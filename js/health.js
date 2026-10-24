// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: sức khoẻ dữ liệu. Ghi lại mọi lần trang gọi ra ngoài (fetch) và mọi kết nối WebSocket,
// gom theo nguồn: còn sống hay chết, độ trễ đo được thật, lần cập nhật cuối.
//   - REST: thời gian khứ hồi của từng lần gọi (trung vị 20 lần gần nhất).
//   - WebSocket: độ trễ = giờ máy lúc nhận trừ giờ sàn ghi trên tin (đã trừ lệch đồng hồ máy so với Binance).
//   - File data/*.json: tuổi dữ liệu = bây giờ trừ thời điểm file được tạo (trường "updated").

export const SOURCES = [
  { id: "binance-ws", name: "Binance Futures WebSocket", kind: "live", feeds: "Giá, lệnh khớp, sổ lệnh, thanh lý (Terminal, Đa biểu đồ)", hosts: ["fstream.binance.com", "stream.binance.com"], expect: 10e3 },
  { id: "binance-rest", name: "Binance REST", kind: "live", feeds: "Nến, OI, funding, tỷ lệ long/short, Radar crypto", hosts: ["fapi.binance.com", "api.binance.com"], probe: "https://fapi.binance.com/fapi/v1/time", expect: 300e3 },
  { id: "bybit", name: "Bybit", kind: "live", feeds: "Funding, OI, sổ lệnh khi chọn sàn Bybit", hosts: ["api.bybit.com", "stream.bybit.com"], probe: "https://api.bybit.com/v5/market/time", expect: 600e3 },
  { id: "okx", name: "OKX", kind: "live", feeds: "Funding, OI, sổ lệnh khi chọn sàn OKX", hosts: ["www.okx.com", "ws.okx.com"], probe: "https://www.okx.com/api/v5/public/time", expect: 600e3 },
  { id: "hyperliquid", name: "Hyperliquid", kind: "live", feeds: "Cá voi, sổ lệnh khi chọn Hyperliquid", hosts: ["api.hyperliquid.xyz"], expect: 600e3 },
  { id: "deribit", name: "Deribit", kind: "live", feeds: "Quyền chọn BTC/ETH, DVOL", hosts: ["www.deribit.com"], probe: "https://www.deribit.com/api/v2/public/get_time", expect: 300e3 },
  { id: "coinbase", name: "Coinbase", kind: "live", feeds: "Chênh giá Coinbase (Radar, chỉ số tổ chức)", hosts: ["api.exchange.coinbase.com"], probe: "https://api.exchange.coinbase.com/time", expect: 600e3 },
  { id: "d-calendar", name: "Lịch kinh tế", kind: "delay", feeds: "ForexFactory + số thực tế Nasdaq", file: "data/calendar.json", expect: 45 * 60e3 },
  { id: "d-news", name: "Tin tức (51 nguồn)", kind: "delay", feeds: "Tab Phân tích, bản đồ tác động tin", file: "data/news.json", expect: 45 * 60e3 },
  { id: "d-reactions", name: "Giá phản ứng sau tin", kind: "delay", feeds: "Bản đồ tác động tin", file: "data/reactions.json", expect: 45 * 60e3 },
  { id: "d-markets", name: "Hàng hoá, forex, crypto", kind: "delay", feeds: "Tab Thị trường (Yahoo, trễ 10–15 phút)", file: "data/markets.json", expect: 45 * 60e3 },
  { id: "d-whales", name: "Cá voi Hyperliquid", kind: "delay", feeds: "Tab Thị trường", file: "data/whales.json", expect: 45 * 60e3 },
  { id: "d-vol", name: "VIX và chỉ số biến động", kind: "delay", feeds: "Tab Phân tích (Yahoo)", file: "data/vol.json", expect: 45 * 60e3 },
  { id: "d-cot", name: "COT của CFTC", kind: "weekly", feeds: "Tab Phân tích (công bố thứ Sáu)", file: "data/cot.json", expect: 8 * 864e5 },
  { id: "d-gex", name: "Chuỗi quyền chọn Mỹ (CBOE)", kind: "delay", feeds: "Tab Quyền chọn: SPX, SPY, QQQ, vàng, dầu…", file: "data/gex_SPY.json", match: /data\/gex_/, expect: 45 * 60e3 },
  { id: "d-flows", name: "Dòng tiền ETF và stablecoin", kind: "eod", feeds: "Tab Phân tích (Farside, DefiLlama)", file: "data/flows.json", expect: 26 * 36e5 },
  { id: "laptop", name: "Máy chủ laptop: nến hợp đồng tương lai", kind: "delay", feeds: "Radar vàng, dầu, ES, NQ… (Yahoo, trễ ~15 phút); chỉ có trên bản laptop", match: /\/api\/bars/, expect: 600e3 },
  { id: "hist", name: "Kho lịch sử data.binance.vision", kind: "eod", feeds: "Tab Tín hiệu: lệnh khớp, cá voi, OI, long/short, độ sâu sổ lệnh nhiều năm (tải miễn phí về laptop); chỉ có trên bản laptop", match: /\/api\/hist\//, expect: 0 },
  { id: "cme", name: "Sổ lệnh và tape CME (vàng, dầu, ES, NQ)", kind: "none", feeds: "Chưa có: cần nguồn trả phí (Rithmic, CQG, Databento…). Hiện chỉ có nến trễ 15 phút", expect: 0 },
];

const state = new Map(SOURCES.map(s => [s.id, { ok: 0, fail: 0, last: 0, lastOk: 0, err: "", rtt: [], lag: [], msgs: 0, socks: 0, age: null, ageT: 0 }]));
let skew = 0; // giờ sàn trừ giờ máy (ms)
const listeners = new Set();
const ping = () => { for (const f of listeners) f(); };
export const onHealth = f => { listeners.add(f); return () => listeners.delete(f); };
export const healthState = id => state.get(id);
export const clockSkew = () => skew;

export function sourceOf(url) {
  let u; try { u = new URL(url, typeof location !== "undefined" ? location.href : "http://localhost/"); } catch { return null; }
  for (const s of SOURCES) {
    if (s.hosts && s.hosts.includes(u.hostname)) return s.id;
    if (s.match && s.match.test(u.pathname)) return s.id;
    if (s.file && u.pathname.endsWith("/" + s.file)) return s.id;
  }
  return null;
}
const push = (a, x, n = 20) => { a.push(x); if (a.length > n) a.shift(); };
export const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function record(id, { ok, rtt, err, updated, lag }, now = Date.now()) {
  const s = state.get(id); if (!s) return;
  s.last = now;
  if (ok) { s.ok++; s.lastOk = now; s.err = ""; } else if (ok === false) { s.fail++; s.err = err || "lỗi"; }
  if (rtt != null) push(s.rtt, rtt);
  if (lag != null) push(s.lag, lag, 50);
  if (updated) { s.age = updated; s.ageT = now; }
}

// thời điểm sàn ghi trên một tin WebSocket (ms), nếu có
export function msgTime(m) {
  const d = m && (m.data !== undefined ? m.data : m);
  const pick = x => { const v = +x; return v > 1e9 ? (v < 1e12 ? v * 1000 : v) : null; };
  if (!d) return null;
  return pick(d.E) || pick(d.T) || pick(m.ts) || pick(d.ts) || (Array.isArray(d) && d[0] ? pick(d[0].ts) || pick(d[0].T) || pick(d[0].time) : null) || (m.params && m.params.data ? pick(m.params.data.timestamp) : null) || pick(d.time);
}

// trạng thái một nguồn: run (đang chạy), slow (cũ quá mức), dead (lần gần nhất lỗi), idle (phiên này chưa dùng), none
export function status(src, s, now = Date.now()) {
  if (src.kind === "none") return "none";
  if (!s.last) return "idle";
  if (s.err && s.last > s.lastOk) return "dead";
  if (src.file && s.age && src.expect && now - s.age > src.expect * 2) return "slow";
  if (!src.file && src.hosts && src.id.endsWith("ws") && now - s.lastOk > src.expect * 3) return "slow";
  return "run";
}

let installed = false;
export function installHealth() {
  if (installed || typeof window === "undefined") return; installed = true;
  const f0 = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input && input.url, id = sourceOf(url), t0 = performance.now();
    if (!id) return f0(input, init);
    try {
      const res = await f0(input, init), rtt = performance.now() - t0;
      if (!res.ok) { record(id, { ok: false, rtt, err: `HTTP ${res.status}` }); ping(); return res; }
      const src = SOURCES.find(s => s.id === id);
      if (src.file || src.match) res.clone().json().then(j => { record(id, { ok: true, rtt, updated: j && +j.updated > 0 ? +j.updated : null }); ping(); }).catch(() => { record(id, { ok: true, rtt }); ping(); });
      else { record(id, { ok: true, rtt }); ping(); }
      return res;
    } catch (e) { record(id, { ok: false, err: e.message || "mất kết nối" }); ping(); throw e; }
  };
  const WS = window.WebSocket;
  if (!WS) return;
  class HWS extends WS {
    constructor(url, p) {
      super(url, p);
      const id = sourceOf(url), sid = id === "binance-rest" ? "binance-ws" : id;
      if (!sid) return;
      const s = state.get(sid); s.socks++;
      let sampled = 0;
      this.addEventListener("message", ev => {
        s.msgs++; const now = Date.now(); s.last = s.lastOk = now; s.err = "";
        if (now - sampled < 2000 || typeof ev.data !== "string") return;
        sampled = now;
        try { const t = msgTime(JSON.parse(ev.data)); if (t) push(s.lag, now + skew - t, 50); } catch { /* bỏ qua */ }
        ping();
      });
      this.addEventListener("close", () => { s.socks = Math.max(0, s.socks - 1); ping(); });
      this.addEventListener("error", () => { s.err = "WebSocket lỗi"; s.last = Date.now(); ping(); });
    }
  }
  window.WebSocket = HWS;
}

// gọi thử mọi nguồn có địa chỉ kiểm tra; đồng thời đo lệch đồng hồ máy so với Binance
export async function probeAll() {
  const jobs = SOURCES.filter(s => s.probe || s.file).map(async s => {
    const t0 = Date.now();
    try {
      const r = await fetch(s.probe || `${s.file}?t=${t0}`, { cache: "no-store" });
      if (s.id === "binance-rest" && r.ok) { const j = await r.json(), t1 = Date.now(); if (j.serverTime) skew = j.serverTime - (t0 + t1) / 2; }
    } catch { /* đã ghi trong fetch */ }
  });
  await Promise.all(jobs); ping();
}
