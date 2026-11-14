// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: cột Thanh lý đứng cạnh footprint, cùng thang giá với biểu đồ.
//
// - Thanh ngang ở mỗi tầng giá: tiền thanh lý ước tính nằm tại đó, xếp chồng theo đòn bẩy (10x, 25x, 50x, 100x).
//   Dưới giá là long bị thanh lý khi giá rơi (đỏ), trên giá là short bị thanh lý khi giá lên (xanh).
//   Ước tính từ open interest mới mở ở mỗi nến và giá vào lệnh (xem liquidationMap trong analytics.js).
// - Chấm đỏ/xanh: lệnh thanh lý thật sàn vừa báo, càng mới càng sát mép phải, càng to tiền càng lớn.
// - Chân khung: tổng long/short bị thanh lý 1 giờ qua và cụm lớn nhất gần giá, để đọc "nhiên liệu nằm phía nào".
import { fmtUsd, fitCanvas, MONO, decimalsFor } from "./util.js?v=202611141528";
import { T, alpha } from "./theme.js?v=202611141528";
import { liquidationMap } from "./analytics.js?v=202611141528";

// các mức đòn bẩy vẽ tách lớp, theo lựa chọn trong khung (cao → đậm)
export const LIQ_LEVS = {
  all: [10, 25, 50, 100],
  high: [25, 50, 100],
  low: [5, 10, 25],
};
const SHADE = [0.35, 0.55, 0.75, 1]; // độ đậm theo thứ tự đòn bẩy

// ước tính thanh lý theo từng đòn bẩy, cùng một bước giá: rows: Map(k -> { long: [...], short: [...] })
export function liqTiers(bars, levs, step) {
  const rows = new Map(); let maxV = 0, totalLong = 0, totalShort = 0;
  if (!bars || !bars.length) return { step, rows, maxV, totalLong, totalShort };
  const first = liquidationMap(bars, { tiers: [[levs[0], 1]], step });
  step = first.step;
  levs.forEach((lev, li) => {
    const m = li === 0 ? first : liquidationMap(bars, { tiers: [[lev, 1]], step });
    for (const [side, list] of [["long", m.longs], ["short", m.shorts]]) {
      for (const x of list) {
        const k = Math.round(x.price / step), r = rows.get(k) || { long: levs.map(() => 0), short: levs.map(() => 0) };
        r[side][li] += x.notional; rows.set(k, r);
      }
    }
    totalLong += m.totalLong; totalShort += m.totalShort;
  });
  for (const r of rows.values()) maxV = Math.max(maxV, r.long.reduce((s, v) => s + v, 0), r.short.reduce((s, v) => s + v, 0));
  return { step, rows, maxV, totalLong, totalShort };
}

// tổng tiền thanh lý thật trong cửa sổ gần nhất
export function liqSummary(liqs, now = Date.now(), win = 3600e3) {
  let long = 0, short = 0, n = 0;
  for (let i = liqs.length - 1; i >= 0; i--) {
    const l = liqs[i]; if (now - l.t > win) break;
    const usd = l.q * l.p; n++;
    if (l.side === "long") long += usd; else short += usd;
  }
  return { long, short, n };
}

// cụm thanh lý ước tính lớn nhất mỗi phía gần giá; kết luận nhiên liệu nằm phía nào
export function liqRead(t, price) {
  if (!t || !t.rows.size || !(price > 0)) return null;
  let below = null, above = null;
  for (const [k, r] of t.rows) {
    const p = k * t.step, L = r.long.reduce((s, v) => s + v, 0), S = r.short.reduce((s, v) => s + v, 0);
    if (p < price && L > 0 && (!below || L > below.usd)) below = { price: p, usd: L };
    if (p > price && S > 0 && (!above || S > above.usd)) above = { price: p, usd: S };
  }
  const fuel = !below && !above ? null : !above || (below && below.usd > above.usd * 1.5) ? "below" : !below || above.usd > below.usd * 1.5 ? "above" : "both";
  return { below, above, fuel };
}

