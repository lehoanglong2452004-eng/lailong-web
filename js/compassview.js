// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: thẻ La bàn sáng ở trang Nhật ký, và tin Telegram mỗi ngày một lần vào giờ đã chọn.
// Nếu tới giờ mà Desk chưa mở thì gửi ngay khi mở trong ngày đó. Giờ gửi và ngày đã gửi lưu trên máy này.
// Bản web đọc data/markets.json, vol.json, flows.json, cot.json do GitHub Actions cập nhật; bản laptop lấy qua máy chủ.
import { compass, compassHtml, compassText } from "./compass.js?v=202610240537";
import { getJson } from "./util.js?v=202610240537";

const STORE = "lailong.compass";

export function initCompass({ $, esc, toast, alerts, journal, events }) {
  let st = { at: "07:30", sent: "" }, data = {}, loadedAt = 0;
  try { st = { ...st, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch { /* chế độ riêng tư */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch { /* chế độ riêng tư */ } };

  async function load() {
    const get = async u => { try { return await getJson(`${u}?t=${Math.floor(Date.now() / 60e3)}`); } catch { return null; } };
    const [m, v, f, c] = await Promise.all([get("data/markets.json"), get("data/vol.json"), get("data/flows.json"), get("data/cot.json")]);
    data = { fx: m ? m.fx : data.fx, vol: v ? v.items : data.vol, flows: f || data.flows, cot: c ? c.items : data.cot };
    loadedAt = Date.now(); render();
  }
  const build = (now = Date.now()) => compass({ ...data, events: events(), trades: journal.trades(), cfg: journal.cfg(), lock: journal.lock(), now });

  function render() {
    const box = $("compassBody"); if (!box) return;
    if (!loadedAt) { box.innerHTML = `<div class="muted">Đang tải dữ liệu…</div>`; return; }
    const c = build();
    box.innerHTML = c.sections.map(s => `<div class="cps"><h4>${esc(s.title)}</h4><ul>${s.lines.map(l => `<li${l.startsWith("→") ? ` class="lean"` : ""}>${esc(l)}</li>`).join("")}</ul></div>`).join("") +
      `<p class="note">Bối cảnh trong ngày, không phải tín hiệu vào lệnh. ${st.sent === c.day ? "Hôm nay đã gửi qua Telegram." : `Tự gửi qua Telegram lúc ${esc(st.at)} mỗi ngày (bật ở menu Cảnh báo).`}</p>`;
  }

  // tới giờ thì gửi một lần trong ngày; chờ dữ liệu tải xong mới gửi
  function tick() {
    if (!alerts.cfg.compass || !loadedAt) return;
    const now = new Date(), [h, m] = String(st.at || "07:30").split(":").map(Number), at = new Date(now); at.setHours(h || 0, m || 0, 0, 0);
    const c = build(now.getTime());
    if (now < at || st.sent === c.day) return;
    st.sent = c.day; save();
    alerts.fire("compass", compassText(c), "price", true, { html: compassHtml(c) });
    render();
  }

  $("compassAt").value = st.at;
  $("compassAt").onchange = () => { if (/^\d\d:\d\d$/.test($("compassAt").value)) { st.at = $("compassAt").value; save(); render(); } };
  $("compassSend").onclick = () => {
    if (!loadedAt) return toast("Dữ liệu chưa tải xong", true);
    const c = build();
    toast(alerts.telegram(compassText(c), true, compassHtml(c)) ? "Đã gửi La bàn sáng qua Telegram" : "Nhập mã bot và chat id ở menu Cảnh báo trước", !alerts.tg.token || !alerts.tg.chat);
  };
  load(); setInterval(load, 30 * 60e3);
  setTimeout(tick, 20e3); setInterval(tick, 60e3);
  return { render, tick };
}
