/**
 * 天气数据服务 - 纯前端版
 * 数据源：Open-Meteo API（支持 CORS + HTTPS，免费无需 API Key）
 * 仅展示当天天气，自动获取定位城市（失败则默认杭州）
 * 容错方案：直连失败自动切换公共 CORS 代理
 */

// 中国主要城市代码（用于城市名验证）
const CITIES = {
  '杭州': { code: '101210101', name: '杭州' },
  '北京': { code: '101010100', name: '北京' },
  '上海': { code: '101020100', name: '上海' },
  '广州': { code: '101280101', name: '广州' },
  '深圳': { code: '101280601', name: '深圳' },
  '成都': { code: '101270101', name: '成都' },
  '武汉': { code: '101200101', name: '武汉' },
  '西安': { code: '101110101', name: '西安' },
  '南京': { code: '101190101', name: '南京' },
  '重庆': { code: '101040100', name: '重庆' },
  '天津': { code: '101030100', name: '天津' },
  '苏州': { code: '101190401', name: '苏州' },
  '长沙': { code: '101250101', name: '长沙' },
  '郑州': { code: '101180101', name: '郑州' },
  '青岛': { code: '101120201', name: '青岛' },
  '大连': { code: '101070201', name: '大连' },
  '厦门': { code: '101230201', name: '厦门' },
  '福州': { code: '101230101', name: '福州' },
  '合肥': { code: '101220101', name: '合肥' },
  '济南': { code: '101120101', name: '济南' },
  '昆明': { code: '101290101', name: '昆明' },
  '沈阳': { code: '101070101', name: '沈阳' },
  '哈尔滨': { code: '101050101', name: '哈尔滨' },
  '长春': { code: '101060101', name: '长春' },
  '南宁': { code: '101300101', name: '南宁' },
  '贵阳': { code: '101260101', name: '贵阳' },
  '石家庄': { code: '101090101', name: '石家庄' },
  '太原': { code: '101100101', name: '太原' },
  '兰州': { code: '101160101', name: '兰州' },
  '海口': { code: '101310101', name: '海口' },
  '呼和浩特': { code: '101080101', name: '呼和浩特' },
  '拉萨': { code: '101140101', name: '拉萨' },
  '银川': { code: '101170101', name: '银川' },
  '西宁': { code: '101150101', name: '西宁' },
  '乌鲁木齐': { code: '101130101', name: '乌鲁木齐' },
}

// 天气类型图标映射（降级数据用）
const WEATHER_ICON_MAP = {
  '晴': { icon: '☀️', bg: 'sunny' },
  '多云': { icon: '⛅', bg: 'partly-cloudy' },
  '阴': { icon: '☁️', bg: 'cloudy' },
  '小雨': { icon: '🌦️', bg: 'rainy' },
  '中雨': { icon: '🌧️', bg: 'rainy' },
  '大雨': { icon: '🌧️', bg: 'rainy' },
  '暴雨': { icon: '⛈️', bg: 'stormy' },
  '雷阵雨': { icon: '⛈️', bg: 'stormy' },
  '小雪': { icon: '🌨️', bg: 'snowy' },
  '中雪': { icon: '🌨️', bg: 'snowy' },
  '大雪': { icon: '❄️', bg: 'snowy' },
  '雾': { icon: '🌫️', bg: 'foggy' },
  '霾': { icon: '😷', bg: 'foggy' },
  '沙尘暴': { icon: '🌪️', bg: 'foggy' },
  '阵雨': { icon: '🌦️', bg: 'rainy' },
  '雨夹雪': { icon: '🌨️', bg: 'snowy' },
  '冻雨': { icon: '🧊', bg: 'rainy' },
  '扬沙': { icon: '🌪️', bg: 'foggy' },
  '浮尘': { icon: '🌫️', bg: 'foggy' },
}

const getWeatherIcon = (type) => WEATHER_ICON_MAP[type] || { icon: '🌤️', bg: 'partly-cloudy' }

// ==================== Open-Meteo 配置 ====================

