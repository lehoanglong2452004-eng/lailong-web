// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Các hàm phân tích order-flow thuần JS, không phụ thuộc thư viện.
// Quy ước nến: {t, o, h, l, c, v, bv, oi}. Mọi giá trị tại nến i chỉ dùng nến 0..i.

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const MS_PER_YEAR = 365 * 24 * 3600 * 1000;

// Hồi quy tuyến tính y theo chỉ số 0..n-1
export function linreg(ys) {
  const n = ys.length;
  if (n < 2) return { slope: NaN, intercept: NaN, r2: NaN };
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const y = ys[i];
    sx += i; sy += y; sxx += i * i; sxy += i * y; syy += y * y;
  }
  const dx = n * sxx - sx * sx;
  const dy = n * syy - sy * sy;
  const slope = (n * sxy - sx * sy) / dx;
  const intercept = (sy - slope * sx) / n;
  const r = dy > 0 ? (n * sxy - sx * sy) / Math.sqrt(dx * dy) : 0;
  return { slope, intercept, r2: r * r };
}

function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }
function stdev(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}

// ATR kiểu Wilder; NaN trước khi đủ n nến
export function atr(bars, n = 14) {
  const len = bars?.length || 0;
  const out = new Array(len).fill(NaN);
  if (len < n || n < 1) return out;
  let sum = 0, prev = NaN;
  for (let i = 0; i < len; i++) {
    const b = bars[i];
    const tr = i === 0 ? b.h - b.l
      : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c));
    if (i < n) {
      sum += tr;
      if (i === n - 1) { prev = sum / n; out[i] = prev; }
    } else {
      prev = (prev * (n - 1) + tr) / n;
      out[i] = prev;
    }
  }
  return out;
}

// Delta = mua chủ động - bán chủ động; thiếu bv thì ước lượng theo thân nến
export function barDelta(bar) {
  if (!bar) return 0;
  if (isNum(bar.bv)) return 2 * bar.bv - bar.v;
  const rng = bar.h - bar.l;
  if (!(rng > 0)) return 0;
  return bar.v * (bar.c - bar.o) / rng;
}

export function isDeltaApprox(bars) {
  return (bars || []).some((b) => !isNum(b.bv));
}

export function cvd(bars) {
  const out = [];
  let s = 0;
  for (const b of bars || []) { s += barDelta(b); out.push(s); }
  return out;
}

// Đỉnh/đáy cục bộ; chỉ "biết" được ở nến i+right (knownAt)
export function pivots(bars, left = 5, right = 5) {
  const out = [];
  const n = bars?.length || 0;
  for (let i = left; i + right < n; i++) {
    const h = bars[i].h, l = bars[i].l;
    let isH = true, isL = true;
    for (let k = i - left; k < i && (isH || isL); k++) {
      if (bars[k].h >= h) isH = false;
      if (bars[k].l <= l) isL = false;
    }
    for (let k = i + 1; k <= i + right && (isH || isL); k++) {
      if (bars[k].h > h) isH = false;
      if (bars[k].l < l) isL = false;
    }
    if (isH) out.push({ i, t: bars[i].t, price: h, kind: 'high', knownAt: i + right });
    if (isL) out.push({ i, t: bars[i].t, price: l, kind: 'low', knownAt: i + right });
  }
  return out;
}

function lastNum(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (isNum(arr[i])) return arr[i];
  return NaN;
}

// Xu hướng.
// Trọng số điểm: 70% từ slopeAtr*r2 (bão hoà tại ±0.1 ATR/nến), 30% từ cấu trúc đỉnh đáy
// (HH-HL = +30, LH-LL = -30, Hỗn hợp = 0).
export function trend(bars, { len = 50 } = {}) {
  const empty = { score: null, label: null, slopeAtr: null, r2: null, structure: null, lastPivots: [] };
  const n = bars?.length || 0;
  if (n < 15) return empty;
  const m = Math.min(len, n);
  const closes = bars.slice(n - m).map((b) => b.c);
  const { slope, r2 } = linreg(closes);
  let a = lastNum(atr(bars, 14));
  if (!(a > 0)) a = NaN;
  const slopeAtr = isNum(a) ? slope / a : 0;
  const pv = pivots(bars, 5, 5);
  const highs = pv.filter((p) => p.kind === 'high').slice(-2);
  const lows = pv.filter((p) => p.kind === 'low').slice(-2);
  let structure = 'Hỗn hợp';
  if (highs.length === 2 && lows.length === 2) {
    if (highs[1].price > highs[0].price && lows[1].price > lows[0].price) structure = 'HH-HL';
    else if (highs[1].price < highs[0].price && lows[1].price < lows[0].price) structure = 'LH-LL';
  }
  const sComp = clamp((slopeAtr * (r2 || 0)) / 0.1, -1, 1) * 70;
  const stComp = structure === 'HH-HL' ? 30 : structure === 'LH-LL' ? -30 : 0;
  const score = Math.round(clamp(sComp + stComp, -100, 100));
  const label = score >= 60 ? 'Tăng mạnh' : score >= 20 ? 'Tăng' : score > -20 ? 'Đi ngang'
    : score > -60 ? 'Giảm' : 'Giảm mạnh';
  const lastPivots = [...highs, ...lows].sort((x, y) => x.i - y.i);
  return { score, label, slopeAtr, r2, structure, lastPivots };
}

