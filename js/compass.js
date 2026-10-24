// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: La bàn trong ngày (phần tính toán, không đụng giao diện).
//
// Bốn bản tin cố định mỗi ngày: sáng 7:30, trưa 11:30, chiều 15:30, tối 20:00 (giờ máy). Mỗi bản gồm bốn phần:
// - Vĩ mô: USD đang mạnh lên hay yếu đi (DXY 5 và 20 phiên), tâm lý thị trường (VIX và VIX 3 tháng), dòng tiền ETF BTC,
//   rồi gộp lại thành gió xuôi / gió ngược cho coin, vàng, dầu. Đây là bối cảnh trong vài ngày, không phải tín hiệu vào lệnh.
// - Lịch tin mạnh từ 0h hôm nay tới 7:30 sáng mai, tin đã ra kèm kết quả, tin sắp ra kèm khung giờ nên đứng ngoài.
// - COT: chỉ số COT 3 năm của đầu cơ lớn ở USD, vàng, dầu, các hợp đồng đang ở cực trị, rồi BTC, ETH ở cuối.
// - Ngân sách rủi ro hôm nay lấy từ nhật ký: rủi ro mỗi lệnh, còn được lỗ bao nhiêu trước khi bị khoá, số lệnh còn lại.
// Từ bản thứ hai trở đi có thêm một dòng so gió xuôi / gió ngược với bản trước.
import { riskLock, guard } from "./journal.js?v=202610240647";
import { cotNote } from "./instview.js?v=202610240647";
import { etfSummary } from "./flowsview.js?v=202610240647";
import { TOP } from "./shock.js?v=202610240647";
import { fmtDate, FLAG, pad2 } from "./util.js?v=202610240647";
import { iconOf, GROUP } from "./icons.js?v=202610240647";

const MIN = 60e3;
const WD = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const num = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("en-US");
const pct = x => `${x > 0 ? "+" : ""}${x.toFixed(1)}%`;
const hm = t => `${pad2(new Date(t).getHours())}:${pad2(new Date(t).getMinutes())}`;
export const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const COT_SHOW = ["DX", "GC", "CL", "BTC", "ETH"];
const CRYPTO = ["BTC", "ETH"];
export const COT_NAME = { DX: "USD", BTC: "Bitcoin CME", ETH: "Ether CME", GC: "Vàng", CL: "Dầu WTI" };
export const SLOTS = [
  { id: "sang", at: "07:30", name: "sáng", icon: "🌅" }, { id: "trua", at: "11:30", name: "trưa", icon: "☀️" },
  { id: "chieu", at: "15:30", name: "chiều", icon: "🌇" }, { id: "toi", at: "20:00", name: "tối", icon: "🌙" },
];
export const slotTime = (s, t) => { const d = new Date(t), [h, m] = s.at.split(":").map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };

// khung đang chạy: khung gần nhất đã tới giờ hôm nay; trước 7:30 vẫn là khung tối hôm qua (today = false)
export function slotOf(now = Date.now()) {
  const due = SLOTS.filter(s => slotTime(s, now) <= now);
  return due.length ? { slot: due[due.length - 1], today: true } : { slot: SLOTS[SLOTS.length - 1], today: false };
}

// USD theo DXY: 5 phiên lệch quá 0,4% và 20 phiên lệch quá 1% thì tính là có hướng
export function usdTrend(fx) {
  const u = (fx || []).find(x => x.code === "USD"), c = u && u.closes;
  if (!c || c.length < 6) return null;
  const last = c[c.length - 1], ch = n => c.length > n ? (last / c[c.length - 1 - n] - 1) * 100 : null;
  const c5 = ch(5), c20 = ch(20), s = (v, k) => v == null || Math.abs(v) < k ? 0 : Math.sign(v);
  const sum = s(c5, 0.4) + s(c20, 1), dir = Math.sign(sum);
  const rate = u.rate && u.rate.rate;
  return { last, c5, c20, dir, rate, txt: `${dir > 0 ? "USD mạnh lên" : dir < 0 ? "USD yếu đi" : "USD đi ngang"}: DXY ${num(last)}, 5 phiên ${pct(c5)}${c20 != null ? `, 20 phiên ${pct(c20)}` : ""}.${rate != null ? ` Lãi suất Fed ${rate}%.` : ""}` };
}

