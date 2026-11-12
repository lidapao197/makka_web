'use strict';
/**
 * Makkah导航 — 现代极简影视导航站入口
 *
 * 技术栈: Node.js 18+ / Express 4 / 原生 HTML + CSS + JS
 * 数据层: lib/catalog.js（从 lib 历史 Widget 脚本提取栏目定义，TMDB 不可用时自动降级）
 *
 * 启动: node server.js  (或双击 run.bat)，默认 http://localhost:3010
 */
const path = require('path');
const express = require('express');
const catalog = require('./lib/catalog');

const PORT = Number(process.env.PORT) || 3010;
const HOST = process.env.HOST || '127.0.0.1';
const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

const APP_VERSION = require('./package.json').version;

/* Key 优先取服务端环境变量（CF Secret），其次取页面弹窗输入并随请求头传入 */
function requestKey(req) {
    return String(process.env.TMDB_API_KEY || req.get('X-TMDB-Key') || '').trim();
}

/* 1. 栏目与筛选器定义（来自 lib 历史脚本） */
app.get('/api/modules', (req, res) => {
    res.json({
        version: catalog.primaryVersion,
        sourceVersions: catalog.sourceVersions,
        keyConfigured: Boolean(String(process.env.TMDB_API_KEY || '').trim()),
        modules: catalog.MODULES,
        quick: catalog.QUICK,
        genreMap: catalog.GENRE_MAP
    });
});

/* 2. 数据：兼容原契约 {module, items}，附带来源与分页信息 */
app.get('/api/data', async (req, res) => {
    const { module: moduleId, ...params } = req.query;
    if (!catalog.hasModule(moduleId)) {
        return res.status(400).json({ error: `未知模块: ${moduleId || '(空)'}` });
    }
    try {
        const data = await catalog.getData(moduleId, params, requestKey(req));
        res.json({ module: moduleId, ...data });
    } catch (e) {
        res.status(500).json({ error: '服务内部错误', message: e.message });
    }
});

/* 2b. 全站搜索：TMDB search/multi */
app.get('/api/search', async (req, res) => {
    try {
        res.json(await catalog.search(String(req.query.q || ''), req.query.page, requestKey(req)));
    } catch (e) {
        res.status(500).json({ error: '搜索失败', message: e.message });
    }
});

/* 2c. 网盘搜索：盘搜 / 觅搜（上游失败返回 ok:false，由前端提示） */
app.get('/api/pan/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ ok: true, list: [], query: '' });
    try {
        res.json({ ok: true, list: await catalog.panSearch(q, req.query.url), query: q });
    } catch (e) {
        res.json({ ok: false, error: e.message, query: q });
    }
});

app.get('/api/mipan/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ ok: true, list: [], query: '' });
    try {
        res.json({ ok: true, list: await catalog.mipanSearch(q, req.query.url), query: q });
    } catch (e) {
        res.json({ ok: false, error: e.message, query: q });
    }
});

/* 3. 图片代理：沿用原白名单 + 防盗链策略，历史脚本的封面均走此路由 */
const IMG_ALLOWED_HOSTS = /^(image\.tmdb\.org|img\d*\.doubanio\.com|doubanio\.com|p\.static\.bilibili\.com|i0\.hdslb\.com|lain\.bgm\.tv|media\.trakt\.tv|s\d*\.anilist\.co)$/i;

function imgRefererFor(hostname) {
    if (/doubanio\.com$/i.test(hostname)) return 'https://movie.douban.com/';
    if (/tmdb\.org$/i.test(hostname)) return 'https://www.themoviedb.org/';
    if (/(bilibili\.com|hdslb\.com)$/i.test(hostname)) return 'https://www.bilibili.com/';
    if (/bgm\.tv$/i.test(hostname)) return 'https://bgm.tv/';
    return '';
}

app.get('/api/img', async (req, res) => {
    let target;
    try { target = new URL(String(req.query.url || '')); } catch (_) {
        return res.status(400).end('bad url');
    }
    if (!/^https?:$/.test(target.protocol) || !IMG_ALLOWED_HOSTS.test(target.hostname)) {
        return res.status(400).end('forbidden host');
    }
    try {
        const referer = imgRefererFor(target.hostname);
        const upstream = await catalog.upstreamFetch(target, {
            headers: referer ? { referer } : {}
        });
        if (!upstream.ok) return res.status(502).end('upstream error');
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (!buf.length) return res.status(502).end('empty body');
        res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(buf);
    } catch (e) {
        res.status(502).end('fetch failed');
    }
});

/* 4. 运行状态 */
app.get('/api/status', (req, res) => res.json({
    version: catalog.primaryVersion,
    appVersion: APP_VERSION,
    sourceVersions: catalog.sourceVersions,
    ...catalog.status(),
    uptimeSec: Math.round(process.uptime())
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'not found', path: req.originalUrl }));

const server = app.listen(PORT, HOST, () => {
    console.log(`http://localhost:${PORT}`);
});

server.on('error', (err) => {
    const code = (err && err.code) || '';
    if (code === 'EADDRINUSE') {
        console.error(`\n  [启动失败] ${HOST}:${PORT} 已被占用，本站同一时刻只能运行一个实例。`);
        console.error(`  ➜ 若旧实例已是最新版本，直接访问即可： http://localhost:${PORT}`);
        console.error('  ➜ 或结束旧实例后重试（PowerShell）：');
        console.error(`     Get-NetTCPConnection -LocalPort ${PORT} -State Listen | Select-Object OwningProcess`);
        console.error('     Stop-Process -Id <上面查到的 PID>');
        console.error('  ➜ 或换个端口启动：');
        console.error('     $env:PORT=' + (PORT + 1) + '; npm start\n');
    } else if (code === 'EACCES' || code === 'EADDRNOTAVAIL') {
        console.error(`\n  [启动失败] 无法绑定 ${HOST}:${PORT}（${code}），请更换 HOST / PORT 或检查权限。\n`);
    } else {
        console.error(`\n  [启动失败] ${(err && err.message) || err}\n`);
    }
    process.exitCode = 1;
});
