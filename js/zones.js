// Nhãn lệnh chờ lớn viết tắt tiếng Anh và vùng chờ mua/bán cho khung lớn.
// ASK = chờ bán, BID = chờ mua. Số kiểu en-US (182.4 · 1,850), tiền gọn $K/$M/$B.

const en = (v, d) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export function fmtQtyEn(q) { const a = Math.abs(q); return en(q, a >= 1000 ? 0 : a >= 1 ? 1 : a >= 0.01 ? 2 : 4); }
export function fmtMoneyEn(usd) {
  const a = Math.abs(usd); if (!isFinite(usd)) return "-";
  if (a >= 1e9) return `$${en(usd / 1e9, 1)}B`;
  if (a >= 1e6) return `$${en(usd / 1e6, 1)}M`;
  if (a >= 1e3) return `$${en(usd / 1e3, 0)}K`;
  return `$${en(usd, 0)}`;
}
export const fmtPriceEn = (p, d = 0) => en(p, d);
const SIDE = s => (s === "bid" ? "BID" : "ASK");
const unit = coin => (coin ? " " + coin : "");
// "ASK 182.4 BTC · $11.9M"
export function wallTag(w, coin) { return `${SIDE(w.side)} ${fmtQtyEn(w.q)}${unit(coin)} · ${fmtMoneyEn(w.q * w.p)}`; }
// "× PULLED 95.0 BTC"
export function pulledTag(e, coin) { return `× PULLED ${fmtQtyEn(e.q)}${unit(coin)}`; }
// "ASK 69,832–70,799 · 1,850 BTC · $130.1M"; vùng chỉ có trong lịch sử: "BID 61,000–61,250 · 4× WALL · 30D"
export function zoneTag(z, coin, dec = 0) {
  const r = `${SIDE(z.side)} ${fmtPriceEn(z.lo, dec)}–${fmtPriceEn(z.hi, dec)}`;
  if (z.q > 0) return `${r} · ${fmtQtyEn(z.q)}${unit(coin)} · ${fmtMoneyEn(z.q * (z.lo + z.hi) / 2)}`;
  return `${r} · ${z.n}× WALL · ${z.days}D`;
}

