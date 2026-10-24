// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: biểu đồ nến / footprint (box chart) kèm delta, CVD và open interest.
//
// Mỗi nến: {t, o, h, l, c, v, d (delta), fp?: Map(chỉ số tầng giá -> [KL bán chủ động, KL mua chủ động]),
//           liqL, liqS (khối lượng long/short bị thanh lý), oi}
// Không có chỉ báo kỹ thuật truyền thống: chỉ có dữ liệu dòng lệnh và các mức giá tính ra từ dữ liệu.

import { fmtVol, fmtUsd, fmtTime, decimalsFor, pad2, MONO, fitCanvas } from "./util.js?v=202610240622";
import { cvd as cvdOf } from "./analytics.js?v=202610240622";
import { cvdCandles, rangeProfile, daySessions } from "./orderflow.js?v=202610240622";
import { GROUPS } from "./flowtools.js?v=202610240622";
import { WALL_KIND } from "./walls.js?v=202610240622";
import { T, alpha, watermark } from "./theme.js?v=202610240622";
import { drawConfl, conflTip } from "./levels.js?v=202610240622";
import { drawShapes } from "./drawings.js?v=202610240622";
import { fpRows, rowExtremes, diagRatio, barStats, auction, unfinishedLevels, deltaDivergence, FP_MODES } from "./footprint.js?v=202610240622";
import { TYPES as RADAR_TYPES, STATUS as RADAR_STATUS, REGIMES as RADAR_REGIMES, fmtDur } from "./radar.js?v=202610240622";

const RADAR_MARK = { wake: "Đ", climax: "C", spike: "K", absorb: "H", vacuum: "T", paradox: "N", drought: "Cạn" };
function radarText(e, dec, ms) {
  const st = RADAR_STATUS[e.r.status];
  return `Radar: ${RADAR_TYPES[e.type].name} ${e.dir > 0 ? "▲" : "▼"} ở ${e.level.toFixed(dec)}. ${RADAR_TYPES[e.type].tip}. Bối cảnh ${RADAR_REGIMES[e.regime].name.toLowerCase()}, khối lượng ×${e.vRel.toFixed(1)} so với cùng thời điểm các ngày trước${e.share != null ? `, mua chủ động ${Math.round(e.share * 100)}%` : ""}. Phản ứng: ${st.name.toLowerCase()}${e.r.at && ms ? ` sau ${fmtDur(e.r.at * ms)}` : ""}.`;
}

const STAT_H = 14, sgn = v => (v > 0 ? "+" : "") + fmtVol(v);
const STAT_ROWS = [
  { name: "Khối lượng", get: s => s.v, fmt: fmtVol, tip: "Tổng khối lượng khớp trong nến" },
  { name: "Delta", get: s => s.d, fmt: sgn, signed: true, tip: "Mua chủ động trừ bán chủ động" },
  { name: "Delta %", get: s => s.v ? s.dPct * 100 : null, fmt: v => (v > 0 ? "+" : "") + v.toFixed(0) + "%", signed: true, tip: "Delta chia khối lượng: trên ±20% là một phe áp đảo rõ" },
  { name: "Δ cao nhất", get: s => s.dMax, fmt: sgn, signed: true, tip: "Delta cao nhất lúc nến đang chạy. Delta đóng nến thấp hơn nhiều là phe mua đã bị đẩy lùi" },
  { name: "Δ thấp nhất", get: s => s.dMin, fmt: sgn, signed: true, tip: "Delta thấp nhất lúc nến đang chạy. Delta đóng nến cao hơn nhiều là phe bán đã bị đẩy lùi" },
  { name: "Số lệnh", get: s => s.n, fmt: v => fmtVol(v), col: "#c678dd", tip: "Số lệnh khớp (Binance gộp các lệnh khớp cùng giá cùng lúc). Nhiều lệnh nhỏ là nhỏ lẻ; ít lệnh mà khối lượng lớn là lệnh to" },
  { name: "KL/lệnh", get: s => s.n ? s.v / s.n : null, fmt: v => fmtVol(v), col: "#f5c542", tip: "Khối lượng trung bình mỗi lệnh khớp: tăng đột biến là có lệnh lớn tham gia" },
];
const AXIS_W = 74, TIME_H = 22, MULTS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
const C = { get bg() { return T.bg; }, get grid() { return T.grid; }, get axis() { return T.muted; }, get text() { return T.text; }, get up() { return T.up; }, get down() { return T.down; }, poc: "#f5d524" };

// mất cân bằng theo đường chéo (như ATAS): mua ở dòng k so với bán ở dòng k − 1, bán ở dòng k so với mua ở dòng k + 1
// (dòng ở mép nến không có dòng kề để so thì bỏ qua)
export function imbalances(rows, ratio = 3) {
  let maxC = 0; for (const r of rows.values()) maxC = Math.max(maxC, r[0], r[1]);
  const buy = new Set(), sell = new Set(), minQ = maxC * 0.05;
  for (const [k, r] of rows) {
    const below = rows.get(k - 1), above = rows.get(k + 1), sb = below ? below[0] : 0, ba = above ? above[1] : 0;
    if (below && r[1] > minQ && (sb ? r[1] >= ratio * sb : r[1] >= maxC * 0.1)) buy.add(k);
    if (above && r[0] > minQ && (ba ? r[0] >= ratio * ba : r[0] >= maxC * 0.1)) sell.add(k);
  }
  return { buy, sell };
}
// dải mất cân bằng xếp chồng: từ `stack` dòng liền nhau cùng phía trở lên, kéo tới khi có nến đóng cửa xuyên qua
export function stackedZones(bars, rowStep, step, { ratio = 3, stack = 3 } = {}) {
  const mult = Math.max(1, Math.round(rowStep / step)), out = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]; if (!b.fp || !b.fp.size) continue;
    const im = imbalances(fpRows(b, mult), ratio);
    for (const [side, set] of [["buy", im.buy], ["sell", im.sell]]) {
      const ks = [...set].sort((a, c) => a - c);
      for (let a = 0; a < ks.length;) {
        let e = a; while (e + 1 < ks.length && ks[e + 1] === ks[e] + 1) e++;
        if (e - a + 1 >= stack) {
          const lo = ks[a] * rowStep, hi = (ks[e] + 1) * rowStep; let end = null;
          for (let j = i + 1; j < bars.length; j++) if (side === "buy" ? bars[j].c < lo : bars[j].c > hi) { end = j; break; }
          out.push({ i, t: b.t, side, lo, hi, n: e - a + 1, end });
        }
        a = e + 1;
      }
    }
  }
  return out;
}

export class FlowChart {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.opts = opts;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.bars = []; this.info = {}; this.step = 1; this.type = "candle"; this.rowMult = "auto";
    this.spacing = { candle: 8, box: 72 }; this.offset = 6; this.yZoom = 1;
    this.show = { radar: false, profile: true, levels: true, zones: true, liq: true, liqMap: true, delta: true, cvd: true, oi: true, absorb: true, big: true, cluster: true, dayProfile: false, algo: true, spoof: true, score: true, imb: true, stats: true, auction: true, diverg: true, confl: true };
    this.fpMode = "bidask"; this.fpColor = "volume";
    this.radar = []; this.levels = []; this.zones = []; this.confl = []; this.liqMap = null; this.markers = []; this.lines = []; this.orders = []; this.position = null;
    this.absorb = []; this.prints = null; this.bigQ = Infinity; this.clusters = []; this.ranges = []; this.pane = "deltaCvd";
    this.vpinVals = null; this.vpinHi = null; this.groupVals = null; this.algoRuns = []; this.spoofs = []; this.scores = []; this.scoreMin = 60;
    this.selecting = false; this.sel = null;
    this.mouse = null; this.drag = null; this.dirty = true;
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setData(bars, info) { this.bars = bars; this.info = info || {}; this.step = info.step || 1; this.offset = this._defOff(); this.yZoom = 1; this._cvd = null; this.dirty = true; }
  refresh() { this._cvd = null; this.dirty = true; }
  setType(t) { if (t !== this.type) { this.type = t; this.offset = this._defOff(); } this.dirty = true; }
  _defOff() { return Math.max(0.6, 50 / this.spacing[this.type]); } // chừa khoảng 50px bên phải nến cuối
  setOverlays(o) { Object.assign(this, o); this.dirty = true; }

