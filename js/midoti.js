// Lai Long Web: chiến lược MIDOTI v2.568 (luật OP + VWAP theo file Pine của Lai Long).
// Tách riêng khỏi strategies.js để bản web công khai có thể không kèm file này.
import { registerStrategy, tzOffsetMin, localMin, inWin, P, OPT } from './strategies.js?v=202610152037';

// ---------- MIDOTI v2.568: luật OP + VWAP theo file Pine của Lai Long ----------
const OP_ANCHORS = [
  { label: '00:00 New York', tz: 'America/New_York', m: 0 },
  { label: 'Mở phiên Á (09:00 Tokyo)', tz: 'Asia/Tokyo', m: 540 },
  { label: 'Mở phiên Âu (08:00 London)', tz: 'Europe/London', m: 480 },
  { label: 'Mở phiên Mỹ (08:00 New York)', tz: 'America/New_York', m: 480 },
  { label: '00:00 UTC', tz: 'UTC', m: 0 },
];
export function midoti(bars, p, cx, iv) {
  const n = bars.length, a = cx.atr(), anc = OP_ANCHORS[Math.round(p.opAnchor)] || OP_ANCHORS[0];
  const dayKey = (t) => Math.floor((t / 6e4 + tzOffsetMin(t, anc.tz) - anc.m) / 1440);
  const key = new Array(n), op = new Array(n), vw = new Array(n), up2 = new Array(n), dn2 = new Array(n), start = new Array(n);
  let sv = 0, spv = 0, sp2 = 0, o = NaN, st = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i]; key[i] = dayKey(b.t);
    if (i === 0 || key[i] !== key[i - 1]) { sv = spv = sp2 = 0; o = b.o; st = b.t; }
    const src = (b.h + b.l + b.c) / 3; sv += b.v; spv += src * b.v; sp2 += src * src * b.v;
    const m = sv > 0 ? spv / sv : src, dev = sv > 0 ? Math.sqrt(Math.max(0, sp2 / sv - m * m)) : 0;
    op[i] = o; vw[i] = m; up2[i] = m + p.band2 * dev; dn2[i] = m - p.band2 * dev; start[i] = st;
  }
  const tfOk = iv <= 36e5, setup = Math.round(p.setup), useA = setup !== 2, useB = setup !== 1;
  const pb = Math.max(2, Math.round(p.pbBars)), hoi = Math.max(1, Math.round(p.hoiMin));
  return (i) => {
    if (!tfOk || i < 20 || !(a[i] > 0)) return null;
    const b = bars[i], t = b.t;
    // thời gian: trong phiên Á/Âu/Mỹ, ngoài rollover, qua vài phút đầu ngày
    if (p.sessOn) {
      const inAsia = inWin(localMin(t, 'Asia/Tokyo'), 540, 1080), inEu = inWin(localMin(t, 'Europe/London'), 480, 1020), inUs = inWin(localMin(t, 'America/New_York'), 480, 1020);
      if (!(inAsia || inEu || inUs)) return null;
    }
    if (p.rollOn && inWin(localMin(t, 'America/New_York'), 1015, 1085)) return null;
    if (p.warmMin > 0 && t - start[i] < p.warmMin * 6e4) return null;
    // đáy/đỉnh nhịp hồi trong cùng ngày giao dịch
    let lowPB = b.l, highPB = b.h, nSame = 1;
    for (let k = 1; k < pb; k++) { if (i - k < 0 || key[i - k] !== key[i]) break; lowPB = Math.min(lowPB, bars[i - k].l); highPB = Math.max(highPB, bars[i - k].h); nSame++; }
    const tol = p.tolAtr * a[i], c = b.c;
    const aL = useA && ((lowPB <= vw[i] + tol && c > vw[i]) || (lowPB <= op[i] + tol && c > op[i]));
    const aS = useA && ((highPB >= vw[i] - tol && c < vw[i]) || (highPB >= op[i] - tol && c < op[i]));
    let bL = false, bS = false;
    if (useB && nSame >= hoi + 2) {
      let dn = true, upw = true;
      for (let m = 1; m <= hoi; m++) {
        dn = dn && (bars[i - m].h < bars[i - m - 1].h || bars[i - m].c < bars[i - m].o);
        upw = upw && (bars[i - m].l > bars[i - m - 1].l || bars[i - m].c > bars[i - m].o);
      }
      bL = dn && c > bars[i - 1].h; bS = upw && c < bars[i - 1].l;
    }
    const buf = p.slBufAtr * a[i], distL = Math.max(c - (lowPB - buf), p.slMinAtr * a[i]), distS = Math.max(highPB + buf - c, p.slMinAtr * a[i]);
    const k0 = key[i], eod = p.eod ? (k) => k + 1 >= n || dayKey(bars[k].t + iv) !== k0 : undefined;
    if (c > op[i] && c > vw[i] && (aL || bL) && c > b.o && c <= up2[i] && distL <= p.slMaxAtr * a[i])
      return { side: 'long', stop: c - distL, forceExit: eod, tag: aL ? 'A · Tựa VWAP/OP' : 'B · Hồi' };
    if (c < op[i] && c < vw[i] && (aS || bS) && c < b.o && c >= dn2[i] && distS <= p.slMaxAtr * a[i])
      return { side: 'short', stop: c + distS, forceExit: eod, tag: aS ? 'A · Tựa VWAP/OP' : 'B · Hồi' };
    return null;
  };
}

