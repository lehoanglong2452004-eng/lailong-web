// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: thẻ "Thanh lý" — bản đồ nhiệt thanh lý ƯỚC TÍNH theo thời gian, kèm nến và cột thanh lý đang chờ.
//
// Trục ngang là thời gian, trục dọc là giá. Mỗi ô sáng dần (tím than → xanh → vàng) khi lượng vị thế ước tính sẽ bị
// thanh lý ở mức giá đó tích tụ thêm; giá quét qua thì ô tắt. Cột bên phải là ảnh chụp lúc này: long chờ dưới giá
// (đỏ), short chờ trên giá (xanh lá), kèm đường cộng dồn từ giá hiện tại ra xa.

import { fmtUsd, decimalsFor, pad2, MONO, fitCanvas } from "./util.js?v=202611061930";
import { T, alpha, watermark } from "./theme.js?v=202611061930";
import { LIQ_LUT, cellAt, colorRef, liqIndex, pendingTotals } from "./liqheat.js?v=202611061930";

const TOP = 24, BOT = 22, LEFT = 40, AXIS_W = 66;
const LONG = "#ff4d6d", SHORT = "#22d36b", HOT = "#fadc28";
const rgb = i => `rgb(${LIQ_LUT[i * 3]},${LIQ_LUT[i * 3 + 1]},${LIQ_LUT[i * 3 + 2]})`;

// bước nhãn trục giá "đẹp" để có khoảng `n` nhãn
function niceTick(span, n) {
  const raw = span / Math.max(1, n), e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
}

// số nến gốc gộp lại thành một nến vẽ để thân nến rộng ít nhất ~7 px
export function candleGroup(colW) { for (const g of [1, 2, 3, 4, 6, 8, 12, 16, 24, 48]) if (g * colW >= 7) return g; return 96; }

