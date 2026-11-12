# Makkah导航 (makka-media-hub)

现代、极简的影视资源聚合导航站。只做信息展示与第三方跳转，不存储、不播放任何视频内容。

> **参考来源**：<https://github.com/MakkaPakka518/testwidget>（ForwardWidget / rex 测试模块）。
> 项目 `lib/` 下的历史 Widget 脚本、栏目定义、筛选器与类型/地区映射均源自该仓库；本站服务端以 `vm` 沙箱解析它们，未改动原始文件。

- **应用版本**：`1.0.0`（`package.json`）
- **栏目版本**：番剧 / 全球影剧 `1.4.0`（`lib/MakkaPakka-ALL.js`），平台片库 `1.3.0`（`lib/ptjc.js` 平台剧场）；三个按钮按各自归属显示对应 `WidgetMetadata.version`
- **技术栈**：Node.js ≥ 20.18.1 / Express 4 / Cloudflare Workers / 原生 HTML + CSS + JavaScript
- **访问地址**：`http://localhost:3010`（`PORT` 可覆盖；控制台仅输出这一行地址）
- **数据**：TMDB（Key 由 `TMDB_API_KEY` 提供，本地可选代理）；请求失败时页面显示错误提示与重试按钮
- **部署**：本地 Express 与 Cloudflare Worker（`wrangler.jsonc` + `worker/`）并存，共用同一份 `lib` 元数据（见最后一章）

---

## 一、快速开始

### 环境要求

- Node.js 20.18.1 或更高（`undici` 7 的要求）；用 `.env` 启动（`npm run start:env` / `run.bat`）需 **22.9+**（`--env-file-if-exists`）
- 首次运行会安装依赖（express、undici、cheerio、winston 等）

### 启动

```bat
npm start
```

带 `.env` 启动（推荐，Key 与代理一次配好）：

```bat
npm run start:env
```

也可以双击 `run.bat`，它同样读取 `.env`（Node 22.9+，文件不存在时自动忽略）。

自定义端口（PowerShell）：

```powershell
$env:PORT=3011; npm start
```

### 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `TMDB_API_KEY` | 是 | TMDB API Key，在 Cloudflare Pages → Settings → Environment variables 配置为加密 Secret |
| `TMDB_LANGUAGE` | 否 | 默认 `zh-CN` |
| `TMDB_PROXY_URL` | 否 | 本地开发用的代理（如 `http://127.0.0.1:7897`）；Cloudflare 上留空直连即可，盘搜引擎也走它 |
| `PAN_API_BASE` | 否 | 盘搜引擎地址，默认 `https://so.252035.xyz`（仅本地 Express 读取） |

本地推荐用 `.env`（已被 `.gitignore` 忽略，不会进仓库）：

```ini
TMDB_API_KEY=<你的 Key>
TMDB_PROXY_URL=http://127.0.0.1:7897
TMDB_LANGUAGE=zh-CN
```

```powershell
Copy-Item .env.example .env   # 首次：复制模板后填入 Key
npm run start:env             # 读取 .env 启动
```

也可以临时导出（只对当前窗口有效）：

```powershell
$env:TMDB_API_KEY="<你的 Key>"; $env:TMDB_PROXY_URL="http://127.0.0.1:7897"; npm start
```

未配置 `TMDB_API_KEY` 时，页面右上角显示「请先输入TMDB的KEY」，点击可在弹窗中输入并保存在当前浏览器（随同源请求发送）；生产环境建议始终使用服务端环境变量。改动环境变量或后端代码后需重启服务；前端静态文件刷新即可。

---

## 二、页面与功能

| 区域 | 说明 |
|---|---|
| 顶部导航 | Logo / favicon、TMDB 全站搜索、数据状态徽章、日夜间切换、关于 |
| 栏目按钮 | 番剧 · 全球影剧 · 平台片库，各显示对应归属的 `WidgetMetadata.version` |
| 网盘搜索 | 栏目栏最右侧，点开后输入关键词，用「盘搜」或「觅搜」检索网盘资源，结果按网盘分组 |
| 快捷榜单 | 5 个预设入口，来自 `lib/ptjc.js` 的剧场/榜单模块 |
| 筛选栏 | 类型 / 地区 / 年份 / 排序等胶囊选项，支持 `belongTo` 级联；两项排序默认「最新」 |
| 卡片网格 | 桌面 6→2 列响应式，竖版海报 + 片名 + 上映时间，点击弹出详情 |
| 详情弹层 | 780px 宽屏，横版海报主视觉，片名下方按可用字段显示地区 / 类型 / 题材 / 语言标签，标签末尾为 TMDB 跳转按钮 + 简介 |
| 分页 | 基于接口 `hasMore`，搜索与浏览共用 |

