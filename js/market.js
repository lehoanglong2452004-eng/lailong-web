// Lai Long Web: trạng thái thị trường của một mã đang xem.
//
// - Book: sổ lệnh đầy đủ (mỗi mức giá một khối lượng), sàn ghi trực tiếp vào đây.
// - Heatmap: cứ COL_MS lại chụp sổ lệnh thành một "cột" để vẽ bản đồ nhiệt kiểu Bookmap,
//   kèm khối lượng mua/bán chủ động khớp trong cột đó.
// - Bars: nến của khung đang xem, nến cuối được cập nhật theo từng lệnh khớp, kèm footprint.

import { niceStep, INTERVALS } from "./util.js?v=202610131920";
import { TapeAggregator, quantile } from "./orderflow.js?v=202610131920";

export const COL_MS = 500;
const MAX_COLS = 7200;       // 1 giờ ở 0,5 giây mỗi cột (bộ ghi trên laptop giữ lâu hơn)
const BAND = 0.03;           // chỉ chụp các mức giá trong ±3% quanh giá giữa
const MAX_LEVELS = 700;

export class Book {
  constructor() { this.bids = new Map(); this.asks = new Map(); this.ts = 0; this._sorted = null; }
  clear() { this.bids.clear(); this.asks.clear(); this._sorted = null; }
  set(side, p, q) {
    const m = side === "bid" ? this.bids : this.asks;
    if (q > 0) m.set(p, q); else m.delete(p);
    this._sorted = null;
  }
  sorted() {
    if (!this._sorted) {
      const bids = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
      const asks = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
      // bỏ các mức giá chéo nhau (có thể xảy ra ngắn khi gói tin đến lệch nhau)
      while (bids.length && asks.length && bids[0][0] >= asks[0][0]) {
        if (bids.length > asks.length) bids.shift(); else asks.shift();
      }
      this._sorted = { bids, asks };
    }
    return this._sorted;
  }
  bestBid() { const s = this.sorted().bids; return s.length ? s[0][0] : null; }
  bestAsk() { const s = this.sorted().asks; return s.length ? s[0][0] : null; }
  mid() {
    const b = this.bestBid(), a = this.bestAsk();
    return b !== null && a !== null ? (a + b) / 2 : b ?? a;
  }
  sizeAt(p) { return this.bids.get(p) || this.asks.get(p) || 0; }
}

export class MarketState {
  constructor() { this.listeners = new Set(); this.reset(); }

