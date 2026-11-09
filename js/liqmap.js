// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bản đồ thanh khoản, khung riêng nằm giữa biểu đồ giá và Smart DOM.
//
// Mỗi dòng trùng đúng một dòng giá của Smart DOM (cùng bước giá, cùng vị trí), nên đọc ngang sang
// sổ lệnh là thấy ngay giá. Trục ngang là thời gian (mặc định 60 giây gần nhất, bên phải là bây giờ):
// cùng cách tô với Bookmap chính (vệt sáng mỗi dòng, làm mượt 3 giây), đường trắng là giá giữa, dải mờ là khoảng
// chênh mua / bán, bong bóng là lệnh gốc đã khớp, vạch vàng là tường đang đứng, dấu × cam là tường bị rút.
// Cột hẹp bên phải: lệnh chờ được xếp thêm (xanh) hay bị rút (đỏ) trong 10 giây qua.

import { fmtVol, decimalsFor, MONO, fitCanvas, touchRows } from "./util.js?v=202611090506";
import { T, alpha } from "./theme.js?v=202611090506";
import { heatIndexCut, HEAT_LUT, HEAT_BG, HOT_X, drawBubble } from "./heatmap.js?v=202611090506";
import { ROW_H, HDR_H } from "./dom.js?v=202611090506";

const PS_W = 46, PS_MS = 10e3;   // cột thêm / rút bên phải: rộng bao nhiêu điểm ảnh, so với bao lâu trước
const PERSIST_MS = 3000, HOLD_MS = 30000, LINE_K = -1.6, FLOOR = 10;

// Tô các cột (mỗi cột: x bắt đầu, v[dòng] = khối lượng chờ) vào bộ đệm điểm ảnh W × (rows × ROW_H).
// Mỗi cột kéo dài tới cột kế tiếp (tới mép phải nếu là cột cuối). Trung bình trượt theo thời gian tau ms.
export function paintRows(data, W, rows, list, mw, now, lo, hi, contrast, tau) {
  const bg = parseInt(HEAT_BG.slice(1), 16), br = (bg >> 16) & 255, bgc = (bg >> 8) & 255, bb = bg & 255;
  for (let k = 0; k < data.length; k += 4) { data[k] = br; data[k + 1] = bgc; data[k + 2] = bb; data[k + 3] = 255; }
  const prof = new Float32Array(ROW_H); for (let y = 0; y < ROW_H; y++) { const u = (y + 0.5 - ROW_H / 2) / (ROW_H / 2); prof[y] = Math.exp(LINE_K * u * u); }
  const ema = new Float32Array(rows); let tPrev = null;
  for (let n = 0; n < list.length; n++) {
    const o = list[n], xa = Math.max(0, o.x), xb = Math.min(W, n + 1 < list.length ? list[n + 1].x : Math.ceil(mw));
    const a = tPrev === null || o.t - tPrev > HOLD_MS || !(tau > 0) ? 1 : 1 - Math.exp(-(o.t - tPrev) / tau); tPrev = o.t;
    for (let r = 0; r < rows; r++) ema[r] += a * (o.v[r] - ema[r]);
    if (xb <= xa) continue;
    for (let r = 0; r < rows; r++) for (let y = 0; y < ROW_H; y++) {
      let li = heatIndexCut(ema[r] * prof[y], lo, hi, contrast); if (li < 0) li = FLOOR;
      const R = HEAT_LUT[li * 3], G = HEAT_LUT[li * 3 + 1], B = HEAT_LUT[li * 3 + 2];
      let p = ((r * ROW_H + y) * W + xa) * 4;
      for (let x = xa; x < xb; x++, p += 4) { data[p] = R; data[p + 1] = G; data[p + 2] = B; }
    }
  }
}

