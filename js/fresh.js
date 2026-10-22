// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: nhãn độ tươi của dữ liệu, để không nhầm dữ liệu trễ là trực tiếp.
//   Trực tiếp (xanh): luồng thời gian thực từ sàn
//   Trễ (vàng): nguồn có độ trễ (Yahoo, CBOE chậm 10 đến 15 phút) hoặc bản chụp định kỳ
//   Cuối ngày / Hằng tuần (xám): số liệu chốt theo ngày hoặc tuần (ETF, COT, lãi suất)
// Mỗi nhãn kèm "cập nhật N trước" và tự chuyển đỏ khi dữ liệu cũ hơn mức nó phải có (mất kết nối, nguồn chết).

export const FRESH = {
  live: { name: "Trực tiếp", cls: "live", expect: 120e3 },
  delay: { name: "Trễ", cls: "delay", expect: 3600e3 },
  eod: { name: "Cuối ngày", cls: "eod", expect: 4 * 864e5 },
  weekly: { name: "Hằng tuần", cls: "eod", expect: 10 * 864e5 },
};

export function ageText(ms) {
  if (!(ms >= 0)) return "";
  if (ms < 60e3) return `${Math.max(1, Math.round(ms / 1000))} giây trước`;
  if (ms < 3600e3) return `${Math.round(ms / 60e3)} phút trước`;
  if (ms < 864e5) return `${Math.round(ms / 3600e3)} giờ trước`;
  return `${Math.round(ms / 864e5)} ngày trước`;
}

const escA = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// kind: live | delay | eod | weekly; t: lúc dữ liệu được lấy (ms); label: chữ thay cho tên mặc định (vd "Trễ 15 phút");
// note: giải thích nguồn khi rê chuột; expect: quá tuổi này thì nhãn chuyển đỏ
export function freshTag(kind, t, { label, note, expect } = {}) {
  const f = FRESH[kind] || FRESH.delay, exp = expect || f.expect;
  const age = t ? Date.now() - t : null, stale = age != null && age > exp;
  return `<span class="fresh ${f.cls}${stale ? " stale" : ""}"${t ? ` data-t="${t}" data-exp="${exp}"` : ""}${note ? ` data-tip="${escA(note)}"` : ""}>` +
    `<b>●</b> ${escA(label || f.name)}${t ? `<i> · ${ageText(age)}</i>` : ""}</span>`;
}

// đặt nhãn vào phần tử theo id (bỏ qua nếu không có)
export function setFresh(el, kind, t, opts) { if (el) el.innerHTML = freshTag(kind, t, opts); }

// cập nhật chữ "N trước" và trạng thái đỏ của mọi nhãn đang hiện; gọi mỗi giây
export function tickFresh(root = document) {
  const now = Date.now();
  for (const el of root.querySelectorAll(".fresh[data-t]")) {
    const age = now - +el.dataset.t, i = el.querySelector("i");
    if (i) i.textContent = ` · ${ageText(age)}`;
    el.classList.toggle("stale", age > +el.dataset.exp);
  }
}
