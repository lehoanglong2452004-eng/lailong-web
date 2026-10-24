// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: thẻ La bàn ở trang Nhật ký, và 4 bản tin Telegram cố định mỗi ngày: sáng 7:30, trưa 11:30, chiều 15:30, tối 20:00.
// Mỗi khung gửi một lần. Nếu tới giờ mà Desk chưa mở thì gửi khung gần nhất ngay khi mở; các khung đã qua trước đó bỏ qua.
// Các khung đã gửi hôm nay và gió của mấy bản gần nhất (để so với bản trước) lưu trên máy này.
// Bản web đọc data/markets.json, vol.json, flows.json, cot.json do GitHub Actions cập nhật; bản laptop lấy qua máy chủ.
import { compass, compassHtml, compassText, SLOTS, slotOf, dayKey } from "./compass.js?v=202610240642";
import { getJson } from "./util.js?v=202610240642";

const STORE = "lailong.compass";

export function initCompass({ $, esc, toast, alerts, journal, events }) {
  let st = { day: "", sent: [], log: [] }, data = {}, loadedAt = 0;
  try { st = { ...st, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch { /* chế độ riêng tư */ }
  // bản cũ chỉ có một giờ gửi: { at, sent: "ngày đã gửi" }
  if (typeof st.sent === "string") st = { day: st.sent, sent: st.sent ? ["sang"] : [], log: [] };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch { /* chế độ riêng tư */ } };
  const sentToday = now => st.day === dayKey(now) ? st.sent : [];
  // bản gần nhất trước khung đang xem, để so gió xuôi / gió ngược
  const prevFor = (slot, now) => [...st.log].reverse().find(x => !(x.day === dayKey(now) && x.id === slot.id)) || null;

  async function load() {
    const get = async u => { try { return await getJson(`${u}?t=${Math.floor(Date.now() / 60e3)}`); } catch { return null; } };
    const [m, v, f, c] = await Promise.all([get("data/markets.json"), get("data/vol.json"), get("data/flows.json"), get("data/cot.json")]);
    data = { fx: m ? m.fx : data.fx, vol: v ? v.items : data.vol, flows: f || data.flows, cot: c ? c.items : data.cot };
    loadedAt = Date.now(); render();
  }
  const build = (now = Date.now(), slot = slotOf(now).slot) =>
    compass({ ...data, events: events(), trades: journal.trades(), cfg: journal.cfg(), lock: journal.lock(), now, slot, prev: prevFor(slot, now) });

  function render() {
    const box = $("compassBody"); if (!box) return;
    if (!loadedAt) { box.innerHTML = `<div class="muted">Đang tải dữ liệu…</div>`; return; }
    const now = Date.now(), c = build(now), done = sentToday(now);
    box.innerHTML = c.sections.map(s => `<div class="cps"><h4>${esc(s.title)}</h4><ul>${s.lines.map(l => `<li${l.startsWith("→") ? ` class="lean"` : ""}>${esc(l)}</li>`).join("")}</ul></div>`).join("") +
      `<p class="note">Đang xem bản ${esc(c.slot.name)}. Bối cảnh trong ngày, không phải tín hiệu vào lệnh. Tự gửi 4 bản mỗi ngày qua Telegram (bật ở menu Cảnh báo): ` +
      SLOTS.map(s => `${s.at} ${s.name}${done.includes(s.id) ? " ✓" : ""}`).join(" · ") + `.</p>`;
  }

  // khung nào tới giờ thì gửi một lần; chờ dữ liệu tải xong mới gửi; trước 7:30 không gửi bù bản tối hôm qua
  function tick() {
    if (!alerts.cfg.compass || !loadedAt) return;
    const now = Date.now(), { slot, today } = slotOf(now), done = sentToday(now);
    if (!today || done.includes(slot.id)) return;
    const c = build(now, slot);
    st.day = c.day; st.sent = [...done, slot.id];
    st.log = [...st.log, { t: now, day: c.day, id: slot.id, name: slot.name, leans: c.leans.map(x => ({ name: x.name, label: x.label })) }].slice(-6);
    save();
    alerts.fire("compass", compassText(c), "price", true, { html: compassHtml(c) });
    render();
  }

  $("compassSend").onclick = () => {
    if (!loadedAt) return toast("Dữ liệu chưa tải xong", true);
    const c = build();
    toast(alerts.telegram(compassText(c), true, compassHtml(c)) ? `Đã gửi La bàn ${c.slot.name} qua Telegram` : "Nhập mã bot và chat id ở menu Cảnh báo trước", !alerts.tg.token || !alerts.tg.chat);
  };
  load(); setInterval(load, 30 * 60e3);
  setTimeout(tick, 20e3); setInterval(tick, 60e3);
  setInterval(render, 5 * 60e3);
  return { render, tick, data: () => data };
}
