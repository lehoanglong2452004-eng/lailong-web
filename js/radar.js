// Lai Long Web: Radar. Chỉ dùng giá và khối lượng (tinh thần Wyckoff) để trả lời:
//   thị trường đang phản ứng thế nào, phản ứng đó là chính thức hay tạm thời, nghịch lý có tự điều chỉnh không.
// Khối lượng "bất thường" luôn xét theo bối cảnh: so với cùng giờ các ngày trước (giờ Mỹ mở cửa ngày nào cũng
// đông thì không tính là bất thường), và so với nhịp của 3 ngày trước đó (đang nhàm chán hay đang hưng phấn).
// Mọi phép đo ở nến i chỉ dùng dữ liệu tới nến i; phần phản ứng mới dùng các nến sau đó.

export const HOUR = 36e5;
const DAY = 864e5;

// tham số theo khung: W nến cho bối cảnh, base nến cho biên độ "bình thường", tối đa maxBars nến để ra kết quả
export const TF = {
  "5m": { ms: 3e5, W: 72, base: 288, maxBars: 24, horizons: [3, 12, 24], win: "6 giờ" },
  "15m": { ms: 9e5, W: 96, base: 480, maxBars: 24, horizons: [4, 12, 24], win: "1 ngày" },
  "1h": { ms: HOUR, W: 72, base: 336, maxBars: 24, horizons: [4, 12, 24], win: "3 ngày" },
  "4h": { ms: 4 * HOUR, W: 42, base: 180, maxBars: 18, horizons: [3, 6, 12], win: "7 ngày" },
  "1d": { ms: DAY, W: 20, base: 120, maxBars: 10, horizons: [1, 3, 5], win: "20 ngày" },
};
export const tfOf = ms => Object.values(TF).find(x => x.ms === ms) || TF["1h"];
// thời lượng dễ đọc: 45 phút, 6 giờ, 3 ngày
export const fmtDur = ms => (ms < HOUR ? `${Math.round(ms / 6e4)} phút` : ms < 2 * DAY ? `${Math.round(ms / HOUR)} giờ` : `${Math.round(ms / DAY)} ngày`);
const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);

export const REGIMES = {
  boring: { name: "Nhàm chán", tip: "Thời gian qua khối lượng và biên độ đều thấp hơn bình thường" },
  euphoria: { name: "Hưng phấn", tip: "Thời gian qua giá đi lên một chiều, khối lượng hoặc biên độ cao hơn bình thường" },
  panic: { name: "Hoảng loạn", tip: "Thời gian qua giá đi xuống một chiều, khối lượng hoặc biên độ cao hơn bình thường" },
  normal: { name: "Bình thường", tip: "Không nhàm chán, không một chiều" },
};

export const TYPES = {
  wake: { name: "Đánh thức", tip: "Khối lượng gấp 3 lần trở lên giữa lúc thị trường đang nhàm chán: có người biết điều gì đó hoặc có tin" },
  climax: { name: "Cao trào", tip: "Khối lượng gấp 3 lần trở lên khi thị trường đang hưng phấn hoặc hoảng loạn: có thể là cú đẩy cuối (climax theo Wyckoff)" },
  spike: { name: "Khối lượng lớn", tip: "Khối lượng gấp 3 lần trở lên trong bối cảnh bình thường" },
  absorb: { name: "Nỗ lực không kết quả", tip: "Khối lượng gấp 2,5 lần nhưng nến hẹp hơn 0,7 ATR: có lệnh chờ lớn hấp thụ hết bên chủ động" },
  vacuum: { name: "Kết quả không nỗ lực", tip: "Nến dài hơn 2 ATR mà khối lượng không cao: giá chạy trong vùng trống thanh khoản, dễ là tạm thời" },
  paradox: { name: "Nghịch lý", tip: "Bên chủ động áp đảo (từ 60/40) nhưng giá đóng cửa đi ngược lại: bên kia đang hấp thụ" },
  drought: { name: "Cạn khối lượng", tip: "Đang hưng phấn/hoảng loạn, giá vẫn ở gần đỉnh/đáy nhưng khối lượng 6 nến gần nhất chỉ còn dưới 60% bình thường: cuộc chơi hết lửa" },
};

