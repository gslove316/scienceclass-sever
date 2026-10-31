const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const DEFAULT_PASSWORD = "1004";
const DEFAULT_TITLE = "애림쌤의 신나는 과학교실";

const sessions = new Map();

function defaultStore() {
  const seeds = [
    [1, "지구과학", "지권의 변화", "암석의 순환과 지구 내부 구조를 탐구해요."],
    [1, "화학", "기체의 성질", "압력·온도에 따른 기체 부피 변화를 알아봐요."],
    [1, "화학", "물질의 상태 변화", "고체·액체·기체와 상태 변화 원리를 배워요."],
    [1, "물리", "빛과 파동", "빛의 반사·굴절과 거울·렌즈의 성질을 탐구해요."],
    [1, "생물", "생물의 다양성", "생물을 분류하고 생물 다양성의 의미를 이해해요."],
    [2, "화학", "물질의 구성", "원소·원자·분자와 이온을 배워요."],
    [2, "물리", "전기와 자기", "전기 회로와 자기장의 성질을 탐구해요."],
    [2, "생물", "식물과 에너지", "광합성과 식물의 호흡을 탐구해요."],
    [2, "생물", "동물과 에너지", "소화·순환·호흡·배설 과정을 이해해요."],
    [2, "지구과학", "태양계", "태양계 구성 천체와 지구의 운동을 배워요."],
    [3, "물리", "운동과 에너지", "속력·가속도와 역학적 에너지를 탐구해요."],
    [3, "화학", "화학 반응의 규칙과 에너지 변화", "화학 반응식과 질량 보존 법칙을 배워요."],
    [3, "생물", "생식과 유전", "세포 분열과 멘델의 유전 법칙을 탐구해요."],
    [3, "지구과학", "별과 우주", "별의 특성과 우주 팽창을 알아봐요."],
    [3, "물리", "에너지 전환과 보존", "여러 에너지의 전환과 보존을 탐구해요."]
  ];
  return {
    title: DEFAULT_TITLE,
    password: DEFAULT_PASSWORD,
    items: seeds.map((s, i) => ({
      id: uid(),
      grade: s[0],
      field: s[1],
      title: s[2],
      description: s[3],
      type: "content",
      url: "",
      content: s[2] + " 단원의 학습 내용입니다.\n\n관리자 페이지에서 수업 자료(웹앱 링크 또는 내용)를 추가해 발전시켜 나갈 수 있어요.",
      order: i
    }))
  };
}

function uid() {
  return Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
}

let store;
function loadStore() {
  try {
    store = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!store.title) store.title = DEFAULT_TITLE;
    if (!store.password) store.password = DEFAULT_PASSWORD;
    if (!Array.isArray(store.items)) store.items = [];
  } catch {
    store = defaultStore();
    saveStore();
  }
}
function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function publicStore() {
  return { title: store.title, items: store.items.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) };
}

function send(res, code, body, headers = {}) {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => {
      raw += c;
      if (raw.length > 2_000_000) reject(new Error("too large"));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("잘못된 요청 형식입니다.")); }
    });
    req.on("error", reject);
  });
}

