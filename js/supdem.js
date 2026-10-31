// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: Price Action + Supply&Demand đa khung (Tuần · Ngày · H4 · H1 · M15 · M5). Chỉ dùng giá.
//   Chép logic từ bản Pine "Price Action + Supply&Demand MTF" (bản thực chiến v1.0):
//   • Đỉnh (cao nhất trong X nến mỗi bên) → SUPPLY: râu trên → đỉnh thân. Đáy → DEMAND: râu dưới → đáy thân.
//   • Đỉnh/đáy mới cách vùng cùng loại, cùng khung ≤ 20 pip → gộp vào vùng đó, tính 1 lần test.
//     Giá chạm vùng rồi rời đi đúng chiều cũng là 1 lần test. Test ≥ 2 lần → vùng "mạnh".
//   • Nến cùng khung đóng cửa phá qua vùng → đổi vai (S→D / D→S); bị phá lần nữa → xoá.
//   • Khung càng lớn viền càng đậm, nền càng nhạt. Vùng nhiều khung chồng nhau = hợp lưu, ví dụ "S · H4+H1+M15".
//   • FVG (khoảng trống 3 nến) ≥ 30 pip, mặc định H4 + H1. Giá lấp hết → xoá.
//   • Chỉ vẽ khung ≥ khung chart. Nến khung lớn chỉ tính khi đã đóng (không vẽ lại).
import { alpha } from "./theme.js?v=202610300405";

// bậc khung: 6 Tuần · 5 Ngày · 4 H4 · 3 H1 · 2 M15 · 1 M5; src là khung nến tải từ sàn (Tuần gộp từ nến ngày)
export const SD_TFS = [
  { r: 6, name: "W", vn: "Tuần", ms: 7 * 864e5, src: "1d", width: 4, transp: 94 },
  { r: 5, name: "D", vn: "Ngày", ms: 864e5, src: "1d", width: 3, transp: 92 },
  { r: 4, name: "H4", vn: "H4", ms: 4 * 36e5, src: "4h", width: 2, transp: 90 },
  { r: 3, name: "H1", vn: "H1", ms: 36e5, src: "1h", width: 1, transp: 86 },
  { r: 2, name: "M15", vn: "M15", ms: 9e5, src: "15m", width: 1, transp: 82, dash: [5, 3] },
  { r: 1, name: "M5", vn: "M5", ms: 3e5, src: "5m", width: 1, transp: 78, dash: [1, 2] },
];
const BY_R = Object.fromEntries(SD_TFS.map(x => [x.r, x]));

export const SD_DEFAULT = {
  tf: { W: true, D: true, H4: true, H1: true, M15: true, M5: true },
  piv: 5, merge: 20, minThk: 10, pip: 0,
  maxBig: 3, maxSmall: 5, strongN: 2,
  fvg: true, fvgTf: { W: false, D: false, H4: true, H1: true, M15: false, M5: false },
  minFvg: 30, half: false, maxF: 5,
  cSup: "#FF1744", cDem: "#00C853", cFvg: "#2196F3",
};
// bản "Price Action + Supply&Demand H1-M15": chỉ bật H1 + M15, FVG cũng H1 + M15, tối đa 5 vùng mỗi khung
export const SD_H1M15 = {
  tf: { W: false, D: false, H4: false, H1: true, M15: true, M5: false },
  fvgTf: { W: false, D: false, H4: false, H1: true, M15: true, M5: false },
};

// 1 pip: vàng theo quy ước FXCM là 0,1; còn lại = bước giá × 10 (như mintick × 10 của Pine)
export function autoPip(symbol, tick, price) {
  if (/XAU|GOLD|PAXG/i.test(symbol || "")) return 0.1;
  if (tick > 0) return tick * 10;
  if (!(price > 0)) return 1;
  return Math.pow(10, Math.floor(Math.log10(price)) - 4) * 10; // không biết bước giá: lấy 5 chữ số có nghĩa
}

