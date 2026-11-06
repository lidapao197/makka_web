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
const TMDB_HOST = /(^|\.)(tmdb\.org|themoviedb\.org)$/i;

function upstreamFetch(url, options = {}) {
    const hostname = url instanceof URL ? url.hostname : new URL(String(url)).hostname;
    const opts = { ...options, signal: options.signal || AbortSignal.timeout(UPSTREAM_TIMEOUT) };
    if (proxyAgent && TMDB_HOST.test(hostname)) opts.dispatcher = proxyAgent;
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

module.exports = { MODULES, QUICK, hasModule, defaultsOf, getData, search, status, GENRE_MAP, ADVANCED_GENRE_MAP, REGION_MAP, upstreamFetch, sourceVersions: SOURCE_VERSIONS, primaryVersion: PRIMARY_VERSION };
