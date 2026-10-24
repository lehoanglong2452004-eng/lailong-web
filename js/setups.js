// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: luật vào/ra cho 2 setup của Radar và thống kê sau phí.
//
// Đánh thức (theo hướng): khối lượng lớn giữa lúc nhàm chán. Chờ xác nhận: trong 3 nến sau, một nến đóng cửa vượt
//   đỉnh (đáy) của nến sự kiện theo hướng sự kiện. Vào lệnh ở giá mở cửa nến kế tiếp.
//   Cắt lỗ: đáy (đỉnh) của nến sự kiện thêm 0,25 ATR, tối thiểu 0,5 ATR.
// Cạn khối lượng (đánh ngược): xu hướng hết lửa. Chờ xác nhận: trong 6 nến sau, một nến đóng cửa thủng đáy (vượt đỉnh)
//   của nến trước nó, ngược xu hướng. Vào lệnh ở giá mở cửa nến kế tiếp.
//   Cắt lỗ: đỉnh (đáy) cao nhất từ lúc sự kiện tới lúc vào, thêm 0,25 ATR, tối thiểu 0,5 ATR.
// Cả hai: chốt lời ở 2R, hết maxBars nến mà chưa chạm thì đóng ở giá đóng cửa. Nến chạm cả cắt lỗ lẫn chốt lời
// thì tính là cắt lỗ (giả định xấu nhất). Một setup chỉ giữ một lệnh mỗi lúc.
// Chi phí: phí taker hai chiều cộng trượt giá hai chiều, đổi ra R theo khoảng cắt lỗ của từng lệnh.
import { equityStats } from "./fractal.js?v=202610240622";

export const SETUPS = {
  wake: { name: "Đánh thức", mode: "follow", confirm: 3, tip: "Theo hướng khối lượng bất thường xuất hiện giữa lúc nhàm chán, sau khi giá xác nhận bằng một nến đóng cửa vượt nến sự kiện" },
  drought: { name: "Cạn khối lượng", mode: "fade", confirm: 6, tip: "Đánh ngược xu hướng đã hết lửa, sau khi giá xác nhận bằng một nến đóng cửa thủng nến trước nó" },
};
export const RULE_DEF = { tp: 2, maxBars: 24, fee: 0.05, slip: 2, riskPct: 1 };

export function trades(bars, items, setup, cfg = {}) {
  const P = { ...RULE_DEF, ...cfg }, S = SETUPS[setup], out = [];
  const cost = (P.fee / 100 + P.slip / 1e4) * 2;
  let busyUntil = -1;
  for (const e of items) {
    if (e.type !== setup || e.i <= busyUntil) continue;
    const A = e.atr, d = S.mode === "follow" ? e.dir : -e.dir, ev = bars[e.i];
    let j = -1;
    for (let k = e.i + 1; k <= Math.min(bars.length - 2, e.i + S.confirm); k++) {
      const b = bars[k];
      const ok = S.mode === "follow" ? (d > 0 ? b.c > ev.h : b.c < ev.l) : (d > 0 ? b.c > bars[k - 1].h : b.c < bars[k - 1].l);
      if (ok) { j = k; break; }
    }
    if (j < 0) continue;
    const ei = j + 1, entry = bars[ei].o;
    let stop;
    if (S.mode === "follow") stop = d > 0 ? ev.l - 0.25 * A : ev.h + 0.25 * A;
    else { const seg = bars.slice(e.i, j + 1); stop = d > 0 ? Math.min(...seg.map(b => b.l)) - 0.25 * A : Math.max(...seg.map(b => b.h)) + 0.25 * A; }
    if ((entry - stop) * d < 0.5 * A) stop = entry - d * 0.5 * A;
    const risk = Math.abs(entry - stop), target = entry + d * P.tp * risk;
    let exit = null, xi = null, why = "time";
    for (let k = ei; k < Math.min(bars.length, ei + P.maxBars); k++) {
      const b = bars[k], hitS = d > 0 ? b.l <= stop : b.h >= stop, hitT = d > 0 ? b.h >= target : b.l <= target;
      if (hitS) { exit = stop; xi = k; why = "stop"; break; }
      if (hitT) { exit = target; xi = k; why = "target"; break; }
    }
    if (exit == null) { if (ei + P.maxBars > bars.length) continue; xi = ei + P.maxBars - 1; exit = bars[xi].c; } // chưa đủ nến thì bỏ (lệnh còn mở)
    const gross = (exit - entry) * d / risk, costR = entry * cost / risk;
    out.push({ setup, t: bars[ei].t, i: ei, xi, dir: d, entry, stop, target, exit, why, gross, costR, R: gross - costR, e });
    busyUntil = xi;
  }
  return out;
}

export function setupStats(list, riskPct = RULE_DEF.riskPct) {
  const st = equityStats(list.map(x => x.R), riskPct), g = equityStats(list.map(x => x.gross), riskPct);
  const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
  return { ...st, grossAvgR: g.avgR, costR: mean(list.map(x => x.costR)), byWhy: { target: list.filter(x => x.why === "target").length, stop: list.filter(x => x.why === "stop").length, time: list.filter(x => x.why === "time").length } };
}
