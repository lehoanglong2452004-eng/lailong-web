// Lai Long Web: FRACTAL — tìm trong lịch sử những đoạn giá + khối lượng giống lúc này, xem sau đó giá đi đâu.
//
// Ý tưởng: thị trường lặp lại cấu trúc (fractal). Mỗi đoạn L nến được mô tả bằng:
//   - hình dạng giá: đường giá đóng cửa so với nến cuối, đo bằng ATR (nên so được giữa giá 1.000 và 100.000,
//     giữa khung 5 phút và 1 giờ: cùng một "hình", khác "cỡ")
//   - hình dạng khối lượng: khối lượng từng nến so với trung bình của đoạn
//   - delta: mua chủ động − bán chủ động trên tổng khối lượng từng nến
//   - bối cảnh khung lớn (lọc): xu hướng H1 và vị trí giá trong biên độ H4
// Khoảng cách giữa hai đoạn = khoảng cách Euclid trên các đặc trưng trên. K đoạn gần nhất (không chồng lên nhau)
// là "mẫu giống nhau". Chỉ dùng những đoạn đã biết kết quả trước thời điểm đang xét (không nhìn trước).
//
// Quy tắc kiểm chứng: vào lệnh ở giá đóng cửa nến cuối của mẫu, chốt lời tp × ATR, cắt lỗ sl × ATR,
// tối đa H nến. Nến chạm cả chốt lời và cắt lỗ tính là thua (thận trọng). Hết giờ: tính theo giá lúc đó.
// Phí và trượt giá trừ vào mỗi lệnh. Kết quả quy ra R (1R = khoảng cắt lỗ).

import { atrSeries } from "./flowtools.js?v=202610132155";

export const HOUR = 36e5;
export const HOLDS = [
  { ms: 30 * 60e3, label: "30 phút" }, { ms: 4 * HOUR, label: "4 giờ" },
  { ms: 24 * HOUR, label: "24 giờ" }, { ms: 48 * HOUR, label: "48 giờ" },
];

// mức độ đủ mẫu theo thông lệ thống kê: < 30 chưa nói được gì, 30 trở lên mới tính được khoảng tin cậy
// tạm dùng, 100 trở lên là ngưỡng thường dùng để tin một tỷ lệ thắng, 300 trở lên thì sai số còn khoảng ±5%.
export const SAMPLE_LEVELS = [
  { min: 0, id: "few", label: "Chưa đủ mẫu", cls: "neg" },
  { min: 30, id: "prelim", label: "Sơ bộ", cls: "muted" },
  { min: 100, id: "ok", label: "Đủ tin", cls: "pos" },
  { min: 300, id: "strong", label: "Chắc hơn", cls: "pos" },
];
export const sampleLevel = n => SAMPLE_LEVELS.reduce((a, s) => (n >= s.min ? s : a), SAMPLE_LEVELS[0]);

// khoảng tin cậy 95% Wilson cho tỷ lệ k/n
export function wilson(k, n, z = 1.96) {
  if (!n) return { p: NaN, lo: NaN, hi: NaN };
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { p, lo: Math.max(0, (c - m) / d), hi: Math.min(1, (c + m) / d) };
}
// tỷ lệ thắng tối thiểu để hoà vốn với chốt lời tp, cắt lỗ sl (đơn vị ATR) và chi phí costR (đơn vị R)
// khoảng tin cậy 95% cho trung bình (kỳ vọng R mỗi lệnh)
export function meanCI(xs, z = 1.96) {
  const n = xs.length; if (!n) return { mean: NaN, lo: NaN, hi: NaN };
  const m = xs.reduce((a, x) => a + x, 0) / n, v = n > 1 ? xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1) : 0, e = z * Math.sqrt(v / n);
  return { mean: m, lo: m - e, hi: m + e };
}
export const breakeven = (tp, sl, costR = 0) => (1 + costR) / (tp / sl + 1);

