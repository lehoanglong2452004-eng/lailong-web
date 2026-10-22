// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: công cụ dòng lệnh nâng cao (không vẽ, để kiểm thử được).
//
// - vpin: mức "độc" của dòng lệnh (VPIN), tính trên nến bằng khối lượng mua/bán chủ động
// - playerGroup / groupFlow: tách lệnh gốc thành cá voi / vừa / nhỏ lẻ và delta của từng nhóm
// - algoRuns: dấu vết thuật toán chia lệnh (cùng phía, cùng kích thước, nhịp đều như TWAP)
// - signalScore: chấm điểm tín hiệu 0–100 (hấp thụ + S/R đã test + CVD phân kỳ + funding)
//   và thống kê tỷ lệ đúng theo từng mức điểm, so với tỷ lệ nền
// Mọi tín hiệu chỉ dùng dữ liệu tới hết nến đó; phần "sau đó" chỉ để thống kê.

const DAY = 864e5;

function buyVol(b) {
  if (typeof b.bv === "number" && isFinite(b.bv)) return b.bv;
  const r = b.h - b.l; return r > 0 ? b.v * (0.5 + 0.5 * (b.c - b.o) / r) : b.v / 2;
}
export function atrSeries(bars, n = 14) {
  const out = new Array(bars.length).fill(null); let a = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], pc = i ? bars[i - 1].c : b.c;
    const tr = Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
    a = a === null ? tr : (a * (n - 1) + tr) / n; out[i] = i >= n - 1 ? a : null;
  }
  return out;
}

// ---------- VPIN ----------
// Chia khối lượng thành các "giỏ" bằng nhau (mặc định 1/50 khối lượng trung bình một ngày,
// nhỏ hơn nếu dữ liệu ngắn để luôn có ít nhất 4 × 50 giỏ).
// Mỗi giỏ: |mua − bán| / khối lượng giỏ. VPIN = trung bình 50 giỏ gần nhất (0 = cân bằng, 1 = một chiều).
// VPIN cao: một phía đang ép rất mạnh, bên tạo lập thị trường dễ rút lệnh, biến động thường tăng theo.
export function vpin(bars, { buckets = 50, perDay = 50, intervalMs = 60e3 } = {}) {
  const n = bars.length, out = new Array(n).fill(null); if (!n) return out;
  let tot = 0; for (const b of bars) tot += b.v || 0;
  const days = Math.max(intervalMs * n / DAY, intervalMs / DAY), V = Math.min(tot / days / perDay, tot / (buckets * 4));
  if (!(V > 0)) return out;
  const imb = []; let cb = 0, cs = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i], v = b.v || 0; if (v <= 0) { if (imb.length >= buckets) out[i] = sum / buckets; continue; }
    const buy = Math.min(v, Math.max(0, buyVol(b))), sell = v - buy; let rem = v, guard = 0;
    while (rem > 1e-12 && guard++ < 5000) {
      const take = Math.min(V - (cb + cs), rem), f = take / v;
      cb += buy * f; cs += sell * f; rem -= take;
      if (cb + cs >= V * (1 - 1e-9)) {
        const x = Math.abs(cb - cs) / V; imb.push(x); sum += x;
        if (imb.length > buckets) sum -= imb[imb.length - 1 - buckets];
        cb = cs = 0;
      }
    }
    if (imb.length >= buckets) out[i] = sum / buckets;
  }
  return out;
}

// phân vị của giá trị cuối trong cả chuỗi (0–100)
export function percentileOf(values, x) {
  const v = values.filter(y => y != null && isFinite(y)); if (!v.length || x == null) return null;
  let below = 0; for (const y of v) if (y <= x) below++;
  return below / v.length * 100;
}

// ---------- nhóm người chơi ----------
// Ngưỡng theo phân vị kích thước lệnh gốc của chính mã đó: cá voi = top 0,5%, vừa = top 5%.
export const GROUPS = [
  { id: "whale", label: "Cá voi", short: "Voi", color: "#f5c542" },
  { id: "mid", label: "Vừa", short: "Vừa", color: "#2f8cff" },
  { id: "retail", label: "Nhỏ lẻ", short: "Lẻ", color: "#9aa0a6" },
];
export function playerGroup(q, big, mid) { return q >= big ? "whale" : q >= mid ? "mid" : "retail"; }

