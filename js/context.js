// Lai Long Web: gắn nhãn bối cảnh cho từng nến, để thống kê tín hiệu tách theo điều kiện thị trường.
// Cùng một tín hiệu nhưng xảy ra ở giờ Á hay giờ Mỹ, biến động thấp hay cao, tay to cùng hay ngược đám đông
// thì kết quả rất khác; lợi thế thật thường nằm ở chỗ biết tín hiệu chạy tốt trong điều kiện nào.
// Mọi nhãn ở nến i chỉ dùng dữ liệu tới nến i (không nhìn trước).
//   phiên (giờ Việt Nam) · biến động (ATR so với 30 ngày) · xu hướng 24 giờ · vị trí so với vùng giá trị hôm trước
//   OI 4 góc (4 giờ) · tay to so với đám đông (top trader / mọi tài khoản) · gamma (chỉ khi đang xem trực tiếp) · tin mạnh
import { atrSeries } from "./flowtools.js?v=202610192356";
import { volumeProfile } from "./analytics.js?v=202610192356";
import { oiQuadrant } from "./lens.js?v=202610192356";

const H = 36e5, DAY = 864e5;

export const TAGS = {
  session: { name: "Phiên", vals: { asia: "Á (7h–14h)", eu: "Âu (14h–20h30)", us: "Mỹ (20h30–3h)", off: "Ngoài giờ (3h–7h)" } },
  vol: { name: "Biến động", vals: { low: "Thấp", mid: "Bình thường", high: "Cao" } },
  trend: { name: "Xu hướng 24 giờ", vals: { up: "Lên", down: "Xuống", range: "Đi ngang" } },
  value: { name: "So với vùng giá trị hôm trước", vals: { above: "Trên VAH", inside: "Trong vùng giá trị", below: "Dưới VAL" } },
  oi: { name: "OI 4 giờ", vals: { longOpen: "Long mới mở", shortCover: "Short đóng", shortOpen: "Short mới mở", longExit: "Long xả", flat: "OI đứng yên" } },
  crowd: { name: "Tay to so với đám đông", vals: { whaleLong: "Tay to nghiêng long hơn", whaleShort: "Tay to nghiêng short hơn", same: "Cùng nhịp" } },
  gamma: { name: "Gamma", vals: { pos: "Dương (giá hay hồi về giữa)", neg: "Âm (giá dễ chạy xa)" } },
  news: { name: "Tin mạnh", vals: { near: "Trong 60 phút quanh tin", none: "Không có tin" } },
};

// phiên theo giờ UTC: Á 0–7, Âu 7–13:30, Mỹ 13:30–20, ngoài giờ 20–24 (tức 3h–7h sáng giờ Việt Nam)
export function sessionOf(t) {
  const m = ((t % DAY) + DAY) % DAY / 6e4;
  return m < 420 ? "asia" : m < 810 ? "eu" : m < 1200 ? "us" : "off";
}

// phân vị của x trong mảng (0..1), mảng không cần sắp xếp
const pct = (arr, x) => { let k = 0; for (const v of arr) if (v < x) k++; return arr.length ? k / arr.length : NaN; };

// z-score trượt của chuỗi s tại i, cửa sổ W điểm trước đó (không gồm i)
function zTrail(s, i, W, minN = 24) {
  let n = 0, a = 0, a2 = 0;
  for (let j = Math.max(0, i - W); j < i; j++) { const v = s[j]; if (v == null || !isFinite(v)) continue; n++; a += v; a2 += v * v; }
  if (n < minN || s[i] == null) return null;
  const m = a / n, sd = Math.sqrt(Math.max(0, a2 / n - m * m));
  return sd > 0 ? (s[i] - m) / sd : 0;
}

// bars: {t,o,h,l,c,v,bv?,oi?,top?,acc?}; opts.tfMs: độ dài một nến; opts.news: [ms của tin mạnh]; opts.gammaFlip: giá lật gamma (trực tiếp)
export function contextSeries(bars, { tfMs = H, news = [], gammaFlip = null, liveFrom = Infinity } = {}) {
  const n = bars.length, atr = atrSeries(bars), perDay = Math.max(1, Math.round(DAY / tfMs));
  const win = 30 * perDay, step = Math.max(1, Math.floor(win / 240)), L4 = Math.max(1, Math.round(4 * H / tfMs));
  const tilt = bars.map(b => (b.top > 0 && b.acc > 0 ? Math.log(b.top / b.acc) : null));
  const dOI = bars.map((b, i) => (i >= L4 && b.oi > 0 && bars[i - L4].oi > 0 ? b.oi / bars[i - L4].oi - 1 : null));
  const newsT = [...news].sort((a, b) => a - b);
  // vùng giá trị của từng ngày UTC (tính khi ngày đó đã đóng)
  const days = new Map();
  for (let i = 0; i < n; i++) { const d = Math.floor(bars[i].t / DAY); if (!days.has(d)) days.set(d, []); days.get(d).push(bars[i]); }
  const va = new Map();
  for (const [d, bs] of days) if (bs.length >= perDay * 0.8) { const p = volumeProfile(bs); if (p.vah != null) va.set(d, p); }
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i], tag = { session: sessionOf(b.t) };
    // biến động: ATR hiện tại so với 30 ngày trước (lấy mẫu thưa cho nhanh)
    if (atr[i] > 0 && i >= perDay * 3) {
      const sample = []; for (let j = Math.max(0, i - win); j < i; j += step) if (atr[j] > 0) sample.push(atr[j]);
      const p = pct(sample, atr[i]); tag.vol = p < 1 / 3 ? "low" : p > 2 / 3 ? "high" : "mid";
    }
    if (i >= perDay && atr[i] > 0) {
      const r = (b.c - bars[i - perDay].c) / (atr[i] * Math.sqrt(perDay));
      tag.trend = r > 1 ? "up" : r < -1 ? "down" : "range";
    }
    const p = va.get(Math.floor(b.t / DAY) - 1);
    if (p) tag.value = b.c > p.vah ? "above" : b.c < p.val ? "below" : "inside";
    if (dOI[i] != null) {
      const q = oiQuadrant(b.c - bars[i - L4].c, dOI[i], zTrail(dOI, i, 30 * perDay));
      if (q.id !== "na") tag.oi = q.id;
    }
    const zt = zTrail(tilt, i, 7 * perDay);
    if (zt != null) tag.crowd = zt > 1 ? "whaleLong" : zt < -1 ? "whaleShort" : "same";
    if (gammaFlip > 0 && b.t >= liveFrom) tag.gamma = b.c >= gammaFlip ? "pos" : "neg";
    if (newsT.length && b.t >= newsT[0] - DAY && b.t <= newsT[newsT.length - 1] + DAY) {
      let near = false; for (const x of newsT) if (Math.abs(x - b.t) <= H) { near = true; break; }
      tag.news = near ? "near" : "none";
    }
    out[i] = tag;
  }
  return out;
}

// mô tả một bộ nhãn thành câu ngắn
export function describe(tag) {
  return Object.entries(tag || {}).filter(([k, v]) => TAGS[k] && TAGS[k].vals[v]).map(([k, v]) => `${TAGS[k].name}: ${TAGS[k].vals[v]}`);
}
