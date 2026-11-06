'use strict';
/* Makkah导航 — 前端交互（原生 JS，无依赖） */
const $ = sel => document.querySelector(sel);

const ICON_STAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.4l2.95 5.98 6.6.96-4.77 4.65 1.12 6.57L12 17.46l-5.9 3.1 1.12-6.57L2.45 9.34l6.6-.96L12 2.4Z"/></svg>';
const ICON_X = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const ICON_EXT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
const state = {
  modules: [], quick: [], version: '', keyConfigured: false, moduleId: 'genreRank', params: {}, page: 1,
  searching: false, searchQuery: '', searchTimer: null,
  payload: null, currentItems: [], abort: null
};

const KEY_STORAGE = 'makka-tmdb-key';
function getLocalKey() { try { return localStorage.getItem(KEY_STORAGE) || ''; } catch (_) { return ''; } }
function setLocalKey(v) { try { v ? localStorage.setItem(KEY_STORAGE, v) : localStorage.removeItem(KEY_STORAGE); } catch (_) { /* 忽略 */ } }
function apiHeaders() { const k = getLocalKey(); return k ? { 'X-TMDB-Key': k } : {}; }
function hasAnyKey() { return state.keyConfigured || Boolean(getLocalKey()); }

/* ---------------- 工具 ---------------- */
function esc(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
function imgFor(url) {
  if (!url || typeof url !== 'string') return '';
  let parsed;
  try { parsed = new URL(url, location.origin); } catch (_) { return ''; }
  const allowed = /^(image\.tmdb\.org|img\d*\.doubanio\.com|doubanio\.com|p\.static\.bilibili\.com|i0\.hdslb\.com|lain\.bgm\.tv|media\.trakt\.tv|s\d*\.anilist\.co)$/i.test(parsed.hostname);
  if (!allowed) return '';
  return '/api/img?url=' + encodeURIComponent(url);
}
const yearOf = m => String((m.releaseDate || '').slice(0, 4) || m.subTitle || '—');
function dateOf(m) {
  const d = String(m.releaseDate || m.subTitle || '').trim();
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(d) ? `上映 ${d}` : '上映时间未知';
}
const kindOf = m => m.mediaType === 'movie' ? '电影' : m.mediaType === 'tv' ? '剧集' : '影视';
const REGION_LABELS = { US:'美国', GB:'英国', CN:'中国大陆', HK:'中国香港', TW:'中国台湾', JP:'日本', KR:'韩国', FR:'法国', DE:'德国', ES:'西班牙', IT:'意大利', IN:'印度', TH:'泰国', CA:'加拿大', AU:'澳大利亚', SG:'新加坡', MX:'墨西哥' };
const LANG_LABELS = { en:'英语', zh:'中文', ja:'日语', ko:'韩语', fr:'法语', de:'德语', es:'西班牙语', it:'意大利语', hi:'印地语', th:'泰语', pt:'葡萄牙语', ru:'俄语' };
function coverTags(m) {
  const tags = [];
  const country = String(m.originCountry || '').toUpperCase();
  if (REGION_LABELS[country]) tags.push(REGION_LABELS[country]);
  else if (/^[A-Z]{2}$/.test(country)) tags.push(country);
  if (m.mediaType) tags.push(kindOf(m));
  String(m.genreTitle || '').split('/').map(s => s.trim()).filter(s => s && s !== '影视').forEach(g => tags.push(g));
  const lang = LANG_LABELS[String(m.originalLanguage || '').toLowerCase()];
  if (lang) tags.push(lang);
  return [...new Set(tags)].slice(0, 8);
}
function ratingHtml(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0
    ? `<span class="rating">${ICON_STAR}${n.toFixed(1)}</span>`
    : '<span>暂无评分</span>';
}
function currentModule() { return state.modules.find(m => m.id === state.moduleId) || { params: [], defaults: {} }; }
function isVisible(p) {
  if (!p.belongTo) return true;
  return p.belongTo.values.includes(String(state.params[p.belongTo.name] ?? ''));
}

/* ---------------- 初始化 ---------------- */
async function init() {
  bindStatic();
  let saved = 'dark';
  try { saved = localStorage.getItem('frame-theme') || 'dark'; } catch (_) { /* file:// 下可能不可用 */ }
  setTheme(saved);

  try {
    const res = await fetch('/api/modules');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    state.modules = data.modules || [];
    state.quick = data.quick || [];
    state.version = data.version || '';
    state.keyConfigured = Boolean(data.keyConfigured);
    if (!state.modules.length) throw new Error('栏目定义为空');
    applyModule(state.modules.find(m => m.id === 'genreRank') ? 'genreRank' : state.modules[0].id);
  } catch (e) {
    $('#resultMeta').textContent = '栏目载入失败';
    $('#grid').classList.add('is-empty');
    $('#grid').innerHTML = `<div class="error-box"><h3>无法连接数据服务</h3><p>${esc(e.message)}<br>请确认已运行 <code>node server.js</code>。</p><button type="button" id="retryInit">重新载入</button></div>`;
    $('#grid').addEventListener('click', e => { if (e.target.id === 'retryInit') location.reload(); }, { once: true });
  }
}

function setSearchMode(on, q = '') {
  $('#filterWrap').hidden = on;
  $('#quickRow').hidden = on;
  if (on) {
    $('#libraryTitle').textContent = `TMDB 搜索 · ${q}`;
    $('#libraryNote').textContent = '结果来自 TMDB 全站搜索';
  } else {
    const m = currentModule();
    $('#libraryTitle').textContent = `${m.label} · ${m.desc}`;
    $('#libraryNote').textContent = '点击卡片查看详情';
  }
}

function exitSearch(reload = true) {
  clearTimeout(state.searchTimer);
  const wasSearching = state.searching;
  state.searching = false;
  state.searchQuery = '';
  state.page = 1;
  $('#search').value = '';
  syncSearch();
  setSearchMode(false);
  if (reload && wasSearching) load();
}

function applyModule(id, preset = {}) {
  const m = state.modules.find(x => x.id === id);
  if (!m) return;
  state.moduleId = id;
  const params = { ...m.defaults };
  Object.entries(preset).forEach(([k, v]) => {
    if (Object.prototype.hasOwnProperty.call(m.defaults, k)) params[k] = String(v);
  });
  state.params = params;
  state.page = 1;
  clearTimeout(state.searchTimer);
  state.searching = false;
  state.searchQuery = '';
  $('#search').value = '';
  syncSearch();
  setSearchMode(false);
  renderTabs();
  renderQuick();
  renderFilters();
  load();
}

/* ---------------- 导航与筛选 ---------------- */
function renderTabs() {
  $('#tabs').innerHTML = state.modules.map(m => `
    <button type="button" class="tab ${m.id === state.moduleId ? 'is-active' : ''}" data-module="${esc(m.id)}"
            role="tab" aria-selected="${m.id === state.moduleId}" title="${esc(m.originTitle)}">
      <strong>${esc(m.label)}${(m.version || state.version) ? `<em class="tab-version">v${esc(m.version || state.version)}</em>` : ''}</strong><small>${esc(m.desc)}</small>
    </button>`).join('');
}

function renderQuick() {
  $('#quickRow').innerHTML = '<span class="quick-label">快捷榜单</span>' + state.quick.map((q, i) => `
    <button type="button" class="quick-chip" data-quick="${i}" title="来自 lib/ptjc.js：${esc(q.originTitle)}">${esc(q.label)}</button>`).join('');
}

function renderFilters() {
  const visible = currentModule().params.filter(isVisible);
  $('#filterGrid').innerHTML = visible.map(p => {
    const control = p.ui === 'select'
      ? `<div class="select-wrap"><select data-key="${esc(p.name)}" aria-label="${esc(p.title)}">
           ${p.options.map(o => `<option value="${esc(o.value)}" ${String(state.params[p.name]) === o.value ? 'selected' : ''}>${esc(o.title)}</option>`).join('')}
         </select></div>`
      : `<div class="pills" data-key="${esc(p.name)}">
           ${p.options.map(o => `<button type="button" class="pill ${String(state.params[p.name]) === o.value ? 'is-active' : ''}" data-value="${esc(o.value)}" aria-pressed="${String(state.params[p.name]) === o.value}">${esc(o.title)}</button>`).join('')}
         </div>`;
    return `<div class="filter-row">
              <span class="filter-label">${esc(p.title)}</span>${control}
            </div>`;
  }).join('');
}

function onFilterChange(key, value) {
  if (String(state.params[key]) === String(value)) return;
  state.params[key] = String(value);
  currentModule().params.forEach(p => {
    if (p.belongTo && p.belongTo.name === key) state.params[p.name] = p.value;
  });
  state.page = 1;
  renderFilters();
  load();
}

function queryParams() {
  const q = new URLSearchParams({ module: state.moduleId, page: String(state.page) });
  currentModule().params.filter(isVisible).forEach(p => {
    const v = state.params[p.name];
    if (v !== undefined && v !== '') q.set(p.name, v);
  });
  return q;
}

/* ---------------- 数据加载 ---------------- */
async function load() {
  if (state.abort) state.abort.abort();
  state.abort = new AbortController();
  showLoading();
  try {
    const url = state.searching
      ? '/api/search?' + new URLSearchParams({ q: state.searchQuery, page: state.page }).toString()
      : '/api/data?' + queryParams().toString();
    const res = await fetch(url, { signal: state.abort.signal, headers: apiHeaders() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.payload = await res.json();
    state.currentItems = state.payload.items || [];
    renderStatus();
    renderGrid();
    renderPager();
  } catch (e) {
    if (e.name === 'AbortError') return;
    $('#resultMeta').textContent = '加载失败';
    $('#grid').classList.add('is-empty');
    $('#grid').innerHTML = `<div class="error-box"><h3>数据加载失败</h3><p>${esc(e.message)}</p><button type="button" id="retryLoad">重试</button></div>`;
  }
}

function showLoading() {
  $('#resultMeta').textContent = '正在载入数据…';
  $('#grid').classList.add('is-loading');
  $('#grid').classList.remove('is-empty');
  $('#grid').innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton-card"><span></span></div>').join('');
  $('#pager').innerHTML = '';
}

function renderStatus() {
  if (!hasAnyKey()) {
    $('#sourceText').textContent = '请先输入TMDB的KEY';
    $('#sourceBadge').classList.add('is-error');
    $('#sourceBadge').title = '点击输入 TMDB API Key';
    return;
  }
  const failed = state.payload.source === 'error';
  $('#sourceText').textContent = failed ? '请求失败' : '在线数据';
  $('#sourceBadge').classList.toggle('is-error', failed);
  $('#sourceBadge').title = state.payload.note || (failed ? '请求失败' : 'TMDB 实时数据');
}

/* ---------------- 卡片网格 ---------------- */
function renderGrid() {
  const grid = $('#grid');
  grid.classList.remove('is-loading');
  const items = state.currentItems;
  const textCard = items.find(x => x.type === 'text');
  if (textCard && items.length === 1) {
    const failed = state.payload.source === 'error';
    grid.classList.add('is-empty');
    grid.innerHTML = `<div class="notice"><h3>${esc(textCard.title)}</h3><p>${esc(textCard.description || '请稍后重试。')}</p><button type="button" id="${failed ? 'retryLoad' : 'noticeReset'}">${failed ? '重试' : '重置筛选'}</button></div>`;
    $('#resultMeta').textContent = failed ? '数据加载失败' : '当前结果：0 部影片';
    return;
  }
  const list = items.filter(x => x.type !== 'text');
  const label = state.searching ? `搜索「${esc(state.searchQuery)}」` : '当前结果';
  $('#resultMeta').innerHTML = `${label}：<strong>${list.length} 部影片</strong> · 第 ${state.page} 页`;
  if (!list.length) {
    grid.classList.add('is-empty');
    grid.innerHTML = `<div class="empty"><h3>${state.searching ? '没有搜到相关影片' : '没有找到匹配的影片'}</h3><p>${state.searching ? '换个关键词再试试。' : '换个筛选条件再试试。'}</p><button type="button" id="emptyReset">${state.searching ? '清除搜索' : '清除条件'}</button></div>`;
    return;
  }
  grid.classList.remove('is-empty');
  grid.innerHTML = list.map((m, i) => {
    const idx = items.indexOf(m);
    const cover = imgFor(m.posterPath);
    return `<article class="card" data-index="${idx}" tabindex="0" role="button" aria-label="查看《${esc(m.title)}》详情" style="--i:${Math.min(i, 14)}">
      <div class="poster">
        <div class="poster-fallback">${esc(String(m.title || '影').slice(0, 1))}</div>
        ${cover ? `<img src="${esc(cover)}" alt="${esc(m.title)} 海报" loading="lazy">` : ''}
      </div>
      <div class="card-body">
        <h3 class="card-title" title="${esc(m.title)}">${esc(m.title)}</h3>
        <p class="card-date">${esc(dateOf(m))}</p>
      </div>
    </article>`;
  }).join('');
}

function renderPager() {
  const hasMore = Boolean(state.payload.hasMore);
  $('#pager').innerHTML = `
    <button type="button" class="page-btn" data-page="prev" ${state.page <= 1 ? 'disabled' : ''}>← 上一页</button>
    <span class="page-num">第 ${state.page} 页</span>
    <button type="button" class="page-btn" data-page="next" ${hasMore ? '' : 'disabled'}>下一页 →</button>`;
}

/* ---------------- 弹层 ---------------- */
function openModal(html, wide = false) {
  const card = $('#modalCard');
  card.innerHTML = html;
  card.classList.toggle('is-wide', wide);
  $('#modal').classList.add('is-open');
  document.body.classList.add('no-scroll');
}
function closeModal() {
  $('#modal').classList.remove('is-open');
  document.body.classList.remove('no-scroll');
}
function tmdbLink(m) {
  const id = Number(m.tmdbId || m.id);
  if (!id || !['movie', 'tv'].includes(m.mediaType)) return '';
  return `https://www.themoviedb.org/${m.mediaType}/${id}`;
}

function openDetail(m) {
  const landscape = imgFor(m.backdropPath || m.posterPath);
  const tags = coverTags(m);
  const detailUrl = tmdbLink(m);
  openModal(`
    <div class="modal-cover">
      ${landscape ? `<img src="${esc(landscape)}" alt="">` : ''}
      <button class="modal-close" data-close aria-label="关闭">${ICON_X}</button>
      <div class="modal-cover-text">
        <span class="eyebrow">Movie Detail</span>
        <h2>${esc(m.title)}</h2>
        <div class="detail-meta">${ratingHtml(m.rating)}<span>${esc(yearOf(m))}</span></div>
        ${(tags.length || detailUrl) ? `<div class="cover-tags">${tags.map(t => `<span class="cover-tag">${esc(t)}</span>`).join('')}${detailUrl ? `<a class="cover-tag cover-tag--link" href="${esc(detailUrl)}" target="_blank" rel="noopener noreferrer" aria-label="在 TMDB 查看影片详情">TMDB ${ICON_EXT}</a>` : ''}</div>` : ''}
      </div>
    </div>
    <div class="modal-body">
      <p class="detail-desc">${esc(m.description || '暂无简介。')}</p>
    </div>`, true);
}

function openKeyModal() {
  const saved = getLocalKey();
  openModal(`
    <div class="info-body">
      <span class="eyebrow">TMDB API Key</span>
      <h2>请输入 TMDB API Key</h2>
      <p>服务端未检测到 <code>TMDB_API_KEY</code> 环境变量。可在此输入 Key，它会保存在当前浏览器，并随本站同源请求发送给后端；生产部署建议在 Cloudflare 环境变量中配置加密 Secret。</p>
      <form id="keyForm" class="submit-form">
        <label>API Key
          <input name="key" type="text" required autocomplete="off" spellcheck="false" placeholder="32 位 TMDB API Key" value="${esc(saved)}">
        </label>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <button class="btn-primary" type="submit">保存并重新加载</button>
          ${saved ? '<button type="button" class="reset-btn" id="clearKey">清除本地 Key</button>' : ''}
          <button type="button" class="reset-btn" data-close>取消</button>
        </div>
      </form>
      <p style="margin-top:16px"><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">免费申请 TMDB API Key ↗</a></p>
    </div>`);
}

function openAbout() {
  openModal(`
    <div class="info-body">
      <span class="eyebrow">About</span>
      <h2>关于 Makkah导航</h2>
      <p>一个轻量的影视资源聚合导航站。栏目、筛选器与数据映射并不写死在前端，而是由服务端从 <code>lib/MakkaPakka-ALL.js</code> 与 <code>lib/ptjc.js</code> 两份历史数据目录中提取后，通过 <code>/api/modules</code> 下发。</p>
      <ul class="info-list">
        <li>3 个栏目：番剧 / 全球影剧 / 平台片库，支持 <code>belongTo</code> 级联筛选与翻页</li>
        <li>卡片字段沿用历史 <code>buildItem</code> 契约：标题、海报、评分、年份、类型、简介</li>
        <li>数据全部来自 TMDB，Key 由服务端 <code>TMDB_API_KEY</code> 环境变量提供，未配置时可在页面输入</li>
        <li>请求失败时页面显示错误原因并提供重试（顶部徽章可查看状态）</li>
        <li>快捷榜单来自 <code>lib/ptjc.js</code>，点击可直接切换到对应筛选组合</li>
        <li>网站不含播放器，卡片仅用于展示影片信息</li>
      </ul>
      <div class="info-status" style="margin-top:22px">当前状态 <span id="aboutStatus"></span></div>
    </div>
    <div style="padding:0 26px 26px"><button class="btn-primary" data-close>我知道了</button></div>`);
  const el = $('#aboutStatus');
  if (el && state.payload) el.textContent = state.payload.note || (state.payload.source === 'tmdb' ? 'TMDB 实时数据' : '请求失败');
}

/* ---------------- Toast / 主题 ---------------- */
let toastTimer = null;
function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#themeBtn').setAttribute('aria-label', t === 'dark' ? '切换到日间模式' : '切换到夜间模式');
  try { localStorage.setItem('frame-theme', t); } catch (_) { /* 忽略 */ }
}
function syncSearch() {
  const has = $('#search').value.length > 0;
  $('#searchClear').hidden = !has;
  $('.search-wrap kbd').hidden = has;
}

/* ---------------- 事件绑定 ---------------- */
function bindStatic() {
  $('#themeBtn').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  $('#aboutBtn').addEventListener('click', e => { e.preventDefault(); openAbout(); });
  $('#sourceBadge').addEventListener('click', () => {
    if (!hasAnyKey()) { openKeyModal(); return; }
    const note = state.payload && (state.payload.note || (state.payload.source === 'tmdb' ? 'TMDB 实时数据' : '请求失败'));
    showToast(note || '正在连接数据服务…');
  });

  const triggerSearch = () => {
    clearTimeout(state.searchTimer);
    const v = $('#search').value.trim();
    if (!v) { exitSearch(); return; }
    state.searching = true;
    state.searchQuery = v;
    state.page = 1;
    setSearchMode(true, v);
    load();
  };
  $('#search').addEventListener('input', () => {
    syncSearch();
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(triggerSearch, 400);
  });
  $('#search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); triggerSearch(); }
  });
  $('#searchClear').addEventListener('click', () => {
    exitSearch();
    $('#search').focus();
  });

  $('#tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-module]');
    if (tab) applyModule(tab.dataset.module);
  });
  $('#quickRow').addEventListener('click', e => {
    const chip = e.target.closest('[data-quick]');
    if (!chip) return;
    const q = state.quick[Number(chip.dataset.quick)];
    if (q) { applyModule(q.module, q.params); showToast(`已切换到「${q.label}」`); }
  });

  $('#filterGrid').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    onFilterChange(pill.parentElement.dataset.key, pill.dataset.value);
  });
  $('#filterGrid').addEventListener('change', e => {
    if (e.target.matches('select[data-key]')) onFilterChange(e.target.dataset.key, e.target.value);
  });
  $('#resetBtn').addEventListener('click', () => {
    applyModule(state.moduleId);
    showToast('已重置筛选条件');
  });

  $('#grid').addEventListener('click', e => {
    if (e.target.closest('#retryLoad')) { load(); return; }
    const reset = e.target.closest('#emptyReset, #noticeReset');
    if (reset) { applyModule(state.moduleId); return; }
    const card = e.target.closest('.card');
    if (card && state.currentItems[Number(card.dataset.index)]) openDetail(state.currentItems[Number(card.dataset.index)]);
  });
  $('#grid').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.card');
    if (card) { e.preventDefault(); openDetail(state.currentItems[Number(card.dataset.index)]); }
  });

  $('#pager').addEventListener('click', e => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    state.page += btn.dataset.page === 'next' ? 1 : -1;
    load();
    window.scrollTo({ top: $('#grid').offsetTop - 100, behavior: 'smooth' });
  });

  $('#modal').addEventListener('click', e => {
    if (e.target.closest('#clearKey')) {
      setLocalKey('');
      closeModal();
      showToast('已清除本地 Key');
      load();
      return;
    }
    if (e.target === $('#modal') || e.target.closest('[data-close]')) closeModal();
  });
  $('#modal').addEventListener('submit', e => {
    if (e.target.id !== 'keyForm') return;
    e.preventDefault();
    const v = String(new FormData(e.target).get('key') || '').trim();
    if (!v) return;
    setLocalKey(v);
    closeModal();
    showToast('Key 已保存，正在重新加载…');
    load();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#search').focus();
      $('#search').select();
    }
  });
  // 占位图/代理图加载失败时隐藏破图，露出渐变底色与片名首字
  document.addEventListener('error', e => {
    if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden';
  }, true);
}

init();
