// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: Kịch bản sốc trước tin lớn (phần tính toán, không đụng giao diện).
//
// Trước tin lớn, ước tính các lệnh đang mở trong nhật ký sẽ lời lỗ bao nhiêu nếu giá giật mạnh.
// - Mức sốc của mỗi mã = hệ số × biên độ trung bình một ngày (ATR 14 nến ngày, theo %). Hệ số 1 với tin rất mạnh
//   của Mỹ (CPI, việc làm, Fed, PCE), 0,6 với tin mạnh khác của Mỹ, 0,4 với tin mạnh của châu Âu, Anh, Nhật, Trung Quốc.
// - Ba kịch bản: đồng tiền của tin mạnh lên, yếu đi, và giật hai chiều quét cả hai phía (mọi lệnh cùng bị đi ngược).
//   Coin, vàng, dầu tính bằng USD nên USD mạnh lên thì giá giảm.
// - Giá chạm cắt lỗ thì coi như khớp trượt thêm 20% quãng sốc; chạm mục tiêu thì chốt ở mục tiêu.
import { fmtDate, FLAG } from "./util.js?v=202610240610";

export const LEAD_MIN = 60; // báo trước tin chừng này phút
export const SLIP = 0.2; // trượt giá khi cắt lỗ bị quét lúc ra tin, tính theo quãng sốc
export const BIG = ["USD", "EUR", "GBP", "JPY", "CNY"];
export const FALLBACK = { crypto: 4, metal: 1.5, oil: 2.5, fx: 0.6 }; // % biên độ một ngày khi không lấy được nến
export const TOP = /CPI|Non-Farm|NFP|FOMC|Federal Funds|Fed Chair|Powell|PCE/i; // tin rất mạnh của Mỹ
const CCY = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "CNH"];
const MIN = 60e3;
const num = x => (Math.round(x * 100) / 100).toLocaleString("en-US");
const usd = x => (x > 0 ? "+" : "") + num(x);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// tin lớn sắp ra trong lead phút tới, các tin cùng giờ cùng nước gộp làm một
export function bigEvents(events, now = Date.now(), lead = LEAD_MIN) {
  const out = [];
  for (const e of events || []) {
    if (e.impact !== "High" || !BIG.includes(e.country) || !(e.t > now) || e.t - now > lead * MIN) continue;
    const g = out.find(x => x.t === e.t && x.country === e.country);
    if (g) g.titles.push(e.title); else out.push({ t: e.t, country: e.country, titles: [e.title] });
  }
  for (const g of out) {
    g.top = g.country === "USD" && g.titles.some(x => TOP.test(x));
    g.mult = g.country === "USD" ? (g.top ? 1 : 0.6) : 0.4;
    g.key = `${g.t}|${g.country}`;
  }
  return out.sort((a, b) => a.t - b.t);
}

// mã giao dịch -> đồng gốc và đồng định giá (BTCUSDT -> BTC/USD, USDJPY -> USD/JPY, XAUUSD -> XAU/USD)
export function parts(sym) {
  const s = String(sym || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/PERP$/, "");
  const m = s.match(/^(.+?)(USDT|USDC|FDUSD|BUSD)$/);
  if (m) return { base: m[1], quote: "USD" };
  if (s.length === 6 && CCY.includes(s.slice(0, 3)) && CCY.includes(s.slice(3))) return { base: s.slice(0, 3), quote: s.slice(3) };
  const n = s.match(/^(.+?)USD$/);
  return n ? { base: n[1], quote: "USD" } : { base: s, quote: "USD" };
}

export function assetClass(sym) {
  const { base } = parts(sym);
  if (/^(XAU|XAG|XPT|XPD|PAXG|GOLD|SILVER|PLATINUM|COPPER|XCU)/.test(base)) return "metal";
  if (/^(WTI|BRENT|USOIL|UKOIL|OIL|CL|NATGAS|NG)$/.test(base)) return "oil";
  return CCY.includes(base) ? "fx" : "crypto";
}

// giá đi chiều nào khi đồng ccy mạnh lên: +1 tăng, -1 giảm, 0 không liên quan trực tiếp
export function ccySign(sym, ccy) {
  const { base, quote } = parts(sym);
  return base === ccy ? 1 : quote === ccy ? -1 : 0;
}

