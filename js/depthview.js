// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: trang Market Depth (độ sâu thị trường và vị thế), cách trình bày theo kiểu FXSSI Order Book.
//
// Trái: lệnh chờ (limit) đang nằm trên sổ lệnh, mặc định của sàn đang chọn ở ô Sàn trên cùng (Binance, OKX, Bybit,
// Hyperliquid); nút Gộp tất cả gộp thêm Binance Spot, OKX Spot, Coinbase và các sàn còn lại. Trên giá hiện tại là lệnh
// chờ bán, dưới là lệnh chờ mua.
// Phải: vị thế ƯỚC TÍNH theo giá vào lệnh, dựng từ nến 1 phút của sàn đang chọn: khối lượng mua chủ động coi như long
// mở ở vùng giá của nến, bán chủ động coi như short (sàn không tách hai phần này thì ước tính theo màu nến). Long vào
// dưới giá hiện tại là đang lãi, trên là đang lỗ; short ngược lại. Đây là ước tính thô, không phải dữ liệu vị thế thật.
// Cứ 10 giây khi trang đang mở thì chụp lại sổ lệnh (Binance Spot và Coinbase nặng nên 30 giây một lần, giữa hai lần
// dùng lại bản trước); giá chạy theo từng giao dịch của sàn đang chọn qua WebSocket. Lần chụp được gom sẵn theo ô nhỏ
// trong ±12% quanh giá cho nhẹ bộ nhớ: giữ hết 10 phút gần nhất, cũ hơn giữ mỗi phút một lần.
// Hàng hoá có đuôi USDT (XAUUSDT, CLUSDT…) chỉ có trên sàn phái sinh; sàn nào không có mã thì bỏ qua.

import { getJson, niceStep } from "./util.js?v=202611062257";
import { getVenue, venueName, venueBars, onVenue } from "./venue.js?v=202611062257";
import { venueDerivs } from "./derivs.js?v=202611062257";

const FAPI = "https://fapi.binance.com", SAPI = "https://api.binance.com";
export const DEPTH_COMMODITIES = [["XAU", "Vàng"], ["XAG", "Bạc"], ["XPT", "Bạch kim"], ["COPPER", "Đồng"], ["CL", "Dầu WTI"], ["BZ", "Dầu Brent"]];
export const DEPTH_COINS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "LINK", "AVAX", "SUI", ...DEPTH_COMMODITIES.map(c => c[0])];
export const isCommodity = c => DEPTH_COMMODITIES.some(x => x[0] === c);
export const DEPTH_PERIODS = [[20, "20 phút"], [60, "1 giờ"], [240, "4 giờ"], [720, "12 giờ"], [1440, "24 giờ"]];
export const DEPTH_RANGES = [1, 2, 3, 5, 10];
export const DEPTH_VIEWS = [["all", "Tất cả"], ["net", "Ròng"], ["diff", "Tăng–Giảm"]];
const SNAP_MS = 10e3, KEEP_ALL_MS = 10 * 60e3, KEEP_SNAPS = 240, STORE_PCT = 12;

// các nguồn sổ lệnh: mỗi hàm trả về { bids: [[giá, số coin]], asks } (số lượng đã là số coin); every: lấy lại sau bao lâu
const num = a => a.map(r => [+r[0], +r[1]]);
export const BOOK_SOURCES = [
  { id: "bnf", name: "Binance Futures", every: 10e3, get: c => getJson(`${FAPI}/fapi/v1/depth?symbol=${c}USDT&limit=1000`).then(d => ({ bids: num(d.bids), asks: num(d.asks) })) },
  { id: "bns", name: "Binance Spot", every: 30e3, skip: isCommodity, get: c => getJson(`${SAPI}/api/v3/depth?symbol=${c}USDT&limit=5000`).then(d => ({ bids: num(d.bids), asks: num(d.asks) })) },
  { id: "okx", name: "OKX Spot", every: 10e3, skip: isCommodity, get: c => getJson(`https://www.okx.com/api/v5/market/books?instId=${c}-USDT&sz=400`).then(d => ({ bids: num(d.data[0].bids), asks: num(d.data[0].asks) })) },
  { id: "okf", name: "OKX Futures", every: 10e3, get: c => Promise.all([okxCtVal(c), getJson(`https://www.okx.com/api/v5/market/books?instId=${c}-USDT-SWAP&sz=400`)]).then(([cv, d]) => ({ bids: num(d.data[0].bids).map(([p, q]) => [p, q * cv]), asks: num(d.data[0].asks).map(([p, q]) => [p, q * cv]) })) },
  { id: "byb", name: "Bybit Futures", every: 10e3, get: c => getJson(`https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${c}USDT&limit=500`).then(d => ({ bids: num(d.result.b), asks: num(d.result.a) })) },
  // Hyperliquid chỉ trả 20 mức mỗi bên: lấy một bản đủ chi tiết sát giá và một bản gộp 3 chữ số cho vùng xa
  { id: "hl", name: "Hyperliquid", every: 10e3, skip: isCommodity, get: c => Promise.all([hlBook(c, null), hlBook(c, 3)]).then(([a, b]) => hlJoin(a, b)) },
  { id: "cb", name: "Coinbase", every: 30e3, skip: c => c === "BNB" || isCommodity(c), get: c => getJson(`https://api.exchange.coinbase.com/products/${c}-USD/book?level=2`).then(d => ({ bids: num(d.bids), asks: num(d.asks) })) },
];

