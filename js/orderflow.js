// Lai Long Web: các công cụ order flow tính trên lệnh khớp và footprint (không vẽ, để kiểm thử được).
//
// - smartTape: ghép các lệnh nhỏ mà sàn tách ra từ một lệnh lớn thành lệnh gốc
// - absorption: nến có lực chủ động rất lớn ở một đầu nhưng giá không đi tiếp (bị hấp thụ)
// - clusterSearch: tìm các ô footprint có khối lượng / delta lớn bất thường
// - cvdCandles: CVD dạng nến (CVD Pro), có thể bắt đầu lại mỗi ngày
// - rangeProfile: hồ sơ khối lượng cho một đoạn nến tự chọn (POC, vùng giá trị, HVN, LVN)

const DAY = 864e5;

// ---------- Smart Tape ----------
// Một lệnh market lớn ăn qua nhiều lệnh chờ sẽ bị sàn báo thành nhiều lệnh khớp nhỏ cùng
// một thời điểm và cùng phía. Ghép các lệnh liền nhau cùng phía, cách nhau không quá gapMs.
// trades: [{t, p, q, side}] theo thứ tự thời gian. Trả về [{t, side, q, n, p, pFirst, pMin, pMax, levels, vwap}]
export function smartTape(trades, { gapMs = 0, tick = 0 } = {}) {
  const out = []; let cur = null;
  for (const tr of trades) {
    if (cur && tr.side === cur.side && tr.t - cur.tLast <= gapMs) {
      cur.q += tr.q; cur.n++; cur.pv += tr.p * tr.q; cur.p = tr.p; cur.tLast = tr.t;
      if (tr.p < cur.pMin) cur.pMin = tr.p; if (tr.p > cur.pMax) cur.pMax = tr.p;
      continue;
    }
    if (cur) out.push(finishPrint(cur, tick));
    cur = { t: tr.t, tLast: tr.t, side: tr.side, q: tr.q, n: 1, pv: tr.p * tr.q, p: tr.p, pFirst: tr.p, pMin: tr.p, pMax: tr.p };
  }
  if (cur) out.push(finishPrint(cur, tick));
  return out;
}
function finishPrint(c, tick) {
  const levels = tick > 0 ? Math.round((c.pMax - c.pMin) / tick) + 1 : (c.pMax > c.pMin ? 2 : 1);
  const out = { t: c.t, side: c.side, q: c.q, n: c.n, p: c.p, pFirst: c.pFirst, pMin: c.pMin, pMax: c.pMax, levels, vwap: c.q ? c.pv / c.q : c.p };
  if (c.meta) out.meta = c.meta;
  return out;
}

// Bộ ghép chạy liên tục cho dữ liệu trực tiếp: add() trả về lệnh gốc vừa hoàn tất (nếu có)
export class TapeAggregator {
  constructor({ gapMs = 0, tick = 0 } = {}) { this.gapMs = gapMs; this.tick = tick; this.cur = null; }
  add(tr) {
    const c = this.cur; this.started = false;
    if (c && tr.side === c.side && tr.t - c.tLast <= this.gapMs) {
      c.q += tr.q; c.n++; c.pv += tr.p * tr.q; c.p = tr.p; c.tLast = tr.t;
      if (tr.p < c.pMin) c.pMin = tr.p; if (tr.p > c.pMax) c.pMax = tr.p;
      return null;
    }
    const done = c ? finishPrint(c, this.tick) : null;
    this.started = true;
    this.cur = { t: tr.t, tLast: tr.t, side: tr.side, q: tr.q, n: 1, pv: tr.p * tr.q, p: tr.p, pFirst: tr.p, pMin: tr.p, pMax: tr.p };
    return done;
  }
  // lệnh đang ghép dở (để hiển thị ngay, chưa chắc đã đủ)
  pending() { return this.cur ? finishPrint(this.cur, this.tick) : null; }
}

// ngưỡng lệnh lớn: phân vị pct của khối lượng các lệnh gốc
export function quantile(values, pct) {
  if (!values.length) return Infinity;
  const s = Float64Array.from(values).sort();
  return s[Math.min(s.length - 1, Math.floor(s.length * pct))];
}

