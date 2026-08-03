/**
 * 股票数据服务 - 纯前端版
 * 数据源：东方财富公开 API（push2delay / push2his / datacenter / np-anotice-stock）+ 金十数据
 * 汇率数据：open.er-api.com（支持 CORS）
 * 容错方案：所有接口均原生支持 CORS，浏览器直连，无需 CORS 代理
 * 无需后端服务器，所有请求由浏览器直接发起
 *
 * CORS 状态说明（2026-08-03 验证）：
 *   push2delay / push2his / datacenter.eastmoney.com — 原生支持 CORS，浏览器直连
 *   np-anotice-stock.eastmoney.com — 原生支持 CORS，用于公告备选
 *   jin10.com — 原生支持 CORS，用于财经快讯
 */

// ==================== CORS 代理容错（保留备用） ====================
// 当前所有接口均支持 CORS 直连，代理仅作为极端情况降级
// 注意：公共 CORS 代理不稳定，allorigins/codetabs/corsproxy.io/proxy.cors.sh 均已失效或需 API Key
const CORS_PROXIES = [
  {
    name: 'whateverorigin',
    build: (url) => `https://www.whateverorigin.org/get?url=${encodeURIComponent(url)}`,
    parse: (json) => {
      if (json && typeof json.contents === 'string') {
        return JSON.parse(json.contents)
      }
      return json
    },
  },
  {
    name: 'cors.eu.org',
    build: (url) => `https://cors.eu.org/${url}`,
    parse: null,
  },
]

// 缓存可用代理（-1 = 直连，0+ = CORS_PROXIES 索引），避免每次都尝试全部
// 注意：不同 API 可能需要不同代理（如 push2his 对部分代理返回 520），
// 因此缓存仅作为优先尝试项，失败后会重新探测
let _workingProxyIdx = null

/**
 * 通过指定代理获取数据，处理代理特有的响应格式
 */
const _fetchViaProxy = async (proxy, targetUrl, timeout) => {
  const proxyUrl = proxy.build(targetUrl)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(proxyUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    // 如果代理定义了 parse 函数，用它处理响应
    return proxy.parse ? proxy.parse(json) : json
  } catch (e) {
    clearTimeout(timeoutId)
    throw e
  }
}

/**
 * 带容错的 fetch：先直连，失败则依次尝试 CORS 代理
 * 适用于所有第三方 API（东方财富、er-api 等）
 */
const fetchWithFallback = async (targetUrl, timeout = 10000) => {
  // 已知可用方式直接使用（但 push2his 对部分代理返回 520，需要特殊处理）
  if (_workingProxyIdx === -1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(targetUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (e) {
      clearTimeout(timeoutId)
      _workingProxyIdx = null
    }
  } else if (_workingProxyIdx !== null && _workingProxyIdx >= 0) {
    try {
      return await _fetchViaProxy(CORS_PROXIES[_workingProxyIdx], targetUrl, timeout + 5000)
    } catch (e) {
      _workingProxyIdx = null
    }
  }

  // 探测阶段：先试直连，再试代理
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const response = await fetch(targetUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
    clearTimeout(timeoutId)
    if (response.ok) {
      _workingProxyIdx = -1
      return await response.json()
    }
  } catch (e) {
    // 直连失败，继续尝试代理
  }

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const result = await _fetchViaProxy(CORS_PROXIES[i], targetUrl, timeout + 5000)
      _workingProxyIdx = i
      console.log(`[StockService] CORS 代理 ${CORS_PROXIES[i].name} 可用`)
      return result
    } catch (e) {
      // 该代理失败，继续尝试下一个
    }
  }

  throw new Error('所有数据源均不可用（直连 + CORS 代理）')
}

// ==================== 东方财富 API 配置 ====================
const EM_UT = 'bd1d9ddb04089700cf9c27f6f7426281'
const EM_PUSH2 = 'https://push2delay.eastmoney.com'
const EM_PUSH2HIS = 'https://push2his.eastmoney.com'
// datacenter.eastmoney.com 原生支持 CORS（datacenter-WEB 不支持），直连无需代理
const EM_DATACENTER = 'https://datacenter.eastmoney.com/api/data/v1/get'

// ==================== 状态管理 ====================
let _cachedStockData = null
let _cachedMarketStats = null
let _cachedMarketStatsTime = 0
const MARKET_STATS_TTL = 30000

// 慢速接口缓存
const _slowCache = {}
const _slowCacheTime = {}
const SLOW_CACHE_TTL = {
  financing: 300000,      // 5 分钟
  ipo: 3600000,           // 1 小时
  lockup: 3600000,        // 1 小时
  earnings: 3600000,      // 1 小时
  exchangeRates: 600000,  // 10 分钟
  northbound: 300000,     // 5 分钟
  news: 300000,           // 5 分钟（金十/东财公告均支持 CORS 直连）
}

const getSlowCache = (key) => {
  const ttl = SLOW_CACHE_TTL[key] || 300000
  if (_slowCache[key] && Date.now() - _slowCacheTime[key] < ttl) return _slowCache[key]
  return null
}
const setSlowCache = (key, data) => {
  _slowCache[key] = data
  _slowCacheTime[key] = Date.now()
}

// ==================== 通用请求函数 ====================

