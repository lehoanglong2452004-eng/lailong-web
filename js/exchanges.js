// Lai Long Web: kết nối thẳng từ trình duyệt tới sàn futures (không cần máy chủ riêng).
//
// Mỗi sàn có cùng một bộ hàm:
//   listSymbols()                     -> [{symbol, last, change, volUsd}]
//   info(symbol)                      -> {tick, ctVal}
//   klines(symbol, interval, n)       -> [{t, o, h, l, c, v, bv}]  (bv: KL mua chủ động, có thể null)
//   oiHistory(symbol, interval, from) -> [{t, oi}]                 (open interest tính bằng đồng gốc)
//   connect(symbol, info, book, h)    -> {close()}
// `book` là sổ lệnh dùng chung (Book), sàn chỉ việc ghi mức giá vào đó.
// h = {onTrades([{p, q, side, t}]), onLiq([{p, q, side, t}]), onBook(), onStatus(text, ok)}
// Với lệnh thanh lý, side là phía vị thế bị thanh lý: "long" hoặc "short".

import { getJson, postJson, INTERVALS, niceStep, sleep } from "./util.js?v=202610192356";

// ---------- kết nối WebSocket có tự nối lại ----------
function openSocket(url, { onOpen, onMessage, onStatus, ping, pingMs = 20000, name }) {
  let ws = null, closed = false, timer = null, retry = 0;
  const start = () => {
    if (closed) return;
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 0; onStatus && onStatus(`Đã kết nối ${name}`, true);
      if (onOpen) onOpen(ws);
      if (ping) timer = setInterval(() => { if (ws.readyState === 1) ws.send(ping()); }, pingMs);
    };
    ws.onmessage = ev => {
      if (ev.data === "pong") return;
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      onMessage(msg, ws);
    };
    ws.onclose = () => {
      clearInterval(timer);
      if (closed) return;
      retry++; const wait = Math.min(15000, 500 * 2 ** retry);
      onStatus && onStatus(`Mất kết nối ${name}, thử lại sau ${(wait / 1000).toFixed(0)} giây`, false);
      setTimeout(start, wait);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* bỏ qua */ } };
  };
  start();
  return {
    close() { closed = true; clearInterval(timer); if (ws) ws.close(); },
    reconnect() { if (ws) ws.close(); },
  };
}

// Tải ngược nhiều trang nến cho đủ `n` nến; fetchPage(endTime) trả nến cũ hơn endTime
async function pageBackward(fetchPage, n, intervalMs) {
  let out = [], end = Date.now() + intervalMs;
  for (let guard = 0; guard < 60 && out.length < n; guard++) {
    const page = await fetchPage(end);
    if (!page.length) break;
    page.sort((a, b) => a.t - b.t);
    const fresh = page.filter(b => !out.length || b.t < out[0].t);
    if (!fresh.length) break;
    out = fresh.concat(out);
    end = fresh[0].t - 1;
  }
  return out.slice(-n);
}

const num = Number;

// ---------- Binance USDⓈ-M Futures ----------
const BN_REST = "https://fapi.binance.com";
const BN_WS = "wss://fstream.binance.com";
let bnInfo = null;