// tâm lý: VIX từ 25 hoặc cao hơn VIX 3 tháng là sợ hãi; VIX dưới 15 và thấp hơn hẳn VIX 3 tháng là ưa rủi ro
export function riskMood(items) {
  const g = s => (items || []).find(x => x.sym === s), v = g("VIX"), v3 = g("VIX3M");
  if (!v || !v.last) return null;
  const r = v3 && v3.last ? v.last / v3.last : null;
  const dir = v.last >= 25 || (r != null && r >= 1) ? -1 : v.last <= 15 && (r == null || r < 0.9) ? 1 : 0;
  return { vix: v.last, ratio: r, dir, txt: `Tâm lý: ${dir < 0 ? "sợ hãi" : dir > 0 ? "ưa rủi ro" : "bình thường"} (VIX ${num(v.last, 1)}${v3 && v3.last ? `, VIX 3 tháng ${num(v3.last, 1)}${r >= 1 ? ", đảo ngược: lo ngắn hạn" : ""}` : ""}).` };
}

// dòng tiền ETF BTC 5 phiên (triệu USD): từ 200 triệu trở lên mới tính là có hướng
export function etfFlow(flows) {
  const s = etfSummary(flows && flows.btc);
  if (!s) return null;
  const dir = s.d5 >= 200 ? 1 : s.d5 <= -200 ? -1 : 0, m = Math.abs(s.d5);
  return { d5: s.d5, dir, txt: `ETF BTC: 5 phiên tiền ${s.d5 >= 0 ? "vào" : "ra"} ròng ${m >= 1000 ? `${num(m / 1000)} tỷ` : `${num(m, 0)} triệu`} USD${Math.abs(s.streak) >= 3 ? `, ${Math.abs(s.streak)} phiên liên tiếp` : ""}.` };
}

const LEAN = { 2: "gió xuôi mạnh", 1: "gió xuôi", 0: "trung lập", "-1": "gió ngược", "-2": "gió ngược mạnh" };
// gộp USD, tâm lý, ETF thành gió xuôi / gió ngược cho từng nhóm. Coin, vàng, dầu tính bằng USD nên USD mạnh là gió ngược.
export function leans(usd, mood, etf) {
  const u = usd ? usd.dir : 0, m = mood ? mood.dir : 0, e = etf ? etf.dir : 0;
  const why = (parts) => parts.filter(([v]) => v).map(([v, up, dn]) => v > 0 ? up : dn);
  const one = (name, terms) => {
    const sc = Math.max(-2, Math.min(2, terms.reduce((a, [v]) => a + v, 0))), w = why(terms);
    return { name, sc, label: LEAN[sc], why: w };
  };
  return [
    one("Coin", [[-u, "USD yếu", "USD mạnh"], [m, "ưa rủi ro", "sợ hãi"], [e, "ETF hút tiền", "ETF rút tiền"]]),
    one("Vàng", [[-u, "USD yếu", "USD mạnh"], [m < 0 ? 1 : 0, "tiền tìm nơi trú ẩn", ""]]),
    one("Dầu", [[-u, "USD yếu", "USD mạnh"], [m, "ưa rủi ro", "sợ hãi"]]),
  ];
}