  get sp() { return this.spacing[this.type]; }
  _layout() {
    const w = this.S.w, h = this.S.h, pw = w - AXIS_W, ph = h - TIME_H;
    const hasOi = this.show.oi && this.bars.some(b => b.oi != null);
    const pane = this.pane, wantDelta = this.show.delta && (pane === "deltaCvd" || pane === "delta"), wantCvd = (this.show.cvd || hasOi) && pane !== "delta";
    const deltaH = wantDelta ? Math.round(ph * (pane === "delta" ? 0.18 : 0.1)) : 0;
    const cvdH = wantCvd ? Math.round(ph * (pane === "deltaCvd" ? 0.14 : 0.22)) : 0;
    const statsH = this.type === "box" && this.show.stats ? STAT_ROWS.length * STAT_H + 3 : 0;
    const priceH = ph - deltaH - cvdH - statsH;
    return { w, h, pw, ph, priceH, deltaTop: priceH, deltaH, cvdTop: priceH + deltaH, cvdH, statsTop: priceH + deltaH + cvdH, statsH, hasOi };
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
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, L.w, L.h); watermark(ctx, L.pw, L.ph);
    if (!this.bars.length) { ctx.fillStyle = C.axis; ctx.font = "14px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "center"; ctx.fillText(this.opts.emptyText || "Đang tải dữ liệu...", L.pw / 2, L.ph / 2); return; }
    const [first, last] = this._visible();
    if (last < first) return; // khung quá hẹp hoặc đã kéo hết nến ra ngoài
    let lo = Infinity, hi = -Infinity;
    for (let i = first; i <= last; i++) { lo = Math.min(lo, this.bars[i].l); hi = Math.max(hi, this.bars[i].h); }
    const mid = (hi + lo) / 2, half = Math.max((hi - lo) / 2, mid * 0.0005) * 1.1 * this.yZoom;
    this._pmin = mid - half; this._pmax = mid + half; this._ph = L.priceH - 12;
    const rowStep = this._rowStep(first, last); this._rowStepUsed = rowStep;
    this._grid(L);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.pw, L.priceH); ctx.clip();
    if (this.show.profile) this._profile(first, last, this.type === "box" ? rowStep : this._profileStep(), L);
    if (this.show.dayProfile) this._dayProfiles(first, last, L);
    this._ranges(first, last, L);
    if (this.show.zones) this._zones(first, L);
    if (this.show.confl) drawConfl(ctx, this.confl, p => this.yOf(p), L.pw, L.priceH, `10px ${MONO}`);
    if (this.show.levels) this._levels(L);
    if (this.type === "box" && this.show.imb) this._stacked(first, last, rowStep, L);
    if (this.type === "box") this._boxes(first, last, rowStep); else this._candles(first, last);
    if (this.type === "box" && this.show.auction) this._auctions(first, last, rowStep, L);
    if (this.show.diverg) this._diverg(first, last);
    this._lines(first, last);
    if (this.show.radar) this._radar(first, last, L);
    if (this.show.cluster) this._clusters(first, last, rowStep);
    if (this.show.big) this._bigPrints(first, last);
    if (this.show.absorb) this._absorb(first, last);
    if (this.show.algo) this._algo(first, last);
    if (this.show.spoof) this._spoofs(first, last);
    if (this.show.score) this._scores(first, last);
    if (this.show.liq) this._liqMarks(first, last);
    this._selBand(L);
    if (this.show.liqMap && this.liqMap) this._liqMap(L);
    this._markers(first, last);
    this._ownLines(L);
    if (this.drawings) drawShapes(ctx, this.drawings.list(), this.drawings.preview, { yOf: p => this.yOf(p), pw: L.pw, ph: L.priceH, dec: decimalsFor(this.info.tick || this.step) });
    ctx.restore();
    if (L.deltaH) this._delta(first, last, L);
    if (L.cvdH) this._cvdPane(first, last, L);
    this._axes(first, last, L);
    if (L.statsH) this._statsPane(first, last, L);
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
    const ctx = this.ctx, w = this.sp * 0.88, rowPx = rowStep / (this._pmax - this._pmin) * this._ph;
    const mode = FP_MODES[this.fpMode] ? this.fpMode : "bidask", colorBy = this.fpColor;
    const minW = { bidask: 58, delta: 40, volume: 40, bavol: 96, ratio: 40, histo: 70, profile: 70 }[mode];
    const showText = rowPx >= 11 && w >= minW, fs = Math.min(11, Math.max(9, rowPx - 2)).toFixed(0);
    const mult = Math.max(1, Math.round(rowStep / this.step)), needImb = this.show.imb || colorBy === "imbalance";
    ctx.font = `${fs}px ${MONO}`; ctx.textBaseline = "middle";
    for (let i = first; i <= last; i++) {
      const b = this.bars[i], x = this.xOf(i), x0 = x - w / 2, up = b.c >= b.o;
      if (!b.fp || !b.fp.size) { // nến lịch sử: sàn không cung cấp footprint quá khứ
        ctx.strokeStyle = ctx.fillStyle = up ? C.up : C.down;
        ctx.beginPath(); ctx.moveTo(x, this.yOf(b.h)); ctx.lineTo(x, this.yOf(b.l)); ctx.stroke();
        const y1 = this.yOf(Math.max(b.o, b.c)), y2 = this.yOf(Math.min(b.o, b.c)); ctx.fillRect(x - w * 0.12, y1, w * 0.24, Math.max(1, y2 - y1));
        continue;
      }
      const rows = fpRows(b, mult), im = needImb ? imbalances(rows) : null, ex = rowExtremes(rows), pocK = ex.pocK;
      const kLo = Math.floor(b.l / rowStep + 1e-9), kHi = Math.floor(b.h / rowStep + 1e-9), strip = Math.min(6, w * 0.08);
      const cx0 = x0 + strip + 1, cw = w - strip - 1, mid = cx0 + cw / 2, dim = b.fpApprox ? 0.75 : 1;
      for (let k = kLo; k <= kHi; k++) {
        const r = rows.get(k) || [0, 0], tot = r[0] + r[1], dd = r[1] - r[0], yTop = this.yOf((k + 1) * rowStep), hgt = Math.max(1, this.yOf(k * rowStep) - yTop - 1);
        const bI = im && im.buy.has(k), sI = im && im.sell.has(k);
        // nền ô
        let col = null, a = 0;
        if (mode === "histo" || mode === "profile") { col = T.muted; a = 0.06; }
        else if (colorBy === "delta") { col = dd >= 0 ? T.up : T.down; a = ex.maxAbsD ? 0.06 + 0.6 * Math.abs(dd) / ex.maxAbsD : 0.05; }
        else if (colorBy === "imbalance") { col = bI ? T.up : sI ? T.down : T.muted; a = bI || sI ? 0.5 : 0.05; }
        else if (colorBy === "candle") { col = up ? T.up : T.down; a = ex.maxTot ? 0.06 + 0.5 * tot / ex.maxTot : 0.05; }
        else { col = r[1] >= r[0] ? T.up : T.down; a = ex.maxTot ? 0.08 + 0.55 * tot / ex.maxTot : 0.05; }
        ctx.fillStyle = alpha(col, (a * dim).toFixed(3)); ctx.fillRect(cx0, yTop + 0.5, cw, hgt);
        if (mode === "histo") { // thanh bán bên trái, mua bên phải, từ giữa ô ra
          const half = cw / 2 - 2, sw = ex.maxSide ? r[0] / ex.maxSide * half : 0, bw = ex.maxSide ? r[1] / ex.maxSide * half : 0;
          ctx.fillStyle = alpha(T.down, sI ? 0.95 : 0.6); ctx.fillRect(mid - sw, yTop + 1, sw, Math.max(1, hgt - 1));
          ctx.fillStyle = alpha(T.up, bI ? 0.95 : 0.6); ctx.fillRect(mid, yTop + 1, bw, Math.max(1, hgt - 1));
        } else if (mode === "profile") { // hồ sơ khối lượng của riêng nến, màu theo delta dòng
          const pw2 = ex.maxTot ? tot / ex.maxTot * (cw - 2) : 0;
          ctx.fillStyle = alpha(dd >= 0 ? T.up : T.down, (0.35 + 0.5 * (ex.maxAbsD ? Math.abs(dd) / ex.maxAbsD : 0)).toFixed(3)); ctx.fillRect(cx0 + 1, yTop + 1, pw2, Math.max(1, hgt - 1));
        }
        if ((bI || sI) && mode !== "histo") { ctx.fillStyle = alpha(bI ? T.up : T.down, 0.85); if (bI) ctx.fillRect(x0 + w - 3, yTop + 0.5, 3, hgt); if (sI) ctx.fillRect(cx0, yTop + 0.5, 3, hgt); }
        if (k === pocK) { ctx.strokeStyle = C.poc; ctx.lineWidth = 1; ctx.strokeRect(cx0 + 0.5, yTop + 1, cw - 1, Math.max(1, hgt - 1)); }
        if (!showText || tot <= 0) continue;
        const ty = yTop + hgt / 2 + 0.5, bold = f => `${f ? "bold " : ""}${fs}px ${MONO}`;
        if (mode === "bidask" || mode === "histo") {
          ctx.font = bold(sI); ctx.textAlign = "right"; ctx.fillStyle = sI ? T.down : C.text; ctx.fillText(fmtVol(r[0]), mid - 5, ty);
          ctx.textAlign = "center"; ctx.fillStyle = C.axis; ctx.fillText("x", mid, ty);
          ctx.font = bold(bI); ctx.textAlign = "left"; ctx.fillStyle = bI ? T.up : C.text; ctx.fillText(fmtVol(r[1]), mid + 5, ty);
        } else if (mode === "bavol") {
          const c1 = cx0 + cw / 6, c3 = cx0 + cw * 5 / 6; ctx.textAlign = "center";
          ctx.font = bold(sI); ctx.fillStyle = sI ? T.down : C.text; ctx.fillText(fmtVol(r[0]), c1, ty);
          ctx.font = bold(k === pocK); ctx.fillStyle = k === pocK ? C.poc : C.axis; ctx.fillText(fmtVol(tot), mid, ty);
          ctx.font = bold(bI); ctx.fillStyle = bI ? T.up : C.text; ctx.fillText(fmtVol(r[1]), c3, ty);
        } else if (mode === "delta") {
          ctx.font = bold(bI || sI); ctx.textAlign = "center"; ctx.fillStyle = dd >= 0 ? T.up : T.down; ctx.fillText((dd > 0 ? "+" : "") + fmtVol(dd), mid, ty);
        } else if (mode === "volume" || mode === "profile") {
          ctx.font = bold(k === pocK); ctx.textAlign = mode === "profile" ? "left" : "center"; ctx.fillStyle = k === pocK ? C.poc : C.text; ctx.fillText(fmtVol(tot), mode === "profile" ? cx0 + 3 : mid, ty);
        } else if (mode === "ratio") {
          const dr = diagRatio(rows, k); ctx.textAlign = "center";
          if (!dr || dr.x == null) { ctx.fillStyle = C.axis; ctx.fillText("·", mid, ty); }
          else { const strong = dr.x >= 3, txt = dr.x === Infinity ? "∞" : dr.x >= 10 ? dr.x.toFixed(0) + "×" : dr.x.toFixed(1) + "×"; ctx.font = bold(strong); ctx.fillStyle = dr.x < 1.5 ? C.axis : dr.side === "buy" ? T.up : T.down; ctx.fillText(txt, mid, ty); }
        }
      }
      const col = up ? C.up : C.down, yo = this.yOf(Math.max(b.o, b.c)), yc = this.yOf(Math.min(b.o, b.c));
      ctx.fillStyle = col; ctx.fillRect(x0, yo, strip, Math.max(1, yc - yo));
      ctx.strokeStyle = col; ctx.lineWidth = 1; if (b.fpApprox) ctx.setLineDash([3, 3]); // nét đứt: footprint ước tính
      ctx.strokeRect(x0 + 0.5, this.yOf((kHi + 1) * rowStep) + 0.5, w - 1, this.yOf(kLo * rowStep) - this.yOf((kHi + 1) * rowStep) - 1); ctx.setLineDash([]);
    }
  }

  // đấu giá chưa xong ở đỉnh/đáy nến (đường chấm kéo sang phải tới khi giá quay lại) và kiệt sức
  _auctions(first, last, rowStep, L) {
    const lb = this.bars[this.bars.length - 1], key = `${this.bars.length}:${rowStep}:${lb ? lb.h + ":" + lb.l : 0}:${this.bars[0] ? this.bars[0].t : 0}`;
    if (!this._unf || this._unf.key !== key) this._unf = { key, lv: unfinishedLevels(this.bars, rowStep, this.step) };
    const ctx = this.ctx, mult = Math.max(1, Math.round(rowStep / this.step)); this._unfVis = []; this._exVis = [];
    for (const u of this._unf.lv) {
      if (u.i > last || (u.end != null && u.end < first)) continue;
      const xa = this.xOf(u.i) + this.sp * 0.44, xb = u.end != null ? this.xOf(u.end) : L.pw, y = Math.round(this.yOf(u.price)) + 0.5;
      if (y < 0 || y > L.priceH) continue;
      ctx.strokeStyle = alpha("#ff9f43", u.end != null ? 0.35 : 0.85); ctx.lineWidth = 1; ctx.setLineDash([1, 3]);
      ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.setLineDash([]);
      this._unfVis.push({ xa, xb, y, u });
    }
    if (this.sp < 40) return;
    ctx.font = `bold 10px ${MONO}`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    for (let i = first; i <= last; i++) {
      const b = this.bars[i]; if (!b.fp || !b.fp.size || b.fpApprox) continue;
      const a = auction(fpRows(b, mult)); if (!a) continue;
      const x = this.xOf(i) + this.sp * 0.44 + 6;
      if (a.exTop) { const y = this.yOf((a.kHi + 0.5) * rowStep); ctx.fillStyle = "#c678dd"; ctx.fillText("E", x, y); this._exVis.push({ x, y, i, side: "top" }); }
      if (a.exBot) { const y = this.yOf((a.kLo + 0.5) * rowStep); ctx.fillStyle = "#c678dd"; ctx.fillText("E", x, y); this._exVis.push({ x, y, i, side: "bot" }); }
    }
  }

  // phân kỳ delta: tam giác trên đỉnh (giá lên mà bán áp đảo) hoặc dưới đáy (giá xuống mà mua áp đảo)
  _diverg(first, last) {
    const lb = this.bars[this.bars.length - 1], key = `${this.bars.length}:${lb ? lb.d : 0}:${lb ? lb.h + ":" + lb.l : 0}`;
    if (!this._dv || this._dv.key !== key) this._dv = { key, list: deltaDivergence(this.bars) };
    const ctx = this.ctx; this._dvVis = [];
    for (const e of this._dv.list) {
      if (e.i < first || e.i > last) continue;
      const b = this.bars[e.i], x = this.xOf(e.i), bear = e.side === "bear", y = bear ? this.yOf(b.h) - 9 : this.yOf(b.l) + 9;
      ctx.fillStyle = bear ? alpha(T.down, 0.9) : alpha(T.up, 0.9); ctx.beginPath();
      if (bear) { ctx.moveTo(x - 4, y - 3); ctx.lineTo(x + 4, y - 3); ctx.lineTo(x, y + 3); } else { ctx.moveTo(x - 4, y + 3); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x, y - 3); }
      ctx.closePath(); ctx.fill(); this._dvVis.push({ x, y, e });
    }
  }

  // bảng thống kê cụm dưới biểu đồ (kiểu Cluster Statistic của ATAS); nhãn nằm ở cột trục giá
  _statsPane(first, last, L) {
    const ctx = this.ctx, top = L.statsTop, cw = Math.max(1, this.sp - 2), stats = [];
    for (let i = first; i <= last; i++) stats.push(barStats(this.bars[i]));
    ctx.fillStyle = T.panel; ctx.fillRect(0, top, L.w, L.statsH);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(L.w, top + 0.5); ctx.stroke();
    const showText = this.sp >= 34; ctx.font = `10px ${MONO}`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    STAT_ROWS.forEach((row, ri) => {
      const y = top + 2 + ri * STAT_H; let mx = 0;
      for (const st of stats) { const v = row.get(st); if (v != null && isFinite(v)) mx = Math.max(mx, Math.abs(v)); }
      stats.forEach((st, j) => {
        const v = row.get(st), x = this.xOf(first + j); if (v == null || !isFinite(v)) return;
        const signed = row.signed, a = mx ? 0.08 + 0.55 * Math.abs(v) / mx : 0.05;
        ctx.fillStyle = alpha(signed ? (v >= 0 ? T.up : T.down) : row.col || "#2f8cff", a.toFixed(3));
        ctx.fillRect(Math.round(x - cw / 2), y, Math.round(cw), STAT_H - 1);
        if (showText) { ctx.fillStyle = C.text; ctx.fillText(row.fmt(v), x, y + STAT_H / 2); }
      });
      ctx.fillStyle = C.axis; ctx.textAlign = "left"; ctx.fillText(row.name, L.pw + 4, y + STAT_H / 2); ctx.textAlign = "center";
    });
  }

  _stacked(first, last, rowStep, L) {
    const lb = this.bars[this.bars.length - 1], key = `${this.bars.length}:${rowStep}:${lb ? lb.v : 0}:${this.bars[0] ? this.bars[0].t : 0}`;
    if (!this._stk || this._stk.key !== key) this._stk = { key, zones: stackedZones(this.bars, rowStep, this.step) };
    const ctx = this.ctx; this._stkVis = [];
    for (const z of this._stk.zones) {
      if (z.end != null && z.end < first) continue; if (z.i > last) continue;
      const xa = this.xOf(z.i) + this.sp * 0.44, xb = z.end != null ? this.xOf(z.end) : L.pw, ya = this.yOf(z.hi), yb = this.yOf(z.lo);
      if (yb < 0 || ya > L.priceH || xb < xa) continue;
      const col = z.side === "buy" ? T.up : T.down;
      ctx.fillStyle = alpha(col, 0.13); ctx.fillRect(xa, ya, xb - xa, Math.max(2, yb - ya));
      ctx.strokeStyle = alpha(col, 0.6); ctx.lineWidth = 1; ctx.setLineDash(z.end != null ? [3, 3] : []);
      ctx.beginPath(); ctx.moveTo(xa, Math.round(ya) + 0.5); ctx.lineTo(xb, Math.round(ya) + 0.5); ctx.moveTo(xa, Math.round(yb) - 0.5); ctx.lineTo(xb, Math.round(yb) - 0.5); ctx.stroke(); ctx.setLineDash([]);
      this._stkVis.push({ xa, xb, ya, yb, z });
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
      const base = lv.kind === "support" ? T.up : T.down, a = 0.35 + 0.5 * (lv.strength || 50) / 100;
      ctx.strokeStyle = alpha(base, a.toFixed(2)); ctx.lineWidth = lv.strength > 70 ? 2 : 1; ctx.setLineDash(lv.broken ? [3, 4] : []);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.fillStyle = alpha(base, 0.95); ctx.textBaseline = "alphabetic";
      ctx.fillText(`${lv.kind === "support" ? "HT" : "KC"} ${lv.price.toFixed(dec)} · chạm ${lv.touches} · test ${lv.tests} · ${Math.round(lv.strength)}đ`, L.pw - 8, y - 3);
    }
  }

  // sự kiện Radar: chấm ở mức giá của sự kiện, nét đứt kéo tới hiện tại với 48 nến gần nhất, màu theo phản ứng
  _radar(first, last, L) {
    const ctx = this.ctx, n = this.bars.length, idx = new Map(this.bars.map((b, i) => [b.t, i]));
    this._radarVis = [];
    ctx.font = `10px ${MONO}`; ctx.textBaseline = "alphabetic";
    for (const e of this.radar) {
      const i = idx.get(e.t); if (i === undefined || i > last) continue;
      const col = e.r.status === "accepted" ? T.up : e.r.status === "rejected" ? T.down : "#f5a524", y = this.yOf(e.level), x = this.xOf(i);
      if (i >= n - 49) { ctx.strokeStyle = alpha(col, 0.75); ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.max(0, x), y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]); }
      if (i < first) continue;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = C.bg; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = "center"; ctx.fillStyle = alpha(col, 0.95); ctx.fillText(RADAR_MARK[e.type] || "", x, e.dir > 0 ? this.yOf(this.bars[i].l) + 13 : this.yOf(this.bars[i].h) - 5);
      this._radarVis.push({ x, y, e });
    }
    ctx.textAlign = "left";
  }

  _zones(first, L) {
    const ctx = this.ctx, idx = new Map(this.bars.map((b, i) => [b.t, i]));
    for (const z of this.zones) {
      const i = idx.get(z.t); if (i === undefined) continue;
      const end = z.endT != null && idx.has(z.endT) ? this.xOf(idx.get(z.endT)) : L.pw;
      const xa = this.xOf(i) - this.sp / 2, ya = this.yOf(z.high), yb = this.yOf(z.low);
      if (end < 0) continue;
      ctx.fillStyle = z.side === "buy" ? alpha(T.up, 0.09) : alpha(T.down, 0.09);
      ctx.fillRect(xa, ya, end - xa, Math.max(2, yb - ya));
      ctx.strokeStyle = z.side === "buy" ? alpha(T.up, 0.4) : alpha(T.down, 0.4); ctx.lineWidth = 1;
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

  // đường giá phụ (ví dụ VWAP trong backtest): [{values, color, name}]
  _lines(first, last) {
    const ctx = this.ctx; let ly = 46;
    for (const ln of this.lines) {
      ctx.strokeStyle = ln.color; ctx.lineWidth = 1.5; ctx.beginPath(); let on = false;
      for (let i = first; i <= last; i++) {
        const v = ln.values[i]; if (!isFinite(v)) { on = false; continue; }
        // ngắt đường khi VWAP neo theo ngày/tuần bắt đầu lại
        const jump = on && ln.resets && ln.resets[i];
        const x = this.xOf(i), y = this.yOf(v); (on && !jump) ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true;
      }
      ctx.stroke();
      ctx.fillStyle = ln.color; ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(ln.name, 8, ly); ly += 14;
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
      ctx.fillStyle = mk.exit ? T.text : up ? C.up : C.down; ctx.beginPath();
      if (mk.exit) { ctx.rect(x - 3.5, y - 3.5, 7, 7); }
      else if (up) { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); }
      else { ctx.moveTo(x, y + s); ctx.lineTo(x + s, y - s); ctx.lineTo(x - s, y - s); }
      ctx.closePath(); ctx.fill();
      if (mk.link) { // nối điểm vào và ra
        const j = idx.get(mk.link.t); if (j !== undefined) { ctx.strokeStyle = mk.link.win ? alpha(T.up, 0.7) : alpha(T.down, 0.7); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(this.xOf(j), this.yOf(mk.link.price)); ctx.stroke(); ctx.setLineDash([]); }
      }
    }
  }

  _ownLines(L) {
    if (this.ol) return this.ol.draw(this.ctx, L);
    const ctx = this.ctx, dec = decimalsFor(this.info.tick || this.step);
    const line = (p, color, text, dash) => {
      const y = Math.round(this.yOf(p)) + 0.5; if (y < 0 || y > L.priceH) return;
      ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; const tw = ctx.measureText(text).width + 10;
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
    ctx.fillStyle = T.panel; ctx.fillRect(0, top, L.pw, H);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(L.w, top + 0.5); ctx.moveTo(0, mid + 0.5); ctx.lineTo(L.pw, mid + 0.5); ctx.stroke();
    const bw = Math.max(1, Math.min(this.sp * 0.7, this.sp - 2));
    if (maxD) for (let i = first; i <= last; i++) {
      const d = this.bars[i].d || 0, hh = Math.abs(d) / maxD * (H / 2 - 3), x = this.xOf(i);
      ctx.fillStyle = d >= 0 ? alpha(T.up, 0.75) : alpha(T.down, 0.75);
      ctx.fillRect(Math.round(x - bw / 2), d >= 0 ? mid - hh : mid, Math.round(bw), Math.max(1, hh));
      if (this.type === "box" && this.sp >= 50) { ctx.fillStyle = d >= 0 ? C.up : C.down; ctx.font = `10px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((d >= 0 ? "+" : "") + fmtVol(d), x, d >= 0 ? mid + 7 : mid - 7); }
    }
    ctx.fillStyle = C.axis; ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`Delta${this.info.deltaApprox ? " (ước tính từ nến)" : ""}`, 6, top + 3);
  }

  _cvdPane(first, last, L) {
    const ctx = this.ctx, top = L.cvdTop, H = L.cvdH;
    if (!this._cvd) this._cvd = cvdOf(this.bars);
    ctx.fillStyle = T.panel; ctx.fillRect(0, top, L.pw, H);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(L.w, top + 0.5); ctx.stroke();
    if (this.pane === "cvdpro") { this._cvdPro(first, last, L); return; }
    if (this.pane === "ofi") { this._ofiPane(first, last, L); return; }
    if (this.pane === "vpin") { this._vpinPane(first, last, L); return; }
    if (this.pane === "groups") { this._groupsPane(first, last, L); return; }
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
      ctx.fillStyle = col; ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      const label = `${name} ${lastV == null ? "" : fmtVol(lastV)}`; ctx.fillText(label, lx, top + 3); lx += ctx.measureText(label).width + 16;
    }
  }

  // CVD Pro: CVD dạng nến, bắt đầu lại mỗi ngày (UTC)
  _cvdPro(first, last, L) {
    const ctx = this.ctx, top = L.cvdTop, H = L.cvdH;
    if (!this._cvdc || this._cvdcN !== this.bars.length || this._cvdcV !== this.bars[this.bars.length - 1].d) { this._cvdc = cvdCandles(this.bars, { reset: "day" }); this._cvdcN = this.bars.length; this._cvdcV = this.bars[this.bars.length - 1].d; }
    const cc = this._cvdc; let lo = Infinity, hi = -Infinity;
    for (let i = first; i <= last; i++) { lo = Math.min(lo, cc[i].l); hi = Math.max(hi, cc[i].h); }
    if (!(hi > lo)) return;
    const Y = v => top + 6 + (hi - v) / (hi - lo) * (H - 12), bw = Math.max(1, Math.min(this.sp * 0.7, this.sp - 2));
    if (lo < 0 && hi > 0) { ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, Y(0) + 0.5); ctx.lineTo(L.pw, Y(0) + 0.5); ctx.stroke(); }
    for (let i = first; i <= last; i++) {
      const c = cc[i], x = this.xOf(i), col = c.c >= c.o ? C.up : C.down;
      if (c.reset && i > first) { ctx.strokeStyle = alpha(T.muted, 0.4); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x - this.sp / 2, top); ctx.lineTo(x - this.sp / 2, top + H); ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, Y(c.h)); ctx.lineTo(Math.round(x) + 0.5, Y(c.l)); ctx.stroke();
      const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c)); ctx.fillRect(Math.round(x - bw / 2), y1, Math.round(bw), Math.max(1, y2 - y1));
    }
    ctx.fillStyle = "#f5c542"; ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`CVD Pro (nến CVD, bắt đầu lại mỗi ngày) ${fmtVol(cc[Math.min(last, cc.length - 1)].c)}`, 6, top + 3);
  }

  _paneLabel(text, col, L, x = 6) {
    const ctx = this.ctx; ctx.fillStyle = col; ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(text, x, L.cvdTop + 3); return x + ctx.measureText(text).width + 14;
  }
  _line(vals, first, last, lo, hi, col, L, width = 1.4) {
    const ctx = this.ctx, top = L.cvdTop, H = L.cvdH; ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath(); let on = false;
    for (let i = first; i <= last; i++) { const v = vals[i]; if (v == null) { on = false; continue; } const x = this.xOf(i), y = top + 16 + (hi - v) / (hi - lo || 1) * (H - 22); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
    ctx.stroke(); ctx.lineWidth = 1;
  }

  // OFI: cột = áp lực sổ lệnh trong nến, đường = cộng dồn. Chỉ có từ lúc mở trang (sàn không cho tải lịch sử sổ lệnh)
  _ofiPane(first, last, L) {
    const ctx = this.ctx, top = L.cvdTop, H = L.cvdH; let maxA = 0, cum = 0; const cumV = [];
    for (let i = 0; i < this.bars.length; i++) { const o = this.bars[i].ofi; if (o == null) { cumV.push(null); continue; } cum += o; cumV.push(cum); if (i >= first && i <= last) maxA = Math.max(maxA, Math.abs(o)); }
    if (!maxA) { this._paneLabel("OFI (áp lực sổ lệnh): đang ghi từ lúc mở trang, chờ vài nến...", C.axis, L); return; }
    const mid = top + 16 + (H - 22) / 2, half = (H - 22) / 2, bw = Math.max(1, Math.min(this.sp * 0.6, this.sp - 2));
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, mid + 0.5); ctx.lineTo(L.pw, mid + 0.5); ctx.stroke();
    for (let i = first; i <= last; i++) { const o = this.bars[i].ofi; if (o == null) continue; const hh = Math.abs(o) / maxA * half; ctx.fillStyle = alpha(o >= 0 ? T.up : T.down, 0.6); ctx.fillRect(Math.round(this.xOf(i) - bw / 2), o >= 0 ? mid - hh : mid, Math.round(bw), Math.max(1, hh)); }
    let lo = Infinity, hi = -Infinity; for (let i = first; i <= last; i++) if (cumV[i] != null) { lo = Math.min(lo, cumV[i]); hi = Math.max(hi, cumV[i]); }
    if (hi > lo) this._line(cumV, first, last, lo, hi, "#f5c542", L);
    const lastO = this.bars[this.bars.length - 1].ofi;
    const x = this._paneLabel(`OFI nến cuối ${lastO == null ? "-" : (lastO >= 0 ? "+" : "") + fmtVol(lastO)}`, lastO >= 0 ? C.up : C.down, L);
    this._paneLabel(`cộng dồn ${fmtVol(cum)} (vàng) · chỉ có từ lúc mở trang`, C.axis, L, x);
  }

  _vpinPane(first, last, L) {
    const v = this.vpinVals; if (!v) { this._paneLabel("VPIN: chưa đủ dữ liệu", C.axis, L); return; }
    const ctx = this.ctx, top = L.cvdTop, H = L.cvdH; let lo = Infinity, hi = -Infinity;
    for (let i = first; i <= last; i++) if (v[i] != null) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
    if (!(hi > lo)) { this._paneLabel("VPIN: chưa đủ 50 giỏ khối lượng", C.axis, L); return; }
    if (this.vpinHi != null) { lo = Math.min(lo, this.vpinHi); hi = Math.max(hi, this.vpinHi); const y = top + 16 + (hi - this.vpinHi) / (hi - lo) * (H - 22); ctx.strokeStyle = alpha(T.down, 0.7); ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]); }
    for (let i = first; i <= last; i++) if (v[i] != null && this.vpinHi != null && v[i] >= this.vpinHi) { ctx.fillStyle = alpha(T.down, 0.18); ctx.fillRect(this.xOf(i) - this.sp / 2, top + 14, this.sp, H - 16); }
    this._line(v, first, last, lo, hi, "#c77dff", L, 1.6);
    const lastV = v[v.length - 1];
    const x = this._paneLabel(`VPIN ${lastV == null ? "-" : lastV.toFixed(3)}${this.vpinPct != null ? ` (cao hơn ${this.vpinPct.toFixed(0)}% lịch sử)` : ""}`, "#c77dff", L);
    this._paneLabel(`nét đứt đỏ: mức top 10% · vùng đỏ: dòng lệnh "độc", dễ biến động mạnh${this.info.deltaApprox ? " · ước tính từ nến" : ""}`, C.axis, L, x);
  }

  // CVD của từng nhóm người chơi, cùng một thang để so được độ lớn
  _groupsPane(first, last, L) {
    const g = this.groupVals; if (!g || !g.some(x => x)) { this._paneLabel("Delta theo nhóm: chưa có lệnh gốc (cần lệnh khớp thật, Binance tải lại được lịch sử)", C.axis, L); return; }
    const series = {}; for (const G of GROUPS) { let c = 0; series[G.id] = g.map(e => { if (!e) return null; c += e[G.id]; return c; }); }
    let lo = Infinity, hi = -Infinity;
    for (const G of GROUPS) for (let i = first; i <= last; i++) { const v = series[G.id][i]; if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    if (!(hi > lo)) return;
    const ctx = this.ctx, top = L.cvdTop, H = L.cvdH;
    if (lo < 0 && hi > 0) { const y = top + 16 + hi / (hi - lo) * (H - 22); ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); }
    for (const G of GROUPS) this._line(series[G.id], first, last, lo, hi, G.color, L, G.id === "whale" ? 2 : 1.3);
    let x = this._paneLabel("CVD theo nhóm:", C.axis, L);
    for (const G of GROUPS) { const arr = series[G.id]; let lv = null; for (let k = Math.min(last, arr.length - 1); k >= 0 && lv == null; k--) lv = arr[k]; x = this._paneLabel(`${G.label} ${lv == null ? "-" : (lv >= 0 ? "+" : "") + fmtVol(lv)}`, G.color, L, x); }
  }

  // dấu vết thuật toán chia lệnh: chuỗi hình thoi tím nối nét đứt
  _algo(first, last) {
    const ctx = this.ctx, col = "#c77dff"; this._algoVis = [];
    if (!this.bars.length) return;
    const t0 = this.bars[first].t, t1 = this.bars[last].t + (this.info.intervalMs || 0);
    for (const r of this.algoRuns) {
      if (r.t1 < t0 || r.t0 > t1) continue;
      ctx.strokeStyle = alpha(col, 0.8); ctx.setLineDash([3, 3]); ctx.beginPath(); let on = false; const pts = [];
      for (const p of r.prints) { const i = this._barIndexAt(p.t); if (i < first || i > last) continue; const ms = this.info.intervalMs || 1, frac = (p.t - this.bars[i].t) / ms; const x = this.xOf(i) + (frac - 0.5) * this.sp * 0.8, y = this.yOf(p.vwap); pts.push([x, y]); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = r.side === "buy" ? T.up : T.down; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      for (const [x, y] of pts) { ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.lineWidth = 1;
      this._algoVis.push({ r, pts });
    }
  }

  _spoofs(first, last) {
    const ctx = this.ctx; this._spoofVis = []; if (!this.bars.length) return;
    for (const e of this.spoofs) {
      if (e.kind !== "spoof") continue;
      const i = this._barIndexAt(e.t); if (i < first || i > last) continue;
      const x = this.xOf(i), y = this.yOf(e.price);
      ctx.strokeStyle = "#ff9f1a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke(); ctx.lineWidth = 1;
      this._spoofVis.push({ e, x, y });
    }
  }

  // điểm tín hiệu ≥ scoreMin: nhãn số dưới đáy (mua) hoặc trên đỉnh (bán)
  _scores(first, last) {
    const ctx = this.ctx; this._scoreVis = [];
    ctx.font = `bold 10px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const e of this.scores) {
      if (e.score < this.scoreMin || e.i < first || e.i > last) continue;
      const b = this.bars[e.i], x = this.xOf(e.i), buy = e.side === "buy", y = buy ? this.yOf(b.l) + 34 : this.yOf(b.h) - 34;
      const w = 26, h = 14, col = buy ? T.up : T.down;
      ctx.fillStyle = alpha(col, 0.9); ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = "#000"; ctx.fillText(String(e.score), x, y + 0.5);
      this._scoreVis.push({ e, x, y, w, h });
    }
  }

  _barIndexAt(t) { // nến chứa thời điểm t
    const b = this.bars; let lo = 0, hi = b.length - 1; if (!b.length || t < b[0].t) return -1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (b[m].t <= t) lo = m; else hi = m - 1; }
    return lo;
  }

  // chấm hấp thụ: đỏ dưới đáy = lực bán bị hấp thụ, xanh trên đỉnh = lực mua bị hấp thụ
  _absorb(first, last) {
    const ctx = this.ctx;
    for (const e of this.absorb) {
      if (e.i < first || e.i > last) continue;
      const x = this.xOf(e.i), r = Math.min(this.sp * 0.6, 4 + e.strength / 100 * 12), y = e.side === "sell" ? this.yOf(e.price) + r + 3 : this.yOf(e.price) - r - 3;
      const col = e.side === "sell" ? T.down : T.up;
      ctx.fillStyle = alpha(col, 0.75); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      e._x = x; e._y = y; e._r = r;
    }
  }

  // Big Trades: lệnh gốc lớn (đã ghép) vẽ thành vòng tròn tại giá trung bình
  _bigPrints(first, last) {
    const lists = this.prints ? this.prints() : null; this._bigVis = []; if (!lists || !isFinite(this.bigQ)) return;
    const ctx = this.ctx, t0 = this.bars[first].t, t1 = this.bars[last].t + (this.info.intervalMs || 0);
    let maxQ = 0; const vis = [];
    for (const list of lists) for (const p of list) if (p.q >= this.bigQ && p.t >= t0 && p.t < t1) { vis.push(p); maxQ = Math.max(maxQ, p.q); }
    this._bigVis = vis;
    for (const p of vis) {
      const i = this._barIndexAt(p.t); if (i < first || i > last) continue;
      const x = this.xOf(i), y = this.yOf(p.vwap), r = Math.max(3, Math.min(this.type === "box" ? this.sp * 0.3 : 22, Math.sqrt(p.q / maxQ) * (this.type === "box" ? this.sp * 0.3 : 22)));
      const col = p.side === "buy" ? T.up : T.down;
      ctx.fillStyle = alpha(col, 0.35); ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      p._x = x; p._y = y; p._r = r;
    }
  }

  // ô footprint tìm được bằng Cluster Search
  _clusters(first, last, rowStep) {
    if (!this.clusters.length) return;
    const ctx = this.ctx, w = this.type === "box" ? this.sp * 0.88 : Math.max(4, this.sp * 0.9);
    ctx.strokeStyle = "#ff9f1c"; ctx.lineWidth = 2;
    for (const c of this.clusters) {
      if (c.i < first || c.i > last) continue;
      const x = this.xOf(c.i), p0 = this.type === "box" ? Math.floor(c.price / rowStep + 1e-9) * rowStep : c.price, p1 = this.type === "box" ? p0 + rowStep : c.price + this.step;
      const y0 = this.yOf(p1), y1 = this.yOf(p0);
      ctx.strokeRect(x - w / 2, y0, w, Math.max(3, y1 - y0));
      c._x = x; c._y0 = y0; c._y1 = Math.max(y0 + 3, y1); c._w = w;
    }
  }

  _profileAt(from, to) {
    const key = `${from}-${to}-${this.bars[to].v}-${this.bars[to].fp ? this.bars[to].fp.size : 0}-${this.bars[from].fpApprox}`;
    this._pcache = this._pcache || new Map();
    let p = this._pcache.get(key);
    if (!p) { p = rangeProfile(this.bars, from, to, this.step); this._pcache.set(key, p); if (this._pcache.size > 200) this._pcache.delete(this._pcache.keys().next().value); }
    return p;
  }

  // vẽ hồ sơ khối lượng nằm ngay trong đoạn nến đó (giống fixed range volume profile)
  _drawRangeProfile(r, prof, L, opts = {}) {
    if (!prof.poc) return;
    const ctx = this.ctx, xa = this.xOf(r.from) - this.sp / 2, xb = this.xOf(r.to) + this.sp / 2, width = Math.max(10, xb - xa);
    if (xb < 0 || xa > L.pw) return;
    let mx = 0; for (const v of prof.rows.values()) mx = Math.max(mx, v[0] + v[1]);
    const rowPx = this.step / (this._pmax - this._pmin) * this._ph, mult = Math.max(1, Math.ceil(2 / Math.max(rowPx, 0.01)));
    const agg = new Map();
    for (const [k, v] of prof.rows) { const kk = Math.floor(k / mult); agg.set(kk, (agg.get(kk) || 0) + v[0] + v[1]); }
    let mx2 = 0; for (const v of agg.values()) mx2 = Math.max(mx2, v);
    ctx.fillStyle = alpha(opts.color || "#2f8cff", 0.06); ctx.fillRect(xa, this.yOf(prof.hi), width, this.yOf(prof.lo) - this.yOf(prof.hi));
    for (const [kk, v] of agg) {
      const pLo = kk * mult * this.step, pHi = pLo + mult * this.step, inVa = pHi > prof.val && pLo < prof.vah;
      const y0 = this.yOf(pHi), y1 = this.yOf(pLo);
      ctx.fillStyle = alpha(opts.color || "#2f8cff", inVa ? 0.42 : 0.2);
      ctx.fillRect(xa, y0, v / mx2 * width * 0.85, Math.max(1, y1 - y0 - 0.5));
    }
    void mx;
    const line = (p, col, dash, label) => {
      const y = Math.round(this.yOf(p)) + 0.5; ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(opts.extend ? L.pw : xb, y); ctx.stroke(); ctx.setLineDash([]);
      if (label) { ctx.font = `10px ${MONO}`; ctx.fillStyle = col; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(label, xa + 2, y - 1); }
    };
    const dec = decimalsFor(this.info.tick || this.step);
    line(prof.poc, C.poc, [], opts.labels ? `POC ${prof.poc.toFixed(dec)}` : "");
    line(prof.vah, alpha(opts.color || "#2f8cff", 0.9), [4, 3], opts.labels ? `VAH ${prof.vah.toFixed(dec)}` : "");
    line(prof.val, alpha(opts.color || "#2f8cff", 0.9), [4, 3], opts.labels ? `VAL ${prof.val.toFixed(dec)}` : "");
  }

  _ranges(first, last, L) {
    for (const r of this.ranges) {
      if (r.to < first || r.from > last || r.to >= this.bars.length) continue;
      r.prof = this._profileAt(r.from, r.to);
      this._drawRangeProfile(r, r.prof, L, { color: "#c678dd", labels: true, extend: true });
    }
  }

  _dayProfiles(first, last, L) {
    if ((this.info.intervalMs || 0) >= 864e5) return;
    for (const s of daySessions(this.bars)) {
      if (s.to < first || s.from > last) continue;
      s.prof = this._profileAt(s.from, s.to);
      this._drawRangeProfile(s, s.prof, L, { color: "#2f8cff", labels: this.sp * (s.to - s.from) > 120 });
    }
  }

  _selBand(L) {
    const s = this.sel; if (!s) return;
    const a = Math.min(s.a, s.b), b = Math.max(s.a, s.b), xa = this.xOf(a) - this.sp / 2, xb = this.xOf(b) + this.sp / 2, ctx = this.ctx;
    ctx.fillStyle = alpha("#c678dd", 0.15); ctx.fillRect(xa, 0, xb - xa, L.priceH);
    ctx.strokeStyle = "#c678dd"; ctx.strokeRect(xa + 0.5, 0.5, xb - xa, L.priceH - 1);
  }

  _axes(first, last, L) {
    const ctx = this.ctx, dec = Math.max(decimalsFor(this._tickStep || this.step), 0);
    ctx.fillStyle = C.bg; ctx.fillRect(L.pw, 0, AXIS_W, L.h); ctx.fillRect(0, L.ph, L.w, TIME_H);
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(L.pw + 0.5, 0); ctx.lineTo(L.pw + 0.5, L.ph); ctx.moveTo(0, L.ph + 0.5); ctx.lineTo(L.w, L.ph + 0.5); ctx.stroke();
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
    ctx.fillStyle = alpha(T.bg, 0.8); ctx.fillRect(4, 4, Math.min(L.pw - 8, 900), 20);
    let x = 8; for (const [t, c] of parts) { ctx.fillStyle = c; ctx.fillText(t, x, 8); x += ctx.measureText(t).width; }
    if (this.type === "box") { ctx.fillStyle = C.axis; ctx.fillText(`Tầng giá ${this._rowStepUsed.toFixed(decimalsFor(this._rowStepUsed))} · viền liền: từ từng lệnh khớp thật · viền nét đứt: ước tính từ nến nhỏ hơn${this.fpProgress ? " · " + this.fpProgress : ""}`, 8, 28); }
  }

  // Chú thích cho đối tượng dưới con trỏ (mức giá, vùng, thanh lý, lệnh backtest)
  hitTest(x, y) {
    const L = this._L; if (!L || !this.bars.length || x > L.pw) return null;
    const dec = decimalsFor(this.info.tick || this.step), i = Math.min(this.bars.length - 1, Math.max(0, this.iAt(x))), b = this.bars[i];
    if (L.statsH && y >= L.statsTop) {
      const row = STAT_ROWS[Math.floor((y - L.statsTop - 2) / STAT_H)]; if (!row) return null;
      const st = barStats(b), v = row.get(st);
      return `${row.name} nến ${fmtTime(b.t)}: ${v == null || !isFinite(v) ? "chưa có (chỉ đo được với nến dựng từ từng lệnh khớp thật)" : row.fmt(v)}. ${row.tip}.${st.approx ? " Nến này là footprint ước tính." : ""}`;
    }
    if (y > L.priceH) return this._paneText(y, i, b, L);
    const ex = this.show.auction && this._exVis && this._exVis.find(v => Math.hypot(x - v.x, y - v.y) <= 7);
    if (ex) return ex.side === "top" ? "Kiệt sức bên mua (exhaustion) ở đỉnh nến: lực mua chủ động giảm dần 3 dòng liền về phía đỉnh và dòng cuối chỉ còn rất ít. Người mua đã cạn, đỉnh này dễ giữ." : "Kiệt sức bên bán (exhaustion) ở đáy nến: lực bán chủ động giảm dần 3 dòng liền về phía đáy và dòng cuối chỉ còn rất ít. Người bán đã cạn, đáy này dễ giữ.";
    const dv = this.show.diverg && this._dvVis && this._dvVis.find(v => Math.hypot(x - v.x, y - v.y) <= 7);
    if (dv) return dv.e.side === "bear" ? `Phân kỳ delta: nến ${fmtTime(this.bars[dv.e.i].t)} lập đỉnh cao hơn 3 nến trước nhưng delta âm (${fmtVol(this.bars[dv.e.i].d)}). Giá lên mà phe bán chủ động áp đảo: lực đẩy lên không thật, thường do lệnh chờ bán hấp thụ.` : `Phân kỳ delta: nến ${fmtTime(this.bars[dv.e.i].t)} lập đáy thấp hơn 3 nến trước nhưng delta dương (+${fmtVol(this.bars[dv.e.i].d)}). Giá xuống mà phe mua chủ động áp đảo: lực bán không thật, thường do lệnh chờ mua hấp thụ.`;
    const uf = this.show.auction && this._unfVis && this._unfVis.find(v => x >= v.xa - 2 && x <= v.xb && Math.abs(y - v.y) <= 3);
    if (uf) { const u = uf.u; return `Đấu giá chưa xong ở ${u.side === "high" ? "đỉnh" : "đáy"} nến ${fmtTime(u.t)} (${u.price.toFixed(dec)}): ở mức giá cực trị vẫn còn cả bên mua và bên bán khớp lệnh, tức là cuộc đấu giá chưa kết thúc. ${u.end != null ? "Giá đã quay lại vượt qua mức này." : "Giá chưa quay lại: mức này thường hút giá về để hoàn tất."}`; }
    const sc = this.show.score && this._scoreVis && this._scoreVis.find(v => Math.abs(x - v.x) <= v.w / 2 + 2 && Math.abs(y - v.y) <= v.h / 2 + 2);
    if (sc) return scoreText(sc.e, dec);
    const rd = this.show.radar && this._radarVis && this._radarVis.find(v => Math.hypot(x - v.x, y - v.y) <= 7);
    if (rd) return radarText(rd.e, dec, this.info.intervalMs);
    const al = this.show.algo && this._algoVis && this._algoVis.find(v => v.pts.some(([px, py]) => Math.hypot(x - px, y - py) <= 6));
    if (al) return algoText(al.r, dec);
    const sp = this.show.spoof && this._spoofVis && this._spoofVis.find(v => Math.hypot(x - v.x, y - v.y) <= 7);
    if (sp) return spoofText(sp.e, dec);
    if (this.show.liq && (b.liqL || b.liqS)) {
      if (b.liqL && Math.abs(y - (this.yOf(b.l) + 10)) < 10) return `Long bị thanh lý trong nến này: ${fmtVol(b.liqL)} (${fmtUsd(b.liqL * b.c)}). Người mua dùng đòn bẩy bị sàn bán cưỡng bức.`;
      if (b.liqS && Math.abs(y - (this.yOf(b.h) - 10)) < 10) return `Short bị thanh lý trong nến này: ${fmtVol(b.liqS)} (${fmtUsd(b.liqS * b.c)}). Người bán khống bị sàn mua cưỡng bức.`;
    }
    const ab = this.show.absorb && this.absorb.find(e => e._x != null && e.i === i && Math.hypot(x - e._x, y - e._y) <= e._r + 3);
    if (ab) return absorbText(ab, dec, this.info);
    const bp = this.show.big && this._bigVis && this._bigVis.find(p => p._x != null && Math.hypot(x - p._x, y - p._y) <= p._r + 2);
    if (bp) return `Big Trade: lệnh gốc ${bp.side === "buy" ? "MUA" : "BÁN"} chủ động ${fmtVol(bp.q)} (≈ ${fmtUsd(bp.q * bp.vwap)}) lúc ${fmtTime(bp.t)}, giá trung bình ${bp.vwap.toFixed(dec)}${bp.n > 1 ? `, ghép từ ${bp.n} lệnh nhỏ, ăn qua ${bp.levels} mức giá` : ""}. Ngưỡng lệnh lớn hiện tại: ${fmtVol(this.bigQ)} (top 0,5%).`;
    const cl = this.show.cluster && this.clusters.find(c => c._x != null && c.i === i && y >= c._y0 - 2 && y <= c._y1 + 2);
    if (cl) return `Cụm khối lượng (Cluster Search) tại ${cl.price.toFixed(dec)}: bán ${fmtVol(cl.sell)} × mua ${fmtVol(cl.buy)}, tổng ${fmtVol(cl.sell + cl.buy)}, delta ${cl.buy - cl.sell >= 0 ? "+" : ""}${fmtVol(cl.buy - cl.sell)}${cl.approx ? " (footprint ước tính)" : ""}. Những ô như vậy thường là nơi phe lớn vào lệnh, giá hay phản ứng khi quay lại.`;
    for (const r of this.ranges) if (r.prof && r.prof.poc && i >= r.from && i <= r.to + 1e6) {
      for (const [p, name] of [[r.prof.poc, "POC (giá khớp nhiều nhất)"], [r.prof.vah, "VAH (cạnh trên vùng giá trị 70%)"], [r.prof.val, "VAL (cạnh dưới vùng giá trị 70%)"]]) if (Math.abs(y - this.yOf(p)) < 4) return `${name} của vùng tự chọn ${fmtTime(this.bars[r.from].t, true)} → ${fmtTime(this.bars[r.to].t, true)}: ${p.toFixed(dec)}. Tổng khối lượng ${fmtVol(r.prof.total)}, delta ${r.prof.delta >= 0 ? "+" : ""}${fmtVol(r.prof.delta)}. HVN: ${r.prof.hvn.slice(0, 4).map(v => v.toFixed(dec)).join(", ") || "-"} · LVN: ${r.prof.lvn.slice(0, 4).map(v => v.toFixed(dec)).join(", ") || "-"}. Bấm chuột phải vào vùng để xoá.`;
    }
    for (const mk of this.markers) if (mk.t === b.t && Math.abs(y - this.yOf(mk.price)) < 8) return mk.exit ? `Thoát lệnh tại ${mk.price.toFixed(dec)}` : `Vào lệnh ${mk.dir > 0 ? "LONG" : "SHORT"} tại ${mk.price.toFixed(dec)}`;
    const st = this.show.imb && this.type === "box" && this._stkVis && this._stkVis.find(v => x >= v.xa && x <= v.xb && y >= v.ya - 2 && y <= v.yb + 2 && !(b.fp && b.fp.size && x >= this.xOf(i) - this.sp * 0.44 && x <= this.xOf(i) + this.sp * 0.44 && y >= this.yOf(b.h) && y <= this.yOf(b.l)));
    if (st) { const z = st.z; return `Mất cân bằng xếp chồng ${z.n} dòng liền nhau, phe ${z.side === "buy" ? "MUA" : "BÁN"} chủ động gấp ít nhất 3 lần phe kia (so theo đường chéo), vùng ${z.lo.toFixed(dec)} – ${z.hi.toFixed(dec)}, nến ${fmtTime(z.t)}. ${z.end != null ? "Đã có nến đóng cửa xuyên qua (nét đứt)." : `Chưa bị xuyên qua: vùng ${z.side === "buy" ? "hỗ trợ" : "kháng cự"} tiềm năng.`}`; }
    if (this.show.levels) for (const lv of this.levels) if (Math.abs(y - this.yOf(lv.price)) < 4) return `${lv.kind === "support" ? "Hỗ trợ" : "Kháng cự"} ${lv.price.toFixed(dec)}: chạm ${lv.touches} lần, bị test ${lv.tests} lần, độ mạnh ${Math.round(lv.strength)}/100${lv.flipped ? ", đã đảo vai" : lv.broken ? ", đã bị phá (nét đứt)" : ", còn giữ"}.`;
    if (this.show.confl) { const c = conflTip(this.confl, y, p => this.yOf(p), dec); if (c) return c; }
    if (this.show.zones) for (const z of this.zones) if (y >= this.yOf(z.high) && y <= this.yOf(z.low) && b.t >= z.t) return `Vùng khối lượng bất thường ${z.low.toFixed(dec)} – ${z.high.toFixed(dec)}: khối lượng cao hơn bình thường ${z.z.toFixed(1)} độ lệch chuẩn, phe ${z.side === "buy" ? "mua" : "bán"} chủ động chiếm ưu thế.`;
    const d = b.d != null ? b.d : (typeof b.bv === "number" ? 2 * b.bv - b.v : null), chg = b.o ? (b.c / b.o - 1) * 100 : 0;
    const candle = `Nến ${fmtTime(b.t)} (${this.info.interval || ""}): mở ${b.o.toFixed(dec)} · cao ${b.h.toFixed(dec)} · thấp ${b.l.toFixed(dec)} · đóng ${b.c.toFixed(dec)} (${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%). ` +
      `${b.c >= b.o ? "Nến xanh: giá đóng cửa cao hơn giá mở cửa." : "Nến đỏ: giá đóng cửa thấp hơn giá mở cửa."} Thân nến là đoạn mở → đóng, râu là giá cao nhất/thấp nhất. ` +
      `Khối lượng ${fmtVol(b.v)}${d != null ? `, delta (mua − bán chủ động) ${d >= 0 ? "+" : ""}${fmtVol(d)}${this.info.deltaApprox ? " (ước tính)" : ""}` : ""}.`;
    if (this.type === "box" && b.fp) {
      const m = FP_MODES[this.fpMode] || FP_MODES.bidask, rs = this._rowStepUsed, k = Math.floor(this.pAt(y) / rs + 1e-9), r = fpRows(b, Math.max(1, Math.round(rs / this.step))).get(k);
      const cell = r ? `Ô ${(k * rs).toFixed(dec)}: bán chủ động ${fmtVol(r[0])} · mua chủ động ${fmtVol(r[1])} · tổng ${fmtVol(r[0] + r[1])} · delta ${sgn(r[1] - r[0])}. ` : "";
      return cell + (b.fpApprox ? "Footprint ước tính: chia khối lượng mua/bán của các nến nhỏ hơn lên khoảng giá (viền nét đứt). " : `Footprint thật từ từng lệnh khớp, chế độ ${m.name}: ${m.tip}; khung vàng là mức giá khớp nhiều nhất. `) + candle;
    }
    return candle;
  }

  _paneText(y, i, b, L) {
    if (y < L.cvdTop || !L.cvdH) return null;
    const t = fmtTime(b.t);
    if (this.pane === "ofi") return b.ofi == null ? `OFI (Order Flow Imbalance): chưa có cho nến ${t}. Sàn không cho tải lịch sử sổ lệnh nên OFI chỉ được ghi từ lúc mở trang.` : `OFI nến ${t}: ${b.ofi >= 0 ? "+" : ""}${fmtVol(b.ofi)}. Cộng phần lệnh chờ mua tốt nhất tăng thêm, trừ phần lệnh chờ bán tốt nhất tăng thêm. Dương = bên mua đang dồn lệnh chờ và kéo giá mua lên; âm = bên bán đang ép. OFI ngược chiều giá thường báo trước giá sắp quay đầu.`;
    if (this.pane === "vpin") { const v = this.vpinVals && this.vpinVals[i]; return v == null ? "VPIN: chưa đủ 50 giỏ khối lượng." : `VPIN nến ${t}: ${v.toFixed(3)}${this.vpinHi != null ? (v >= this.vpinHi ? " (thuộc top 10%: dòng lệnh độc)" : "") : ""}. VPIN đo mức một chiều của dòng lệnh trên 50 giỏ khối lượng gần nhất: 0 = mua bán cân bằng, càng gần 1 = một phía áp đảo. VPIN cao nghĩa là có người biết điều gì đó hoặc đang ép rất mạnh, bên tạo lập thị trường dễ rút lệnh nên giá dễ chạy mạnh.`; }
    if (this.pane === "groups") { const e = this.groupVals && this.groupVals[i]; if (!e) return `Nến ${t}: chưa có lệnh gốc để chia nhóm.`; const f = (d, v) => `${d >= 0 ? "+" : ""}${fmtVol(d)} (KL ${fmtVol(v)})`; return `Delta theo nhóm, nến ${t}: cá voi ${f(e.whale, e.whaleV)} · vừa ${f(e.mid, e.midV)} · nhỏ lẻ ${f(e.retail, e.retailV)}. Cá voi = lệnh gốc thuộc top 0,5%, vừa = top 5%, còn lại là nhỏ lẻ. Cá voi mua trong khi nhỏ lẻ bán là dấu hiệu tích luỹ.`; }
    return null;
  }

  _bind() {
    const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener("mousemove", e => {
      const p = pos(e); this.mouse = p;
      if (this.sel) { this.sel.b = Math.min(this.bars.length - 1, Math.max(0, this.iAt(p.x))); this.dirty = true; return; }
      if (this.drag) {
        if (this.drag.axis) this.yZoom = Math.min(20, Math.max(0.05, this.drag.zoom * Math.exp((p.y - this.drag.y) * 0.006)));
        else this.offset = Math.min(this._L.pw / this.sp - 3, Math.max(3 - this.bars.length, this.drag.offset - (p.x - this.drag.x) / this.sp));
      }
      this.dirty = true;
    });
    cv.addEventListener("mouseleave", () => { this.mouse = null; this.drag = null; this.dirty = true; });
    cv.addEventListener("mousedown", e => {
      const p = pos(e);
      if (e.button !== 0) return;
      if ((this.selecting || e.shiftKey) && p.x < this._L.pw && this.bars.length) { const i = Math.min(this.bars.length - 1, Math.max(0, this.iAt(p.x))); this.sel = { a: i, b: i }; return; }
      this.drag = { x: p.x, y: p.y, offset: this.offset, zoom: this.yZoom, axis: p.x > this._L.pw };
    });
    window.addEventListener("mouseup", () => {
      this.drag = null;
      if (this.sel) { const a = Math.min(this.sel.a, this.sel.b), b = Math.max(this.sel.a, this.sel.b); this.sel = null; if (b > a) { this.ranges.push({ from: a, to: b, t0: this.bars[a].t, t1: this.bars[b].t }); if (this.opts.onRange) this.opts.onRange(this.ranges); } this.dirty = true; }
    });
    cv.addEventListener("contextmenu", e => { // chuột phải: xoá vùng tự chọn dưới con trỏ
      const p = pos(e), i = this.iAt(p.x), k = this.ranges.findIndex(r => i >= r.from && i <= r.to);
      if (k >= 0) { e.preventDefault(); this.ranges.splice(k, 1); if (this.opts.onRange) this.opts.onRange(this.ranges); this.dirty = true; }
    });
    cv.addEventListener("dblclick", () => { this.offset = this._defOff(); this.yZoom = 1; this.dirty = true; });
    cv.addEventListener("wheel", e => {
      e.preventDefault(); const p = pos(e), before = this.fAt(p.x), k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const [mn, mx] = this.type === "box" ? [30, 260] : [1, 60];
      this.spacing[this.type] = Math.min(mx, Math.max(mn, this.sp * k)); this.offset -= this.fAt(p.x) - before; this.dirty = true;
    }, { passive: false });
    let touch = null;
    const spanX = e => Math.abs(e.touches[0].clientX - e.touches[1].clientX);
    cv.addEventListener("touchstart", e => {
      if (e.touches.length >= 2) { touch = { pinch: true, dx: spanX(e), sp: this.sp }; return; }
      touch = { x: e.touches[0].clientX, offset: this.offset };
    }, { passive: true });
    cv.addEventListener("touchmove", e => {
      if (!touch) return; e.preventDefault();
      if (touch.pinch) { // hai ngón: chụm/mở để thu/phóng nến
        if (e.touches.length < 2 || touch.dx < 30) return; const [mn, mx] = this.type === "box" ? [30, 260] : [1, 60];
        this.spacing[this.type] = Math.min(mx, Math.max(mn, touch.sp * spanX(e) / touch.dx)); this.dirty = true; return;
      }
      this.offset = Math.max(3 - this.bars.length, touch.offset - (e.touches[0].clientX - touch.x) / this.sp); this.dirty = true; }, { passive: false });
    cv.addEventListener("touchend", e => { touch = e.touches.length ? touch : null; });
  }
}

// Biểu đồ đường vốn và sụt giảm cho backtest
export function drawEquity(canvas, equity, capital) {
  const S = canvas._fit || (canvas._fit = fitCanvas(canvas, () => drawEquity(canvas, canvas._eq, canvas._cap)));
  canvas._eq = equity; canvas._cap = capital;
  const ctx = S.ctx, w = S.w, h = S.h, padL = 8, padR = 70, eqH = h * 0.7 - 10, ddTop = h * 0.7 + 6, ddH = h * 0.3 - 26;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
  if (!equity || equity.length < 2) { ctx.fillStyle = C.axis; ctx.font = "13px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "center"; ctx.fillText("Chưa có kết quả backtest", w / 2, h / 2); return; }
  let lo = Infinity, hi = -Infinity, peak = -Infinity; const dd = [];
  for (const p of equity) { lo = Math.min(lo, p.eq); hi = Math.max(hi, p.eq); peak = Math.max(peak, p.eq); dd.push((p.eq / peak - 1) * 100); }
  lo = Math.min(lo, capital); hi = Math.max(hi, capital);
  const minDD = Math.min(-0.01, ...dd), n = equity.length, X = i => padL + i / (n - 1) * (w - padL - padR), Y = v => 8 + (hi - v) / (hi - lo || 1) * eqH;
  ctx.strokeStyle = C.grid; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(padL, Y(capital)); ctx.lineTo(w - padR, Y(capital)); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); equity.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p.eq)) : ctx.moveTo(X(i), Y(p.eq))));
  ctx.strokeStyle = equity[n - 1].eq >= capital ? C.up : C.down; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = alpha(T.down, 0.35); ctx.beginPath(); ctx.moveTo(X(0), ddTop);
  dd.forEach((v, i) => ctx.lineTo(X(i), ddTop + v / minDD * ddH)); ctx.lineTo(X(n - 1), ddTop); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.axis; ctx.font = `11px ${MONO}`; ctx.textAlign = "left";
  ctx.fillText(hi.toFixed(0), w - padR + 6, 14); ctx.fillText(lo.toFixed(0), w - padR + 6, eqH + 8); ctx.fillText(minDD.toFixed(1) + "%", w - padR + 6, ddTop + ddH);
  ctx.fillText("Đường vốn", padL + 4, 20); ctx.fillText("Sụt giảm", padL + 4, ddTop + 12);
  const d0 = new Date(equity[0].t), d1 = new Date(equity[n - 1].t);
  ctx.fillText(`${pad2(d0.getDate())}/${pad2(d0.getMonth() + 1)}/${d0.getFullYear()}`, padL, h - 6);
  ctx.textAlign = "right"; ctx.fillText(`${pad2(d1.getDate())}/${pad2(d1.getMonth() + 1)}/${d1.getFullYear()}`, w - padR, h - 6);
}