/**
 * 请求东方财富 push2 clist API
 */
const fetchFromEastMoney = async (params, timeout = 10000) => {
  const qs = new URLSearchParams(params).toString()
  const url = `${EM_PUSH2}/api/qt/clist/get?${qs}`
  const json = await fetchWithFallback(url, timeout)
  return json.data?.diff || []
}

/**
 * 请求东方财富 push2 ulist API（指数）
 */
const fetchUlistFromEastMoney = async (params, timeout = 8000) => {
  const qs = new URLSearchParams(params).toString()
  const url = `${EM_PUSH2}/api/qt/ulist.np/get?${qs}`
  const json = await fetchWithFallback(url, timeout)
  return json
}

/**
 * 请求东方财富 push2his kline API（K线）
 */
const fetchKlineFromEastMoney = async (secid, klt = 101, fqt = 1, beg, end, lmt = 120) => {
  const params = new URLSearchParams({
    secid, klt: String(klt), fqt: String(fqt), beg, end, lmt: String(lmt),
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
  })
  const url = `${EM_PUSH2HIS}/api/qt/stock/kline/get?${params}`
  return await fetchWithFallback(url, 10000)
}

/**
 * 请求东方财富 push2his trends2 API（分时）
 */
const fetchTrendsFromEastMoney = async (secid) => {
  const params = new URLSearchParams({
    secid, fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58', iscr: '0', ndays: '1',
  })
  const url = `${EM_PUSH2HIS}/api/qt/stock/trends2/get?${params}`
  return await fetchWithFallback(url, 10000)
}

/**
 * 请求东方财富 datacenter API
 */
const fetchFromDatacenter = async (reportName, extraParams = {}, timeout = 15000) => {
  const params = new URLSearchParams({
    reportName, columns: 'ALL', source: 'WEB', pageSize: '20', pageNumber: '1',
    ...extraParams,
  })
  const url = `${EM_DATACENTER}?${params}`
  const json = await fetchWithFallback(url, timeout)
  if (!json.success) throw new Error(json.message || 'datacenter 请求失败')
  return json.result?.data || []
}

/**
 * 获取财经新闻 — 基于东财 datacenter 公告数据（支持 CORS 直连）
 * 由于 np-weblist / jin10.com 浏览器端不可用，改用 datacenter 的财报、IPO、解禁数据构建新闻流
 */
