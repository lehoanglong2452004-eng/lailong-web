// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: thẻ Kịch bản sốc ở trang Nhật ký, và cảnh báo 60 phút trước mỗi tin lớn khi đang có lệnh mở.
// Giá hiện tại và biên độ một ngày lấy từ nến ngày Binance Futures; mã không có trên Binance thì tính từ giá vào
// và biên độ ước lượng theo loại tài sản. Mỗi tin chỉ báo một lần (danh sách đã báo lưu trên máy này).
import { bigEvents, shockScenarios, shockHtml, shockText, assetClass, tone, FALLBACK, LEAD_MIN } from "./shock.js?v=202610240642";
import { riskLock, guard } from "./journal.js?v=202610240642";
import { avgReaction } from "./newsview.js?v=202610240642";
import { atrSeries } from "./radar.js?v=202610240642";
import { getJson, fmtDate, fmtVol, FLAG } from "./util.js?v=202610240642";

const SENT = "lailong.shock.sent";
const COL = { crypto: "BTC", metal: "Vàng", oil: "Dầu WTI", fx: "DXY" }; // cột phản ứng giá gần nhất với từng loại tài sản

export function initShock({ $, esc, table, alerts, journal, events, reactions }) {
  const cache = {};
  let last = null, busy = false;
  const sent = () => { try { return JSON.parse(localStorage.getItem(SENT) || "[]"); } catch { return []; } };
  const markSent = k => { try { localStorage.setItem(SENT, JSON.stringify([...sent(), k].slice(-30))); } catch { /* chế độ riêng tư */ } };
  const openTrades = () => journal.trades().filter(t => !(t.exit > 0) && t.qty > 0);

  // giá hiện tại và ATR 14 ngày (%) của nến ngày đã đóng
  async function quote(sym) {
    const c = cache[sym]; if (c && Date.now() - c.t < 5 * 60e3) return c;
    try {
      const k = await getJson(`https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(sym)}&interval=1d&limit=20`);
      const bars = k.map(x => ({ h: +x[2], l: +x[3], c: +x[4] })), done = bars.slice(0, -1), atr = atrSeries(done).at(-1), mark = bars.at(-1).c;
      if (!(atr > 0) || !(mark > 0)) throw new Error("thiếu nến");
      return (cache[sym] = { t: Date.now(), mark, atrPct: atr / done.at(-1).c * 100, est: false });
    } catch { return (cache[sym] = { t: Date.now() - 4 * 60e3, mark: null, atrPct: FALLBACK[assetClass(sym)], est: true }); }
  }

  // các lần trước: trung bình mức chạy 60 phút sau cùng loại tin, ở các tài sản gần với lệnh đang mở
  function history(ev, syms) {
    const r = reactions && reactions(); if (!r || !r.events) return "";
    const rows = avgReaction(r.events, r.assets).filter(x => x.country === ev.country && ev.titles.includes(x.title));
    if (!rows.length) return "";
    const x = rows.sort((a, b) => b.n - a.n)[0], cols = [...new Set((syms.length ? syms : ["BTCUSDT", "XAUUSDT"]).map(s => COL[assetClass(s)]))];
    const bits = cols.filter(a => x.avg[a] != null).map(a => `${a} chạy trung bình ${x.avg[a].toFixed(2)}%`);
    return bits.length ? `${bits.join(", ")} (${x.n} lần, tin ${x.title})` : "";
  }

  async function compute(ev) {
    const open = openTrades(), syms = [...new Set(open.map(t => t.sym))];
    const qs = Object.fromEntries(await Promise.all(syms.map(async s => [s, await quote(s)])));
    const pct = Object.fromEntries(syms.map(s => [s, ev.mult * qs[s].atrPct]));
    const res = shockScenarios(open.map(t => ({ ...t, mark: qs[t.sym].mark })), pct, ev.country);
    const trades = journal.trades(), cfg = journal.cfg(), L = riskLock(trades, cfg, Date.now(), journal.lock());
    return { ev, res, ctx: { equity: guard(trades, cfg).equity, budget: L.dayLim + L.dayPnl, hist: history(ev, syms) }, at: Date.now() };
  }

  // 60 phút trước tin lớn, nếu đang có lệnh mở: tính và báo một lần
  async function tick() {
    if (!alerts.cfg.shock || busy) return;
    const ev = bigEvents(events())[0];
    if (!ev || sent().includes(ev.key) || !openTrades().length) return;
    busy = true; markSent(ev.key);
    try {
      last = await compute(ev);
      alerts.fire("shock", shockText(last.ev, last.res), "down", true, { html: shockHtml(last.ev, last.res, last.ctx) });
      render();
    } finally { busy = false; }
  }

  const sgn = v => (v > 0 ? "+" : "") + fmtVol(v);
  const cls = v => v > 0 ? "pos" : v < 0 ? "neg" : "";
  function render() {
    const box = $("shockBody"); if (!box) return;
    const next = bigEvents(events(), Date.now(), 7 * 24 * 60)[0], n = openTrades().length;
    const head = next ? `<p>Tin lớn tiếp theo: <b>${FLAG[next.country] || esc(next.country)} ${esc(next.titles.join(", "))}</b> lúc ${fmtDate(next.t)} (còn ${until(next.t)}). Mức sốc = ${String(next.mult).replace(".", ",")} × biên độ một ngày.</p>` :
      `<p class="muted">Lịch tuần này không còn tin lớn nào của Mỹ, châu Âu, Anh, Nhật, Trung Quốc.</p>`;
    let body = "";
    if (last) {
      const { ev, res, ctx } = last, lab = res.linked;
      body = `<p class="muted">Tính lúc ${fmtDate(last.at).slice(11)} cho tin ${FLAG[ev.country] || esc(ev.country)} ${esc(ev.titles.join(", "))}. Số là lời (+) lỗ (-) USDT so với giá lúc tính.</p><div class="tablewrap">` +
        table(["Mã", "Phía", "Khối lượng", "Giá hiện tại", "Cắt lỗ", "Mức sốc", ...(lab ? [`${ev.country} mạnh lên`, `${ev.country} yếu đi`] : []), "Giật hai chiều"],
          res.rows.map(r => `<tr><td>${esc(r.sym)}</td><td class="${r.side === "long" ? "pos" : "neg"}">${r.side === "long" ? "LONG" : "SHORT"}</td><td>${fmtVol(r.qty)}</td><td>${r.est ? `<span data-tip="Không lấy được giá Binance, tính từ giá vào">≈ ${r.mark}</span>` : r.mark}</td><td>${r.stop}${r.stopHit ? ` <span class="tag gate" data-tip="Mức sốc vượt qua cắt lỗ: tính lỗ tới cắt lỗ cộng trượt giá">bị quét</span>` : ""}</td><td>±${r.pct.toFixed(2)}%</td>${lab ? `<td class="${cls(r.up)}">${sgn(r.up)}</td><td class="${cls(r.down)}">${sgn(r.down)}</td>` : ""}<td class="${cls(r.whip)}">${sgn(r.whip)}</td></tr>`)
            .concat(`<tr class="tot"><td colspan="6"><b>Tổng</b> (rủi ro tới cắt lỗ ${fmtVol(res.risk)} USDT)</td>${lab ? `<td class="${cls(res.up)}">${tone(res.up, ctx.budget)} ${sgn(res.up)}</td><td class="${cls(res.down)}">${tone(res.down, ctx.budget)} ${sgn(res.down)}</td>` : ""}<td class="${cls(res.whip)}">${tone(res.whip, ctx.budget)} ${sgn(res.whip)}</td></tr>`), "") +
        `</div><p class="note">Hôm nay ${ctx.budget > 0 ? `còn được lỗ ${fmtVol(ctx.budget)} USDT trước khi bị khoá` : "đã hết mức được lỗ"}. 🟢 lời · 🟡 dưới nửa mức còn được lỗ · 🟠 từ nửa trở lên · 🔴 chạm mức khoá.${ctx.hist ? ` Các lần trước, 60 phút sau tin này: ${esc(ctx.hist)}.` : ""}</p>`;
    } else body = n ? `<p class="muted">Đang mở ${n} lệnh có khối lượng. Bấm Tính ngay để xem trước.</p>` : `<p class="muted">Chưa có lệnh đang mở có khối lượng trong nhật ký.</p>`;
    box.innerHTML = head + body;
  }
  const until = t => { const m = Math.max(0, Math.round((t - Date.now()) / 60e3)); return m >= 60 * 24 ? `${Math.floor(m / 1440)} ngày ${Math.floor(m % 1440 / 60)} giờ` : m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${m} phút`; };

  $("shockNow").onclick = async () => {
    if (!openTrades().length) { last = null; render(); return; }
    const ev = bigEvents(events(), Date.now(), 7 * 24 * 60)[0] || { t: Date.now(), country: "USD", titles: ["tin rất mạnh"], mult: 1, key: "now" };
    $("shockNow").disabled = true;
    try { last = await compute(ev); render(); } finally { $("shockNow").disabled = false; }
  };
  setInterval(tick, 30e3); setTimeout(tick, 5e3);
  return { render, tick, lead: LEAD_MIN };
}