export const MIDOTI = {
  name: 'MIDOTI v2.568 (OP + VWAP)', short: 'MIDOTI',
  description: 'Luật của chỉ báo MIDOTI v2.568. MUA khi giá đóng cửa trên OP ngày và trên VWAP, có một trong hai thiết lập: A · Tựa (vài nến gần nhất hồi chạm VWAP hoặc OP rồi đóng cửa lại phía trên) hoặc B · Hồi (có nhịp hồi rồi nến hiện tại phá đỉnh nến trước). Nến xác nhận là nến tăng, chưa vượt VWAP +2σ, trong phiên Á/Âu/Mỹ, ngoài giờ rollover. SL dưới đáy nhịp hồi. BÁN đối xứng. Vào ở giá đóng cửa nến tín hiệu. Chỉ chạy từ khung 1 phút tới 1 giờ.',
  params: [
    OPT('opAnchor', 'Mốc OP ngày', OP_ANCHORS.map((x) => x.label), 0),
    OPT('setup', 'Thiết lập', ['A · Tựa và B · Hồi', 'Chỉ A · Tựa VWAP/OP', 'Chỉ B · Hồi'], 0),
    P('pbBars', 'Số nến nhịp hồi', 5, 2, 20, 1),
    P('tolAtr', 'Sai số chạm (× ATR)', 0.1, 0, 2, 0.05, { g: 'atr' }),
    P('hoiMin', 'Số nến hồi tối thiểu', 2, 1, 6, 1),
    P('band2', 'Không vào khi vượt VWAP ± σ', 2, 0.5, 5, 0.1, { g: 'vwap' }),
    P('slBufAtr', 'Đệm SL (× ATR)', 0.1, 0, 2, 0.05, { g: 'atr' }),
    P('slMinAtr', 'SL tối thiểu (× ATR)', 0.3, 0, 3, 0.05, { g: 'atr' }),
    P('slMaxAtr', 'SL tối đa (× ATR)', 2.5, 0.2, 10, 0.1, { g: 'atr' }),
    OPT('sessOn', 'Chỉ vào lệnh trong phiên Á/Âu/Mỹ', ['Không', 'Có'], 1),
    OPT('rollOn', 'Tránh rollover 16:55–18:05 New York', ['Không', 'Có'], 1),
    P('warmMin', 'Chờ sau mốc OP (phút)', 15, 0, 240, 5),
    OPT('eod', 'Đóng lệnh cuối ngày (trước OP mới)', ['Không', 'Có'], 1),
  ],
  prepare: (bars, p, cx, iv) => midoti(bars, p, cx, iv),
};
registerStrategy('midoti', MIDOTI, true);