// ---------- tiện ích ----------
function atrSeries(bars, n = 14) {
  const out = new Array(bars.length).fill(null); let a = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], pc = i ? bars[i - 1].c : b.c;
    const tr = Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
    a = a === null ? tr : (a * (n - 1) + tr) / n; out[i] = i >= n - 1 ? a : null;
  }
  return out;
}
function buyVol(b) {
  if (typeof b.bv === "number" && isFinite(b.bv)) return b.bv;
  const r = b.h - b.l; return r > 0 ? b.v * (0.5 + 0.5 * (b.c - b.o) / r) : b.v / 2;
}

// khối lượng mua/bán chủ động ở phần dưới và phần trên của nến
// zone: tỷ lệ biên độ nến tính là "đáy" / "đỉnh" (mặc định 1/3)
export function edgeFlow(b, step, zone = 1 / 3) {
  const r = b.h - b.l, loCut = b.l + r * zone, hiCut = b.h - r * zone;
  const res = { lowSell: 0, lowBuy: 0, highSell: 0, highBuy: 0, exact: !!(b.fp && b.fp.size && !b.fpApprox) };
  if (b.fp && b.fp.size && step > 0) {
    for (const [k, c] of b.fp) {
      const p = (k + 0.5) * step;
      if (p <= loCut) { res.lowSell += c[0]; res.lowBuy += c[1]; }
      if (p >= hiCut) { res.highSell += c[0]; res.highBuy += c[1]; }
    }
    return res;
  }
  // không có footprint: coi khối lượng trải đều trên biên độ nến
  const buy = buyVol(b), sell = b.v - buy;
  res.lowSell = res.highSell = sell * zone; res.lowBuy = res.highBuy = buy * zone;
  return res;
}

// ---------- chỉ báo hấp thụ ----------
// Hấp thụ bán (chấm đỏ ở đáy): khối lượng nến cao bất thường, phần đáy nến có rất nhiều lệnh BÁN
// chủ động, nhưng giá không giảm tiếp mà đóng cửa xa đáy. Người mua bị động (lệnh chờ mua) đã ăn
// hết lực bán. Hấp thụ mua (chấm xanh ở đỉnh) là ngược lại.
// Tín hiệu chỉ dùng dữ liệu tới hết nến đó. Phần "sau đó" (fwd) chỉ để thống kê và chú thích.
export function absorption(bars, { step = 0, lookback = 50, zMin = 2, edgeShare = 0.3, edgeDom = 0.6, closeMin = 0.5, horizon = 10, moveAtr = 1 } = {}) {
  const n = bars.length, out = [], atr = atrSeries(bars);
  const lv = bars.map(b => Math.log1p(Math.max(0, b.v)));
  let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    if (i >= lookback) {
      const m = s / lookback, sd = Math.sqrt(Math.max(0, s2 / lookback - m * m));
      const b = bars[i], r = b.h - b.l, z = sd > 0 ? (lv[i] - m) / sd : 0;
      if (z >= zMin && r > 0 && b.v > 0) {
        const f = edgeFlow(b, step), pos = (b.c - b.l) / r; // vị trí giá đóng cửa: 0 = đáy, 1 = đỉnh
        const lowTot = f.lowSell + f.lowBuy, highTot = f.highSell + f.highBuy;
        const dom = f.exact ? edgeDom : edgeDom - 0.05; // footprint ước tính trải đều nên nới ngưỡng một chút
        const sellAbs = f.lowSell >= edgeShare * b.v * (f.exact ? 1 : 0.5) && lowTot > 0 && f.lowSell / lowTot >= dom && pos >= closeMin;
        const buyAbs = f.highBuy >= edgeShare * b.v * (f.exact ? 1 : 0.5) && highTot > 0 && f.highBuy / highTot >= dom && (1 - pos) >= closeMin;
        // không có footprint thật thì cần thêm: delta cả nến âm/dương rõ nhưng nến đóng ngược chiều
        const d = 2 * buyVol(b) - b.v, approxOk = f.exact || (sellAbs ? d < 0 && b.c >= b.o : buyAbs ? d > 0 && b.c <= b.o : false);
        if ((sellAbs || buyAbs) && approxOk) {
          const side = sellAbs ? "sell" : "buy"; // phía chủ động bị hấp thụ
          const edgeVol = side === "sell" ? f.lowSell : f.highBuy, edgeTot = side === "sell" ? lowTot : highTot;
          const ev = {
            i, t: b.t, side, price: side === "sell" ? b.l : b.h, vol: b.v, z,
            edgeVol, edgeShare: edgeVol / b.v, edgeDom: edgeVol / edgeTot,
            edgeDelta: side === "sell" ? f.lowBuy - f.lowSell : f.highBuy - f.highSell,
            closePos: pos, exact: f.exact, atr: atr[i],
            strength: Math.min(100, Math.round(20 * z * (edgeVol / b.v) * 2 + 10)),
            fwd: forward(bars, i, side, atr[i], horizon, moveAtr),
          };
          out.push(ev);
        }
      }
    }
    s += lv[i]; s2 += lv[i] * lv[i];
    if (i >= lookback) { s -= lv[i - lookback]; s2 -= lv[i - lookback] * lv[i - lookback]; }
  }
  return out;
}

