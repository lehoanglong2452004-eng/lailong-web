// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: Smart DOM, sổ lệnh dạng bậc thang để soi thanh khoản và dòng lệnh.
//
// Cột (bật/tắt được): khối lượng hôm nay | tường lệnh chờ | thay đổi chờ mua | bán đã khớp | chờ mua | giá |
// chờ bán | mua đã khớp | thay đổi chờ bán | kéo/xếp | footprint nến | cân bằng | tổng chờ.
// Kiểu vẽ: nền xám than, dải chờ mua xanh / chờ bán đỏ chạy dọc hai bên cột giá, lệnh chờ lớn bất thường
// (≥ 4 lần trung vị trong khung nhìn) tô đậm và chữ trắng đậm như "large size highlight" của Jigsaw. Bản đồ thanh khoản nằm ở khung riêng (liqmap.js), cùng dòng giá.

import { fmtVol, decimalsFor, MONO, fitCanvas, touchRows } from "./util.js?v=202611090506";
import { T, alpha } from "./theme.js?v=202611090506";

export const ROW_H = 18, HDR_H = 24;
const UI = "'Segoe UI', Inter, Roboto, 'Helvetica Neue', Arial, sans-serif";
const BG = "#0c0e11", PRICE_BG = "#12161b", GRID = "rgba(255,255,255,0.035)", SEP = "#262b33", INK = "#cfd6df", DIM = "#6f7a88";
const BIG_X = 4; // lệnh chờ lớn bất thường: gấp bấy nhiêu lần trung vị các mức trong khung nhìn
const CHG_MS = 5000;

// Mặc định là bậc thang kiểu DOM chuyên nghiệp (Jigsaw, Bookmap, ATAS): Bán đã khớp | Chờ mua | Giá | Chờ bán | Mua đã khớp,
// thêm cột Hôm nay và Tường bên trái. Các cột phân tích khác bật trong "Cột ▾".
export const DOM_COLS = [
  { id: "today", label: "Hôm nay", w: 1.1, tip: "Khối lượng đã khớp tại mỗi giá trong ngày (giờ UTC). Thanh dài là vùng giá được giao dịch nhiều nhất hôm nay." },
  { id: "walls", label: "Tường", w: 0.9, tip: "Tường lệnh chờ lớn (≥ 6 lần trung vị, top 3% quanh giá). Ô vàng = tường đang đứng và đã đứng bao lâu. \"G×n\" màu cam = số lần tường tại giá này bị rút khi giá tới gần trong 10 phút qua (nghi tường giả, spoofing)." },
  { id: "bidChg", off: true, label: "Δ Mua", w: 0.75, tip: "Lệnh chờ mua tại giá đó tăng (+) hay giảm (−) bao nhiêu trong 5 giây qua. Giảm mạnh mà không có lệnh khớp là lệnh bị rút." },
  { id: "sells", label: "Bán", w: 0.85, tip: "Tổng khối lượng BÁN chủ động đã khớp tại mỗi giá kể từ lúc mở trang (hoặc lúc bấm xoá)." },
  { id: "bid", label: "Chờ mua", w: 1.25, tip: "Lệnh chờ mua (bid) đang nằm tại mỗi giá." },
  { id: "price", label: "Giá", w: 1.05, tip: "Mức giá. Ô có viền là giá khớp gần nhất; chữ đậm là giá mua/bán tốt nhất." },
  { id: "ask", label: "Chờ bán", w: 1.25, tip: "Lệnh chờ bán (ask) đang nằm tại mỗi giá." },
  { id: "buys", label: "Mua", w: 0.85, tip: "Tổng khối lượng MUA chủ động đã khớp tại mỗi giá kể từ lúc mở trang (hoặc lúc bấm xoá)." },
  { id: "askChg", off: true, label: "Δ Bán", w: 0.75, tip: "Lệnh chờ bán tại giá đó tăng (+) hay giảm (−) bao nhiêu trong 5 giây qua." },
  { id: "pull", off: true, label: "Kéo/Xếp", w: 0.85, tip: "Lệnh chờ được XẾP thêm (+, xanh lơ) hay bị KÉO đi (−, cam) tại mỗi giá trong 5 giây qua, đã trừ phần bị khớp. Khác cột Δ: lệnh chờ giảm vì bị ăn không tính là kéo. Phía dưới giá là lệnh chờ mua, phía trên là lệnh chờ bán. Kéo mạnh ngay trước giá là bên đó đang rút lui; xếp dày là bên đó đang chặn." },
  { id: "fp", off: true, label: "FP nến", w: 1.15, tip: "Footprint của nến đang chạy: bán chủ động × mua chủ động tại mỗi giá." },
  { id: "imb", off: true, label: "Cân bằng", w: 0.8, tip: "Tỷ lệ MUA chủ động trên tổng khối lượng đã khớp tại mỗi giá (từ lúc mở trang). Thanh xanh lệch phải: bên mua áp đảo; đỏ lệch trái: bên bán áp đảo. Ô đậm khi một bên gấp 3 lần bên kia." },
  { id: "cum", off: true, label: "Tổng chờ", w: 0.9, tip: "Tổng lệnh chờ cộng dồn từ giá tốt nhất tới mức này: phía dưới cộng các lệnh chờ mua, phía trên cộng các lệnh chờ bán. Cho biết giá phải ăn qua bao nhiêu lệnh để tới đây." },
];