export class LiqHeatChart {
  constructor(canvas, { livePrice } = {}) {
    this.cv = canvas; this.livePrice = livePrice || (() => null);
    this.S = fitCanvas(canvas, () => { this.dirty = true; this._img = null; }); this.ctx = this.S.ctx;
    this.data = null; this.bars = []; this.from = 0; this.thr = 0.22; this.msg = "Đang tải dữ liệu thanh lý...";
    this.view = null; this.mouse = null; this.dirty = true; this.symbol = ""; this.tick = 0;
    this._events();
    const loop = () => { if (this.dirty && !this.cv.hidden) { this.dirty = false; this.draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // data = liqHeat(bars); from = chỉ số nến đầu tiên được vẽ (các nến trước chỉ để các mức kịp tích tụ)
  setData(bars, data, { from = 0, symbol = "", tick = 0, keepView = false } = {}) {
    this.bars = bars || []; this.data = data; this.from = Math.max(0, Math.min(from, this.bars.length - 1)); this.symbol = symbol; this.tick = tick;
    this.msg = this.bars.length && data && data.cols.length ? "" : this.msg;
    this.ref = data ? colorRef(data.cols, this.from) : 1;
    if (!keepView || !this.view) this.resetView();
    this._img = null; this.dirty = true;
  }
  setMessage(text) { this.msg = text; this.dirty = true; }
  setThreshold(x) { this.thr = x; this._img = null; this.dirty = true; }

  resetView() {
    const bs = this.bars.slice(this.from);
    if (!bs.length) { this.view = null; return; }
    let lo = Infinity, hi = -Infinity; for (const b of bs) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); }
    const pad = Math.max((hi - lo) * 0.35, hi * 0.015);
    this.view = { lo: lo - pad, hi: hi + pad };
    this._img = null; this.dirty = true;
  }

  layout() {
    const w = this.S.w, h = this.S.h, prof = w < 520 ? Math.max(70, Math.round(w * 0.2)) : Math.min(230, Math.round(w * 0.18));
    const R = w - prof - AXIS_W, left = w < 520 ? 26 : LEFT;
    return { w, h, L: left, R, pw: R - left, top: TOP, ph: h - TOP - BOT, X0: R + AXIS_W, prof };
  }
  y(p, L) { const v = this.view; return L.top + (v.hi - p) / (v.hi - v.lo) * L.ph; }
  price(y, L) { const v = this.view; return v.hi - (y - L.top) / L.ph * (v.hi - v.lo); }
  colW(L) { return L.pw / Math.max(1, this.bars.length - this.from); }

  // lớp nhiệt vẽ vào ảnh rời: rộng bằng số cột, cao bằng điểm ảnh thật của vùng vẽ; chỉ dựng lại khi dữ liệu,
  // khung nhìn hay ngưỡng màu đổi
  _heatImage(L) {
    const dpr = window.devicePixelRatio || 1, n = this.bars.length - this.from, H = Math.max(1, Math.round(L.ph * dpr));
    const k = `${n}|${H}|${this.view.lo}|${this.view.hi}|${this.thr}`;
    if (this._img && this._imgKey === k) return this._img;
    const cv = this._imgCv || (this._imgCv = document.createElement("canvas"));
    cv.width = Math.max(1, n); cv.height = H;
    const c2 = cv.getContext("2d"), img = c2.createImageData(cv.width, H), d = img.data, idx = new Int16Array(cv.width * H).fill(-1);
    const step = this.data.step, lo = this.view.lo, span = this.view.hi - lo, ref = this.ref || 1;
    for (let i = 0; i < n; i++) {
      const col = this.data.cols[this.from + i];
      for (let j = 0; j < col.keys.length; j++) {
        const li = liqIndex(col.vals[j] / ref, this.thr); if (li < 0) continue;
        const p0 = col.keys[j] * step, y0 = Math.floor((1 - (p0 + step - lo) / span) * H), y1 = Math.ceil((1 - (p0 - lo) / span) * H);
        if (y1 < 0 || y0 >= H) continue;
        for (let yy = Math.max(0, y0), ye = Math.min(H, Math.max(y1, y0 + 1)); yy < ye; yy++) { const q = yy * cv.width + i; if (li > idx[q]) idx[q] = li; }
      }
    }
    for (let q = 0; q < idx.length; q++) {
      const li = Math.max(0, idx[q]); d[q * 4] = LIQ_LUT[li * 3]; d[q * 4 + 1] = LIQ_LUT[li * 3 + 1]; d[q * 4 + 2] = LIQ_LUT[li * 3 + 2]; d[q * 4 + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
    this._img = cv; this._imgKey = k;
    return cv;
  }

  draw() {
    const ctx = this.ctx, L = this.layout();
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, L.w, L.h);
    if (!this.data || !this.view || this.msg) {
      watermark(ctx, L.w, L.h);
      ctx.fillStyle = T.muted; ctx.font = `12px ${MONO}`; ctx.textAlign = "center";
      ctx.fillText(this.msg || "Chưa có dữ liệu", L.w / 2, L.h / 2); return;
    }
    const dec = decimalsFor(this.tick || this.data.step), live = this.livePrice(), last = live > 0 ? live : this.bars[this.bars.length - 1].c;
    ctx.save(); ctx.beginPath(); ctx.rect(L.L, L.top, L.pw, L.ph); ctx.clip();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(this._heatImage(L), L.L, L.top, L.pw, L.ph);
    watermark(ctx, L.w - L.prof, L.h);
    // lưới giá
    const tk = niceTick(this.view.hi - this.view.lo, Math.max(3, Math.floor(L.ph / 56)));
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
    for (let p = Math.ceil(this.view.lo / tk) * tk; p < this.view.hi; p += tk) { const yy = Math.round(this.y(p, L)) + 0.5; ctx.beginPath(); ctx.moveTo(L.L, yy); ctx.lineTo(L.R, yy); ctx.stroke(); }
    this._candles(ctx, L);
    ctx.restore();
    this._axes(ctx, L, tk, dec);
    this._profile(ctx, L, last, dec);
    // đường giá hiện tại
    const yl = Math.round(this.y(last, L)) + 0.5;
    if (yl > L.top && yl < L.top + L.ph) {
      ctx.setLineDash([4, 3]); ctx.strokeStyle = alpha(T.text, 0.8); ctx.beginPath(); ctx.moveTo(L.L, yl); ctx.lineTo(L.w, yl); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = T.text; ctx.fillRect(L.R + 1, yl - 8, AXIS_W - 2, 16);
      ctx.fillStyle = T.bg; ctx.font = `600 11px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(last.toFixed(dec), L.R + 5, yl + 4);
    }
    this._legend(ctx, L);
    this._hover(ctx, L, last, dec);
  }

  _candles(ctx, L) {
    const cw = this.colW(L), g = candleGroup(cw), n = this.bars.length - this.from;
    for (let s = 0; s < n; s += g) {
      let o = null, h = -Infinity, l = Infinity, c = null;
      for (let i = s; i < Math.min(n, s + g); i++) { const b = this.bars[this.from + i]; if (o == null) o = b.o; h = Math.max(h, b.h); l = Math.min(l, b.l); c = b.c; }
      const xm = L.L + (s + Math.min(g, n - s) / 2) * cw, bw = Math.max(1, Math.min(g * cw * 0.7, 14)), col = c >= o ? T.up : T.down;
      ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(Math.round(xm) + 0.5, this.y(h, L)); ctx.lineTo(Math.round(xm) + 0.5, this.y(l, L)); ctx.stroke();
      const y0 = this.y(Math.max(o, c), L), y1 = this.y(Math.min(o, c), L);
      ctx.fillStyle = col; ctx.fillRect(Math.round(xm - bw / 2), y0, Math.round(bw), Math.max(1, y1 - y0));
    }
  }

  _axes(ctx, L, tk, dec) {
    ctx.fillStyle = T.bg; ctx.fillRect(L.R, L.top, AXIS_W, L.ph); ctx.fillRect(0, L.top + L.ph, L.w, BOT);
    ctx.font = `11px ${MONO}`; ctx.fillStyle = T.muted; ctx.textAlign = "left";
    const pd = tk >= 1 ? 0 : dec;
    for (let p = Math.ceil(this.view.lo / tk) * tk; p < this.view.hi; p += tk) { const yy = this.y(p, L); if (yy > L.top + 6 && yy < L.top + L.ph - 4) ctx.fillText(p.toFixed(pd), L.R + 5, yy + 4); }
    // nhãn thời gian
    const cw = this.colW(L), every = Math.max(1, Math.ceil(110 / cw)), n = this.bars.length - this.from;
    ctx.textAlign = "center";
    for (let i = Math.floor(every / 2); i < n; i += every) {
      const d = new Date(this.bars[this.from + i].t), x = L.L + (i + 0.5) * cw;
      ctx.fillText(`${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`, x, L.top + L.ph + 15);
    }
    // thang màu bên trái
    const bx = L.L < 30 ? 6 : 12, bw = L.L < 30 ? 10 : 14, by = L.top + 18, bh = L.ph - 36;
    ctx.fillStyle = T.bg; ctx.fillRect(0, L.top, L.L, L.ph);
    const gr = ctx.createLinearGradient(0, by + bh, 0, by);
    for (const s of [0, 0.25, 0.5, 0.68, 0.84, 1]) gr.addColorStop(s, rgb(Math.round(s * 255)));
    ctx.fillStyle = gr; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = T.muted; ctx.font = `10px ${MONO}`; ctx.textAlign = "left";
    ctx.fillText(fmtUsd(this.ref).replace(/\.\d+(?=[KMB])/, ""), 2, L.top + 11);
    ctx.fillText(fmtUsd(this.ref * this.thr).replace(/\.\d+(?=[KMB])/, ""), 2, by + bh + 13);
  }

  // cột thanh lý đang chờ lúc này
  _profile(ctx, L, last) {
    const X0 = L.X0, PW = L.prof, step = this.data.step, rowH = step / (this.view.hi - this.view.lo) * L.ph;
    ctx.fillStyle = alpha(T.text, 0.035); ctx.fillRect(X0, L.top, PW, L.ph);
    ctx.save(); ctx.beginPath(); ctx.rect(X0, L.top, PW, L.ph); ctx.clip();
    const lv = this.data.last, inView = o => o.price + step >= this.view.lo && o.price <= this.view.hi;
    let mx = 0; for (const o of [...lv.longs, ...lv.shorts]) if (inView(o)) mx = Math.max(mx, o.notional);
    mx = mx || 1;
    const bar = (o, col) => { ctx.fillStyle = col; ctx.fillRect(X0, this.y(o.price + step, L), o.notional / mx * (PW - 14), Math.max(1, rowH - 0.5)); };
    for (const o of lv.longs) if (inView(o)) bar(o, alpha(LONG, 0.85));
    for (const o of lv.shorts) if (inView(o)) bar(o, alpha(SHORT, 0.85));
    const tot = pendingTotals(lv, last);
    const cum = (arr, dir, total, col) => {
      if (!total) return; let s = 0; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X0, this.y(last, L));
      for (const o of [...arr].sort((a, b) => dir * (a.price - b.price))) { s += o.notional; ctx.lineTo(X0 + s / total * (PW - 14), this.y(o.price + (dir > 0 ? 0 : step), L)); }
      ctx.stroke(); ctx.lineWidth = 1;
    };
    cum(lv.longs.filter(o => o.price < last), -1, tot.long, LONG);
    cum(lv.shorts.filter(o => o.price > last), 1, tot.short, SHORT);
    ctx.restore();
    ctx.fillStyle = alpha(T.bg, 0.85); ctx.fillRect(X0, L.top, PW, 34); ctx.fillRect(X0, L.top + L.ph - 20, PW, 20);
    ctx.font = `11px ${MONO}`; ctx.textAlign = "left";
    ctx.fillStyle = T.muted; ctx.fillText(PW < 150 ? "Đang chờ" : "Thanh lý đang chờ (bây giờ)", X0 + 5, L.top + 12);
    ctx.fillStyle = SHORT; ctx.fillText(`${PW < 150 ? "S" : "Short chờ"}: ${fmtUsd(tot.short)} ↑`, X0 + 5, L.top + 28);
    ctx.fillStyle = LONG; ctx.fillText(`${PW < 150 ? "L" : "Long chờ"}: ${fmtUsd(tot.long)} ↓`, X0 + 5, L.top + L.ph - 6);
    this._tot = tot;
  }

  _legend(ctx, L) {
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, L.w, TOP);
    ctx.font = `11px ${MONO}`; ctx.textAlign = "left"; let x = 8;
    const item = (fill, text) => { if (x > L.w - 40) return; ctx.fillStyle = fill; ctx.fillRect(x, 8, 10, 10); ctx.fillStyle = T.muted; ctx.fillText(text, x + 15, 17); x += 15 + ctx.measureText(text).width + 16; };
    const gr = ctx.createLinearGradient(8, 0, 18, 0); for (const s of [0, 0.5, 1]) gr.addColorStop(s, rgb(Math.round(s * 255)));
    item(gr, L.w < 700 ? "Dày dần" : "Mức thanh lý dày dần (tối → vàng)");
    item(LONG, L.w < 700 ? "Long" : "Long bị thanh lý nếu giá xuống tới");
    item(SHORT, L.w < 700 ? "Short" : "Short bị thanh lý nếu giá lên tới");
    // nhãn cảnh báo: rút gọn dần cho vừa chỗ trống còn lại
    for (const t of [`${this.symbol} · ƯỚC TÍNH từ OI, không phải thanh lý thật`, "ƯỚC TÍNH từ OI, không phải thanh lý thật", "ƯỚC TÍNH từ OI"]) {
      if (ctx.measureText(t).width < L.w - 8 - x) { ctx.fillStyle = HOT; ctx.textAlign = "right"; ctx.fillText(t, L.w - 8, 17); break; }
    }
  }

  _hover(ctx, L, last, dec) {
    const m = this.mouse; if (!m || m.y < L.top || m.y > L.top + L.ph) return;
    const inPlot = m.x >= L.L && m.x < L.R, inProf = m.x >= L.X0; if (!inPlot && !inProf) return;
    const step = this.data.step, p = this.price(m.y, L), key = Math.floor(p / step), p0 = key * step;
    ctx.strokeStyle = alpha(T.text, 0.35); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(L.L, Math.round(m.y) + 0.5); ctx.lineTo(L.w, Math.round(m.y) + 0.5);
    if (inPlot) { ctx.moveTo(Math.round(m.x) + 0.5, L.top); ctx.lineTo(Math.round(m.x) + 0.5, L.top + L.ph); }
    ctx.stroke(); ctx.setLineDash([]);
    const dist = (p0 / last - 1) * 100, lines = [];
    if (inPlot) {
      const i = Math.min(this.bars.length - this.from - 1, Math.max(0, Math.floor((m.x - L.L) / this.colW(L)))), b = this.bars[this.from + i], d = new Date(b.t);
      const cell = cellAt(this.data.cols[this.from + i], key);
      lines.push(`${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())} · giá ${p0.toFixed(dec)}–${(p0 + step).toFixed(dec)}`);
      lines.push(cell && cell.v > 0 ? `${cell.long ? "Long" : "Short"} chờ thanh lý ước tính ${fmtUsd(cell.v)}` : "Không có mức thanh lý ước tính ở ô này");
    } else {
      const lv = this.data.last, below = p < last, arr = below ? lv.longs : lv.shorts, o = arr.find(q => Math.floor(q.price / step + 1e-9) === key);
      let cum = 0; for (const q of arr) if (below ? q.price >= p0 && q.price < last : q.price <= p0 && q.price > last) cum += q.notional;
      lines.push(`Giá ${p0.toFixed(dec)}–${(p0 + step).toFixed(dec)}: ${below ? "long" : "short"} chờ ${o ? fmtUsd(o.notional) : "$0"}`);
      lines.push(`Cộng dồn từ giá hiện tại tới đây: ${fmtUsd(cum)}`);
    }
    lines.push(`Cách giá hiện tại ${dist >= 0 ? "+" : ""}${dist.toFixed(2)}%`);
    ctx.font = `11px ${MONO}`;
    const tw = Math.max(...lines.map(s => ctx.measureText(s).width)) + 16, th = lines.length * 16 + 8;
    let tx = m.x + 14, ty = m.y + 14; if (tx + tw > L.w - 4) tx = m.x - tw - 14; if (ty + th > L.h - 4) ty = m.y - th - 14; tx = Math.max(4, tx);
    ctx.fillStyle = "rgba(10,12,16,0.93)"; ctx.fillRect(tx, ty, tw, th); ctx.strokeStyle = "#3a4250"; ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);
    ctx.fillStyle = "#e6e6e6"; ctx.textAlign = "left"; lines.forEach((s, k) => ctx.fillText(s, tx + 8, ty + 17 + k * 16));
  }

  _zoom(f, y) {
    if (!this.view) return; const L = this.layout(), p = this.price(y, L), v = this.view;
    const lo = p - (p - v.lo) * f, hi = p + (v.hi - p) * f; if (hi - lo < this.data.step * 6) return;
    this.view = { lo, hi }; this._img = null; this.dirty = true;
  }
  _pan(dy) {
    if (!this.view) return; const L = this.layout(), d = dy / L.ph * (this.view.hi - this.view.lo);
    this.view = { lo: this.view.lo + d, hi: this.view.hi + d }; this._img = null; this.dirty = true;
  }

  _events() {
    const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    let drag = null;
    cv.addEventListener("mousemove", e => {
      const m = pos(e); if (drag) { this._pan(m.y - drag.y); drag = m; }
      this.mouse = m; this.dirty = true;
    });
    cv.addEventListener("mouseleave", () => { this.mouse = null; drag = null; this.dirty = true; });
    cv.addEventListener("mousedown", e => { drag = pos(e); });
    window.addEventListener("mouseup", () => { drag = null; });
    cv.addEventListener("wheel", e => { e.preventDefault(); this._zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, pos(e).y); }, { passive: false });
    cv.addEventListener("dblclick", () => this.resetView());
    // điện thoại: một ngón kéo giá, hai ngón chụm/mở để phóng giá, chạm giữ để xem ô
    let t0 = null;
    cv.addEventListener("touchstart", e => {
      const ts = [...e.touches].map(pos);
      t0 = ts.length === 2 ? { pinch: Math.abs(ts[0].y - ts[1].y) || 1, cy: (ts[0].y + ts[1].y) / 2 } : { y: ts[0].y };
      this.mouse = ts.length === 1 ? ts[0] : null; this.dirty = true;
    }, { passive: true });
    cv.addEventListener("touchmove", e => {
      if (!t0) return; e.preventDefault(); const ts = [...e.touches].map(pos);
      if (ts.length === 2 && t0.pinch) { const d = Math.abs(ts[0].y - ts[1].y) || 1; this._zoom(t0.pinch / d, t0.cy); t0.pinch = d; }
      else if (ts.length === 1 && t0.y != null) { this._pan(ts[0].y - t0.y); t0.y = ts[0].y; this.mouse = ts[0]; }
    }, { passive: false });
    cv.addEventListener("touchend", () => { t0 = null; });
  }
}
