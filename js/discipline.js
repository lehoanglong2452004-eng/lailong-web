// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: Gác cổng kỷ luật (phần tính toán, không đụng giao diện).
//
// - Kiểm tra lệnh vừa vào: gỡ gạc ngay sau lệnh thua, rủi ro vượt mức cho phép, vào sát giờ tin mạnh.
// - Báo trước khi sắp bị khoá: còn một lệnh thua nữa là đủ chuỗi thua, lỗ ngày hoặc tuần đã gần chạm giới hạn.
// - Soạn tin Telegram theo kiểu HTML của Telegram (chỉ in đậm), mọi chữ bro gõ đều được thoát ký tự.
import { result, riskLock, guard, weekStart } from "./journal.js?v=202610240523";
import { fmtDate, FLAG } from "./util.js?v=202610240523";

export const REVENGE_MIN = 15; // vào lệnh trong chừng này phút sau một lệnh thua thì coi là gỡ gạc
export const OVERSIZE = 1.25; // rủi ro lệnh vượt 1,25 lần mức % vốn cho phép
export const NEWS_BEFORE = 15, NEWS_AFTER = 5; // vào lệnh từ 15 phút trước tới 5 phút sau tin mạnh
export const NEAR = 0.66; // lỗ đã tới 66% giới hạn thì báo sắp khoá
export const GATE = { revenge: "gỡ gạc", size: "quá rủi ro", news: "sát giờ tin" };

const MIN = 60e3;
const riskOf = t => Math.abs(t.entry - t.stop) * (+t.qty || 0);
const usd = x => (Math.round(x * 100) / 100).toLocaleString("en-US");
const sR = x => (x > 0 ? "+" : "") + x.toFixed(1) + "R";
const hm = t => fmtDate(t).slice(11);
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const escHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// lệnh mới cand so với các lệnh đã ghi. events: lịch kinh tế {t, title, country, impact}.
// Trả về [{ code, lvl, txt }], lvl "stop" là dấu hiệu mạnh, "warn" là nhắc.
// Ô "Vào lúc" chỉ có tới phút, nên lệnh đóng trong cùng phút với giờ vào lệnh mới vẫn tính là đóng trước.
export function entryChecks(trades, cand, cfg, { events = [] } = {}) {
  const out = [], others = trades.filter(t => t.id !== cand.id);
  const closed = others.filter(t => result(t) && (t.tExit || t.t) < cand.t + MIN).sort((a, b) => (a.tExit || a.t) - (b.tExit || b.t));
  const last = closed[closed.length - 1];
  if (last && result(last).pnl < 0 && cand.t - (last.tExit || last.t) <= REVENGE_MIN * MIN) {
    const r = result(last), gap = Math.max(0, Math.round((cand.t - (last.tExit || last.t)) / MIN));
    let n = 0; for (let i = closed.length - 1; i >= 0 && result(closed[i]).pnl < 0; i--) n++;
    const bits = [];
    if (last.sym === cand.sym) bits.push(last.side === cand.side ? "cùng mã, cùng chiều" : "cùng mã, đảo chiều");
    const k = riskOf(last) > 0 && riskOf(cand) > 0 ? riskOf(cand) / riskOf(last) : 0;
    if (k >= 1.3) bits.push(`rủi ro gấp ${k.toFixed(1)} lần lệnh vừa thua`);
    out.push({ code: "revenge", lvl: "stop", txt: `Vào lệnh ${gap ? `${gap} phút sau` : "ngay sau"} lệnh thua ${last.sym} ${sR(r.R)}${last.qty ? ` (${usd(r.pnl)} USDT)` : ""}${n >= 2 ? `, đang thua ${n} lệnh liên tiếp` : ""}${bits.length ? `: ${bits.join(", ")}` : ""}. Rất dễ là lệnh gỡ gạc.` });
  }
  const allowed = guard(others, cfg, cand.t).equity * cfg.riskPct / 100, risk = riskOf(cand);
  if (allowed > 0 && risk > allowed * OVERSIZE) out.push({ code: "size", lvl: risk > allowed * 2 ? "stop" : "warn", txt: `Rủi ro ${usd(risk)} USDT, gấp ${(risk / allowed).toFixed(1)} lần mức ${cfg.riskPct}% vốn (${usd(allowed)} USDT).` });
  const ev = events.filter(e => e.impact === "High" && cand.t >= e.t - NEWS_BEFORE * MIN && cand.t <= e.t + NEWS_AFTER * MIN).sort((a, b) => Math.abs(a.t - cand.t) - Math.abs(b.t - cand.t));
  if (ev.length) {
    const e = ev[0], same = ev.filter(x => x.t === e.t && x.country === e.country), m = Math.round((e.t - cand.t) / MIN);
    out.push({ code: "news", lvl: "warn", txt: `Vào lệnh ${m > 0 ? `${m} phút trước` : m < 0 ? `${-m} phút sau` : "đúng lúc ra"} tin ${FLAG[e.country] || e.country} ${same.map(x => x.title).join(", ")} (${hm(e.t)}). Quanh giờ tin giá giật hai chiều, trượt giá lớn.` });
  }
  return out;
}