// gộp nến ngày thành nến tuần (tuần bắt đầu thứ Hai 00:00 UTC như TradingView); bỏ tuần đầu nếu thiếu ngày
export function weekly(days) {
  const out = [];
  for (const d of days) {
    const wd = (new Date(d.t).getUTCDay() + 6) % 7, t = d.t - wd * 864e5, w = out[out.length - 1];
    if (w && w.t === t) { w.h = Math.max(w.h, d.h); w.l = Math.min(w.l, d.l); w.c = d.c; }
    else out.push({ t, o: d.o, h: d.h, l: d.l, c: d.c, first: d.t });
  }
  if (out.length && out[0].first !== out[0].t) out.shift();
  return out.map(({ first, ...w }) => w);
}

// đỉnh/đáy tại p: cao/thấp nhất trong L nến mỗi bên (bên trái phải hơn hẳn, bên phải được bằng, như ta.pivothigh)
function pivot(bars, p, L, hi) {
  const v = hi ? bars[p].h : bars[p].l;
  for (let j = p - L; j <= p + L; j++) {
    if (j === p) continue;
    const x = hi ? bars[j].h : bars[j].l;
    if (hi ? (j < p ? x >= v : x > v) : (j < p ? x <= v : x < v)) return false;
  }
  return true;
}

const kindTxt = z => z.flips > 0 ? (z.kind === 1 ? "S→D" : "D→S") : (z.kind === 1 ? "D" : "S");