const binance = {
  id: "BINANCE", name: "Binance Futures", hasLiq: true, hasOi: true, oiDays: 30,
  async listSymbols() {
    const rows = await getJson(`${BN_REST}/fapi/v1/ticker/24hr`);
    return rows.filter(r => r.symbol.endsWith("USDT"))
      .map(r => ({ symbol: r.symbol, last: num(r.lastPrice), change: num(r.priceChangePercent), volUsd: num(r.quoteVolume) }));
  },
  async info(symbol) {
    if (!bnInfo) bnInfo = getJson(`${BN_REST}/fapi/v1/exchangeInfo`).catch(e => { bnInfo = null; throw e; });
    const s = (await bnInfo).symbols.find(x => x.symbol === symbol);
    if (!s) throw new Error(`Binance không có mã ${symbol}`);
    const pf = s.filters.find(f => f.filterType === "PRICE_FILTER");
    return { tick: num(pf.tickSize), ctVal: 1 };
  },
  async klines(symbol, interval, n) {
    const ms = INTERVALS[interval];
    return pageBackward(async end => {
      const rows = await getJson(`${BN_REST}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(1500, n + 1)}&endTime=${end}`);
      return rows.map(r => ({ t: r[0], o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[5]), bv: num(r[9]), n: num(r[8]) }));
    }, n, ms);
  },
  // nến trực tiếp qua một WebSocket chung cho nhiều cặp (mã, khung): onBar(symbol, interval, bar) mỗi lần có cập nhật
  klineStream(pairs, onBar, onStatus) {
    const streams = [...new Set(pairs.map(([s, i]) => `${s.toLowerCase()}@kline_${i}`))];
    if (!streams.length) return { close() {} };
    // nến là dữ liệu thị trường: Binance đã tách đường dẫn, đường /stream cũ vẫn mở được nhưng không gửi gì
    return openSocket(`${BN_WS}/market/stream?streams=${streams.join("/")}`, {
      name: "nến Binance", onStatus,
      onMessage: m => {
        const k = m.data && m.data.k; if (!k) return;
        onBar(k.s, k.i, { t: k.t, o: num(k.o), h: num(k.h), l: num(k.l), c: num(k.c), v: num(k.v), bv: num(k.V) });
      },
    });
  },
  async oiHistory(symbol, interval, from) {
    const period = oiPeriod(interval, ["5m", "15m", "1h", "4h", "1d"]);
    const pms = INTERVALS[period], out = [];
    let end = Date.now();
    const start = Math.max(from, Date.now() - 29.5 * 86400e3);
    for (let guard = 0; guard < 40 && end > start; guard++) {
      const rows = await getJson(`${BN_REST}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=500&endTime=${end}`);
      if (!rows.length) break;
      for (const r of rows) out.push({ t: r.timestamp, oi: num(r.sumOpenInterest) });
      const first = Math.min(...rows.map(r => r.timestamp));
      if (first >= end) break;
      end = first - pms;
    }
    return dedupe(out);
  },
  async fundingHistory(symbol, from) {
    const out = []; let start = from;
    for (let guard = 0; guard < 20 && start < Date.now(); guard++) {
      const rows = await getJson(`${BN_REST}/fapi/v1/fundingRate?symbol=${symbol}&startTime=${start}&limit=1000`);
      if (!rows.length) break;
      for (const r of rows) out.push({ t: r.fundingTime, rate: num(r.fundingRate) });
      const last = Math.max(...rows.map(r => r.fundingTime));
      if (rows.length < 1000 || last <= start) break;
      start = last + 1;
    }
    return dedupe(out);
  },
  connect(symbol, info, book, h) {
    const s = symbol.toLowerCase();
    // Sổ lệnh sâu: nhận thay đổi qua WebSocket rồi ghép với ảnh chụp 1000 mức giá qua REST.
    let buffer = [], synced = false, lastU = 0, loading = false;
    const resync = async () => {
      if (loading) return; loading = true; synced = false;
      try {
        const snap = await getJson(`${BN_REST}/fapi/v1/depth?symbol=${symbol}&limit=1000`);
        book.clear();
        for (const [p, q] of snap.bids) book.set("bid", num(p), num(q));
        for (const [p, q] of snap.asks) book.set("ask", num(p), num(q));
        const L = snap.lastUpdateId;
        const pending = buffer.filter(e => e.u >= L); buffer = [];
        let first = true;
        for (const e of pending) {
          if (first && !(e.U <= L && e.u >= L)) continue;
          apply(e); first = false;
        }
        synced = true; lastU = pending.length ? pending[pending.length - 1].u : L;
        h.onBook();
      } catch (err) {
        h.onStatus(`Không tải được sổ lệnh Binance: ${err.message}`, false);
        setTimeout(resync, 3000);
      } finally { loading = false; }
    };
    const apply = e => {
      for (const [p, q] of e.b) book.set("bid", num(p), num(q));
      for (const [p, q] of e.a) book.set("ask", num(p), num(q));
      lastU = e.u;
    };
    const depth = openSocket(`${BN_WS}/public/stream?streams=${s}@depth@100ms`, {
      name: "sổ lệnh Binance", onStatus: h.onStatus,
      onOpen: () => { buffer = []; synced = false; setTimeout(resync, 300); },
      onMessage: msg => {
        const e = msg.data || msg; if (e.e !== "depthUpdate") return;
        if (!synced) { buffer.push(e); if (buffer.length > 2000) buffer.shift(); return; }
        if (e.pu !== lastU) { buffer = [e]; resync(); return; } // lỡ mất gói tin: tải lại
        apply(e); book.ts = e.T; h.onBook();
      },
    });
    const market = openSocket(`${BN_WS}/market/stream?streams=${s}@aggTrade/${s}@forceOrder`, {
      name: "khớp lệnh Binance", onStatus: h.onStatus,
      onMessage: msg => {
        const e = msg.data || msg;
        if (e.e === "aggTrade") h.onTrades([{ p: num(e.p), q: num(e.q), side: e.m ? "sell" : "buy", t: e.T }]);
        else if (e.e === "forceOrder") {
          const o = e.o; // lệnh BÁN cưỡng bức nghĩa là vị thế LONG bị thanh lý
          h.onLiq([{ p: num(o.ap) || num(o.p), q: num(o.z) || num(o.q), side: o.S === "SELL" ? "long" : "short", t: o.T }]);
        }
      },
    });
    return { close() { depth.close(); market.close(); } };
  },
};

