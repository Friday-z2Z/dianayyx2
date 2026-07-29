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

from flask import Flask, jsonify, request
from flask_cors import CORS

import akshare as ak
import pandas as pd
import numpy as np

app = Flask(__name__)
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
        df = ak.stock_zh_a_spot_em()
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
    if n >= 1e8:
        return f"{n / 1e8:.2f}亿"
    if n >= 1e4:
        return f"{n / 1e4:.0f}万"
    return f"{n:.0f}"

def format_market_cap(num):
    n = safe_float(num)
    if n >= 1e12:
        return f"{n / 1e12:.2f}万亿"
    if n >= 1e8:
        return f"{n / 1e8:.1f}亿"
    return f"{n:.0f}万"


# ==================== 股票池定义 ====================
STOCK_POOL = [
    {'code': '600519', 'name': '贵州茅台', 'industry': '白酒', 'sector': '消费'},
    {'code': '000858', 'name': '五粮液', 'industry': '白酒', 'sector': '消费'},
    {'code': '000568', 'name': '泸州老窖', 'industry': '白酒', 'sector': '消费'},
    {'code': '002304', 'name': '洋河股份', 'industry': '白酒', 'sector': '消费'},
    {'code': '600809', 'name': '山西汾酒', 'industry': '白酒', 'sector': '消费'},
    {'code': '600036', 'name': '招商银行', 'industry': '银行', 'sector': '金融'},
    {'code': '601398', 'name': '工商银行', 'industry': '银行', 'sector': '金融'},
    {'code': '601939', 'name': '建设银行', 'industry': '银行', 'sector': '金融'},
    {'code': '601288', 'name': '农业银行', 'industry': '银行', 'sector': '金融'},
    {'code': '000001', 'name': '平安银行', 'industry': '银行', 'sector': '金融'},
    {'code': '601166', 'name': '兴业银行', 'industry': '银行', 'sector': '金融'},
    {'code': '600000', 'name': '浦发银行', 'industry': '银行', 'sector': '金融'},
    {'code': '600016', 'name': '民生银行', 'industry': '银行', 'sector': '金融'},
    {'code': '601318', 'name': '中国平安', 'industry': '保险', 'sector': '金融'},
    {'code': '601628', 'name': '中国人寿', 'industry': '保险', 'sector': '金融'},
    {'code': '600030', 'name': '中信证券', 'industry': '证券', 'sector': '金融'},
    {'code': '300059', 'name': '东方财富', 'industry': '金融科技', 'sector': '金融'},
    {'code': '601688', 'name': '华泰证券', 'industry': '证券', 'sector': '金融'},
    {'code': '300750', 'name': '宁德时代', 'industry': '新能源', 'sector': '科技'},
    {'code': '002594', 'name': '比亚迪', 'industry': '新能源汽车', 'sector': '科技'},
    {'code': '601012', 'name': '隆基绿能', 'industry': '光伏', 'sector': '科技'},
    {'code': '300274', 'name': '阳光电源', 'industry': '光伏', 'sector': '科技'},
    {'code': '002459', 'name': '晶澳科技', 'industry': '光伏', 'sector': '科技'},
    {'code': '688599', 'name': '天合光能', 'industry': '光伏', 'sector': '科技'},
    {'code': '688981', 'name': '中芯国际', 'industry': '半导体', 'sector': '科技'},
    {'code': '002371', 'name': '北方华创', 'industry': '半导体设备', 'sector': '科技'},
    {'code': '603501', 'name': '韦尔股份', 'industry': '芯片设计', 'sector': '科技'},
    {'code': '688008', 'name': '澜起科技', 'industry': '芯片设计', 'sector': '科技'},
    {'code': '002475', 'name': '立讯精密', 'industry': '消费电子', 'sector': '科技'},
    {'code': '000725', 'name': '京东方A', 'industry': '面板', 'sector': '科技'},
    {'code': '002415', 'name': '海康威视', 'industry': '安防', 'sector': '科技'},
    {'code': '002241', 'name': '歌尔股份', 'industry': '消费电子', 'sector': '科技'},
    {'code': '603986', 'name': '兆易创新', 'industry': '存储芯片', 'sector': '科技'},
    {'code': '002230', 'name': '科大讯飞', 'industry': '人工智能', 'sector': '科技'},
    {'code': '300496', 'name': '中科创达', 'industry': '智能OS', 'sector': '科技'},
    {'code': '688111', 'name': '金山办公', 'industry': '软件', 'sector': '科技'},
    {'code': '300033', 'name': '同花顺', 'industry': '金融科技', 'sector': '科技'},
    {'code': '000333', 'name': '美的集团', 'industry': '家电', 'sector': '消费'},
    {'code': '000651', 'name': '格力电器', 'industry': '家电', 'sector': '消费'},
    {'code': '600690', 'name': '海尔智家', 'industry': '家电', 'sector': '消费'},
    {'code': '600276', 'name': '恒瑞医药', 'industry': '创新药', 'sector': '医药'},
    {'code': '300760', 'name': '迈瑞医疗', 'industry': '医疗器械', 'sector': '医药'},
    {'code': '000538', 'name': '云南白药', 'industry': '中药', 'sector': '医药'},
    {'code': '300122', 'name': '智飞生物', 'industry': '疫苗', 'sector': '医药'},
    {'code': '002007', 'name': '华兰生物', 'industry': '血液制品', 'sector': '医药'},
    {'code': '300347', 'name': '泰格医药', 'industry': 'CRO', 'sector': '医药'},
    {'code': '600887', 'name': '伊利股份', 'industry': '乳业', 'sector': '消费'},
    {'code': '603288', 'name': '海天味业', 'industry': '调味品', 'sector': '消费'},
    {'code': '002714', 'name': '牧原股份', 'industry': '养殖', 'sector': '消费'},
    {'code': '000002', 'name': '万科A', 'industry': '房地产', 'sector': '地产'},
    {'code': '600048', 'name': '保利发展', 'industry': '房地产', 'sector': '地产'},
    {'code': '001979', 'name': '招商蛇口', 'industry': '房地产', 'sector': '地产'},
    {'code': '600900', 'name': '长江电力', 'industry': '电力', 'sector': '公用'},
    {'code': '600023', 'name': '浙能电力', 'industry': '电力', 'sector': '公用'},
    {'code': '600025', 'name': '华能水电', 'industry': '电力', 'sector': '公用'},
    {'code': '600050', 'name': '中国联通', 'industry': '通信', 'sector': '通信'},
    {'code': '601728', 'name': '中国电信', 'industry': '通信', 'sector': '通信'},
    {'code': '000063', 'name': '中兴通讯', 'industry': '通信设备', 'sector': '通信'},
    {'code': '600585', 'name': '海螺水泥', 'industry': '水泥', 'sector': '周期'},
    {'code': '601633', 'name': '长城汽车', 'industry': '汽车', 'sector': '周期'},
    {'code': '600104', 'name': '上汽集团', 'industry': '汽车', 'sector': '周期'},
    {'code': '601857', 'name': '中国石油', 'industry': '石油', 'sector': '周期'},
    {'code': '600028', 'name': '中国石化', 'industry': '石油', 'sector': '周期'},
    {'code': '601899', 'name': '紫金矿业', 'industry': '有色金属', 'sector': '周期'},
    {'code': '603993', 'name': '洛阳钼业', 'industry': '有色金属', 'sector': '周期'},
    {'code': '601888', 'name': '中国中免', 'industry': '免税', 'sector': '消费'},
    {'code': '000888', 'name': '峨眉山A', 'industry': '旅游', 'sector': '消费'},
    {'code': '600893', 'name': '航发动力', 'industry': '航空发动机', 'sector': '军工'},
    {'code': '002179', 'name': '中航光电', 'industry': '军工电子', 'sector': '军工'},
    {'code': '600760', 'name': '中航沈飞', 'industry': '军机', 'sector': '军工'},
    {'code': '601006', 'name': '大秦铁路', 'industry': '铁路', 'sector': '交通'},
    {'code': '600029', 'name': '南方航空', 'industry': '航空', 'sector': '交通'},
    {'code': '601111', 'name': '中国国航', 'industry': '航空', 'sector': '交通'},
    {'code': '300413', 'name': '芒果超媒', 'industry': '流媒体', 'sector': '传媒'},
    {'code': '002602', 'name': '世纪华通', 'industry': '游戏', 'sector': '传媒'},
    {'code': '002311', 'name': '海大集团', 'industry': '饲料', 'sector': '农业'},
    {'code': '300498', 'name': '温氏股份', 'industry': '养殖', 'sector': '农业'},
    {'code': '601390', 'name': '中国中铁', 'industry': '基建', 'sector': '基建'},
    {'code': '601186', 'name': '中国铁建', 'industry': '基建', 'sector': '基建'},
    {'code': '601668', 'name': '中国建筑', 'industry': '基建', 'sector': '基建'},
    {'code': '002352', 'name': '顺丰控股', 'industry': '快递', 'sector': '物流'},
    {'code': '600233', 'name': '圆通速递', 'industry': '快递', 'sector': '物流'},
    {'code': '688036', 'name': '传音控股', 'industry': '手机', 'sector': '科技'},
    {'code': '300782', 'name': '卓胜微', 'industry': '射频芯片', 'sector': '科技'},
    {'code': '688012', 'name': '中微公司', 'industry': '半导体设备', 'sector': '科技'},
    {'code': '603160', 'name': '汇顶科技', 'industry': '芯片设计', 'sector': '科技'},
    {'code': '002049', 'name': '紫光国微', 'industry': '安全芯片', 'sector': '科技'},
    {'code': '300661', 'name': '圣邦股份', 'industry': '模拟芯片', 'sector': '科技'},
    {'code': '688396', 'name': '华润微', 'industry': '功率半导体', 'sector': '科技'},
    {'code': '002557', 'name': '洽洽食品', 'industry': '休闲食品', 'sector': '消费'},
    {'code': '603369', 'name': '今世缘', 'industry': '白酒', 'sector': '消费'},
    {'code': '000977', 'name': '浪潮信息', 'industry': '服务器', 'sector': '科技'},
    {'code': '603019', 'name': '中科曙光', 'industry': '算力', 'sector': '科技'},
    {'code': '300474', 'name': '景嘉微', 'industry': 'GPU', 'sector': '科技'},
]

