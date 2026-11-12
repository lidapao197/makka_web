/* Cloudflare Worker 共用的数据逻辑（仅使用 Web 标准 API，无 Node 内置模块） */
import { META } from './_meta.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const LANG = 'zh-CN';
const UPSTREAM_TIMEOUT = 12000;
export const IMG_ALLOWED_HOSTS = /^(image\.tmdb\.org|img\d*\.doubanio\.com|doubanio\.com|p\.static\.bilibili\.com|i0\.hdslb\.com|lain\.bgm\.tv|media\.trakt\.tv|s\d*\.anilist\.co)$/i;

/* isolate 级缓存：同一 Worker 实例内的请求可复用，实时性以 5 分钟为限 */
const cache = new Map();

export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
}

export function keyConfigured(env) {
    return Boolean(String(env.TMDB_API_KEY || '').trim());
}

/* 与本地 Express 保持一致：服务端环境变量优先，其次页面弹窗输入的 Key */
export function requestKey(request, env) {
    return String(env.TMDB_API_KEY || request.headers.get('X-TMDB-Key') || '').trim();
}

export function hasModule(id) {
    return META.modules.some(m => m.id === id);
}

export function imgRefererFor(hostname) {
    if (/doubanio\.com$/i.test(hostname)) return 'https://movie.douban.com/';
    if (/tmdb\.org$/i.test(hostname)) return 'https://www.themoviedb.org/';
    if (/(bilibili\.com|hdslb\.com)$/i.test(hostname)) return 'https://www.bilibili.com/';
    if (/bgm\.tv$/i.test(hostname)) return 'https://bgm.tv/';
    return '';
}

function errorResult(page, note) {
    return {
        items: [{ id: 'error', type: 'text', title: '数据加载失败', description: `${note}。请检查 TMDB_API_KEY 配置或稍后重试。` }],
        source: 'error', page, hasMore: false, note
    };
}

function genreText(ids) {
    const names = (ids || []).map(id => META.genreMap[id]).filter(Boolean);
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

function tmdbUrl(endpoint, query, key) {
    const url = new URL(TMDB_BASE + endpoint);
    url.searchParams.set('api_key', key);
    url.searchParams.set('language', LANG);
    Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
    return url;
}

async function tmdbGet(endpoint, query, key) {
    const res = await fetch(tmdbUrl(endpoint, query, key), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT)
    });
    if (!res.ok) throw new Error('TMDB ' + res.status);
    return res.json();
}

function sortByRule(list, rule) {
    if (rule === 'rating') list.sort((a, b) => b.vote - a.vote);
    else if (rule === 'time') list.sort((a, b) => b._date.localeCompare(a._date));
    else list.sort((a, b) => b._popularity - a._popularity);
}

function discoverQuery(mediaType, page, rule) {
    const q = { page, include_adult: 'false', 'vote_count.gte': rule === 'rating' ? 200 : 10 };
    if (rule === 'rating') q.sort_by = 'vote_average.desc';
    else if (rule === 'time') {
        q.sort_by = mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
        const maxDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        q[mediaType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = maxDate;
    } else q.sort_by = 'popularity.desc';
    return q;
}

async function tmdbGenreRank(p, page, key) {
    const mediaType = p.sort_by || 'all';
    const genre = p.genre || 'all';
    const region = p.region || 'all';
    const rule = p.order_rule || 'popularity';
    const build = mt => {
        const q = discoverQuery(mt, page, rule);
        const gid = (META.advancedGenreMap[genre] || {})[mt];
        if (gid) q.with_genres = gid;
        const country = META.regionMap[region];
        if (country) q.with_origin_country = country;
        return q;
    };
    if (mediaType === 'all') {
        const [movies, tvs] = await Promise.all([
            tmdbGet('/discover/movie', build('movie'), key),
            tmdbGet('/discover/tv', build('tv'), key)
        ]);
        const list = [
            ...(movies.results || []).map(x => toCard(x, 'movie')),
            ...(tvs.results || []).map(x => toCard(x, 'tv'))
        ];
        sortByRule(list, rule);
        return list.slice(0, 20);
    }
    const r = await tmdbGet(`/discover/${mediaType}`, build(mediaType), key);
    return (r.results || []).map(x => toCard(x, mediaType));
}

async function tmdbPlatform(p, page, key) {
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
        if (q.sort_by === 'first_air_date.desc') q.sort_by = 'primary_release_date.desc';
        const providerMap = { '213': '8', '2739': '337', '49': '1899|15', '2552': '350' };
        q.watch_region = 'US';
        q.with_watch_providers = providerMap[network];
    }
    const r = await tmdbGet(`/discover/${mediaType}`, q, key);
    const items = (r.results || []).map(x => toCard(x, mediaType));
    return items.length ? items : [{ id: 'empty', type: 'text', title: '暂无流媒体数据', description: '试试切换平台或内容分类' }];
}