// gộp nến nhỏ thành nến lớn; mỗi nến lớn ghi thời điểm đóng cửa
export function aggregate(bars, ms, baseMs) {
  if (ms <= baseMs) return bars.map(b => ({ ...b, end: b.t + baseMs }));
  const out = []; let cur = null;
  for (const b of bars) {
    const k = Math.floor(b.t / ms) * ms;
    if (!cur || cur.t !== k) { cur = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, end: k + ms }; out.push(cur); }
    else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.v += b.v; }
  }
  return out;
}
function ema(vals, n) { const k = 2 / (n + 1), out = []; let e = null; for (const v of vals) { e = e === null ? v : e + k * (v - e); out.push(e); } return out; }

// bối cảnh khung lớn tại từng nến, chỉ dùng nến H1/H4 đã đóng cửa:
//   trend: 1 tăng, -1 giảm, 0 đi ngang (EMA20 so với EMA50 trên H1, chênh hơn 0,3 ATR H1)
//   pos: 0 đáy, 1 giữa, 2 đỉnh biên độ 30 nến H4 gần nhất (khoảng 5 ngày)
export function context(bars, baseMs) {
  const n = bars.length, trend = new Array(n).fill(null), pos = new Array(n).fill(null);
  const h1 = aggregate(bars, HOUR, baseMs), h4 = aggregate(bars, 4 * HOUR, baseMs);
  const e20 = ema(h1.map(b => b.c), 20), e50 = ema(h1.map(b => b.c), 50), a1 = atrSeries(h1, 14);
  let k1 = -1, k4 = -1;
  for (let i = 0; i < n; i++) {
    const now = bars[i].t + baseMs;
    while (k1 + 1 < h1.length && h1[k1 + 1].end <= now) k1++;
    while (k4 + 1 < h4.length && h4[k4 + 1].end <= now) k4++;
    if (k1 >= 49 && a1[k1]) { const d = (e20[k1] - e50[k1]) / a1[k1]; trend[i] = d > 0.3 ? 1 : d < -0.3 ? -1 : 0; }
    if (k4 >= 29) {
      let lo = Infinity, hi = -Infinity; for (let j = k4 - 29; j <= k4; j++) { lo = Math.min(lo, h4[j].l); hi = Math.max(hi, h4[j].h); }
      const x = hi > lo ? (bars[i].c - lo) / (hi - lo) : 0.5; pos[i] = x < 1 / 3 ? 0 : x > 2 / 3 ? 2 : 1;
    }
  }
  return { trend, pos };
}

// đặc trưng của mọi đoạn L nến kết thúc tại i (đã nhân trọng số, khoảng cách = Euclid thường)
export function buildIndex(bars, { L = 24, intervalMs, label = "", wVol = 0.35, wDelta = 0.35 } = {}) {
  const n = bars.length, D = 3 * L - 1, feat = new Float32Array(n * D), valid = new Uint8Array(n), atr = atrSeries(bars, 14);
  const hasDelta = bars.some(b => typeof b.bv === "number" && isFinite(b.bv));
  const sp = 1 / Math.sqrt(L - 1), sv = wVol / Math.sqrt(L), sd = wDelta / Math.sqrt(L);
  for (let i = L + 14; i < n; i++) {
    const a = atr[i]; if (!(a > 0)) continue;
    let mv = 0; for (let k = i - L + 1; k <= i; k++) mv += bars[k].v; mv /= L; if (!(mv > 0)) continue;
    const o = i * D, c = bars[i].c; let p = 0;
    for (let k = i - L + 1; k < i; k++) feat[o + p++] = (bars[k].c - c) / a * sp;
    for (let k = i - L + 1; k <= i; k++) feat[o + p++] = Math.max(-3, Math.min(3, Math.log((bars[k].v || 1e-9) / mv))) * sv;
    for (let k = i - L + 1; k <= i; k++) { const b = bars[k]; feat[o + p++] = hasDelta && b.v > 0 ? ((2 * b.bv - b.v) / b.v) * sd : 0; }
    valid[i] = 1;
  }
  return { bars, L, D, feat, valid, atr, intervalMs, label, hasDelta, ctx: context(bars, intervalMs) };
}

