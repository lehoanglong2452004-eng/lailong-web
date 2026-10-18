// Lai Long Web: đọc TPO (Market Profile) theo cách của Dalton / CBOT: kiểu mở cửa, kiểu ngày, hình dạng hồ sơ,
// đỉnh/đáy yếu, đuôi từ chối, POC di chuyển, vùng chữ đơn lẻ chưa lấp, và thống kê "sau kiểu ngày này, hôm sau thường làm gì".
// Không vẽ, để kiểm thử được. Đầu vào là các phiên của buildTpo (tpo.js), mỗi phiên có thêm `first`: các nến của 2 chữ đầu.

const PERIOD = 30 * 60e3, DAY = 864e5, HOUR = 36e5;

// ---------- cách chia phiên ----------
let nyFmt = null;
function nyMinutes(t) { // phút trong ngày theo giờ New York và ngày New York (yyyy-mm-dd)
  nyFmt = nyFmt || new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const o = {}; for (const x of nyFmt.formatToParts(new Date(t))) o[x.type] = x.value;
  return { min: +o.hour * 60 + +o.minute, day: `${o.year}-${o.month}-${o.day}` };
}
export const SESSIONS = {
  utc: { name: "Ngày UTC", tip: "Phiên 24 giờ bắt đầu 0 giờ UTC (7 giờ sáng Việt Nam)" },
  vn: { name: "Ngày Việt Nam", tip: "Phiên 24 giờ bắt đầu 0 giờ Việt Nam (17 giờ UTC hôm trước)" },
  us: { name: "Phiên Mỹ", tip: "9:30 đến 16:00 giờ New York (giờ chứng khoán Mỹ mở cửa), tự theo giờ mùa hè/đông; ngoài giờ này không tính" },
};
// trả về hàm t -> { start, p } (mốc bắt đầu phiên, số thứ tự chữ) hoặc null nếu nến nằm ngoài phiên
export function sessionKeyer(kind = "utc") {
  if (kind === "vn") return t => { const s = Math.floor((t + 7 * HOUR) / DAY) * DAY - 7 * HOUR; return { start: s, p: Math.floor((t - s) / PERIOD) }; };
  if (kind === "us") return t => {
    const { min } = nyMinutes(t); if (min < 570 || min >= 960) return null;
    const s = t - (min - 570) * 60e3 - (t % 60e3); return { start: s, p: Math.floor((min - 570) / 30) };
  };
  return t => { const s = Math.floor(t / DAY) * DAY; return { start: s, p: Math.floor((t - s) / PERIOD) }; };
}

// ---------- tên gọi ----------
export const OPEN_TYPES = {
  OD: { name: "Open Drive", vn: "Mở cửa là chạy", tip: "Mở ở sát một đầu và đi thẳng một mạch, không quay lại giá mở. Phe chủ động tự tin nhất; ngày thường đi tiếp hướng đó" },
  OTD: { name: "Open Test Drive", vn: "Thử rồi chạy", tip: "Mở ra đi thử một hướng một đoạn ngắn (kiểm tra xem còn lệnh không), rồi quay đầu chạy mạnh hướng kia. Hướng chạy sau là hướng thật" },
  ORR: { name: "Open Rejection Reverse", vn: "Bị từ chối rồi đảo", tip: "Mở ra đi một hướng khá xa, bị từ chối, quay ngược qua giá mở và đi tiếp hướng kia. Phe mở đầu bị bắt sai" },
  OA: { name: "Open Auction", vn: "Đấu giá quanh giá mở", tip: "Giá xoay quanh giá mở, chưa phe nào tự tin. Ngày thường cân bằng, chờ phá biên IB" },
};
export const DAY_TYPES = {
  trend: { name: "Trend", vn: "Ngày xu hướng", tip: "Biên độ rộng gấp nhiều lần IB, mở rộng một phía, đóng gần cực trị. Một phe kiểm soát cả ngày" },
  dd: { name: "Double Distribution", vn: "Hai vùng giá trị", tip: "Hai cụm giá trị tách nhau bởi một đoạn chữ đơn lẻ: giá chấp nhận một vùng rồi chuyển hẳn sang vùng mới" },
  nv: { name: "Normal Variation", vn: "Biến thể thường", tip: "Mở rộng IB về một phía khoảng tới 2 lần. Phe dài hạn chen vào một phía nhưng chưa thành xu hướng" },
  normal: { name: "Normal", vn: "Ngày thường", tip: "IB rộng và gần như không phá. Phe dài hạn dựng biên sớm, cả ngày đi trong đó" },
  neutral: { name: "Neutral", vn: "Trung tính", tip: "Phá IB cả hai phía. Đóng ở giữa: thị trường cân bằng. Đóng ở một đầu: phe đó thắng cuối ngày" },
  nontrend: { name: "Non-trend", vn: "Không xu hướng", tip: "Biên độ rất hẹp so với các ngày trước. Thiếu người tham gia, thường trước tin lớn; sau đó hay bùng nổ" },
};
export const SHAPES = {
  P: { name: "P", tip: "Phần dày ở trên, đuôi mỏng ở dưới: thường là short bị ép mua lại (short covering), chưa chắc là phe mua dài hạn" },
  b: { name: "b", tip: "Phần dày ở dưới, đuôi mỏng ở trên: thường là long bỏ chạy (long liquidation)" },
  D: { name: "D", tip: "Phân bố cân đối, POC ở giữa: thị trường cân bằng, hai phe đồng ý giá" },
  I: { name: "I", tip: "Mỏng và dài: giá đi một mạch, ít thời gian ở mỗi mức (xu hướng)" },
};
export const OPEN_LOC = {
  aboveRange: "trên biên độ phiên trước", aboveVA: "trên vùng giá trị phiên trước", inVA: "trong vùng giá trị phiên trước",
  belowVA: "dưới vùng giá trị phiên trước", belowRange: "dưới biên độ phiên trước",
};

