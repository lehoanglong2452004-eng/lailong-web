// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bảng giá hàng hoá và crypto đuôi USDT (XAUUSDT, CLUSDT, BTCUSDT…) trên các sàn phái sinh crypto.
// Trình duyệt gọi thẳng sàn, không qua máy chủ. Binance: giá chạy từng giây qua WebSocket miniTicker, funding và
// hợp đồng mở (OI) hỏi lại mỗi phút. Bybit, OKX, Hyperliquid: hỏi lại bảng giá mỗi 10 đến 15 giây.
// "Gộp tất cả": giá trung bình theo khối lượng, khối lượng và OI cộng các sàn, funding trung bình theo OI quy về 8 giờ.
import { getJson } from "./util.js?v=202611090440";
import { openSocket, hlContexts, hlCoin } from "./exchanges.js?v=202611090440";

// [mã gốc, tên, nhóm]: nhóm "comm" là hàng hoá, "crypto" là BTC, ETH
export const BOARD = [
  ["XAU", "Vàng", "comm"], ["XAG", "Bạc", "comm"], ["XPT", "Bạch kim", "comm"], ["COPPER", "Đồng", "comm"],
  ["CL", "Dầu WTI", "comm"], ["BZ", "Dầu Brent", "comm"], ["BTC", "Bitcoin", "crypto"], ["ETH", "Ethereum", "crypto"],
];
export const BOARD_VENUES = ["BINANCE", "BYBIT", "OKX", "HYPERLIQUID"];
export const VENUE_SHORT = { BINANCE: "Binance", BYBIT: "Bybit", OKX: "OKX", HYPERLIQUID: "Hyperliquid" };
const BN = "https://fapi.binance.com", BY = "https://api.bybit.com", OK = "https://www.okx.com";
const n = x => (x == null || x === "" ? null : +x);
const okInst = c => `${c}-USDT-SWAP`;

// mỗi dòng: { coin, price, chg (% 24 giờ), vol (USD 24 giờ), oi (USD), fund (tỷ lệ mỗi kỳ, 0.0001 = 0,01%), fundH (giờ mỗi kỳ) }
export function parseBinance(tickers, prem, ois, finfo = []) {
  const P = new Map((prem || []).map(x => [x.symbol, x])), F = new Map((finfo || []).map(x => [x.symbol, +x.fundingIntervalHours]));
  const out = {};
  for (const [c] of BOARD) {
    const s = c + "USDT", t = (tickers || []).find(x => x && x.symbol === s); if (!t) continue;
    const p = P.get(s), o = (ois || []).find(x => x && x.symbol === s), price = n(t.lastPrice);
    out[c] = { coin: c, price, chg: n(t.priceChangePercent), vol: n(t.quoteVolume), oi: o ? +o.openInterest * price : null,
      fund: p ? n(p.lastFundingRate) : null, fundH: F.get(s) || 8 };
  }
  return out;
}
export function parseBybit(list) {
  const out = {};
  for (const [c] of BOARD) {
    const t = (list || []).find(x => x.symbol === c + "USDT"); if (!t) continue;
    out[c] = { coin: c, price: n(t.lastPrice), chg: n(t.price24hPcnt) * 100, vol: n(t.turnover24h), oi: n(t.openInterestValue),
      fund: n(t.fundingRate), fundH: n(t.fundingIntervalHour) || 8 };
  }
  return out;
}
export function parseOkx(tickers, ois, funds) {
  const out = {};
  for (const [c] of BOARD) {
    const id = okInst(c), t = (tickers || []).find(x => x.instId === id); if (!t) continue;
    const last = n(t.last), open = n(t.open24h), o = (ois || []).find(x => x.instId === id), f = (funds || []).find(x => x && x.instId === id);
    const fh = f && f.nextFundingTime && f.fundingTime ? Math.round((+f.nextFundingTime - +f.fundingTime) / 3600e3) : 8;
    out[c] = { coin: c, price: last, chg: open ? (last / open - 1) * 100 : null, vol: n(t.volCcy24h) * last, oi: o ? n(o.oiUsd) : null,
      fund: f ? n(f.fundingRate) : null, fundH: fh > 0 ? fh : 8 };
  }
  return out;
}
// all: danh sách của hlContexts(); names: { coin gốc -> tên hợp đồng trên Hyperliquid }
export function parseHl(all, names) {
  const out = {};
  for (const [c] of BOARD) {
    const x = (all || []).find(y => y.name === names[c] && !y.dead); if (!x) continue;
    const k = x.ctx, price = n(k.markPx), prev = n(k.prevDayPx);
    out[c] = { coin: c, price, chg: prev ? (price / prev - 1) * 100 : null, vol: n(k.dayNtlVlm), oi: n(k.openInterest) * price, fund: n(k.funding), fundH: 1 };
  }
  return out;
}