// kết quả nếu vào lệnh tại đóng cửa nến j, giữ tối đa H nến
export function outcome(bars, atr, j, H, { tp = 1, sl = 1, costPct = 0 } = {}) {
  const c = bars[j].c, a = atr[j], n = bars.length;
  if (!(a > 0) || j + H >= n) return null;
  const costR = costPct * c / (sl * a);
  const res = side => {
    const s = side === "long" ? 1 : -1, tpPx = c + s * tp * a, slPx = c - s * sl * a;
    for (let k = 1; k <= H; k++) {
      const b = bars[j + k], hitT = s > 0 ? b.h >= tpPx : b.l <= tpPx, hitS = s > 0 ? b.l <= slPx : b.h >= slPx;
      if (hitS) return { r: "loss", R: -1 - costR, k };
      if (hitT) return { r: "win", R: tp / sl - costR, k };
    }
    const f = s * (bars[j + H].c - c) / (sl * a);
    return { r: "time", R: Math.max(-1, Math.min(tp / sl, f)) - costR, k: H };
  };
  return { long: res("long"), short: res("short"), final: (bars[j + H].c - c) / a, costR };
}

function dist(fa, oa, fb, ob, D, cut) {
  let s = 0;
  for (let k = 0; k < D; k++) { const d = fa[oa + k] - fb[ob + k]; s += d * d; if (s > cut) return s; }
  return s;
}

