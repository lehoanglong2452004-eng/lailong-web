// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: các hàm định dạng và tính toán nhỏ dùng chung.

export function fmtVol(v) {
  const a = Math.abs(v);
  if (!isFinite(v)) return "-";
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (v / 1e3).toFixed(1) + "K";
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (a === 0) return "0";
  return v.toFixed(3);
}

export function fmtUsd(v) {
  if (!isFinite(v)) return "-";
  const a = Math.abs(v);
  if (a >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(0);
}

export function decimalsFor(step) {
  if (!step || !isFinite(step)) return 2;
  if (step >= 1) return step % 1 === 0 ? 0 : 1;
  return Math.min(8, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
}

// Làm tròn về bước "đẹp" gần nhất: 1, 2, 2.5, 5 x 10^n
export function niceStep(x) {
  if (!(x > 0)) return 0;
  const e = Math.pow(10, Math.floor(Math.log10(x) + 1e-9)), m = x / e;
  const nm = [1, 2, 2.5, 5, 10].find(k => m <= k * 1.0001) || 10;
  return nm * e;
}

// cờ theo mã tiền tệ trong lịch kinh tế
export const FLAG = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CNY: "🇨🇳", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭" };

export const pad2 = n => (n < 10 ? "0" + n : "" + n);

export function fmtTime(ms, withDate = false) {
  const d = new Date(ms);
  const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return withDate ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${t}` : t;
}

export function fmtDate(ms) {
  const d = new Date(ms);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtPct(v, d = 2) {
  if (v === null || v === undefined || !isFinite(v)) return "-";
  return (v >= 0 ? "+" : "") + v.toFixed(d) + "%";
}

export const INTERVALS = {
  "1m": 60e3, "5m": 300e3, "15m": 900e3, "1h": 3600e3, "4h": 14400e3, "1d": 86400e3,
};

export const MONO = "'IBM Plex Mono', Consolas, 'Cascadia Mono', Menlo, monospace";

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Ngân sách REST của Binance Futures (2400 trọng số/phút cho mỗi IP). Trang chạy thẳng trong trình duyệt nên
// tự đếm trọng số các lần gọi trong 60 giây gần nhất và chờ khi sắp chạm 75% hạn mức. Bị 429 thì nghỉ theo
// Retry-After (mặc định 60 giây), bị 418 (sàn tạm cấm IP) thì nghỉ 5 phút: trong lúc nghỉ không gửi thêm,
// tránh việc cố gọi tiếp làm lệnh cấm kéo dài.
const BN_HOST = "fapi.binance.com", BN_LIMIT = 2400, BN_SOFT = 1800;
const bn = { log: [], until: 0, status: 0 };
export function binanceWeight(url) {
  const u = new URL(url), lim = +(u.searchParams.get("limit") || 0), p = u.pathname;
  if (p.endsWith("/aggTrades")) return 20;
  if (p.endsWith("/klines") || p.endsWith("/continuousKlines")) return lim >= 1000 ? 10 : lim >= 500 ? 5 : lim >= 100 ? 2 : 1;
  if (p.endsWith("/depth")) return lim >= 1000 ? 20 : lim >= 500 ? 10 : lim >= 100 ? 5 : 2;
  if (p.endsWith("/ticker/24hr") && !u.searchParams.get("symbol")) return 40;
  return 1;
}
export function binanceBudget(now = Date.now()) {
  bn.log = bn.log.filter(x => now - x.t < 60e3);
  return { used: bn.log.reduce((a, x) => a + x.w, 0), limit: BN_LIMIT, blockedFor: Math.max(0, bn.until - now), status: bn.status };
}
export function binanceBlock(status, retryAfterSec, now = Date.now()) {
  bn.until = now + (retryAfterSec > 0 ? retryAfterSec * 1000 : status === 418 ? 300e3 : 60e3); bn.status = status;
}
async function binanceGate(url) {
  const w = binanceWeight(url);
  for (;;) {
    const now = Date.now();
    if (bn.until > now) throw new Error(`HTTP ${bn.status} (Binance đang tạm chặn, thử lại sau ${Math.ceil((bn.until - now) / 1000)} giây) ${url.split("?")[0]}`);
    const b = binanceBudget(now);
    if (!bn.log.length || b.used + w <= BN_SOFT) { bn.log.push({ t: now, w }); return; }
    await sleep(Math.max(250, 60e3 - (now - bn.log[0].t) + 50));
  }
}

export async function getJson(url, opts) {
  const isBn = typeof url === "string" && url.includes(BN_HOST);
  if (isBn) await binanceGate(url);
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    if (isBn && (resp.status === 429 || resp.status === 418)) binanceBlock(resp.status, +resp.headers.get("Retry-After"));
    throw new Error(`HTTP ${resp.status} ${url.split("?")[0]}`);
  }
  return resp.json();
}

// Dữ liệu nhanh (lịch kinh tế, tin, biến động chỉ số). Trên trang công khai (github.io) đọc nhánh `live` của repo web,
// nơi máy chủ GitHub đẩy dữ liệu mới vài phút một lần (lailong/terminal/live.py); đọc theo mã commit mới nhất để
// không dính bộ nhớ đệm 5 phút của raw.githubusercontent.com. Lấy bản nào mới hơn giữa nhánh live và data/ của trang.
// Trên laptop, data/ do máy chủ cục bộ lấy trực tiếp nên chỉ đọc data/.
export function liveRepo(loc = globalThis.location) {
  const h = loc && loc.hostname || "";
  if (!h.endsWith(".github.io")) return null;
  return { owner: h.split(".")[0], repo: (loc.pathname || "").split("/").filter(Boolean)[0] || h };
}
const LIVE = { sha: null, at: 0 };
async function liveHead(r) {
  if (LIVE.sha && Date.now() - LIVE.at < 90e3) return LIVE.sha;
  try {
    const resp = await fetch(`https://api.github.com/repos/${r.owner}/${r.repo}/commits/live`, { headers: { Accept: "application/vnd.github.sha" } });
    if (resp.ok) { LIVE.sha = (await resp.text()).trim(); LIVE.at = Date.now(); }
    else LIVE.at = Date.now() - 30e3; // hết lượt gọi API: dùng tên nhánh, thử lại sau 1 phút
  } catch { /* mạng lỗi: dùng tên nhánh */ }
  return LIVE.sha;
}
export function newer(a, b) { if (!a) return b || null; if (!b) return a; return (a.updated || 0) >= (b.updated || 0) ? a : b; }
export async function liveJson(name) {
  const local = getJson(`data/${name}?t=${Math.floor(Date.now() / 60e3)}`).catch(() => null), r = liveRepo();
  if (!r) return local;
  let fast = null;
  try { fast = await getJson(`https://raw.githubusercontent.com/${r.owner}/${r.repo}/${(await liveHead(r)) || "live"}/${name}`); } catch { fast = null; }
  return newer(fast, await local);
}

export function postJson(url, body) {
  return getJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// Canvas sắc nét trên màn hình độ phân giải cao, tự đổi kích thước theo khung chứa
export function fitCanvas(cv, onResize) {
  const ctx = cv.getContext("2d");
  const state = { w: 100, h: 100, ctx };
  let ready = false;
  const resize = () => {
    const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    state.w = Math.max(50, r.width); state.h = Math.max(50, r.height);
    cv.width = Math.round(state.w * dpr); cv.height = Math.round(state.h * dpr);
    cv.style.width = state.w + "px"; cv.style.height = state.h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (onResize && ready) onResize();
  };
  resize(); ready = true;
  new ResizeObserver(resize).observe(cv.parentElement);
  return state;
}

// điện thoại: kéo dọc một ngón để cuộn từng dòng (sổ lệnh, bản đồ thanh khoản, băng lệnh)
// onRows(n): n > 0 khi ngón tay kéo xuống
export function touchRows(cv, rowH, onRows) {
  let y0 = null, acc = 0;
  cv.addEventListener("touchstart", e => { if (e.touches.length === 1) { y0 = e.touches[0].clientY; acc = 0; } else y0 = null; }, { passive: true });
  cv.addEventListener("touchmove", e => {
    if (y0 == null) return; e.preventDefault();
    const y = e.touches[0].clientY; acc += y - y0; y0 = y;
    const n = Math.trunc(acc / rowH); if (n) { acc -= n * rowH; onRows(n); }
  }, { passive: false });
  cv.addEventListener("touchend", () => { y0 = null; });
}
