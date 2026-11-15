// Chỉ báo của nút ƒx trên thanh công cụ dọc: VWAP, CVD, COT index, Seasonal, ATR; và hồ sơ khối lượng từng nến cho khung tuần, tháng.
// Hàm thuần, không đụng tới trang: dễ kiểm thử.
import { barStart } from "./util.js?v=202611150608";

export const IND_KEYS = ["vwap", "cvd", "cot", "seasonal", "atr"];
export const IND_NAMES = { vwap: "VWAP", cvd: "CVD", cot: "COT index", seasonal: "Seasonal", atr: "ATR" };

// VWAP neo theo kỳ: khung nhỏ theo ngày, 1h–4h theo tuần, 1D theo tháng, tuần/tháng theo năm
export function vwapAnchor(interval) { return { "1h": "week", "4h": "week", "1d": "month", "1w": "year", "1M": "year" }[interval] || "day"; }
export function periodKey(t, anchor) {
  if (anchor === "week") return barStart(t, "1w");
  const d = new Date(t);
  if (anchor === "month") return d.getUTCFullYear() * 12 + d.getUTCMonth();
  if (anchor === "year") return d.getUTCFullYear();
  return Math.floor(t / 864e5);
}
// VWAP và dải ±1 độ lệch chuẩn (theo khối lượng), làm mới đầu mỗi kỳ
export function vwapSeries(bars, anchor = "day") {
  const vwap = [], up = [], dn = [];
  let key = null, sv = 0, spv = 0, sp2v = 0;
  for (const b of bars) {
    const k = periodKey(b.t, anchor); if (k !== key) { key = k; sv = spv = sp2v = 0; }
    const tp = (b.h + b.l + b.c) / 3, v = b.v || 0; sv += v; spv += tp * v; sp2v += tp * tp * v;
    if (!sv) { vwap.push(tp); up.push(tp); dn.push(tp); continue; }
    const m = spv / sv, sd = Math.sqrt(Math.max(0, sp2v / sv - m * m));
    vwap.push(m); up.push(m + sd); dn.push(m - sd);
  }
  return { vwap, up, dn };
}
// delta của nến: ưu tiên delta footprint, không có thì từ khối lượng mua chủ động
export const barDelta = b => (b.d != null ? b.d : b.bv != null ? 2 * b.bv - (b.v || 0) : 0);
// CVD cộng dồn trên các nến đang tải
export function cvdSeries(bars) { let c = 0; return bars.map(b => (c += barDelta(b))); }
// ATR kiểu Wilder
export function atrSeries(bars, n = 14) {
  const out = []; let atr = null, sum = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], pc = i ? bars[i - 1].c : b.c, tr = Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
    if (i < n) { sum += tr; out.push(i === n - 1 ? (atr = sum / n) : null); continue; }
    atr = (atr * (n - 1) + tr) / n; out.push(atr);
  }
  return out;
}
// COT index: vị thế ròng của quỹ lớn (đầu cơ) so với min–max của n tuần gần nhất, 0..100
// hist: [[ngày "YYYY-MM-DD", ròng đầu cơ, ròng thương mại], ...] theo thời gian tăng dần
export function cotIndex(hist, n = 26) {
  const rows = (hist || []).filter(r => r && r[1] != null).map(r => ({ t: Date.parse(r[0]), s: +r[1] })).filter(r => isFinite(r.t)).sort((a, b) => a.t - b.t), out = [];
  for (let i = n - 1; i < rows.length; i++) {
    let lo = Infinity, hi = -Infinity; for (let j = i - n + 1; j <= i; j++) { lo = Math.min(lo, rows[j].s); hi = Math.max(hi, rows[j].s); }
    out.push({ t: rows[i].t, v: hi > lo ? (rows[i].s - lo) / (hi - lo) * 100 : 50 });
  }
  return out;
}
// gán chuỗi theo tuần (hoặc bất kỳ chuỗi {t, v}) lên nến: giá trị gần nhất đã có tại thời điểm nến
export function stepOnBars(bars, pts) {
  const out = []; let j = -1;
  for (const b of bars) { while (j + 1 < pts.length && pts[j + 1].t <= b.t) j++; out.push(j >= 0 ? pts[j].v : null); }
  return out;
}

