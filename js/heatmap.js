// Lai Long Web: bản đồ nhiệt thanh khoản kiểu Bookmap.
//
// Trục ngang là thời gian, trục dọc là giá. Màu ở mỗi điểm là khối lượng lệnh chờ tại mức giá đó
// vào thời điểm đó: xanh đậm = mỏng, vàng/cam/trắng = dày (tường thanh khoản).
// Bong bóng là lệnh khớp (xanh lá: mua chủ động, đỏ: bán chủ động), kim cương là lệnh thanh lý.

import { COL_MS } from "./market.js";
import { fmtVol, fmtUsd, decimalsFor, fmtTime, MONO, fitCanvas } from "./util.js";

const AXIS_W = 72, BOOK_W = 96, LIQ_W = 64, TIME_H = 20, PANE_H = 74;

// bảng màu: nền tối -> xanh dương -> xanh ngọc -> lục -> vàng -> cam -> trắng
const STOPS = [[0, 9, 12, 22], [0.12, 14, 34, 92], [0.3, 0, 110, 190], [0.48, 0, 190, 170], [0.62, 70, 210, 60], [0.78, 250, 220, 40], [0.9, 255, 120, 20], [1, 255, 250, 240]];
const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255; let j = 0; while (j < STOPS.length - 2 && x > STOPS[j + 1][0]) j++;
    const a = STOPS[j], b = STOPS[j + 1], f = (x - a[0]) / (b[0] - a[0]);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
  }
  return lut;
})();

