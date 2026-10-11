// Lai Long Web: sổ lệnh DOM dạng bậc thang để theo dõi dòng lệnh.
//
// Cột: lệnh khớp 60 giây gần nhất (bong bóng) | đã khớp tại giá kể từ lúc mở trang (bán | mua)
//      | chờ mua | giá | chờ bán

import { fmtVol, decimalsFor, MONO, fitCanvas } from "./util.js";
import { T, alpha } from "./theme.js";

const ROW_H = 20, TAPE_MS = 60000;

export class Dom {
  constructor(canvas, market) {
    this.cv = canvas; this.m = market;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.center = null; this.tick = 0; this.mult = 1; this.hover = null; this.follow = true; this.dirty = true;
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => { this.dirty = true; }, 400);
  }
  reset() { this.center = null; this.tick = 0; this.follow = true; this.dirty = true; }
  recenter() { const m = this.m.book.mid(); if (m != null && this.tick) this.center = this._snap(m); this.follow = true; this.dirty = true; }
  update() {
    const t = (this.m.tick || this.m.grid) * this.mult;
    if (t && t !== this.tick) { this.tick = t; this.center = null; }
    const mid = this.m.book.mid();
    if (mid != null && this.tick) {
      if (this.center === null) this.center = this._snap(mid);
      const half = Math.floor(this._rows() / 2);
      if (this.follow && Math.abs((this.center - mid) / this.tick) > half * 0.6) this.center = this._snap(mid);
    }
    this.dirty = true;
  }
  setMult(k) { this.mult = k; this.tick = 0; this.update(); }

  // vị trí các cột theo độ rộng hiện tại
  get cols() {
    const w = this.S.w, tape = Math.max(50, w * 0.14), price = Math.max(70, w * 0.2), rest = w - tape - price;
    const traded = rest * 0.3, side = (rest - traded) / 2;
    const xTr = tape, xBid = tape + traded, xPrice = xBid + side, xAsk = xPrice + price;
    return { tape, traded, side, price, xTr, xBid, xPrice, xAsk };
  }
  _snap(p) { return Math.round(p / this.tick) * this.tick; }
  _rows() { return Math.max(3, Math.floor(this.S.h / ROW_H)); }
  _priceOfRow(k) { return this.center + (Math.floor(this._rows() / 2) - k) * this.tick; }
  _rowOf(p) { return Math.floor(this._rows() / 2) - Math.round((p - this.center) / this.tick); }

  _levels() {
    const rows = this._rows(), { bids, asks } = this.m.book.sorted(), lv = new Map();
    for (const [side, list] of [["bid", bids], ["ask", asks]]) for (const [p, q] of list) {
      const k = this._rowOf(p); if (k < 0 || k >= rows) continue;
      const e = lv.get(k) || { bid: 0, ask: 0 }; e[side] += q; lv.set(k, e);
    }
    const traded = new Map(), tk = this.m.tick;
    if (tk) for (const [key, v] of this.m.tradedAt) {
      const k = this._rowOf(key * tk); if (k < 0 || k >= rows) continue;
      const e = traded.get(k) || [0, 0]; e[0] += v[0]; e[1] += v[1]; traded.set(k, e);
    }
    return { lv, traded, bestBid: bids.length ? this._rowOf(bids[0][0]) : null, bestAsk: asks.length ? this._rowOf(asks[0][0]) : null };
  }

  _draw() {
    const ctx = this.ctx, w = this.S.w, h = this.S.h;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h);
    if (this.center === null || !this.tick) { ctx.fillStyle = T.muted; ctx.font = "13px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.fillText("Đang chờ sổ lệnh...", w / 2, h / 2); return; }
    const rows = this._rows(), dec = decimalsFor(this.tick), c = this.cols, { lv, traded, bestBid, bestAsk } = this._levels();
    let maxQ = 0, maxT = 0;
    for (const v of lv.values()) maxQ = Math.max(maxQ, v.bid, v.ask);
    for (const v of traded.values()) maxT = Math.max(maxT, v[0] + v[1]);
    const last = this.m.last, lastRow = last ? this._rowOf(last.p) : null;
    ctx.textBaseline = "middle";
    for (let k = 0; k < rows; k++) {
      const y = k * ROW_H, price = this._priceOfRow(k), e = lv.get(k), ask = bestAsk !== null ? k <= bestAsk : price > this.center;
      if (this.hover === k) { ctx.fillStyle = alpha(T.accent, 0.14); ctx.fillRect(0, y, w, ROW_H); }
      ctx.fillStyle = alpha(ask ? T.down : T.up, 0.09); ctx.fillRect(c.xPrice, y, c.price, ROW_H - 1);
      ctx.font = `12px ${MONO}`;
      // đã khớp tại giá: phần bán (đỏ) và mua (xanh) nối tiếp nhau
      const tr = traded.get(k);
      if (tr && maxT) {
        const ws = tr[0] / maxT * (c.traded - 6), wb = tr[1] / maxT * (c.traded - 6);
        ctx.fillStyle = alpha(T.down, 0.55); ctx.fillRect(c.xTr + 3, y + 3, ws, ROW_H - 6);
        ctx.fillStyle = alpha(T.up, 0.55); ctx.fillRect(c.xTr + 3 + ws, y + 3, wb, ROW_H - 6);
        if (c.traded > 70) { ctx.fillStyle = T.text; ctx.textAlign = "right"; ctx.fillText(fmtVol(tr[0] + tr[1]), c.xBid - 4, y + ROW_H / 2); }
      }
      if (e && maxQ) {
        if (e.bid) {
          const bw = e.bid / maxQ * (c.side - 6); ctx.fillStyle = alpha(T.up, 0.4); ctx.fillRect(c.xPrice - 3 - bw, y + 2, bw, ROW_H - 4);
          ctx.fillStyle = T.up; ctx.textAlign = "right"; ctx.fillText(fmtVol(e.bid), c.xPrice - 6, y + ROW_H / 2);
        }
        if (e.ask) {
          const aw = e.ask / maxQ * (c.side - 6); ctx.fillStyle = alpha(T.down, 0.4); ctx.fillRect(c.xAsk + 3, y + 2, aw, ROW_H - 4);
          ctx.fillStyle = T.down; ctx.textAlign = "left"; ctx.fillText(fmtVol(e.ask), c.xAsk + 6, y + ROW_H / 2);
        }
      }
      const best = k === bestBid || k === bestAsk;
      ctx.font = `${best ? "bold " : ""}12px ${MONO}`; ctx.fillStyle = best ? "#fff" : T.text; ctx.textAlign = "center";
      ctx.fillText(price.toFixed(dec), c.xPrice + c.price / 2, y + ROW_H / 2);
      if (k === lastRow) { ctx.strokeStyle = last.side === "buy" ? T.up : T.down; ctx.lineWidth = 1.5; ctx.strokeRect(c.xPrice + 1, y + 1, c.price - 2, ROW_H - 3); }
      ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 0.5); ctx.lineTo(w, y + ROW_H - 0.5); ctx.stroke();
    }
    ctx.strokeStyle = T.line; ctx.beginPath(); for (const x of [c.xTr, c.xBid, c.xPrice, c.xAsk]) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); } ctx.stroke();
    // bong bóng lệnh khớp 60 giây gần nhất
    const now = Date.now(), list = this.m.trades; let start = list.length, maxB = 0;
    while (start > 0 && now - list[start - 1].t < TAPE_MS && list.length - start < 3000) start--;
    for (let i = start; i < list.length; i++) maxB = Math.max(maxB, list[i].q);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, c.tape, h); ctx.clip();
    for (let i = start; i < list.length; i++) {
      const t = list[i], x = c.tape - 6 - (now - t.t) / TAPE_MS * (c.tape - 12), yy = this._rowOf(t.p) * ROW_H + ROW_H / 2;
      ctx.fillStyle = alpha(t.side === "buy" ? T.up : T.down, 0.6);
      ctx.beginPath(); ctx.arc(x, yy, Math.max(1.5, Math.sqrt(t.q / (maxB || 1)) * 10), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  hitTest(x, y) {
    if (this.center === null || !this.tick) return null;
    const k = Math.floor(y / ROW_H), price = this._priceOfRow(k), dec = decimalsFor(this.tick), c = this.cols, { lv, traded } = this._levels();
    const e = lv.get(k) || { bid: 0, ask: 0 }, tr = traded.get(k) || [0, 0];
    if (x < c.tape) return "Bong bóng: lệnh khớp trong 60 giây gần nhất, trôi từ phải sang trái. Xanh là mua chủ động, đỏ là bán chủ động.";
    return `Giá ${price.toFixed(dec)} · chờ mua ${fmtVol(e.bid)} · chờ bán ${fmtVol(e.ask)} · đã khớp từ lúc mở trang: bán ${fmtVol(tr[0])}, mua ${fmtVol(tr[1])}`;
  }

  _bind() {
    const cv = this.cv, row = e => { const r = cv.getBoundingClientRect(); return Math.floor((e.clientY - r.top) / ROW_H); };
    cv.addEventListener("mousemove", e => { this.hover = row(e); this.dirty = true; });
    cv.addEventListener("mouseleave", () => { this.hover = null; this.dirty = true; });
    cv.addEventListener("dblclick", () => this.recenter());
    cv.addEventListener("wheel", e => { e.preventDefault(); if (this.center === null) return; this.center += (e.deltaY < 0 ? 3 : -3) * this.tick; this.follow = false; this.dirty = true; }, { passive: false });
  }
}