const doyOf = t => { const d = new Date(t); return Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5); };
// Seasonal: đường trung bình theo ngày trong năm của `years` năm trọn gần nhất (lãi luỹ kế % từ đầu năm)
// daily: nến ngày tăng dần. Trả về { avg: [366] hoặc null, years: số năm dùng, stat(t, days) }
export function seasonal(daily, { years = 5, now = Date.now() } = {}) {
  const yNow = new Date(now).getUTCFullYear(), by = new Map();
  for (const b of daily || []) { const y = new Date(b.t).getUTCFullYear(); if (y >= yNow || y < yNow - years) continue; if (!by.has(y)) by.set(y, []); by.get(y).push(b); }
  const paths = [];
  for (const [, bs] of by) {
    if (bs.length < 300) continue; // năm thiếu dữ liệu
    const p0 = bs[0].o || bs[0].c, path = new Array(366).fill(null);
    for (const b of bs) path[Math.min(365, doyOf(b.t))] = (b.c / p0 - 1) * 100;
    for (let i = 1; i < 366; i++) if (path[i] == null) path[i] = path[i - 1]; // lấp ngày trống (năm không nhuận)
    if (path[0] == null) path[0] = 0;
    paths.push(path);
  }
  if (!paths.length) return { avg: null, years: 0, paths };
  const avg = Array.from({ length: 366 }, (_, i) => paths.reduce((s, p) => s + p[i], 0) / paths.length);
  return { avg, years: paths.length, paths };
}
export const seasonalAt = (S, t) => (S && S.avg ? S.avg[Math.min(365, doyOf(t))] : null);
// thống kê `days` ngày tới từ ngày t ở các năm trước: số năm tăng / tổng, lãi trung bình %
export function seasonalStat(S, t, days = 7) {
  if (!S || !S.paths || !S.paths.length) return null;
  const a = Math.min(365, doyOf(t)), b = Math.min(365, a + days); let up = 0, sum = 0;
  for (const p of S.paths) { const r = ((1 + p[b] / 100) / (1 + p[a] / 100) - 1) * 100; sum += r; if (r > 0) up++; }
  return { up, n: S.paths.length, avg: sum / S.paths.length };
}

// Hồ sơ khối lượng của từng nến tuần/tháng dựng từ nến nhỏ hơn: khối lượng mỗi nến nhỏ rải đều trên khoảng cao–thấp của nó.
// Trả về Map(t nến lớn → { step, k0, vals, poc }) với vals[i] = khối lượng ở nấc k0 + i.
export function candleProfiles(bars, sub, { rows = 14 } = {}) {
  const out = new Map(); if (!bars.length || !sub || !sub.length) return out;
  let j = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], tEnd = i + 1 < bars.length ? bars[i + 1].t : Infinity;
    while (j < sub.length && sub[j].t < b.t) j++;
    const rng = b.h - b.l; if (!(rng > 0)) continue;
    const step = rng / rows, vals = new Array(rows).fill(0); let any = false;
    for (let k = j; k < sub.length && sub[k].t < tEnd; k++) {
      const s = sub[k], lo = Math.max(b.l, s.l), hi = Math.min(b.h, s.h), v = s.v || 0; if (!(v > 0)) continue;
      any = true;
      if (!(hi > lo)) { vals[Math.min(rows - 1, Math.max(0, Math.floor((s.c - b.l) / step)))] += v; continue; }
      const r0 = Math.floor((lo - b.l) / step), r1 = Math.min(rows - 1, Math.floor((hi - b.l) / step - 1e-9)), per = v / (hi - lo);
      for (let r = Math.max(0, r0); r <= r1; r++) { const a = Math.max(lo, b.l + r * step), c = Math.min(hi, b.l + (r + 1) * step); if (c > a) vals[r] += per * (c - a); }
    }
    if (!any) continue;
    let poc = 0; for (let r = 1; r < rows; r++) if (vals[r] > vals[poc]) poc = r;
    out.set(b.t, { lo: b.l, step, vals, poc });
  }
  return out;
}
// khung nhỏ hơn dùng để dựng hồ sơ từng nến
export const SUB_IV = { "1w": "4h", "1M": "1d" };
