/* ============ 本地存储 ============ */
const KEY_SITES = "axc_sites_v1";
const KEY_SETTINGS = "axc_settings_v1";
const KEY_PRICES = "axc_prices_v1";
const KEY_READ_NOTICES = "axc_read_notices_v1";
let REGISTRY = { notice: [], contact: [], presetGroups: [], presetTags: [], sites: [] };

function defaultSettings() {
  return {
    theme: "morandi", wallpaper: { type: "none", value: "", opacity: 0.82 },
    appName: "API小仓库", proxyUrl: "", 
    groups: ["付费站", "公益站", "有签到", "限制签到", "生图站"],
    tags: ["试吃", "无试吃", "试吃不确定", "需邀请码", "关闭注册", "生图", "视频", "音频", "抗截断", "常用"],
    sortMode: "custom", collapsedGroups: [], filterCollapsed: true, regFilterCollapsed: true, modelFilterCollapsed: true
  };
}

const store = {
  getSites() { try { return JSON.parse(localStorage.getItem(KEY_SITES) || "[]"); } catch { return []; } },
  saveSites(sites) { localStorage.setItem(KEY_SITES, JSON.stringify(sites)); },
  getSettings() { try { const s = JSON.parse(localStorage.getItem(KEY_SETTINGS) || "null"); return s ? Object.assign(defaultSettings(), s) : defaultSettings(); } catch { return defaultSettings(); } },
  saveSettings(s) { localStorage.setItem(KEY_SETTINGS, JSON.stringify(s)); },
  getPrices() { try { return JSON.parse(localStorage.getItem(KEY_PRICES) || "[]"); } catch { return []; } },
  savePrices(prices) { localStorage.setItem(KEY_PRICES, JSON.stringify(prices)); },
  getReadNotices() { try { return JSON.parse(localStorage.getItem(KEY_READ_NOTICES) || "[]"); } catch { return []; } },
  saveReadNotices(ids) { localStorage.setItem(KEY_READ_NOTICES, JSON.stringify(ids)); }
};

const state = {
  sites: [], settings: defaultSettings(), modelPrices: [], currentTab: "warehouse",
  filterGroup: "all", filterTags: [], search: "", modelSearch: "",
  providerFilter: [], priceTypeFilter: [], siteFilter: [],
  regFilterGroup: "all", regFilterTags: [], regCollapsed: [],
  selectedMyIds: new Set(), selectedRegIds: new Set()
};

function uid() { return "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr() { const d = new Date(); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function linkify(text) {
  if (!text) return "";
  const urlRe = /(https?:\/\/[a-zA-Z0-9\-\._~:\/\?#\[\]@!$&'()*+,;=%]+)/g;
  let result = ""; let lastIndex = 0; let m;
  while ((m = urlRe.exec(text)) !== null) {
    result += esc(text.slice(lastIndex, m.index));
    let url = m[1]; let trailing = "";
    while (/[.,;:!?)]$/.test(url)) {
      if (/[.,;:!?]$/.test(url) || (url.endsWith(")") && !url.includes("("))) { trailing = url.slice(-1) + trailing; url = url.slice(0, -1); } else break;
    }
    result += `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`; result += esc(trailing);
    lastIndex = m.index + m[1].length;
  }
  result += esc(text.slice(lastIndex)); return result;
}

window.copyText = (text) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast("已复制")).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
};
function fallbackCopy(text) { 
  const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); 
  try { document.execCommand("copy"); toast("已复制"); } catch { toast("复制失败"); } 
  document.body.removeChild(ta); 
}

async function init() {
  try { 
    const res = await fetch('./registry.json'); 
    if (res.ok) {
      REGISTRY = await res.json();
      if (REGISTRY.contact && !Array.isArray(REGISTRY.contact)) {
        const newContact = [];
        if (REGISTRY.contact.email) newContact.push({ label: '邮箱', value: REGISTRY.contact.email });
        if (REGISTRY.contact.qq) newContact.push({ label: 'QQ', value: REGISTRY.contact.qq });
        REGISTRY.contact = newContact;
      }
      if (!Array.isArray(REGISTRY.contact)) REGISTRY.contact = [];
    }
  } catch (err) {}

  state.settings = store.getSettings(); state.sites = store.getSites(); state.modelPrices = store.getPrices();
  const today = todayStr(); let changed = false;
  state.sites.forEach(s => { if (s.todayCheckedIn && s.lastCheckinDate !== today) { s.todayCheckedIn = false; changed = true; } });
  if (changed) store.saveSites(state.sites);

  applyTheme(); applyWallpaper();
  renderGroupFilter(); renderTagFilter(); renderList(); renderRegistry(); renderModelList();
  updateFilterUI(); updateRegFilterUI(); updateModelFilterUI(); bindEvents();
  updateNoticeBadge();
}

function updateNoticeBadge() {
  const readList = store.getReadNotices(); let unreadCount = 0;
  (REGISTRY.notice || []).forEach(n => { if (!readList.includes(n.date + "_" + n.title)) unreadCount++; });
  const badge = document.getElementById("noticeBadge");
  if (badge) { if (unreadCount > 0) { badge.textContent = unreadCount; badge.style.display = "inline-block"; } else { badge.style.display = "none"; } }
}

function applyTheme() { document.documentElement.setAttribute("data-theme", state.settings.theme === "mono" ? "mono" : "morandi"); }
function applyWallpaper() {
  const w = state.settings.wallpaper || { type: "none", value: "", opacity: 0.82 };
  const el = document.getElementById("wallpaper");
  let css = "transparent";
  if (w.type === "color" && w.value) css = w.value;
  else if (w.type === "image" && w.value) css = `url("${w.value}") center/cover no-repeat`;
  el.style.background = css;
  document.documentElement.style.setProperty("--card-opacity", String(w.opacity || 0.82));
  const name = state.settings.appName || "API小仓库";
  document.getElementById("appName").textContent = name; document.title = name;
}

window.switchTab = (tab) => {
  state.currentTab = tab;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`page-${tab}`).classList.add("active");
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add("active");
  document.getElementById("searchBar").classList.remove("show");
  if (tab === "warehouse") document.getElementById("btnAdd").style.display = "flex";
  else document.getElementById("btnAdd").style.display = "none";
};

function updateFilterUI() { const c = document.getElementById("filterContent"); const t = document.getElementById("filterTitle"); const a = document.getElementById("filterArrow"); if (state.settings.filterCollapsed) { c.style.display = "none"; t.textContent = "筛选与排序（点击展开）"; a.style.transform = "rotate(-90deg)"; } else { c.style.display = "block"; t.textContent = "筛选与排序（点击收起）"; a.style.transform = "rotate(0deg)"; } }
function updateRegFilterUI() { const c = document.getElementById("regFilterContent"); const t = document.getElementById("regFilterTitle"); const a = document.getElementById("regFilterArrow"); if (state.settings.regFilterCollapsed) { c.style.display = "none"; t.textContent = "筛选（点击展开）"; a.style.transform = "rotate(-90deg)"; } else { c.style.display = "block"; t.textContent = "筛选（点击收起）"; a.style.transform = "rotate(0deg)"; } }
function updateModelFilterUI() { const c = document.getElementById("modelFilterContent"); const t = document.getElementById("modelFilterTitle"); const a = document.getElementById("modelFilterArrow"); if (state.settings.modelFilterCollapsed) { c.style.display = "none"; t.textContent = "筛选（点击展开）"; a.style.transform = "rotate(-90deg)"; } else { c.style.display = "block"; t.textContent = "筛选（点击收起）"; a.style.transform = "rotate(0deg)"; } }

