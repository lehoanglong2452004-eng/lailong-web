// Lai Long Web: bảng màu giao diện. Biểu đồ canvas đọc màu trực tiếp từ T nên đổi màu là vẽ lại ngay.

export const THEMES = {
  bloomberg: { name: "Bloomberg (mặc định)", bg: "#000000", panel: "#0b0b0b", panel2: "#151515", line: "#2b2b2b", grid: "#161616", text: "#ffffff", muted: "#a3a3a3", accent: "#ff9f1c", up: "#1fb57a", down: "#e5484d" },
  midnight: { name: "Xanh đêm", bg: "#0f1218", panel: "#151a22", panel2: "#1b212b", line: "#262e3b", grid: "#1a202b", text: "#d8dee9", muted: "#7d8899", accent: "#2f8cff", up: "#1fb57a", down: "#e5484d" },
  contrast: { name: "Tương phản cao", bg: "#000000", panel: "#000000", panel2: "#0d0d0d", line: "#3a3a3a", grid: "#1c1c1c", text: "#ffffff", muted: "#cfcfcf", accent: "#ffd400", up: "#00e676", down: "#ff1744" },
};
export const EDITABLE = [["bg", "Nền"], ["panel", "Nền khung"], ["text", "Chữ"], ["muted", "Chữ phụ"], ["accent", "Màu nhấn"], ["up", "Tăng / mua"], ["down", "Giảm / bán"], ["line", "Đường kẻ"]];

const STORE = "lailong.theme";
export const T = { ...THEMES.bloomberg };

// "#rrggbb" + độ trong suốt -> "rgba(...)"
export function alpha(hex, a) {
  const h = hex.replace("#", ""), n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function applyTheme(t) {
  Object.assign(T, t);
  const r = document.documentElement.style;
  r.setProperty("--bg", T.bg); r.setProperty("--panel", T.panel); r.setProperty("--panel-2", T.panel2);
  r.setProperty("--line", T.line); r.setProperty("--ink", T.text); r.setProperty("--muted", T.muted);
  r.setProperty("--accent", T.accent); r.setProperty("--buy", T.up); r.setProperty("--sell", T.down);
  try { localStorage.setItem(STORE, JSON.stringify(T)); } catch { /* bỏ qua */ }
  window.dispatchEvent(new Event("lailong-theme"));
}

export function loadTheme() {
  let t = null;
  try { t = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { t = null; }
  applyTheme({ ...THEMES.bloomberg, ...(t || {}) });
}
