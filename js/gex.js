// Lai Long Web: tính GEX (gamma exposure), tường call/put, điểm lật gamma, max pain và bề mặt IV từ chuỗi quyền chọn.
// Dữ liệu đầu vào thống nhất: { spot, mult, exps: [ms hết hạn], rows: [[strike, iExp, +1 call / -1 put, OI, iv (0.45 = 45%)]] }.
// Quy ước như SqueezeMetrics/SpotGamma: nhà tạo lập (dealer) mua call của khách, bán put cho khách,
// nên gamma của call tính dương, của put tính âm. GEX = gamma × OI × hệ số × giá² × 1%: số USD dealer phải mua/bán khi giá đi 1%.

const YEAR = 365 * 864e5;
const SQ2PI = Math.sqrt(2 * Math.PI);
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

export function bsGamma(S, K, T, iv) {
  if (!(S > 0 && K > 0 && T > 0 && iv > 0)) return 0;
  const v = iv * Math.sqrt(T), d1 = (Math.log(S / K) + 0.5 * iv * iv * T) / v;
  return Math.exp(-0.5 * d1 * d1) / SQ2PI / (S * v);
}

// Deribit get_book_summary_by_currency -> dạng thống nhất (hết hạn lúc 08:00 UTC, 1 hợp đồng = 1 coin)
export function fromDeribit(list, now = Date.now()) {
  const exps = [], idx = new Map(), rows = []; let spot = 0;
  for (const o of list) {
    const m = /^[A-Z]+-(\d{1,2})([A-Z]{3})(\d{2})-([\d.]+)-([CP])$/.exec(o.instrument_name || ""); if (!m) continue;
    const t = Date.UTC(2000 + +m[3], MON[m[2]], +m[1], 8);
    if (t <= now || !(o.open_interest > 0) || !(o.mark_iv > 0)) continue;
    if (!idx.has(t)) { idx.set(t, exps.length); exps.push(t); }
    rows.push([+m[4], idx.get(t), m[5] === "C" ? 1 : -1, o.open_interest, o.mark_iv / 100]);
    if (!spot && o.estimated_delivery_price) spot = o.estimated_delivery_price;
  }
  return sortExps({ spot, mult: 1, exps, rows });
}

function sortExps(ch) {
  const order = ch.exps.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]), map = new Map(order.map(([, i], j) => [i, j]));
  return { ...ch, exps: order.map(x => x[0]), rows: ch.rows.map(r => [r[0], map.get(r[1]), r[2], r[3], r[4]]) };
}

// lọc theo hạn: maxDays (số ngày tới hạn) hoặc chỉ một hạn cụ thể
export function pick(ch, { maxDays = Infinity, exp = null, now = Date.now() } = {}) {
  const keep = ch.exps.map(t => (exp == null ? t - now <= maxDays * 864e5 : t === exp) && t > now);
  return { ...ch, rows: ch.rows.filter(r => keep[r[1]]) };
}

// GEX theo từng strike tại giá S
export function gexByStrike(ch, S = ch.spot, now = Date.now()) {
  const m = new Map();
  for (const [k, ie, cp, oi, iv] of ch.rows) {
    const T = Math.max((ch.exps[ie] - now) / YEAR, 1 / (365 * 24));
    const g = bsGamma(S, k, T, iv) * oi * ch.mult * S * S * 0.01;
    const x = m.get(k) || { k, call: 0, put: 0, callOi: 0, putOi: 0 };
    if (cp > 0) { x.call += g; x.callOi += oi; } else { x.put -= g; x.putOi += oi; }
    m.set(k, x);
  }
  return [...m.values()].map(x => ({ ...x, net: x.call + x.put })).sort((a, b) => a.k - b.k);
}

export const totalGex = (ch, S, now) => gexByStrike(ch, S, now).reduce((s, x) => s + x.net, 0);

