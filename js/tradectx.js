// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bối cảnh lúc vào lệnh (phần tính toán, không đụng giao diện).
// Mỗi lệnh mới ghi trong vòng 60 phút được chụp lại thị trường lúc đó, để sau này biết lệnh thắng trong bối cảnh nào:
//   4 lớp đồng thuận (vĩ mô của La bàn, COT, cấu trúc giá 1h, order flow 1h), phiên, biến động, xu hướng 24 giờ,
//   tín hiệu vừa xuất hiện trên mã đó (3 nến 1 giờ đã đóng gần nhất, tín hiệu sổ lệnh 60 phút trước) và gamma (BTC, ETH).
// Chỉ dùng dữ liệu tới lúc vào lệnh. Lớp nào thiếu dữ liệu thì ghi là chưa có (dir null), không tính là trung lập.
// Hướng lưu theo thị trường (+1 lên, -1 xuống); so với phía của lệnh lúc đọc, nên sửa LONG/SHORT vẫn đúng.
import { evaluate, linkOf } from "./consensus.js?v=202610260704";
import { leans, usdTrend, riskMood, etfFlow } from "./compass.js?v=202610260704";
import { contextSeries, sessionOf, TAGS } from "./context.js?v=202610260704";
import { prepBars, detectAll, SIGNALS } from "./signals.js?v=202610260704";
import { result, groupBy } from "./journal.js?v=202610260704";
import { equityStats } from "./fractal.js?v=202610260704";

const H = 36e5;
export const CTX_LAYERS = ["Vĩ mô (la bàn)", "COT", "Cấu trúc giá 1h", "Order flow 1h"];
export const SIG_BARS = 3; // số nến 1 giờ đã đóng gần nhất để tìm tín hiệu
export const LIVE_MIN = 60; // phút: tín hiệu sổ lệnh trước lúc vào lệnh
const MAX_SIGS = 8;

// bars: nến 1 giờ {t,o,h,l,c,v,bv} (có thể gồm nến đang chạy); macro: {fx, vol, flows, cot} của La bàn;
// live: sự kiện sổ lệnh đã ghi {sig, sym, t, dir}; flip: điểm lật gamma
export function buildCtx({ sym, t, entry, bars = null, macro = null, live = [], flip = null }) {
  const all = (bars || []).filter(b => b.t <= t).sort((a, b) => a.t - b.t);
  const closed = all.filter(b => b.t + H <= t), d = macro || {};
  const L = d.fx || d.vol || d.flows ? leans(usdTrend(d.fx), riskMood(d.vol), etfFlow(d.flows)) : null;
  const ev = evaluate(sym, { bars: closed, leans: L || [], cot: d.cot, cfg: {}, equity: 0 });
  const k = linkOf(sym), cot = k.cot && (d.cot || []).find(i => i.sym === k.cot);
  const na = [
    !L || !L.some(x => x.name === k.lean),
    !cot || cot.specIdx == null,
    closed.length < 60,
    closed.filter(b => b.bv != null && b.v > 0).length < 24,
  ];
  const layers = ev.layers.map((l, i) => ({ dir: na[i] ? null : l.dir, txt: l.txt }));
  const tags = { session: sessionOf(t) };
  if (closed.length >= 30) {
    const tg = contextSeries(closed, { tfMs: H }).at(-1) || {};
    for (const key of ["vol", "trend", "value"]) if (tg[key]) tags[key] = tg[key];
  }
  // tín hiệu từ nến: detectAll bỏ qua nến cuối (nến đang chạy lúc vào lệnh), nên chỉ thấy nến đã đóng
  const sigs = [];
  if (all.length >= 60) {
    // chưa có nến đang chạy thì thêm một nến giả ở cuối để nến đã đóng gần nhất vẫn được xét
    const arr = all.at(-1).t + H > t ? all : [...all, { ...all.at(-1), t: all.at(-1).t + H }], from = arr.at(-1).t - SIG_BARS * H;
    for (const e of detectAll(prepBars(arr), { tfMs: H })) if (e.t >= from) sigs.push({ sig: e.sig, dir: e.dir, t: e.t });
  }
  for (const e of live || []) if (e.sym === sym && e.t <= t && e.t >= t - LIVE_MIN * 6e4 && e.dir) sigs.push({ sig: e.sig, dir: e.dir, t: e.t });
  const seen = new Set(), uniq = sigs.sort((a, b) => b.t - a.t).filter(s => { const key = `${s.sig}|${s.dir}`; return !seen.has(key) && seen.add(key); }).slice(0, MAX_SIGS);
  const out = { v: 1, at: t, layers, tags, sigs: uniq };
  if (flip > 0 && entry > 0) { out.gamma = entry >= flip ? "pos" : "neg"; out.flip = flip; }
  return out;
}

const sideOf = t => (t.side === "long" ? 1 : -1);
// quan hệ của một hướng thị trường với lệnh: with (cùng chiều), against (ngược), flat (trung lập), na (chưa có dữ liệu)
export const rel = (dir, side) => (dir == null ? "na" : dir === 0 ? "flat" : dir === side ? "with" : "against");
export function alignOf(t) {
  const s = sideOf(t), rs = (t.ctx ? t.ctx.layers : []).map(l => rel(l.dir, s));
  return { with: rs.filter(r => r === "with").length, against: rs.filter(r => r === "against").length, known: rs.filter(r => r !== "na").length, rels: rs };
}
export function trendRel(t) {
  const tr = t.ctx && t.ctx.tags.trend;
  return !tr ? null : tr === "range" ? "range" : (tr === "up") === (sideOf(t) > 0) ? "with" : "against";
}
const sigName = s => (SIGNALS[s] ? SIGNALS[s].name : s);
const REL_TXT = { with: "cùng chiều lệnh", against: "ngược chiều lệnh", flat: "trung lập", na: "chưa có dữ liệu" };
const TREND_TXT = { with: "Thuận xu hướng 24 giờ", against: "Ngược xu hướng 24 giờ", range: "Xu hướng 24 giờ đi ngang" };

