// Lai Long Web: khớp lệnh giả lập, mô phỏng sát cách sàn khớp thật.
//
// - Lệnh market "ăn" dần từng mức giá trong sổ lệnh thật, nên lệnh to sẽ bị trượt giá.
// - Lệnh limit vượt giá thị trường khớp ngay với sổ lệnh (taker), phần còn lại nằm chờ.
// - Lệnh limit nằm chờ phải xếp hàng: phía trước là toàn bộ khối lượng đang chờ ở mức giá đó
//   lúc đặt. Chỉ khi giao dịch thật khớp hết phần phía trước mới tới lượt mình (khớp từng phần).
//   Nếu giá chạy xuyên qua mức giá đặt thì khớp hết. Khối lượng phía trước giảm khi người khác huỷ.
// - Ký quỹ cô lập: lỗ chạm ngưỡng ký quỹ duy trì thì bị thanh lý.

export const TAKER_FEE = 0.0005, MAKER_FEE = 0.0002, MMR = 0.005, START_BALANCE = 10000;
const STORE = "lailong.paper.v1";

export class PaperBroker {
  constructor(onChange) {
    this.onChange = onChange || (() => {});
    this.load();
  }

  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { s = null; }
    this.s = s || { balance: START_BALANCE, orders: [], fills: [], positions: {}, seq: 1, logs: [] };
  }
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.s)); } catch { /* chế độ riêng tư */ } }
  reset() { localStorage.removeItem(STORE); this.load(); this.log("Đã đặt lại tài khoản giả lập về 10.000 USDT"); this._changed(); }

  log(text) { this.s.logs.unshift({ t: Date.now(), text }); this.s.logs.length = Math.min(this.s.logs.length, 300); }
  _changed() { this.save(); this.onChange(); }

  pos(key) { return this.s.positions[key] || (this.s.positions[key] = { key, qty: 0, avg: 0, lev: 10, realized: 0, mark: 0 }); }
  openOrders(key) { return this.s.orders.filter(o => o.status === "open" && (!key || o.key === key)); }

  account() {
    let upnl = 0, posMargin = 0, ordMargin = 0;
    for (const p of Object.values(this.s.positions)) {
      if (!p.qty) continue;
      upnl += (p.mark - p.avg) * p.qty; posMargin += Math.abs(p.qty) * p.avg / p.lev;
    }
    for (const o of this.openOrders()) ordMargin += o.remaining * o.price / o.lev;
    const equity = this.s.balance + upnl;
    return { balance: this.s.balance, equity, upnl, posMargin, ordMargin, available: equity - posMargin - ordMargin };
  }

  positionView(key) {
    const p = this.pos(key);
    const upnl = p.qty ? (p.mark - p.avg) * p.qty : 0;
    return { ...p, upnl, margin: p.qty ? Math.abs(p.qty) * p.avg / p.lev : 0, liq: liqPrice(p) };
  }

  // ----- đặt / huỷ lệnh -----
  place({ key, side, type, qty, price, lev }, book) {
    qty = +qty; lev = Math.max(1, Math.min(125, +lev || 1));
    const reject = why => { this.log(`Từ chối lệnh: ${why}`); this._changed(); return { error: why }; };
    if (!(qty > 0)) return reject("khối lượng phải lớn hơn 0");
    const best = side === "buy" ? book.bestAsk() : book.bestBid();
    if (best === null) return reject("chưa có sổ lệnh");
    if (type === "limit" && !(price > 0)) return reject("giá không hợp lệ");
    const refPx = type === "market" ? best : price;
    const p = this.pos(key);
    const reducing = p.qty && Math.sign(p.qty) !== (side === "buy" ? 1 : -1) ? Math.min(Math.abs(p.qty), qty) : 0;
    const need = (qty - reducing) * refPx / lev + qty * refPx * TAKER_FEE;
    if (need > this.account().available + 1e-9) return reject(`không đủ ký quỹ (cần ${need.toFixed(2)} USDT)`);
    p.lev = lev;
    const o = { id: "P" + this.s.seq++, key, side, type, qty, remaining: qty, price: type === "limit" ? price : 0, lev, status: "open", t: Date.now(), queueAhead: 0, avgFill: 0, filled: 0 };
    this.s.orders.unshift(o); this.s.orders.length = Math.min(this.s.orders.length, 500);
    // phần khớp ngay với sổ lệnh (taker)
    const levels = side === "buy" ? book.sorted().asks : book.sorted().bids;
    for (const [lp, lq] of levels) {
      if (o.remaining <= 1e-12) break;
      if (type === "limit" && (side === "buy" ? lp > price : lp < price)) break;
      this._fill(o, Math.min(lq, o.remaining), lp, "taker");
    }
    if (type === "market") {
      if (o.remaining > 1e-12) { o.status = o.filled ? "filled" : "rejected"; this.log(`Sổ lệnh không đủ sâu, huỷ phần còn lại ${o.remaining.toFixed(6)}`); o.remaining = 0; }
    } else if (o.remaining > 1e-12) {
      o.queueAhead = (side === "buy" ? book.bids.get(price) : book.asks.get(price)) || 0;
      this.log(`Đặt ${side === "buy" ? "MUA" : "BÁN"} limit ${o.remaining} @ ${price}, phía trước còn ${o.queueAhead.toFixed(4)} đang chờ`);
    }
    this._changed();
    return { order: o };
  }

  cancel(id) {
    const o = this.s.orders.find(x => x.id === id && x.status === "open");
    if (o) { o.status = o.filled ? "partial" : "cancelled"; this.log(`Huỷ lệnh ${id}`); this._changed(); }
  }
  cancelAll(key) { for (const o of this.openOrders(key)) o.status = o.filled ? "partial" : "cancelled"; this.log("Huỷ tất cả lệnh"); this._changed(); }
  closePosition(key, book) {
    const p = this.pos(key); if (!p.qty) return;
    this.place({ key, side: p.qty > 0 ? "sell" : "buy", type: "market", qty: Math.abs(p.qty), lev: p.lev }, book);
  }

  // ----- dữ liệu thị trường -----
  onBook(key, book) {
    let changed = false;
    for (const o of this.openOrders(key)) {
      const lvl = (o.side === "buy" ? book.bids.get(o.price) : book.asks.get(o.price)) || 0;
      if (lvl < o.queueAhead) { o.queueAhead = lvl; changed = true; } // người phía trước huỷ lệnh
    }
    if (changed) this.save();
  }

  onTrades(key, trades) {
    const p = this.pos(key); let changed = false;
    for (const t of trades) {
      p.mark = t.p;
      for (const o of this.openOrders(key)) {
        // lệnh mua chờ chỉ khớp với người BÁN chủ động, và ngược lại
        const hits = o.side === "buy" ? t.side === "sell" && t.p <= o.price : t.side === "buy" && t.p >= o.price;
        if (!hits) continue;
        const through = o.side === "buy" ? t.p < o.price : t.p > o.price;
        let q;
        if (through) q = o.remaining;
        else {
          const eat = Math.min(o.queueAhead, t.q); o.queueAhead -= eat;
          q = Math.min(o.remaining, t.q - eat);
        }
        if (q > 1e-12) { this._fill(o, q, o.price, "maker"); changed = true; }
      }
      if (this._checkLiq(p)) changed = true;
    }
    if (changed) this._changed();
  }

  _checkLiq(p) {
    if (!p.qty) return false;
    const lp = liqPrice(p);
    if ((p.qty > 0 && p.mark <= lp) || (p.qty < 0 && p.mark >= lp)) {
      const loss = Math.abs(p.qty) * p.avg / p.lev;
      this.s.balance -= loss; p.realized -= loss;
      this.log(`THANH LÝ ${p.qty > 0 ? "LONG" : "SHORT"} ${Math.abs(p.qty)} ${p.key} tại ${lp.toFixed(4)}, mất ${loss.toFixed(2)} USDT ký quỹ`);
      this.s.fills.unshift({ id: "L" + this.s.seq++, orderId: "-", key: p.key, side: p.qty > 0 ? "sell" : "buy", qty: Math.abs(p.qty), price: lp, fee: 0, liquidity: "thanh lý", t: Date.now() });
      p.qty = 0; p.avg = 0;
      for (const o of this.openOrders(p.key)) o.status = "cancelled";
      return true;
    }
    return false;
  }

  _fill(o, q, px, liquidity) {
    q = +q.toFixed(10);
    const fee = q * px * (liquidity === "maker" ? MAKER_FEE : TAKER_FEE);
    o.avgFill = (o.avgFill * o.filled + px * q) / (o.filled + q); o.filled += q; o.remaining = +(o.remaining - q).toFixed(10);
    if (o.remaining <= 1e-12) { o.remaining = 0; o.status = "filled"; }
    this.s.balance -= fee;
    const p = this.pos(o.key), dq = o.side === "buy" ? q : -q;
    if (!p.qty || Math.sign(p.qty) === Math.sign(dq)) { // mở thêm
      p.avg = (p.avg * Math.abs(p.qty) + px * q) / (Math.abs(p.qty) + q); p.qty = +(p.qty + dq).toFixed(10); p.lev = o.lev;
    } else { // giảm / đảo vị thế
      const close = Math.min(Math.abs(p.qty), q), pnl = (px - p.avg) * close * Math.sign(p.qty);
      this.s.balance += pnl; p.realized += pnl; p.qty = +(p.qty + dq).toFixed(10);
      if (Math.abs(p.qty) < 1e-10) { p.qty = 0; p.avg = 0; } else if (Math.sign(p.qty) === Math.sign(dq)) p.avg = px;
    }
    p.mark = p.mark || px;
    this.s.fills.unshift({ id: "F" + this.s.seq++, orderId: o.id, key: o.key, side: o.side, qty: q, price: px, fee, liquidity, t: Date.now() });
    this.s.fills.length = Math.min(this.s.fills.length, 500);
    this.log(`Khớp ${o.side === "buy" ? "MUA" : "BÁN"} ${q} @ ${px} (${liquidity === "maker" ? "maker, phí 0,02%" : "taker, phí 0,05%"})`);
  }
}

export function liqPrice(p) {
  if (!p.qty) return 0;
  return p.qty > 0 ? p.avg * (1 - 1 / p.lev + MMR) : p.avg * (1 + 1 / p.lev - MMR);
}
