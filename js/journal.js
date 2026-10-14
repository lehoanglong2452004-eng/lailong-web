// Lai Long Web: quản lý rủi ro và nhật ký giao dịch (phần tính toán, không đụng giao diện).
//
// - Tính khối lượng lệnh theo % rủi ro: lỗ khi chạm cắt lỗ (cộng phí hai chiều) đúng bằng số tiền chấp nhận mất.
// - Rào chắn trong ngày: lỗ đã chốt hôm nay, số lệnh hôm nay, tổng rủi ro các lệnh đang mở.
// - Thống kê nhật ký theo chiến lược, phía, giờ vào lệnh, thứ trong tuần và theo từng lỗi hay mắc.
import { equityStats } from "./fractal.js?v=202610141959";

export const MISTAKES = [
  ["early", "Vào sớm, chưa đủ tín hiệu"], ["fomo", "FOMO, đuổi giá"], ["noplan", "Ngoài kế hoạch"],
  ["movestop", "Dời cắt lỗ ra xa"], ["cutwin", "Chốt lời quá sớm"], ["size", "Khối lượng quá lớn"],
  ["revenge", "Gỡ lỗ, trả thù thị trường"], ["news", "Vào lệnh sát giờ ra tin"], ["late", "Vào trễ, giá đã chạy"],
];
export const SETTINGS_DEF = { capital: 10000, riskPct: 1, dayLossPct: 3, maxTrades: 6, fee: 0.05, mmr: 0.5 };

// equity: vốn hiện tại; riskPct: % chấp nhận mất; fee: phí taker % mỗi chiều; lev: đòn bẩy; mmr: ký quỹ duy trì %
export function sizeFor({ equity, riskPct, entry, stop, target, fee = 0.05, lev = 10, mmr = 0.5 }) {
  if (!(equity > 0) || !(entry > 0) || !(stop > 0) || entry === stop) return null;
  const side = stop < entry ? "long" : "short", dist = Math.abs(entry - stop), f = fee / 100;
  const riskUsd = equity * riskPct / 100;
  const qty = riskUsd / (dist + (entry + stop) * f); // phí vào ở giá vào, phí ra ở giá cắt lỗ
  const notional = qty * entry, margin = notional / lev;
  const liq = side === "long" ? entry * (1 - 1 / lev + mmr / 100) : entry * (1 + 1 / lev - mmr / 100);
  const stopBeyondLiq = side === "long" ? stop <= liq : stop >= liq;
  const rr = target > 0 ? (side === "long" ? target - entry : entry - target) / dist : null;
  return { side, qty, notional, margin, riskUsd, distPct: dist / entry * 100, liq, stopBeyondLiq, rr, minLev: notional / equity, feeUsd: (entry + stop) * f * qty };
}

// kết quả một lệnh đã đóng, tính theo R (bội số của rủi ro ban đầu) và theo USDT
export function result(t) {
  if (!(t.exit > 0) || !(t.entry > 0) || !(t.stop > 0) || t.entry === t.stop) return null;
  const dir = t.side === "long" ? 1 : -1, risk = Math.abs(t.entry - t.stop);
  const fee = +t.fee || 0, qty = +t.qty || 0;
  const pnl = (t.exit - t.entry) * dir * qty - fee;
  const R = qty > 0 ? pnl / (risk * qty) : (t.exit - t.entry) * dir / risk;
  return { R, pnl };
}

const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