// sắp bị khoá: [{ key, txt }], key để mỗi mốc chỉ báo một lần (theo ngày hoặc tuần)
export function nearLock(trades, cfg, now = Date.now(), prev = null) {
  const L = riskLock(trades, cfg, now, prev);
  if (L.lock) return [];
  const per = guard(trades, cfg, now).equity * cfg.riskPct / 100, day = dayKey(now), out = [];
  const room = x => per > 0 ? x < per ? ` (chưa tới 1 lệnh thua ${usd(per)} USDT)` : ` (khoảng ${Math.floor(x / per + 1e-9)} lệnh thua ${usd(per)} USDT)` : "";
  if (cfg.lossStreak > 1 && L.streak >= 1 && L.streak === cfg.lossStreak - 1)
    out.push({ key: `streak|${day}|${L.streak}`, txt: `Đã thua ${L.streak} lệnh liên tiếp hôm nay. Thua thêm 1 lệnh nữa là khoá giao dịch tới 00:00.` });
  if (cfg.dayLossPct > 0 && L.dayLim > 0 && -L.dayPnl >= NEAR * L.dayLim) {
    const x = L.dayLim + L.dayPnl;
    out.push({ key: `day|${day}`, txt: `Hôm nay đã lỗ ${usd(-L.dayPnl)} / ${usd(L.dayLim)} USDT (${Math.round(-L.dayPnl / L.dayLim * 100)}% giới hạn ngày). Lỗ thêm ${usd(x)} USDT nữa${room(x)} là khoá tới 00:00.` });
  }
  if (cfg.weekLossPct > 0 && L.weekLim > 0 && -L.weekPnl >= NEAR * L.weekLim) {
    const x = L.weekLim + L.weekPnl;
    out.push({ key: `week|${dayKey(weekStart(now))}`, txt: `Tuần này đã lỗ ${usd(-L.weekPnl)} / ${usd(L.weekLim)} USDT (${Math.round(-L.weekPnl / L.weekLim * 100)}% giới hạn tuần). Lỗ thêm ${usd(x)} USDT nữa${room(x)} là khoá tới thứ Hai.` });
  }
  const todayN = trades.filter(t => dayKey(t.t) === day).length;
  if (cfg.maxTrades > 1 && todayN === cfg.maxTrades - 1)
    out.push({ key: `count|${day}`, txt: `Đã vào ${todayN} lệnh hôm nay, còn 1 lệnh nữa là chạm mức tối đa ${cfg.maxTrades} lệnh/ngày.` });
  return out;
}

// tóm tắt các lệnh đã đóng hôm nay, cho tin khoá
export function daySummary(trades, now = Date.now()) {
  const day = dayKey(now), rs = trades.filter(t => result(t) && dayKey(t.tExit || t.t) === day).map(result);
  return { n: rs.length, win: rs.filter(r => r.pnl > 0).length, loss: rs.filter(r => r.pnl < 0).length, pnl: rs.reduce((a, r) => a + r.pnl, 0), R: rs.reduce((a, r) => a + r.R, 0) };
}

const lines = items => items.map(i => `• ${escHtml(i.txt)}`).join("\n");

export function gateHtml(cand, items) {
  return `⚠️ <b>GÁC CỔNG KỶ LUẬT</b>\n${escHtml(cand.sym)} ${cand.side === "long" ? "LONG" : "SHORT"} vào lúc ${hm(cand.t)}\n${lines(items)}\n` +
    (items.some(i => i.code === "revenge") ? `→ Bro đã xác nhận vẫn vào. Nghỉ ${REVENGE_MIN} phút và xem lại kế hoạch trước lệnh tiếp theo.` : "→ Bro đã xác nhận vẫn vào. Giữ đúng cắt lỗ đã đặt.");
}

export function nearHtml(items) {
  return `🟠 <b>SẮP BỊ KHOÁ GIAO DỊCH</b>\n${lines(items)}\n→ Lệnh tiếp theo chỉ vào khi đúng kế hoạch, hoặc dừng hôm nay.`;
}

export function lockHtml(lock, sum) {
  return `⛔ <b>ĐÃ KHOÁ GIAO DỊCH</b> tới ${fmtDate(lock.until)}\n${escHtml(lock.why)}.\n` +
    (sum && sum.n ? `Hôm nay: ${sum.n} lệnh đã đóng, thắng ${sum.win}, thua ${sum.loss}, tổng ${usd(sum.pnl)} USDT (${sR(sum.R)}).\n` : "") +
    `Lệnh mới trong nhật ký và lệnh giả lập bị chặn tới giờ đó, chỉ được đóng lệnh đang mở.`;
}