// khối lượng tương đối: so với trung vị cùng thời điểm trong ngày (UTC) của tối đa 14 ngày trước;
// thiếu mẫu thì so 48 nến trước. Khung ngày thì "cùng thời điểm" là mọi ngày, tức so với 14 ngày trước.
export function relVolume(bars, ms = HOUR) {
  const byHour = new Map(), out = new Array(bars.length).fill(null);
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], hr = ms >= DAY ? 0 : Math.floor((((b.t % DAY) + DAY) % DAY) / ms), hist = byHour.get(hr) || [];
    let ref = hist.length >= 5 ? median(hist.slice(-14)) : NaN;
    if (!(ref > 0)) { const prev = bars.slice(Math.max(0, i - 48), i).map(x => x.v).filter(v => v > 0); ref = prev.length >= 12 ? median(prev) : NaN; }
    out[i] = ref > 0 && b.v >= 0 ? b.v / ref : null;
    hist.push(b.v); byHour.set(hr, hist);
  }
  return out;
}

// ATR đơn giản 14 nến, tính tới nến i (gồm cả i)
export function atrSeries(bars, n = 14) {
  const tr = bars.map((b, i) => (i ? Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)) : b.h - b.l));
  return tr.map((_, i) => (i + 1 >= n ? mean(tr.slice(i + 1 - n, i + 1)) : mean(tr.slice(0, i + 1))));
}

// bối cảnh của W nến trước i (không gồm i)
export function regimeAt(bars, vr, atr, i, W = 72, base = 336) {
  if (i < W + 24) return null;
  const a = Math.max(0, i - W), seg = bars.slice(a, i);
  const actV = median(vr.slice(a, i).filter(x => x != null));
  const tr = j => bars[j].h - bars[j].l;
  const rngNow = mean(seg.map((_, k) => tr(a + k))), b0 = Math.max(0, i - base), rngBase = mean(bars.slice(b0, i).map((_, k) => tr(b0 + k)));
  const rngRel = rngBase > 0 ? rngNow / rngBase : 1;
  let path = 0; for (let j = a + 1; j < i; j++) path += Math.abs(bars[j].c - bars[j - 1].c);
  const move = bars[i - 1].c - bars[a].c, eff = path > 0 ? Math.abs(move) / path : 0, dir = Math.sign(move);
  const hot = actV > 1.15 || rngRel > 1.15;
  const id = actV < 0.85 && rngRel < 0.85 ? "boring" : eff > 0.3 && hot ? (dir > 0 ? "euphoria" : "panic") : "normal";
  return { id, actV, rngRel, eff, dir, hi: Math.max(...seg.map(b => b.h)), lo: Math.min(...seg.map(b => b.l)) };
}

// phát hiện sự kiện trên các nến đã đóng (bỏ nến cuối đang chạy)
export function detect(bars, { closedOnly = true, ms = HOUR } = {}) {
  const P = tfOf(ms), vr = relVolume(bars, ms), atr = atrSeries(bars), ev = [], lastOf = {};
  const end = closedOnly ? bars.length - 1 : bars.length;
  const reg = bars.map((_, i) => regimeAt(bars, vr, atr, i, P.W, P.base));
  let droughtOn = false;
  for (let i = 1; i < end; i++) {
    const b = bars[i], r = reg[i], A = atr[i - 1], v = vr[i];
    if (!r || !(A > 0) || v == null) continue;
    const range = b.h - b.l, body = b.c - b.o, hasTb = b.tb != null && b.v > 0;
    const share = hasTb ? b.tb / b.v : null, dSign = hasTb ? Math.sign(share - 0.5) : 0;
    const level = b.qv > 0 && b.v > 0 ? b.qv / b.v : (b.h + b.l + b.c) / 3;
    const push = (type, dir, extra = {}) => {
      if (lastOf[type] != null && i - lastOf[type] < 6) return;
      lastOf[type] = i;
      ev.push({ type, i, t: b.t, dir: dir || Math.sign(body) || 1, level, vRel: v, atr: A, regime: r.id, share, ...extra });
    };
    if (v >= 3) push(r.id === "boring" ? "wake" : r.id === "normal" ? "spike" : "climax", r.id === "euphoria" || r.id === "panic" ? r.dir : dSign || Math.sign(body));
    if (v >= 2.5 && range <= 0.7 * A) push("absorb", dSign || Math.sign(body));
    if (range >= 2 * A && v <= 1.2) push("vacuum", Math.sign(body));
    if (hasTb && v >= 1.5 && Math.abs(share - 0.5) >= 0.1 && body * dSign < -0.3 * A) push("paradox", dSign);
    // cạn khối lượng: chỉ báo một lần khi điều kiện vừa bật
    const hotNow = r.id === "euphoria" || r.id === "panic";
    const last6 = vr.slice(i - 5, i + 1).filter(x => x != null);
    const nearExt = hotNow && (r.dir > 0 ? r.hi - b.c <= A : b.c - r.lo <= A);
    const dry = hotNow && last6.length >= 5 && mean(last6) <= 0.6 && nearExt;
    if (dry && !droughtOn) push("drought", r.dir, { vRel: mean(last6) });
    droughtOn = dry;
  }
  return { events: ev, vr, atr, reg };
}

