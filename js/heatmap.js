// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bản đồ nhiệt thanh khoản kiểu Bookmap.
//
// Trục ngang là thời gian, trục dọc là giá. Màu ở mỗi điểm là khối lượng lệnh chờ tại mức giá đó
// vào thời điểm đó: xanh đậm = mỏng, vàng/cam/đỏ = dày (tường thanh khoản).
// Bong bóng là lệnh khớp (xanh lá: mua chủ động, đỏ: bán chủ động), kim cương là lệnh thanh lý.

import { COL_MS } from "./market.js?v=202610300405";
import { fmtVol, fmtUsd, decimalsFor, fmtTime, MONO, fitCanvas } from "./util.js?v=202610300405";
import { T, alpha, watermark } from "./theme.js?v=202610300405";
import { drawConfl, conflTip } from "./levels.js?v=202610300405";
import { drawShapes } from "./drawings.js?v=202610300405";
import { bookImb } from "./walls.js?v=202610300405";

const AXIS_W = 72, TIME_H = 20, PANE_H = 74;

// Cài đặt mặc định của Bookmap (bấm đúp vào ô trong bảng cài đặt để về mặc định)
export const HM_DEFAULTS = {
  palette: "bookmap",   // bảng màu: bookmap (xanh -> vàng -> cam -> đỏ) hoặc gray (xám)
  upper: 99,            // ngưỡng cắt trên: mức lệnh chờ từ phân vị này trở lên tô màu đậm nhất
  lower: 2,             // ngưỡng cắt dưới: dưới phân vị này để nền tối
  auto: "live",         // tự chỉnh tương phản: live (liên tục), recenter (khi căn giữa lại), off (giữ nguyên)
  smooth: "auto",       // làm mịn dọc: auto, none, 1, 2, 3
  aggregate: false,     // sổ lệnh cộng dồn từ giá hiện tại ra xa
  dim: 0,               // làm tối bản đồ (%)
  dots: "3d", dotStyle: "pie", dotSize: 1, dotAlpha: 100,
  cluster: "smart", clusterSec: 1, clusterVol: 0, // gom bong bóng; clusterVol 0 = tự động
  dotMode: "total",     // total (tổng khối lượng) hoặc delta (mua − bán)
  dotMin: 0,            // ẩn bong bóng nhỏ hơn mức này
  bboHide: 3,           // ẩn đường giá mua/bán khi hai đường gần nhau dưới số điểm ảnh này
  lastLine: true,       // đường giá khớp cuối
  vwap: true, poc: true,
  colCob: true, colCum: false, cobPct: false, colCvp: true, colSvp: false, colQd: false, colTc: false,
  slices: 0,            // vạch chia thời gian (giây), 0 = tự động
  recenter: "bbo",      // tự căn giữa theo bbo, last (giá khớp) hoặc none
  candles: false,       // vẽ nến chồng lên bản đồ
  imb: true,            // đường mất cân bằng sổ lệnh ±0,5% quanh giá ở ô dưới
  speed: true,          // đường tốc độ băng (số lệnh khớp mỗi giây) ở ô dưới
};

// bảng màu kiểu Bookmap: nền xanh đen -> xanh thép -> xanh nhạt -> vàng -> cam -> đỏ (tường dày nhất)
const PALETTES = {
  bookmap: [[0, 13, 30, 46], [0.18, 16, 52, 84], [0.36, 22, 104, 160], [0.5, 60, 160, 220], [0.6, 190, 225, 238], [0.7, 246, 238, 140], [0.84, 248, 150, 30], [1, 228, 36, 27]],
  gray: [[0, 18, 18, 18], [0.5, 120, 120, 120], [1, 255, 255, 255]],
};
export const HEAT_BG = "#0a1520";
const makeLut = stops => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255; let j = 0; while (j < stops.length - 2 && x > stops[j + 1][0]) j++;
    const a = stops[j], b = stops[j + 1], f = (x - a[0]) / (b[0] - a[0]);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
  }
  return lut;
};
const LUTS = Object.fromEntries(Object.entries(PALETTES).map(([k, v]) => [k, makeLut(v)]));
const LUT = LUTS.bookmap;

// Đổi khối lượng lệnh chờ thành chỉ số màu 0..255, hoặc -1 (để nền tối) nếu quá mỏng.
// Dưới 1% mức tham chiếu là nền; còn lại theo căn bậc ~0,6 nên mức mỏng vẫn thấy màu xanh tối, tường dày lên vàng, cam, đỏ.
export function heatIndex(q, ref, contrast = 1) {
  if (!(q > 0)) return -1;
  const x = q / ref * contrast;
  if (x < 0.01) return -1;
  return Math.min(255, (Math.pow(Math.min(1, x), 0.6) * 235 + 20) | 0);
}
// Như trên nhưng theo hai ngưỡng cắt: lo trở xuống là nền, hi trở lên là màu đậm nhất
export function heatIndexCut(q, lo, hi, contrast = 1) {
  if (!(q > lo)) return -1;
  const x = (q - lo) / Math.max(1e-12, hi - lo) * contrast;
  return Math.min(255, (Math.pow(Math.min(1, x), 0.6) * 235 + 20) | 0);
}
export { LUT as HEAT_LUT };

const BUY = [47, 191, 106], SELL = [224, 71, 58];
const mix = f => `rgb(${SELL.map((c, i) => Math.round(c + (BUY[i] - c) * f)).join(",")})`;
// Vẽ một bong bóng: 3D (quả cầu có bóng đổ) hoặc 2D (phẳng). buyFrac = tỷ lệ mua chủ động.
// Kiểu tô: pie (chia miếng xanh/đỏ), gradient (một màu pha giữa xanh và đỏ), solid (hai nửa màu đặc, chia theo tỷ lệ).
export function drawBubble(ctx, x, y, r, buyFrac, o = {}) {
  const d3 = o.d3 !== false, style = o.style || "pie";
  const g = (c0, c1, c2) => { if (!d3) return c1; const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(0.55, c1); gr.addColorStop(1, c2); return gr; };
  ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const sell = 1 - buyFrac;
  if (style === "gradient") {
    const c = mix(buyFrac);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g("rgba(255,255,255,0.75)", c, "rgba(0,0,0,0.85)");
    if (d3) { ctx.fillStyle = c; ctx.fill(); ctx.fillStyle = g("rgba(255,255,255,0.55)", "rgba(255,255,255,0)", "rgba(0,0,0,0.55)"); }
    ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g("#9df5bf", "#2fbf6a", "#0f5c31"); ctx.fill();
    if (sell > 0.005) {
      ctx.beginPath();
      if (style === "solid") { ctx.arc(x, y, r, 0, Math.PI * 2); ctx.save(); ctx.clip(); ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, r * 2 * sell); }
      else { ctx.moveTo(x, y); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + sell * Math.PI * 2); ctx.closePath(); }
      ctx.fillStyle = g("#ffb3a6", "#e0473a", "#6e1610"); ctx.fill();
      if (style === "solid") ctx.restore();
    }
  }
  if (r > 4) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
}

export class Heatmap {
  constructor(canvas, market, opts = {}) {
    this.cv = canvas; this.m = market; this.opts = opts;
    this.S = fitCanvas(canvas, () => { this.dirty = true; });
    this.ctx = this.S.ctx;
    this.off = document.createElement("canvas"); this.offCtx = this.off.getContext("2d");
    this.msPerPx = 120; this.follow = true; this.tEnd = Date.now(); this.rightPad = 70;
    this.pCenter = null; this.pxPerPrice = null; this.contrast = 1; this.cfg = { ...HM_DEFAULTS };
    this.show = { bubbles: true, liq: true, levels: true, zones: true, liqMap: true, bigOnly: false, ice: true, confl: true };
    this.levels = []; this.zones = []; this.confl = []; this.liqMap = null; this.orders = []; this.position = null;
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

  // Bố cục: bản đồ | các cột bên phải (COB, Volume Profile, +/-, đếm lệnh, thanh lý ước tính) | trục giá
  get L() {
    const w = this.S.w, h = this.S.h, narrow = w < 700, k = narrow ? 0.55 : 1, c = this.cfg, axisW = narrow ? 60 : AXIS_W;
    const want = [];
    if (c.colCob) want.push(["cob", (c.colCum ? 150 : 84) * k]);
    if (!narrow) {
      if (c.colCvp) want.push(["cvp", 64]);
      if (c.colSvp) want.push(["svp", 64]);
      if (c.colQd) want.push(["qd", 58]);
      if (c.colTc) want.push(["tc", 52]);
    }
    if (this.show.liqMap && this.liqMap) want.push(["liq", 64 * k]);
    const side = want.reduce((a, x) => a + x[1], 0), pw = Math.max(50, w - axisW - side), ph = h - TIME_H - PANE_H;
    const colsL = {}; let x = pw; for (const [id, cw] of want) { colsL[id] = { x, w: cw }; x += cw; }
    return { w, h, pw, ph, side, axisW, colsL, axisX: w - axisW, paneTop: ph, timeTop: ph + PANE_H };
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
      this.tEnd = Date.now();
      const rc = this.cfg.recenter, p = rc === "last" ? (this.m.last ? this.m.last.p : mid) : mid;
      const y = this.yOf(p);
      if (rc !== "none" && (y < this._L.ph * 0.2 || y > this._L.ph * 0.8)) this.pCenter = p;
    }
    return true;
  }

