'use strict';
/**
 * 数据目录层
 * - 直接读取 lib/MakkaPakka-ALL.js 与 lib/ptjc.js 两份历史 Widget 脚本，
 *   在 vm 沙箱中提取 WidgetMetadata、类型映射表与地区映射表，作为新站点的栏目/筛选器定义。
 * - 卡片字段沿用历史脚本 buildItem 的契约：
 *   { id, tmdbId, type, mediaType, title, genreTitle, description,
 *     releaseDate, subTitle, posterPath, backdropPath, rating }
 * - 数据全部来自 TMDB（Key 取自 TMDB_API_KEY 环境变量），请求失败时返回错误提示卡片。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TMDB_BASE = 'https://api.themoviedb.org/3';

/* ------------------------------------------------------------------ *
 * 1. 从历史 lib 脚本中提取元数据
 * ------------------------------------------------------------------ */
function extractMetadata(file) {
    const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
    // 追加在同一次执行的词法作用域内，才能取到 const 声明的映射表
    const capture = `
;globalThis.__CAPTURE__ = {
    metadata: typeof WidgetMetadata !== 'undefined' ? WidgetMetadata : null,
    genreMap: typeof GLOBAL_GENRE_MAP_ALL !== 'undefined' ? GLOBAL_GENRE_MAP_ALL : null,
    advanced: typeof ADVANCED_GENRE_MAP !== 'undefined' ? ADVANCED_GENRE_MAP : null,
    region: typeof REGION_MAP !== 'undefined' ? REGION_MAP : null
};`;
    const noop = () => undefined;
    const widgetStub = new Proxy({}, { get: () => noop });
    const sandbox = {
        console, URL, URLSearchParams, setTimeout, clearTimeout,
        fetch: async () => { throw new Error('sandbox: network disabled'); },
        Widget: widgetStub
    };
    vm.createContext(sandbox);
    vm.runInContext(code + capture, sandbox, { filename: file, timeout: 2000 });
    return sandbox.__CAPTURE__ || {};
}

let mainCapture = {};
let theaterCapture = {};
try { mainCapture = extractMetadata('MakkaPakka-ALL.js'); } catch (e) {
    /* 解析失败时沿用内置兜底定义 */
}
try { theaterCapture = extractMetadata('ptjc.js'); } catch (e) {
    /* 忽略 */
}

const GENRE_MAP = mainCapture.genreMap || { 878: '科幻', 18: '剧情', 16: '动画', 28: '动作', 35: '喜剧', 9648: '悬疑', 10749: '爱情', 80: '犯罪', 27: '恐怖', 14: '奇幻', 99: '纪录片', 10759: '动作冒险', 10765: '科幻奇幻' };
const ADVANCED_GENRE_MAP = mainCapture.advanced || {};
const REGION_MAP = mainCapture.region || {};
const mainModules = (mainCapture.metadata && mainCapture.metadata.modules) || [];
const theaterModules = (theaterCapture.metadata && theaterCapture.metadata.modules) || [];

/* 版本信息直接取自两份历史脚本的 WidgetMetadata.version */
const SOURCE_VERSIONS = {
    'MakkaPakka-ALL.js': String((mainCapture.metadata && mainCapture.metadata.version) || ''),
    'ptjc.js': String((theaterCapture.metadata && theaterCapture.metadata.version) || '')
};
const PRIMARY_SOURCE = 'MakkaPakka-ALL.js';
const PRIMARY_VERSION = SOURCE_VERSIONS[PRIMARY_SOURCE];

/* 只保留 server.js 路由表中实际支持的 3 个栏目 */
const MAIN_DEFS = [
    { id: 'anime', fn: 'routeAnimeOmni', label: '番剧', desc: '二次元全境聚合', source: PRIMARY_SOURCE, versionSource: PRIMARY_SOURCE },
    { id: 'genreRank', fn: 'loadGenreRank', label: '全球影剧', desc: '电影 · 剧集 · 题材', source: PRIMARY_SOURCE, versionSource: PRIMARY_SOURCE },
    // 平台片库的筛选器定义来自主脚本，但平台剧场/流媒体榜单归属 ptjc.js，按钮按此显示版本
    { id: 'platform', fn: 'loadPlatformMatrix', label: '平台片库', desc: '按流媒体平台浏览', source: PRIMARY_SOURCE, versionSource: 'ptjc.js' }
];

