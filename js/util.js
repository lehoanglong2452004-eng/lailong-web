// Lai Long Web: các hàm định dạng và tính toán nhỏ dùng chung.

export function fmtVol(v) {
  const a = Math.abs(v);
  if (!isFinite(v)) return "-";
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (v / 1e3).toFixed(1) + "K";
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (a === 0) return "0";
  return v.toFixed(3);
}

export function fmtUsd(v) {
  if (!isFinite(v)) return "-";
  const a = Math.abs(v);
  if (a >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(0);
}

export function decimalsFor(step) {
  if (!step || !isFinite(step)) return 2;
  if (step >= 1) return step % 1 === 0 ? 0 : 1;
  return Math.min(8, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
}

// Làm tròn về bước "đẹp" gần nhất: 1, 2, 2.5, 5 x 10^n
export function niceStep(x) {
  if (!(x > 0)) return 0;
  const e = Math.pow(10, Math.floor(Math.log10(x) + 1e-9)), m = x / e;
  const nm = [1, 2, 2.5, 5, 10].find(k => m <= k * 1.0001) || 10;
  return nm * e;
}

export const pad2 = n => (n < 10 ? "0" + n : "" + n);

export function fmtTime(ms, withDate = false) {
  const d = new Date(ms);
  const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return withDate ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${t}` : t;
}

export function fmtDate(ms) {
  const d = new Date(ms);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtPct(v, d = 2) {
  if (v === null || v === undefined || !isFinite(v)) return "-";
  return (v >= 0 ? "+" : "") + v.toFixed(d) + "%";
}

export const INTERVALS = {
  "1m": 60e3, "5m": 300e3, "15m": 900e3, "1h": 3600e3, "4h": 14400e3, "1d": 86400e3,
};

export const MONO = "Consolas, 'Cascadia Mono', 'SF Mono', Menlo, monospace";

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function getJson(url, opts) {
  const resp = await fetch(url, opts);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${url.split("?")[0]}`);
  return resp.json();
}

export function postJson(url, body) {
  return getJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// Canvas sắc nét trên màn hình độ phân giải cao, tự đổi kích thước theo khung chứa
export function fitCanvas(cv, onResize) {
  const ctx = cv.getContext("2d");
  const state = { w: 100, h: 100, ctx };
  let ready = false;
  const resize = () => {
    const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    state.w = Math.max(50, r.width); state.h = Math.max(50, r.height);
    cv.width = Math.round(state.w * dpr); cv.height = Math.round(state.h * dpr);
    cv.style.width = state.w + "px"; cv.style.height = state.h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (onResize && ready) onResize();
  };
  resize(); ready = true;
  new ResizeObserver(resize).observe(cv.parentElement);
  return state;
}

// điện thoại: kéo dọc một ngón để cuộn từng dòng (sổ lệnh, bản đồ thanh khoản, băng lệnh)
// onRows(n): n > 0 khi ngón tay kéo xuống
export function touchRows(cv, rowH, onRows) {
  let y0 = null, acc = 0;
  cv.addEventListener("touchstart", e => { if (e.touches.length === 1) { y0 = e.touches[0].clientY; acc = 0; } else y0 = null; }, { passive: true });
  cv.addEventListener("touchmove", e => {
    if (y0 == null) return; e.preventDefault();
    const y = e.touches[0].clientY; acc += y - y0; y0 = y;
    const n = Math.trunc(acc / rowH); if (n) { acc -= n * rowH; onRows(n); }
  }, { passive: false });
  cv.addEventListener("touchend", () => { y0 = null; });
}