async function tmdbAnime(p, page, key) {
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
    const r = await tmdbGet('/discover/tv', q, key);
    return (r.results || []).map(x => toCard(x, 'tv'));
}

function fetchUpstream(id, p, page, key) {
    if (id === 'genreRank') return tmdbGenreRank(p, page, key);
    if (id === 'platform') return tmdbPlatform(p, page, key);
    return tmdbAnime(p, page, key);
}

export async function getData(id, rawParams, key) {
    const p = { ...(META.defaults[id] || {}), ...rawParams };
    const page = Math.max(1, parseInt(p.page, 10) || 1);
    p.page = page;
    const cacheKey = id + ':' + JSON.stringify(Object.entries(p).sort());
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.value;

    if (!key) return errorResult(page, '未配置 TMDB API Key');
    try {
        const items = await fetchUpstream(id, p, page, key);
        if (!Array.isArray(items)) throw new Error('上游返回异常');
        const value = { items, source: 'tmdb', page, hasMore: items.length >= 20, note: '' };
        cache.set(cacheKey, { value, expires: Date.now() + 300000 });
        return value;
    } catch (e) {
        return errorResult(page, `TMDB 请求失败（${e.message}）`);
    }
}

export async function search(query, rawPage, key) {
    const keyword = String(query || '').trim();
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    if (!keyword) return { items: [], source: 'tmdb', page: 1, hasMore: false, note: '' };
    if (!key) return errorResult(page, '未配置 TMDB API Key');

    try {
        const url = tmdbUrl('/search/multi', { query: keyword, page, include_adult: 'false' }, key);
        const res = await fetch(url, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT)
        });
        if (!res.ok) throw new Error('TMDB ' + res.status);
        const data = await res.json();
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
 * 网盘搜索：盘搜（so.252035.xyz）+ 觅搜（mipan.so）
 * ------------------------------------------------------------------ */
const PAN_API_BASE = 'https://so.252035.xyz';
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

/** 校验用户填写的引擎地址：仅 https、禁止内网与 IP 直连 */
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

function panFetch(url, options = {}) {
    return fetch(url, { ...options, signal: AbortSignal.timeout(18000) });
}

async function panSearchOne(q, base) {
    const ck = 'pan|' + base + '|' + q;
    const hit = panCache.get(ck);
    if (hit && hit.expires > Date.now()) return hit.value;

    const res = await panFetch(base + '/api/search', {
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

export async function panSearch(keyword, apiBase) {
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
    const res = await panFetch(base + '/api/token', {
        headers: { accept: 'application/json', referer: base + '/' }
    });
    if (!res.ok) throw new Error('token HTTP ' + res.status);
    const data = await res.json().catch(() => null);
    if (!data || !data.token) throw new Error('未获取到觅搜 token');
    mipanToken = { base, value: String(data.token), expireAt: Date.now() + PAN_CACHE_TTL };
    return mipanToken.value;
}

async function mipanRequest(q, token, base) {
    const res = await panFetch(base + '/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mipan-token': token, referer: base + '/' },
        body: JSON.stringify({ kw: q })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}

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

export async function mipanSearch(keyword, origin) {
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

export function status(env) {
    return {
        name: 'makkah-media-nav',
        metaFrom: ['lib/MakkaPakka-ALL.js', 'lib/ptjc.js'],
        modules: META.modules.length,
        quickLists: META.quick.length,
        tmdbKeyConfigured: keyConfigured(env),
        proxyConfigured: false,
        upstreamTimeoutMs: UPSTREAM_TIMEOUT,
        cacheEntries: cache.size
    };
}
