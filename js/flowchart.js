// Lai Long Web: biểu đồ nến / footprint (box chart) kèm delta, CVD và open interest.
//
// Mỗi nến: {t, o, h, l, c, v, d (delta), fp?: Map(chỉ số tầng giá -> [KL bán chủ động, KL mua chủ động]),
//           liqL, liqS (khối lượng long/short bị thanh lý), oi}
// Không có chỉ báo kỹ thuật truyền thống: chỉ có dữ liệu dòng lệnh và các mức giá tính ra từ dữ liệu.

import { fmtVol, fmtUsd, decimalsFor, pad2, MONO, fitCanvas } from "./util.js";
import { cvd as cvdOf } from "./analytics.js";

const AXIS_W = 74, TIME_H = 22, MULTS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
const C = { bg: "#0f1218", grid: "#1a202b", axis: "#7d8899", text: "#d8dee9", up: "#1fb57a", down: "#e5484d", poc: "#f5d524" };

export class FlowChart {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.opts = opts;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.bars = []; this.info = {}; this.step = 1; this.type = "candle"; this.rowMult = "auto";
    this.spacing = { candle: 8, box: 96 }; this.offset = 6; this.yZoom = 1;
    this.show = { profile: true, levels: true, zones: true, liq: true, liqMap: true, delta: true, cvd: true, oi: true };
    this.levels = []; this.zones = []; this.liqMap = null; this.markers = []; this.orders = []; this.position = null;
    this.mouse = null; this.drag = null; this.dirty = true;
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setData(bars, info) { this.bars = bars; this.info = info || {}; this.step = info.step || 1; this.offset = 6; this.yZoom = 1; this._cvd = null; this.dirty = true; }
  refresh() { this._cvd = null; this.dirty = true; }
  setType(t) { this.type = t; this.dirty = true; }
  setOverlays(o) { Object.assign(this, o); this.dirty = true; }

  get sp() { return this.spacing[this.type]; }
  _layout() {
    const w = this.S.w, h = this.S.h, pw = w - AXIS_W, ph = h - TIME_H;
    const hasOi = this.show.oi && this.bars.some(b => b.oi != null);
    const deltaH = this.show.delta ? Math.round(ph * 0.1) : 0;
    const cvdH = this.show.cvd || hasOi ? Math.round(ph * 0.14) : 0;
    const priceH = ph - deltaH - cvdH;
    return { w, h, pw, ph, priceH, deltaTop: priceH, deltaH, cvdTop: priceH + deltaH, cvdH, hasOi };
  }
  xOf(i) { return this._L.pw - (this.bars.length - 1 - i + this.offset) * this.sp - this.sp / 2; }
  fAt(x) { return this.bars.length - 1 + this.offset - (this._L.pw - x - this.sp / 2) / this.sp; }
  iAt(x) { return Math.round(this.fAt(x)); }
  yOf(p) { return 6 + (this._pmax - p) / (this._pmax - this._pmin) * this._ph; }
  pAt(y) { return this._pmax - (y - 6) / this._ph * (this._pmax - this._pmin); }

  _visible() {
    const n = this.bars.length; if (!n) return [0, -1];
    return [Math.max(0, this.iAt(0) - 1), Math.min(n - 1, this.iAt(this._L.pw) + 1)];
  }

  _rowStep(first, last) {
    if (this.rowMult !== "auto") return this.step * Number(this.rowMult);
    const r = []; for (let i = first; i <= last; i++) r.push(this.bars[i].h - this.bars[i].l);
    r.sort((a, b) => a - b);
    const med = r.length ? r[r.length >> 1] : 0, target = this.type === "box" ? 12 : 4, ppp = this._ph / (this._pmax - this._pmin || 1);
    for (const m of MULTS) { const rs = this.step * m; if (med / rs <= target * 1.5 && rs * ppp >= (this.type === "box" ? 13 : 2)) return rs; }
    return this.step * MULTS[MULTS.length - 1];
  }