// ---------- đọc một phiên ----------
// s: phiên của buildTpo (keys, rows, poc, vah, val, ibHigh, ibLow, open, close, high, low, first, periods), step: bước giá
export function readSession(s, step, prev = null, avgRange = null, { final = true } = {}) {
  const cnt = k => s.rows.get(k)?.size || 0, ks = s.keys, out = {};
  const ibH = s.ibHigh != null ? (s.ibHigh + 1) * step : null, ibL = s.ibLow != null ? s.ibLow * step : null;
  const range = s.high - s.low, ib = ibH != null ? ibH - ibL : null;
  out.ib = ib; out.range = range; out.rangeX = ib ? range / ib : null;
  out.extUp = ibH != null && s.high > ibH + step * 0.5 && s.periods > 2;
  out.extDn = ibL != null && s.low < ibL - step * 0.5 && s.periods > 2;
  out.open = openType(s, step);
  if (prev) {
    const pvah = (prev.vah + 1) * step, pval = prev.val * step, o = s.open;
    out.loc = o > prev.high ? "aboveRange" : o < prev.low ? "belowRange" : o > pvah ? "aboveVA" : o < pval ? "belowVA" : "inVA";
  }
  // đuôi từ chối: ≥ 2 dòng chữ đơn lẻ ở mép (ở đỉnh thì là chữ sau chữ đầu tiên của phiên, tức không phải lúc mở)
  const tail = dir => { let n = 0; const seq = dir > 0 ? [...ks].reverse() : ks; for (const k of seq) { if (cnt(k) === 1) n++; else break; } return n; };
  out.excessHigh = tail(1) >= 2; out.excessLow = tail(-1) >= 2;
  // đỉnh/đáy yếu: mép phẳng, ≥ 2 chữ ở dòng cuối và dòng kề cũng ≥ 2 chữ, không có đuôi
  const kHi = ks[ks.length - 1], kLo = ks[0];
  out.poorHigh = ks.length >= 4 && cnt(kHi) >= 2 && cnt(kHi - 1) >= 2;
  out.poorLow = ks.length >= 4 && cnt(kLo) >= 2 && cnt(kLo + 1) >= 2;
  // hình dạng: vị trí POC và phân bố số chữ theo ba phần
  const n = ks.length, third = Math.max(1, Math.floor(n / 3));
  let top = 0, bot = 0, all = 0; ks.forEach((k, i) => { const c = cnt(k); all += c; if (i >= n - third) top += c; if (i < third) bot += c; });
  const pocRel = n > 1 ? (s.poc - kLo) / (kHi - kLo) : 0.5, thin = all / Math.max(1, n) < 2.2 && n >= 12;
  out.shape = thin ? "I" : pocRel >= 0.62 && top > bot * 1.4 ? "P" : pocRel <= 0.38 && bot > top * 1.4 ? "b" : "D";
  out.pocRel = pocRel;
  // vùng chữ đơn lẻ liền nhau ≥ 2 dòng
  out.singleZones = []; const sg = s.singles || [];
  for (let i = 0; i < sg.length;) { let j = i; while (j + 1 < sg.length && sg[j + 1] === sg[j] + 1) j++; if (j - i + 1 >= 2) out.singleZones.push({ lo: sg[i], hi: sg[j] }); i = j + 1; }
  // kiểu ngày
  const closeRel = range > 0 ? (s.close - s.low) / range : 0.5;
  out.closeRel = closeRel;
  let type = "normal";
  if (final && avgRange && range < avgRange * 0.5) type = "nontrend";
  else if (out.extUp && out.extDn) type = "neutral";
  else if (out.rangeX != null && out.rangeX >= 2.2 && (out.extUp ? closeRel >= 0.75 : closeRel <= 0.25) && out.shape !== "D") type = "trend";
  else if (out.singleZones.some(z => z.hi - z.lo + 1 >= 3) && (out.extUp || out.extDn)) type = "dd";
  else if (out.rangeX != null && out.rangeX > 1.15 && (out.extUp || out.extDn)) type = "nv";
  out.type = type;
  out.dir = out.extUp && !out.extDn ? 1 : out.extDn && !out.extUp ? -1 : closeRel > 0.66 ? 1 : closeRel < 0.34 ? -1 : 0;
  return out;
}