export class Heatmap {
  constructor(canvas, market, opts = {}) {
    this.cv = canvas; this.m = market; this.opts = opts;
    this.S = fitCanvas(canvas, () => { this.dirty = true; });
    this.ctx = this.S.ctx;
    this.off = document.createElement("canvas"); this.offCtx = this.off.getContext("2d");
    this.msPerPx = 120; this.follow = true; this.tEnd = Date.now(); this.rightPad = 70;
    this.pCenter = null; this.pxPerPrice = null; this.contrast = 1;
    this.show = { bubbles: true, liq: true, levels: true, zones: true, liqMap: true, bigOnly: false };
    this.levels = []; this.zones = []; this.liqMap = null; this.orders = []; this.position = null;
    this.mouse = null; this.drag = null; this.dirty = true; this._lastDraw = 0;
    this._bind();
    const loop = ts => {
      // vẽ lại tối đa ~12 lần/giây khi đang theo dõi, ngay lập tức khi người dùng thao tác
      if (this.dirty || (this.follow && ts - this._lastDraw > 80)) { this.dirty = false; this._lastDraw = ts; this._draw(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resetView() { this.pCenter = null; this.pxPerPrice = null; this.follow = true; this.dirty = true; }
  setOverlays(o) { Object.assign(this, o); this.dirty = true; }

  get L() {
    // màn hình hẹp (điện thoại): thu nhỏ cột sổ lệnh và cột thanh lý
    const w = this.S.w, h = this.S.h, k = w < 700 ? 0.55 : 1, bookW = BOOK_W * k, liqW = LIQ_W * k, axisW = w < 700 ? 60 : AXIS_W;
    const side = bookW + (this.show.liqMap && this.liqMap ? liqW : 0);
    const pw = Math.max(50, w - axisW - side), ph = h - TIME_H - PANE_H;
    return { w, h, pw, ph, side, bookW, liqW, axisW, bookX: pw, liqX: pw + bookW, axisX: w - axisW, paneTop: ph, timeTop: ph + PANE_H };
  }
  xOf(t) { return this._L.pw - this.rightPad - (this.tEnd - t) / this.msPerPx; }
  tAt(x) { return this.tEnd - (this._L.pw - this.rightPad - x) * this.msPerPx; }
  yOf(p) { return this._L.ph / 2 - (p - this.pCenter) * this.pxPerPrice; }
  pAt(y) { return this.pCenter + (this._L.ph / 2 - y) / this.pxPerPrice; }

  _initScale() {
    const mid = this.m.book.mid() ?? (this.m.last && this.m.last.p);
    if (mid == null) return false;
    if (this.pCenter === null) this.pCenter = mid;
    if (this.pxPerPrice === null) this.pxPerPrice = this._L.ph / (mid * 0.006); // ±0,3% trên màn hình
    if (this.follow) {
      this.tEnd = Date.now() + this.rightPad * 0;
      const y = this.yOf(mid);
      if (y < this._L.ph * 0.2 || y > this._L.ph * 0.8) this.pCenter = mid;
    }
    return true;
  }

  _draw() {
    if (!this.cv.offsetParent) return; // đang ẩn (trang khác hoặc chế độ nến)
    const ctx = this.ctx, L = this._L = this.L;
    if (L.ph < 20 || L.pw < 20) return;
    ctx.fillStyle = "#090c16"; ctx.fillRect(0, 0, L.w, L.h);
    if (!this._initScale()) {
      ctx.fillStyle = "#7d8899"; ctx.font = "14px Segoe UI, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Đang chờ dữ liệu sổ lệnh...", L.pw / 2, L.ph / 2); return;
    }
    const cols = this.m.cols, t0 = this.tAt(0), t1 = this.tAt(L.pw);
    let i0 = lowerBound(cols, t0 - COL_MS), i1 = Math.min(cols.length - 1, lowerBound(cols, t1));
    this._heat(cols, i0, i1, L);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.pw, L.ph); ctx.clip();
    if (this.show.zones) this._zones(L);
    this._bbo(cols, i0, i1);
    if (this.show.levels) this._levels(L);
    if (this.show.bubbles) this._bubbles(cols, i0, i1, L);
    if (this.show.liq) this._liqs(cols, i0, i1);
    this._ownLines(L);
    ctx.restore();
    this._pane(cols, i0, i1, L);
    this._book(L);
    if (this.show.liqMap && this.liqMap) this._liqMap(L);
    this._axes(L);
    this._cross(L, cols);
    this._legend(L);
  }

  // ----- bản đồ nhiệt: vẽ từng điểm ảnh vào bộ đệm rồi phóng lên canvas -----
  _heat(cols, i0, i1, L) {
    const W = Math.ceil(L.pw), H = Math.ceil(L.ph);
    if (this.off.width !== W || this.off.height !== H) { this.off.width = W; this.off.height = H; this._img = null; }
    if (!this._img) { this._img = this.offCtx.createImageData(W, H); this._row = new Float32Array(H); }
    const img = this._img, data = img.data, row = this._row, g = this.m.grid;
    data.fill(0); for (let k = 3; k < data.length; k += 4) data[k] = 255;
    // nền
    for (let k = 0; k < data.length; k += 4) { data[k] = 9; data[k + 1] = 12; data[k + 2] = 22; }
    if (!g || i1 < 0) { this.offCtx.putImageData(img, 0, 0); this.ctx.drawImage(this.off, 0, 0, L.pw, L.ph); return; }
    // mức tham chiếu màu: phân vị 97% của khối lượng trong vùng nhìn thấy
    const sample = [], stepI = Math.max(1, Math.floor((i1 - i0 + 1) / 60));
    for (let i = Math.max(0, i0); i <= i1; i += stepI) {
      const c = carry(cols, i); if (!c) continue;
      for (let j = 0; j < c.keys.length; j += 3) { const y = this.yOf(c.keys[j] * g); if (y >= 0 && y < H) sample.push(c.sizes[j]); }
    }
    sample.sort((a, b) => a - b);
    const ref = (sample.length ? sample[Math.floor(sample.length * 0.995)] : 1) || 1; // mức 99,5% = màu trắng
    const gpx = g * this.pxPerPrice, half = Math.max(0.5, gpx / 2);
    let x = Math.max(0, Math.floor(this.xOf(cols[Math.max(0, i0)].t)));
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = carry(cols, i); const xa = Math.max(0, Math.floor(this.xOf(cols[i].t)));
      const xb = Math.min(W, Math.floor(this.xOf(cols[i].t + COL_MS)) + (i === i1 ? 0 : 0));
      if (!c || xb <= xa || xb <= x) continue;
      row.fill(0);
      for (let j = 0; j < c.keys.length; j++) {
        const yc = this.yOf(c.keys[j] * g);
        let ya = Math.floor(yc - half), yb = Math.ceil(yc + half); if (yb <= 0 || ya >= H) continue;
        ya = Math.max(0, ya); yb = Math.min(H, yb);
        const s = c.sizes[j]; for (let y = ya; y < yb; y++) row[y] = gpx < 1 ? row[y] + s : Math.max(row[y], s);
      }
      const c0 = this.contrast;
      for (let y = 0; y < H; y++) {
        const s = row[y]; if (!s) continue;
        const v = Math.min(1, Math.pow(s / ref * c0, 0.55)), li = (v * 255) | 0;
        const r = LUT[li * 3], gg = LUT[li * 3 + 1], b = LUT[li * 3 + 2];
        let p = (y * W + Math.max(x, xa)) * 4;
        for (let xx = Math.max(x, xa); xx < xb; xx++, p += 4) { data[p] = r; data[p + 1] = gg; data[p + 2] = b; }
      }
      x = xb;
    }
    this.offCtx.putImageData(img, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.off, 0, 0, L.pw, L.ph);
    this._ref = ref;
  }

  // đường giá mua tốt nhất / bán tốt nhất theo thời gian
  _bbo(cols, i0, i1) {
    const ctx = this.ctx;
    for (const [key, col] of [["bb", "#1fd18a"], ["ba", "#ff5a5f"]]) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.beginPath(); let on = false, py = 0;
      for (let i = Math.max(0, i0); i <= i1; i++) {
        const c = cols[i]; if (c[key] == null) { on = false; continue; }
        const x = this.xOf(c.t), y = this.yOf(c[key]);
        if (!on) { ctx.moveTo(x, y); on = true; } else { ctx.lineTo(x, py); ctx.lineTo(x, y); }
        py = y;
      }
      if (on) ctx.lineTo(this.xOf(Date.now()), py);
      ctx.stroke();
    }
  }

