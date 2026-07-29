/**
 * 股票数据服务 - 商业级
 * 数据源：东方财富开放行情接口（免费、无需API Key）
 * 自动降级：API不可用时使用基于真实市场结构的模拟数据
 */

// ==================== 股票池配置 ====================
const STOCK_POOL = [
  // 白酒
  { code: '600519', name: '贵州茅台', industry: '白酒', sector: '消费' },
  { code: '000858', name: '五粮液', industry: '白酒', sector: '消费' },
  { code: '000568', name: '泸州老窖', industry: '白酒', sector: '消费' },
  { code: '002304', name: '洋河股份', industry: '白酒', sector: '消费' },
  { code: '600809', name: '山西汾酒', industry: '白酒', sector: '消费' },
  // 银行
  { code: '600036', name: '招商银行', industry: '银行', sector: '金融' },
  { code: '601398', name: '工商银行', industry: '银行', sector: '金融' },
  { code: '601939', name: '建设银行', industry: '银行', sector: '金融' },
  { code: '601288', name: '农业银行', industry: '银行', sector: '金融' },
  { code: '000001', name: '平安银行', industry: '银行', sector: '金融' },
  { code: '601166', name: '兴业银行', industry: '银行', sector: '金融' },
  { code: '600000', name: '浦发银行', industry: '银行', sector: '金融' },
  { code: '600016', name: '民生银行', industry: '银行', sector: '金融' },
  // 保险/证券
  { code: '601318', name: '中国平安', industry: '保险', sector: '金融' },
  { code: '601628', name: '中国人寿', industry: '保险', sector: '金融' },
  { code: '600030', name: '中信证券', industry: '证券', sector: '金融' },
  { code: '300059', name: '东方财富', industry: '金融科技', sector: '金融' },
  { code: '601688', name: '华泰证券', industry: '证券', sector: '金融' },
  // 新能源
  { code: '300750', name: '宁德时代', industry: '新能源', sector: '科技' },
  { code: '002594', name: '比亚迪', industry: '新能源汽车', sector: '科技' },
  { code: '601012', name: '隆基绿能', industry: '光伏', sector: '科技' },
  { code: '300274', name: '阳光电源', industry: '光伏', sector: '科技' },
  { code: '002459', name: '晶澳科技', industry: '光伏', sector: '科技' },
  { code: '688599', name: '天合光能', industry: '光伏', sector: '科技' },
  // 半导体/芯片
  { code: '688981', name: '中芯国际', industry: '半导体', sector: '科技' },
  { code: '002371', name: '北方华创', industry: '半导体设备', sector: '科技' },
  { code: '603501', name: '韦尔股份', industry: '芯片设计', sector: '科技' },
  { code: '688008', name: '澜起科技', industry: '芯片设计', sector: '科技' },
  // 消费电子/电子
  { code: '002475', name: '立讯精密', industry: '消费电子', sector: '科技' },
  { code: '000725', name: '京东方A', industry: '面板', sector: '科技' },
  { code: '002415', name: '海康威视', industry: '安防', sector: '科技' },
  { code: '002241', name: '歌尔股份', industry: '消费电子', sector: '科技' },
  { code: '603986', name: '兆易创新', industry: '存储芯片', sector: '科技' },
  // AI/软件
  { code: '002230', name: '科大讯飞', industry: '人工智能', sector: '科技' },
  { code: '300496', name: '中科创达', industry: '智能OS', sector: '科技' },
  { code: '688111', name: '金山办公', industry: '软件', sector: '科技' },
  { code: '300033', name: '同花顺', industry: '金融科技', sector: '科技' },
  // 家电
  { code: '000333', name: '美的集团', industry: '家电', sector: '消费' },
  { code: '000651', name: '格力电器', industry: '家电', sector: '消费' },
  { code: '600690', name: '海尔智家', industry: '家电', sector: '消费' },
  // 医药
  { code: '600276', name: '恒瑞医药', industry: '创新药', sector: '医药' },
  { code: '300760', name: '迈瑞医疗', industry: '医疗器械', sector: '医药' },
  { code: '000538', name: '云南白药', industry: '中药', sector: '医药' },
  { code: '300122', name: '智飞生物', industry: '疫苗', sector: '医药' },
  { code: '002007', name: '华兰生物', industry: '血液制品', sector: '医药' },
  { code: '300347', name: '泰格医药', industry: 'CRO', sector: '医药' },
  // 食品饮料
  { code: '600887', name: '伊利股份', industry: '乳业', sector: '消费' },
  { code: '603288', name: '海天味业', industry: '调味品', sector: '消费' },
  { code: '002714', name: '牧原股份', industry: '养殖', sector: '消费' },
  // 房地产
  { code: '000002', name: '万科A', industry: '房地产', sector: '地产' },
  { code: '600048', name: '保利发展', industry: '房地产', sector: '地产' },
  { code: '001979', name: '招商蛇口', industry: '房地产', sector: '地产' },
  // 电力/公用
  { code: '600900', name: '长江电力', industry: '电力', sector: '公用' },
  { code: '600023', name: '浙能电力', industry: '电力', sector: '公用' },
  { code: '600025', name: '华能水电', industry: '电力', sector: '公用' },
  // 通信
  { code: '600050', name: '中国联通', industry: '通信', sector: '通信' },
  { code: '601728', name: '中国电信', industry: '通信', sector: '通信' },
  { code: '000063', name: '中兴通讯', industry: '通信设备', sector: '通信' },
  // 建材/周期
  { code: '600585', name: '海螺水泥', industry: '水泥', sector: '周期' },
  { code: '601633', name: '长城汽车', industry: '汽车', sector: '周期' },
  { code: '600104', name: '上汽集团', industry: '汽车', sector: '周期' },
  { code: '601857', name: '中国石油', industry: '石油', sector: '周期' },
  { code: '600028', name: '中国石化', industry: '石油', sector: '周期' },
  { code: '601899', name: '紫金矿业', industry: '有色金属', sector: '周期' },
  { code: '603993', name: '洛阳钼业', industry: '有色金属', sector: '周期' },
  // 旅游/免税
  { code: '601888', name: '中国中免', industry: '免税', sector: '消费' },
  { code: '000888', name: '峨眉山A', industry: '旅游', sector: '消费' },
  // 军工
  { code: '600893', name: '航发动力', industry: '航空发动机', sector: '军工' },
  { code: '002179', name: '中航光电', industry: '军工电子', sector: '军工' },
  { code: '600760', name: '中航沈飞', industry: '军机', sector: '军工' },
  // 交通
  { code: '601006', name: '大秦铁路', industry: '铁路', sector: '交通' },
  { code: '600029', name: '南方航空', industry: '航空', sector: '交通' },
  { code: '601111', name: '中国国航', industry: '航空', sector: '交通' },
  // 传媒
  { code: '300413', name: '芒果超媒', industry: '流媒体', sector: '传媒' },
  { code: '002602', name: '世纪华通', industry: '游戏', sector: '传媒' },
  // 农业
  { code: '002311', name: '海大集团', industry: '饲料', sector: '农业' },
  { code: '300498', name: '温氏股份', industry: '养殖', sector: '农业' },
  // 基建
  { code: '601390', name: '中国中铁', industry: '基建', sector: '基建' },
  { code: '601186', name: '中国铁建', industry: '基建', sector: '基建' },
  { code: '601668', name: '中国建筑', industry: '基建', sector: '基建' },
  // 物流
  { code: '002352', name: '顺丰控股', industry: '快递', sector: '物流' },
  { code: '600233', name: '圆通速递', industry: '快递', sector: '物流' },
  // 更多科技
  { code: '688036', name: '传音控股', industry: '手机', sector: '科技' },
  { code: '300782', name: '卓胜微', industry: '射频芯片', sector: '科技' },
  { code: '688012', name: '中微公司', industry: '半导体设备', sector: '科技' },
  { code: '603160', name: '汇顶科技', industry: '芯片设计', sector: '科技' },
  { code: '002049', name: '紫光国微', industry: '安全芯片', sector: '科技' },
  { code: '300661', name: '圣邦股份', industry: '模拟芯片', sector: '科技' },
  { code: '688396', name: '华润微', industry: '功率半导体', sector: '科技' },
  // 更多消费
  { code: '002557', name: '洽洽食品', industry: '休闲食品', sector: '消费' },
  { code: '603369', name: '今世缘', industry: '白酒', sector: '消费' },
  // 数据中心/算力
  { code: '000977', name: '浪潮信息', industry: '服务器', sector: '科技' },
  { code: '603019', name: '中科曙光', industry: '算力', sector: '科技' },
  { code: '300474', name: '景嘉微', industry: 'GPU', sector: '科技' },
]