// kiểu mở cửa, từ các nến của 2 chữ đầu (IB). Trả về { id, dir }
export function openType(s, step) {
  const f = s.first || []; if (f.length < 2 || s.ibHigh == null) return null;
  const o = s.open, hi = Math.max(...f.map(b => b.h)), lo = Math.min(...f.map(b => b.l)), r = hi - lo;
  if (!(r > step)) return { id: "OA", dir: 0 };
  const up = hi - o, dn = o - lo, end = f[f.length - 1].c, endRel = (end - lo) / r;
  if (dn <= 0.1 * r && endRel >= 0.7) return { id: "OD", dir: 1 };
  if (up <= 0.1 * r && endRel <= 0.3) return { id: "OD", dir: -1 };
  // hướng đi trước: nến đầu tiên ra khỏi ±15% biên độ quanh giá mở
  let firstDir = 0, firstExt = 0;
  for (const b of f) { if (b.h - o >= 0.15 * r) { firstDir = 1; break; } if (o - b.l >= 0.15 * r) { firstDir = -1; break; } }
  if (firstDir) { // biên độ đi thử trước khi quay đầu
    const turn = f.findIndex(b => firstDir > 0 ? b.l < o : b.h > o);
    const seg = turn > 0 ? f.slice(0, turn) : f;
    firstExt = firstDir > 0 ? Math.max(...seg.map(b => b.h)) - o : o - Math.min(...seg.map(b => b.l));
  }
  const reversed = firstDir > 0 ? endRel <= 0.35 && dn >= 0.5 * r : firstDir < 0 ? endRel >= 0.65 && up >= 0.5 * r : false;
  if (reversed && firstExt <= 0.35 * r) return { id: "OTD", dir: -firstDir };
  if (reversed) return { id: "ORR", dir: -firstDir };
  return { id: "OA", dir: 0 };
}

// POC đang hình thành sau mỗi chữ: [{ p, k }]
export function pocPath(s) {
  const ps = [...(s.periodList || [])].sort((a, b) => a - b), out = [];
  for (const p of ps) {
    let best = null, bc = -1;
    for (const k of s.keys) { let c = 0; for (const q of s.rows.get(k)) if (q <= p) c++; if (c > bc) { bc = c; best = k; } }
    if (!out.length || out[out.length - 1].k !== best) out.push({ p, k: best });
  }
  return out;
}

// vùng chữ đơn lẻ chưa bị các phiên sau lấp lại: [{ from (start phiên), lo, hi }]
export function unfilledSingles(sessions, reads, { recent = 5 } = {}) {
  const out = [];
  sessions.forEach((s, i) => {
    if (i < sessions.length - recent) return;
    for (const z of reads[i].singleZones) {
      const later = sessions.slice(i + 1);
      if (later.length && later.some(n => { for (let k = z.lo; k <= z.hi; k++) if (n.rows.has(k)) return true; return false; })) continue;
      out.push({ from: s.start, lo: z.lo, hi: z.hi });
    }
  });
  return out;
}