const FALLBACK_PARAMS = {
    anime: [
        { name: 'anime_source', title: '选择数据源', type: 'enumeration', value: 'cal', enumOptions: [
            { title: 'Bangumi 追番日历', value: 'cal' }, { title: 'Bilibili 热度榜单', value: 'bili' },
            { title: 'TMDB 热门/新番', value: 'tmdb' }, { title: 'AniList 流行榜单', value: 'anilist' }
        ] }
    ],
    genreRank: [
        { name: 'sort_by', title: '影视类型', type: 'enumeration', value: 'all', enumOptions: [
            { title: '全部', value: 'all' }, { title: '电影', value: 'movie' }, { title: '剧集', value: 'tv' }
        ] },
        { name: 'genre', title: '题材流派', type: 'enumeration', value: 'all', enumOptions: [
            { title: '全部题材', value: 'all' }, { title: '科幻', value: 'scifi' }, { title: '悬疑', value: 'mystery' },
            { title: '动作', value: 'action' }, { title: '喜剧', value: 'comedy' }, { title: '剧情', value: 'drama' }
        ] },
        { name: 'order_rule', title: '排序规则', type: 'enumeration', value: 'popularity', enumOptions: [
            { title: '热门趋势', value: 'popularity' }, { title: '评分最高', value: 'rating' }, { title: '最新上线', value: 'time' }
        ] }
    ],
    platform: [
        { name: 'sort_by', title: '内容分类', type: 'enumeration', value: 'tv_drama', enumOptions: [
            { title: '电视剧', value: 'tv_drama' }, { title: '综艺', value: 'tv_variety' },
            { title: '动漫', value: 'tv_anime' }, { title: '电影', value: 'movie' }
        ] },
        { name: 'platform', title: '播出平台', type: 'enumeration', value: '2007', enumOptions: [
            { title: '腾讯视频', value: '2007' }, { title: '爱奇艺', value: '1330' },
            { title: 'Netflix', value: '213' }, { title: 'Apple TV+', value: '2552' }
        ] }
    ]
};

function normalizeParam(p) {
    let options = (p.enumOptions || []).map(o => ({ title: String(o.title), value: String(o.value) }));
    // 历史脚本的年份下拉包含 1940 年至今的全部年份，界面只保留最近 10 年
    if (p.name === 'rank_year') options = options.slice(0, 10);
    return {
        name: p.name,
        title: p.title,
        value: p.value === undefined || p.value === null ? '' : String(p.value),
        options,
        belongTo: p.belongTo ? { name: p.belongTo.paramName, values: p.belongTo.value.map(String) } : null,
        ui: options.length > 12 ? 'select' : 'pills'
    };
}

const MODULES = MAIN_DEFS.map(def => {
    const source = mainModules.find(m => m.functionName === def.fn);
    const raw = (source && source.params) ? source.params : FALLBACK_PARAMS[def.id];
    const params = raw.filter(p => p.type === 'enumeration' && Array.isArray(p.enumOptions)).map(normalizeParam);
    const defaults = {};
    params.forEach(p => { defaults[p.name] = p.value; });
    return {
        id: def.id,
        label: def.label,
        desc: def.desc,
        originTitle: source ? source.title : def.label,
        source: def.source,
        versionSource: def.versionSource,
        version: SOURCE_VERSIONS[def.versionSource] || '',
        cacheDuration: (source && source.cacheDuration) || 3600,
        paramCount: raw.length,
        params,
        defaults
    };
});

