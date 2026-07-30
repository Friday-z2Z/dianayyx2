"""
akshare 股票数据 API 服务
基于 akshare 库提供真实 A 股市场数据
通过 Flask 提供 HTTP API，供前端 Vue 应用调用

优化：后台预加载全市场数据，所有接口从缓存读取，刷新周期 60s
"""

import sys
import os
import time
import threading
from datetime import datetime, timedelta
from functools import wraps

# 确保 stdout 使用 utf-8 编码（Windows 环境）
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# 清除系统代理设置，避免 akshare/requests 通过代理连接失败
# Windows 系统代理（如 Clash/V2Ray）会导致 akshare 的 requests 请求出现 RemoteDisconnected
for _proxy_key in ('HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy'):
    os.environ.pop(_proxy_key, None)
os.environ['NO_PROXY'] = '*'

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import requests as _requests
import akshare as ak
import pandas as pd
import numpy as np

# ==================== 关键：绕过 Windows 系统代理 ====================
# Windows 系统代理（Clash/V2Ray 127.0.0.1:7897）会导致所有 HTTP 请求被拦截
# requests 库默认从环境变量和 Windows 注册表读取代理设置
# trust_env=False 可完全禁止读取代理配置，确保直连目标服务器
_original_session_init = _requests.Session.__init__
def _no_proxy_session_init(self, *args, **kwargs):
    _original_session_init(self, *args, **kwargs)
    self.trust_env = False
    self.proxies = {'http': None, 'https': None}
_requests.Session.__init__ = _no_proxy_session_init

# 全局无代理 Session，用于所有直接 HTTP 调用
_session = _requests.Session()
_session.trust_env = False
_session.proxies = {'http': None, 'https': None}

# ==================== 静态文件服务（打包后部署） ====================
# dist 目录路径：server/ 的上一级目录中的 dist/
_DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')

app = Flask(__name__, static_folder=None)  # 禁用默认静态文件路由，手动控制
CORS(app)

# ==================== 全局市场数据缓存 ====================
# stock_zh_a_spot_em() 下载全部 A 股行情需要 60-70 秒
# 在后台线程预加载，所有接口共享同一份缓存
_market_df = None          # 全市场实时行情 DataFrame
_market_df_lock = threading.Lock()
_market_df_loading = False
_market_df_last_update = 0
_MARKET_REFRESH_INTERVAL = 60  # 刷新间隔（秒）

# 慢速接口数据缓存（汇率、全球指数等）
_slow_cache = {}           # {key: (data, timestamp)}
_slow_cache_lock = threading.Lock()
_SLOW_CACHE_TTL = 600      # 慢速接口缓存 TTL（秒）

def _fetch_market_data_from_em_direct():
    """直接从东方财富 push2delay API 获取全市场行情
    当 akshare 的 82.push2.eastmoney.com 被系统代理阻断时的降级方案。
    push2delay 每页最多返回 100 条，需要分页获取全部 5885 只股票。
    返回与 ak.stock_zh_a_spot_em() 相同列名的 DataFrame。
    """
    all_items = []
    page = 1
    max_pages = 80  # 5885 / 100 ≈ 59 页，留余量
    while page <= max_pages:
        url = 'https://push2delay.eastmoney.com/api/qt/clist/get'
        params = {
            'pn': str(page), 'pz': '100', 'po': '1', 'np': '1',
            'ut': 'bd1d9ddb04089700cf9c27f6f7426281',
            'fltt': '2', 'invt': '2', 'fid': 'f12',
            'fs': 'm:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23,m:0 t:81 s:2048',
            'fields': 'f2,f3,f4,f5,f6,f7,f8,f9,f12,f14,f15,f16,f17,f18,f20,f23',
        }
        r = _session.get(url, params=params, timeout=30,
                          headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
        data = r.json()
        items = data.get('data', {}).get('diff', [])
        if not items:
            break
        all_items.extend(items)
        if len(items) < 100:
            break
        page += 1

    # 转换为与 akshare 相同列名的 DataFrame
    col_map = {
        'f2': '最新价', 'f3': '涨跌幅', 'f4': '涨跌额', 'f5': '成交量',
        'f6': '成交额', 'f7': '振幅', 'f8': '换手率', 'f9': '市盈率-动态',
        'f12': '代码', 'f14': '名称', 'f15': '最高', 'f16': '最低',
        'f17': '今开', 'f18': '昨收', 'f20': '总市值', 'f23': '市净率',
    }
    rows = []
    for item in all_items:
        row = {}
        for f, col in col_map.items():
            row[col] = item.get(f)
        rows.append(row)
    df = pd.DataFrame(rows)
    if not df.empty:
        df['代码'] = df['代码'].astype(str).str.zfill(6)
    print(f"[push2delay] 获取 {len(df)} 只股票 ({page-1} 页)")
    return df


def _refresh_market_data():
    """后台刷新全市场行情数据"""
    global _market_df, _market_df_loading, _market_df_last_update
    with _market_df_lock:
        if _market_df_loading:
            return
        _market_df_loading = True

    try:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 开始刷新全市场行情...")
        t0 = time.time()
        try:
            df = ak.stock_zh_a_spot_em()
        except Exception as e_ak:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] akshare 获取失败({e_ak}), 降级到 push2delay 直连...")
            df = None
        if df is None or df.empty:
            df = _fetch_market_data_from_em_direct()
        elapsed = time.time() - t0
        if df is not None and not df.empty:
            df['代码'] = df['代码'].astype(str).str.zfill(6)
            with _market_df_lock:
                _market_df = df
                _market_df_last_update = time.time()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 全市场行情刷新完成: {len(df)} 只股票, 耗时 {elapsed:.1f}s")
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 全市场行情数据为空")
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 全市场行情刷新失败: {e}")
    finally:
        with _market_df_lock:
            _market_df_loading = False


def _get_market_df():
    """获取全市场行情 DataFrame（从缓存）"""
    with _market_df_lock:
        return _market_df


def _market_data_ready():
    """检查市场数据是否已加载"""
    with _market_df_lock:
        return _market_df is not None and not _market_df.empty


def _market_data_age():
    """获取缓存数据的年龄（秒）"""
    with _market_df_lock:
        if _market_df_last_update == 0:
            return 999999
        return time.time() - _market_df_last_update


def _prefetch_slow_endpoints():
    """预加载慢速接口数据（汇率、全球指数、指数行情等），避免首次请求超时"""
    endpoints = [
        ('indices', _fetch_indices_cached),
        ('exchange_rates', _get_exchange_rates_data),
        ('global_indices', _get_global_indices_data),
    ]
    with app.app_context():
        for name, func in endpoints:
            try:
                t0 = time.time()
                func()
                print(f"[{datetime.now().strftime('%H:%M:%S')}] 预加载 {name} 完成, 耗时 {time.time()-t0:.1f}s")
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] 预加载 {name} 失败: {e}")


