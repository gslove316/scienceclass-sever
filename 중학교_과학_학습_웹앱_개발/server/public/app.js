(function () {
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const FIELD_META = {
  "물리": { cls: "f-physics", icon: '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z"/>' },
  "화학": { cls: "f-chem", icon: '<path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7 15h10"/>' },
  "지구과학": { cls: "f-earth", icon: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>' },
  "생물": { cls: "f-bio", icon: '<path d="M12 2C7 7 7 13 12 22c5-9 5-15 0-20Z"/><path d="M12 6v12"/>' }
};
const fieldIconSvg = f => {
  const inner = FIELD_META[f]?.icon || '<circle cx="12" cy="12" r="9"/>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
};
const fieldCls = f => FIELD_META[f]?.cls || "f-all";

let title = "애림쌤의 신나는 과학교실";
let items = [];
let admin = false;
let token = "";
let selectedGrade = 0;
let selectedField = "";

try { token = sessionStorage.getItem("erim-server-token") || ""; } catch { }

async function api(url, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", "Bearer " + token);
  if (opts.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res;
  try {
    res = await fetch(url, { ...opts, headers, cache: "no-store" });
  } catch {
    $("#offline").classList.remove("hidden");
    throw new Error("서버에 연결하지 못했습니다.");
  }
  $("#offline").classList.add("hidden");
  let body;
  try { body = await res.json(); } catch { throw new Error("서버 응답을 확인하지 못했습니다."); }
  if (!res.ok) throw new Error(body.error || "처리하지 못했습니다.");
  return body;
}

function setTitle(t) {
  title = t;
  document.title = t;
  $("#brandTitle").textContent = t;
  $("#footTitle").textContent = t + " · 반짝반짝 호기심 충전소";
}

async function refreshState() {
  const state = await api("/api/state");
  setTitle(state.title);
  items = state.items;
}

function visibleItems() {
  const q = $("#search").value.trim().toLowerCase();
  const grade = admin ? Number($("#adminGrade").value) : selectedGrade;
  const field = admin ? $("#adminField").value : selectedField;
  return items
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter(a => (!grade || Number(a.grade) === grade)
      && (!field || a.field === field)
      && (!q || ((a.title || "") + " " + (a.description || "")).toLowerCase().includes(q)));
}

function render() {
  const ready = admin || !!selectedGrade;
  const q = $("#search").value.trim();
  const list = visibleItems();

  $("#adminBar").classList.toggle("hidden", !admin);
  $("#adminFilters").classList.toggle("hidden", !admin);
  $("#hero").classList.toggle("hidden", admin);
  $("#gradeBlock").classList.toggle("hidden", admin);
  $("#fieldBlock").classList.toggle("hidden", admin);
  $("#studentViewBtn").classList.toggle("hidden", !admin);
  $("#lockBtn").classList.toggle("admin-on", admin);
  $("#lockBtn").setAttribute("aria-label", admin ? "관리자 모드 사용 중" : "관리자 페이지 열기");
  $("#sortHint").classList.toggle("hidden", !admin || !!q);

  $$("[data-grade]").forEach(b => {
    const on = Number(b.dataset.grade) === selectedGrade;
    b.classList.toggle("selected", on); b.setAttribute("aria-pressed", on);
  });
  $$("#fieldGrid [data-field]").forEach(b => {
    const on = b.dataset.field === selectedField;
    b.classList.toggle("selected", on); b.setAttribute("aria-pressed", on);
    b.disabled = !selectedGrade && !admin;
  });

  $("#search").disabled = !ready;
  $("#clearSearch").classList.toggle("hidden", !q);

  $("#listTitle").textContent = admin
    ? "등록된 수업 자료"
    : selectedGrade ? selectedGrade + "학년 " + (selectedField || "전체") + " 수업 자료" : "수업 자료";
  $("#count").textContent = ready ? list.length : 0;
  $("#searchHint").textContent = admin
    ? "관리 필터 안에서 제목과 안내를 검색합니다."
    : selectedGrade ? selectedGrade + "학년 · " + (selectedField || "전체 분야") + " 안에서 검색해요." : "학년을 먼저 골라 보세요!";

  const cards = $("#cards");
  if (!ready) { cards.innerHTML = emptyBox("🧪", "나의 학년에서 시작해요", "위에서 1·2·3학년 중 나의 학년을 콕 골라 주세요."); return; }
  if (!list.length) {
    cards.innerHTML = admin
      ? emptyBox("➕", "아직 등록된 자료가 없어요", "오른쪽 위 ‘수업 항목 추가’ 버튼으로 자료를 등록해 보세요.")
      : emptyBox("🔍", "조건에 맞는 자료가 없어요", "검색어를 지우거나 다른 분야를 골라 보세요.");
    return;
  }

  cards.innerHTML = list.map((a, idx) => {
    const cls = fieldCls(a.field);
    const isExternal = a.type === "link" && a.url;
    const href = isExternal ? esc(a.url) : "#";
    const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ' data-view="' + esc(a.id) + '"';
    const arrow = isExternal
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    const sortRow = admin ? (
      '<div class="sort-row">' +
      '<button class="btn sm" type="button" data-move="-1" data-id="' + esc(a.id) + '" aria-label="앞으로 이동" ' + (idx === 0 ? "disabled" : "") + '>←</button>' +
      '<button class="btn sm" type="button" data-move="1" data-id="' + esc(a.id) + '" aria-label="뒤로 이동" ' + (idx === list.length - 1 ? "disabled" : "") + '>→</button>' +
      '</div>'
    ) : "";
    const adminRow = admin ? (
      '<div class="card-admin">' +
      '<button class="btn sm" type="button" data-edit="' + esc(a.id) + '">수정</button>' +
      '<button class="btn sm danger" type="button" data-del="' + esc(a.id) + '">삭제</button>' +
      '</div>'
    ) : "";
    return '<article class="card ' + cls + '" data-card="' + esc(a.id) + '">' +
      sortRow +
      '<div class="card-icon" aria-hidden="true">' + fieldIconSvg(a.field) + '</div>' +
      '<div class="ctag"><b>' + Number(a.grade) + '학년</b> · ' + esc(a.field || "분야 미지정") + '</div>' +
      '<h3>' + esc(a.title) + '</h3>' +
      '<p>' + esc(a.description || "수업 자료를 열어 학습을 시작하세요.") + '</p>' +
      '<a class="go" href="' + href + '"' + target + '>수업 자료 열기 ' + arrow + '</a>' +
      adminRow +
      '</article>';
  }).join("");
}
function emptyBox(icon, t, d) {
  return '<div class="empty"><div class="ei">' + esc(icon) + '</div><h3>' + esc(t) + '</h3><p>' + esc(d) + '</p></div>';
}

function openContent(a) {
  const w = window.open("", "_blank");
  if (!w) { toast("팝업이 차단되었습니다. 허용 후 다시 시도하세요."); return; }
  const doc =
    '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(a.title) + '</title>' +
    '<style>body{margin:0;font:17px/1.75 "Pretendard","Noto Sans KR",system-ui,sans-serif;color:#4a2c5a;background:#fff5fb;font-weight:600}' +
    '.wrap{max-width:760px;margin:auto;padding:40px 24px 80px}' +
    '.badge{display:inline-block;font-size:13px;font-weight:900;color:#ff4e9b;background:#ffe7f2;border:2px solid #ffd0e6;border-radius:999px;padding:6px 15px;margin-bottom:16px}' +
    'h1{font-size:30px;font-weight:900;letter-spacing:-.8px;margin:0 0 20px}' +
    '.content{background:#fff;border:3px solid #fff;border-radius:22px;padding:28px;white-space:pre-wrap;box-shadow:0 12px 28px rgba(255,126,182,.18);font-weight:700;color:#7a5a8c}' +
    'footer{margin-top:28px;font-size:13px;font-weight:700;color:#a98fb8}</style></head><body>' +
    '<div class="wrap"><span class="badge">' + Number(a.grade) + '학년 · ' + esc(a.field) + '</span>' +
    '<h1>' + esc(a.title) + '</h1>' +
    '<div class="content">' + esc(a.content || a.description || "등록된 내용이 없습니다.") + '</div>' +
    '<footer>' + esc(title) + ' · 2022 개정 교육과정 비상교육 기반</footer></div></body></html>';
  w.document.write(doc); w.document.close();
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

$("#gradeGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-grade]"); if (!b) return;
  selectedGrade = Number(b.dataset.grade);
  selectedField = "";
  $("#search").value = "";
  try { sessionStorage.setItem("erim-grade", selectedGrade); } catch { }
  render();
});
$("#fieldGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-field]"); if (!b || b.disabled) return;
  selectedField = b.dataset.field;
  render();
});
$("#search").addEventListener("input", render);
$("#clearSearch").addEventListener("click", () => { $("#search").value = ""; render(); });
$("#adminGrade").addEventListener("change", render);
$("#adminField").addEventListener("change", render);

$("#cards").addEventListener("click", async e => {
  const view = e.target.closest("[data-view]");
  if (view) { e.preventDefault(); const a = items.find(x => x.id === view.dataset.view); if (a) openContent(a); return; }
  if (!admin) return;
  const mover = e.target.closest("[data-move]");
  if (mover) { await moveItem(mover.dataset.id, Number(mover.dataset.move)); return; }
  const ed = e.target.closest("[data-edit]");
  if (ed) { openItemDlg(items.find(x => x.id === ed.dataset.edit)); return; }
  const del = e.target.closest("[data-del]");
  if (del) {
    const a = items.find(x => x.id === del.dataset.del);
    if (a && confirm("‘" + a.title + "’ 수업 자료를 삭제할까요?")) {
      try { await api("/api/items/" + a.id, { method: "DELETE" }); await refreshState(); render(); toast("수업 자료를 삭제했어요."); }
      catch (err) { toast(err.message); }
    }
  }
});

async function moveItem(id, dir) {
  const list = visibleItems();
  const idx = list.findIndex(x => x.id === id);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= list.length) return;
  const ids = list.map(x => x.id);
  [ids[idx], ids[j]] = [ids[j], ids[idx]];
  try { await api("/api/order", { method: "PUT", body: JSON.stringify({ ids }) }); await refreshState(); render(); toast("순서를 저장했어요."); }
  catch (err) { toast(err.message); }
}