  _bubbles(cols, i0, i1, L) {
    const ctx = this.ctx, bucketPx = Math.max(7, COL_MS / this.msPerPx), groups = new Map();
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = cols[i]; if (!c.bv && !c.sv) continue;
      const gx = Math.floor(this.xOf(c.t) / bucketPx), e = groups.get(gx) || { bv: 0, sv: 0, bpv: 0, spv: 0, x: 0, big: [] };
      e.bv += c.bv; e.sv += c.sv; e.bpv += c.bpv; e.spv += c.spv; e.x = this.xOf(c.t + COL_MS / 2);
      if (c.big) e.big.push(...c.big);
      groups.set(gx, e);
    }
    let maxV = 0; for (const e of groups.values()) maxV = Math.max(maxV, e.bv, e.sv);
    if (!maxV) return;
    const rMax = Math.min(26, Math.max(8, 30 * Math.sqrt(120 / this.msPerPx) / 2));
    for (const e of groups.values()) {
      for (const [v, pv, fill] of [[e.sv, e.spv, "rgba(255,70,80,0.62)"], [e.bv, e.bpv, "rgba(40,220,130,0.62)"]]) {
        if (!v) continue;
        if (this.show.bigOnly && v < this.m.bigTrade) continue;
        const r = Math.max(1.5, Math.sqrt(v / maxV) * rMax), y = this.yOf(pv / v);
        ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(e.x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      for (const t of e.big) { // lệnh lớn: vòng trắng và nhãn khối lượng
        const y = this.yOf(t.p), r = Math.max(5, Math.sqrt(t.q / maxV) * rMax);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, y, r, 0, Math.PI * 2); ctx.stroke();
        if (t.q >= this.m.bigTrade * 2) { ctx.fillStyle = "#fff"; ctx.font = `10px ${MONO}`; ctx.textAlign = "center"; ctx.fillText(fmtVol(t.q), e.x, y - r - 5); }
      }
    }
  }