/* 展示偏好：把「最新」排序选项置顶并设为默认（历史脚本默认热度最高） */
const PINNED_SORTS = [
    { module: 'genreRank', param: 'order_rule', value: 'time' },
    { module: 'platform', param: 'sort', value: 'first_air_date.desc' }
];
for (const pref of PINNED_SORTS) {
    const mod = MODULES.find(m => m.id === pref.module);
    const rule = mod && mod.params.find(p => p.name === pref.param);
    if (!rule) continue;
    const pinned = rule.options.find(o => o.value === pref.value);
    if (!pinned) continue;
    rule.options = [pinned, ...rule.options.filter(o => o.value !== pref.value)];
    rule.value = pref.value;
    mod.defaults[pref.param] = pref.value;
}

/** 来自 ptjc.js 的剧场/榜单快捷入口（展示名转为简体） */
const QUICK_LABELS = ['豆瓣热榜', '各平台剧场', '热门番剧', '芒果TV热榜', '流媒体 TOP 10'];
const QUICK_PRESETS = [
    { module: 'genreRank', params: { sort_by: 'all', genre: 'drama', region: 'cn', order_rule: 'popularity' } },
    { module: 'platform', params: { sort_by: 'tv_drama', platform: '2007', sort: 'popularity.desc' } },
    { module: 'anime', params: { anime_source: 'bili', bili_sort: '1' } },
    { module: 'platform', params: { sort_by: 'tv_variety', platform: '1631', sort: 'first_air_date.desc' } },
    { module: 'platform', params: { sort_by: 'movie', platform: '213', sort: 'popularity.desc' } }
];
const QUICK = theaterModules.slice(0, 5).map((m, i) => ({
    label: QUICK_LABELS[i],
    originTitle: m.title,
    description: m.description || '',
    module: QUICK_PRESETS[i].module,
    params: QUICK_PRESETS[i].params
}));

const MODULE_MAP = new Map(MODULES.map(m => [m.id, m]));
const hasModule = id => MODULE_MAP.has(id);
const defaultsOf = id => ({ ...(MODULE_MAP.get(id) || {}).defaults });

/* ------------------------------------------------------------------ *
 * 2. 排序工具（按热度 / 评分 / 上映日期）
 * ------------------------------------------------------------------ */
function sortByRule(list, rule) {
    if (rule === 'rating') list.sort((a, b) => b.vote - a.vote);
    else if (rule === 'time') list.sort((a, b) => b._date.localeCompare(a._date));
    else list.sort((a, b) => b._popularity - a._popularity);
}

/* ------------------------------------------------------------------ *
 * 3. 真实 TMDB 数据源（按 lib 中的映射表构造 discover 查询）
 * ------------------------------------------------------------------ */
/* 配置全部来自环境变量（Cloudflare 环境变量 / Secret 或本地 shell） */
const API_KEY = String(process.env.TMDB_API_KEY || '').trim();
const LANG = String(process.env.TMDB_LANGUAGE || 'zh-CN').trim();

/* 上游出口：本地可选代理（undici ProxyAgent 局部 dispatcher）；CF 上留空直连 */
const { ProxyAgent, fetch: undiciFetch } = require('undici');
const PROXY_URL = String(process.env.TMDB_PROXY_URL || '').trim();
const proxyAgent = PROXY_URL ? new ProxyAgent(PROXY_URL) : null;
const UPSTREAM_TIMEOUT = 15000;
/* 本机走代理的域名：TMDB 与盘搜引擎直连被阻断；Cloudflare 上 proxyAgent 为空时全部直连 */
const PROXY_HOSTS = /(^|\.)(tmdb\.org|themoviedb\.org|252035\.xyz)$/i;

function upstreamFetch(url, options = {}) {
    const hostname = url instanceof URL ? url.hostname : new URL(String(url)).hostname;
    const opts = { ...options, signal: options.signal || AbortSignal.timeout(UPSTREAM_TIMEOUT) };
    if (proxyAgent && PROXY_HOSTS.test(hostname)) opts.dispatcher = proxyAgent;
    return undiciFetch(String(url), opts);
}