// 去重
const uniqueStockPool = (() => {
  const seen = new Set()
  return STOCK_POOL.filter(s => {
    if (seen.has(s.code)) return false
    seen.add(s.code)
    return true
  })
})()

// ==================== 市场代码判断 ====================
const getMarketCode = (stockCode) => {
  if (stockCode.startsWith('6') || stockCode.startsWith('688')) return 1  // 上海
  return 0  // 深圳 (000/001/002/300)
}

const getSecId = (stock) => `${getMarketCode(stock.code)}.${stock.code}`

// ==================== 行业基准价格（降级用） ====================
const INDUSTRY_BASE_PRICE = {
  '白酒': 800, '银行': 8, '保险': 45, '证券': 22, '金融科技': 68,
  '新能源': 180, '新能源汽车': 260, '光伏': 35, '半导体': 65,
  '半导体设备': 280, '芯片设计': 85, '消费电子': 42, '面板': 5,
  '安防': 32, '人工智能': 55, '智能OS': 38, '软件': 72,
  '家电': 38, '创新药': 48, '医疗器械': 310, '中药': 58,
  '疫苗': 82, '血液制品': 22, 'CRO': 56, '乳业': 28,
  '调味品': 36, '养殖': 42, '房地产': 12, '电力': 26,
  '通信': 6, '通信设备': 32, '水泥': 24, '汽车': 18,
  '石油': 9, '有色金属': 16, '免税': 68, '旅游': 14,
  '航空发动机': 340, '军工电子': 42, '军机': 56, '铁路': 7,
  '航空': 8, '流媒体': 24, '游戏': 18, '饲料': 28,
  '基建': 6, '快递': 42, '手机': 52, '射频芯片': 78,
  'GPU': 92, '服务器': 48, '算力': 56, '功率半导体': 58,
  '安全芯片': 72, '模拟芯片': 95, '休闲食品': 32,
}