  _draw() {
    if (!this.cv.offsetParent) return; // đang ẩn (trang khác hoặc chế độ nến)
    const ctx = this.ctx, L = this._L = this.L;
    if (L.ph < 20 || L.pw < 20) return;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, L.w, L.h); watermark(ctx, L.pw, L.ph);
    if (!this._initScale()) {
      ctx.fillStyle = T.muted; ctx.font = "14px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "center";
      ctx.fillText("Đang chờ dữ liệu sổ lệnh...", L.pw / 2, L.ph / 2); return;
    }
    const cols = this.m.cols, t0 = this.tAt(0), t1 = this.tAt(L.pw);
    let i0 = lowerBound(cols, t0 - COL_MS), i1 = Math.min(cols.length - 1, lowerBound(cols, t1));
    this._heat(cols, i0, i1, L);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.pw, L.ph); ctx.clip();
    this._slices(L);
    if (this.cfg.candles) this._candles(L);
    if (this.show.zones) this._zones(L);
    if (this.show.confl) drawConfl(ctx, this.confl, p => this.yOf(p), L.pw, L.ph, `10px ${MONO}`);
    if (this.cfg.vwap) this._vwap(cols, i0, i1);
    this._bbo(cols, i0, i1, L);
    this._axisTags = [];
    if (this.show.levels) { this._levels(L); this._marks(L); }
    if (this.show.bubbles) this._bubbles(cols, i0, i1, L);
    if (this.show.liq) this._liqs(cols, i0, i1);
    if (this.show.ice) this._icebergs(L);
    this._ownLines(L);
    this._alertLines(L);
    if (this.drawings) this._axisTags.push(...drawShapes(ctx, this.drawings.list(), this.drawings.preview, { yOf: p => this.yOf(p), pw: L.pw, ph: L.ph, dec: decimalsFor(this.m.tick || this.m.grid) }));
    ctx.restore();
    this._pane(cols, i0, i1, L);
    this._pocs = [];
    this._columns(L, cols, i0, i1);
    this._pocLines(L);
    this._axes(L);
    this._cross(L, cols);
    this._legend(L);
  }

  // ----- bản đồ nhiệt: vẽ từng điểm ảnh vào bộ đệm rồi phóng lên canvas -----
  // Mỗi cột thời gian được dựng thành một dải điểm ảnh theo chiều dọc. Khi thu nhỏ, nhiều mức giá dồn vào
  // một điểm ảnh nên cộng lại; vì vậy mức tham chiếu màu được lấy từ chính các điểm ảnh đã dựng
  // (không phải từ từng mức giá lẻ), để màu không bị cháy sáng khi thu nhỏ.
  _heat(cols, i0, i1, L) {
    const W = Math.ceil(L.pw), H = Math.ceil(L.ph);
    if (this.off.width !== W || this.off.height !== H) { this.off.width = W; this.off.height = H; this._img = null; }
    if (!this._img) { this._img = this.offCtx.createImageData(W, H); this._row = new Float32Array(H); }
    const img = this._img, data = img.data, row = this._row, g = this.m.grid, tk = this.m.tick;
    const bgn = parseInt(HEAT_BG.slice(1), 16), br = (bgn >> 16) & 255, bgc = (bgn >> 8) & 255, bb0 = bgn & 255;
    for (let k = 0; k < data.length; k += 4) { data[k] = br; data[k + 1] = bgc; data[k + 2] = bb0; data[k + 3] = 255; }
    if (!g || i1 < 0) { this.offCtx.putImageData(img, 0, 0); this.ctx.drawImage(this.off, 0, 0, L.pw, L.ph); return; }
    // phóng to đủ lớn thì dùng bản chi tiết theo bước giá gốc (mỗi mức giá một dòng như Bookmap)
    const fine = tk > 0 && tk < g && tk * this.pxPerPrice >= 2;
    const step = fine ? tk : g, gpx = step * this.pxPerPrice, half = Math.max(0.5, gpx / 2), gap = gpx >= 5 ? 1 : 0;
    const cfg = this.cfg, agg = cfg.aggregate;
    // làm mịn dọc: tự động khi thu nhỏ (nhiều mức giá trong một điểm ảnh), hoặc theo mức chọn
    const sm = cfg.smooth === "none" ? 0 : cfg.smooth === "auto" ? (gpx < 0.5 ? 2 : gpx < 1 ? 1 : 0) : +cfg.smooth;
    if (!this._row2 || this._row2.length !== H) this._row2 = new Float32Array(H);
    const build = c => {
      const ks = fine && c.fk ? c.fk : c.keys, qs = fine && c.fk ? c.fq : c.sizes, st = fine && c.fk ? tk : g;
      row.fill(0); let any = false, run = 0;
      const nb = fine && c.fk ? c.fnb : c.knb;
      for (let j = 0; j < ks.length; j++) {
        // các mức giá được lưu: phía mua từ cao xuống thấp rồi phía bán từ thấp lên cao; cộng dồn thì bắt đầu lại khi sang phía bán
        if (agg && j === nb) run = 0;
        const q = agg ? (run += qs[j]) : qs[j];
        const yc = this.yOf(ks[j] * st);
        let ya = Math.floor(yc - half), yb = Math.ceil(yc + half) - gap; if (yb <= 0 || ya >= H) continue;
        ya = Math.max(0, ya); yb = Math.min(H, yb); any = true;
        for (let y = ya; y < yb; y++) row[y] = gpx < 1 && !agg ? row[y] + q : Math.max(row[y], q);
      }
      if (sm && any) { const r2 = this._row2; for (let y = 0; y < H; y++) { let a = 0, n = 0; for (let d = -sm; d <= sm; d++) { const yy = y + d; if (yy >= 0 && yy < H) { a += row[yy]; n++; } } r2[y] = a / n; } row.set(r2); }
      return any;
    };
    // lượt 1: lấy mẫu các điểm ảnh để tìm mức tham chiếu (phân vị 99%)
    const sample = [], stepI = Math.max(1, Math.floor((i1 - i0 + 1) / 80));
    for (let i = Math.max(0, i0); i <= i1; i += stepI) {
      const c = carry(cols, i); if (!c || !build(c)) continue;
      for (let y = 0; y < H; y += 2) if (row[y] > 0) sample.push(row[y]);
    }
    sample.sort((a, b) => a - b);
    const pct = q => sample.length ? sample[Math.min(sample.length - 1, Math.floor(sample.length * q))] : 0;
    // ngưỡng cắt theo phân vị; tự chỉnh liên tục, chỉ khi căn giữa lại / đổi độ phóng, hoặc giữ nguyên
    const zoomKey = `${this.pxPerPrice.toFixed(5)}:${fine}:${agg}:${sm}`;
    const key = cfg.auto === "recenter" ? `${Math.round(this.pCenter / (step || 1))}:${zoomKey}` : cfg.auto === "off" ? zoomKey : null;
    let hi = pct(cfg.upper / 100) || 1, lo = pct(cfg.lower / 100) || 0;
    if (key !== null && this._cut && this._cut.key === key && this._cut.fine === fine) { hi = this._cut.hi; lo = this._cut.lo; } else this._cut = { key, hi, lo, fine };
    if (hi <= lo) hi = lo + 1e-9;
    const ref = hi, LUTc = LUTS[cfg.palette] || LUT, dimK = 1 - Math.min(0.9, (cfg.dim || 0) / 100);
    // lượt 2: tô màu
    let x = Math.max(0, Math.floor(this.xOf(cols[Math.max(0, i0)].t))), lastC = null;
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = carry(cols, i), xa = Math.max(0, Math.floor(this.xOf(cols[i].t)));
      const xb = Math.min(W, Math.floor(this.xOf(cols[i].t + (cols[i].span || COL_MS))));
      if (!c || xb <= xa || xb <= x) continue;
      if (c !== lastC) { build(c); lastC = c; }
      for (let y = 0; y < H; y++) {
        const li = heatIndexCut(row[y], lo, hi, this.contrast); if (li < 0) continue;
        const r = LUTc[li * 3] * dimK, gg = LUTc[li * 3 + 1] * dimK, b = LUTc[li * 3 + 2] * dimK;
        let p = (y * W + Math.max(x, xa)) * 4;
        for (let xx = Math.max(x, xa); xx < xb; xx++, p += 4) { data[p] = r; data[p + 1] = gg; data[p + 2] = b; }
      }
      x = xb;
    }
    this.offCtx.putImageData(img, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.off, 0, 0, L.pw, L.ph);
    this._ref = ref; this._fine = fine;
  }

  // đường giá mua tốt nhất (xanh) / bán tốt nhất (đỏ) theo thời gian, dạng bậc thang như Bookmap;
  // phần từ bây giờ tới mép phải là nét đứt: giá mua / bán đang đứng. Khi thu nhỏ tới mức hai đường gần nhau
  // dưới ngưỡng thì ẩn đi, chỉ còn đường giá khớp cuối (có biên trễ 20% để khỏi nhấp nháy).
  _bbo(cols, i0, i1, L) {
    const ctx = this.ctx, xNow = this.xOf(Date.now()), { bids, asks } = this.m.book.sorted();
    const gapPx = bids.length && asks.length ? (asks[0][0] - bids[0][0]) * this.pxPerPrice : 99, thr = this.cfg.bboHide;
    if (this._bboHidden) { if (gapPx > thr * 1.2) this._bboHidden = false; } else if (gapPx < thr) this._bboHidden = true;
    const step = (key, col, width, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.lineJoin = "miter"; ctx.beginPath(); let on = false, py = 0;
      for (let i = Math.max(0, i0); i <= i1; i++) {
        const c = cols[i]; if (c[key] == null) { on = false; continue; }
        const x = this.xOf(c.t), y = Math.round(this.yOf(c[key])) + 0.5;
        if (!on) { ctx.moveTo(x, y); on = true; } else if (y !== py) { ctx.lineTo(x, py); ctx.lineTo(x, y); }
        py = y;
      }
      if (on) { ctx.lineTo(xNow, py); ctx.stroke(); if (dash) { ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(xNow, py); ctx.lineTo(L.pw, py); } }
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (!this._bboHidden) { step("ba", "#ff3b30", 2, true); step("bb", "#22d36b", 2, true); }
    if (this.cfg.lastLine || this._bboHidden) step("lp", "rgba(235,240,245,0.85)", this._bboHidden ? 1.6 : 1, this._bboHidden);
    ctx.lineWidth = 1;
  }

  // VWAP phiên (từ lúc mở trang): đường tím
  _vwap(cols, i0, i1) {
    const ctx = this.ctx; ctx.strokeStyle = "rgba(200,120,255,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); let on = false;
    for (let i = Math.max(0, i0); i <= i1; i++) { const c = cols[i]; if (c.vwap == null) continue; const x = this.xOf(c.t + COL_MS / 2), y = this.yOf(c.vwap); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
    ctx.stroke(); ctx.lineWidth = 1;
  }
  _pocLines(L) {
    const ctx = this.ctx; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.pw, L.ph); ctx.clip();
    for (const pc of this._pocs || []) {
      const y = Math.round(this.yOf(pc.p)) + 0.5; if (y < 0 || y > L.ph) continue;
      ctx.strokeStyle = pc.kind === "cvp" ? "rgba(245,197,66,0.9)" : "rgba(255,150,40,0.8)"; ctx.setLineDash(pc.kind === "cvp" ? [] : [5, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "10px 'IBM Plex Mono', Consolas, monospace"; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = "left"; ctx.fillText(pc.kind === "cvp" ? "POC vùng" : "POC phiên", 6, y - 3);
    }
    ctx.restore(); ctx.lineWidth = 1;
  }
  // vạch chia thời gian (nét chấm), như Time slices của Bookmap
  _slices(L) {
    const ms = (this.cfg.slices || 0) * 1000; if (!ms) return;
    const ctx = this.ctx, t0 = this.tAt(0), t1 = this.tAt(L.pw); if ((t1 - t0) / ms > 200) return;
    ctx.strokeStyle = "rgba(220,230,240,0.35)"; ctx.setLineDash([2, 4]); ctx.beginPath();
    for (let t = Math.ceil(t0 / ms) * ms; t < t1; t += ms) { const x = Math.round(this.xOf(t)) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, L.ph); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // nến của khung đang chọn, vẽ chồng lên bản đồ (thân rỗng để vẫn thấy thanh khoản phía sau)
  _candles(L) {
    const ctx = this.ctx, bars = this.m.bars, ms = this.m.intervalMs; if (!bars.length || !ms) return;
    const t0 = this.tAt(0), t1 = this.tAt(L.pw);
    for (let i = bars.length - 1; i >= 0; i--) {
      const b = bars[i]; if (b.t + ms < t0) break; if (b.t > t1) continue;
      const xa = this.xOf(b.t), xb = this.xOf(b.t + ms), w = xb - xa, xm = (xa + xb) / 2, up = b.c >= b.o, col = up ? "#22d36b" : "#ff3b30";
      const bw = Math.max(1, Math.min(w * 0.7, 40));
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xm, this.yOf(b.h)); ctx.lineTo(xm, this.yOf(b.l)); ctx.stroke();
      const yo = this.yOf(b.o), yc = this.yOf(b.c);
      ctx.fillStyle = alpha(col, 0.18); ctx.fillRect(xm - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo)));
      ctx.strokeRect(xm - bw / 2 + 0.5, Math.min(yo, yc) + 0.5, bw - 1, Math.max(1, Math.abs(yc - yo)));
    }
  }

  // Bong bóng khối lượng: mỗi nhóm một quả, đặt tại giá trung bình đã khớp. Thể tích quả cầu tỷ lệ với khối lượng
  // (bán kính theo căn bậc ba). Cách gom: thông minh (theo điểm ảnh rồi gộp quả chồng nhau), theo thời gian,
  // theo khối lượng (mỗi quả đủ một lượng) hoặc theo giá (gộp tới khi giá đổi).
  _bubbles(cols, i0, i1, L) {
    const ctx = this.ctx, cfg = this.cfg, tk = this.m.tick || this.m.grid || 1, groups = [];
    let cur = null;
    const push = () => { if (cur && cur.bv + cur.sv > 0) groups.push(cur); cur = null; };
    const add = (c) => {
      if (!cur) cur = { bv: 0, sv: 0, pv: 0, tv: 0, big: [], k: null };
      cur.bv += c.bv; cur.sv += c.sv; cur.pv += c.bpv + c.spv; cur.tv += (c.t + (c.span || COL_MS) / 2) * (c.bv + c.sv);
      if (c.big) cur.big.push(...c.big);
    };
    let visV = 0; for (let i = Math.max(0, i0); i <= i1; i++) visV += cols[i].bv + cols[i].sv;
    const volT = cfg.clusterVol > 0 ? cfg.clusterVol : visV / 120 || 1;
    const bucketPx = Math.max(6, COL_MS / this.msPerPx), secMs = Math.max(COL_MS, cfg.clusterSec * 1000);
    let gk = null;
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = cols[i]; if (!c.bv && !c.sv) continue;
      if (cfg.cluster === "volume") { add(c); if (cur.bv + cur.sv >= volT) push(); continue; }
      if (cfg.cluster === "price") { const k = Math.round((c.bpv + c.spv) / (c.bv + c.sv) / tk); if (cur && cur.k !== k) push(); add(c); cur.k = k; continue; }
      const k = cfg.cluster === "time" ? Math.floor(c.t / secMs) : Math.floor(this.xOf(c.t) / bucketPx);
      if (k !== gk) { push(); gk = k; }
      add(c);
    }
    push();
    let maxV = 0; const val = g => cfg.dotMode === "delta" ? Math.abs(g.bv - g.sv) : g.bv + g.sv;
    for (const g of groups) maxV = Math.max(maxV, val(g));
    if (!maxV) return;
    const rMax = Math.min(30, L.ph * 0.06, Math.max(9, 34 * Math.sqrt(120 / this.msPerPx) / 2)) * cfg.dotSize;
    let dots = groups.map(g => { const v = val(g), tot = g.bv + g.sv; return { x: this.xOf(g.tv / tot), y: this.yOf(g.pv / tot), r: Math.max(2, Math.cbrt(v / maxV) * rMax), bv: g.bv, sv: g.sv, p: g.pv / tot, v, big: g.big }; });
    // gom thông minh: gộp các quả chồng lên nhau nhiều (tâm cách nhau dưới 60% tổng bán kính)
    if (cfg.cluster === "smart") {
      const out = [];
      for (const d of dots) {
        const o = out[out.length - 1];
        if (o && Math.hypot(d.x - o.x, d.y - o.y) < (d.r + o.r) * 0.6) {
          const w = o.v + d.v || 1; o.x = (o.x * o.v + d.x * d.v) / w; o.y = (o.y * o.v + d.y * d.v) / w; o.p = (o.p * (o.bv + o.sv) + d.p * (d.bv + d.sv)) / (o.bv + o.sv + d.bv + d.sv);
          o.bv += d.bv; o.sv += d.sv; o.v = cfg.dotMode === "delta" ? Math.abs(o.bv - o.sv) : o.bv + o.sv; o.big.push(...d.big);
          o.r = Math.max(2, Math.cbrt(Math.min(1, o.v / maxV)) * rMax);
        } else out.push({ ...d, big: d.big.slice() });
      }
      dots = out;
    }
    this._bub = [];
    const opt = { d3: cfg.dots !== "2d", style: cfg.dotStyle, alpha: cfg.dotAlpha / 100 };
    for (const d of dots) {
      if (this.show.bigOnly && d.bv + d.sv < this.m.bigTrade) continue;
      if (cfg.dotMin > 0 && d.v < cfg.dotMin) continue;
      if (d.x < -d.r || d.x > L.pw + d.r) continue;
      const frac = cfg.dotMode === "delta" ? (d.bv >= d.sv ? 1 : 0) : d.bv / (d.bv + d.sv);
      drawBubble(ctx, d.x, d.y, d.r, frac, opt);
      this._bub.push(d);
      for (const t of d.big) if (t.q >= this.m.bigTrade * 2) { ctx.fillStyle = "#fff"; ctx.font = `bold 10px ${MONO}`; ctx.textAlign = "center"; ctx.fillText(fmtVol(t.q), d.x, d.y - d.r - 4); break; }
    }
  }

  // lệnh băng chìm / nạp lại: vạch ngang suốt thời gian bị khớp, ô "I" ở cuối, nét đứt khi đã bị xuyên thủng
  _icebergs(L) {
    const ctx = this.ctx, now = Date.now(), t0 = this.tAt(0); this._iceVis = [];
    const evs = this.m.ice ? this.m.ice.events : [];
    let maxH = 0; for (const e of evs) maxH = Math.max(maxH, e.hidden);
    for (const e of evs) {
      const tEnd = e.status === "live" ? now : e.tEnd || e.t1; if (tEnd < t0) continue;
      const y = Math.round(this.yOf(e.price)) + 0.5; if (y < -10 || y > L.ph + 10) continue;
      const xa = Math.max(0, this.xOf(e.t)), xb = Math.min(L.pw, this.xOf(e.status === "live" ? e.t1 : tEnd)), col = e.side === "bid" ? "#3cf0b4" : "#ff6fae";
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(e.status === "broken" ? [4, 3] : []);
      ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(Math.max(xa + 2, xb), y); ctx.stroke(); ctx.setLineDash([]);
      const r = 5 + 4 * Math.sqrt(e.hidden / (maxH || 1)), x = Math.max(xa + r, xb);
      ctx.fillStyle = "#06121c"; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let a = 0; a < 6; a++) { const an = Math.PI / 6 + a * Math.PI / 3; ctx.lineTo(x + r * Math.cos(an), y + r * Math.sin(an)); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.font = `bold ${Math.round(r * 1.2)}px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("I", x, y + 0.5); ctx.textBaseline = "alphabetic";
      if (L.pw >= 300) { ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(`ẩn ${fmtVol(e.hidden)}`, x + r + 3, y - 4); }
      this._iceVis.push({ x, y, r, e });
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
      const base = lv.kind === "support" ? T.up : T.down;
      const a = 0.35 + 0.5 * (lv.strength || 50) / 100;
      ctx.strokeStyle = alpha(base, a.toFixed(2)); ctx.lineWidth = lv.strength > 70 ? 2 : 1; ctx.setLineDash(lv.broken ? [3, 4] : []);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.fillStyle = alpha(base, 0.95);
      ctx.fillText(`${lv.kind === "support" ? "HT" : "KC"} ${lv.price.toFixed(dec)} · chạm ${lv.touches} · test ${lv.tests}`, 6, y - 3);
      (this._axisTags || (this._axisTags = [])).push({ y, col: base, txt: lv.price.toFixed(dec) });
    }
  }

  // mốc giá trong ngày: nét chấm mảnh xuyên bản đồ, nhãn ở mép phải
  _marks(L) {
    const ctx = this.ctx, dec = decimalsFor(this.m.tick || this.m.grid);
    for (const mk of this.marks || []) {
      const y = Math.round(this.yOf(mk.price)) + 0.5; if (y < 0 || y > L.ph) continue;
      const col = mk.kind === "open" ? "#c9d1d9" : mk.kind === "hi" ? "#ff7b72" : "#56d364";
      ctx.strokeStyle = alpha(col, mk.prev ? 0.45 : 0.75); ctx.setLineDash(mk.prev ? [2, 4] : [6, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      const t = `${mk.label} ${mk.price.toFixed(dec)}`; ctx.font = "10px 'IBM Plex Mono', Consolas, monospace"; const tw = ctx.measureText(t).width + 8;
      ctx.fillStyle = alpha("#000000", 0.6); ctx.fillRect(L.pw - tw - 2, y - 13, tw, 12); ctx.fillStyle = col; ctx.textAlign = "left"; ctx.fillText(t, L.pw - tw + 2, y - 4);
    }
  }

  // mức giá đã đặt cảnh báo: nét chấm cam, có chuông ở mép trái
  _alertLines(L) {
    const ctx = this.ctx, dec = decimalsFor(this.m.tick || this.m.grid);
    for (const a of this.alertLevels || []) {
      const y = Math.round(this.yOf(a.price)) + 0.5; if (y < 0 || y > L.ph) continue;
      ctx.strokeStyle = "#ffa940"; ctx.lineWidth = 1; ctx.setLineDash([1, 3]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "left"; ctx.fillStyle = "#ffa940"; ctx.fillText(`🔔 ${a.price.toFixed(dec)}`, 4, y - 3);
      (this._axisTags || (this._axisTags = [])).push({ y, col: "#ffa940", txt: a.price.toFixed(dec) });
    }
  }

  _zones(L) {
    const ctx = this.ctx;
    for (const z of this.zones) {
      const ya = this.yOf(z.high), yb = this.yOf(z.low); if (yb < 0 || ya > L.ph) continue;
      const xa = Math.max(0, this.xOf(z.t));
      ctx.fillStyle = z.side === "buy" ? alpha(T.up, 0.10) : alpha(T.down, 0.10);
      ctx.fillRect(xa, ya, L.pw - xa, Math.max(2, yb - ya));
      ctx.strokeStyle = z.side === "buy" ? alpha(T.up, 0.45) : alpha(T.down, 0.45); ctx.lineWidth = 1;
      ctx.strokeRect(xa + 0.5, ya + 0.5, L.pw - xa - 1, Math.max(2, yb - ya));
      ctx.fillStyle = T.text; ctx.font = `10px ${MONO}`; ctx.textAlign = "left";
      ctx.fillText(`KL bất thường ${z.z.toFixed(1)}σ`, xa + 4, ya + 11);
    }
  }

  _ownLines(L) {
    if (this.ol) return this.ol.draw(this.ctx, L);
    const ctx = this.ctx, dec = decimalsFor(this.m.tick || this.m.grid);
    const line = (p, color, text, dash) => {
      const y = Math.round(this.yOf(p)) + 0.5; if (y < 0 || y > L.ph) return;
      ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; const tw = ctx.measureText(text).width + 10;
      ctx.fillStyle = color; ctx.fillRect(L.pw - tw - 4, y - 8, tw, 16); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(text, L.pw - tw + 1, y + 4);
    };
    for (const o of this.orders) line(o.price, o.side === "buy" ? T.up : T.down, `${o.side === "buy" ? "MUA" : "BÁN"} ${+o.remaining.toFixed(6)} @ ${o.price.toFixed(dec)} · trước: ${fmtVol(o.queueAhead || 0)}`, [5, 4]);
    const p = this.position;
    if (p && p.qty) {
      line(p.avg, p.qty > 0 ? T.up : T.down, `${p.qty > 0 ? "LONG" : "SHORT"} ${+Math.abs(p.qty).toFixed(6)} · ${p.upnl >= 0 ? "+" : ""}${p.upnl.toFixed(2)} USDT`, []);
      if (p.liq > 0) line(p.liq, "#a8711a", `Thanh lý ${p.liq.toFixed(dec)}`, [2, 3]);
    }
  }

  // ô dưới: khối lượng mua/bán theo thời gian và CVD
  _pane(cols, i0, i1, L) {
    const ctx = this.ctx, top = L.paneTop, H = PANE_H - 4, mid = top + H / 2 + 2;
    ctx.fillStyle = T.panel; ctx.fillRect(0, top, L.pw, PANE_H);
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(L.w, top + 0.5); ctx.stroke();
    const bucketPx = Math.max(3, COL_MS / this.msPerPx), groups = new Map();
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = cols[i], gx = Math.floor(this.xOf(c.t) / bucketPx), e = groups.get(gx) || { b: 0, s: 0, n: 0 };
      e.b += c.bv; e.s += c.sv; e.n += c.tn || 0; groups.set(gx, e);
    }
    let maxV = 0; for (const e of groups.values()) maxV = Math.max(maxV, e.b, e.s);
    if (maxV) for (const [gx, e] of groups) {
      const x = gx * bucketPx, bw = Math.max(1, bucketPx - 1);
      ctx.fillStyle = alpha(T.up, 0.7); ctx.fillRect(x, mid - e.b / maxV * (H / 2 - 2), bw, e.b / maxV * (H / 2 - 2));
      ctx.fillStyle = alpha(T.down, 0.7); ctx.fillRect(x, mid, bw, e.s / maxV * (H / 2 - 2));
    }
    // CVD trong vùng nhìn thấy
    let cum = 0, lo = 0, hi = 0; const pts = [];
    for (let i = Math.max(0, i0); i <= i1; i++) { cum += cols[i].bv - cols[i].sv; lo = Math.min(lo, cum); hi = Math.max(hi, cum); pts.push([this.xOf(cols[i].t + COL_MS), cum]); }
    if (pts.length > 1 && hi > lo) {
      ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 1.4; ctx.beginPath();
      pts.forEach(([x, v], k) => { const y = top + 4 + (hi - v) / (hi - lo) * (H - 6); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    ctx.fillStyle = T.muted; ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "left";
    // nhãn dòng 1 nối tiếp nhau theo độ rộng chữ thật; hết chỗ thì xuống dòng 2
    const cvdTxt = `CVD ${cum >= 0 ? "+" : ""}${fmtVol(cum)}`, cvdX = 6 + ctx.measureText("Mua / bán chủ động").width + 12;
    ctx.fillText("Mua / bán chủ động", 6, top + 13); ctx.fillStyle = "#f5c542"; ctx.fillText(cvdTxt, cvdX, top + 13);
    const nextX = cvdX + ctx.measureText(cvdTxt).width + 16;
    // mất cân bằng sổ lệnh ±0,5%: đường tím, giữa ô là cân bằng, trên là chờ mua dày hơn
    this._imbNow = null;
    if (this.cfg.imb) {
      const ipts = []; let last = null;
      for (let i = Math.max(0, i0); i <= i1; i++) {
        const c = cols[i]; if (!c.keys) continue;
        if (c._imbTs !== c.bookTs) { c._imb = bookImb(c.keys, c.sizes, c.knb); c._imbTs = c.bookTs; }
        if (c._imb != null) { ipts.push([this.xOf(c.t + COL_MS), c._imb]); last = c._imb; }
      }
      if (ipts.length > 1) {
        const yI = v => top + 4 + (1 - v) / 2 * (H - 6);
        ctx.strokeStyle = alpha("#b07cff", 0.35); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(0, yI(0)); ctx.lineTo(L.pw, yI(0)); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = "#b07cff"; ctx.lineWidth = 1.2; ctx.beginPath(); ipts.forEach(([x, v], k) => k ? ctx.lineTo(x, yI(v)) : ctx.moveTo(x, yI(v))); ctx.stroke(); ctx.lineWidth = 1;
      }
      if (last != null) { this._imbNow = last; ctx.fillStyle = "#b07cff"; ctx.textAlign = "right"; ctx.fillText(L.pw >= 700 ? `Sổ ±0,5%: ${last >= 0 ? "mua" : "bán"} dày hơn ${Math.abs(last * 100).toFixed(0)}%` : `Sổ ${last >= 0 ? "mua" : "bán"} +${Math.abs(last * 100).toFixed(0)}%`, L.pw - 6, L.pw >= 1000 ? top + 13 : top + 26); ctx.textAlign = "left"; }
    }
    // tốc độ băng: số lệnh khớp mỗi giây; chấm sáng là lúc tốc độ vượt 3 lần mức thường (thường đi trước cú chạy)
    this._speedNow = null;
    if (this.cfg.speed && groups.size > 3) {
      const secs = bucketPx * this.msPerPx / 1000, arr = [...groups].sort((a, b) => a[0] - b[0]).map(([gx, e]) => [gx * bucketPx + bucketPx / 2, e.n / secs]);
      const rates = arr.map(a => a[1]).filter(v => v > 0).sort((a, b) => a - b), med = rates.length ? rates[rates.length >> 1] : 0, mx = rates.length ? rates[rates.length - 1] : 0;
      if (mx > 0) {
        const y = v => top + H - 1 - v / mx * (H - 18);
        ctx.strokeStyle = alpha("#39d5ff", 0.85); ctx.lineWidth = 1; ctx.beginPath(); arr.forEach(([x, v], k) => k ? ctx.lineTo(x, y(v)) : ctx.moveTo(x, y(v))); ctx.stroke();
        ctx.fillStyle = "#39d5ff"; for (const [x, v] of arr) if (med > 0 && v >= 3 * med && v >= 2) { ctx.beginPath(); ctx.arc(x, y(v), 2.5, 0, 7); ctx.fill(); }
        let n5 = 0; const tNow = Date.now(); for (let i = cols.length - 1; i >= 0 && cols[i].t > tNow - 5000; i--) n5 += cols[i].tn || 0;
        this._speedNow = { now: n5 / 5, med }; ctx.textAlign = "left";
        const sp = `Tốc độ ${(n5 / 5).toFixed(1)} lệnh/giây${med && L.pw >= 600 ? ` (thường ${med.toFixed(1)})` : ""}`, fits = nextX + ctx.measureText(sp).width < L.pw - (L.pw >= 1000 && this.cfg.imb ? 260 : 10);
        ctx.fillText(sp, fits ? nextX : 6, fits ? top + 13 : top + 26);
      }
    }
  }

  // Lưới dòng dùng chung cho các cột bên phải: cùng dòng giá với bản đồ; khi thu nhỏ thì gộp vài mức giá
  // vào một dòng để chữ không chồng lên nhau (mỗi dòng cao tối thiểu 13 điểm ảnh).
  _rowGrid() {
    const tk = this.m.tick, g = this.m.grid || tk || 1, base = this._fine ? tk : g, minPx = 13;
    const k = Math.max(1, Math.ceil(minPx / Math.max(1e-9, base * this.pxPerPrice))), step = base * k;
    return { step, rowPx: step * this.pxPerPrice, minPx };
  }
  _colFrame(c, title, L) {
    const ctx = this.ctx;
    ctx.fillStyle = "#0d141c"; ctx.fillRect(c.x, 0, c.w, L.ph);
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(c.x + 0.5, 0); ctx.lineTo(c.x + 0.5, L.ph); ctx.stroke();
    return () => {
      ctx.fillStyle = T.panel; ctx.fillRect(c.x + 1, 0, c.w - 1, 14);
      ctx.fillStyle = T.muted; ctx.font = "bold 10px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      if (Array.isArray(title)) { ctx.fillText(title[0], c.x + c.w / 4 + 1, 11); ctx.fillText(title[1], c.x + c.w * 3 / 4, 11); } else ctx.fillText(title, c.x + c.w / 2, 11);
    };
  }
  _rowBox(yc, rowPx) { return [Math.round(yc - rowPx / 2), Math.max(1, Math.round(rowPx) - (rowPx > 4 ? 1 : 0))]; }

  _columns(L, cols, i0, i1) {
    const C = L.colsL, G = this._rowGrid();
    if (C.cob) this._cob(L, C.cob, G);
    if (C.cvp) this._profile(L, C.cvp, G, this._cvpMap(cols, i0, i1), "VP VÙNG", "cvp");
    if (C.svp) this._profile(L, C.svp, G, this._svpMap(), "VP PHIÊN", "svp");
    if (C.qd) this._quoteDelta(L, C.qd, G);
    if (C.tc) this._tradeCount(L, C.tc, G, cols, i0, i1);
    if (C.liq) this._liqMap(L, C.liq);
  }

  // COB: thanh đỏ là lệnh chờ bán, xanh là lệnh chờ mua, kèm con số (hoặc % so với tổng lệnh chờ đang thấy).
  // Nửa phải (nếu bật) là sổ lệnh cộng dồn từ giá hiện tại ra xa.
  _cob(L, c, G) {
    const ctx = this.ctx, { bids, asks } = this.m.book.sorted(), { step, rowPx, minPx } = G, x0 = c.x, W = c.w, withCum = this.cfg.colCum;
    const done = this._colFrame(c, withCum ? (W > 110 ? ["LỆNH CHỜ", "CỘNG DỒN"] : ["CHỜ", "CỘNG"]) : "COB", L);
    const agg = new Map(), cum = new Map(); let maxQ = 0, maxC = 0, tot = 0;
    for (const [side, list] of [["bid", bids], ["ask", asks]]) {
      let run = 0;
      for (const [p, q] of list) {
        run += q; const y = this.yOf(p); if (y < -rowPx || y > L.ph + rowPx) { if ((side === "bid" && y > L.ph) || (side === "ask" && y < 0)) break; continue; }
        const kk = Math.round(p / step), e = agg.get(kk) || { q: 0, side }; e.q += q; tot += q; agg.set(kk, e); maxQ = Math.max(maxQ, e.q);
        cum.set(kk, { q: run, side }); maxC = Math.max(maxC, run);
      }
    }
    const half = withCum ? Math.floor(W / 2) - 2 : W - 4, xc = x0 + half + 4, font = Math.min(11, Math.max(9, rowPx - 3));
    ctx.font = `${font}px ${MONO}`; ctx.textBaseline = "middle";
    const bb = bids.length ? Math.round(bids[0][0] / step) : null, ba = asks.length ? Math.round(asks[0][0] / step) : null;
    for (const [kk, e] of agg) {
      const yc = this.yOf(kk * step), [y, h] = this._rowBox(yc, rowPx);
      if (kk === bb || kk === ba) { ctx.fillStyle = e.side === "bid" ? "rgba(31,174,91,0.22)" : "rgba(217,52,43,0.22)"; ctx.fillRect(x0 + 1, y, W - 2, h); }
      ctx.fillStyle = e.side === "bid" ? "#1fae5b" : "#d9342b"; ctx.fillRect(x0 + 2, y, Math.max(1, e.q / maxQ * (half - 2)), h);
      const cu = withCum && cum.get(kk);
      if (cu) { ctx.fillStyle = e.side === "bid" ? "rgba(31,174,91,0.55)" : "rgba(217,52,43,0.55)"; ctx.fillRect(xc, y, Math.max(1, cu.q / maxC * (half - 2)), h); }
      if (rowPx >= minPx - 0.5) {
        ctx.fillStyle = "#fff"; ctx.textAlign = "left";
        ctx.fillText(this.cfg.cobPct ? (e.q / tot * 100).toFixed(2) + "%" : fmtVol(e.q), x0 + 4, yc + 0.5);
        if (cu) ctx.fillText(fmtVol(cu.q), xc + 2, yc + 0.5);
      }
    }
    done();
  }

  // Volume Profile: khối lượng đã khớp ở từng dòng giá. Phần xanh là mua chủ động, đỏ là bán chủ động.
  // Dòng nhiều nhất (POC) viền vàng và (nếu bật) kẻ đường ngang trên bản đồ.
  _cvpMap(cols, i0, i1) {
    const tk = this.m.tick, out = new Map(); if (!tk) return out;
    for (let i = Math.max(0, i0); i <= i1; i++) { const vp = cols[i].vp; if (vp) for (const [k, e] of vp) { const o = out.get(k) || [0, 0, 0]; o[0] += e[0]; o[1] += e[1]; o[2] += e[2]; out.set(k, o); } }
    return out;
  }
  _svpMap() { return this.m.tradedAt; }
  _profile(L, c, G, map, title, kind) {
    const ctx = this.ctx, { step, rowPx, minPx } = G, tk = this.m.tick, done = this._colFrame(c, title, L);
    if (!tk || !map.size) { done(); return; }
    const bins = new Map(); let maxV = 0, poc = null;
    for (const [k, e] of map) { const p = k * tk, y = this.yOf(p); if (y < -rowPx || y > L.ph + rowPx) continue; const kk = Math.round(p / step), o = bins.get(kk) || [0, 0]; o[0] += e[0]; o[1] += e[1]; bins.set(kk, o); }
    for (const [kk, o] of bins) if (o[0] + o[1] > maxV) { maxV = o[0] + o[1]; poc = kk; }
    ctx.font = `${Math.min(10, Math.max(8, rowPx - 4))}px ${MONO}`; ctx.textBaseline = "middle";
    for (const [kk, o] of bins) {
      const v = o[0] + o[1], yc = this.yOf(kk * step), [y, h] = this._rowBox(yc, rowPx), wt = v / maxV * (c.w - 6), wb = wt * o[1] / v;
      ctx.fillStyle = "#1fae5b"; ctx.fillRect(c.x + 3, y, wb, h); ctx.fillStyle = "#d9342b"; ctx.fillRect(c.x + 3 + wb, y, wt - wb, h);
      if (kk === poc) { ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 1.5; ctx.strokeRect(c.x + 1.5, y + 0.5, c.w - 3, h); ctx.lineWidth = 1; }
      if (rowPx >= minPx - 0.5 && v >= maxV * 0.2) { ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.fillText(fmtVol(v), c.x + c.w - 3, yc + 0.5); }
    }
    if (poc != null && this.cfg.poc) (this._pocs || (this._pocs = [])).push({ p: poc * step, kind });
    done();
  }

  // +/-: lệnh chờ được thêm (xanh, dương) hay rút (đỏ, âm) ở mỗi dòng giá kể từ lần giá tốt nhất đổi gần nhất
  _quoteDelta(L, c, G) {
    const ctx = this.ctx, { step, rowPx, minPx } = G, tk = this.m.tick, done = this._colFrame(c, "+/−", L);
    if (!tk) { done(); return; }
    const bins = new Map(); let maxA = 0;
    for (const [k, d] of this.m.quoteDelta) { const p = k * tk, y = this.yOf(p); if (y < -rowPx || y > L.ph + rowPx) continue; const kk = Math.round(p / step); bins.set(kk, (bins.get(kk) || 0) + d); }
    for (const d of bins.values()) maxA = Math.max(maxA, Math.abs(d));
    ctx.font = `${Math.min(10, Math.max(8, rowPx - 4))}px ${MONO}`; ctx.textBaseline = "middle"; ctx.textAlign = "right";
    for (const [kk, d] of bins) {
      if (Math.abs(d) < maxA * 0.02) continue;
      const yc = this.yOf(kk * step), [y, h] = this._rowBox(yc, rowPx);
      ctx.fillStyle = d > 0 ? "rgba(31,174,91,0.45)" : "rgba(217,52,43,0.5)"; ctx.fillRect(c.x + 2, y, Math.abs(d) / maxA * (c.w - 4), h);
      if (rowPx >= minPx - 0.5) { ctx.fillStyle = d > 0 ? "#7ee2a8" : "#ff8a80"; ctx.fillText((d > 0 ? "+" : "") + fmtVol(d), c.x + c.w - 3, yc + 0.5); }
    }
    done();
  }

  // Đếm số lệnh khớp ở mỗi dòng giá trong vùng thời gian đang xem
  _tradeCount(L, c, G, cols, i0, i1) {
    const ctx = this.ctx, { step, rowPx, minPx } = G, tk = this.m.tick, done = this._colFrame(c, "SỐ LỆNH", L), map = this._cvpMap(cols, i0, i1);
    if (!tk || !map.size) { done(); return; }
    const bins = new Map(); let maxN = 0;
    for (const [k, e] of map) { const p = k * tk, kk = Math.round(p / step); bins.set(kk, (bins.get(kk) || 0) + e[2]); }
    for (const n of bins.values()) maxN = Math.max(maxN, n);
    ctx.font = `${Math.min(10, Math.max(8, rowPx - 4))}px ${MONO}`; ctx.textBaseline = "middle"; ctx.textAlign = "right";
    for (const [kk, n] of bins) {
      const yc = this.yOf(kk * step); if (yc < -rowPx || yc > L.ph + rowPx) continue;
      const [y, h] = this._rowBox(yc, rowPx);
      ctx.fillStyle = "rgba(120,160,220,0.45)"; ctx.fillRect(c.x + 2, y, n / maxN * (c.w - 4), h);
      if (rowPx >= minPx - 0.5) { ctx.fillStyle = "#fff"; ctx.fillText(String(n), c.x + c.w - 3, yc + 0.5); }
    }
    done();
  }

  // bản đồ thanh lý ước tính từ open interest
  _liqMap(L, col) {
    const ctx = this.ctx, m = this.liqMap, x0 = col.x, LW = col.w;
    ctx.fillStyle = T.panel; ctx.fillRect(x0, 0, LW, L.ph);
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, L.ph); ctx.stroke();
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
    ctx.fillStyle = T.muted; ctx.font = "10px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    if (LW > 50) ctx.fillText("Thanh lý ƯT", x0 + LW / 2, L.ph - 4);
  }

  _axes(L) {
    const ctx = this.ctx, x0 = L.axisX, dec = decimalsFor(this.m.tick || this.m.grid), AXIS_W = L.axisW;
    ctx.fillStyle = T.bg; ctx.fillRect(x0, 0, AXIS_W, L.h); ctx.fillRect(0, L.timeTop, L.w, TIME_H);
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, L.h); ctx.moveTo(0, L.timeTop + 0.5); ctx.lineTo(L.w, L.timeTop + 0.5); ctx.stroke();
    const range = L.ph / this.pxPerPrice, raw = range / Math.max(3, L.ph / 50), e = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map(k => k * e).find(s => s >= raw);
    ctx.font = `11px ${MONO}`; ctx.fillStyle = T.muted; ctx.textAlign = "left";
    for (let p = Math.ceil(this.pAt(L.ph) / st) * st; p <= this.pAt(0); p += st) {
      const y = this.yOf(p); ctx.fillText(p.toFixed(Math.max(dec, decimalsFor(st))), x0 + 6, y + 4);
      ctx.fillStyle = alpha(T.text, 0.05); ctx.fillRect(0, Math.round(y), L.pw, 1); ctx.fillStyle = T.muted;
    }
    for (const tg of this._axisTags || []) { ctx.fillStyle = alpha(tg.col, 0.85); ctx.fillRect(x0 + 1, tg.y - 8, AXIS_W - 1, 16); ctx.fillStyle = "#fff"; ctx.fillText(tg.txt, x0 + 6, tg.y + 4); }
    const last = this.m.last;
    if (last) {
      const y = this.yOf(last.p), col = last.side === "buy" ? T.up : T.down;
      ctx.fillStyle = col; ctx.fillRect(x0 + 1, y - 9, AXIS_W - 1, 18); ctx.fillStyle = "#fff"; ctx.fillText(last.p.toFixed(dec), x0 + 6, y + 4);
    }
    // trục thời gian
    const spanMs = L.pw * this.msPerPx, steps = [1e3, 5e3, 10e3, 15e3, 30e3, 60e3, 120e3, 300e3, 600e3, 900e3, 1800e3, 3600e3];
    const tStep = steps.find(s => s / this.msPerPx >= 90) || 3600e3;
    ctx.fillStyle = T.muted; ctx.textAlign = "center";
    for (let t = Math.ceil(this.tAt(0) / tStep) * tStep; t < this.tAt(L.pw); t += tStep) {
      const x = this.xOf(t); ctx.fillText(fmtTime(t), x, L.timeTop + 14);
      ctx.fillStyle = alpha(T.text, 0.05); ctx.fillRect(Math.round(x), 0, 1, L.ph); ctx.fillStyle = T.muted;
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
    if (c && this._fine && c.fk) { const k = Math.round(p / this.m.tick); for (let j = 0; j < c.fk.length; j++) if (c.fk[j] === k) { size = c.fq[j]; break; } }
    else if (c && this.m.grid) { const k = Math.round(p / this.m.grid); for (let j = 0; j < c.keys.length; j++) if (c.keys[j] === k) { size = c.sizes[j]; break; } }
    ctx.fillStyle = "#3a4558"; ctx.fillRect(L.axisX + 1, m.y - 9, AXIS_W - 1, 18);
    ctx.fillStyle = "#fff"; ctx.font = `11px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(p.toFixed(dec), L.axisX + 6, m.y + 4);
    ctx.fillStyle = "#3a4558"; ctx.fillRect(m.x - 34, L.timeTop + 1, 68, TIME_H - 2); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(fmtTime(t), m.x, L.timeTop + 14);
    if (size !== null) { const txt = `Chờ: ${fmtVol(size)}`; ctx.fillStyle = alpha(T.bg, 0.85); ctx.fillRect(m.x + 10, m.y + 8, ctx.measureText(txt).width + 10, 18); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(txt, m.x + 15, m.y + 21); }
  }

  _legend() {
    const ctx = this.ctx, m = this.m, dec = decimalsFor(m.tick || m.grid);
    const txt = `${m.symbol} · ${this.opts.exchangeName ? this.opts.exchangeName() : m.exchange} · tầng giá ${m.grid ? m.grid.toFixed(decimalsFor(m.grid)) : "-"}${m.last ? " · giá " + m.last.p.toFixed(dec) : ""}${this.follow ? "" : " · đang xem lại (bấm đúp để theo dõi)"}`;
    ctx.font = "12px 'IBM Plex Mono', Consolas, monospace"; ctx.fillStyle = alpha(T.bg, 0.8); ctx.fillRect(4, 4, ctx.measureText(txt).width + 12, 20);
    ctx.fillStyle = T.text; ctx.textAlign = "left"; ctx.fillText(txt, 10, 18);
    // lệch sổ lệnh (mua so với bán trong vùng đang xem) và lệch khối lượng khớp (mua so với bán trên màn hình)
    const L = this._L; if (!L || L.pw < 300) return; const im = this._imb(L); if (!im) return;
    const box = (x, label, v) => {
      ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; ctx.fillStyle = alpha(T.bg, 0.8); ctx.fillRect(x, 28, 132, 18);
      ctx.fillStyle = T.muted; ctx.textAlign = "left"; ctx.fillText(label, x + 6, 41);
      const bx = x + 62, bw = 64; ctx.fillStyle = "#d9342b"; ctx.fillRect(bx, 33, bw, 8); ctx.fillStyle = "#1fae5b"; ctx.fillRect(bx, 33, bw * (0.5 + v / 2), 8);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `bold 9px ${MONO}`; ctx.fillText(`${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`, bx + bw / 2, 41);
    };
    if (im.book != null) box(4, "Sổ lệnh", im.book);
    if (im.vol != null) box(140, "Khớp", im.vol);
  }

  _imb(L) {
    if (!L) return null;
    const { bids, asks } = this.m.book.sorted(), lo = this.pAt(L.ph), hi = this.pAt(0);
    let b = 0, a = 0; for (const [p, q] of bids) { if (p < lo) break; if (p <= hi) b += q; } for (const [p, q] of asks) { if (p > hi) break; if (p >= lo) a += q; }
    let bv = 0, sv = 0; const cols = this.m.cols, t0 = this.tAt(0);
    for (let i = cols.length - 1; i >= 0 && cols[i].t >= t0; i--) { bv += cols[i].bv; sv += cols[i].sv; }
    return { book: a + b ? (b - a) / (a + b) : null, vol: bv + sv ? (bv - sv) / (bv + sv) : null };
  }

  // Chú thích cho đối tượng dưới con trỏ
  hitTest(x, y) {
    const L = this._L; if (!L || this.pCenter === null) return null;
    const dec = decimalsFor(this.m.tick || this.m.grid);
    const inCol = id => { const c = L.colsL[id]; return c && x >= c.x && x < c.x + c.w && y < L.ph; };
    if (inCol("cvp")) return "Volume Profile vùng đang xem (CVP): khối lượng đã khớp ở từng dòng giá trong khoảng thời gian trên màn hình. Xanh là mua chủ động, đỏ là bán chủ động. Viền vàng là POC, giá khớp nhiều nhất.";
    if (inCol("svp")) return "Volume Profile phiên (SVP): khối lượng đã khớp ở từng dòng giá kể từ lúc mở trang. Viền vàng là POC của phiên.";
    if (inCol("qd")) return "Cột +/−: lệnh chờ được thêm vào (xanh, số dương) hay bị rút ra hoặc bị khớp (đỏ, số âm) ở mỗi dòng giá, tính từ lần gần nhất giá mua hoặc bán tốt nhất thay đổi.";
    if (inCol("tc")) return "Số lệnh khớp ở mỗi dòng giá trong khoảng thời gian đang xem. Nhiều lệnh nhỏ dồn vào một giá thường là thuật toán hoặc nhiều người cùng đánh.";
    const cob = L.colsL.cob;
    if (cob && inCol("cob")) return x < cob.x + cob.w / 2 || !this.cfg.colCum ? "Sổ lệnh hiện tại (COB), cùng dòng giá với bản đồ: thanh đỏ là lệnh chờ bán, xanh là lệnh chờ mua, con số là khối lượng. Dòng tô nền là giá mua / bán tốt nhất. Khi thu nhỏ, vài mức giá được gộp chung một dòng." : "Sổ lệnh cộng dồn: tổng lệnh chờ từ giá hiện tại tới mức giá đó. Cho biết giá phải ăn hết bao nhiêu để đi tới đó.";
    if (this.show.ice && this._iceVis) for (const v of this._iceVis) if (Math.hypot(x - v.x, y - v.y) <= v.r + 3) { const e = v.e; return `Nghi lệnh băng chìm (iceberg) phía ${e.side === "bid" ? "CHỜ MUA" : "CHỜ BÁN"} tại ${e.price.toFixed(dec)}: đã khớp ${fmtVol(e.filled)} qua ${e.n} lệnh trong ${((e.t1 - e.t) / 1000).toFixed(0)} giây, trong khi sổ lệnh chỉ hiện tối đa ${fmtVol(e.disp)}. Phần ẩn hoặc nạp lại ước tính ${fmtVol(e.hidden)}. ${e.status === "live" ? "Đang còn bị khớp." : e.status === "held" ? "Kết quả: GIỮ được giá (nét liền)." : "Kết quả: bị XUYÊN THỦNG (nét đứt)."}`; }
    if (this._bub) for (const b of this._bub) if (Math.hypot(x - b.x, y - b.y) <= b.r + 2) { const v = b.bv + b.sv; return `Đã khớp ${fmtVol(v)} quanh giá ${b.p.toFixed(dec)}: mua chủ động ${fmtVol(b.bv)} (${(b.bv / v * 100).toFixed(0)}%, phần xanh), bán chủ động ${fmtVol(b.sv)} (${(b.sv / v * 100).toFixed(0)}%, phần đỏ). Thể tích bong bóng tỷ lệ với khối lượng.`; }
    if (inCol("liq")) return `Bản đồ thanh lý ước tính quanh ${this.pAt(y).toFixed(dec)}: hồng là vùng long có thể bị thanh lý, vàng là vùng short. Ước tính từ open interest, không phải dữ liệu thật.`;
    if (y >= 28 && y <= 46 && x < 272) return "Lệch sổ lệnh: lệnh chờ mua trừ lệnh chờ bán, chia tổng, trong vùng giá đang xem. Lệch khớp: mua chủ động trừ bán chủ động trong khoảng thời gian đang xem. Dương (xanh nhiều) là phe mua lấn át.";
    if (y > L.paneTop && y < L.timeTop && x < L.pw) return `Cột xanh: khối lượng mua chủ động, cột đỏ: bán chủ động theo thời gian. Đường vàng là CVD (mua trừ bán cộng dồn) trong vùng đang xem.${this.cfg.imb ? " Đường tím là mất cân bằng sổ lệnh trong ±0,5% quanh giá: trên vạch giữa là lệnh chờ mua dày hơn chờ bán, dưới là ngược lại. CVD lên mà sổ nghiêng về bán là người mua đang ăn vào tường bán; CVD xuống mà sổ nghiêng về mua là có bên đang đỡ giá." : ""}${this.cfg.speed ? " Đường xanh lơ là tốc độ băng (số lệnh khớp mỗi giây); chấm sáng là lúc tốc độ vượt 3 lần mức thường, hay báo trước một cú chạy hoặc lúc ra tin." : ""}`;
    if (x > L.pw || y > L.ph) return null;
    const cols = this.m.cols, t = this.tAt(x), i0 = lowerBound(cols, t - 4 * this.msPerPx - COL_MS), i1 = lowerBound(cols, t + 4 * this.msPerPx);
    for (let i = Math.max(0, i0); i < Math.min(cols.length, i1 + 1); i++) {
      for (const l of cols[i].liq || []) if (Math.abs(this.yOf(l.p) - y) < 10) return `Lệnh thanh lý thật: ${l.side === "long" ? "LONG bị thanh lý (bị bán cưỡng bức)" : "SHORT bị thanh lý (bị mua cưỡng bức)"} ${fmtVol(l.q)} tại ${l.p.toFixed(dec)}, giá trị ${fmtUsd(l.p * l.q)}, lúc ${fmtTime(l.t)}.`;
      for (const b of cols[i].big || []) if (Math.abs(this.yOf(b.p) - y) < 10) return `Lệnh lớn: ${b.side === "buy" ? "MUA" : "BÁN"} chủ động ${fmtVol(b.q)} tại ${b.p.toFixed(dec)} (${fmtUsd(b.p * b.q)}), thuộc nhóm 0,5% lệnh to nhất kể từ lúc mở trang.`;
    }
    if (this.show.levels) for (const lv of this.levels) if (Math.abs(y - this.yOf(lv.price)) < 4) return `${lv.kind === "support" ? "Hỗ trợ" : "Kháng cự"} ${lv.price.toFixed(dec)} (khung nến đang chọn): chạm ${lv.touches} lần, bị test ${lv.tests} lần, độ mạnh ${Math.round(lv.strength)}/100.`;
    if (this.show.levels) for (const mk of this.marks || []) if (Math.abs(y - this.yOf(mk.price)) < 4) return `${mk.label}: ${mk.price.toFixed(dec)} (theo giờ UTC, tính từ nến đang có). Giá hay phản ứng ở các mốc này.`;
    if (this.show.confl) { const c = conflTip(this.confl, y, p => this.yOf(p), dec); if (c) return c; }
    if (this.show.zones) for (const z of this.zones) if (y >= this.yOf(z.high) && y <= this.yOf(z.low)) return `Vùng khối lượng bất thường ${z.low.toFixed(dec)} – ${z.high.toFixed(dec)} (${z.z.toFixed(1)}σ), phe ${z.side === "buy" ? "mua" : "bán"} chủ động chiếm ưu thế, chưa bị xuyên qua.`;
    return "Màu nền là lượng lệnh chờ tại mức giá đó theo thời gian: xanh đậm là mỏng, xanh nhạt rồi vàng, cam, đỏ là càng dày (đỏ là tường dày nhất). Bong bóng là khối lượng đã khớp.";
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
    // hai ngón: chụm/mở ngang để phóng thời gian, dọc để phóng giá
    const span = e => [Math.abs(e.touches[0].clientX - e.touches[1].clientX), Math.abs(e.touches[0].clientY - e.touches[1].clientY)];
    cv.addEventListener("touchstart", e => {
      if (e.touches.length >= 2) { const [dx, dy] = span(e); touch = { pinch: true, dx, dy, ms: this.msPerPx, pp: this.pxPerPrice }; return; }
      const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, tEnd: this.tEnd, pc: this.pCenter };
    }, { passive: true });
    cv.addEventListener("touchmove", e => {
      if (!touch) return; e.preventDefault();
      if (touch.pinch) {
        if (e.touches.length < 2) return; const [dx, dy] = span(e);
        if (touch.dx > 40 && dx > 10) this.msPerPx = Math.min(20000, Math.max(15, touch.ms * touch.dx / dx));
        if (touch.dy > 40 && dy > 10) this.pxPerPrice = touch.pp * dy / touch.dy;
        this.dirty = true; return;
      }
      const t = e.touches[0];
      this.tEnd = touch.tEnd - (t.clientX - touch.x) * this.msPerPx; this.pCenter = touch.pc + (t.clientY - touch.y) / this.pxPerPrice;
      this.follow = false; this.dirty = true;
    }, { passive: false });
    cv.addEventListener("touchend", e => { touch = e.touches.length ? touch : null; });
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