// ---------- OKX (hợp đồng SWAP) ----------
const OKX_REST = "https://www.okx.com";
const OKX_WS = "wss://ws.okx.com:8443/ws/v5/public";
const okxInst = symbol => {
  const s = symbol.toUpperCase();
  for (const q of ["USDT", "USDC", "USD"]) if (s.endsWith(q)) return `${s.slice(0, -q.length)}-${q}-SWAP`;
  return `${s}-USDT-SWAP`;
};
const OKX_BAR = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1Dutc" };

const okx = {
  id: "OKX", name: "OKX", hasLiq: true, hasOi: true, oiDays: 30,
  async listSymbols() {
    const r = await getJson(`${OKX_REST}/api/v5/market/tickers?instType=SWAP`);
    return r.data.filter(x => x.instId.endsWith("-USDT-SWAP")).map(x => {
      const last = num(x.last), open = num(x.sodUtc0) || num(x.open24h);
      return { symbol: x.instId.replace("-USDT-SWAP", "USDT"), last, change: open ? (last / open - 1) * 100 : 0, volUsd: num(x.volCcy24h) * last };
    });
  },
  async info(symbol) {
    const r = await getJson(`${OKX_REST}/api/v5/public/instruments?instType=SWAP&instId=${okxInst(symbol)}`);
    if (!r.data || !r.data.length) throw new Error(`OKX không có mã ${okxInst(symbol)}`);
    return { tick: num(r.data[0].tickSz), ctVal: num(r.data[0].ctVal) };
  },
  async klines(symbol, interval, n) {
    const inst = okxInst(symbol);
    return pageBackward(async end => {
      const r = await getJson(`${OKX_REST}/api/v5/market/history-candles?instId=${inst}&bar=${OKX_BAR[interval]}&limit=100&after=${end}`);
      return r.data.map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[6]), bv: null }));
    }, Math.min(n, 3000), INTERVALS[interval]);
  },
  async fundingHistory(symbol, from) {
    const out = []; let after = Date.now();
    for (let guard = 0; guard < 30 && after > from; guard++) {
      const r = await getJson(`${OKX_REST}/api/v5/public/funding-rate-history?instId=${okxInst(symbol)}&limit=100&after=${after}`);
      if (!r.data || !r.data.length) break;
      for (const x of r.data) out.push({ t: num(x.fundingTime), rate: num(x.realizedRate || x.fundingRate) });
      const first = Math.min(...r.data.map(x => num(x.fundingTime)));
      if (first >= after) break;
      after = first;
    }
    return dedupe(out);
  },
  async oiHistory(symbol, interval, from) {
    const period = oiPeriod(interval, ["5m", "15m", "1h", "4h", "1d"]);
    const p = { "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1D" }[period];
    const out = []; let end = Date.now();
    for (let guard = 0; guard < 20 && end > from; guard++) {
      const r = await getJson(`${OKX_REST}/api/v5/rubik/stat/contracts/open-interest-history?instId=${okxInst(symbol)}&period=${p}&limit=100&end=${end}`);
      if (!r.data || !r.data.length) break;
      for (const x of r.data) out.push({ t: num(x[0]), oi: num(x[2]) });
      const first = Math.min(...r.data.map(x => num(x[0])));
      if (first >= end) break;
      end = first - 1;
      await sleep(120); // giới hạn tần suất của OKX
    }
    return dedupe(out);
  },
  // lệnh thanh lý đã xảy ra (OKX cho tải lại khoảng vài ngày gần nhất)
  async liqHistory(symbol, info, from) {
    const inst = okxInst(symbol), uly = inst.replace("-SWAP", ""), cv = (info && info.ctVal) || 1, out = [];
    let after = "";
    for (let guard = 0; guard < 10; guard++) {
      const r = await getJson(`${OKX_REST}/api/v5/public/liquidation-orders?instType=SWAP&uly=${uly}&state=filled&limit=100${after ? "&after=" + after : ""}`);
      const det = (r.data || []).flatMap(d => d.details || []);
      if (!det.length) break;
      for (const x of det) out.push({ p: num(x.bkPx), q: num(x.sz) * cv, side: x.posSide === "short" || (x.posSide === "net" && x.side === "buy") ? "short" : "long", t: num(x.ts) });
      const first = Math.min(...det.map(x => num(x.ts)));
      if (first <= from || String(first) === after) break;
      after = String(first); await sleep(150);
    }
    return out.filter(x => x.t >= from).sort((a, b) => a.t - b.t);
  },
  connect(symbol, info, book, h) {
    const inst = okxInst(symbol), cv = info.ctVal || 1;
    const ws = openSocket(OKX_WS, {
      name: "OKX", onStatus: h.onStatus, ping: () => "ping", pingMs: 20000,
      onOpen: s => s.send(JSON.stringify({ op: "subscribe", args: [
        { channel: "books", instId: inst }, { channel: "trades", instId: inst },
        { channel: "liquidation-orders", instType: "SWAP" },
      ] })),
      onMessage: msg => {
        const ch = msg.arg && msg.arg.channel, data = msg.data; if (!data) return;
        if (ch === "trades") h.onTrades(data.map(t => ({ p: num(t.px), q: num(t.sz) * cv, side: t.side, t: num(t.ts) })));
        else if (ch === "books") {
          if (msg.action === "snapshot") book.clear();
          for (const d of data) {
            for (const l of d.bids) book.set("bid", num(l[0]), num(l[1]) * cv);
            for (const l of d.asks) book.set("ask", num(l[0]), num(l[1]) * cv);
            book.ts = num(d.ts);
          }
          h.onBook();
        } else if (ch === "liquidation-orders") {
          const out = [];
          for (const d of data) {
            if (d.instId !== inst) continue;
            for (const x of d.details) out.push({ p: num(x.bkPx), q: num(x.sz) * cv, side: x.posSide === "short" || (x.posSide === "net" && x.side === "buy") ? "short" : "long", t: num(x.ts) });
          }
          if (out.length) h.onLiq(out);
        }
      },
    });
    return ws;
  },
};

