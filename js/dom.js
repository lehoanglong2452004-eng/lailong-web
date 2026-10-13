// Lai Long Web: Smart DOM, sổ lệnh dạng bậc thang để soi thanh khoản và dòng lệnh.
//
// Cột (bật/tắt được): khối lượng hôm nay tại giá | giá | thay đổi lệnh chờ mua | chờ mua |
// bán chủ động đã khớp | bản đồ thanh khoản 60 giây + dấu vết giá + bong bóng lệnh khớp |
// footprint nến hiện tại | mua chủ động đã khớp | chờ bán | thay đổi lệnh chờ bán

import { fmtVol, decimalsFor, MONO, fitCanvas } from "./util.js";
import { T, alpha } from "./theme.js";

const ROW_H = 18, HDR_H = 22, MAP_MS = 60000, CHG_MS = 5000;

export const DOM_COLS = [
  { id: "today", label: "Hôm nay", w: 1.1, tip: "Khối lượng đã khớp tại mỗi giá trong ngày (giờ UTC). Thanh dài là vùng giá được giao dịch nhiều nhất hôm nay." },
  { id: "price", label: "Giá", w: 1.05, tip: "Mức giá. Ô có viền là giá khớp gần nhất; chữ đậm là giá mua/bán tốt nhất." },
  { id: "bidChg", label: "Δ Mua", w: 0.75, tip: "Lệnh chờ mua tại giá đó tăng (+) hay giảm (−) bao nhiêu trong 5 giây qua. Giảm mạnh mà không có lệnh khớp là lệnh bị rút." },
  { id: "bid", label: "Chờ mua", w: 1.25, tip: "Lệnh chờ mua (bid) đang nằm tại mỗi giá." },
  { id: "sells", label: "Bán", w: 0.85, tip: "Tổng khối lượng BÁN chủ động đã khớp tại mỗi giá kể từ lúc mở trang (hoặc lúc bấm xoá)." },
  { id: "map", label: "Bản đồ 60s", w: 1.6, tip: "Bản đồ thanh khoản 60 giây gần nhất: màu sáng là lệnh chờ dày. Đường trắng là dấu vết giá, chấm xanh/đỏ là lệnh mua/bán chủ động vừa khớp." },
  { id: "fp", label: "FP nến", w: 1.15, tip: "Footprint của nến đang chạy: bán chủ động × mua chủ động tại mỗi giá." },
  { id: "buys", label: "Mua", w: 0.85, tip: "Tổng khối lượng MUA chủ động đã khớp tại mỗi giá kể từ lúc mở trang (hoặc lúc bấm xoá)." },
  { id: "ask", label: "Chờ bán", w: 1.25, tip: "Lệnh chờ bán (ask) đang nằm tại mỗi giá." },
  { id: "askChg", label: "Δ Bán", w: 0.75, tip: "Lệnh chờ bán tại giá đó tăng (+) hay giảm (−) bao nhiêu trong 5 giây qua." },
];

// bảng màu bản đồ thanh khoản: tối -> xanh -> vàng -> trắng
const HEAT = [[0, 10, 14, 30], [0.25, 0, 90, 180], [0.5, 0, 190, 160], [0.72, 240, 210, 40], [0.88, 255, 120, 20], [1, 255, 250, 240]];
function heatColor(x) {
  let j = 0; while (j < HEAT.length - 2 && x > HEAT[j + 1][0]) j++;
  const a = HEAT[j], b = HEAT[j + 1], f = Math.min(1, Math.max(0, (x - a[0]) / (b[0] - a[0])));
  return `rgb(${a[1] + (b[1] - a[1]) * f | 0},${a[2] + (b[2] - a[2]) * f | 0},${a[3] + (b[3] - a[3]) * f | 0})`;
}

