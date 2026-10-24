// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: thẻ Đồng thuận 4 lớp ở trang Nhật ký, và cảnh báo khi một mã trong danh sách theo dõi có đủ 4 lớp cùng chiều.
// Quét mỗi 5 phút bằng nến 1 giờ Binance Futures đã đóng. Một mã vào trạng thái đồng thuận thì báo một lần; hết đồng thuận
// rồi quay lại thì báo lần nữa. Đang khoá giao dịch thì không báo. Danh sách mã và trạng thái lưu trên máy này.
import { evaluate, consensusHtml, consensusText } from "./consensus.js?v=202610240622";
import { leans, usdTrend, riskMood, etfFlow } from "./compass.js?v=202610240622";
import { bigEvents } from "./shock.js?v=202610240622";
import { guard } from "./journal.js?v=202610240622";
import { getJson, fmtDate, fmtVol } from "./util.js?v=202610240622";

const STORE = "lailong.consensus";
const DEF_SYMS = "BTCUSDT, ETHUSDT, SOLUSDT, XAUUSDT";
const H = 3600e3;

export function initConsensus({ $, esc, toast, alerts, journal, events, macro }) {
  let st = { syms: DEF_SYMS, active: {} }, rows = [], at = 0, busy = false;
  try { st = { ...st, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch { /* chế độ riêng tư */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch { /* chế độ riêng tư */ } };
  const list = () => [...new Set(String(st.syms).toUpperCase().split(/[\s,;]+/).filter(Boolean))].slice(0, 12);
  const cache = {};

  // nến 1 giờ đã đóng; mỗi giờ tải lại một lần
  async function bars(sym) {
    const hour = Math.floor(Date.now() / H), c = cache[sym];
    if (c && c.hour === hour) return c.bars;
    try {
      const k = await getJson(`https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(sym)}&interval=1h&limit=121`);
      const b = k.map(r => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5], bv: +r[9] })).filter(x => x.t + H <= Date.now());
      cache[sym] = { hour, bars: b }; return b;
    } catch { return null; }
  }

  async function scan(manual = false) {
    if (busy) return; busy = true;
    if (manual) $("cnsNow").disabled = true;
    try {
      const d = macro() || {}, L = leans(usdTrend(d.fx), riskMood(d.vol), etfFlow(d.flows));
      const cfg = journal.cfg(), equity = guard(journal.trades(), cfg).equity, out = [];
      for (const s of list()) { const b = await bars(s); out.push(b && b.length >= 60 ? evaluate(s, { bars: b, leans: L, cot: d.cot, cfg, equity }) : { sym: s, err: true }); }
      rows = out; at = Date.now();
      if (d.fx || d.vol || d.cot) notify(out);
      render();
    } finally { busy = false; if (manual) $("cnsNow").disabled = false; }
  }

  // báo khi một mã vừa vào trạng thái đồng thuận
  function notify(out) {
    const lock = journal.lock(), soon = bigEvents(events())[0], equity = guard(journal.trades(), journal.cfg()).equity;
    for (const r of out) {
      if (r.err) continue;
      const was = st.active[r.sym];
      if (!r.dir) { delete st.active[r.sym]; continue; }
      if (was && was.dir === r.dir) continue;
      st.active[r.sym] = { dir: r.dir, t: Date.now() };
      if (!alerts.cfg.consensus || lock) continue;
      const warn = soon ? [`Còn ${Math.round((soon.t - Date.now()) / 60e3)} phút tới tin ${soon.country} ${soon.titles.join(", ")}: đợi qua tin rồi hãy vào.`] : [];
      if (r.plan && equity > 0 && r.plan.notional > 3 * equity) warn.push(`Giá trị lệnh bằng ${(r.plan.notional / equity).toFixed(1)} lần vốn: cắt lỗ đang rất gần, dễ bị quét bởi nhiễu.`);
      alerts.fire("cns" + r.sym, consensusText(r), r.dir > 0 ? "up" : "down", true, { html: consensusHtml(r, { warn }) });
    }
    save();
  }

  const pip = l => `<span class="cpip ${l.dir > 0 ? "pos" : l.dir < 0 ? "neg" : "muted"}" data-tip="${esc(l.name)}: ${esc(l.txt)}">${l.dir > 0 ? "▲" : l.dir < 0 ? "▼" : "■"}</span>`;
  const p = x => +x.toPrecision(6);
  function render() {
    const box = $("cnsBody"); if (!box) return;
    if (!at) { box.innerHTML = `<div class="muted">${busy ? "Đang quét…" : "Chưa quét. Bấm Quét ngay hoặc chờ vài giây."}</div>`; return; }
    box.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Mã</th><th>Vĩ mô</th><th>COT</th><th>Cấu trúc 1h</th><th>Order flow 1h</th><th>Kết luận</th><th>Kế hoạch</th><th></th></tr></thead><tbody>` +
      rows.map(r => r.err ? `<tr><td>${esc(r.sym)}</td><td colspan="7" class="muted">Không lấy được nến 1h Binance Futures cho mã này.</td></tr>` :
        `<tr><td>${esc(r.sym)}</td>${r.layers.map(l => `<td>${pip(l)}</td>`).join("")}<td class="${r.dir > 0 ? "pos" : r.dir < 0 ? "neg" : ""}">${r.dir ? `<b>${r.dir > 0 ? "LONG" : "SHORT"} 4/4</b>` : r.lean && r.count >= 3 ? `nghiêng ${r.lean > 0 ? "LONG" : "SHORT"} ${r.count}/4` : `<span class="muted">chưa đồng thuận</span>`}</td>` +
        `<td class="t">${r.plan ? `Vào ${p(r.plan.zone[0])}–${p(r.plan.zone[1])}<br>Cắt lỗ ${p(r.plan.stop)} · mục tiêu ${p(r.plan.target)}<br>KL ${fmtVol(r.plan.qty)} (rủi ro ${fmtVol(r.plan.riskUsd)} USDT)` : ""}</td>` +
        `<td>${r.plan ? `<button class="tool" data-cfill="${esc(r.sym)}" data-tip="Điền vào ô Tính khối lượng lệnh bên trái">Đưa vào ô tính</button>` : ""}</td></tr>`).join("") +
      `</tbody></table></div><p class="note">Quét lúc ${fmtDate(at).slice(11)} bằng nến 1 giờ Binance đã đóng, tự quét lại mỗi 5 phút. ▲ ủng hộ LONG, ▼ ủng hộ SHORT, ■ trung lập; rê chuột lên ô để xem lý do. Đủ 4/4 thì báo qua tiếng và Telegram (bật ở menu Cảnh báo).</p>`;
  }

  $("cnsSyms").value = st.syms;
  $("cnsSyms").onchange = () => { st.syms = $("cnsSyms").value.trim() || DEF_SYMS; $("cnsSyms").value = st.syms; save(); scan(true); };
  $("cnsNow").onclick = () => scan(true);
  $("cnsBody").onclick = e => {
    const b = e.target.closest("[data-cfill]"), r = b && rows.find(x => x.sym === b.dataset.cfill); if (!r || !r.plan) return;
    $("szSym").value = r.sym; $("szSide").value = r.plan.side; $("szEntry").value = p(r.plan.entry); $("szStop").value = p(r.plan.stop); $("szTarget").value = p(r.plan.target);
    $("szStop").dispatchEvent(new Event("input")); $("szOut").scrollIntoView({ behavior: "smooth", block: "center" });
    toast(`Đã điền ${r.sym} ${r.plan.side.toUpperCase()} vào ô tính khối lượng`);
  };
  setTimeout(scan, 25e3); setInterval(scan, 5 * 60e3);
  return { render, scan };
}
