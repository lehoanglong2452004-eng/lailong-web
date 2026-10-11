// Lai Long Web: sổ lệnh DOM dạng bậc thang, bấm để đặt lệnh giả lập.

import { fmtVol, decimalsFor, niceStep, MONO, fitCanvas } from "./util.js";

const ROW_H = 18, TAPE_W = 64, OWN_W = 60, PRICE_W = 82, TAPE_MS = 60000;
const C = { bg: "#0f1218", line: "#1d2430", text: "#d8dee9", muted: "#7d8899", bidBar: "rgba(31,181,122,0.32)", askBar: "rgba(229,72,77,0.32)", bidCell: "#10241d", askCell: "#2a1416", up: "#1fb57a", down: "#e5484d", hover: "#1c2636", own: "#2f8cff" };

export class Dom {
  constructor(canvas, market, opts = {}) {
    this.cv = canvas; this.m = market; this.opts = opts;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.own = []; this.center = null; this.tick = 0; this.mult = 1; this.hover = null; this.follow = true; this.dirty = true;
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => { this.dirty = true; }, 400);
  }
  reset() { this.center = null; this.tick = 0; this.follow = true; this.dirty = true; }
  setOwn(orders) { this.own = orders; this.dirty = true; }
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

  _snap(p) { return Math.round(p / this.tick) * this.tick; }
  _rows() { return Math.max(3, Math.floor(this.S.h / ROW_H)); }
  _priceOfRow(k) { return this.center + (Math.floor(this._rows() / 2) - k) * this.tick; }
  _rowOf(p) { return Math.floor(this._rows() / 2) - Math.round((p - this.center) / this.tick); }

  _draw() {
    const ctx = this.ctx, w = this.S.w, h = this.S.h;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    if (this.center === null || !this.tick) { ctx.fillStyle = C.muted; ctx.font = "13px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.fillText("Đang chờ sổ lệnh...", w / 2, h / 2); return; }
    const rows = this._rows(), dec = decimalsFor(this.tick), xVol = TAPE_W, xPrice = w - OWN_W - PRICE_W, xOwn = w - OWN_W, volW = xPrice - xVol;
    const { bids, asks } = this.m.book.sorted(), levels = new Map();
    for (const [side, list] of [["bid", bids], ["ask", asks]]) for (const [p, q] of list) {
      const k = this._rowOf(p); if (k < -1 || k > rows) { if (k > rows && side === "bid") break; if (k < -1 && side === "ask") break; continue; }
      const e = levels.get(k) || { q: 0, side }; e.q += q; levels.set(k, e);
    }
    let maxQ = 0; for (const v of levels.values()) maxQ = Math.max(maxQ, v.q);
    const bestBid = bids.length ? this._rowOf(bids[0][0]) : null, bestAsk = asks.length ? this._rowOf(asks[0][0]) : null;
    const own = new Map();
    for (const o of this.own) { const k = this._rowOf(o.price), e = own.get(k) || { buy: 0, sell: 0, ahead: 0 }; e[o.side] += o.remaining; e.ahead = Math.max(e.ahead, o.queueAhead || 0); own.set(k, e); }
    const last = this.m.last, lastRow = last ? this._rowOf(last.p) : null;
    ctx.textBaseline = "middle";
    for (let k = 0; k < rows; k++) {
      const y = k * ROW_H, price = this._priceOfRow(k), lv = levels.get(k), ask = bestAsk !== null ? k <= bestAsk : price > this.center;
      if (this.hover === k) { ctx.fillStyle = C.hover; ctx.fillRect(0, y, w, ROW_H); }
      ctx.fillStyle = ask ? C.askCell : C.bidCell; ctx.fillRect(xPrice, y, PRICE_W, ROW_H - 1);
      ctx.font = `12px ${MONO}`;
      if (lv && maxQ) {
        ctx.fillStyle = lv.side === "bid" ? C.bidBar : C.askBar; ctx.fillRect(xVol + 2, y + 2, (volW - 4) * Math.min(1, lv.q / maxQ), ROW_H - 4);
        ctx.fillStyle = lv.side === "bid" ? "#7ff0c0" : "#ff9a9e"; ctx.textAlign = "right"; ctx.fillText(fmtVol(lv.q), xPrice - 6, y + ROW_H / 2);
      }
      const best = k === bestBid || k === bestAsk;
      ctx.font = `${best ? "bold " : ""}12px ${MONO}`; ctx.fillStyle = best ? "#fff" : C.text; ctx.textAlign = "center";
      ctx.fillText(price.toFixed(dec), xPrice + PRICE_W / 2, y + ROW_H / 2);
      if (k === lastRow) { ctx.strokeStyle = last.side === "buy" ? C.up : C.down; ctx.lineWidth = 1.5; ctx.strokeRect(xPrice + 1, y + 1, PRICE_W - 2, ROW_H - 3); }
      const o = own.get(k);
      if (o) {
        ctx.fillStyle = C.own; ctx.fillRect(xOwn + 2, y + 2, OWN_W - 4, ROW_H - 4); ctx.fillStyle = "#fff"; ctx.font = `11px ${MONO}`;
        ctx.fillText((o.buy ? "+" : "-") + fmtVol(o.buy || o.sell), xOwn + OWN_W / 2, y + ROW_H / 2);
      }
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 0.5); ctx.lineTo(w, y + ROW_H - 0.5); ctx.stroke();
    }
    ctx.strokeStyle = "#262e3b"; ctx.beginPath(); for (const x of [xVol, xPrice, xOwn]) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); } ctx.stroke();
    // bong bóng lệnh khớp 60 giây gần nhất
    const now = Date.now(), tr = this.m.trades; let maxT = 0, start = tr.length;
    while (start > 0 && now - tr[start - 1].t < TAPE_MS && tr.length - start < 3000) start--;
    for (let i = start; i < tr.length; i++) maxT = Math.max(maxT, tr[i].q);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, TAPE_W, h); ctx.clip();
    for (let i = start; i < tr.length; i++) {
      const t = tr[i], age = now - t.t, x = TAPE_W - 6 - age / TAPE_MS * (TAPE_W - 12), yy = this._rowOf(t.p) * ROW_H + ROW_H / 2;
      ctx.fillStyle = t.side === "buy" ? "rgba(31,181,122,0.55)" : "rgba(229,72,77,0.55)";
      ctx.beginPath(); ctx.arc(x, yy, Math.max(1.5, Math.sqrt(t.q / (maxT || 1)) * 10), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _bind() {
    const cv = this.cv, row = e => { const r = cv.getBoundingClientRect(); return Math.floor((e.clientY - r.top) / ROW_H); };
    cv.addEventListener("mousemove", e => { this.hover = row(e); this.dirty = true; });
    cv.addEventListener("mouseleave", () => { this.hover = null; this.dirty = true; });
    cv.addEventListener("click", e => { if (this.center !== null && this.opts.onClick) this.opts.onClick(+this._priceOfRow(row(e)).toFixed(10), "buy"); });
    cv.addEventListener("contextmenu", e => { e.preventDefault(); if (this.center !== null && this.opts.onClick) this.opts.onClick(+this._priceOfRow(row(e)).toFixed(10), "sell"); });
    cv.addEventListener("wheel", e => { e.preventDefault(); if (this.center === null) return; this.center += (e.deltaY < 0 ? 3 : -3) * this.tick; this.follow = false; this.dirty = true; }, { passive: false });
  }
}
void niceStep;