export class Dom {
  constructor(canvas, market) {
    this.cv = canvas; this.m = market;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.center = null; this.tick = 0; this.mult = 1; this.hover = null; this.follow = true; this.dirty = true;
    this.visible = new Set(DOM_COLS.filter(c => !c.off).map(c => c.id));
    this.snaps = []; // ảnh chụp lệnh chờ mỗi giây để tính thay đổi độ sâu
    this.walls = null; // WallTracker (app gắn vào)
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
    // cột giá cần tối thiểu ~58px để đọc đủ số (màn hình hẹp như điện thoại)
    const pw = list.length === 1 ? this.S.w : Math.min(this.S.w * 0.4, Math.max(58, this.S.w * 1.05 / tw)), rest = this.S.w - pw, tr = tw - 1.05;
    let x = 0; const out = {};
    for (const c of list) { const w = c.id === "price" ? pw : rest * c.w / tr; out[c.id] = { x, w, def: c }; x += w; }
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
    this.snaps.push({ t: Date.now(), tick: this.tick, rows: this._bookRows(), traded: this._tradedRows() });
    while (this.snaps.length > 12) this.snaps.shift();
  }

  // đã khớp cộng dồn theo dòng DOM: khoá -> [bán chủ động, mua chủ động]
  _tradedRows() {
    const tk = this.m.tick, t = this.tick, out = new Map();
    if (!tk || !t) return out;
    for (const [key, v] of this.m.tradedAt) { const k = Math.round(key * tk / t), e = out.get(k); if (e) { e[0] += v[0]; e[1] += v[1]; } else out.set(k, [v[0], v[1]]); }
    return out;
  }

