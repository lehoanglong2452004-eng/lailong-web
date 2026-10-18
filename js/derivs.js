// Lai Long Web: dữ liệu phái sinh sâu hơn, lấy thẳng từ API công khai của sàn.
//   Binance Futures: tỷ lệ long/short (mọi tài khoản và top trader), tỷ lệ mua/bán chủ động, chênh lệch
//                    funding hiện tại, open interest.
//   Deribit:         quyền chọn BTC/ETH: tỷ lệ put/call theo OI và khối lượng, điểm "max pain", các giá
//                    thực hiện có OI lớn nhất (thường thành nam châm hút giá gần ngày đáo hạn).
import { getJson } from "./util.js?v=202610180437";

const FAPI = "https://fapi.binance.com";
const DERIBIT = "https://www.deribit.com/api/v2/public";

const last = a => a[a.length - 1];
const num = x => +x;

export async function binanceDerivs(symbol, period = "1h", limit = 48) {
  const q = `symbol=${symbol}&period=${period}&limit=${limit}`;
  const safe = p => p.catch(e => ({ err: e.message }));
  const [acc, top, taker, oi, prem] = await Promise.all([
    safe(getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?${q}`)),
    safe(getJson(`${FAPI}/futures/data/topLongShortPositionRatio?${q}`)),
    safe(getJson(`${FAPI}/futures/data/takerlongshortRatio?${q}`)),
    safe(getJson(`${FAPI}/futures/data/openInterestHist?${q}`)),
    safe(getJson(`${FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`)),
  ]);
  const ser = (r, k) => Array.isArray(r) ? r.map(x => ({ t: num(x.timestamp), v: num(x[k]) })).filter(x => isFinite(x.v)).sort((a, b) => a.t - b.t) : null;
  return {
    acc: ser(acc, "longShortRatio"), accLong: Array.isArray(acc) && acc.length ? num(last(acc).longAccount) : null,
    top: ser(top, "longShortRatio"), topLong: Array.isArray(top) && top.length ? num(last(top).longAccount) : null,
    taker: ser(taker, "buySellRatio"),
    oi: ser(oi, "sumOpenInterestValue"),
    funding: prem && !prem.err ? num(prem.lastFundingRate) : null, mark: prem && !prem.err ? num(prem.markPrice) : null, index: prem && !prem.err ? num(prem.indexPrice) : null,
    nextFunding: prem && !prem.err ? num(prem.nextFundingTime) : null,
    errors: [acc, top, taker, oi, prem].filter(r => r && r.err).map(r => r.err),
  };
}

// tên quyền chọn Deribit: BTC-27DEC24-60000-C
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
export function parseOption(name) {
  const m = /^([A-Z_]+)-(\d{1,2})([A-Z]{3})(\d{2})-(\d+(?:d\d+)?)-([CP])$/.exec(name);
  if (!m || MON[m[3]] == null) return null;
  return { expiry: Date.UTC(2000 + +m[4], MON[m[3]], +m[2], 8), strike: +m[5].replace("d", "."), type: m[6] };
}

// max pain: giá đáo hạn mà tổng tiền người mua quyền chọn nhận được là nhỏ nhất
export function maxPain(opts) {
  const strikes = [...new Set(opts.map(o => o.strike))].sort((a, b) => a - b);
  let best = null, bestPay = Infinity;
  for (const K of strikes) {
    let pay = 0;
    for (const o of opts) pay += o.oi * (o.type === "C" ? Math.max(0, K - o.strike) : Math.max(0, o.strike - K));
    if (pay < bestPay) { bestPay = pay; best = K; }
  }
  return best;
}

export function optionsSummary(rows, now = Date.now()) {
  const opts = rows.map(r => ({ ...parseOption(r.instrument_name), oi: +r.open_interest || 0, vol: +r.volume || 0, iv: +r.mark_iv || null, under: +r.underlying_price || null })).filter(o => o.expiry && o.expiry > now);
  if (!opts.length) return null;
  const sum = (a, k) => a.reduce((s, o) => s + o[k], 0);
  const calls = opts.filter(o => o.type === "C"), puts = opts.filter(o => o.type === "P");
  // kỳ đáo hạn gần nhất còn từ 1 ngày trở lên và có OI đáng kể (ít nhất 3% tổng OI)
  const byExp = new Map(); for (const o of opts) (byExp.get(o.expiry) || byExp.set(o.expiry, []).get(o.expiry)).push(o);
  const tot = sum(opts, "oi"), exps = [...byExp.keys()].sort((a, b) => a - b);
  const main = exps.find(e => e - now > 86400e3 && sum(byExp.get(e), "oi") >= tot * 0.03) ?? exps[0];
  const big = exps.reduce((a, e) => sum(byExp.get(e), "oi") > sum(byExp.get(a), "oi") ? e : a, exps[0]);
  const exp = byExp.get(main), under = opts.find(o => o.under)?.under ?? null;
  const topStrikes = type => { const m = new Map(); for (const o of exp) if (o.type === type) m.set(o.strike, (m.get(o.strike) || 0) + o.oi); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ strike: k, oi: v })); };
  // độ lệch IV: quyền chọn bán (put) cách giá ~10% so với quyền chọn mua (call) cách ~10%, cùng kỳ chính
  const near = (type, target) => exp.filter(o => o.type === type && o.iv).sort((a, b) => Math.abs(a.strike - target) - Math.abs(b.strike - target))[0];
  const p10 = under ? near("P", under * 0.9) : null, c10 = under ? near("C", under * 1.1) : null;
  return {
    pcOi: sum(calls, "oi") ? sum(puts, "oi") / sum(calls, "oi") : null,
    pcVol: sum(calls, "vol") ? sum(puts, "vol") / sum(calls, "vol") : null,
    totalOi: tot, under, mainExpiry: main, mainOi: sum(exp, "oi"), maxPain: maxPain(exp), bigExpiry: big, bigOi: sum(byExp.get(big), "oi"), bigMaxPain: maxPain(byExp.get(big)),
    topCalls: topStrikes("C"), topPuts: topStrikes("P"), skew: p10 && c10 ? p10.iv - c10.iv : null,
  };
}

export async function deribitOptions(currency) {
  const r = await getJson(`${DERIBIT}/get_book_summary_by_currency?currency=${currency}&kind=option`);
  return optionsSummary(r.result || []);
}
