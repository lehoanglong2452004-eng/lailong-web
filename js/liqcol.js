// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: cột Thanh lý đứng cạnh footprint, cùng thang giá với biểu đồ.
//
// - Thanh ngang ở mỗi tầng giá: tiền thanh lý ước tính nằm tại đó, xếp chồng theo đòn bẩy (10x, 25x, 50x, 100x).
//   Dưới giá là long bị thanh lý khi giá rơi (đỏ), trên giá là short bị thanh lý khi giá lên (xanh).
//   Ước tính từ open interest mới mở ở mỗi nến và giá vào lệnh (xem liquidationMap trong analytics.js).
// - Chấm đỏ/xanh: lệnh thanh lý thật sàn vừa báo, càng mới càng sát mép phải, càng to tiền càng lớn.
// - Chân khung: tổng long/short bị thanh lý 1 giờ qua và cụm lớn nhất gần giá, để đọc "nhiên liệu nằm phía nào".
import { fmtUsd, fitCanvas, MONO, decimalsFor } from "./util.js?v=202611142030";
import { T, alpha } from "./theme.js?v=202611142030";
import { liquidationMap } from "./analytics.js?v=202611142030";

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
  if (!bars || !bars.length) return { step, rows, maxV, totalLong, totalShort, levs };
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
  return { step, rows, maxV, totalLong, totalShort, levs };
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
  // đòn bẩy góp nhiều tiền nhất ở cụm đó và khoảng cách tới giá (phần trăm)
  const lev = vals => { let bi = 0; vals.forEach((v, i) => { if (v > vals[bi]) bi = i; }); return t.levs ? t.levs[bi] : null; };
  for (const [k, r] of t.rows) {
    const p = k * t.step, L = r.long.reduce((s, v) => s + v, 0), S = r.short.reduce((s, v) => s + v, 0);
    if (p < price && L > 0 && (!below || L > below.usd)) below = { price: p, usd: L, side: "long", lev: lev(r.long), dist: (price - p) / price * 100 };
    if (p > price && S > 0 && (!above || S > above.usd)) above = { price: p, usd: S, side: "short", lev: lev(r.short), dist: (p - price) / price * 100 };
  }
  const fuel = !below && !above ? null : !above || (below && below.usd > above.usd * 1.5) ? "below" : !below || above.usd > below.usd * 1.5 ? "above" : "both";
  const big = !below ? above : !above ? below : below.usd >= above.usd ? below : above;
  return { below, above, fuel, big };
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
    const top = 0, ph = f._L.priceH, gut = w >= 150 ? 48 : 4, dotsW = Math.min(44, Math.round(w * 0.2)), barX0 = gut, barW = Math.max(10, w - dotsW - barX0 - 4);
    const dec = decimalsFor(this.m.tick || 0.01);
    // thang giá mờ để đọc ngang sang biểu đồ, nhãn giá ở mép trái
    ctx.strokeStyle = T.grid; ctx.lineWidth = 1; ctx.beginPath();
    const ticks = f._ticks();
    for (const p of ticks) { const y = Math.round(f.yOf(p)) + 0.5; if (y < top || y > ph) continue; ctx.moveTo(gut, y); ctx.lineTo(w, y); }
    ctx.stroke();
    if (gut > 4) {
      ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = T.muted;
      const yp0 = f.yOf(price);
      for (const p of ticks) { const y = f.yOf(p); if (y < top + 28 || y > ph - 6 || Math.abs(y - yp0) < 10) continue; ctx.fillText(p.toFixed(dec), gut - 6, y); }
    }
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
      const tag = (txt, y, col) => { const tw = ctx.measureText(txt).width + 8; ctx.fillStyle = alpha(T.bg, 0.85); ctx.fillRect(barX0, y - 7, tw, 14); ctx.fillStyle = col; ctx.fillText(txt, barX0 + 4, y); };
      if (offUp > 0) tag(`▲ short ${fmtUsd(offUp)} phía trên`, top + 34, T.up);
      if (offDn > 0) tag(`▼ long ${fmtUsd(offDn)} phía dưới`, ph - 10, T.down);
    }
    // giá hiện tại
    const yp = f.yOf(price);
    if (yp >= top && yp <= ph) {
      ctx.strokeStyle = T.accent; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(gut, Math.round(yp) + 0.5); ctx.lineTo(w, Math.round(yp) + 0.5); ctx.stroke(); ctx.setLineDash([]);
      if (gut > 4) { ctx.font = `600 10px ${MONO}`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = T.accent; ctx.fillText(price.toFixed(dec), gut - 6, yp); }
    }
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
    ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
    const sub = "cùng thang giá với footprint", sw = ctx.measureText(sub).width + 10;
    ctx.fillStyle = alpha(T.bg, 0.9); ctx.fillRect(0, top, Math.min(w, sw), 16); ctx.fillStyle = T.muted; ctx.fillText(sub, 6, top + 4);
    ctx.font = `9px ${MONO}`; ctx.textAlign = "right"; ctx.fillText("1 giờ", w - 4, top + 18);
    this._legend(ctx, w, h, ph);
  }
  // chú thích dưới cùng: mỗi đòn bẩy một ô đậm dần, chấm là thanh lý thật
  _legend(ctx, w, h, ph) {
    const y = Math.min(h - 8, ph + 12); let x = 6;
    ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = T.bg; ctx.fillRect(0, y - 8, w, 16);
    this.levs.forEach((l, i) => {
      ctx.fillStyle = T.muted; ctx.fillText(l + "x", x, y); x += ctx.measureText(l + "x").width + 3;
      ctx.fillStyle = alpha(T.up, SHADE[Math.min(SHADE.length - 1, i)].toFixed(2)); ctx.fillRect(x, y - 4, 5, 9); x += 10;
    });
    if (x + 80 > w) return;
    ctx.fillStyle = T.muted; ctx.fillText("·", x, y); x += 10;
    ctx.fillStyle = alpha(T.down, 0.85); ctx.beginPath(); ctx.arc(x + 3, y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.muted; ctx.fillText("thanh lý", x + 10, y);
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
