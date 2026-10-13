// Backtest đơn giản cho chiến lược order-flow. Tín hiệu tại nến i chỉ dùng nến 0..i,
// vào lệnh ở giá mở nến i+1. Một vị thế tại một thời điểm.
import { atr, barDelta, volumeZ, pivots, vwapSeries } from './analytics.js?v=202610132110';

const MS_PER_YEAR = 365 * 24 * 3600 * 1000;

// Mỗi chiến lược: {name, description, params, prepare(bars, p) -> signal(i)}
// signal(i) trả null hoặc {side: 'long'|'short', stop, rr, maxHold}.
export const STRATEGIES = {
  volBreakout: {
    name: 'Phá vỡ vùng khối lượng bất thường',
    description: 'Khi một nến có khối lượng đột biến và đóng cửa vượt đỉnh/đáy gần nhất theo hướng dòng tiền chủ động, vào lệnh theo hướng đó ở nến kế tiếp. Cắt lỗ ở phía bên kia của nến đột biến.',
    params: [
      { key: 'zThreshold', label: 'Ngưỡng z khối lượng', default: 2.5, min: 1, max: 6, step: 0.1 },
      { key: 'lookback', label: 'Số nến tính z', default: 50, min: 10, max: 500, step: 1 },
      { key: 'range', label: 'Số nến tìm đỉnh/đáy', default: 20, min: 2, max: 200, step: 1 },
      { key: 'atrBuffer', label: 'Đệm cắt lỗ (x ATR)', default: 0.2, min: 0, max: 3, step: 0.05 },
      { key: 'rr', label: 'Tỉ lệ lời/lỗ (R)', default: 2, min: 0.5, max: 10, step: 0.1 },
      { key: 'maxHold', label: 'Giữ tối đa (nến)', default: 24, min: 1, max: 1000, step: 1 },
    ],
    prepare(bars, p) {
      const a = atr(bars, 14);
      const z = volumeZ(bars, p.lookback);
      const R = Math.max(1, Math.round(p.range));
      return (i) => {
        if (i < R || !(z[i] >= p.zThreshold) || !(a[i] > 0)) return null;
        const b = bars[i];
        let hh = -Infinity, ll = Infinity;
        for (let k = i - R; k < i; k++) { if (bars[k].h > hh) hh = bars[k].h; if (bars[k].l < ll) ll = bars[k].l; }
        const d = barDelta(b);
        if (d > 0 && b.c > hh) return { side: 'long', stop: b.l - p.atrBuffer * a[i] };
        if (d < 0 && b.c < ll) return { side: 'short', stop: b.h + p.atrBuffer * a[i] };
        return null;
      };
    },
  },
  srRetest: {
    name: 'Test lại hỗ trợ/kháng cự',
    description: 'Khi giá phá một vùng hỗ trợ/kháng cự rồi quay lại test và bị đẩy đi tiếp, vào lệnh theo hướng phá vỡ. Chế độ bật lại: vùng chạm nhiều lần chưa thủng bị chạm râu và đóng ngược lại thì vào lệnh đảo chiều.',
    // mode: 0 = cả hai, 1 = chỉ test lại sau phá vỡ, 2 = chỉ bật lại
    params: [
      { key: 'mode', label: 'Chế độ (0=cả hai, 1=test lại, 2=bật lại)', default: 0, min: 0, max: 2, step: 1 },
      { key: 'pivotLen', label: 'Độ rộng pivot (nến mỗi bên)', default: 5, min: 2, max: 30, step: 1 },
      { key: 'tolAtr', label: 'Dung sai vùng (x ATR)', default: 0.3, min: 0.05, max: 2, step: 0.05 },
      { key: 'retestBars', label: 'Số nến chờ test lại', default: 10, min: 1, max: 100, step: 1 },
      { key: 'minTouches', label: 'Số lần chạm tối thiểu (bật lại)', default: 2, min: 1, max: 10, step: 1 },
      { key: 'stopAtr', label: 'Cắt lỗ sau vùng (x ATR)', default: 0.5, min: 0.05, max: 5, step: 0.05 },
      { key: 'rr', label: 'Tỉ lệ lời/lỗ (R)', default: 2, min: 0.5, max: 10, step: 0.1 },
      { key: 'maxHold', label: 'Giữ tối đa (nến)', default: 48, min: 1, max: 1000, step: 1 },
    ],
    prepare(bars, p) {
      const a = atr(bars, 14);
      const L = Math.max(1, Math.round(p.pivotLen));
      // pivot chỉ được dùng từ nến knownAt trở đi => không nhìn trước
      const pv = pivots(bars, L, L).sort((x, y) => x.knownAt - y.knownAt);
      const mode = Math.round(p.mode);
      const useRetest = mode === 0 || mode === 1;
      const useBounce = mode === 0 || mode === 2;
      const MAX_LEVELS = 40;
      let levels = [];
      let pi = 0;
      return (i) => {
        const b = bars[i];
        const ai = a[i];
        // thêm pivot vừa được xác nhận
        while (pi < pv.length && pv[pi].knownAt <= i) {
          const q = pv[pi++];
          if (!(ai > 0)) continue;
          const tol = p.tolAtr * ai;
          const lv = levels.find((x) => Math.abs(x.price - q.price) <= tol);
          if (lv) {
            lv.sum += q.price; lv.touches++; lv.price = lv.sum / lv.touches; lv.lastI = q.i;
          } else {
            levels.push({ price: q.price, sum: q.price, touches: 1, side: b.c > q.price ? 1 : -1,
              broken: false, breakIdx: -1, breakDir: 0, used: false, lastI: q.i });
            if (levels.length > MAX_LEVELS) levels = levels.slice(-MAX_LEVELS);
          }
        }
        if (!(ai > 0)) return null;
        const tol = p.tolAtr * ai;
        let best = null;
        for (const lv of levels) {
          const P = lv.price;
          // phá vỡ: đóng cửa vượt quá dung sai
          if (lv.side === -1 && b.c > P + tol) {
            lv.side = 1; lv.broken = true; lv.breakIdx = i; lv.breakDir = 1; lv.used = false; continue;
          }
          if (lv.side === 1 && b.c < P - tol) {
            lv.side = -1; lv.broken = true; lv.breakIdx = i; lv.breakDir = -1; lv.used = false; continue;
          }
          let sig = null;
          if (useRetest && lv.broken && !lv.used && i > lv.breakIdx && i - lv.breakIdx <= p.retestBars) {
            if (lv.breakDir === 1 && b.l <= P + tol && b.c > P) sig = { side: 'long', stop: P - p.stopAtr * ai };
            if (lv.breakDir === -1 && b.h >= P - tol && b.c < P) sig = { side: 'short', stop: P + p.stopAtr * ai };
          }
          if (!sig && useBounce && !lv.broken && lv.touches >= p.minTouches) {
            if (lv.side === 1 && b.l <= P + tol && b.c > P) sig = { side: 'long', stop: P - p.stopAtr * ai };
            if (lv.side === -1 && b.h >= P - tol && b.c < P) sig = { side: 'short', stop: P + p.stopAtr * ai };
          }
          if (sig && (!best || lv.touches > best.touches)) best = { ...sig, touches: lv.touches, lv };
        }
        if (!best) return null;
        if (best.lv.broken) best.lv.used = true;
        return { side: best.side, stop: best.stop };
      };
    },
  },
  vwapTouch: {
    name: 'VWAP làm hỗ trợ/kháng cự',
    description: 'Giá chạm VWAP rồi bị đẩy lại thì vào lệnh đảo chiều (bật lại), hoặc đóng cửa xuyên qua VWAP thì vào lệnh theo hướng phá vỡ. Kèm bảng thống kê mỗi lần chạm VWAP giá bật lại hay xuyên qua.',
    // anchor: 0 = VWAP ngày, 1 = VWAP tuần, 2 = VWAP cuộn N nến; mode: 0 = bật lại, 1 = phá vỡ, 2 = cả hai
    params: [
      { key: 'anchor', label: 'VWAP (0=ngày, 1=tuần, 2=cuộn)', default: 0, min: 0, max: 2, step: 1 },
      { key: 'rollLen', label: 'Số nến VWAP cuộn', default: 96, min: 5, max: 2000, step: 1 },
      { key: 'mode', label: 'Chế độ (0=bật lại, 1=phá vỡ, 2=cả hai)', default: 0, min: 0, max: 2, step: 1 },
      { key: 'tolAtr', label: 'Dung sai chạm (x ATR)', default: 0.2, min: 0, max: 2, step: 0.05 },
      { key: 'stopAtr', label: 'Cắt lỗ sau VWAP (x ATR)', default: 0.6, min: 0.05, max: 5, step: 0.05 },
      { key: 'rr', label: 'Tỉ lệ lời/lỗ (R)', default: 2, min: 0.5, max: 10, step: 0.1 },
      { key: 'maxHold', label: 'Giữ tối đa (nến)', default: 24, min: 1, max: 1000, step: 1 },
    ],
    vwap(bars, p) { return vwapSeries(bars, { anchor: ['day', 'week', 'rolling'][Math.round(p.anchor)] || 'day', len: Math.round(p.rollLen) }); },
    prepare(bars, p) {
      const a = atr(bars, 14), w = this.vwap(bars, p), mode = Math.round(p.mode);
      return (i) => {
        if (i < 1 || !(a[i] > 0)) return null;
        const b = bars[i], prev = bars[i - 1], tol = p.tolAtr * a[i], wi = w[i], wp = w[i - 1];
        const above = prev.c > wp + tol, below = prev.c < wp - tol;
        if (mode !== 1) { // bật lại: râu chạm VWAP, đóng cửa quay về phía cũ
          if (above && b.l <= wi + tol && b.c > wi) return { side: 'long', stop: Math.min(b.l, wi) - p.stopAtr * a[i] };
          if (below && b.h >= wi - tol && b.c < wi) return { side: 'short', stop: Math.max(b.h, wi) + p.stopAtr * a[i] };
        }
        if (mode !== 0) { // phá vỡ: đóng cửa xuyên qua VWAP quá dung sai
          if (above && b.c < wi - tol) return { side: 'short', stop: wi + p.stopAtr * a[i] };
          if (below && b.c > wi + tol) return { side: 'long', stop: wi - p.stopAtr * a[i] };
        }
        return null;
      };
    },
  },
};

