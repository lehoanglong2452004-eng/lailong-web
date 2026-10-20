// Lai Long Web: sổ tín hiệu tự chấm điểm. Mọi tín hiệu phân tích (Radar, hấp thụ, delta phân kỳ, cá voi, OI,
// tay to so với đám đông, chạm vùng hợp lưu, cùng các tín hiệu chỉ có khi xem trực tiếp như tường bị rút, iceberg)
// được ghi lại với thời điểm, giá và hướng; sau đó máy tự chấm theo nhiều mốc thời gian.
// Luật chấm (giống nhau cho mọi tín hiệu, không nhìn trước):
//   vào ở giá mở của nến ngay sau nến có tín hiệu; ra ở giá đóng sau H nến; lãi/lỗ tính bằng ATR lúc có tín hiệu,
//   đã trừ phí taker và trượt giá hai chiều. So với "nền": vào ngẫu nhiên ở mọi nến cùng hướng.
// Chống soi dữ liệu: chỉ gọi là "Có lợi thế" khi 70% sự kiện đầu có kỳ vọng sau phí dương chắc chắn (khoảng tin cậy
// 95% nằm trên 0) VÀ 30% sự kiện cuối (chưa dùng để đánh giá) vẫn dương.
import { detect as radarDetect, TYPES as RADAR_TYPES, tfOf } from "./radar.js?v=202610200119";
import { absorption } from "./orderflow.js?v=202610200119";
import { deltaDivergence } from "./footprint.js?v=202610200119";
import { atrSeries } from "./flowtools.js?v=202610200119";
import { wilson, meanCI } from "./fractal.js?v=202610200119";
import { touchEvents, BUCKETS } from "./levels.js?v=202610200119";
import { TAGS } from "./context.js?v=202610200119";

const H = 36e5;

// danh mục tín hiệu: need = dữ liệu cần (bars: nến thường; flow: lệnh khớp lịch sử có cá voi; metrics: OI và tỷ lệ
// long/short theo 5 phút; live: chỉ ghi được khi đang xem trực tiếp)
export const SIGNALS = {
  ...Object.fromEntries(Object.entries(RADAR_TYPES).map(([k, v]) => [`radar.${k}`, { name: `Radar: ${v.name}`, group: "Radar", need: "bars", tip: v.tip }])),
  "absorb.sell": { name: "Hấp thụ phe bán ở đáy nến", group: "Order flow", need: "bars", tip: "Bán chủ động dồn ở đáy nến nhưng giá đóng xa đáy: lệnh chờ mua đã đỡ hết. Hướng: lên" },
  "absorb.buy": { name: "Hấp thụ phe mua ở đỉnh nến", group: "Order flow", need: "bars", tip: "Mua chủ động dồn ở đỉnh nến nhưng giá đóng xa đỉnh. Hướng: xuống" },
  "div.bull": { name: "Delta phân kỳ tăng", group: "Order flow", need: "bars", tip: "Giá làm đáy mới nhưng delta nến dương: phe bán đuối. Hướng: lên" },
  "div.bear": { name: "Delta phân kỳ giảm", group: "Order flow", need: "bars", tip: "Giá làm đỉnh mới nhưng delta nến âm: phe mua đuối. Hướng: xuống" },
  "whale.buy": { name: "Cá voi mua dồn", group: "Order flow", need: "flow", tip: "Khối lượng mua chủ động của lệnh lớn (từ ngưỡng cá voi) cao bất thường so với 200 nến trước. Hướng: lên" },
  "whale.sell": { name: "Cá voi bán dồn", group: "Order flow", need: "flow", tip: "Khối lượng bán chủ động của lệnh lớn cao bất thường. Hướng: xuống" },
  "oi.longOpen": { name: "OI tăng mạnh, giá lên (long mới)", group: "Phái sinh", need: "metrics", tip: "OI 4 giờ tăng bất thường (z ≥ 2) cùng lúc giá lên. Hướng: theo giá" },
  "oi.shortOpen": { name: "OI tăng mạnh, giá xuống (short mới)", group: "Phái sinh", need: "metrics", tip: "OI 4 giờ tăng bất thường cùng lúc giá xuống. Hướng: theo giá" },
  "oi.longExit": { name: "OI giảm mạnh, giá xuống (long xả)", group: "Phái sinh", need: "metrics", tip: "OI 4 giờ giảm bất thường (z ≤ −2) khi giá xuống: long bị quét. Hướng: hồi lên" },
  "oi.shortCover": { name: "OI giảm mạnh, giá lên (short đóng)", group: "Phái sinh", need: "metrics", tip: "OI 4 giờ giảm bất thường khi giá lên: short bị ép. Hướng: hồi xuống" },
  "crowd.whaleLong": { name: "Tay to chuyển sang nghiêng long hơn đám đông", group: "Phái sinh", need: "metrics", tip: "Tỷ lệ long/short theo vị thế của top trader vượt hẳn tỷ lệ của mọi tài khoản (z > 1). Hướng: lên" },
  "crowd.whaleShort": { name: "Tay to chuyển sang nghiêng short hơn đám đông", group: "Phái sinh", need: "metrics", tip: "Top trader nghiêng short hơn hẳn đám đông (z < −1). Hướng: xuống" },
  ...Object.fromEntries(BUCKETS.map(b => [b.id, { name: b.name, group: "Vùng hợp lưu", need: "bars", tip: "Lần đầu trong ngày giá chạm vùng này (dựng từ POC, VAH/VAL, đỉnh/đáy hôm qua, POC tuần, POC chưa chạm, hỗ trợ/kháng cự). Hướng: bật ngược lại" }])),
  "wall.pulled": { name: "Tường lệnh bị rút khi giá tới gần", group: "Trực tiếp", need: "live", tip: "Tường lớn biến mất khi giá còn cách vài bước mà gần như không được khớp. Hướng: về phía tường vừa rút" },
  "wall.eaten": { name: "Tường lệnh bị ăn hết", group: "Trực tiếp", need: "live", tip: "Tường lớn bị khớp hết. Hướng: theo phía vừa ăn tường" },
  "ice.hold": { name: "Iceberg giữ giá", group: "Trực tiếp", need: "live", tip: "Mức giá bị khớp gấp 2 lần lượng hiện trên sổ mà vẫn đứng. Hướng: bật khỏi mức đó" },
  "ice.break": { name: "Iceberg bị xuyên", group: "Trực tiếp", need: "live", tip: "Lệnh ẩn bị phá. Hướng: theo phía phá" },
  "big.buy": { name: "Big Trade mua", group: "Trực tiếp", need: "live", tip: "Lệnh gốc mua chủ động thuộc top 0,5%. Hướng: lên" },
  "big.sell": { name: "Big Trade bán", group: "Trực tiếp", need: "live", tip: "Lệnh gốc bán chủ động thuộc top 0,5%. Hướng: xuống" },
};