  _liqs(cols, i0, i1) {
    const ctx = this.ctx;
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = cols[i]; if (!c.liq) continue;
      for (const l of c.liq) {
        const x = this.xOf(c.t + COL_MS / 2), y = this.yOf(l.p), usd = l.p * l.q;
        const r = Math.max(3, Math.min(11, Math.sqrt(usd / 2e4) * 2));
        ctx.fillStyle = l.side === "long" ? "#ff3df2" : "#ffd400"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (usd >= 5e4) { ctx.fillStyle = ctx.fillStyle; ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(fmtUsd(usd), x + r + 3, y + 3); }
      }
    }
  }

  _levels(L) {
    const ctx = this.ctx, dec = decimalsFor(this.m.tick || this.m.grid);
    for (const lv of this.levels) {
      const y = Math.round(this.yOf(lv.price)) + 0.5; if (y < 0 || y > L.ph) continue;
      const col = lv.kind === "support" ? "rgba(31,209,138," : "rgba(255,90,95,";
      const a = 0.35 + 0.5 * (lv.strength || 50) / 100;
      ctx.strokeStyle = col + a.toFixed(2) + ")"; ctx.lineWidth = lv.strength > 70 ? 2 : 1; ctx.setLineDash(lv.broken ? [3, 4] : []);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.fillStyle = col + "0.95)";
      ctx.fillText(`${lv.kind === "support" ? "HT" : "KC"} ${lv.price.toFixed(dec)} · chạm ${lv.touches} · test ${lv.tests}`, 6, y - 3);
    }
  }

  _zones(L) {
    const ctx = this.ctx;
    for (const z of this.zones) {
      const ya = this.yOf(z.high), yb = this.yOf(z.low); if (yb < 0 || ya > L.ph) continue;
      const xa = Math.max(0, this.xOf(z.t));
      ctx.fillStyle = z.side === "buy" ? "rgba(40,220,130,0.10)" : "rgba(255,70,80,0.10)";
      ctx.fillRect(xa, ya, L.pw - xa, Math.max(2, yb - ya));
      ctx.strokeStyle = z.side === "buy" ? "rgba(40,220,130,0.45)" : "rgba(255,70,80,0.45)"; ctx.lineWidth = 1;
      ctx.strokeRect(xa + 0.5, ya + 0.5, L.pw - xa - 1, Math.max(2, yb - ya));
      ctx.fillStyle = "#c9d1dc"; ctx.font = `10px ${MONO}`; ctx.textAlign = "left";
      ctx.fillText(`KL bất thường ${z.z.toFixed(1)}σ`, xa + 4, ya + 11);
    }
  }

  _ownLines(L) {
    const ctx = this.ctx, dec = decimalsFor(this.m.tick || this.m.grid);
    const line = (p, color, text, dash) => {
      const y = Math.round(this.yOf(p)) + 0.5; if (y < 0 || y > L.ph) return;
      ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "11px Segoe UI, sans-serif"; const tw = ctx.measureText(text).width + 10;
      ctx.fillStyle = color; ctx.fillRect(L.pw - tw - 4, y - 8, tw, 16); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(text, L.pw - tw + 1, y + 4);
    };
    for (const o of this.orders) line(o.price, o.side === "buy" ? "#1fb57a" : "#e5484d", `${o.side === "buy" ? "MUA" : "BÁN"} ${+o.remaining.toFixed(6)} @ ${o.price.toFixed(dec)} · trước: ${fmtVol(o.queueAhead || 0)}`, [5, 4]);
    const p = this.position;
    if (p && p.qty) {
      line(p.avg, p.qty > 0 ? "#1fb57a" : "#e5484d", `${p.qty > 0 ? "LONG" : "SHORT"} ${+Math.abs(p.qty).toFixed(6)} · ${p.upnl >= 0 ? "+" : ""}${p.upnl.toFixed(2)} USDT`, []);
      if (p.liq > 0) line(p.liq, "#a8711a", `Thanh lý ${p.liq.toFixed(dec)}`, [2, 3]);
    }
  }

  // ô dưới: khối lượng mua/bán theo thời gian và CVD
  _pane(cols, i0, i1, L) {
    const ctx = this.ctx, top = L.paneTop, H = PANE_H - 4, mid = top + H / 2 + 2;
    ctx.fillStyle = "#0d111b"; ctx.fillRect(0, top, L.pw, PANE_H);
    ctx.strokeStyle = "#1d2430"; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(L.w, top + 0.5); ctx.stroke();
    const bucketPx = Math.max(3, COL_MS / this.msPerPx), groups = new Map();
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = cols[i], gx = Math.floor(this.xOf(c.t) / bucketPx), e = groups.get(gx) || { b: 0, s: 0 };
      e.b += c.bv; e.s += c.sv; groups.set(gx, e);
    }
    let maxV = 0; for (const e of groups.values()) maxV = Math.max(maxV, e.b, e.s);
    if (maxV) for (const [gx, e] of groups) {
      const x = gx * bucketPx, bw = Math.max(1, bucketPx - 1);
      ctx.fillStyle = "rgba(40,220,130,0.7)"; ctx.fillRect(x, mid - e.b / maxV * (H / 2 - 2), bw, e.b / maxV * (H / 2 - 2));
      ctx.fillStyle = "rgba(255,70,80,0.7)"; ctx.fillRect(x, mid, bw, e.s / maxV * (H / 2 - 2));
    }
    // CVD trong vùng nhìn thấy
    let cum = 0, lo = 0, hi = 0; const pts = [];
    for (let i = Math.max(0, i0); i <= i1; i++) { cum += cols[i].bv - cols[i].sv; lo = Math.min(lo, cum); hi = Math.max(hi, cum); pts.push([this.xOf(cols[i].t + COL_MS), cum]); }
    if (pts.length > 1 && hi > lo) {
      ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 1.4; ctx.beginPath();
      pts.forEach(([x, v], k) => { const y = top + 4 + (hi - v) / (hi - lo) * (H - 6); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    ctx.fillStyle = "#7d8899"; ctx.font = "11px Segoe UI, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Mua / bán chủ động", 6, top + 13); ctx.fillStyle = "#f5c542"; ctx.fillText(`CVD ${cum >= 0 ? "+" : ""}${fmtVol(cum)}`, 130, top + 13);
  }

  // cột sổ lệnh hiện tại bên phải
  _book(L) {
    const ctx = this.ctx, { bids, asks } = this.m.book.sorted(), g = this.m.grid || this.m.tick || 1;
    ctx.fillStyle = "#0d111b"; ctx.fillRect(L.bookX, 0, L.bookW, L.ph);
    const agg = new Map(); let maxQ = 0;
    for (const [side, list] of [["bid", bids], ["ask", asks]]) for (const [p, q] of list) {
      const y = this.yOf(p); if (y < -10 || y > L.ph + 10) continue;
      const k = Math.round(p / g), e = agg.get(k) || { q: 0, side }; e.q += q; agg.set(k, e); maxQ = Math.max(maxQ, e.q);
    }
    const gpx = Math.max(1, g * this.pxPerPrice);
    for (const [k, e] of agg) {
      const y = this.yOf(k * g) - gpx / 2, wpx = e.q / maxQ * (L.bookW - 6);
      ctx.fillStyle = e.side === "bid" ? "rgba(31,181,122,0.75)" : "rgba(229,72,77,0.75)";
      ctx.fillRect(L.bookX + 2, y, wpx, Math.max(1, gpx - (gpx > 3 ? 1 : 0)));
      if (gpx >= 11 && e.q > maxQ * 0.15) { ctx.fillStyle = "#e9eef5"; ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.fillText(fmtVol(e.q), L.bookX + L.bookW - 4, y + gpx / 2 + 3); }
    }
    ctx.fillStyle = "#7d8899"; ctx.font = "10px Segoe UI, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Sổ lệnh", L.bookX + L.bookW / 2, L.ph - 4);
  }

  // bản đồ thanh lý ước tính từ open interest
  _liqMap(L) {
    const ctx = this.ctx, m = this.liqMap, x0 = L.liqX, LW = L.liqW;
    ctx.fillStyle = "#0b0f18"; ctx.fillRect(x0, 0, LW, L.ph);
    ctx.strokeStyle = "#1d2430"; ctx.beginPath(); ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, L.ph); ctx.stroke();
    const rows = new Map(), rowPx = 3;
    for (const [list, side] of [[m.longs, "l"], [m.shorts, "s"]]) for (const b of list) {
      const y = this.yOf(b.price + m.step / 2); if (y < 0 || y > L.ph) continue;
      const k = Math.floor(y / rowPx), e = rows.get(k) || { l: 0, s: 0 }; e[side] += b.notional; rows.set(k, e);
    }
    let maxN = 0; for (const e of rows.values()) maxN = Math.max(maxN, e.l + e.s);
    for (const [k, e] of rows) {
      const tot = e.l + e.s, wpx = tot / maxN * (LW - 4), a = 0.25 + 0.75 * tot / maxN;
      ctx.fillStyle = e.l >= e.s ? `rgba(255,61,242,${a.toFixed(2)})` : `rgba(255,212,0,${a.toFixed(2)})`;
      ctx.fillRect(x0 + LW - 2 - wpx, k * rowPx, wpx, rowPx - 0.5);
    }
    ctx.fillStyle = "#7d8899"; ctx.font = "10px Segoe UI, sans-serif"; ctx.textAlign = "center";
    if (LW > 50) ctx.fillText("Thanh lý ƯT", x0 + LW / 2, L.ph - 4);
  }

  _axes(L) {
    const ctx = this.ctx, x0 = L.axisX, dec = decimalsFor(this.m.tick || this.m.grid), AXIS_W = L.axisW;
    ctx.fillStyle = "#0f1218"; ctx.fillRect(x0, 0, AXIS_W, L.h); ctx.fillRect(0, L.timeTop, L.w, TIME_H);
    ctx.strokeStyle = "#262e3b"; ctx.beginPath(); ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, L.h); ctx.moveTo(0, L.timeTop + 0.5); ctx.lineTo(L.w, L.timeTop + 0.5); ctx.stroke();
    const range = L.ph / this.pxPerPrice, raw = range / Math.max(3, L.ph / 50), e = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map(k => k * e).find(s => s >= raw);
    ctx.font = `11px ${MONO}`; ctx.fillStyle = "#7d8899"; ctx.textAlign = "left";
    for (let p = Math.ceil(this.pAt(L.ph) / st) * st; p <= this.pAt(0); p += st) {
      const y = this.yOf(p); ctx.fillText(p.toFixed(Math.max(dec, decimalsFor(st))), x0 + 6, y + 4);
      ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(0, Math.round(y), L.pw, 1); ctx.fillStyle = "#7d8899";
    }
    const last = this.m.last;
    if (last) {
      const y = this.yOf(last.p), col = last.side === "buy" ? "#1fb57a" : "#e5484d";
      ctx.fillStyle = col; ctx.fillRect(x0 + 1, y - 9, AXIS_W - 1, 18); ctx.fillStyle = "#fff"; ctx.fillText(last.p.toFixed(dec), x0 + 6, y + 4);
    }
    // trục thời gian
    const spanMs = L.pw * this.msPerPx, steps = [1e3, 5e3, 10e3, 15e3, 30e3, 60e3, 120e3, 300e3, 600e3, 900e3, 1800e3, 3600e3];
    const tStep = steps.find(s => s / this.msPerPx >= 90) || 3600e3;
    ctx.fillStyle = "#7d8899"; ctx.textAlign = "center";
    for (let t = Math.ceil(this.tAt(0) / tStep) * tStep; t < this.tAt(L.pw); t += tStep) {
      const x = this.xOf(t); ctx.fillText(fmtTime(t), x, L.timeTop + 14);
      ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(Math.round(x), 0, 1, L.ph); ctx.fillStyle = "#7d8899";
    }
    void spanMs;
  }

  _cross(L, cols) {
    const m = this.mouse; if (!m || m.x > L.pw || m.y > L.ph) return;
    const ctx = this.ctx, p = this.pAt(m.y), t = this.tAt(m.x), dec = decimalsFor(this.m.tick || this.m.grid), AXIS_W = L.axisW;
    ctx.strokeStyle = "rgba(200,210,230,0.5)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.x + 0.5, 0); ctx.lineTo(m.x + 0.5, L.ph); ctx.moveTo(0, m.y + 0.5); ctx.lineTo(L.pw, m.y + 0.5); ctx.stroke(); ctx.setLineDash([]);
    // khối lượng chờ tại điểm con trỏ
    let size = null; const i = Math.min(cols.length - 1, lowerBound(cols, t) - 1), c = i >= 0 ? carry(cols, i) : null;
    if (c && this.m.grid) { const k = Math.round(p / this.m.grid); for (let j = 0; j < c.keys.length; j++) if (c.keys[j] === k) { size = c.sizes[j]; break; } }
    ctx.fillStyle = "#3a4558"; ctx.fillRect(L.axisX + 1, m.y - 9, AXIS_W - 1, 18);
    ctx.fillStyle = "#fff"; ctx.font = `11px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(p.toFixed(dec), L.axisX + 6, m.y + 4);
    ctx.fillStyle = "#3a4558"; ctx.fillRect(m.x - 34, L.timeTop + 1, 68, TIME_H - 2); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(fmtTime(t), m.x, L.timeTop + 14);
    if (size !== null) { const txt = `Chờ: ${fmtVol(size)}`; ctx.fillStyle = "rgba(15,18,24,0.85)"; ctx.fillRect(m.x + 10, m.y + 8, ctx.measureText(txt).width + 10, 18); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(txt, m.x + 15, m.y + 21); }
  }

  _legend() {
    const ctx = this.ctx, m = this.m, dec = decimalsFor(m.tick || m.grid);
    const txt = `${m.symbol} · ${this.opts.exchangeName ? this.opts.exchangeName() : m.exchange} · tầng giá ${m.grid ? m.grid.toFixed(decimalsFor(m.grid)) : "-"}${m.last ? " · giá " + m.last.p.toFixed(dec) : ""}${this.follow ? "" : " · đang xem lại (bấm đúp để theo dõi)"}`;
    ctx.font = "12px Segoe UI, sans-serif"; ctx.fillStyle = "rgba(9,12,22,0.8)"; ctx.fillRect(4, 4, ctx.measureText(txt).width + 12, 20);
    ctx.fillStyle = "#d8dee9"; ctx.textAlign = "left"; ctx.fillText(txt, 10, 18);
  }

  _bind() {
    const cv = this.cv;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener("mousemove", e => {
      const p = pos(e); this.mouse = p;
      if (this.drag) {
        if (this.drag.axis) this.pxPerPrice = Math.max(1e-9, this.drag.ppp * Math.exp(-(p.y - this.drag.y) * 0.01));
        else {
          this.tEnd = this.drag.tEnd - (p.x - this.drag.x) * this.msPerPx;
          this.pCenter = this.drag.pc + (p.y - this.drag.y) / this.pxPerPrice;
          if (Math.abs(p.x - this.drag.x) + Math.abs(p.y - this.drag.y) > 4) this.follow = false;
        }
      }
      this.dirty = true;
    });
    cv.addEventListener("mouseleave", () => { this.mouse = null; this.drag = null; this.dirty = true; });
    cv.addEventListener("mousedown", e => {
      const p = pos(e);
      this.drag = { x: p.x, y: p.y, tEnd: this.tEnd, pc: this.pCenter, ppp: this.pxPerPrice, axis: p.x > this._L.pw };
    });
    window.addEventListener("mouseup", () => { this.drag = null; });
    cv.addEventListener("dblclick", () => { this.follow = true; this.pCenter = null; this.dirty = true; });
    cv.addEventListener("wheel", e => {
      e.preventDefault(); const p = pos(e), k = e.deltaY < 0 ? 1 / 1.15 : 1.15;
      if (e.ctrlKey || e.shiftKey || p.x > this._L.pw) { // phóng giá quanh con trỏ
        const before = this.pAt(p.y); this.pxPerPrice /= k; this.pCenter += before - this.pAt(p.y);
      } else { // phóng thời gian quanh con trỏ
        const before = this.tAt(p.x); this.msPerPx = Math.min(20000, Math.max(15, this.msPerPx * k));
        if (!this.follow) this.tEnd += before - this.tAt(p.x);
      }
      this.dirty = true;
    }, { passive: false });
    // điện thoại: kéo bằng một ngón
    let touch = null;
    cv.addEventListener("touchstart", e => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, tEnd: this.tEnd, pc: this.pCenter }; }, { passive: true });
    cv.addEventListener("touchmove", e => {
      if (!touch) return; const t = e.touches[0]; e.preventDefault();
      this.tEnd = touch.tEnd - (t.clientX - touch.x) * this.msPerPx; this.pCenter = touch.pc + (t.clientY - touch.y) / this.pxPerPrice;
      this.follow = false; this.dirty = true;
    }, { passive: false });
    cv.addEventListener("touchend", () => { touch = null; });
  }
}

// cột chưa kịp chụp sổ lệnh thì dùng ảnh chụp gần nhất trước đó
function carry(cols, i) {
  for (let j = i; j >= Math.max(0, i - 20); j--) if (cols[j].keys) return cols[j];
  return null;
}

function lowerBound(cols, t) {
  let lo = 0, hi = cols.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cols[m].t < t) lo = m + 1; else hi = m; }
  return lo;
}