export function defaultParams(strategyId) {
  const s = STRATEGIES[strategyId];
  const out = {};
  for (const p of s?.params || []) out[p.key] = p.default;
  return out;
}

function inferInterval(bars) {
  const d = [];
  for (let i = 1; i < Math.min(bars.length, 50); i++) d.push(bars[i].t - bars[i - 1].t);
  d.sort((x, y) => x - y);
  return d.length ? d[d.length >> 1] : 60000;
}

// Thống kê từ danh sách lệnh và đường vốn
export function computeStats(trades, equity, capital, intervalMs, barsInPos = 0) {
  const n = trades.length;
  const finalEq = equity.length ? equity[equity.length - 1].eq : capital;
  const wins = trades.filter((t) => t.pnl > 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = -trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0);
  let peak = -Infinity, mdd = 0;
  for (const e of equity) {
    if (e.eq > peak) peak = e.eq;
    if (peak > 0) mdd = Math.max(mdd, (peak - e.eq) / peak * 100);
  }
  const rets = [];
  for (let i = 1; i < equity.length; i++) if (equity[i - 1].eq > 0) rets.push(equity[i].eq / equity[i - 1].eq - 1);
  let sharpe = 0;
  if (rets.length > 1) {
    const m = rets.reduce((s, x) => s + x, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((s, x) => s + (x - m) ** 2, 0) / (rets.length - 1));
    sharpe = sd > 0 ? (m / sd) * Math.sqrt(MS_PER_YEAR / (intervalMs || 60000)) : 0;
  }
  return {
    netProfit: finalEq - capital,
    netPct: (finalEq / capital - 1) * 100,
    trades: n,
    winRate: n ? (wins.length / n) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
    avgR: n ? trades.reduce((s, t) => s + t.r, 0) / n : 0,
    expectancy: n ? trades.reduce((s, t) => s + t.pnl, 0) / n : 0,
    maxDrawdownPct: mdd,
    sharpe,
    avgBars: n ? trades.reduce((s, t) => s + t.bars, 0) / n : 0,
    longs: trades.filter((t) => t.side === 'long').length,
    shorts: trades.filter((t) => t.side === 'short').length,
    bestTrade: n ? Math.max(...trades.map((t) => t.pnl)) : 0,
    worstTrade: n ? Math.min(...trades.map((t) => t.pnl)) : 0,
    exposurePct: equity.length ? (barsInPos / equity.length) * 100 : 0,
  };
}