  _draw() {
    if (!this.cv.offsetParent) { this._L = this._layout(); return; }
    const ctx = this.ctx, L = this._L = this._layout();
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, L.w, L.h);
    if (!this.bars.length) { ctx.fillStyle = C.axis; ctx.font = "14px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.fillText(this.opts.emptyText || "Đang tải dữ liệu...", L.pw / 2, L.ph / 2); return; }
    const [first, last] = this._visible();
    let lo = Infinity, hi = -Infinity;
    for (let i = first; i <= last; i++) { lo = Math.min(lo, this.bars[i].l); hi = Math.max(hi, this.bars[i].h); }
    const mid = (hi + lo) / 2, half = Math.max((hi - lo) / 2, mid * 0.0005) * 1.1 * this.yZoom;
    this._pmin = mid - half; this._pmax = mid + half; this._ph = L.priceH - 12;
    const rowStep = this._rowStep(first, last); this._rowStepUsed = rowStep;
    this._grid(L);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.pw, L.priceH); ctx.clip();
    if (this.show.profile) this._profile(first, last, this.type === "box" ? rowStep : this._profileStep(), L);
    if (this.show.zones) this._zones(first, L);
    if (this.show.levels) this._levels(L);
    if (this.type === "box") this._boxes(first, last, rowStep); else this._candles(first, last);
    if (this.show.liq) this._liqMarks(first, last);
    if (this.show.liqMap && this.liqMap) this._liqMap(L);
    this._markers(first, last);
    this._ownLines(L);
    ctx.restore();
    if (this.show.delta) this._delta(first, last, L);
    if (L.cvdH) this._cvdPane(first, last, L);
    this._axes(first, last, L);
    this._cross(L);
    this._legend(L);
  }

  _profileStep() {
    const target = (this._pmax - this._pmin) / 80;
    for (const m of MULTS) if (this.step * m >= target) return this.step * m;
    return this.step * MULTS[MULTS.length - 1];
  }

  _grid(L) {
    const ctx = this.ctx; ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (const p of this._ticks()) { const y = Math.round(this.yOf(p)) + 0.5; ctx.moveTo(0, y); ctx.lineTo(L.pw, y); }
    ctx.stroke();
  }
  _ticks() {
    const range = this._pmax - this._pmin, raw = range / Math.max(3, Math.floor(this._ph / 60)), e = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map(m => m * e).find(s => s >= raw) || raw; this._tickStep = st;
    const out = []; for (let p = Math.ceil(this._pmin / st) * st; p <= this._pmax; p += st) out.push(p); return out;
  }

  _candles(first, last) {
    const ctx = this.ctx, bw = Math.max(1, Math.min(this.sp * 0.7, this.sp - 2));
    for (let i = first; i <= last; i++) {
      const b = this.bars[i], x = this.xOf(i), col = b.c >= b.o ? C.up : C.down;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, this.yOf(b.h)); ctx.lineTo(Math.round(x) + 0.5, this.yOf(b.l)); ctx.stroke();
      const y1 = this.yOf(Math.max(b.o, b.c)), y2 = this.yOf(Math.min(b.o, b.c));
      ctx.fillRect(Math.round(x - bw / 2), Math.round(y1), Math.round(bw), Math.max(1, Math.round(y2 - y1)));
    }
  }

  _boxes(first, last, rowStep) {
    const ctx = this.ctx, w = this.sp * 0.88, rowPx = rowStep / (this._pmax - this._pmin) * this._ph, showText = rowPx >= 11 && w >= 58;
    const mult = Math.max(1, Math.round(rowStep / this.step));
    ctx.font = `${Math.min(11, Math.max(9, rowPx - 2)).toFixed(0)}px ${MONO}`; ctx.textBaseline = "middle";
    for (let i = first; i <= last; i++) {
      const b = this.bars[i], x = this.xOf(i), x0 = x - w / 2, up = b.c >= b.o;
      if (!b.fp || !b.fp.size) { // nến lịch sử: sàn không cung cấp footprint quá khứ
        ctx.strokeStyle = ctx.fillStyle = up ? C.up : C.down;
        ctx.beginPath(); ctx.moveTo(x, this.yOf(b.h)); ctx.lineTo(x, this.yOf(b.l)); ctx.stroke();
        const y1 = this.yOf(Math.max(b.o, b.c)), y2 = this.yOf(Math.min(b.o, b.c)); ctx.fillRect(x - w * 0.12, y1, w * 0.24, Math.max(1, y2 - y1));
        continue;
      }
      const rows = new Map(); let maxTot = 0, pocK = null;
      for (const [k0, cell] of b.fp) { const k = Math.floor(k0 / mult); const r = rows.get(k) || [0, 0]; r[0] += cell[0]; r[1] += cell[1]; rows.set(k, r); }
      for (const [k, r] of rows) { const t = r[0] + r[1]; if (t > maxTot) { maxTot = t; pocK = k; } }
      const kLo = Math.floor(b.l / rowStep + 1e-9), kHi = Math.floor(b.h / rowStep + 1e-9), strip = Math.min(6, w * 0.08);
      for (let k = kLo; k <= kHi; k++) {
        const r = rows.get(k) || [0, 0], tot = r[0] + r[1], yTop = this.yOf((k + 1) * rowStep), hgt = this.yOf(k * rowStep) - yTop;
        const a = maxTot ? 0.08 + 0.55 * tot / maxTot : 0.05;
        ctx.fillStyle = (r[1] >= r[0] ? "rgba(31,181,122," : "rgba(229,72,77,") + a.toFixed(3) + ")";
        ctx.fillRect(x0 + strip + 1, yTop + 0.5, w - strip - 1, Math.max(1, hgt - 1));
        if (k === pocK) { ctx.strokeStyle = C.poc; ctx.lineWidth = 1; ctx.strokeRect(x0 + strip + 1.5, yTop + 1, w - strip - 2, Math.max(1, hgt - 2)); }
        if (showText && tot > 0) {
          const cx = x0 + strip + (w - strip) / 2, buyImb = r[1] >= 3 * r[0] && r[1] > 0, sellImb = r[0] >= 3 * r[1] && r[0] > 0;
          ctx.textAlign = "right"; ctx.fillStyle = sellImb ? "#ff7b7f" : C.text; ctx.fillText(fmtVol(r[0]), cx - 5, yTop + hgt / 2);
          ctx.textAlign = "center"; ctx.fillStyle = C.axis; ctx.fillText("x", cx, yTop + hgt / 2);
          ctx.textAlign = "left"; ctx.fillStyle = buyImb ? "#5ff0b0" : C.text; ctx.fillText(fmtVol(r[1]), cx + 5, yTop + hgt / 2);
        }
      }
      const col = up ? C.up : C.down, yo = this.yOf(Math.max(b.o, b.c)), yc = this.yOf(Math.min(b.o, b.c));
      ctx.fillStyle = col; ctx.fillRect(x0, yo, strip, Math.max(1, yc - yo));
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, this.yOf((kHi + 1) * rowStep) + 0.5, w - 1, this.yOf(kLo * rowStep) - this.yOf((kHi + 1) * rowStep) - 1);
    }
  }

  _profile(first, last, rowStep, L) {
    const rows = new Map(); let total = 0;
    for (let i = first; i <= last; i++) {
      const b = this.bars[i];
      if (b.fp && b.fp.size) for (const [k0, c] of b.fp) { const k = Math.floor(k0 * this.step / rowStep + 1e-9); rows.set(k, (rows.get(k) || 0) + c[0] + c[1]); }
      else if (b.v > 0) { const k1 = Math.floor(b.l / rowStep), k2 = Math.floor(b.h / rowStep), per = b.v / (k2 - k1 + 1); for (let k = k1; k <= k2; k++) rows.set(k, (rows.get(k) || 0) + per); }
      total += b.v;
    }
    if (!rows.size) return;
    let maxV = 0, pocK = null; for (const [k, v] of rows) if (v > maxV) { maxV = v; pocK = k; }
    const va = new Set([pocK]); let acc = rows.get(pocK), lo = pocK, hi = pocK;
    while (acc < total * 0.7) { const u = rows.get(hi + 1) || 0, d = rows.get(lo - 1) || 0; if (!u && !d) break; if (u >= d) { hi++; acc += u; va.add(hi); } else { lo--; acc += d; va.add(lo); } }
    const ctx = this.ctx, maxW = L.pw * 0.18;
    for (const [k, v] of rows) {
      const yTop = this.yOf((k + 1) * rowStep), yBot = this.yOf(k * rowStep);
      ctx.fillStyle = k === pocK ? "rgba(245,213,36,0.45)" : va.has(k) ? "rgba(47,140,255,0.32)" : "rgba(47,140,255,0.16)";
      ctx.fillRect(0, yTop + 0.5, v / maxV * maxW, Math.max(1, yBot - yTop - 1));
    }
  }

  _levels(L) {
    const ctx = this.ctx, dec = decimalsFor(this.info.tick || this.step);
    for (const lv of this.levels) {
      const y = Math.round(this.yOf(lv.price)) + 0.5; if (y < 0 || y > L.priceH) continue;
      const col = lv.kind === "support" ? "rgba(31,209,138," : "rgba(255,90,95,", a = 0.35 + 0.5 * (lv.strength || 50) / 100;
      ctx.strokeStyle = col + a.toFixed(2) + ")"; ctx.lineWidth = lv.strength > 70 ? 2 : 1; ctx.setLineDash(lv.broken ? [3, 4] : []);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.fillStyle = col + "0.95)"; ctx.textBaseline = "alphabetic";
      ctx.fillText(`${lv.kind === "support" ? "HT" : "KC"} ${lv.price.toFixed(dec)} · chạm ${lv.touches} · test ${lv.tests} · ${Math.round(lv.strength)}đ`, L.pw - 8, y - 3);
    }
  }

  _zones(first, L) {
    const ctx = this.ctx, idx = new Map(this.bars.map((b, i) => [b.t, i]));
    for (const z of this.zones) {
      const i = idx.get(z.t); if (i === undefined) continue;
      const end = z.endT != null && idx.has(z.endT) ? this.xOf(idx.get(z.endT)) : L.pw;
      const xa = this.xOf(i) - this.sp / 2, ya = this.yOf(z.high), yb = this.yOf(z.low);
      if (end < 0) continue;
      ctx.fillStyle = z.side === "buy" ? "rgba(40,220,130,0.09)" : "rgba(255,70,80,0.09)";
      ctx.fillRect(xa, ya, end - xa, Math.max(2, yb - ya));
      ctx.strokeStyle = z.side === "buy" ? "rgba(40,220,130,0.4)" : "rgba(255,70,80,0.4)"; ctx.lineWidth = 1;
      ctx.strokeRect(xa + 0.5, ya + 0.5, end - xa, Math.max(2, yb - ya));
    }
    void first;
  }

  _liqMarks(first, last) {
    const ctx = this.ctx; let maxQ = 0;
    for (let i = first; i <= last; i++) maxQ = Math.max(maxQ, this.bars[i].liqL || 0, this.bars[i].liqS || 0);
    if (!maxQ) return;
    for (let i = first; i <= last; i++) {
      const b = this.bars[i], x = this.xOf(i);
      for (const [q, y, col] of [[b.liqL, this.yOf(b.l) + 10, "#ff3df2"], [b.liqS, this.yOf(b.h) - 10, "#ffd400"]]) {
        if (!q) continue; const r = 3 + Math.sqrt(q / maxQ) * 8;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
      }
    }
  }

  _liqMap(L) {
    const ctx = this.ctx, m = this.liqMap, maxW = L.pw * 0.14, rowPx = 3, rows = new Map();
    for (const [list, s] of [[m.longs, "l"], [m.shorts, "s"]]) for (const b of list) {
      const y = this.yOf(b.price + m.step / 2); if (y < 0 || y > L.priceH) continue;
      const k = Math.floor(y / rowPx), e = rows.get(k) || { l: 0, s: 0 }; e[s] += b.notional; rows.set(k, e);
    }
    let maxN = 0; for (const e of rows.values()) maxN = Math.max(maxN, e.l + e.s);
    for (const [k, e] of rows) {
      const tot = e.l + e.s, wpx = tot / maxN * maxW, a = 0.2 + 0.6 * tot / maxN;
      ctx.fillStyle = e.l >= e.s ? `rgba(255,61,242,${a.toFixed(2)})` : `rgba(255,212,0,${a.toFixed(2)})`;
      ctx.fillRect(L.pw - wpx, k * rowPx, wpx, rowPx - 0.5);
    }
  }

  // điểm vào/ra lệnh của backtest
  _markers(first, last) {
    if (!this.markers.length) return;
    const ctx = this.ctx, t0 = this.bars[first].t, t1 = this.bars[last].t, idx = this._idx || (this._idx = new Map());
    if (idx.size !== this.bars.length) { idx.clear(); this.bars.forEach((b, i) => idx.set(b.t, i)); }
    for (const mk of this.markers) {
      if (mk.t < t0 || mk.t > t1) continue;
      const i = idx.get(mk.t); if (i === undefined) continue;
      const x = this.xOf(i), y = this.yOf(mk.price), up = mk.dir > 0, s = 6;
      ctx.fillStyle = mk.exit ? "#d8dee9" : up ? C.up : C.down; ctx.beginPath();
      if (mk.exit) { ctx.rect(x - 3.5, y - 3.5, 7, 7); }
      else if (up) { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); }
      else { ctx.moveTo(x, y + s); ctx.lineTo(x + s, y - s); ctx.lineTo(x - s, y - s); }
      ctx.closePath(); ctx.fill();
      if (mk.link) { // nối điểm vào và ra
        const j = idx.get(mk.link.t); if (j !== undefined) { ctx.strokeStyle = mk.link.win ? "rgba(31,181,122,0.7)" : "rgba(229,72,77,0.7)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(this.xOf(j), this.yOf(mk.link.price)); ctx.stroke(); ctx.setLineDash([]); }
      }
    }
  }

  _ownLines(L) {
    const ctx = this.ctx, dec = decimalsFor(this.info.tick || this.step);
    const line = (p, color, text, dash) => {
      const y = Math.round(this.yOf(p)) + 0.5; if (y < 0 || y > L.priceH) return;
      ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "11px Segoe UI, sans-serif"; const tw = ctx.measureText(text).width + 10;
      ctx.fillStyle = color; ctx.fillRect(L.pw - tw - 4, y - 8, tw, 16); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, L.pw - tw + 1, y);
    };
    for (const o of this.orders) line(o.price, o.side === "buy" ? C.up : C.down, `${o.side === "buy" ? "MUA" : "BÁN"} ${+o.remaining.toFixed(6)} @ ${o.price.toFixed(dec)}`, [5, 4]);
    const p = this.position;
    if (p && p.qty) {
      line(p.avg, p.qty > 0 ? C.up : C.down, `${p.qty > 0 ? "LONG" : "SHORT"} ${+Math.abs(p.qty).toFixed(6)} · ${p.upnl >= 0 ? "+" : ""}${p.upnl.toFixed(2)} USDT`, []);
      if (p.liq > 0) line(p.liq, "#a8711a", `Thanh lý ${p.liq.toFixed(dec)}`, [2, 3]);
    }
  }

  _delta(first, last, L) {
    const ctx = this.ctx, top = L.deltaTop, H = L.deltaH, mid = top + H / 2; let maxD = 0;
    for (let i = first; i <= last; i++) maxD = Math.max(maxD, Math.abs(this.bars[i].d || 0));
    ctx.fillStyle = "#121722"; ctx.fillRect(0, top, L.pw, H);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(L.w, top + 0.5); ctx.moveTo(0, mid + 0.5); ctx.lineTo(L.pw, mid + 0.5); ctx.stroke();
    const bw = Math.max(1, Math.min(this.sp * 0.7, this.sp - 2));
    if (maxD) for (let i = first; i <= last; i++) {
      const d = this.bars[i].d || 0, hh = Math.abs(d) / maxD * (H / 2 - 3), x = this.xOf(i);
      ctx.fillStyle = d >= 0 ? "rgba(31,181,122,0.75)" : "rgba(229,72,77,0.75)";
      ctx.fillRect(Math.round(x - bw / 2), d >= 0 ? mid - hh : mid, Math.round(bw), Math.max(1, hh));
      if (this.type === "box" && this.sp >= 50) { ctx.fillStyle = d >= 0 ? C.up : C.down; ctx.font = `10px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((d >= 0 ? "+" : "") + fmtVol(d), x, d >= 0 ? mid + 7 : mid - 7); }
    }
    ctx.fillStyle = C.axis; ctx.font = "11px Segoe UI, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`Delta${this.info.deltaApprox ? " (ước tính từ nến)" : ""}`, 6, top + 3);
  }

  _cvdPane(first, last, L) {
    const ctx = this.ctx, top = L.cvdTop, H = L.cvdH;
    if (!this._cvd) this._cvd = cvdOf(this.bars);
    ctx.fillStyle = "#0d111b"; ctx.fillRect(0, top, L.pw, H);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(L.w, top + 0.5); ctx.stroke();
    const series = [];
    if (this.show.cvd) series.push([this._cvd, "#f5c542", "CVD"]);
    if (L.hasOi) series.push([this.bars.map(b => b.oi), "#2f8cff", "Open interest"]);
    let lx = 6;
    for (const [vals, col, name] of series) {
      let lo = Infinity, hi = -Infinity;
      for (let i = first; i <= last; i++) { const v = vals[i]; if (v == null) continue; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (!(hi > lo)) continue;
      ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); let on = false;
      for (let i = first; i <= last; i++) { const v = vals[i]; if (v == null) { on = false; continue; } const x = this.xOf(i), y = top + 6 + (hi - v) / (hi - lo) * (H - 12); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
      ctx.stroke();
      const lastV = vals[Math.min(last, vals.length - 1)];
      ctx.fillStyle = col; ctx.font = "11px Segoe UI, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      const label = `${name} ${lastV == null ? "" : fmtVol(lastV)}`; ctx.fillText(label, lx, top + 3); lx += ctx.measureText(label).width + 16;
    }
  }

  _axes(first, last, L) {
    const ctx = this.ctx, dec = Math.max(decimalsFor(this._tickStep || this.step), 0);
    ctx.fillStyle = C.bg; ctx.fillRect(L.pw, 0, AXIS_W, L.h); ctx.fillRect(0, L.ph, L.w, TIME_H);
    ctx.strokeStyle = "#262e3b"; ctx.beginPath(); ctx.moveTo(L.pw + 0.5, 0); ctx.lineTo(L.pw + 0.5, L.ph); ctx.moveTo(0, L.ph + 0.5); ctx.lineTo(L.w, L.ph + 0.5); ctx.stroke();
    ctx.fillStyle = C.axis; ctx.font = `11px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (const p of this._ticks()) { const y = this.yOf(p); if (y > 6 && y < L.priceH - 6) ctx.fillText(p.toFixed(dec), L.pw + 6, y); }
    const b = this.bars[this.bars.length - 1], y = this.yOf(b.c), col = b.c >= b.o ? C.up : C.down;
    if (y > 0 && y < L.priceH) {
      ctx.strokeStyle = col; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(L.pw, Math.round(y) + 0.5); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.fillRect(L.pw + 1, y - 9, AXIS_W - 1, 18); ctx.fillStyle = "#fff"; ctx.fillText(b.c.toFixed(decimalsFor(this.info.tick || this.step)), L.pw + 6, y);
    }
    ctx.fillStyle = C.axis; ctx.textAlign = "center"; const every = Math.max(1, Math.ceil(90 / this.sp)); let prevDay = null;
    const ms = this.info.intervalMs || 60e3;
    for (let i = first; i <= last; i++) {
      if (i % every) continue;
      const d = new Date(this.bars[i].t), x = this.xOf(i);
      let txt = ms >= 86400e3 ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}` : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      if (ms < 86400e3 && prevDay !== null && d.getDate() !== prevDay) txt = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
      prevDay = d.getDate();
      if (x > 20 && x < L.pw - 20) ctx.fillText(txt, x, L.ph + TIME_H / 2);
    }
  }

  _cross(L) {
    const m = this.mouse; if (!m || m.x > L.pw || m.y > L.ph) return;
    const ctx = this.ctx, i = Math.min(this.bars.length - 1, Math.max(0, this.iAt(m.x))), x = Math.round(this.xOf(i)) + 0.5, y = Math.round(m.y) + 0.5;
    ctx.strokeStyle = "#56627a"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, L.ph); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `11px ${MONO}`; ctx.textBaseline = "middle";
    if (m.y < L.priceH) { ctx.fillStyle = "#3a4558"; ctx.fillRect(L.pw + 1, y - 9, AXIS_W - 1, 18); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(this.pAt(m.y).toFixed(decimalsFor(this.info.tick || this.step)), L.pw + 6, y); }
    const d = new Date(this.bars[i].t), txt = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    ctx.fillStyle = "#3a4558"; ctx.fillRect(x - 46, L.ph + 1, 92, TIME_H - 2); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(txt, x, L.ph + TIME_H / 2);
  }

  _legend(L) {
    const ctx = this.ctx; let i = this.bars.length - 1;
    if (this.mouse && this.mouse.x < L.pw) i = Math.min(this.bars.length - 1, Math.max(0, this.iAt(this.mouse.x)));
    const b = this.bars[i], dec = decimalsFor(this.info.tick || this.step), col = b.c >= b.o ? C.up : C.down;
    const parts = [[`${this.info.symbol || ""} · ${this.info.exchangeName || ""} · ${this.info.interval || ""}   `, C.text], ["O ", C.axis], [b.o.toFixed(dec) + "  ", col], ["H ", C.axis], [b.h.toFixed(dec) + "  ", col], ["L ", C.axis], [b.l.toFixed(dec) + "  ", col], ["C ", C.axis], [b.c.toFixed(dec) + "  ", col], ["KL ", C.axis], [fmtVol(b.v) + "  ", C.text], ["Δ ", C.axis], [(b.d >= 0 ? "+" : "") + fmtVol(b.d || 0) + "  ", (b.d || 0) >= 0 ? C.up : C.down]];
    if (b.liqL || b.liqS) parts.push(["Thanh lý L/S ", C.axis], [`${fmtUsd((b.liqL || 0) * b.c)} / ${fmtUsd((b.liqS || 0) * b.c)}`, "#ffd400"]);
    ctx.font = `12px ${MONO}`; ctx.textBaseline = "top"; ctx.textAlign = "left";
    ctx.fillStyle = "rgba(15,18,24,0.8)"; ctx.fillRect(4, 4, Math.min(L.pw - 8, 900), 20);
    let x = 8; for (const [t, c] of parts) { ctx.fillStyle = c; ctx.fillText(t, x, 8); x += ctx.measureText(t).width; }
    if (this.type === "box") { ctx.fillStyle = C.axis; ctx.fillText(`Tầng giá ${this._rowStepUsed.toFixed(decimalsFor(this._rowStepUsed))} · footprint chỉ có từ lúc mở trang`, 8, 28); }
  }

  _bind() {
    const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener("mousemove", e => {
      const p = pos(e); this.mouse = p;
      if (this.drag) {
        if (this.drag.axis) this.yZoom = Math.min(20, Math.max(0.05, this.drag.zoom * Math.exp((p.y - this.drag.y) * 0.006)));
        else this.offset = Math.min(this._L.pw / this.sp - 3, Math.max(3 - this.bars.length, this.drag.offset - (p.x - this.drag.x) / this.sp));
      }
      this.dirty = true;
    });
    cv.addEventListener("mouseleave", () => { this.mouse = null; this.drag = null; this.dirty = true; });
    cv.addEventListener("mousedown", e => { const p = pos(e); this.drag = { x: p.x, y: p.y, offset: this.offset, zoom: this.yZoom, axis: p.x > this._L.pw }; });
    window.addEventListener("mouseup", () => { this.drag = null; });
    cv.addEventListener("dblclick", () => { this.offset = 6; this.yZoom = 1; this.dirty = true; });
    cv.addEventListener("wheel", e => {
      e.preventDefault(); const p = pos(e), before = this.fAt(p.x), k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const [mn, mx] = this.type === "box" ? [30, 260] : [1, 60];
      this.spacing[this.type] = Math.min(mx, Math.max(mn, this.sp * k)); this.offset -= this.fAt(p.x) - before; this.dirty = true;
    }, { passive: false });
    let touch = null;
    cv.addEventListener("touchstart", e => { touch = { x: e.touches[0].clientX, offset: this.offset }; }, { passive: true });
    cv.addEventListener("touchmove", e => { if (!touch) return; e.preventDefault(); this.offset = Math.max(3 - this.bars.length, touch.offset - (e.touches[0].clientX - touch.x) / this.sp); this.dirty = true; }, { passive: false });
    cv.addEventListener("touchend", () => { touch = null; });
  }
}

// Biểu đồ đường vốn và sụt giảm cho backtest
export function drawEquity(canvas, equity, capital) {
  const S = canvas._fit || (canvas._fit = fitCanvas(canvas, () => drawEquity(canvas, canvas._eq, canvas._cap)));
  canvas._eq = equity; canvas._cap = capital;
  const ctx = S.ctx, w = S.w, h = S.h, padL = 8, padR = 70, eqH = h * 0.7 - 10, ddTop = h * 0.7 + 6, ddH = h * 0.3 - 26;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
  if (!equity || equity.length < 2) { ctx.fillStyle = C.axis; ctx.font = "13px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.fillText("Chưa có kết quả backtest", w / 2, h / 2); return; }
  let lo = Infinity, hi = -Infinity, peak = -Infinity; const dd = [];
  for (const p of equity) { lo = Math.min(lo, p.eq); hi = Math.max(hi, p.eq); peak = Math.max(peak, p.eq); dd.push((p.eq / peak - 1) * 100); }
  lo = Math.min(lo, capital); hi = Math.max(hi, capital);
  const minDD = Math.min(-0.01, ...dd), n = equity.length, X = i => padL + i / (n - 1) * (w - padL - padR), Y = v => 8 + (hi - v) / (hi - lo || 1) * eqH;
  ctx.strokeStyle = C.grid; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(padL, Y(capital)); ctx.lineTo(w - padR, Y(capital)); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); equity.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p.eq)) : ctx.moveTo(X(i), Y(p.eq))));
  ctx.strokeStyle = equity[n - 1].eq >= capital ? C.up : C.down; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = "rgba(229,72,77,0.35)"; ctx.beginPath(); ctx.moveTo(X(0), ddTop);
  dd.forEach((v, i) => ctx.lineTo(X(i), ddTop + v / minDD * ddH)); ctx.lineTo(X(n - 1), ddTop); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.axis; ctx.font = `11px ${MONO}`; ctx.textAlign = "left";
  ctx.fillText(hi.toFixed(0), w - padR + 6, 14); ctx.fillText(lo.toFixed(0), w - padR + 6, eqH + 8); ctx.fillText(minDD.toFixed(1) + "%", w - padR + 6, ddTop + ddH);
  ctx.fillText("Đường vốn", padL + 4, 20); ctx.fillText("Sụt giảm", padL + 4, ddTop + 12);
  const d0 = new Date(equity[0].t), d1 = new Date(equity[n - 1].t);
  ctx.fillText(`${pad2(d0.getDate())}/${pad2(d0.getMonth() + 1)}/${d0.getFullYear()}`, padL, h - 6);
  ctx.textAlign = "right"; ctx.fillText(`${pad2(d1.getDate())}/${pad2(d1.getMonth() + 1)}/${d1.getFullYear()}`, w - padR, h - 6);
}
