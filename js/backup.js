// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: sao lưu và khôi phục toàn bộ dữ liệu lâu dài của app trong một file JSON, để chuyển máy hoặc cất lên Drive.
// Gồm: nhật ký (kèm khoá rủi ro), tài khoản giả lập, bố cục đã lưu, báo cáo hiệu suất, các chiến lược đang forward test,
// sổ tín hiệu ghi trực tiếp và kết quả chấm điểm tín hiệu.
// Không gồm mã Telegram và khoá API: file sao lưu có thể nằm trên Drive, nên bí mật phải nhập lại trên máy mới.

// các khoá giữ lâu dài trong localStorage (app.js không xoá các khoá này khi mở trang)
export const KEEP_KEYS = [
  "lailong.journal.v1", "lailong.paper.v1", "lailong.layout.presets", "lailong.multi.presets",
  "lailong.perf.v1", "lailong.forward.v1", "lailong.forward.v1.at", "lailong.telegram",
  "lailong.events.v1", "lailong.verified", "lailong.shock.sent", "lailong.compass", "lailong.consensus",
];
export const SECRET_KEYS = new Set(["lailong.telegram"]);
export const BACKUP_KEYS = KEEP_KEYS.filter(k => !SECRET_KEYS.has(k));
const NAMES = {
  "lailong.journal.v1": "nhật ký giao dịch", "lailong.paper.v1": "tài khoản giả lập", "lailong.layout.presets": "bố cục đã lưu",
  "lailong.multi.presets": "bố cục đa biểu đồ", "lailong.perf.v1": "báo cáo hiệu suất", "lailong.forward.v1": "chiến lược forward test",
  "lailong.events.v1": "sổ tín hiệu ghi trực tiếp", "lailong.verified": "kết quả chấm điểm tín hiệu",
  "lailong.shock.sent": "các tin lớn đã báo kịch bản sốc", "lailong.compass": "giờ gửi la bàn sáng",
  "lailong.consensus": "danh sách mã theo dõi đồng thuận",
};

export function packBackup(storage, now = Date.now()) {
  const data = {};
  for (const k of BACKUP_KEYS) { const v = storage.getItem(k); if (v != null) data[k] = v; }
  return { app: "lailong", kind: "backup", v: 1, at: now, data };
}

// trả về danh sách phần đã nạp; ném lỗi nếu file không phải bản sao lưu Lai Long
export function applyBackup(obj, storage) {
  if (!obj || obj.app !== "lailong" || obj.kind !== "backup" || !obj.data || typeof obj.data !== "object") throw new Error("File này không phải bản sao lưu Lai Long");
  const done = BACKUP_KEYS.filter(k => typeof obj.data[k] === "string");
  for (const k of done) JSON.parse(obj.data[k]); // phần nào hỏng thì dừng trước khi ghi đè bất cứ thứ gì
  for (const k of done) storage.setItem(k, obj.data[k]);
  return done;
}

export const backupSummary = keys => keys.map(k => NAMES[k]).filter(Boolean);

export function initBackup({ $, toast }) {
  const stamp = () => new Date().toISOString().slice(0, 10);
  $("bkSave").onclick = () => {
    const b = packBackup(localStorage), s = JSON.stringify(b);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([s], { type: "application/json" })); a.download = `lailong-saoluu-${stamp()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    const parts = backupSummary(Object.keys(b.data));
    $("bkMsg").textContent = parts.length ? `Đã xuất: ${parts.join(", ")}.` : "Chưa có dữ liệu nào để sao lưu.";
  };
  $("bkLoad").onclick = () => $("bkFile").click();
  $("bkFile").onchange = async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!confirm(`Khôi phục bản sao lưu ngày ${new Date(obj.at || 0).toLocaleString("vi-VN")}? Dữ liệu cùng loại trên máy này sẽ bị thay thế.`)) return;
      const done = applyBackup(obj, localStorage);
      toast(`Đã khôi phục: ${backupSummary(done).join(", ") || "không có gì"}. Đang tải lại trang…`);
      setTimeout(() => location.reload(), 1200);
    } catch (err) { toast(err.message || "File sao lưu bị hỏng", true); }
  };
}