// sau tín hiệu: giá có đảo chiều được moveAtr ATR trước khi phá cực trị của nến hấp thụ không
function forward(bars, i, side, atr, horizon, moveAtr) {
  const b = bars[i], dir = side === "sell" ? 1 : -1, ext = side === "sell" ? b.l : b.h, a = atr || (b.h - b.l);
  let best = 0, result = "pending", bars_ = 0;
  for (let j = i + 1; j < Math.min(bars.length, i + 1 + horizon); j++) {
    const x = bars[j]; bars_ = j - i;
    if (dir > 0 ? x.l < ext : x.h > ext) { result = "failed"; break; }
    const fav = dir > 0 ? x.h - b.c : b.c - x.l; best = Math.max(best, fav);
    if (best >= moveAtr * a) { result = "reversed"; break; }
  }
  if (result === "pending" && i + horizon < bars.length) result = "unclear";
  return { result, bars: bars_, bestAtr: a ? best / a : 0, bestPct: b.c ? best / b.c * 100 * 1 : 0 };
}

export function absorptionStats(events) {
  const done = events.filter(e => e.fwd.result !== "pending");
  const by = side => { const g = done.filter(e => e.side === side), ok = g.filter(e => e.fwd.result === "reversed").length; return { n: g.length, reversed: ok, failed: g.filter(e => e.fwd.result === "failed").length, pct: g.length ? ok / g.length * 100 : NaN }; };
  return { sell: by("sell"), buy: by("buy") };
}

// ---------- Cluster Search ----------
// metric: "volume" (tổng), "delta" (|mua - bán|), "buy", "sell". Ngưỡng: phân vị (topPct) hoặc minValue.
export function clusterSearch(bars, { metric = "volume", topPct = 0.005, minValue = 0, from = 0, to = bars.length - 1, step = 0, maxResults = 300 } = {}) {
  const cells = [];
  for (let i = Math.max(0, from); i <= Math.min(bars.length - 1, to); i++) {
    const b = bars[i]; if (!b.fp || !b.fp.size) continue;
    for (const [k, c] of b.fp) {
      const v = metric === "delta" ? Math.abs(c[1] - c[0]) : metric === "buy" ? c[1] : metric === "sell" ? c[0] : c[0] + c[1];
      if (v > 0) cells.push({ i, t: b.t, k, price: k * step, sell: c[0], buy: c[1], value: v, approx: !!b.fpApprox });
    }
  }
  if (!cells.length) return { threshold: Infinity, cells: [] };
  const thr = minValue > 0 ? minValue : quantile(cells.map(c => c.value), 1 - topPct);
  const hit = cells.filter(c => c.value >= thr).sort((a, b) => b.value - a.value).slice(0, maxResults);
  return { threshold: thr, cells: hit };
}

