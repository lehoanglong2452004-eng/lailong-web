// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: các chỉ báo vẽ thẳng lên Bookmap, theo bộ công cụ của Bookmap bản trả phí (phần tính toán).
//
// - Large Lot Tracker: lệnh chờ lớn trong sổ (lấy từ bộ theo dõi tường), vẽ suốt thời gian nó đứng, kèm khối lượng
//   và kết cục (bị ăn, bị rút khi giá tới gần, rút khi giá còn xa).
// - Sweeps: một lệnh gốc (đã ghép ở Smart Tape) ăn qua nhiều mức giá một lúc.
// - Absorption: phía chủ động đánh dồn dập vào một mức giá mà giá không đi qua được: phía bị động đang hấp thụ.
// - Stops: chuỗi lệnh cùng phía khớp liên tục, đẩy giá đi xa trong vòng 1 giây (thường là cắt lỗ hoặc
//   thanh lý dây chuyền).
// Chỉ dùng lệnh khớp và sổ lệnh đã nhận, không nhìn trước.
import { quantile } from "./orderflow.js?v=202611041932";

export const SWEEP_LEVELS = 3; // lệnh gốc ăn qua từ bấy nhiêu mức giá trở lên

// lệnh chờ lớn: tường đang đứng và tường đã kết thúc, thành các đoạn {p, side, t0, t1, q, kind}
export function largeLots(walls, now) {
  if (!walls) return [];
  const out = [];
  for (const e of walls.events) out.push({ p: e.price, side: e.side, t0: e.t - e.life, t1: e.t, q: e.q, kind: e.kind });
  for (const w of walls.active()) out.push({ p: w.p, side: w.side, t0: w.t0, t1: now, q: w.maxQ, cur: w.q, kind: "live" });
  return out;
}

// lệnh quét: lệnh gốc ăn qua ≥ SWEEP_LEVELS mức giá và đủ lớn (từ ngưỡng lệnh "vừa" của Smart Tape: top 5%)
export function sweeps(prints, minQ, minLevels = SWEEP_LEVELS) {
  const out = [];
  for (const p of prints) if (p.levels >= minLevels && p.q >= minQ) out.push(p);
  return out;
}

// Hấp thụ và chuỗi cắt lỗ, tính dần theo lệnh khớp mới. step() gọi khoảng mỗi giây.
export class FlowMarks {
  constructor({ bucketMs = 5000, holdMs = 15000, pct = 0.99, stopMs = 1000, stopN = 10, stopTicks = 6, stopPct = 0.0004 } = {}) {
    Object.assign(this, { bucketMs, holdMs, pct, stopMs, stopN, stopTicks, stopPct });
    this.reset();
  }
  reset() { this.absorbs = []; this.stops = []; this._absDone = 0; this._stopT = 0; this._thr = Infinity; this._thrT = 0; }

  step(trades, tick, now) {
    if (!trades.length || !(tick > 0)) return;
    this._absorb(trades, tick, now);
    this._stopRuns(trades, tick);
    if (this.absorbs.length > 500) this.absorbs.splice(0, this.absorbs.length - 500);
    if (this.stops.length > 500) this.stops.splice(0, this.stops.length - 500);
  }

  // khối lượng chủ động theo ô (mức giá × phía × 5 giây)
  _buckets(trades, from, tick) {
    const m = new Map();
    for (let i = lowerT(trades, from); i < trades.length; i++) {
      const t = trades[i], k = Math.round(t.p / tick), b = Math.floor(t.t / this.bucketMs), key = `${b}|${k}|${t.side}`;
      const e = m.get(key) || { t0: b * this.bucketMs, k, side: t.side, q: 0, n: 0 };
      e.q += t.q; e.n++; m.set(key, e);
    }
    return m;
  }

  // Hấp thụ: ô có khối lượng chủ động thuộc top 1% và ≥ 5 lần trung vị (so với 15 phút gần nhất), sau đó 15 giây giá không vượt quá
  // mức đó hơn 1 bước giá theo hướng của phía chủ động. Mua bị hấp thụ = phía bán chặn (kháng cự), và ngược lại.
  _absorb(trades, tick, now) {
    if (now - this._thrT > 30e3 || this._thr === Infinity) {
      const qs = [...this._buckets(trades, -Infinity, tick).values()].map(e => e.q);
      this._thr = qs.length >= 100 ? Math.max(quantile(qs, this.pct), 5 * quantile(qs, 0.5)) : Infinity; this._thrT = now;
    }
    if (this._thr === Infinity) return;
    const ready = now - this.holdMs - this.bucketMs, from = Math.max(this._absDone, ready - 60e3);
    for (const e of this._buckets(trades, from, tick).values()) {
      const te = e.t0 + this.bucketMs; if (te > ready || e.t0 < from || e.q < this._thr) continue;
      const p = +(e.k * tick).toPrecision(12); let broke = false;
      for (let i = lowerT(trades, e.t0); i < trades.length && trades[i].t <= te + this.holdMs; i++) {
        const x = trades[i].p;
        if (e.side === "buy" ? x > p + tick * 1.5 : x < p - tick * 1.5) { broke = true; break; }
      }
      if (!broke) this.absorbs.push({ t: e.t0, t1: te, p, side: e.side, q: e.q, n: e.n });
    }
    this._absDone = Math.max(this._absDone, Math.floor(ready / this.bucketMs) * this.bucketMs);
    this.absorbs.sort((a, b) => a.t - b.t);
  }

  // Chuỗi cắt lỗ: trong 1 giây có ≥ 10 lệnh cùng phía, giá đi một mạch ≥ max(6 bước giá, 0,04%) theo hướng đó
  // và lệnh mới nhất ở đúng đỉnh (mua) / đáy (bán) của chuỗi. Chuỗi liền nhau được nối thành một.
  _stopRuns(trades, tick) {
    let j = lowerT(trades, this._stopT - this.stopMs);
    for (let i = lowerT(trades, this._stopT + 1); i < trades.length; i++) {
      const t = trades[i]; while (trades[j].t < t.t - this.stopMs) j++;
      let n = 0, q = 0, ext = t.p, top = true;
      for (let k = j; k <= i; k++) {
        const x = trades[k]; if (x.side !== t.side) continue;
        n++; q += x.q;
        if (t.side === "buy") { ext = Math.min(ext, x.p); if (x.p > t.p) top = false; } else { ext = Math.max(ext, x.p); if (x.p < t.p) top = false; }
      }
      const dist = Math.abs(t.p - ext), need = Math.max(this.stopTicks * tick, this.stopPct * t.p);
      if (n < this.stopN || !top || dist < need) continue;
      const last = this.stops[this.stops.length - 1];
      if (last && last.side === t.side && t.t - last.t1 <= this.stopMs) { last.t1 = t.t; last.p1 = t.p; last.q += t.q; last.n++; }
      else this.stops.push({ t: trades[j].t, t1: t.t, p0: ext, p1: t.p, side: t.side, q, n });
    }
    this._stopT = trades[trades.length - 1].t;
  }
}

function lowerT(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < t) lo = m + 1; else hi = m; }
  return lo;
}
