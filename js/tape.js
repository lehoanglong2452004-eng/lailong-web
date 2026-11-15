// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: Smart Tape, băng lệnh khớp đã ghép các lệnh nhỏ thành lệnh gốc.
//
// Một lệnh market lớn ăn qua nhiều lệnh chờ bị sàn báo thành hàng trăm lệnh khớp nhỏ cùng thời điểm.
// Băng này ghép lại (market.prints) để thấy đúng kích thước lệnh gốc. Tắt "gộp lệnh gốc" để xem băng thô.
// Ba chế độ: Lệnh khớp (mọi lệnh), Lệnh lớn (top 0,5%), Hấp thụ (iceberg giữ giá và nến hấp thụ).
// Bên phải: khối lượng đã khớp tại mỗi mức giá trong 5 / 15 / 30 / 60 phút gần nhất, ô cam là giá hiện tại.

import { fmtVol, decimalsFor, pad2, MONO, fitCanvas, touchRows } from "./util.js?v=202611150629";
import { T, alpha, chrome, isLight } from "./theme.js?v=202611150629";
import { GROUPS, playerGroup } from "./flowtools.js?v=202611150629";

const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));
const UI = "'Segoe UI', Inter, Roboto, 'Helvetica Neue', Arial, sans-serif";
const ROW_H = 19, HDR_H = 22, HIST_TOP = 20;
const COLS = [
  ["time", "Giờ", 1.2, "Thời điểm khớp lệnh (giờ máy bạn)."],
  ["price", "Giá", 1.05, "Giá khớp cuối cùng của lệnh gốc."],
  ["vol", "KL", 0.8, "Khối lượng của lệnh gốc sau khi ghép."],
  ["side", "Phe", 0.45, "Chấm xanh: mua chủ động, chấm đỏ: bán chủ động. Chấm càng to lệnh càng lớn."],
  ["note", "Ghi chú", 1.5, "Gộp bao nhiêu lệnh nhỏ, quét qua mấy mức giá, lệnh lớn, lệnh máy chia đều, hoặc bị hấp thụ tại một mức có lệnh băng chìm."],
];

// nhịp băng lệnh: tốc độ, mua/bán chủ động và lệnh lớn nhất trong cửa sổ gần nhất, so với nhịp trung bình 5 phút
export function tapeStats(prints, now = Date.now(), win = 60e3) {
  let buy = 0, sell = 0, n = 0, n5 = 0, big = null, oldest = now, buy5 = 0, sell5 = 0;
  for (let i = prints.length - 1; i >= 0; i--) {
    const p = prints[i], age = now - p.t; if (age > 300e3) break; if (age < 0) continue;
    n5++; oldest = p.t; if (p.side === "buy") buy5 += p.q; else sell5 += p.q;
    if (age <= win) { n++; if (p.side === "buy") buy += p.q; else sell += p.q; if (!big || p.q > big.q) big = p; }
  }
  // mới mở trang chưa đủ dữ liệu thì chưa so sánh tốc độ
  const span = (now - oldest) / 1000, rate = n / (win / 1000), avg = span >= 2 * win / 1000 ? n5 / Math.min(300, span) : null;
  return { buy, sell, delta: buy - sell, n, rate, avg, speed: avg ? rate / avg : null, big, buy5, sell5 };
}

// khối lượng khớp theo giá, gom theo phút: cộng dồn nhanh cho cửa sổ 5 / 15 / 30 / 60 phút
export class PriceVolume {
  constructor() { this.min = new Map(); this.tick = 0; }
  reset(tick = 0) { this.min.clear(); this.tick = tick; }
  add(list) {
    if (!this.tick) return;
    for (const t of list) {
      const m = Math.floor(t.t / 60e3), k = Math.round(t.p / this.tick);
      let b = this.min.get(m); if (!b) { b = new Map(); this.min.set(m, b); }
      const e = b.get(k) || [0, 0]; e[t.side === "buy" ? 1 : 0] += t.q; b.set(k, e);
    }
    if (this.min.size > 70) { const keep = Math.floor(Date.now() / 60e3) - 61; for (const m of this.min.keys()) if (m < keep) this.min.delete(m); }
  }
  // tổng theo giá trong `mins` phút gần nhất: Map(k -> [bán, mua])
  window(mins, now = Date.now()) {
    const from = Math.floor(now / 60e3) - mins + 1, out = new Map();
    for (const [m, b] of this.min) { if (m < from) continue; for (const [k, e] of b) { const o = out.get(k); if (o) { o[0] += e[0]; o[1] += e[1]; } else out.set(k, [e[0], e[1]]); } }
    return out;
  }
}