// OKX futures tính khối lượng theo hợp đồng: đổi ra số coin bằng ctVal của hợp đồng (nhớ lại sau lần đầu)
const CTVAL = {};
const okxCtVal = c => CTVAL[c] || (CTVAL[c] = getJson(`https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${c}-USDT-SWAP`).then(d => +d.data[0].ctVal, e => { delete CTVAL[c]; throw e; }));
// sổ lệnh của sàn đang chọn ở ô Sàn trên cùng
export const VENUE_SRC = { BINANCE: "bnf", OKX: "okf", BYBIT: "byb", HYPERLIQUID: "hl" };
const hlBook = (coin, nSigFigs) => getJson("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "l2Book", coin, nSigFigs }) })
  .then(d => ({ bids: d.levels[0].map(x => [+x.px, +x.sz]), asks: d.levels[1].map(x => [+x.px, +x.sz]) }));
// ghép sổ chi tiết (sát giá) với sổ gộp (xa giá): phần gộp chỉ lấy ngoài vùng bản chi tiết đã có
export function hlJoin(fine, wide) {
  const bLo = fine.bids.length ? fine.bids[fine.bids.length - 1][0] : Infinity, aHi = fine.asks.length ? fine.asks[fine.asks.length - 1][0] : -Infinity;
  return { bids: fine.bids.concat(wide.bids.filter(r => r[0] < bLo)), asks: fine.asks.concat(wide.asks.filter(r => r[0] > aHi)) };
}
export const SRC_ALL = "all";

// bước gom giá: khoảng ±range% chia khoảng 70 dòng, làm tròn số đẹp
export function depthStep(price, rangePct) { return niceStep(price * rangePct / 100 * 2 / 70); }

// gom các mức giá vào ô: key = floor(giá / step); trả về Map(key -> số coin)
export function bucketize(levels, step, into = new Map()) {
  for (const [p, q] of levels) {
    if (!(q > 0) || !(p > 0)) continue;
    const k = Math.floor(p / step + 1e-9);
    into.set(k, (into.get(k) || 0) + q);
  }
  return into;
}

// sổ lệnh gộp của nhiều sàn: { bids: Map, asks: Map, mid, ok: [tên sàn], err: [..] }
export function mergeDepth(books, step) {
  const bids = new Map(), asks = new Map(), ok = [], err = [];
  let bestBid = 0, bestAsk = Infinity;
  for (const b of books) {
    if (!b || b.error) { if (b) err.push(`${b.name}: ${b.error}`); continue; }
    ok.push(b.name);
    bucketize(b.bids, step, bids); bucketize(b.asks, step, asks);
    if (b.bids.length) bestBid = Math.max(bestBid, b.bids[0][0]);
    if (b.asks.length) bestAsk = Math.min(bestAsk, b.asks[0][0]);
  }
  const mid = bestBid > 0 && isFinite(bestAsk) ? (bestBid + bestAsk) / 2 : bestBid || null;
  return { bids, asks, mid, ok, err };
}

// % tài khoản đang long của một mã trên một sàn (null nếu sàn không công bố)
export async function quickLong(V, c) {
  if (V === "BINANCE") { const d = await getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${c}USDT&period=5m&limit=1`); return d && d[0] ? +d[0].longAccount : null; }
  if (V === "BYBIT") { const d = await getJson(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${c}USDT&period=5min&limit=1`); const x = d.result && d.result.list && d.result.list[0]; return x ? +x.buyRatio : null; }
  if (V === "OKX") { const d = await getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${c}&period=5m`); const r = d.data && d.data[0] ? +d.data[0][1] : null; return r > 0 ? r / (1 + r) : null; }
  return null;
}
export const QUICK_VENUES = ["BINANCE", "BYBIT", "OKX"];

// giá trực tiếp theo từng giao dịch của từng sàn: { url, sub (tin đăng ký), price(tin) }
const lastPx = a => (Array.isArray(a) && a.length ? +(a[a.length - 1].px ?? a[a.length - 1].p) : NaN);
export function liveFeed(V, c) {
  if (V === "OKX") return { url: "wss://ws.okx.com:8443/ws/v5/public", sub: JSON.stringify({ op: "subscribe", args: [{ channel: "trades", instId: `${c}-USDT-SWAP` }] }), price: m => lastPx(m.data) };
  if (V === "BYBIT") return { url: "wss://stream.bybit.com/v5/public/linear", sub: JSON.stringify({ op: "subscribe", args: [`publicTrade.${c}USDT`] }), price: m => lastPx(m.data) };
  if (V === "HYPERLIQUID") return { url: "wss://api.hyperliquid.xyz/ws", sub: JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin: c } }), price: m => (m.channel === "trades" ? lastPx(m.data) : NaN) };
  return { url: `wss://fstream.binance.com/ws/${c.toLowerCase()}usdt@aggTrade`, sub: null, price: m => +m.p };
}

// Ô gom nhỏ nhất để cất lần chụp: mọi bước gom của các khoảng giá (1, 2, 2,5, 5 × 10^n) đều là bội số của nó,
// nên gom lại từ bản cất cho đúng như gom từ sổ lệnh gốc.
export function baseStep(price) {
  const m = depthStep(price, Math.min(...DEPTH_RANGES));
  return m > 0 ? 0.5 * Math.pow(10, Math.floor(Math.log10(m) + 1e-9)) : 0;
}
const packMap = m => { const a = new Float64Array(m.size * 2); let i = 0; for (const [k, q] of m) { a[i++] = k; a[i++] = q; } return a; };
// gộp sổ lệnh các sàn thành một bản gọn: { base, bids: Float64Array [ô, số coin, ...], asks, bestBid, bestAsk, ok, err }
export function compactBooks(books, price, pct = STORE_PCT) {
  const base = baseStep(price), lo = price * (1 - pct / 100), hi = price * (1 + pct / 100), bids = new Map(), asks = new Map(), ok = [], err = [];
  let bestBid = 0, bestAsk = Infinity;
  const inR = a => a.filter(r => r[0] >= lo && r[0] <= hi);
  for (const b of books) {
    if (!b || b.error) { if (b) err.push(`${b.name}: ${b.error}`); continue; }
    ok.push(b.name);
    bucketize(inR(b.bids), base, bids); bucketize(inR(b.asks), base, asks);
    if (b.bids.length) bestBid = Math.max(bestBid, b.bids[0][0]);
    if (b.asks.length) bestAsk = Math.min(bestAsk, b.asks[0][0]);
  }
  return { base, bids: packMap(bids), asks: packMap(asks), bestBid, bestAsk, ok, err };
}
// một hay nhiều bản gọn (mỗi sàn một bản) → sổ lệnh gộp theo bước gom step, cùng dạng mergeDepth
export function unpackDepth(list, step) {
  const bids = new Map(), asks = new Map(), ok = [], err = [];
  let bestBid = 0, bestAsk = Infinity;
  for (const c of Array.isArray(list) ? list : [list]) {
    ok.push(...c.ok); err.push(...c.err);
    if (!c.base) continue;
    const m = step / c.base, im = Math.round(m), exact = Math.abs(m - im) < 1e-6 && im >= 1;
    const side = (a, out) => { for (let i = 0; i < a.length; i += 2) { const k = exact ? Math.floor(a[i] / im) : Math.floor((a[i] + 0.5) * c.base / step); out.set(k, (out.get(k) || 0) + a[i + 1]); } };
    side(c.bids, bids); side(c.asks, asks);
    if (c.bestBid > 0) bestBid = Math.max(bestBid, c.bestBid);
    if (c.bestAsk > 0) bestAsk = Math.min(bestAsk, c.bestAsk);
  }
  const mid = bestBid > 0 && isFinite(bestAsk) ? (bestBid + bestAsk) / 2 : bestBid || null;
  return { bids, asks, mid, ok, err };
}
// giữ hết các lần chụp trong 10 phút gần nhất, cũ hơn thì mỗi phút một lần, tối đa KEEP_SNAPS
export function thinSnaps(snaps, now = Date.now(), keepAll = KEEP_ALL_MS, max = KEEP_SNAPS) {
  const out = []; let lastMin = null;
  for (const s of snaps) {
    if (now - s.t <= keepAll) { out.push(s); continue; }
    const m = Math.floor(s.t / 60e3); if (m === lastMin) continue;
    lastMin = m; out.push(s);
  }
  return out.length > max ? out.slice(out.length - max) : out;
}

// vị thế ước tính theo giá vào lệnh từ nến [t, o, h, l, c, v, ..., takerBuyV (chỉ số 9)]:
// khối lượng mỗi nến rải đều trên khoảng thấp–cao của nến. Trả về { long: Map, short: Map }
// Nến dạng đối tượng { o, h, l, c, v, bv } cũng được. Sàn không tách khối lượng mua chủ động (bv null): ước tính theo
// nến, nến tăng tính cả là long, nến giảm tính cả là short, nến đứng giá chia đôi.
export function entryProfile(klines, step) {
  const long = new Map(), short = new Map();
  for (const k of klines) {
    const arr = Array.isArray(k), o = +(arr ? k[1] : k.o), c = +(arr ? k[4] : k.c), h = +(arr ? k[2] : k.h), l = +(arr ? k[3] : k.l), v = +(arr ? k[5] : k.v);
    const raw = arr ? k[9] : k.bv, bv = raw != null && raw !== "" && isFinite(+raw) ? +raw : c > o ? v : c < o ? 0 : v / 2;
    if (!(v > 0) || !(h > 0)) continue;
    const sv = Math.max(0, v - bv), k0 = Math.floor(l / step + 1e-9), k1 = Math.floor(h / step + 1e-9), n = k1 - k0 + 1;
    for (let k = k0; k <= k1; k++) {
      long.set(k, (long.get(k) || 0) + bv / n);
      short.set(k, (short.get(k) || 0) + sv / n);
    }
  }
  return { long, short };
}

// tổng trong khoảng ±pct% quanh giá: lệnh chờ mua / bán, vị thế lãi / lỗ
export function depthRatios(depth, pos, price, step, pct = 2) {
  const lo = Math.floor(price * (1 - pct / 100) / step), hi = Math.floor(price * (1 + pct / 100) / step), pk = Math.floor(price / step);
  let bid = 0, ask = 0, win = 0, lose = 0, lg = 0, sh = 0;
  for (let k = lo; k <= hi; k++) {
    bid += depth.bids.get(k) || 0; ask += depth.asks.get(k) || 0;
    const L = pos ? pos.long.get(k) || 0 : 0, S = pos ? pos.short.get(k) || 0 : 0;
    lg += L; sh += S;
    if (k < pk) { win += L; lose += S; } else if (k > pk) { win += S; lose += L; }
  }
  const r = (a, b) => a + b > 0 ? a / (a + b) : null;
  return { bid: r(bid, ask), long: r(lg, sh), win: r(win, lose), bidQ: bid, askQ: ask };
}

// chênh lệch lệnh chờ giữa hai lần chụp: Map(key -> thay đổi, dương là thêm lệnh, âm là rút)
export function depthDiff(cur, prev) {
  const out = new Map();
  for (const side of ["bids", "asks"]) {
    const a = cur[side], b = prev[side];
    for (const [k, q] of a) out.set(k, (out.get(k) || 0) + q - (b.get(k) || 0));
    for (const [k, q] of b) if (!a.has(k)) out.set(k, (out.get(k) || 0) - q);
  }
  return out;
}

// vùng lệnh chờ lớn nhất mỗi phía (để ghi nhãn): [{ k, q, side }]
export function topWalls(depth, price, step, n = 3) {
  const pk = Math.floor(price / step), pick = (m, side, f) => [...m].filter(([k]) => f(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, q]) => ({ k, q, side }));
  return [...pick(depth.asks, "ask", k => k >= pk), ...pick(depth.bids, "bid", k => k <= pk)];
}