// Động lượng.
// Trọng số: roc10 chuẩn hoá theo ATR% (40), deltaRatio20 (30, bão hoà ±0.3),
// cvdSlope20 (15, bão hoà ±0.3), gia tốc (15).
export function momentum(bars) {
  const n = bars?.length || 0;
  const res = { roc10: null, roc30: null, deltaRatio20: null, cvdSlope20: null, accel: null, score: null, label: null };
  if (n < 2) return res;
  const c = (k) => bars[n - 1 - k].c;
  const roc = (k, off = 0) => (n - 1 - off - k >= 0 ? (bars[n - 1 - off].c / bars[n - 1 - off - k].c - 1) * 100 : null);
  res.roc10 = roc(10);
  res.roc30 = roc(30);
  const m = Math.min(20, n);
  const tail = bars.slice(n - m);
  const vol = tail.reduce((s, b) => s + b.v, 0);
  const dsum = tail.reduce((s, b) => s + barDelta(b), 0);
  res.deltaRatio20 = vol > 0 ? clamp(dsum / vol, -1, 1) : 0;
  const cv = cvd(tail);
  const { slope } = linreg(cv);
  res.cvdSlope20 = vol > 0 && isNum(slope) ? clamp((slope * m) / vol, -1, 1) : 0;
  const roc10prev = roc(10, 10);
  res.accel = res.roc10 != null && roc10prev != null ? res.roc10 - roc10prev : null;
  if (res.roc10 == null) return res;
  const a = lastNum(atr(bars, 14));
  const atrPct = a > 0 ? (a / c(0)) * 100 : Math.abs(res.roc10) || 1;
  const unit = atrPct * Math.sqrt(10) || 1;
  const score = clamp(res.roc10 / unit, -1, 1) * 40
    + clamp(res.deltaRatio20 / 0.3, -1, 1) * 30
    + clamp(res.cvdSlope20 / 0.3, -1, 1) * 15
    + clamp((res.accel ?? 0) / unit, -1, 1) * 15;
  res.score = Math.round(clamp(score, -100, 100));
  const ac = res.accel ?? 0;
  if (Math.abs(res.score) < 15) res.label = 'Trung tính';
  else if (res.score > 0) res.label = ac >= 0 ? 'Tăng tốc lên' : 'Tăng chậm lại';
  else res.label = ac <= 0 ? 'Giảm tốc xuống' : 'Giảm chậm lại';
  return res;
}

// Chuỗi biến động thực hiện (năm hoá, %) trên cửa sổ win nến; NaN khi chưa đủ
export function realizedSeries(bars, intervalMs, win = 20) {
  const n = bars?.length || 0;
  const out = new Array(n).fill(NaN);
  if (!(intervalMs > 0)) return out;
  const ann = Math.sqrt(MS_PER_YEAR / intervalMs) * 100;
  const r = new Array(n).fill(0);
  for (let i = 1; i < n; i++) r[i] = Math.log(bars[i].c / bars[i - 1].c);
  let s = 0, ss = 0;
  for (let i = 1; i < n; i++) {
    s += r[i]; ss += r[i] * r[i];
    if (i > win) { s -= r[i - win]; ss -= r[i - win] * r[i - win]; }
    if (i >= win) {
      const v = (ss - (s * s) / win) / (win - 1);
      out[i] = Math.sqrt(Math.max(0, v)) * ann;
    }
  }
  return out;
}

