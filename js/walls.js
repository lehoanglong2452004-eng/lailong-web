// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: theo dõi "tường" lệnh chờ lớn trong sổ lệnh để phát hiện tường giả (spoofing).
//
// Mỗi giây so sổ lệnh (đã gộp theo bước giá của bản đồ nhiệt) với lần trước:
//   - Tường = lệnh chờ ≥ 6 lần mức trung vị và thuộc top 3% các mức giá trong ±1% quanh giá.
//   - Khi tường mất ≥ 75% khối lượng: so khối lượng đã khớp tại đó kể từ lúc tường xuất hiện.
//       khớp ≥ 50% phần mất  -> "bị ăn" (tường thật, có người khớp vào)
//       khớp ít, giá đã tới gần -> "rút khi giá tới gần" (nghi tường giả: dựng lên để doạ rồi rút)
//       khớp ít, giá còn xa    -> "rút khi giá còn xa" (đổi ý bình thường)
// Sau mỗi kết cục, theo dõi giá thêm 5 phút: giá đi bao nhiêu sau 1 phút, 5 phút, xa nhất mỗi phía
// (nhật ký tường và thống kê trong phiên).

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
  reset() { this.walls = new Map(); this.events = []; this.born = []; this.log = []; this.pending = []; this.grid = 0; }

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
      const w = { k, p, side: p < mid ? "bid" : "ask", t0: now, maxQ: q, q, dist0: Math.abs(p - mid), minDist: Math.abs(p - mid), tr0: tradedAt(k) };
      this.walls.set(k, w); this.born.push(w);
      this.log.push({ t: now, side: w.side, price: p, q, dist: w.dist0 });
    }
    if (this.born.length > 200) this.born.splice(0, this.born.length - 200);
    if (this.log.length > 2000) this.log.splice(0, 500);
    this._track(now, mid);
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
      const ev = { t: now, side: w.side, price: w.p, q: w.maxQ, life, dist, dist0: w.dist0, traded: hit, kind, mid0: mid, hi: mid, lo: mid, r60: null, r300: null };
      this.events.push(ev); done.push(ev); this.pending.push(ev);
    }
    if (this.events.length > 2000) this.events.splice(0, 500);
    return done;
  }

  // giá sau kết cục: biến động tính theo % so với giá lúc tường mất
  _track(now, mid) {
    const left = [];
    for (const e of this.pending) {
      const dt = now - e.t;
      if (dt <= 300e3) { e.hi = Math.max(e.hi, mid); e.lo = Math.min(e.lo, mid); }
      const snap = () => ({ end: (mid / e.mid0 - 1) * 100, up: (e.hi / e.mid0 - 1) * 100, dn: (e.lo / e.mid0 - 1) * 100 });
      if (!e.r60 && dt >= 60e3) e.r60 = snap();
      if (dt >= 300e3) e.r300 = snap(); else left.push(e);
    }
    this.pending = left;
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

// Thống kê tường trong phiên. "Theo phía tường": dương nghĩa là giá đi theo hướng tường bảo vệ
// (tường chờ mua -> giá lên, tường chờ bán -> giá xuống).
export function wallStats(events, { h = "r60" } = {}) {
  const side = s => {
    const ev = events.filter(e => e.side === s), c = k => ev.filter(e => e.kind === k).length;
    const sp = c("spoof"), fi = c("filled");
    return { n: ev.length, spoof: sp, pulled: c("pulled"), filled: fi, spoofRate: sp + fi ? sp / (sp + fi) : null, life: ev.length ? ev.reduce((a, e) => a + e.life, 0) / ev.length : null };
  };
  const react = kind => {
    const ev = events.filter(e => e.kind === kind && e[h]);
    if (!ev.length) return null;
    const dir = e => (e.side === "bid" ? 1 : -1), avg = f => ev.reduce((a, e) => a + f(e), 0) / ev.length;
    return {
      n: ev.length,
      move: avg(e => dir(e) * e[h].end),                                 // giá đi theo phía tường (%)
      fav: avg(e => (e.side === "bid" ? e[h].up : -e[h].dn)),            // xa nhất theo phía tường
      adv: avg(e => (e.side === "bid" ? -e[h].dn : e[h].up)),            // xa nhất ngược phía tường
      hold: ev.filter(e => dir(e) * e[h].end > 0).length / ev.length,    // tỷ lệ giá đi theo phía tường
    };
  };
  // mức giá bị rút khi giá tới gần nhiều lần nhất
  const by = new Map();
  for (const e of events) if (e.kind === "spoof") { const k = e.price, x = by.get(k) || { price: k, side: e.side, n: 0, q: 0 }; x.n++; x.q += e.q; by.set(k, x); }
  const hot = [...by.values()].filter(x => x.n >= 2).sort((a, b) => b.n - a.n || b.q - a.q).slice(0, 5);
  return { bid: side("bid"), ask: side("ask"), react: { spoof: react("spoof"), filled: react("filled"), pulled: react("pulled") }, hot };
}

// Mất cân bằng sổ lệnh gần giá từ một ảnh chụp sổ (khoá ô lưới, các ô mua đứng trước): (chờ mua − chờ bán) / tổng
// trong ±band quanh giá giữa. +1: chỉ có lệnh chờ mua, −1: chỉ có chờ bán.
export function bookImb(keys, sizes, knb, band = 0.005) {
  if (!keys || !keys.length || !knb || knb >= keys.length) return null;
  let bb = -Infinity, ba = Infinity;
  for (let i = 0; i < keys.length; i++) if (i < knb) bb = Math.max(bb, keys[i]); else ba = Math.min(ba, keys[i]);
  const mid = (bb + ba) / 2, w = Math.abs(mid) * band;
  let b = 0, a = 0;
  for (let i = 0; i < keys.length; i++) { if (Math.abs(keys[i] - mid) > w) continue; if (i < knb) b += sizes[i]; else a += sizes[i]; }
  return b + a ? (b - a) / (b + a) : null;
}
