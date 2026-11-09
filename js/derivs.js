// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: dữ liệu phái sinh sâu hơn, lấy thẳng từ API công khai của sàn.
//   Binance Futures: tỷ lệ long/short (mọi tài khoản và top trader), tỷ lệ mua/bán chủ động, chênh lệch
//                    funding hiện tại, open interest.
//   Deribit:         quyền chọn BTC/ETH: tỷ lệ put/call theo OI và khối lượng, điểm "max pain", các giá
//                    thực hiện có OI lớn nhất (thường thành nam châm hút giá gần ngày đáo hạn).
import { getJson } from "./util.js?v=202611090440";

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

// cùng bộ số liệu cho sàn đang chọn; số nào sàn không công bố thì để null (không lấy tạm Binance)
// trả thêm: venue, fundingH (số giờ mỗi kỳ funding), missing: [tên số liệu sàn không công bố]
const OKX = "https://www.okx.com", BYBIT = "https://api.bybit.com", HL = "https://api.hyperliquid.xyz/info";
const okxInst = s => s.replace(/USDT$/, "") + "-USDT-SWAP", base = s => s.replace(/USDT$/, "");
const longOf = r => (r > 0 ? r / (1 + r) : null);
export async function venueDerivs(venue, symbol) {
  if (venue === "BINANCE" || !venue) return { venue: "BINANCE", fundingH: 8, missing: [], ...(await binanceDerivs(symbol)) };
  const safe = p => p.catch(e => ({ err: e.message }));
  const out = { venue, acc: null, accLong: null, top: null, topLong: null, taker: null, oi: null, funding: null, mark: null, index: null, nextFunding: null, fundingH: 8, missing: [], errors: [] };
  const errs = rs => rs.filter(r => r && r.err).map(r => r.err);
  if (venue === "BYBIT") {
    const q = `category=linear&symbol=${symbol}`;
    const [acc, oi, tk] = await Promise.all([
      safe(getJson(`${BYBIT}/v5/market/account-ratio?${q}&period=1h&limit=48`)),
      safe(getJson(`${BYBIT}/v5/market/open-interest?${q}&intervalTime=1h&limit=48`)),
      safe(getJson(`${BYBIT}/v5/market/tickers?${q}`)),
    ]);
    const t = tk && tk.result && tk.result.list && tk.result.list[0];
    if (t) { out.funding = num(t.fundingRate); out.mark = num(t.markPrice); out.index = num(t.indexPrice); out.nextFunding = num(t.nextFundingTime); out.fundingH = num(t.fundingIntervalHour) || 8; }
    const al = acc && acc.result && acc.result.list;
    if (al && al.length) { out.acc = al.map(x => ({ t: num(x.timestamp), v: num(x.buyRatio) / num(x.sellRatio) })).filter(x => isFinite(x.v)).sort((a, b) => a.t - b.t); out.accLong = num(al[0].buyRatio); }
    const ol = oi && oi.result && oi.result.list;
    if (ol && ol.length && out.mark) out.oi = ol.map(x => ({ t: num(x.timestamp), v: num(x.openInterest) * out.mark })).sort((a, b) => a.t - b.t);
    out.missing = ["top", "taker"]; out.errors = errs([acc, oi, tk]);
    return out;
  }
  if (venue === "OKX") {
    const c = base(symbol), inst = okxInst(symbol), R = `${OKX}/api/v5/rubik/stat`;
    const [acc, top, tk, oi, fr, mk, ix] = await Promise.all([
      safe(getJson(`${R}/contracts/long-short-account-ratio?ccy=${c}&period=1H`)),
      safe(getJson(`${R}/contracts/long-short-account-ratio-contract-top-trader?instId=${inst}&period=1H`)),
      safe(getJson(`${R}/taker-volume?ccy=${c}&instType=CONTRACTS&period=1H`)),
      safe(getJson(`${R}/contracts/open-interest-volume?ccy=${c}&period=1H`)),
      safe(getJson(`${OKX}/api/v5/public/funding-rate?instId=${inst}`)),
      safe(getJson(`${OKX}/api/v5/public/mark-price?instType=SWAP&instId=${inst}`)),
      safe(getJson(`${OKX}/api/v5/market/index-tickers?instId=${c}-USDT`)),
    ]);
    const rows = r => (r && Array.isArray(r.data) ? r.data : null), last48 = a => a.sort((x, y) => x.t - y.t).slice(-48);
    const a = rows(acc); if (a && a.length) { out.acc = last48(a.map(x => ({ t: num(x[0]), v: num(x[1]) }))); out.accLong = longOf(out.acc.at(-1).v); }
    const tp = rows(top); if (tp && tp.length) { out.top = last48(tp.map(x => ({ t: num(x[0]), v: num(x[1]) }))); out.topLong = longOf(out.top.at(-1).v); }
    const k = rows(tk); if (k && k.length) out.taker = last48(k.map(x => ({ t: num(x[0]), v: num(x[1]) > 0 ? num(x[2]) / num(x[1]) : NaN })).filter(x => isFinite(x.v)));
    const o = rows(oi); if (o && o.length) out.oi = last48(o.map(x => ({ t: num(x[0]), v: num(x[1]) })));
    const f = rows(fr); if (f && f[0]) { out.funding = num(f[0].fundingRate); out.nextFunding = num(f[0].nextFundingTime); }
    const m = rows(mk); if (m && m[0]) out.mark = num(m[0].markPx);
    const i = rows(ix); if (i && i[0]) out.index = num(i[0].idxPx);
    out.missing = [!out.top && "top"].filter(Boolean); out.errors = errs([acc, top, tk, oi, fr, mk, ix]);
    return out;
  }
  if (venue === "HYPERLIQUID") {
    const r = await safe(getJson(HL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "metaAndAssetCtxs" }) }));
    if (r && !r.err && Array.isArray(r)) {
      const i = r[0].universe.findIndex(u => u.name === base(symbol)), c = i >= 0 ? r[1][i] : null;
      if (c) { out.funding = num(c.funding); out.mark = num(c.markPx); out.index = num(c.oraclePx); out.fundingH = 1; const oiNow = num(c.openInterest) * out.mark; out.oi = [{ t: Date.now(), v: oiNow }]; }
    }
    out.missing = ["acc", "top", "taker"]; out.errors = errs([r]);
    return out;
  }
  return out;
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