export function volatility(bars, intervalMs) {
  const n = bars?.length || 0;
  const res = { atrPct: null, realized: null, parkinson: null, percentile: null, regime: null, series: [] };
  if (n < 2 || !(intervalMs > 0)) return res;
  const a = lastNum(atr(bars, 14));
  const last = bars[n - 1].c;
  res.atrPct = isNum(a) ? (a / last) * 100 : null;
  const series = realizedSeries(bars, intervalMs, 20);
  res.series = series;
  const cur = series[n - 1];
  res.realized = isNum(cur) ? cur : null;
  const ann = Math.sqrt(MS_PER_YEAR / intervalMs) * 100;
  const m = Math.min(20, n);
  let pk = 0;
  for (let i = n - m; i < n; i++) { const x = Math.log(bars[i].h / bars[i].l); pk += x * x; }
  res.parkinson = Math.sqrt(pk / m / (4 * Math.LN2)) * ann;
  if (res.realized != null) {
    const valid = series.filter(isNum);
    const below = valid.filter((x) => x <= cur).length;
    res.percentile = (below / valid.length) * 100;
    res.regime = res.percentile < 25 ? 'Nén' : res.percentile > 80 ? 'Bùng nổ' : 'Bình thường';
  }
  return res;
}

// z-score của log(volume) so với `lookback` nến trước (không tính nến hiện tại).
// Nến volume <= 0 bị bỏ qua khỏi thống kê.
export function volumeZ(bars, lookback = 50) {
  const n = bars?.length || 0;
  const out = new Array(n).fill(NaN);
  const lv = (bars || []).map((b) => (b.v > 0 ? Math.log(b.v) : null));
  let s = 0, ss = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    if (i >= lookback && cnt >= 2 && lv[i] != null) {
      const m = s / cnt;
      const sd = Math.sqrt(Math.max(0, (ss - cnt * m * m) / (cnt - 1)));
      if (sd > 0) out[i] = (lv[i] - m) / sd;
    }
    // trượt cửa sổ: thêm i, bỏ i-lookback
    if (lv[i] != null) { s += lv[i]; ss += lv[i] * lv[i]; cnt++; }
    const j = i - lookback;
    if (j >= 0 && lv[j] != null) { s -= lv[j]; ss -= lv[j] * lv[j]; cnt--; }
  }
  return out;
}

// Vùng khối lượng bất thường; mất hiệu lực khi có nến đóng xuyên qua phía đối diện
export function abnormalVolume(bars, { lookback = 50, z = 2.5 } = {}) {
  const n = bars?.length || 0;
  const zs = volumeZ(bars, lookback);
  const zones = [];
  for (let i = 0; i < n; i++) {
    if (!(zs[i] >= z)) continue;
    const b = bars[i];
    const side = barDelta(b) >= 0 ? 'buy' : 'sell';
    let active = true, endT = null;
    for (let j = i + 1; j < n; j++) {
      const c = bars[j].c;
      if ((side === 'buy' && c < b.l) || (side === 'sell' && c > b.h)) {
        active = false; endT = bars[j].t; break;
      }
    }
    zones.push({ i, t: b.t, z: zs[i], low: b.l, high: b.h, side, volume: b.v, active, endT });
  }
  return zones;
}

function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}

