// Lai Long Web: kiểm tra độ bền của một chiến lược.
// Cùng thông số, chạy trên nhiều coin, chia thời gian thành nhiều đoạn liên tiếp và tách theo
// trạng thái thị trường (lên, xuống, đi ngang). Lợi thế thật phải còn ở hầu hết các phần,
// không chỉ nhờ một coin hay một giai đoạn may mắn.
import { tradeStats, splitTrades } from "./backtest.js?v=202610141840";

export const REGIMES = [["up", "Thị trường lên"], ["down", "Thị trường xuống"], ["flat", "Đi ngang"]];

// Trạng thái thị trường tại từng nến, chỉ dùng các nến đã qua (không nhìn trước).
// Hiệu suất xu hướng ER = |giá đóng cửa hiện tại − L nến trước| / tổng quãng đường đi trong L nến.
// ER ≥ ngưỡng: đang có xu hướng (lên hoặc xuống theo dấu); thấp hơn: đi ngang.
export function regimes(bars, L = 50, thr = 0.3) {
  const out = new Array(bars.length).fill(null);
  let path = 0;
  for (let i = 1; i < bars.length; i++) {
    path += Math.abs(bars[i].c - bars[i - 1].c);
    if (i > L) path -= Math.abs(bars[i - L].c - bars[i - L - 1].c);
    if (i < L) continue;
    const move = bars[i].c - bars[i - L].c, er = path > 0 ? Math.abs(move) / path : 0;
    out[i] = er < thr ? "flat" : move > 0 ? "up" : "down";
  }
  return out;
}

const pos = st => st.n > 0 && st.avgR > 0;

// sets: [{symbol, bars, trades}]; trades lấy từ simulate (mỗi lệnh có i, t)
export function robustness(sets, { segments = 5, leg = 2, riskPct = 1, minCell = 5 } = {}) {
  const ok = sets.filter(s => s.bars.length);
  const t0 = Math.min(...ok.map(s => s.bars[0].t)), t1 = Math.max(...ok.map(s => s.bars[s.bars.length - 1].t));
  const K = Math.max(1, Math.round(segments)), w = (t1 - t0) / K || 1;
  const segOf = t => Math.min(K - 1, Math.max(0, Math.floor((t - t0) / w)));
  const segs = Array.from({ length: K }, (_, k) => ({ from: t0 + k * w, to: t0 + (k + 1) * w, trades: [] }));
  const reg = Object.fromEntries(REGIMES.map(([k]) => [k, []]));
  const all = [], coins = [];
  for (const s of ok) {
    const rg = regimes(s.bars), cells = Array.from({ length: K }, () => []);
    for (const tr of s.trades) {
      const k = segOf(tr.t); cells[k].push(tr); segs[k].trades.push(tr); all.push(tr);
      const r = rg[tr.i]; if (r) reg[r].push(tr);
    }
    const sp = splitTrades(s.trades, s.bars);
    coins.push({
      symbol: s.symbol, bars: s.bars.length, from: s.bars[0].t, to: s.bars[s.bars.length - 1].t,
      st: tradeStats(s.trades, leg, riskPct), oos: tradeStats(sp.oos, leg, riskPct),
      cells: cells.map(c => tradeStats(c, leg, riskPct)),
    });
  }
  const byTime = a => a.slice().sort((x, y) => x.t - y.t);
  const pooled = tradeStats(byTime(all), leg, riskPct);
  const segStats = segs.map(g => ({ from: g.from, to: g.to, st: tradeStats(byTime(g.trades), leg, riskPct) }));
  const regStats = REGIMES.map(([k, name]) => ({ key: k, name, st: tradeStats(byTime(reg[k]), leg, riskPct) }));

  // ba điều kiện của một lợi thế bền
  const coinsUsed = coins.filter(c => c.st.n >= minCell), segsUsed = segStats.filter(g => g.st.n >= minCell), regUsed = regStats.filter(g => g.st.n >= minCell);
  const share = a => a.length ? a.filter(x => pos(x.st)).length / a.length : 0;
  const checks = [
    { ok: pooled.n >= 30 && pooled.ci.lo > 0, txt: `Gộp tất cả ${pooled.n} lệnh: cận dưới kỳ vọng 95% ${pooled.n ? (pooled.ci.lo >= 0 ? "+" : "") + pooled.ci.lo.toFixed(2) + "R" : "-"} (cần trên 0 và ít nhất 30 lệnh)` },
    { ok: coinsUsed.length >= 2 && share(coinsUsed) >= 2 / 3, txt: `Coin có kỳ vọng dương: ${coinsUsed.filter(x => pos(x.st)).length}/${coinsUsed.length} (cần ít nhất 2/3, chỉ tính coin có từ ${minCell} lệnh)` },
    { ok: segsUsed.length >= 2 && share(segsUsed) >= 2 / 3, txt: `Đoạn thời gian có kỳ vọng dương: ${segsUsed.filter(x => pos(x.st)).length}/${segsUsed.length} (cần ít nhất 2/3)` },
  ];
  const regNote = regUsed.length ? regUsed.filter(x => pos(x.st)).map(x => x.name.toLowerCase()) : [];
  const nOk = checks.filter(c => c.ok).length;
  const verdict = pooled.n < 30 ? { txt: "Chưa đủ lệnh để kết luận", cls: "" }
    : nOk === 3 ? { txt: "Lợi thế bền", cls: "pos" }
    : pooled.ci.hi < 0 ? { txt: "Lỗ ở hầu hết mọi nơi", cls: "neg" }
    : checks[0].ok || pooled.avgR > 0 ? { txt: "Có dấu hiệu nhưng chưa bền", cls: "" }
    : { txt: "Không có lợi thế bền", cls: "neg" };
  return { coins, segs: segStats, regimes: regStats, pooled, checks, verdict, regNote, K };
}
