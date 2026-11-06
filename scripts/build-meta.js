'use strict';
/**
 * 构建期脚本：在 Node 环境里用 vm 解析 lib/*.js 的 WidgetMetadata，
 * 把规范化后的栏目 / 筛选器 / 映射表 / 版本固化为 worker/_meta.js。
 * Cloudflare Workers 运行时没有 fs / vm，不能直接读取这两份历史脚本。
 * 本地 Express 不依赖本文件，npm start 行为不变。
 */
const fs = require('fs');
const path = require('path');
const catalog = require('../lib/catalog');
const pkg = require('../package.json');

const meta = {
    modules: catalog.MODULES,
    quick: catalog.QUICK,
    defaults: Object.fromEntries(catalog.MODULES.map(m => [m.id, m.defaults])),
    genreMap: catalog.GENRE_MAP,
    advancedGenreMap: catalog.ADVANCED_GENRE_MAP,
    regionMap: catalog.REGION_MAP,
    sourceVersions: catalog.sourceVersions,
    primaryVersion: catalog.primaryVersion,
    appVersion: pkg.version
};

const outDir = path.join(__dirname, '..', 'worker');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, '_meta.js');
fs.writeFileSync(
    out,
    '/* 由 npm run build 自动生成（读取 lib/*.js 的 WidgetMetadata），请勿手改 */\n' +
    'export const META = ' + JSON.stringify(meta, null, 2) + ';\n',
    'utf8'
);
console.log('worker/_meta.js generated:', fs.statSync(out).size, 'bytes');