// Hồ sơ khối lượng. levels[].price = cận dưới của ô; poc = giữa ô POC;
// vah = cận trên ô cao nhất vùng giá trị, val = cận dưới ô thấp nhất.
// buyKey: tên trường khối lượng mua chủ động (mặc định 'bv'); thiếu thì ước lượng từ delta.
export function volumeProfile(bars, step, { buyKey = 'bv' } = {}) {
  const res = { step: null, levels: [], poc: null, vah: null, val: null, hvn: [], lvn: [] };
  const n = bars?.length || 0;
  if (!n) return res;
  let lo = Infinity, hi = -Infinity;
  for (const b of bars) { if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h; }
  if (!(step > 0)) step = niceStep((hi - lo) / 100 || hi * 0.001);
  // giới hạn số ô để tránh mảng quá lớn
  while ((hi - lo) / step > 5000) step *= 2;
  res.step = step;
  const i0 = Math.floor(lo / step), i1 = Math.floor(hi / step);
  const size = i1 - i0 + 1;
  const vol = new Float64Array(size), buy = new Float64Array(size);
  for (const b of bars) {
    if (!(b.v > 0)) continue;
    const a = Math.floor(b.l / step) - i0, z = Math.floor(b.h / step) - i0;
    const k = z - a + 1;
    const bvv = isNum(b[buyKey]) ? b[buyKey] : (b.v + barDelta({ ...b, bv: null })) / 2;
    const share = clamp(bvv / b.v, 0, 1);
    for (let j = a; j <= z; j++) { vol[j] += b.v / k; buy[j] += (b.v / k) * share; }
  }
  for (let j = 0; j < size; j++) {
    res.levels.push({ price: (i0 + j) * step, vol: vol[j], buy: buy[j], sell: vol[j] - buy[j] });
  }
  let total = 0, pocJ = 0;
  for (let j = 0; j < size; j++) { total += vol[j]; if (vol[j] > vol[pocJ]) pocJ = j; }
  if (!(total > 0)) return res;
  res.poc = (i0 + pocJ) * step + step / 2;
  // mở rộng vùng giá trị 70% từ POC
  let a = pocJ, z = pocJ, acc = vol[pocJ];
  while (acc < total * 0.7 && (a > 0 || z < size - 1)) {
    const up = z < size - 1 ? vol[z + 1] : -1;
    const dn = a > 0 ? vol[a - 1] : -1;
    if (up >= dn) { z++; acc += vol[z]; } else { a--; acc += vol[a]; }
  }
  res.val = (i0 + a) * step;
  res.vah = (i0 + z + 1) * step;
  const vs = Array.from(vol);
  const m = mean(vs), sd = stdev(vs) || 0;
  for (let j = 1; j < size - 1; j++) {
    const p = (i0 + j) * step;
    if (vol[j] > vol[j - 1] && vol[j] >= vol[j + 1] && vol[j] > m + sd) res.hvn.push(p);
    if (vol[j] < vol[j - 1] && vol[j] <= vol[j + 1] && vol[j] < m - 0.5 * sd && j >= a && j <= z) res.lvn.push(p);
  }
  return res;
}

// Hỗ trợ/kháng cự từ gom cụm các pivot đã xác nhận (dung sai tolAtr*ATR hiện tại).
// strength (0-100): touches 35 (bão hoà 5), tests 25 (bão hoà 6), độ gần đây 20,
// volume tại pivot so với trung bình 20 (bão hoà gấp 2); đã thủng mà chưa đổi vai thì x0.6.
export function srLevels(bars, { left = 5, right = 5, tolAtr = 0.3, maxLevels = 12 } = {}) {
  const n = bars?.length || 0;
  if (n < left + right + 2) return [];
  const a = lastNum(atr(bars, 14));
  const lastC = bars[n - 1].c;
  const tol = tolAtr * (isNum(a) ? a : (bars[n - 1].h - bars[n - 1].l));
  const pv = pivots(bars, left, right).sort((x, y) => x.price - y.price);
  if (!pv.length) return [];
  // gom cụm tham lam theo giá
  const clusters = [];
  let cur = null;
  for (const p of pv) {
    if (cur && p.price - cur.sum / cur.items.length <= tol) { cur.items.push(p); cur.sum += p.price; }
    else { cur = { items: [p], sum: p.price }; clusters.push(cur); }
  }
  const avgVol = mean(bars.map((b) => b.v)) || 1;
  const out = [];
  for (const cl of clusters) {
    const price = cl.sum / cl.items.length;
    const items = cl.items.slice().sort((x, y) => x.i - y.i);
    const pivotIdx = new Set(items.map((p) => p.i));
    const first = items[0];
    const highs = items.filter((p) => p.kind === 'high').length;
    // phía ban đầu: đa số pivot đỉnh => giá ở dưới (-1)
    let side = highs * 2 >= items.length ? -1 : 1;
    let tests = 0, lastTestT = null, broken = false, flipped = false, lastIdx = items[items.length - 1].i;
    for (let j = first.i + 1; j < n; j++) {
      const b = bars[j];
      if (side === -1) {
        if (b.c > price + tol) { side = 1; broken = true; continue; }
        if (!pivotIdx.has(j) && b.h >= price - tol && b.c < price) {
          if (broken) flipped = true; else tests++;
          lastTestT = b.t; lastIdx = Math.max(lastIdx, j);
        }
      } else {
        if (b.c < price - tol) { side = -1; broken = true; continue; }
        if (!pivotIdx.has(j) && b.l <= price + tol && b.c > price) {
          if (broken) flipped = true; else tests++;
          lastTestT = b.t; lastIdx = Math.max(lastIdx, j);
        }
      }
    }
    const pvVol = mean(items.map((p) => bars[p.i].v));
    let strength = (Math.min(items.length, 5) / 5) * 35
      + (Math.min(tests, 6) / 6) * 25
      + (lastIdx / (n - 1)) * 20
      + clamp(pvVol / avgVol / 2, 0, 1) * 20;
    if (broken && !flipped) strength *= 0.6;
    out.push({
      price,
      kind: price > lastC ? 'resistance' : 'support',
      touches: items.length, tests, lastTestT, broken, flipped,
      firstT: first.t,
      strength: Math.round(clamp(strength, 0, 100)),
      distancePct: ((price - lastC) / lastC) * 100,
    });
  }
  out.sort((x, y) => y.strength - x.strength);
  return out.slice(0, maxLevels);
}

