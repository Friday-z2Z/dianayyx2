/**
 * 股票数据服务 - 商业级
 * 数据源：akshare 后端服务（全市场实时行情）
 * 降级方案：东方财富直连API（通过 Vite 代理）
 * 不再使用预设股票池，所有数据均来自实时接口
 */

// ==================== API 基地址配置 ====================
// 开发模式 / 本地 Flask 部署：使用相对路径（Vite proxy 或 Flask 代理）
// GitHub Pages 部署（无后端）：IS_STATIC=true，直接调用支持 CORS 的东方财富 API
// GitHub Pages 部署（有后端）：通过 VITE_API_BASE 环境变量指向远程后端
const API_BASE = import.meta.env.VITE_API_BASE || ''

// 静态模式：生产构建且未配置后端地址时，直连支持 CORS 的公开 API
const IS_STATIC = !API_BASE && import.meta.env.PROD

// ==================== 状态管理 ====================
let _cachedStockData = null
let _cachedMarketStats = null
let _cachedMarketStatsTime = 0
const MARKET_STATS_TTL = 30000  // 市场统计缓存 30 秒

// ==================== 东方财富 API 基础配置 ====================
// 双通道：直连代理（主）+ 后端代理（备）
// 静态模式下直连东方财富 API（支持 CORS），开发/部署模式下通过代理
const EM_DIRECT = IS_STATIC ? 'https://push2delay.eastmoney.com' : `${API_BASE}/api/eastmoney`
const EM_BACKEND = IS_STATIC ? '' : `${API_BASE}/api/akshare/em_api`
const EM_UT = 'bd1d9ddb04089700cf9c27f6f7426281'

// ==================== 静态模式 CORS 代理容错 ====================
// GitHub Pages (HTTPS) 直连东方财富 API 可能因网络环境被关闭连接
// 公共 CORS 代理作为降级方案，按顺序尝试直到成功
const CORS_PROXIES = [
  { name: 'allorigins', build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { name: 'codetabs',   build: (url) => `https://api.codetabs.com/v1/proxy/?quest=${url}` },
  { name: 'corsproxy',  build: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}` },
]

// 缓存可用代理（-1 = 直连，0+ = CORS_PROXIES 索引），避免每次都尝试全部
let _workingProxyIdx = null  // null = 未测试，-1 = 直连可用，0+ = 代理索引

/**
 * 带容错的 fetch：静态模式下先直连，失败则依次尝试 CORS 代理
 * 非静态模式直接请求（由 Vite/Flask 代理）
 */
const _fetchWithFallback = async (targetUrl, timeout = 10000) => {
  // 非静态模式：直接请求
  if (!IS_STATIC) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(targetUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (e) {
      clearTimeout(timeoutId)
      throw e
    }
  }

  // 静态模式：已知可用方式直接使用（_workingProxyIdx !== null 时才走缓存路径）
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
      _workingProxyIdx = null  // 直连失败，重新探测
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
      _workingProxyIdx = null  // 代理失败，重新探测
    }
  }

  // 探测阶段：先试直连，再试代理
  // 1. 直连
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const response = await fetch(targetUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
    clearTimeout(timeoutId)
    if (response.ok) {
      _workingProxyIdx = -1
      console.log('[StockService] 静态模式：直连东方财富 API 成功')
      return await response.json()
    }
  } catch (e) {
    console.warn('[StockService] 直连失败，尝试 CORS 代理:', e.message)
  }

  // 2. 依次尝试 CORS 代理
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
        console.log(`[StockService] 静态模式：CORS 代理 ${proxy.name} 可用`)
        return await response.json()
      }
    } catch (e) {
      clearTimeout(timeoutId)
      console.warn(`[StockService] CORS 代理 ${proxy.name} 失败:`, e.message)
    }
  }

  throw new Error('所有数据源均不可用（直连 + 3 个 CORS 代理）')
}

/**
 * 通用东方财富 API 请求（双通道容错）
 * 优先 Vite 直连代理，失败降级到后端代理
 */
const _emFetch = async (apiPath, apiName, params, timeout = 10000) => {
  const qs = new URLSearchParams(params).toString()
  const directUrl = `${EM_DIRECT}${apiPath}?${qs}`

  // 静态模式：使用带 CORS 代理容错的 fetch
  if (IS_STATIC) {
    return _fetchWithFallback(directUrl, timeout)
  }

  // 开发/部署模式：直连 + 后端代理降级
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(directUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`EM HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    // 降级：后端代理
    const backendUrl = `${EM_BACKEND}?${new URLSearchParams({ ...params, _api: apiName }).toString()}`
    const controller2 = new AbortController()
    const timeoutId2 = setTimeout(() => controller2.abort(), timeout)
    try {
      const response = await fetch(backendUrl, {
        signal: controller2.signal,
        headers: { 'Accept': 'application/json' }
      })
      clearTimeout(timeoutId2)
      if (!response.ok) throw new Error(`EM backend HTTP ${response.status}`)
      return await response.json()
    } catch (error2) {
      clearTimeout(timeoutId2)
      throw error2
    }
  }
}