// phản ứng sau sự kiện, đo theo hướng dir của sự kiện, đơn vị ATR lúc xảy ra:
//   chính thức: giá đi thêm 1 ATR theo hướng đó trước khi đóng cửa ngược qua mức giá quá 0,5 ATR
//   tạm thời:   đóng cửa ngược qua mức giá quá 0,5 ATR trước
//   giằng co:   24 nến không ra kết quả; đang chờ: chưa đủ 24 nến
export function reaction(bars, e, { maxBars = 24, horizons = [4, 12, 24] } = {}) {
  const A = e.atr, d = e.dir, start = e.i + 1;
  let status = null, at = null, mfe = 0, mae = 0;
  for (let j = start; j < Math.min(bars.length, e.i + 1 + maxBars); j++) {
    const b = bars[j];
    mfe = Math.max(mfe, ((d > 0 ? b.h : b.l) - bars[e.i].c) * d / A);
    mae = Math.min(mae, ((d > 0 ? b.l : b.h) - bars[e.i].c) * d / A);
    if ((b.c - e.level) * d < -0.5 * A) { status = "rejected"; at = j - e.i; break; }
    if (mfe >= 1) { status = "accepted"; at = j - e.i; break; }
  }
  if (!status) status = bars.length - 1 - e.i >= maxBars ? "chop" : "pending";
  const fwd = Object.fromEntries(horizons.map(H => [H, e.i + H < bars.length ? (bars[e.i + H].c - bars[e.i].c) * d / A : null]));
  return { status, at, mfe, mae, fwd };
}

export const STATUS = {
  accepted: { name: "Chính thức", cls: "up", tip: "Giá đã đi thêm 1 ATR theo hướng sự kiện mà không quay ngược qua mức giá" },
  rejected: { name: "Tạm thời", cls: "dn", tip: "Giá đã đóng cửa ngược qua mức giá của sự kiện: thị trường bác bỏ" },
  chop: { name: "Giằng co", cls: "", tip: "24 nến sau vẫn chưa ra kết quả" },
  pending: { name: "Đang chờ", cls: "muted", tip: "Chưa đủ 24 nến để kết luận" },
};

// thống kê theo loại sự kiện (và theo hướng nếu muốn): tỷ lệ chính thức/tạm thời, thời gian tới khi ra kết quả,
// thay đổi giá trung bình sau các mốc horizons (số nến) theo hướng sự kiện (đơn vị ATR)
export function typeStats(items, horizons = [4, 12, 24]) {
  const by = new Map();
  for (const it of items) { const k = it.type; (by.get(k) || by.set(k, []).get(k)).push(it); }
  const out = {};
  for (const [k, a] of by) {
    const done = a.filter(x => x.r.status !== "pending");
    const acc = done.filter(x => x.r.status === "accepted"), rej = done.filter(x => x.r.status === "rejected");
    const f = H => a.map(x => x.r.fwd[H]).filter(x => x != null);
    out[k] = {
      n: a.length, done: done.length, accepted: acc.length, rejected: rej.length,
      acceptRate: done.length ? acc.length / done.length : NaN,
      rejectRate: done.length ? rej.length / done.length : NaN,
      medBars: { accepted: median(acc.map(x => x.r.at)), rejected: median(rej.map(x => x.r.at)) },
      fwd: Object.fromEntries(horizons.map(H => { const xs = f(H); return [H, { n: xs.length, avg: mean(xs), pos: xs.length ? xs.filter(x => x > 0).length / xs.length : NaN }]; })),
    };
  }
  return out;
}