// Bản đồ thanh lý ƯỚC LƯỢNG (không phải dữ liệu sàn).
// Mô hình: mỗi nến có oi và oi trước: dOI = oi - prevOi.
//  - dOI > 0: vị thế mới mở tại giá điển hình p=(h+l+c)/3; tỉ lệ long = bv/v (thiếu thì 0.5).
//    Với mỗi bậc đòn bẩy [L, w]: giá thanh lý long = p*(1-1/L+mmr), short = p*(1+1/L-mmr);
//    cộng notional dOI*p*w*share vào ô giá tương ứng.
//  - dOI < 0: thu nhỏ mọi ô hiện có theo tỉ lệ |dOI|/prevOi.
// Trước khi cộng vị thế mới, nến hiện tại quét các ô cũ: ô long bị xoá khi low <= giữa ô,
// ô short bị xoá khi high >= giữa ô. Vị thế mở trong nến không bị chính nến đó quét.
// price trả về = cận dưới ô.
export function liquidationMap(bars, {
  tiers = [[5, 0.1], [10, 0.25], [25, 0.3], [50, 0.2], [100, 0.15]], mmr = 0.005, step,
} = {}) {
  const n = bars?.length || 0;
  const res = { step: null, longs: [], shorts: [], totalLong: 0, totalShort: 0, approx: true };
  if (!n) return res;
  if (!(step > 0)) step = niceStep(bars[n - 1].c * 0.001);
  res.step = step;
  const L = new Map(), S = new Map();
  let prevOi = null;
  for (const b of bars) {
    // quét thanh lý
    for (const k of L.keys()) if (b.l <= (k + 0.5) * step) L.delete(k);
    for (const k of S.keys()) if (b.h >= (k + 0.5) * step) S.delete(k);
    if (isNum(b.oi) && isNum(prevOi) && prevOi > 0) {
      const d = b.oi - prevOi;
      if (d > 0) {
        const p = (b.h + b.l + b.c) / 3;
        const ls = isNum(b.bv) && b.v > 0 ? clamp(b.bv / b.v, 0, 1) : 0.5;
        for (const [lev, w] of tiers) {
          const lp = p * (1 - 1 / lev + mmr), sp = p * (1 + 1 / lev - mmr);
          const kl = Math.floor(lp / step), ks = Math.floor(sp / step);
          L.set(kl, (L.get(kl) || 0) + d * p * w * ls);
          S.set(ks, (S.get(ks) || 0) + d * p * w * (1 - ls));
        }
      } else if (d < 0) {
        const f = Math.max(0, 1 - -d / prevOi);
        for (const [k, v] of L) L.set(k, v * f);
        for (const [k, v] of S) S.set(k, v * f);
      }
    }
    if (isNum(b.oi)) prevOi = b.oi;
  }
  res.longs = [...L].map(([k, v]) => ({ price: k * step, notional: v })).sort((x, y) => x.price - y.price);
  res.shorts = [...S].map(([k, v]) => ({ price: k * step, notional: v })).sort((x, y) => x.price - y.price);
  res.totalLong = res.longs.reduce((s, x) => s + x.notional, 0);
  res.totalShort = res.shorts.reduce((s, x) => s + x.notional, 0);
  return res;
}

export function summary(bars, intervalMs) {
  return { trend: trend(bars), momentum: momentum(bars), volatility: volatility(bars, intervalMs) };
}