// ---------- Bybit (linear USDT) ----------
const BY_REST = "https://api.bybit.com";
const BY_WS = "wss://stream.bybit.com/v5/public/linear";
const BY_INT = { "1m": "1", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };

const bybit = {
  id: "BYBIT", name: "Bybit", hasLiq: true, hasOi: true, oiDays: 60,
  async listSymbols() {
    const r = await getJson(`${BY_REST}/v5/market/tickers?category=linear`);
    return r.result.list.filter(x => x.symbol.endsWith("USDT"))
      .map(x => ({ symbol: x.symbol, last: num(x.lastPrice), change: num(x.price24hPcnt) * 100, volUsd: num(x.turnover24h) }));
  },
  async info(symbol) {
    const r = await getJson(`${BY_REST}/v5/market/instruments-info?category=linear&symbol=${symbol}`);
    if (!r.result.list.length) throw new Error(`Bybit không có mã ${symbol}`);
    return { tick: num(r.result.list[0].priceFilter.tickSize), ctVal: 1 };
  },
  async klines(symbol, interval, n) {
    return pageBackward(async end => {
      const r = await getJson(`${BY_REST}/v5/market/kline?category=linear&symbol=${symbol}&interval=${BY_INT[interval]}&limit=1000&end=${end}`);
      return r.result.list.map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[5]), bv: null }));
    }, n, INTERVALS[interval]);
  },
  async fundingHistory(symbol, from) {
    const out = []; let end = Date.now();
    for (let guard = 0; guard < 30 && end > from; guard++) {
      const r = await getJson(`${BY_REST}/v5/market/funding/history?category=linear&symbol=${symbol}&limit=200&endTime=${end}`);
      const list = r.result.list || []; if (!list.length) break;
      for (const x of list) out.push({ t: num(x.fundingRateTimestamp), rate: num(x.fundingRate) });
      const first = Math.min(...list.map(x => num(x.fundingRateTimestamp)));
      if (first >= end) break;
      end = first - 1;
    }
    return dedupe(out);
  },
  async oiHistory(symbol, interval, from) {
    const period = oiPeriod(interval, ["5m", "15m", "1h", "4h", "1d"]);
    const p = { "5m": "5min", "15m": "15min", "1h": "1h", "4h": "4h", "1d": "1d" }[period];
    const out = []; let end = Date.now();
    for (let guard = 0; guard < 30 && end > from; guard++) {
      const r = await getJson(`${BY_REST}/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=${p}&limit=200&endTime=${end}`);
      const list = r.result.list || []; if (!list.length) break;
      for (const x of list) out.push({ t: num(x.timestamp), oi: num(x.openInterest) });
      const first = Math.min(...list.map(x => num(x.timestamp)));
      if (first >= end) break;
      end = first - 1;
    }
    return dedupe(out);
  },
  connect(symbol, info, book, h) {
    return openSocket(BY_WS, {
      name: "Bybit", onStatus: h.onStatus, ping: () => JSON.stringify({ op: "ping" }),
      onOpen: s => s.send(JSON.stringify({ op: "subscribe", args: [`orderbook.1000.${symbol}`, `publicTrade.${symbol}`, `allLiquidation.${symbol}`] })),
      onMessage: msg => {
        const topic = msg.topic || "", data = msg.data; if (!data) return;
        if (topic.startsWith("publicTrade.")) h.onTrades(data.map(t => ({ p: num(t.p), q: num(t.v), side: t.S === "Buy" ? "buy" : "sell", t: num(t.T) })));
        else if (topic.startsWith("orderbook.")) {
          if (msg.type === "snapshot") book.clear();
          for (const [p, q] of data.b || []) book.set("bid", num(p), num(q));
          for (const [p, q] of data.a || []) book.set("ask", num(p), num(q));
          book.ts = num(msg.ts); h.onBook();
        } else if (topic.startsWith("allLiquidation.")) {
          // S = "Buy": vị thế long bị thanh lý (theo tài liệu Bybit)
          h.onLiq(data.map(x => ({ p: num(x.p), q: num(x.v), side: x.S === "Buy" ? "long" : "short", t: num(x.T) })));
        }
      },
    });
  },
};

