// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Bộ máy backtest. Tín hiệu tại nến i chỉ dùng nến 0..i. Một vị thế tại một thời điểm.
// simulate(): bộ máy chính của trang Backtest, tính kết quả theo R cho hai kịch bản chốt lời TP1 / TP2.
// runBacktest(): bộ máy cũ tính theo USDT, vào ở giá mở nến sau tín hiệu (giữ cho các bài test).
import { STRATEGIES, defaultParams, context } from './strategies.js?v=202610240629';
import { equityStats } from './fractal.js?v=202610240629';
export { STRATEGIES, defaultParams };

const MS_PER_YEAR = 365 * 24 * 3600 * 1000;

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

// ---------- bộ máy chính: kết quả theo R, hai kịch bản chốt lời ----------
// Mỗi lệnh có một SL và hai "chân" độc lập: chân 1 chốt ở TP1, chân 2 chốt ở TP2 (SL giữ nguyên, không dời).
// Lệnh kết thúc khi cả hai chân đã đóng. R của một chân = (lời/lỗ theo giá − phí hai đầu) / khoảng cách SL,
// nhân với hệ số f < 1 khi giới hạn đòn bẩy làm khối lượng nhỏ hơn mức rủi ro đã chọn.
// Vào lệnh: không có entry thì khớp ở giá đóng cửa nến tín hiệu (cộng trượt giá), theo dõi từ nến sau.
// Lệnh chờ: khớp khi giá chạm entry (mở cửa vượt qua thì khớp ở giá mở), huỷ khi hết hạn hoặc giá chạy tới cancelPx
// (mặc định là tp1Px riêng của chiến lược nếu có) trước khi khớp.
// Trong cùng một nến chạm cả SL và TP thì tính SL. Nến khớp lệnh chờ mà chạm luôn SL thì tính SL.
export const EXIT = { tp: 'Chốt lời', sl: 'Cắt lỗ', time: 'Hết giờ', eod: 'Cuối ngày', end: 'Cuối dữ liệu' };
export function simulate(bars, strat, params = {}, {
  riskPct = 1, feeRate = 0.0005, slippageBps = 2, maxLeverage = 20, tp1R = 1, tp2R = 2, maxHoldBars = Infinity, side = 'both', intervalMs,
} = {}) {
  const s = typeof strat === 'string' ? STRATEGIES[strat] : strat;
  if (!s) throw new Error('Không có chiến lược: ' + strat);
  const p = { ...(typeof strat === 'string' ? defaultParams(strat) : {}), ...params };
  const n = bars?.length || 0, trades = [], out = { trades, signals: 0, missed: 0, barsInPos: 0 };
  if (!n) return out;
  const iv = intervalMs || inferInterval(bars), signal = s.prepare(bars, p, context(bars), iv), slip = slippageBps / 1e4;
  let pos = null, pend = null;
  const allowed = (sd) => side === 'both' || side === sd;
  const open = (i, px, sg) => {
    const dir = sg.side === 'long' ? 1 : -1, risk = dir * (px - sg.stop);
    if (!(risk > 0)) return;
    const tpOf = (R, own) => (own != null && dir * (own - px) > 0 ? own : px + dir * R * risk);
    pos = {
      dir, side: sg.side, tag: sg.tag || '', i, t: bars[i].t, entryPx: px, stop: sg.stop, risk, forceExit: sg.forceExit,
      f: Math.min(1, maxLeverage * risk / ((riskPct / 100) * px)),
      legs: [{ tp: tpOf(tp1R, sg.tp1Px) }, { tp: tpOf(tp2R, sg.tp2Px) }],
    };
  };
  const closeLeg = (leg, i, px, why) => {
    const { dir, entryPx, risk, f } = pos;
    leg.px = px; leg.why = why; leg.i = i; leg.t = bars[i].t;
    leg.r = (dir * (px - entryPx) - feeRate * (entryPx + px)) / risk * f;
  };
  const finish = () => {
    if (!pos || pos.legs.some((l) => l.r == null)) return;
    const [a, b] = pos.legs;
    trades.push({
      side: pos.side, tag: pos.tag, i: pos.i, t: pos.t, entryPx: pos.entryPx, stop: pos.stop, risk: pos.risk, f: pos.f,
      tp1Px: a.tp, tp2Px: b.tp, r1: a.r, r2: b.r, why1: a.why, why2: b.why, exit1: { t: a.t, px: a.px }, exit2: { t: b.t, px: b.px },
      bars1: a.i - pos.i, bars2: b.i - pos.i, exitT: Math.max(a.t, b.t),
    });
    pos = null;
  };
  const stopFill = (b) => (pos.dir === 1 ? Math.min(b.o, pos.stop) : Math.max(b.o, pos.stop)) * (1 - pos.dir * slip);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (pend && !pos) {
      const dir = pend.side === 'long' ? 1 : -1;
      if (i - pend.i > pend.valid) { pend = null; out.missed++; }
      else if (dir === 1 ? b.l <= pend.entry : b.h >= pend.entry) {
        const sg = pend; pend = null;
        open(i, dir === 1 ? Math.min(b.o, sg.entry) : Math.max(b.o, sg.entry), sg);
        if (pos && (dir === 1 ? b.l <= pos.stop : b.h >= pos.stop)) { const px = stopFill(b); for (const l of pos.legs) closeLeg(l, i, px, EXIT.sl); }
      } else if (dir === 1 ? b.h >= pend.cancelPx : b.l <= pend.cancelPx) { pend = null; out.missed++; }
    } else if (pos && i > pos.i) {
      const { dir } = pos, hitSL = dir === 1 ? b.l <= pos.stop : b.h >= pos.stop;
      for (const l of pos.legs) {
        if (l.r != null) continue;
        if (hitSL) closeLeg(l, i, stopFill(b), EXIT.sl);
        else if (dir === 1 ? b.h >= l.tp : b.l <= l.tp) closeLeg(l, i, dir === 1 ? Math.max(b.o, l.tp) : Math.min(b.o, l.tp), EXIT.tp);
      }
      const why = i - pos.i >= maxHoldBars ? EXIT.time : pos.forceExit && pos.forceExit(i) ? EXIT.eod : i === n - 1 ? EXIT.end : null;
      if (why) { const px = b.c * (1 - dir * slip); for (const l of pos.legs) if (l.r == null) closeLeg(l, i, px, why); }
    }
    if (pos) out.barsInPos++;
    finish();
    // tín hiệu luôn được gọi mỗi nến để chiến lược cập nhật trạng thái tuần tự
    const sg = signal(i);
    if (sg && !pos && !pend && allowed(sg.side) && i < n - 1) {
      out.signals++;
      const dir = sg.side === 'long' ? 1 : -1;
      if (sg.fillAt != null) {
        open(i, sg.fillAt, sg);
        if (pos && (dir === 1 ? b.l <= pos.stop : b.h >= pos.stop)) { const px = stopFill(b); for (const l of pos.legs) closeLeg(l, i, px, EXIT.sl); finish(); }
      } else if (sg.entry == null) open(i, b.c * (1 + dir * slip), sg);
      else if (dir * (sg.entry - sg.stop) > 0) {
        // huỷ lệnh chờ khi giá chạy tới mức chiến lược chỉ định (ví dụ Fibonacci: vượt đỉnh cũ) trước khi khớp
        pend = { ...sg, i, valid: sg.valid ?? 30, cancelPx: sg.cancelPx ?? sg.tp1Px ?? (dir === 1 ? Infinity : -Infinity) };
      }
    }
  }
  return out;
}

// Thống kê một danh sách lệnh theo một kịch bản chốt lời (leg 1 hoặc 2)
export function tradeStats(trades, leg = 2, riskPct = 1) {
  const k = leg === 1 ? 'r1' : 'r2', st = equityStats(trades.map((t) => t[k]), riskPct);
  const why = {}; for (const t of trades) { const w = t[leg === 1 ? 'why1' : 'why2']; why[w] = (why[w] || 0) + 1; }
  st.why = why;
  st.avgBars = trades.length ? trades.reduce((s, t) => s + t[leg === 1 ? 'bars1' : 'bars2'], 0) / trades.length : NaN;
  st.capped = trades.filter((t) => t.f < 1).length;
  return st;
}

// Chia theo thời gian: lệnh vào trước mốc split (phần đầu) và sau (phần cuối, ngoài mẫu)
export function splitTrades(trades, bars, frac = 0.7) {
  const cut = bars[Math.min(bars.length - 1, Math.floor(bars.length * frac))]?.t ?? Infinity;
  return { cut, ins: trades.filter((t) => t.t < cut), oos: trades.filter((t) => t.t >= cut) };
}