// ---------- VWAP ----------
// VWAP = tổng(giá điển hình x khối lượng) / tổng khối lượng.
// anchor: 'day' (reset 00:00 UTC), 'week' (reset thứ Hai 00:00 UTC), 'rolling' (len nến gần nhất).
// Giá trị ở nến i đã gồm cả nến i, nên chỉ dùng được sau khi nến i đóng.
export function vwapSeries(bars, { anchor = 'day', len = 96 } = {}) {
  const n = bars?.length || 0, out = new Array(n).fill(NaN);
  const periodKey = (t) => anchor === 'week' ? Math.floor((t / 86400000 + 3) / 7) : Math.floor(t / 86400000);
  let pv = 0, vv = 0, key = null;
  for (let i = 0; i < n; i++) {
    const b = bars[i], tp = (b.h + b.l + b.c) / 3;
    if (anchor === 'rolling') {
      pv += tp * b.v; vv += b.v;
      if (i >= len) { const o = bars[i - len]; pv -= (o.h + o.l + o.c) / 3 * o.v; vv -= o.v; }
    } else {
      const k = periodKey(b.t);
      if (k !== key) { key = k; pv = 0; vv = 0; }
      pv += tp * b.v; vv += b.v;
    }
    out[i] = vv > 0 ? pv / vv : tp;
  }
  return out;
}

// Thống kê phản ứng khi giá chạm VWAP: bật lại hay xuyên qua.
// Một lần chạm: nến trước đóng cửa ở một phía của VWAP, nến này có râu chạm tới VWAP (trong dung sai).
// Kết quả trong `horizon` nến sau đó:
//   - "bật lại": giá đi tiếp về phía ban đầu được moveAtr x ATR trước khi đóng cửa xuyên qua VWAP
//   - "xuyên qua": đóng cửa ở phía bên kia VWAP quá dung sai trước
//   - "không rõ": không có điều nào xảy ra
// Sau một lần chạm, phải rời VWAP xa hơn dung sai mới tính lần chạm tiếp theo.
export function vwapReactions(bars, vwap, { tolAtr = 0.2, horizon = 12, moveAtr = 1 } = {}) {
  const n = bars?.length || 0, a = atr(bars, 14), events = [];
  let armed = true;
  for (let i = 1; i < n; i++) {
    const b = bars[i], prev = bars[i - 1], w = vwap[i - 1], ai = a[i - 1];
    if (!isNum(w) || !(ai > 0)) continue;
    const tol = tolAtr * ai;
    const away = b.l > vwap[i] + tol || b.h < vwap[i] - tol; // cả nến nằm hẳn một phía
    const side = prev.c > w + tol ? 1 : prev.c < w - tol ? -1 : 0; // 1: giá ở trên (VWAP là hỗ trợ)
    const touched = side === 1 ? b.l <= vwap[i] + tol : side === -1 ? b.h >= vwap[i] - tol : false;
    if (!armed || !touched) { if (away) armed = true; continue; }
    armed = false;
    let outcome = 'Không rõ', after = null;
    // ngay nến chạm: đóng cửa xuyên qua thì tính là xuyên qua; còn lại xét từ nến sau
    if (side === 1 ? b.c < vwap[i] - tol : b.c > vwap[i] + tol) { outcome = 'Xuyên qua'; after = 0; }
    else for (let j = i + 1; j <= Math.min(n - 1, i + horizon); j++) {
      const bj = bars[j], wj = vwap[j];
      const crossed = side === 1 ? bj.c < wj - tol : bj.c > wj + tol;
      const moved = side === 1 ? bj.h >= vwap[i] + moveAtr * ai : bj.l <= vwap[i] - moveAtr * ai;
      if (crossed) { outcome = 'Xuyên qua'; after = j - i; break; }
      if (moved) { outcome = 'Bật lại'; after = j - i; break; }
    }
    const end = bars[Math.min(n - 1, i + horizon)];
    events.push({ i, t: b.t, side: side === 1 ? 'support' : 'resistance', vwap: vwap[i], outcome, after, fwdPct: side * (end.c / b.c - 1) * 100, complete: i + horizon < n });
  }
  const group = (kind) => {
    const ev = events.filter((e) => e.side === kind && e.complete);
    const c = (o) => ev.filter((e) => e.outcome === o).length;
    return {
      touches: ev.length, bounce: c('Bật lại'), breaks: c('Xuyên qua'), unclear: c('Không rõ'),
      bouncePct: ev.length ? c('Bật lại') / ev.length * 100 : NaN,
      breakPct: ev.length ? c('Xuyên qua') / ev.length * 100 : NaN,
      avgFwdPct: ev.length ? mean(ev.map((e) => e.fwdPct)) : NaN,
    };
  };
  return { events, support: group('support'), resistance: group('resistance') };
}