// tìm K đoạn giống đoạn kết thúc tại q.i của chỉ mục q.ix nhất trong các chỉ mục libs.
// capT: chỉ nhận đoạn mà kết quả (H nến sau) đã biết trước thời điểm này.
export function search(q, libs, { K = 100, H = 48, sameCtx = true, capT = Infinity } = {}) {
  const { ix: qix, i: qi } = q, D = qix.D, qo = qi * D, ct = qix.ctx.trend[qi], cp = qix.ctx.pos[qi];
  const cand = [];
  for (const lib of libs) {
    if (lib.D !== D) continue;
    const { bars, valid, feat, ctx, intervalMs } = lib, n = bars.length;
    for (let j = 0; j + H < n; j++) {
      if (!valid[j]) continue;
      if (bars[j + H].t + intervalMs > capT) break;
      if (lib === qix && Math.abs(j - qi) < qix.L) continue;
      if (sameCtx && ct != null && cp != null && (ctx.trend[j] !== ct || ctx.pos[j] !== cp)) continue;
      cand.push({ lib, j, d: dist(qix.feat, qo, feat, j * D, D, Infinity) });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  const out = [], taken = new Map();
  for (const c of cand) {
    const t = taken.get(c.lib) || []; const gap = Math.max(1, c.lib.L >> 1);
    if (t.some(j => Math.abs(j - c.j) < gap)) continue;
    t.push(c.j); taken.set(c.lib, t); out.push(c);
    if (out.length >= K) break;
  }
  return out;
}

// thống kê nhóm mẫu giống nhau
// holds: các mốc thời gian giữ lệnh; quy ra số nến của khung gốc baseMs (mẫu ở khung khác dùng cùng số nến:
// cùng hình thì cùng nhịp, chỉ khác cỡ — đúng tinh thần fractal)
export function summarize(matches, { H = 48, tp = 1, sl = 1, costPct = 0, holds = [], baseMs } = {}) {
  const side = () => ({ n: 0, win: 0, loss: 0, time: 0, sumR: 0, Rs: [] });
  const st = { long: side(), short: side(), n: 0, up: 0, finals: [] };
  for (const m of matches) {
    const o = outcome(m.lib.bars, m.lib.atr, m.j, H, { tp, sl, costPct }); m.out = o; if (!o) continue;
    st.n++; if (o.final > 0) st.up++; st.finals.push(o.final);
    for (const s of ["long", "short"]) { const x = st[s], r = o[s]; x.n++; x[r.r]++; x.sumR += r.R; x.Rs.push(r.R); }
  }
  for (const s of ["long", "short"]) {
    const x = st[s]; x.ci = wilson(x.win, x.n); x.expR = x.n ? x.sumR / x.n : NaN; x.ciR = meanCI(x.Rs);
  }
  const costR = st.n ? matches.reduce((a, m) => a + (m.out ? m.out.costR : 0), 0) / st.n : 0;
  st.breakeven = breakeven(tp, sl, costR); st.costR = costR;
  st.finals.sort((a, b) => a - b); st.median = st.finals.length ? st.finals[st.finals.length >> 1] : NaN;
  st.level = sampleLevel(st.n);
  // bên nào có lợi thế: đủ 30 mẫu và cận dưới khoảng tin cậy 95% của kỳ vọng R (đã trừ phí) vẫn dương.
  // Dùng kỳ vọng R thay vì tỷ lệ thắng vì nhiều lệnh "hết giờ" vẫn có lãi hoặc lỗ một phần.
  st.edge = null;
  for (const s of ["long", "short"]) { const x = st[s]; if (x.n >= 30 && x.ciR.lo > 0 && (!st.edge || x.expR > st[st.edge].expR)) st.edge = s; }
  st.holds = holds.map(h => {
    const fs = []; let up = 0;
    for (const m of matches) {
      const k = Math.max(1, Math.round(h.ms / (baseMs || m.lib.intervalMs))), b = m.lib.bars, a = m.lib.atr[m.j];
      if (m.j + k >= b.length || !(a > 0)) continue;
      const f = (b[m.j + k].c - b[m.j].c) / a; fs.push(f); if (f > 0) up++;
    }
    fs.sort((a, b) => a - b);
    return { ...h, n: fs.length, upPct: fs.length ? up / fs.length * 100 : NaN, median: fs.length ? fs[fs.length >> 1] : NaN, q1: fs.length ? fs[Math.floor(fs.length * 0.25)] : NaN, q3: fs.length ? fs[Math.floor(fs.length * 0.75)] : NaN };
  });
  return st;
}

// đường giá trước và sau của từng mẫu (đơn vị ATR, 0 = giá lúc vào), để vẽ quạt
export function paths(matches, L, H) {
  return matches.map(m => {
    const b = m.lib.bars, a = m.lib.atr[m.j], c = b[m.j].c, p = [];
    for (let k = -L + 1; k <= H; k++) { const x = b[m.j + k]; p.push(x ? (x.c - c) / a : null); }
    return p;
  });
}
export function quantiles(ps, qs = [0.1, 0.25, 0.5, 0.75, 0.9]) {
  const len = ps.length ? ps[0].length : 0, out = qs.map(() => new Array(len).fill(null));
  for (let k = 0; k < len; k++) {
    const col = ps.map(p => p[k]).filter(v => v != null).sort((a, b) => a - b); if (!col.length) continue;
    qs.forEach((q, qi) => { out[qi][k] = col[Math.min(col.length - 1, Math.floor(q * col.length))]; });
  }
  return out;
}

// Kiểm chứng ngoài mẫu (walk-forward): 70% dữ liệu đầu chỉ làm "thư viện". Trên 30% sau, tại từng điểm thử
// (cách nhau H nến để các lệnh không chồng nhau), chỉ tìm mẫu trong quá khứ của điểm đó, quyết định
// LONG / SHORT / đứng ngoài như người dùng thật, rồi ghi kết quả thật. So với vào lệnh ở mọi điểm thử.
export async function walkForward(ix, { K = 100, H = 48, tp = 1, sl = 1, costPct = 0, sameCtx = true, split = 0.7, maxTests = 300, minN = 30, onProgress } = {}) {
  const bars = ix.bars, n = bars.length, start = Math.max(ix.L + 60, Math.floor(n * split));
  let step = Math.max(1, H); const span = n - H - 1 - start;
  if (span <= 0) return null;
  if (span / step > maxTests) step = Math.ceil(span / maxTests);
  const trades = [], base = { long: [], short: [], t: [] }, costs = []; let tests = 0, skipped = 0;
  for (let i = start; i < n - H - 1; i += step) {
    if (!ix.valid[i]) continue;
    const o = outcome(bars, ix.atr, i, H, { tp, sl, costPct }); if (!o) continue;
    tests++; base.long.push(o.long.R); base.short.push(o.short.R); base.t.push(bars[i].t + ix.intervalMs); costs.push(o.costR);
    const m = search({ ix, i }, [ix], { K, H, sameCtx, capT: bars[i].t + ix.intervalMs });
    const s = summarize(m, { H, tp, sl, costPct });
    let side = null;
    // giống cách đọc trên màn hình: đủ mẫu, kỳ vọng dương và tỷ lệ thắng trên mức hoà vốn
    if (s.n >= minN) for (const sd of ["long", "short"]) if (s[sd].expR > 0 && (!side || s[sd].expR > s[side].expR)) side = sd;
    if (side) trades.push({ i, t: bars[i].t + ix.intervalMs, side, ...o[side], n: s.n, expR: s[side].expR }); else skipped++;
    if (onProgress && tests % 10 === 0) { onProgress(i - start, span); await new Promise(r => setTimeout(r, 0)); }
  }
  const agg = arr => { const w = arr.filter(x => x.r === "win").length, R = arr.reduce((a, x) => a + x.R, 0); return { n: arr.length, win: w, wr: arr.length ? arr.filter(x => x.R > 0).length / arr.length : NaN, ci: wilson(w, arr.length), avgR: arr.length ? R / arr.length : NaN, ciR: meanCI(arr.map(x => x.R)), totalR: R }; };
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  return {
    tests, skipped, trades, res: agg(trades), long: agg(trades.filter(t => t.side === "long")), short: agg(trades.filter(t => t.side === "short")),
    baseLong: mean(base.long), baseShort: mean(base.short), base, from: bars[start].t, to: bars[n - 1].t, step,
    breakeven: breakeven(tp, sl, mean(costs) || 0),
  };
}

// Đường cong vốn của một chuỗi lệnh (theo thứ tự thời gian), mỗi lệnh rủi ro riskPct vốn (1R = riskPct).
//   wr: tỷ lệ lệnh có lãi sau phí · pf: tổng R lãi / tổng R lỗ · maxDDR: sụt giảm lớn nhất tính bằng R
//   (từ đỉnh cao nhất của tổng R tới đáy sau đó) · maxDDPct / finalPct: vốn tính lãi kép theo riskPct
export function equityStats(Rs, riskPct = 1) {
  const r = riskPct / 100, curve = [0], eq = [1];
  let sum = 0, peak = 0, dd = 0, e = 1, ePeak = 1, eDD = 0, gp = 0, gl = 0, wins = 0, streak = 0, maxStreak = 0;
  for (const R of Rs) {
    sum += R; curve.push(sum); peak = Math.max(peak, sum); dd = Math.max(dd, peak - sum);
    e *= 1 + R * r; eq.push(e); ePeak = Math.max(ePeak, e); eDD = Math.max(eDD, 1 - e / ePeak);
    if (R > 0) { gp += R; wins++; streak = 0; } else { gl -= R; streak++; maxStreak = Math.max(maxStreak, streak); }
  }
  const n = Rs.length;
  return {
    n, wins, wr: n ? wins / n : NaN, pf: gl > 0 ? gp / gl : gp > 0 ? Infinity : NaN, totalR: sum, avgR: n ? sum / n : NaN,
    maxDDR: dd, maxDDPct: eDD * 100, finalPct: (e - 1) * 100, maxLossStreak: maxStreak, curve, eq, ci: meanCI(Rs),
  };
}
