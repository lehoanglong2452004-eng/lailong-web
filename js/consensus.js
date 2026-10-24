// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: Đồng thuận 4 lớp (phần tính toán, không đụng giao diện).
//
// Bốn lớp chấm độc lập cho mỗi mã, mỗi lớp cho +1 (ủng hộ LONG), -1 (ủng hộ SHORT) hoặc 0:
// 1. Vĩ mô: gió xuôi / gió ngược của La bàn cho nhóm của mã (coin, vàng, dầu).
// 2. COT: đầu cơ lớn tăng hay giảm vị thế ròng trong tuần (từ 1% open interest), trừ khi đã đông ở cực trị 3 năm:
//    chỉ số từ 90 thì nghiêng xuống (đám đông long đã chật), tới 10 thì nghiêng lên (dễ bị ép mua lại).
// 3. Cấu trúc giá nến 1 giờ: giá trên EMA20 trên EMA50, EMA20 đi lên và đỉnh đáy 12 nến gần nhất không thấp hơn
//    12 nến trước (ngược lại cho SHORT).
// 4. Order flow nến 1 giờ: chênh lệch mua bán chủ động 24 nến từ 3% khối lượng và 6 nến gần nhất cùng chiều.
// Cả bốn cùng chiều mới là đồng thuận. Kèm vùng vào, cắt lỗ theo ATR và khối lượng tính bằng sizeFor của nhật ký.
import { sizeFor } from "./journal.js?v=202610240605";
import { atrSeries } from "./radar.js?v=202610240605";
import { assetClass, parts } from "./shock.js?v=202610240605";
import { escHtml } from "./discipline.js?v=202610240605";

export const FLOW_MIN = 0.03; // chênh lệch mua bán chủ động tối thiểu, theo tỷ lệ khối lượng 24 nến
export const COT_MOVE = 0.01; // thay đổi vị thế ròng tối thiểu của đầu cơ trong tuần, theo tỷ lệ open interest
const LAYER = ["Vĩ mô", "COT", "Cấu trúc giá 1h", "Order flow 1h"];
const num = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("en-US");
const px = x => x >= 1000 ? num(x, 1) : x >= 1 ? num(x, 3) : num(x, 6);

export function ema(vals, n) { const k = 2 / (n + 1), out = []; let e = null; for (const v of vals) { e = e === null ? v : e + k * (v - e); out.push(e); } return out; }

// nhóm La bàn và hợp đồng COT gần nhất với mã; altcoin dùng Bitcoin CME làm đại diện
export function linkOf(sym) {
  const cls = assetClass(sym), { base } = parts(sym);
  if (cls === "metal") return { lean: "Vàng", cot: /^XAG|SILVER/.test(base) ? "SI" : "GC" };
  if (cls === "oil") return { lean: "Dầu", cot: "CL" };
  if (cls === "crypto") return { lean: "Coin", cot: base === "ETH" ? "ETH" : "BTC", proxy: base !== "ETH" && base !== "BTC" };
  return { lean: null, cot: null };
}

export function macroLayer(sym, leans) {
  const k = linkOf(sym).lean, L = k && (leans || []).find(x => x.name === k);
  if (!L) return { dir: 0, txt: "chưa có dữ liệu vĩ mô cho mã này" };
  return { dir: Math.sign(L.sc), txt: `${k.toLowerCase()} ${L.label}${L.why.length ? ` (${L.why.join(", ")})` : ""}` };
}

export function cotLayer(sym, items) {
  const k = linkOf(sym), x = k.cot && (items || []).find(i => i.sym === k.cot);
  if (!x || x.specIdx == null) return { dir: 0, txt: "chưa có COT cho mã này" };
  const name = `${x.name}${k.proxy ? " (đại diện)" : ""}`, chg = x.oi ? x.specChg / x.oi : 0;
  if (x.specIdx >= 90) return { dir: -1, txt: `${name}: chỉ số ${Math.round(x.specIdx)}, đám đông long đã chật` };
  if (x.specIdx <= 10) return { dir: 1, txt: `${name}: chỉ số ${Math.round(x.specIdx)}, short đông, dễ bị ép mua lại` };
  const dir = Math.abs(chg) >= COT_MOVE ? Math.sign(chg) : 0;
  return { dir, txt: `${name}: đầu cơ ${x.specChg >= 0 ? "tăng" : "giảm"} ròng ${num(Math.abs(x.specChg), 0)} hợp đồng (${(chg * 100).toFixed(1)}% OI), chỉ số ${Math.round(x.specIdx)}` };
}

