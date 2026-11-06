// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Song ngữ cho tin tức và bài mạng xã hội: nguồn gốc tiếng Anh, bản tiếng Việt do máy dịch
// (lailong/terminal/translate.py). Ba chế độ: cả hai, chỉ tiếng Anh, chỉ tiếng Việt; nhớ trên máy này.

export const LANGS = [["both", "Song ngữ"], ["en", "EN"], ["vi", "VI"]];
const KEY = "lailong.lang";
let mode = "both";
try { const v = localStorage.getItem(KEY); if (LANGS.some(([id]) => id === v)) mode = v; } catch { /* chế độ riêng tư */ }

export function getLang() { return mode; }

export function setLang(v) {
  if (!LANGS.some(([id]) => id === v) || v === mode) return;
  mode = v;
  try { localStorage.setItem(KEY, v); } catch { /* bỏ qua */ }
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("lailong-lang", { detail: v }));
}

// HTML của một câu theo chế độ đang chọn; chưa có bản dịch thì hiện tiếng Anh
export function bi(en, vi, esc, m = mode) {
  en = en || ""; vi = vi || "";
  if (m === "vi") return esc(vi || en);
  if (m === "en" || !vi || vi === en) return esc(en);
  return `${esc(en)}<span class="vi">${esc(vi)}</span>`;
}

export function langTabs(m = mode) {
  return LANGS.map(([id, nm]) => `<button class="${id === m ? "on" : ""}" data-lang="${id}" title="Bản tiếng Việt là dịch máy, có thể chưa sát nghĩa">${nm}</button>`).join("");
}

// gắn nút chọn ngôn ngữ vào một phần tử; mọi chỗ dùng bi() vẽ lại khi đổi
export function mountLang(el) {
  if (!el) return;
  el.innerHTML = langTabs();
  el.onclick = e => { const b = e.target.closest("[data-lang]"); if (b) setLang(b.dataset.lang); };
  document.addEventListener("lailong-lang", () => { el.innerHTML = langTabs(); });
}
