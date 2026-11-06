// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Ngôn ngữ của cả trang: tiếng Việt (mặc định) hoặc tiếng Anh, một nút VI / EN ở góc trên bên phải; nhớ trên máy này.
// Tin tức và bài mạng xã hội: chế độ EN hiện bài gốc tiếng Anh, chế độ VI hiện bản dịch máy
// (lailong/terminal/translate.py), chưa có bản dịch thì hiện bài gốc. Phần giao diện do i18n.js dịch.

export const LANGS = [["vi", "VI"], ["en", "EN"]];
const KEY = "lailong.lang";
let mode = "vi";
try { const v = localStorage.getItem(KEY); if (LANGS.some(([id]) => id === v)) mode = v; } catch { /* chế độ riêng tư */ }

export function getLang() { return mode; }

export function setLang(v) {
  if (!LANGS.some(([id]) => id === v) || v === mode) return;
  mode = v;
  try { localStorage.setItem(KEY, v); } catch { /* bỏ qua */ }
  if (typeof document !== "undefined") {
    document.documentElement.lang = v;
    document.dispatchEvent(new CustomEvent("lailong-lang", { detail: v }));
  }
}

// HTML của một câu tin / bài viết theo ngôn ngữ đang chọn; chưa có bản dịch thì hiện tiếng Anh
export function bi(en, vi, esc, m = mode) {
  en = en || ""; vi = vi || "";
  return esc(m === "vi" && vi ? vi : en);
}

export function langTabs(m = mode) {
  return LANGS.map(([id, nm]) => `<button class="${id === m ? "on" : ""}" data-lang="${id}" data-tip="${id === "vi" ? "Giao diện tiếng Việt; tin tức và bài mạng xã hội hiện bản dịch máy" : "English interface; news and social posts in the original English"}">${nm}</button>`).join("");
}

// gắn nút chọn ngôn ngữ vào một phần tử; mọi chỗ dùng bi() vẽ lại khi đổi
export function mountLang(el) {
  if (!el) return;
  el.innerHTML = langTabs();
  el.onclick = e => { const b = e.target.closest("[data-lang]"); if (b) setLang(b.dataset.lang); };
  document.addEventListener("lailong-lang", () => { el.innerHTML = langTabs(); });
}
