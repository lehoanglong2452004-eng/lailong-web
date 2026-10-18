// Lai Long Web: bộ chiến lược backtest. Mỗi chiến lược chỉ dùng nến 0..i để ra tín hiệu ở nến i (không nhìn trước).
// Chiến lược: { name, short, group, description, params, prepare(bars, p, cx) -> signal(i) }
// signal(i) trả null hoặc một lệnh:
//   { side: 'long'|'short', stop, tag,
//     entry?   giá lệnh chờ (limit) đặt ở nến i, khớp ở các nến sau. Không có thì vào ngay giá đóng cửa nến i,
//     fillAt?  lệnh chờ đã khớp ngay trong nến i ở giá này (chiến lược tự theo dõi vùng chạm),
//     valid?   số nến lệnh chờ còn hiệu lực (mặc định 30),
//     tp1Px?, tp2Px?   chốt lời theo giá riêng của chiến lược (mặc định theo R chung),
//     forceExit?(k)    true thì đóng lệnh ở giá đóng cửa nến k (ví dụ cuối ngày) }
// Bộ máy chạy lệnh nằm trong backtest.js.
import { atr, pivots } from './analytics.js?v=202610180133';

// ---------- chỉ báo dùng chung, tính một lần cho mỗi bộ nến ----------
const cxCache = new WeakMap();
export function context(bars) {
  let cx = cxCache.get(bars);
  if (cx) return cx;
  const m = new Map(), memo = (k, f) => (m.has(k) ? m.get(k) : (m.set(k, f()), m.get(k)));
  cx = {
    atr: () => memo('atr', () => atr(bars, 14)),
    ema: (n) => memo('ema' + n, () => { const o = new Array(bars.length).fill(NaN), k = 2 / (n + 1); let e = NaN; bars.forEach((b, i) => { e = i === 0 ? b.c : e + k * (b.c - e); o[i] = i >= n - 1 ? e : NaN; }); return o; }),
    // khối lượng trung bình n nến TRƯỚC nến i (không tính nến i)
    volAvg: (n = 20) => memo('va' + n, () => { const o = new Array(bars.length).fill(NaN); let s = 0; for (let i = 0; i < bars.length; i++) { if (i >= n) o[i] = s / n; s += bars[i].v; if (i >= n) s -= bars[i - n].v; } return o; }),
    pivots: (L) => memo('pv' + L, () => pivots(bars, L, L).sort((a, b) => a.knownAt - b.knownAt || a.i - b.i)),
  };
  cxCache.set(bars, cx);
  return cx;
}

// Dòng đỉnh/đáy đã xác nhận tới nến i: highs, lows, zz (zigzag xen kẽ đỉnh-đáy)
function pivotFeed(cx, L) {
  const pv = cx.pivots(L), highs = [], lows = [], zz = [];
  let k = 0;
  return {
    highs, lows, zz,
    step(i) {
      const added = [];
      while (k < pv.length && pv[k].knownAt <= i) {
        const q = pv[k++];
        (q.kind === 'high' ? highs : lows).push(q); added.push(q);
        const last = zz[zz.length - 1];
        if (last && last.kind === q.kind) { if (q.kind === 'high' ? q.price >= last.price : q.price <= last.price) zz[zz.length - 1] = q; } else zz.push(q);
      }
      return added;
    },
  };
}