export class Dom {
  constructor(canvas, market) {
    this.cv = canvas; this.m = market;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.center = null; this.tick = 0; this.mult = 1; this.hover = null; this.follow = true; this.dirty = true;
    this.visible = new Set(DOM_COLS.map(c => c.id));
    this.snaps = []; // ảnh chụp lệnh chờ mỗi giây để tính thay đổi độ sâu
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => { this._snap(); this.dirty = true; }, 1000);
    setInterval(() => { this.dirty = true; }, 250);
  }
  reset() { this.center = null; this.tick = 0; this.follow = true; this.snaps = []; this.dirty = true; }
  recenter() { const m = this.m.book.mid(); if (m != null && this.tick) this.center = this._snapP(m); this.follow = true; this.dirty = true; }
  setColumns(ids) { this.visible = new Set(ids); this.dirty = true; }
  update() {
    const t = (this.m.tick || this.m.grid) * this.mult;
    if (t && t !== this.tick) { this.tick = t; this.center = null; this.snaps = []; }
    const mid = this.m.book.mid();
    if (mid != null && this.tick) {
      if (this.center === null) this.center = this._snapP(mid);
      const half = Math.floor(this._rows() / 2);
      if (this.follow && Math.abs((this.center - mid) / this.tick) > half * 0.6) this.center = this._snapP(mid);
    }
    this.dirty = true;
  }
  setMult(k) { this.mult = k; this.tick = 0; this.update(); }

  // vị trí các cột đang bật theo độ rộng hiện tại
  get cols() {
    const list = DOM_COLS.filter(c => this.visible.has(c.id) || c.id === "price"), tw = list.reduce((s, c) => s + c.w, 0);
    let x = 0; const out = {};
    for (const c of list) { const w = this.S.w * c.w / tw; out[c.id] = { x, w, def: c }; x += w; }
    return out;
  }
  _snapP(p) { return Math.round(p / this.tick) * this.tick; }
  _rows() { return Math.max(3, Math.floor((this.S.h - HDR_H) / ROW_H)); }
  _priceOfRow(k) { return this.center + (Math.floor(this._rows() / 2) - k) * this.tick; }
  _rowOf(p) { return Math.floor(this._rows() / 2) - Math.round((p - this.center) / this.tick); }
  _yOf(k) { return HDR_H + k * ROW_H; }

  // gộp lệnh chờ theo dòng của DOM (khoá = số bước giá tuyệt đối)
  _bookRows() {
    const { bids, asks } = this.m.book.sorted(), out = new Map(), t = this.tick;
    for (const [side, list] of [["bid", bids], ["ask", asks]]) {
      let n = 0;
      for (const [p, q] of list) { if (n++ > 1500) break; const k = Math.round(p / t), e = out.get(k) || { bid: 0, ask: 0 }; e[side] += q; out.set(k, e); }
    }
    return out;
  }
  _snap() {
    if (!this.tick) return;
    this.snaps.push({ t: Date.now(), tick: this.tick, rows: this._bookRows() });
    while (this.snaps.length > 12) this.snaps.shift();
  }

  _levels() {
    const rows = this._rows(), t = this.tick, bookRows = this._bookRows(), lv = new Map();
    for (const [k, e] of bookRows) { const r = this._rowOf(k * t); if (r >= 0 && r < rows) lv.set(r, e); }
    // thay đổi so với CHG_MS trước
    const now = Date.now(), old = this.snaps.find(s => s.tick === t && now - s.t >= CHG_MS - 500) || null, chg = new Map();
    if (old) for (let r = 0; r < rows; r++) {
      const k = Math.round(this._priceOfRow(r) / t), a = bookRows.get(k) || { bid: 0, ask: 0 }, b = old.rows.get(k) || { bid: 0, ask: 0 };
      if (a.bid !== b.bid || a.ask !== b.ask) chg.set(r, { bid: a.bid - b.bid, ask: a.ask - b.ask });
    }
    // đã khớp tại giá, khối lượng hôm nay (theo bước giá của sàn) -> dòng DOM
    const tk = this.m.tick, traded = new Map(), today = new Map();
    if (tk) {
      for (const [key, v] of this.m.tradedAt) { const r = this._rowOf(key * tk); if (r < 0 || r >= rows) continue; const e = traded.get(r) || [0, 0]; e[0] += v[0]; e[1] += v[1]; traded.set(r, e); }
      for (const [key, v] of this.m.dayVol) { const r = this._rowOf(key * tk); if (r >= 0 && r < rows) today.set(r, (today.get(r) || 0) + v); }
    }
    // footprint nến đang chạy
    const fp = new Map(), bar = this.m.bars[this.m.bars.length - 1], st = this.m.fpStep;
    if (bar && bar.fp && st) for (const [k, c] of bar.fp) { const r = this._rowOf((k + 0.5) * st); if (r < 0 || r >= rows) continue; const e = fp.get(r) || [0, 0]; e[0] += c[0]; e[1] += c[1]; fp.set(r, e); }
    const { bids, asks } = this.m.book.sorted();
    return { lv, chg, traded, today, fp, bestBid: bids.length ? this._rowOf(bids[0][0]) : null, bestAsk: asks.length ? this._rowOf(asks[0][0]) : null };
  }

  _draw() {
    const ctx = this.ctx, w = this.S.w, h = this.S.h;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h);
    const C = this.cols; this._C = C;
    this._header(C);
    if (this.center === null || !this.tick) { ctx.fillStyle = T.muted; ctx.font = "13px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Đang chờ sổ lệnh...", w / 2, h / 2); return; }
    const rows = this._rows(), dec = decimalsFor(this.tick), D = this._levels();
    this._D = D;
    let maxQ = 0, maxT = 0, maxDay = 0, maxFp = 0, maxChg = 0;
    for (const v of D.lv.values()) maxQ = Math.max(maxQ, v.bid, v.ask);
    for (const v of D.traded.values()) maxT = Math.max(maxT, v[0], v[1]);
    for (const v of D.today.values()) maxDay = Math.max(maxDay, v);
    for (const v of D.fp.values()) maxFp = Math.max(maxFp, v[0], v[1]);
    for (const v of D.chg.values()) maxChg = Math.max(maxChg, Math.abs(v.bid), Math.abs(v.ask));
    const last = this.m.last, lastRow = last ? this._rowOf(last.p) : null;
    ctx.textBaseline = "middle";
    if (C.map) this._map(C.map, rows);
    for (let k = 0; k < rows; k++) {
      const y = this._yOf(k), cy = y + ROW_H / 2, price = this._priceOfRow(k), e = D.lv.get(k), isAsk = D.bestAsk !== null ? k <= D.bestAsk : price > this.center;
      if (this.hover === k) { ctx.fillStyle = alpha(T.accent, 0.14); ctx.fillRect(0, y, w, ROW_H); }
      ctx.font = `${this.S.w < 520 ? 10.5 : 11.5}px ${MONO}`;
      const fill = (col, frac, color, fromRight) => { if (!col || !(frac > 0)) return; const bw = Math.min(1, frac) * (col.w - 4); ctx.fillStyle = color; ctx.fillRect(fromRight ? col.x + col.w - 2 - bw : col.x + 2, y + 2, bw, ROW_H - 4); };
      const text = (col, s, color, align = "right") => {
        if (!col || !s) return; ctx.save(); ctx.beginPath(); ctx.rect(col.x + 1, y, col.w - 2, ROW_H); ctx.clip();
        ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, align === "right" ? col.x + col.w - 3 : align === "left" ? col.x + 3 : col.x + col.w / 2, cy); ctx.restore();
      };
      // hôm nay
      const tv = D.today.get(k);
      if (C.today && tv) { fill(C.today, tv / maxDay, alpha(T.accent, 0.35), false); text(C.today, fmtVol(tv), T.text); }
      // giá
      if (C.price) {
        ctx.fillStyle = alpha(isAsk ? T.down : T.up, 0.1); ctx.fillRect(C.price.x, y, C.price.w, ROW_H - 1);
        const best = k === D.bestBid || k === D.bestAsk;
        ctx.font = `${best ? "bold " : ""}11.5px ${MONO}`; text(C.price, price.toFixed(dec), best ? "#fff" : T.text, "center"); ctx.font = `11.5px ${MONO}`;
        if (k === lastRow) { ctx.strokeStyle = last.side === "buy" ? T.up : T.down; ctx.lineWidth = 1.5; ctx.strokeRect(C.price.x + 1, y + 1, C.price.w - 2, ROW_H - 3); }
      }
      // thay đổi độ sâu
      const ch = D.chg.get(k);
      if (ch && maxChg) {
        if (C.bidChg && ch.bid) { fill(C.bidChg, Math.abs(ch.bid) / maxChg, alpha(ch.bid > 0 ? T.up : T.down, 0.3), true); text(C.bidChg, (ch.bid > 0 ? "+" : "−") + fmtVol(Math.abs(ch.bid)), ch.bid > 0 ? T.up : T.down); }
        if (C.askChg && ch.ask) { fill(C.askChg, Math.abs(ch.ask) / maxChg, alpha(ch.ask > 0 ? T.up : T.down, 0.3), false); text(C.askChg, (ch.ask > 0 ? "+" : "−") + fmtVol(Math.abs(ch.ask)), ch.ask > 0 ? T.up : T.down, "left"); }
      }
      // lệnh chờ
      if (e && maxQ) {
        if (C.bid && e.bid) { fill(C.bid, e.bid / maxQ, alpha(T.up, 0.38), true); text(C.bid, fmtVol(e.bid), T.text); }
        if (C.ask && e.ask) { fill(C.ask, e.ask / maxQ, alpha(T.down, 0.38), false); text(C.ask, fmtVol(e.ask), T.text, "left"); }
      }
      // đã khớp tại giá
      const tr = D.traded.get(k);
      if (tr && maxT) {
        if (C.sells && tr[0]) { fill(C.sells, tr[0] / maxT, alpha(T.down, 0.45), true); text(C.sells, fmtVol(tr[0]), T.text); }
        if (C.buys && tr[1]) { fill(C.buys, tr[1] / maxT, alpha(T.up, 0.45), false); text(C.buys, fmtVol(tr[1]), T.text, "left"); }
      }
      // footprint nến hiện tại: bán x mua, ô nổi bật khi lệch 3 lần
      const f = D.fp.get(k);
      if (C.fp && f && (f[0] || f[1])) {
        const dlt = f[1] - f[0], imb = f[1] >= 3 * f[0] ? T.up : f[0] >= 3 * f[1] ? T.down : null;
        ctx.fillStyle = alpha(dlt >= 0 ? T.up : T.down, (0.12 + 0.5 * Math.max(f[0], f[1]) / maxFp).toFixed(2)); ctx.fillRect(C.fp.x + 2, y + 1, C.fp.w - 4, ROW_H - 2);
        const cx = C.fp.x + C.fp.w / 2;
        ctx.save(); ctx.beginPath(); ctx.rect(C.fp.x + 1, y, C.fp.w - 2, ROW_H); ctx.clip();
        ctx.textAlign = "right"; ctx.fillStyle = imb === T.down ? T.down : T.text; ctx.fillText(fmtVol(f[0]), cx - 4, cy);
        ctx.textAlign = "center"; ctx.fillStyle = T.muted; ctx.fillText("×", cx, cy);
        ctx.textAlign = "left"; ctx.fillStyle = imb === T.up ? T.up : T.text; ctx.fillText(fmtVol(f[1]), cx + 4, cy);
        ctx.restore();
      }
      ctx.strokeStyle = alpha(T.line, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 0.5); ctx.lineTo(w, y + ROW_H - 0.5); ctx.stroke();
    }
    // vạch phân cách cột và đường chia giá mua / bán
    ctx.strokeStyle = T.line; ctx.beginPath();
    for (const c of Object.values(C)) { ctx.moveTo(Math.round(c.x) + 0.5, 0); ctx.lineTo(Math.round(c.x) + 0.5, h); }
    ctx.stroke();
    if (D.bestAsk !== null) { const y = this._yOf(D.bestAsk + 1) + 0.5; ctx.strokeStyle = T.text; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  _header(C) {
    const ctx = this.ctx;
    ctx.fillStyle = T.panel2; ctx.fillRect(0, 0, this.S.w, HDR_H);
    ctx.font = `bold ${this.S.w < 520 ? 9.5 : 10.5}px Segoe UI, sans-serif`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    for (const c of Object.values(C)) {
      ctx.fillStyle = T.accent; ctx.save(); ctx.beginPath(); ctx.rect(c.x, 0, c.w, HDR_H); ctx.clip();
      ctx.fillText(c.def.label.toUpperCase(), c.x + c.w / 2, HDR_H / 2); ctx.restore();
    }
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(0, HDR_H - 0.5); ctx.lineTo(this.S.w, HDR_H - 0.5); ctx.stroke();
  }

  // bản đồ thanh khoản 60 giây + dấu vết giá + bong bóng lệnh khớp
  _map(col, rows) {
    const ctx = this.ctx, cols = this.m.cols, now = Date.now(), g = this.m.grid, t = this.tick;
    ctx.save(); ctx.beginPath(); ctx.rect(col.x, HDR_H, col.w, rows * ROW_H); ctx.clip();
    ctx.fillStyle = "#05070d"; ctx.fillRect(col.x, HDR_H, col.w, rows * ROW_H);
    if (g && cols.length) {
      let i0 = cols.length; while (i0 > 0 && now - cols[i0 - 1].t < MAP_MS) i0--;
      const n = cols.length - i0, cw = col.w / (MAP_MS / 500);
      // giá trị lớn nhất để chuẩn hoá màu
      let mx = 0; const cells = [];
      let carry = null;
      for (let i = i0; i < cols.length; i++) {
        const c = cols[i].keys ? cols[i] : carry; if (!c || !c.keys) continue; carry = c;
        const x = col.x + col.w - (now - cols[i].t) / MAP_MS * col.w, agg = new Map();
        for (let j = 0; j < c.keys.length; j++) { const r = this._rowOf(c.keys[j] * g); if (r < 0 || r >= rows) continue; agg.set(r, (agg.get(r) || 0) + c.sizes[j]); }
        for (const [r, q] of agg) { mx = Math.max(mx, q); cells.push(x, r, q); }
      }
      void n;
      for (let j = 0; j < cells.length; j += 3) {
        const v = Math.pow(cells[j + 2] / (mx || 1), 0.5);
        ctx.fillStyle = heatColor(v); ctx.fillRect(cells[j], this._yOf(cells[j + 1]), cw + 0.6, ROW_H);
      }
      // dấu vết: giá giữa của từng cột
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.beginPath(); let on = false;
      for (let i = i0; i < cols.length; i++) {
        const c = cols[i]; if (c.bb == null || c.ba == null) continue;
        const x = col.x + col.w - (now - c.t) / MAP_MS * col.w, y = this._yOf(this._rowOf((c.bb + c.ba) / 2)) + ROW_H / 2;
        on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true;
      }
      ctx.stroke();
    }
    // bong bóng lệnh gốc (đã ghép) trong 60 giây
    const pr = this.m.prints; let s = pr.length, maxB = 0;
    while (s > 0 && now - pr[s - 1].t < MAP_MS) s--;
    for (let i = s; i < pr.length; i++) maxB = Math.max(maxB, pr[i].q);
    for (let i = s; i < pr.length; i++) {
      const p = pr[i], x = col.x + col.w - (now - p.t) / MAP_MS * col.w, y = this._yOf(this._rowOf(p.vwap)) + ROW_H / 2;
      const r = Math.max(1.5, Math.sqrt(p.q / (maxB || 1)) * ROW_H * 0.9);
      ctx.fillStyle = alpha(p.side === "buy" ? T.up : T.down, 0.7); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (p.q >= this.m.bigPrint) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    ctx.restore(); void t;
  }

  hitTest(x, y) {
    const C = this._C; if (!C) return null;
    const col = Object.values(C).find(c => x >= c.x && x < c.x + c.w); if (!col) return null;
    if (y < HDR_H) return `${col.def.label}: ${col.def.tip}`;
    if (this.center === null || !this.tick || !this._D) return null;
    const k = Math.floor((y - HDR_H) / ROW_H), price = this._priceOfRow(k), dec = decimalsFor(this.tick), D = this._D;
    const e = D.lv.get(k) || { bid: 0, ask: 0 }, tr = D.traded.get(k) || [0, 0], f = D.fp.get(k) || [0, 0], ch = D.chg.get(k) || { bid: 0, ask: 0 }, tv = D.today.get(k) || 0;
    const sg = v => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtVol(Math.abs(v));
    return `Giá ${price.toFixed(dec)} · chờ mua ${fmtVol(e.bid)} (5 giây: ${sg(ch.bid)}) · chờ bán ${fmtVol(e.ask)} (5 giây: ${sg(ch.ask)}) · đã khớp từ lúc mở trang: bán ${fmtVol(tr[0])}, mua ${fmtVol(tr[1])} · nến hiện tại: bán ${fmtVol(f[0])} × mua ${fmtVol(f[1])} · hôm nay ${fmtVol(tv)}. [${col.def.label}] ${col.def.tip}`;
  }

  _bind() {
    const cv = this.cv, row = e => { const r = cv.getBoundingClientRect(); return Math.floor((e.clientY - r.top - HDR_H) / ROW_H); };
    cv.addEventListener("mousemove", e => { this.hover = row(e); this.dirty = true; });
    cv.addEventListener("mouseleave", () => { this.hover = null; this.dirty = true; });
    cv.addEventListener("dblclick", () => this.recenter());
    cv.addEventListener("wheel", e => { e.preventDefault(); if (this.center === null) return; this.center += (e.deltaY < 0 ? 3 : -3) * this.tick; this.follow = false; this.dirty = true; }, { passive: false });
  }
}