// bước giá "đẹp" gần x nhất: 1, 2, 2.5, 5 × 10^k
export function niceStep(x) {
  if (!(x > 0)) return 0;
  const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e;
  return (f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * e;
}
// độ rộng một nấc gộp sổ lệnh theo khung đang xem (phần trăm giá)
export const ZONE_PCT = { "1h": 0.001, "4h": 0.002, "1d": 0.003, "1w": 0.004, "1M": 0.008 };
export const zoneStep = (interval, mid) => (ZONE_PCT[interval] && mid > 0 ? niceStep(mid * ZONE_PCT[interval]) : 0);

// Gộp sổ lệnh theo nấc thô. Nấc mạnh (≥ mult × trung vị các nấc cùng phía, hoặc thuộc top `topN` nấc và ≥ 1,5 × trung vị) thành vùng;
// nấc mạnh liền nhau nhập làm một.
// bids/asks: [[giá, khối lượng], ...]. Trả về [{side, lo, hi, q, k}] (k = q / vùng lớn nhất, 0..1), lớn trước.
export function bookZones(bids, asks, step, { mult = 3, max = 8, topN = 2 } = {}) {
  if (!(step > 0)) return [];
  const out = [];
  for (const [side, rows] of [["bid", bids || []], ["ask", asks || []]]) {
    const m = new Map();
    for (const [p, q] of rows) { if (!(q > 0)) continue; const k = Math.floor(p / step + 1e-9); m.set(k, (m.get(k) || 0) + q); }
    if (m.size < 3) continue;
    const vals = [...m.values()].sort((a, b) => a - b), med = vals[Math.floor(vals.length / 2)];
    const rank = vals[Math.max(0, vals.length - topN)], strong = [...m.entries()].filter(([, q]) => q >= mult * med || (q >= rank && q >= 1.5 * med)).sort((a, b) => a[0] - b[0]);
    let cur = null;
    for (const [k, q] of strong) {
      if (cur && k === cur.k1 + 1) { cur.k1 = k; cur.q += q; continue; }
      cur = { side, k0: k, k1: k, q }; out.push(cur);
    }
  }
  const zs = out.map(z => ({ side: z.side, lo: z.k0 * step, hi: (z.k1 + 1) * step, q: z.q })).sort((a, b) => b.q - a.q);
  const per = { bid: 0, ask: 0 }, keep = zs.filter(z => ++per[z.side] <= max), top = keep.length ? keep[0].q : 0;
  return keep.map(z => ({ ...z, k: top ? z.q / top : 1 }));
}

// Vùng từng có tường lớn (nhật ký lưu trên máy): gộp theo nấc, giữ nấc có ≥ minN lần xuất hiện trong `days` ngày.
// log: [{t, side, price, q}]. Trả về [{side, lo, hi, q: 0, n, qSum, days, hist: true}].
export function historyZones(log, step, now = Date.now(), { days = 30, minN = 2, max = 6 } = {}) {
  if (!(step > 0) || !log || !log.length) return [];
  const m = new Map(), t0 = now - days * 864e5;
  for (const e of log) {
    if (!(e.t >= t0) || !(e.price > 0)) continue;
    const k = Math.floor(e.price / step + 1e-9), key = `${e.side}:${k}`, x = m.get(key) || { side: e.side, k, n: 0, qSum: 0 };
    x.n++; x.qSum += e.q || 0; m.set(key, x);
  }
  const list = [...m.values()].filter(x => x.n >= minN).sort((a, b) => b.n - a.n || b.qSum - a.qSum);
  const per = { bid: 0, ask: 0 };
  return list.filter(x => ++per[x.side] <= max).map(x => ({ side: x.side, lo: x.k * step, hi: (x.k + 1) * step, q: 0, n: x.n, qSum: x.qSum, days, hist: true }));
}
// gộp vùng sổ lệnh hiện tại với vùng lịch sử: vùng lịch sử trùng vùng sổ lệnh thì chỉ ghi số lần vào vùng sổ lệnh
export function mergeZones(book, hist) {
  const out = book.map(z => ({ ...z }));
  for (const h of hist) {
    const hit = out.find(z => z.side === h.side && h.lo < z.hi && h.hi > z.lo);
    if (hit) hit.n = (hit.n || 0) + h.n; else out.push({ ...h, k: 0.3 });
  }
  return out;
}

// nhật ký tường lớn theo mã, lưu trên máy (giới hạn số dòng và số ngày)
export const HIST_MAX = 3000, HIST_DAYS = 30;
const histKey = sym => `lailong.wallhist.${sym}`;
export function loadWallHist(sym, store = globalThis.localStorage) {
  try { const a = JSON.parse(store.getItem(histKey(sym)) || "[]"); return Array.isArray(a) ? a.filter(e => e && e.t && e.price > 0) : []; } catch { return []; }
}
export function trimWallHist(list, now = Date.now()) {
  const t0 = now - HIST_DAYS * 864e5, a = list.filter(e => e.t >= t0);
  return a.length > HIST_MAX ? a.slice(a.length - HIST_MAX) : a;
}
export function saveWallHist(sym, list, store = globalThis.localStorage) {
  try { store.setItem(histKey(sym), JSON.stringify(list.map(e => ({ t: e.t, side: e.side, price: e.price, q: Math.round(e.q * 1e4) / 1e4 })))); } catch { /* bộ nhớ đầy hoặc bị chặn */ }
}

// Xếp nhãn so le: giữ thứ tự theo giá, cách nhau ít nhất `gap`, nằm trong [top, bottom]. Nhiều quá thì thu gap (tối thiểu minGap).
// items: [{y}], trả về cùng mảng đã gán ty.
export function staggerTags(items, top, bottom, gap = 20, minGap = 15) {
  const it = items.slice().sort((a, b) => a.y - b.y), n = it.length; if (!n) return items;
  const span = bottom - top; if (n > 1 && (n - 1) * gap > span) gap = Math.max(minGap, span / (n - 1));
  for (let i = 0; i < n; i++) it[i].ty = Math.max(top, i ? Math.max(it[i].y, it[i - 1].ty + gap) : it[i].y);
  for (let i = n - 1; i >= 0; i--) { const lim = i === n - 1 ? bottom : it[i + 1].ty - gap; if (it[i].ty > lim) it[i].ty = lim; }
  return items;
}
