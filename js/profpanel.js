// Ô "KL theo giá": khối lượng khớp theo từng mức giá, thang giá riêng phủ hết cột.
// Mặc định đồng bộ với vùng đang xem trên biểu đồ; chip 4g · 1N · 1T xem khoảng thời gian cố định.
import { T, alpha, isLight } from "./theme.js?v=202611150629";
import { fitCanvas, fmtVol, decimalsFor, MONO } from "./util.js?v=202611150629";
import { niceStep } from "./zones.js?v=202611150629";

export const PROF_MODES = [["chart", "Theo biểu đồ"], ["4h", "4g"], ["1d", "1N"], ["1w", "1T"]];
// nến dùng cho từng khoảng: khung, số nến
export const PROF_SRC = { "4h": ["1m", 240], "1d": ["5m", 288], "1w": ["1h", 168] };

export const profColors = () => (isLight() ? { bar: "#3b7ddd", poc: "#173f8a" } : { bar: "#2f6fe0", poc: "#8ab8ff" });

// Khối lượng theo nấc giá `step` từ các nến: nến có footprint dùng ô thật (giá = khoá × fpStep), không có thì rải đều trên cao–thấp.
// Trả về Map(nấc → khối lượng)
export function volByPrice(bars, step, fpStep = 0) {
  const m = new Map(); if (!(step > 0)) return m;
  const add = (k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const b of bars) {
    if (b.fp && b.fp.size && fpStep > 0) { for (const [k0, c] of b.fp) add(Math.floor((k0 * fpStep) / step + 1e-9), c[0] + c[1]); continue; }
    const v = b.v || 0; if (!(v > 0)) continue;
    if (!(b.h > b.l)) { add(Math.floor(b.c / step + 1e-9), v); continue; }
    const k1 = Math.floor(b.l / step + 1e-9), k2 = Math.floor(b.h / step - 1e-9), per = v / (b.h - b.l);
    for (let k = k1; k <= k2; k++) { const a = Math.max(b.l, k * step), c = Math.min(b.h, (k + 1) * step); if (c > a) add(k, per * (c - a)); }
  }
  return m;
}

export class ProfPanel {
  constructor(canvas) {
    this.cv = canvas; this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.bars = []; this.fpStep = 0; this.tick = 0; this.price = null; this.label = ""; this.dirty = true; this._R = null;
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  // bars: các nến cần tính; label: chữ mô tả khoảng (ví dụ "130 nến 5m đang xem")
  set(bars, { fpStep = 0, tick = 0, price = null, label = "" } = {}) { Object.assign(this, { bars: bars || [], fpStep, tick, price, label }); this.dirty = true; }
  setPrice(p) { if (p !== this.price) { this.price = p; this.dirty = true; } }

  _draw() {
    const ctx = this.ctx, w = this.S.w, h = this.S.h, col = profColors(); this._R = null;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h);
    const bars = this.bars; let lo = Infinity, hi = -Infinity;
    for (const b of bars) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); }
    if (!bars.length || !(hi > lo)) { ctx.fillStyle = T.muted; ctx.font = `12px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Đang tải khối lượng...", w / 2, h / 2); return; }
    const foot = 18, H = h - foot - 4; let step = Math.max(this.tick || 0, niceStep((hi - lo) / Math.max(4, Math.floor(H / 14))));
    while ((hi - lo) / step > H / 11) step = niceStep(step * 2.01); // mỗi dòng tối thiểu ~11 điểm ảnh
    const k0 = Math.floor(lo / step + 1e-9), k1 = Math.floor(hi / step - 1e-9), n = k1 - k0 + 1, rh = H / n;
    const m = volByPrice(bars, step, this.fpStep); let mx = 0, poc = null, tot = 0;
    for (let k = k0; k <= k1; k++) { const v = m.get(k) || 0; tot += v; if (v > mx) { mx = v; poc = k; } }
    const dec = Math.max(decimalsFor(step), 0); ctx.font = `600 10.5px ${MONO}`;
    const labW = Math.ceil(ctx.measureText(hi.toFixed(dec)).width) + 6, x0 = labW + 6, bw = w - x0 - 34;
    ctx.textBaseline = "middle";
    for (let k = k1, j = 0; k >= k0; k--, j++) {
      const y = 2 + j * rh, v = m.get(k) || 0, isPoc = k === poc;
      ctx.font = `${isPoc ? "600 " : ""}10.5px ${MONO}`; ctx.textAlign = "right"; ctx.fillStyle = isPoc ? col.poc : T.muted;
      if (rh >= 9 || j % Math.ceil(9 / rh) === 0) ctx.fillText((k * step).toFixed(dec), labW, y + rh / 2);
      if (!v || !mx) continue;
      const ww = Math.max(1, v / mx * bw);
      ctx.fillStyle = isPoc ? col.poc : alpha(col.bar, 0.88); ctx.fillRect(x0, y + Math.min(1.5, rh * 0.15), ww, Math.max(1, rh - Math.min(3, rh * 0.3)));
      if (isPoc) { ctx.font = `600 10.5px ${MONO}`; ctx.textAlign = "left"; ctx.fillText("POC", Math.min(x0 + ww + 4, w - 30), y + rh / 2); }
    }
    // giá hiện tại: nét đứt cam
    if (this.price != null && this.price >= lo && this.price <= hi) {
      const y = 2 + (k1 + 1 - this.price / step) * rh;
      ctx.save(); ctx.strokeStyle = "#ff9f1c"; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x0 - 4, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); ctx.stroke(); ctx.restore();
    }
    ctx.font = `10.5px ${MONO}`; ctx.fillStyle = T.muted; ctx.textAlign = "left"; ctx.fillText(this.label, 6, h - foot / 2, w - 12);
    this._R = { k0, k1, rh, step, dec, m, tot };
  }

  hitTest(x, y) {
    const R = this._R; if (!R) return null;
    const j = Math.floor((y - 2) / R.rh), k = R.k1 - j; if (k < R.k0 || k > R.k1) return null;
    const v = R.m.get(k) || 0;
    return `Mức giá ${(k * R.step).toFixed(R.dec)} – ${((k + 1) * R.step).toFixed(R.dec)}\nKhối lượng khớp: ${fmtVol(v)}${R.tot ? ` (${(v / R.tot * 100).toFixed(1)}% tổng)` : ""}\n${this.label}`;
  }
}