$("#lockBtn").addEventListener("click", () => {
  if (admin) { enterAdmin(); return; }
  $("#loginErr").textContent = ""; $("#pwInput").value = "";
  $("#loginDlg").showModal();
  setTimeout(() => $("#pwInput").focus(), 50);
});
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const r = await api("/api/login", { method: "POST", body: JSON.stringify({ password: $("#pwInput").value }) });
    token = r.token;
    try { sessionStorage.setItem("erim-server-token", token); } catch { }
    $("#pwInput").value = "";
    $("#loginDlg").close();
    enterAdmin();
    toast("관리자 모드로 입장했어요.");
  } catch (err) { $("#loginErr").textContent = err.message; }
});
function enterAdmin() { admin = true; $("#search").value = ""; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
$("#studentViewBtn").addEventListener("click", () => { admin = false; $("#search").value = ""; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
$("#logoutBtn").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); } catch { }
  token = ""; try { sessionStorage.removeItem("erim-server-token"); } catch { }
  admin = false; $("#search").value = ""; render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  toast("관리자 모드를 종료했어요.");
});

$("#titleBtn").addEventListener("click", () => {
  $("#titleErr").textContent = ""; $("#titleInput").value = title;
  $("#titleDlg").showModal();
  setTimeout(() => $("#titleInput").focus(), 50);
});
$("#titleForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const r = await api("/api/title", { method: "PUT", body: JSON.stringify({ title: $("#titleInput").value }) });
    setTitle(r.title);
    $("#titleDlg").close();
    toast("제목을 변경했어요.");
  } catch (err) { $("#titleErr").textContent = err.message; }
});