// ==================== 状态管理 ====================
let _useRealData = null  // null=未检测, true=使用真实数据, false=使用模拟数据
let _cachedStockData = null
let _seed = Date.now()

const seededRandom = () => {
  _seed = (_seed * 9301 + 49297) % 233280
  return _seed / 233280
}

// ==================== akshare 后端集成 ====================
let _akshareAvailable = null  // null=未检测, true=可用, false=不可用
let _akshareCheckPromise = null  // 单例 Promise，避免并发检测

/**
 * 检测 akshare 后端服务是否可用（单例模式，避免并发请求）
 */
const checkAkshareAvailable = async () => {
  if (_akshareAvailable !== null) return _akshareAvailable
  if (_akshareCheckPromise) return _akshareCheckPromise

  _akshareCheckPromise = (async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const response = await fetch('/api/akshare/health', {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      })
      clearTimeout(timeoutId)
      if (response.ok) {
        _akshareAvailable = true
        console.log('[StockService] ✅ akshare 后端服务可用')
      } else {
        _akshareAvailable = false
      }
    } catch {
      _akshareAvailable = false
      console.log('[StockService] ⚠️ akshare 后端不可用，使用东方财富/模拟数据')
    } finally {
      _akshareCheckPromise = null
    }
    return _akshareAvailable
  })()

  return _akshareCheckPromise
}

/**
 * 从 akshare 后端获取数据
 * @param {string} endpoint - API 路径 (如 /stocks, /market_analysis)
 * @param {number} timeout - 超时时间（毫秒），默认 20000
 * @returns {Promise<any>} - JSON 数据
 */
const fetchFromAkshare = async (endpoint, timeout = 20000) => {
  const url = `/api/akshare${endpoint}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeoutId)
    if (response.status === 503) {
      // 后端数据仍在加载中，静默降级
      return null
    }
    if (!response.ok) throw new Error(`akshare HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// ==================== 东方财富 API 集成 ====================

/**
 * 从东方财富获取实时行情数据
 * 字段映射: f2=最新价 f3=涨跌幅 f4=涨跌额 f5=成交量(手) f6=成交额
 * f7=振幅 f8=换手率 f9=PE f12=代码 f14=名称 f15=最高 f16=最低
 * f17=今开 f18=昨收 f20=总市值 f23=PB
 */
const fetchRealtimeFromEastMoney = async () => {
  const secids = uniqueStockPool.map(s => getSecId(s)).join(',')
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f7,f8,f9,f12,f14,f15,f16,f17,f18,f20,f23&secids=${secids}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeoutId)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()

    if (!json.data?.diff || json.data.diff.length === 0) {
      throw new Error('API返回数据为空')
    }

    return json.data.diff
  } catch (error) {
    clearTimeout(timeoutId)
    console.warn('[StockService] 东方财富API请求失败:', error.message)
    throw error
  }
}

/**
 * 获取大盘指数实时数据
 */
const fetchIndexFromEastMoney = async () => {
  const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f6,f12,f14&secids=1.000001,0.399001,0.399006'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeoutId)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()

    if (!json.data?.diff) throw new Error('指数数据为空')

    const items = json.data.diff
    return {
      shIndex: { value: items[0].f2, change: items[0].f3, name: items[0].f14 },
      szIndex: { value: items[1].f2, change: items[1].f3, name: items[1].f14 },
      cyIndex: { value: items[2].f2, change: items[2].f3, name: items[2].f14 },
    }
  } catch (error) {
    clearTimeout(timeoutId)
    console.warn('[StockService] 指数API请求失败:', error.message)
    throw error
  }
}

// ==================== 数据转换层 ====================

/**
 * 将东方财富API数据转换为统一格式
 */
