// Lai Long Web: theo dõi "tường" lệnh chờ lớn trong sổ lệnh để phát hiện tường giả (spoofing).
//
// Mỗi giây so sổ lệnh (đã gộp theo bước giá của bản đồ nhiệt) với lần trước:
//   - Tường = lệnh chờ ≥ 6 lần mức trung vị và thuộc top 3% các mức giá trong ±1% quanh giá.
//   - Khi tường mất ≥ 75% khối lượng: so khối lượng đã khớp tại đó kể từ lúc tường xuất hiện.
//       khớp ≥ 50% phần mất  -> "bị ăn" (tường thật, có người khớp vào)
//       khớp ít, giá đã tới gần -> "rút khi giá tới gần" (nghi tường giả: dựng lên để doạ rồi rút)
//       khớp ít, giá còn xa    -> "rút khi giá còn xa" (đổi ý bình thường)

export const WALL_KIND = {
  spoof: { label: "Rút khi giá tới gần", cls: "neg", note: "nghi tường giả" },
  pulled: { label: "Rút khi giá còn xa", cls: "muted", note: "đổi ý" },
  filled: { label: "Bị ăn", cls: "pos", note: "tường thật" },
};

export class WallTracker {
  constructor({ band = 0.01, mult = 6, top = 0.97, gone = 0.25, minLife = 3000, nearPct = 0.0012, nearGrid = 8 } = {}) {
    Object.assign(this, { band, mult, top, gone, minLife, nearPct, nearGrid });
    this.reset();
  }
  reset() { this.walls = new Map(); this.events = []; this.grid = 0; }

  // col: cột bản đồ nhiệt mới nhất {keys, sizes}; traded: Map(khoá ô lưới -> [bán, mua] cộng dồn)
  step(now, col, mid, grid, traded) {
    if (!col || !col.keys || !mid || !grid) return [];
    if (grid !== this.grid) { this.walls.clear(); this.grid = grid; }
    const cur = new Map(), near = [];
    for (let i = 0; i < col.keys.length; i++) {
      const k = col.keys[i], p = k * grid, q = col.sizes[i];
      if (Math.abs(p - mid) / mid > this.band * 1.5) continue;
      cur.set(k, q); if (Math.abs(p - mid) / mid <= this.band) near.push(q);
    }
    if (near.length < 10) return [];
    near.sort((a, b) => a - b);
    const thr = Math.max(near[near.length >> 1] * this.mult, near[Math.min(near.length - 1, Math.floor(near.length * this.top))]);
    const tradedAt = k => { const e = traded.get(k); return e ? e[0] + e[1] : 0; };
    for (const [k, q] of cur) {
      if (q < thr || this.walls.has(k)) continue;
      const p = k * grid;
      if (Math.abs(p - mid) <= grid) continue; // ngay sát giá, không phân biệt được
      this.walls.set(k, { k, p, side: p < mid ? "bid" : "ask", t0: now, maxQ: q, q, dist0: Math.abs(p - mid), minDist: Math.abs(p - mid), tr0: tradedAt(k) });
    }
    const done = [];
    for (const [k, w] of this.walls) {
      const dist = Math.abs(w.p - mid);
      if (dist / mid > this.band * 1.5) { this.walls.delete(k); continue; } // ra khỏi vùng theo dõi, không kết luận
      const q = cur.get(k) || 0;
      w.maxQ = Math.max(w.maxQ, q); w.q = q; w.minDist = Math.min(w.minDist, dist);
      const crossed = w.side === "bid" ? mid < w.p : mid > w.p;
      if (q > this.gone * w.maxQ && !crossed) continue;
      this.walls.delete(k);
      const life = now - w.t0; if (life < this.minLife) continue; // nhấp nháy, bỏ qua
      const removed = w.maxQ - q, hit = Math.max(0, tradedAt(k) - w.tr0);
      const isNear = dist <= Math.max(this.nearGrid * grid, this.nearPct * mid);
      const kind = hit >= 0.5 * removed || crossed ? "filled" : isNear ? "spoof" : "pulled";
      const ev = { t: now, side: w.side, price: w.p, q: w.maxQ, life, dist, dist0: w.dist0, traded: hit, kind };
      this.events.push(ev); done.push(ev);
    }
    if (this.events.length > 2000) this.events.splice(0, 500);
    return done;
  }

  // các tường đang đứng (để vẽ)
  active() { return [...this.walls.values()]; }
  // số lần bị rút khi giá tới gần tại từng ô lưới trong windowMs gần nhất
  spoofCounts(now, windowMs = 10 * 60e3) {
    const m = new Map();
    for (const e of this.events) if (e.kind === "spoof" && now - e.t <= windowMs) { const k = Math.round(e.price / this.grid); m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }
}
