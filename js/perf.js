// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: báo cáo hiệu suất (phần tính toán). Nguồn: nhật ký, lịch sử lãi/lỗ Binance qua máy chủ laptop,
// hoặc file CSV xuất từ sàn. Mọi nguồn đổi về cùng một dạng:
//   trades: [{ t, sym, pnl (đã trừ phí), fee, R? }]   flows: [{ t, kind: "funding" | "transfer", v }]
import { result } from "./journal.js?v=202610240605";

const DAY = 864e5;
export const monthKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function fromJournal(trades) {
  return {
    trades: trades.map(t => { const r = result(t); return r && { t: t.tExit || t.t, sym: t.sym, pnl: r.pnl, fee: +t.fee || 0, R: r.R }; }).filter(Boolean).sort((a, b) => a.t - b.t),
    flows: [],
  };
}

// rows: [thời gian, mã, loại, số tiền] (REALIZED_PNL, COMMISSION, FUNDING_FEE, TRANSFER).
// Các dòng REALIZED_PNL cùng mã cách nhau dưới gap ms gộp thành một lệnh đóng; phí phát sinh từ lần đóng trước
// tới lần đóng này (gồm cả phí lúc mở) tính cho lệnh đó, nên lãi/lỗ mỗi lệnh là sau phí.
export function fromIncome(rows, { gap = 60e3 } = {}) {
  const trades = [], flows = [], fee = new Map(), open = new Map();
  const close = sym => { const g = open.get(sym); if (!g) return; open.delete(sym); const f = fee.get(sym) || 0; fee.set(sym, 0); trades.push({ t: g.t, sym, pnl: g.pnl + f, fee: -f }); };
  for (const [t, sym, kind, v] of [...rows].sort((a, b) => a[0] - b[0])) {
    if (kind === "COMMISSION") { const g = open.get(sym); if (g && t - g.t > gap) close(sym); fee.set(sym, (fee.get(sym) || 0) + v); continue; }
    if (kind === "FUNDING_FEE") { flows.push({ t, kind: "funding", v }); continue; }
    if (kind === "TRANSFER") { flows.push({ t, kind: "transfer", v }); continue; }
    if (kind !== "REALIZED_PNL") continue;
    const g = open.get(sym);
    if (g && t - g.t <= gap) { g.pnl += v; g.t = t; continue; }
    if (g) close(sym);
    open.set(sym, { t, pnl: v });
  }
  for (const sym of [...open.keys()]) close(sym);
  trades.sort((a, b) => a.t - b.t);
  return { trades, flows };
}

// file CSV xuất từ sàn: tìm cột thời gian, mã, lãi/lỗ đã chốt và phí theo tên cột (Binance, Bybit, OKX…)
export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("file trống");
  const split = l => { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === "," || c === ";" || c === "\t") { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map(s => s.trim()); };
  const head = split(lines[0]).map(h => h.toLowerCase());
  const find = (re, not) => head.findIndex(h => re.test(h) && !(not && not.test(h)));
  const iT = find(/date|time|thời gian|thoi_gian/), iS = find(/symbol|pair|contract|^ma$|mã/), iP = find(/realized|closed p&l|closed pnl|pnl|profit|lai_lo/), iF = find(/fee|commission|phi/, /coin|asset|rate|currency/);
  if (iT < 0 || iP < 0) throw new Error("không thấy cột thời gian hoặc cột lãi/lỗ đã chốt");
  const num = s => { const x = parseFloat(String(s || "").replace(/[^0-9eE.+-]/g, "")); return isFinite(x) ? x : 0; };
  const time = s => { const v = String(s).trim(); if (/^\d{10,13}$/.test(v)) return +v < 1e12 ? +v * 1000 : +v; const iso = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(:\d\d)?$/.test(v) ? v.replace(" ", "T") + "Z" : v; const t = Date.parse(iso); return isFinite(t) ? t : null; };
  const rows = [];
  for (const l of lines.slice(1)) {
    const c = split(l), t = time(c[iT]); if (t == null) continue;
    const sym = iS >= 0 ? c[iS] : "", p = num(c[iP]), f = iF >= 0 ? -Math.abs(num(c[iF])) : 0;
    if (f) rows.push([t, sym, "COMMISSION", f]);
    if (p) rows.push([t, sym, "REALIZED_PNL", p]);
  }
  if (!rows.length) throw new Error("không có dòng nào có lãi/lỗ");
  return rows;
}

