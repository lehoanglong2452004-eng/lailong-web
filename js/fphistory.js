// Lai Long Web: dựng footprint cho các nến lịch sử.
//
// Sàn không cho tải footprint quá khứ, nên làm hai lớp:
// 1. Ước tính (mọi sàn): chia khối lượng mua/bán chủ động của các nến nhỏ hơn (ví dụ nến 1 phút
//    trong một nến 15 phút) đều lên khoảng giá của từng nến nhỏ. Nến ước tính vẽ viền nét đứt.
// 2. Chính xác (Binance): tải ngược từng lệnh khớp (aggTrades) cho các nến gần nhất và thay
//    phần ước tính bằng số liệu thật. Có giới hạn số lần gọi để không vượt hạn mức của sàn.

import { INTERVALS, getJson, sleep } from "./util.js?v=202610152106";
import { smartTape } from "./orderflow.js?v=202610152106";

const SUB = { "1m": null, "5m": "1m", "15m": "1m", "1h": "5m", "4h": "15m", "1d": "1h" };
const SUB_CAP = { BINANCE: 12000, BYBIT: 12000, OKX: 3000, HYPERLIQUID: 5000, SIM: 12000 };

function addRange(fp, step, l, h, sell, buy) {
  const k1 = Math.floor(l / step + 1e-9), k2 = Math.floor(h / step + 1e-9), n = k2 - k1 + 1;
  for (let k = k1; k <= k2; k++) { const c = fp.get(k) || [0, 0]; c[0] += sell / n; c[1] += buy / n; fp.set(k, c); }
}

function buyOf(b) {
  if (typeof b.bv === "number" && isFinite(b.bv)) return b.bv;
  const r = b.h - b.l; return r > 0 ? b.v * (0.5 + 0.5 * (b.c - b.o) / r) : b.v / 2;
}

// Lớp 1: footprint ước tính cho mọi nến chưa có footprint
export async function approxFootprint(ex, symbol, market, isCurrent) {
  const bars = market.bars, step = market.fpStep, ms = market.intervalMs;
  if (!bars.length || !step) return;
  const sub = SUB[market.interval];
  let subBars = [];
  if (sub) {
    const ratio = Math.round(ms / INTERVALS[sub]);
    const n = Math.min(SUB_CAP[ex.id] || 3000, bars.length * ratio);
    try { subBars = await ex.klines(symbol, sub, n); } catch { subBars = []; }
    if (!isCurrent()) return;
  }
  let j = 0;
  subBars.sort((a, b) => a.t - b.t);
  for (const b of bars) {
    if (b.fp && !b.fpApprox) continue; // đã có footprint thật
    const fp = new Map();
    while (j < subBars.length && subBars[j].t < b.t) j++;
    let k = j, used = 0;
    while (k < subBars.length && subBars[k].t < b.t + ms) {
      const s = subBars[k], buy = buyOf(s); addRange(fp, step, s.l, s.h, s.v - buy, buy); used++; k++;
    }
    if (!used) { const buy = buyOf(b); addRange(fp, step, b.l, b.h, b.v - buy, buy); }
    b.fp = fp; b.fpApprox = true;
  }
  market.emit("footprint");
}

// Lớp 2: footprint chính xác từ từng lệnh khớp của Binance cho các nến gần nhất
export async function exactFootprintBinance(symbol, market, isCurrent, { maxRequests = 150, maxBars = 400, onProgress } = {}) {
  const url = "https://fapi.binance.com/fapi/v1/aggTrades";
  const bars = market.bars, step = market.fpStep, ms = market.intervalMs;
  if (!bars.length || !step) return;
  const liveStart = market.liveStart || Date.now();
  const oldest = bars[Math.max(0, bars.length - maxBars)].t;
  const idx = new Map(bars.map((b, i) => [b.t, i]));
  const acc = new Map(); // thời gian nến -> footprint đang dựng
  let minId = null, done = 0, finishedBefore = Infinity;
  const finalize = (beforeT) => {
    // các nến nằm hẳn sau mốc beforeT đã đủ lệnh khớp
    for (const [t, fp] of acc) {
      if (t < beforeT) continue;
      const b = bars[idx.get(t)]; if (!b) { acc.delete(t); continue; }
      if (b.live) { for (const [k, c] of fp) { const e = b.fp.get(k) || [0, 0]; e[0] += c[0]; e[1] += c[1]; b.fp.set(k, e); } }
      else { b.fp = fp; b.fpApprox = false; }
      acc.delete(t);
    }
    market.emit("footprint");
  };
  for (let r = 0; r < maxRequests && isCurrent(); r++) {
    let rows;
    try { rows = await getJson(minId === null ? `${url}?symbol=${symbol}&limit=1000` : `${url}?symbol=${symbol}&fromId=${Math.max(0, minId - 1000)}&limit=1000`); }
    catch { await sleep(2000); continue; }
    if (!isCurrent() || !rows.length) break;
    for (const x of rows) {
      if (minId !== null && x.a >= minId) continue;
      const t = x.T; if (t >= liveStart) continue; // phần sau lúc mở trang đã có từ luồng trực tiếp
      const bt = Math.floor(t / ms) * ms; if (!idx.has(bt)) continue;
      const p = +x.p, q = +x.q, k = Math.floor(p / step + 1e-9);
      let fp = acc.get(bt); if (!fp) { fp = new Map(); acc.set(bt, fp); }
      const c = fp.get(k) || [0, 0]; c[x.m ? 0 : 1] += q; fp.set(k, c);
    }
    // ghép lệnh nhỏ thành lệnh gốc để vẽ Big Trades cho cả các nến cũ
    const page = rows.filter(x => (minId === null || x.a < minId) && x.T < liveStart).sort((a, b) => a.a - b.a)
      .map(x => ({ t: x.T, p: +x.p, q: +x.q, side: x.m ? "sell" : "buy" }));
    for (const pr of smartTape(page, { tick: market.tick })) market.histPrints.push(pr);
    if (market.histPrints.length > 200000) market.histPrints.splice(0, market.histPrints.length - 200000);
    market.updateBigPrint();
    minId = Math.min(...rows.map(x => x.a));
    const earliest = Math.min(...rows.map(x => x.T));
    const barStart = Math.floor(earliest / ms) * ms;
    // nến chứa lệnh sớm nhất có thể chưa đủ; các nến sau nó thì đã đủ
    if (barStart + ms <= finishedBefore) { finalize(barStart + ms); finishedBefore = barStart + ms; }
    done = bars.length - idx.get(barStart) || 0;
    if (onProgress) onProgress(Math.min(done, maxBars), maxBars, earliest);
    if (earliest <= oldest || minId <= 0) break;
    await sleep(450); // giữ dưới hạn mức 2400 trọng số/phút của Binance
  }
  if (isCurrent() && onProgress) onProgress(null);
}
