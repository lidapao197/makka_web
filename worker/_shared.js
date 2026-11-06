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