$("#pwBtn").addEventListener("click", () => { $("#pwForm").reset(); $("#pwErr").textContent = ""; $("#pwDlg").showModal(); });
$("#pwForm").addEventListener("submit", async e => {
  e.preventDefault();
  const current = $("#curPw").value, n1 = $("#newPw").value, n2 = $("#newPw2").value;
  if (n1.length < 4) { $("#pwErr").textContent = "새 비밀번호는 4자 이상이어야 합니다."; return; }
  if (n1 !== n2) { $("#pwErr").textContent = "새 비밀번호가 서로 일치하지 않습니다."; return; }
  try {
    await api("/api/password", { method: "PUT", body: JSON.stringify({ current, next: n1 }) });
    $("#pwDlg").close();
    toast("비밀번호를 변경했어요.");
  } catch (err) { $("#pwErr").textContent = err.message; }
});

let editingId = null;
let itemMode = "link";
function setItemMode(m) {
  itemMode = m;
  $("#linkBox").classList.toggle("hidden", m !== "link");
  $("#contentBox").classList.toggle("hidden", m !== "content");
  $$("#itemForm .tabs button").forEach(b => b.classList.toggle("active", b.dataset.mode === m));
}
$$("#itemForm .tabs button").forEach(b => b.addEventListener("click", () => setItemMode(b.dataset.mode)));

