/**
 * 天气数据服务 v2
 * 数据源：t.weather.itboy.net（免费无需API Key）
 * 仅展示当天天气，自动获取定位城市（失败则默认杭州）
 */

// 中国主要城市代码
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

// 天气类型图标映射
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

const getWindLevel = (fl) => {
  const m = { '<3级':2,'1级':1,'2级':2,'3级':3,'3-4级':3,'4级':4,'4-5级':4,'5级':5,'5-6级':5,'6级':6,'7级':7,'8级':7,'9级':8,'10级':9,'11级':10,'12级':11 }
  return m[fl] || 2
}

const parseTemp = (str) => {
  const match = String(str).match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
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
 */
export const getCurrentWeather = async (cityName = '杭州') => {
  const city = CITIES[cityName] || CITIES['杭州']
  const actualCity = city === CITIES[cityName] ? cityName : '杭州'

  let timeoutId = null
  try {
    const baseUrl = import.meta.env.DEV ? '/api/weather' : 'http://t.weather.itboy.net/api/weather'
    const url = `${baseUrl}/city/${city.code}`

    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()

    if (json.status !== 200 || !json.data) {
      throw new Error(json.message || '天气API返回数据异常')
    }

    const data = json.data
    const today = data.forecast[0]
    const weatherInfo = getWeatherIcon(today.type)

    return {
      city: json.cityInfo.city.replace('市', ''),
      temperature: Math.round(parseFloat(data.wendu)),
      feelsLike: Math.round(parseFloat(data.wendu) - 2),
      humidity: parseInt(data.shidu),
      weatherDesc: today.type,
      weatherIcon: weatherInfo.icon,
      weatherBg: weatherInfo.bg,
      windSpeed: getWindLevel(today.fl) * 5,
      windDirection: today.fx,
      updateTime: json.time?.split(' ')[1]?.slice(0, 5) || '--:--',
      aqi: data.forecast[0].aqi,
      quality: data.quality,
      pm25: data.pm25,
      pm10: data.pm10,
      high: parseTemp(today.high),
      low: parseTemp(today.low),
      notice: today.notice,
    }
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId)
    console.warn('[WeatherService] 天气API请求失败:', error.message)
    return getFallbackWeather(actualCity)
  }
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
