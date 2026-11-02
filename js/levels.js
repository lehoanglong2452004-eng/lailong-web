// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bản đồ mức giá hợp lưu. Gom mọi mức giá quan trọng của một tài sản (hồ sơ khối lượng, TPO,
// đỉnh/đáy hôm qua, hỗ trợ/kháng cự đã test, quyền chọn, cụm thanh lý, tường lệnh, iceberg) rồi nhóm các mức
// nằm sát nhau thành vùng. Nhiều nguồn trùng một vùng thì vùng đó có điểm hợp lưu cao.
// Phần lịch sử: tại đầu mỗi ngày dựng lại các mức đã biết lúc đó (chỉ những nguồn tính được từ nến), rồi ghi
// lại lần đầu giá chạm từng vùng trong ngày, để sổ tín hiệu chấm xem vùng điểm cao có bật lại nhiều hơn không.
import { volumeProfile, srLevels } from "./analytics.js?v=202610300405";
import { atrSeries } from "./flowtools.js?v=202610300405";

const DAY = 864e5;

// trọng số từng loại nguồn (điểm hợp lưu = tổng trọng số các nguồn trong vùng)
export const KINDS = {
  poc: { name: "POC hôm qua", w: 2 }, vah: { name: "VAH hôm qua", w: 1.5 }, val: { name: "VAL hôm qua", w: 1.5 },
  pdh: { name: "Đỉnh hôm qua", w: 1.5 }, pdl: { name: "Đáy hôm qua", w: 1.5 }, naked: { name: "POC chưa chạm", w: 2 },
  wpoc: { name: "POC tuần", w: 1.5 }, hvn: { name: "Nút khối lượng lớn", w: 1 },
  sr: { name: "Hỗ trợ/kháng cự đã test", w: 1 }, vwap: { name: "VWAP ngày", w: 1 },
  callWall: { name: "Tường call", w: 2 }, putWall: { name: "Tường put", w: 2 }, flip: { name: "Điểm lật gamma", w: 2 }, maxPain: { name: "Max pain", w: 1 },
  liq: { name: "Cụm thanh lý ước tính", w: 1.5 }, wall: { name: "Tường lệnh đang đứng", w: 1.5 }, ice: { name: "Iceberg", w: 1.5 },
};
export const BUCKETS = [
  { id: "zone.s1", name: "Chạm vùng 1 nguồn", min: 0, max: 2.5 },
  { id: "zone.s2", name: "Chạm vùng hợp lưu 2,5–4,5 điểm", min: 2.5, max: 5 },
  { id: "zone.s3", name: "Chạm vùng hợp lưu từ 5 điểm", min: 5, max: Infinity },
];
export const bucketOf = score => BUCKETS.find(b => score >= b.min && score < b.max);

// sources: [{kind, price, w?, label?}] → vùng {lo, hi, mid, score, items}; tol: khoảng gộp (giá)
export function zones(sources, tol) {
  const src = sources.filter(s => s.price > 0 && isFinite(s.price)).sort((a, b) => a.price - b.price);
  const out = [];
  for (const s of src) {
    const w = s.w ?? (KINDS[s.kind] ? KINDS[s.kind].w : 1), z = out[out.length - 1];
    if (z && s.price - z.lo <= tol * 2 && s.price - z.hi <= tol) { z.items.push({ ...s, w }); z.hi = Math.max(z.hi, s.price); }
    else out.push({ lo: s.price, hi: s.price, items: [{ ...s, w }] });
  }
  for (const z of out) {
    // mỗi loại nguồn chỉ tính một lần trong vùng (hai mức SR sát nhau không nhân đôi điểm)
    const best = new Map(); for (const it of z.items) best.set(it.kind, Math.max(best.get(it.kind) || 0, it.w));
    z.score = [...best.values()].reduce((a, x) => a + x, 0);
    z.mid = (z.lo + z.hi) / 2; z.lo -= tol / 2; z.hi += tol / 2;
    z.kinds = [...best.keys()];
  }
  return out;
}

// các mức tính được từ nến, biết tại đầu ngày d (chỉ dùng nến trước ngày đó)
export function dailySources(byDay, d, { srBars = null } = {}) {
  const out = [], prev = byDay.get(d - 1);
  if (prev && prev.length) {
    const p = volumeProfile(prev);
    if (p.poc != null) out.push({ kind: "poc", price: p.poc }, { kind: "vah", price: p.vah }, { kind: "val", price: p.val });
    for (const x of p.hvn.slice(0, 3)) out.push({ kind: "hvn", price: x });
    out.push({ kind: "pdh", price: Math.max(...prev.map(b => b.h)) }, { kind: "pdl", price: Math.min(...prev.map(b => b.l)) });
  }
  // POC tuần (7 ngày trước) và POC của 5 ngày gần nhất chưa bị giá chạm lại
  const week = []; for (let k = 1; k <= 7; k++) { const bs = byDay.get(d - k); if (bs) week.push(...bs); }
  if (week.length) { const p = volumeProfile(week); if (p.poc != null) out.push({ kind: "wpoc", price: p.poc }); }
  for (let k = 2; k <= 6; k++) {
    const bs = byDay.get(d - k); if (!bs || !bs.length) continue;
    const poc = volumeProfile(bs).poc; if (poc == null) continue;
    let hit = false; for (let j = k - 1; j >= 1 && !hit; j--) for (const b of byDay.get(d - j) || []) if (b.l <= poc && b.h >= poc) { hit = true; break; }
    if (!hit) out.push({ kind: "naked", price: poc });
  }
  if (srBars && srBars.length > 40) for (const lv of srLevels(srBars, { maxLevels: 8 })) if (!lv.broken) out.push({ kind: "sr", price: lv.price, w: 0.5 + (lv.strength || 50) / 100 });
  return out;
}