// ---------- Hyperliquid ----------
const HL_REST = "https://api.hyperliquid.xyz/info";
const HL_WS = "wss://api.hyperliquid.xyz/ws";
const hlCoin = symbol => symbol.toUpperCase().replace(/(USDT|USDC|USD)$/, "");

const hyperliquid = {
  id: "HYPERLIQUID", name: "Hyperliquid", hasLiq: false, hasOi: false, oiDays: 0,
  async listSymbols() {
    const [meta, ctxs] = await postJson(HL_REST, { type: "metaAndAssetCtxs" });
    return meta.universe.map((u, i) => {
      const c = ctxs[i] || {}, last = num(c.markPx), prev = num(c.prevDayPx);
      return { symbol: u.name + "USDT", last, change: prev ? (last / prev - 1) * 100 : 0, volUsd: num(c.dayNtlVlm) };
    });
  },
  async info() { return { tick: 0, ctVal: 1 }; }, // bước giá suy ra từ sổ lệnh
  async klines(symbol, interval, n) {
    const ms = INTERVALS[interval], end = Date.now(), start = end - ms * Math.min(n, 5000);
    const rows = await postJson(HL_REST, { type: "candleSnapshot", req: { coin: hlCoin(symbol), interval, startTime: start, endTime: end } });
    return rows.map(x => ({ t: num(x.t), o: num(x.o), h: num(x.h), l: num(x.l), c: num(x.c), v: num(x.v), bv: null }));
  },
  async oiHistory() { return []; },
  // funding của Hyperliquid tính theo từng giờ
  async fundingHistory(symbol, from) {
    const out = []; let start = Math.max(from, Date.now() - 60 * 864e5);
    for (let guard = 0; guard < 40 && start < Date.now(); guard++) {
      const rows = await postJson(HL_REST, { type: "fundingHistory", coin: hlCoin(symbol), startTime: start });
      if (!rows.length) break;
      for (const x of rows) out.push({ t: num(x.time), rate: num(x.fundingRate) });
      const last = Math.max(...rows.map(x => num(x.time)));
      if (last <= start || rows.length < 400) break;
      start = last + 1;
    }
    return dedupe(out);
  },
  connect(symbol, info, book, h) {
    const coin = hlCoin(symbol);
    return openSocket(HL_WS, {
      name: "Hyperliquid", onStatus: h.onStatus, ping: () => JSON.stringify({ method: "ping" }), pingMs: 30000,
      onOpen: s => {
        s.send(JSON.stringify({ method: "subscribe", subscription: { type: "l2Book", coin } }));
        s.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin } }));
      },
      onMessage: msg => {
        if (msg.channel === "trades") h.onTrades(msg.data.map(t => ({ p: num(t.px), q: num(t.sz), side: t.side === "B" ? "buy" : "sell", t: num(t.time) })));
        else if (msg.channel === "l2Book") {
          const [bids, asks] = msg.data.levels; book.clear(); // mỗi tin là ảnh chụp 20 mức mỗi bên
          for (const x of bids) book.set("bid", num(x.px), num(x.sz));
          for (const x of asks) book.set("ask", num(x.px), num(x.sz));
          book.ts = num(msg.data.time); h.onBook();
        }
      },
    });
  },
};

