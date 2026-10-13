// Lai Long Web: Smart Tape, băng lệnh khớp đã ghép các lệnh nhỏ thành lệnh gốc.
//
// Một lệnh market lớn ăn qua nhiều lệnh chờ bị sàn báo thành hàng trăm lệnh khớp nhỏ cùng thời điểm.
// Băng này ghép lại (market.prints) để thấy đúng kích thước lệnh gốc. Tắt "Ghép lệnh" để xem băng thô.

import { fmtVol, decimalsFor, pad2, MONO, fitCanvas, touchRows } from "./util.js?v=202610132155";
import { T, alpha } from "./theme.js?v=202610132155";
import { GROUPS, playerGroup } from "./flowtools.js?v=202610132155";

const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));

const ROW_H = 18, HDR_H = 22;
const COLS = [
  ["time", "Thời gian", 1.1, "Thời điểm khớp lệnh (giờ máy bạn)."],
  ["price", "Giá", 1.05, "Giá khớp cuối cùng của lệnh gốc."],
  ["sweep", "+/−", 0.65, "Số mức giá lệnh gốc đã ăn qua: + là mua chủ động, − là bán chủ động. Càng nhiều dấu thì lệnh càng hung hăng."],
  ["vol", "KL", 0.85, "Khối lượng của lệnh gốc sau khi ghép."],
  ["bid", "Bid", 1.05, "Giá mua tốt nhất ngay trước khi lệnh khớp."],
  ["ask", "Ask", 1.05, "Giá bán tốt nhất ngay trước khi lệnh khớp."],
  ["sizes", "Sizes", 1.5, "Khối lượng chờ ở giá mua tốt nhất × giá bán tốt nhất lúc đó."],
  ["avg", "TB", 0.75, "Khối lượng trung bình mỗi lệnh nhỏ: khối lượng chia số lệnh nhỏ được ghép."],
  ["group", "Nhóm", 0.75, "Nhóm người chơi theo kích thước lệnh gốc: Voi (cá voi) = top 0,5%, Vừa = top 5%, Lẻ (nhỏ lẻ) = còn lại. \"Máy\" = lệnh thuộc một chuỗi chia đều (thuật toán kiểu TWAP)."],
];

function hms(t) { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; }