// delta của từng nhóm trong từng nến. lists: các mảng lệnh gốc (đã sắp theo thời gian trong từng mảng)
export function groupFlow(bars, lists, { big, mid, intervalMs }) {
  const n = bars.length, out = bars.map(() => null); if (!n || !isFinite(big) || !isFinite(mid)) return out;
  const t0 = bars[0].t, idx = new Map(); bars.forEach((b, i) => idx.set(b.t, i));
  for (const list of lists) for (const p of list) {
    if (p.t < t0) continue;
    const i = idx.get(Math.floor(p.t / intervalMs) * intervalMs); if (i == null) continue;
    const e = out[i] || (out[i] = { whale: 0, mid: 0, retail: 0, whaleV: 0, midV: 0, retailV: 0 }), g = playerGroup(p.q, big, mid);
    e[g] += p.side === "buy" ? p.q : -p.q; e[g + "V"] += p.q;
  }
  return out;
}

// ---------- dấu vết thuật toán chia lệnh (TWAP / mua rải đều) ----------
// Tìm chuỗi lệnh gốc cùng phía, cùng kích thước (3 chữ số có nghĩa), cách nhau đều đặn.
// cv = độ lệch chuẩn / trung bình của khoảng cách giữa các lệnh: càng nhỏ càng đều (máy đặt).
export function algoRuns(lists, { minCount = 6, cvMax = 0.3, tol = 0.35, minGapMs = 400, maxGapMs = 10 * 60e3, minQ = 0 } = {}) {
  const groups = new Map();
  for (const list of lists) for (const p of list) {
    if (!(p.q > 0) || p.q < minQ) continue;
    const k = p.side + ":" + Number(p.q.toPrecision(3));
    let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(p);
  }
  const runs = [];
  const finish = run => {
    if (run.length < minCount) return;
    const gaps = []; for (let i = 1; i < run.length; i++) gaps.push(run[i].t - run[i - 1].t);
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length, sd = Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length), cv = m ? sd / m : 1;
    if (cv > cvMax) return;
    let q = 0, pv = 0, pMin = Infinity, pMax = -Infinity;
    for (const p of run) { q += p.q; pv += p.vwap * p.q; pMin = Math.min(pMin, p.vwap); pMax = Math.max(pMax, p.vwap); }
    runs.push({ side: run[0].side, size: run[0].q, n: run.length, gapMs: m, cv, t0: run[0].t, t1: run[run.length - 1].t, total: q, vwap: pv / q, pMin, pMax, first: run[0].vwap, last: run[run.length - 1].vwap, prints: run });
  };
  for (const g of groups.values()) {
    if (g.length < minCount) continue;
    g.sort((a, b) => a.t - b.t);
    let run = [g[0]], mean = 0;
    for (let i = 1; i < g.length; i++) {
      const p = g[i], gap = p.t - run[run.length - 1].t;
      if (gap < minGapMs) continue; // cùng một đợt quét, không phải nhịp
      const fits = gap <= maxGapMs && (run.length < 2 || Math.abs(gap - mean) <= tol * mean);
      if (fits) { run.push(p); const k = run.length - 1; mean = (mean * (k - 1) + gap) / k; continue; }
      finish(run);
      run = gap <= maxGapMs ? [run[run.length - 1], p] : [p]; mean = run.length === 2 ? gap : 0;
    }
    finish(run);
  }
  return runs.sort((a, b) => b.t1 - a.t1);
}