// ---------- Giả lập: chạy được khi không có mạng, để tập và kiểm thử ----------
function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

const sim = {
  id: "SIM", name: "Giả lập", hasLiq: true, hasOi: true, oiDays: 3650,
  _price: 65000, _anchor: 65000,
  async listSymbols() { return [{ symbol: "BTCUSDT", last: this._price, change: 0, volUsd: 1e9 }]; },
  async info() { return { tick: 0.1, ctVal: 1 }; },
  _bars(interval, n, symbol = "BTCUSDT") {
    // mỗi mã giả lập một chuỗi giá riêng (BTCUSDT giữ nguyên chuỗi cũ)
    const seed = symbol === "BTCUSDT" ? 0 : [...symbol].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 100003, 7);
    const ms = INTERVALS[interval], r = prng(7 + ms / 1000 + seed), out = [];
    let p = 52000, oi = 80000, t = Math.floor(Date.now() / ms) * ms - (n - 1) * ms;
    const vol = 0.0035 * Math.sqrt(ms / 60e3) / 3;
    let regime = 0;
    for (let i = 0; i < n; i++, t += ms) {
      if (r() < 0.01) regime = (r() - 0.5) * vol * 0.6;
      const o = p, ret = regime + gauss(r) * vol * (r() < 0.03 ? 3 : 1);
      const c = o * Math.exp(ret), h = Math.max(o, c) * (1 + Math.abs(gauss(r)) * vol * 0.6), l = Math.min(o, c) * (1 - Math.abs(gauss(r)) * vol * 0.6);
      const v = 400 * Math.sqrt(ms / 60e3) * Math.exp(gauss(r) * 0.5 + (Math.abs(ret) / vol) * 0.4);
      const bv = v * Math.min(0.95, Math.max(0.05, 0.5 + ret / vol * 0.15 + gauss(r) * 0.05));
      oi = Math.max(1000, oi * (1 + gauss(r) * 0.004 + (Math.abs(ret) > vol * 2 ? -0.01 : 0.0015)));
      out.push({ t, o, h, l, c, v, bv, oi }); p = c;
    }
    // đưa giá cuối về đúng giá đang chạy để nến lịch sử khớp với sổ lệnh giả lập
    const k = out.length ? this._anchor / out[out.length - 1].c : 1;
    for (const b of out) { b.o *= k; b.h *= k; b.l *= k; b.c *= k; }
    return out;
  },
  async klines(symbol, interval, n) { this._anchor = this._price; return this._bars(interval, n, symbol).map(({ oi, ...b }) => b); },
  async oiHistory(symbol, interval, from) {
    const ms = INTERVALS[interval];
    return this._bars(interval, Math.min(20000, Math.ceil((Date.now() - from) / ms) + 1)).map(b => ({ t: b.t + ms, oi: b.oi }));
  },
  async fundingHistory(symbol, from) {
    const r = prng(99), out = []; let f = 0.0001;
    for (let t = Math.floor(from / 288e5) * 288e5; t <= Date.now(); t += 288e5) { f = Math.max(-0.0008, Math.min(0.0012, f * 0.9 + 0.00001 + gauss(r) * 0.00008)); out.push({ t, rate: f }); }
    return out;
  },
  connect(symbol, info, book, h) {
    const r = prng(Date.now() & 0xffff), tick = 0.1;
    let mid = this._price, drift = 0, twap = null;
    const walls = new Map(), spoofs = new Set();
    // lệnh chờ ở mỗi mức giá đứng yên khá lâu và thay đổi dần như sổ lệnh thật; phân phối lệch (đa số mỏng, ít mức dày)
    const lv = new Map(), lvl = (p, d) => {
      let q = lv.get(p);
      if (q === undefined || r() < 0.01) { q = Math.exp(gauss(r) * 0.9) * 0.35 * (1 + d * 0.004); lv.set(p, q); }
      return q;
    };
    const rebuild = () => {
      if (lv.size > 20000) lv.clear();
      book.clear();
      const bb = Math.floor(mid / tick) * tick;
      for (let i = 0; i < 1200; i++) {
        // gần giá: từng bước 0,1; xa giá: thưa dần như sổ lệnh thật
        const d = i < 200 ? i : 200 + (i - 200) * 5;
        const pb = +(bb - d * tick).toFixed(1), pa = +(bb + (d + 1) * tick).toFixed(1);
        book.set("bid", pb, lvl(pb, d) + (walls.get(pb) || 0));
        book.set("ask", pa, lvl(pa, d) + (walls.get(pa) || 0));
      }
      book.ts = Date.now();
    };
    h.onStatus("Đang chạy dữ liệu giả lập", true);
    const timer = setInterval(() => {
      if (r() < 0.02) drift = (r() - 0.5) * 0.4;
      if (r() < 0.05) { // tường thanh khoản xuất hiện / biến mất
        const p = +(Math.round((mid + (r() - 0.5) * 300) / 0.5) * 0.5).toFixed(1);
        walls.set(p, 150 + r() * 300);
        if (r() < 0.5) spoofs.add(p);
        if (walls.size > 12) { const k = walls.keys().next().value; walls.delete(k); spoofs.delete(k); }
      }
      for (const p of spoofs) if (Math.abs(p - mid) < 3) { walls.delete(p); spoofs.delete(p); } // tường giả: rút khi giá tới gần
      if (!twap && r() < 0.002) twap = { side: r() < 0.5 ? "buy" : "sell", q: +(0.5 + r() * 3).toFixed(3), every: 1500 + r() * 3000, left: 8 + Math.floor(r() * 12), next: Date.now() };
      const trades = [], now = Date.now(), n = 1 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const side = r() < 0.5 + drift * 0.5 ? "buy" : "sell";
        mid += (side === "buy" ? 1 : -1) * tick * (r() < 0.3 ? Math.ceil(r() * 4) : 0);
        const q = r() < 0.02 ? 5 + r() * 30 : Math.exp(gauss(r)) * 0.15;
        const p = side === "buy" ? Math.ceil(mid / tick) * tick : Math.floor(mid / tick) * tick;
        trades.push({ p: +p.toFixed(1), q, side, t: now });
      }
      this._price = mid;
      h.onTrades(trades);
      if (twap && now >= twap.next) { // thuật toán chia lệnh: cùng kích thước, nhịp đều
        h.onTrades([{ p: +(twap.side === "buy" ? Math.ceil(mid / tick) * tick : Math.floor(mid / tick) * tick).toFixed(1), q: twap.q, side: twap.side, t: now + 1 }]);
        twap.next = now + twap.every * (0.95 + r() * 0.1); if (--twap.left <= 0) twap = null;
      }
      if (r() < 0.004) h.onLiq([{ p: +mid.toFixed(1), q: 0.2 + r() * 6, side: r() < 0.5 ? "long" : "short", t: now }]);
      rebuild(); h.onBook();
    }, 100);
    rebuild(); h.onBook();
    return { close() { clearInterval(timer); } };
  },
};

