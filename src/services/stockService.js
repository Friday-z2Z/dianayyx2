/**
 * 股票数据服务 - 纯前端版
 * 数据源：东方财富公开 API（push2delay / push2his / datacenter-web / np-weblist）
 * 汇率数据：open.er-api.com（支持 CORS）
 * 容错方案：直连失败自动切换公共 CORS 代理（allorigins / codetabs / corsproxy）
 * 无需后端服务器，所有请求由浏览器直接发起
 */

// ==================== CORS 代理容错 ====================
// 部分东方财富 API 不支持 CORS，直连失败时依次尝试公共代理
const CORS_PROXIES = [
  { name: 'allorigins', build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { name: 'codetabs',   build: (url) => `https://api.codetabs.com/v1/proxy/?quest=${url}` },
  { name: 'corsproxy',  build: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}` },
]

// 缓存可用代理（-1 = 直连，0+ = CORS_PROXIES 索引），避免每次都尝试全部
let _workingProxyIdx = null

/**
 * 带容错的 fetch：先直连，失败则依次尝试 CORS 代理
 * 适用于所有第三方 API（东方财富、er-api 等）
 */
const fetchWithFallback = async (targetUrl, timeout = 10000) => {
  // 已知可用方式直接使用
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
    const proxy = CORS_PROXIES[_workingProxyIdx]
    const proxyUrl = proxy.build(targetUrl)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout + 5000)
    try {
      const response = await fetch(proxyUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (e) {
      clearTimeout(timeoutId)
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
    const proxy = CORS_PROXIES[i]
    const proxyUrl = proxy.build(targetUrl)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout + 5000)
    try {
      const response = await fetch(proxyUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
      clearTimeout(timeoutId)
      if (response.ok) {
        _workingProxyIdx = i
        console.log(`[StockService] CORS 代理 ${proxy.name} 可用`)
        return await response.json()
      }
    } catch (e) {
      clearTimeout(timeoutId)
    }
  }

  throw new Error('所有数据源均不可用（直连 + 3 个 CORS 代理）')
}

// ==================== 东方财富 API 配置 ====================
const EM_UT = 'bd1d9ddb04089700cf9c27f6f7426281'
const EM_PUSH2 = 'https://push2delay.eastmoney.com'
const EM_PUSH2HIS = 'https://push2his.eastmoney.com'
const EM_DATACENTER = 'https://datacenter-web.eastmoney.com/api/data/v1/get'
const EM_NEWS_URL = 'https://np-weblist.eastmoney.com/comm/web/getFastNewsList'

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
  news: 120000,           // 2 分钟
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
 * 请求东方财富新闻 API
 */
const fetchNewsFromEastMoney = async () => {
  const params = new URLSearchParams({
    client: 'web', biz: 'web_724', fastColumn: '102', sortEnd: '', pageSize: '20',
    req_trace: String(Date.now()),
  })
  const url = `${EM_NEWS_URL}?${params}`
  const json = await fetchWithFallback(url, 10000)
  return json.data?.fastNewsList || []
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
 * 从东方财富获取全市场股票行情（按总市值降序，取前200）
 */
const fetchStockListFromEastMoney = async () => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: 200, po: 1, np: 1,
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
 * 从东方财富获取全市场涨跌统计
 */
const fetchMarketStatsFromEastMoney = async () => {
  if (_cachedMarketStats && Date.now() - _cachedMarketStatsTime < MARKET_STATS_TTL) return _cachedMarketStats
  const allItems = await fetchFromEastMoney({
    pn: 1, pz: 5500, po: 1, np: 1,
    ut: EM_UT, fltt: 2, invt: 2,
    fid: 'f12',
    fs: 'm:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23,m:0 t:81 s:2048',
    fields: 'f3',
  }, 15000)
  const changes = allItems.map(i => i.f3).filter(v => v != null && v !== '-')
  const upCount = changes.filter(v => v > 0).length
  const downCount = changes.filter(v => v < 0).length
  const flatCount = changes.filter(v => v === 0).length
  const limitUpCount = changes.filter(v => v >= 9.9).length
  const limitDownCount = changes.filter(v => v <= -9.9).length
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
 * 返回最近20个交易日的融资余额、融资买入额、净买入额及时间序列
 */
const fetchFinancingFromDatacenter = async () => {
  // 获取上交所融资融券汇总数据（按日期排序）
  const data = await fetchFromDatacenter('RPTA_WEB_RZRQ_GGMX', {
    columns: 'DATE,MARKET,RZYE,RZMRE,RZJME,RZCHE',
    sortColumns: 'DATE',
    sortTypes: '-1',
    pageSize: '500',
    filter: "(MARKET=\"融资融券_沪证\")",
  }, 15000)

  if (!data || data.length === 0) {
    return { balance: 0, buy: 0, repay: 0, net: 0, timeSharing: [] }
  }

  // 按日期聚合，取最近20个交易日
  const byDate = {}
  for (const row of data) {
    const dateStr = String(row.DATE || '').slice(0, 10)
    if (!dateStr) continue
    if (!byDate[dateStr]) {
      byDate[dateStr] = { balance: 0, buy: 0, net: 0 }
    }
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
    pageSize: '15',
  }, 15000)

  return data.map(row => {
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
    pageSize: '15',
    filter: `(FREE_DATE>='${startDate}')(FREE_DATE<='${endDate}')`,
  }, 15000)

  return data.map(row => ({
    name: row.SECURITY_NAME_ABBR || '--',
    code: row.SECURITY_CODE || '--',
    type: row.FREE_SHARES_TYPE || '--',
    date: String(row.FREE_DATE || '').slice(0, 10),
    volume: Math.round((Number(row.CURRENT_FREE_SHARES) || 0) / 1e4, 1),
    marketValue: Math.round((Number(row.LIFT_MARKET_CAP) || 0) / 1e4, 1),
  }))
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
    pageSize: '10',
    filter: `(REPORTDATE='${quarterDate}')`,
  }, 15000)

  return data.map(row => ({
    name: row.SECURITY_NAME_ABBR || '--',
    code: row.SECURITY_CODE || '--',
    type: '业绩快报',
    date: String(row.NOTICE_DATE || '').slice(0, 10),
    changePercent: Number(row.SJLTZ) || 0,
  }))
}

/**
 * 从东方财富 datacenter 获取北向资金历史数据
 * 注意：北向资金实时数据自2024-08-19停止发布，此处返回最后有效历史数据
 */
const fetchNorthboundFromDatacenter = async () => {
  const data = await fetchFromDatacenter('RPT_MUTUAL_DEAL_HISTORY', {
    sortColumns: 'TRADE_DATE',
    sortTypes: '-1',
    pageSize: '30',
    filter: '(MUTUAL_TYPE="001")',
  }, 15000)

  if (!data || data.length === 0) {
    return { sh: [], sz: [], total: [], updateTime: '--' }
  }

  // 数据按日期降序返回，反转后按日期升序
  const sorted = data.reverse()
  const total = sorted.map(row => ({
    time: String(row.TRADE_DATE || '').slice(5, 10),
    value: Math.round((Number(row.NET_DEAL_AMT) || 0) / 10000, 2),
  }))

  // 北向资金实时数据已停发，NET_DEAL_AMT 可能为 null，使用 DEAL_AMT 作为参考
  const validData = total.filter(t => t.value !== 0)
  const lastDate = sorted.length > 0 ? String(sorted[sorted.length - 1].TRADE_DATE || '').slice(0, 10) : '--'

  return {
    sh: [],
    sz: [],
    total: validData.length > 0 ? validData : total,
    updateTime: lastDate,
  }
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
      return {
        ...stats,
        timeSharing: { time: [], up: [], down: [] },
      }
    }
  } catch (e) {
    console.warn('[StockService] 市场情绪失败:', e?.message)
  }
  return {
    upCount: 0, downCount: 0, flatCount: 0,
    limitUpCount: 0, limitDownCount: 0, bombCount: 0,
    timeSharing: { time: [], up: [], down: [] },
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
 */
export const getFinancialNews = async () => {
  const cached = getSlowCache('news')
  if (cached) return cached
  try {
    const newsList = await fetchNewsFromEastMoney()
    if (newsList.length > 0) {
      const result = newsList.slice(0, 15).map(item => ({
        title: item.title || '--',
        content: (item.summary || '').slice(0, 200),
        time: item.showTime || '--',
        url: item.code ? `https://finance.eastmoney.com/a/${item.code}.html` : '#',
        source: '东方财富',
      }))
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