export const VERDICT = {
  edge: { name: "Có lợi thế", cls: "up" }, lose: { name: "Thua sau phí", cls: "dn" },
  unclear: { name: "Chưa rõ", cls: "muted" }, few: { name: "Chưa đủ mẫu", cls: "muted" },
};

// chuẩn hoá nến về dạng các bộ phát hiện cần: tb (mua chủ động) cho Radar, d (delta) cho footprint
export function prepBars(bars) {
  return bars.map(b => {
    const bv = b.bv != null ? b.bv : b.tb;
    return { ...b, bv, tb: bv, d: bv != null ? 2 * bv - b.v : b.d };
  });
}

function zTrail(s, i, W, minN = 30) {
  let n = 0, a = 0, a2 = 0;
  for (let j = Math.max(0, i - W); j < i; j++) { const v = s[j]; if (v == null || !isFinite(v)) continue; n++; a += v; a2 += v * v; }
  if (n < minN || s[i] == null) return null;
  const m = a / n, sd = Math.sqrt(Math.max(0, a2 / n - m * m));
  return sd > 0 ? (s[i] - m) / sd : 0;
}

// tìm mọi tín hiệu tính được từ nến; bars đã qua prepBars; trả về [{sig, i, t, dir, price}]
export function detectAll(bars, { tfMs = H, step = 0, cooldown = 6 } = {}) {
  const ev = [], n = bars.length; if (n < 60) return ev;
  const add = (sig, i, dir, price, extra = {}) => { if (i < n - 1 && dir) ev.push({ sig, i, t: bars[i].t, dir, price: price ?? bars[i].c, ...extra }); };
  if (tfOf(tfMs).ms === tfMs) for (const e of radarDetect(bars, { ms: tfMs }).events) add(`radar.${e.type}`, e.i, e.dir, e.level);
  for (const e of absorption(bars, { step })) add(`absorb.${e.side}`, e.i, e.side === "sell" ? 1 : -1, e.price);
  for (const e of deltaDivergence(bars)) add(`div.${e.side}`, e.i, e.side === "bull" ? 1 : -1);
  // cá voi: khối lượng mua/bán của lệnh lớn so với 200 nến trước
  if (bars.some(b => b.wb != null)) {
    const W = 200, nb = bars.map(b => (b.wb != null ? Math.log1p(b.wb) : null)), ns = bars.map(b => (b.ws != null ? Math.log1p(b.ws) : null));
    let last = -Infinity;
    for (let i = W; i < n; i++) {
      const zb = zTrail(nb, i, W), zs = zTrail(ns, i, W);
      if (zb == null || zs == null || i - last < cooldown) continue;
      if (zb >= 3 && bars[i].wb > 1.5 * bars[i].ws) { add("whale.buy", i, 1); last = i; }
      else if (zs >= 3 && bars[i].ws > 1.5 * bars[i].wb) { add("whale.sell", i, -1); last = i; }
    }
  }
  // OI 4 giờ bất thường, và tay to so với đám đông đổi trạng thái
  if (bars.some(b => b.oi > 0)) {
    const L = Math.max(1, Math.round(4 * H / tfMs)), W = Math.round(30 * 24 * H / tfMs);
    const d = bars.map((b, i) => (i >= L && b.oi > 0 && bars[i - L].oi > 0 ? b.oi / bars[i - L].oi - 1 : null));
    let last = -Infinity;
    for (let i = L; i < n; i++) {
      const z = zTrail(d, i, W); if (z == null || i - last < Math.max(cooldown, L)) continue;
      const up = bars[i].c >= bars[i - L].c;
      if (z >= 2) { add(up ? "oi.longOpen" : "oi.shortOpen", i, up ? 1 : -1); last = i; }
      else if (z <= -2) { add(up ? "oi.shortCover" : "oi.longExit", i, up ? -1 : 1); last = i; }
    }
  }
  if (bars.some(b => b.top > 0 && b.acc > 0)) {
    const W = Math.round(7 * 24 * H / tfMs), tilt = bars.map(b => (b.top > 0 && b.acc > 0 ? Math.log(b.top / b.acc) : null));
    let prev = null;
    for (let i = 1; i < n; i++) {
      const z = zTrail(tilt, i, W, 24); if (z == null) continue;
      // có trễ: vào trạng thái khi |z| > 1, chỉ về "cùng nhịp" khi |z| < 0,5, để không bật tắt liên tục quanh ngưỡng
      const st = z > 1 ? "whaleLong" : z < -1 ? "whaleShort" : Math.abs(z) < 0.5 ? "same" : prev;
      if (prev && st !== prev && st !== "same") add(`crowd.${st}`, i, st === "whaleLong" ? 1 : -1);
      prev = st;
    }
  }
  for (const e of touchEvents(bars)) add(e.sig, e.i, e.dir, e.price, { score: e.score, kinds: e.kinds });
  return ev.sort((a, b) => a.t - b.t);
}