// COT: các hợp đồng chính và mọi hợp đồng đang ở cực trị 3 năm (chỉ số từ 90 hoặc tới 10); crypto luôn nằm cuối danh sách
export function cotLines(items, max = 7) {
  const xs = (items || []).filter(x => x.specIdx != null);
  const main = COT_SHOW.map(s => xs.find(x => x.sym === s)).filter(Boolean), coin = main.filter(x => CRYPTO.includes(x.sym));
  const ext = xs.filter(x => !COT_SHOW.includes(x.sym) && (x.specIdx >= 90 || x.specIdx <= 10)).sort((a, b) => Math.abs(b.specIdx - 50) - Math.abs(a.specIdx - 50));
  const lab = i => i >= 80 ? "đầu cơ long đông" : i <= 20 ? "đầu cơ short đông" : "trung tính";
  const rows = [...[...main.filter(x => !coin.includes(x)), ...ext].slice(0, max - coin.length), ...coin].map(x => {
    const note = cotNote(x);
    return { sym: x.sym, idx: x.specIdx, txt: `${iconOf(x.sym) ? iconOf(x.sym) + " " : ""}${COT_NAME[x.sym] || x.name}: chỉ số ${Math.round(x.specIdx)} (${lab(x.specIdx)}), tuần này đầu cơ ${x.specChg >= 0 ? "tăng" : "giảm"} ròng ${num(Math.abs(x.specChg), 0)} hợp đồng${note ? `. ${note}` : ""}.` };
  });
  return { date: xs.length ? xs[0].date : null, rows };
}

// tin mạnh từ 0h hôm nay tới 7:30 sáng mai (giờ máy), để bản tối thấy cả tin Mỹ ra lúc nửa đêm; trước 7:30 thì tính theo hôm qua.
// Các tin cùng giờ cùng nước gộp làm một.
export function todayEvents(events, now = Date.now()) {
  const out = [], { today } = slotOf(now), d = new Date(now);
  if (!today) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  const from = d.getTime(); d.setDate(d.getDate() + 1);
  const mid = d.getTime(), to = slotTime(SLOTS[0], mid);
  for (const e of events || []) {
    if (e.impact !== "High" || e.t < from || e.t >= to) continue;
    const g = out.find(x => x.t === e.t && x.country === e.country);
    if (g) { g.titles.push(e.title); if (e.actual) g.actual.push(`${e.title} ${e.actual}`); }
    else out.push({ t: e.t, country: e.country, titles: [e.title], actual: e.actual ? [`${e.title} ${e.actual}`] : [] });
  }
  for (const g of out) g.top = g.country === "USD" && g.titles.some(x => TOP.test(x));
  return out.sort((a, b) => a.t - b.t).map(g => ({ ...g, txt: `${hm(g.t)} ${FLAG[g.country] || g.country} ${g.titles.join(", ")}${g.top ? " ⭐" : ""}${g.t >= mid && today ? " (rạng sáng mai)" : ""}` +
    (g.t < now ? ` (đã ra${g.actual.length ? `: ${g.actual.join(", ")}` : ""})` : `: đứng ngoài ${hm(g.t - 15 * MIN)}–${hm(g.t + 5 * MIN)}`) }));
}

// ngân sách rủi ro hôm nay theo cài đặt nhật ký
export function riskBudget(trades, cfg, now = Date.now(), prevLock = null) {
  const L = riskLock(trades, cfg, now, prevLock), g = guard(trades, cfg, now), per = g.equity * cfg.riskPct / 100;
  const dayLeft = Math.max(0, L.dayLim + L.dayPnl), weekLeft = Math.max(0, L.weekLim + L.weekPnl);
  const lines = L.lock ? [`⛔ Đang khoá giao dịch tới ${fmtDate(L.lock.until)}: ${L.lock.why}.`] : [];
  lines.push(`Vốn ${num(g.equity, 0)} USDT, rủi ro mỗi lệnh ${cfg.riskPct}% = ${num(per)} USDT.`);
  if (!L.lock) {
    lines.push(`Hôm nay còn được lỗ ${num(dayLeft)} USDT${per > 0 ? ` (khoảng ${Math.floor(dayLeft / per + 1e-9)} lệnh thua)` : ""}${cfg.weekLossPct > 0 ? `, tuần này còn ${num(weekLeft)} USDT` : ""}.`);
    lines.push(`Còn ${Math.max(0, cfg.maxTrades - g.todayN)}/${cfg.maxTrades} lệnh hôm nay${cfg.lossStreak > 0 ? `; thua ${cfg.lossStreak} lệnh liên tiếp là khoá${L.streak ? ` (đang thua ${L.streak})` : ""}` : ""}.`);
  }
  if (g.open) lines.push(`Đang mở ${g.open} lệnh, rủi ro ${num(g.openRisk)} USDT (${g.openRiskPct.toFixed(1)}% vốn).`);
  return { per, dayLeft, weekLeft, lock: L.lock, lines };
}