function oiPeriod(interval, allowed) {
  const ms = INTERVALS[interval];
  let best = allowed[0];
  for (const p of allowed) if (INTERVALS[p] <= ms) best = p;
  return best;
}

function dedupe(rows) {
  const m = new Map(); for (const r of rows) m.set(r.t, r);
  return [...m.values()].sort((a, b) => a.t - b.t);
}

export const EXCHANGES = { BINANCE: binance, OKX: okx, BYBIT: bybit, HYPERLIQUID: hyperliquid, SIM: sim };

// Gắn open interest vào từng nến: lấy giá trị gần nhất tính tới lúc nến đóng
export function attachOi(bars, oiRows, intervalMs) {
  let j = 0;
  for (const b of bars) {
    const close = b.t + intervalMs;
    while (j + 1 < oiRows.length && oiRows[j + 1].t <= close) j++;
    b.oi = oiRows.length && oiRows[j].t <= close && close - oiRows[j].t <= Math.max(intervalMs, 3600e3) * 2 ? oiRows[j].oi : null;
  }
  return bars;
}

// Gắn funding vào từng nến: mức funding đã chốt gần nhất tính tới lúc nến đóng
export function attachFunding(bars, rows, intervalMs) {
  let j = -1;
  for (const b of bars) {
    const close = b.t + intervalMs;
    while (j + 1 < rows.length && rows[j + 1].t <= close) j++;
    b.fund = j >= 0 ? rows[j].rate : null;
  }
  return bars;
}