// positions: [{ sym, side, qty, entry, stop, target, mark }]; pct: { mã: % sốc }; ccy: đồng tiền của tin.
// Số trả về là lời (+) lỗ (-) USDT so với giá hiện tại.
export function shockScenarios(positions, pct, ccy) {
  const rows = positions.filter(p => p.qty > 0 && p.entry > 0).map(p => {
    const m = p.mark > 0 ? p.mark : p.entry, dir = p.side === "long" ? 1 : -1, sh = pct[p.sym] ?? 0, x = sh / 100 * m;
    const toStop = p.stop > 0 ? Math.max(0, dir * (m - p.stop)) : Infinity;
    const toTgt = p.target > 0 ? Math.max(0, dir * (p.target - m)) : Infinity;
    const lose = Math.min(x, toStop + SLIP * x) * p.qty, gain = Math.min(x, toTgt) * p.qty;
    const s = ccySign(p.sym, ccy) * dir; // +1: đồng tiền của tin mạnh lên thì lệnh này lời
    const move = k => k > 0 ? gain : k < 0 ? -lose : 0;
    return { sym: p.sym, side: p.side, qty: p.qty, mark: m, stop: p.stop, est: !(p.mark > 0), pct: sh, stopHit: x >= toStop, risk: isFinite(toStop) ? toStop * p.qty : null, up: move(s), down: move(-s), whip: -lose };
  });
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  return { rows, up: sum("up"), down: sum("down"), whip: sum("whip"), risk: rows.reduce((a, r) => a + (r.risk ?? 0), 0), linked: rows.some(r => r.up || r.down) };
}

// màu theo mức còn được lỗ hôm nay trước khi bị khoá
export function tone(v, budget) {
  if (v >= 0) return "🟢";
  if (!(budget > 0) || -v >= budget) return "🔴";
  return -v >= budget / 2 ? "🟠" : "🟡";
}

const evName = ev => `${FLAG[ev.country] || ev.country} ${ev.titles.join(", ")}`;
const sideName = s => s === "long" ? "LONG" : "SHORT";

export function shockText(ev, res) {
  return `Kịch bản sốc trước tin ${ev.country} ${ev.titles.join(", ")} (${fmtDate(ev.t).slice(11)}): giật hai chiều ${usd(res.whip)} USDT` +
    (res.linked ? `, ${ev.country} mạnh lên ${usd(res.up)}, ${ev.country} yếu đi ${usd(res.down)}` : "");
}

// ctx: { equity, budget (còn được lỗ hôm nay), hist (chuỗi phản ứng giá các lần trước), now }
export function shockHtml(ev, res, { equity = 0, budget = null, hist = "", now = Date.now() } = {}) {
  const mins = Math.max(0, Math.round((ev.t - now) / MIN)), pc = v => equity > 0 ? ` (${(Math.abs(v) / equity * 100).toFixed(1)}% vốn)` : "";
  const line = (label, v) => `${tone(v, budget)} ${label}: <b>${usd(v)} USDT</b>${v < 0 ? pc(v) : ""}${v < 0 && budget != null && -v >= budget ? ", vượt mức còn được lỗ → sẽ bị khoá" : ""}`;
  const worst = res.rows.slice().sort((a, b) => a.whip - b.whip)[0];
  return [
    `🌪 <b>KỊCH BẢN SỐC</b> · còn ${mins} phút tới tin ${esc(evName(ev))} (${fmtDate(ev.t).slice(11)})`,
    `Đang mở ${res.rows.length} lệnh, rủi ro tới cắt lỗ ${num(res.risk)} USDT${pc(res.risk)}.` +
      (budget != null ? budget > 0 ? ` Hôm nay còn được lỗ ${num(budget)} USDT trước khi bị khoá.` : " Hôm nay đã hết mức được lỗ." : ""),
    `Mức sốc: ${res.rows.map(r => `${esc(r.sym)} ±${r.pct.toFixed(1)}%`).filter((x, i, a) => a.indexOf(x) === i).join(", ")}`,
    ...(res.linked ? [line(`${ev.country} mạnh lên`, res.up), line(`${ev.country} yếu đi`, res.down)] : []),
    line("Giật hai chiều, quét cả hai phía", res.whip),
    ...(worst && worst.whip < 0 ? [`→ Lệnh gánh nhiều nhất: ${esc(worst.sym)} ${sideName(worst.side)} ${usd(worst.whip)} USDT. Cân nhắc giảm khối lượng hoặc đứng ngoài trước tin.`] : []),
    ...(hist ? [`Các lần trước, 60 phút sau tin này: ${esc(hist)}.`] : []),
  ].join("\n");
}