export function groupDays(bars) {
  const m = new Map();
  for (const b of bars) { const d = Math.floor(b.t / DAY); if (!m.has(d)) m.set(d, []); m.get(d).push(b); }
  return m;
}

// sự kiện "giá chạm vùng" trong lịch sử: lần đầu mỗi vùng bị chạm trong ngày, hướng là bật ngược lại
// (giá đi từ trên xuống chạm vùng thì hướng +1, từ dưới lên thì -1); trả về [{sig, i, t, dir, price, score}]
export function touchEvents(bars, { tolAtr = 0.25 } = {}) {
  const byDay = groupDays(bars), atr = atrSeries(bars), ev = [];
  const idx = new Map(bars.map((b, i) => [b.t, i]));
  for (const [d, bs] of byDay) {
    if (!byDay.has(d - 1)) continue;
    const i0 = idx.get(bs[0].t), A = atr[i0 - 1];
    if (!(A > 0)) continue;
    const srBars = bars.slice(Math.max(0, i0 - 300), i0);
    const zs = zones(dailySources(byDay, d, { srBars }), tolAtr * A), done = new Set();
    for (let k = 0; k < bs.length; k++) {
      const i = i0 + k, b = bars[i], pc = bars[i - 1].c;
      zs.forEach((z, zi) => {
        if (done.has(zi) || b.l > z.hi || b.h < z.lo) return;
        done.add(zi);
        if (pc >= z.lo && pc <= z.hi) return; // mở ngày ngay trong vùng: không tính là chạm
        const bk = bucketOf(z.score);
        ev.push({ sig: bk.id, i, t: b.t, dir: pc > z.hi ? 1 : -1, price: pc > z.hi ? z.hi : z.lo, score: z.score, kinds: z.kinds });
      });
    }
  }
  return ev;
}

// vùng hợp lưu hiện tại: nguồn từ nến (như lịch sử) cộng các nguồn trực tiếp (quyền chọn, thanh lý, tường, iceberg)
export function liveZones(bars, live = [], { tolAtr = 0.25 } = {}) {
  if (bars.length < 30) return [];
  const byDay = groupDays(bars), d = Math.floor(bars[bars.length - 1].t / DAY), A = atrSeries(bars).at(-1);
  if (!(A > 0)) return [];
  const today = byDay.get(d) || [];
  const src = dailySources(byDay, d, { srBars: bars.slice(-300) });
  if (today.length) {
    let pv = 0, v = 0; for (const b of today) { const tp = (b.h + b.l + b.c) / 3; pv += tp * b.v; v += b.v; }
    if (v > 0) src.push({ kind: "vwap", price: pv / v });
  }
  const price = bars[bars.length - 1].c;
  return zones([...src, ...live], tolAtr * A).map(z => ({ ...z, dist: (z.mid - price) / A })).sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
}

// vẽ vùng hợp lưu (điểm ≥ 3) lên biểu đồ: dải màu vàng, càng nhiều điểm càng đậm; dùng chung cho Bookmap và footprint
export const CONFL_MIN = 3;
const CONFL_COL = "245,165,36";
export function drawConfl(ctx, zs, yOf, pw, ph, font) {
  for (const z of zs || []) {
    if (z.score < CONFL_MIN) continue;
    let ya = yOf(z.hi), yb = yOf(z.lo); if (yb < 0 || ya > ph) continue;
    if (yb - ya < 3) { const m = (ya + yb) / 2; ya = m - 1.5; yb = m + 1.5; }
    const a = Math.min(0.32, 0.06 + z.score * 0.03);
    ctx.fillStyle = `rgba(${CONFL_COL},${a.toFixed(2)})`; ctx.fillRect(0, ya, pw, yb - ya);
    ctx.strokeStyle = `rgba(${CONFL_COL},0.7)`; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(0, Math.round(ya) + 0.5); ctx.lineTo(pw, Math.round(ya) + 0.5); ctx.moveTo(0, Math.round(yb) + 0.5); ctx.lineTo(pw, Math.round(yb) + 0.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = font; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = `rgba(${CONFL_COL},1)`;
    ctx.fillText(`Hợp lưu ${z.score.toFixed(1)}đ`, 6, Math.max(10, ya - 2));
  }
}
export function conflTip(zs, y, yOf, dec) {
  for (const z of zs || []) {
    if (z.score < CONFL_MIN) continue;
    const ya = yOf(z.hi), yb = yOf(z.lo);
    if (y >= Math.min(ya, (ya + yb) / 2 - 2) && y <= Math.max(yb, (ya + yb) / 2 + 2)) return `Vùng hợp lưu ${z.lo.toFixed(dec)}–${z.hi.toFixed(dec)}, ${z.score.toFixed(1)} điểm: ${z.kinds.map(k => (KINDS[k] ? KINDS[k].name : k)).join(", ")}. Càng nhiều nguồn trùng nhau, giá càng hay phản ứng ở đây; xem tỷ lệ bật lại đã kiểm chứng ở tab Tín hiệu.`;
  }
  return null;
}
