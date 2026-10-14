// Lai Long Web: bản đồ nhiệt thanh khoản kiểu Bookmap.
//
// Trục ngang là thời gian, trục dọc là giá. Màu ở mỗi điểm là khối lượng lệnh chờ tại mức giá đó
// vào thời điểm đó: xanh đậm = mỏng, vàng/cam/đỏ = dày (tường thanh khoản).
// Bong bóng là lệnh khớp (xanh lá: mua chủ động, đỏ: bán chủ động), kim cương là lệnh thanh lý.

import { COL_MS } from "./market.js?v=202610141828";
import { fmtVol, fmtUsd, decimalsFor, fmtTime, MONO, fitCanvas } from "./util.js?v=202610141828";
import { T, alpha } from "./theme.js?v=202610141828";

const AXIS_W = 72, BOOK_W = 150, LIQ_W = 64, TIME_H = 20, PANE_H = 74;

// bảng màu kiểu Bookmap: nền xanh đen -> xanh thép -> xanh nhạt -> vàng -> cam -> đỏ (tường dày nhất)
const STOPS = [[0, 13, 30, 46], [0.18, 16, 52, 84], [0.36, 22, 104, 160], [0.5, 60, 160, 220], [0.6, 190, 225, 238], [0.7, 246, 238, 140], [0.84, 248, 150, 30], [1, 228, 36, 27]];
export const HEAT_BG = "#0a1520";
const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255; let j = 0; while (j < STOPS.length - 2 && x > STOPS[j + 1][0]) j++;
    const a = STOPS[j], b = STOPS[j + 1], f = (x - a[0]) / (b[0] - a[0]);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
  }
  return lut;
})();

// Đổi khối lượng lệnh chờ thành chỉ số màu 0..255, hoặc -1 (để nền tối) nếu quá mỏng.
// Dưới 1% mức tham chiếu là nền; còn lại theo căn bậc ~0,6 nên mức mỏng vẫn thấy màu xanh tối, tường dày lên vàng, cam, đỏ.
export function heatIndex(q, ref, contrast = 1) {
  if (!(q > 0)) return -1;
  const x = q / ref * contrast;
  if (x < 0.01) return -1;
  return Math.min(255, (Math.pow(Math.min(1, x), 0.6) * 235 + 20) | 0);
}
export { LUT as HEAT_LUT };