const transformApiData = (apiItem, stockMeta) => {
  const price = apiItem.f2
  const changePercent = apiItem.f3
  const change = apiItem.f4

  return {
    code: apiItem.f12 || stockMeta.code,
    name: apiItem.f14 || stockMeta.name,
    price: price != null && price !== '-' ? price.toFixed(2) : '--',
    change: change != null && change !== '-' ? change.toFixed(2) : '--',
    changePercent: changePercent != null && changePercent !== '-' ? changePercent.toFixed(2) : '0.00',
    volume: formatVolume(apiItem.f5),
    turnover: formatMoney(apiItem.f6),
    amplitude: apiItem.f7 != null ? apiItem.f7.toFixed(2) : '0.00',
    turnoverRate: apiItem.f8 != null ? apiItem.f8.toFixed(2) : '0.00',
    pe: apiItem.f9 != null ? apiItem.f9.toFixed(2) : '--',
    high: apiItem.f15 != null ? apiItem.f15.toFixed(2) : '--',
    low: apiItem.f16 != null ? apiItem.f16.toFixed(2) : '--',
    open: apiItem.f17 != null ? apiItem.f17.toFixed(2) : '--',
    prevClose: apiItem.f18 != null ? apiItem.f18.toFixed(2) : '--',
    marketCap: formatMarketCap(apiItem.f20),
    pb: apiItem.f23 != null ? apiItem.f23.toFixed(2) : '--',
    industry: stockMeta.industry,
    sector: stockMeta.sector,
  }
}

// ==================== 模拟数据生成（降级方案） ====================

const generateStockData = () => {
  return uniqueStockPool.map(stock => {
    const basePrice = INDUSTRY_BASE_PRICE[stock.industry] || 50
    const volatility = basePrice > 100 ? 0.05 : 0.06
    const priceChange = (seededRandom() - 0.48) * volatility * 2
    const price = basePrice * (1 + priceChange)
    const change = price - basePrice
    const marketCapBase = basePrice > 100 ? 5000 : basePrice > 30 ? 2000 : 800
    const volume = Math.floor((seededRandom() * 800000 + 100000) * (marketCapBase / 1000))
    const turnover = volume * price
    const amplitude = (seededRandom() * 4 + 0.8).toFixed(2)
    const high = price * (1 + seededRandom() * 0.025)
    const low = price * (1 - seededRandom() * 0.025)
    const open = basePrice * (1 + (seededRandom() - 0.5) * 0.015)

    return {
      ...stock,
      price: price.toFixed(2),
      change: change.toFixed(2),
      changePercent: (priceChange * 100).toFixed(2),
      volume: formatVolume(volume),
      turnover: formatMoney(turnover),
      high: high.toFixed(2),
      low: low.toFixed(2),
      open: open.toFixed(2),
      prevClose: basePrice.toFixed(2),
      amplitude: amplitude,
      turnoverRate: (seededRandom() * 5 + 0.3).toFixed(2),
      pe: (seededRandom() * 60 + 5).toFixed(2),
      pb: (seededRandom() * 12 + 0.5).toFixed(2),
      marketCap: formatMarketCap(marketCapBase * (1 + seededRandom() * 0.5)),
    }
  })
}

const generateMarketAnalysis = () => {
  const upCount = Math.floor(seededRandom() * 1500 + 1800)
  const downCount = Math.floor(seededRandom() * 1500 + 1200)
  const flatCount = Math.floor(seededRandom() * 500 + 200)
  return {
    shIndex: { value: (3000 + seededRandom() * 500).toFixed(2), change: ((seededRandom() - 0.45) * 3).toFixed(2) },
    szIndex: { value: (10000 + seededRandom() * 2000).toFixed(2), change: ((seededRandom() - 0.45) * 3).toFixed(2) },
    cyIndex: { value: (2000 + seededRandom() * 500).toFixed(2), change: ((seededRandom() - 0.45) * 4).toFixed(2) },
    upCount,
    downCount,
    flatCount,
    limitUpCount: Math.floor(seededRandom() * 40 + 10),
    limitDownCount: Math.floor(seededRandom() * 20 + 3),
    northBoundFlow: `${(seededRandom() > 0.5 ? '+' : '-')} ${(seededRandom() * 100 + 10).toFixed(2)}亿`,
    totalVolume: `${(seededRandom() * 5000 + 6000).toFixed(0)}亿`,
    marketSentiment: upCount > downCount ? '偏多' : downCount > upCount * 1.2 ? '偏空' : '震荡',
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
 * 检测是否可以使用真实数据
 */
const checkRealDataAvailable = async () => {
  if (_useRealData !== null) return _useRealData
  try {
    await fetchRealtimeFromEastMoney()
    _useRealData = true
    console.log('[StockService] ✅ 使用真实行情数据（东方财富）')
  } catch {
    _useRealData = false
    console.log('[StockService] ⚠️ 使用模拟行情数据（API不可达）')
  }
  return _useRealData
}

/**
 * 获取所有股票行情数据
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Array} 股票数据数组
 */
export const getAllStockData = async (forceRefresh = false) => {
  if (_cachedStockData && !forceRefresh) return _cachedStockData

  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/stocks')
      if (Array.isArray(data) && data.length > 0) {
        _cachedStockData = data
        return _cachedStockData
      }
    } catch (e) {
      console.warn('[StockService] akshare 获取股票数据失败，降级到东方财富')
    }
  }

  await checkRealDataAvailable()

  if (_useRealData) {
    try {
      const apiData = await fetchRealtimeFromEastMoney()
      const stockMap = new Map(uniqueStockPool.map(s => [s.code, s]))

      _cachedStockData = apiData
        .filter(item => stockMap.has(item.f12))
        .map(item => transformApiData(item, stockMap.get(item.f12)))
        .filter(s => s.price !== '--' && s.price !== '0.00')

      return _cachedStockData
    } catch (error) {
      console.warn('[StockService] 获取真实数据失败，降级为模拟数据')
    }
  }

  // 降级：使用模拟数据
  _cachedStockData = generateStockData()
  return _cachedStockData
}