// ---------- chấm điểm tín hiệu tổng hợp ----------
// Mỗi nến có điểm cho chiều MUA và chiều BÁN, từ 4 thành phần:
//   hấp thụ (tối đa 35) · chạm hỗ trợ/kháng cự đã test ≥ 2 lần (25) · CVD phân kỳ (25) · funding lệch (15)
// Điểm = tổng / tổng tối đa có dữ liệu × 100. Hỗ trợ/kháng cự lấy từ đỉnh/đáy đã xác nhận trước nến đó.
// "Đúng" = giá đi được moveAtr ATR theo hướng tín hiệu trước khi đi ngược moveAtr ATR, trong horizon nến.
export const SCORE_PARTS = [
  { id: "absorb", label: "Hấp thụ", max: 35 },
  { id: "sr", label: "S/R đã test", max: 25 },
  { id: "div", label: "CVD phân kỳ", max: 25 },
  { id: "fund", label: "Funding", max: 15 },
];
export function signalScore(bars, { absorb = [], pivot = 3, srBack = 300, srAtr = 0.35, divBack = 20, fundBack = 500, minScore = 20, horizon = 10, moveAtr = 1 } = {}) {
  const n = bars.length, atr = atrSeries(bars), events = [];
  if (n < 60) return { events, buckets: [], base: null, hasFund: false };
  const absAt = new Map(); for (const e of absorb) absAt.set(e.i, e);
  const cvd = []; let c = 0; for (const b of bars) { c += typeof b.d === "number" ? b.d : 2 * buyVol(b) - b.v; cvd.push(c); }
  const fund = []; let lastF = null; for (const b of bars) { if (b.fund != null) lastF = b.fund; fund.push(lastF); }
  const hasFund = fund.some(f => f != null);
  const lows = [], highs = []; // đáy/đỉnh đã xác nhận: {i, p}
  for (let i = 60; i < n; i++) {
    // đỉnh/đáy tại j = i - pivot được xác nhận khi đã có đủ pivot nến sau nó (tới nến i)
    const j = i - pivot;
    if (j >= pivot) {
      let isL = true, isH = true;
      for (let k = j - pivot; k <= j + pivot; k++) { if (k === j) continue; if (bars[k].l <= bars[j].l) isL = false; if (bars[k].h >= bars[j].h) isH = false; }
      if (isL) lows.push({ i: j, p: bars[j].l }); if (isH) highs.push({ i: j, p: bars[j].h });
    }
    const b = bars[i], a = atr[i]; if (!a) continue;
    const part = { buy: { absorb: 0, sr: 0, div: 0, fund: 0 }, sell: { absorb: 0, sr: 0, div: 0, fund: 0 } }, why = { buy: [], sell: [] };
    const ab = absAt.get(i);
    if (ab) { const side = ab.side === "sell" ? "buy" : "sell", pts = 15 + 20 * Math.min(100, ab.strength) / 100; part[side].absorb = pts; why[side].push(`${ab.side === "sell" ? "hấp thụ lực bán ở đáy" : "hấp thụ lực mua ở đỉnh"} (độ mạnh ${ab.strength})`); }
    const touches = (list, price) => { let k = 0; for (let x = list.length - 1; x >= 0 && list[x].i >= i - srBack; x--) if (list[x].i < i && Math.abs(list[x].p - price) <= srAtr * a) k++; return k; };
    const ts = touches(lows, b.l), tr = touches(highs, b.h);
    if (ts >= 2 && b.c > b.l) { part.buy.sr = 25 * Math.min(1, (ts - 1) / 2); why.buy.push(`chạm hỗ trợ đã test ${ts} lần`); }
    if (tr >= 2 && b.c < b.h) { part.sell.sr = 25 * Math.min(1, (tr - 1) / 2); why.sell.push(`chạm kháng cự đã test ${tr} lần`); }
    // CVD phân kỳ: giá tạo đáy thấp hơn đáy trước trong divBack nến nhưng CVD lại cao hơn (lực bán yếu đi)
    let jl = -1, jh = -1;
    for (let k = Math.max(0, i - divBack); k <= i - 3; k++) { if (jl < 0 || bars[k].l < bars[jl].l) jl = k; if (jh < 0 || bars[k].h > bars[jh].h) jh = k; }
    if (jl >= 0 && b.l < bars[jl].l && cvd[i] > cvd[jl]) { part.buy.div = 25; why.buy.push("giá thủng đáy cũ nhưng CVD cao hơn"); }
    if (jh >= 0 && b.h > bars[jh].h && cvd[i] < cvd[jh]) { part.sell.div = 25; why.sell.push("giá vượt đỉnh cũ nhưng CVD thấp hơn"); }
    if (hasFund && fund[i] != null) {
      const hist = []; for (let k = Math.max(0, i - fundBack); k < i; k++) if (fund[k] != null) hist.push(fund[k]);
      if (hist.length >= 50) {
        let below = 0; for (const f of hist) if (f < fund[i]) below++;
        const r = below / hist.length;
        if (r >= 0.9 && fund[i] > 0) { part.sell.fund = r >= 0.95 ? 15 : 8; why.sell.push(`funding cao (${(fund[i] * 100).toFixed(4)}%, phe mua đang đông)`); }
        if (r <= 0.1) { part.buy.fund = r <= 0.05 ? 15 : 8; why.buy.push(`funding thấp (${(fund[i] * 100).toFixed(4)}%, phe bán đang đông)`); }
      }
    }
    const max = hasFund ? 100 : 85, sum = s => s.absorb + s.sr + s.div + s.fund;
    const sb = sum(part.buy), ss = sum(part.sell); if (!sb && !ss) continue;
    const side = sb >= ss ? "buy" : "sell", raw = Math.max(sb, ss) - 0.5 * Math.min(sb, ss);
    const score = Math.round(Math.max(0, Math.min(100, raw / max * 100)));
    if (score < minScore) continue;
    events.push({ i, t: b.t, side, score, parts: part[side], why: why[side], price: b.c, atr: a, fwd: fwdSym(bars, i, side === "buy" ? 1 : -1, a, horizon, moveAtr) });
  }
  // tỷ lệ nền: vào lệnh ở mọi nến theo cùng một luật, để biết điểm số có hơn tung đồng xu không
  const baseOf = dir => { let ok = 0, m = 0; for (let i = 60; i < n - horizon; i++) { if (!atr[i]) continue; const f = fwdSym(bars, i, dir, atr[i], horizon, moveAtr); if (f.result === "pending") continue; m++; if (f.result === "win") ok++; } return m ? ok / m * 100 : NaN; };
  const base = { buy: baseOf(1), sell: baseOf(-1) };
  const edges = [20, 40, 60, 80, 101], buckets = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const g = events.filter(e => e.score >= edges[k] && e.score < edges[k + 1] && e.fwd.result !== "pending");
    const w = g.filter(e => e.fwd.result === "win").length, l = g.filter(e => e.fwd.result === "loss").length;
    const bs = g.filter(e => e.side === "buy").length, ss = g.length - bs;
    const baseMix = g.length ? (bs * base.buy + ss * base.sell) / g.length : NaN;
    buckets.push({ lo: edges[k], hi: Math.min(100, edges[k + 1] - 1), n: g.length, win: w, loss: l, pct: g.length ? w / g.length * 100 : NaN, base: baseMix });
  }
  return { events, buckets, base, hasFund };
}

// thắng nếu đi được moveAtr ATR theo hướng dir trước khi đi ngược moveAtr ATR (cùng nến chạm cả hai = thua)
export function fwdSym(bars, i, dir, a, horizon = 10, moveAtr = 1) {
  const e = bars[i].c, up = e + dir * moveAtr * a, dn = e - dir * moveAtr * a;
  for (let j = i + 1; j < Math.min(bars.length, i + 1 + horizon); j++) {
    const x = bars[j], hitBad = dir > 0 ? x.l <= dn : x.h >= dn, hitGood = dir > 0 ? x.h >= up : x.l <= up;
    if (hitBad) return { result: "loss", bars: j - i };
    if (hitGood) return { result: "win", bars: j - i };
  }
  return { result: i + horizon < bars.length ? "flat" : "pending", bars: horizon };
}