function absorbText(e, dec, info) {
  const side = e.side === "sell", f = e.fwd, n = info.interval || "";
  let t = `${side ? "HẤP THỤ BÁN tại đáy" : "HẤP THỤ MUA tại đỉnh"} ${e.price.toFixed(dec)} (nến ${fmtTime(e.t, true)} ${n}): ` +
    `khối lượng nến ${fmtVol(e.vol)}, cao hơn bình thường ${e.z.toFixed(1)}σ; ${side ? "bán" : "mua"} chủ động ở ${side ? "1/3 dưới" : "1/3 trên"} của nến ${fmtVol(e.edgeVol)} ` +
    `(${(e.edgeShare * 100).toFixed(0)}% khối lượng nến, chiếm ${(e.edgeDom * 100).toFixed(0)}% giao dịch ở vùng đó), delta vùng ${e.edgeDelta >= 0 ? "+" : ""}${fmtVol(e.edgeDelta)}; ` +
    `giá đóng cửa ở ${(side ? e.closePos : 1 - e.closePos) * 100 | 0}% thân nến tính từ ${side ? "đáy" : "đỉnh"}. ` +
    `Nghĩa là ${side ? "lệnh chờ MUA đã đỡ hết lực bán, phe mua đang giữ giá" : "lệnh chờ BÁN đã chặn hết lực mua, phe bán đang giữ giá"}${e.exact ? "" : " (tính từ footprint ước tính nên kém chính xác hơn)"}. Độ mạnh ${e.strength}/100. `;
  if (f.result === "reversed") t += `Sau đó: giá ${side ? "tăng" : "giảm"} được ${f.bestAtr.toFixed(1)} ATR (${f.bestPct.toFixed(2)}%) trong ${f.bars} nến mà không phá ${side ? "đáy" : "đỉnh"}, tín hiệu đúng.`;
  else if (f.result === "failed") t += `Sau đó: giá phá ${side ? "đáy" : "đỉnh"} nến hấp thụ sau ${f.bars} nến, tín hiệu sai.`;
  else if (f.result === "unclear") t += `Sau đó: chưa đi được 1 ATR, cũng chưa phá ${side ? "đáy" : "đỉnh"} (không rõ).`;
  else t += "Đang chờ các nến sau để đánh giá.";
  return t;
}