// ---------- CVD Pro: CVD dạng nến ----------
export function cvdCandles(bars, { reset = "day" } = {}) {
  const out = []; let cum = 0, day = null;
  for (const b of bars) {
    const dd = Math.floor(b.t / DAY);
    if (reset === "day" && dd !== day) { cum = 0; day = dd; }
    const d = typeof b.d === "number" ? b.d : 2 * buyVol(b) - b.v, o = cum, c = cum + d;
    // nến đang chạy có ghi được đỉnh/đáy CVD trong nến thì dùng, không thì lấy mở/đóng
    const h = b.cvdH != null ? o + b.cvdH : Math.max(o, c), l = b.cvdL != null ? o + b.cvdL : Math.min(o, c);
    out.push({ o, h: Math.max(h, o, c), l: Math.min(l, o, c), c, reset: reset === "day" && o === 0 });
    cum = c;
  }
  return out;
}

// ---------- hồ sơ khối lượng cho đoạn nến tự chọn ----------
export function rangeProfile(bars, i0, i1, step) {
  const a = Math.max(0, Math.min(i0, i1)), z = Math.min(bars.length - 1, Math.max(i0, i1));
  const rows = new Map(); let total = 0, lo = Infinity, hi = -Infinity, buyTot = 0;
  for (let i = a; i <= z; i++) {
    const b = bars[i]; lo = Math.min(lo, b.l); hi = Math.max(hi, b.h);
    if (b.fp && b.fp.size) {
      const mult = 1;
      for (const [k0, c] of b.fp) { const k = Math.floor(k0 / mult); const r = rows.get(k) || [0, 0]; r[0] += c[0]; r[1] += c[1]; rows.set(k, r); total += c[0] + c[1]; buyTot += c[1]; }
    } else if (b.v > 0 && step > 0) {
      const k1 = Math.floor(b.l / step + 1e-9), k2 = Math.floor(b.h / step + 1e-9), n = k2 - k1 + 1, buy = buyVol(b);
      for (let k = k1; k <= k2; k++) { const r = rows.get(k) || [0, 0]; r[0] += (b.v - buy) / n; r[1] += buy / n; rows.set(k, r); }
      total += b.v; buyTot += buy;
    }
  }
  const res = { from: a, to: z, step, rows, total, delta: 2 * buyTot - total, lo, hi, poc: null, vah: null, val: null, hvn: [], lvn: [] };
  if (!rows.size || !(total > 0)) return res;
  const ks = [...rows.keys()].sort((x, y) => x - y), kMin = ks[0], kMax = ks[ks.length - 1];
  const vol = k => { const r = rows.get(k); return r ? r[0] + r[1] : 0; };
  let pocK = kMin; for (const k of ks) if (vol(k) > vol(pocK)) pocK = k;
  let lk = pocK, hk = pocK, acc = vol(pocK);
  while (acc < total * 0.7 && (lk > kMin || hk < kMax)) {
    const u = hk < kMax ? vol(hk + 1) : -1, d = lk > kMin ? vol(lk - 1) : -1;
    if (u >= d) { hk++; acc += Math.max(0, u); } else { lk--; acc += Math.max(0, d); }
  }
  res.poc = (pocK + 0.5) * step; res.val = lk * step; res.vah = (hk + 1) * step; res.pocVol = vol(pocK);
  const vals = []; for (let k = kMin; k <= kMax; k++) vals.push(vol(k));
  const m = vals.reduce((x, y) => x + y, 0) / vals.length, sd = Math.sqrt(vals.reduce((x, y) => x + (y - m) ** 2, 0) / vals.length);
  for (let k = kMin + 1; k < kMax; k++) {
    const v = vol(k), p = (k + 0.5) * step;
    if (v > vol(k - 1) && v >= vol(k + 1) && v > m + sd) res.hvn.push(p);
    if (v < vol(k - 1) && v <= vol(k + 1) && v < m - 0.5 * sd && k >= lk && k <= hk) res.lvn.push(p);
  }
  return res;
}

// chia nến thành các phiên theo ngày (UTC) để vẽ hồ sơ khối lượng từng ngày
export function daySessions(bars) {
  const out = []; let s = null;
  bars.forEach((b, i) => {
    const d = Math.floor(b.t / DAY);
    if (!s || s.day !== d) { s = { day: d, from: i, to: i }; out.push(s); } else s.to = i;
  });
  return out;
}