// so gió xuôi / gió ngược với bản trước (prev: { day, name, leans: [{ name, label }] }); bỏ qua nếu bản trước đã quá 24 giờ
export function leanChanges(prev, L, now = Date.now()) {
  if (!prev || !prev.leans || !(prev.t > now - 864e5)) return null;
  const name = prev.day === dayKey(now) ? prev.name : prev.name === "tối" ? "tối qua" : `${prev.name} hôm qua`;
  const d = L.map(x => { const p = prev.leans.find(y => y.name === x.name); return p && p.label !== x.label ? `${GROUP[x.name]} ${x.name} ${p.label} → ${x.label}` : null; }).filter(Boolean);
  return `So với bản ${name}: ${d.length ? d.join(", ") : "gió không đổi"}.`;
}

// gộp thành các mục { title, lines } để vẽ thẻ và soạn tin Telegram
export function compass({ fx, vol, flows, cot, events, trades, cfg, lock = null, now = Date.now(), slot = slotOf(now).slot, prev = null }) {
  const usd = usdTrend(fx), mood = riskMood(vol), etf = etfFlow(flows), L = leans(usd, mood, etf);
  const macro = [usd, mood, etf].filter(Boolean).map(x => x.txt);
  if (usd || mood || etf) {
    macro.push("→ " + L.map(x => `${GROUP[x.name]} ${x.name}: ${x.label}${x.why.length ? ` (${x.why.join(", ")})` : ""}`).join(" · "));
    const ch = leanChanges(prev, L, now); if (ch) macro.push(ch);
  }
  const c = cotLines(cot), ev = todayEvents(events, now), b = cfg ? riskBudget(trades || [], cfg, now, lock) : null;
  const d = new Date(now);
  return {
    day: dayKey(now), slot, title: `${WD[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`, leans: L,
    sections: [
      { title: "Vĩ mô", lines: macro.length ? macro : ["Chưa tải được dữ liệu USD, VIX, ETF."] },
      { title: "Lịch tin mạnh hôm nay và đêm nay", lines: ev.length ? ev.map(e => e.txt) : ["Không có tin mạnh nào hôm nay và đêm nay."] },
      { title: `COT${c.date ? ` (báo cáo ${c.date.slice(8, 10)}/${c.date.slice(5, 7)})` : ""}`, lines: c.rows.length ? c.rows.map(r => r.txt) : ["Chưa tải được COT."] },
      ...(b ? [{ title: "Ngân sách rủi ro hôm nay", lines: b.lines }] : []),
    ],
  };
}

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function compassHtml(c) {
  return `🧭 <b>LA BÀN ${c.slot.name.toUpperCase()}</b> ${c.slot.icon} · ${c.title}\n` + c.sections.map(s => `<b>${esc(s.title)}</b>\n` + s.lines.map(l => (l.startsWith("→") || l.startsWith("⛔") ? "" : "• ") + esc(l)).join("\n")).join("\n") +
    "\n<i>Bối cảnh trong ngày, không phải tín hiệu vào lệnh.</i>";
}
export const compassText = c => `La bàn ${c.slot.name} ${c.title}: ${c.leans.map(x => `${x.name} ${x.label}`).join(", ")}`;