// strategyId: khoá trong STRATEGIES, hoặc trực tiếp một object có prepare() (dùng cho test).
// signal có thể kèm rr/maxHold riêng; mặc định lấy từ params.
export function runBacktest(bars, strategyId, params = {}, {
  capital = 10000, riskPct = 1, maxLeverage = 20, feeRate = 0.0005, slippageBps = 2, intervalMs,
} = {}) {
  const strat = typeof strategyId === 'object' ? strategyId : STRATEGIES[strategyId];
  if (!strat) throw new Error('Không có chiến lược: ' + strategyId);
  const p = { ...(typeof strategyId === 'string' ? defaultParams(strategyId) : {}), ...params };
  const n = bars?.length || 0;
  const iv = intervalMs || (n > 1 ? inferInterval(bars) : 60000);
  const trades = [], equity = [];
  if (!n) return { trades, equity, stats: computeStats(trades, equity, capital, iv) };
  const signal = strat.prepare(bars, p);
  const slip = slippageBps / 10000;
  let cash = capital;
  let pos = null; // {dir, side, entryIdx, entryPx, qty, stop, tp, maxHold, fees, risk, eq0}
  let pending = null;
  let barsInPos = 0;

  const close = (i, px, reason) => {
    const fee = pos.qty * px * feeRate;
    const gross = pos.dir * pos.qty * (px - pos.entryPx);
    cash += gross - fee;
    const fees = pos.fees + fee;
    const pnl = gross - fees;
    trades.push({
      side: pos.side, entryT: bars[pos.entryIdx].t, entryPx: pos.entryPx, exitT: bars[i].t, exitPx: px,
      qty: pos.qty, notional: pos.qty * pos.entryPx, pnl, pnlPct: (pnl / pos.eq0) * 100,
      r: pnl / (pos.qty * pos.risk), fees, reason, bars: i - pos.entryIdx + 1,
    });
    pos = null;
  };

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // vào lệnh chờ ở giá mở nến i
    if (pending && !pos) {
      const dir = pending.side === 'long' ? 1 : -1;
      const entryPx = b.o * (1 + dir * slip);
      const risk = dir * (entryPx - pending.stop);
      if (risk > 0 && cash > 0) {
        let qty = (cash * riskPct / 100) / risk;
        qty = Math.min(qty, (cash * maxLeverage) / entryPx);
        const fee = qty * entryPx * feeRate;
        const rr = pending.rr ?? p.rr ?? 2;
        pos = {
          dir, side: pending.side, entryIdx: i, entryPx, qty, stop: pending.stop,
          tp: entryPx + dir * rr * risk, maxHold: Math.max(1, Math.round(pending.maxHold ?? p.maxHold ?? 24)),
          fees: fee, risk, eq0: cash,
        };
        cash -= fee;
      }
      pending = null;
    }
    // kiểm tra thoát trong nến: SL ưu tiên trước TP
    if (pos) {
      barsInPos++;
      const { dir, stop, tp } = pos;
      const hitSL = dir === 1 ? b.l <= stop : b.h >= stop;
      const hitTP = dir === 1 ? b.h >= tp : b.l <= tp;
      if (hitSL) {
        // gap qua stop thì khớp ở giá mở
        const base = dir === 1 ? Math.min(b.o, stop) : Math.max(b.o, stop);
        close(i, base * (1 - dir * slip), 'SL');
      } else if (hitTP) {
        close(i, tp, 'TP');
      } else if (i - pos.entryIdx + 1 >= pos.maxHold) {
        close(i, b.c * (1 - pos.dir * slip), 'Hết giờ');
      } else if (i === n - 1) {
        close(i, b.c * (1 - pos.dir * slip), 'Cuối dữ liệu');
      }
    }
    // tín hiệu luôn được gọi mỗi nến để chiến lược cập nhật trạng thái tuần tự
    const sig = signal(i);
    if (!pos && sig && i < n - 1) pending = sig;
    const eq = pos ? cash + pos.dir * pos.qty * (b.c - pos.entryPx) : cash;
    equity.push({ t: b.t, eq });
  }
  return { trades, equity, stats: computeStats(trades, equity, capital, iv, barsInPos) };
}