function openItemDlg(a = null) {
  editingId = a?.id || null;
  const f = $("#itemForm");
  f.reset(); $("#itemErr").textContent = "";
  $("#itemTitle").textContent = a ? "수업 항목 수정" : "수업 항목 추가";
  $("#itemSave").textContent = a ? "수정 저장" : "추가하기";
  f.title.value = a?.title || "";
  f.description.value = a?.description || "";
  f.grade.value = String(a?.grade || Number($("#adminGrade").value) || 1);
  f.field.value = a?.field || $("#adminField").value || "";
  f.url.value = a?.type === "link" ? (a.url || "") : "";
  f.content.value = a?.content || "";
  setItemMode(a ? (a.type === "link" ? "link" : "content") : "link");
  $("#itemDlg").showModal();
  setTimeout(() => f.title.focus(), 50);
}
$("#addBtn").addEventListener("click", () => openItemDlg());

$("#itemForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const payload = {
    title: f.title.value.trim(),
    field: f.field.value,
    grade: Number(f.grade.value),
    description: f.description.value.trim(),
    type: itemMode,
    url: itemMode === "link" ? f.url.value.trim() : "",
    content: itemMode === "content" ? f.content.value.trim() : ""
  };
  if (!payload.title) { $("#itemErr").textContent = "수업 제목을 입력하세요."; return; }
  if (!payload.field) { $("#itemErr").textContent = "탐구 분야를 선택하세요."; return; }
  if (itemMode === "link" && !/^https?:\/\//i.test(payload.url)) { $("#itemErr").textContent = "링크는 http:// 또는 https:// 로 시작해야 합니다."; return; }
  if (itemMode === "content" && !payload.content) { $("#itemErr").textContent = "수업 내용을 작성하세요."; return; }
  try {
    if (editingId) {
      await api("/api/items/" + editingId, { method: "PUT", body: JSON.stringify(payload) });
      toast("수정 내용을 저장했어요.");
    } else {
      await api("/api/items", { method: "POST", body: JSON.stringify(payload) });
      toast("새 수업 자료를 추가했어요.");
      $("#adminGrade").value = String(payload.grade);
      $("#adminField").value = payload.field;
    }
    await refreshState();
    $("#itemDlg").close();
    render();
  } catch (err) { $("#itemErr").textContent = err.message; }
});

$$("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

async function init() {
  try {
    const s = await api("/api/session");
    admin = !!s.admin;
  } catch { admin = false; }
  try {
    const g = Number(sessionStorage.getItem("erim-grade"));
    if ([1, 2, 3].includes(g)) selectedGrade = g;
  } catch { }
  try { await refreshState(); } catch (err) { toast(err.message); }
  render();
}
init();

})();