function tokenFrom(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}
function isAdmin(req) {
  return sessions.has(tokenFrom(req));
}

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { send(res, 403, { error: "forbidden" }); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, d2) => {
        if (e2) { send(res, 404, { error: "not found" }); return; }
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  const method = req.method;

  if (p === "/api/state" && method === "GET") {
    return send(res, 200, publicStore());
  }

  if (p === "/api/login" && method === "POST") {
    const body = await readJson(req);
    if (String(body.password) !== store.password) return send(res, 401, { error: "비밀번호가 올바르지 않습니다." });
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, Date.now());
    return send(res, 200, { token });
  }

  if (p === "/api/logout" && method === "POST") {
    sessions.delete(tokenFrom(req));
    return send(res, 200, { ok: true });
  }

  if (p === "/api/session" && method === "GET") {
    return send(res, 200, { admin: isAdmin(req) });
  }

  if (!isAdmin(req)) return send(res, 401, { error: "관리자 로그인이 필요합니다." });

  if (p === "/api/title" && method === "PUT") {
    const body = await readJson(req);
    const title = String(body.title || "").trim();
    if (!title) return send(res, 400, { error: "제목을 입력하세요." });
    if (title.length > 40) return send(res, 400, { error: "제목은 40자 이하여야 합니다." });
    store.title = title;
    saveStore();
    return send(res, 200, { title });
  }

  if (p === "/api/password" && method === "PUT") {
    const body = await readJson(req);
    if (String(body.current) !== store.password) return send(res, 401, { error: "현재 비밀번호가 올바르지 않습니다." });
    const next = String(body.next || "");
    if (next.length < 4) return send(res, 400, { error: "새 비밀번호는 4자 이상이어야 합니다." });
    store.password = next;
    saveStore();
    return send(res, 200, { ok: true });
  }

  if (p === "/api/items" && method === "POST") {
    const body = await readJson(req);
    const item = validateItem(body);
    if (item.error) return send(res, 400, { error: item.error });
    const maxOrder = store.items.reduce((m, x) => Math.max(m, x.order || 0), -1);
    const created = { id: uid(), ...item.value, order: maxOrder + 1 };
    store.items.push(created);
    saveStore();
    return send(res, 200, created);
  }

  const itemMatch = p.match(/^\/api\/items\/([\w-]+)$/);
  if (itemMatch) {
    const id = itemMatch[1];
    const idx = store.items.findIndex(x => x.id === id);
    if (idx < 0) return send(res, 404, { error: "항목을 찾을 수 없습니다." });
    if (method === "PUT") {
      const body = await readJson(req);
      const item = validateItem(body);
      if (item.error) return send(res, 400, { error: item.error });
      store.items[idx] = { ...store.items[idx], ...item.value };
      saveStore();
      return send(res, 200, store.items[idx]);
    }
    if (method === "DELETE") {
      store.items.splice(idx, 1);
      saveStore();
      return send(res, 200, { ok: true });
    }
  }

  if (p === "/api/order" && method === "PUT") {
    const body = await readJson(req);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const lookup = new Map(store.items.map(x => [x.id, x]));
    const ordered = ids.map(id => lookup.get(id)).filter(Boolean);
    const rest = store.items.filter(x => !ids.includes(x.id));
    store.items = [...ordered, ...rest].map((x, i) => ({ ...x, order: i }));
    saveStore();
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: "알 수 없는 요청입니다." });
}

function validateItem(body) {
  const title = String(body.title || "").trim();
  const field = String(body.field || "").trim();
  const grade = Number(body.grade);
  const type = body.type === "link" ? "link" : "content";
  if (!title) return { error: "수업 제목을 입력하세요." };
  if (![1, 2, 3].includes(grade)) return { error: "학년을 선택하세요." };
  if (!["물리", "화학", "지구과학", "생물"].includes(field)) return { error: "탐구 분야를 선택하세요." };
  let url = "", content = "";
  if (type === "link") {
    url = String(body.url || "").trim();
    if (!/^https?:\/\//i.test(url)) return { error: "링크는 http:// 또는 https:// 로 시작해야 합니다." };
  } else {
    content = String(body.content || "").trim();
    if (!content) return { error: "수업 내용을 작성하세요." };
  }
  return { value: { title, field, grade, type, url, content, description: String(body.description || "").trim() } };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch(err => send(res, 400, { error: err.message || "처리하지 못했습니다." }));
    return;
  }
  serveStatic(req, res, url.pathname);
});

loadStore();
server.listen(PORT, () => {
  console.log(`애림쌤의 신나는 과학교실(서버 버전) → http://localhost:${PORT}`);
  console.log(`데이터 저장 위치: ${DATA_FILE}`);
});