// các dòng mô tả bối cảnh của một lệnh (cho ô gợi ý và bản xuất)
export function ctxLines(t) {
  const c = t.ctx; if (!c) return [];
  const s = sideOf(t), a = alignOf(t), out = [`Đồng thuận: ${a.with}/${a.known} lớp cùng chiều lệnh${a.against ? `, ${a.against} lớp ngược` : ""}`];
  c.layers.forEach((l, i) => out.push(`${CTX_LAYERS[i]}: ${REL_TXT[rel(l.dir, s)]}${l.dir != null ? ` · ${l.txt}` : ""}`));
  for (const k of ["session", "vol", "trend", "value"]) if (c.tags[k]) out.push(`${TAGS[k].name}: ${TAGS[k].vals[c.tags[k]]}`);
  if (c.gamma) out.push(`Gamma: ${TAGS.gamma.vals[c.gamma]}`);
  out.push(c.sigs.length ? `Tín hiệu trước khi vào: ${c.sigs.map(x => `${sigName(x.sig)} (${x.dir === s ? "cùng chiều" : "ngược chiều"})`).join(", ")}` : "Không có tín hiệu nào trong 3 giờ trước khi vào");
  return out;
}

// thống kê các lệnh đã đóng theo bối cảnh lúc vào; phiên tính được cho mọi lệnh, phần còn lại chỉ cho lệnh có bối cảnh
export function ctxStats(trades, cfg) {
  const rows = trades.map(t => ({ t, ...result(t) })).filter(r => r.R != null && isFinite(r.R));
  const cx = rows.filter(r => r.t.ctx), rp = cfg.riskPct, s = r => sideOf(r.t);
  const strong = cx.filter(r => { const a = alignOf(r.t); return a.with >= 3 && !a.against; });
  const vsMacro = cx.filter(r => alignOf(r.t).rels[0] === "against");
  return {
    n: rows.length, covered: cx.length,
    strong: equityStats(strong.map(r => r.R), rp), vsMacro: equityStats(vsMacro.map(r => r.R), rp),
    byAlign: groupBy(cx, r => alignOf(r.t).with, rp).sort((a, b) => b.key - a.key),
    byLayer: groupBy(cx, r => alignOf(r.t).rels.map((x, i) => (x === "with" || x === "against" ? `${i}:${x}` : null)), rp).sort((a, b) => +a.key[0] - +b.key[0] || (a.key.endsWith("with") ? -1 : 1)),
    byTrend: groupBy(cx, r => trendRel(r.t), rp),
    bySession: groupBy(rows, r => sessionOf(r.t.t), rp),
    byVol: groupBy(cx, r => r.t.ctx.tags.vol || null, rp),
    bySig: groupBy(cx, r => [...new Set(r.t.ctx.sigs.map(x => `${x.sig}|${x.dir === s(r) ? "with" : "against"}`))], rp).sort((a, b) => b.n - a.n).slice(0, 12),
    byGamma: groupBy(cx, r => r.t.ctx.gamma || null, rp),
  };
}

// nhãn cho từng nhóm của ctxStats
export const CTX_LABEL = {
  byAlign: k => (k === 4 ? "4 lớp cùng chiều (đủ đồng thuận)" : `${k} lớp cùng chiều`),
  byLayer: k => { const [i, x] = k.split(":"); return `${CTX_LAYERS[+i]} ${REL_TXT[x]}`; },
  byTrend: k => TREND_TXT[k] || k,
  bySession: k => `Phiên ${TAGS.session.vals[k] || k}`,
  byVol: k => `Biến động ${(TAGS.vol.vals[k] || k).toLowerCase()}`,
  bySig: k => { const [sig, x] = k.split("|"); return `${sigName(sig)} (${x === "with" ? "cùng chiều" : "ngược chiều"})`; },
  byGamma: k => `Gamma ${(TAGS.gamma.vals[k] || k).toLowerCase()}`,
};

// cột thêm cho file CSV
const relCsv = { with: "cung_chieu", against: "nguoc_chieu", flat: "trung_lap", na: "" };
export const CTX_CSV = {
  head: ["lop_cung_chieu", "lop_nguoc_chieu", "vi_mo", "cot", "cau_truc_1h", "order_flow_1h", "phien", "bien_dong", "xu_huong_24h", "gamma", "tin_hieu_truoc_khi_vao"],
  row: t => {
    if (!t.ctx) return ["", "", "", "", "", "", sessionOf(t.t), "", "", "", ""];
    const a = alignOf(t), c = t.ctx;
    return [a.with, a.against, ...a.rels.map(x => relCsv[x]), c.tags.session || "", c.tags.vol || "", trendRel(t) || "", c.gamma || "", c.sigs.map(x => `${x.sig}${x.dir === sideOf(t) ? "+" : "-"}`).join("|")];
  },
};
