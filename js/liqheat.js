// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bản đồ nhiệt thanh lý ƯỚC TÍNH theo thời gian (kiểu Liquidation Heatmap).
//
// Cùng mô hình với liquidationMap trong analytics.js: mỗi nến OI tăng thì vị thế mới mở tại giá điển hình,
// chia theo các bậc đòn bẩy, ra giá thanh lý long (dưới) và short (trên); OI giảm thì mọi mức co lại theo tỉ lệ;
// giá quét qua mức nào thì mức đó coi như đã bị thanh lý và biến mất. Khác ở chỗ ở đây giữ lại TỪNG CỘT theo
// thời gian, nên thấy được mức thanh lý sinh ra lúc nào, tích tụ dày dần và bị giá quét lúc nào.
// Đây là ước tính từ OI và nến, không phải dữ liệu thanh lý thật của sàn.

const isNum = v => typeof v === "number" && isFinite(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const LIQ_TIERS = [[5, 0.1], [10, 0.25], [25, 0.3], [50, 0.2], [100, 0.15]];
// mô hình đòn bẩy chọn được trên thẻ Thanh lý
export const LIQ_MODELS = {
  all: { name: "Đòn bẩy 5x–100x", tiers: LIQ_TIERS },
  high: { name: "Đòn bẩy cao 25x–100x", tiers: [[25, 0.45], [50, 0.3], [100, 0.25]] },
  low: { name: "Đòn bẩy thấp 5x–25x", tiers: [[5, 0.25], [10, 0.4], [25, 0.35]] },
};
// khoảng thời gian: khung nến và số nến hiển thị; warm thêm bấy nhiêu nến phía trước để các mức cũ kịp tích tụ
export const LIQ_RANGES = {
  "24h": { name: "24 giờ", interval: "5m", n: 288, warm: 144 },
  "3d": { name: "3 ngày", interval: "15m", n: 288, warm: 144 },
  "7d": { name: "7 ngày", interval: "1h", n: 168, warm: 72 },
  "30d": { name: "30 ngày", interval: "4h", n: 176, warm: 0 },
};

// bars: [{t, o, h, l, c, v, bv, oi}] tăng dần theo thời gian. Trả về
// { step, cols: [{ t, keys: Int32Array, vals: Float32Array, long: Uint8Array }], last: { longs, shorts } }
// keys là chỉ số ô giá (giá = key × step), long[j] = 1 nếu ô đó là thanh lý long.
export function liqHeat(bars, { tiers = LIQ_TIERS, mmr = 0.005, step } = {}) {
  const n = bars ? bars.length : 0, res = { step: null, cols: [], last: { longs: [], shorts: [] } };
  if (!n) return res;
  if (!(step > 0)) step = niceStep(bars[n - 1].c * 0.0006);
  res.step = step;
  const L = new Map(), S = new Map();
  let prevOi = null;
  for (const b of bars) {
    for (const k of L.keys()) if (b.l <= (k + 0.5) * step) L.delete(k);
    for (const k of S.keys()) if (b.h >= (k + 0.5) * step) S.delete(k);
    if (isNum(b.oi) && isNum(prevOi) && prevOi > 0) {
      const d = b.oi - prevOi;
      if (d > 0) {
        const p = (b.h + b.l + b.c) / 3, ls = isNum(b.bv) && b.v > 0 ? clamp(b.bv / b.v, 0, 1) : 0.5;
        for (const [lev, w] of tiers) {
          const kl = Math.floor(p * (1 - 1 / lev + mmr) / step), ks = Math.floor(p * (1 + 1 / lev - mmr) / step);
          L.set(kl, (L.get(kl) || 0) + d * p * w * ls);
          S.set(ks, (S.get(ks) || 0) + d * p * w * (1 - ls));
        }
      } else if (d < 0) {
        const f = Math.max(0, 1 - -d / prevOi);
        for (const [k, v] of L) L.set(k, v * f);
        for (const [k, v] of S) S.set(k, v * f);
      }
    }
    if (isNum(b.oi)) prevOi = b.oi;
    const m = L.size + S.size, keys = new Int32Array(m), vals = new Float32Array(m), long = new Uint8Array(m);
    let j = 0;
    for (const [k, v] of L) { keys[j] = k; vals[j] = v; long[j++] = 1; }
    for (const [k, v] of S) { keys[j] = k; vals[j++] = v; }
    res.cols.push({ t: b.t, keys, vals, long });
  }
  res.last.longs = [...L].map(([k, v]) => ({ price: k * step, notional: v })).sort((a, b) => a.price - b.price);
  res.last.shorts = [...S].map(([k, v]) => ({ price: k * step, notional: v })).sort((a, b) => a.price - b.price);
  return res;
}

export function niceStep(x) {
  const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
}

// bảng màu kiểu Liquidation Heatmap: tím than -> xanh dương -> xanh lơ -> xanh lá -> vàng
const STOPS = [[0, 14, 8, 48], [0.25, 22, 30, 160], [0.5, 30, 110, 240], [0.68, 40, 220, 230], [0.84, 120, 230, 120], [1, 250, 220, 40]];
export const LIQ_LUT = (() => {
  const out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255; let k = 0; while (k < STOPS.length - 2 && x > STOPS[k + 1][0]) k++;
    const [a, ...ca] = STOPS[k], [b, ...cb] = STOPS[k + 1], f = (x - a) / (b - a || 1);
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(ca[c] + (cb[c] - ca[c]) * f);
  }
  return out;
})();

// giá trị của ô giá `key` trong một cột (0 nếu không có)
export function cellAt(col, key) {
  if (!col) return null;
  for (let j = 0; j < col.keys.length; j++) if (col.keys[j] === key) return { v: col.vals[j], long: !!col.long[j] };
  return null;
}

// tổng thanh lý long đang chờ dưới giá và short đang chờ trên giá
export function pendingTotals(last, price) {
  let long = 0, short = 0;
  for (const o of last.longs) if (o.price < price) long += o.notional;
  for (const o of last.shorts) if (o.price > price) short += o.notional;
  return { long, short };
}

// mốc màu: phân vị 99,5% của mọi ô (lấy mẫu cho nhanh), để một vài ô cực lớn không làm tối cả bản đồ
export function colorRef(cols, from = 0) {
  let total = 0; for (let i = from; i < cols.length; i++) total += cols[i].vals.length;
  if (!total) return 1;
  const every = Math.max(1, Math.floor(total / 60000)), arr = [];
  let c = 0;
  for (let i = from; i < cols.length; i++) for (const v of cols[i].vals) if (c++ % every === 0) arr.push(v);
  arr.sort((a, b) => a - b);
  return arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.995))] || 1;
}

// chỉ số màu 0..255 cho tỷ lệ x = giá trị / mốc; dưới ngưỡng thr thì -1 (không tô)
export function liqIndex(x, thr) {
  if (!(x >= thr)) return -1;
  return Math.min(255, Math.round(Math.pow(Math.min(1, (x - thr) / (1 - thr || 1)), 0.8) * 225 + 30));
}