// gộp nhiều sàn: { BINANCE: {XAU: row}, ... } -> { XAU: { ...row, venues: ["BINANCE", ...] } }
export function mergeVenues(by) {
  const out = {};
  for (const [c] of BOARD) {
    const rows = Object.entries(by).map(([v, m]) => m && m[c] && m[c].price ? { v, ...m[c] } : null).filter(Boolean);
    if (!rows.length) continue;
    const vol = rows.reduce((s, r) => s + (r.vol || 0), 0), oiRows = rows.filter(r => r.oi > 0 && r.fund != null), oi = rows.reduce((s, r) => s + (r.oi || 0), 0);
    const w = r => (vol > 0 ? (r.vol || 0) / vol : 1 / rows.length);
    const fundOi = oiRows.reduce((s, r) => s + r.oi, 0);
    out[c] = {
      coin: c, venues: rows.map(r => r.v),
      price: rows.reduce((s, r) => s + r.price * w(r), 0),
      chg: rows.some(r => r.chg != null) ? rows.filter(r => r.chg != null).reduce((s, r) => s + r.chg * w(r), 0) / rows.filter(r => r.chg != null).reduce((s, r) => s + w(r), 0) : null,
      vol, oi: oi || null, fundH: 8,
      fund: fundOi > 0 ? oiRows.reduce((s, r) => s + r.fund * (8 / r.fundH) * r.oi, 0) / fundOi : null,
    };
  }
  return out;
}

// ---------- lấy dữ liệu từng sàn ----------
let bnFinfo = null, bnFinfoT = 0;
async function snapBinance(withMeta) {
  const tickers = await Promise.all(BOARD.map(([c]) => getJson(`${BN}/fapi/v1/ticker/24hr?symbol=${c}USDT`).catch(() => null)));
  if (!withMeta) return parseBinance(tickers, null, null);
  if (!bnFinfo || Date.now() - bnFinfoT > 3600e3) { bnFinfo = await getJson(`${BN}/fapi/v1/fundingInfo`).catch(() => bnFinfo || []); bnFinfoT = Date.now(); }
  const have = BOARD.filter((_, i) => tickers[i]).map(([c]) => c);
  const [prem, ois] = await Promise.all([
    getJson(`${BN}/fapi/v1/premiumIndex`).catch(() => []),
    Promise.all(have.map(c => getJson(`${BN}/fapi/v1/openInterest?symbol=${c}USDT`).catch(() => null))),
  ]);
  return parseBinance(tickers, prem, ois, bnFinfo);
}
async function snapBybit() { return parseBybit((await getJson(`${BY}/v5/market/tickers?category=linear`)).result.list); }
let okFund = {}, okFundT = 0;
async function snapOkx() {
  const [t, o] = await Promise.all([getJson(`${OK}/api/v5/market/tickers?instType=SWAP`), getJson(`${OK}/api/v5/public/open-interest?instType=SWAP`).catch(() => ({ data: [] }))]);
  if (Date.now() - okFundT > 60e3) {
    okFundT = Date.now();
    const ids = BOARD.map(([c]) => okInst(c)).filter(id => t.data.some(x => x.instId === id));
    const fs = await Promise.all(ids.map(id => getJson(`${OK}/api/v5/public/funding-rate?instId=${id}`).then(r => r.data[0]).catch(() => null)));
    okFund = Object.fromEntries(fs.filter(Boolean).map(f => [f.instId, f]));
  }
  return parseOkx(t.data, o.data, Object.values(okFund));
}
let hlNamesMap = null;
async function snapHl() {
  const all = await hlContexts();
  if (!hlNamesMap) hlNamesMap = Object.fromEntries(await Promise.all(BOARD.map(async ([c]) => [c, await hlCoin(c + "USDT").catch(() => c)])));
  return parseHl(all, hlNamesMap);
}
export function snapVenue(v, withMeta = true) {
  return v === "BINANCE" ? snapBinance(withMeta) : v === "BYBIT" ? snapBybit() : v === "OKX" ? snapOkx() : v === "HYPERLIQUID" ? snapHl() : Promise.resolve({});
}