export class Tape {
  constructor(canvas, market) {
    this.cv = canvas; this.m = market;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.smart = true; this.minQ = 0; this.bigOnly = false; this.group = ""; this.scroll = 0; this.dirty = true;
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => { this.dirty = true; }, 250);
  }
  reset() { this.scroll = 0; this.dirty = true; }

  _rowsData() {
    let list;
    if (this.smart) {
      list = this.m.prints.slice(-3000); const pend = this.m.tape.pending();
      if (pend) list.push({ ...pend, meta: this.m.tape.cur.meta, pending: true });
    } else list = this.m.trades.slice(-3000).map(t => ({ t: t.t, side: t.side, q: t.q, n: 1, p: t.p, pMin: t.p, pMax: t.p, levels: 1, vwap: t.p }));
    const min = this.bigOnly ? this.m.bigPrint : this.minQ;
    if (min > 0) list = list.filter(p => p.q >= min);
    if (this.group === "algo") list = list.filter(p => p.algo);
    else if (this.group) list = list.filter(p => playerGroup(p.q, this.m.bigPrint, this.m.midPrint) === this.group);
    return list.reverse();
  }

  get cols() {
    const tw = COLS.reduce((s, c) => s + c[2], 0); let x = 0; const out = [];
    for (const c of COLS) { const w = this.S.w * c[2] / tw; out.push({ id: c[0], label: c[1], tip: c[3], x, w }); x += w; }
    return out;
  }

  _draw() {
    const ctx = this.ctx, w = this.S.w, h = this.S.h, C = this.cols; this._C = C;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = T.panel2; ctx.fillRect(0, 0, w, HDR_H);
    const small = w < 420, font = small ? 10.5 : 11.5;
    ctx.font = `bold ${small ? 9.5 : 10.5}px Segoe UI, sans-serif`; ctx.textBaseline = "middle"; ctx.textAlign = "center"; ctx.fillStyle = T.accent;
    for (const c of C) ctx.fillText(c.label.toUpperCase(), c.x + c.w / 2, HDR_H / 2);
    const data = this._rowsData(), rows = Math.floor((h - HDR_H) / ROW_H), dec = decimalsFor(this.m.tick || 0.01);
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, data.length - rows)));
    this._data = data;
    const big = this.m.bigPrint;
    ctx.font = `11.5px ${MONO}`;
    for (let r = 0; r < rows; r++) {
      const p = data[r + this.scroll]; if (!p) break;
      const y = HDR_H + r * ROW_H, cy = y + ROW_H / 2, buy = p.side === "buy", col = buy ? T.up : T.down;
      if (p.q >= big) { ctx.fillStyle = alpha(col, 0.28); ctx.fillRect(0, y, w, ROW_H); }
      else if (r % 2) { ctx.fillStyle = alpha(T.text, 0.03); ctx.fillRect(0, y, w, ROW_H); }
      const m = p.meta || {}, sw = p.levels > 9 ? `${buy ? "+" : "−"}${p.levels}` : (buy ? "+" : "−").repeat(p.levels);
      const cells = { time: hms(p.t), price: p.p.toFixed(dec), sweep: sw, vol: fmtVol(p.q), bid: m.bb != null ? m.bb.toFixed(dec) : "", ask: m.ba != null ? m.ba.toFixed(dec) : "", sizes: m.bb != null ? `${fmtVol(m.bq)}×${fmtVol(m.aq)}` : "", avg: fmtVol(p.q / p.n) };
      const grp = isFinite(this.m.midPrint) ? GROUP[playerGroup(p.q, big, this.m.midPrint)] : null;
      cells.group = p.algo ? "Máy" : grp ? grp.short : "";
      ctx.font = `${p.q >= big ? "bold " : ""}${font}px ${MONO}`;
      for (const c of C) {
        ctx.fillStyle = c.id === "vol" || c.id === "price" || c.id === "sweep" ? col : c.id === "time" ? (p.pending ? T.muted : col) : c.id === "group" ? (p.algo ? "#c77dff" : grp ? grp.color : T.text) : T.text;
        ctx.save(); ctx.beginPath(); ctx.rect(c.x, y, c.w, ROW_H); ctx.clip();
        ctx.textAlign = c.id === "sweep" ? "left" : "right"; ctx.fillText(cells[c.id], c.id === "sweep" ? c.x + 3 : c.x + c.w - 3, cy); ctx.restore();
      }
    }
    if (!data.length) { ctx.fillStyle = T.muted; ctx.textAlign = "center"; ctx.font = "13px Segoe UI, sans-serif"; ctx.fillText("Đang chờ lệnh khớp...", w / 2, h / 2); }
    ctx.strokeStyle = T.line; ctx.beginPath(); for (const c of C) { ctx.moveTo(Math.round(c.x) + 0.5, 0); ctx.lineTo(Math.round(c.x) + 0.5, h); } ctx.moveTo(0, HDR_H - 0.5); ctx.lineTo(w, HDR_H - 0.5); ctx.stroke();
    if (this.scroll > 0) { ctx.fillStyle = alpha(T.accent, 0.9); ctx.fillRect(0, HDR_H, w, 3); }
  }

  hitTest(x, y) {
    const C = this._C; if (!C) return null;
    const col = C.find(c => x >= c.x && x < c.x + c.w);
    if (y < HDR_H) return col ? `${col.label}: ${col.tip}` : null;
    const p = this._data && this._data[Math.floor((y - HDR_H) / ROW_H) + this.scroll]; if (!p) return null;
    const dec = decimalsFor(this.m.tick || 0.01), m = p.meta || {}, coin = this.m.symbol.replace(/(USDT|USDC|USD)$/, "");
    let s = `${p.side === "buy" ? "MUA" : "BÁN"} chủ động ${fmtVol(p.q)} ${coin} (≈ ${fmtVol(p.q * p.vwap)} USD) lúc ${hms(p.t)}`;
    if (p.n > 1) s += `, ghép từ ${p.n} lệnh nhỏ cùng thời điểm, ăn qua ${p.levels} mức giá ${p.pMin.toFixed(dec)} – ${p.pMax.toFixed(dec)}, giá trung bình ${p.vwap.toFixed(dec)}`;
    s += ".";
    if (m.bb != null) s += ` Ngay trước đó: mua tốt nhất ${m.bb.toFixed(dec)} (${fmtVol(m.bq)}), bán tốt nhất ${m.ba.toFixed(dec)} (${fmtVol(m.aq)}).`;
    if (p.q >= this.m.bigPrint) s += ` Đây là lệnh lớn (top 0,5% lệnh gốc, từ ${fmtVol(this.m.bigPrint)}).`;
    else if (p.q >= this.m.midPrint) s += ` Nhóm "Vừa" (top 5% lệnh gốc, từ ${fmtVol(this.m.midPrint)}).`;
    if (p.algo) s += " Lệnh này thuộc một chuỗi lệnh cùng kích thước, nhịp đều (thuật toán chia lệnh, xem tab \"Lệnh chia đều\").";
    return s;
  }

  _bind() {
    this.cv.addEventListener("wheel", e => { e.preventDefault(); this.scroll = Math.max(0, this.scroll + (e.deltaY > 0 ? 3 : -3)); this.dirty = true; }, { passive: false });
    this.cv.addEventListener("dblclick", () => { this.scroll = 0; this.dirty = true; });
    touchRows(this.cv, ROW_H, n => { this.scroll = Math.max(0, this.scroll - n); this.dirty = true; });
  }
}