function genreText(ids) {
    const names = (ids || []).map(id => GENRE_MAP[id]).filter(Boolean);
    return names.length ? names.slice(0, 2).join(' / ') : '影视';
}

function toCard(item, mediaType) {
    const date = item.release_date || item.first_air_date || '';
    const vote = Number(item.vote_average) || 0;
    return {
        id: String(item.id),
        tmdbId: item.id,
        type: 'tmdb',
        mediaType,
        title: item.title || item.name || '未命名',
        genreTitle: genreText(item.genre_ids),
        description: item.overview || '',
        releaseDate: date,
        subTitle: date ? date.substring(0, 4) : '未知',
        posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
        backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '',
        rating: vote > 0 ? vote.toFixed(1) : '',
        vote,
        originCountry: Array.isArray(item.origin_country) ? (item.origin_country[0] || '') : (item.origin_country || ''),
        originalLanguage: item.original_language || '',
        _popularity: item.popularity || 0,
        _date: date || '1970-01-01'
    };
}

async function tmdbGet(endpoint, query, apiKey = '') {
    const url = new URL(TMDB_BASE + endpoint);
    url.searchParams.set('api_key', apiKey || API_KEY);
    url.searchParams.set('language', LANG);
    Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
    const res = await upstreamFetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json();
}