STOCK_POOL_CODES = [s['code'] for s in STOCK_POOL]
STOCK_POOL_MAP = {s['code']: s for s in STOCK_POOL}

# ==================== 从全市场缓存中提取数据 ====================

def _extract_stock_list():
    """从全市场缓存中提取股票池行情"""
    df = _get_market_df()
    if df is None or df.empty:
        return None
    pool_df = df[df['代码'].isin(STOCK_POOL_CODES)].copy()
    result = []
    for _, row in pool_df.iterrows():
        code = str(row.get('代码', '')).zfill(6)
        meta = STOCK_POOL_MAP.get(code, {})
        price = safe_float(row.get('最新价'))
        change_percent = safe_float(row.get('涨跌幅'))
        change = safe_float(row.get('涨跌额'))
        prev_close = price - change if price and change else safe_float(row.get('昨收'))
        result.append({
            'code': code,
            'name': str(row.get('名称', meta.get('name', '--'))),
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
            'industry': meta.get('industry', '--'),
            'sector': meta.get('sector', '--'),
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
        meta = STOCK_POOL_MAP.get(code, {})
        price = safe_float(row.get('最新价'))
        result.append({
            'code': code,
            'name': str(row.get('名称', meta.get('name', '--'))),
            'price': f"{price:.2f}" if price else '--',
            'changePercent': f"{safe_float(row.get('涨跌幅')):.2f}",
            'change': f"{safe_float(row.get('涨跌额')):.2f}",
            'volume': format_volume(row.get('成交量')),
            'turnover': format_money(row.get('成交额')),
            'industry': meta.get('industry', '--'),
            'sector': meta.get('sector', '--'),
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
        print(f"[WARN] 指数获取失败: {e}")
        return {'shIndex': sh_data, 'szIndex': sz_data, 'cyIndex': cy_data}


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
    """获取新股日历"""
    try:
        df = ak.stock_ipo_declare_em()
        if df is None or df.empty:
            raise ValueError("IPO数据为空")
        result = []
        for _, row in df.head(10).iterrows():
            result.append({
                'name': str(row.get('企业名称', '--')),
                'code': '--',
                'industry': str(row.get('注册地', '--')),
                'price': '--',
                'pe': '--',
                'applyDate': str(row.get('更新日期', '--')),
                'listDate': str(row.get('拟上市地点', '--')),
                'status': str(row.get('最新状态', '--')),
            })
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] get_ipo: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/akshare/lockup')
@cached('lockup', 3600)
def get_lockup_calendar():
    """获取解禁日历"""
    try:
        df = ak.stock_restricted_release_queue_em()
        if df is None or df.empty:
            raise ValueError("解禁数据为空")
        result = []
        for _, row in df.head(10).iterrows():
            result.append({
                'name': str(row.get('股票名称', '--')),
                'code': str(row.get('股票代码', '--')),
                'type': str(row.get('解禁类型', '--')),
                'date': str(row.get('解禁日期', '--')),
                'volume': safe_float(row.get('解禁数量', 0)),
                'marketValue': round(safe_float(row.get('解禁市值', 0)) / 1e8, 1),
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
    """获取全球指数"""
    with _slow_cache_lock:
        cached = _slow_cache.get('global_indices')
        if cached and (time.time() - cached[1] < _SLOW_CACHE_TTL):
            return jsonify(cached[0])

    try:
        df = ak.index_global_spot_em()
        if df is None or df.empty:
            raise ValueError("全球指数数据为空")

        target_indices = {
            'HSI': '恒生指数', 'N225': '日经225', 'DJI': '道琼斯',
            'SPX': '标普500', 'NDX': '纳斯达克', 'FTSE': '富时100',
            'GDAXI': '德国DAX', 'KS11': '韩国KOSPI',
        }
        result = []
        for _, row in df.iterrows():
            name = str(row.get('名称', ''))
            code = str(row.get('代码', ''))
            for target_code, target_name in target_indices.items():
                if target_name in name or target_code == code:
                    result.append({
                        'code': target_code, 'name': target_name,
                        'value': f"{safe_float(row.get('最新价')):.2f}",
                        'changePercent': f"{safe_float(row.get('涨跌幅')):.2f}",
                    })
                    break
        if not result:
            for _, row in df.head(8).iterrows():
                result.append({
                    'code': str(row.get('代码', '--')), 'name': str(row.get('名称', '--')),
                    'value': f"{safe_float(row.get('最新价')):.2f}",
                    'changePercent': f"{safe_float(row.get('涨跌幅')):.2f}",
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
    """
    try:
        df = ak.stock_board_industry_name_em()
        if df is None or df.empty:
            raise ValueError("板块数据为空")
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
        # 按涨跌幅排序
        result.sort(key=lambda x: safe_float(x['avgChange'], -999), reverse=True)
        # 取涨幅前15 + 跌幅前15
        top_gainers = result[:15]
        top_losers = result[-15:]
        # 合并去重
        seen = set()
        merged = []
        for s in top_gainers + top_losers:
            if s['name'] not in seen:
                seen.add(s['name'])
                merged.append(s)
        return jsonify(merged)
    except Exception as e:
        print(f"[ERROR] get_sector_heatmap: {e}")
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
                meta = STOCK_POOL_MAP.get(code, {})
                price = safe_float(row.get('最新价'))
                change = safe_float(row.get('涨跌额'))
                stock_info = {
                    'code': code,
                    'name': str(row.get('名称', meta.get('name', '--'))),
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
                    'industry': meta.get('industry', '--'),
                    'sector': meta.get('sector', '--'),
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

    使用 ak.stock_individual_fund_flow_rank 获取全市场个股资金流向数据，
    返回今日主力净流入前20和后20。
    """
    try:
        indicator = request.args.get('indicator', '今日')
        df = ak.stock_individual_fund_flow_rank(indicator=indicator)
        if df is None or df.empty:
            raise ValueError("资金流向数据为空")

        # 确保列名正确
        result = []
        for _, row in df.iterrows():
            code = str(row.get('代码', '')).zfill(6)
            net_inflow = safe_float(row.get('今日主力净流入-净额', 0))
            result.append({
                'code': code,
                'name': str(row.get('名称', '--')),
                'price': f"{safe_float(row.get('最新价')):.2f}",
                'changePercent': f"{safe_float(row.get('今日涨跌幅')):.2f}",
                'mainNetInflow': format_money(row.get('今日主力净流入-净额')),
                'mainNetInflowPct': f"{safe_float(row.get('今日主力净流入-净占比')):.2f}",
                'superLargeNetInflow': format_money(row.get('今日超大单净流入-净额')),
                'largeNetInflow': format_money(row.get('今日大单净流入-净额')),
                'mediumNetInflow': format_money(row.get('今日中单净流入-净额')),
                'smallNetInflow': format_money(row.get('今日小单净流入-净额')),
            })

        # 按主力净流入排序
        result.sort(key=lambda x: safe_float(x.get('mainNetInflow', '0').replace('亿', '').replace('万', '')), reverse=True)

        # 返回流入前20 + 流出前20
        inflow = result[:20]
        outflow = sorted(result[-20:], key=lambda x: safe_float(x.get('mainNetInflow', '0').replace('亿', '').replace('万', '')))
        return jsonify({'inflow': inflow, 'outflow': outflow})
    except Exception as e:
        print(f"[ERROR] get_fund_flow_ranking: {e}")
        return jsonify({'error': str(e)}), 500


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


# ==================== 启动 ====================
if __name__ == '__main__':
    print("=" * 60)
    print("  akshare 股票数据 API 服务")
    print(f"  akshare version: {ak.__version__}")
    print("  服务地址: http://127.0.0.1:5001")
    print("  健康检查: http://127.0.0.1:5001/api/akshare/health")
    print("  优化: 后台预加载全市场数据，刷新间隔 60s")
    print("=" * 60)

    # 启动后台数据刷新线程
    refresh_thread = threading.Thread(target=_background_refresh_loop, daemon=True)
    refresh_thread.start()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 后台数据刷新线程已启动，正在预加载全市场行情...")

    app.run(host='127.0.0.1', port=5001, debug=False, threaded=True)