// thống kê: sau phiên có kiểu ngày T (hoặc đỉnh/đáy yếu), phiên kế tiếp thì sao
export function nextDayStats(sessions, reads) {
  const by = {}, poor = { high: { n: 0, hit: 0 }, low: { n: 0, hit: 0 } };
  for (let i = 0; i + 1 < sessions.length; i++) {
    const s = sessions[i], r = reads[i], nx = sessions[i + 1];
    const e = by[r.type] || (by[r.type] = { n: 0, up: 0, poc: 0, ext: 0 });
    e.n++; if (nx.close > s.close) e.up++; if (nx.rows.has(s.poc)) e.poc++;
    if (nx.high > s.high || nx.low < s.low) e.ext++;
    if (r.poorHigh) { poor.high.n++; if (nx.high > s.high) poor.high.hit++; }
    if (r.poorLow) { poor.low.n++; if (nx.low < s.low) poor.low.hit++; }
  }
  return { by, poor };
}

// các dòng chữ tóm tắt cho phiên hiện tại
export function narrateTpo(sessions, reads, stats, step, dec) {
  const n = sessions.length; if (!n) return [];
  const s = sessions[n - 1], r = reads[n - 1], P = k => (k * step).toFixed(dec), lines = [];
  const ot = r.open && OPEN_TYPES[r.open.id];
  if (ot) lines.push(`Mở cửa: ${ot.vn} (${ot.name})${r.open.dir ? (r.open.dir > 0 ? " ▲" : " ▼") : ""}${r.loc ? `, mở ${OPEN_LOC[r.loc]}` : ""}. ${ot.tip}.`);
  if (r.ib != null) {
    const prevIb = reads.slice(Math.max(0, n - 11), n - 1).map(x => x.ib).filter(x => x > 0), avgIb = prevIb.length ? prevIb.reduce((a, b) => a + b, 0) / prevIb.length : null;
    const rel = avgIb ? r.ib / avgIb : null;
    lines.push(`IB ${P(s.ibLow)} – ${P(s.ibHigh + 1)}${rel ? ` (${rel < 0.7 ? "hẹp" : rel > 1.3 ? "rộng" : "bình thường"}, ×${rel.toFixed(1)} so với 10 phiên trước)` : ""}${r.extUp || r.extDn ? `, đã phá ${r.extUp && r.extDn ? "cả hai phía" : r.extUp ? "lên" : "xuống"}` : ", chưa phá"}.${rel && rel < 0.7 ? " IB hẹp thường bị phá mạnh trong ngày." : ""}`);
  }
  const dt = DAY_TYPES[r.type];
  lines.push(`Kiểu ngày tới lúc này: ${dt.vn} (${dt.name})${r.dir ? (r.dir > 0 ? " ▲" : " ▼") : ""}. Hình ${r.shape}: ${SHAPES[r.shape].tip}.`);
  const marks = [];
  if (r.poorHigh) marks.push(`đỉnh yếu ${s.high.toFixed(dec)} (đỉnh phẳng, chưa có ai từ chối, hay bị quay lại phá)`);
  if (r.poorLow) marks.push(`đáy yếu ${s.low.toFixed(dec)} (đáy phẳng, hay bị quay lại phá)`);
  if (r.excessHigh) marks.push("đuôi từ chối ở đỉnh (người bán dài hạn đã vào)");
  if (r.excessLow) marks.push("đuôi từ chối ở đáy (người mua dài hạn đã vào)");
  if (marks.length) lines.push(`Mép phiên: ${marks.join("; ")}.`);
  const prev = n > 1 ? reads[n - 2] : null, st = prev && stats.by[prev.type];
  if (prev && st && st.n >= 3) lines.push(`Lịch sử: sau ${st.n} phiên kiểu ${DAY_TYPES[prev.type].vn} (giống hôm qua), phiên sau đóng cao hơn ${Math.round(st.up / st.n * 100)}%, quay về POC hôm trước ${Math.round(st.poc / st.n * 100)}%.`);
  const ph = stats.poor.high, pl = stats.poor.low;
  if (prev && prev.poorHigh && ph.n >= 3) lines.push(`Hôm qua có đỉnh yếu: trong ${ph.n} lần, phiên sau phá lên trên ${Math.round(ph.hit / ph.n * 100)}%.`);
  if (prev && prev.poorLow && pl.n >= 3) lines.push(`Hôm qua có đáy yếu: trong ${pl.n} lần, phiên sau phá xuống dưới ${Math.round(pl.hit / pl.n * 100)}%.`);
  return lines;
}