// 中国主要城市经纬度（用于 Open-Meteo API）
const CITY_COORDS = {
  '杭州': { lat: 30.27, lon: 120.15 },
  '北京': { lat: 39.90, lon: 116.41 },
  '上海': { lat: 31.23, lon: 121.47 },
  '广州': { lat: 23.13, lon: 113.26 },
  '深圳': { lat: 22.54, lon: 114.06 },
  '成都': { lat: 30.67, lon: 104.07 },
  '武汉': { lat: 30.59, lon: 114.31 },
  '西安': { lat: 34.27, lon: 108.95 },
  '南京': { lat: 32.04, lon: 118.78 },
  '重庆': { lat: 29.56, lon: 106.55 },
  '天津': { lat: 39.08, lon: 117.20 },
  '苏州': { lat: 31.30, lon: 120.62 },
  '长沙': { lat: 28.23, lon: 112.94 },
  '郑州': { lat: 34.75, lon: 113.65 },
  '青岛': { lat: 36.07, lon: 120.38 },
  '大连': { lat: 38.91, lon: 121.60 },
  '厦门': { lat: 24.48, lon: 118.09 },
  '福州': { lat: 26.08, lon: 119.30 },
  '合肥': { lat: 31.82, lon: 117.23 },
  '济南': { lat: 36.65, lon: 117.00 },
  '昆明': { lat: 25.04, lon: 102.72 },
  '沈阳': { lat: 41.80, lon: 123.43 },
  '哈尔滨': { lat: 45.80, lon: 126.53 },
  '长春': { lat: 43.82, lon: 125.32 },
  '南宁': { lat: 22.82, lon: 108.37 },
  '贵阳': { lat: 26.65, lon: 106.71 },
  '石家庄': { lat: 38.04, lon: 114.51 },
  '太原': { lat: 37.87, lon: 112.55 },
  '兰州': { lat: 36.06, lon: 103.83 },
  '海口': { lat: 20.04, lon: 110.20 },
  '呼和浩特': { lat: 40.81, lon: 111.75 },
  '拉萨': { lat: 29.65, lon: 91.13 },
  '银川': { lat: 38.49, lon: 106.23 },
  '西宁': { lat: 36.63, lon: 101.78 },
  '乌鲁木齐': { lat: 43.83, lon: 87.62 },
}

// WMO 天气代码 → 中文描述 + 图标
const WMO_CODE_MAP = {
  0:  { desc: '晴',     icon: '☀️',  bg: 'sunny' },
  1:  { desc: '晴',     icon: '☀️',  bg: 'sunny' },
  2:  { desc: '多云',   icon: '⛅',  bg: 'partly-cloudy' },
  3:  { desc: '阴',     icon: '☁️',  bg: 'cloudy' },
  45: { desc: '雾',     icon: '🌫️', bg: 'foggy' },
  48: { desc: '雾',     icon: '🌫️', bg: 'foggy' },
  51: { desc: '小雨',   icon: '🌦️', bg: 'rainy' },
  53: { desc: '中雨',   icon: '🌧️', bg: 'rainy' },
  55: { desc: '大雨',   icon: '🌧️', bg: 'rainy' },
  56: { desc: '冻雨',   icon: '🧊', bg: 'rainy' },
  57: { desc: '冻雨',   icon: '🧊', bg: 'rainy' },
  61: { desc: '小雨',   icon: '🌦️', bg: 'rainy' },
  63: { desc: '中雨',   icon: '🌧️', bg: 'rainy' },
  65: { desc: '大雨',   icon: '🌧️', bg: 'rainy' },
  66: { desc: '冻雨',   icon: '🧊', bg: 'rainy' },
  67: { desc: '冻雨',   icon: '🧊', bg: 'rainy' },
  71: { desc: '小雪',   icon: '🌨️', bg: 'snowy' },
  73: { desc: '中雪',   icon: '🌨️', bg: 'snowy' },
  75: { desc: '大雪',   icon: '❄️', bg: 'snowy' },
  77: { desc: '小雪',   icon: '🌨️', bg: 'snowy' },
  80: { desc: '阵雨',   icon: '🌦️', bg: 'rainy' },
  81: { desc: '阵雨',   icon: '🌧️', bg: 'rainy' },
  82: { desc: '暴雨',   icon: '⛈️', bg: 'stormy' },
  85: { desc: '阵雪',   icon: '🌨️', bg: 'snowy' },
  86: { desc: '阵雪',   icon: '❄️', bg: 'snowy' },
  95: { desc: '雷阵雨', icon: '⛈️', bg: 'stormy' },
  96: { desc: '雷阵雨', icon: '⛈️', bg: 'stormy' },
  99: { desc: '雷阵雨', icon: '⛈️', bg: 'stormy' },
}

const getWindDir = (deg) => {
  const dirs = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风']
  return dirs[Math.round(deg / 45) % 8]
}

// CORS 代理容错列表（Open-Meteo 已支持 CORS，代理仅作为降级备份）
// 注意：cors.eu.org 易限流（429），whateverorigin 优先；其余代理均已失效
const CORS_PROXIES = [
  (u) => `https://www.whateverorigin.org/get?url=${encodeURIComponent(u)}`,
  (u) => `https://cors.eu.org/${u}`,
]

/**
 * 从 Open-Meteo 获取天气（支持 CORS + HTTPS）
 * 直连失败时通过 CORS 代理降级
 */