export class LiqColumn {
  constructor(canvas, { flow, market }) {
    this.cv = canvas; this.flow = flow; this.m = market;
    this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.tiers = null; this.levs = LIQ_LEVS.all; this.dirty = true; this._vis = []; this._dots = [];
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  setData(bars, model = "all") {
    this.levs = LIQ_LEVS[model] || LIQ_LEVS.all;
    this.tiers = bars && bars.some(b => b.oi != null) ? liqTiers(bars, this.levs) : null;
    this.dirty = true;
  }
  _draw() {
    const S = this.S, ctx = this.ctx, w = S.w, h = S.h, f = this.flow;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h);
    this._vis = []; this._dots = [];
    if (!this.cv.offsetParent) return;
    if (f && f.cv && !f.cv.offsetParent) { this._msg("Cột Thanh lý đi cùng biểu đồ 1 ô"); return; } // lưới 2/4/6: không có thang giá chung
    if (!f || !f._L || f._pmax == null || !f.bars.length) { this._msg("Chờ biểu đồ..."); return; }
    const price = this.m.last ? this.m.last.p : f.bars[f.bars.length - 1].c;
    const top = 0, ph = f._L.priceH, dotsW = 44, barX0 = 4, barW = w - dotsW - barX0 - 4;
    // thang giá mờ để đọc ngang sang biểu đồ
    ctx.strokeStyle = T.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (const p of f._ticks()) { const y = Math.round(f.yOf(p)) + 0.5; if (y < top || y > ph) continue; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    const t = this.tiers;
    if (!t || !t.rows.size) this._msg(this.m.bars && this.m.bars.some(b => b.oi != null) ? "Đang tính..." : "Sàn này không có open interest");
    else {
      let offUp = 0, offDn = 0; // tiền nằm ngoài khung giá đang xem (khung 1 phút thường chỉ rộng vài phần nghìn, cụm 25x–100x nằm xa hơn)
      for (const [k, r] of t.rows) {
        const p = k * t.step, yTop = f.yOf(p + t.step), yBot = f.yOf(p);
        if (yBot < top) { if (p > price) offUp += r.short.reduce((s, v) => s + v, 0); continue; }
        if (yTop > ph) { if (p < price) offDn += r.long.reduce((s, v) => s + v, 0); continue; }
        const isLong = p < price, vals = isLong ? r.long : r.short, tot = vals.reduce((s, v) => s + v, 0);
        if (!tot) continue;
        const col = isLong ? T.down : T.up, hh = Math.max(2, yBot - yTop - 1);
        let x = barX0;
        vals.forEach((v, li) => {
          if (!v) return;
          const ww = v / t.maxV * barW;
          ctx.fillStyle = alpha(col, SHADE[Math.min(SHADE.length - 1, li)].toFixed(2)); ctx.fillRect(x, yTop + 0.5, ww, hh); x += ww;
        });
        this._vis.push({ y0: yTop, y1: yBot, p, tot, vals, isLong });
      }
      // mũi tên ở mép trên / dưới: tổng ước tính nằm ngoài khung nhìn, để biết nhiên liệu còn ở xa phía nào
      ctx.font = `600 10px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const tag = (txt, y, col) => { const tw = ctx.measureText(txt).width + 8; ctx.fillStyle = alpha(T.bg, 0.85); ctx.fillRect(2, y - 7, tw, 14); ctx.fillStyle = col; ctx.fillText(txt, 6, y); };
      if (offUp > 0) tag(`▲ short ${fmtUsd(offUp)} phía trên`, top + 24, T.up);
      if (offDn > 0) tag(`▼ long ${fmtUsd(offDn)} phía dưới`, ph - 10, T.down);
    }
    // giá hiện tại
    const yp = f.yOf(price);
    if (yp >= top && yp <= ph) { ctx.strokeStyle = T.accent; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(0, Math.round(yp) + 0.5); ctx.lineTo(w, Math.round(yp) + 0.5); ctx.stroke(); ctx.setLineDash([]); }
    // thanh lý thật 1 giờ qua: chấm, mới nhất sát mép phải
    const now = Date.now(), liqs = this.m.liqs || [];
    let maxUsd = 0; const recent = [];
    for (let i = liqs.length - 1; i >= 0 && now - liqs[i].t <= 3600e3; i--) { recent.push(liqs[i]); maxUsd = Math.max(maxUsd, liqs[i].q * liqs[i].p); }
    ctx.fillStyle = alpha(T.muted, 0.12); ctx.fillRect(w - dotsW, top, dotsW, ph);
    for (const l of recent) {
      const y = f.yOf(l.p); if (y < top || y > ph) continue;
      const age = (now - l.t) / 3600e3, x = w - 4 - age * (dotsW - 8), usd = l.q * l.p, r = 1.5 + Math.sqrt(usd / (maxUsd || 1)) * 4.5;
      ctx.fillStyle = alpha(l.side === "long" ? T.down : T.up, 0.85); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      this._dots.push({ x, y, r, l, usd });
    }
    ctx.fillStyle = T.muted; ctx.font = `9px ${MONO}`; ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText("1 giờ", w - 4, top + 3);
    ctx.textAlign = "left"; ctx.fillText(this.levs.map(l => l + "x").join(" ▮ "), 4, top + 3);
  }
  _msg(text) { const ctx = this.ctx; ctx.fillStyle = T.muted; ctx.font = `11px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, this.S.w / 2, this.S.h / 2); }
  hitTest(x, y) {
    const dec = decimalsFor(this.m.tick || 0.01);
    for (const d of this._dots) if (Math.hypot(x - d.x, y - d.y) <= d.r + 2) return `Thanh lý thật: ${d.l.side === "long" ? "LONG" : "SHORT"} ${fmtUsd(d.usd)} tại ${d.l.p.toFixed(dec)}, ${Math.round((Date.now() - d.l.t) / 60e3)} phút trước.`;
    const r = this._vis.find(v => y >= v.y0 && y <= v.y1); if (!r) return null;
    const parts = this.levs.map((lev, i) => r.vals[i] ? `${lev}x ${fmtUsd(r.vals[i])}` : null).filter(Boolean).join(" · ");
    return `Quanh ${r.p.toFixed(dec)}: ước tính ${fmtUsd(r.tot)} ${r.isLong ? "long bị thanh lý nếu giá rơi tới đây" : "short bị thanh lý nếu giá lên tới đây"} (${parts}). Ước tính từ open interest mới mở và giá vào, không phải số thật của sàn.`;
  }
}
