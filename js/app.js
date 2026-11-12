/* ============ 本地存储 ============ */
const KEY_SITES = "axc_sites_v1";
const KEY_SETTINGS = "axc_settings_v1";
const KEY_PRICES = "axc_prices_v1";
let REGISTRY = { notice: [], contact: {}, presetGroups: [], presetTags: [], sites: [] };

function defaultSettings() {
  return {
    theme: "morandi",
    wallpaper: { type: "none", value: "", opacity: 0.82 },
    appName: "API小仓库",
    proxyUrl: "", // 代理地址
    groups: ["付费站", "公益站", "有签到", "限制签到", "生图站"],
    tags: ["试吃", "无试吃", "试吃不确定", "需邀请码", "关闭注册", "生图", "视频", "音频", "抗截断", "常用"],
    sortMode: "custom",
    collapsedGroups: [],
    filterCollapsed: true,
    regFilterCollapsed: true
  };
}

const store = {
  getSites() { try { return JSON.parse(localStorage.getItem(KEY_SITES) || "[]"); } catch { return []; } },
  saveSites(sites) { localStorage.setItem(KEY_SITES, JSON.stringify(sites)); },
  getSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY_SETTINGS) || "null");
      if (!s) return defaultSettings();
      return Object.assign(defaultSettings(), s);
    } catch { return defaultSettings(); }
  },
  saveSettings(s) { localStorage.setItem(KEY_SETTINGS, JSON.stringify(s)); },
  getPrices() { try { return JSON.parse(localStorage.getItem(KEY_PRICES) || "[]"); } catch { return []; } },
  savePrices(prices) { localStorage.setItem(KEY_PRICES, JSON.stringify(prices)); }
};

const state = {
  sites: [],
  settings: defaultSettings(),
  modelPrices: [],
  currentTab: "warehouse",
  filterGroup: "all",
  filterTags: [],
  search: "",
  modelSearch: "",
  regFilterGroup: "all",
  regFilterTags: [],
  regCollapsed: []
};

function uid() { return "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr() {
  const d = new Date(); const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
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

async function init() {
  try {
    const res = await fetch('./registry.json');
    if (res.ok) REGISTRY = await res.json();
  } catch (err) {}

  state.settings = store.getSettings();
  state.sites = store.getSites();
  state.modelPrices = store.getPrices();

  const today = todayStr(); let changed = false;
  state.sites.forEach(s => {
    if (s.todayCheckedIn && s.lastCheckinDate !== today) { s.todayCheckedIn = false; changed = true; }
  });
  if (changed) store.saveSites(state.sites);

  applyTheme(); applyWallpaper();
  renderGroupFilter(); renderTagFilter(); renderList(); renderRegistry(); renderModelList();
  updateFilterUI(); updateRegFilterUI(); bindEvents();
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

/* ====== Tab切换 ====== */
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

/* ====== 仓库逻辑 ====== */
function updateFilterUI() { const c = document.getElementById("filterContent"); const t = document.getElementById("filterTitle"); const a = document.getElementById("filterArrow"); if (state.settings.filterCollapsed) { c.style.display = "none"; t.textContent = "筛选与排序（点击展开）"; a.style.transform = "rotate(-90deg)"; } else { c.style.display = "block"; t.textContent = "筛选与排序（点击收起）"; a.style.transform = "rotate(0deg)"; } }
function updateRegFilterUI() { const c = document.getElementById("regFilterContent"); const t = document.getElementById("regFilterTitle"); const a = document.getElementById("regFilterArrow"); if (state.settings.regFilterCollapsed) { c.style.display = "none"; t.textContent = "筛选（点击展开）"; a.style.transform = "rotate(-90deg)"; } else { c.style.display = "block"; t.textContent = "筛选（点击收起）"; a.style.transform = "rotate(0deg)"; } }

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
  });
}