def _background_refresh_loop():
    """后台刷新循环：启动时立即加载，之后每 60 秒刷新一次"""
    # 首次加载市场数据
    _refresh_market_data()
    # 市场数据加载完成后，预加载慢速接口
    _prefetch_slow_endpoints()
    last_slow_refresh = time.time()
    while True:
        time.sleep(10)
        if _market_data_age() > _MARKET_REFRESH_INTERVAL and not _market_df_loading:
            _refresh_market_data()
        # 每 5 分钟刷新一次慢速接口缓存
        if time.time() - last_slow_refresh > 300:
            _prefetch_slow_endpoints()
            last_slow_refresh = time.time()


# ==================== 轻量缓存（用于非全市场接口） ====================
_light_cache = {}
_light_cache_lock = threading.Lock()

def cached(key, ttl=60):
    """装饰器：缓存函数结果（轻量接口用）"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = f"{key}:{':'.join(str(a) for a in args)}"
            now = time.time()
            with _light_cache_lock:
                if cache_key in _light_cache:
                    data, ts = _light_cache[cache_key]
                    if now - ts < ttl:
                        return data
            result = func(*args, **kwargs)
            with _light_cache_lock:
                _light_cache[cache_key] = (result, now)
            return result
        return wrapper
    return decorator


# ==================== 工具函数 ====================
def safe_float(val, default=0.0):
    try:
        if val is None or (isinstance(val, float) and np.isnan(val)) or val == '-' or val == '':
            return default
        return float(val)
    except (ValueError, TypeError):
        return default

def format_volume(vol):
    v = safe_float(vol)
    if v >= 1e8:
        return f"{v / 1e8:.2f}亿"
    if v >= 1e4:
        return f"{v / 1e4:.0f}万"
    return str(int(v))

def format_money(num):
    n = safe_float(num)
    abs_n = abs(n)
    if abs_n >= 1e8:
        return f"{n / 1e8:.2f}亿"
    if abs_n >= 1e4:
        return f"{n / 1e4:.0f}万"
    return f"{n:.0f}"

def format_market_cap(num):
    n = safe_float(num)
    abs_n = abs(n)
    if abs_n >= 1e12:
        return f"{n / 1e12:.2f}万亿"
    if abs_n >= 1e8:
        return f"{n / 1e8:.1f}亿"
    return f"{n:.0f}万"


# ==================== 从全市场缓存中提取数据 ====================

def _extract_stock_list():
    """从全市场缓存中提取股票行情（按总市值降序，最多返回200只）"""
    df = _get_market_df()
    if df is None or df.empty:
        return None
    full_df = df.copy()
    # 按总市值降序排列
    if '总市值' in full_df.columns:
        full_df['总市值'] = full_df['总市值'].apply(safe_float)
        full_df = full_df.sort_values('总市值', ascending=False)
    result = []
    for _, row in full_df.head(200).iterrows():
        code = str(row.get('代码', '')).zfill(6)
        price = safe_float(row.get('最新价'))
        change_percent = safe_float(row.get('涨跌幅'))
        change = safe_float(row.get('涨跌额'))
        prev_close = price - change if price and change else safe_float(row.get('昨收'))
        # industry / sector 直接从行情数据中获取（全市场行情通常无此列，则设为 '--'）
        industry_val = row.get('行业') if '行业' in row else None
        sector_val = row.get('板块') if '板块' in row else None
        result.append({
            'code': code,
            'name': str(row.get('名称', '--')),
            'price': f"{price:.2f}" if price else '--',
            'change': f"{change:.2f}" if change else '--',
            'changePercent': f"{change_percent:.2f}" if change_percent else '0.00',
            'volume': format_volume(row.get('成交量')),
            'turnover': format_money(row.get('成交额')),
            'amplitude': f"{safe_float(row.get('振幅')):.2f}",
            'turnoverRate': f"{safe_float(row.get('换手率')):.2f}",
            'pe': f"{safe_float(row.get('市盈率-动态')):.2f}" if safe_float(row.get('市盈率-动态')) else '--',
            'high': f"{safe_float(row.get('最高')):.2f}",
            'low': f"{safe_float(row.get('最低')):.2f}",
            'open': f"{safe_float(row.get('今开')):.2f}",
            'prevClose': f"{prev_close:.2f}" if prev_close else '--',
            'marketCap': format_market_cap(row.get('总市值')),
            'pb': f"{safe_float(row.get('市净率')):.2f}" if safe_float(row.get('市净率')) else '--',
            'industry': str(industry_val) if industry_val is not None and str(industry_val) != 'nan' else '--',
            'sector': str(sector_val) if sector_val is not None and str(sector_val) != 'nan' else '--',
        })
    return result


def _extract_market_stats():
    """从全市场缓存中提取涨跌统计"""
    df = _get_market_df()
    if df is None or df.empty:
        return None
    changes = df['涨跌幅'].apply(safe_float)
    up_count = int((changes > 0).sum())
    down_count = int((changes < 0).sum())
    flat_count = int((changes == 0).sum())
    limit_up = int((changes >= 9.9).sum())
    limit_down = int((changes <= -9.9).sum())
    # 炸板：振幅大且当前涨幅回落
    bomb_count = 0
    if '振幅' in df.columns:
        high_changes = changes + df['振幅'].apply(safe_float) * 0.5
        bomb_count = int(((high_changes >= 9.9) & (changes < 9.0)).sum())
    return {
        'upCount': up_count,
        'downCount': down_count,
        'flatCount': flat_count,
        'limitUpCount': limit_up,
        'limitDownCount': limit_down,
        'bombCount': bomb_count,
    }


def _extract_ranking(direction='up', count=100):
    """从全市场缓存中提取涨跌排行（全市场，不限于预设股票池）"""
    df = _get_market_df()
    if df is None or df.empty:
        return None
    # 使用全市场数据，不限于预设股票池
    full_df = df.copy()
    full_df['涨跌幅'] = full_df['涨跌幅'].apply(safe_float)
    # 过滤掉涨跌幅为0或NaN的（可能是停牌）
    full_df = full_df[full_df['涨跌幅'].notna() & (full_df['涨跌幅'] != 0)]
    if direction == 'up':
        full_df = full_df.sort_values('涨跌幅', ascending=False)
    else:
        full_df = full_df.sort_values('涨跌幅', ascending=True)
    result = []
    for _, row in full_df.head(count).iterrows():
        code = str(row.get('代码', '')).zfill(6)
        price = safe_float(row.get('最新价'))
        result.append({
            'code': code,
            'name': str(row.get('名称', '--')),
            'price': f"{price:.2f}" if price else '--',
            'changePercent': f"{safe_float(row.get('涨跌幅')):.2f}",
            'change': f"{safe_float(row.get('涨跌额')):.2f}",
            'volume': format_volume(row.get('成交量')),
            'turnover': format_money(row.get('成交额')),
            'industry': '--',
            'sector': '--',
        })
    return result


# ==================== API 路由 ====================

@app.route('/api/akshare/health')
def health():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'time': datetime.now().isoformat(),
        'akshare_version': ak.__version__,
        'market_data_ready': _market_data_ready(),
        'market_data_age': round(_market_data_age(), 0),
    })


@app.route('/api/akshare/stocks')
def get_stocks():
    """获取股票池实时行情"""
    if not _market_data_ready():
        return jsonify({'error': '数据加载中，请稍后重试', 'loading': True}), 503
    try:
        result = _extract_stock_list()
        if result is None:
            return jsonify({'error': '数据为空'}), 500
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_stocks: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/market_analysis')
def get_market_analysis():
    """获取大盘分析数据（指数 + 涨跌家数）"""
    try:
        # 指数数据（轻量调用，有缓存）
        index_data = _fetch_indices_cached()

        # 全市场统计（从缓存读取）
        stats = _extract_market_stats()
        if stats is None:
            return jsonify({'error': '市场数据加载中', 'loading': True}), 503

        return jsonify({
            **index_data,
            **stats,
            'northBoundFlow': '--',
            'totalVolume': '--',
            'marketSentiment': '偏多' if stats['upCount'] > stats['downCount'] else '偏空' if stats['downCount'] > stats['upCount'] * 1.2 else '震荡',
        })
    except Exception as e:
        print(f"[ERROR] get_market_analysis: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/market_sentiment')
def get_market_sentiment():
    """获取市场情绪数据（涨跌家数、涨跌停、炸板）"""
    try:
        stats = _extract_market_stats()
        if stats is None:
            return jsonify({'error': '市场数据加载中', 'loading': True}), 503

        # 分时涨跌家数（akshare 无直接接口，基于当前数据模拟走势）
        now = datetime.now()
        total_minutes = max(0, min(240, (now.hour - 9) * 60 + now.minute - 30))
        time_arr, up_arr, down_arr = [], [], []
        for i in range(0, total_minutes + 1, 5):
            m = i + 30
            h = 9 + m // 60
            mm = m % 60
            if h == 11 and mm > 30:
                continue
            if h == 12:
                continue
            if h > 15:
                break
            time_arr.append(f"{h:02d}:{mm:02d}")
            progress = i / 240 if total_minutes > 0 else 0
            base_up = stats['upCount'] * (0.3 + progress * 0.7)
            base_down = stats['downCount'] * (0.3 + progress * 0.7)
            up_arr.append(int(base_up + (np.random.random() - 0.5) * 200))
            down_arr.append(int(base_down + (np.random.random() - 0.5) * 200))

        return jsonify({
            **stats,
            'timeSharing': {'time': time_arr, 'up': up_arr, 'down': down_arr},
        })
    except Exception as e:
        print(f"[ERROR] get_market_sentiment: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== 指数数据（轻量缓存） ====================
_indices_cache = None
_indices_cache_time = 0
_indices_lock = threading.Lock()

def _fetch_indices_cached():
    """获取三大指数数据，缓存 120 秒

    优化：使用单次 ak.stock_zh_index_spot_em(symbol='沪深重要指数') 调用，
    一次性获取上证指数、深证成指、创业板指数据，避免多次网络请求导致超时。
    """
    global _indices_cache, _indices_cache_time
    with _indices_lock:
        if _indices_cache is not None and time.time() - _indices_cache_time < 120:
            return _indices_cache

    sh_data = {'value': '--', 'change': '0.00', 'name': '上证指数'}
    sz_data = {'value': '--', 'change': '0.00', 'name': '深证成指'}
    cy_data = {'value': '--', 'change': '0.00', 'name': '创业板指'}

    try:
        # 单次调用获取沪深重要指数（包含上证指数、深证成指、创业板指）
        index_df = ak.stock_zh_index_spot_em(symbol='沪深重要指数')
        if index_df is not None and not index_df.empty:
            for _, row in index_df.iterrows():
                name = str(row.get('名称', ''))
                code = str(row.get('代码', ''))
                if name == '上证指数' or code == '000001':
                    sh_data = {'value': f"{safe_float(row.get('最新价')):.2f}", 'change': f"{safe_float(row.get('涨跌幅')):.2f}", 'name': name}
                elif name == '深证成指' or code == '399001':
                    sz_data = {'value': f"{safe_float(row.get('最新价')):.2f}", 'change': f"{safe_float(row.get('涨跌幅')):.2f}", 'name': name}
                elif name == '创业板指' or code == '399006':
                    cy_data = {'value': f"{safe_float(row.get('最新价')):.2f}", 'change': f"{safe_float(row.get('涨跌幅')):.2f}", 'name': name}
        else:
            print("[WARN] 沪深重要指数数据为空，尝试分别获取")
            # 降级：分别获取
            for symbol in ['上证系列指数', '深证系列指数']:
                try:
                    fallback_df = ak.stock_zh_index_spot_em(symbol=symbol)
                    if fallback_df is None or fallback_df.empty:
                        continue
                    for _, row in fallback_df.iterrows():
                        name = str(row.get('名称', ''))
                        code = str(row.get('代码', ''))
                        if name == '上证指数' or code == '000001':
                            sh_data = {'value': f"{safe_float(row.get('最新价')):.2f}", 'change': f"{safe_float(row.get('涨跌幅')):.2f}", 'name': name}
                        elif name == '深证成指' or code == '399001':
                            sz_data = {'value': f"{safe_float(row.get('最新价')):.2f}", 'change': f"{safe_float(row.get('涨跌幅')):.2f}", 'name': name}
                        elif name == '创业板指' or code == '399006':
                            cy_data = {'value': f"{safe_float(row.get('最新价')):.2f}", 'change': f"{safe_float(row.get('涨跌幅')):.2f}", 'name': name}
                except Exception as e:
                    print(f"[WARN] 降级获取{symbol}失败: {e}")

        result = {'shIndex': sh_data, 'szIndex': sz_data, 'cyIndex': cy_data}
        with _indices_lock:
            _indices_cache = result
            _indices_cache_time = time.time()
        return result
    except Exception as e:
        print(f"[WARN] 指数获取失败({e}), 降级到 push2delay 直连...")
        # 降级：push2delay ulist API
        try:
            url = 'https://push2delay.eastmoney.com/api/qt/ulist.np/get'
            params = {
                'fltt': '2', 'invt': '2',
                'fields': 'f2,f3,f4,f6,f12,f14',
                'secids': '1.000001,0.399001,0.399006',
            }
            r = _session.get(url, params=params, timeout=8,
                             headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
            items = r.json().get('data', {}).get('diff', [])
            if items and len(items) >= 3:
                sh_data = {'value': f"{safe_float(items[0].get('f2')):.2f}", 'change': f"{safe_float(items[0].get('f3')):.2f}", 'name': items[0].get('f14', '上证指数')}
                sz_data = {'value': f"{safe_float(items[1].get('f2')):.2f}", 'change': f"{safe_float(items[1].get('f3')):.2f}", 'name': items[1].get('f14', '深证成指')}
                cy_data = {'value': f"{safe_float(items[2].get('f2')):.2f}", 'change': f"{safe_float(items[2].get('f3')):.2f}", 'name': items[2].get('f14', '创业板指')}
        except Exception as e2:
            print(f"[WARN] push2delay 指数获取也失败: {e2}")
        result = {'shIndex': sh_data, 'szIndex': sz_data, 'cyIndex': cy_data}
        with _indices_lock:
            _indices_cache = result
            _indices_cache_time = time.time()
        return result


@app.route('/api/akshare/northbound')
@cached('northbound', 300)
def get_northbound():
    """获取北向资金数据（日级，返回 sh/sz/total 格式）

    注意：沪深交易所自2024年8月19日起停止发布北向资金实时数据，
    历史数据仅更新至2024-8-16。此处返回最后30条有效历史数据。
    """
    try:
        df = ak.stock_hsgt_hist_em(symbol='北向资金')
        if df is None or df.empty:
            raise ValueError("北向资金数据为空")

        # 过滤掉 当日成交净买额 为 NaN 的行（2024-08-19 后无数据）
        col_net = '当日成交净买额'
        if col_net not in df.columns:
            # 兼容旧版列名
            for c in df.columns:
                if '净买' in c:
                    col_net = c
                    break
        valid_df = df[df[col_net].notna()].copy()
        if valid_df.empty:
            raise ValueError("无有效北向资金数据")

        # 分别获取沪股通和深股通历史数据
        sh_df = ak.stock_hsgt_hist_em(symbol='沪股通')
        sz_df = ak.stock_hsgt_hist_em(symbol='深股通')

        # 过滤有效行
        sh_valid = sh_df[sh_df[col_net].notna()].copy() if sh_df is not None and not sh_df.empty else valid_df
        sz_valid = sz_df[sz_df[col_net].notna()].copy() if sz_df is not None and not sz_df.empty else valid_df

        # 取最近 30 天有效数据
        recent_total = valid_df.tail(30)
        recent_sh = sh_valid.tail(30)
        recent_sz = sz_valid.tail(30)

        sh, sz, total = [], [], []
        for _, row in recent_sh.iterrows():
            date_str = str(row.get('日期', ''))
            short_date = date_str[5:10] if len(date_str) >= 10 else date_str
            val = safe_float(row.get(col_net, 0))
            sh.append({'time': short_date, 'value': round(val, 2)})
        for _, row in recent_sz.iterrows():
            date_str = str(row.get('日期', ''))
            short_date = date_str[5:10] if len(date_str) >= 10 else date_str
            val = safe_float(row.get(col_net, 0))
            sz.append({'time': short_date, 'value': round(val, 2)})
        for _, row in recent_total.iterrows():
            date_str = str(row.get('日期', ''))
            short_date = date_str[5:10] if len(date_str) >= 10 else date_str
            val = safe_float(row.get(col_net, 0))
            total.append({'time': short_date, 'value': round(val, 2)})

        # 最后有效日期
        last_date = str(valid_df['日期'].iloc[-1]) if '日期' in valid_df.columns else ''

        return jsonify({
            'sh': sh,
            'sz': sz,
            'total': total,
            'updateTime': datetime.now().strftime('%H:%M'),
            'lastDate': last_date,
            'note': '北向资金实时数据自2024-08-19起停止发布，显示为最后有效历史数据',
        })
    except Exception as e:
        print(f"[ERROR] get_northbound: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/ipo')
@cached('ipo', 3600)
def get_ipo_calendar():
    """获取新股日历
    使用 stock_new_ipo_cninfo() 获取含发行价和发行市盈率的新股数据
    """
    try:
        df = ak.stock_new_ipo_cninfo()
        if df is None or df.empty:
            raise ValueError("IPO数据为空")
        # 按申购日期降序排列（最近的在前）
        if '申购日期' in df.columns:
            df = df.sort_values('申购日期', ascending=False)
        result = []
        for _, row in df.head(15).iterrows():
            # 上市日期可能为 NaT，需处理
            list_date = row.get('上市日期')
            list_date_str = None
            if list_date is not None and str(list_date) != 'NaT' and str(list_date) != 'nan':
                list_date_str = str(list_date)[:10]

            # 发行价和市盈率：缺失时返回 None，前端 v-if 不显示
            price_val = safe_float(row.get('发行价'))
            pe_val = safe_float(row.get('发行市盈率'))

            result.append({
                'name': str(row.get('证券简称', '--')),
                'code': str(row.get('证劵代码', '--')),
                'industry': None,
                'price': round(price_val, 2) if price_val else None,
                'pe': round(pe_val, 2) if pe_val else None,
                'applyDate': str(row.get('申购日期', '--'))[:10],
                'listDate': list_date_str,
                'status': None,
            })
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_ipo: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/lockup')
@cached('lockup', 3600)
def get_lockup_calendar():
    """获取解禁日历

    使用 stock_restricted_release_detail_em 获取含股票名称和代码的解禁明细。
    返回本月及下月的解禁数据，按解禁市值降序排列。
    """
    try:
        now = datetime.now()
        start_date = now.strftime('%Y%m%d')
        end_date = (now.replace(day=1) + timedelta(days=62)).strftime('%Y%m%d')
        df = ak.stock_restricted_release_detail_em(start_date=start_date, end_date=end_date)
        if df is None or df.empty:
            raise ValueError("解禁数据为空")
        result = []
        for _, row in df.head(15).iterrows():
            result.append({
                'name': str(row.get('股票简称', '--')),
                'code': str(row.get('股票代码', '--')),
                'type': str(row.get('限售股类型', '--')),
                'date': str(row.get('解禁时间', '--')),
                'volume': round(safe_float(row.get('实际解禁数量', 0)) / 1e4, 1),
                'marketValue': round(safe_float(row.get('实际解禁市值', 0)) / 1e8, 1),
            })
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_lockup: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/earnings')
@cached('earnings', 3600)
def get_earnings_calendar():
    """获取财报日历"""
    try:
        # stock_yjbb_em 需要季度末日期
        now = datetime.now()
        month = now.month
        if month <= 3:
            quarter_date = f"{now.year - 1}1231"
        elif month <= 6:
            quarter_date = f"{now.year}0331"
        elif month <= 9:
            quarter_date = f"{now.year}0630"
        else:
            quarter_date = f"{now.year}0930"

        df = ak.stock_yjbb_em(date=quarter_date)
        if df is None or df.empty:
            raise ValueError("财报数据为空")
        result = []
        for _, row in df.head(10).iterrows():
            result.append({
                'name': str(row.get('股票简称', '--')),
                'code': str(row.get('股票代码', '--')),
                'type': '业绩快报',
                'date': str(row.get('最新公告日期', '--')),
                'changePercent': safe_float(row.get('净利润-同比增长', 0)),
            })
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_earnings: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/global_indices')
def get_global_indices():
    """获取全球指数

    使用东方财富 push2delay 直连 API，避免 akshare 代理问题。
    """
    with _slow_cache_lock:
        cached = _slow_cache.get('global_indices')
        if cached and (time.time() - cached[1] < _SLOW_CACHE_TTL):
            return jsonify(cached[0])

    try:
        url = 'https://push2delay.eastmoney.com/api/qt/clist/get'
        params = {
            'pn': 1, 'pz': 20, 'po': 1, 'np': 1,
            'fltt': 2, 'invt': 2, 'fid': 'f3',
            'fs': 'i:100.HSI,i:100.N225,i:100.DJIA,i:100.SPX,i:100.NDX,i:100.FTSE,i:100.GDAXI,i:100.KS11',
            'fields': 'f2,f3,f4,f12,f14',
        }
        r = _session.get(url, params=params, timeout=15,
                         headers={'User-Agent': 'Mozilla/5.0'})
        data = r.json()
        items = data.get('data', {}).get('diff', []) if data else []
        if not items:
            raise ValueError("全球指数数据为空")

        result = []
        for item in items:
            result.append({
                'code': str(item.get('f12', '--')),
                'name': str(item.get('f14', '--')),
                'value': f"{safe_float(item.get('f2')):.2f}",
                'changePercent': f"{safe_float(item.get('f3')):.2f}",
            })
        result = result[:8]
        with _slow_cache_lock:
            _slow_cache['global_indices'] = (result, time.time())
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_global_indices: {e}")
        return jsonify({'error': str(e)}), 500


def _get_global_indices_data():
    """获取全球指数数据（用于预加载）"""
    return get_global_indices()


@app.route('/api/akshare/exchange_rates')
def get_exchange_rates():
    """获取汇率数据

    currency_boc_safe 返回中国银行外汇牌价（中间价），单位为每100外币兑人民币
    前端需要每1外币兑人民币的汇率，以及百分比涨跌
    """
    # 检查缓存
    with _slow_cache_lock:
        cached_entry = _slow_cache.get('exchange_rates')
        if cached_entry and (time.time() - cached_entry[1] < _SLOW_CACHE_TTL):
            return jsonify(cached_entry[0])

    try:
        df = ak.currency_boc_safe()
        if df is None or df.empty:
            raise ValueError("汇率数据为空")

        latest = df.iloc[-1]
        target_currencies = {
            '美元': 'USDCNY', '欧元': 'EURCNY', '日元': 'JPYCNY',
            '英镑': 'GBPCNY', '港元': 'HKDCNY',
        }
        result = []
        prev = df.iloc[-2] if len(df) >= 2 else latest
        for cn_name, code in target_currencies.items():
            if cn_name in df.columns:
                rate_raw = safe_float(latest.get(cn_name, 0))
                prev_rate_raw = safe_float(prev.get(cn_name, 0))
                rate = rate_raw / 100.0 if rate_raw > 0 else 0
                prev_rate = prev_rate_raw / 100.0 if prev_rate_raw > 0 else 0
                if prev_rate > 0:
                    change_pct = ((rate - prev_rate) / prev_rate) * 100
                else:
                    change_pct = 0
                if rate > 0:
                    result.append({
                        'name': f"{cn_name}/人民币", 'code': code,
                        'rate': f"{rate:.4f}",
                        'change': f"{change_pct:+.2f}",
                    })
        result = result[:5]
        # 写入缓存
        with _slow_cache_lock:
            _slow_cache['exchange_rates'] = (result, time.time())
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_exchange_rates: {e}")
        return jsonify({'error': str(e)}), 500


def _get_exchange_rates_data():
    """获取汇率数据（用于预加载，直接调用 Flask 路由函数）"""
    return get_exchange_rates()


@app.route('/api/akshare/sector_heatmap')
@cached('sector_heatmap', 60)
def get_sector_heatmap():
    """获取板块热力图数据

    返回涨幅前15 + 跌幅前15 = 30个板块，适合移动端热力图展示。
    优先使用 akshare，降级到 push2delay 直连。
    """
    # 优先 akshare
    try:
        df = ak.stock_board_industry_name_em()
        if df is not None and not df.empty:
            result = []
            for _, row in df.iterrows():
                up = int(safe_float(row.get('上涨家数', 0)))
                down = int(safe_float(row.get('下跌家数', 0)))
                result.append({
                    'name': str(row.get('板块名称', '--')),
                    'avgChange': f"{safe_float(row.get('涨跌幅')):.2f}",
                    'upCount': up,
                    'downCount': down,
                    'count': up + down,
                    'totalVolume': format_money(row.get('总市值')),
                    'topStock': str(row.get('领涨股票', '--')),
                    'topStockChange': f"{safe_float(row.get('领涨股票-涨跌幅')):.2f}",
                })
            result.sort(key=lambda x: safe_float(x['avgChange'], -999), reverse=True)
            top_gainers = result[:15]
            top_losers = result[-15:]
            seen = set()
            merged = []
            for s in top_gainers + top_losers:
                if s['name'] not in seen:
                    seen.add(s['name'])
                    merged.append(s)
            return jsonify(merged)
    except Exception as e:
        print(f"[WARN] akshare 板块热力图失败({e}), 降级到 push2delay 直连...")

    # 降级：push2delay 直连（行业板块行情）
    try:
        url = 'https://push2delay.eastmoney.com/api/qt/clist/get'
        params = {
            'pn': '1', 'pz': '100', 'po': '1', 'np': '1',
            'ut': 'bd1d9ddb04089700cf9c27f6f7426281',
            'fltt': '2', 'invt': '2', 'fid': 'f3',
            'fs': 'm:90 t:2 f:!50',
            'fields': 'f2,f3,f4,f8,f12,f14,f104,f105,f128,f136,f140,f168',
        }
        r = _session.get(url, params=params, timeout=15,
                         headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
        items = r.json().get('data', {}).get('diff', [])
        result = []
        for item in items:
            up = int(safe_float(item.get('f104', 0)))
            down = int(safe_float(item.get('f105', 0)))
            result.append({
                'name': item.get('f14', '--'),
                'avgChange': f"{safe_float(item.get('f3')):.2f}",
                'upCount': up,
                'downCount': down,
                'count': up + down,
                'totalVolume': format_money(item.get('f168')),
                'topStock': str(item.get('f128', '--')),
                'topStockChange': f"{safe_float(item.get('f136')):.2f}",
            })
        result.sort(key=lambda x: safe_float(x['avgChange'], -999), reverse=True)
        top_gainers = result[:15]
        top_losers = result[-15:]
        seen = set()
        merged = []
        for s in top_gainers + top_losers:
            if s['name'] not in seen:
                seen.add(s['name'])
                merged.append(s)
        return jsonify(merged)
    except Exception as e:
        print(f"[ERROR] get_sector_heatmap fallback: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/kline/<code>')
@cached('kline', 300)
def get_kline(code):
    """获取K线数据"""
    try:
        period = request.args.get('period', 'daily')
        count = int(request.args.get('count', 120))
        period_map = {'5min': '5', '15min': '15', '30min': '30', '60min': '60', 'daily': 'daily', 'weekly': 'weekly', 'monthly': 'monthly'}
        ak_period = period_map.get(period, 'daily')
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=365)).strftime('%Y%m%d')
        df = ak.stock_zh_a_hist(symbol=code, period=ak_period, start_date=start_date, end_date=end_date, adjust='qfq')
        if df is None or df.empty:
            raise ValueError("K线数据为空")
        result = []
        for _, row in df.tail(count).iterrows():
            result.append({
                'date': str(row.get('日期', '')),
                'open': safe_float(row.get('开盘')),
                'close': safe_float(row.get('收盘')),
                'high': safe_float(row.get('最高')),
                'low': safe_float(row.get('最低')),
                'volume': int(safe_float(row.get('成交量'))),
                'turnover': safe_float(row.get('成交额')),
                'amplitude': safe_float(row.get('振幅')),
                'changePercent': safe_float(row.get('涨跌幅')),
                'change': safe_float(row.get('涨跌额')),
                'turnoverRate': safe_float(row.get('换手率')),
            })
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_kline: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/timeline/<code>')
@cached('timeline', 30)
def get_timeline(code):
    """获取分时数据"""
    try:
        df = ak.stock_zh_a_hist_pre_min_em(symbol=code)
        if df is None or df.empty:
            raise ValueError("分时数据为空")
        points = []
        pre_close = 0
        for _, row in df.iterrows():
            time_str = str(row.get('时间', ''))[-5:] if len(str(row.get('时间', ''))) > 5 else '00:00'
            price = safe_float(row.get('最新价', row.get('收盘', 0)))
            if pre_close == 0:
                pre_close = price
            points.append({
                'time': time_str, 'price': price,
                'avgPrice': safe_float(row.get('均价', price)),
                'volume': int(safe_float(row.get('成交量', 0))),
            })
        return jsonify({'preClose': pre_close, 'points': points})
    except Exception as e:
        print(f"[ERROR] get_timeline: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/stock_detail/<code>')
def get_stock_detail(code):
    """获取单只股票详情"""
    try:
        stock_info = {}
        # 从全市场缓存中获取实时行情
        df = _get_market_df()
        if df is not None and not df.empty:
            stock_row = df[df['代码'] == code]
            if not stock_row.empty:
                row = stock_row.iloc[0]
                price = safe_float(row.get('最新价'))
                change = safe_float(row.get('涨跌额'))
                # industry / sector 直接从行情数据中获取（全市场行情通常无此列，则设为 '--'）
                industry_val = row.get('行业') if '行业' in row else None
                sector_val = row.get('板块') if '板块' in row else None
                stock_info = {
                    'code': code,
                    'name': str(row.get('名称', '--')),
                    'price': f"{price:.2f}" if price else '--',
                    'change': f"{change:.2f}" if change else '--',
                    'changePercent': f"{safe_float(row.get('涨跌幅')):.2f}",
                    'volume': format_volume(row.get('成交量')),
                    'turnover': format_money(row.get('成交额')),
                    'amplitude': f"{safe_float(row.get('振幅')):.2f}",
                    'turnoverRate': f"{safe_float(row.get('换手率')):.2f}",
                    'high': f"{safe_float(row.get('最高')):.2f}",
                    'low': f"{safe_float(row.get('最低')):.2f}",
                    'open': f"{safe_float(row.get('今开')):.2f}",
                    'prevClose': f"{safe_float(row.get('昨收')):.2f}",
                    'marketCap': format_market_cap(row.get('总市值')),
                    'pe': f"{safe_float(row.get('市盈率-动态')):.2f}" if safe_float(row.get('市盈率-动态')) else '--',
                    'pb': f"{safe_float(row.get('市净率')):.2f}" if safe_float(row.get('市净率')) else '--',
                    'industry': str(industry_val) if industry_val is not None and str(industry_val) != 'nan' else '--',
                    'sector': str(sector_val) if sector_val is not None and str(sector_val) != 'nan' else '--',
                }

        # K线数据（单独调用，有缓存）
        kline_data = []
        try:
            end_date = datetime.now().strftime('%Y%m%d')
            start_date = (datetime.now() - timedelta(days=180)).strftime('%Y%m%d')
            kdf = ak.stock_zh_a_hist(symbol=code, period='daily', start_date=start_date, end_date=end_date, adjust='qfq')
            if kdf is not None and not kdf.empty:
                for _, row in kdf.tail(120).iterrows():
                    kline_data.append({
                        'date': str(row.get('日期', '')),
                        'open': safe_float(row.get('开盘')),
                        'close': safe_float(row.get('收盘')),
                        'high': safe_float(row.get('最高')),
                        'low': safe_float(row.get('最低')),
                        'volume': int(safe_float(row.get('成交量'))),
                        'turnover': safe_float(row.get('成交额')),
                        'amplitude': safe_float(row.get('振幅')),
                        'changePercent': safe_float(row.get('涨跌幅')),
                        'change': safe_float(row.get('涨跌额')),
                        'turnoverRate': safe_float(row.get('换手率')),
                    })
        except Exception as e:
            print(f"[WARN] K线获取失败: {e}")

        return jsonify({**stock_info, 'klineData': kline_data})
    except Exception as e:
        print(f"[ERROR] get_stock_detail: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/ranking')
def get_ranking():
    """获取涨跌排行榜"""
    if not _market_data_ready():
        return jsonify({'error': '数据加载中，请稍后重试', 'loading': True}), 503
    try:
        direction = request.args.get('direction', 'up')
        count = int(request.args.get('count', 100))
        result = _extract_ranking(direction, count)
        if result is None:
            return jsonify({'error': '数据为空'}), 500
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_ranking: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/fund_flow_ranking')
@cached('fund_flow_ranking', 60)
def get_fund_flow_ranking():
    """获取个股资金流向排行（实时）

    优先使用 ak.stock_individual_fund_flow_rank，
    降级到 push2delay 直连 API。
    返回今日主力净流入前20和后20。
    所有金额字段返回原始数值（元），前端负责格式化显示，确保单位一致。
    """
    # 优先 akshare
    try:
        indicator = request.args.get('indicator', '今日')
        df = ak.stock_individual_fund_flow_rank(indicator=indicator)
        if df is not None and not df.empty:
            result = []
            for _, row in df.iterrows():
                code = str(row.get('代码', '')).zfill(6)
                main_inflow = safe_float(row.get('今日主力净流入-净额'))
                result.append({
                    'code': code,
                    'name': str(row.get('名称', '--')),
                    'price': safe_float(row.get('最新价')),
                    'changePercent': safe_float(row.get('今日涨跌幅')),
                    'mainNetInflow': main_inflow,
                    'mainNetInflowPct': safe_float(row.get('今日主力净流入-净占比')),
                    'superLargeNetInflow': safe_float(row.get('今日超大单净流入-净额')),
                    'largeNetInflow': safe_float(row.get('今日大单净流入-净额')),
                    'mediumNetInflow': safe_float(row.get('今日中单净流入-净额')),
                    'smallNetInflow': safe_float(row.get('今日小单净流入-净额')),
                })
            # 按主力净流入原始数值降序排列
            result.sort(key=lambda x: x['mainNetInflow'], reverse=True)
            inflow = result[:20]
            # 流出按原始数值升序（最负的在前）
            outflow = list(reversed(result[-20:]))
            return jsonify({'inflow': inflow, 'outflow': outflow})
    except Exception as e:
        print(f"[WARN] akshare 资金流向失败({e}), 降级到 push2delay 直连...")

    # 降级：push2delay 直连
    try:
        base_url = 'https://push2delay.eastmoney.com/api/qt/clist/get'
        common_params = {
            'pn': '1', 'pz': '20', 'np': '1',
            'ut': 'b2884a393a59ad64002292a3e90d46a5',
            'fltt': '2', 'invt': '2', 'fid': 'f62',
            'fs': 'm:0 t:6 f:!2,m:0 t:13 f:!2,m:0 t:80 f:!2,m:1 t:2 f:!2,m:1 t:23 f:!2,m:0 t:7 f:!2,m:1 t:3 f:!2',
            'fields': 'f12,f14,f2,f3,f62,f184,f66,f72,f78,f84',
        }
        headers = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'}

        # 流入前20（降序）
        inflow_params = {**common_params, 'po': '1'}
        r_in = _session.get(base_url, params=inflow_params, timeout=15, headers=headers)
        inflow_items = r_in.json().get('data', {}).get('diff', [])

        # 流出前20（升序）
        outflow_params = {**common_params, 'po': '0'}
        r_out = _session.get(base_url, params=outflow_params, timeout=15, headers=headers)
        outflow_items = r_out.json().get('data', {}).get('diff', [])

        def map_fund(item):
            return {
                'code': str(item.get('f12', '')).zfill(6),
                'name': item.get('f14', '--'),
                'price': safe_float(item.get('f2')),
                'changePercent': safe_float(item.get('f3')),
                'mainNetInflow': safe_float(item.get('f62')),
                'mainNetInflowPct': safe_float(item.get('f184')),
                'superLargeNetInflow': safe_float(item.get('f66')),
                'largeNetInflow': safe_float(item.get('f72')),
                'mediumNetInflow': safe_float(item.get('f78')),
                'smallNetInflow': safe_float(item.get('f84')),
            }

        inflow = [map_fund(item) for item in inflow_items[:20]]
        outflow = [map_fund(item) for item in outflow_items[:20]]
        return jsonify({'inflow': inflow, 'outflow': outflow})
    except Exception as e:
        print(f"[ERROR] get_fund_flow_ranking fallback: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/financing')
@cached('financing', 300)
def get_financing():
    """获取融资融券数据（上交所为主，附加深交所最新日）

    返回最近20个交易日的融资余额、融资买入额、净买入额及时间序列。
    所有金额字段返回原始数值（元），前端负责格式化显示。
    上交所数据为多日历史（单位：元），深交所数据为单日（单位：亿元，需×1e8转换）。
    """
    try:
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=40)).strftime('%Y%m%d')

        # 1. 获取上交所融资融券数据（多日，单位：元）
        df = None
        try:
            df = ak.stock_margin_sse(start_date=start_date, end_date=end_date)
        except Exception as e:
            print(f"[WARN] 获取SSE融资数据失败: {e}")

        if df is None or df.empty:
            return jsonify({'balance': 0, 'buy': 0, 'repay': 0, 'net': 0, 'timeSharing': []})

        df = df.copy()
        # SSE 日期列名为 '信用交易日期'，统一为 '日期'
        if '信用交易日期' in df.columns:
            df.rename(columns={'信用交易日期': '日期'}, inplace=True)
        df['日期'] = pd.to_datetime(df['日期'], format='%Y%m%d')
        df = df.sort_values('日期').tail(20).reset_index(drop=True)

        # 计算融资偿还额：融资余额[t] = 融资余额[t-1] + 融资买入额 - 融资偿还额
        # 净买入 = 融资余额[t] - 融资余额[t-1]
        df['净买入'] = df['融资余额'].diff()
        df['融资偿还额'] = df['融资买入额'] - df['净买入']
        # 第一行无前一日数据，净买入设为0（无法计算）
        df.loc[df.index[0], '净买入'] = 0
        df.loc[df.index[0], '融资偿还额'] = safe_float(df.loc[df.index[0], '融资买入额'])

        # 2. 尝试获取深交所最新日数据（单位：亿元，需×1e8转换为元）
        latest_date_str = df.iloc[-1]['日期'].strftime('%Y%m%d')
        szse_balance = 0
        szse_buy = 0
        try:
            df_szse = ak.stock_margin_szse(date=latest_date_str)
            if df_szse is not None and not df_szse.empty:
                # SZSE 数据单位为亿元
                szse_balance = safe_float(df_szse.iloc[0].get('融资余额', 0)) * 1e8
                szse_buy = safe_float(df_szse.iloc[0].get('融资买入额', 0)) * 1e8
                print(f"[INFO] SZSE融资数据获取成功: 余额={szse_balance/1e8:.2f}亿, 买入={szse_buy/1e8:.2f}亿")
        except Exception as e:
            print(f"[WARN] 获取SZSE融资数据失败: {e}")

        # 3. 汇总最新日数据（SSE + SZSE）
        latest = df.iloc[-1]
        total_balance = safe_float(latest['融资余额']) + szse_balance
        total_buy = safe_float(latest['融资买入额']) + szse_buy
        # SSE净买入可从余额变化计算，SZSE无历史数据故净买入用SSE值
        total_net = safe_float(latest['净买入'])
        total_repay = total_buy - total_net

        return jsonify({
            'balance': total_balance,
            'buy': total_buy,
            'repay': total_repay,
            'net': total_net,
            'timeSharing': [
                {
                    'date': row['日期'].strftime('%m-%d'),
                    'balance': safe_float(row['融资余额']),
                    'net': safe_float(row['净买入']),
                }
                for _, row in df.iterrows()
            ],
        })
    except Exception as e:
        print(f"[ERROR] get_financing: {e}")
        return jsonify({'balance': 0, 'buy': 0, 'repay': 0, 'net': 0, 'timeSharing': []})


@app.route('/api/akshare/news')
@cached('news', 120)
def get_news():
    """获取重要财经新闻

    使用 ak.stock_info_global_em 获取全球财经资讯，
    返回最新的15条重要新闻。
    """
    try:
        df = ak.stock_info_global_em()
        if df is None or df.empty:
            raise ValueError("新闻数据为空")

        result = []
        for _, row in df.head(20).iterrows():
            result.append({
                'title': str(row.get('标题', '--')),
                'content': str(row.get('摘要', row.get('内容', '')))[:200],
                'time': str(row.get('发布时间', '--')),
                'url': str(row.get('链接', '#')),
                'source': '东方财富',
            })
        return jsonify(result[:15])
    except Exception as e:
        print(f"[ERROR] get_news: {e}")
        # 降级：尝试经济日历
        try:
            df = ak.news_economic_baidu(symbol="最新资讯")
            if df is not None and not df.empty:
                result = []
                for _, row in df.head(15).iterrows():
                    result.append({
                        'title': str(row.get('title', '--')),
                        'content': str(row.get('digest', ''))[:200],
                        'time': str(row.get('date', '--')),
                        'url': str(row.get('url', '#')),
                        'source': '百度财经',
                    })
                return jsonify(result)
        except Exception as e2:
            print(f"[ERROR] get_news fallback: {e2}")
        return jsonify({'error': str(e)}), 500


# ==================== 东方财富 API 代理（绕过系统代理 TLS 问题） ====================
# Node.js (Vite proxy) 无法直连东方财富 API（系统代理导致 socket hang up）
# 通过 Flask 后端代理，后端已清除代理环境变量，可直连

_EM_ALLOWED_APIS = {
    'clist': 'https://push2delay.eastmoney.com/api/qt/clist/get',
    'ulist': 'https://push2delay.eastmoney.com/api/qt/ulist.np/get',
}

@app.route('/api/akshare/em_api')
def em_api_proxy():
    """代理东方财富行情 API 请求"""
    api = request.args.get('_api', '')
    if api not in _EM_ALLOWED_APIS:
        return jsonify({'error': f'api not allowed: {api}'}), 403
    url = _EM_ALLOWED_APIS[api]
    # 转发除 _api 外的所有参数
    params = {k: v for k, v in request.args.items() if k != '_api'}
    try:
        r = _session.get(url, params=params, timeout=15,
                         headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
        return jsonify(r.json())
    except Exception as e:
        print(f"[ERROR] em_api_proxy ({api}): {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/em_news')
@cached('em_news', 120)
def em_news_proxy():
    """代理东方财富 7x24 全球财经快讯 API"""
    url = 'https://np-weblist.eastmoney.com/comm/web/getFastNewsList'
    params = {
        'client': 'web',
        'biz': 'web_724',
        'fastColumn': '102',
        'sortEnd': '',
        'pageSize': '20',
        'req_trace': str(int(time.time() * 1000)),
    }
    try:
        r = _session.get(url, params=params, timeout=10,
                         headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://kuaixun.eastmoney.com/'})
        data = r.json()
        news_list = data.get('data', {}).get('fastNewsList', [])
        if not news_list:
            return jsonify([])
        result = []
        for item in news_list[:15]:
            code = item.get('code', '')
            result.append({
                'title': item.get('title', '--'),
                'content': (item.get('summary', ''))[:200],
                'time': item.get('showTime', '--'),
                'url': f'https://finance.eastmoney.com/a/{code}.html' if code else '#',
                'source': '东方财富',
            })
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] em_news_proxy: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== 东方财富直连代理（打包后替代 Vite proxy） ====================
# 开发时 Vite proxy 将 /api/eastmoney 代理到 push2delay.eastmoney.com
# 打包后由 Flask 后端接管此代理，确保前端 _emFetch 主通道正常工作

@app.route('/api/eastmoney/<path:subpath>')
def em_direct_proxy(subpath):
    """代理东方财富行情 API（直连模式）
    前端请求 /api/eastmoney/api/qt/clist/get?...
    转发到 https://push2delay.eastmoney.com/api/qt/clist/get?...
    """
    url = f'https://push2delay.eastmoney.com/{subpath}'
    params = {k: v for k, v in request.args.items()}
    try:
        r = _session.get(url, params=params, timeout=15,
                         headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'})
        return jsonify(r.json())
    except Exception as e:
        print(f"[ERROR] em_direct_proxy: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== 天气 API 代理（打包后替代 Vite proxy） ====================
@app.route('/api/weather/<path:subpath>')
def weather_proxy(subpath):
    """代理天气 API
    前端请求 /api/weather/city/<code>
    转发到 http://t.weather.itboy.net/api/weather/city/<code>
    """
    url = f'http://t.weather.itboy.net/api/weather/{subpath}'
    params = {k: v for k, v in request.args.items()}
    try:
        r = _session.get(url, params=params, timeout=10,
                         headers={'User-Agent': 'Mozilla/5.0'})
        return jsonify(r.json())
    except Exception as e:
        print(f"[ERROR] weather_proxy: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== 静态文件服务（打包后部署） ====================
# 打包后的 dist 目录由 Flask 提供，访问 http://127.0.0.1:5001/dianayyx2/ 即可

@app.route('/dianayyx2/')
@app.route('/dianayyx2')
def serve_index():
    """返回前端入口 index.html"""
    index_path = os.path.join(_DIST_DIR, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(_DIST_DIR, 'index.html')
    return jsonify({'error': '前端未打包，请先运行 pnpm run build'}), 404


@app.route('/dianayyx2/<path:filename>')
def serve_static(filename):
    """返回前端静态资源（JS/CSS/图片等）"""
    return send_from_directory(_DIST_DIR, filename)


@app.route('/')
def root_redirect():
    """根路径重定向到前端入口"""
    from flask import redirect
    return redirect('/dianayyx2/')


# ==================== 启动 ====================
if __name__ == '__main__':
    dist_exists = os.path.exists(os.path.join(_DIST_DIR, 'index.html'))
    print("=" * 60)
    print("  akshare 股票数据 API 服务")
    print(f"  akshare version: {ak.__version__}")
    print("  服务地址: http://127.0.0.1:5001")
    print("  健康检查: http://127.0.0.1:5001/api/akshare/health")
    if dist_exists:
        print(f"  前端入口: http://127.0.0.1:5001/dianayyx2/")
    else:
        print("  [警告] dist 目录不存在，请先运行 pnpm run build")
    print("  优化: 后台预加载全市场数据，刷新间隔 60s")
    print("=" * 60)

    # 启动后台数据刷新线程
    refresh_thread = threading.Thread(target=_background_refresh_loop, daemon=True)
    refresh_thread.start()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 后台数据刷新线程已启动，正在预加载全市场行情...")

    app.run(host='127.0.0.1', port=5001, debug=False, threaded=True)