function scoreText(e, dec) {
  const P = e.parts, fwd = { win: "ĐÚNG", loss: "SAI", flat: "đi ngang", pending: "đang chờ" }[e.fwd.result];
  return `Điểm tín hiệu ${e.score}/100, chiều ${e.side === "buy" ? "MUA" : "BÁN"} tại ${e.price.toFixed(dec)} (nến ${fmtTime(e.t)}). ` +
    `Thành phần: hấp thụ ${P.absorb.toFixed(0)}/35 · S/R đã test ${P.sr.toFixed(0)}/25 · CVD phân kỳ ${P.div.toFixed(0)}/25 · funding ${P.fund.toFixed(0)}/15. ` +
    `Lý do: ${e.why.join("; ") || "-"}. Sau đó: ${fwd}${e.fwd.result === "win" || e.fwd.result === "loss" ? ` sau ${e.fwd.bars} nến` : ""} (đúng = giá đi 1 ATR theo hướng tín hiệu trước khi đi ngược 1 ATR, trong 10 nến). Xem tab "Điểm tín hiệu" để biết tỷ lệ đúng của từng mức điểm.`;
}
function algoText(r, dec) {
  return `Dấu vết lệnh chia đều (thuật toán kiểu TWAP): ${r.n} lệnh ${r.side === "buy" ? "MUA" : "BÁN"} cùng kích thước ${fmtVol(r.size)}, cứ khoảng ${(r.gapMs / 1000).toFixed(1)} giây một lệnh (độ đều ${((1 - r.cv) * 100).toFixed(0)}%), ` +
    `từ ${fmtTime(r.t0, true)} đến ${fmtTime(r.t1, true)}. Tổng ${fmtVol(r.total)} (≈ ${fmtUsd(r.total * r.vwap)}), giá trung bình ${r.vwap.toFixed(dec)}, giá đi từ ${r.first.toFixed(dec)} tới ${r.last.toFixed(dec)}. ` +
    `Người thường không đặt lệnh đều như máy: đây thường là quỹ hoặc tổ chức đang ${r.side === "buy" ? "mua" : "bán"} rải để không đẩy giá.`;
}
function spoofText(e, dec) {
  const k = WALL_KIND[e.kind];
  return `Nghi tường giả (spoofing): lệnh chờ ${e.side === "bid" ? "MUA" : "BÁN"} lớn ${fmtVol(e.q)} tại ${e.price.toFixed(dec)} đứng ${(e.life / 1000).toFixed(0)} giây rồi bị rút khi giá chỉ còn cách ${e.dist.toFixed(dec)} (lúc dựng cách ${e.dist0.toFixed(dec)}). ` +
    `Chỉ ${fmtVol(e.traded)} được khớp tại đó. ${k.label}: tường dựng lên để doạ phe kia rồi rút, nên đừng tin tường này là hỗ trợ/kháng cự.`;
}