// báo cáo theo tháng và tổng: vốn đầu kỳ = capital + lãi/lỗ và tiền nạp/rút trước đó
export function report({ trades, flows }, { capital = 10000 } = {}) {
  const ev = [...trades.map(x => ({ t: x.t, v: x.pnl, tr: x })), ...flows.map(f => ({ t: f.t, v: f.v, f }))].sort((a, b) => a.t - b.t);
  if (!ev.length) return null;
  let eq = capital, peak = capital, maxDD = 0, ddAt = null;
  const days = new Map(), months = new Map();
  const M = k => months.get(k) || months.set(k, { key: k, start: eq, pnl: 0, fees: 0, funding: 0, transfer: 0, list: [], peak: eq, dd: 0 }).get(k);
  for (const e of ev) {
    const m = M(monthKey(e.t));
    if (e.f && e.f.kind === "transfer") { m.transfer += e.v; eq += e.v; peak += e.v; }
    else { eq += e.v; m.pnl += e.v; if (e.f) m.funding += e.v; else { m.fees += e.tr.fee || 0; m.list.push(e.tr); } }
    m.peak = Math.max(m.peak, eq); m.dd = Math.max(m.dd, m.peak > 0 ? (m.peak - eq) / m.peak : 0);
    peak = Math.max(peak, eq); const dd = peak > 0 ? (peak - eq) / peak : 0; if (dd > maxDD) { maxDD = dd; ddAt = e.t; }
    days.set(dayStart(e.t), eq);
  }
  const tradeStats = list => {
    const w = list.filter(x => x.pnl > 0), l = list.filter(x => x.pnl < 0), gw = w.reduce((a, x) => a + x.pnl, 0), gl = -l.reduce((a, x) => a + x.pnl, 0);
    const Rs = list.map(x => x.R).filter(x => x != null && isFinite(x));
    return { n: list.length, wr: list.length ? w.length / list.length : NaN, avg: list.length ? (gw - gl) / list.length : NaN, avgWin: w.length ? gw / w.length : NaN, avgLoss: l.length ? -gl / l.length : NaN, pf: gl > 0 ? gw / gl : gw > 0 ? Infinity : NaN, avgR: Rs.length ? Rs.reduce((a, x) => a + x, 0) / Rs.length : null, best: list.length ? Math.max(...list.map(x => x.pnl)) : NaN, worst: list.length ? Math.min(...list.map(x => x.pnl)) : NaN };
  };
  const ms = [...months.values()].map(m => ({ key: m.key, start: m.start, pnl: m.pnl, ret: m.start > 0 ? m.pnl / m.start : NaN, fees: m.fees, funding: m.funding, transfer: m.transfer, dd: m.dd, ...tradeStats(m.list) }));
  // chuỗi vốn theo ngày (điền ngày trống) để tính Sharpe ngày
  const ks = [...days.keys()].sort((a, b) => a - b), curve = [];
  let last = capital;
  for (let d = ks[0]; d <= ks[ks.length - 1]; d += DAY) { const dd = dayStart(d + DAY / 2); if (days.has(dd)) last = days.get(dd); curve.push([dd, last]); }
  const rets = []; for (let i = 1; i < curve.length; i++) if (curve[i - 1][1] > 0) rets.push(curve[i][1] / curve[i - 1][1] - 1);
  const mu = rets.reduce((a, x) => a + x, 0) / (rets.length || 1), sd = Math.sqrt(rets.reduce((a, x) => a + (x - mu) ** 2, 0) / Math.max(1, rets.length - 1));
  const transfers = flows.filter(f => f.kind === "transfer").reduce((a, f) => a + f.v, 0);
  const total = { ...tradeStats(trades), pnl: eq - capital - transfers, ret: (eq - capital - transfers) / capital, maxDD, ddAt, fees: ms.reduce((a, m) => a + m.fees, 0), funding: ms.reduce((a, m) => a + m.funding, 0), equity: eq, sharpe: sd > 0 ? (mu / sd) * Math.sqrt(365) : NaN, posMonths: ms.filter(m => m.pnl > 0).length, from: ev[0].t, to: ev[ev.length - 1].t };
  return { months: ms, total, curve };
}