// bars: nến 1 giờ đã đóng {h, l, c, v, bv}, cũ trước, cần ít nhất 60 nến
export function structureLayer(bars) {
  if (!bars || bars.length < 60) return { dir: 0, txt: "chưa đủ nến" };
  const c = bars.map(b => b.c), e20 = ema(c, 20), e50 = ema(c, 50), n = c.length - 1, last = c[n];
  const hi = (a, b) => Math.max(...bars.slice(a, b).map(x => x.h)), lo = (a, b) => Math.min(...bars.slice(a, b).map(x => x.l));
  const hh = hi(n - 11, n + 1) >= hi(n - 23, n - 11), hl = lo(n - 11, n + 1) >= lo(n - 23, n - 11);
  const lh = hi(n - 11, n + 1) <= hi(n - 23, n - 11), ll = lo(n - 11, n + 1) <= lo(n - 23, n - 11);
  const up = last > e20[n] && e20[n] > e50[n] && e20[n] > e20[n - 5] && hh && hl;
  const dn = last < e20[n] && e20[n] < e50[n] && e20[n] < e20[n - 5] && lh && ll;
  const atr = atrSeries(bars)[n];
  const txt = up ? "giá trên EMA20 trên EMA50, đỉnh và đáy cao dần" : dn ? "giá dưới EMA20 dưới EMA50, đỉnh và đáy thấp dần" :
    `chưa rõ xu hướng (giá ${last > e20[n] ? "trên" : "dưới"} EMA20, EMA20 ${e20[n] > e50[n] ? "trên" : "dưới"} EMA50)`;
  return { dir: up ? 1 : dn ? -1 : 0, txt, last, e20: e20[n], atr };
}

export function flowLayer(bars) {
  const b = (bars || []).filter(x => x.bv != null && x.v > 0);
  if (b.length < 24) return { dir: 0, txt: "sàn không cho khối lượng mua chủ động" };
  const d = x => 2 * x.bv - x.v, w = b.slice(-24), vol = w.reduce((a, x) => a + x.v, 0);
  const r = w.reduce((a, x) => a + d(x), 0) / vol, r6 = w.slice(-6).reduce((a, x) => a + d(x), 0);
  const dir = r >= FLOW_MIN && r6 > 0 ? 1 : r <= -FLOW_MIN && r6 < 0 ? -1 : 0;
  return { dir, r, txt: `${r >= 0 ? "mua" : "bán"} chủ động nhiều hơn ${(Math.abs(r) * 100).toFixed(1)}% khối lượng 24 nến, 6 nến gần nhất ${r6 >= 0 ? "mua" : "bán"} ròng` };
}

// vùng vào từ giá đóng cửa lùi tối đa 1 ATR về phía EMA20; cắt lỗ cách giữa vùng atrMult × ATR; mục tiêu 2R
export function tradePlan(sym, dir, st, cfg, equity) {
  if (!dir || !(st.atr > 0)) return null;
  const far = dir > 0 ? Math.max(st.e20, st.last - st.atr) : Math.min(st.e20, st.last + st.atr);
  const zone = [Math.min(far, st.last), Math.max(far, st.last)], entry = (zone[0] + zone[1]) / 2;
  const stop = entry - dir * (cfg.atrMult || 1.5) * st.atr, target = entry + dir * 2 * Math.abs(entry - stop);
  const s = sizeFor({ equity, riskPct: cfg.riskPct, entry, stop, target, fee: cfg.fee, lev: 10, mmr: cfg.mmr });
  return s && { sym, side: dir > 0 ? "long" : "short", zone, entry, stop, target, qty: s.qty, notional: s.notional, riskUsd: s.riskUsd, atrMult: cfg.atrMult || 1.5 };
}

export function evaluate(sym, { bars, leans, cot, cfg, equity }) {
  const st = structureLayer(bars);
  const layers = [macroLayer(sym, leans), cotLayer(sym, cot), st, flowLayer(bars)].map((l, i) => ({ name: LAYER[i], dir: l.dir, txt: l.txt }));
  const up = layers.filter(l => l.dir > 0).length, dn = layers.filter(l => l.dir < 0).length;
  const dir = up === 4 ? 1 : dn === 4 ? -1 : 0, lean = up > dn ? 1 : dn > up ? -1 : 0;
  return { sym, layers, dir, lean, count: Math.max(up, dn), plan: dir ? tradePlan(sym, dir, st, cfg, equity) : null };
}

export function consensusHtml(r, { warn = [] } = {}) {
  const p = r.plan, coin = parts(r.sym).base;
  return [
    `🎯 <b>ĐỒNG THUẬN 4 LỚP</b> · ${escHtml(r.sym)} <b>${r.dir > 0 ? "LONG" : "SHORT"}</b>`,
    ...r.layers.map(l => `✅ ${l.name}: ${escHtml(l.txt)}`),
    ...(p ? [
      `Vùng vào: ${px(p.zone[0])} – ${px(p.zone[1])}`,
      `Cắt lỗ: ${px(p.stop)} (${p.atrMult} ATR 1h) · Mục tiêu 2R: ${px(p.target)}`,
      `Khối lượng: ${num(p.qty, p.qty >= 100 ? 0 : 4)} ${escHtml(coin)} (rủi ro ${num(p.riskUsd)} USDT, giá trị lệnh ${num(p.notional, 0)} USDT)`,
    ] : []),
    ...warn.map(w => `⚠️ ${escHtml(w)}`),
    "<i>Đủ 4 lớp không có nghĩa là chắc thắng. Xem lịch tin và giới hạn rủi ro trước khi vào.</i>",
  ].join("\n");
}
export const consensusText = r => `Đồng thuận 4 lớp: ${r.sym} ${r.dir > 0 ? "LONG" : "SHORT"}${r.plan ? `, vào ${px(r.plan.zone[0])}–${px(r.plan.zone[1])}, cắt lỗ ${px(r.plan.stop)}` : ""}`;