// đặt sự kiện trực tiếp (có t, không có i) vào chuỗi nến: nến chứa thời điểm đó
export function placeEvents(events, bars, tfMs) {
  const out = [];
  if (!bars.length) return out;
  for (const e of events) {
    let lo = 0, hi = bars.length - 1;
    if (e.t < bars[0].t || e.t >= bars[hi].t + tfMs) continue;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (bars[m].t <= e.t) lo = m; else hi = m - 1; }
    if (lo < bars.length - 1) out.push({ ...e, i: lo });
  }
  return out;
}

// chấm điểm: horizons là số nến; feePct (% mỗi chiều, taker), slipBps (phần vạn mỗi chiều)
export function scoreEvents(events, bars, { horizons = [1, 4, 12], feePct = 0.05, slipBps = 2 } = {}) {
  const atr = atrSeries(bars), cost = 2 * (feePct / 100 + slipBps / 1e4);
  return events.map(e => {
    const A = atr[e.i], ent = bars[e.i + 1] ? bars[e.i + 1].o : null, r = {};
    for (const h of horizons) {
      const j = e.i + h;
      if (!(A > 0) || ent == null || j >= bars.length) { r[h] = null; continue; }
      let mfe = 0, mae = 0;
      for (let k = e.i + 1; k <= j; k++) { mfe = Math.max(mfe, (e.dir > 0 ? bars[k].h - ent : ent - bars[k].l) / A); mae = Math.max(mae, (e.dir > 0 ? ent - bars[k].l : bars[k].h - ent) / A); }
      const gross = e.dir * (bars[j].c - ent) / A;
      r[h] = { gross, net: gross - cost * ent / A, mfe, mae };
    }
    return { ...e, r };
  });
}

// nền: vào lệnh LONG ở mọi nến, cùng luật; dùng để biết tín hiệu hơn ngẫu nhiên bao nhiêu
export function baseline(bars, horizons = [1, 4, 12]) {
  const atr = atrSeries(bars), out = {};
  for (const h of horizons) {
    let n = 0, s = 0, up = 0;
    for (let i = 20; i + h < bars.length; i++) {
      if (!(atr[i] > 0) || !bars[i + 1]) continue;
      const g = (bars[i + h].c - bars[i + 1].o) / atr[i]; n++; s += g; if (g > 0) up++;
    }
    out[h] = { n, mean: n ? s / n : 0, up: n ? up / n : 0.5 };
  }
  return out;
}