// tf: { W, D, H4, H1, M15, M5 } -> nến từng khung (có thể kèm nến đang chạy, sẽ bị bỏ qua)
// chart: nến của biểu đồ (chartMs mỗi nến). Kết quả: { zones, gaps } để vẽ.
export function supplyDemand({ chart = [], chartMs, tf = {}, now = Date.now() }, opts = {}, pip = 0.1) {
  const o = { ...SD_DEFAULT, ...opts, tf: { ...SD_DEFAULT.tf, ...opts.tf }, fvgTf: { ...SD_DEFAULT.fvgTf, ...opts.fvgTf } };
  const L = Math.max(1, Math.round(o.piv)), zones = [], gaps = [], events = [];
  const maxOf = r => r >= 4 ? o.maxBig : o.maxSmall;
  const closed = (bars, ms) => bars.filter(b => b.t + ms <= now);

  // ---- vùng Supply / Demand ----
  const newSeg = (z, t) => z.segs.push({ t0: t, t1: null, kind: z.kind });
  const addZone = (r, kind, top, bot, t0) => {
    const tol = o.merge * pip;
    const m = zones.find(z => z.r === r && z.kind === kind && Math.max(z.bot, bot) - Math.min(z.top, top) <= tol);
    if (m) { // gộp: mở rộng tới râu mới; chưa chạm vùng thì tính 1 lần test
      const touched = Math.max(m.bot, bot) <= Math.min(m.top, top);
      if (m.kind === -1 && top > m.top) m.top = top;
      if (m.kind === 1 && bot < m.bot) m.bot = bot;
      if (!touched) m.tests++;
      return;
    }
    const z = { r, kind, top, bot, t0, tests: 0, flips: 0, inZone: false, segs: [] };
    newSeg(z, t0); zones.push(z);
    if (zones.filter(x => x.r === r).length > maxOf(r)) zones.splice(zones.findIndex(x => x.r === r), 1);
  };
  // nến cùng khung đóng cửa phá vùng → đổi vai; đã đổi vai mà bị phá lần nữa → xoá
  const applyClose = (r, px, t) => {
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      if (z.r !== r || !(z.kind === -1 ? px > z.top : px < z.bot)) continue;
      if (z.flips >= 1) { zones.splice(i, 1); continue; }
      const s = z.segs[z.segs.length - 1];
      Object.assign(s, { t1: t, top: z.top, bot: z.bot, strong: z.tests >= o.strongN });
      z.flips = 1; z.kind = -z.kind; z.tests = 0; z.inZone = false;
      newSeg(z, t);
    }
  };
  // giá vào vùng rồi rời đi đúng chiều (Demand: lên trên, Supply: xuống dưới) = 1 lần test
  const countTests = b => {
    for (const z of zones) {
      const touch = b.h >= z.bot && b.l <= z.top, left = z.inZone && !touch;
      const held = z.kind === 1 ? b.l > z.top : b.h < z.bot;
      z.inZone = touch;
      if (left && held) z.tests++;
    }
  };

  // ---- FVG ----
  const addGap = (r, dir, top, bot, t0) => {
    if (top - bot < o.minFvg * pip) return;
    if (gaps.some(g => g.r === r && g.dir === dir && Math.max(g.bot, bot) <= Math.min(g.top, top))) return;
    gaps.push({ r, dir, top, bot, t0 });
    if (gaps.filter(g => g.r === r).length > o.maxF) gaps.splice(gaps.findIndex(g => g.r === r), 1);
  };
  const fillGaps = b => {
    for (let i = gaps.length - 1; i >= 0; i--) {
      const g = gaps[i], lvl = o.half ? (g.top + g.bot) / 2 : g.dir === 1 ? g.bot : g.top;
      if (g.dir === 1 ? b.l <= lvl : b.h >= lvl) gaps.splice(i, 1);
    }
  };

  // mỗi nến khung lớn đóng là một sự kiện, xử lý đúng lúc nó đóng; cùng lúc thì khung lớn trước
  const thk = o.minThk * pip, series = [];
  for (const x of SD_TFS) {
    if (x.ms < chartMs) continue; // chỉ vẽ khung ≥ khung chart
    const bars = closed(tf[x.name] || [], x.ms);
    series.push({ ms: x.ms, bars });
    const zOn = o.tf[x.name], fOn = o.fvg && o.fvgTf[x.name];
    if (!zOn && !fOn) continue;
    for (let k = 0; k < bars.length; k++) events.push({ at: bars[k].t + x.ms, r: x.r, k, bars, zOn, fOn });
  }
  events.sort((a, b) => a.at - b.at || b.r - a.r);
  const proc = ({ at, r, k, bars, zOn, fOn }) => {
    const b = bars[k];
    if (zOn) {
      applyClose(r, b.c, at);
      const p = k - L;
      if (p - L >= 0) {
        const x = bars[p], bt = Math.max(x.o, x.c), bb = Math.min(x.o, x.c);
        if (pivot(bars, p, L, true)) addZone(r, -1, x.h, Math.min(bt, x.h - thk), x.t);
        if (pivot(bars, p, L, false)) addZone(r, 1, Math.max(bb, x.l + thk), x.l, x.t);
      }
    }
    if (fOn && k >= 2) {
      const a = bars[k - 2];
      if (b.l > a.h) addGap(r, 1, b.l, a.h, bars[k - 1].t);
      if (b.h < a.l) addGap(r, -1, a.l, b.h, bars[k - 1].t);
    }
  };

  // dòng giá để đếm test và lấp FVG: nến chart, phần trước đó lấy từ khung lớn dần (chỉ nến đã đóng)
  let stream = closed(chart, chartMs), start = stream.length ? stream[0].t : Infinity;
  for (const s of series.sort((a, b) => a.ms - b.ms)) {
    if (s.ms === chartMs) continue;
    stream = s.bars.filter(b => b.t + s.ms <= start).concat(stream);
    if (s.bars.length) start = Math.min(start, s.bars[0].t);
  }
  let ei = 0;
  for (const b of stream) {
    while (ei < events.length && events[ei].at <= b.t) proc(events[ei++]);
    countTests(b); fillGaps(b);
  }
  while (ei < events.length) proc(events[ei++]);

  // nhãn hợp lưu: vùng lớn nhất trong cụm ghi đủ các khung; vùng nằm trong vùng khung lớn hơn chỉ ghi tên khung
  const overlaps = (a, b) => Math.max(a.bot, b.bot) <= Math.min(a.top, b.top);
  return {
    zones: zones.map(z => {
      const tfs = [];
      for (let r = 6; r >= 1; r--) if (zones.some(x => x.r === r && x.kind === z.kind && overlaps(x, z))) tfs.push(BY_R[r].name);
      const inner = tfs.some(n => SD_TFS.find(x => x.name === n).r > z.r);
      const strong = z.tests >= o.strongN, tail = (z.tests > 0 ? ` · test ${z.tests}` : "") + (strong ? " · mạnh" : "");
      const text = inner ? BY_R[z.r].name : `${kindTxt(z)} · ${tfs.length >= 2 ? tfs.join("+") : BY_R[z.r].name}${tail}`;
      return { r: z.r, kind: z.kind, top: z.top, bot: z.bot, tests: z.tests, flips: z.flips, strong, tfs, inner, text, segs: z.segs };
    }),
    gaps: gaps.map(g => ({ ...g })),
    opts: o,
  };
}

