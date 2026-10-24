// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: nghe nút bấm dưới tin Telegram (callback "opt:BTC"…) khi Desk đang mở.
// Hỏi api.telegram.org bằng getUpdates (long polling 25 giây), chỉ nhận nút bấm từ đúng chat id đã cài.
// Lúc bắt đầu bỏ qua các lần bấm cũ khi Desk còn tắt. Nhiều tab cùng mở thì chỉ một tab nghe (khoá trong localStorage).
// Bot đang đặt webhook ở nơi khác thì Telegram trả lỗi 409: tab này lùi lại, thử lại sau.
const LOCK = "lailong.tgpoll", API = "https://api.telegram.org/bot";
const tabId = Math.random().toString(36).slice(2);

// lấy nút bấm còn hiệu lực từ một lô update; trả về { offset, taps: [{ id, data }] }
export function readTaps(updates, chat, offset = 0) {
  const taps = [];
  for (const u of updates || []) {
    offset = Math.max(offset, u.update_id + 1);
    const q = u.callback_query, c = q && q.message && q.message.chat;
    if (q && c && String(c.id) === String(chat) && typeof q.data === "string") taps.push({ id: q.id, data: q.data });
  }
  return { offset, taps };
}

export function initTgBot({ alerts, onTap }) {
  let offset = null, wait = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // giữ khoá nghe: tab giữ khoá làm mới mỗi lần hỏi; khoá cũ hơn 60 giây thì tab khác lấy
  const own = () => {
    try {
      const l = JSON.parse(localStorage.getItem(LOCK) || "{}");
      if (l.id && l.id !== tabId && Date.now() - l.t < 60e3) return false;
      localStorage.setItem(LOCK, JSON.stringify({ id: tabId, t: Date.now() }));
    } catch { /* chế độ riêng tư: vẫn nghe */ }
    return true;
  };
  const call = async (method, params) => {
    const r = await fetch(`${API}${encodeURIComponent(alerts.tg.token)}/${method}?${new URLSearchParams(params)}`);
    const j = await r.json().catch(() => ({ ok: false, error_code: r.status }));
    if (!j.ok) throw Object.assign(new Error(j.description || `HTTP ${r.status}`), { code: j.error_code || r.status });
    return j.result;
  };
  async function loop() {
    for (;;) {
      const { on, token, chat } = alerts.tg;
      if (!on || !token || !chat || !own()) { offset = null; await sleep(30e3); continue; }
      try {
        // lần đầu: nhảy qua mọi lần bấm cũ
        if (offset == null) { const last = await call("getUpdates", { offset: -1, timeout: 0 }); offset = last.length ? last[last.length - 1].update_id + 1 : 0; }
        const ups = await call("getUpdates", { offset, timeout: 25, allowed_updates: JSON.stringify(["callback_query"]) });
        const r = readTaps(ups, chat, offset); offset = r.offset; wait = 0;
        for (const t of r.taps) {
          fetch(`${API}${encodeURIComponent(token)}/answerCallbackQuery`, { method: "POST", mode: "no-cors", body: new URLSearchParams({ callback_query_id: t.id, text: "Đang soạn bản tin…" }) }).catch(() => {});
          try { await onTap(t.data); } catch { /* bỏ qua lần bấm lỗi */ }
        }
      } catch (e) {
        // 401: sai mã bot; 409: có webhook hoặc nơi khác đang nghe; còn lại: mất mạng
        wait = e.code === 401 || e.code === 409 ? 5 * 60e3 : Math.min(60e3, (wait || 2500) * 2);
        await sleep(wait);
      }
    }
  }
  loop();
}