/**
 * 通用东方财富 clist API 请求
 */
const fetchFromEastMoney = async (params, timeout = 10000) => {
  const json = await _emFetch('/api/qt/clist/get', 'clist', params, timeout)
  return json.data?.diff || []
}

/**
 * 从东方财富获取全市场股票行情（按总市值降序，取前200）
 */
const fetchStockListFromEastMoney = async () => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: 200, po: 1, np: 1,
    ut: EM_UT, fltt: 2, invt: 2,
    fid: 'f20',  // 按总市值排序
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
 * 从东方财富获取全市场涨跌统计（获取全部股票的涨跌幅用于统计）
 */
const fetchMarketStatsFromEastMoney = async () => {
  if (_cachedMarketStats && Date.now() - _cachedMarketStatsTime < MARKET_STATS_TTL) return _cachedMarketStats
  // 获取全部A股涨跌幅（只请求 f3 字段以减少数据量）
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
    fid: 'f3',  // 按涨跌幅排序
    fs: 'm:90 t:2 f:!50',  // 行业板块
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
  // 取涨幅前15 + 跌幅前15
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
    fid: 'f3',  // 按涨跌幅排序
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
 * 从东方财富获取资金流向排行
 * 返回原始数值（元），前端负责格式化显示
 */
const fetchFundFlowFromEastMoney = async (direction, count = 15) => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: count, po: direction === 'inflow' ? 1 : 0, np: 1,
    ut: 'b2884a393a59ad64002292a3e90d46a5', fltt: 2, invt: 2,
    fid: 'f62',  // 按主力净流入排序
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
 * 从东方财富获取主力净流入占比排行（按占比排序，与绝对金额排行互补）
 * 返回原始数值（元），前端负责格式化显示
 */
const fetchFundFlowPctFromEastMoney = async (direction, count = 15) => {
  const items = await fetchFromEastMoney({
    pn: 1, pz: count, po: direction === 'inflow' ? 1 : 0, np: 1,
    ut: 'b2884a393a59ad64002292a3e90d46a5', fltt: 2, invt: 2,
    fid: 'f184',  // 按主力净流入占比排序
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
 * 获取大盘指数实时数据（双通道：Vite直连 + 后端代理）
 */
const fetchIndexFromEastMoney = async () => {
  const json = await _emFetch('/api/qt/ulist.np/get', 'ulist', {
    fltt: '2', invt: '2',
    fields: 'f2,f3,f4,f6,f12,f14',
    secids: '1.000001,0.399001,0.399006',
  }, 8000)
  if (!json.data?.diff) throw new Error('指数数据为空')
  const items = json.data.diff
  return {
    shIndex: { value: items[0].f2, change: items[0].f3, name: items[0].f14 },
    szIndex: { value: items[1].f2, change: items[1].f3, name: items[1].f14 },
    cyIndex: { value: items[2].f2, change: items[2].f3, name: items[2].f14 },
  }
}

// ==================== akshare 后端集成 ====================
let _akshareAvailable = null
let _akshareCheckPromise = null
let _akshareCheckTime = 0
const AKSHARE_RECHECK_INTERVAL = 60000  // 60 秒后允许重新检查

const checkAkshareAvailable = async () => {
  // 静态模式（GitHub Pages 无后端）直接返回不可用
  if (IS_STATIC) {
    _akshareAvailable = false
    return false
  }
  // 60 秒内使用缓存结果，超过则重新检查
  if (_akshareAvailable !== null && Date.now() - _akshareCheckTime < AKSHARE_RECHECK_INTERVAL) {
    return _akshareAvailable
  }
  if (_akshareCheckPromise) return _akshareCheckPromise

  _akshareCheckPromise = (async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(`${API_BASE}/api/akshare/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      })
      clearTimeout(timeoutId)
      _akshareAvailable = response.ok
    } catch {
      _akshareAvailable = false
    } finally {
      _akshareCheckPromise = null
      _akshareCheckTime = Date.now()
    }
    if (_akshareAvailable) console.log('[StockService] akshare 后端服务可用')
    else console.warn('[StockService] akshare 后端不可用，使用东方财富直连API')
    return _akshareAvailable
  })()

  return _akshareCheckPromise
}

/**
 * 重置 akshare 可用性检查（手动刷新时调用）
 */
export const resetAkshareCheck = () => {
  _akshareAvailable = null
  _akshareCheckTime = 0
}

const fetchFromAkshare = async (endpoint, timeout = 20000) => {
  const url = `${API_BASE}/api/akshare${endpoint}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeoutId)
    if (response.status === 503) return null
    if (!response.ok) throw new Error(`akshare HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
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

// ==================== 公开 API ====================

/**
 * 获取所有股票行情数据（全市场实时）
 */
export const getAllStockData = async (forceRefresh = false) => {
  if (forceRefresh) {
    resetAkshareCheck()
    _cachedStockData = null
  }
  if (_cachedStockData && !forceRefresh) return _cachedStockData

  // 优先 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/stocks')
      if (Array.isArray(data) && data.length > 0) {
        _cachedStockData = data
        return _cachedStockData
      }
    } catch (e) {
      console.warn('[StockService] akshare 获取股票数据失败，降级到东方财富直连')
    }
  }

  // 降级：东方财富直连API（全市场按市值排序前200）
  try {
    const data = await fetchStockListFromEastMoney()
    if (data.length > 0) {
      _cachedStockData = data
      return _cachedStockData
    }
  } catch (e) {
    console.warn('[StockService] 东方财富直连获取股票数据失败:', e?.message)
  }

  return []
}

/**
 * 获取大盘分析数据（指数 + 涨跌家数）
 */
export const getMarketAnalysis = async () => {
  // 优先 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/market_analysis')
      if (data && data.shIndex && data.shIndex.value !== '--') return data
    } catch (e) {
      console.warn('[StockService] akshare 获取市场分析失败，降级到东方财富直连')
    }
  }

  // 降级：东方财富直连（指数 + 涨跌统计）
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
    console.warn('[StockService] 东方财富直连市场分析失败:', e?.message)
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
  // 优先 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/market_sentiment')
      if (data && data.upCount !== undefined && data.upCount > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取市场情绪失败，降级到东方财富直连')
    }
  }

  // 降级：东方财富直连（全市场涨跌统计）
  try {
    const stats = await fetchMarketStatsFromEastMoney()
    if (stats.upCount > 0 || stats.downCount > 0) {
      return {
        ...stats,
        timeSharing: { time: [], up: [], down: [] },
      }
    }
  } catch (e) {
    console.warn('[StockService] 东方财富直连市场情绪失败:', e?.message)
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
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/northbound')
      if (data && data.sh && data.sh.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取北向资金失败')
    }
  }
  return { sh: [], sz: [], total: [], updateTime: '--' }
}

/**
 * 获取融资数据
 * 优先 akshare 后端，返回原始数值（元）
 */
export const getFinancingData = async () => {
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/financing')
      if (data && data.balance > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取融资数据失败')
    }
  }
  return { balance: 0, buy: 0, repay: 0, net: 0, timeSharing: [] }
}

/**
 * 获取IPO日历
 */
export const getIPOCalendar = async () => {
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/ipo')
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取IPO日历失败')
    }
  }
  return []
}

/**
 * 获取解禁日历
 */
export const getLockupCalendar = async () => {
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/lockup')
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取解禁日历失败')
    }
  }
  return []
}

/**
 * 获取财报日历
 */
export const getEarningsCalendar = async () => {
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/earnings')
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取财报日历失败')
    }
  }
  return []
}

/**
 * 获取全球指数
 */
export const getGlobalIndices = async () => {
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/global_indices', 35000)
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取全球指数失败，降级到东方财富')
    }
  }

  // 降级：东方财富直连
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
    console.warn('[StockService] 东方财富全球指数API失败:', e?.message)
  }

  return []
}

/**
 * 获取汇率数据
 */
export const getExchangeRates = async () => {
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/exchange_rates', 35000)
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取汇率失败')
    }
  }
  return []
}

/**
 * 获取板块热力图数据
 */
export const getSectorHeatmap = async () => {
  // 优先 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/sector_heatmap', 30000)
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取板块热力图失败，降级到东方财富直连')
    }
  }

  // 降级：东方财富直连（行业板块行情）
  try {
    const data = await fetchSectorDataFromEastMoney()
    if (data.length > 0) return data
  } catch (e) {
    console.warn('[StockService] 东方财富直连板块热力图失败:', e?.message)
  }

  return []
}

/**
 * 获取涨幅/跌幅排行（全市场实时数据）
 */
export const getPriceRanking = async () => {
  // 优先 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const [upData, downData] = await Promise.all([
        fetchFromAkshare('/ranking?direction=up&count=15'),
        fetchFromAkshare('/ranking?direction=down&count=15'),
      ])
      if (Array.isArray(upData) && upData.length > 0 && Array.isArray(downData) && downData.length > 0) {
        return { up: upData, down: downData }
      }
    } catch (e) {
      console.warn('[StockService] akshare 获取涨跌排行失败，降级到东方财富直连')
    }
  }

  // 降级：东方财富直连
  try {
    const [up, down] = await Promise.all([
      fetchRankingFromEastMoney('up', 15),
      fetchRankingFromEastMoney('down', 15),
    ])
    return { up, down }
  } catch (e) {
    console.warn('[StockService] 东方财富直连涨跌排行失败:', e?.message)
  }

  return { up: [], down: [] }
}

/**
 * 获取资金流向排行（全市场实时数据）
 * 返回原始数值（元），前端负责格式化显示
 */
export const getCapitalRanking = async () => {
  // 优先 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/fund_flow_ranking', 20000)
      if (data && Array.isArray(data.inflow) && data.inflow.length > 0) {
        return {
          inflow: data.inflow.map(s => ({ ...s })),
          outflow: data.outflow.map(s => ({ ...s })),
        }
      }
    } catch (e) {
      console.warn('[StockService] akshare 获取资金流向排行失败，降级到东方财富直连')
    }
  }

  // 降级：东方财富直连
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
    console.warn('[StockService] 东方财富直连资金流向排行失败:', e?.message)
  }

  return { inflow: [], outflow: [] }
}

/**
 * 获取主力动向排行（按主力净流入占比排序，与"资金"tab的绝对金额排行互补）
 * 北向资金实时数据已于2024年8月停发，改用主力净流入占比作为主力动向指标
 */
export const getNorthboundRanking = async () => {
  // 直接使用东方财富按主力净流入占比(f184)排序的API
  try {
    const [inflow, outflow] = await Promise.all([
      fetchFundFlowPctFromEastMoney('inflow', 15),
      fetchFundFlowPctFromEastMoney('outflow', 15),
    ])
    if (inflow.length > 0 || outflow.length > 0) {
      return {
        increase: inflow,
        decrease: outflow,
      }
    }
  } catch (e) {
    console.warn('[StockService] 主力占比排行获取失败，降级到资金排行:', e?.message)
  }

  // 降级：使用资金排行数据
  const data = await getCapitalRanking()
  return {
    increase: data.inflow || [],
    decrease: data.outflow || [],
  }
}

/**
 * 从东方财富获取财经快讯（通过后端代理）
 * 后端 /api/akshare/em_news 已格式化返回标准新闻结构
 */
const fetchNewsFromEastMoney = async () => {
  const url = `${API_BASE}/api/akshare/em_news`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`EM News HTTP ${response.status}`)
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) return data
    return []
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * 获取重要财经新闻
 * 优先 akshare 后端 /news 接口
 * 降级：东方财富 7x24 全球财经快讯 API
 */
export const getFinancialNews = async () => {
  // 静态模式无后端，东方财富新闻 API 不支持 CORS，跳过
  if (IS_STATIC) return []

  // 优先 akshare 后端
  try {
    const data = await fetchFromAkshare('/news', 15000)
    if (Array.isArray(data) && data.length > 0) return data
  } catch (e) {
    console.warn('[StockService] akshare 获取新闻失败:', e?.message || e)
  }

  // 降级：东方财富直连
  try {
    const data = await fetchNewsFromEastMoney()
    if (data.length > 0) return data
  } catch (e) {
    console.warn('[StockService] 东方财富新闻API失败:', e?.message)
  }

  return []
}