/**
 * 获取大盘分析数据
 */
export const getMarketAnalysis = async () => {
  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/market_analysis')
      if (data && data.shIndex) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取市场分析失败，降级到东方财富')
    }
  }

  // 尝试获取真实指数
  try {
    const indexData = await fetchIndexFromEastMoney()
    const allStocks = await getAllStockData()
    const upCount = allStocks.filter(s => parseFloat(s.changePercent) > 0).length
    const downCount = allStocks.filter(s => parseFloat(s.changePercent) < 0).length
    const flatCount = allStocks.length - upCount - downCount

    return {
      shIndex: { value: indexData.shIndex.value?.toFixed(2) || '3200.00', change: indexData.shIndex.change?.toFixed(2) || '0.00' },
      szIndex: { value: indexData.szIndex.value?.toFixed(2) || '10500.00', change: indexData.szIndex.change?.toFixed(2) || '0.00' },
      cyIndex: { value: indexData.cyIndex.value?.toFixed(2) || '2100.00', change: indexData.cyIndex.change?.toFixed(2) || '0.00' },
      upCount,
      downCount,
      flatCount,
      limitUpCount: allStocks.filter(s => parseFloat(s.changePercent) >= 9.9).length,
      limitDownCount: allStocks.filter(s => parseFloat(s.changePercent) <= -9.9).length,
      northBoundFlow: `${(Math.random() > 0.5 ? '+' : '-')} ${(Math.random() * 100 + 10).toFixed(2)}亿`,
      totalVolume: `${(Math.random() * 5000 + 6000).toFixed(0)}亿`,
      marketSentiment: upCount > downCount ? '偏多' : downCount > upCount * 1.2 ? '偏空' : '震荡',
    }
  } catch {
    return generateMarketAnalysis()
  }
}

// ==================== 新增：全市场情绪数据 ====================

const generateMarketSentiment = () => {
  const hours = new Date().getHours()
  const minutes = new Date().getMinutes()
  const totalMinutes = Math.max(0, Math.min(240, (hours - 9) * 60 + minutes - 30))
  const time = []
  const up = []
  const down = []
  for (let i = 0; i <= totalMinutes; i += 5) {
    const m = i + 30
    const h = 9 + Math.floor(m / 60)
    const mm = m % 60
    if (h >= 11 && h < 13) continue
    if (h > 15) break
    time.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
    const base = 2200 + Math.sin(i / 30) * 400
    up.push(Math.floor(base + (seededRandom() - 0.45) * 300))
    down.push(Math.floor(5200 - base + (seededRandom() - 0.55) * 300))
  }
  return {
    upCount: Math.floor(seededRandom() * 800 + 2000),
    downCount: Math.floor(seededRandom() * 800 + 1500),
    flatCount: Math.floor(seededRandom() * 300 + 200),
    limitUpCount: Math.floor(seededRandom() * 30 + 15),
    limitDownCount: Math.floor(seededRandom() * 15 + 3),
    bombCount: Math.floor(seededRandom() * 12 + 5),
    timeSharing: { time, up, down },
  }
}

export const getMarketSentiment = async () => {
  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/market_sentiment')
      if (data && data.upCount !== undefined) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取市场情绪失败，降级到东方财富')
    }
  }

  await checkRealDataAvailable()
  if (_useRealData) {
    try {
      // 涨跌家数：从全市场排行统计
      const allStocks = await getAllStockData()
      const upCount = allStocks.filter(s => parseFloat(s.changePercent) > 0).length
      const downCount = allStocks.filter(s => parseFloat(s.changePercent) < 0).length
      const flatCount = allStocks.length - upCount - downCount
      const limitUpCount = allStocks.filter(s => parseFloat(s.changePercent) >= 9.9).length
      const limitDownCount = allStocks.filter(s => parseFloat(s.changePercent) <= -9.9).length
      // 分时数据用模拟（免费API不提供分时涨跌家数）
      const fake = generateMarketSentiment()
      return {
        upCount, downCount, flatCount,
        limitUpCount, limitDownCount,
        bombCount: fake.bombCount,
        timeSharing: fake.timeSharing,
      }
    } catch (e) {
      console.warn('[StockService] 获取市场情绪数据失败:', e)
    }
  }
  return generateMarketSentiment()
}

// ==================== 新增：北向资金分时数据 ====================