  _levels() {
    const rows = this._rows(), t = this.tick, bookRows = this._bookRows(), lv = new Map();
    for (const [k, e] of bookRows) { const r = this._rowOf(k * t); if (r >= 0 && r < rows) lv.set(r, e); }
    // thay đổi so với CHG_MS trước
    const now = Date.now(), old = this.snaps.find(s => s.tick === t && now - s.t >= CHG_MS - 500) || null, chg = new Map(), pull = new Map();
    const trNow = old && old.traded ? this._tradedRows() : null;
    if (old) for (let r = 0; r < rows; r++) {
      const k = Math.round(this._priceOfRow(r) / t), a = bookRows.get(k) || { bid: 0, ask: 0 }, b = old.rows.get(k) || { bid: 0, ask: 0 };
      if (a.bid !== b.bid || a.ask !== b.ask) chg.set(r, { bid: a.bid - b.bid, ask: a.ask - b.ask });
      // kéo/xếp: lệnh chờ mua giảm vì bị bán chủ động khớp vào thì không tính là kéo (tương tự phía bán)
      if (trNow) {
        const x = trNow.get(k) || [0, 0], y = old.traded.get(k) || [0, 0], sold = x[0] - y[0], bought = x[1] - y[1];
        const bid = a.bid - b.bid + sold, ask = a.ask - b.ask + bought;
        if (Math.abs(bid) > 1e-12 || Math.abs(ask) > 1e-12) pull.set(r, { bid, ask });
      }
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
    // tường đang đứng và số lần bị rút khi giá tới gần (10 phút)
    const wallNow = new Map(), spoof = new Map();
    if (this.walls) {
      for (const wl of this.walls.active()) { const r = this._rowOf(wl.p); if (r >= 0 && r < rows) wallNow.set(r, wl); }
      for (const e of this.walls.events) if (e.kind === "spoof" && now - e.t <= 600e3) { const r = this._rowOf(e.price); if (r >= 0 && r < rows) spoof.set(r, (spoof.get(r) || 0) + 1); }
    }
    const { bids, asks } = this.m.book.sorted();
    const bestBid = bids.length ? this._rowOf(bids[0][0]) : null, bestAsk = asks.length ? this._rowOf(asks[0][0]) : null;
    // tổng lệnh chờ cộng dồn từ giá tốt nhất ra xa
    const cum = new Map();
    if (bestBid !== null) { let a = 0; for (let r = Math.max(0, bestBid); r < rows; r++) { a += (lv.get(r) || { bid: 0 }).bid; if (a) cum.set(r, { side: "bid", q: a }); } }
    if (bestAsk !== null) { let a = 0; for (let r = Math.min(rows - 1, bestAsk); r >= 0; r--) { a += (lv.get(r) || { ask: 0 }).ask; if (a) cum.set(r, { side: "ask", q: a }); } }
    // áp lực sổ lệnh: 10 mức gần nhất mỗi bên
    const top = (list) => list.slice(0, 10).reduce((x, l) => x + l[1], 0), tb = top(bids), ta = top(asks);
    // tổng kéo/xếp trong khung nhìn mỗi phía
    let pullBid = 0, pullAsk = 0;
    for (const [r, v] of pull) { if (bestAsk !== null && r <= bestAsk) pullAsk += v.ask; else pullBid += v.bid; }
    return { lv, chg, pull, pullBid, pullAsk, traded, today, fp, wallNow, spoof, cum, bookImb: tb + ta ? (tb - ta) / (tb + ta) : null, bestBid, bestAsk };
  }

  _draw() {
    const ctx = this.ctx, w = this.S.w, h = this.S.h;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
    const C = this.cols; this._C = C;
    this._header(C);
    if (this.center === null || !this.tick) { ctx.fillStyle = T.muted; ctx.font = "13px 'IBM Plex Mono', Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Đang chờ sổ lệnh...", w / 2, h / 2); return; }
    const rows = this._rows(), dec = decimalsFor(this.tick), D = this._levels();
    this._D = D;
    let maxQ = 0, maxT = 0, maxDay = 0, maxFp = 0, maxChg = 0, maxCum = 0, maxPull = 0;
    for (const [r, v] of D.pull) maxPull = Math.max(maxPull, Math.abs(D.bestAsk !== null && r <= D.bestAsk ? v.ask : v.bid));
    for (const v of D.cum.values()) maxCum = Math.max(maxCum, v.q);
    const qs = [];
    for (const v of D.lv.values()) { maxQ = Math.max(maxQ, v.bid, v.ask); if (v.bid) qs.push(v.bid); if (v.ask) qs.push(v.ask); }
    qs.sort((a, b) => a - b);
    const bigQ = qs.length >= 8 ? BIG_X * qs[qs.length >> 1] : Infinity;
    for (const v of D.traded.values()) maxT = Math.max(maxT, v[0], v[1]);
    for (const v of D.today.values()) maxDay = Math.max(maxDay, v);
    for (const v of D.fp.values()) maxFp = Math.max(maxFp, v[0], v[1]);
    for (const v of D.chg.values()) maxChg = Math.max(maxChg, Math.abs(v.bid), Math.abs(v.ask));
    const last = this.m.last, lastRow = last ? this._rowOf(last.p) : null;
    ctx.textBaseline = "middle";
    for (let k = 0; k < rows; k++) {
      const y = this._yOf(k), cy = y + ROW_H / 2, price = this._priceOfRow(k), e = D.lv.get(k), isAsk = D.bestAsk !== null ? k <= D.bestAsk : price > this.center;
      // dải nền chờ mua / chờ bán dọc hai bên cột giá
      if (C.bid && !isAsk) { ctx.fillStyle = "rgba(31,174,91,0.05)"; ctx.fillRect(C.bid.x, y, C.bid.w, ROW_H); }
      if (C.ask && isAsk) { ctx.fillStyle = "rgba(217,52,43,0.05)"; ctx.fillRect(C.ask.x, y, C.ask.w, ROW_H); }
      if (this.hover === k) { ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(0, y, w, ROW_H); }
      ctx.font = `${this.S.w < 520 ? 10.5 : 11}px ${MONO}`;
      const fill = (col, frac, color, fromRight) => { if (!col || !(frac > 0)) return; const bw = Math.min(1, frac) * (col.w - 4); ctx.fillStyle = color; ctx.fillRect(fromRight ? col.x + col.w - 2 - bw : col.x + 2, y + 2, bw, ROW_H - 4); };
      const text = (col, s, color, align = "right") => {
        if (!col || !s) return; ctx.save(); ctx.beginPath(); ctx.rect(col.x + 1, y, col.w - 2, ROW_H); ctx.clip();
        ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, align === "right" ? col.x + col.w - 3 : align === "left" ? col.x + 3 : col.x + col.w / 2, cy); ctx.restore();
      };
      // hôm nay
      const tv = D.today.get(k);
      if (C.today && tv) { fill(C.today, tv / maxDay, "rgba(120,140,170,0.28)", false); text(C.today, fmtVol(tv), DIM); }
      // giá
      if (C.price) {
        const best = k === D.bestBid || k === D.bestAsk, spread = D.bestBid !== null && D.bestAsk !== null && k > D.bestAsk && k < D.bestBid;
        ctx.fillStyle = best ? (k === D.bestBid ? "rgba(31,174,91,0.42)" : "rgba(217,52,43,0.42)") : PRICE_BG; ctx.fillRect(C.price.x, y, C.price.w, ROW_H);
        ctx.font = `${best ? "bold " : ""}11px ${MONO}`; text(C.price, price.toFixed(dec), best ? "#fff" : spread ? DIM : INK, "center"); ctx.font = `11px ${MONO}`;
        if (k === lastRow) { ctx.strokeStyle = last.side === "buy" ? "#3ddc84" : "#ff5b52"; ctx.lineWidth = 1.5; ctx.strokeRect(C.price.x + 1.5, y + 1.5, C.price.w - 3, ROW_H - 3); }
      }
      // thay đổi độ sâu
      const ch = D.chg.get(k);
      if (ch && maxChg) {
        if (C.bidChg && ch.bid) { fill(C.bidChg, Math.abs(ch.bid) / maxChg, alpha(ch.bid > 0 ? T.up : T.down, 0.3), true); text(C.bidChg, (ch.bid > 0 ? "+" : "−") + fmtVol(Math.abs(ch.bid)), ch.bid > 0 ? T.up : T.down); }
        if (C.askChg && ch.ask) { fill(C.askChg, Math.abs(ch.ask) / maxChg, alpha(ch.ask > 0 ? T.up : T.down, 0.3), false); text(C.askChg, (ch.ask > 0 ? "+" : "−") + fmtVol(Math.abs(ch.ask)), ch.ask > 0 ? T.up : T.down, "left"); }
      }
      // kéo/xếp lệnh: phía bán ở trên giá mua/bán tốt nhất, phía mua ở dưới
      const pl = D.pull.get(k);
      if (C.pull && pl && maxPull) {
        const v = isAsk ? pl.ask : pl.bid;
        if (Math.abs(v) > 1e-12) { const c = v > 0 ? "#39d5ff" : "#ff9f1a"; fill(C.pull, Math.abs(v) / maxPull, alpha(c, 0.3), !isAsk); text(C.pull, (v > 0 ? "+" : "−") + fmtVol(Math.abs(v)), c, isAsk ? "left" : "right"); }
      }
      // lệnh chờ
      if (e && maxQ) {
        // lệnh chờ lớn bất thường: thanh đậm, chữ trắng đậm
        const side = (col, q, rgb, fromRight) => {
          if (!col || !q) return; const big = q >= bigQ;
          fill(col, q / maxQ, `rgba(${rgb},${big ? 0.75 : 0.32})`, fromRight);
          if (big) ctx.font = `bold 11px ${MONO}`;
          text(col, fmtVol(q), big ? "#fff" : INK, fromRight ? "right" : "left"); ctx.font = `11px ${MONO}`;
        };
        side(C.bid, e.bid, "31,174,91", true); side(C.ask, e.ask, "217,52,43", false);
      }
      // đã khớp tại giá
      const tr = D.traded.get(k);
      if (tr && maxT) {
        if (C.sells && tr[0]) { fill(C.sells, tr[0] / maxT, "rgba(217,52,43,0.22)", true); text(C.sells, fmtVol(tr[0]), "#e8857f"); }
        if (C.buys && tr[1]) { fill(C.buys, tr[1] / maxT, "rgba(31,174,91,0.22)", false); text(C.buys, fmtVol(tr[1]), "#6fd69b", "left"); }
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
      // cân bằng mua/bán đã khớp tại giá
      if (C.imb && tr && tr[0] + tr[1] > 0) {
        const share = tr[1] / (tr[0] + tr[1]), d = share - 0.5, strong = tr[1] >= 3 * tr[0] || tr[0] >= 3 * tr[1], mid = C.imb.x + C.imb.w / 2;
        ctx.fillStyle = alpha(d >= 0 ? T.up : T.down, strong ? 0.6 : 0.3); ctx.fillRect(d >= 0 ? mid : mid + d * (C.imb.w - 4), y + 2, Math.abs(d) * (C.imb.w - 4), ROW_H - 4);
        ctx.font = `${strong ? "bold " : ""}11px ${MONO}`; text(C.imb, `${Math.round(share * 100)}%`, strong ? "#fff" : T.text, "center"); ctx.font = `11px ${MONO}`;
      }
      // tổng lệnh chờ cộng dồn
      const cu = D.cum.get(k);
      if (C.cum && cu && maxCum) { fill(C.cum, cu.q / maxCum, alpha(cu.side === "bid" ? T.up : T.down, 0.16), cu.side === "bid"); text(C.cum, fmtVol(cu.q), T.muted); }
      if (C.walls) {
        const wl = D.wallNow.get(k), sc = D.spoof.get(k);
        if (wl) { ctx.fillStyle = alpha("#f5c542", 0.35); ctx.fillRect(C.walls.x + 2, y + 2, C.walls.w - 4, ROW_H - 4); text(C.walls, `${((Date.now() - wl.t0) / 1000).toFixed(0)}s`, T.text, sc ? "left" : "right"); }
        if (sc) text(C.walls, `G×${sc}`, "#ff9f1a");
      }
      ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 0.5); ctx.lineTo(w, y + ROW_H - 0.5); ctx.stroke();
    }
    // vạch phân cách cột và đường chia giá mua / bán
    ctx.strokeStyle = SEP; ctx.lineWidth = 1; ctx.beginPath();
    for (const c of Object.values(C)) { if (!c.x) continue; ctx.moveTo(Math.round(c.x) + 0.5, HDR_H); ctx.lineTo(Math.round(c.x) + 0.5, h); }
    ctx.stroke();
    if (D.bestAsk !== null) { const y = this._yOf(D.bestAsk + 1) + 0.5; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  _header(C) {
    const ctx = this.ctx;
    ctx.fillStyle = "#191d23"; ctx.fillRect(0, 0, this.S.w, HDR_H);
    ctx.font = `600 ${this.S.w < 520 ? 10.5 : 11.5}px ${UI}`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    const tint = { bid: "#6fd69b", sells: "#e8857f", ask: "#e8857f", buys: "#6fd69b", price: INK };
    for (const c of Object.values(C)) {
      ctx.fillStyle = tint[c.def.id] || "#8b95a3"; ctx.save(); ctx.beginPath(); ctx.rect(c.x, 0, c.w, HDR_H); ctx.clip();
      ctx.fillText(c.def.label, c.x + c.w / 2, HDR_H / 2); ctx.restore();
      if (c.x) { ctx.fillStyle = SEP; ctx.fillRect(Math.round(c.x), 4, 1, HDR_H - 8); }
    }
    // áp lực 10 mức gần nhất: vạch màu dưới tiêu đề (xanh dài = bên chờ mua dày hơn)
    const bi = this._D && this._D.bookImb;
    if (bi != null) { const w = this.S.w, mid = w / 2; ctx.fillStyle = alpha(bi >= 0 ? T.up : T.down, 0.7); ctx.fillRect(bi >= 0 ? mid : mid + bi * mid, HDR_H - 2, Math.abs(bi) * mid, 2); }
    ctx.strokeStyle = SEP; ctx.beginPath(); ctx.moveTo(0, HDR_H - 0.5); ctx.lineTo(this.S.w, HDR_H - 0.5); ctx.stroke();
  }

  hitTest(x, y) {
    const C = this._C; if (!C) return null;
    const col = Object.values(C).find(c => x >= c.x && x < c.x + c.w); if (!col) return null;
    if (y < HDR_H) return `${col.def.label}: ${col.def.tip}`;
    if (this.center === null || !this.tick || !this._D) return null;
    const k = Math.floor((y - HDR_H) / ROW_H), price = this._priceOfRow(k), dec = decimalsFor(this.tick), D = this._D;
    const e = D.lv.get(k) || { bid: 0, ask: 0 }, tr = D.traded.get(k) || [0, 0], f = D.fp.get(k) || [0, 0], ch = D.chg.get(k) || { bid: 0, ask: 0 }, tv = D.today.get(k) || 0;
    const sg = v => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtVol(Math.abs(v));
    const wl = D.wallNow && D.wallNow.get(k), sc = D.spoof && D.spoof.get(k);
    const wallTxt = (wl ? ` · TƯỜNG ${wl.side === "bid" ? "MUA" : "BÁN"} ${fmtVol(wl.q)} đang đứng ${((Date.now() - wl.t0) / 1000).toFixed(0)} giây` : "") + (sc ? ` · ${sc} lần tường bị rút khi giá tới gần trong 10 phút (nghi tường giả)` : "");
    const cu = D.cum && D.cum.get(k), bi = D.bookImb, pl = D.pull && D.pull.get(k);
    const pullTxt = (pl ? ` · 5 giây qua đã trừ phần bị khớp: chờ mua ${pl.bid >= 0 ? "xếp thêm" : "bị kéo"} ${fmtVol(Math.abs(pl.bid))}, chờ bán ${pl.ask >= 0 ? "xếp thêm" : "bị kéo"} ${fmtVol(Math.abs(pl.ask))}` : "") +
      (D.pull ? ` · cả khung nhìn: phía mua ${sg(D.pullBid)}, phía bán ${sg(D.pullAsk)}` : "");
    const extra = (cu ? ` · tổng chờ ${cu.side === "bid" ? "mua" : "bán"} cộng dồn tới đây ${fmtVol(cu.q)}` : "") + (tr[0] + tr[1] ? ` · mua chủ động chiếm ${Math.round(tr[1] / (tr[0] + tr[1]) * 100)}% khối lượng đã khớp ở giá này` : "") +
      (bi != null ? ` · 10 mức gần nhất: chờ mua ${bi >= 0 ? "dày hơn" : "mỏng hơn"} chờ bán ${Math.abs(bi * 100).toFixed(0)}%` : "");
    return `Giá ${price.toFixed(dec)}${extra}${pullTxt} · chờ mua ${fmtVol(e.bid)} (5 giây: ${sg(ch.bid)}) · chờ bán ${fmtVol(e.ask)} (5 giây: ${sg(ch.ask)}) · đã khớp từ lúc mở trang: bán ${fmtVol(tr[0])}, mua ${fmtVol(tr[1])} · nến hiện tại: bán ${fmtVol(f[0])} × mua ${fmtVol(f[1])} · hôm nay ${fmtVol(tv)}${wallTxt}. [${col.def.label}] ${col.def.tip}`;
  }

  _bind() {
    const cv = this.cv, row = e => { const r = cv.getBoundingClientRect(); return Math.floor((e.clientY - r.top - HDR_H) / ROW_H); };
    cv.addEventListener("mousemove", e => { this.hover = row(e); this.dirty = true; });
    cv.addEventListener("mouseleave", () => { this.hover = null; this.dirty = true; });
    cv.addEventListener("dblclick", () => this.recenter());
    cv.addEventListener("wheel", e => { e.preventDefault(); if (this.center === null) return; this.center += (e.deltaY < 0 ? 3 : -3) * this.tick; this.follow = false; this.dirty = true; }, { passive: false });
    touchRows(cv, ROW_H, n => { if (this.center === null) return; this.center += n * this.tick; this.follow = false; this.dirty = true; });
  }
}