// ---------- múi giờ (có giờ mùa hè) ----------
const tzFmt = {}, tzCache = new Map();
export function tzOffsetMin(t, tz) {
  if (tz === 'UTC') return 0;
  const key = tz + ':' + Math.floor(t / 36e5);
  let v = tzCache.get(key);
  if (v != null) return v;
  const f = tzFmt[tz] || (tzFmt[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
  const p = {}; for (const x of f.formatToParts(t)) p[x.type] = x.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  v = Math.round((asUtc - Math.floor(t / 6e4) * 6e4) / 6e4);
  tzCache.set(key, v);
  return v;
}
// phút trong ngày theo giờ địa phương
export const localMin = (t, tz) => { const m = Math.floor((t / 6e4 + tzOffsetMin(t, tz)) % 1440); return m < 0 ? m + 1440 : m; };
export const inWin = (m, a, b) => (a <= b ? m >= a && m < b : m >= a || m < b);

const body = (b) => Math.abs(b.c - b.o), rng = (b) => b.h - b.l;
const isUp = (b) => b.c > b.o, isDn = (b) => b.c < b.o;
const lowest = (bars, a, b) => { let x = Infinity; for (let k = Math.max(0, a); k <= b; k++) x = Math.min(x, bars[k].l); return x; };
const highest = (bars, a, b) => { let x = -Infinity; for (let k = Math.max(0, a); k <= b; k++) x = Math.max(x, bars[k].h); return x; };
const volAround = (bars, i) => (bars[i - 1]?.v ?? bars[i].v) + bars[i].v + (bars[i + 1]?.v ?? bars[i].v);
// đường thẳng qua 2 điểm (i, price), giá trị tại nến k
const lineAt = (p1, p2, k) => p1.price + (p2.price - p1.price) * (k - p1.i) / ((p2.i - p1.i) || 1);

export const P = (key, label, def, min, max, step, extra = {}) => ({ key, label, default: def, min, max, step, ...extra });
export const OPT = (key, label, options, def = 0, extra = {}) => ({ key, label, default: def, options, ...extra });
const ENTRY = OPT('entryMode', 'Cách vào lệnh', ['Lệnh chờ ở mép vùng', 'Chờ nến xác nhận đóng cửa'], 0, { g: 'bt-entry' });
const BUF = (def = 0.1) => P('bufAtr', 'Đệm cắt lỗ (× ATR)', def, 0, 3, 0.05, { g: 'atr' });

// ---------- hai đỉnh / hai đáy (dùng chung cho mẫu khối lượng số 10, 24, 25) ----------
function doubleDetector(bars, cx, { pivotLen = 5, tolAtr = 0.5, minGap = 5, maxGap = 120, volLower = 0, bufAtr = 0.2, validBars = 30 }) {
  const a = cx.atr(), pf = pivotFeed(cx, Math.max(2, Math.round(pivotLen))), used = new Set();
  const check = (i, list, dir) => {
    if (list.length < 2) return null;
    const A = list[list.length - 2], B = list[list.length - 1], ai = a[B.i];
    if (!(ai > 0) || used.has(B.i) || B.i - A.i < minGap || B.i - A.i > maxGap || i - B.i > validBars) return null;
    if (Math.abs(B.price - A.price) > tolAtr * ai) return null;
    if (volLower && !(volAround(bars, B.i) < volAround(bars, A.i))) return null;
    // đường cổ = đỉnh cao nhất (đáy thấp nhất) giữa hai đáy (hai đỉnh)
    const neck = dir === 1 ? highest(bars, A.i + 1, B.i - 1) : lowest(bars, A.i + 1, B.i - 1);
    const ext = dir === 1 ? Math.min(A.price, B.price) : Math.max(A.price, B.price);
    // trong lúc chờ, giá không được thủng đáy (vượt đỉnh) của mẫu
    for (let k = B.i + 1; k < i; k++) if (dir === 1 ? bars[k].c < ext : bars[k].c > ext) { used.add(B.i); return null; }
    const b = bars[i], p = bars[i - 1];
    if (dir === 1 ? b.c > neck && p.c <= neck : b.c < neck && p.c >= neck) {
      used.add(B.i);
      return { side: dir === 1 ? 'long' : 'short', stop: ext - dir * bufAtr * a[i], tag: dir === 1 ? 'Hai đáy' : 'Hai đỉnh' };
    }
    return null;
  };
  return (i) => { pf.step(i); if (i < 2) return null; return check(i, pf.lows, 1) || check(i, pf.highs, -1); };
}

// ---------- 31 mẫu hình khối lượng, gom thành các nhóm phát hiện được bằng máy ----------
const VOL_GROUPS = [
  'Tất cả các nhóm',
  'Phá nền kèm volume lớn (mẫu 1, 16, 18, 20, 31)',
  'Cao trào volume rồi đảo chiều (mẫu 9, 13, 14)',
  'Hai đỉnh/đáy, lần hai volume thấp (mẫu 10, 24, 25)',
  'Đỉnh/đáy mới nhưng volume yếu dần (mẫu 4, 15)',
  'Test lại sau phá vỡ, volume co lại (mẫu 19)',
  'Phá vỡ giả, volume yếu (mẫu 17)',
  'Vai đầu vai, phá cổ kèm volume (mẫu 21, 22, 23)',
  'Tam giác hội tụ, phá kèm volume (mẫu 26, 27, 28)',
];

function vol31(bars, p, cx) {
  const a = cx.atr(), va = cx.volAvg(20), N = Math.max(8, Math.round(p.baseBars)), pf = pivotFeed(cx, Math.max(2, Math.round(p.pivotLen)));
  const grp = Math.round(p.group), on = (g) => grp === 0 || grp === g, buf = (i) => p.bufAtr * a[i];
  const dbl = doubleDetector(bars, cx, { pivotLen: p.pivotLen, tolAtr: 0.5, volLower: 1, bufAtr: p.bufAtr });
  const breaks = []; // phá nền đã xảy ra, chờ test lại (nhóm 5)
  const fakes = []; // phá nền bằng volume yếu, chờ quay vào lại (nhóm 6)
  const climax = { long: null, short: null };
  const usedDiv = new Set(), usedHS = new Set(), usedTri = new Set();
  // nền: N nến trước i, biên độ hẹp, volume co dần
  const base = (i) => {
    if (i < N + 1) return null;
    const hi = highest(bars, i - N, i - 1), lo = lowest(bars, i - N, i - 1);
    if (!(a[i] > 0) || hi - lo > p.baseAtr * a[i]) return null;
    let v1 = 0, v2 = 0; const h = N >> 1;
    for (let k = i - N; k < i; k++) (k < i - h ? (v1 += bars[k].v) : (v2 += bars[k].v));
    return { hi, lo, shrink: v2 / (N - h) < v1 / h };
  };
  // quy tắc đồng biến (mẫu 2, 3, 5 - 8): lệnh mua cần volume nến tăng lớn hơn volume nến giảm trong 20 nến
  const concordOk = (i, dir) => {
    if (!p.concord) return true;
    let up = 0, dn = 0; for (let k = Math.max(0, i - 19); k <= i; k++) (isUp(bars[k]) ? (up += bars[k].v) : isDn(bars[k]) ? (dn += bars[k].v) : 0);
    return dir === 1 ? up > dn : dn > up;
  };
  const S = (dir, stop, tag) => ({ side: dir === 1 ? 'long' : 'short', stop, tag });
  return (i) => {
    const added = pf.step(i), sigDbl = dbl(i);
    if (i < 30 || !(a[i] > 0) || !(va[i] > 0)) return null;
    const b = bars[i], hv = b.v >= p.volMult * va[i], out = [];
    // 1. phá nền kèm volume lớn
    const bs = base(i);
    if (bs) {
      const dir = b.c > bs.hi ? 1 : b.c < bs.lo ? -1 : 0;
      if (dir) {
        if (hv && bs.shrink) { breaks.push({ i, dir, lvl: dir === 1 ? bs.hi : bs.lo, mid: (bs.hi + bs.lo) / 2 }); if (on(1)) out.push(S(dir, (bs.hi + bs.lo) / 2 - dir * buf(i), 'Phá nền kèm volume')); }
        else if (b.v < va[i]) fakes.push({ i, dir, lvl: dir === 1 ? bs.hi : bs.lo, ext: dir === 1 ? b.h : b.l });
      }
    }
    // 2. cao trào volume: sau một nhịp giảm (tăng) mạnh, nến volume cực lớn tạo đáy (đỉnh) mới; vào khi giá vượt lại đỉnh (đáy) nến cao trào
    if (on(2)) {
      for (const dir of [1, -1]) {
        const key = dir === 1 ? 'long' : 'short', fell = dir * (bars[i - 20].c - b.c) >= 4 * a[i];
        if (fell && b.v >= 3 * va[i] && (dir === 1 ? b.l <= lowest(bars, i - 30, i - 1) : b.h >= highest(bars, i - 30, i - 1))) climax[key] = { i, ext: dir === 1 ? b.l : b.h, trig: dir === 1 ? b.h : b.l };
        const c = climax[key];
        if (c && i > c.i && i - c.i <= 6) {
          if (dir === 1 ? b.l < c.ext : b.h > c.ext) climax[key] = null;
          else if (dir === 1 ? b.c > c.trig : b.c < c.trig) { out.push(S(dir, c.ext - dir * buf(i), 'Cao trào volume')); climax[key] = null; }
        } else if (c && i - c.i > 6) climax[key] = null;
      }
    }
    // 3. hai đỉnh/đáy, lần hai volume thấp hơn
    if (on(3) && sigDbl) out.push({ ...sigDbl, tag: sigDbl.tag + ' (volume giảm)' });
    // 4. ba đỉnh tăng dần nhưng volume giảm dần → bán khi thủng đáy gần nhất (ngược lại cho đáy)
    if (on(4)) {
      for (const [list, other, dir] of [[pf.highs, pf.lows, -1], [pf.lows, pf.highs, 1]]) {
        if (list.length < 3) continue;
        const [x, y, z] = list.slice(-3);
        if (usedDiv.has(z.i) || i - z.i > 30) continue;
        const rising = dir === -1 ? x.price < y.price && y.price < z.price : x.price > y.price && y.price > z.price;
        if (!rising || !(volAround(bars, x.i) > volAround(bars, y.i) && volAround(bars, y.i) > volAround(bars, z.i))) continue;
        const mid = [...other].reverse().find((q) => q.i > y.i && q.i < z.i);
        if (mid && (dir === -1 ? b.c < mid.price : b.c > mid.price)) { usedDiv.add(z.i); out.push(S(dir, z.price - dir * buf(i), dir === -1 ? 'Đỉnh mới, volume yếu' : 'Đáy mới, volume yếu')); }
      }
    }
    // 5. test lại mức phá vỡ, volume co lại, rồi bật đi tiếp
    for (let k = breaks.length - 1; k >= 0; k--) {
      const r = breaks[k];
      if (i - r.i > 40 || (r.dir === 1 ? b.c < r.mid : b.c > r.mid)) { breaks.splice(k, 1); continue; }
      if (i - r.i < 2) continue;
      const touched = r.dir === 1 ? b.l <= r.lvl + 0.3 * a[i] : b.h >= r.lvl - 0.3 * a[i];
      let quiet = 0; for (let q = i - 2; q <= i; q++) quiet += bars[q].v;
      if (touched && quiet / 3 < va[i] && (r.dir === 1 ? b.c > r.lvl && isUp(b) : b.c < r.lvl && isDn(b))) {
        breaks.splice(k, 1);
        if (on(5)) out.push(S(r.dir, (r.dir === 1 ? Math.min(b.l, r.lvl) : Math.max(b.h, r.lvl)) - r.dir * Math.max(buf(i), 0.5 * a[i]), 'Test lại sau phá vỡ'));
      }
    }
    // 6. phá vỡ giả: phá nền bằng volume yếu rồi đóng cửa quay vào trong nền
    for (let k = fakes.length - 1; k >= 0; k--) {
      const f = fakes[k];
      if (i === f.i) continue;
      f.ext = f.dir === 1 ? Math.max(f.ext, b.h) : Math.min(f.ext, b.l);
      if (i - f.i > 4) { fakes.splice(k, 1); continue; }
      if (f.dir === 1 ? b.c < f.lvl : b.c > f.lvl) { fakes.splice(k, 1); if (on(6)) out.push(S(-f.dir, f.ext + f.dir * buf(i), 'Phá vỡ giả')); }
    }
    // 7. vai đầu vai: 5 điểm xen kẽ, đầu cao (thấp) nhất, hai vai gần bằng nhau, phá đường cổ kèm volume
    if (on(7) && pf.zz.length >= 5) {
      const [s1, n1, hd, n2, s2] = pf.zz.slice(-5), dir = s2.kind === 'high' ? -1 : 1;
      const ok = dir === -1 ? hd.price > s1.price && hd.price > s2.price : hd.price < s1.price && hd.price < s2.price;
      if (ok && !usedHS.has(s2.i) && i - s2.i <= 30 && Math.abs(s1.price - s2.price) <= 1.5 * a[s2.i]) {
        const neck = lineAt(n1, n2, i);
        if (dir === -1 ? b.c < neck && bars[i - 1].c >= lineAt(n1, n2, i - 1) : b.c > neck && bars[i - 1].c <= lineAt(n1, n2, i - 1)) {
          usedHS.add(s2.i);
          if (b.v >= va[i]) out.push(S(dir, s2.price - dir * buf(i), dir === -1 ? 'Vai đầu vai' : 'Vai đầu vai ngược'));
        }
      }
    }
    // 8. tam giác: 2 đỉnh thấp dần, 2 đáy cao dần; phá cạnh kèm volume
    if (on(8) && pf.highs.length >= 2 && pf.lows.length >= 2) {
      const [h1, h2] = pf.highs.slice(-2), [l1, l2] = pf.lows.slice(-2), key = h2.i + ':' + l2.i;
      if (h1.price > h2.price && l1.price < l2.price && Math.min(h1.i, l1.i) >= i - 80 && !usedTri.has(key)) {
        const up = lineAt(h1, h2, i), lo = lineAt(l1, l2, i);
        if (up > lo && b.v >= 1.5 * va[i]) {
          if (b.c > up && bars[i - 1].c <= lineAt(h1, h2, i - 1)) { usedTri.add(key); out.push(S(1, lo - buf(i), 'Tam giác phá lên')); }
          else if (b.c < lo && bars[i - 1].c >= lineAt(l1, l2, i - 1)) { usedTri.add(key); out.push(S(-1, up + buf(i), 'Tam giác phá xuống')); }
        }
      }
    }
    void added;
    for (const s of out) if (concordOk(i, s.side === 'long' ? 1 : -1) && (s.side === 'long' ? s.stop < b.c : s.stop > b.c)) return s;
    return null;
  };
}

// ---------- vùng cung cầu / orderblock: lưu vùng tươi, vào lệnh ở lần chạm đầu tiên ----------
// zone: { dir, prox (mép gần), dist (mép xa), i, tag }
function zoneTrader(bars, cx, p, makeZones) {
  const a = cx.atr(), zones = [], mode = Math.round(p.entryMode), valid = Math.round(p.validBars);
  return (i) => {
    if (!(a[i] > 0)) return null;
    const b = bars[i];
    for (const z of makeZones(i) || []) zones.push(z);
    for (let k = zones.length - 1; k >= 0; k--) {
      const z = zones[k], side = z.dir === 1 ? 'long' : 'short';
      if (i - z.i > valid || (z.dir === 1 ? b.c < z.dist : b.c > z.dist)) { zones.splice(k, 1); continue; }
      if (i === z.i) continue;
      const touch = z.dir === 1 ? b.l <= z.prox : b.h >= z.prox;
      if (!touch) continue;
      // lần chạm đầu tiên làm vùng hết "tươi", dù có vào lệnh hay không
      zones.splice(k, 1);
      // lệnh chờ ở mép gần: khớp ngay trong nến chạm vùng (mở cửa vượt qua mép thì khớp ở giá mở)
      if (mode === 0) return { side, fillAt: z.dir === 1 ? Math.min(b.o, z.prox) : Math.max(b.o, z.prox), stop: z.dist - z.dir * p.bufAtr * a[i], tag: z.tag };
      // chờ xác nhận: nến chạm vùng phải đóng cửa quay ra theo hướng vùng
      if (z.dir === 1 ? isUp(b) && b.c > z.prox : isDn(b) && b.c < z.prox)
        return { side, stop: (z.dir === 1 ? Math.min(z.dist, b.l) : Math.max(z.dist, b.h)) - z.dir * p.bufAtr * a[i], tag: z.tag + ' (xác nhận)' };
    }
    return null;
  };
}

// ---------- danh sách chiến lược ----------
export const STRATEGIES = {
  doubleTB: {
    name: 'Hai đỉnh / hai đáy', short: 'Hai đỉnh/đáy',
    description: 'Hai đáy gần bằng nhau (lệch không quá dung sai), cách nhau một khoảng vừa phải, ở giữa có một đỉnh làm đường cổ. MUA khi giá đóng cửa vượt đường cổ, SL dưới đáy thấp hơn. Hai đỉnh thì ngược lại. Có thể bắt buộc đáy thứ hai có volume thấp hơn đáy thứ nhất (mẫu khối lượng số 10, 25).',
    params: [
      P('pivotLen', 'Độ rộng đỉnh/đáy (nến mỗi bên)', 5, 2, 30, 1),
      P('tolAtr', 'Hai đáy lệch tối đa (× ATR)', 0.5, 0.05, 3, 0.05, { g: 'atr' }),
      P('minGap', 'Khoảng cách tối thiểu (nến)', 5, 2, 200, 1),
      P('maxGap', 'Khoảng cách tối đa (nến)', 120, 10, 1000, 5),
      OPT('volLower', 'Đáy 2 phải có volume thấp hơn', ['Không', 'Có'], 0),
      P('validBars', 'Chờ phá đường cổ tối đa (nến)', 30, 2, 300, 1),
      BUF(0.2),
    ],
    prepare: (bars, p, cx) => doubleDetector(bars, cx, p),
  },
  fibo: {
    name: 'Fibonacci thoái lui 0.5 – 0.68', short: 'Fibonacci',
    description: 'Lấy con sóng gần nhất theo xu hướng: đáy rồi đỉnh mới cao hơn đỉnh trước (sóng tăng), dài ít nhất vài ATR. Đặt lệnh chờ MUA ở mốc 0.5, nếu giá đã ở trong vùng 0.5 – 0.68 thì vào ngay. SL ở điểm bắt đầu sóng (mốc 1.0) hoặc mốc 0.786. TP1 ở đỉnh cũ (mốc 0), TP2 ở mốc mở rộng −0.272. Sóng giảm thì ngược lại. Giá chạm đỉnh cũ trước khi khớp thì huỷ lệnh chờ.',
    params: [
      P('pivotLen', 'Độ rộng đỉnh/đáy (nến mỗi bên)', 5, 2, 30, 1),
      P('minImpAtr', 'Sóng dài tối thiểu (× ATR)', 3, 1, 30, 0.5, { g: 'atr' }),
      P('lvlA', 'Mép trên vùng vào (mốc)', 0.5, 0.236, 0.786, 0.01),
      P('lvlB', 'Mép dưới vùng vào (mốc)', 0.68, 0.382, 0.886, 0.01),
      OPT('slMode', 'Cắt lỗ ở', ['Mốc 1.0 (điểm đầu sóng)', 'Mốc 0.786'], 0),
      OPT('tpMode', 'Chốt lời', ['TP1 mốc 0, TP2 mốc −0.272', 'Theo R chung bên dưới'], 0),
      P('validBars', 'Lệnh chờ hiệu lực (nến)', 60, 2, 500, 1),
      BUF(0.1),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), pf = pivotFeed(cx, Math.max(2, Math.round(p.pivotLen))), used = new Set();
      return (i) => {
        const added = pf.step(i);
        if (!(a[i] > 0)) return null;
        const b = bars[i];
        for (const q of added) {
          const prevSame = (q.kind === 'high' ? pf.highs : pf.lows).slice(-2)[0], dir = q.kind === 'high' ? 1 : -1;
          const start = [...(dir === 1 ? pf.lows : pf.highs)].reverse().find((x) => x.i < q.i);
          if (!start || !prevSame || prevSame === q || used.has(q.i)) continue;
          if (dir === 1 ? q.price <= prevSame.price : q.price >= prevSame.price) continue; // phải là đỉnh cao hơn (đáy thấp hơn)
          const R = Math.abs(q.price - start.price);
          if (R < p.minImpAtr * a[i]) continue;
          // từ đỉnh tới giờ giá chưa vượt đỉnh (thủng đáy)
          if (dir === 1 ? highest(bars, q.i + 1, i) > q.price : lowest(bars, q.i + 1, i) < q.price) continue;
          used.add(q.i);
          const lv = (f) => q.price - dir * f * R, eA = lv(Math.min(p.lvlA, p.lvlB)), eB = lv(Math.max(p.lvlA, p.lvlB));
          const stop = (p.slMode ? lv(0.786) : start.price) - dir * p.bufAtr * a[i];
          const tps = p.tpMode ? {} : { tp1Px: q.price, tp2Px: q.price + dir * 0.272 * R };
          const side = dir === 1 ? 'long' : 'short', tag = `Fibo ${Math.min(p.lvlA, p.lvlB)}–${Math.max(p.lvlA, p.lvlB)}`;
          if (dir === 1 ? b.c > eA : b.c < eA) return { side, entry: eA, stop, valid: Math.round(p.validBars), tag, ...tps };
          if (dir === 1 ? b.c >= eB : b.c <= eB) return { side, stop, tag, ...tps };
        }
        return null;
      };
    },
  },
  candle: {
    name: 'Nến pinbar / engulfing / rút râu volume lớn', short: 'Pinbar/Engulfing',
    description: 'Nến đảo chiều tại đáy (đỉnh) của vài nến gần nhất, kèm volume lớn hơn trung bình. Pinbar: râu dài gấp nhiều lần thân. Engulfing: thân nến nuốt trọn thân nến trước, ngược màu. Vào ở giá đóng cửa, SL ngoài râu nến.',
    params: [
      OPT('kind', 'Dạng nến', ['Pinbar và engulfing', 'Chỉ pinbar (rút râu)', 'Chỉ engulfing'], 0),
      P('volMult', 'Volume ≥ (× trung bình 20 nến)', 1.5, 0.5, 10, 0.1, { g: 'bt-volmult' }),
      P('wickRatio', 'Râu pinbar ≥ (× thân)', 2, 1, 10, 0.5),
      P('lookback', 'Phải là đáy/đỉnh của (nến)', 10, 2, 100, 1),
      BUF(0.1),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), va = cx.volAvg(20), kind = Math.round(p.kind), L = Math.round(p.lookback);
      return (i) => {
        if (i < L + 1 || !(a[i] > 0) || !(bars[i].v >= p.volMult * va[i])) return null;
        const b = bars[i], pr = bars[i - 1], r = rng(b);
        if (!(r > 0)) return null;
        const lw = Math.min(b.o, b.c) - b.l, uw = b.h - Math.max(b.o, b.c), bd = body(b);
        const atLow = Math.min(b.l, pr.l) <= lowest(bars, i - L, i - 2), atHigh = Math.max(b.h, pr.h) >= highest(bars, i - L, i - 2);
        if (kind !== 2) {
          if (lw >= p.wickRatio * bd && lw >= 0.6 * r && b.l <= lowest(bars, i - L, i - 1)) return { side: 'long', stop: b.l - p.bufAtr * a[i], tag: 'Pinbar tăng' };
          if (uw >= p.wickRatio * bd && uw >= 0.6 * r && b.h >= highest(bars, i - L, i - 1)) return { side: 'short', stop: b.h + p.bufAtr * a[i], tag: 'Pinbar giảm' };
        }
        if (kind !== 1) {
          if (isDn(pr) && isUp(b) && b.c >= pr.o && b.o <= pr.c && bd > body(pr) && atLow) return { side: 'long', stop: Math.min(b.l, pr.l) - p.bufAtr * a[i], tag: 'Engulfing tăng' };
          if (isUp(pr) && isDn(b) && b.c <= pr.o && b.o >= pr.c && bd > body(pr) && atHigh) return { side: 'short', stop: Math.max(b.h, pr.h) + p.bufAtr * a[i], tag: 'Engulfing giảm' };
        }
        return null;
      };
    },
  },
  pullback: {
    name: 'Pullback theo xu hướng (EMA)', short: 'Pullback',
    description: 'Xu hướng tăng khi EMA nhanh trên EMA chậm và EMA chậm đang đi lên. Giá hồi về chạm EMA nhanh rồi có nến tăng đóng cửa vượt đỉnh nến trước thì MUA, SL dưới đáy nhịp hồi. Xu hướng giảm thì ngược lại.',
    params: [
      P('fast', 'EMA nhanh', 20, 5, 200, 1),
      P('slow', 'EMA chậm', 50, 10, 400, 1),
      P('tolAtr', 'Sai số chạm EMA (× ATR)', 0.2, 0, 2, 0.05, { g: 'atr' }),
      P('pbBars', 'Số nến nhịp hồi', 5, 2, 30, 1),
      BUF(0.2),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), ef = cx.ema(Math.round(p.fast)), es = cx.ema(Math.round(p.slow)), pb = Math.round(p.pbBars);
      return (i) => {
        if (i < pb + 6 || !(a[i] > 0) || !(es[i - 5] > 0)) return null;
        const b = bars[i], tol = p.tolAtr * a[i], lo = lowest(bars, i - pb + 1, i), hi = highest(bars, i - pb + 1, i);
        if (ef[i] > es[i] && es[i] > es[i - 5] && lo <= ef[i] + tol && b.c > ef[i] && isUp(b) && b.c > bars[i - 1].h) return { side: 'long', stop: lo - p.bufAtr * a[i], tag: 'Pullback EMA' };
        if (ef[i] < es[i] && es[i] < es[i - 5] && hi >= ef[i] - tol && b.c < ef[i] && isDn(b) && b.c < bars[i - 1].l) return { side: 'short', stop: hi + p.bufAtr * a[i], tag: 'Pullback EMA' };
        return null;
      };
    },
  },
  pullbackVwap: {
    name: 'Pullback kết hợp VWAP', short: 'Pullback VWAP',
    description: 'Giá ở trên VWAP ngày và EMA 50 đang đi lên (xu hướng tăng trong ngày). Giá hồi về chạm VWAP rồi có nến tăng đóng cửa vượt đỉnh nến trước thì MUA, SL dưới đáy nhịp hồi. Xu hướng giảm thì ngược lại.',
    params: [
      OPT('anchor', 'VWAP neo lúc', ['00:00 New York', '00:00 UTC'], 0, { g: 'vwap' }),
      P('tolAtr', 'Sai số chạm VWAP (× ATR)', 0.15, 0, 2, 0.05, { g: 'atr' }),
      P('pbBars', 'Số nến nhịp hồi', 5, 2, 30, 1),
      P('trendEma', 'EMA xu hướng', 50, 10, 400, 1),
      BUF(0.1),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), es = cx.ema(Math.round(p.trendEma)), pb = Math.round(p.pbBars), tz = p.anchor ? 'UTC' : 'America/New_York';
      const vw = new Array(bars.length), cnt = new Array(bars.length);
      let sv = 0, spv = 0, k0 = null, c = 0;
      bars.forEach((b, i) => { const k = Math.floor((b.t / 6e4 + tzOffsetMin(b.t, tz)) / 1440); if (k !== k0) { k0 = k; sv = spv = 0; c = 0; } const s = (b.h + b.l + b.c) / 3; sv += b.v; spv += s * b.v; vw[i] = sv > 0 ? spv / sv : s; cnt[i] = ++c; });
      return (i) => {
        if (i < pb + 6 || !(a[i] > 0) || cnt[i] < pb + 2 || !(es[i - 5] > 0)) return null;
        const b = bars[i], tol = p.tolAtr * a[i], lo = lowest(bars, i - pb + 1, i), hi = highest(bars, i - pb + 1, i);
        if (b.c > vw[i] && es[i] > es[i - 5] && lo <= vw[i] + tol && isUp(b) && b.c > bars[i - 1].h) return { side: 'long', stop: lo - p.bufAtr * a[i], tag: 'Pullback VWAP' };
        if (b.c < vw[i] && es[i] < es[i - 5] && hi >= vw[i] - tol && isDn(b) && b.c < bars[i - 1].l) return { side: 'short', stop: hi + p.bufAtr * a[i], tag: 'Pullback VWAP' };
        return null;
      };
    },
  },
  orderblock: {
    name: 'Orderblock', short: 'Orderblock',
    description: 'Orderblock tăng là nến giảm cuối cùng trước một cú đẩy mạnh phá đỉnh gần nhất (phá cấu trúc). Vùng là thân và râu nến đó. Giá quay lại chạm vùng lần đầu thì MUA, SL dưới vùng. Orderblock giảm thì ngược lại. Chỉ dùng vùng còn tươi (chưa bị chạm).',
    params: [
      P('pivotLen', 'Độ rộng đỉnh/đáy (nến mỗi bên)', 5, 2, 30, 1),
      P('impulseAtr', 'Cú đẩy tối thiểu (× ATR)', 2, 0.5, 10, 0.1, { g: 'atr' }),
      ENTRY,
      P('validBars', 'Vùng còn hiệu lực (nến)', 200, 5, 2000, 5),
      BUF(0.1),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), pf = pivotFeed(cx, Math.max(2, Math.round(p.pivotLen))), broken = new Set();
      return zoneTrader(bars, cx, p, (i) => {
        pf.step(i);
        const b = bars[i], out = [];
        for (const [list, dir] of [[pf.highs, 1], [pf.lows, -1]]) {
          const lv = list[list.length - 1];
          if (!lv || broken.has(lv.i) || !(dir === 1 ? b.c > lv.price : b.c < lv.price)) continue;
          broken.add(lv.i);
          // nến ngược màu cuối cùng trước cú đẩy, trong 10 nến
          let ob = -1;
          for (let k = i - 1; k >= Math.max(lv.i, i - 10); k--) if (dir === 1 ? isDn(bars[k]) : isUp(bars[k])) { ob = k; break; }
          if (ob < 0) continue;
          const o = bars[ob];
          if (dir * (b.c - (dir === 1 ? o.l : o.h)) < p.impulseAtr * a[i]) continue;
          out.push({ dir, prox: dir === 1 ? o.h : o.l, dist: dir === 1 ? o.l : o.h, i, tag: dir === 1 ? 'Orderblock tăng' : 'Orderblock giảm' });
        }
        return out;
      });
    },
  },
  sdz: {
    name: 'Supply Demand Zone (RBR · DBD · DBR · RBD)', short: 'Supply Demand',
    description: 'Theo file Supply Demand Zone: một nền gồm vài nến nhỏ, trước là chân vào và sau là một nến thân dài (gần như marubozu) rời nền. Rally-Base-Rally và Drop-Base-Drop là vùng tiếp diễn; Drop-Base-Rally và Rally-Base-Drop là vùng đảo chiều. Vùng cầu: mép gần là thân cao nhất của nền, mép xa là râu thấp nhất. Giá quay lại vùng tươi lần đầu thì MUA, SL dưới mép xa. Vùng cung ngược lại.',
    params: [
      OPT('type', 'Loại vùng', ['Tất cả', 'Tiếp diễn RBR / DBD', 'Đảo chiều DBR / RBD'], 0),
      P('legAtr', 'Nến rời nền: thân ≥ (× ATR)', 1.2, 0.3, 6, 0.1, { g: 'atr' }),
      P('baseMax', 'Nền tối đa (nến)', 4, 1, 10, 1),
      ENTRY,
      P('validBars', 'Vùng còn hiệu lực (nến)', 300, 5, 3000, 5),
      BUF(0.1),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), type = Math.round(p.type), M = Math.round(p.baseMax);
      return zoneTrader(bars, cx, p, (i) => {
        if (i < M + 3 || !(a[i] > 0)) return null;
        const b = bars[i], dir = isUp(b) ? 1 : isDn(b) ? -1 : 0;
        if (!dir || body(b) < p.legAtr * a[i] || body(b) < 0.6 * rng(b)) return null;
        // nền: các nến nhỏ ngay trước nến rời nền
        let k = i - 1, nb = 0;
        while (k > 0 && nb < M && (body(bars[k]) <= 0.5 * rng(bars[k]) || rng(bars[k]) <= 0.8 * a[k])) { k--; nb++; }
        if (!nb) return null;
        const leg = bars[k], legDir = isUp(leg) ? 1 : isDn(leg) ? -1 : 0;
        if (!legDir || body(leg) < 0.8 * p.legAtr * a[k]) return null;
        const cont = legDir === dir;
        if ((type === 1 && !cont) || (type === 2 && cont)) return null;
        let bodyHi = -Infinity, bodyLo = Infinity, hi = -Infinity, lo = Infinity;
        for (let q = k + 1; q < i; q++) { const x = bars[q]; bodyHi = Math.max(bodyHi, x.o, x.c); bodyLo = Math.min(bodyLo, x.o, x.c); hi = Math.max(hi, x.h); lo = Math.min(lo, x.l); }
        const name = cont ? (dir === 1 ? 'RBR' : 'DBD') : (dir === 1 ? 'DBR' : 'RBD');
        return [{ dir, prox: dir === 1 ? bodyHi : bodyLo, dist: dir === 1 ? lo : hi, i, tag: `${dir === 1 ? 'Vùng cầu' : 'Vùng cung'} ${name}` }];
      });
    },
  },
  poe: {
    name: 'Point of Entry (QML · MPL)', short: 'Point of Entry',
    description: 'Theo file Point of Entry: QML bán gồm đỉnh H, đáy L, đỉnh cao hơn HH, rồi giá đóng cửa thủng L (tạo LL). Mức QML là đỉnh H (vai trái). Đặt lệnh chờ BÁN ở QML, SL trên HH. QML mua ngược lại. Biên độ giữa vai trái và đầu không được quá rộng.',
    params: [
      P('pivotLen', 'Độ rộng đỉnh/đáy (nến mỗi bên)', 4, 2, 30, 1),
      P('maxHeadAtr', 'Đầu cao hơn vai tối đa (× ATR)', 5, 0.5, 30, 0.5, { g: 'atr' }),
      ENTRY,
      P('validBars', 'Lệnh chờ hiệu lực (nến)', 100, 5, 1000, 5),
      BUF(0.1),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), pf = pivotFeed(cx, Math.max(2, Math.round(p.pivotLen))), used = new Set();
      return zoneTrader(bars, cx, p, (i) => {
        pf.step(i);
        const z = pf.zz;
        if (z.length < 3 || !(a[i] > 0)) return null;
        const [s, m, hd] = z.slice(-3), b = bars[i];
        if (used.has(hd.i)) return null;
        // bán: H (s, đỉnh) → L (m) → HH (hd); giá đóng cửa thủng L
        if (s.kind === 'high' && hd.price > s.price && hd.price - s.price <= p.maxHeadAtr * a[i] && b.c < m.price && b.c < s.price) {
          used.add(hd.i); return [{ dir: -1, prox: s.price, dist: hd.price, i, tag: 'QML bán' }];
        }
        if (s.kind === 'low' && hd.price < s.price && s.price - hd.price <= p.maxHeadAtr * a[i] && b.c > m.price && b.c > s.price) {
          used.add(hd.i); return [{ dir: 1, prox: s.price, dist: hd.price, i, tag: 'QML mua' }];
        }
        return null;
      });
    },
  },
  vol31: {
    name: '31 mẫu hình khối lượng', short: '31 mẫu volume',
    description: 'Theo file 31 mẫu hình khối lượng, gom thành 8 nhóm máy phát hiện được: phá nền kèm volume lớn, cao trào volume rồi đảo chiều, hai đỉnh/đáy có volume giảm ở lần hai, đỉnh mới nhưng volume yếu dần, test lại sau phá vỡ khi volume co lại, phá vỡ giả do volume yếu, vai đầu vai và tam giác hội tụ. Các mẫu 2, 3, 5 đến 8 (quy tắc đồng biến) dùng làm bộ lọc. Mẫu 11, 12, 29, 30 và cốc tay cầm khó định nghĩa chính xác bằng máy nên được tính chung vào nhóm phá nền.',
    params: [
      OPT('group', 'Nhóm mẫu', VOL_GROUPS, 0),
      P('volMult', 'Volume phá vỡ ≥ (× trung bình 20 nến)', 2, 1, 10, 0.1, { g: 'bt-volmult' }),
      P('baseBars', 'Độ dài nền (nến)', 20, 8, 200, 1),
      P('baseAtr', 'Nền cao tối đa (× ATR)', 4, 1, 20, 0.5, { g: 'atr' }),
      P('pivotLen', 'Độ rộng đỉnh/đáy (nến mỗi bên)', 5, 2, 30, 1),
      OPT('concord', 'Lọc đồng biến (mẫu 2, 3, 5–8)', ['Không', 'Có'], 0),
      BUF(0.2),
    ],
    prepare: (bars, p, cx) => vol31(bars, p, cx),
  },
  wyckoff: {
    name: 'Wyckoff tích luỹ / phân phối', short: 'Wyckoff',
    description: 'Theo file Phương pháp Wyckoff. Tích luỹ: sau nhịp giảm có cao trào bán SC (volume rất lớn), nhịp hồi AR tạo biên trên. Spring là nến thủng đáy SC rồi đóng cửa quay lại trong nền, volume thấp hơn SC: MUA, SL dưới Spring. Hoặc chờ SOS (đóng cửa vượt biên trên kèm volume) rồi mua ở BU/LPS khi giá test lại biên trên. Phân phối ngược lại với BC, UTAD, SOW, LPSY.',
    params: [
      OPT('mode', 'Điểm vào', ['Spring / UTAD', 'BU / LPS sau SOS / SOW', 'Cả hai'], 2),
      P('climaxMult', 'Cao trào: volume ≥ (× trung bình 20 nến)', 2.5, 1.2, 10, 0.1, { g: 'bt-volmult' }),
      P('minBars', 'Nền tối thiểu (nến)', 20, 5, 500, 1),
      P('maxBars', 'Nền tối đa (nến)', 300, 20, 3000, 10),
      P('maxRangeAtr', 'Nền cao tối đa (× ATR)', 12, 2, 50, 0.5, { g: 'atr' }),
      BUF(0.1),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), va = cx.volAvg(20), mode = Math.round(p.mode), tr = { 1: null, '-1': null };
      return (i) => {
        if (i < 60 || !(a[i] > 0) || !(va[i] > 0)) return null;
        const b = bars[i];
        for (const dir of [1, -1]) {
          let r = tr[dir];
          // cao trào mới sau một nhịp giảm (tăng) dài: bắt đầu nền mới
          const ext = dir === 1 ? b.l <= lowest(bars, i - 50, i - 1) : b.h >= highest(bars, i - 50, i - 1);
          if ((!r || r.done) && ext && b.v >= p.climaxMult * va[i] && dir * (bars[i - 30].c - b.c) > 3 * a[i]) {
            tr[dir] = r = { i, ext: dir === 1 ? b.l : b.h, vol: b.v, ar: dir === 1 ? b.h : b.l, sprung: false, sos: -1, sosExt: NaN, done: false };
            continue;
          }
          if (!r || r.done) continue;
          const age = i - r.i;
          if (age <= 10) r.ar = dir === 1 ? Math.max(r.ar, b.h) : Math.min(r.ar, b.l); // AR: biên còn lại của nền
          const height = Math.abs(r.ar - r.ext);
          if (age > p.maxBars || height > p.maxRangeAtr * a[i]) { r.done = true; continue; }
          if (age < Math.max(11, p.minBars)) continue;
          // Spring / UTAD: thủng biên rồi đóng cửa quay lại trong nền, volume thấp hơn cao trào
          if (dir === 1 ? b.l < r.ext : b.h > r.ext) {
            if ((dir === 1 ? b.c > r.ext : b.c < r.ext) && b.v < r.vol && !r.sprung && r.sos < 0) {
              r.sprung = true;
              if (mode !== 1) return { side: dir === 1 ? 'long' : 'short', stop: (dir === 1 ? b.l : b.h) - dir * p.bufAtr * a[i], tag: dir === 1 ? 'Spring' : 'UTAD' };
            } else if (dir === 1 ? b.c < r.ext : b.c > r.ext) { r.done = true; continue; }
          }
          // SOS / SOW: đóng cửa vượt biên kia kèm volume; sau đó BU / LPS khi test lại
          if (r.sos < 0 && (dir === 1 ? b.c > r.ar : b.c < r.ar) && b.v >= 1.5 * va[i]) { r.sos = i; r.sosExt = dir === 1 ? b.h : b.l; continue; }
          if (r.sos >= 0) {
            r.sosExt = dir === 1 ? Math.max(r.sosExt, b.h) : Math.min(r.sosExt, b.l);
            if (i - r.sos > 40 || (dir === 1 ? b.c < r.ar - 0.5 * height : b.c > r.ar + 0.5 * height)) { r.done = true; continue; }
            const touch = dir === 1 ? b.l <= r.ar + 0.3 * a[i] : b.h >= r.ar - 0.3 * a[i];
            if (i - r.sos >= 2 && touch && (dir === 1 ? b.c > r.ar && isUp(b) : b.c < r.ar && isDn(b))) {
              r.done = true;
              if (mode !== 0) return { side: dir === 1 ? 'long' : 'short', stop: (dir === 1 ? Math.min(b.l, r.ar) : Math.max(b.h, r.ar)) - dir * Math.max(p.bufAtr, 0.5) * a[i], tag: dir === 1 ? 'BU / LPS' : 'LPSY' };
            }
          }
        }
        return null;
      };
    },
  },
  structure: {
    name: 'Đỉnh sau cao hơn, đáy sau cao hơn (và ngược lại)', short: 'HH-HL / LH-LL',
    description: 'Xu hướng tăng khi hai đỉnh gần nhất cao dần và hai đáy gần nhất cao dần (HH-HL). MUA khi vừa xác nhận một đáy cao hơn, hoặc khi giá phá đỉnh gần nhất, SL dưới đáy cao hơn đó. Xu hướng giảm (LH-LL) thì BÁN ngược lại.',
    params: [
      P('pivotLen', 'Độ rộng đỉnh/đáy (nến mỗi bên)', 5, 2, 30, 1),
      OPT('entry', 'Vào lệnh khi', ['Xác nhận đáy (đỉnh) mới', 'Giá phá đỉnh (đáy) gần nhất'], 0),
      BUF(0.2),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), pf = pivotFeed(cx, Math.max(2, Math.round(p.pivotLen))), used = new Set();
      return (i) => {
        const added = pf.step(i);
        if (!(a[i] > 0) || pf.highs.length < 2 || pf.lows.length < 2) return null;
        const [h1, h2] = pf.highs.slice(-2), [l1, l2] = pf.lows.slice(-2), b = bars[i];
        const upT = h2.price > h1.price && l2.price > l1.price, dnT = h2.price < h1.price && l2.price < l1.price;
        if (!p.entry) {
          if (upT && added.includes(l2) && l2.i > h2.i) return { side: 'long', stop: l2.price - p.bufAtr * a[i], tag: 'Đáy cao hơn (HL)' };
          if (dnT && added.includes(h2) && h2.i > l2.i) return { side: 'short', stop: h2.price + p.bufAtr * a[i], tag: 'Đỉnh thấp hơn (LH)' };
          return null;
        }
        if (upT && l2.i > h2.i && !used.has(h2.i) && b.c > h2.price && bars[i - 1].c <= h2.price) { used.add(h2.i); return { side: 'long', stop: l2.price - p.bufAtr * a[i], tag: 'Phá đỉnh (HH)' }; }
        if (dnT && h2.i > l2.i && !used.has(l2.i) && b.c < l2.price && bars[i - 1].c >= l2.price) { used.add(l2.i); return { side: 'short', stop: h2.price + p.bufAtr * a[i], tag: 'Phá đáy (LL)' }; }
        return null;
      };
    },
  },
  counter: {
    name: 'Chống lại thị trường (mua đáy, bán đỉnh volume lớn)', short: 'Chống thị trường',
    description: 'Nến tạo đáy thấp nhất trong N nến gần nhất và có khối lượng lớn hơn nhiều lần trung bình: MUA ở giá đóng cửa nến đó, SL dưới râu nến. Nến tạo đỉnh cao nhất kèm volume lớn thì BÁN. Có thể bắt buộc nến phải có râu dài (rút râu).',
    params: [
      P('lookback', 'Đáy/đỉnh của N nến gần nhất', 20, 5, 500, 1),
      P('volMult', 'Volume ≥ (× trung bình 20 nến)', 2, 1, 10, 0.1, { g: 'bt-volmult' }),
      OPT('wick', 'Bắt buộc râu dài', ['Không bắt buộc', 'Râu ≥ 50% chiều dài nến'], 0),
      BUF(0.1),
    ],
    prepare(bars, p, cx) {
      const a = cx.atr(), va = cx.volAvg(20), L = Math.round(p.lookback);
      return (i) => {
        if (i < L || !(a[i] > 0) || !(bars[i].v >= p.volMult * va[i])) return null;
        const b = bars[i], r = rng(b);
        if (!(r > 0)) return null;
        const lw = (Math.min(b.o, b.c) - b.l) / r, uw = (b.h - Math.max(b.o, b.c)) / r;
        if (b.l <= lowest(bars, i - L + 1, i - 1) && (!p.wick || lw >= 0.5)) return { side: 'long', stop: b.l - p.bufAtr * a[i], tag: 'Mua đáy volume lớn' };
        if (b.h >= highest(bars, i - L + 1, i - 1) && (!p.wick || uw >= 0.5)) return { side: 'short', stop: b.h + p.bufAtr * a[i], tag: 'Bán đỉnh volume lớn' };
        return null;
      };
    },
  },
};

export const STRATEGY_ORDER = ['doubleTB', 'fibo', 'candle', 'pullback', 'pullbackVwap', 'orderblock', 'vol31', 'poe', 'sdz', 'wyckoff', 'structure', 'counter'];

export function defaultParams(id) {
  const out = {};
  for (const p of STRATEGIES[id]?.params || []) out[p.key] = p.default;
  return out;
}

// Chiến lược nằm ở file riêng (ví dụ MIDOTI, chỉ có trong bản trên máy của Lai Long) tự đăng ký vào danh sách
export function registerStrategy(id, s, first = false) {
  STRATEGIES[id] = s;
  if (!STRATEGY_ORDER.includes(id)) first ? STRATEGY_ORDER.unshift(id) : STRATEGY_ORDER.push(id);
}