// Vẽ một bong bóng 3D: quả cầu chia hai phần, xanh = mua chủ động, đỏ = bán chủ động (buyFrac = tỷ lệ mua).
// Đổ bóng bằng gradient toả tròn lệch lên trên bên trái cho có khối.
export function drawBubble(ctx, x, y, r, buyFrac) {
  const g = (c0, c1, c2) => { const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(0.55, c1); gr.addColorStop(1, c2); return gr; };
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g("#9df5bf", "#2fbf6a", "#0f5c31"); ctx.fill();
  const sell = 1 - buyFrac;
  if (sell > 0.005) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + sell * Math.PI * 2); ctx.closePath();
    ctx.fillStyle = g("#ffb3a6", "#e0473a", "#6e1610"); ctx.fill();
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
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, L.w, L.h);
    if (!this._initScale()) {
      ctx.fillStyle = T.muted; ctx.font = "14px Segoe UI, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Đang chờ dữ liệu sổ lệnh...", L.pw / 2, L.ph / 2); return;
    }
    const cols = this.m.cols, t0 = this.tAt(0), t1 = this.tAt(L.pw);
    let i0 = lowerBound(cols, t0 - COL_MS), i1 = Math.min(cols.length - 1, lowerBound(cols, t1));
    this._heat(cols, i0, i1, L);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.pw, L.ph); ctx.clip();
    if (this.show.zones) this._zones(L);
    this._bbo(cols, i0, i1, L);
    this._axisTags = [];
    if (this.show.levels) { this._levels(L); this._marks(L); }
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
    const build = c => {
      const ks = fine && c.fk ? c.fk : c.keys, qs = fine && c.fk ? c.fq : c.sizes, st = fine && c.fk ? tk : g;
      row.fill(0); let any = false;
      for (let j = 0; j < ks.length; j++) {
        const yc = this.yOf(ks[j] * st);
        let ya = Math.floor(yc - half), yb = Math.ceil(yc + half) - gap; if (yb <= 0 || ya >= H) continue;
        ya = Math.max(0, ya); yb = Math.min(H, yb); any = true;
        const q = qs[j]; for (let y = ya; y < yb; y++) row[y] = gpx < 1 ? row[y] + q : Math.max(row[y], q);
      }
      return any;
    };
    // lượt 1: lấy mẫu các điểm ảnh để tìm mức tham chiếu (phân vị 99%)
    const sample = [], stepI = Math.max(1, Math.floor((i1 - i0 + 1) / 80));
    for (let i = Math.max(0, i0); i <= i1; i += stepI) {
      const c = carry(cols, i); if (!c || !build(c)) continue;
      for (let y = 0; y < H; y += 2) if (row[y] > 0) sample.push(row[y]);
    }
    sample.sort((a, b) => a - b);
    const ref = (sample.length ? sample[Math.floor(sample.length * 0.99)] : 1) || 1;
    // lượt 2: tô màu
    let x = Math.max(0, Math.floor(this.xOf(cols[Math.max(0, i0)].t))), lastC = null;
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = carry(cols, i), xa = Math.max(0, Math.floor(this.xOf(cols[i].t)));
      const xb = Math.min(W, Math.floor(this.xOf(cols[i].t + COL_MS)));
      if (!c || xb <= xa || xb <= x) continue;
      if (c !== lastC) { build(c); lastC = c; }
      for (let y = 0; y < H; y++) {
        const li = heatIndex(row[y], ref, this.contrast); if (li < 0) continue;
        const r = LUT[li * 3], gg = LUT[li * 3 + 1], b = LUT[li * 3 + 2];
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
  // phần từ bây giờ tới mép phải là nét đứt: giá mua / bán đang đứng
  _bbo(cols, i0, i1, L) {
    const ctx = this.ctx, xNow = this.xOf(Date.now());
    for (const [key, col] of [["ba", "#ff3b30"], ["bb", "#22d36b"]]) {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = "miter"; ctx.beginPath(); let on = false, py = 0;
      for (let i = Math.max(0, i0); i <= i1; i++) {
        const c = cols[i]; if (c[key] == null) { on = false; continue; }
        const x = this.xOf(c.t), y = Math.round(this.yOf(c[key])) + 0.5;
        if (!on) { ctx.moveTo(x, y); on = true; } else if (y !== py) { ctx.lineTo(x, py); ctx.lineTo(x, y); }
        py = y;
      }
      if (on) { ctx.lineTo(xNow, py); ctx.stroke(); ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(xNow, py); ctx.lineTo(L.pw, py); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.lineWidth = 1;
  }

  // Bong bóng 3D: mỗi nhóm thời gian một quả, đặt tại giá trung bình đã khớp. Thể tích quả cầu tỷ lệ với
  // khối lượng (bán kính theo căn bậc ba). Phần đỏ / xanh là tỷ lệ bán chủ động / mua chủ động.
  _bubbles(cols, i0, i1, L) {
    const ctx = this.ctx, bucketPx = Math.max(6, COL_MS / this.msPerPx), groups = new Map();
    for (let i = Math.max(0, i0); i <= i1; i++) {
      const c = cols[i]; if (!c.bv && !c.sv) continue;
      const gx = Math.floor(this.xOf(c.t) / bucketPx), e = groups.get(gx) || { bv: 0, sv: 0, pv: 0, x: 0, big: [] };
      e.bv += c.bv; e.sv += c.sv; e.pv += c.bpv + c.spv; e.x = this.xOf(c.t + COL_MS / 2);
      if (c.big) e.big.push(...c.big);
      groups.set(gx, e);
    }
    let maxV = 0; for (const e of groups.values()) maxV = Math.max(maxV, e.bv + e.sv);
    if (!maxV) return;
    const rMax = Math.min(30, L.ph * 0.06, Math.max(9, 34 * Math.sqrt(120 / this.msPerPx) / 2));
    this._bub = [];
    for (const e of groups.values()) {
      const v = e.bv + e.sv;
      if (this.show.bigOnly && v < this.m.bigTrade) continue;
      const r = Math.max(2, Math.cbrt(v / maxV) * rMax), y = this.yOf(e.pv / v);
      drawBubble(ctx, e.x, y, r, e.bv / v);
      this._bub.push({ x: e.x, y, r, bv: e.bv, sv: e.sv, p: e.pv / v });
      for (const t of e.big) if (t.q >= this.m.bigTrade * 2) { ctx.fillStyle = "#fff"; ctx.font = `bold 10px ${MONO}`; ctx.textAlign = "center"; ctx.fillText(fmtVol(t.q), e.x, y - r - 4); break; }
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
      const t = `${mk.label} ${mk.price.toFixed(dec)}`; ctx.font = "10px Segoe UI, sans-serif"; const tw = ctx.measureText(t).width + 8;
      ctx.fillStyle = alpha("#000000", 0.6); ctx.fillRect(L.pw - tw - 2, y - 13, tw, 12); ctx.fillStyle = col; ctx.textAlign = "left"; ctx.fillText(t, L.pw - tw + 2, y - 4);
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
    const ctx = this.ctx, dec = decimalsFor(this.m.tick || this.m.grid);
    const line = (p, color, text, dash) => {
      const y = Math.round(this.yOf(p)) + 0.5; if (y < 0 || y > L.ph) return;
      ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "11px Segoe UI, sans-serif"; const tw = ctx.measureText(text).width + 10;
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
      const c = cols[i], gx = Math.floor(this.xOf(c.t) / bucketPx), e = groups.get(gx) || { b: 0, s: 0 };
      e.b += c.bv; e.s += c.sv; groups.set(gx, e);
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
    ctx.fillStyle = T.muted; ctx.font = "11px Segoe UI, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Mua / bán chủ động", 6, top + 13); ctx.fillStyle = "#f5c542"; ctx.fillText(`CVD ${cum >= 0 ? "+" : ""}${fmtVol(cum)}`, 130, top + 13);
  }

  // Cột sổ lệnh hiện tại (COB) bên phải, cùng dòng giá với bản đồ nhiệt: thanh đỏ là lệnh chờ bán, xanh là
  // lệnh chờ mua, kèm con số. Khi thu nhỏ, nhiều mức giá được gộp để chữ không chồng lên nhau.
  // Nửa phải là sổ lệnh cộng dồn tính từ giá hiện tại ra xa.
  _book(L) {
    const ctx = this.ctx, { bids, asks } = this.m.book.sorted(), tk = this.m.tick, g = this.m.grid || tk || 1;
    const base = this._fine ? tk : g, minPx = 13, k = Math.max(1, Math.ceil(minPx / Math.max(1e-9, base * this.pxPerPrice)));
    const step = base * k, rowPx = step * this.pxPerPrice, x0 = L.bookX, W = L.bookW;
    ctx.fillStyle = "#0d141c"; ctx.fillRect(x0, 0, W, L.ph);
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, L.ph); ctx.stroke();
    const agg = new Map(), cum = new Map(); let maxQ = 0, maxC = 0;
    for (const [side, list] of [["bid", bids], ["ask", asks]]) {
      let run = 0;
      for (const [p, q] of list) {
        run += q; const y = this.yOf(p); if (y < -rowPx || y > L.ph + rowPx) { if ((side === "bid" && y > L.ph) || (side === "ask" && y < 0)) break; continue; }
        const kk = Math.round(p / step), e = agg.get(kk) || { q: 0, side }; e.q += q; agg.set(kk, e); maxQ = Math.max(maxQ, e.q);
        cum.set(kk, { q: run, side }); maxC = Math.max(maxC, run);
      }
    }
    const half = Math.floor(W / 2) - 2, xc = x0 + half + 4, font = Math.min(11, Math.max(9, rowPx - 3));
    ctx.font = `${font}px ${MONO}`; ctx.textBaseline = "middle";
    const bb = bids.length ? Math.round(bids[0][0] / step) : null, ba = asks.length ? Math.round(asks[0][0] / step) : null;
    for (const [kk, e] of agg) {
      const yc = this.yOf(kk * step), y = Math.round(yc - rowPx / 2), h = Math.max(1, Math.round(rowPx) - (rowPx > 4 ? 1 : 0));
      const col = e.side === "bid" ? "#1fae5b" : "#d9342b", wpx = Math.max(1, e.q / maxQ * (half - 2));
      if (kk === bb || kk === ba) { ctx.fillStyle = e.side === "bid" ? "rgba(31,174,91,0.22)" : "rgba(217,52,43,0.22)"; ctx.fillRect(x0 + 1, y, W - 2, h); }
      ctx.fillStyle = col; ctx.fillRect(x0 + 2, y, wpx, h);
      const c = cum.get(kk);
      if (c) { ctx.fillStyle = e.side === "bid" ? "rgba(31,174,91,0.55)" : "rgba(217,52,43,0.55)"; ctx.fillRect(xc, y, Math.max(1, c.q / maxC * (half - 2)), h); }
      if (rowPx >= minPx - 0.5) {
        ctx.fillStyle = "#fff"; ctx.textAlign = "left";
        ctx.fillText(fmtVol(e.q), x0 + 4, yc + 0.5);
        if (c) ctx.fillText(fmtVol(c.q), xc + 2, yc + 0.5);
      }
    }
    ctx.fillStyle = T.panel; ctx.fillRect(x0 + 1, 0, W - 1, 14);
    ctx.fillStyle = T.muted; ctx.font = "bold 10px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(W > 110 ? "LỆNH CHỜ" : "CHỜ", x0 + half / 2 + 2, 11); ctx.fillText(W > 110 ? "CỘNG DỒN" : "CỘNG", xc + half / 2, 11);
  }

  // bản đồ thanh lý ước tính từ open interest
  _liqMap(L) {
    const ctx = this.ctx, m = this.liqMap, x0 = L.liqX, LW = L.liqW;
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
    ctx.fillStyle = T.muted; ctx.font = "10px Segoe UI, sans-serif"; ctx.textAlign = "center";
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
    ctx.font = "12px Segoe UI, sans-serif"; ctx.fillStyle = alpha(T.bg, 0.8); ctx.fillRect(4, 4, ctx.measureText(txt).width + 12, 20);
    ctx.fillStyle = T.text; ctx.textAlign = "left"; ctx.fillText(txt, 10, 18);
    // lệch sổ lệnh (mua so với bán trong vùng đang xem) và lệch khối lượng khớp (mua so với bán trên màn hình)
    const L = this._L; if (!L || L.pw < 300) return; const im = this._imb(L); if (!im) return;
    const box = (x, label, v) => {
      ctx.font = "11px Segoe UI, sans-serif"; ctx.fillStyle = alpha(T.bg, 0.8); ctx.fillRect(x, 28, 132, 18);
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
    if (x > L.bookX && x < L.bookX + L.bookW && y < L.ph) return x < L.bookX + L.bookW / 2 ? "Sổ lệnh hiện tại (COB), cùng dòng giá với bản đồ: thanh đỏ là lệnh chờ bán, xanh là lệnh chờ mua, con số là khối lượng. Dòng tô nền là giá mua / bán tốt nhất. Khi thu nhỏ, vài mức giá được gộp chung một dòng." : "Sổ lệnh cộng dồn: tổng lệnh chờ từ giá hiện tại tới mức giá đó. Cho biết giá phải ăn hết bao nhiêu để đi tới đó.";
    if (this._bub) for (const b of this._bub) if (Math.hypot(x - b.x, y - b.y) <= b.r + 2) { const v = b.bv + b.sv; return `Đã khớp ${fmtVol(v)} quanh giá ${b.p.toFixed(dec)}: mua chủ động ${fmtVol(b.bv)} (${(b.bv / v * 100).toFixed(0)}%, phần xanh), bán chủ động ${fmtVol(b.sv)} (${(b.sv / v * 100).toFixed(0)}%, phần đỏ). Thể tích bong bóng tỷ lệ với khối lượng.`; }
    if (this.show.liqMap && this.liqMap && x > L.liqX && x < L.axisX && y < L.ph) return `Bản đồ thanh lý ước tính quanh ${this.pAt(y).toFixed(dec)}: hồng là vùng long có thể bị thanh lý, vàng là vùng short. Ước tính từ open interest, không phải dữ liệu thật.`;
    if (y >= 28 && y <= 46 && x < 272) return "Lệch sổ lệnh: lệnh chờ mua trừ lệnh chờ bán, chia tổng, trong vùng giá đang xem. Lệch khớp: mua chủ động trừ bán chủ động trong khoảng thời gian đang xem. Dương (xanh nhiều) là phe mua lấn át.";
    if (y > L.paneTop && y < L.timeTop && x < L.pw) return "Cột xanh: khối lượng mua chủ động, cột đỏ: bán chủ động theo thời gian. Đường vàng là CVD (mua trừ bán cộng dồn) trong vùng đang xem.";
    if (x > L.pw || y > L.ph) return null;
    const cols = this.m.cols, t = this.tAt(x), i0 = lowerBound(cols, t - 4 * this.msPerPx - COL_MS), i1 = lowerBound(cols, t + 4 * this.msPerPx);
    for (let i = Math.max(0, i0); i < Math.min(cols.length, i1 + 1); i++) {
      for (const l of cols[i].liq || []) if (Math.abs(this.yOf(l.p) - y) < 10) return `Lệnh thanh lý thật: ${l.side === "long" ? "LONG bị thanh lý (bị bán cưỡng bức)" : "SHORT bị thanh lý (bị mua cưỡng bức)"} ${fmtVol(l.q)} tại ${l.p.toFixed(dec)}, giá trị ${fmtUsd(l.p * l.q)}, lúc ${fmtTime(l.t)}.`;
      for (const b of cols[i].big || []) if (Math.abs(this.yOf(b.p) - y) < 10) return `Lệnh lớn: ${b.side === "buy" ? "MUA" : "BÁN"} chủ động ${fmtVol(b.q)} tại ${b.p.toFixed(dec)} (${fmtUsd(b.p * b.q)}), thuộc nhóm 0,5% lệnh to nhất kể từ lúc mở trang.`;
    }
    if (this.show.levels) for (const lv of this.levels) if (Math.abs(y - this.yOf(lv.price)) < 4) return `${lv.kind === "support" ? "Hỗ trợ" : "Kháng cự"} ${lv.price.toFixed(dec)} (khung nến đang chọn): chạm ${lv.touches} lần, bị test ${lv.tests} lần, độ mạnh ${Math.round(lv.strength)}/100.`;
    if (this.show.levels) for (const mk of this.marks || []) if (Math.abs(y - this.yOf(mk.price)) < 4) return `${mk.label}: ${mk.price.toFixed(dec)} (theo giờ UTC, tính từ nến đang có). Giá hay phản ứng ở các mốc này.`;
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
