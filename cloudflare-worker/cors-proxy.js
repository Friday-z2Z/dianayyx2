/**
 * Cloudflare Worker - CORS 代理（兼容前端 API 路径）
 *
 * 部署步骤：
 * 1. 注册 Cloudflare 账号（免费）：https://dash.cloudflare.com/sign-up
 * 2. 进入 Workers & Pages → Create application → Create Worker
 * 3. 起名如 cors-proxy，点击 Deploy
 * 4. 点击 "Edit code"，将本文件内容粘贴进去，点击 Deploy
 * 5. 复制 Worker URL（如 https://cors-proxy.your-name.workers.dev）
 * 6. 在 GitHub 仓库 Settings → Secrets and variables → Actions → New repository secret
 *    Name: VITE_API_BASE
 *    Value: https://cors-proxy.your-name.workers.dev
 * 7. 重新推送代码到 main 分支触发自动构建
 *
 * 部署后所有 API 请求通过 Cloudflare Worker 代理，解决 ERR_CONNECTION_CLOSED 问题
 * Cloudflare 免费额度：10万请求/天，足够个人使用
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

// 路由映射：前端路径 → 目标 API
const ROUTES = {
  // 东方财富行情 API
  '/api/eastmoney': {
    target: 'https://push2delay.eastmoney.com',
    stripPrefix: '/api/eastmoney',
    headers: { 'Referer': 'https://quote.eastmoney.com/' },
  },
  // 东方财富新闻 API
  '/api/akshare/em_news': {
    target: 'https://np-weblist.eastmoney.com/comm/web/getFastNewsList',
    stripPrefix: '/api/akshare/em_news',
    params: { client: 'web', biz: 'web_724', fastColumn: '102', sortEnd: '', pageSize: '15' },
    headers: { 'Referer': 'https://kuaixun.eastmoney.com/' },
  },
}

export default {
  async fetch(request) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url = new URL(request.url)

    // 健康检查
    if (url.pathname === '/' || url.pathname === '/api/akshare/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'CORS Proxy Worker' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // 天气 API 代理
    if (url.pathname.startsWith('/api/weather/city/')) {
      const cityCode = url.pathname.split('/').pop()
      const targetUrl = `http://t.weather.itboy.net/api/weather/city/${cityCode}`
      return _proxyFetch(targetUrl, { 'Referer': 'https://www.weather.com.cn/' })
    }

    // 东方财富 API 代理（路径前缀匹配）
    for (const [prefix, config] of Object.entries(ROUTES)) {
      if (url.pathname.startsWith(prefix)) {
        let targetUrl
        if (config.stripPrefix) {
          const subPath = url.pathname.slice(config.stripPrefix.length)
          const searchParams = new URLSearchParams({ ...config.params, ...Object.fromEntries(url.searchParams) })
          targetUrl = `${config.target}${subPath}${searchParams.toString() ? '?' + searchParams.toString() : ''}`
        } else {
          const searchParams = new URLSearchParams({ ...config.params, ...Object.fromEntries(url.searchParams) })
          targetUrl = `${config.target}?${searchParams.toString()}`
        }
        return _proxyFetch(targetUrl, config.headers)
      }
    }

    // 通用代理：/proxy?url=<target>
    if (url.pathname === '/proxy') {
      const targetUrl = url.searchParams.get('url')
      if (targetUrl) return _proxyFetch(targetUrl, { 'Referer': 'https://quote.eastmoney.com/' })
    }

    return new Response(JSON.stringify({ error: 'Not found', path: url.pathname }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  },
}

async function _proxyFetch(targetUrl, extraHeaders = {}) {
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        ...extraHeaders,
      },
    })
    const data = await response.text()
    return new Response(data, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, target: targetUrl }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}