const getWeatherFromOpenMeteo = async (cityName) => {
  const coords = CITY_COORDS[cityName] || CITY_COORDS['杭州']
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&current_weather=true` +
    `&hourly=relative_humidity_2m,apparent_temperature` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=Asia/Shanghai`

  let json = null

  // 1. 直连（Open-Meteo 原生支持 CORS）
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (response.ok) json = await response.json()
  } catch (e) {
    console.warn('[WeatherService] Open-Meteo 直连失败，尝试 CORS 代理:', e.message)
  }

  // 2. 依次尝试 CORS 代理
  for (let i = 0; i < CORS_PROXIES.length && !json; i++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 18000)
      const response = await fetch(CORS_PROXIES[i](url), { signal: controller.signal })
      clearTimeout(timeoutId)
      if (response.ok) {
        const raw = await response.json()
        // whateverorigin 返回 { contents: "...", status: {...} }，需要提取 contents
        json = (raw && typeof raw.contents === 'string') ? JSON.parse(raw.contents) : raw
      }
    } catch (e) {
      console.warn(`[WeatherService] CORS 代理 ${i} 失败:`, e.message)
    }
  }

  if (!json) return getFallbackWeather(cityName)

  try {
    const cw = json.current_weather
    const wmo = WMO_CODE_MAP[cw.weathercode] || { desc: '未知', icon: '🌤️', bg: 'partly-cloudy' }

    // 从 hourly 数据中提取当前小时的湿度和体感温度
    const nowHour = cw.time?.slice(0, 13) // "2026-07-30T17"
    const hourIdx = json.hourly?.time?.findIndex(t => t.startsWith(nowHour)) ?? -1
    const humidity = hourIdx >= 0 ? Math.round(json.hourly.relative_humidity_2m[hourIdx]) : 60
    const feelsLike = hourIdx >= 0 ? Math.round(json.hourly.apparent_temperature[hourIdx]) : Math.round(cw.temperature - 2)

    // 日最高/最低温度
    const high = json.daily?.temperature_2m_max?.[0] ? Math.round(json.daily.temperature_2m_max[0]) : Math.round(cw.temperature + 3)
    const low = json.daily?.temperature_2m_min?.[0] ? Math.round(json.daily.temperature_2m_min[0]) : Math.round(cw.temperature - 5)

    const isDay = cw.is_day === 1
    return {
      city: cityName,
      temperature: Math.round(cw.temperature),
      feelsLike,
      humidity,
      weatherDesc: wmo.desc,
      weatherIcon: isDay ? wmo.icon : (wmo.desc === '晴' ? '🌙' : wmo.icon),
      weatherBg: wmo.bg,
      windSpeed: Math.round(cw.windspeed),
      windDirection: getWindDir(cw.winddirection),
      updateTime: cw.time?.split('T')[1]?.slice(0, 5) || '--:--',
      aqi: 0,
      quality: '--',
      pm25: 0,
      pm10: 0,
      high,
      low,
      notice: isDay ? '注意防晒补水' : '夜间温差较大',
    }
  } catch (error) {
    console.warn('[WeatherService] Open-Meteo 数据解析失败:', error.message)
    return getFallbackWeather(cityName)
  }
}

// ==================== 定位逻辑 ====================

/**
 * 尝试通过浏览器 Geolocation + 反向地理编码获取城市名
 * 失败则返回 '杭州'
 */
export const detectCity = async () => {
  // 1. 先检查 localStorage 缓存
  const cached = localStorage.getItem('weather_city')
  if (cached && CITIES[cached]) return cached

  // 2. 尝试浏览器定位
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('不支持定位'))
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: false })
    })

    const { latitude, longitude } = pos.coords

    // 使用免费反向地理编码 API
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 4000)
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=zh`,
      { signal: controller.signal, headers: { 'Accept': 'application/json' } }
    )
    const geoJson = await geoRes.json()
    const addr = geoJson.address || {}
    // 尝试匹配城市
    const candidates = [addr.city, addr.town, addr.county, addr.state, addr.province]
    for (const name of candidates) {
      if (name && CITIES[name]) {
        localStorage.setItem('weather_city', name)
        return name
      }
      // 处理 "杭州市" -> "杭州" 的情况
      if (name) {
        const short = name.replace(/市$|省$|自治区$|壮族$|回族$|维吾尔$/, '')
        if (CITIES[short]) {
          localStorage.setItem('weather_city', short)
          return short
        }
      }
    }
    console.warn('[Weather] 定位成功但无法匹配城市，坐标:', latitude, longitude)
  } catch (e) {
    console.warn('[Weather] 定位失败:', e.message)
  }

  // 3. 默认杭州
  return '杭州'
}

// ==================== 天气获取 ====================

/**
 * 获取当天实时天气（仅今天）
 * 纯前端模式：直连 Open-Meteo API，失败降级为模拟数据
 */
export const getCurrentWeather = async (cityName = '杭州') => {
  const actualCity = CITIES[cityName] ? cityName : '杭州'
  return getWeatherFromOpenMeteo(actualCity)
}

// 降级模拟数据
const getFallbackWeather = (cityName) => {
  const hour = new Date().getHours()
  const isNight = hour < 6 || hour > 20
  return {
    city: cityName,
    temperature: isNight ? 22 : 28,
    feelsLike: isNight ? 21 : 30,
    humidity: 65,
    weatherDesc: isNight ? '晴' : '主要晴朗',
    weatherIcon: isNight ? '🌙' : '☀️',
    weatherBg: isNight ? 'night' : 'sunny',
    windSpeed: 12,
    windDirection: '南风',
    updateTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    aqi: 45,
    quality: '优',
    pm25: 10,
    pm10: 18,
    high: 33,
    low: 25,
    notice: '数据加载失败，显示模拟数据',
  }
}