// đường GEX tổng khi giá chạy từ lo đến hi; điểm lật = nơi đổi dấu gần giá hiện tại nhất
export function gexProfile(ch, { range = 0.1, steps = 60, now = Date.now() } = {}) {
  const S0 = ch.spot, pts = [];
  for (let i = 0; i <= steps; i++) { const S = S0 * (1 - range + 2 * range * i / steps); pts.push({ S, g: totalGex(ch, S, now) }); }
  let flip = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if ((a.g <= 0) !== (b.g <= 0)) {
      const S = a.S + (b.S - a.S) * (-a.g) / (b.g - a.g);
      if (flip == null || Math.abs(S - S0) < Math.abs(flip - S0)) flip = S;
    }
  }
  return { pts, flip };
}

// max pain: mức giá đáo hạn làm tổng tiền người mua quyền chọn nhận được nhỏ nhất
export function maxPain(ch) {
  const ks = [...new Set(ch.rows.map(r => r[0]))].sort((a, b) => a - b);
  let best = null, bestV = Infinity;
  for (const K of ks) {
    let v = 0;
    for (const [k, , cp, oi] of ch.rows) v += oi * (cp > 0 ? Math.max(0, K - k) : Math.max(0, k - K));
    if (v < bestV) { bestV = v; best = K; }
  }
  return best;
}

// các mức chính
export function levels(ch, now = Date.now()) {
  const st = gexByStrike(ch, ch.spot, now);
  if (!st.length) return null;
  // tường call: strike trên giá có gamma call lớn nhất; tường put: strike dưới giá có gamma put lớn nhất
  const above = st.filter(x => x.k >= ch.spot), below = st.filter(x => x.k <= ch.spot);
  const callWall = (above.length ? above : st).reduce((a, b) => b.call > a.call ? b : a);
  const putWall = (below.length ? below : st).reduce((a, b) => b.put < a.put ? b : a);
  const { pts, flip } = gexProfile(ch, { now });
  const net = st.reduce((s, x) => s + x.net, 0), callG = st.reduce((s, x) => s + x.call, 0), putG = st.reduce((s, x) => s + x.put, 0);
  const callOi = st.reduce((s, x) => s + x.callOi, 0), putOi = st.reduce((s, x) => s + x.putOi, 0);
  return { strikes: st, profile: pts, flip, callWall: callWall.k, putWall: putWall.k, maxPain: maxPain(ch), net, callG, putG, pcr: callOi ? putOi / callOi : null };
}

// IV theo strike của một hạn (lấy OTM: put dưới giá, call trên giá) và IV ATM theo hạn
export function smile(ch, ie) {
  const m = new Map();
  for (const [k, e, cp, , iv] of ch.rows) {
    if (e !== ie) continue;
    if ((cp > 0 && k >= ch.spot) || (cp < 0 && k < ch.spot) || !m.has(k)) m.set(k, iv);
  }
  return [...m].map(([k, iv]) => ({ k, iv })).sort((a, b) => a.k - b.k);
}
export function atmIv(ch, ie) {
  const s = smile(ch, ie); if (!s.length) return null;
  return s.reduce((a, b) => Math.abs(b.k - ch.spot) < Math.abs(a.k - ch.spot) ? b : a).iv;
}

// bề mặt IV: lưới (hạn × độ lệch giá) - mỗi ô nội suy từ nụ cười của hạn đó
export function ivSurface(ch, { mny = [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2], maxExp = 12, now = Date.now() } = {}) {
  const out = [];
  for (let ie = 0; ie < ch.exps.length && out.length < maxExp; ie++) {
    const s = smile(ch, ie); if (s.length < 4) continue;
    const row = mny.map(x => {
      const K = ch.spot * (1 + x), eps = ch.spot * 1e-9;
      if (K < s[0].k - eps || K > s[s.length - 1].k + eps) return null;
      if (K >= s[s.length - 1].k) return s[s.length - 1].iv;
      const j = s.findIndex(p => p.k >= K); if (j <= 0) return s[0].iv;
      const a = s[j - 1], b = s[j]; return a.iv + (b.iv - a.iv) * (K - a.k) / (b.k - a.k);
    });
    if (row.filter(v => v != null).length >= 3) out.push({ exp: ch.exps[ie], days: (ch.exps[ie] - now) / 864e5, iv: row });
  }
  return { mny, rows: out };
}
