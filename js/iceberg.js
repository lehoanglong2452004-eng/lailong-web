// Lai Long Web: phát hiện lệnh băng chìm (iceberg) và lệnh nạp lại liên tục, kiểu Bookmap.
//
// Ở một mức giá đang bị khớp chủ động (ví dụ phe bán đập liên tục vào giá chờ mua 100), so tổng khối lượng
// đã khớp ở đó với lượng lớn nhất từng hiện trên sổ lệnh tại giá đó. Nếu khớp được nhiều gấp `ratio` lần
// lượng hiện ra mà mức giá vẫn đứng, nghĩa là có người giấu lệnh lớn (iceberg) hoặc liên tục nạp thêm.
// Sàn crypto không cho biết lệnh nào là iceberg, nên đây là ước tính từ dữ liệu sổ lệnh và lệnh khớp.
//
// Mỗi phát hiện kết thúc theo một trong hai cách:
//   giữ  : không còn bị khớp ở đó trong `idleMs` mà giá chưa xuyên qua (tường ẩn đã chặn được giá)
//   thủng: giá đã đi xuyên qua mức đó (phe chủ động thắng)

export class IcebergTracker {
  constructor({ ratio = 2, minTrades = 3, idleMs = 20000 } = {}) {
    Object.assign(this, { ratio, minTrades, idleMs });
    this.reset();
  }
  reset() { this.lv = new Map(); this.events = []; }

  // t: lệnh khớp {t, p, q, side}; dispQ: lượng đang hiện trên sổ ở giá đó, phía bị khớp; minQ: khối lượng ẩn tối thiểu
  onTrade(t, dispQ, tick, minQ) {
    if (!tick || !(minQ > 0) || !isFinite(minQ)) return null;
    const side = t.side === "buy" ? "ask" : "bid", k = Math.round(t.p / tick), id = side + k;
    let s = this.lv.get(id);
    if (!s || t.t - s.last > this.idleMs) { s = { side, k, p: t.p, t0: t.t, last: t.t, filled: 0, disp: 0, n: 0, ev: null }; this.lv.set(id, s); }
    s.filled += t.q; s.n++; s.last = t.t; s.disp = Math.max(s.disp, dispQ || 0);
    const hidden = s.filled - s.disp;
    if (s.ev) { Object.assign(s.ev, { t1: t.t, filled: s.filled, disp: s.disp, hidden, n: s.n }); return null; }
    if (s.disp > 0 && s.n >= this.minTrades && s.filled >= this.ratio * s.disp && hidden >= minQ) {
      s.ev = { t: s.t0, t1: t.t, side, price: s.p, filled: s.filled, disp: s.disp, hidden, n: s.n, status: "live" };
      this.events.push(s.ev);
      if (this.events.length > 1000) this.events.splice(0, 200);
      return s.ev;
    }
    return null;
  }

  // gọi khi sổ lệnh đổi: cập nhật lượng đang hiện, kết thúc các mức đã thủng hoặc đã yên
  onBook(now, book) {
    const bb = book.bestBid(), ba = book.bestAsk();
    for (const [id, s] of this.lv) {
      const m = s.side === "bid" ? book.bids : book.asks, q = m.get(s.p) || 0;
      if (q > s.disp && !s.ev) s.disp = q;
      const broken = s.side === "bid" ? bb != null && bb < s.p && !q : ba != null && ba > s.p && !q;
      if (broken) { if (s.ev) { s.ev.status = "broken"; s.ev.tEnd = now; } this.lv.delete(id); }
      else if (now - s.last > this.idleMs) { if (s.ev) { s.ev.status = "held"; s.ev.tEnd = now; } this.lv.delete(id); }
    }
  }

  stats() {
    const c = { live: 0, held: 0, broken: 0 };
    for (const e of this.events) c[e.status]++;
    return c;
  }
}