export const LMAP_WINDOWS = [30e3, 60e3, 120e3, 300e3, 900e3];

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
    ctx.fillStyle = HEAT_BG; ctx.fillRect(0, 0, w, h);
    this._header(now);
    if (d.center === null || !d.tick) { ctx.fillStyle = T.muted; ctx.font = "13px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Đang chờ sổ lệnh...", w / 2, h / 2); return; }
    const rows = d._rows(), cols = this.m.cols, g = this.m.grid, top = HDR_H, bottom = top + rows * ROW_H;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, w, rows * ROW_H); ctx.clip();
    const hw = w >= 220 ? PS_W : 0, mw = w - hw; // bên phải: cột thêm / rút lệnh chờ
    this._cells = null; this._mw = mw;
    if (g && cols.length) {
      let i0 = cols.length; while (i0 > 0 && now - cols[i0 - 1].t < this.windowMs + HOLD_MS) i0--;
      // gộp mỗi cột thời gian vào các dòng của DOM. Ưu tiên bản chi tiết theo bước giá gốc (mỗi mức giá
      // rơi đúng vào dòng DOM của nó); chỉ khi chưa có mới chia đều ô lưới thô cho các dòng nó phủ.
      // Nhiều cột rơi vào cùng một điểm ảnh ngang thì chỉ vẽ cột mới nhất.
      const list = [], all = []; let carry = null; const tk = this.m.tick;
      for (let i = i0; i < cols.length; i++) {
        const c = cols[i].keys ? cols[i] : carry; if (!c || !c.keys) continue; carry = c;
        const x = Math.max(0, this._x(cols[i].t, now) * mw / w), px = Math.floor(x);
        if (i < cols.length - 1 && Math.floor(Math.max(0, this._x(cols[i + 1].t, now) * mw / w)) === px) continue;
        const v = new Float32Array(rows);
        if (c.fk && tk > 0) {
          for (let j = 0; j < c.fk.length; j++) { const r = d._rowOf(c.fk[j] * tk); if (r >= 0 && r < rows) v[r] += c.fq[j]; }
        } else for (let j = 0; j < c.keys.length; j++) {
          const pc = c.keys[j] * g, rA = d._rowOf(pc + g / 2 - d.tick / 2), rB = d._rowOf(pc - g / 2 + d.tick / 2);
          const lo = Math.min(rA, rB), hi = Math.max(rA, rB); if (hi < 0 || lo >= rows) continue;
          const q = c.sizes[j] / (hi - lo + 1);
          for (let r = Math.max(0, lo); r <= Math.min(rows - 1, hi); r++) v[r] += q;
        }
        for (let r = 0; r < rows; r++) if (v[r] > 0) all.push(v[r]);
        list.push({ t: cols[i].t, x: px, v, c: cols[i] });
      }
      // cùng cách tô màu với Bookmap: thang log, màu đậm nhất ít nhất HOT_X lần trung vị
      all.sort((a, b) => a - b);
      const pct = q => all.length ? all[Math.min(all.length - 1, Math.floor(all.length * q))] : 0, med = pct(0.5);
      const lo = Math.max(pct(0.3), med * 0.2) || 1e-9, hi = Math.max(pct(0.99), HOT_X * med, lo * 1.01);
      this._cells = { list, ref: hi };
      this._paint(list, rows, mw, now, lo, hi);
      ctx.drawImage(this.off, 0, top);
      // khoảng chênh mua / bán: dải mờ giữa giá mua và bán tốt nhất, đường trắng là giá giữa
      const yR = p => d._yOf(d._rowOf(p)) + ROW_H / 2;
      ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.beginPath(); const pts = list.filter(o => o.c.bb != null && o.c.ba != null);
      pts.forEach((o, n) => { const y = yR(o.c.ba) - ROW_H / 2; n ? ctx.lineTo(o.x, y) : ctx.moveTo(o.x, y); });
      for (let n = pts.length - 1; n >= 0; n--) ctx.lineTo(pts[n].x, yR(pts[n].c.bb) + ROW_H / 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(240,244,248,0.9)"; ctx.lineWidth = 1.4; ctx.lineJoin = "round"; ctx.beginPath();
      pts.forEach((o, n) => { const y = (yR(o.c.bb) + yR(o.c.ba)) / 2; n ? ctx.lineTo(o.x, y) : ctx.moveTo(o.x, y); });
      if (pts.length) ctx.lineTo(mw, (yR(pts[pts.length - 1].c.bb) + yR(pts[pts.length - 1].c.ba)) / 2);
      ctx.stroke(); ctx.lineWidth = 1;
      if (hw) this._pullStack(list, rows, mw, hw, now);
    }
    // tường đang đứng: vạch vàng mảnh dưới dòng, từ lúc xuất hiện tới bây giờ, đầu vạch có chốt
    if (this.walls) for (const wl of this.walls.active()) {
      const r = d._rowOf(wl.p); if (r < 0 || r >= rows) continue;
      const x0 = Math.max(0, this._x(wl.t0, now) * this._mw / w), y = d._yOf(r) + ROW_H - 1.5;
      ctx.strokeStyle = "rgba(245,197,66,0.85)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(this._mw, y); ctx.moveTo(x0 + 0.5, y - 5); ctx.lineTo(x0 + 0.5, y); ctx.stroke(); ctx.lineWidth = 1;
    }
    // bong bóng lệnh gốc đã khớp
    const pr = this.m.prints; let s = pr.length, maxB = 0; this._vis = [];
    while (s > 0 && now - pr[s - 1].t < this.windowMs) s--;
    for (let i = s; i < pr.length; i++) maxB = Math.max(maxB, pr[i].q);
    for (let i = s; i < pr.length; i++) {
      const p = pr[i], x = this._x(p.t, now) * (this._mw || w) / w, y = d._yOf(d._rowOf(p.vwap)) + ROW_H / 2;
      if (y < top || y > bottom) continue;
      const rad = Math.max(1.5, Math.sqrt(p.q / (maxB || 1)) * ROW_H * 0.85);
      drawBubble(ctx, x, y, rad, p.side === "buy" ? 1 : 0);
      if (p.q >= this.m.bigPrint) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, rad + 1, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
      this._vis.push({ p, x, y, r: rad });
    }
    // tường bị rút khi giá tới gần
    if (this.walls) for (const e of this.walls.events) {
      if (e.kind !== "spoof" || now - e.t > this.windowMs) continue;
      const r = d._rowOf(e.price); if (r < 0 || r >= rows) continue;
      const x = this._x(e.t, now) * (this._mw || w) / w, y = d._yOf(r) + ROW_H / 2, a = 1 - 0.6 * (now - e.t) / this.windowMs;
      ctx.strokeStyle = `rgba(255,159,26,${a.toFixed(2)})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke(); ctx.lineWidth = 1;
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

  // Tô bản đồ vào bộ đệm: mỗi dòng giá là một vệt sáng giữa dòng mờ dần ra mép, làm mượt theo thời gian
  // (trung bình trượt PERSIST_MS) để lệnh chờ chớp tắt không vỡ thành khối, rồi đưa lên màn hình một lần.
  _paint(list, rows, mw, now, lo, hi) {
    const W = Math.max(1, Math.ceil(mw)), H = rows * ROW_H;
    if (!this.off) { this.off = document.createElement("canvas"); this.offCtx = this.off.getContext("2d"); }
    if (this.off.width !== W || this.off.height !== H) { this.off.width = W; this.off.height = H; this._img = null; }
    if (!this._img) this._img = this.offCtx.createImageData(W, H);
    paintRows(this._img.data, W, rows, list, mw, now, lo, hi, this.contrast, PERSIST_MS);
    this.offCtx.putImageData(this._img, 0, 0);
  }

  // Cột thêm / rút: lệnh chờ ở mỗi dòng bây giờ so với PS_MS trước. Xanh sang phải = được xếp thêm,
  // đỏ sang trái = bị rút hoặc bị khớp. Nhìn ngay ra phía nào đang dồn lệnh, phía nào đang bỏ chạy.
  _pullStack(list, rows, mw, hw, now) {
    const ctx = this.ctx, d = this.dom, cur = list[list.length - 1]; if (!cur) return;
    let old = list[0]; for (const o of list) { if (o.t <= now - PS_MS) old = o; else break; }
    const x0 = mw, xm = mw + hw / 2, dv = new Float32Array(rows); let mx = 0;
    ctx.fillStyle = "#0b0f14"; ctx.fillRect(x0, HDR_H, hw, rows * ROW_H);
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(x0 + 0.5, HDR_H); ctx.lineTo(x0 + 0.5, HDR_H + rows * ROW_H); ctx.stroke();
    for (let r = 0; r < rows; r++) { dv[r] = cur.v[r] - old.v[r]; mx = Math.max(mx, Math.abs(dv[r])); }
    if (!mx) return;
    this._ps = { dv, old: old.t };
    for (let r = 0; r < rows; r++) {
      const v = dv[r], bw = Math.abs(v) / mx * (hw / 2 - 3); if (bw < 0.5) continue;
      ctx.fillStyle = v > 0 ? "rgba(34,211,107,0.85)" : "rgba(255,59,48,0.85)";
      ctx.fillRect(v > 0 ? xm : xm - bw, d._yOf(r) + 4, bw, ROW_H - 8);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.moveTo(xm + 0.5, HDR_H); ctx.lineTo(xm + 0.5, HDR_H + rows * ROW_H); ctx.stroke();
  }

  _header(now) {
    const ctx = this.ctx, w = this.S.w;
    ctx.fillStyle = T.panel2; ctx.fillRect(0, 0, w, HDR_H);
    ctx.font = `bold 10px 'IBM Plex Mono', Consolas, monospace`; ctx.textBaseline = "middle"; ctx.fillStyle = T.muted;
    const mw = Math.min(w, this._mw || w), steps = [5e3, 10e3, 15e3, 30e3, 60e3, 120e3, 300e3], st = steps.find(s => mw / (this.windowMs / s) >= 60) || 300e3;
    ctx.strokeStyle = T.line; ctx.beginPath();
    for (let t = st; t < this.windowMs; t += st) {
      const x = this._x(now - t, now) * mw / w; ctx.textAlign = "center"; ctx.fillText(`−${t >= 60e3 ? t / 60e3 + "p" : t / 1000 + "s"}`, x, HDR_H / 2);
      ctx.moveTo(Math.round(x) + 0.5, HDR_H - 4); ctx.lineTo(Math.round(x) + 0.5, HDR_H);
    }
    ctx.stroke();
    ctx.textAlign = "right"; ctx.fillStyle = T.accent; ctx.fillText("BÂY GIỜ", mw - 4, HDR_H / 2);
    if (mw < w) { ctx.textAlign = "center"; ctx.fillStyle = T.muted; ctx.fillText(`±${PS_MS / 1000}s`, (mw + w) / 2, HDR_H / 2); }
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(0, HDR_H - 0.5); ctx.lineTo(w, HDR_H - 0.5); ctx.stroke();
  }

  hitTest(x, y) {
    const d = this.dom, now = Date.now();
    if (y < HDR_H && x >= (this._mw || this.S.w)) return `Cột thêm / rút: lệnh chờ ở mỗi dòng giá bây giờ so với ${PS_MS / 1000} giây trước. Xanh sang phải là được xếp thêm, đỏ sang trái là bị rút hoặc bị khớp.`;
    if (y < HDR_H) return `Bản đồ thanh khoản ${secs(this.windowMs)} gần nhất, bên phải là bây giờ. Mỗi dòng trùng một dòng giá của Smart DOM bên cạnh. Màu sáng là lệnh chờ dày (tường), tối là mỏng. Đường trắng là giá giữa, xanh/đỏ mảnh là giá mua/bán tốt nhất. Bong bóng là lệnh gốc đã khớp (viền trắng là lệnh lớn). Khung vàng là tường đang đứng, dấu × cam là tường bị rút khi giá tới gần.`;
    if (d.center === null || !d.tick) return null;
    const dec = decimalsFor(d.tick);
    const hit = this._vis && this._vis.find(v => Math.hypot(x - v.x, y - v.y) <= v.r + 2);
    if (hit && hit.p) { const p = hit.p; return `${p.side === "buy" ? "MUA" : "BÁN"} chủ động ${fmtVol(p.q)} tại ${p.vwap.toFixed(dec)}, ${secs(now - p.t)} trước${p.n > 1 ? `, ghép từ ${p.n} lệnh nhỏ` : ""}${p.q >= this.m.bigPrint ? ". Đây là lệnh lớn (top 0,5%)" : ""}.`; }
    if (hit && hit.spoof) { const e = hit.spoof; return `Tường ${e.side === "bid" ? "MUA" : "BÁN"} ${fmtVol(e.q)} tại ${e.price.toFixed(dec)} bị rút ${secs(now - e.t)} trước, khi giá chỉ còn cách ${e.dist.toFixed(dec)}. Chỉ ${fmtVol(e.traded)} được khớp tại đó: nghi tường giả.`; }
    const r = Math.floor((y - HDR_H) / ROW_H), price = d._priceOfRow(r), mw = this._mw || this.S.w;
    if (x >= mw && this._ps) { const v = this._ps.dv[r] || 0; return `Cột thêm / rút, giá ${price.toFixed(dec)}: lệnh chờ ${v >= 0 ? "được xếp THÊM" : "bị RÚT hoặc bị khớp"} ${fmtVol(Math.abs(v))} trong ${secs(now - this._ps.old)} qua. Xanh sang phải là thêm, đỏ sang trái là rút. Một phía rút mạnh khi giá tới gần thường là tường giả; một phía xếp thêm liên tục là có người đang thật sự chặn.`; }
    const ago = now - this._tAt(x * this.S.w / mw, now);
    let q = null;
    if (this._cells) { for (const o of this._cells.list) { if (o.x > x) break; q = o.v[r] || null; } }
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