export function guard(trades, cfg, now = Date.now()) {
  const closed = trades.filter(t => result(t)), equity = cfg.capital + closed.reduce((a, t) => a + result(t).pnl, 0);
  const today = trades.filter(t => dayKey(t.t) === dayKey(now));
  const dayPnl = closed.filter(t => dayKey(t.tExit || t.t) === dayKey(now)).reduce((a, t) => a + result(t).pnl, 0);
  const open = trades.filter(t => !(t.exit > 0));
  const openRisk = open.reduce((a, t) => a + Math.abs(t.entry - t.stop) * (+t.qty || 0), 0);
  const longs = open.filter(t => t.side === "long").length, shorts = open.length - longs;
  const limitUsd = equity * cfg.dayLossPct / 100;
  const warn = [];
  if (dayPnl <= -limitUsd && limitUsd > 0) warn.push({ lvl: "stop", txt: `Hôm nay đã lỗ ${fmt(-dayPnl)} USDT, chạm giới hạn ${cfg.dayLossPct}% vốn. Nên dừng giao dịch tới ngày mai.` });
  else if (dayPnl < -limitUsd * 0.66 && limitUsd > 0) warn.push({ lvl: "warn", txt: `Hôm nay đã lỗ ${fmt(-dayPnl)} USDT, gần chạm giới hạn ${fmt(limitUsd)} USDT.` });
  if (today.length >= cfg.maxTrades) warn.push({ lvl: "warn", txt: `Đã vào ${today.length} lệnh hôm nay, bằng hoặc vượt mức tối đa ${cfg.maxTrades}. Giao dịch quá nhiều thường do cảm xúc.` });
  if (Math.max(longs, shorts) >= 2) warn.push({ lvl: "warn", txt: `Đang mở ${Math.max(longs, shorts)} lệnh cùng chiều ${longs >= shorts ? "LONG" : "SHORT"}. Các coin lớn thường chạy cùng nhau, nên rủi ro thật gần bằng tổng các lệnh: ${fmt(openRisk)} USDT (${(openRisk / equity * 100).toFixed(1)}% vốn).` });
  return { equity, dayPnl, limitUsd, todayN: today.length, open: open.length, openRisk, openRiskPct: equity > 0 ? openRisk / equity * 100 : 0, warn };
}
const fmt = x => (Math.round(x * 100) / 100).toLocaleString("en-US");

// nhóm các lệnh đã đóng theo khoá, trả về thống kê R cho mỗi nhóm
function groupBy(rows, keyFn, riskPct) {
  const m = new Map();
  for (const r of rows) for (const k of [].concat(keyFn(r))) { if (k == null) continue; (m.get(k) || m.set(k, []).get(k)).push(r); }
  return [...m].map(([k, rs]) => ({ key: k, n: rs.length, pnl: rs.reduce((a, r) => a + r.pnl, 0), st: equityStats(rs.map(r => r.R), riskPct) }));
}

export function journalStats(trades, cfg) {
  const rows = trades.map(t => ({ t, ...result(t) })).filter(r => r.R != null && isFinite(r.R)).sort((a, b) => (a.t.tExit || a.t.t) - (b.t.tExit || b.t.t));
  const rp = cfg.riskPct, st = equityStats(rows.map(r => r.R), rp);
  const hour = r => new Date(r.t.t).getHours(), wd = r => new Date(r.t.t).getDay();
  const clean = rows.filter(r => !(r.t.mistakes || []).length), dirty = rows.filter(r => (r.t.mistakes || []).length);
  return {
    rows, st, pnl: rows.reduce((a, r) => a + r.pnl, 0),
    byStrat: groupBy(rows, r => r.t.strat || "Khác", rp).sort((a, b) => b.n - a.n),
    bySide: groupBy(rows, r => r.t.side, rp),
    byHour: groupBy(rows, hour, rp).sort((a, b) => a.key - b.key),
    byWeekday: groupBy(rows, wd, rp).sort((a, b) => a.key - b.key),
    byMistake: groupBy(rows, r => r.t.mistakes || [], rp).sort((a, b) => a.st.totalR - b.st.totalR),
    byEmo: groupBy(rows, r => r.t.emo || null, rp).sort((a, b) => a.key - b.key),
    clean: equityStats(clean.map(r => r.R), rp), dirty: equityStats(dirty.map(r => r.R), rp),
  };
}

export function toCsv(trades) {
  const head = ["thoi_gian_vao", "ma", "phia", "chien_luoc", "gia_vao", "cat_lo", "muc_tieu", "gia_ra", "thoi_gian_ra", "khoi_luong", "phi", "R", "lai_lo_usdt", "loi", "cam_xuc", "ly_do", "ghi_chu"];
  const q = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const iso = t => t ? new Date(t).toISOString() : "";
  return [head.join(",")].concat(trades.map(t => { const r = result(t); return [iso(t.t), t.sym, t.side, t.strat, t.entry, t.stop, t.target, t.exit, iso(t.tExit), t.qty, t.fee, r ? r.R.toFixed(3) : "", r ? r.pnl.toFixed(2) : "", (t.mistakes || []).join("|"), t.emo, t.reason, t.note].map(q).join(","); })).join("\n");
}
