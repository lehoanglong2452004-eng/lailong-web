// Lai Long Web: bản đồ thanh khoản, khung riêng nằm giữa biểu đồ giá và Smart DOM.
//
// Mỗi dòng trùng đúng một dòng giá của Smart DOM (cùng bước giá, cùng vị trí), nên đọc ngang sang
// sổ lệnh là thấy ngay giá. Trục ngang là thời gian (mặc định 60 giây gần nhất, bên phải là bây giờ):
// màu sáng là lệnh chờ dày, đường trắng là dấu vết giá giữa, đường xanh/đỏ mảnh là giá mua/bán tốt nhất,
// bong bóng là lệnh gốc đã khớp, khung vàng là tường lệnh chờ đang đứng, dấu × cam là tường bị rút.

import { fmtVol, decimalsFor, MONO, fitCanvas, touchRows } from "./util.js?v=202610132215";
import { T, alpha } from "./theme.js?v=202610132215";
import { COL_MS } from "./market.js?v=202610132215";
import { ROW_H, HDR_H } from "./dom.js?v=202610132215";

export const LMAP_WINDOWS = [30e3, 60e3, 120e3, 300e3, 900e3];

// tối -> xanh -> vàng -> trắng
const HEAT = [[0, 10, 14, 30], [0.25, 0, 90, 180], [0.5, 0, 190, 160], [0.72, 240, 210, 40], [0.88, 255, 120, 20], [1, 255, 250, 240]];
function heatColor(x) {
  let j = 0; while (j < HEAT.length - 2 && x > HEAT[j + 1][0]) j++;
  const a = HEAT[j], b = HEAT[j + 1], f = Math.min(1, Math.max(0, (x - a[0]) / (b[0] - a[0])));
  return `rgb(${a[1] + (b[1] - a[1]) * f | 0},${a[2] + (b[2] - a[2]) * f | 0},${a[3] + (b[3] - a[3]) * f | 0})`;
}
const secs = ms => ms >= 60e3 ? `${(ms / 60e3).toFixed(ms % 60e3 ? 1 : 0)} phút` : `${Math.round(ms / 1000)} giây`;

