/* Cloudflare Worker 入口：/api/* 走数据接口，其余请求回落 public/ 静态资源 */
import { META } from './_meta.js';
import {
    IMG_ALLOWED_HOSTS, imgRefererFor, json, keyConfigured, requestKey,
    hasModule, getData, search, panSearch, mipanSearch, status
} from './_shared.js';

async function handleImg(url) {
    const raw = url.searchParams.get('url') || '';
    let target;
    try { target = new URL(raw); } catch (e) {
        return new Response('bad url', { status: 400 });
    }
    if (!/^https?:$/.test(target.protocol) || !IMG_ALLOWED_HOSTS.test(target.hostname)) {
        return new Response('host not allowed', { status: 400 });
    }
    try {
        const referer = imgRefererFor(target.hostname);
        const upstream = await fetch(target.toString(), {
            headers: referer ? { referer } : {},
            signal: AbortSignal.timeout(12000)
        });
        if (!upstream.ok) return new Response('upstream ' + upstream.status, { status: 502 });
        return new Response(upstream.body, {
            status: 200,
            headers: {
                'content-type': upstream.headers.get('content-type') || 'image/jpeg',
                'cache-control': 'public, max-age=86400'
            }
        });
    } catch (e) {
        return new Response('upstream failed', { status: 502 });
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        /* 静态资源、favicon、首页等全部交给 Workers Static Assets */
        if (path !== '/api' && !path.startsWith('/api/')) {
            return env.ASSETS.fetch(request);
        }

        switch (path) {
            case '/api/modules':
                return json({
                    version: META.primaryVersion,
                    sourceVersions: META.sourceVersions,
                    keyConfigured: keyConfigured(env),
                    modules: META.modules,
                    quick: META.quick,
                    genreMap: META.genreMap
                });

            case '/api/status':
                return json({
                    version: META.primaryVersion,
                    appVersion: META.appVersion,
                    sourceVersions: META.sourceVersions,
                    ...status(env),
                    uptimeSec: 0
                });

            case '/api/data': {
                const params = Object.fromEntries(url.searchParams);
                const moduleId = params.module;
                delete params.module;
                if (!hasModule(moduleId)) {
                    return json({ error: `未知模块: ${moduleId || '(空)'}` }, 400);
                }
                try {
                    const data = await getData(moduleId, params, requestKey(request, env));
                    return json({ module: moduleId, ...data });
                } catch (e) {
                    return json({ error: '服务内部错误', message: e.message }, 500);
                }
            }

            case '/api/search':
                try {
                    const data = await search(
                        url.searchParams.get('q') || '',
                        url.searchParams.get('page'),
                        requestKey(request, env)
                    );
                    return json(data);
                } catch (e) {
                    return json({ error: '搜索失败', message: e.message }, 500);
                }

            case '/api/pan/search':
            case '/api/mipan/search': {
                const q = (url.searchParams.get('q') || '').trim();
                const apiBase = url.searchParams.getAll('url');
                if (!q) return json({ ok: true, list: [], query: '' });
                try {
                    const list = path === '/api/pan/search' ? await panSearch(q, apiBase) : await mipanSearch(q, apiBase);
                    return json({ ok: true, list, query: q });
                } catch (e) {
                    return json({ ok: false, error: e.message, query: q });
                }
            }

            case '/api/img':
                return handleImg(url);

            default:
                return json({ error: 'not found', path }, 404);
        }
    }
};