// phân tích trọn gói cho một tài sản
export function analyze(bars, ms = HOUR) {
  const P = tfOf(ms), d = detect(bars, { ms });
  const items = d.events.map(e => ({ ...e, r: reaction(bars, e, { maxBars: P.maxBars, horizons: P.horizons }) }));
  const last = bars.length - 1, regNow = regimeAt(bars, d.vr, d.atr, last, P.W, P.base);
  return { ...d, items, stats: typeStats(items, P.horizons), regNow, vrNow: d.vr[last - 1], atrNow: d.atr[last], tf: P };
}

// trạng thái nhanh của một khung cho bảng đa khung: bối cảnh, KL nến vừa đóng, sự kiện gần nhất trong 48 nến
export function snapshot(an) {
  const n = an.vr.length, recent = an.items.filter(x => x.i >= n - 49);
  return { regime: an.regNow ? an.regNow.id : null, vr: an.vrNow, last: recent[recent.length - 1] || null, count: recent.length, barsAgo: e => n - 2 - e.i };
}

// câu trả lời ngắn: bối cảnh, phản ứng gần nhất và lịch sử của loại đó (stats có thể là thống kê cả rổ)
export function narrate(an, stats = an.stats, { recentBars = 48 } = {}) {
  const lines = [], R = an.regNow, P = an.tf || TF["1h"];
  if (R) lines.push(`Bối cảnh ${P.win}: ${REGIMES[R.id].name.toLowerCase()} (khối lượng ×${R.actV.toFixed(2)}, biên độ ×${R.rngRel.toFixed(2)} so với bình thường).`);
  const n = an.vr.length, recent = an.items.filter(x => x.i >= n - 1 - recentBars);
  if (!recent.length) lines.push(`${fmtDur(recentBars * P.ms)} qua không có khối lượng hay phản ứng nào bất thường: thị trường đang im.`);
  // ưu tiên sự kiện nặng ký nhất trong 48 giờ, cùng hạng thì lấy cái mới nhất
  const rank = { wake: 4, climax: 4, paradox: 3, drought: 3, absorb: 2, spike: 1, vacuum: 0 };
  const e = recent.reduce((a, x) => (!a || rank[x.type] >= rank[a.type] ? x : a), null);
  if (e) {
    const s = stats[e.type], dir = e.dir > 0 ? "lên" : "xuống";
    let t = `Gần nhất: ${TYPES[e.type].name.toLowerCase()} hướng ${dir} ở ${fmtLevel(e.level)}, ${e.i === n - 2 ? "vừa xong" : `${fmtDur((n - 2 - e.i) * P.ms)} trước`}, hiện ${STATUS[e.r.status].name.toLowerCase()}.`;
    if (s && s.done >= 5) t += ` Lịch sử loại này: ${s.done} lần có kết quả, ${Math.round(s.acceptRate * 100)}% chính thức, ${Math.round(s.rejectRate * 100)}% tạm thời.`;
    else t += " Chưa đủ lần lặp lại để thống kê.";
    lines.push(t);
  }
  return lines;
}
export const fmtLevel = x => (x >= 1000 ? x.toFixed(0) : x >= 10 ? x.toFixed(2) : x.toPrecision(4));

// đồng loạt: những nến mà từ minAssets tài sản trở lên cùng có sự kiện (cùng mốc thời gian),
// ví dụ vàng, yên và S&P cùng có khối lượng bất thường trong một giờ. rows: [{ id, item }]
export function together(rows, { minAssets = 3 } = {}) {
  const by = new Map();
  for (const r of rows) { const g = by.get(r.item.t) || by.set(r.item.t, new Map()).get(r.item.t); if (!g.has(r.id)) g.set(r.id, r.item); }
  return [...by].filter(([, g]) => g.size >= minAssets).map(([t, g]) => {
    const list = [...g].map(([id, item]) => ({ id, item })), up = list.filter(x => x.item.dir > 0).length;
    return { t, list, up, down: list.length - up };
  }).sort((a, b) => b.t - a.t);
}