export class LiqMap {
  constructor(canvas, market, dom) {
    this.cv = canvas; this.m = market; this.dom = dom; this.walls = null;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.windowMs = 60e3; this.contrast = 1; this.mouse = null; this.dirty = true;
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => { this.dirty = true; }, 200);
  }
  setWindow(ms) { this.windowMs = ms; this.dirty = true; }

  _x(t, now) { return this.S.w - (now - t) / this.windowMs * this.S.w; }
  _tAt(x, now) { return now - (this.S.w - x) / this.S.w * this.windowMs; }

  _draw() {
    if (!this.cv.offsetParent) return;
    const ctx = this.ctx, w = this.S.w, h = this.S.h, d = this.dom, now = Date.now();
    ctx.fillStyle = "#05070d"; ctx.fillRect(0, 0, w, h);
    this._header(now);
    if (d.center === null || !d.tick) { ctx.fillStyle = T.muted; ctx.font = "13px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Đang chờ sổ lệnh...", w / 2, h / 2); return; }
    const rows = d._rows(), cols = this.m.cols, g = this.m.grid, top = HDR_H, bottom = top + rows * ROW_H;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, w, rows * ROW_H); ctx.clip();
    const cw = Math.max(1, w * COL_MS / this.windowMs) + 0.6;
    this._cells = null;
    if (g && cols.length) {
      let i0 = cols.length; while (i0 > 0 && now - cols[i0 - 1].t < this.windowMs + COL_MS) i0--;
      // gộp mỗi cột thời gian vào các dòng của DOM; ô trống thì lấy ảnh chụp gần nhất trước đó
      const cells = [], all = []; let carry = null;
      for (let i = i0; i < cols.length; i++) {
        const c = cols[i].keys ? cols[i] : carry; if (!c || !c.keys) continue; carry = c;
        const agg = new Map();
        for (let j = 0; j < c.keys.length; j++) {
          // một ô lưới của bản đồ nhiệt có thể phủ nhiều dòng DOM (bước giá DOM nhỏ hơn): chia đều cho các dòng đó
          const pc = c.keys[j] * g, rA = d._rowOf(pc + g / 2 - d.tick / 2), rB = d._rowOf(pc - g / 2 + d.tick / 2);
          const lo = Math.min(rA, rB), hi = Math.max(rA, rB); if (hi < 0 || lo >= rows) continue;
          const q = c.sizes[j] / (hi - lo + 1);
          for (let r = Math.max(0, lo); r <= Math.min(rows - 1, hi); r++) agg.set(r, (agg.get(r) || 0) + q);
        }
        for (const [r, q] of agg) { cells.push(this._x(cols[i].t, now), r, q); all.push(q); }
      }
      // chuẩn hoá theo phân vị 98% để một bức tường lớn không làm tối cả bản đồ
      all.sort((a, b) => a - b);
      const ref = (all.length ? all[Math.floor(all.length * 0.98)] : 1) / this.contrast || 1;
      for (let j = 0; j < cells.length; j += 3) { ctx.fillStyle = heatColor(Math.min(1, Math.pow(cells[j + 2] / ref, 0.5))); ctx.fillRect(cells[j], d._yOf(cells[j + 1]), cw, ROW_H); }
      this._cells = { cells, ref };
      // giá mua/bán tốt nhất và dấu vết giá giữa
      const line = (f, col, width) => {
        ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath(); let on = false;
        for (let i = i0; i < cols.length; i++) { const c = cols[i], p = f(c); if (p == null) { on = false; continue; } const x = this._x(c.t, now) + cw / 2, y = d._yOf(d._rowOf(p)) + ROW_H / 2; on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
        ctx.stroke(); ctx.lineWidth = 1;
      };
      line(c => c.bb, alpha(T.up, 0.9), 1);
      line(c => c.ba, alpha(T.down, 0.9), 1);
      line(c => c.bb != null && c.ba != null ? (c.bb + c.ba) / 2 : null, "#ffffff", 1.6);
    }
    // tường đang đứng: khung vàng từ lúc xuất hiện tới bây giờ
    if (this.walls) for (const wl of this.walls.active()) {
      const r = d._rowOf(wl.p); if (r < 0 || r >= rows) continue;
      const x0 = Math.max(0, this._x(wl.t0, now));
      ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, d._yOf(r) + 1.5, w - x0 - 2, ROW_H - 3); ctx.lineWidth = 1;
    }
    // bong bóng lệnh gốc đã khớp
    const pr = this.m.prints; let s = pr.length, maxB = 0; this._vis = [];
    while (s > 0 && now - pr[s - 1].t < this.windowMs) s--;
    for (let i = s; i < pr.length; i++) maxB = Math.max(maxB, pr[i].q);
    for (let i = s; i < pr.length; i++) {
      const p = pr[i], x = this._x(p.t, now), y = d._yOf(d._rowOf(p.vwap)) + ROW_H / 2;
      if (y < top || y > bottom) continue;
      const rad = Math.max(1.5, Math.sqrt(p.q / (maxB || 1)) * ROW_H * 1.1);
      ctx.fillStyle = alpha(p.side === "buy" ? T.up : T.down, 0.72); ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      if (p.q >= this.m.bigPrint) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1; }
      this._vis.push({ p, x, y, r: rad });
    }
    // tường bị rút khi giá tới gần
    if (this.walls) for (const e of this.walls.events) {
      if (e.kind !== "spoof" || now - e.t > this.windowMs) continue;
      const r = d._rowOf(e.price); if (r < 0 || r >= rows) continue;
      const x = this._x(e.t, now), y = d._yOf(r) + ROW_H / 2;
      ctx.strokeStyle = "#ff9f1a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke(); ctx.lineWidth = 1;
      this._vis.push({ spoof: e, x, y, r: 6 });
    }
    // nhãn giá mờ bên trái, mỗi 5 dòng, để khung vẫn đọc được khi ẩn DOM
    const dec = decimalsFor(d.tick);
    ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (let k = 0; k < rows; k += 5) { const y = d._yOf(k) + ROW_H / 2; ctx.fillStyle = "rgba(0,0,0,0.55)"; const t = d._priceOfRow(k).toFixed(dec), tw = ctx.measureText(t).width; ctx.fillRect(2, y - 7, tw + 6, 14); ctx.fillStyle = alpha(T.text, 0.75); ctx.fillText(t, 5, y); }
    // thước ngang theo chuột
    if (this.mouse && this.mouse.y > top) {
      const r = Math.floor((this.mouse.y - top) / ROW_H), y = d._yOf(r);
      ctx.strokeStyle = alpha(T.accent, 0.8); ctx.strokeRect(0.5, y + 0.5, w - 1, ROW_H - 1);
      ctx.beginPath(); ctx.moveTo(this.mouse.x + 0.5, top); ctx.lineTo(this.mouse.x + 0.5, bottom); ctx.stroke();
    }
    ctx.restore();
  }

  _header(now) {
    const ctx = this.ctx, w = this.S.w;
    ctx.fillStyle = T.panel2; ctx.fillRect(0, 0, w, HDR_H);
    ctx.font = `bold 10px Segoe UI, sans-serif`; ctx.textBaseline = "middle"; ctx.fillStyle = T.muted;
    const steps = [5e3, 10e3, 15e3, 30e3, 60e3, 120e3, 300e3], st = steps.find(s => w / (this.windowMs / s) >= 60) || 300e3;
    ctx.strokeStyle = T.line; ctx.beginPath();
    for (let t = st; t < this.windowMs; t += st) {
      const x = this._x(now - t, now); ctx.textAlign = "center"; ctx.fillText(`−${t >= 60e3 ? t / 60e3 + "p" : t / 1000 + "s"}`, x, HDR_H / 2);
      ctx.moveTo(Math.round(x) + 0.5, HDR_H - 4); ctx.lineTo(Math.round(x) + 0.5, HDR_H);
    }
    ctx.stroke();
    ctx.textAlign = "right"; ctx.fillStyle = T.accent; ctx.fillText("BÂY GIỜ", w - 4, HDR_H / 2);
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(0, HDR_H - 0.5); ctx.lineTo(w, HDR_H - 0.5); ctx.stroke();
  }

  hitTest(x, y) {
    const d = this.dom, now = Date.now();
    if (y < HDR_H) return `Bản đồ thanh khoản ${secs(this.windowMs)} gần nhất, bên phải là bây giờ. Mỗi dòng trùng một dòng giá của Smart DOM bên cạnh. Màu sáng là lệnh chờ dày (tường), tối là mỏng. Đường trắng là giá giữa, xanh/đỏ mảnh là giá mua/bán tốt nhất. Bong bóng là lệnh gốc đã khớp (viền trắng là lệnh lớn). Khung vàng là tường đang đứng, dấu × cam là tường bị rút khi giá tới gần.`;
    if (d.center === null || !d.tick) return null;
    const dec = decimalsFor(d.tick);
    const hit = this._vis && this._vis.find(v => Math.hypot(x - v.x, y - v.y) <= v.r + 2);
    if (hit && hit.p) { const p = hit.p; return `${p.side === "buy" ? "MUA" : "BÁN"} chủ động ${fmtVol(p.q)} tại ${p.vwap.toFixed(dec)}, ${secs(now - p.t)} trước${p.n > 1 ? `, ghép từ ${p.n} lệnh nhỏ` : ""}${p.q >= this.m.bigPrint ? ". Đây là lệnh lớn (top 0,5%)" : ""}.`; }
    if (hit && hit.spoof) { const e = hit.spoof; return `Tường ${e.side === "bid" ? "MUA" : "BÁN"} ${fmtVol(e.q)} tại ${e.price.toFixed(dec)} bị rút ${secs(now - e.t)} trước, khi giá chỉ còn cách ${e.dist.toFixed(dec)}. Chỉ ${fmtVol(e.traded)} được khớp tại đó: nghi tường giả.`; }
    const r = Math.floor((y - HDR_H) / ROW_H), price = d._priceOfRow(r), ago = now - this._tAt(x, now);
    let q = null;
    if (this._cells) { const c = this._cells.cells, cw = this.S.w * COL_MS / this.windowMs + 0.6; for (let j = 0; j < c.length; j += 3) if (c[j + 1] === r && x >= c[j] && x < c[j] + cw) q = c[j + 2]; }
    return `Giá ${price.toFixed(dec)}, ${secs(Math.max(0, ago))} trước: lệnh chờ ${q == null ? "không có" : fmtVol(q)}${q != null && this._cells ? ` (${(q / (this._cells.ref || 1) * 100).toFixed(0)}% so với mức dày nhất)` : ""}. Lăn chuột để cuộn giá (cuộn cùng Smart DOM).`;
  }

  _bind() {
    const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener("mousemove", e => { this.mouse = pos(e); this.dirty = true; });
    cv.addEventListener("mouseleave", () => { this.mouse = null; this.dirty = true; });
    cv.addEventListener("dblclick", () => this.dom.recenter());
    cv.addEventListener("wheel", e => { e.preventDefault(); const d = this.dom; if (d.center === null) return; d.center += (e.deltaY < 0 ? 3 : -3) * d.tick; d.follow = false; d.dirty = true; this.dirty = true; }, { passive: false });
    touchRows(cv, ROW_H, n => { const d = this.dom; if (d.center === null) return; d.center += n * d.tick; d.follow = false; d.dirty = true; this.dirty = true; });
  }
}
