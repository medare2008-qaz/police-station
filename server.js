// 한빛경찰서 데모 서버. Node.js 표준 라이브러리만 사용합니다.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "inquiries.json");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8000);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
// 개발용 기본값입니다. 실제 운영이나 외부 공개 전에는 환경 변수로 바꾸세요.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
const SESSION_COOKIE = "hanbit_admin_session";
const sessions = new Map();
const failedLogins = new Map();

function readInquiries() {
  try {
    const items = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(items) ? items : [];
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return [];
    throw error;
  }
}

function writeInquiries(items) {
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(items, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempFile, DATA_FILE);
}

function sendJson(response, status, data, headers = {}) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    ...headers,
  });
  response.end(body);
}

function readJson(request, response) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > 12000) {
        sendJson(response, 413, { error: "요청 내용이 너무 깁니다." });
        request.destroy();
        resolve(null);
      }
    });
    request.on("end", () => {
      if (response.writableEnded) return;
      try {
        const payload = JSON.parse(body);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid payload");
        resolve(payload);
      } catch {
        sendJson(response, 400, { error: "요청 내용을 읽을 수 없습니다." });
        resolve(null);
      }
    });
  });
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  return !origin || new URL(origin).host === request.headers.host;
}

function sessionId(request) {
  const cookie = request.headers.cookie || "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry ? entry.slice(SESSION_COOKIE.length + 1) : "";
}

function isAdmin(request) {
  const id = sessionId(request);
  const expiresAt = sessions.get(id);
  if (expiresAt && expiresAt > Date.now()) return true;
  sessions.delete(id);
  return false;
}

function secureEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash) && String(left).length === String(right).length;
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/admin/requests") {
    if (!isAdmin(request)) return sendJson(response, 401, { error: "로그인이 필요합니다." });
    const requests = readInquiries().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(response, 200, requests);
  }

  if (["POST", "PATCH"].includes(request.method) && !sameOrigin(request)) {
    return sendJson(response, 403, { error: "허용되지 않은 요청입니다." });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/logout") {
    sessions.delete(sessionId(request));
    return sendJson(response, 200, { ok: true }, {
      "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/inquiries") {
    const payload = await readJson(request, response);
    if (!payload) return;
    const category = String(payload.category || "").trim();
    const title = String(payload.title || "").trim();
    const content = String(payload.content || "").trim();
    const validExclusionIds = new Set(["agency", "contract", "unclear"]);
    const exclusionFindings = Array.isArray(payload.exclusionFindings)
      ? [...new Set(payload.exclusionFindings.map((finding) => finding && finding.id).filter((id) => validExclusionIds.has(id)))]
      : [];
    if (!["일반 문의", "불편·건의", "교통 관련 문의", "기타"].includes(category)) {
      return sendJson(response, 400, { error: "민원 종류를 선택해 주세요." });
    }
    if (!title || title.length > 80 || !content || content.length > 1000) {
      return sendJson(response, 400, { error: "제목과 내용을 확인해 주세요." });
    }
    const now = new Date();
    const item = {
      id: `HB-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      createdAt: now.toISOString(), category, excludedReason: exclusionFindings[0] || "", title, content, status: "접수",
    };
    const items = readInquiries();
    items.push(item);
    writeInquiries(items);
    return sendJson(response, 201, { id: item.id, status: item.status });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    const ip = request.socket.remoteAddress || "local";
    const attempt = failedLogins.get(ip) || { count: 0, until: 0 };
    if (attempt.until > Date.now()) return sendJson(response, 429, { error: "로그인 시도가 잠시 제한되었습니다." });
    const payload = await readJson(request, response);
    if (!payload) return;
    if (!secureEqual(payload.username || "", ADMIN_USERNAME) || !secureEqual(payload.password || "", ADMIN_PASSWORD)) {
      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.count = 0;
        attempt.until = Date.now() + 5 * 60 * 1000;
      }
      failedLogins.set(ip, attempt);
      return sendJson(response, 401, { error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }
    failedLogins.delete(ip);
    const id = crypto.randomBytes(32).toString("base64url");
    sessions.set(id, Date.now() + 8 * 60 * 60 * 1000);
    const secure = request.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return sendJson(response, 200, { ok: true }, {
      "Set-Cookie": `${SESSION_COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`,
    });
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/requests/")) {
    if (!sameOrigin(request)) return sendJson(response, 403, { error: "허용되지 않은 요청입니다." });
    if (!isAdmin(request)) return sendJson(response, 401, { error: "로그인이 필요합니다." });
    const id = decodeURIComponent(url.pathname.slice("/api/admin/requests/".length));
    const items = readInquiries();
    const remainingItems = items.filter((item) => item.id !== id);
    if (remainingItems.length === items.length) return sendJson(response, 404, { error: "민원을 찾을 수 없습니다." });
    writeInquiries(remainingItems);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/requests/")) {
    if (!isAdmin(request)) return sendJson(response, 401, { error: "로그인이 필요합니다." });
    const payload = await readJson(request, response);
    if (!payload) return;
    const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";
    if (!reply || reply.length > 2000) return sendJson(response, 400, { error: "답변 내용을 입력해 주세요. (최대 2,000자)" });
    const id = decodeURIComponent(url.pathname.slice("/api/admin/requests/".length));
    const items = readInquiries();
    const item = items.find((entry) => entry.id === id);
    if (!item) return sendJson(response, 404, { error: "민원을 찾을 수 없습니다." });
    item.reply = reply;
    item.repliedAt = new Date().toISOString();
    // 답변을 저장하면 처리 상태도 자동 완료로 변경합니다.
    item.status = "답변 완료";
    writeInquiries(items);
    return sendJson(response, 200, { ok: true });
  }

  return sendJson(response, 404, { error: "요청한 API가 없습니다." });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  if (url.pathname.startsWith("/api/")) return handleApi(request, response, url);
  // Older form versions could place login values in the page URL; remove them immediately.
  if (url.searchParams.has("username") || url.searchParams.has("password")) {
    response.writeHead(303, { Location: "/", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    return response.end();
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    return response.end();
  }
  const fileName = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const allowedFiles = {
    "index.html": "text/html; charset=utf-8",
    "about.html": "text/html; charset=utf-8",
    "departments.html": "text/html; charset=utf-8",
    "area.html": "text/html; charset=utf-8",
    "civil.html": "text/html; charset=utf-8",
    "styles.css": "text/css; charset=utf-8",
    "script.js": "text/javascript; charset=utf-8",
    "images/poster-help.svg": "image/svg+xml; charset=utf-8",
    "images/poster-phishing.svg": "image/svg+xml; charset=utf-8",
    "images/poster-traffic.svg": "image/svg+xml; charset=utf-8",
  };
  if (!allowedFiles[fileName]) {
    response.writeHead(404);
    return response.end("찾을 수 없습니다.");
  }
  const body = fs.readFileSync(path.join(ROOT, fileName));
  response.writeHead(200, {
    "Content-Type": allowedFiles[fileName],
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  });
  response.end(request.method === "HEAD" ? undefined : body);
});

server.listen(PORT, HOST, () => {
  console.log(`홈페이지: http://${HOST}:${PORT}`);
  console.log(`관리자 로그인: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD} (개발용)`);
  console.log("민원 저장: inquiries.json | 실제 운영에 기본 계정을 사용하지 마세요.");
});