function balanceText(s) {
  let extra = "";
  if (s.balance && s.quotaPerUnit && s.currency) {
    const n = parseFloat(s.balance);
    if (!isNaN(n) && s.quotaPerUnit > 0) extra = `（约 ${(n / s.quotaPerUnit).toFixed(2)} ${s.currency}）`;
  }
  
  if (s.balance) {
    return `<span class="balance">余额 <b>${esc(s.balance)}</b>${esc(extra)}</span> <button class="mini-btn" data-act="fetchBalance" style="padding:2px 5px; font-size:11px;">↻</button>`;
  } else {
    return `<span class="balance">余额 <b>未记录</b></span> <button class="mini-btn" data-act="fetchBalance" style="padding:2px 5px; font-size:11px;">↻ 拉取</button>`;
  }
}
function cardHTML(s) {
  const tags = (s.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("");
  const checkinBtn = s.hasCheckin ? `<button class="mini-btn ${s.todayCheckedIn ? "done" : ""}" data-act="checkin">${s.todayCheckedIn ? "今日已签" : "标记签到"}</button>` : "";
  return `<div class="card ${(s.tags || []).includes("常用") ? "pinned" : ""}" data-id="${esc(s.id)}">
    <div class="card-top">
      <div class="card-name">${(s.tags || []).includes("常用") ? '<span class="pin">☆</span>' : ""}${esc(s.name)}</div>
      <div class="card-actions">${checkinBtn}<button class="mini-btn" data-act="copy">复制</button><button class="mini-btn" data-act="open">打开</button></div>
    </div>
    <div class="card-meta" style="margin-top:8px;"><span>${esc(s.group || "")}</span> ${balanceText(s)}</div>
    ${tags ? `<div class="card-tags">${tags}</div>` : ""}
    ${s.note ? `<div class="card-note">${linkify(s.note)}</div>` : ""}
    <div class="card-meta" style="margin-top:8px;gap:6px"><button class="mini-btn" data-act="edit">编辑</button><button class="mini-btn danger" data-act="delete">删除</button></div>
  </div>`;
}

function openSite(id) { const s = state.sites.find(x => x.id === id); if (!s) return; s.lastOpenedAt = new Date().toISOString(); store.saveSites(state.sites); window.open(s.invite || s.mainUrl, "_blank"); }
function toggleCheckin(id) { const s = state.sites.find(x => x.id === id); if (!s) return; s.todayCheckedIn = !s.todayCheckedIn; if (s.todayCheckedIn) s.lastCheckinDate = todayStr(); store.saveSites(state.sites); renderList(); toast(s.todayCheckedIn ? "已标记今日签到" : "已取消签到标记"); }
function copyInvite(id) { const s = state.sites.find(x => x.id === id); if (!s) return; const text = s.invite || s.mainUrl || ""; if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).then(() => toast("已复制链接")).catch(() => fallbackCopy(text)); } else fallbackCopy(text); }
function fallbackCopy(text) { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("已复制链接"); } catch { toast("复制失败"); } document.body.removeChild(ta); }
function deleteSite(id) { const s = state.sites.find(x => x.id === id); if (!s) return; if (!confirm(`确定删除「${s.name}」？`)) return; state.sites = state.sites.filter(x => x.id !== id); store.saveSites(state.sites); renderList(); toast("已删除"); }

/* ====== 核心：带代理的请求与多平台余额解析 ====== */
async function fetchWithProxy(url, options = {}) {
  const proxy = state.settings.proxyUrl;
  if (proxy) {
    // 如果配置了代理，将目标 URL 拼接进去
    const target = encodeURIComponent(url);
    return fetch(`${proxy}?target=${target}`, options);
  }
  // 没配置代理，直接请求（可能失败）
  return fetch(url, options);
}

