// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bảng chuỗi quyền chọn (depth view) cho một hạn: call bên trái, put bên phải theo từng strike.
// Hàng chuỗi: [strike, i_hạn, ±1, OI, iv, KL trong ngày, giá mua, giá bán] (giá mua/bán theo USD, có thể thiếu).
import { bsDelta } from "./optpro.js?v=202610240523";
import { pick, maxPain } from "./gex.js?v=202610240523";

const YEAR = 365 * 864e5;
const side = r => ({ oi: r[3], vol: r[5] || 0, iv: r[4], bid: r[6] > 0 ? r[6] : null, ask: r[7] > 0 ? r[7] : null });

export function chainTable(ch, ei, { n = 12, now = Date.now() } = {}) {
  const t = ch.exps[ei]; if (t == null) return null;
  const T = Math.max(0, (t - now) / YEAR), S = ch.spot, by = new Map();
  for (const r of ch.rows) {
    if (r[1] !== ei) continue;
    const e = by.get(r[0]) || { k: r[0], c: null, p: null };
    const x = side(r); x.delta = bsDelta(S, r[0], T, r[4], r[2]); x.mid = x.bid != null && x.ask != null ? (x.bid + x.ask) / 2 : null;
    if (r[2] > 0) e.c = x; else e.p = x; by.set(r[0], e);
  }
  const all = [...by.values()].sort((a, b) => a.k - b.k);
  if (!all.length) return null;
  let ai = 0; all.forEach((e, i) => { if (Math.abs(e.k - S) < Math.abs(all[ai].k - S)) ai = i; });
  const rows = all.slice(Math.max(0, ai - n), ai + n + 1);
  let cOi = 0, pOi = 0, cVol = 0, pVol = 0, cw = null, pw = null;
  for (const e of all) {
    if (e.c) { cOi += e.c.oi; cVol += e.c.vol; if (!cw || e.c.oi > cw.c.oi) cw = e; }
    if (e.p) { pOi += e.p.oi; pVol += e.p.vol; if (!pw || e.p.oi > pw.p.oi) pw = e; }
  }
  const atm = all[ai], straddle = atm.c && atm.p && atm.c.mid != null && atm.p.mid != null ? atm.c.mid + atm.p.mid : null;
  const atmIv = atm.c && atm.p ? (atm.c.iv + atm.p.iv) / 2 : (atm.c || atm.p).iv;
  // biên độ dự kiến tới hạn: theo giá straddle ATM nếu có giá mua/bán, không thì theo IV ATM
  const move = straddle != null ? straddle : S * atmIv * Math.sqrt(T);
  const maxOi = Math.max(1, ...rows.map(e => Math.max(e.c ? e.c.oi : 0, e.p ? e.p.oi : 0)));
  return {
    exp: t, days: T * 365, spot: S, atmK: atm.k, rows, maxOi,
    cOi, pOi, cVol, pVol, pcrOi: cOi ? pOi / cOi : null, pcrVol: cVol ? pVol / cVol : null,
    callWall: cw && cw.k, putWall: pw && pw.k, maxPain: maxPain(pick(ch, { exp: t, now })),
    move, movePct: S ? move / S * 100 : null, moveSrc: straddle != null ? "straddle" : "iv",
  };
}