---

## 三、目录结构

```
makka_web/
├── server.js                # 本地 Express 入口：静态托管 / API 路由 / 图片代理
├── lib/
│   ├── catalog.js           # 本地数据层：解析历史脚本、TMDB 请求、失败提示、缓存
│   ├── MakkaPakka-ALL.js    # 历史 Widget 母本（栏目 / 筛选器 / 映射表来源）
│   └── ptjc.js              # 历史「平台剧场」Widget（快捷榜单来源）
├── wrangler.jsonc           # Workers 配置：入口 / 兼容日期 / public 静态资源绑定
├── worker/                  # Cloudflare Worker（单入口 fetch handler）
│   ├── index.js             #   /api/* 路由分发 + 静态资源回落
│   ├── _shared.js           #   与 catalog.js 等价的纯 Web 标准数据逻辑
│   └── _meta.js             #   npm run build 生成的静态元数据（已随仓库提交）
├── scripts/
│   └── build-meta.js        # 构建期解析 lib/*.js → worker/_meta.js
├── public/
│   ├── index.html
│   ├── favicon.svg          # Lucide 场记板图标
│   ├── css/style.css
│   └── js/app.js            # 渲染与交互（原生 JS）
├── .nvmrc                   # 固定 CF 构建期 Node 22
├── run.bat                  # Windows 一键启动（GBK + CRLF，勿改格式）
├── package.json
└── README.md
```

---

## 四、接口一览

| 接口 | 说明 |
|---|---|
| `GET /api/modules` | 栏目、筛选器、快捷榜单、类型映射与 `version` |
| `GET /api/data?module=<id>&<参数>&page=1` | 栏目数据，返回 `{module, items, source, page, hasMore, note}` |
| `GET /api/search?q=<关键词>&page=1` | TMDB `search/multi` 全站搜索 |
| `GET /api/pan/search?q=<关键词>` | 盘搜：聚合引擎结果，按网盘分组，含画质标签与提取码 |
| `GET /api/mipan/search?q=<关键词>` | 觅搜：token 鉴权的第二个聚合引擎 |
| `GET /api/img?url=<编码后的图片地址>` | 图片代理：域名白名单 + 按源站附加防盗链 Referer |
| `GET /api/status` | 运行状态：版本、Key / 代理配置、超时、缓存条目（本地与 Worker 均提供） |

---

## 五、数据链路

1. `lib/catalog.js` 在 `vm` 沙箱中读取两份历史脚本，提取 `WidgetMetadata`、`GLOBAL_GENRE_MAP_ALL`、`ADVANCED_GENRE_MAP`、`REGION_MAP`，规范化为 3 个栏目；展示层的排序默认值偏好在 catalog 内覆盖，不改动母本。
2. 卡片沿用历史 `buildItem` 契约：`id / tmdbId / mediaType / title / genreTitle / description / releaseDate / subTitle / posterPath / backdropPath / rating`，并补充 `originCountry / originalLanguage` 供详情标签使用。
3. 上游请求分两套运行时：本地 Express 走 `upstreamFetch()`，仅在设置 `TMDB_PROXY_URL` 时给 `tmdb.org` / `themoviedb.org` / `252035.xyz`（盘搜）挂 `undici.ProxyAgent`（超时 15 秒）；Cloudflare Worker 走原生 `fetch` 直连（超时 12 秒），不需要代理。觅搜域名本地可直连。两者返回相同的卡片契约。
4. 请求失败时返回一张 `type: 'text'` 提示卡片，页面显示失败原因并提供「重试」按钮，顶部徽章变红显示「请求失败」；不再保留任何离线兜底内容。成功结果缓存 5 分钟，失败结果不缓存以便重试。
5. 封面一律经 `/api/img` 代理，浏览器不直接访问 TMDB CDN；本地与 Worker 各有白名单 + 防盗链实现。
6. Worker 运行时没有 `fs` / `vm`，栏目、筛选器、映射表与版本由 `npm run build` 在构建期解析 `lib/*.js` 后固化为 `worker/_meta.js`；本地 Express 仍在运行时用 `vm` 解析同一份历史脚本。

---

## 六、参考来源