async function fetchBalance(id) {
  const s = state.sites.find(x => x.id === id);
  if (!s) return;
  
  const type = s.siteType || "newapi";
  if (type === "manual") return toast("该站点设置为手动模式，请直接编辑填写");
  if (!s.apiEndpoint) return toast("请先在「编辑」中填写 API 端点");
  if (!s.accessToken) return toast("请先在「编辑」中填写 访问令牌");

  toast("正在拉取余额...");
  try {
    let url = s.apiEndpoint.replace(/\/+$/, "");
    let headers = { "Authorization": "Bearer " + s.accessToken };
    
    // 根据不同类型拼接不同路径
    if (type === "newapi") {
      url += "/api/user/self";
      if (s.userId) headers["New-Api-User"] = s.userId;
    } else if (type === "sub2api") {
      url += "/api/v1/auth/me";
    } else if (type === "deepseek") {
      url += "/user/balance";
    } else if (type === "siliconflow") {
      url += "/v1/user/info";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 代理可能稍慢，给8秒
    const res = await fetchWithProxy(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let newBalance = "";

    // 解析返回值
    if (type === "newapi") {
      if (data && data.data && data.data.quota !== undefined) newBalance = String(data.data.quota);
    } else if (type === "sub2api") {
      if (data && data.data && data.data.quota !== undefined) newBalance = String(data.data.quota);
      else if (data && data.quota !== undefined) newBalance = String(data.quota);
    } else if (type === "deepseek") {
      if (data && data.balance_infos && data.balance_infos.length > 0) {
        newBalance = data.balance_infos[0].total_balance;
      }
    } else if (type === "siliconflow") {
      if (data && data.data && data.data.totalBalance !== undefined) newBalance = String(data.data.totalBalance);
      else if (data && data.totalBalance !== undefined) newBalance = String(data.totalBalance);
    }

    if (newBalance !== "") {
      s.balance = newBalance;
      store.saveSites(state.sites);
      renderList();
      toast("余额已成功更新");
    } else {
      throw new Error("未找到余额字段");
    }
  } catch (err) {
    console.error(err);
    toast("拉取失败，请检查代理配置或去站点手动查看");
  }
}

function openSiteForm(id) {
  const editing = id ? state.sites.find(x => x.id === id) : null;
  const s = editing || { name: "", invite: "", group: state.settings.groups[0] || "付费站", tags: [], note: "", hasCheckin: false, todayCheckedIn: false, lastCheckinDate: "", balance: "", quotaPerUnit: "", currency: "", apiEndpoint: "", siteType: "newapi", accessToken: "", userId: "", cnyRate: "" };
  const tagPicker = state.settings.tags.map(t => `<span class="chip ${(s.tags || []).includes(t) ? "active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("");
  
  showModal(`
    <h3>${editing ? "编辑站点" : "添加站点"}</h3>
    <div class="field"><label>站名 *</label><input id="f-name" value="${esc(s.name)}"></div>
    <div class="field"><label>链接 *</label><input id="f-invite" value="${esc(s.invite)}" placeholder="比如签到页或注册链接"></div>
    <div class="field"><label>分组</label><input id="f-group" value="${esc(s.group)}" list="groupList"><datalist id="groupList">${state.settings.groups.map(g => `<option value="${esc(g)}">`).join("")}</datalist></div>
    <div class="field"><label>标签（可多选）</label><div class="tag-picker" id="tagPicker">${tagPicker}</div></div>
    <div class="field"><label>备注</label><textarea id="f-note">${esc(s.note)}</textarea></div>
    <div class="field"><label>是否有签到</label><select id="f-hasCheckin"><option value="0" ${!s.hasCheckin ? "selected" : ""}>否</option><option value="1" ${s.hasCheckin ? "selected" : ""}>是</option></select></div>
    <div class="field"><label>余额</label><input id="f-balance" value="${esc(s.balance)}" placeholder="可手填，也可点刷新自动拉取"></div>
    <div class="field"><label>换算比例（多少 quota = 1 单位）</label><input id="f-quota" value="${esc(s.quotaPerUnit)}" placeholder="可选，如 500000"></div>
    <div class="field"><label>货币单位</label><select id="f-currency"><option value="" ${!s.currency ? "selected" : ""}>不换算</option><option value="USD" ${s.currency === "USD" ? "selected" : ""}>USD</option><option value="CNY" ${s.currency === "CNY" ? "selected" : ""}>CNY</option></select></div>
    
    <div class="field"><label>站点架构类型（用于拉取余额）</label>
      <select id="f-siteType">
        <option value="newapi" ${s.siteType === "newapi" ? "selected" : ""}>New API 体系（大部分中转站）</option>
        <option value="sub2api" ${s.siteType === "sub2api" ? "selected" : ""}>Sub2API 体系</option>
        <option value="deepseek" ${s.siteType === "deepseek" ? "selected" : ""}>DeepSeek 官方</option>
        <option value="siliconflow" ${s.siteType === "siliconflow" ? "selected" : ""}>硅基流动 SiliconFlow</option>
        <option value="manual" ${s.siteType === "manual" ? "selected" : ""}>仅手动记录（不拉取）</option>
      </select>
    </div>
    
    <div class="field"><label>API 端点（用于拉取余额和模型价格）</label><input id="f-api" value="${esc(s.apiEndpoint)}" placeholder="如 https://api.xxx.com"></div>
    <div class="field"><label>人民币换算比例（比价时用）</label><input id="f-cnyRate" value="${esc(s.cnyRate)}" placeholder="比如 1 倍率=1.5元就填 1.5"></div>
    <div class="field"><label>访问令牌（用于自动拉取余额）</label><input id="f-token" value="${esc(s.accessToken)}" placeholder="系统访问令牌"></div>
    <div class="field"><label>用户 ID（仅 New API 需要，可选）</label><input id="f-uid" value="${esc(s.userId)}"></div>
    <div class="btn-row"><button class="btn" id="btnCancel">取消</button><button class="btn primary" id="btnSave">保存</button></div>
  `);
  document.querySelectorAll("#tagPicker .chip").forEach(c => c.onclick = () => c.classList.toggle("active"));
  document.getElementById("btnCancel").onclick = closeModal;
  document.getElementById("btnSave").onclick = () => {
    const name = document.getElementById("f-name").value.trim();
    const invite = document.getElementById("f-invite").value.trim();
    if (!name || !invite) { toast("站名和链接必填"); return; }
    const tags = [...document.querySelectorAll("#tagPicker .chip.active")].map(c => c.dataset.tag);
    const obj = {
      id: s.id || uid(), name, invite, group: document.getElementById("f-group").value.trim() || "其他", tags,
      note: document.getElementById("f-note").value.trim(), hasCheckin: document.getElementById("f-hasCheckin").value === "1",
      todayCheckedIn: s.todayCheckedIn || false, lastCheckinDate: s.lastCheckinDate || "",
      balance: document.getElementById("f-balance").value.trim(), quotaPerUnit: parseFloat(document.getElementById("f-quota").value) || "",
      currency: document.getElementById("f-currency").value, apiEndpoint: document.getElementById("f-api").value.trim(),
      cnyRate: parseFloat(document.getElementById("f-cnyRate").value) || "", accessToken: document.getElementById("f-token").value.trim(),
      siteType: document.getElementById("f-siteType").value,
      userId: document.getElementById("f-uid").value.trim(), sourceId: s.sourceId || null, createdAt: s.createdAt || new Date().toISOString(), lastOpenedAt: s.lastOpenedAt || ""
    };
    if (editing) state.sites = state.sites.map(x => x.id === obj.id ? obj : x); else state.sites.push(obj);
    store.saveSites(state.sites); closeModal(); renderList(); renderRegistry(); toast(editing ? "已保存" : "已添加");
  };
}

/* ====== 模型页与真实拉取逻辑 ====== */
function renderModelList() {
  const wrap = document.getElementById("modelList");
  if (!wrap) return;
  let list = state.modelPrices.slice();
  if (state.modelSearch.trim()) {
    const q = state.modelSearch.trim().toLowerCase();
    list = list.filter(m => m.modelName.toLowerCase().includes(q) || m.siteName.toLowerCase().includes(q));
  }
  list.sort((a, b) => a.cnyPrice - b.cnyPrice);
  if (!list.length) {
    wrap.innerHTML = `<div class="empty">暂无数据<br>点击右上角「更新价格」拉取，或先添加带 API 端点的站点。</div>`;
    return;
  }
  wrap.innerHTML = list.map(m => `
    <div class="model-card" onclick="openModelDrawer('${m.siteId}')">
      <div class="model-info">
        <div class="model-name">${esc(m.modelName)}</div>
        <div class="model-meta">${esc(m.siteName)} ${m.priceType === "倍率" ? `(倍率: ${m.rawPrice})` : ""}</div>
      </div>
      <div class="model-price">￥${m.cnyPrice.toFixed(4)}<span>${m.unit}</span></div>
    </div>
  `).join("");
}

window.openModelDrawer = (siteId) => {
  const s = state.sites.find(x => x.id === siteId);
  if (!s) return;
  const tags = (s.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("");
  document.getElementById("modalBox").innerHTML = `
    <h3>来源站点</h3>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-top"><div class="card-name">${esc(s.name)}</div></div>
      <div class="card-tags">${tags}</div>
      <div class="card-note">${esc(s.note || "暂无备注")}</div>
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn primary" onclick="window.open('${esc(s.invite)}', '_blank')">前往注册 / 登录</button>
        <button class="btn" onclick="navigator.clipboard.writeText('${esc(s.invite)}'); toast('已复制');">复制链接</button>
      </div>
    </div>
    <div class="btn-row"><button class="btn" onclick="closeModal()">关闭</button></div>
  `;
  document.getElementById("modalMask").classList.add("show");
};

document.getElementById("btnFetchPrices").onclick = async () => {
  const sites = state.sites.filter(s => s.apiEndpoint && s.siteType !== "manual" && s.siteType !== "deepseek" && s.siteType !== "siliconflow");
  if (!sites.length) return toast("没有支持拉取价格的中转站（请检查端点或类型）");
  const btn = document.getElementById("btnFetchPrices");
  btn.textContent = "拉取中…"; btn.disabled = true;
  let newPrices = []; let successCount = 0;

  for (const s of sites) {
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
            const rawRatio = item.model_ratio || item.ratio || item.input_price || item.price;
            if (modelName && rawRatio !== undefined) {
              const numRatio = parseFloat(rawRatio);
              if (!isNaN(numRatio)) {
                const rate = s.cnyRate || 1;
                newPrices.push({
                  siteId: s.id, siteName: s.name, modelName: modelName,
                  rawPrice: rawRatio, priceType: item.model_ratio ? "倍率" : "单价",
                  cnyPrice: numRatio * rate, unit: item.model_ratio ? "倍率折合" : "元/百万"
                });
              }
            }
          });
          successCount++;
        }
      }
    } catch (e) { console.warn(`拉取 ${s.name} 失败:`, e); }
  }

  state.modelPrices = newPrices;
  store.savePrices(state.modelPrices);
  renderModelList();
  btn.textContent = "↻ 更新价格"; btn.disabled = false;
  toast(`成功拉取 ${successCount}/${sites.length} 个站点`);
};

document.getElementById("modelSearchInput").oninput = e => { state.modelSearch = e.target.value; renderModelList(); };

/* ====== 收录与设置弹窗 ====== */
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
  if (!REGISTRY.sites || REGISTRY.sites.length === 0) { wrap.innerHTML = `<div class="empty">数据为空，请确认 registry.json 已上传。</div>`; return; }
  if (!list.length) { wrap.innerHTML = `<div class="empty">没有匹配的收录站点</div>`; return; }
  const groups = [...(REGISTRY.presetGroups||[])]; list.forEach(s => { if (s.group && !groups.includes(s.group)) groups.push(s.group); });
  const html = []; groups.forEach(g => { const items = list.filter(s => s.group === g); if (!items.length) return; const collapsed = state.regCollapsed.includes(g); html.push(`<section class="group ${collapsed ? "collapsed" : ""}" data-group="${esc(g)}"><div class="group-head"><span class="arrow">▼</span><span class="gname">${esc(g)}</span><span class="gcount">${items.length}</span></div><div class="group-body">${items.map(regCardHTML).join("")}</div></section>`); });
  wrap.innerHTML = html.join("");
  wrap.querySelectorAll(".group-head").forEach(h => { h.onclick = () => { const sec = h.parentElement; const g = sec.dataset.group; sec.classList.toggle("collapsed"); const set = new Set(state.regCollapsed); if (sec.classList.contains("collapsed")) set.add(g); else set.delete(g); state.regCollapsed = [...set]; }; });
  wrap.querySelectorAll("[data-add]").forEach(btn => { btn.onclick = () => addFromRegistry(btn.dataset.add); });
}
function regCardHTML(s) { const added = state.sites.some(x => x.sourceId === s.id); const tags = (s.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join(""); return `<div class="reg-card"><div class="reg-top"><div class="reg-name">${(s.tags||[]).includes("常用") ? '<span style="color:var(--accent);margin-right:4px;font-size:15px">☆</span>' : ''}${esc(s.name)}</div><button class="mini-btn ${added ? "done" : ""}" data-add="${esc(s.id)}" ${added ? "disabled" : ""}>${added ? "已添加" : "添加"}</button></div><div class="card-tags">${tags}</div><div class="reg-note">${esc(s.group)}｜${linkify(s.note || "")}</div></div>`; }
function addFromRegistry(rid) { const r = REGISTRY.sites.find(s => s.id === rid); if (!r) return; if (state.sites.some(x => x.sourceId === r.id)) { toast("已经添加过了"); return; } let host = ""; try { host = new URL(r.invite).origin; } catch {} const obj = { id: uid(), name: r.name, invite: r.invite, group: r.group, tags: [...(r.tags || [])], note: r.note || "", hasCheckin: ["有签到", "限制签到"].includes(r.group), todayCheckedIn: false, lastCheckinDate: "", balance: "", quotaPerUnit: "", currency: "", apiEndpoint: host ? host : "", siteType: "newapi", cnyRate: "", accessToken: "", userId: "", sourceId: r.id, createdAt: new Date().toISOString(), lastOpenedAt: "" }; state.sites.push(obj); store.saveSites(state.sites); renderList(); renderRegistry(); toast(`已添加「${r.name}」`); }

function openSettings() {
  const s = state.settings; const w = s.wallpaper || { type: "none", value: "", opacity: 0.82 }; const presetColors = ["#e8e4dd","#d4d9d6","#cfd6dc","#e3d8d2","#dcd8d0","#d9d5d0"];
  showModal(`
    <h3>设置</h3>
    <div class="settings-section"><h4>主题</h4><div class="theme-row"><button class="theme-btn ${s.theme !== "mono" ? "active" : ""}" data-theme-btn="morandi">莫兰迪</button><button class="theme-btn ${s.theme === "mono" ? "active" : ""}" data-theme-btn="mono">极简黑白</button></div></div>
    <div class="settings-section"><h4>应用名称</h4><input id="s-appName" value="${esc(s.appName)}" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius);background:#ffffff !important;color:#2d2b28 !important;-webkit-appearance:none;"></div>
    
    <div class="settings-section">
      <h4>网络代理（解决跨域拉取余额）</h4>
      <div class="field"><input id="s-proxyUrl" value="${esc(s.proxyUrl || '')}" placeholder="填入你的 Cloudflare Worker 地址"><div class="hint">不填将无法自动拉取。请自行部署（教程见下方）。</div></div>
    </div>

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
      <div class="hint" style="margin-top:6px">导入会合并到现有站点，同 ID 覆盖。</div>
      <input type="file" id="s-file" accept="application/json" style="display:none">
    </div>
    <div class="btn-row"><button class="btn" id="s-close">关闭</button></div>
  `);
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

function showModal(html) { const mask = document.getElementById("modalMask"); document.getElementById("modalBox").innerHTML = html; mask.classList.add("show"); }
function closeModal() { document.getElementById("modalMask").classList.remove("show"); document.getElementById("modalBox").innerHTML = ""; }
let toastTimer = null;
function toast(msg) { const el = document.getElementById("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 1800); }

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach(n => n.onclick = () => switchTab(n.dataset.tab));
  document.getElementById("btnNotice").onclick = () => {
    let html = `<h3>公告</h3><div class="notice-contact"><b>联系作者</b><br>邮箱：${esc(REGISTRY.contact?.email || "")}<br>QQ：${esc(REGISTRY.contact?.qq || "")}</div>`;
    const notices = (REGISTRY.notice || []).slice().reverse();
    if (notices.length === 0) html += `<div class="empty" style="padding:20px;">暂无公告</div>`;
    else notices.forEach(n => { html += `<div class="notice-card"><div class="notice-header"><span class="notice-title">${esc(n.title)}</span><span class="notice-date">${esc(n.date)}</span></div><div class="notice-content">${linkify(n.content)}</div></div>`; });
    html += `<div class="btn-row"><button class="btn" id="btnCloseNotice">关闭</button></div>`;
    showModal(html); document.getElementById("btnCloseNotice").onclick = closeModal;
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
  const panel = document.getElementById("registryPanel"); const entryBtn = document.getElementById("btnRegistry");
  entryBtn.onclick = () => { panel.hidden = !panel.hidden; if (panel.hidden) entryBtn.classList.remove("open"); else { entryBtn.classList.add("open"); renderRegistry(); } };
  document.getElementById("regClose").onclick = () => { panel.hidden = true; entryBtn.classList.remove("open"); renderRegistry(); };
  document.getElementById("modalMask").onclick = e => { if (e.target.id === "modalMask") closeModal(); };
}

init();