// gom các mức giá thành `rows` dòng quanh giá hiện tại (mỗi dòng g bước giá); trả về từ giá cao xuống thấp
export function histRows(win, curK, rows) {
  if (!win.size || rows < 1) return { g: 1, list: [] };
  let lo = Infinity, hi = -Infinity; for (const k of win.keys()) { lo = Math.min(lo, k); hi = Math.max(hi, k); }
  if (curK != null) { lo = Math.min(lo, curK); hi = Math.max(hi, curK); }
  const g = Math.max(1, Math.ceil((hi - lo + 1) / rows)), c = curK != null ? Math.floor(curK / g) : Math.floor((lo + hi) / 2 / g);
  const top = c + Math.floor(rows / 2), list = [];
  for (let r = 0; r < rows; r++) list.push({ g: top - r, s: 0, b: 0 });
  for (const [k, e] of win) { const r = top - Math.floor(k / g); if (r >= 0 && r < rows) { list[r].s += e[0]; list[r].b += e[1]; } }
  return { g, list, cur: curK != null ? top - Math.floor(curK / g) : -1 };
}

function hms(t) { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; }

export class Tape {
  constructor(canvas, market) {
    this.cv = canvas; this.m = market;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.smart = true; this.minQ = 0; this.bigOnly = false; this.group = ""; this.mode = "all"; this.scroll = 0; this.dirty = true;
    this.pv = new PriceVolume(); this.winMin = 30; this.absorbEvents = []; this.hover = null;
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => { this.dirty = true; }, 250);
  }
  reset() { this.scroll = 0; this.pv.reset(); this.dirty = true; }
  addTrades(list) { if (!this.pv.tick && this.m.tick) this.pv.tick = this.m.tick; this.pv.add(list); }
  get stats() { return tapeStats(this.smart ? this.m.prints : this.m.trades); }

  // iceberg đang sống hoặc vừa giữ được giá: khoá giá -> sự kiện, để ghi "hấp thụ" lên lệnh khớp tại đó
  _iceAt() {
    const out = new Map(), tk = this.m.tick, now = Date.now(); if (!tk || !this.m.ice) return out;
    for (const e of this.m.ice.events) if (e.status === "live" || now - (e.t1 || e.t) < 120e3) out.set(Math.round(e.price / tk), e);
    return out;
  }
  _rowsData() {
    if (this.mode === "absorb") return this._absorbRows();
    let list;
    if (this.smart) {
      list = this.m.prints.slice(-3000); const pend = this.m.tape.pending();
      if (pend) list.push({ ...pend, meta: this.m.tape.cur.meta, pending: true });
    } else list = this.m.trades.slice(-3000).map(t => ({ t: t.t, side: t.side, q: t.q, n: 1, p: t.p, pMin: t.p, pMax: t.p, levels: 1, vwap: t.p }));
    const min = this.bigOnly || this.mode === "big" ? this.m.bigPrint : this.minQ;
    if (min > 0) list = list.filter(p => p.q >= min);
    if (this.group === "algo") list = list.filter(p => p.algo);
    else if (this.group) list = list.filter(p => playerGroup(p.q, this.m.bigPrint, this.m.midPrint) === this.group);
    return list.reverse();
  }
  // tab Hấp thụ: lệnh băng chìm (bị khớp nhiều hơn lượng hiện trên sổ mà giá vẫn đứng) và nến hấp thụ
  _absorbRows() {
    const out = [];
    for (const e of this.m.ice ? this.m.ice.events : []) out.push({ t: e.t1 || e.t, p: e.price, q: e.filled, side: e.side === "bid" ? "sell" : "buy", ice: e });
    for (const a of this.absorbEvents || []) out.push({ t: a.t, p: a.price, q: a.edgeVol || a.vol, side: a.side, abs: a });
    return out.sort((a, b) => b.t - a.t).slice(0, 400);
  }
  _note(p, iceAt) {
    if (p.ice) { const e = p.ice, st = { live: "đang giữ", held: "đã giữ giá", broken: "đã thủng" }[e.status] || ""; return `◆ iceberg ${e.side === "bid" ? "chờ mua" : "chờ bán"} · hiện ${fmtVol(e.disp)} · ${st}`; }
    if (p.abs) return `nến hấp thụ ${p.side === "sell" ? "bán" : "mua"} · độ mạnh ${p.abs.strength}`;
    const parts = [];
    const tk = this.m.tick, ice = tk && iceAt.get(Math.round(p.p / tk));
    if (ice && (ice.side === "bid") === (p.side === "sell")) parts.push(`hấp thụ ${p.p.toFixed(decimalsFor(tk))}`);
    if (p.n > 1) parts.push(`gộp ${p.n} lệnh`);
    if (p.levels >= 3) parts.push(`quét ${p.levels} mức`);
    if (p.algo) parts.push("máy chia lệnh");
    return parts.join(" · ");
  }

  get histW() { return 0; } // KL khớp theo giá đã tách thành ô riêng (KL theo giá)
  get cols() {
    const W = this.S.w - this.histW, tw = COLS.reduce((s, c) => s + c[2], 0); let x = 0; const out = [];
    for (const c of COLS) { const w = W * c[2] / tw; out.push({ id: c[0], label: c[1], tip: c[3], x, w }); x += w; }
    return out;
  }

  _draw() {
    const ctx = this.ctx, w = this.S.w, h = this.S.h, C = this.cols, HW = this.histW, W = w - HW; this._C = C;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = chrome()["pro-head"]; ctx.fillRect(0, 0, W, HDR_H);
    const small = W < 300, font = small ? 10.5 : 11.5;
    ctx.font = `600 ${small ? 10.5 : 11.5}px ${UI}`; ctx.textBaseline = "middle"; ctx.fillStyle = chrome().dim;
    for (const c of C) { ctx.textAlign = c.id === "note" || c.id === "side" ? "left" : "right"; ctx.fillText(c.label, c.id === "note" || c.id === "side" ? c.x + 4 : c.x + c.w - 4, HDR_H / 2); }
    const data = this._rowsData(), rows = Math.floor((h - HDR_H) / ROW_H), dec = decimalsFor(this.m.tick || 0.01);
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, data.length - rows)));
    this._data = data;
    const big = this.m.bigPrint, iceAt = this._iceAt();
    for (let r = 0; r < rows; r++) {
      const p = data[r + this.scroll]; if (!p) break;
      const y = HDR_H + r * ROW_H, cy = y + ROW_H / 2, buy = p.side === "buy", col = buy ? T.tapeBuy : T.tapeSell, isBig = p.q >= big;
      if (isBig) { ctx.fillStyle = alpha(col, 0.22); ctx.fillRect(0, y, W, ROW_H); }
      else if (r % 2) { ctx.fillStyle = alpha(T.text, 0.025); ctx.fillRect(0, y, W, ROW_H); }
      const note = this._note(p, iceAt), grp = !p.ice && !p.abs && isFinite(this.m.midPrint) ? GROUP[playerGroup(p.q, big, this.m.midPrint)] : null;
      const cells = { time: hms(p.t), price: p.p.toFixed(dec), vol: fmtVol(p.q) };
      ctx.font = `${isBig ? "bold " : ""}${font}px ${MONO}`; ctx.textAlign = "right";
      for (const c of C) {
        if (!cells[c.id]) continue;
        ctx.fillStyle = c.id === "time" ? (p.pending ? T.muted : "#9aa4b1") : col;
        ctx.save(); ctx.beginPath(); ctx.rect(c.x, y, c.w, ROW_H); ctx.clip(); ctx.fillText(cells[c.id], c.x + c.w - 4, cy + 0.5); ctx.restore();
      }
      const sc = C.find(c => c.id === "side"), rad = Math.max(2, Math.min(ROW_H / 2 - 1.5, 2 + 6 * Math.sqrt(Math.min(1, p.q / (isFinite(big) && big > 0 ? big : p.q * 4)))));
      ctx.fillStyle = alpha(col, isBig ? 1 : 0.85); ctx.beginPath(); ctx.arc(sc.x + 4 + rad, cy, rad, 0, Math.PI * 2); ctx.fill();
      const nc = C.find(c => c.id === "note");
      if (note || grp) {
        ctx.save(); ctx.beginPath(); ctx.rect(nc.x, y, nc.w, ROW_H); ctx.clip(); ctx.font = `${font - 0.5}px ${UI}`; ctx.textAlign = "left";
        ctx.fillStyle = p.ice ? "#4aa3ff" : note.startsWith("hấp thụ") ? "#ff9f1c" : isLight() ? "#4f5a68" : "#b9c2ce"; ctx.fillText(note || (grp && grp.id === "whale" ? grp.short : ""), nc.x + 4, cy + 0.5); ctx.restore();
      }
    }
    if (!data.length) { ctx.fillStyle = T.muted; ctx.textAlign = "center"; ctx.font = `12px ${UI}`; ctx.fillText(this.mode === "absorb" ? "Chưa thấy lệnh băng chìm hay nến hấp thụ nào" : "Đang chờ lệnh khớp...", W / 2, h / 2); }
    ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(0, HDR_H - 0.5); ctx.lineTo(W, HDR_H - 0.5); ctx.stroke();
    if (this.scroll > 0) { ctx.fillStyle = alpha(T.accent, 0.9); ctx.fillRect(0, HDR_H, W, 3); }
  }

  hitTest(x, y) {
    const C = this._C; if (!C) return null;
    const col = C.find(c => x >= c.x && x < c.x + c.w);
    if (y < HDR_H) return col ? `${col.label}: ${col.tip}` : null;
    const p = this._data && this._data[Math.floor((y - HDR_H) / ROW_H) + this.scroll]; if (!p) return null;
    const dec = decimalsFor(this.m.tick || 0.01), m = p.meta || {}, coin = this.m.symbol.replace(/(USDT|USDC|USD)$/, "");
    if (p.ice) { const e = p.ice; return `Lệnh băng chìm ${e.side === "bid" ? "CHỜ MUA" : "CHỜ BÁN"} tại ${e.price.toFixed(dec)}: đã khớp ${fmtVol(e.filled)} ${coin} trong khi sổ lệnh chỉ hiện tối đa ${fmtVol(e.disp)} (ẩn khoảng ${fmtVol(e.hidden)}), ${e.n} lệnh khớp vào, ${e.status === "live" ? "vẫn đang giữ" : e.status === "held" ? "đã giữ được giá" : "đã bị xuyên"}.`; }
    if (p.abs) { const a = p.abs; return `Nến hấp thụ lúc ${hms(a.t)}: ${a.side === "sell" ? "bán chủ động đập mạnh ở đáy nến nhưng giá không giảm tiếp" : "mua chủ động dồn ở đỉnh nến nhưng giá không lên tiếp"}, khối lượng phần mép ${fmtVol(a.edgeVol)} (${Math.round(a.edgeShare * 100)}% cả nến), độ mạnh ${a.strength}/100.`; }
    let s = `${p.side === "buy" ? "MUA" : "BÁN"} chủ động ${fmtVol(p.q)} ${coin} (≈ ${fmtVol(p.q * p.vwap)} USD) lúc ${hms(p.t)}`;
    if (p.n > 1) s += `, ghép từ ${p.n} lệnh nhỏ cùng thời điểm, ăn qua ${p.levels} mức giá ${p.pMin.toFixed(dec)} – ${p.pMax.toFixed(dec)}, giá trung bình ${p.vwap.toFixed(dec)}`;
    s += ".";
    if (m.bb != null) s += ` Ngay trước đó: mua tốt nhất ${m.bb.toFixed(dec)} (${fmtVol(m.bq)}), bán tốt nhất ${m.ba.toFixed(dec)} (${fmtVol(m.aq)}).`;
    if (p.q >= this.m.bigPrint) s += ` Đây là lệnh lớn (top 0,5% lệnh gốc, từ ${fmtVol(this.m.bigPrint)}).`;
    else if (p.q >= this.m.midPrint) s += ` Nhóm "Vừa" (top 5% lệnh gốc, từ ${fmtVol(this.m.midPrint)}).`;
    if (p.algo) s += " Lệnh này thuộc một chuỗi lệnh cùng kích thước, nhịp đều (thuật toán chia lệnh).";
    return s;
  }

  _bind() {
    this.cv.addEventListener("wheel", e => { e.preventDefault(); this.scroll = Math.max(0, this.scroll + (e.deltaY > 0 ? 3 : -3)); this.dirty = true; }, { passive: false });
    this.cv.addEventListener("dblclick", () => { this.scroll = 0; this.dirty = true; });
    touchRows(this.cv, ROW_H, n => { this.scroll = Math.max(0, this.scroll - n); this.dirty = true; });
  }
}