// Bước giá của sổ lệnh suy ra từ khoảng cách nhỏ nhất giữa các mức giá
export function inferTick(prices) {
  let d = Infinity;
  for (let i = 1; i < prices.length; i++) { const x = Math.abs(prices[i] - prices[i - 1]); if (x > 1e-12) d = Math.min(d, x); }
  return isFinite(d) ? niceStep(d) : 0;
}

// ---------- giá dự phòng khi sàn chính nghẽn ----------
// 2 nến gần nhất (gồm nến đang chạy) của một sàn, bỏ cuộc sau 2,5 giây
async function quick(url) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 2500);
  try { return await getJson(url, { signal: ac.signal }); } finally { clearTimeout(t); }
}
const LAST = {
  BINANCE: async (s, iv) => (await quick(`${BN_REST}/fapi/v1/klines?symbol=${s}&interval=${iv}&limit=2`)).map(r => ({ t: r[0], o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[5]), bv: num(r[9]) })),
  BYBIT: async (s, iv) => (await quick(`${BY_REST}/v5/market/kline?category=linear&symbol=${s}&interval=${BY_INT[iv]}&limit=2`)).result.list.map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[5]), bv: null })).reverse(),
  OKX: async (s, iv) => (await quick(`${OKX_REST}/api/v5/market/candles?instId=${okxInst(s)}&bar=${OKX_BAR[iv]}&limit=2`)).data.map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[6]), bv: null })).reverse(),
};
export const FALLBACK_ORDER = ["BINANCE", "BYBIT", "OKX"];
// thử sàn đang chọn trước, nghẽn hoặc lỗi thì lần lượt Binance, Bybit, OKX (chỉ mã USDT); trả về { bars, ex }
export async function lastBarsFailover(primary, symbol, interval) {
  const order = [primary, ...(/USDT$/.test(symbol) ? FALLBACK_ORDER.filter(x => x !== primary) : [])];
  let err = null;
  for (const id of order) {
    try {
      const bars = LAST[id] ? await LAST[id](symbol, interval) : await EXCHANGES[id].klines(symbol, interval, 2);
      if (bars.length) return { bars, ex: id };
    } catch (e) { err = e; }
  }
  throw err || new Error("không sàn nào trả lời");
}

// đếm ngược tới lúc đóng nến (nến theo giờ UTC, như sàn); now nên đã trừ lệch đồng hồ so với sàn
export function candleCountdown(intervalMs, now = Date.now()) {
  const left = Math.ceil(now / intervalMs) * intervalMs - now || intervalMs, s = Math.ceil(left / 1000);
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60, p = v => String(v).padStart(2, "0");
  return { left, text: d ? `${d}n ${p(h)}:${p(m)}` : h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`, soon: left <= Math.min(30e3, intervalMs * 0.1) };
}