const fetchNewsFromDatacenter = async () => {
  // 并行获取三类公告数据，合成为新闻流
  const [earnings, ipo, lockup] = await Promise.allSettled([
    fetchFromDatacenter('RPT_LICO_FN_CPD', {
      columns: 'SECURITY_CODE,SECURITY_NAME_ABBR,NOTICE_DATE,SJLTZ',
      sortColumns: 'NOTICE_DATE', sortTypes: '-1', pageSize: '8',
    }, 12000),
    fetchFromDatacenter('RPT_NEWSTOCK_ISSUEINFO', {
      columns: 'SECURITY_NAME_ABBR,SECUCODE,DAT_ZHAOGURIQI,ISSUE_PRICE',
      sortColumns: 'DAT_ZHAOGURIQI', sortTypes: '-1', pageSize: '4',
    }, 12000),
    fetchFromDatacenter('RPT_LIFT_STAGE', {
      columns: 'SECURITY_NAME_ABBR,SECURITY_CODE,FREE_DATE,CURRENT_FREE_SHARES,LIFT_MARKET_CAP',
      sortColumns: 'FREE_DATE', sortTypes: '1', pageSize: '4',
    }, 12000),
  ])

  const news = []

  // 财报快报
  if (earnings.status === 'fulfilled' && earnings.value?.length > 0) {
    for (const row of earnings.value) {
      const change = Number(row.SJLTZ) || 0
      const changeStr = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`
      news.push({
        title: `${row.SECURITY_NAME_ABBR || '--'}发布业绩快报，利润变动${changeStr}`,
        content: `${row.SECURITY_NAME_ABBR || '--'}（${row.SECURITY_CODE || '--'}）发布最新业绩快报，净利润同比变动${changeStr}。`,
        time: (String(row.NOTICE_DATE || '').slice(0, 16)) || '--',
        url: '#',
        source: '东方财富',
      })
    }
  }

  // 新股申购
  if (ipo.status === 'fulfilled' && ipo.value?.length > 0) {
    for (const row of ipo.value) {
      const price = row.ISSUE_PRICE ? `发行价${row.ISSUE_PRICE}元` : '发行价待定'
      news.push({
        title: `${row.SECURITY_NAME_ABBR || '--'}新股申购，${price}`,
        content: `${row.SECURITY_NAME_ABBR || '--'}将于${String(row.DAT_ZHAOGURIQI || '').slice(0, 10)}开始申购，${price}。`,
        time: (String(row.DAT_ZHAOGURIQI || '').slice(0, 16)) || '--',
        url: '#',
        source: '东方财富',
      })
    }
  }

  // 解禁提醒
  if (lockup.status === 'fulfilled' && lockup.value?.length > 0) {
    for (const row of lockup.value) {
      const value = Number(row.LIFT_MARKET_CAP) || 0
      const valueStr = value >= 1e8 ? `${(value / 1e8).toFixed(1)}亿` : value >= 1e4 ? `${(value / 1e4).toFixed(0)}万` : ''
      news.push({
        title: `${row.SECURITY_NAME_ABBR || '--'}限售股解禁${valueStr ? '，市值' + valueStr : ''}`,
        content: `${row.SECURITY_NAME_ABBR || '--'}（${row.SECURITY_CODE || '--'}）将于${String(row.FREE_DATE || '').slice(0, 10)}解禁限售股${valueStr ? '，解禁市值' + valueStr : ''}。`,
        time: (String(row.FREE_DATE || '').slice(0, 16)) || '--',
        url: '#',
        source: '东方财富',
      })
    }
  }

  // 按时间倒序排列
  news.sort((a, b) => (b.time || '').localeCompare(a.time || ''))
  return news
}

// ==================== 格式化工具 ====================
const formatVolume = (vol) => {
  if (vol == null || vol === '-') return '--'
  if (vol >= 100000000) return (vol / 100000000).toFixed(2) + '亿'
  if (vol >= 10000) return (vol / 10000).toFixed(0) + '万'
  return String(vol)
}

const formatMoney = (num) => {
  if (num == null || num === '-') return '--'
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿'
  if (num >= 10000) return (num / 10000).toFixed(0) + '万'
  return num.toFixed(0)
}

const formatMarketCap = (num) => {
  if (num == null) return '--'
  if (num >= 1000000000000) return (num / 1000000000000).toFixed(2) + '万亿'
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿'
  return num.toFixed(0) + '万'
}

/**
 * 股票代码转 secid（东方财富格式）
 * 沪市 6/9 开头 → 1.code，深市 0/3 开头 → 0.code，北交所 8/4 开头 → 0.code
 */
const codeToSecid = (code) => {
  const c = String(code).padStart(6, '0')
  if (c.startsWith('6') || c.startsWith('9')) return `1.${c}`
  return `0.${c}`
}

// ==================== 数据源函数 ====================

/**
 * 从东方财富获取全市场股票行情（按总市值降序，取前100）
 * 注意：push2delay clist 每页最多返回100条，pz>100 无效
 */
const fetchStockListFromEastMoney = async () => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: 100, po: 1, np: 1,
    ut: EM_UT, fltt: 2, invt: 2,
    fid: 'f20',
    fs: 'm:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23,m:0 t:81 s:2048',
    fields: 'f2,f3,f4,f5,f6,f7,f8,f9,f12,f14,f15,f16,f17,f18,f20,f23',
  })
  return items.map(item => ({
    code: String(item.f12 || '').padStart(6, '0'),
    name: item.f14 || '--',
    price: item.f2 != null && item.f2 !== '-' ? item.f2.toFixed(2) : '--',
    change: item.f4 != null && item.f4 !== '-' ? item.f4.toFixed(2) : '--',
    changePercent: item.f3 != null && item.f3 !== '-' ? item.f3.toFixed(2) : '0.00',
    volume: formatVolume(item.f5),
    turnover: formatMoney(item.f6),
    amplitude: item.f7 != null ? item.f7.toFixed(2) : '0.00',
    turnoverRate: item.f8 != null ? item.f8.toFixed(2) : '0.00',
    pe: item.f9 != null && item.f9 !== '-' ? item.f9.toFixed(2) : '--',
    high: item.f15 != null && item.f15 !== '-' ? item.f15.toFixed(2) : '--',
    low: item.f16 != null && item.f16 !== '-' ? item.f16.toFixed(2) : '--',
    open: item.f17 != null && item.f17 !== '-' ? item.f17.toFixed(2) : '--',
    prevClose: item.f18 != null && item.f18 !== '-' ? item.f18.toFixed(2) : '--',
    marketCap: formatMarketCap(item.f20),
    pb: item.f23 != null && item.f23 !== '-' ? item.f23.toFixed(2) : '--',
    industry: '--',
    sector: '--',
  })).filter(s => s.price !== '--' && s.price !== '0.00')
}

/**
 * 根据股票代码和名称判断涨跌停阈值
 * 北交所(8/4/920开头): ±30%，创业板(300/301)/科创板(688/689): ±20%（ST同限）
 * 主板: ST/*ST ±5%，普通 ±10%
 */
const getLimitThreshold = (code, name) => {
  const c = String(code).padStart(6, '0')
  const n = name || ''
  // 北交所: ±30%（ST同限）
  if (c.startsWith('8') || c.startsWith('4') || c.startsWith('920')) return 30
  // 创业板/科创板: ±20%（ST同限）
  if (c.startsWith('300') || c.startsWith('301') || c.startsWith('688') || c.startsWith('689')) return 20
  // 主板: ST ±5%，普通 ±10%
  if (n.includes('ST') || n.includes('*ST')) return 5
  return 10
}

/**
 * 判断是否为新股上市首日（无涨跌停限制）
 * N/C 前缀为上市首日/次日，摘牌为退市股，均不计入涨跌停统计
 */
const isNoLimitStock = (name) => {
  const n = name || ''
  return n.startsWith('N') || n.startsWith('C') || n.includes('摘牌')
}

/**
 * 全市场 fs 参数（沪深主板 + 创业板 + 科创板 + 北交所）
 */
const MARKET_FS = 'm:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23,m:0 t:81 s:2048'

/**
 * 从东方财富获取全市场涨跌统计
 * 涨跌家数：来自指数 API 的 f104(上涨家数)/f105(下跌家数)，覆盖全市场
 * 涨跌停数：按涨跌幅排序取前100只，按板块阈值计算（涨停股均在涨幅前100内）
 * 注意：push2delay clist 每页最多返回100条，无法一次获取全市场5800+只股票
 */
const fetchMarketStatsFromEastMoney = async () => {
  if (_cachedMarketStats && Date.now() - _cachedMarketStatsTime < MARKET_STATS_TTL) return _cachedMarketStats

  // 并行请求：指数涨跌家数 + 涨幅前100 + 跌幅前100
  const [indexJson, gainersJson, losersJson] = await Promise.all([
    fetchUlistFromEastMoney({
      fltt: '2', invt: '2',
      fields: 'f104,f105,f12',
      secids: '1.000001,0.399001',
    }),
    fetchWithFallback(`${EM_PUSH2}/api/qt/clist/get?${new URLSearchParams({
      pn: '1', pz: '100', po: '1', np: '1',
      ut: EM_UT, fltt: '2', invt: '2',
      fid: 'f3', fs: MARKET_FS, fields: 'f3,f12,f14',
    })}`, 10000),
    fetchWithFallback(`${EM_PUSH2}/api/qt/clist/get?${new URLSearchParams({
      pn: '1', pz: '100', po: '0', np: '1',
      ut: EM_UT, fltt: '2', invt: '2',
      fid: 'f3', fs: MARKET_FS, fields: 'f3,f12,f14',
    })}`, 10000),
  ])

  // 涨跌家数（上证覆盖沪市，深证覆盖深市，合计覆盖全A股）
  const indexItems = indexJson?.data?.diff || []
  const shIdx = indexItems.find(i => i.f12 === '000001') || {}
  const szIdx = indexItems.find(i => i.f12 === '399001') || {}
  const upCount = (shIdx.f104 || 0) + (szIdx.f104 || 0)
  const downCount = (shIdx.f105 || 0) + (szIdx.f105 || 0)
  const totalStocks = gainersJson?.data?.total || 5500
  const flatCount = Math.max(0, totalStocks - upCount - downCount)

  // 涨跌停：按板块阈值计算（预留0.2%容差应对价格取整）
  const gainers = gainersJson?.data?.diff || []
  const losers = losersJson?.data?.diff || []

  let limitUpCount = 0, limitDownCount = 0
  for (const item of gainers) {
    const change = item.f3
    if (change == null || change === '-') continue
    if (isNoLimitStock(item.f14)) continue
    const threshold = getLimitThreshold(item.f12, item.f14)
    if (change >= threshold - 0.2) limitUpCount++
  }
  for (const item of losers) {
    const change = item.f3
    if (change == null || change === '-') continue
    if (isNoLimitStock(item.f14)) continue
    const threshold = getLimitThreshold(item.f12, item.f14)
    if (change <= -(threshold - 0.2)) limitDownCount++
  }

  _cachedMarketStats = { upCount, downCount, flatCount, limitUpCount, limitDownCount, bombCount: 0 }
  _cachedMarketStatsTime = Date.now()
  return _cachedMarketStats
}

/**
 * 从东方财富获取行业板块数据
 */
const fetchSectorDataFromEastMoney = async () => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: 100, po: 1, np: 1,
    ut: EM_UT, fltt: 2, invt: 2,
    fid: 'f3',
    fs: 'm:90 t:2 f:!50',
    fields: 'f2,f3,f4,f8,f12,f14,f104,f105,f128,f136,f140,f168',
  })
  const result = items.map(item => ({
    name: item.f14 || '--',
    avgChange: item.f3 != null ? item.f3.toFixed(2) : '0.00',
    upCount: item.f104 || 0,
    downCount: item.f105 || 0,
    count: (item.f104 || 0) + (item.f105 || 0),
    totalVolume: formatMoney(item.f168),
    topStock: item.f128 || '--',
    topStockChange: item.f136 != null ? item.f136.toFixed(2) : '0.00',
  }))
  result.sort((a, b) => parseFloat(b.avgChange) - parseFloat(a.avgChange))
  const top = result.slice(0, 15)
  const bottom = result.slice(-15)
  const seen = new Set()
  const merged = []
  for (const s of [...top, ...bottom]) {
    if (!seen.has(s.name)) { seen.add(s.name); merged.push(s) }
  }
  return merged
}

/**
 * 从东方财富获取涨跌排行
 */
const fetchRankingFromEastMoney = async (direction, count = 15) => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: count, po: direction === 'up' ? 1 : 0, np: 1,
    ut: EM_UT, fltt: 2, invt: 2,
    fid: 'f3',
    fs: 'm:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23,m:0 t:81 s:2048',
    fields: 'f2,f3,f4,f5,f6,f12,f14',
  })
  return items.map(item => ({
    code: String(item.f12 || '').padStart(6, '0'),
    name: item.f14 || '--',
    price: item.f2 != null && item.f2 !== '-' ? item.f2.toFixed(2) : '--',
    changePercent: item.f3 != null && item.f3 !== '-' ? item.f3.toFixed(2) : '0.00',
    change: item.f4 != null && item.f4 !== '-' ? item.f4.toFixed(2) : '--',
    volume: formatVolume(item.f5),
    turnover: formatMoney(item.f6),
    industry: '--',
    sector: '--',
  }))
}

/**
 * 从东方财富获取资金流向排行（按主力净流入金额排序）
 */
const fetchFundFlowFromEastMoney = async (direction, count = 15) => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: count, po: direction === 'inflow' ? 1 : 0, np: 1,
    ut: 'b2884a393a59ad64002292a3e90d46a5', fltt: 2, invt: 2,
    fid: 'f62',
    fs: 'm:0 t:6 f:!2,m:0 t:13 f:!2,m:0 t:80 f:!2,m:1 t:2 f:!2,m:1 t:23 f:!2,m:0 t:7 f:!2,m:1 t:3 f:!2',
    fields: 'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124',
  })
  return items.map(item => ({
    code: String(item.f12 || '').padStart(6, '0'),
    name: item.f14 || '--',
    price: item.f2 != null ? Number(item.f2) : 0,
    changePercent: item.f3 != null ? Number(item.f3) : 0,
    mainNetInflow: item.f62 != null ? Number(item.f62) : 0,
    mainNetInflowPct: item.f184 != null ? Number(item.f184) : 0,
    superLargeNetInflow: item.f66 != null ? Number(item.f66) : 0,
    largeNetInflow: item.f72 != null ? Number(item.f72) : 0,
    mediumNetInflow: item.f78 != null ? Number(item.f78) : 0,
    smallNetInflow: item.f84 != null ? Number(item.f84) : 0,
  }))
}

/**
 * 从东方财富获取主力净流入占比排行（按占比排序）
 */
const fetchFundFlowPctFromEastMoney = async (direction, count = 15) => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: count, po: direction === 'inflow' ? 1 : 0, np: 1,
    ut: 'b2884a393a59ad64002292a3e90d46a5', fltt: 2, invt: 2,
    fid: 'f184',
    fs: 'm:0 t:6 f:!2,m:0 t:13 f:!2,m:0 t:80 f:!2,m:1 t:2 f:!2,m:1 t:23 f:!2,m:0 t:7 f:!2,m:1 t:3 f:!2',
    fields: 'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124',
  })
  return items.map(item => ({
    code: String(item.f12 || '').padStart(6, '0'),
    name: item.f14 || '--',
    price: item.f2 != null ? Number(item.f2) : 0,
    changePercent: item.f3 != null ? Number(item.f3) : 0,
    mainNetInflow: item.f62 != null ? Number(item.f62) : 0,
    mainNetInflowPct: item.f184 != null ? Number(item.f184) : 0,
    superLargeNetInflow: item.f66 != null ? Number(item.f66) : 0,
    largeNetInflow: item.f72 != null ? Number(item.f72) : 0,
    mediumNetInflow: item.f78 != null ? Number(item.f78) : 0,
    smallNetInflow: item.f84 != null ? Number(item.f84) : 0,
  }))
}

/**
 * 从东方财富获取大盘指数实时数据
 */
const fetchIndexFromEastMoney = async () => {
  const json = await fetchUlistFromEastMoney({
    fltt: '2', invt: '2',
    fields: 'f2,f3,f4,f6,f12,f14',
    secids: '1.000001,0.399001,0.399006',
  })
  if (!json.data?.diff) throw new Error('指数数据为空')
  const items = json.data.diff
  return {
    shIndex: { value: items[0].f2, change: items[0].f3, name: items[0].f14 },
    szIndex: { value: items[1].f2, change: items[1].f3, name: items[1].f14 },
    cyIndex: { value: items[2].f2, change: items[2].f3, name: items[2].f14 },
  }
}

/**
 * 从东方财富 datacenter 获取融资融券数据
 * RPTA_WEB_RZRQ_GGMX 返回个股明细（非汇总），需按日期聚合
 * 每页最多500条，每天约1500只个股，需3页获取完整一天
 * 并行获取沪深两市各3页，聚合得到最新交易日汇总
 */
const fetchFinancingFromDatacenter = async () => {
  // 并行获取沪市3页 + 深市3页
  const pages = [1, 2, 3]
  const [shResults, szResults] = await Promise.all([
    Promise.all(pages.map(pg => fetchFromDatacenter('RPTA_WEB_RZRQ_GGMX', {
      columns: 'DATE,MARKET,RZYE,RZMRE,RZJME',
      sortColumns: 'DATE', sortTypes: '-1',
      pageSize: '500', pageNumber: String(pg),
      filter: '(MARKET="融资融券_沪证")',
    }, 15000).catch(() => []))),
    Promise.all(pages.map(pg => fetchFromDatacenter('RPTA_WEB_RZRQ_GGMX', {
      columns: 'DATE,MARKET,RZYE,RZMRE,RZJME',
      sortColumns: 'DATE', sortTypes: '-1',
      pageSize: '500', pageNumber: String(pg),
      filter: '(MARKET="融资融券_深证")',
    }, 15000).catch(() => []))),
  ])

  const allData = [...shResults.flat(), ...szResults.flat()]
  if (allData.length === 0) {
    return { balance: 0, buy: 0, repay: 0, net: 0, timeSharing: [] }
  }

  // 按日期聚合
  const byDate = {}
  for (const row of allData) {
    const dateStr = String(row.DATE || '').slice(0, 10)
    if (!dateStr) continue
    if (!byDate[dateStr]) byDate[dateStr] = { balance: 0, buy: 0, net: 0 }
    byDate[dateStr].balance += Number(row.RZYE) || 0
    byDate[dateStr].buy += Number(row.RZMRE) || 0
    byDate[dateStr].net += Number(row.RZJME) || 0
  }

  const dates = Object.keys(byDate).sort()
  const recent = dates.slice(-20)
  const timeSharing = recent.map(d => ({
    date: d.slice(5),
    balance: byDate[d].balance,
    net: byDate[d].net,
  }))

  const latest = recent.length > 0 ? byDate[recent[recent.length - 1]] : { balance: 0, buy: 0, net: 0 }
  return {
    balance: latest.balance,
    buy: latest.buy,
    repay: latest.buy - latest.net,
    net: latest.net,
    timeSharing,
  }
}

/**
 * 从东方财富 datacenter 获取 IPO 新股日历
 */
const fetchIPOFromDatacenter = async () => {
  const data = await fetchFromDatacenter('RPT_NEWSTOCK_ISSUEINFO', {
    sortColumns: 'DAT_ZHAOGURIQI',
    sortTypes: '-1',
    pageSize: '200',
  }, 15000)

  const mapped = data.map(row => {
    const applyDate = String(row.DAT_ZHAOGURIQI || '').slice(0, 10)
    return {
      name: row.SECURITY_NAME_ABBR || '--',
      code: String(row.SECUCODE || '').split('.')[0] || '--',
      industry: null,
      price: row.ISSUE_PRICE != null ? Number(row.ISSUE_PRICE) : null,
      pe: row.PE_RATIO_AFTER != null ? Number(row.PE_RATIO_AFTER) : null,
      applyDate,
      listDate: null,
      status: null,
    }
  })

  // 去重：同一股票代码只保留一条（最新申购日）
  const seen = new Set()
  return mapped.filter(item => {
    if (seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}

/**
 * 从东方财富 datacenter 获取解禁日历
 */
const fetchLockupFromDatacenter = async () => {
  const now = new Date()
  const startDate = now.toISOString().slice(0, 10)
  const futureDate = new Date(now)
  futureDate.setMonth(futureDate.getMonth() + 2)
  const endDate = futureDate.toISOString().slice(0, 10)

  const data = await fetchFromDatacenter('RPT_LIFT_STAGE', {
    sortColumns: 'FREE_DATE',
    sortTypes: '1',
    pageSize: '30',
    filter: `(FREE_DATE>='${startDate}')(FREE_DATE<='${endDate}')`,
  }, 15000)

  const mapped = data.map(row => ({
    name: row.SECURITY_NAME_ABBR || '--',
    code: row.SECURITY_CODE || '--',
    type: row.FREE_SHARES_TYPE || '--',
    date: String(row.FREE_DATE || '').slice(0, 10),
    volume: Math.round((Number(row.CURRENT_FREE_SHARES) || 0) / 1e4, 1),
    marketValue: Math.round((Number(row.LIFT_MARKET_CAP) || 0) / 1e4, 1),
  }))

  // 去重：同一股票代码只保留一条（最近解禁日）
  const seen = new Set()
  return mapped.filter(item => {
    if (seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}

/**
 * 从东方财富 datacenter 获取财报日历
 */
const fetchEarningsFromDatacenter = async () => {
  const now = new Date()
  const month = now.getMonth() + 1
  let quarterDate
  if (month <= 3) quarterDate = `${now.getFullYear() - 1}-12-31`
  else if (month <= 6) quarterDate = `${now.getFullYear()}-03-31`
  else if (month <= 9) quarterDate = `${now.getFullYear()}-06-30`
  else quarterDate = `${now.getFullYear()}-09-30`

  const data = await fetchFromDatacenter('RPT_LICO_FN_CPD', {
    sortColumns: 'NOTICE_DATE',
    sortTypes: '-1',
    pageSize: '20',
    filter: `(REPORTDATE='${quarterDate}')`,
  }, 15000)

  const mapped = data.map(row => ({
    name: row.SECURITY_NAME_ABBR || '--',
    code: row.SECURITY_CODE || '--',
    type: '业绩快报',
    date: String(row.NOTICE_DATE || '').slice(0, 10),
    changePercent: Number(row.SJLTZ) || 0,
  }))

  // 去重：同一股票代码只保留一条（最新披露日）
  const seen = new Set()
  return mapped.filter(item => {
    if (seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}

/**
 * 北向资金数据已于 2024-08-19 停止发布
 * NET_DEAL_AMT/BUY_AMT/SELL_AMT 字段全部为 null，仅 DEAL_AMT（成交额）有值
 * 返回空数据，由组件显示"数据已停发"提示
 */
const fetchNorthboundFromDatacenter = async () => {
  return { sh: [], sz: [], total: [], updateTime: '2024-08-19 停发' }
}

/**
 * 从 open.er-api.com 获取汇率数据
 * 返回美元、欧元、日元、英镑、港元兑人民币汇率
 */
const fetchExchangeRatesFromER = async () => {
  const url = 'https://open.er-api.com/v6/latest/USD'
  const json = await fetchWithFallback(url, 10000)

  if (json.result !== 'success') throw new Error('汇率API返回失败')

  const cny = json.rates.CNY
  const eur = json.rates.EUR
  const jpy = json.rates.JPY
  const gbp = json.rates.GBP
  const hkd = json.rates.HKD

  if (!cny) throw new Error('未找到CNY汇率')

  // 计算各货币兑人民币汇率（USD/CNY 已知，其他货币/CNY = (USD/CNY) / (USD/XXX)）
  const result = [
    { name: '美元/人民币', code: 'USDCNY', rate: cny.toFixed(4), change: '0.00' },
  ]
  if (eur) result.push({ name: '欧元/人民币', code: 'EURCNY', rate: (cny / eur).toFixed(4), change: '0.00' })
  if (jpy) result.push({ name: '日元/人民币', code: 'JPYCNY', rate: (cny / jpy).toFixed(4), change: '0.00' })
  if (gbp) result.push({ name: '英镑/人民币', code: 'GBPCNY', rate: (cny / gbp).toFixed(4), change: '0.00' })
  if (hkd) result.push({ name: '港元/人民币', code: 'HKDCNY', rate: (cny / hkd).toFixed(4), change: '0.00' })

  return result
}

// ==================== 公开 API ====================

/**
 * 获取所有股票行情数据（全市场实时）
 */
export const getAllStockData = async (forceRefresh = false) => {
  if (forceRefresh) _cachedStockData = null
  if (_cachedStockData && !forceRefresh) return _cachedStockData

  try {
    const data = await fetchStockListFromEastMoney()
    if (data.length > 0) {
      _cachedStockData = data
      return _cachedStockData
    }
  } catch (e) {
    console.warn('[StockService] 获取股票数据失败:', e?.message)
  }
  return []
}

/**
 * 获取大盘分析数据（指数 + 涨跌家数）
 */
export const getMarketAnalysis = async () => {
  try {
    const [indexData, stats] = await Promise.all([
      fetchIndexFromEastMoney(),
      fetchMarketStatsFromEastMoney(),
    ])
    return {
      shIndex: { value: indexData.shIndex.value?.toFixed(2) || '--', change: indexData.shIndex.change?.toFixed(2) || '0.00', name: '上证指数' },
      szIndex: { value: indexData.szIndex.value?.toFixed(2) || '--', change: indexData.szIndex.change?.toFixed(2) || '0.00', name: '深证成指' },
      cyIndex: { value: indexData.cyIndex.value?.toFixed(2) || '--', change: indexData.cyIndex.change?.toFixed(2) || '0.00', name: '创业板指' },
      upCount: stats.upCount,
      downCount: stats.downCount,
      flatCount: stats.flatCount,
      limitUpCount: stats.limitUpCount,
      limitDownCount: stats.limitDownCount,
      northBoundFlow: '--',
      totalVolume: '--',
      marketSentiment: stats.upCount > stats.downCount ? '偏多' : stats.downCount > stats.upCount * 1.2 ? '偏空' : '震荡',
    }
  } catch (e) {
    console.warn('[StockService] 市场分析失败:', e?.message)
    return {
      shIndex: { value: '--', change: '0.00', name: '上证指数' },
      szIndex: { value: '--', change: '0.00', name: '深证成指' },
      cyIndex: { value: '--', change: '0.00', name: '创业板指' },
      upCount: 0, downCount: 0, flatCount: 0,
      limitUpCount: 0, limitDownCount: 0,
      northBoundFlow: '--', totalVolume: '--', marketSentiment: '--',
    }
  }
}

/**
 * 获取市场情绪数据（涨跌家数、涨跌停、炸板）
 */
export const getMarketSentiment = async () => {
  try {
    const stats = await fetchMarketStatsFromEastMoney()
    if (stats.upCount > 0 || stats.downCount > 0) {
      return { ...stats, timeSharing: null }
    }
  } catch (e) {
    console.warn('[StockService] 市场情绪失败:', e?.message)
  }
  return {
    upCount: 0, downCount: 0, flatCount: 0,
    limitUpCount: 0, limitDownCount: 0, bombCount: 0,
    timeSharing: null,
  }
}

/**
 * 获取北向资金数据
 */
export const getNorthboundCapital = async () => {
  const cached = getSlowCache('northbound')
  if (cached) return cached
  try {
    const data = await fetchNorthboundFromDatacenter()
    if (data.total.length > 0) {
      setSlowCache('northbound', data)
      return data
    }
  } catch (e) {
    console.warn('[StockService] 北向资金获取失败:', e?.message)
  }
  return { sh: [], sz: [], total: [], updateTime: '--' }
}

/**
 * 获取融资数据
 */
export const getFinancingData = async () => {
  const cached = getSlowCache('financing')
  if (cached) return cached
  try {
    const data = await fetchFinancingFromDatacenter()
    if (data.balance > 0) {
      setSlowCache('financing', data)
      return data
    }
  } catch (e) {
    console.warn('[StockService] 融资数据获取失败:', e?.message)
  }
  return { balance: 0, buy: 0, repay: 0, net: 0, timeSharing: [] }
}

/**
 * 获取IPO日历
 */
export const getIPOCalendar = async () => {
  const cached = getSlowCache('ipo')
  if (cached) return cached
  try {
    const data = await fetchIPOFromDatacenter()
    if (data.length > 0) {
      setSlowCache('ipo', data)
      return data
    }
  } catch (e) {
    console.warn('[StockService] IPO日历获取失败:', e?.message)
  }
  return []
}

/**
 * 获取解禁日历
 */
export const getLockupCalendar = async () => {
  const cached = getSlowCache('lockup')
  if (cached) return cached
  try {
    const data = await fetchLockupFromDatacenter()
    if (data.length > 0) {
      setSlowCache('lockup', data)
      return data
    }
  } catch (e) {
    console.warn('[StockService] 解禁日历获取失败:', e?.message)
  }
  return []
}

/**
 * 获取财报日历
 */
export const getEarningsCalendar = async () => {
  const cached = getSlowCache('earnings')
  if (cached) return cached
  try {
    const data = await fetchEarningsFromDatacenter()
    if (data.length > 0) {
      setSlowCache('earnings', data)
      return data
    }
  } catch (e) {
    console.warn('[StockService] 财报日历获取失败:', e?.message)
  }
  return []
}

/**
 * 获取全球指数
 */
export const getGlobalIndices = async () => {
  try {
    const items = await fetchFromEastMoney({
      pn: 1, pz: 20, po: 1, np: 1,
      ut: EM_UT, fltt: 2, invt: 2,
      fid: 'f3',
      fs: 'i:100.HSI,i:100.N225,i:100.DJIA,i:100.SPX,i:100.NDX,i:100.FTSE,i:100.GDAXI,i:100.KS11',
      fields: 'f2,f3,f4,f12,f14',
    })
    if (items.length > 0) {
      return items.map(item => ({
        code: item.f12,
        name: item.f14,
        value: item.f2?.toFixed(2) || '--',
        changePercent: item.f3?.toFixed(2) || '0.00',
      }))
    }
  } catch (e) {
    console.warn('[StockService] 全球指数获取失败:', e?.message)
  }
  return []
}

/**
 * 获取汇率数据
 */
export const getExchangeRates = async () => {
  const cached = getSlowCache('exchangeRates')
  if (cached) return cached
  try {
    const data = await fetchExchangeRatesFromER()
    if (data.length > 0) {
      setSlowCache('exchangeRates', data)
      return data
    }
  } catch (e) {
    console.warn('[StockService] 汇率获取失败:', e?.message)
  }
  return []
}

/**
 * 获取板块热力图数据
 */
export const getSectorHeatmap = async () => {
  try {
    const data = await fetchSectorDataFromEastMoney()
    if (data.length > 0) return data
  } catch (e) {
    console.warn('[StockService] 板块热力图失败:', e?.message)
  }
  return []
}

/**
 * 获取涨幅/跌幅排行
 */
export const getPriceRanking = async () => {
  try {
    const [up, down] = await Promise.all([
      fetchRankingFromEastMoney('up', 15),
      fetchRankingFromEastMoney('down', 15),
    ])
    return { up, down }
  } catch (e) {
    console.warn('[StockService] 涨跌排行失败:', e?.message)
  }
  return { up: [], down: [] }
}

/**
 * 获取资金流向排行
 */
export const getCapitalRanking = async () => {
  try {
    const [inflow, outflow] = await Promise.all([
      fetchFundFlowFromEastMoney('inflow', 15),
      fetchFundFlowFromEastMoney('outflow', 15),
    ])
    return {
      inflow: inflow.map(s => ({ ...s })),
      outflow: outflow.map(s => ({ ...s })),
    }
  } catch (e) {
    console.warn('[StockService] 资金流向排行失败:', e?.message)
  }
  return { inflow: [], outflow: [] }
}

/**
 * 获取主力动向排行（按主力净流入占比排序）
 */
export const getNorthboundRanking = async () => {
  try {
    const [inflow, outflow] = await Promise.all([
      fetchFundFlowPctFromEastMoney('inflow', 15),
      fetchFundFlowPctFromEastMoney('outflow', 15),
    ])
    if (inflow.length > 0 || outflow.length > 0) {
      return { increase: inflow, decrease: outflow }
    }
  } catch (e) {
    console.warn('[StockService] 主力占比排行失败:', e?.message)
  }
  // 降级：使用资金排行数据
  const data = await getCapitalRanking()
  return {
    increase: data.inflow || [],
    decrease: data.outflow || [],
  }
}

/**
 * 获取重要财经新闻
 * 数据源：东财 datacenter（财报快报 + IPO + 解禁），支持 CORS 直连，无需代理
 */
export const getFinancialNews = async () => {
  const cached = getSlowCache('news')
  if (cached) return cached
  try {
    const newsList = await fetchNewsFromDatacenter()
    if (newsList.length > 0) {
      const result = newsList.slice(0, 15)
      setSlowCache('news', result)
      return result
    }
  } catch (e) {
    console.warn('[StockService] 新闻获取失败:', e?.message)
  }
  return []
}

/**
 * 重置缓存（手动刷新时调用）
 */
export const resetAkshareCheck = () => {
  _cachedStockData = null
  _cachedMarketStats = null
  _cachedMarketStatsTime = 0
  Object.keys(_slowCache).forEach(k => { _slowCache[k] = null })
}