- **<https://github.com/MakkaPakka518/testwidget>** —— ForwardWidget / rex 测试模块；`MakkaPakka-ALL.js`、平台剧场等历史 Widget 脚本与栏目元数据来源
- **TMDB API** —— 影片信息与图片数据（<https://www.themoviedb.org/>）
- **Lucide** —— 站点图标 `clapperboard`（MIT，<https://github.com/lucide-icons/lucide>）
- **nodejs/undici** —— `ProxyAgent` 代理方案（<https://github.com/nodejs/undici>）

> 本站不是 TMDB 官方产品，仅使用其公开 API 做信息展示。

---

## 七、常见问题

| 现象 | 处理 |
|---|---|
| `EADDRINUSE 3010` | 已有实例在运行；关闭旧窗口，或 `$env:PORT=3011; npm start` |
| 徽章显示「请先输入TMDB的KEY」 | 服务端未设 `TMDB_API_KEY`；点击徽章在弹窗输入并保存在浏览器，或到 CF 后台配置环境变量 |
| 徽章显示「请求失败」 | TMDB 不可达 / 超时 / Key 无效；页面显示失败原因与「重试」按钮，本地检查 `TMDB_PROXY_URL` |
| 改了 `lib/catalog.js` / `server.js` 没生效 | 后端代码不热重载，需重启服务；前端文件刷新即可 |
| 盘搜提示超时 | 盘搜引擎 `so.252035.xyz` 在本机直连被阻断，需设置 `TMDB_PROXY_URL`；Cloudflare 上由平台出口直连 |
| 觅搜提示 token 失败 | 上游鉴权服务临时不可用，稍后重试或改用盘搜 |
| 双击 `run.bat` 一闪而退 | 该文件必须保持 GBK 编码 + CRLF 换行 |

---

## 八、部署到 Cloudflare Workers

本项目采用**并存式**架构：`server.js` + `lib/catalog.js` 负责本地 Express，`wrangler.jsonc` + `worker/` 负责 Cloudflare Workers，前端 `public/` 完全共用，本地 `npm start` 不受影响。

### 一次性配置

在 Cloudflare Dashboard → Workers & Pages → **Create application → GitHub** 导入仓库（Workers Builds），配置：

| 配置项 | 值 |
|---|---|
| Worker 名称 | `makka-media-hub`（**必须与 `wrangler.jsonc` 的 `name` 完全一致**，否则构建失败） |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy`（默认） |
| Preview command | `npx wrangler preview`（默认） |
| Root directory | `/`（默认） |
| 运行时 Secret | Settings → **Variables & Secrets** 添加 `TMDB_API_KEY`；可选 `TMDB_LANGUAGE=zh-CN` |
| Node 版本 | 由仓库根目录 `.nvmrc` 固定为 `22`（Workers Builds 默认 24，不读 `engines`） |

`wrangler.jsonc` 里 `assets.directory = "./public"` + `ASSETS` binding：`worker/index.js` 对非 `/api/*` 请求调用 `env.ASSETS.fetch(request)` 回落静态资源，API 由同一个 Worker 的路径分发处理。

### 自动部署

配置完成后，push 到生产分支即自动触发：自动安装依赖 → `npm run build`（重新生成 `worker/_meta.js`）→ `npx wrangler deploy`。非生产分支通过 `npx wrangler preview` 生成 Preview URL，构建日志保留 90 天。若要关闭自动发布，把 Deploy command 改成 `npx wrangler versions upload`。

### 注意事项

- **Key 不进仓库**：`TMDB_API_KEY` 是运行时 Secret，不要只配在 Settings → Build 的 Build variables 里（那些仅构建期可见）；未配置时页面徽章显示「请先输入TMDB的KEY」，点击可在弹窗输入并保存在当前浏览器。
- `worker/_meta.js` 是构建产物，已随仓库提交作为兜底，每次构建覆盖，请勿手动修改。
- CF 出口可直接访问 TMDB，**不需要** `TMDB_PROXY_URL`；该变量仅用于本地开发绕过 DNS 污染。
- `server.js`、`run.bat` 会一起提交但 CF 不会执行；`lib/*.js` 只在构建期被 `scripts/build-meta.js` 读取。
- `package.json` 已把 `wrangler` 列入 devDependencies，Workers Builds 会用仓库声明的版本。
- 本地手动部署可用 `npm run deploy`（需先 `npx wrangler login`）；预览 Workers 版用 `npx wrangler dev`，与 3010 端口的 Express 互不干扰。