  reset(opts = {}) {
    this.symbol = opts.symbol || ""; this.exchange = opts.exchange || "";
    this.tick = opts.tick || 0; this.grid = 0; this.interval = opts.interval || "1m";
    this.intervalMs = INTERVALS[this.interval];
    this.book = new Book();
    this.cols = []; this._col = null;
    this.trades = []; this.liqs = [];
    this.bars = []; this.fpStep = 0;
    this.last = null; this.cvd = 0; this.liveStart = null;
    this.tradedAt = new Map(); // khối lượng đã khớp tại từng mức giá kể từ lúc mở trang: [bán, mua]
    this.sizes = []; this.bigTrade = Infinity; // ngưỡng "lệnh lớn": phân vị 99,5%
    // Smart Tape: lệnh gốc sau khi ghép các lệnh nhỏ cùng thời điểm, cùng phía
    this.tape = new TapeAggregator({ tick: this.tick });
    this.prints = []; this.histPrints = []; this.bigPrint = Infinity; this.midPrint = Infinity; // cá voi: top 0,5%, vừa: top 5%
    this.tradedGrid = new Map(); // khối lượng đã khớp theo ô lưới của bản đồ nhiệt (cho bộ theo dõi tường)
    this._pb = null; this._pa = null; this.ofiPend = new Map(); // OFI: thay đổi lệnh chờ ở giá mua/bán tốt nhất
    this.dayVol = new Map(); this.dayStart = Math.floor(Date.now() / 864e5) * 864e5; // khối lượng tại giá trong ngày (UTC)
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(kind) { for (const fn of this.listeners) fn(kind); }

  // ----- nến lịch sử -----
  setBars(bars) {
    this.bars = bars.map(b => ({ ...b, d: deltaOf(b), fp: null, liqL: 0, liqS: 0 }));
    const lastC = bars.length ? bars[bars.length - 1].c : 0;
    this.fpStep = lastC ? footprintStep(lastC, this.intervalMs, this.tick) : 0;
    this.emit("bars");
  }

  // ----- dữ liệu thời gian thực -----
  onBook() {
    if (!this.grid) {
      const mid = this.book.mid();
      if (mid) this.grid = Math.max(this.tick || 0, niceStep(mid * 0.00004));
    }
    this._ofi(Date.now());
    this._ensureCol(Date.now());
    this.emit("book");
  }

  onTrades(list) {
    const now = Date.now();
    if (this.tick && !this.tape.tick) this.tape.tick = this.tick;
    for (const t of list) {
      this.trades.push(t); this.last = t;
      const done = this.tape.add(t);
      if (this.tape.started) { const b = this.book.sorted(); this.tape.cur.meta = { bb: b.bids[0] ? b.bids[0][0] : null, ba: b.asks[0] ? b.asks[0][0] : null, bq: b.bids[0] ? b.bids[0][1] : 0, aq: b.asks[0] ? b.asks[0][1] : 0 }; }
      if (done) this.prints.push(done);
      if (this.tick && t.t >= this.dayStart) { const k = Math.round(t.p / this.tick); this.dayVol.set(k, (this.dayVol.get(k) || 0) + t.q); }
      if (this.grid) { const k = Math.round(t.p / this.grid), e = this.tradedGrid.get(k) || [0, 0]; e[t.side === "buy" ? 1 : 0] += t.q; this.tradedGrid.set(k, e); }
      if (this.tick) { const k = Math.round(t.p / this.tick), e = this.tradedAt.get(k) || [0, 0]; e[t.side === "buy" ? 1 : 0] += t.q; this.tradedAt.set(k, e); }
      const col = this._ensureCol(now);
      if (t.side === "buy") { col.bv += t.q; col.bpv += t.p * t.q; } else { col.sv += t.q; col.spv += t.p * t.q; }
      col.hi = Math.max(col.hi, t.p); col.lo = Math.min(col.lo, t.p);
      this.cvd += t.side === "buy" ? t.q : -t.q;
      this.sizes.push(t.q);
      if (t.q >= this.bigTrade) (col.big || (col.big = [])).push(t);
      this._barTrade(t);
    }
    if (this.sizes.length > 4000) this.sizes.splice(0, this.sizes.length - 3000);
    if (this.prints.length > 6000) this.prints.splice(0, 1000);
    if (this.prints.length >= 50 && this.prints.length % 20 < list.length) this.updateBigPrint();
    if (this.sizes.length > 200 && (this.trades.length % 50 < list.length)) {
      const s = this.sizes.slice().sort((a, b) => a - b);
      this.bigTrade = s[Math.floor(s.length * 0.995)];
    }
    const cutoff = now - 15 * 60e3;
    if (this.trades.length > 20000 || (this.trades.length && this.trades[0].t < cutoff - 60e3)) {
      let k = 0; while (k < this.trades.length && this.trades[k].t < cutoff) k++;
      this.trades.splice(0, Math.max(k, this.trades.length - 20000));
    }
    this.emit("trades");
  }

  // ngưỡng lệnh lớn của Smart Tape: top 0,5% lệnh gốc (cả lịch sử tải lại lẫn trực tiếp)
  updateBigPrint() {
    const qs = this.prints.map(p => p.q); for (const p of this.histPrints) qs.push(p.q);
    if (qs.length >= 50) { this.bigPrint = quantile(qs, 0.995); this.midPrint = quantile(qs, 0.95); }
  }

  // OFI (Order Flow Imbalance, Cont và cộng sự): mỗi lần sổ lệnh đổi, cộng phần lệnh chờ mua tốt nhất
  // tăng thêm và trừ phần lệnh chờ bán tốt nhất tăng thêm. Dương = áp lực mua trong sổ lệnh.
  _ofi(now) {
    const s = this.book.sorted(), bb = s.bids[0], ba = s.asks[0];
    if (!bb || !ba) return;
    if (this._pb && this._pa) {
      const [pb, qb] = this._pb, [pa, qa] = this._pa;
      const e = (bb[0] >= pb ? bb[1] : 0) - (bb[0] <= pb ? qb : 0) - (ba[0] <= pa ? ba[1] : 0) + (ba[0] >= pa ? qa : 0);
      if (e) {
        const bar = this._barAt(now);
        if (bar) bar.ofi = (bar.ofi || 0) + e;
        else if (this.intervalMs) { const bt = Math.floor(now / this.intervalMs) * this.intervalMs; this.ofiPend.set(bt, (this.ofiPend.get(bt) || 0) + e); }
      }
    }
    this._pb = [bb[0], bb[1]]; this._pa = [ba[0], ba[1]];
  }

  onLiq(list) {
    for (const l of list) {
      this.liqs.push(l);
      const col = this._ensureCol(Date.now());
      (col.liq || (col.liq = [])).push(l);
      const b = this._barAt(l.t);
      if (b) { if (l.side === "long") b.liqL += l.q; else b.liqS += l.q; }
    }
    if (this.liqs.length > 5000) this.liqs.splice(0, 1000);
    this.emit("liq");
  }

  // Chụp sổ lệnh vào cột hiện tại; cột mới mở mỗi COL_MS
  _ensureCol(now) {
    const t = Math.floor(now / COL_MS) * COL_MS;
    let col = this._col;
    if (!col || col.t !== t) {
      col = { t, bv: 0, sv: 0, bpv: 0, spv: 0, hi: -Infinity, lo: Infinity, keys: null, sizes: null, bb: null, ba: null };
      this.cols.push(col); this._col = col;
      if (this.cols.length > MAX_COLS) this.cols.splice(0, this.cols.length - MAX_COLS);
    }
    if (this.grid && this.book.ts !== col.bookTs) this._snapshot(col);
    return col;
  }

  _snapshot(col) {
    const { bids, asks } = this.book.sorted(), g = this.grid, mid = this.book.mid();
    if (!mid) return;
    const lo = mid * (1 - BAND), hi = mid * (1 + BAND), agg = new Map();
    for (const side of [bids, asks]) {
      let n = 0;
      for (const [p, q] of side) {
        if (p < lo || p > hi || n++ > MAX_LEVELS) break;
        const k = Math.round(p / g); agg.set(k, (agg.get(k) || 0) + q);
      }
    }
    const keys = new Int32Array(agg.size), sizes = new Float32Array(agg.size); let i = 0;
    for (const [k, q] of agg) { keys[i] = k; sizes[i] = q; i++; }
    col.keys = keys; col.sizes = sizes; col.bookTs = this.book.ts;
    col.bb = bids.length ? bids[0][0] : null; col.ba = asks.length ? asks[0][0] : null;
  }

  _barAt(t) {
    const n = this.bars.length; if (!n) return null;
    const bt = Math.floor(t / this.intervalMs) * this.intervalMs;
    for (let i = n - 1; i >= Math.max(0, n - 3); i--) if (this.bars[i].t === bt) return this.bars[i];
    return null;
  }

  _barTrade(tr) {
    if (!this.bars.length || !this.fpStep) return;
    if (this.liveStart === null) this.liveStart = tr.t; // mốc nối giữa dữ liệu lịch sử và trực tiếp
    const ms = this.intervalMs, bt = Math.floor(tr.t / ms) * ms;
    let b = this.bars[this.bars.length - 1];
    if (bt < b.t) return;
    if (bt > b.t) {
      b = { t: bt, o: tr.p, h: tr.p, l: tr.p, c: tr.p, v: 0, bv: 0, d: 0, fp: new Map(), liqL: 0, liqS: 0, live: true, fund: b.fund };
      if (this.ofiPend.has(bt)) { b.ofi = this.ofiPend.get(bt); this.ofiPend.delete(bt); }
      this.bars.push(b);
      if (this.bars.length > 20000) this.bars.shift();
      this.emit("newbar");
    }
    // nến đang chạy lúc mở trang: bỏ phần ước tính, dựng lại từ lệnh khớp thật
    // (phần trước lúc mở trang được bù bằng dữ liệu lịch sử nếu sàn cho tải)
    if (!b.fp || b.fpApprox) { b.fp = new Map(); b.fpApprox = false; b.live = true; }
    b.h = Math.max(b.h, tr.p); b.l = Math.min(b.l, tr.p); b.c = tr.p; b.v += tr.q;
    if (tr.side === "buy") b.bv = (b.bv || 0) + tr.q;
    b.d += tr.side === "buy" ? tr.q : -tr.q;
    // đỉnh/đáy CVD trong nến (cho CVD Pro), tính từ lúc bắt đầu theo dõi nến này
    if (b.cvdH == null) { b.cvdH = Math.max(0, b.d); b.cvdL = Math.min(0, b.d); } else { b.cvdH = Math.max(b.cvdH, b.d); b.cvdL = Math.min(b.cvdL, b.d); }
    const k = Math.floor(tr.p / this.fpStep + 1e-9), cell = b.fp.get(k) || [0, 0];
    cell[tr.side === "buy" ? 1 : 0] += tr.q; b.fp.set(k, cell);
  }
}

function deltaOf(b) {
  if (typeof b.bv === "number" && isFinite(b.bv)) return 2 * b.bv - b.v;
  const r = b.h - b.l; return r > 0 ? b.v * (b.c - b.o) / r : 0;
}

// Bước giá footprint: khoảng 1/40 biên độ nến điển hình của khung thời gian
export function footprintStep(price, intervalMs, tick) {
  const minutes = intervalMs / 60e3;
  const ratio = 0.00004 * Math.sqrt(minutes);
  return Math.max(tick || 0, niceStep(price * ratio));
}