const fmtQ = q => !q ? "0" : q >= 1e6 ? (q / 1e6).toFixed(1) + "M" : q >= 1e4 ? (q / 1e3).toFixed(0) + "K" : q >= 1e3 ? (q / 1e3).toFixed(1) + "K" : q >= 100 ? q.toFixed(0) : q >= 10 ? q.toFixed(1) : q.toFixed(2);
const pctTxt = r => r == null ? "–" : Math.round(r * 100) + "%";

export function initDepth({ $, esc }) {
  const cv = $("depthCanvas"); if (!cv) return { show() {}, hide() {} };
  const ctx = cv.getContext("2d");
  const S = { src: "venue", coin: "BTC", period: 60, range: 3, view: "all", snaps: [], at: -1, pos: null, ls: null, timer: null, visible: false, busy: false, sent: {}, err: [], books: {}, noSym: {}, livePx: null };
  try { Object.assign(S, JSON.parse(localStorage.getItem("lailong.depth") || "{}"), { snaps: [], at: -1, pos: null, ls: null, timer: null, visible: false, busy: false, sent: {}, err: [], books: {}, noSym: {}, livePx: null }); } catch { /* bỏ qua */ }
  if (!DEPTH_COINS.includes(S.coin)) S.coin = "BTC";
  if (S.src !== SRC_ALL) S.src = "venue";
  // các sàn đang xem: sàn đang chọn ở ô Sàn trên cùng (mặc định), hoặc gộp tất cả
  const curSrc = () => (S.src === SRC_ALL ? SRC_ALL : VENUE_SRC[getVenue()] || "bnf");
  const pickCs = cs => { const id = curSrc(); return id === SRC_ALL ? cs : cs.filter(c => c.id === id); };
  const save = () => { try { localStorage.setItem("lailong.depth", JSON.stringify({ src: S.src, coin: S.coin, period: S.period, range: S.range, view: S.view })); } catch { /* bỏ qua */ } };

  // sổ lệnh một sàn: dùng lại bản trước nếu chưa tới lượt lấy lại; sàn không có mã này (HTTP 400/404) thì bỏ qua cả phiên
  async function book(s, coin) {
    const key = s.id + ":" + coin, old = S.books[key];
    if (old && Date.now() - old.t < s.every - 500) return old.b;
    try { const b = { ...(await s.get(coin)), name: s.name }; S.books[key] = { t: Date.now(), b }; return b; }
    catch (e) {
      const msg = String(e.message || e);
      // HTTP 400/404 hoặc dữ liệu trả về không đúng dạng (sàn báo mã không có) chứ không phải mất mạng
      if (/HTTP 40[04]|Cannot read|undefined|not iterable/.test(msg) && !/fetch|network/i.test(msg) && !(old && old.b && !old.b.error)) S.noSym[key] = true;
      return old && Date.now() - old.t < 60e3 ? old.b : { name: s.name, error: msg.slice(0, 80) };
    }
  }
  async function snap() {
    const coin = S.coin, only = curSrc(), srcs = BOOK_SOURCES.filter(s => (only === SRC_ALL || s.id === only) && !(s.skip && s.skip(coin)) && !S.noSym[s.id + ":" + coin]);
    if (!srcs.length) { S.err = [`${venueName()} không có ${coin}USDT`]; return null; }
    const got = await Promise.all(srcs.map(s => book(s, coin)));
    if (coin !== S.coin) return null;
    const ref = got.find(b => !b.error && b.bids.length && b.asks.length);
    if (!ref) { S.err = got.map(b => `${b.name}: ${b.error || "trống"}`); return null; }
    const price = (ref.bids[0][0] + ref.asks[0][0]) / 2;
    // mỗi sàn một bản gọn để xem riêng từng sàn hoặc gộp tất cả
    return { t: Date.now(), price, cs: got.map((b, i) => ({ id: srcs[i].id, ...compactBooks([b], price) })) };
  }
  // vị thế ước tính và tỷ lệ long/short: luôn của sàn đang chọn (Gộp tất cả chỉ gộp sổ lệnh)
  async function loadPos() {
    const n = Math.min(1500, S.period), V = getVenue(), sym = S.coin + "USDT";
    const [kl, d] = await Promise.all([venueBars(sym, "1m", n, V).catch(() => null), venueDerivs(V, sym).catch(() => null)]);
    S.pos = kl && kl.length ? kl : null; S.posV = V;
    S.ls = { acc: d ? d.accLong : null, top: d ? d.topLong : null, missing: d ? d.missing : [], est: !!(kl && kl.length && kl[0].bv == null) };
  }
  async function loadQuick() {
    const V = getVenue();
    if (S.quick && S.quick.V === V && Date.now() - S.quick.t < 5 * 60e3) return;
    const rows = await Promise.all(DEPTH_COINS.map(c => quickLong(V, c).then(p => [c, p], () => [c, null])));
    S.quick = { V, t: Date.now(), rows };
  }
  async function tick(full) {
    if (S.busy) return; S.busy = true;
    try {
      const sn = await snap();
      if (sn) {
        const follow = S.at < 0 || S.at === S.snaps.length - 1, viewing = S.snaps[S.at]; // đang xem lần chụp cũ thì giữ nguyên chỗ đang xem
        S.snaps.push(sn); S.snaps = thinSnaps(S.snaps, sn.t);
        S.at = follow ? S.snaps.length - 1 : Math.max(0, S.snaps.findIndex(x => x.t >= viewing.t));
      }
      if (full || !S.pos || Date.now() - (S.posAt || 0) > 60e3) { await loadPos(); S.posAt = Date.now(); }
      loadQuick().then(renderSide, () => {});
    } finally { S.busy = false; }
    render();
  }

  function data() {
    const sn = S.snaps[S.at]; if (!sn) return null;
    const key = `${sn.t}|${curSrc()}|${S.range}|${S.view}|${S.period}|${S.posAt || 0}`;
    if (S.memo && S.memo.key === key) return withLive(S.memo.D);
    const step = depthStep(sn.price, S.range), depth = unpackDepth(pickCs(sn.cs), step), price = depth.mid || sn.price;
    const pos = S.pos ? entryProfile(S.pos, step) : null;
    // Tăng–Giảm: so với lần chụp cách đó khoảng một "khoảng thời gian", hoặc lần đầu nếu chưa đủ lâu
    let diff = null, base = null;
    if (S.view === "diff") {
      base = S.snaps.slice(0, S.at).reverse().find(x => sn.t - x.t >= S.period * 60e3) || S.snaps[0];
      if (base && base !== sn) diff = depthDiff(depth, unpackDepth(pickCs(base.cs), step));
    }
    const D = { sn, step, depth, price, pos, diff, base };
    S.memo = { key, D };
    return withLive(D);
  }
  // đang xem lần chụp mới nhất thì đường giá chạy theo giao dịch trực tiếp
  const withLive = D => (S.livePx && S.at === S.snaps.length - 1 && Math.abs(S.livePx / D.price - 1) < 0.05 ? { ...D, price: S.livePx } : D);

  function render() { renderBar(); draw(); }
  function draw() {
    const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(320, r.width), H = Math.max(360, r.height);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.body), C = k => css.getPropertyValue(k).trim(), MONO = C("--mono") || "monospace";
    const up = C("--buy") || "#1fb57a", dn = C("--sell") || "#e5484d", ink = C("--ink") || "#fff", muted = C("--muted") || "#999", line = C("--line") || "#2b2b2b";
    ctx.fillStyle = C("--panel") || "#0b0b0b"; ctx.fillRect(0, 0, W, H);
    const D = data(); S.layout = null;
    ctx.font = `12px ${MONO}`; ctx.textBaseline = "middle";
    if (!D) { const rt = $("depthRatios"); if (rt) rt.innerHTML = ""; ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.fillText(S.err.length ? "Chưa lấy được sổ lệnh: " + S.err.join(" · ") : "Đang tải sổ lệnh…", W / 2, H / 2); return; }
    const { step, depth, price, pos, diff } = D, top = 26, bot = 8, ph = H - top - bot, AX = 76, cx = W / 2, half = cx - AX / 2 - 8;
    const lo = Math.floor(price * (1 - S.range / 100) / step), hi = Math.floor(price * (1 + S.range / 100) / step), rows = hi - lo + 1, rowH = ph / rows;
    const yOf = k => top + (hi - k) * rowH, pk = Math.floor(price / step);
    S.layout = { top, rowH, hi, lo, step, cx, AX, D };
    // trái: lệnh chờ hoặc thay đổi lệnh chờ
    let mxL = 0, mxR = 0;
    for (let k = lo; k <= hi; k++) {
      mxL = Math.max(mxL, diff ? Math.abs(diff.get(k) || 0) : (depth.bids.get(k) || 0) + (depth.asks.get(k) || 0));
      if (pos) mxR = Math.max(mxR, S.view === "net" ? Math.abs((pos.long.get(k) || 0) - (pos.short.get(k) || 0)) : (pos.long.get(k) || 0) + (pos.short.get(k) || 0));
    }
    const walls = new Set(topWalls(depth, price, step).map(w => w.k));
    const hgt = Math.max(1, rowH - (rowH > 5 ? 1.5 : 0.5));
    ctx.textAlign = "left"; ctx.font = `bold 11px ${MONO}`;
    for (let k = lo; k <= hi; k++) {
      const y = yOf(k);
      if (diff) {
        const d = diff.get(k) || 0, len = mxL ? Math.abs(d) / mxL * half : 0;
        ctx.fillStyle = d >= 0 ? up : dn; ctx.globalAlpha = 0.8; ctx.fillRect(cx - AX / 2 - len, y, len, hgt); ctx.globalAlpha = 1;
      } else {
        const q = k >= pk ? depth.asks.get(k) || 0 : depth.bids.get(k) || 0, len = mxL ? q / mxL * half : 0;
        ctx.fillStyle = k >= pk ? dn : up; ctx.globalAlpha = 0.8; ctx.fillRect(cx - AX / 2 - len, y, len, hgt); ctx.globalAlpha = 1;
        if (walls.has(k) && q > 0 && rowH >= 6) { ctx.fillStyle = ink; ctx.fillText(`${fmtQ(q)} ${S.coin}`, Math.max(4, cx - AX / 2 - len + 4), y + hgt / 2); }
      }
      if (pos && mxR) {
        const L = pos.long.get(k) || 0, Sh = pos.short.get(k) || 0, sc = (half - 4) / mxR, x0 = cx + AX / 2;
        if (S.view === "net") { const d = L - Sh; ctx.fillStyle = d >= 0 ? up : dn; ctx.globalAlpha = 0.85; ctx.fillRect(x0, y, Math.abs(d) * sc, hgt); }
        else {
          ctx.fillStyle = up; ctx.globalAlpha = k < pk ? 0.9 : 0.35; ctx.fillRect(x0, y, L * sc, hgt);
          ctx.fillStyle = dn; ctx.globalAlpha = k > pk ? 0.9 : 0.35; ctx.fillRect(x0 + L * sc, y, Sh * sc, hgt);
        }
        ctx.globalAlpha = 1;
      }
    }
    // trục giá giữa
    ctx.fillStyle = C("--panel-2") || "#151515"; ctx.fillRect(cx - AX / 2, top, AX, ph);
    ctx.fillStyle = muted; ctx.font = `11px ${MONO}`; ctx.textAlign = "center";
    const every = Math.max(1, Math.ceil(16 / rowH)), dec = step < 1 ? Math.min(6, Math.ceil(-Math.log10(step))) : 0;
    for (let k = hi; k >= lo; k -= every) ctx.fillText((k * step).toFixed(dec), cx, yOf(k) + rowH / 2);
    const yp = yOf(pk) + rowH / 2;
    ctx.strokeStyle = "#33ff66"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, yp); ctx.lineTo(W, yp); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = "#33ff66"; ctx.fillRect(cx - AX / 2, yp - 9, AX, 18); ctx.fillStyle = "#000"; ctx.font = `bold 12px ${MONO}`; ctx.fillText(price.toFixed(dec), cx, yp);
    // tiêu đề hai bên và nhãn góc
    ctx.font = `bold 12px ${MONO}`; ctx.fillStyle = C("--accent") || "#ff9f1c";
    const narrow = W < 760;
    ctx.fillText(diff ? (narrow ? "THÊM / RÚT" : `LỆNH CHỜ THÊM / RÚT so với ${new Date(D.base.t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`) : narrow ? "LỆNH CHỜ" : S.view === "diff" ? "LỆNH CHỜ TRÊN SÀN · Tăng–Giảm cần lần chụp kế tiếp (10 giây)" : "LỆNH CHỜ TRÊN SÀN", cx / 2, 12);
    ctx.fillText(narrow ? "VỊ THẾ ƯỚC TÍNH" : S.view === "net" ? "VỊ THẾ ƯỚC TÍNH: LONG − SHORT" : "VỊ THẾ ƯỚC TÍNH (giá vào lệnh)", cx + cx / 2, 12);
    if (!narrow) {
      ctx.font = `11px ${MONO}`; ctx.fillStyle = muted; ctx.globalAlpha = 0.8;
      ctx.textAlign = "left"; ctx.fillText(diff ? "xanh: lệnh mới đặt thêm · đỏ: lệnh bị rút" : "LỆNH CHỜ BÁN", 6, top + 10); if (!diff) ctx.fillText("LỆNH CHỜ MUA", 6, top + ph - 10);
      ctx.textAlign = "right"; ctx.fillText("LONG ĐANG LỖ · SHORT ĐANG LÃI", W - 6, top + 10); ctx.fillText("LONG ĐANG LÃI · SHORT ĐANG LỖ", W - 6, top + ph - 10);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = line; ctx.strokeRect(0.5, top - 0.5, W - 1, ph + 1);
    renderRatios(D);
  }

  function renderBar() {
    const bar = $("depthBar"); if (!bar) return;
    const chips = (list, cur, attr) => list.map(([v, n]) => `<button class="${String(v) === String(cur) ? "on" : ""}" data-${attr}="${v}">${n}</button>`).join("");
    bar.innerHTML = `<select id="depthCoin" class="tool">${DEPTH_COINS.map(c => { const cm = DEPTH_COMMODITIES.find(x => x[0] === c); return `<option value="${c}"${c === S.coin ? " selected" : ""}>${cm ? `${c}USDT · ${cm[1]}` : c}</option>`; }).join("")}</select>` +
      `<span class="dpgrp"><span class="muted">Sổ lệnh</span><span class="newstabs inl">${chips([["venue", esc(venueName())], [SRC_ALL, "Gộp tất cả"]], S.src, "src")}</span></span>` +
      `<span class="dpgrp"><span class="muted">Khoảng</span><span class="newstabs inl">${chips(DEPTH_PERIODS, S.period, "period")}</span></span>` +
      `<span class="dpgrp"><span class="muted">Giá ±</span><span class="newstabs inl">${chips(DEPTH_RANGES.map(r => [r, r + "%"]), S.range, "range")}</span></span>` +
      `<span class="dpgrp"><span class="muted">Xem</span><span class="newstabs inl">${chips(DEPTH_VIEWS, S.view, "view")}</span></span>`;
    const sl = $("depthSnap"), sn = S.snaps[S.at];
    if (sl) {
      sl.max = Math.max(0, S.snaps.length - 1); sl.value = Math.max(0, S.at);
      $("depthSnapInfo").textContent = sn ? `Lần chụp ${new Date(sn.t).toLocaleTimeString("vi-VN")} · ${S.at + 1}/${S.snaps.length} · tự chụp mỗi 10 giây khi trang đang mở` : "";
    }
  }

  function renderRatios(D) {
    const el = $("depthRatios"); if (!el) return;
    const r = depthRatios(D.depth, D.pos, D.price, D.step, 2);
    const bar = (name, a, la, lb, ca, cb, tip) => a == null ? "" : `<div class="dprow" title="${esc(tip)}"><span class="dpn">${name}</span><div class="dpbar"><i style="width:${(a * 100).toFixed(1)}%;background:${ca}"><b>${la} ${pctTxt(a)}</b></i><i style="width:${(100 - a * 100).toFixed(1)}%;background:${cb}"><b>${pctTxt(1 - a)} ${lb}</b></i></div></div>`;
    const ls = S.ls || {}, vn = venueName(S.posV || getVenue());
    el.innerHTML = bar("Lệnh chờ mua / bán (±2%)", r.bid, "Mua", "Bán", "var(--buy)", "var(--sell)", `Tổng lệnh chờ mua ${fmtQ(r.bidQ)} ${S.coin}, chờ bán ${fmtQ(r.askQ)} ${S.coin} trong khoảng ±2% quanh giá`) +
      bar(`Tài khoản long / short (${vn})`, ls.acc, "Long", "Short", "var(--buy)", "var(--sell)", `Tỷ lệ tài khoản đang long trên ${vn}, số công khai của sàn`) +
      bar(`Vị thế top trader long / short (${vn})`, ls.top, "Long", "Short", "var(--buy)", "var(--sell)", `Tỷ lệ vị thế long của nhóm tài khoản lớn nhất ${vn}`) +
      bar("Vị thế ước tính lãi / lỗ (±2%)", r.win, "Lãi", "Lỗ", "#4aa3ff", "#6b6b6b", ls.est ? `Ước tính theo nến 1 phút của ${vn}: nến tăng tính là long, nến giảm tính là short` : "Ước tính từ khối lượng khớp chủ động theo giá vào lệnh trong khoảng thời gian đang chọn") +
      (ls.missing && ls.missing.length ? `<p class="note">${esc(vn)} không công bố ${ls.missing.map(k => ({ acc: "tỷ lệ tài khoản long/short", top: "tỷ lệ top trader", taker: "tỷ lệ mua/bán chủ động" })[k]).join(", ")}.</p>` : "") +
      `<p class="note">Nguồn sổ lệnh: ${esc(D.depth.ok.join(", ") || "chưa có")}${D.depth.err.length ? ` · lỗi: ${esc(D.depth.err.join("; "))}` : ""}. Mỗi ô gom ${D.step} USD. Vị thế bên phải là ước tính${ls.est ? " theo nến (sàn này không tách mua/bán chủ động)" : ""}, không phải dữ liệu thật của sàn.</p>`;
  }

  function renderSide() {
    const el = $("depthQuick"); if (!el || !S.quick || S.quick.V !== getVenue()) return;
    el.innerHTML = `<h4>Tâm lý nhanh <button class="q" data-g="market-depth">?</button></h4>` + S.quick.rows.map(([c, p]) => p == null ? "" : `<button class="dpq${c === S.coin ? " on" : ""}" data-coin="${c}"><span>${c}</span><span class="dpbar sm"><i style="width:${(p * 100).toFixed(0)}%;background:var(--buy)"><b>${Math.round(p * 100)}%</b></i><i style="width:${(100 - p * 100).toFixed(0)}%;background:var(--sell)"></i></span><small class="${p >= 0.7 ? "dn" : p <= 0.4 ? "up" : "muted"}">${p >= 0.7 ? "Đông long" : p <= 0.4 ? "Đông short" : ""}</small></button>`).join("") +
      (QUICK_VENUES.includes(getVenue()) ? `<p class="note">% tài khoản đang long trên ${esc(venueName())}. Khi đám đông dồn quá về một phía (trên 70% hay dưới 40%), giá hay đi ngược để quét họ.</p>` : `<p class="note">${esc(venueName())} không công bố tỷ lệ tài khoản long/short.</p>`);
  }

  // rê chuột: số liệu của ô giá
  const tip = $("depthTip");
  cv.addEventListener("mousemove", e => {
    const L = S.layout; if (!L || !tip) return;
    const rc = cv.getBoundingClientRect(), y = e.clientY - rc.top, k = L.hi - Math.floor((y - L.top) / L.rowH);
    if (k < L.lo || k > L.hi) { tip.hidden = true; return; }
    const { depth, pos, diff, step } = L.D, p0 = k * step, dec = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
    const L1 = pos ? pos.long.get(k) || 0 : 0, S1 = pos ? pos.short.get(k) || 0 : 0;
    tip.innerHTML = `<b>${p0.toFixed(dec)} – ${(p0 + step).toFixed(dec)}</b><br>Chờ mua ${fmtQ(depth.bids.get(k) || 0)} · chờ bán ${fmtQ(depth.asks.get(k) || 0)} ${S.coin}` +
      (diff ? `<br>Thay đổi ${(diff.get(k) || 0) < 0 ? "−" : "+"}${fmtQ(Math.abs(diff.get(k) || 0))} ${S.coin}` : "") +
      (pos ? `<br>Long ước tính ${fmtQ(L1)} · short ${fmtQ(S1)} ${S.coin}` : "");
    tip.hidden = false; tip.style.left = Math.min(e.clientX + 14, innerWidth - 260) + "px"; tip.style.top = e.clientY + 14 + "px";
  });
  cv.addEventListener("mouseleave", () => { if (tip) tip.hidden = true; });

  document.addEventListener("click", e => {
    if (!S.visible) return;
    const b = e.target.closest("#depthBar [data-src], #depthBar [data-period], #depthBar [data-range], #depthBar [data-view], #depthQuick [data-coin]"); if (!b) return;
    if (b.dataset.src) { if (b.dataset.src !== S.src) { S.src = b.dataset.src; S.snaps = []; S.at = -1; S.memo = null; save(); render(); tick(false); } return; }
    if (b.dataset.period) { S.period = +b.dataset.period; save(); tick(true); return; }
    if (b.dataset.range) { S.range = +b.dataset.range; save(); render(); return; }
    if (b.dataset.view) { S.view = b.dataset.view; save(); render(); return; }
    if (b.dataset.coin) setCoin(b.dataset.coin);
  });
  document.addEventListener("change", e => { if (e.target.id === "depthCoin") setCoin(e.target.value); });
  function setCoin(c) { if (c === S.coin) return; S.coin = c; S.snaps = []; S.at = -1; S.pos = null; S.memo = null; S.livePx = null; save(); render(); tick(true); renderSide(); liveOn(); }
  // giá trực tiếp: giao dịch Binance Futures qua WebSocket, vẽ lại tối đa 4 lần mỗi giây
  let ws = null, wsCoin = null, wsV = null, wsRetry = 0, drawQ = false;
  // đổi sàn ở ô Sàn trên cùng: chụp lại sổ lệnh, vị thế, tâm lý nhanh và giá trực tiếp của sàn mới
  onVenue(() => { S.snaps = []; S.at = -1; S.pos = null; S.memo = null; S.livePx = null; if (S.visible) { render(); tick(true); liveOn(); } });
  function liveOff() { wsCoin = null; if (ws) { const w = ws; ws = null; try { w.close(); } catch { /* bỏ qua */ } } }
  function liveOn() {
    if (typeof WebSocket === "undefined" || (ws && wsCoin === S.coin && wsV === getVenue())) return;
    liveOff(); wsCoin = S.coin;
    const L = liveFeed(getVenue(), S.coin); wsV = getVenue();
    const me = new WebSocket(L.url); ws = me;
    me.onopen = () => { wsRetry = 0; if (L.sub) me.send(L.sub); };
    me.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      const p = L.price(m); if (!(p > 0) || wsCoin !== S.coin) return;
      S.livePx = p;
      if (!drawQ && S.visible && !document.hidden) { drawQ = true; setTimeout(() => { drawQ = false; if (S.visible) draw(); }, 250); }
    };
    me.onclose = () => { if (ws !== me) return; ws = null; if (S.visible) setTimeout(() => { if (S.visible && !ws) liveOn(); }, Math.min(15e3, 1000 * 2 ** wsRetry++)); };
    me.onerror = () => { try { me.close(); } catch { /* bỏ qua */ } };
  }
  const sl = $("depthSnap"); if (sl) sl.oninput = () => { S.at = +sl.value; render(); };
  new ResizeObserver(() => { if (S.visible) render(); }).observe(cv.parentElement);

  return {
    show() { S.visible = true; render(); tick(!S.pos); liveOn(); if (!S.timer) S.timer = setInterval(() => { if (!document.hidden && S.visible) tick(false); }, SNAP_MS); },
    hide() { S.visible = false; liveOff(); if (S.timer) { clearInterval(S.timer); S.timer = null; } },
  };
}