// Bảng sống: chọn sàn hoặc "ALL" (gộp). onData({ rows, at, live, venue, errors }) gọi mỗi khi có số mới.
export function liveBoard(onData) {
  let venue = "BINANCE", rows = {}, by = {}, at = 0, sock = null, timer = null, metaT = 0, live = false, errors = [], token = 0, on = false;
  const emit = () => onData({ rows, at, live, venue, errors, by });
  const pollMs = () => (venue === "BINANCE" ? 60e3 : venue === "HYPERLIQUID" ? 15e3 : venue === "ALL" ? 20e3 : 10e3);
  async function poll() {
    const my = token;
    try {
      if (venue === "ALL") {
        const res = await Promise.allSettled(BOARD_VENUES.map(v => snapVenue(v)));
        if (my !== token) return;
        by = Object.fromEntries(BOARD_VENUES.map((v, i) => [v, res[i].status === "fulfilled" ? res[i].value : null]));
        errors = BOARD_VENUES.filter((v, i) => res[i].status === "rejected").map(v => VENUE_SHORT[v]);
        rows = mergeVenues(by);
      } else {
        const r = await snapVenue(venue, true);
        if (my !== token) return;
        // Binance: giữ giá từ WebSocket (mới hơn), chỉ lấy funding và OI từ lần hỏi này
        if (venue === "BINANCE" && live) for (const c in r) rows[c] = { ...r[c], ...pick(rows[c]) };
        else rows = r;
        errors = [];
      }
      at = Date.now(); metaT = at;
    } catch (e) { if (my === token) errors = [`${VENUE_SHORT[venue] || venue}: ${e.message}`]; }
    if (my === token) emit();
  }
  const pick = r => (r ? { price: r.price, chg: r.chg, vol: r.vol } : {});
  function startWs() {
    const streams = BOARD.map(([c]) => `${c.toLowerCase()}usdt@miniTicker`).join("/");
    sock = openSocket(`wss://fstream.binance.com/stream?streams=${streams}`, {
      name: "bảng giá Binance",
      onStatus: (_, ok) => { live = !!ok; emit(); },
      onMessage: m => {
        const d = m && m.data; if (!d || !d.s) return;
        const c = d.s.replace(/USDT$/, ""), o = +d.o, p = +d.c;
        rows[c] = { ...(rows[c] || { coin: c, fundH: 8 }), coin: c, price: p, chg: o ? (p / o - 1) * 100 : null, vol: +d.q };
        at = Date.now(); live = true;
        if (!emit.t) emit.t = setTimeout(() => { emit.t = null; emit(); }, 500); // vẽ lại tối đa 2 lần mỗi giây
      },
    });
  }
  function stop() { token++; clearInterval(timer); timer = null; if (sock) { sock.close(); sock = null; } live = false; }
  function start() {
    stop(); if (!on) return;
    rows = {}; by = {}; at = 0; errors = []; emit();
    if (venue === "BINANCE") startWs();
    poll(); timer = setInterval(poll, pollMs());
  }
  return {
    setVenue(v) { if (v === venue) return; venue = v; start(); },
    get venue() { return venue; },
    show() { if (on) return; on = true; start(); },
    hide() { on = false; stop(); },
    data: () => ({ rows, at, live, venue, errors, by }),
    metaAge: () => (metaT ? Date.now() - metaT : null),
  };
}