function renderGroupFilter() {
  const wrap = document.getElementById("groupFilter");
  const chips = [`<span class="chip ${state.filterGroup === "all" ? "active" : ""}" data-group="all">全部</span>`];
  state.settings.groups.forEach(g => chips.push(`<span class="chip ${state.filterGroup === g ? "active" : ""}" data-group="${esc(g)}">${esc(g)}</span>`));
  wrap.innerHTML = chips.join("");
  wrap.querySelectorAll(".chip").forEach(c => { c.onclick = () => { state.filterGroup = c.dataset.group; renderGroupFilter(); renderList(); }; });
}
function renderTagFilter() {
  const wrap = document.getElementById("tagFilter");
  wrap.innerHTML = state.settings.tags.map(t => `<span class="chip ${state.filterTags.includes(t) ? "active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("");
  wrap.querySelectorAll(".chip").forEach(c => { c.onclick = () => { const t = c.dataset.tag; const i = state.filterTags.indexOf(t); if (i >= 0) state.filterTags.splice(i, 1); else state.filterTags.push(t); renderTagFilter(); renderList(); }; });
}

function getFilteredSites() {
  let arr = state.sites.slice();
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    arr = arr.filter(s => (s.name||"").toLowerCase().includes(q) || (s.note||"").toLowerCase().includes(q) || (s.invite||"").toLowerCase().includes(q) || (s.group||"").toLowerCase().includes(q) || (s.tags||[]).some(t => t.toLowerCase().includes(q)));
  }
  if (state.filterGroup !== "all") arr = arr.filter(s => s.group === state.filterGroup);
  if (state.filterTags.length) arr = arr.filter(s => state.filterTags.every(t => (s.tags || []).includes(t)));
  return arr;
}
function sortSites(arr) {
  const mode = state.settings.sortMode || "custom";
  const byCommon = (a, b) => ((b.tags||[]).includes("常用")?1:0) - ((a.tags||[]).includes("常用")?1:0);
  const num = v => { const n = parseFloat(v); return isNaN(n) ? -Infinity : n; };
  const sorted = arr.slice();
  if (mode === "name-asc") sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh"));
  else if (mode === "name-desc") sorted.sort((a, b) => (b.name || "").localeCompare(a.name || "", "zh"));
  else if (mode === "balance-desc") sorted.sort((a, b) => num(b.balance) - num(a.balance));
  else if (mode === "balance-asc") sorted.sort((a, b) => num(a.balance) - num(b.balance));
  else if (mode === "recent") sorted.sort((a, b) => (b.lastOpenedAt || "").localeCompare(a.lastOpenedAt || ""));
  else sorted.sort(byCommon);
  return sorted;
}

function renderList() {
  const wrap = document.getElementById("siteList");
  const all = getFilteredSites();
  if (!all.length) { wrap.innerHTML = `<div class="empty">没有匹配的站点</div>`; return; }
  const groups = [...state.settings.groups];
  all.forEach(s => { if (s.group && !groups.includes(s.group)) groups.push(s.group); });
  const html = [];
  groups.forEach(g => {
    const items = sortSites(all.filter(s => s.group === g));
    if (!items.length) return;
    const collapsed = (state.settings.collapsedGroups || []).includes(g);
    html.push(`<section class="group ${collapsed ? "collapsed" : ""}" data-group="${esc(g)}">
      <div class="group-head"><span class="arrow">▼</span><span class="gname">${esc(g)}</span><span class="gcount">${items.length}</span></div>
      <div class="group-body">${items.map(cardHTML).join("")}</div>
    </section>`);
  });
  wrap.innerHTML = html.join("");
  wrap.querySelectorAll(".group-head").forEach(h => {
    h.onclick = () => {
      const sec = h.parentElement; const g = sec.dataset.group; sec.classList.toggle("collapsed");
      const set = new Set(state.settings.collapsedGroups || []);
      if (sec.classList.contains("collapsed")) set.add(g); else set.delete(g);
      state.settings.collapsedGroups = [...set]; store.saveSettings(state.settings);
    };
  });
  wrap.querySelectorAll(".card").forEach(card => {
    const id = card.dataset.id;
    card.querySelector('[data-act="open"]')?.addEventListener("click", () => openSite(id));
    card.querySelector('[data-act="checkin"]')?.addEventListener("click", () => toggleCheckin(id));
    card.querySelector('[data-act="copy"]')?.addEventListener("click", () => copyInvite(id));
    card.querySelector('[data-act="edit"]')?.addEventListener("click", () => openSiteForm(id));
    card.querySelector('[data-act="delete"]')?.addEventListener("click", () => deleteSite(id));
    card.querySelector('[data-act="fetchBalance"]')?.addEventListener("click", () => fetchBalance(id));
    card.querySelector('.checkbox')?.addEventListener("change", (e) => toggleMySelect(id, e.target.checked));
  });
  updateBatchBar();
}

function balanceText(s) {
  let mainAmount = s.balance || "未记录"; let subAmount = "";
  if (s.balance && s.quotaPerUnit && s.currency) {
    const n = parseFloat(s.balance);
    if (!isNaN(n) && s.quotaPerUnit > 0) { mainAmount = (n / s.quotaPerUnit).toFixed(2) + " " + s.currency; subAmount = ` (原始: ${s.balance})`; }
  }
  const btn = s.siteType === "manual" ? "" : `<button class="mini-btn" data-act="fetchBalance" style="padding:2px 5px; font-size:11px; margin-left:4px;">↻</button>`;
  return `<span class="balance">余额 <b>${esc(mainAmount)}</b><span style="font-size:11px;color:#999">${esc(subAmount)}</span>${btn}</span>`;
}
function cardHTML(s) {
  const tags = (s.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("");
  const checkinBtn = s.hasCheckin ? `<button class="mini-btn ${s.todayCheckedIn ? "done" : ""}" data-act="checkin">${s.todayCheckedIn ? "今日已签" : "标记签到"}</button>` : "";
  const checked = state.selectedMyIds.has(s.id) ? "checked" : "";
  return `<div class="card ${(s.tags || []).includes("常用") ? "pinned" : ""} ${checked ? "selected" : ""}" data-id="${esc(s.id)}">
    <div class="card-top">
      <div class="card-name">${(s.tags || []).includes("常用") ? '<span class="pin">☆</span>' : ""}${esc(s.name)}</div>
      <div class="card-actions">
        ${checkinBtn}
        <button class="mini-btn" data-act="copy">复制</button>
        <button class="mini-btn" data-act="open">打开</button>
        <input type="checkbox" class="checkbox" ${checked}>
      </div>
    </div>
    <div class="card-meta" style="margin-top:8px;"><span>${esc(s.group || "")}</span> ${balanceText(s)}</div>
    ${tags ? `<div class="card-tags">${tags}</div>` : ""}
    ${s.note ? `<div class="card-note">${linkify(s.note)}</div>` : ""}
    <div class="card-meta" style="margin-top:8px;gap:6px"><button class="mini-btn" data-act="edit">编辑</button><button class="mini-btn danger" data-act="delete">删除</button></div>
  </div>`;
}

function openSite(id) { const s = state.sites.find(x => x.id === id); if (!s) return; s.lastOpenedAt = new Date().toISOString(); store.saveSites(state.sites); window.open(s.invite || s.mainUrl, "_blank"); }
function toggleCheckin(id) { const s = state.sites.find(x => x.id === id); if (!s) return; s.todayCheckedIn = !s.todayCheckedIn; if (s.todayCheckedIn) s.lastCheckinDate = todayStr(); store.saveSites(state.sites); renderList(); toast(s.todayCheckedIn ? "已标记今日签到" : "已取消签到标记"); }
function copyInvite(id) { const s = state.sites.find(x => x.id === id); if (!s) return; const text = s.invite || s.mainUrl || ""; copyText(text); }
function deleteSite(id) { const s = state.sites.find(x => x.id === id); if (!s) return; if (!confirm(`确定删除「${s.name}」？`)) return; state.sites = state.sites.filter(x => x.id !== id); state.selectedMyIds.delete(id); store.saveSites(state.sites); renderList(); toast("已删除"); }

/* ====== 多选与批量操作逻辑 ====== */
function toggleMySelect(id, isChecked) {
  if (isChecked) state.selectedMyIds.add(id); else state.selectedMyIds.delete(id);
  renderList();
}

document.getElementById("btnSelectAllMy").onclick = () => {
  const visibleSites = getFilteredSites();
  if (visibleSites.length === 0) return;
  const allSelected = visibleSites.every(s => state.selectedMyIds.has(s.id));
  visibleSites.forEach(s => {
    if (allSelected) state.selectedMyIds.delete(s.id);
    else state.selectedMyIds.add(s.id);
  });
  renderList();
};

document.getElementById("btnClearSel").onclick = () => { state.selectedMyIds.clear(); renderList(); };

function updateBatchBar() {
  const bar = document.getElementById("batchBar");
  const count = state.selectedMyIds.size;
  document.getElementById("selCount").textContent = count;
  if (count > 0) bar.classList.add("show"); else bar.classList.remove("show");
}

document.getElementById("btnOpenBatch").onclick = () => {
  const groups = state.settings.groups.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  const tags = state.settings.tags.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  showModal(`
    <h3>批量操作 (已选 ${state.selectedMyIds.size} 项)</h3>
    <div class="field"><label>更换分组</label><select id="b-group"><option value="">-- 不修改 --</option>${groups}</select></div>
    <div class="field"><label>更换标签</label><select id="b-tag"><option value="">-- 不修改 --</option>${tags}</select>
      <label class="check-row"><input type="checkbox" id="b-keepTags"> 保留原有标签（不勾选则覆盖）</label>
    </div>
    <div class="field"><label>签到状态</label>
      <select id="b-checkin"><option value="">-- 不修改 --</option><option value="yes">标记为：有签到</option><option value="no">标记为：无签到</option><option value="done">标记为：今日已签</option></select>
    </div>
    <div class="btn-row" style="margin-top:20px;">
      <button class="btn" id="b-copy">复制选中邀请链接</button>
      <button class="btn primary" id="b-apply">确认应用</button>
    </div>
  `);
  
  document.getElementById("b-copy").onclick = () => {
    let text = "";
    state.sites.forEach(s => {
      if (state.selectedMyIds.has(s.id)) {
        const link = s.shareLink || s.invite || s.mainUrl;
        if(link) text += `【${s.name}】\n${link}\n\n`;
      }
    });
    if(!text) return toast("选中站点没有填写链接");
    copyText(text.trim());
    closeModal(); state.selectedMyIds.clear(); renderList();
  };

  document.getElementById("b-apply").onclick = () => {
    const g = document.getElementById("b-group").value;
    const t = document.getElementById("b-tag").value;
    const keep = document.getElementById("b-keepTags").checked;
    const c = document.getElementById("b-checkin").value;

    state.sites.forEach(s => {
      if (!state.selectedMyIds.has(s.id)) return;
      if (g) s.group = g;
      if (t) { if (keep) { if (!s.tags.includes(t)) s.tags.push(t); } else { s.tags = [t]; } }
      if (c === "yes") s.hasCheckin = true;
      if (c === "no") s.hasCheckin = false;
      if (c === "done") { s.hasCheckin = true; s.todayCheckedIn = true; s.lastCheckinDate = todayStr(); }
    });
    store.saveSites(state.sites); closeModal(); state.selectedMyIds.clear(); renderList(); toast("批量应用完成");
  };
};

/* ====== 核心：拉取逻辑 ====== */
async function fetchWithProxy(url, options = {}) {
  const proxy = state.settings.proxyUrl;
  if (proxy) { return fetch(`${proxy}?target=${encodeURIComponent(url)}`, options); }
  return fetch(url, options);
}

async function fetchBalance(id) {
  const s = state.sites.find(x => x.id === id); if (!s) return;
  const type = s.siteType || "newapi";
  if (type === "manual") return toast("该站点设置为手动模式，请直接编辑填写");
  if (!s.apiEndpoint) return toast("请先在「编辑」中填写 API 端点");
  if (!s.accessToken) return toast("请先在「编辑」中填写 访问令牌");
  toast("正在拉取余额...");
  try {
    let url = s.apiEndpoint.replace(/\/+$/, ""); let headers = { "Authorization": "Bearer " + s.accessToken };
    if (type === "newapi") { url += "/api/user/self"; if (s.userId) headers["New-Api-User"] = s.userId; }
    else if (type === "sub2api") { url += "/api/v1/auth/me"; }
    else if (type === "deepseek") { url += "/user/balance"; }
    else if (type === "siliconflow") { url += "/v1/user/info"; }
    const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetchWithProxy(url, { headers, signal: controller.signal }); clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json(); let newBalance = "";
    if (type === "newapi") { if (data?.data?.quota !== undefined) newBalance = String(data.data.quota); }
    else if (type === "sub2api") { if (data?.data?.quota !== undefined) newBalance = String(data.data.quota); else if (data?.quota !== undefined) newBalance = String(data.quota); }
    else if (type === "deepseek") { if (data?.balance_infos?.length > 0) newBalance = data.balance_infos[0].total_balance; }
    else if (type === "siliconflow") { if (data?.data?.totalBalance !== undefined) newBalance = String(data.data.totalBalance); else if (data?.totalBalance !== undefined) newBalance = String(data.totalBalance); }
    if (newBalance !== "") { s.balance = newBalance; store.saveSites(state.sites); renderList(); toast("余额已成功更新"); }
    else throw new Error("未找到余额字段");
  } catch (err) { console.error(err); toast("拉取失败！请先检查是否开启了网络代理，或检查你的 Worker 代理是否正常。"); }
}

function openSiteForm(id) {
  const editing = id ? state.sites.find(x => x.id === id) : null;
  const s = editing || { name: "", invite: "", shareLink: "", group: state.settings.groups[0] || "付费站", tags: [], note: "", hasCheckin: false, todayCheckedIn: false, lastCheckinDate: "", balance: "", quotaPerUnit: "500000", currency: "CNY", apiEndpoint: "", siteType: "newapi", accessToken: "", userId: "", modelRatio: "1" };
  const tagPicker = state.settings.tags.map(t => `<span class="chip ${(s.tags || []).includes(t) ? "active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("");
  
  showModal(`
    <h3>${editing ? "编辑站点" : "添加站点"}</h3>
    <div class="field"><label>站名 *</label><input id="f-name" value="${esc(s.name)}"></div>
    <div class="field"><label>主链接 *</label><input id="f-invite" value="${esc(s.invite)}" placeholder="用于自己跳转（首页或签到页）"></div>
    <div class="field"><label>分享邀请链接（可选）</label><input id="f-shareLink" value="${esc(s.shareLink||'')}" placeholder="用于批量复制分享给别人"></div>
    <div class="field"><label>分组</label><input id="f-group" value="${esc(s.group)}" list="groupList"><datalist id="groupList">${state.settings.groups.map(g => `<option value="${esc(g)}">`).join("")}</datalist></div>
    <div class="field"><label>标签（可多选）</label><div class="tag-picker" id="tagPicker">${tagPicker}</div></div>
    <div class="field"><label>备注</label><textarea id="f-note">${esc(s.note)}</textarea></div>
    <div class="field"><label>是否有签到</label><select id="f-hasCheckin"><option value="0" ${!s.hasCheckin ? "selected" : ""}>否</option><option value="1" ${s.hasCheckin ? "selected" : ""}>是</option></select></div>
    <div class="field"><label>站点架构类型（用于拉取余额）</label><select id="f-siteType"><option value="newapi" ${s.siteType === "newapi" ? "selected" : ""}>New API 体系</option><option value="sub2api" ${s.siteType === "sub2api" ? "selected" : ""}>Sub2API 体系</option><option value="deepseek" ${s.siteType === "deepseek" ? "selected" : ""}>DeepSeek 官方</option><option value="siliconflow" ${s.siteType === "siliconflow" ? "selected" : ""}>硅基流动</option><option value="manual" ${s.siteType === "manual" ? "selected" : ""}>仅手动记录</option></select></div>
    <div class="field"><label>API 端点</label><input id="f-api" value="${esc(s.apiEndpoint)}" placeholder="如 https://api.xxx.com"></div>
    <div class="field"><label>访问令牌</label><input id="f-token" value="${esc(s.accessToken)}" placeholder="系统访问令牌"></div>
    <div class="field"><label>用户 ID (New API需要)</label><input id="f-uid" value="${esc(s.userId)}"></div>
    <div class="field"><label>余额</label><input id="f-balance" value="${esc(s.balance)}" placeholder="可手填，也可点刷新自动拉取"></div>
    <div class="field"><label>换算比例（1额度＝？quota）</label><input id="f-quota" value="${esc(s.quotaPerUnit)}" placeholder="默认 500000"></div>
    <div class="field"><label>货币单位</label><select id="f-currency"><option value="" ${!s.currency ? "selected" : ""}>不换算</option><option value="USD" ${s.currency === "USD" ? "selected" : ""}>USD</option><option value="CNY" ${s.currency === "CNY" ? "selected" : ""}>CNY</option></select></div>
    <div class="field"><label>人民币换算比例（1额度＝？人民币）</label><input id="f-ratio" value="${esc(s.modelRatio)}" placeholder="默认 1"></div>
    <div style="text-align:center; margin: 16px 0 10px;"><a href="javascript:void(0)" id="btnTutorialFromForm" style="color:var(--accent); font-size:13px; text-decoration:none;">👉 不知道怎么填？点此查看换算教程</a></div>
    <div class="btn-row"><button class="btn" id="btnCancel">取消</button><button class="btn primary" id="btnSave">保存</button></div>
  `);
  
  document.getElementById("btnTutorialFromForm").onclick = showTutorial;
  document.querySelectorAll("#tagPicker .chip").forEach(c => c.onclick = () => c.classList.toggle("active"));
  document.getElementById("btnCancel").onclick = closeModal;
  document.getElementById("btnSave").onclick = () => {
    const name = document.getElementById("f-name").value.trim();
    const invite = document.getElementById("f-invite").value.trim();
    if (!name || !invite) { toast("站名和主链接必填"); return; }
    const tags = [...document.querySelectorAll("#tagPicker .chip.active")].map(c => c.dataset.tag);
    const obj = {
      id: s.id || uid(), name, invite, shareLink: document.getElementById("f-shareLink").value.trim(), 
      group: document.getElementById("f-group").value.trim() || "其他", tags, note: document.getElementById("f-note").value.trim(), 
      hasCheckin: document.getElementById("f-hasCheckin").value === "1", todayCheckedIn: s.todayCheckedIn || false, lastCheckinDate: s.lastCheckinDate || "",
      balance: document.getElementById("f-balance").value.trim(), quotaPerUnit: parseFloat(document.getElementById("f-quota").value) || 500000, 
      currency: document.getElementById("f-currency").value, apiEndpoint: document.getElementById("f-api").value.trim(), modelRatio: parseFloat(document.getElementById("f-ratio").value) || 1, 
      accessToken: document.getElementById("f-token").value.trim(), siteType: document.getElementById("f-siteType").value, userId: document.getElementById("f-uid").value.trim(), 
      sourceId: s.sourceId || null, createdAt: s.createdAt || new Date().toISOString(), lastOpenedAt: s.lastOpenedAt || ""
    };
    if (editing) state.sites = state.sites.map(x => x.id === obj.id ? obj : x); else state.sites.push(obj);
    store.saveSites(state.sites); closeModal(); renderList(); renderRegistry(); toast(editing ? "已保存" : "已添加");
  };
}

/* ====== 收录站点多选与拉取 ====== */
function regCardHTML(s) { 
  const added = state.sites.some(x => x.sourceId === s.id); 
  const tags = (s.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join(""); 
  const checked = state.selectedRegIds.has(s.id) ? "checked" : "";
  return `<div class="reg-card" data-id="${esc(s.id)}" style="cursor:pointer">
    <div class="reg-top">
      <div class="reg-name">${(s.tags||[]).includes("常用") ? '<span style="color:var(--accent);margin-right:4px;font-size:15px">☆</span>' : ''}${esc(s.name)}</div>
      <div class="card-actions">
        <button class="mini-btn ${added ? "done" : ""}" data-add="${esc(s.id)}" ${added ? "disabled" : ""}>${added ? "已添加" : "添加"}</button>
        <input type="checkbox" class="checkbox" data-regcheck="${esc(s.id)}" ${checked}>
      </div>
    </div>
    <div class="card-tags">${tags}</div>
    <div class="reg-note">${esc(s.group)}｜${linkify(s.note || "")}</div>
  </div>`; 
}

function renderRegGroupFilter() { const wrap = document.getElementById("regGroupFilter"); if(!wrap) return; const chips = [`<span class="chip ${state.regFilterGroup === "all" ? "active" : ""}" data-group="all">全部</span>`]; (REGISTRY.presetGroups||[]).forEach(g => chips.push(`<span class="chip ${state.regFilterGroup === g ? "active" : ""}" data-group="${esc(g)}">${esc(g)}</span>`)); wrap.innerHTML = chips.join(""); wrap.querySelectorAll(".chip").forEach(c => { c.onclick = () => { state.regFilterGroup = c.dataset.group; renderRegGroupFilter(); renderRegistry(); }; }); }
function renderRegTagFilter() { const wrap = document.getElementById("regTagFilter"); if(!wrap) return; wrap.innerHTML = (REGISTRY.presetTags||[]).map(t => `<span class="chip ${state.regFilterTags.includes(t) ? "active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join(""); wrap.querySelectorAll(".chip").forEach(c => { c.onclick = () => { const t = c.dataset.tag; const i = state.regFilterTags.indexOf(t); if (i >= 0) state.regFilterTags.splice(i, 1); else state.regFilterTags.push(t); renderRegTagFilter(); renderRegistry(); }; }); }

function renderRegistry() {
  if(!document.getElementById("regList")) return;
  renderRegGroupFilter(); renderRegTagFilter();
  let list = (REGISTRY.sites || []).slice();
  if (state.search.trim()) { const q = state.search.trim().toLowerCase(); list = list.filter(s => (s.name||"").toLowerCase().includes(q) || (s.note||"").toLowerCase().includes(q) || (s.tags||[]).some(t => t.toLowerCase().includes(q))); }
  if (state.regFilterGroup !== "all") list = list.filter(s => s.group === state.regFilterGroup);
  if (state.regFilterTags.length) list = list.filter(s => state.regFilterTags.every(t => (s.tags || []).includes(t)));
  
  const entryBtn = document.getElementById("btnRegistry");
  if (!document.getElementById("registryPanel").hidden) entryBtn.textContent = "收起收录站点";
  else if (state.search.trim()) entryBtn.textContent = `收录站点（匹配 ${list.length} 个，点击展开）`;
  else entryBtn.textContent = "收录站点（点击展开）";
  
  const wrap = document.getElementById("regList");
  if (!list.length) { wrap.innerHTML = `<div class="empty">没有匹配的收录站点</div>`; return; }
  
  const groups = [...(REGISTRY.presetGroups||[])]; list.forEach(s => { if (s.group && !groups.includes(s.group)) groups.push(s.group); });
  const html = []; groups.forEach(g => { const items = list.filter(s => s.group === g); if (!items.length) return; const collapsed = state.regCollapsed.includes(g); html.push(`<section class="group ${collapsed ? "collapsed" : ""}" data-group="${esc(g)}"><div class="group-head"><span class="arrow">▼</span><span class="gname">${esc(g)}</span><span class="gcount">${items.length}</span></div><div class="group-body">${items.map(regCardHTML).join("")}</div></section>`); });
  wrap.innerHTML = html.join("");
  
  wrap.querySelectorAll(".group-head").forEach(h => { h.onclick = () => { const sec = h.parentElement; const g = sec.dataset.group; sec.classList.toggle("collapsed"); const set = new Set(state.regCollapsed); if (sec.classList.contains("collapsed")) set.add(g); else set.delete(g); state.regCollapsed = [...set]; }; });
  
  wrap.querySelectorAll(".reg-card").forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest("button") || e.target.closest(".checkbox")) return;
      const id = card.dataset.id; const r = REGISTRY.sites.find(s => s.id === id);
      if (r && r.invite) window.open(r.invite, "_blank");
    };
  });
  
  wrap.querySelectorAll("[data-add]").forEach(btn => { btn.onclick = () => addFromRegistry(btn.dataset.add); });
  wrap.querySelectorAll(".checkbox[data-regcheck]").forEach(cb => {
    cb.onchange = (e) => {
      const id = cb.dataset.regcheck;
      if(e.target.checked) state.selectedRegIds.add(id); else state.selectedRegIds.delete(id);
    };
  });
}

document.getElementById("btnSelectAllReg").onclick = () => {
  let list = (REGISTRY.sites || []).slice();
  if (state.search.trim()) { const q = state.search.trim().toLowerCase(); list = list.filter(s => (s.name||"").toLowerCase().includes(q) || (s.note||"").toLowerCase().includes(q) || (s.tags||[]).some(t => t.toLowerCase().includes(q))); }
  if (state.regFilterGroup !== "all") list = list.filter(s => s.group === state.regFilterGroup);
  if (state.regFilterTags.length) list = list.filter(s => state.regFilterTags.every(t => (s.tags || []).includes(t)));
  
  if(list.length === 0) return;
  const allSelected = list.every(s => state.selectedRegIds.has(s.id));
  list.forEach(s => { if(allSelected) state.selectedRegIds.delete(s.id); else state.selectedRegIds.add(s.id); });
  renderRegistry();
};

document.getElementById("btnBatchAddReg").onclick = () => {
  if(state.selectedRegIds.size === 0) return toast("请先勾选要添加的站点");
  let count = 0;
  state.selectedRegIds.forEach(id => {
    const r = REGISTRY.sites.find(s => s.id === id);
    if(r && !state.sites.some(x => x.sourceId === r.id)) { addFromRegistry(id); count++; }
  });
  state.selectedRegIds.clear();
  renderRegistry();
  toast(`成功添加 ${count} 个站点到我的站点`);
};

function addFromRegistry(rid) {
  const r = REGISTRY.sites.find(s => s.id === rid); if (!r) return;
  if (state.sites.some(x => x.sourceId === r.id)) { toast("已经添加过了"); return; }
  let host = ""; try { host = new URL(r.invite).origin; } catch {}
  const obj = { id: uid(), name: r.name, invite: r.invite, shareLink: "", group: r.group, tags: [...(r.tags || [])], note: r.note || "", hasCheckin: ["有签到", "限制签到"].includes(r.group), todayCheckedIn: false, lastCheckinDate: "", balance: "", quotaPerUnit: "500000", currency: "CNY", apiEndpoint: host ? host : "", siteType: "newapi", modelRatio: "1", accessToken: "", userId: "", sourceId: r.id, createdAt: new Date().toISOString(), lastOpenedAt: "" };
  state.sites.push(obj); store.saveSites(state.sites); renderList(); renderRegistry();
}

/* ====== 模型页与拉取逻辑 ====== */
function getProvider(modelName) {
  const n = (modelName || "").toLowerCase();
  if (n.includes("gpt") || n.includes("dall-e") || n.includes("whisper")) return "OpenAI";
  if (n.includes("claude")) return "Anthropic";
  if (n.includes("gemini") || n.includes("palm")) return "Google";
  if (n.includes("llama")) return "Meta";
  if (n.includes("qwen")) return "通义千问";
  if (n.includes("glm")) return "智谱";
  if (n.includes("deepseek")) return "DeepSeek";
  return "其他";
}

function renderProviderFilter() {
  const wrap = document.getElementById("providerFilter"); if(!wrap) return;
  const providers = ["全部", "OpenAI", "Anthropic", "Google", "Meta", "通义千问", "智谱", "DeepSeek", "其他"];
  wrap.innerHTML = providers.map(p => `<span class="chip ${state.providerFilter.includes(p) || (p==="全部" && state.providerFilter.length===0) ? "active" : ""}" data-p="${p}">${p}</span>`).join("");
  wrap.querySelectorAll(".chip").forEach(c => { c.onclick = () => { const p = c.dataset.p; if (p === "全部") state.providerFilter = []; else { const idx = state.providerFilter.indexOf(p); if (idx >= 0) state.providerFilter.splice(idx, 1); else state.providerFilter.push(p); } renderProviderFilter(); renderModelList(); }; });
}

function renderPriceTypeFilter() {
  const wrap = document.getElementById("priceTypeFilter"); if(!wrap) return;
  const types = ["全部", "按次", "按量"];
  wrap.innerHTML = types.map(t => `<span class="chip ${state.priceTypeFilter.includes(t) || (t==="全部" && state.priceTypeFilter.length===0) ? "active" : ""}" data-t="${t}">${t}</span>`).join("");
  wrap.querySelectorAll(".chip").forEach(c => { c.onclick = () => { const t = c.dataset.t; if (t === "全部") state.priceTypeFilter = []; else { const idx = state.priceTypeFilter.indexOf(t); if (idx >= 0) state.priceTypeFilter.splice(idx, 1); else state.priceTypeFilter.push(t); } renderPriceTypeFilter(); renderModelList(); }; });
}

function renderSiteFilter() {
  const wrap = document.getElementById("siteFilter"); if(!wrap) return;
  const siteNames = [...new Set(state.modelPrices.map(m => m.siteName))];
  if (siteNames.length === 0) { wrap.innerHTML = `<div style="font-size:12px;color:#999;">暂无站点数据</div>`; return; }
  const chips = [`<span class="chip ${state.siteFilter.length === 0 ? "active" : ""}" data-s="all">全选</span>`];
  siteNames.forEach(s => chips.push(`<span class="chip ${state.siteFilter.includes(s) ? "active" : ""}" data-s="${esc(s)}">${esc(s)}</span>`));
  wrap.innerHTML = chips.join("");
  wrap.querySelectorAll(".chip").forEach(c => { c.onclick = () => { const s = c.dataset.s; if (s === "all") state.siteFilter = []; else { const idx = state.siteFilter.indexOf(s); if (idx >= 0) state.siteFilter.splice(idx, 1); else state.siteFilter.push(s); } renderSiteFilter(); renderModelList(); }; });
}

function renderModelList() {
  const wrap = document.getElementById("modelList"); if (!wrap) return;
  renderProviderFilter(); renderPriceTypeFilter(); renderSiteFilter();
  let list = state.modelPrices.slice();
  if (state.modelSearch.trim()) { const q = state.modelSearch.trim().toLowerCase(); list = list.filter(m => (m.modelName||"").toLowerCase().includes(q) || (m.siteName||"").toLowerCase().includes(q)); }
  if (state.providerFilter.length) list = list.filter(m => state.providerFilter.includes(getProvider(m.modelName)));
  if (state.siteFilter.length) list = list.filter(m => state.siteFilter.includes(m.siteName));
  if (state.priceTypeFilter.length) list = list.filter(m => state.priceTypeFilter.includes(m.priceType));
  list.sort((a, b) => (a.cnyPrice || 0) - (b.cnyPrice || 0));
  if (!list.length) { wrap.innerHTML = `<div class="empty">暂无数据<br>点击右上角「更新价格」拉取，或更改筛选条件。</div>`; return; }
  
  wrap.innerHTML = list.map(m => {
    let html = `<div class="model-card" onclick="openModelDrawer('${m.siteId}')">
      <div class="model-info">
        <div class="model-name">${esc(m.modelName)}</div>
        <div class="model-meta">${esc(m.siteName)} | ${m.priceType}</div>
      </div>
      <div class="model-price" style="text-align:right;">`;
    if (m.priceType === "按量") {
      html += `输入: ￥${(m.cnyInput || 0).toFixed(4)} / 1M<br>输出: ￥${(m.cnyOutput || 0).toFixed(4)} / 1M<br><span style="font-size:11px;color:#999;font-weight:normal;">(额度: ${m.rawInput.toFixed(2)} / ${m.rawOutput.toFixed(2)})</span>`;
    } else {
      html += `￥${(m.cnyInput || 0).toFixed(4)} / 次<br><span style="font-size:11px;color:#999;font-weight:normal;">(额度: ${m.rawInput})</span>`;
    }
    html += `</div></div>`;
    return html;
  }).join("");
}

window.openModelDrawer = (siteId) => {
  const s = state.sites.find(x => x.id === siteId); if (!s) return;
  const tags = (s.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("");
  showModal(`
    <h3>来源站点</h3>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-top"><div class="card-name">${esc(s.name)}</div></div>
      <div class="card-tags">${tags}</div>
      <div class="card-note">${esc(s.note || "暂无备注")}</div>
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn primary" onclick="window.open('${esc(s.invite)}', '_blank')">前往注册 / 登录</button>
        <button class="btn" onclick="copyText('${esc(s.invite)}')">复制链接</button>
      </div>
    </div>
    <div class="btn-row"><button class="btn" onclick="closeModal()">关闭</button></div>
  `);
};

window.openFetchPricesDrawer = () => {
  const groups = [...new Set(state.sites.map(s => s.group))].filter(Boolean);
  
  showModal(`
    <h3>更新价格</h3>
    <div style="margin-bottom:12px; display:flex; gap:8px;">
      <button class="btn" style="flex:1; padding:6px; font-size:13px;" id="btnFetchAll">全选</button>
      <button class="btn" style="flex:1; padding:6px; font-size:13px;" id="btnFetchNone">取消</button>
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-size:12px; color:var(--text-2); margin-bottom:6px;">按分组快捷选择</div>
      <div class="chip-row" id="fetchGroupChips">
        ${groups.map(g => `<span class="chip" data-group="${esc(g)}">${esc(g)}</span>`).join("")}
      </div>
    </div>
    
    <div style="max-height:40vh; overflow-y:auto; margin-bottom:12px; background:#fff; border:1.5px solid var(--border); border-radius:var(--radius); padding:0 12px;" id="fetchSiteList">
      ${state.sites.map(s => `
        <label style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px dashed #eee; cursor:pointer;">
          <input type="checkbox" class="f-check" value="${s.id}" checked style="width:16px; height:16px; accent-color:var(--accent);">
          <span style="font-size:14px; flex:1;">${esc(s.name)} <span style="color:var(--text-2); font-size:12px;">(${esc(s.group||'未分组')})</span></span>
        </label>
      `).join("")}
    </div>

    <div style="font-size:12px; color:var(--danger); background:#fdf5f5; padding:8px; border-radius:4px; margin-bottom:12px; line-height:1.5;">
      💡 提示：部分站点可能因接口限制或网络问题导致拉取失败。更新失败将保留原有数据；更新成功但返回空列表，则会清空该站旧数据。
    </div>

    <div class="btn-row" style="margin-top:0;">
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn primary" id="btnExecuteFetch">开始更新</button>
    </div>
  `);

  document.getElementById("btnFetchAll").onclick = () => {
    document.querySelectorAll(".f-check").forEach(cb => cb.checked = true);
  };
  document.getElementById("btnFetchNone").onclick = () => {
    document.querySelectorAll(".f-check").forEach(cb => cb.checked = false);
  };

  document.querySelectorAll("#fetchGroupChips .chip").forEach(chip => {
    chip.onclick = () => {
      const g = chip.dataset.group;
      state.sites.filter(s => s.group === g).forEach(s => {
        const cb = document.querySelector(`.f-check[value="${s.id}"]`);
        if(cb) cb.checked = true;
      });
    };
  });

  document.getElementById("btnExecuteFetch").onclick = () => {
    const selectedIds = [];
    document.querySelectorAll(".f-check:checked").forEach(cb => {
      selectedIds.push(cb.value);
    });
    if (!selectedIds.length) return toast("请至少选择一个站点");
    executeFetchPrices(selectedIds);
  };
};

window.executeFetchPrices = async (selectedIds) => {
  closeModal();
  const sitesToFetch = state.sites.filter(s => selectedIds.includes(s.id));
  
  const btn = document.getElementById("btnFetchPrices"); 
  btn.textContent = "拉取中…"; btn.disabled = true;
  
  let newPrices = []; 
  let successIds = [];
  let failCount = 0;

  for (const s of sitesToFetch) {
    if (!s.apiEndpoint || ["manual", "deepseek", "siliconflow"].includes(s.siteType)) {
      failCount++;
      continue;
    }
    
    try {
      const url = s.apiEndpoint.replace(/\/+$/, "") + "/api/pricing";
      const controller = new AbortController(); 
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetchWithProxy(url, { signal: controller.signal }); 
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json(); 
        const items = data.data || data.models || data;
        if (Array.isArray(items)) {
          items.forEach(item => {
            const modelName = item.model_name || item.model || item.id; 
            if(!modelName) return;
            const mRatio = parseFloat(item.model_ratio || item.ratio) || 0;
            const cRatio = parseFloat(item.completion_ratio) || mRatio;
            const mPrice = parseFloat(item.model_price || item.price);
            const rate = s.modelRatio || 1;
            
            if (mRatio > 0) {
              const rawIn = mRatio * 2; 
              const rawOut = rawIn * cRatio; 
              newPrices.push({ siteId: s.id, siteName: s.name, modelName, priceType: "按量", rawInput: rawIn, rawOutput: rawOut, cnyInput: rawIn * rate, cnyOutput: rawOut * rate, cnyPrice: rawIn * rate });
            } else if (!isNaN(mPrice)) {
              newPrices.push({ siteId: s.id, siteName: s.name, modelName, priceType: "按次", rawInput: mPrice, rawOutput: 0, cnyInput: mPrice * rate, cnyOutput: 0, cnyPrice: mPrice * rate });
            }
          });
          successIds.push(s.id);
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    } catch (e) { 
      console.warn(`拉取 ${s.name} 失败:`, e); 
      failCount++;
    }
  }

  // ==== 合并数据逻辑 ====
  const remainPrices = state.modelPrices.filter(p => !successIds.includes(p.siteId));
  state.modelPrices = [...remainPrices, ...newPrices];
  
  store.savePrices(state.modelPrices); 
  renderModelList();
  
  btn.textContent = "↻ 更新价格"; btn.disabled = false;
  
  if (failCount > 0) {
    toast(`更新完成！成功 ${successIds.length} 个，失败/跳过 ${failCount} 个`);
  } else {
    toast(`成功更新 ${successIds.length} 个站点价格`);
  }
};

document.getElementById("btnFetchPrices").onclick = () => {
  if (!state.sites.length) return toast("你还没有添加任何站点");
  openFetchPricesDrawer();
};

document.getElementById("modelSearchInput").oninput = e => { state.modelSearch = e.target.value; renderModelList(); };

/* ====== 设置与弹窗 ====== */
function openSettings() {
  const s = state.settings; const w = s.wallpaper || { type: "none", value: "", opacity: 0.82 }; const presetColors = ["#e8e4dd","#d4d9d6","#cfd6dc","#e3d8d2","#dcd8d0","#d9d5d0"];
  const appVersion = "v1.1.1"; 
  const cacheVersion = "v1.1.1"; 
  
  showModal(`
    <h3>设置</h3>
    <div class="settings-section"><h4>主题</h4><div class="theme-row"><button class="theme-btn ${s.theme !== "mono" ? "active" : ""}" data-theme-btn="morandi">莫兰迪</button><button class="theme-btn ${s.theme === "mono" ? "active" : ""}" data-theme-btn="mono">极简黑白</button></div></div>
    <div class="settings-section"><h4>应用名称</h4><input id="s-appName" value="${esc(s.appName)}" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius);background:#ffffff !important;color:#2d2b28 !important;-webkit-appearance:none;"></div>
    <div class="settings-section"><h4>网络代理（解决跨域拉取余额）</h4><div class="field"><input id="s-proxyUrl" value="${esc(s.proxyUrl || '')}" placeholder="填入你的 Cloudflare Worker 地址"><div class="hint">不填将无法自动拉取。<a href="javascript:void(0)" id="btnShowTutorial" style="color:var(--accent)">点此查看免费配置教程</a></div></div></div>
    <div class="settings-section">
      <h4>壁纸</h4>
      <div class="field"><label>类型</label><select id="s-wallType"><option value="none" ${w.type === "none" ? "selected" : ""}>无</option><option value="color" ${w.type === "color" ? "selected" : ""}>纯色</option><option value="image" ${w.type === "image" ? "selected" : ""}>图片 URL / 本地上传</option></select></div>
      <div class="field" id="colorField" style="display:${w.type === "color" ? "block" : "none"}"><label>选颜色（点预设或自选）</label><div class="color-row"><input type="color" id="s-wallColor" value="${/^#[0-9a-fA-F]{6}$/.test(w.value || "") ? w.value : "#e8e4dd"}"><div class="preset-colors" id="presetColors">${presetColors.map(c => `<div class="preset-color" data-color="${c}" style="background:${c}" title="${c}"></div>`).join("")}</div></div></div>
      <div class="field" id="valueField" style="display:${w.type === "image" ? "block" : "none"}"><label>图片链接（或者是点下方按钮上传）</label><input id="s-wallValue" value="${esc(w.value && !w.value.startsWith('data:') ? w.value : '')}" placeholder="https://..."><div style="margin-top:8px"><input type="file" id="s-wallFile" accept="image/*" style="display:none"><button class="btn" style="width:100%;padding:8px;font-size:13px" onclick="document.getElementById('s-wallFile').click()">从相册选择图片上传</button></div></div>
      <div class="wall-preview" id="wallPreview"></div>
      <div class="field"><label>卡片不透明度：<span id="opVal">${Math.round((w.opacity || 0.82) * 100)}%</span></label><input type="range" id="s-opacity" min="40" max="100" value="${Math.round((w.opacity || 0.82) * 100)}" style="width:100%"></div>
    </div>
    <div class="settings-section">
      <h4>数据</h4>
      <div class="btn-row" style="margin-top:0"><button class="btn" id="s-export">导出存档</button><button class="btn" id="s-import">导入存档</button></div>
      <label class="check-row"><input type="checkbox" id="s-exportTokens"> 导出时包含访问令牌（分享存档前请取消勾选）</label>
      <input type="file" id="s-file" accept="application/json" style="display:none">
    </div>
    
    <div style="text-align:center; font-size:11px; color:var(--text-2); margin-top:20px; opacity:0.7; line-height:1.8;">
      API小仓库 ${appVersion} (缓存:${cacheVersion})<br>
      设计者：<span onclick="showContactModal()" style="color:var(--accent); cursor:pointer; text-decoration:underline;">漆岐</span>
    </div>
    
    <div class="btn-row"><button class="btn" id="s-close">关闭</button></div>
  `);
  
  document.getElementById("btnShowTutorial").onclick = showTutorial;
  document.querySelectorAll("[data-theme-btn]").forEach(b => { b.onclick = () => { s.theme = b.dataset.themeBtn; store.saveSettings(s); applyTheme(); openSettings(); }; });
  document.getElementById("s-appName").oninput = e => { s.appName = e.target.value || "API小仓库"; store.saveSettings(s); applyWallpaper(); };
  document.getElementById("s-proxyUrl").oninput = e => { s.proxyUrl = e.target.value.trim(); store.saveSettings(s); };
  
  const preview = () => { const type = document.getElementById("s-wallType").value; const opacity = parseInt(document.getElementById("s-opacity").value, 10) / 100; let value = ""; if (type === "color") { value = document.getElementById("s-wallColor").value; } else if (type === "image") { value = document.getElementById("s-wallValue").value.trim(); if (!value && s.wallpaper.type === "image" && s.wallpaper.value.startsWith('data:')) value = s.wallpaper.value; } s.wallpaper = { type, value, opacity }; store.saveSettings(s); applyWallpaper(); const pv = document.getElementById("wallPreview"); let css = "transparent"; if (type === "color") css = value || "transparent"; else if (type === "image") css = value ? `url("${value}") center/cover no-repeat` : "transparent"; pv.style.background = css; };
  const typeSel = document.getElementById("s-wallType"); typeSel.onchange = () => { const t = typeSel.value; document.getElementById("colorField").style.display = t === "color" ? "block" : "none"; document.getElementById("valueField").style.display = t === "image" ? "block" : "none"; preview(); };
  const colorInput = document.getElementById("s-wallColor"); colorInput.oninput = preview; colorInput.onchange = preview; document.querySelectorAll("#presetColors .preset-color").forEach(el => { el.onclick = () => { colorInput.value = el.dataset.color; preview(); }; });
  document.getElementById("s-wallValue").oninput = preview;
  document.getElementById("s-wallFile").onchange = e => { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { const img = new Image(); img.onload = () => { const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d"); const MAX = 1280; let w = img.width, h = img.height; if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } } canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h); let q = 0.7; let d = canvas.toDataURL("image/jpeg", q); while (d.length > 400000 && q > 0.3) { q -= 0.1; d = canvas.toDataURL("image/jpeg", q); } document.getElementById("s-wallValue").value = d; preview(); }; img.src = ev.target.result; }; reader.readAsDataURL(file); };
  document.getElementById("s-opacity").oninput = e => { document.getElementById("opVal").textContent = e.target.value + "%"; preview(); }; preview();
  document.getElementById("s-export").onclick = () => { const includeTokens = document.getElementById("s-exportTokens").checked; const sites = state.sites.map(x => { const copy = { ...x }; if (!includeTokens) { copy.accessToken = ""; copy.userId = ""; } return copy; }); const data = { app: "API小仓库", version: 1, exportedAt: new Date().toISOString(), includesTokens: includeTokens, settings: s, sites }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "api-xiaocangku-backup-" + todayStr() + ".json"; a.click(); URL.revokeObjectURL(a.href); toast(includeTokens ? "已导出（含令牌）" : "已导出（不含令牌）"); };
  document.getElementById("s-import").onclick = () => document.getElementById("s-file").click();
  document.getElementById("s-file").onchange = e => { const f = e.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data.sites)) throw new Error("格式不对"); if (!confirm(`导入 ${data.sites.length} 个站点，合并到现有列表？`)) return; data.sites.forEach(x => { if (!x.id) x.id = uid(); const idx = state.sites.findIndex(y => y.id === x.id); if (idx >= 0) state.sites[idx] = x; else state.sites.push(x); }); if (data.settings) { state.settings = Object.assign(state.settings, data.settings); store.saveSettings(state.settings); } store.saveSites(state.sites); closeModal(); applyTheme(); applyWallpaper(); renderGroupFilter(); renderTagFilter(); renderList(); renderRegistry(); toast("导入完成"); } catch (err) { toast("导入失败：" + err.message); } }; reader.readAsText(f); };
  document.getElementById("s-close").onclick = closeModal;
}

function getContactHtml() {
  let html = '';
  if (Array.isArray(REGISTRY.contact)) {
    REGISTRY.contact.forEach(c => {
      if (!c.label || !c.value) return;
      let valHtml = '';
      if (c.value.startsWith('http://') || c.value.startsWith('https://')) {
        valHtml = `<a href="${esc(c.value)}" target="_blank">${esc(c.value)}</a> <button class="mini-btn" onclick="copyText('${esc(c.value)}')" style="padding:0 4px; font-size:11px;">复制</button>`;
      } else {
        valHtml = `${esc(c.value)} <button class="mini-btn" onclick="copyText('${esc(c.value)}')" style="padding:0 4px; font-size:11px;">复制</button>`;
      }
      html += `<div style="margin-bottom:4px;"><span style="color:var(--text-2);">${esc(c.label)}：</span>${valHtml}</div>`;
    });
  }
  return html;
}

window.showContactModal = () => {
  const html = getContactHtml();
  showModal(`
    <h3>联系作者（设计者：漆岐）</h3>
    <div style="font-size:13px; line-height:1.8; margin-bottom:16px;">
      ${html || '<div style="color:#999;">暂未配置联系方式</div>'}
    </div>
    <div class="btn-row"><button class="btn" onclick="closeModal()">关闭</button></div>
  `);
};

function showTutorial() {
  showModal(`
    <h3>使用教程</h3>
    <div style="display:flex; gap:8px; margin-bottom:16px;">
      <button class="btn primary" style="flex:1; font-size:13px;" onclick="document.getElementById('tut1').style.display='block';document.getElementById('tut2').style.display='none';">余额与比例</button>
      <button class="btn" style="flex:1; font-size:13px;" onclick="document.getElementById('tut1').style.display='none';document.getElementById('tut2').style.display='block';">配置免费代理</button>
    </div>
    <div id="tut1" style="font-size:13px; line-height:1.6; color:var(--text-2);">
      <div style="color:#b57b7b; background:#fdf5f5; padding:8px; border-radius:6px; margin-bottom:12px; font-size:12px;">⚠️ 注意：本工具的自动拉取余额和拉取模型功能依赖 Cloudflare 代理。由于网络环境限制，点击刷新拉取时，请务必确保开启了网络代理。如果未开启导致拉取失败，请直接在上方编辑框中手动填写余额。</div>
      <b>一、余额换算：用于首页显示真实余额</b><br>中转站接口返回的余额数据通常是底层的“Quota（配额）”，数值极大。需要通过除法将其转换为真实的金额。<br>1. <b>默认情况</b>：大多数标准站点的换算比例默认为 500000（即 1 额度 = 500000 quota）。<br>2. <b>自定义计算</b>：如果拉取的金额与实际不符，请使用以下公式自行计算：<br><code>接口拉取的原始 Quota ÷ 网页显示的真实金额 = 换算比例</code><br>*(例如：接口拉回 74737，网页实际余额为 1976.43 元，则 74737 ÷ 1976.43 ＝ 37.814。此时在“换算比例”填入 37.814 即可。此比例仅用于让首页卡片显示正确的余额金额。)*<br><br>
      <b>二、模型单价换算：用于模型比价</b><br>在“模型”页面中，接口拉取到的模型价格通常是“站点自定义额度”（如：12额度/次）或“倍率”（如：倍率 600）。需要通过乘法将其折算为人民币。<br>1. <b>自定义额度计算</b>：参考站点的充值比例。如果充值 0.5 元可获得 100 额度，说明 1 额度 = 0.005 元。在“人民币换算比例”中填入 0.005，系统会将 12额度/次 自动计算为 0.06 元。<br>2. <b>倍率计算</b>：大部分站点的标准倍率换算为 1 倍率 = 0.002 元。填入 0.002 即可。<br>*(此比例仅用于模型比价页面的价格排序。)*
    </div>
    <div id="tut2" style="display:none; font-size:13px; line-height:1.6; color:var(--text-2);">
      <div style="color:#b57b7b; background:#fdf5f5; padding:8px; border-radius:6px; margin-bottom:12px; font-size:12px;">⚠️ 注意：注册和配置 Cloudflare Worker 的过程中，请确保你的网络代理处于开启状态，否则可能无法正常访问其控制台或无法部署成功。</div>
      <p>由于浏览器的跨域安全限制，前端网页无法直接拉取其他站点的余额。你需要免费配置一个 Cloudflare Worker 作为中转代理。</p>
      <b>【第一步：注册并创建 Worker】</b><br>1. 访问并登录 Cloudflare 官网 (dash.cloudflare.com)。<br>2. 在左侧菜单栏找到并点击 “Workers & Pages”。<br><img src="https://1435398813yutang-blip.github.io/tuchuang/%E4%BB%A3%E7%90%861.jpg" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid var(--border);"><br>3. 点击 “Create application” 按钮，选择 “Create Worker”。<br><img src="https://1435398813yutang-blip.github.io/tuchuang/%E4%BB%A3%E7%90%862.jpg" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid var(--border);"><br><img src="https://1435398813yutang-blip.github.io/tuchuang/%E4%BB%A3%E7%90%863.jpg" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid var(--border);"><br>4. 保持默认或随便起一个名字（例如 my-proxy），点击 “Deploy” 部署。<br><img src="https://1435398813yutang-blip.github.io/tuchuang/%E4%BB%A3%E7%90%864.jpg" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid var(--border);"><br><br>
      <b>【第二步：粘贴代理代码】</b><br>1. 部署完成后，点击页面上的 “Edit code” 按钮进入代码编辑界面。<br><img src="https://1435398813yutang-blip.github.io/tuchuang/%E4%BB%A3%E7%90%865.jpg" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid var(--border);"><br>2. 将左侧代码框里默认的代码全部删除。<br>3. 复制下方提供的代理代码，粘贴进去，然后点击右上角的 “Save and deploy” 部署。<br><img src="https://1435398813yutang-blip.github.io/tuchuang/%E4%BB%A3%E7%90%866.jpg" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid var(--border);"><br>
      <div style="background:#2d2b28; color:#fff; padding:10px; border-radius:6px; font-family:monospace; font-size:11px; overflow-x:auto; white-space:pre; margin:8px 0;">export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*' } });
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('target');
    if (!targetUrl) return new Response('Missing', { status: 400 });
    const modifiedRequest = new Request(targetUrl, request);
    modifiedRequest.headers.delete('Origin'); modifiedRequest.headers.delete('Referer');
    try {
      const response = await fetch(modifiedRequest);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      return newResponse;
    } catch (e) { return new Response(e.message, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }); }
  }
};</div><br>
      <b>【第三步：填入代理地址】</b><br>部署成功后，页面上方会显示一个类似 https://xxx.workers.dev 的网址。<br>1. 复制这个网址。<br><img src="https://1435398813yutang-blip.github.io/tuchuang/%E4%BB%A3%E7%90%867.jpg" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid var(--border);"><br>2. 回到 API小仓库的 “设置” 页面。<br>3. 将网址粘贴到 “网络代理” 输入框中，保存即可。
    </div>
    <div class="btn-row"><button class="btn" onclick="closeModal()">关闭</button></div>
  `);
}

function showModal(html) { const mask = document.getElementById("modalMask"); document.getElementById("modalBox").innerHTML = html; mask.classList.add("show"); }
function closeModal() { document.getElementById("modalMask").classList.remove("show"); document.getElementById("modalBox").innerHTML = ""; }
let toastTimer = null;
function toast(msg) { const el = document.getElementById("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 1800); }

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach(n => n.onclick = () => switchTab(n.dataset.tab));
  document.getElementById("btnNotice").onclick = () => {
    const readList = store.getReadNotices();
    const contactHtml = getContactHtml();
    
    let html = `<h3>公告</h3>`;
    
    if (contactHtml) {
      html += `
        <div class="notice-contact" style="padding:0; overflow:hidden; margin-bottom:12px;">
          <div id="contactToggle" style="padding:12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
            <b style="font-size:13px; color:var(--text);">联系方式（点击展开）</b>
            <span id="contactArrow" style="font-size:10px; color:var(--text-2); transition:transform 0.2s; transform:rotate(-90deg);">▼</span>
          </div>
          <div id="contactBody" style="display:none; padding:0 12px 12px 12px; border-top:1px dashed var(--border);">
            <div style="margin-top:8px;">${contactHtml}</div>
          </div>
        </div>
      `;
    }

    let notices = (REGISTRY.notice || []).slice();
    notices.sort((a, b) => {
      const pinA = a.isPinned ? 1 : 0;
      const pinB = b.isPinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      return (b.date || "").localeCompare(a.date || "");
    });
    const newReadList = [...readList];
    if (notices.length === 0) html += `<div class="empty" style="padding:20px;">暂无公告</div>`;
    else notices.forEach(n => { 
      const pinHtml = n.isPinned ? '<span style="background:var(--danger);color:#fff;font-size:10px;padding:2px 4px;border-radius:4px;">置顶</span>' : '';
      const noticeId = n.date + "_" + n.title;
      const isRead = readList.includes(noticeId);
      if (!isRead) newReadList.push(noticeId);
      const expandedClass = isRead ? "" : "expanded";
      html += `<div class="notice-card ${expandedClass}" data-id="${esc(noticeId)}"><div class="notice-header"><div class="left-part">${pinHtml}<span class="notice-title">${esc(n.title)}</span></div><div style="display:flex; align-items:center; gap:8px;"><span class="notice-date">${esc(n.date)}</span><span class="notice-arrow">▼</span></div></div><div class="notice-content">${linkify(n.content)}</div></div>`; 
    });
    html += `<div class="btn-row"><button class="btn" id="btnCloseNotice">关闭</button></div>`;
    showModal(html); 
    
    if (document.getElementById("contactToggle")) {
      document.getElementById("contactToggle").onclick = () => {
        const body = document.getElementById("contactBody");
        const arrow = document.getElementById("contactArrow");
        if (body.style.display === "none") {
          body.style.display = "block";
          arrow.style.transform = "rotate(0deg)";
        } else {
          body.style.display = "none";
          arrow.style.transform = "rotate(-90deg)";
        }
      };
    }

    document.querySelectorAll(".notice-header").forEach(header => { header.onclick = () => { header.parentElement.classList.toggle("expanded"); }; });
    store.saveReadNotices(newReadList);
    document.getElementById("noticeBadge").style.display = "none";
    document.getElementById("btnCloseNotice").onclick = closeModal;
  };
  document.getElementById("btnSearch").onclick = () => { const bar = document.getElementById("searchBar"); bar.classList.toggle("show"); if (bar.classList.contains("show")) document.getElementById("searchInput").focus(); };
  document.getElementById("btnCloseSearch").onclick = () => { document.getElementById("searchBar").classList.remove("show"); document.getElementById("searchInput").value = ""; state.search = ""; renderList(); renderRegistry(); };
  document.getElementById("searchInput").oninput = e => { state.search = e.target.value; renderList(); renderRegistry(); };
  document.getElementById("btnSettings").onclick = openSettings;
  document.getElementById("btnAdd").onclick = () => openSiteForm(null);
  document.getElementById("sortSelect").value = state.settings.sortMode || "custom";
  document.getElementById("sortSelect").onchange = e => { state.settings.sortMode = e.target.value; store.saveSettings(state.settings); renderList(); };
  document.getElementById("filterToggle").onclick = () => { state.settings.filterCollapsed = !state.settings.filterCollapsed; store.saveSettings(state.settings); updateFilterUI(); };
  document.getElementById("regFilterToggle").onclick = () => { state.settings.regFilterCollapsed = !state.settings.regFilterCollapsed; store.saveSettings(state.settings); updateRegFilterUI(); };
  document.getElementById("modelFilterToggle").onclick = () => { state.settings.modelFilterCollapsed = !state.settings.modelFilterCollapsed; store.saveSettings(state.settings); updateModelFilterUI(); };
  const panel = document.getElementById("registryPanel"); const entryBtn = document.getElementById("btnRegistry");
  entryBtn.onclick = () => { panel.hidden = !panel.hidden; if (panel.hidden) entryBtn.classList.remove("open"); else { entryBtn.classList.add("open"); renderRegistry(); } };
  document.getElementById("regClose").onclick = () => { panel.hidden = true; entryBtn.classList.remove("open"); renderRegistry(); };
  document.getElementById("modalMask").onclick = e => { if (e.target.id === "modalMask") closeModal(); };
}

init();