// thống kê một nhóm sự kiện đã chấm ở mốc h
// z: độ chặt của khoảng tin cậy; trong từng bối cảnh dùng 2,58 (99%) vì soi nhiều nhóm cùng lúc thì dễ có nhóm đẹp do may
export function stats(scored, h, base = null, { minN = 30, split = 0.7, z = 1.96 } = {}) {
  const done = scored.filter(e => e.r && e.r[h]).sort((a, b) => a.t - b.t);
  const n = done.length, net = done.map(e => e.r[h].net);
  const hit = wilson(done.filter(e => e.r[h].gross > 0).length, n), ci = meanCI(net);
  const k = Math.floor(n * split), isCi = meanCI(net.slice(0, k), z), oos = meanCI(net.slice(k));
  let edge = null;
  if (base && base[h] && n) {
    const dirMean = done.reduce((a, e) => a + e.dir, 0) / n, gross = done.reduce((a, e) => a + e.r[h].gross, 0) / n;
    edge = gross - dirMean * base[h].mean;
  }
  const verdict = n < minN ? "few" : isCi.lo > 0 && oos.mean > 0 && n - k >= 10 ? "edge" : ci.hi < 0 ? "lose" : "unclear";
  return {
    n, pending: scored.length - n, hit, net: ci, is: isCi, oos, oosN: n - k, edge, verdict,
    mfe: n ? done.reduce((a, e) => a + e.r[h].mfe, 0) / n : NaN, mae: n ? done.reduce((a, e) => a + e.r[h].mae, 0) / n : NaN,
  };
}

// bảng tổng: mỗi tín hiệu một dòng, mỗi mốc một ô
export function scorecard(scored, horizons, base, opts) {
  const by = new Map();
  for (const e of scored) { if (!by.has(e.sig)) by.set(e.sig, []); by.get(e.sig).push(e); }
  return [...by.entries()].map(([sig, list]) => ({ sig, list, h: Object.fromEntries(horizons.map(h => [h, stats(list, h, base, opts)])) }))
    .sort((a, b) => (SIGNALS[a.sig]?.group || "").localeCompare(SIGNALS[b.sig]?.group || "") || b.list.length - a.list.length);
}

// tách thống kê theo nhãn bối cảnh (tags[i] từ context.js) ở mốc h
export function byContext(list, tags, h, base, { minN = 15, z = 2.58 } = {}) {
  const out = [];
  for (const key of Object.keys(TAGS)) {
    const groups = new Map();
    for (const e of list) { const v = tags[e.i] && tags[e.i][key]; if (!v) continue; if (!groups.has(v)) groups.set(v, []); groups.get(v).push(e); }
    if (groups.size < 2) continue;
    const rows = [...groups.entries()].map(([v, g]) => ({ v, name: TAGS[key].vals[v] || v, st: stats(g, h, base, { minN, z }) }));
    out.push({ key, name: TAGS[key].name, rows: rows.sort((a, b) => b.st.n - a.st.n) });
  }
  return out;
}

// tín hiệu có lợi thế trong đúng bối cảnh hiện tại (cho kế hoạch phiên và lọc cảnh báo)
export function edgesFor(card, tags, tagNow, h, base, { minN = 15, z = 2.58 } = {}) {
  const out = [];
  for (const row of card) {
    const all = row.h[h]; if (!all) continue;
    let best = null;
    for (const [k, v] of Object.entries(tagNow || {})) {
      const g = row.list.filter(e => tags[e.i] && tags[e.i][k] === v);
      const st = stats(g, h, base, { minN, z });
      if (st.verdict === "edge" && (!best || st.net.mean > best.st.net.mean)) best = { key: k, v, st };
    }
    if (all.verdict === "edge" || best) out.push({ sig: row.sig, all, best });
  }
  return out.sort((a, b) => (b.best ? b.best.st.net.mean : b.all.net.mean) - (a.best ? a.best.st.net.mean : a.all.net.mean));
}

// mốc chấm theo khung: luôn gồm khoảng 15 phút, 1 giờ, 4 giờ và 24 giờ nếu chia hết
export function horizonsFor(tfMs) {
  const want = [15 * 6e4, H, 4 * H, 24 * H];
  return [...new Set(want.filter(x => x >= tfMs).map(x => Math.max(1, Math.round(x / tfMs))))];
}
export const fmtH = (h, tfMs) => { const ms = h * tfMs; return ms < H ? `${Math.round(ms / 6e4)}p` : ms < 864e5 ? `${Math.round(ms / H)}g` : `${Math.round(ms / 864e5)}n`; };