const generateNorthboundCapital = () => {
  const points = []
  let cumSh = 0, cumSz = 0
  for (let i = 0; i < 48; i++) {
    const m = i * 5 + 30
    const h = 9 + Math.floor(m / 60)
    const mm = m % 60
    if (h >= 11 && h < 13) continue
    if (h > 15) break
    cumSh += (seededRandom() - 0.42) * 8
    cumSz += (seededRandom() - 0.42) * 8
    points.push({
      time: `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      sh: parseFloat(cumSh.toFixed(2)),
      sz: parseFloat(cumSz.toFixed(2)),
      total: parseFloat((cumSh + cumSz).toFixed(2)),
    })
  }
  return {
    sh: points.map(p => ({ time: p.time, value: p.sh })),
    sz: points.map(p => ({ time: p.time, value: p.sz })),
    total: points.map(p => ({ time: p.time, value: p.total })),
    updateTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  }
}

export const getNorthboundCapital = async () => {
  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/northbound')
      if (data && data.sh && data.sh.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取北向资金失败，降级到东方财富')
    }
  }

  await checkRealDataAvailable()
  if (_useRealData) {
    try {
      const baseUrl = import.meta.env.DEV ? '/api/eastmoney' : 'https://push2.eastmoney.com'
      const url = `${baseUrl}/api/qt/kamtbs.ww?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56&ut=b2884a393a59ad64002292a3e90d46a5`
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } })
      const json = await response.json()
      if (json.data) {
        const sh = [], sz = [], total = []
        const items = json.data.s2n || []
        items.forEach(item => {
          const parts = item.split(',')
          if (parts.length >= 4) {
            const time = parts[0]
            sh.push({ time, value: parseFloat(parts[1]) || 0 })
            sz.push({ time, value: parseFloat(parts[2]) || 0 })
            total.push({ time, value: parseFloat(parts[3]) || 0 })
          }
        })
        if (sh.length > 0) {
          return {
            sh, sz, total,
            updateTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          }
        }
      }
    } catch (e) {
      console.warn('[StockService] 北向资金API失败:', e)
    }
  }
  return generateNorthboundCapital()
}

// ==================== 新增：融资数据 ====================

const generateFinancingData = () => {
  const timeSharing = []
  let net = 0
  for (let i = 0; i < 48; i++) {
    net += (seededRandom() - 0.42) * 5
    timeSharing.push(parseFloat(net.toFixed(2)))
  }
  return {
    balance: parseFloat((seededRandom() * 5000 + 15000).toFixed(2)),
    buy: parseFloat((seededRandom() * 500 + 800).toFixed(2)),
    repay: parseFloat((seededRandom() * 400 + 600).toFixed(2)),
    net: parseFloat(net.toFixed(2)),
    timeSharing,
  }
}

export const getFinancingData = async () => {
  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/financing')
      if (data && data.balance !== undefined) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取融资数据失败，降级到模拟数据')
    }
  }

  // 融资数据免费API有限，使用模拟数据
  return generateFinancingData()
}

// ==================== 新增：IPO日历 ====================

const generateIPOCalendar = () => {
  const ipoNames = [
    { name: '华创新材', code: '301588', industry: '新材料' },
    { name: '中科智芯', code: '688721', industry: '半导体' },
    { name: '明远科技', code: '001388', industry: '软件' },
    { name: '盛景生物', code: '301606', industry: '医药' },
  ]
  return ipoNames.map((item, i) => {
    const price = (seededRandom() * 50 + 10).toFixed(2)
    const pe = (seededRandom() * 40 + 15).toFixed(1)
    const d = new Date()
    d.setDate(d.getDate() + i * 2 + 1)
    const applyDate = `${d.getMonth() + 1}/${d.getDate()}`
    d.setDate(d.getDate() + 7)
    const listDate = `${d.getMonth() + 1}/${d.getDate()}`
    return { ...item, price, pe, applyDate, listDate }
  })
}

export const getIPOCalendar = async () => {
  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/ipo')
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取IPO日历失败，降级到东方财富')
    }
  }

  await checkRealDataAvailable()
  if (_useRealData) {
    try {
      const url = 'https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_IPO&columns=ALL&pageSize=10&sortColumns=APPLY_DATE&sortTypes=-1&source=WEB&client=WEB'
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } })
      const json = await response.json()
      if (json.result?.data?.length) {
        return json.result.data.slice(0, 10).map(item => ({
          name: item.SECURITY_NAME || '--',
          code: item.SECURITY_CODE || '--',
          industry: item.INDUSTRY || '--',
          price: item.ISSUE_PRICE || '--',
          pe: item.PE_RATIO || '--',
          applyDate: item.APPLY_DATE?.slice(5).replace('-', '/') || '--',
          listDate: item.LIST_DATE?.slice(5)?.replace('-', '/') || '--',
        }))
      }
    } catch (e) {
      console.warn('[StockService] IPO日历API失败:', e)
    }
  }
  return generateIPOCalendar()
}

// ==================== 新增：解禁日历 ====================

const generateLockupCalendar = () => {
  const items = [
    { name: '宁德时代', code: '300750', type: '首发原股东' },
    { name: '比亚迪', code: '002594', type: '定增机构' },
    { name: '中芯国际', code: '688981', type: '首发机构' },
    { name: '隆基绿能', code: '601012', type: '股权激励' },
    { name: '迈瑞医疗', code: '300760', type: '首发原股东' },
  ]
  return items.map(item => {
    const d = new Date()
    d.setDate(d.getDate() + Math.floor(seededRandom() * 30 + 1))
    return {
      ...item,
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      volume: Math.floor(seededRandom() * 5000 + 500),
      marketValue: (seededRandom() * 200 + 20).toFixed(1),
    }
  })
}

export const getLockupCalendar = async () => {
  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/lockup')
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取解禁日历失败，降级到模拟数据')
    }
  }

  return generateLockupCalendar()
}

// ==================== 新增：财报日历 ====================

const generateEarningsCalendar = () => {
  const items = [
    { name: '贵州茅台', code: '600519', type: '年报' },
    { name: '招商银行', code: '600036', type: '季报' },
    { name: '美的集团', code: '000333', type: '半年报' },
    { name: '恒瑞医药', code: '600276', type: '季报' },
    { name: '中国平安', code: '601318', type: '年报' },
    { name: '立讯精密', code: '002475', type: '季报' },
  ]
  return items.map(item => {
    const d = new Date()
    d.setDate(d.getDate() + Math.floor(seededRandom() * 30 + 1))
    return {
      ...item,
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      changePercent: parseFloat(((seededRandom() - 0.4) * 30).toFixed(2)),
    }
  })
}

export const getEarningsCalendar = async () => {
  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/earnings')
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取财报日历失败，降级到模拟数据')
    }
  }

  return generateEarningsCalendar()
}

// ==================== 新增：全球指数 ====================

const generateGlobalIndices = () => {
  return [
    { code: 'HSI', name: '恒生指数', value: (18000 + seededRandom() * 2000).toFixed(2), changePercent: ((seededRandom() - 0.45) * 3).toFixed(2) },
    { code: 'N225', name: '日经225', value: (32000 + seededRandom() * 3000).toFixed(2), changePercent: ((seededRandom() - 0.45) * 2.5).toFixed(2) },
    { code: 'DJI', name: '道琼斯', value: (34000 + seededRandom() * 4000).toFixed(2), changePercent: ((seededRandom() - 0.45) * 2).toFixed(2) },
    { code: 'SPX', name: '标普500', value: (4500 + seededRandom() * 500).toFixed(2), changePercent: ((seededRandom() - 0.45) * 2).toFixed(2) },
    { code: 'NDX', name: '纳斯达克', value: (14000 + seededRandom() * 2000).toFixed(2), changePercent: ((seededRandom() - 0.45) * 2.5).toFixed(2) },
    { code: 'FTSE', name: '富时100', value: (7200 + seededRandom() * 800).toFixed(2), changePercent: ((seededRandom() - 0.45) * 1.5).toFixed(2) },
    { code: 'DAX', name: '德国DAX', value: (16000 + seededRandom() * 1500).toFixed(2), changePercent: ((seededRandom() - 0.45) * 2).toFixed(2) },
    { code: 'KS11', name: '韩国KOSPI', value: (2400 + seededRandom() * 400).toFixed(2), changePercent: ((seededRandom() - 0.45) * 2).toFixed(2) },
  ]
}

export const getGlobalIndices = async () => {
  // 优先尝试 akshare 后端（全球指数接口较慢，使用 35 秒超时）
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/global_indices', 35000)
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取全球指数失败，降级到东方财富')
    }
  }

  await checkRealDataAvailable()
  if (_useRealData) {
    try {
      const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&fields=f2,f3,f4,f12,f14&fs=i:100.HSI,i:100.N225,i:100.DJI,i:100.SPX,i:100.NDX,i:100.FTSE,i:100.GDAXI,i:100.KS11'
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } })
      const json = await response.json()
      if (json.data?.diff?.length) {
        return json.data.diff.map(item => ({
          code: item.f12,
          name: item.f14,
          value: item.f2?.toFixed(2) || '--',
          changePercent: item.f3?.toFixed(2) || '0.00',
        }))
      }
    } catch (e) {
      console.warn('[StockService] 全球指数API失败:', e)
    }
  }
  return generateGlobalIndices()
}

// ==================== 新增：汇率数据 ====================

const generateExchangeRates = () => {
  return [
    { name: '美元/人民币', code: 'USDCNY', rate: (7.1 + seededRandom() * 0.3).toFixed(4), change: ((seededRandom() - 0.5) * 0.3).toFixed(2) },
    { name: '欧元/人民币', code: 'EURCNY', rate: (7.7 + seededRandom() * 0.4).toFixed(4), change: ((seededRandom() - 0.5) * 0.3).toFixed(2) },
    { name: '日元/人民币', code: 'JPYCNY', rate: (0.047 + seededRandom() * 0.005).toFixed(4), change: ((seededRandom() - 0.5) * 0.5).toFixed(2) },
    { name: '英镑/人民币', code: 'GBPCNY', rate: (8.9 + seededRandom() * 0.5).toFixed(4), change: ((seededRandom() - 0.5) * 0.3).toFixed(2) },
    { name: '港币/人民币', code: 'HKDCNY', rate: (0.91 + seededRandom() * 0.03).toFixed(4), change: ((seededRandom() - 0.5) * 0.2).toFixed(2) },
  ]
}

export const getExchangeRates = async () => {
  // 优先尝试 akshare 后端（汇率接口较慢，使用 35 秒超时）
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/exchange_rates', 35000)
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取汇率失败，降级到模拟数据')
    }
  }

  return generateExchangeRates()
}

// ==================== 新增：行业热力图 ====================

export const getSectorHeatmap = async () => {
  // 优先尝试 akshare 后端
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/sector_heatmap')
      if (Array.isArray(data) && data.length > 0) return data
    } catch (e) {
      console.warn('[StockService] akshare 获取板块热力图失败，降级到本地计算')
    }
  }

  const allStocks = await getAllStockData()
  const sectorMap = {}
  allStocks.forEach(s => {
    const sector = s.sector || s.industry || '其他'
    if (!sectorMap[sector]) sectorMap[sector] = { name: sector, stocks: [], totalChange: 0, count: 0 }
    sectorMap[sector].stocks.push(s)
    sectorMap[sector].totalChange += parseFloat(s.changePercent) || 0
    sectorMap[sector].count += 1
  })
  return Object.values(sectorMap).map(sector => ({
    name: sector.name,
    avgChange: parseFloat((sector.totalChange / sector.count).toFixed(2)),
    upCount: sector.stocks.filter(s => parseFloat(s.changePercent) > 0).length,
    downCount: sector.stocks.filter(s => parseFloat(s.changePercent) < 0).length,
    count: sector.count,
    topStock: sector.stocks.sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent))[0]?.name || '--',
  })).sort((a, b) => b.avgChange - a.avgChange)
}

// ==================== 新增：多榜单数据（全市场实时） ====================

/**
 * 获取涨幅/跌幅排行（全市场实时数据）
 * 使用 akshare 后端 /ranking 接口，从全市场 5000+ 只股票中排序
 */
export const getPriceRanking = async () => {
  // 优先使用 akshare 全市场排行
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const [upData, downData] = await Promise.all([
        fetchFromAkshare('/ranking?direction=up&count=15'),
        fetchFromAkshare('/ranking?direction=down&count=15'),
      ])
      if (Array.isArray(upData) && Array.isArray(downData)) {
        return { up: upData, down: downData }
      }
    } catch (e) {
      console.warn('[StockService] akshare 获取涨跌排行失败，降级到本地数据')
    }
  }

  // 降级：使用本地股票池
  const allStocks = await getAllStockData()
  const sorted = [...allStocks].sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent))
  return {
    up: sorted.slice(0, 15),
    down: sorted.slice(-15).reverse(),
  }
}

/**
 * 获取资金流向排行（全市场实时数据）
 * 使用 akshare 后端 /fund_flow_ranking 接口
 */
export const getCapitalRanking = async () => {
  // 优先使用 akshare 资金流向排行
  await checkAkshareAvailable()
  if (_akshareAvailable) {
    try {
      const data = await fetchFromAkshare('/fund_flow_ranking', 20000)
      if (data && Array.isArray(data.inflow) && Array.isArray(data.outflow)) {
        return {
          inflow: data.inflow.map(s => ({ ...s, volume: s.mainNetInflow || '--' })),
          outflow: data.outflow.map(s => ({ ...s, volume: s.mainNetInflow || '--' })),
        }
      }
    } catch (e) {
      console.warn('[StockService] akshare 获取资金流向排行失败，降级到本地数据')
    }
  }

  // 降级：使用成交额作为资金流向的近似
  const allStocks = await getAllStockData()
  const sorted = [...allStocks].sort((a, b) => {
    const volA = parseFloat(a.turnover?.replace(/[^0-9.]/g, '')) || 0
    const volB = parseFloat(b.turnover?.replace(/[^0-9.]/g, '')) || 0
    return volB - volA
  })
  return {
    inflow: sorted.slice(0, 15).map(s => ({ ...s, volume: s.turnover || '--' })),
    outflow: sorted.slice(-15).reverse().map(s => ({ ...s, volume: s.turnover || '--' })),
  }
}

/**
 * 获取北向资金增持排行（全市场实时数据）
 * 使用 akshare 后端 /fund_flow_ranking 接口（北向资金暂无实时数据，使用主力资金流向替代）
 */
export const getNorthboundRanking = async () => {
  // 复用资金流向排行接口（北向实时数据已于2024年8月停发）
  return getCapitalRanking()
}

// ==================== 新增：财经新闻 ====================

/**
 * 获取重要财经新闻
 * 直接请求 akshare 后端 /news 接口（不依赖缓存的健康检查，避免首次加载时缓存 false 导致新闻永远不加载）
 * 后端已有 Baidu 财经作为降级方案
 */
export const getFinancialNews = async () => {
  try {
    const data = await fetchFromAkshare('/news', 15000)
    if (Array.isArray(data) && data.length > 0) return data
  } catch (e) {
    console.warn('[StockService] 获取新闻失败:', e?.message || e)
  }
  return []
}