function discoverQuery(mediaType, page, rule) {
    const q = { page, include_adult: 'false', 'vote_count.gte': rule === 'rating' ? 200 : 10 };
    if (rule === 'rating') q.sort_by = 'vote_average.desc';
    else if (rule === 'time') {
        q.sort_by = mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
        // 与 lib 的 fetchGenreRankData 一致：不把远期未上映影片排进「最新上线」
        const maxDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        q[mediaType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = maxDate;
    } else q.sort_by = 'popularity.desc';
    return q;
}

async function tmdbGenreRank(p, page, apiKey) {
    const mediaType = p.sort_by || 'all';
    const genre = p.genre || 'all';
    const region = p.region || 'all';
    const rule = p.order_rule || 'popularity';
    const build = mt => {
        const q = discoverQuery(mt, page, rule);
        const gid = (ADVANCED_GENRE_MAP[genre] || {})[mt];
        if (gid) q.with_genres = gid;
        const country = REGION_MAP[region];
        if (country) q.with_origin_country = country;
        return q;
    };
    if (mediaType === 'all') {
        const [movies, tvs] = await Promise.all([
            tmdbGet('/discover/movie', build('movie'), apiKey),
            tmdbGet('/discover/tv', build('tv'), apiKey)
        ]);
        const list = [
            ...(movies.results || []).map(x => toCard(x, 'movie')),
            ...(tvs.results || []).map(x => toCard(x, 'tv'))
        ];
        sortByRule(list, rule);
        return list.slice(0, 20);
    }
    const r = await tmdbGet(`/discover/${mediaType}`, build(mediaType), apiKey);
    return (r.results || []).map(x => toCard(x, mediaType));
}

async function tmdbPlatform(p, page, apiKey) {
    const category = p.sort_by || 'tv_drama';
    const network = p.platform || '2007';
    const sort = p.sort || 'first_air_date.desc';
    if (category === 'movie' && !['213', '2739', '49', '2552'].includes(network)) {
        return [{ id: 'empty', type: 'text', title: '暂不支持国内平台电影', description: '请切换为剧集或国外平台' }];
    }
    let mediaType = 'tv';
    const q = { page, include_adult: 'false', sort_by: sort };
    if (category.startsWith('tv_')) {
        q.with_networks = network;
        if (category === 'tv_anime') q.with_genres = '16';
        else if (category === 'tv_variety') q.with_genres = '10764|10767';
        else q.without_genres = '16,10764,10767';
    } else {
        mediaType = 'movie';
        // discover/movie 不认 first_air_date.desc，改用对应的首映日期字段
        if (q.sort_by === 'first_air_date.desc') q.sort_by = 'primary_release_date.desc';
        const providerMap = { '213': '8', '2739': '337', '49': '1899|15', '2552': '350' };
        q.watch_region = 'US';
        q.with_watch_providers = providerMap[network];
    }
    const r = await tmdbGet(`/discover/${mediaType}`, q, apiKey);
    const items = (r.results || []).map(x => toCard(x, mediaType));
    return items.length ? items : [{ id: 'empty', type: 'text', title: '暂无流媒体数据', description: '试试切换平台或内容分类' }];
}

async function tmdbAnime(p, page, apiKey) {
    const src = p.anime_source || 'cal';
    const q = { page, with_genres: '16', sort_by: 'popularity.desc', include_adult: 'false' };
    if (src === 'tmdb') {
        q.sort_by = p.tmdb_sort === 'top' ? 'vote_average.desc'
            : p.tmdb_sort === 'new' ? 'first_air_date.desc' : 'popularity.desc';
    } else if (src === 'anilist' || src === 'mal') {
        q.sort_by = (p.anilist_sort === 'SCORE_DESC' || src === 'mal') ? 'vote_average.desc' : 'popularity.desc';
        q['vote_count.gte'] = 50;
    } else if (src === 'cal' || src === 'daily') {
        q.sort_by = 'first_air_date.desc';
        q['first_air_date.lte'] = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    } else if (src === 'rank') {
        if (p.rank_year) q.first_air_date_year = p.rank_year;
        q.sort_by = p.rank_sort === 'date' ? 'first_air_date.desc' : 'popularity.desc';
    }
    const r = await tmdbGet('/discover/tv', q, apiKey);
    return (r.results || []).map(x => toCard(x, 'tv'));
}

async function fetchUpstream(id, p, page, apiKey) {
    if (id === 'genreRank') return tmdbGenreRank(p, page, apiKey);
    if (id === 'platform') return tmdbPlatform(p, page, apiKey);
    return tmdbAnime(p, page, apiKey);
}

/* ------------------------------------------------------------------ *
 * 4. 对外接口：TMDB 数据 + 失败提示（失败返回 text 卡片）
 * ------------------------------------------------------------------ */
const cache = new Map();

function errorResult(page, note) {
    return {
        items: [{ id: 'error', type: 'text', title: '数据加载失败', description: `${note}。请检查网络或代理设置后重试。` }],
        source: 'error', page, hasMore: false, note
    };
}

async function getData(id, rawParams, clientKey = '') {
    const p = { ...defaultsOf(id), ...rawParams };
    const page = Math.max(1, parseInt(p.page, 10) || 1);
    p.page = page;
    const cacheKey = `${id}:${JSON.stringify(Object.entries(p).sort())}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.value;

    const key = API_KEY || clientKey || '';
    if (!key) return errorResult(page, '未配置 TMDB API Key');
    try {
        const items = await fetchUpstream(id, p, page, key);
        if (!Array.isArray(items)) throw new Error('上游返回异常');
        const value = { items, source: 'tmdb', page, hasMore: items.length >= 20, note: '' };
        cache.set(cacheKey, { value, expires: Date.now() + 300000 });
        return value;
    } catch (e) {
        return errorResult(page, `TMDB ${PROXY_URL ? '经代理' : '直连'}请求失败（${e.message}）`);
    }
}

/* ------------------------------------------------------------------ *
 * 5. 全站搜索：TMDB search/multi（失败时返回错误提示）
 * ------------------------------------------------------------------ */
async function search(query, rawPage = 1, clientKey = '') {
    const keyword = String(query || '').trim();
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    if (!keyword) return { items: [], source: 'tmdb', page: 1, hasMore: false, note: '' };
    const key = API_KEY || clientKey || '';
    if (!key) return errorResult(page, '未配置 TMDB API Key');

    try {
        const url = `${TMDB_BASE}/search/multi?${new URLSearchParams({
            api_key: key, language: LANG, query: keyword, page, include_adult: 'false'
        })}`;
        const r = await upstreamFetch(url);
        if (!r.ok) throw new Error(`TMDB ${r.status}`);
        const data = await r.json();
        const items = (data.results || [])
            .filter(x => x && ['movie', 'tv'].includes(x.media_type))
            .map(x => toCard(x, x.media_type));
        return {
            items, source: 'tmdb', page,
            hasMore: page < Math.min(Number(data.total_pages) || 1, 500),
            note: ''
        };
    } catch (e) {
        return errorResult(page, `TMDB 搜索请求失败（${e.message}）`);
    }
}

/* ------------------------------------------------------------------ *
 * 6. 网盘搜索：盘搜（so.252035.xyz）+ 觅搜（mipan.so）
 * ------------------------------------------------------------------ */
const PAN_API_BASE = String(process.env.PAN_API_BASE || 'https://so.252035.xyz').trim().replace(/\/+$/, '');
const MIPAN_ORIGIN = 'https://www.mipan.so';
const PAN_ALL_TYPES = ['quark', 'aliyun', 'baidu', 'uc', 'tianyi', 'xunlei', '123', '115', 'mobile', 'guangya', 'magnet', 'ed2k'];
const MIPAN_ALL_TYPES = [...PAN_ALL_TYPES.filter(t => t !== 'magnet' && t !== 'ed2k'), 'pikpak'];
const PAN_TYPE_LABEL = {
    quark: '夸克', aliyun: '阿里', baidu: '百度', uc: 'UC', tianyi: '天翼',
    xunlei: '迅雷', 123: '123', 115: '115', mobile: '移动', guangya: '光鸭',
    magnet: '磁力', ed2k: '电驴', pikpak: 'PikPak', other: '其它'
};
const PAN_CACHE_TTL = 5 * 60 * 1000;
const panCache = new Map();

const cleanText = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const normShareUrl = u => String(u || '').trim().replace(/[?&]+$/, '');

/** 校验用户在设置里填写的引擎地址：仅 https、禁止内网与 IP 直连，返回去掉末尾斜杠的根地址 */
function resolveApiBase(raw, fallback) {
    const input = String(raw || '').trim();
    if (!input) return fallback;
    let u;
    try { u = new URL(input); } catch (e) { throw new Error('地址格式不正确'); }
    if (u.protocol !== 'https:') throw new Error('只支持 https 地址');
    const host = u.hostname.toLowerCase();
    if (/^(localhost|0\.0\.0\.0|127\.|10\.|169\.254\.|192\.168\.|::1|\[::1\])/.test(host)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
        || /\.local$/.test(host)) {
        throw new Error('不允许使用内网地址');
    }
    const path = u.pathname.replace(/\/+$/, '');
    return u.origin + (path === '/' ? '' : path);
}

const QUALITY_KEYWORDS = [
    { k: ['dolby vision', 'dovi', '杜比视界'], s: 100 },
    { k: ['hdr10+'], s: 90 },
    { k: ['hdr10', 'hdr', 'hlg'], s: 80 },
    { k: ['4k', '2160p', 'uhd', '8k'], s: 70 },
    { k: ['remux', '蓝光原盘', '原盘', 'bluray', 'blu-ray'], s: 65 },
    { k: ['高码率', '高码', 'x265', 'h265', 'hevc'], s: 55 },
    { k: ['杜比全景声', 'atmos'], s: 50 },
    { k: ['1080p', '1080i', 'fhd'], s: 40 },
    { k: ['60fps', '60帧'], s: 30 },
    { k: ['720p'], s: 20 },
    { k: ['web-dl', 'bdrip'], s: 15 },
    { k: ['国语', '粤语', '中字', '双语'], s: 5 }
];

function qualityScore(title) {
    const t = String(title || '').toLowerCase();
    return QUALITY_KEYWORDS.reduce((sum, row) => row.k.some(k => t.includes(k)) ? sum + row.s : sum, 0);
}

function qualityTagsOf(title) {
    const t = String(title || '').toLowerCase();
    const tags = [];
    if (/dolby.?vision|dovi|杜比视界/.test(t)) tags.push('杜比视界');
    else if (/hdr/.test(t)) tags.push('HDR');
    if (/4k|2160p|uhd|8k/.test(t)) tags.push('4K');
    if (/remux|蓝光原盘|bluray|blu-ray|原盘/.test(t)) tags.push('蓝光');
    if (/高码率|高码|x265|h265|hevc/.test(t)) tags.push('高码');
    if (/1080p|1080i/.test(t)) tags.push('1080P');
    if (/60fps|60帧/.test(t)) tags.push('60帧');
    return tags.slice(0, 3);
}

function sortByQuality(list) {
    return list
        .map((x, i) => ({ x, q: qualityScore(x.title), i }))
        .sort((a, b) => b.q - a.q || a.i - b.i)
        .map(v => v.x);
}

/** 把前端传来的地址（字符串 / 数组）规范成去重后的 https 根地址列表，最多 5 个 */
function normalizeBases(input, fallback) {
    const raw = Array.isArray(input) ? input : (input ? [input] : []);
    const bases = [];
    let lastErr = null;
    for (const item of raw) {
        try {
            const base = resolveApiBase(item, '');
            if (base && !bases.includes(base)) bases.push(base);
        } catch (e) { lastErr = e; }
        if (bases.length >= 5) break;
    }
    if (bases.length) return bases;
    if (lastErr) throw lastErr;
    return [fallback];
}

/** 多个引擎结果合并：按 类型+链接 去重后统一按画质排序 */
function mergeEngineLists(lists) {
    const seen = new Set();
    const out = [];
    lists.forEach(list => (list || []).forEach(item => {
        const key = item.type + '|' + normShareUrl(item.url);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(item);
    }));
    return sortByQuality(out);
}

/** 单个盘搜引擎：POST 聚合接口，按 merged_by_type 归并 */
async function panSearchOne(q, base) {
    const ck = 'pan|' + base + '|' + q;
    const hit = panCache.get(ck);
    if (hit && hit.expires > Date.now()) return hit.value;

    const res = await upstreamFetch(base + '/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kw: q, res: 'merge', cloud_types: PAN_ALL_TYPES, src: 'all' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const byType = (data && data.data && data.data.merged_by_type) || (data && data.merged_by_type) || {};

    const out = [];
    const seen = new Set();
    Object.keys(byType).forEach(type => {
        (byType[type] || []).forEach(item => {
            const url = item.url || item.share_url || '';
            if (!url) return;
            const key = type + '|' + normShareUrl(url);
            if (seen.has(key)) return;
            seen.add(key);
            const title = cleanText(item.note || item.title || item.name || q);
            out.push({
                type,
                label: PAN_TYPE_LABEL[type] || type,
                title,
                url,
                password: item.password || item.pwd || '',
                datetime: item.datetime || item.time || '',
                qualityTags: qualityTagsOf(title)
            });
        });
    });

    const list = sortByQuality(out);
    if (list.length) panCache.set(ck, { value: list, expires: Date.now() + PAN_CACHE_TTL });
    return list;
}

/** 盘搜：支持多个地址，并发请求后合并去重 */
async function panSearch(keyword, apiBase) {
    const q = String(keyword || '').trim();
    if (!q) return [];
    const bases = normalizeBases(apiBase, PAN_API_BASE);
    const settled = await Promise.allSettled(bases.map(base => panSearchOne(q, base)));
    const lists = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
    if (!lists.length) {
        const failed = settled.find(x => x.status === 'rejected');
        throw (failed && failed.reason) || new Error('盘搜请求失败');
    }
    return mergeEngineLists(lists);
}

let mipanToken = { base: '', value: '', expireAt: 0 };
async function mipanFetchToken(force, base) {
    if (!force && mipanToken.base === base && mipanToken.value && Date.now() < mipanToken.expireAt) return mipanToken.value;
    const res = await upstreamFetch(base + '/api/token', {
        headers: { accept: 'application/json', referer: base + '/' }
    });
    if (!res.ok) throw new Error('token HTTP ' + res.status);
    const data = await res.json().catch(() => null);
    if (!data || !data.token) throw new Error('未获取到觅搜 token');
    mipanToken = { base, value: String(data.token), expireAt: Date.now() + PAN_CACHE_TTL };
    return mipanToken.value;
}

async function mipanRequest(q, token, base) {
    const res = await upstreamFetch(base + '/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mipan-token': token, referer: base + '/' },
        body: JSON.stringify({ kw: q })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}

/** 单个觅搜引擎：token 鉴权，token 失效自动刷新重试一次 */
async function mipanSearchOne(q, base) {
    const ck = 'mipan|' + base + '|' + q;
    const hit = panCache.get(ck);
    if (hit && hit.expires > Date.now()) return hit.value;

    let data;
    try {
        data = await mipanRequest(q, await mipanFetchToken(false, base), base);
    } catch (e) {
        data = await mipanRequest(q, await mipanFetchToken(true, base), base);
    }

    let root = data;
    if (data && data.data && typeof data.data === 'object') root = data.data;

    const out = [];
    const seen = new Set();
    const pushItem = (it, typeHint) => {
        if (!it) return;
        const url = it.url || it.link || it.share_url || '';
        if (!url) return;
        let type = String(it.type || it.disk_type || typeHint || 'other').toLowerCase();
        if (type === 'ali') type = 'aliyun';
        if (type === 'others') type = 'other';
        if (!MIPAN_ALL_TYPES.includes(type)) return;
        const key = type + '|' + normShareUrl(url);
        if (seen.has(key)) return;
        seen.add(key);
        const title = cleanText(it.note || it.title || it.name || q);
        out.push({
            type,
            label: PAN_TYPE_LABEL[type] || type,
            title,
            url,
            password: it.password || it.pwd || '',
            datetime: it.datetime || it.date || it.publishTime || '',
            qualityTags: qualityTagsOf(title)
        });
    };
    if (Array.isArray(root)) root.forEach(x => pushItem(x));
    else if (root && Array.isArray(root.results)) {
        root.results.forEach(x => {
            if (x && Array.isArray(x.links)) x.links.forEach(l => pushItem(Object.assign({}, x, l), l && l.type));
            else pushItem(x);
        });
    }
    if (root && root.merged_by_type && typeof root.merged_by_type === 'object') {
        Object.keys(root.merged_by_type).forEach(t => (root.merged_by_type[t] || []).forEach(item => pushItem(item, t)));
    }

    const list = sortByQuality(out);
    if (list.length) panCache.set(ck, { value: list, expires: Date.now() + PAN_CACHE_TTL });
    return list;
}

/** 觅搜：支持多个地址，并发请求后合并去重 */
async function mipanSearch(keyword, origin) {
    const q = String(keyword || '').trim();
    if (!q) return [];
    const bases = normalizeBases(origin, MIPAN_ORIGIN);
    const settled = await Promise.allSettled(bases.map(base => mipanSearchOne(q, base)));
    const lists = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
    if (!lists.length) {
        const failed = settled.find(x => x.status === 'rejected');
        throw (failed && failed.reason) || new Error('觅搜请求失败');
    }
    return mergeEngineLists(lists);
}

function status() {
    return {
        name: 'makkah-media-nav',
        metaFrom: ['lib/MakkaPakka-ALL.js', 'lib/ptjc.js'],
        modules: MODULES.length,
        quickLists: QUICK.length,
        tmdbKeyConfigured: Boolean(API_KEY),
        proxyConfigured: Boolean(proxyAgent),
        upstreamTimeoutMs: UPSTREAM_TIMEOUT,
        cacheEntries: cache.size
    };
}

module.exports = { MODULES, QUICK, hasModule, defaultsOf, getData, search, panSearch, mipanSearch, PAN_ALL_TYPES, PAN_TYPE_LABEL, status, GENRE_MAP, ADVANCED_GENRE_MAP, REGION_MAP, upstreamFetch, sourceVersions: SOURCE_VERSIONS, primaryVersion: PRIMARY_VERSION };
