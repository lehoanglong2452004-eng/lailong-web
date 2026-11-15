// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bảng màu giao diện. Biểu đồ canvas đọc màu trực tiếp từ T nên đổi màu là vẽ lại ngay.

export const EDITABLE = [["bg", "Nền"], ["panel", "Nền khung"], ["text", "Chữ"], ["muted", "Chữ phụ"], ["accent", "Màu nhấn"], ["up", "Tăng / mua"], ["down", "Giảm / bán"], ["line", "Đường kẻ"]];
// màu riêng của từng thành phần Terminal: bro tự chọn trong ⚙ Cài đặt → Màu sắc
export const ELEM = {
  fpCell: "#1d3a66", fpPoc: "#6b5a12", fpPocLine: "#ffd23f", imbBuy: "#14995a", imbSell: "#b8323a",
  volUp: "#2f6fe0", volDn: "#2f6fe0", statBuy: "#2fd18b", statSell: "#ff5a5f",
  wallAsk: "#ffd166", wallBid: "#7dffb2",
  domBid: "#1fb57a", domAsk: "#e5484d", domPrice: "#ff9f1c", domBig: "#ffffff",
  tapeBuy: "#1fb57a", tapeSell: "#e5484d",
};
// hai chế độ màu: Hiện đại (nền đen) và Cổ điển (nền trắng). Chọn chế độ là áp cả màu của từng thành phần
export const THEMES = {
  modern: { name: "Hiện đại", bg: "#000000", panel: "#0b0b0b", panel2: "#151515", line: "#2b2b2b", grid: "#161616", text: "#ffffff", muted: "#a3a3a3", accent: "#ff9f1c", up: "#1fb57a", down: "#e5484d", ...ELEM },
  classic: {
    name: "Cổ điển", bg: "#ffffff", panel: "#f6f7f9", panel2: "#eceff3", line: "#d5d9e0", grid: "#eef0f3", text: "#14181f", muted: "#5f6b7a", accent: "#e07000", up: "#0a9a5c", down: "#d9363e",
    fpCell: "#9fbde6", fpPoc: "#f2d675", fpPocLine: "#b07d00", imbBuy: "#56c48b", imbSell: "#ec7a7f",
    volUp: "#3b7ddd", volDn: "#3b7ddd", statBuy: "#0a9a5c", statSell: "#d9363e",
    wallAsk: "#d99a00", wallBid: "#0f9d58",
    domBid: "#0a9a5c", domAsk: "#d9363e", domPrice: "#e07000", domBig: "#000000",
    tapeBuy: "#0a9a5c", tapeSell: "#d9363e",
  },
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
export const DEFAULT_THEME = { ...THEMES.modern };
export const T = { ...DEFAULT_THEME };

// "#rrggbb" + độ trong suốt -> "rgba(...)"
export function alpha(hex, a) {
  const h = hex.replace("#", ""), n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// nền sáng hay tối (độ sáng cảm nhận của màu nền)
export function isLight(hex = T.bg) { const n = parseInt(String(hex).replace("#", "").slice(0, 6), 16); return isFinite(n) && ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 150; }
// màu khung, thanh, ô nhập của Terminal suy ra từ chế độ sáng / tối
const CHROME = {
  dark: { "pro-panel": "#0c0e11", "pro-head": "#191d23", "pro-line": "#262b33", "pro-line2": "#2d3039", "pro-hover": "#252b34", "pro-on": "#2b3442", "pro-text": "#cfd6df", "pro-bar": "#15181d", "pro-bar2": "#101317", "pro-sel": "#1f242c", field: "#0f1215", "chip-bg": "#12151a", "dim-line": "#4a4d59", hi: "#ffffff", dim: "#8b95a3", dim2: "#9aa4b1", "tbar-a": "#262830", "tbar-b": "#1c1e24" },
  light: { "pro-panel": "#ffffff", "pro-head": "#f1f3f6", "pro-line": "#d5d9e0", "pro-line2": "#d5d9e0", "pro-hover": "#e9edf2", "pro-on": "#e3e8ef", "pro-text": "#1d2330", "pro-bar": "#f6f7f9", "pro-bar2": "#eef1f5", "pro-sel": "#e3e8ef", field: "#ffffff", "chip-bg": "#ffffff", "dim-line": "#9aa3b0", hi: "#10141b", dim: "#5f6b7a", dim2: "#4f5a68", "tbar-a": "#f3f5f8", "tbar-b": "#e8ebf0" },
};
// màu khung cho các canvas (Smart DOM, Smart Tape...): theo chế độ đang dùng
export const chrome = () => CHROME[isLight(T.bg) ? "light" : "dark"];
export function applyTheme(t) {
  Object.assign(T, t);
  const r = document.documentElement.style, lt = isLight(T.bg);
  r.setProperty("--bg", T.bg); r.setProperty("--panel", T.panel); r.setProperty("--panel-2", T.panel2);
  r.setProperty("--line", T.line); r.setProperty("--ink", T.text); r.setProperty("--muted", T.muted);
  r.setProperty("--accent", T.accent); r.setProperty("--buy", T.up); r.setProperty("--sell", T.down);
  for (const [k, v] of Object.entries(CHROME[lt ? "light" : "dark"])) r.setProperty(`--${k}`, v);
  r.setProperty("color-scheme", lt ? "light" : "dark"); document.documentElement.classList.toggle("light", lt);
  try { sessionStorage.setItem(STORE, JSON.stringify(T)); } catch { /* bỏ qua */ }
  window.dispatchEvent(new Event("lailong-theme"));
}

export function loadTheme() {
  let t = null, s = null;
  try { t = JSON.parse(sessionStorage.getItem(STORE) || "null"); } catch { t = null; }
  try { s = JSON.parse(localStorage.getItem(SAVED) || "null"); } catch { s = null; }
  applyTheme({ ...DEFAULT_THEME, ...oldVol(s), ...oldVol(t) });
}
// bản cũ: cột khối lượng xanh lá / đỏ theo delta. Nay mặc định xanh dương; ai chưa tự đổi màu cột thì đổi theo
function oldVol(t) { if (!t) return {}; return t.volUp === "#1fb57a" && t.volDn === "#e5484d" ? { ...t, volUp: ELEM.volUp, volDn: ELEM.volDn } : t; }
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