// vẽ vùng và FVG lên canvas. xOfT: thời điểm -> x; right: x của nến cuối (vùng kéo dài tới đó)
export function drawSD(ctx, sd, { xOfT, yOf, right, font }) {
  if (!sd) return;
  const o = sd.opts, rect = (xa, xb, top, bot) => [xa, yOf(top), Math.max(1, xb - xa), Math.max(1, yOf(bot) - yOf(top))];
  ctx.save(); ctx.font = font; ctx.textBaseline = "middle";
  for (const g of sd.gaps) {
    const t = BY_R[g.r], [x, y, w, h] = rect(xOfT(g.t0), right, g.top, g.bot);
    if (x + w < 0) continue;
    ctx.fillStyle = alpha(o.cFvg, 0.12); ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = alpha(o.cFvg, 0.6); ctx.lineWidth = t.width; ctx.setLineDash([5, 3]); ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]); ctx.fillStyle = o.cFvg; ctx.textAlign = "right"; ctx.fillText(`FVG · ${t.name}`, x + w - 3, y + h / 2);
  }
  // khung lớn vẽ trước, vùng khung nhỏ nằm trên
  for (const z of [...sd.zones].sort((a, b) => b.r - a.r)) {
    const t = BY_R[z.r];
    z.segs.forEach((s, i) => {
      const last = i === z.segs.length - 1, c = s.kind === 1 ? o.cDem : o.cSup;
      const top = last ? z.top : s.top, bot = last ? z.bot : s.bot, strong = last ? z.strong : s.strong;
      const [x, y, w, h] = rect(xOfT(s.t0), last ? right : xOfT(s.t1), top, bot);
      if (x + w < 0) return;
      ctx.fillStyle = alpha(c, (100 - t.transp + (strong ? 10 : 0)) / 100); ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = alpha(c, 0.7); ctx.lineWidth = t.width; ctx.setLineDash(t.dash || []);
      ctx.strokeRect(x + 0.5, y + 0.5, w, h); ctx.setLineDash([]);
      if (!last) return; // chỉ đoạn mới nhất có chữ
      ctx.fillStyle = c; ctx.textAlign = z.inner ? "left" : "right";
      ctx.fillText(z.text, z.inner ? Math.max(x, 0) + 3 : x + w - 3, y + h / 2);
    });
  }
  ctx.restore();
}

// chữ khi rê chuột vào vùng (vùng khung nhỏ nhất chứa điểm đó)
export function sdTip(sd, y, yOf, dec) {
  if (!sd) return null;
  const f = v => v.toFixed(dec);
  const z = sd.zones.filter(z => y >= yOf(z.top) - 2 && y <= yOf(z.bot) + 2).sort((a, b) => a.r - b.r)[0];
  if (z) {
    const role = z.kind === 1 ? "Demand (vùng cầu, đỡ giá)" : "Supply (vùng cung, cản giá)";
    return `${role} khung ${BY_R[z.r].vn} ${f(z.bot)} – ${f(z.top)}` +
      (z.flips ? `, đã đổi vai từ ${z.kind === 1 ? "Supply" : "Demand"} (bị phá lần nữa sẽ xoá)` : "") +
      `: bị test ${z.tests} lần${z.strong ? ", vùng mạnh" : ""}.` +
      (z.tfs.length >= 2 ? ` Hợp lưu các khung ${z.tfs.join(" + ")}.` : "");
  }
  const g = sd.gaps.filter(g => y >= yOf(g.top) - 2 && y <= yOf(g.bot) + 2).sort((a, b) => a.r - b.r)[0];
  if (g) return `FVG ${g.dir === 1 ? "tăng (khoảng trống đỡ giá)" : "giảm (khoảng trống cản giá)"} khung ${BY_R[g.r].vn} ${f(g.bot)} – ${f(g.top)}: giá lấp ${sd.opts.half ? "tới 50%" : "hết"} thì xoá.`;
  return null;
}
