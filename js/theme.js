// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bảng màu giao diện. Biểu đồ canvas đọc màu trực tiếp từ T nên đổi màu là vẽ lại ngay.

export const THEMES = {
  bloomberg: { name: "Đen cam (mặc định)", bg: "#000000", panel: "#0b0b0b", panel2: "#151515", line: "#2b2b2b", grid: "#161616", text: "#ffffff", muted: "#a3a3a3", accent: "#ff9f1c", up: "#1fb57a", down: "#e5484d" },
  midnight: { name: "Xanh đêm", bg: "#0f1218", panel: "#151a22", panel2: "#1b212b", line: "#262e3b", grid: "#1a202b", text: "#d8dee9", muted: "#7d8899", accent: "#2f8cff", up: "#1fb57a", down: "#e5484d" },
  contrast: { name: "Tương phản cao", bg: "#000000", panel: "#000000", panel2: "#0d0d0d", line: "#3a3a3a", grid: "#1c1c1c", text: "#ffffff", muted: "#cfcfcf", accent: "#ffd400", up: "#00e676", down: "#ff1744" },
};
export const EDITABLE = [["bg", "Nền"], ["panel", "Nền khung"], ["text", "Chữ"], ["muted", "Chữ phụ"], ["accent", "Màu nhấn"], ["up", "Tăng / mua"], ["down", "Giảm / bán"], ["line", "Đường kẻ"]];
// màu riêng của từng thành phần Terminal: bro tự chọn trong ⚙ Cài đặt → Màu sắc
export const ELEM = {
  fpCell: "#1d3a66", fpPoc: "#6b5a12", fpPocLine: "#ffd23f", imbBuy: "#14995a", imbSell: "#b8323a",
  volUp: "#1fb57a", volDn: "#e5484d", statBuy: "#2fd18b", statSell: "#ff5a5f",
  wallAsk: "#ffd166", wallBid: "#7dffb2",
  domBid: "#1fb57a", domAsk: "#e5484d", domPrice: "#ff9f1c", domBig: "#ffffff",
  tapeBuy: "#1fb57a", tapeSell: "#e5484d",
};
export const COLOR_GROUPS = [
  ["Chung", EDITABLE],
  ["Footprint", [["fpCell", "Nền ô"], ["fpPoc", "POC · nền"], ["fpPocLine", "POC · viền"], ["imbBuy", "Mất cân bằng mua"], ["imbSell", "Mất cân bằng bán"]]],
  ["Khối lượng", [["volUp", "Cột delta dương"], ["volDn", "Cột delta âm"], ["statBuy", "Số mua"], ["statSell", "Số bán"]]],
  ["Lệnh chờ lớn", [["wallAsk", "Chờ bán lớn"], ["wallBid", "Chờ mua lớn"]]],
  ["Smart DOM", [["domBid", "Bid"], ["domAsk", "Ask"], ["domPrice", "Giá hiện tại"], ["domBig", "Lệnh lớn"]]],
  ["Smart Tape", [["tapeBuy", "Mua"], ["tapeSell", "Bán"]]],
];

// STORE: màu đang xem trong phiên (đổi là thấy ngay); SAVED: màu bro bấm Lưu, giữ cả khi đóng trình duyệt
const STORE = "lailong.theme", SAVED = "lailong.theme.saved";
export const DEFAULT_THEME = { ...THEMES.bloomberg, ...ELEM };
export const T = { ...DEFAULT_THEME };

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
  try { sessionStorage.setItem(STORE, JSON.stringify(T)); } catch { /* bỏ qua */ }
  window.dispatchEvent(new Event("lailong-theme"));
}

export function loadTheme() {
  let t = null, s = null;
  try { t = JSON.parse(sessionStorage.getItem(STORE) || "null"); } catch { t = null; }
  try { s = JSON.parse(localStorage.getItem(SAVED) || "null"); } catch { s = null; }
  applyTheme({ ...DEFAULT_THEME, ...(s || {}), ...(t || {}) });
}
// chỉ giữ các khoá màu hợp lệ dạng #rrggbb
export function cleanTheme(t) {
  const out = {};
  for (const k of Object.keys(DEFAULT_THEME)) if (k !== "name" && typeof t[k] === "string" && /^#[0-9a-f]{6}$/i.test(t[k])) out[k] = t[k].toLowerCase();
  return out;
}
export function saveTheme() { try { localStorage.setItem(SAVED, JSON.stringify(cleanTheme(T))); } catch { /* bỏ qua */ } }
export function savedTheme() { try { return JSON.parse(localStorage.getItem(SAVED) || "null"); } catch { return null; } }
// về màu mặc định để xem trước; bấm Lưu mới ghi đè màu đã lưu
export function resetTheme() { applyTheme({ ...DEFAULT_THEME }); }

// Chữ "Lai Long" trắng mờ làm nền, vẽ ngay sau khi tô nền để nằm dưới dữ liệu
export function watermark(ctx, w, h, a = 0.06) {
  if (w < 120 || h < 60) return;
  const size = Math.round(Math.min(w / 5.5, h / 3, 140));
  ctx.save();
  ctx.font = `700 ${size}px 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = alpha(T.text, a);
  ctx.fillText("Lai Long", w / 2, h / 2);
  ctx.restore();
}
