// Lai Long Web: ghép dữ liệu, biểu đồ, phân tích và backtest thành một trang phân tích thuần giá và khối lượng.

import { EXCHANGES, attachOi, attachFunding, inferTick } from "./exchanges.js?v=202610141840";
import { MarketState } from "./market.js?v=202610141840";
import { Heatmap, HM_DEFAULTS } from "./heatmap.js?v=202610141840";
import { FlowChart } from "./flowchart.js?v=202610141840";
import { Dom } from "./dom.js?v=202610141840";
import { srLevels, abnormalVolume, liquidationMap, summary, volumeProfile, isDeltaApprox } from "./analytics.js?v=202610141840";
import { initBacktest } from "./backtestview.js?v=202610141840";
import { approxFootprint, exactFootprintBinance } from "./fphistory.js?v=202610141840";
import { absorption, absorptionStats, clusterSearch } from "./orderflow.js?v=202610141840";
import { Tape } from "./tape.js?v=202610141840";
import { LiqMap } from "./liqmap.js?v=202610141840";
import { vpin, percentileOf, groupFlow, algoRuns, signalScore, SCORE_PARTS } from "./flowtools.js?v=202610141840";
import { WallTracker, WALL_KIND } from "./walls.js?v=202610141840";
import { DOM_COLS } from "./dom.js?v=202610141840";
import { initFractal } from "./fractalview.js?v=202610141840";
import { GLOSSARY, GROUPS } from "./glossary.js?v=202610141840";
import { T, THEMES, EDITABLE, applyTheme, loadTheme, alpha } from "./theme.js?v=202610141840";
import { fmtVol, fmtUsd, fmtPct, fmtTime, fmtDate, decimalsFor, INTERVALS, getJson, fitCanvas, MONO } from "./util.js?v=202610141840";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
loadTheme();

// ---------- trạng thái ----------
const saved = (() => { try { return JSON.parse(localStorage.getItem("lailong.ui") || "{}"); } catch { return {}; } })();
const qs = new URLSearchParams(location.search);
const S = {
  ex: qs.get("ex") || saved.ex || "BINANCE",
  symbol: (qs.get("s") || saved.symbol || "BTCUSDT").toUpperCase(),
  interval: qs.get("i") || saved.interval || "1m",
  view: qs.get("v") || saved.view || "terminal",
  mode: saved.mode === "box" ? "box" : "heat", // trang Nến đã bỏ: chỉ còn Bookmap và Footprint
  tab: "absorb",
};
if (!EXCHANGES[S.ex]) S.ex = "BINANCE";
if (!INTERVALS[S.interval]) S.interval = "1m";
const persist = () => {
  try { localStorage.setItem("lailong.ui", JSON.stringify({ ex: S.ex, symbol: S.symbol, interval: S.interval, view: S.view, mode: S.mode })); } catch { /* bỏ qua */ }
  const u = new URL(location.href); u.searchParams.set("ex", S.ex); u.searchParams.set("s", S.symbol); u.searchParams.set("i", S.interval); u.searchParams.set("v", S.view);
  history.replaceState(null, "", u);
};
const ex = () => EXCHANGES[S.ex];
const key = () => `${S.ex}:${S.symbol}`;
const coin = () => S.symbol.replace(/(USDT|USDC|USD)$/, "");
const GL = new Map(GLOSSARY.map(g => [g.id, g]));
// tiêu đề cột: "chữ" hoặc ["chữ", id thuật ngữ] để rê chuột ra giải thích
const th = h => Array.isArray(h) ? `<th data-g="${h[1]}">${h[0]}</th>` : `<th>${h}</th>`;
function table(head, rows, empty) {
  if (!rows.length) return `<div class="empty">${empty}</div>`;
  return `<table><thead><tr>${head.map(th).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

const market = new MarketState();
const logs = [];
function log(text) { logs.unshift({ t: Date.now(), text }); if (logs.length > 300) logs.pop(); if (S.tab === "logs") renderTab(); }
function toast(text, err) { const el = $("toast"); el.textContent = text; el.className = "toast" + (err ? " err" : ""); el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 4000); }

const heat = new Heatmap($("heat"), market, { exchangeName: () => ex().name });
const flow = new FlowChart($("flow"));
const dom = new Dom($("dom"), market);
const tape = new Tape($("tape"), market);
const walls = new WallTracker(); dom.walls = walls;
const lmap = new LiqMap($("lmap"), market, dom); lmap.walls = walls;
flow.prints = () => [market.histPrints, market.prints];
flow.opts.onRange = () => { if (S.tab === "absorb") renderTab(); };

// ---------- tải dữ liệu một mã ----------
let conn = null, loadToken = 0, analysis = null, fpState = null;
async function load() {
  const token = ++loadToken; persist();
  if (conn) { conn.close(); conn = null; }
  market.reset({ symbol: S.symbol, exchange: S.ex, interval: S.interval });
  heat.resetView(); dom.reset(); flow.setData([], {}); flow.fpProgress = ""; flow.ranges = []; analysis = null; fpState = null; absorb = []; clusters = null; scores = null; algo = []; walls.reset(); flow.setOverlays({ spoofs: walls.events, algoRuns: [], scores: [], vpinVals: null, groupVals: null }); tape.reset(); renderSignals(); renderTab();
  setConn("Đang tải dữ liệu", null);
  let info = { tick: 0, ctVal: 1 };
  try { info = await ex().info(S.symbol); } catch (e) { log(`Không lấy được thông tin mã: ${e.message}`); }
  if (token !== loadToken) return;
  market.tick = info.tick;
  conn = ex().connect(S.symbol, info, market.book, {
    onBook: () => {
      if (token !== loadToken) return;
      if (!market.tick) { const s = market.book.sorted(); market.tick = inferTick(s.bids.slice(0, 30).map(x => x[0])); }
      market.onBook(); dom.update();
    },
    onTrades: list => { if (token !== loadToken) return; market.onTrades(list); },
    onLiq: list => { if (token !== loadToken) return; market.onLiq(list); },
    onStatus: (text, ok) => { if (token === loadToken) { setConn(text, ok); log(text); } },
  });
  try {
    const bars = await ex().klines(S.symbol, S.interval, 1500);
    if (ex().hasOi && bars.length) {
      try { attachOi(bars, await ex().oiHistory(S.symbol, S.interval, bars[0].t), INTERVALS[S.interval]); }
      catch (e) { log(`Không tải được open interest: ${e.message}`); }
    }
    if (ex().fundingHistory && bars.length) {
      try { attachFunding(bars, await ex().fundingHistory(S.symbol, bars[0].t - 864e5), INTERVALS[S.interval]); }
      catch (e) { log(`Không tải được lịch sử funding: ${e.message}`); }
    }
    if (token !== loadToken) return;
    market.setBars(bars);
    flow.setData(market.bars, { step: market.fpStep, tick: market.tick, intervalMs: market.intervalMs, symbol: S.symbol, exchangeName: ex().name, interval: S.interval, deltaApprox: isDeltaApprox(bars) });
    recompute();
    log(`Đã tải ${bars.length} nến ${S.interval} ${S.symbol} từ ${ex().name}`);
    if (S.mode !== "heat") startFootprint();
    seedDayVolume(token);
  } catch (e) {
    log(`Không tải được nến: ${e.message}`); toast(`Không tải được dữ liệu từ ${ex().name}: ${e.message}`, true);
  }
}

// ---------- footprint cho mọi nến trên biểu đồ ----------
// Bước 1: ước tính từ nến nhỏ hơn (mọi sàn). Bước 2 (Binance): thay bằng từng lệnh khớp thật, từ nến mới về nến cũ.
function startFootprint() {
  if (!market.bars.length || fpState) return;
  const token = loadToken, isCur = () => token === loadToken;
  fpState = { token };
  flow.fpProgress = "đang dựng footprint cho các nến cũ..."; flow.dirty = true;
  approxFootprint(ex(), S.symbol, market, isCur).then(() => {
    if (!isCur()) return;
    if (ex().id !== "BINANCE") { flow.fpProgress = `${ex().name} không cho tải từng lệnh khớp cũ, nến trước lúc mở trang là ước tính`; flow.dirty = true; return; }
    let earliest = null;
    exactFootprintBinance(S.symbol, market, isCur, {
      onProgress: (done, max, e) => {
        if (done != null) { earliest = e; flow.fpProgress = `đang tải lệnh khớp thật từ Binance, đã tới ${fmtTime(e)}`; }
        else flow.fpProgress = earliest ? `lệnh khớp thật từ ${fmtTime(earliest, true)}, trước đó là ước tính` : "";
        flow.dirty = true;
      },
    }).catch(e => log(`Không tải được lệnh khớp cũ: ${e.message}`));
  });
}

// ---------- phân tích trên nến của khung đang xem ----------
function recompute() {
  const bars = market.bars; if (bars.length < 30) return;
  const levels = srLevels(bars, { maxLevels: 10 });
  const zonesAll = abnormalVolume(bars);
  const zones = zonesAll.filter(z => z.active).slice(-8);
  const liqMap = bars.some(b => b.oi != null) ? liquidationMap(bars) : null;
  analysis = { levels, zones, zonesAll, liqMap, sum: summary(bars, market.intervalMs) };
  heat.setOverlays({ levels, zones, liqMap, marks: priceMarks(bars) });
  flow.setOverlays({ levels, zones, liqMap });
  recomputeFlow();
  renderSignals();
  if (S.view === "analysis") renderAnalysis();
}
// Các mốc giá trong ngày (giờ UTC) từ nến đang có: giá mở cửa, đỉnh, đáy hôm nay và đỉnh, đáy hôm qua
function priceMarks(bars) {
  if (!bars.length) return [];
  const D = 864e5, today = Math.floor(bars[bars.length - 1].t / D) * D, out = [];
  const span = (from, to) => { let h = -Infinity, l = Infinity, o = null; for (const b of bars) if (b.t >= from && b.t < to) { if (o === null) o = b.o; h = Math.max(h, b.h); l = Math.min(l, b.l); } return o === null ? null : { o, h, l }; };
  const td = span(today, today + D), yd = span(today - D, today);
  if (td) out.push({ price: td.o, label: "Mở cửa ngày", kind: "open" }, { price: td.h, label: "Đỉnh hôm nay", kind: "hi" }, { price: td.l, label: "Đáy hôm nay", kind: "lo" });
  if (yd && bars[0].t <= today - D + market.intervalMs) out.push({ price: yd.h, label: "Đỉnh hôm qua", kind: "hi", prev: true }, { price: yd.l, label: "Đáy hôm qua", kind: "lo", prev: true });
  return out;
}
market.on(kind => {
  if (kind === "newbar") recompute();
  if (kind === "footprint") { flow.refresh(); scheduleFlow(); }
  if (kind === "trades" || kind === "liq") { flow.refresh(); scheduleUi(); }
});
let uiTimer = null;
function scheduleUi() { if (uiTimer) return; uiTimer = setTimeout(() => { uiTimer = null; flow.bigQ = market.bigPrint; if (S.tab === "big") renderTab(); }, 1000); }
setInterval(() => { if (market.bars.length) recompute(); }, 15000);

function trendTag(label, score) {
  const cls = score > 15 ? "up" : score < -15 ? "down" : "flat";
  return `<span class="tag ${cls}">${esc(label || "-")}</span>`;
}
function renderSignals() {
  const el = $("signalbar");
  if (!analysis) { el.innerHTML = `<span>Đang tính xu hướng, động lượng, biến động...</span>`; return; }
  const { trend: t, momentum: m, volatility: v } = analysis.sum, lv = analysis.levels;
  const last = market.bars[market.bars.length - 1].c, dec = decimalsFor(market.tick || market.fpStep);
  const sup = lv.filter(x => x.price < last).sort((a, b) => b.price - a.price)[0];
  const res = lv.filter(x => x.price > last).sort((a, b) => a.price - b.price)[0];
  el.innerHTML = [
    ["trend-score", `Xu hướng ${S.interval}: ${trendTag(t.label, t.score)} <b>${t.score == null ? "-" : t.score.toFixed(0)}</b>`],
    ["structure", `Cấu trúc: <b>${esc(t.structure || "-")}</b>`],
    ["momentum", `Động lượng: ${trendTag(m.label, m.score)}`],
    ["vol-regime", `Biến động: <b>${esc(v.regime || "-")}</b> (${v.percentile == null ? "-" : v.percentile.toFixed(0)}%, ATR ${v.atrPct == null ? "-" : v.atrPct.toFixed(2)}%)`],
    ["sr-level", `HT gần: <b class="pos">${sup ? sup.price.toFixed(dec) : "-"}</b>`],
    ["sr-level", `KC gần: <b class="neg">${res ? res.price.toFixed(dec) : "-"}</b>`],
  ].map(([g, x]) => `<span data-g="${g}">${x}</span>`).join("");
}

// ---------- hấp thụ, cụm khối lượng (tính trên nến của khung đang xem) ----------
let absorb = [], clusters = null, flowTimer = null, algo = [], scores = null;
const CL = { on: false, metric: "volume", top: 0.005, min: 0 };
function recomputeFlow() {
  if (market.bars.length < 60) return;
  absorb = absorption(market.bars, { step: market.fpStep });
  clusters = CL.on ? clusterSearch(market.bars, { metric: CL.metric, topPct: CL.top, minValue: CL.min, step: market.fpStep }) : null;
  const vp = vpin(market.bars, { intervalMs: market.intervalMs }), vv = vp.filter(v => v != null).sort((a, b) => a - b);
  scores = signalScore(market.bars, { absorb });
  flow.setOverlays({ absorb, clusters: clusters ? clusters.cells : [], vpinVals: vp, vpinHi: vv.length ? vv[Math.floor(vv.length * 0.9)] : null, vpinPct: percentileOf(vp, vp[vp.length - 1]), scores: scores.events });
  flow.bigQ = market.bigPrint;
  recomputePrints();
  if (["absorb", "clusters", "score"].includes(S.tab)) renderTab();
}
// nhóm người chơi và lệnh chia đều: tính lại theo lệnh gốc (cả lịch sử tải lại lẫn trực tiếp)
function recomputePrints() {
  if (!market.bars.length) return;
  const lists = [market.histPrints, market.prints];
  flow.setOverlays({ groupVals: groupFlow(market.bars, lists, { big: market.bigPrint, mid: market.midPrint, intervalMs: market.intervalMs }) });
  const n = market.histPrints.length + market.prints.length; if (n < 200) return;
  const qs = []; for (const l of lists) for (let i = 0; i < l.length; i += Math.max(1, Math.floor(n / 20000))) qs.push(l[i].q);
  qs.sort((a, b) => a - b);
  for (const l of lists) for (const p of l) p.algo = false;
  algo = algoRuns(lists, { minQ: qs[Math.floor(qs.length * 0.6)] });
  for (const r of algo) for (const p of r.prints) p.algo = true;
  flow.setOverlays({ algoRuns: algo });
  if (S.tab === "algo") renderTab();
}
setInterval(() => { if (S.mode !== "heat" || S.tab === "algo") recomputePrints(); }, 5000);
// tường lệnh chờ: so sổ lệnh mỗi giây
setInterval(() => {
  const cols = market.cols; let col = null; for (let i = cols.length - 1; i >= Math.max(0, cols.length - 4); i--) if (cols[i].keys) { col = cols[i]; break; }
  const done = walls.step(Date.now(), col, market.book.mid(), market.grid, market.tradedGrid);
  if (done.length) { flow.dirty = true; if (S.tab === "spoof") renderTab(); }
}, 1000);
function scheduleFlow() { if (flowTimer) return; flowTimer = setTimeout(() => { flowTimer = null; recomputeFlow(); }, 1500); }

// khối lượng tại giá trong ngày (UTC) cho cột "Hôm nay" của Smart DOM, dựng từ nến 1 phút
async function seedDayVolume(token) {
  const start = market.dayStart, n = Math.min(1440, Math.ceil((Date.now() - start) / 60e3) + 1);
  try {
    const bars = await ex().klines(S.symbol, "1m", n);
    if (token !== loadToken || !market.tick) return;
    const tk = market.tick, liveStart = market.liveStart || Date.now();
    for (const b of bars) {
      if (b.t < start || b.t + 60e3 > liveStart) continue; // phần sau lúc mở trang đã có từ lệnh khớp trực tiếp
      const k1 = Math.round(b.l / tk), k2 = Math.round(b.h / tk), cnt = k2 - k1 + 1, st = Math.max(1, Math.ceil(cnt / 400));
      for (let k = k1; k <= k2; k += st) market.dayVol.set(k, (market.dayVol.get(k) || 0) + b.v * Math.min(st, k2 - k + 1) / cnt);
    }
  } catch (e) { log(`Không tải được khối lượng trong ngày: ${e.message}`); }
}

// ---------- các tab phía dưới ----------
let symbolRows = [], symbolFilter = "";
function renderTab() {
  const body = $("tabBody"), dec = decimalsFor(market.tick);
  const coinName = coin();
  if (S.tab === "absorb") {
    const st = absorptionStats(absorb), pct = g => isFinite(g.pct) ? g.pct.toFixed(0) + "%" : "-";
    const res = { reversed: ["Đúng", "pos"], failed: ["Sai", "neg"], unclear: ["Không rõ", "muted"], pending: ["Đang chờ", "muted"] };
    body.innerHTML = `<div class="signalbar"><span data-g="absorption">Khung ${S.interval}, ${market.bars.length} nến: hấp thụ bán (đỏ) <b>${st.sell.n}</b> lần, đúng <b class="pos">${pct(st.sell)}</b> · hấp thụ mua (xanh) <b>${st.buy.n}</b> lần, đúng <b class="pos">${pct(st.buy)}</b></span>${flow.ranges.length ? `<span data-g="range-profile">Vùng tự chọn: <b>${flow.ranges.length}</b> (chuột phải để xoá)</span>` : ""}</div>` +
      table(["Nến", ["Loại", "absorption"], "Giá", "KL nến", ["Độ lệch", "sigma"], "Chủ động ở mép", "Đóng cửa", "Độ mạnh", "Sau đó", ""],
        absorb.slice(-150).reverse().map(e => { const r = res[e.fwd.result]; return `<tr class="click" data-goto="${e.t}"><td>${fmtDate(e.t)}</td><td class="t ${e.side === "sell" ? "neg" : "pos"}">${e.side === "sell" ? "Hấp thụ bán (đáy)" : "Hấp thụ mua (đỉnh)"}</td><td>${e.price.toFixed(dec)}</td><td>${fmtVol(e.vol)}</td><td>${e.z.toFixed(1)}σ</td><td>${fmtVol(e.edgeVol)} (${(e.edgeShare * 100).toFixed(0)}%)</td><td>${((e.side === "sell" ? e.closePos : 1 - e.closePos) * 100).toFixed(0)}% từ mép</td><td>${e.strength}</td><td class="t ${r[1]}">${r[0]}${e.fwd.result === "reversed" ? ` (+${e.fwd.bestAtr.toFixed(1)} ATR, ${e.fwd.bars} nến)` : ""}</td><td class="t muted">${e.exact ? "" : "ước tính"}</td></tr>`; }),
        "Chưa có nến hấp thụ nào trong dữ liệu đang xem.");
  } else if (S.tab === "clusters") {
    body.innerHTML = !CL.on ? `<div class="empty">Bật "Tìm cụm ▾" trên biểu đồ để tìm các ô footprint có khối lượng lớn bất thường.</div>` : !clusters ? `<div class="empty">Đang tính...</div>` :
      `<div class="signalbar"><span data-g="cluster-search">Ngưỡng: <b>${fmtVol(clusters.threshold)} ${coinName}</b> · tìm thấy <b>${clusters.cells.length}</b> ô</span></div>` +
      table(["Nến", "Giá", "Bán", "Mua", "Tổng", ["Delta", "delta"], ""], clusters.cells.map(c => `<tr class="click" data-goto="${c.t}"><td>${fmtDate(c.t)}</td><td>${c.price.toFixed(dec)}</td><td class="neg">${fmtVol(c.sell)}</td><td class="pos">${fmtVol(c.buy)}</td><td>${fmtVol(c.sell + c.buy)}</td><td class="${c.buy >= c.sell ? "pos" : "neg"}">${c.buy >= c.sell ? "+" : ""}${fmtVol(c.buy - c.sell)}</td><td class="t muted">${c.approx ? "ước tính" : ""}</td></tr>`), "Không có ô nào vượt ngưỡng.");
  } else if (S.tab === "big") {
    const all = market.prints.concat(market.histPrints).filter(p => p.q >= market.bigPrint).sort((a, b) => b.t - a.t).slice(0, 300);
    body.innerHTML = `<div class="signalbar"><span data-g="big-trades">Ngưỡng Big Trade (top 0,5% lệnh gốc đã ghép): <b>${isFinite(market.bigPrint) ? fmtVol(market.bigPrint) + " " + coinName : "đang tính"}</b>${market.histPrints.length ? ` · gồm ${fmtVol(market.histPrints.length)} lệnh gốc tải lại từ ${ex().name}` : ""}</span></div>` +
      table(["Thời gian", ["Phía", "aggressor"], "Giá TB", "Khối lượng", "Giá trị", ["Số lệnh nhỏ", "smart-tape"], ["Mức giá quét", "sweep"]], all.map(t => `<tr class="click" data-goto="${t.t}"><td>${fmtTime(t.t, true)}</td><td class="${t.side === "buy" ? "pos" : "neg"}">${t.side === "buy" ? "MUA" : "BÁN"}</td><td>${t.vwap.toFixed(dec)}</td><td>${fmtVol(t.q)}</td><td>${fmtUsd(t.vwap * t.q)}</td><td>${t.n}</td><td>${t.levels}</td></tr>`), "Chưa có Big Trade.");
  } else if (S.tab === "score") {
    if (!scores) { body.innerHTML = `<div class="empty">Đang tính...</div>`; return; }
    const pct = x => isFinite(x) ? x.toFixed(0) + "%" : "-", B = scores.base || {};
    body.innerHTML = `<div class="signalbar"><span data-g="signal-score">Khung ${S.interval}, ${market.bars.length} nến · <b>${scores.events.length}</b> tín hiệu điểm ≥ 20 · tỷ lệ nền (vào ở mọi nến): mua <b>${pct(B.buy)}</b>, bán <b>${pct(B.sell)}</b>${scores.hasFund ? "" : " · không có funding nên điểm tính trên 85"}</span><span>Hiện trên biểu đồ từ điểm <select id="scoreMin">${[40, 50, 60, 70, 80].map(v => `<option${v === flow.scoreMin ? " selected" : ""}>${v}</option>`).join("")}</select></span></div>` +
      table(["Mức điểm", "Số lần", "Đúng", "Sai", ["Tỷ lệ đúng", "signal-score"], "Tỷ lệ nền", "Hơn nền"], scores.buckets.map(b => `<tr><td>${b.lo} – ${b.hi}</td><td>${b.n}</td><td class="pos">${b.win}</td><td class="neg">${b.loss}</td><td><b>${pct(b.pct)}</b></td><td class="muted">${pct(b.base)}</td><td class="${b.pct - b.base >= 0 ? "pos" : "neg"}">${isFinite(b.pct - b.base) ? (b.pct - b.base >= 0 ? "+" : "") + (b.pct - b.base).toFixed(0) + " điểm" : "-"}</td></tr>`), "Chưa đủ dữ liệu.") +
      `<p class="note">Đúng = giá đi 1 ATR theo hướng tín hiệu trước khi đi ngược 1 ATR, trong 10 nến. "Tỷ lệ nền" là kết quả nếu vào lệnh ở mọi nến theo cùng luật: một mức điểm chỉ có ý nghĩa khi đúng nhiều hơn nền rõ ràng và có ít nhất khoảng 100 lần.</p>` +
      table(["Nến", "Phía", "Điểm", ...SCORE_PARTS.map(x => x.label), "Lý do", "Sau đó"], scores.events.slice(-150).reverse().map(e => { const r = { win: ["Đúng", "pos"], loss: ["Sai", "neg"], flat: ["Đi ngang", "muted"], pending: ["Đang chờ", "muted"] }[e.fwd.result]; return `<tr class="click" data-goto="${e.t}"><td>${fmtDate(e.t)}</td><td class="${e.side === "buy" ? "pos" : "neg"}">${e.side === "buy" ? "MUA" : "BÁN"}</td><td><b>${e.score}</b></td>${SCORE_PARTS.map(x => `<td>${e.parts[x.id] ? e.parts[x.id].toFixed(0) : "-"}</td>`).join("")}<td class="t">${esc(e.why.join("; "))}</td><td class="t ${r[1]}">${r[0]}</td></tr>`; }), "Chưa có tín hiệu.");
    const sm = $("scoreMin"); if (sm) sm.onchange = () => { flow.scoreMin = +sm.value; flow.dirty = true; };
  } else if (S.tab === "algo") {
    body.innerHTML = `<div class="signalbar"><span data-g="algo-twap">Chuỗi lệnh gốc cùng phía, cùng kích thước, cách nhau đều đặn (ít nhất 6 lệnh, độ lệch nhịp ≤ 30%) · tìm thấy <b>${algo.length}</b> chuỗi trong ${fmtVol(market.histPrints.length + market.prints.length)} lệnh gốc</span></div>` +
      table(["Bắt đầu", "Kết thúc", "Phía", "KL mỗi lệnh", "Số lệnh", "Nhịp", "Độ đều", "Tổng KL", "Giá trị", "Giá TB", "Giá đi"], algo.slice(0, 300).map(r => `<tr class="click" data-goto="${r.t0}"><td>${fmtTime(r.t0, true)}</td><td>${fmtTime(r.t1, true)}</td><td class="${r.side === "buy" ? "pos" : "neg"}">${r.side === "buy" ? "MUA" : "BÁN"}</td><td>${fmtVol(r.size)}</td><td>${r.n}</td><td>${(r.gapMs / 1000).toFixed(1)} giây</td><td>${((1 - r.cv) * 100).toFixed(0)}%</td><td>${fmtVol(r.total)}</td><td>${fmtUsd(r.total * r.vwap)}</td><td>${r.vwap.toFixed(dec)}</td><td class="${r.last >= r.first ? "pos" : "neg"}">${r.first.toFixed(dec)} → ${r.last.toFixed(dec)}</td></tr>`), market.histPrints.length + market.prints.length < 200 ? "Đang chờ đủ lệnh khớp..." : "Chưa thấy chuỗi lệnh chia đều nào.");
  } else if (S.tab === "spoof") {
    const ev = walls.events.slice().reverse(), cnt = k => walls.events.filter(e => e.kind === k).length;
    body.innerHTML = `<div class="signalbar"><span data-g="spoofing">Từ lúc mở trang: <b class="neg">${cnt("spoof")}</b> lần rút khi giá tới gần (nghi tường giả) · <b>${cnt("pulled")}</b> lần rút khi giá còn xa · <b class="pos">${cnt("filled")}</b> lần bị ăn (tường thật) · đang đứng <b>${walls.active().length}</b> tường</span></div>` +
      table(["Thời gian", "Phía", "Giá", "KL tường", "Đứng", "Cách giá lúc dựng", "Cách giá lúc mất", "Đã khớp tại đó", "Kết luận"], ev.slice(0, 300).map(e => { const k = WALL_KIND[e.kind]; return `<tr class="click" data-goto="${e.t}"><td>${fmtTime(e.t, true)}</td><td class="${e.side === "bid" ? "pos" : "neg"}">${e.side === "bid" ? "Chờ mua" : "Chờ bán"}</td><td>${e.price.toFixed(dec)}</td><td>${fmtVol(e.q)}</td><td>${(e.life / 1000).toFixed(0)} giây</td><td>${e.dist0.toFixed(dec)}</td><td>${e.dist.toFixed(dec)}</td><td>${fmtVol(e.traded)} (${e.q ? (e.traded / e.q * 100).toFixed(0) : 0}%)</td><td class="t ${k.cls}">${k.label} (${k.note})</td></tr>`; }), "Chưa có tường nào biến mất. Bộ theo dõi chạy từ lúc mở trang.");
  } else if (S.tab === "symbols") {
    const f = symbolFilter.toUpperCase(), rows = symbolRows.filter(r => !f || r.symbol.includes(f)).slice(0, 300);
    body.innerHTML = `<div class="signalbar"><input id="symFilter" placeholder="Tìm mã..." value="${esc(symbolFilter)}" style="width:160px"></div>` +
      table(["Mã", "Giá", "24h", "Khối lượng 24h"], rows.map(r => `<tr class="click${r.symbol === S.symbol ? " active" : ""}" data-sym="${esc(r.symbol)}"><td>${esc(r.symbol)}</td><td>${r.last}</td><td class="${r.change >= 0 ? "pos" : "neg"}">${fmtPct(r.change)}</td><td>${fmtUsd(r.volUsd)}</td></tr>`), "Đang tải danh sách mã...");
    const inp = $("symFilter"); inp.oninput = () => { symbolFilter = inp.value; renderTab(); const i2 = $("symFilter"); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); };
  } else if (S.tab === "logs") {
    body.innerHTML = table(["Thời gian", "Nội dung"], logs.map(x => `<tr><td>${fmtTime(x.t, true)}</td><td class="t">${esc(x.text)}</td></tr>`), "Chưa có nhật ký.");
  }
}
$("tabBody").addEventListener("click", e => {
  const r = e.target.closest("[data-sym]"); if (r) { S.symbol = r.dataset.sym; $("symbol").value = S.symbol; load(); return; }
  const g = e.target.closest("[data-goto]"); if (g) goToTime(+g.dataset.goto);
});
// đưa biểu đồ nến/footprint tới nến chứa thời điểm t
function goToTime(t) {
  if (S.mode === "heat") setMode("box");
  const i = flow._barIndexAt(t); if (i < 0) return;
  const vis = flow._L ? flow._L.pw / flow.sp : 20;
  flow.offset = Math.max(-flow.bars.length + 3, flow.bars.length - 1 - i - vis / 2); flow.dirty = true;
}
async function loadSymbols() {
  symbolRows = [];
  try {
    symbolRows = (await ex().listSymbols()).sort((a, b) => b.volUsd - a.volUsd);
    $("symbolList").innerHTML = symbolRows.slice(0, 400).map(r => `<option value="${esc(r.symbol)}">`).join("");
  } catch (e) { log(`Không tải được danh sách mã: ${e.message}`); }
  if (S.tab === "symbols") renderTab();
}

// ---------- trang Phân tích ----------
const mtfCache = new Map();
async function renderAnalysis() {
  if (!analysis) { $("mtfTable").innerHTML = `<div class="empty">Đang tải dữ liệu...</div>`; return; }
  const dec = decimalsFor(market.tick || market.fpStep), last = market.bars[market.bars.length - 1].c;
  $("srInfo").textContent = `khung ${S.interval}, giá ${last.toFixed(dec)}`;
  $("srTable").innerHTML = table(["Mức giá", "Loại", "Khoảng cách", ["Số lần chạm", "sr-touches"], ["Số lần test", "sr-tests"], "Test gần nhất", ["Trạng thái", "sr-status"], ["Độ mạnh", "sr-strength"]],
    analysis.levels.slice().sort((a, b) => b.price - a.price).map(l => `<tr><td>${l.price.toFixed(dec)}</td><td class="t ${l.kind === "support" ? "pos" : "neg"}">${l.kind === "support" ? "Hỗ trợ" : "Kháng cự"}</td><td>${fmtPct(l.distancePct)}</td><td>${l.touches}</td><td>${l.tests}</td><td>${l.lastTestT ? fmtDate(l.lastTestT) : "-"}</td><td class="t">${l.flipped ? "Đã đảo vai" : l.broken ? "Đã bị phá" : "Còn giữ"}</td><td><span class="bar"><i style="left:0;width:${l.strength}%;background:var(--accent)"></i></span>${l.strength.toFixed(0)}</td></tr>`),
    "Chưa đủ dữ liệu.");
  $("zoneTable").innerHTML = table(["Thời gian", ["Phía", "aggressor"], "Vùng giá", ["Độ lệch", "sigma"], "Khối lượng", ["Trạng thái", "zone-status"]],
    analysis.zonesAll.slice(-25).reverse().map(z => `<tr><td>${fmtDate(z.t)}</td><td class="t ${z.side === "buy" ? "pos" : "neg"}">${z.side === "buy" ? "Mua chủ động" : "Bán chủ động"}</td><td>${z.low.toFixed(dec)} – ${z.high.toFixed(dec)}</td><td>${z.z.toFixed(1)}σ</td><td>${fmtVol(z.volume)}</td><td class="t">${z.active ? "Còn hiệu lực" : "Đã bị xuyên qua"}</td></tr>`),
    "Không có nến khối lượng bất thường trong dữ liệu đã tải.");
  renderAbsorptionCard();
  const vp = volumeProfile(market.bars.slice(-500));
  const near = (arr, n) => arr.slice().sort((a, b) => Math.abs(a - last) - Math.abs(b - last)).slice(0, n).sort((a, b) => b - a).map(x => x.toFixed(dec)).join(", ") || "-";
  $("vpStats").innerHTML = `<div class="kv"><span>Phạm vi</span><b>500 nến ${S.interval} gần nhất</b><span data-g="poc">POC (giá nhiều KL nhất)</span><b>${vp.poc == null ? "-" : vp.poc.toFixed(dec)}</b><span data-g="value-area">Vùng giá trị 70%</span><b>${vp.val == null ? "-" : vp.val.toFixed(dec) + " – " + vp.vah.toFixed(dec)}</b><span data-g="hvn">Nút khối lượng cao (HVN)</span><b>${near(vp.hvn, 6)}</b><span data-g="lvn">Nút khối lượng thấp (LVN)</span><b>${near(vp.lvn, 6)}</b></div><p class="note">HVN thường là vùng giá dễ bị hút về và đi ngang; LVN là vùng giá dễ chạy nhanh qua.</p>`;
  renderDvol();
  const tfs = ["5m", "15m", "1h", "4h", "1d"], rows = [];
  for (const tf of tfs) {
    const ck = `${S.ex}:${S.symbol}:${tf}`; let c = mtfCache.get(ck);
    if (!c || Date.now() - c.t > 60e3) {
      try { const bars = tf === S.interval ? market.bars : await ex().klines(S.symbol, tf, 500); c = { t: Date.now(), s: summary(bars, INTERVALS[tf]) }; mtfCache.set(ck, c); }
      catch (e) { c = { t: 0, err: e.message }; }
    }
    if (c.err) { rows.push(`<tr><td>${tf}</td><td colspan="7" class="t muted">Lỗi: ${esc(c.err)}</td></tr>`); continue; }
    const { trend: t, momentum: m, volatility: v } = c.s;
    const sc = x => x == null ? "-" : `<span class="bar"><i style="${x >= 0 ? "left:50%" : `left:${50 + x / 2}%`};width:${Math.abs(x) / 2}%;background:${x >= 0 ? "var(--buy)" : "var(--sell)"}"></i></span>${x.toFixed(0)}`;
    rows.push(`<tr><td>${tf}</td><td>${trendTag(t.label, t.score)}</td><td>${sc(t.score)}</td><td class="t">${esc(t.structure || "-")}</td><td>${trendTag(m.label, m.score)} ${sc(m.score)}</td><td>${fmtPct(m.roc10)}</td><td class="t">${esc(v.regime || "-")} (${v.percentile == null ? "-" : v.percentile.toFixed(0)}%)</td><td>${v.realized == null ? "-" : v.realized.toFixed(0) + "%"} · ATR ${v.atrPct == null ? "-" : v.atrPct.toFixed(2) + "%"}</td></tr>`);
  }
  $("mtfTable").innerHTML = table([["Khung", "mtf"], "Xu hướng", ["Điểm xu hướng", "trend-score"], ["Cấu trúc", "structure"], ["Động lượng", "momentum"], ["Thay đổi 10 nến", "roc"], ["Chế độ biến động", "vol-regime"], ["Biến động năm hoá", "realized-vol"]], rows, "");
}

const absCache = new Map();
async function renderAbsorptionCard() {
  const rows = [];
  for (const tf of ["5m", "15m", "1h", "4h", "1d"]) {
    const ck = `${S.ex}:${S.symbol}:${tf}`; let c = absCache.get(ck);
    if (tf === S.interval) c = { t: Date.now(), ev: absorb, bars: market.bars, exact: true };
    else if (!c || Date.now() - c.t > 120e3) {
      try { const bars = await ex().klines(S.symbol, tf, 500); c = { t: Date.now(), ev: absorption(bars), bars }; absCache.set(ck, c); }
      catch (e) { rows.push(`<tr><td>${tf}</td><td colspan="7" class="t muted">Lỗi: ${esc(e.message)}</td></tr>`); continue; }
    }
    const st = absorptionStats(c.ev), last = c.ev[c.ev.length - 1], dec = decimalsFor(market.tick || 0.01), pct = g => isFinite(g.pct) ? `${g.pct.toFixed(0)}%` : "-";
    rows.push(`<tr><td>${tf}${tf === S.interval ? " ★" : ""}</td><td>${c.bars.length}</td><td class="neg">${st.sell.n}</td><td class="pos">${pct(st.sell)}</td><td class="pos">${st.buy.n}</td><td class="pos">${pct(st.buy)}</td><td class="t">${last ? `${last.side === "sell" ? "Hấp thụ bán" : "Hấp thụ mua"} ${last.price.toFixed(dec)} lúc ${fmtDate(last.t)}` : "-"}</td></tr>`);
  }
  $("absInfo").textContent = `${S.symbol} · ${ex().name}`;
  $("absTable").innerHTML = table([["Khung", "mtf"], "Số nến", ["Hấp thụ bán", "absorption"], "Đúng", ["Hấp thụ mua", "absorption"], "Đúng", "Gần nhất"], rows, "");
}

let dvolCache = null;
async function renderDvol() {
  const c = coin(), box = $("dvolStats");
  if (c !== "BTC" && c !== "ETH") { box.innerHTML = `<p class="note">Deribit chỉ công bố chỉ số biến động quyền chọn DVOL cho BTC và ETH.</p>`; return; }
  try {
    if (!dvolCache || dvolCache.c !== c || Date.now() - dvolCache.t > 300e3) {
      const end = Date.now(), start = end - 30 * 86400e3;
      const r = await getJson(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${c}&start_timestamp=${start}&end_timestamp=${end}&resolution=3600`);
      dvolCache = { c, t: Date.now(), data: r.result.data.map(x => ({ t: x[0], v: x[4] })).sort((a, b) => a.t - b.t) };
    }
    const d = dvolCache.data, cur = d[d.length - 1].v, day = d[Math.max(0, d.length - 25)].v;
    const pct = d.filter(x => x.v <= cur).length / d.length * 100, rv = analysis.sum.volatility.realized;
    const daily = cur / Math.sqrt(365);
    box.innerHTML = `<div class="kv"><span data-g="dvol">DVOL hiện tại (biến động kỳ vọng 30 ngày)</span><b>${cur.toFixed(1)}%</b><span data-g="dvol">Tương đương mỗi ngày</span><b>khoảng ±${daily.toFixed(2)}%</b><span>Thay đổi 24 giờ</span><b class="${cur >= day ? "pos" : "neg"}">${(cur - day >= 0 ? "+" : "") + (cur - day).toFixed(1)} điểm</b><span>Vị trí trong 30 ngày</span><b>${pct.toFixed(0)}%</b><span data-g="realized-vol">Biến động thực tế (${S.interval})</span><b>${rv == null ? "-" : rv.toFixed(1) + "%"}</b><span data-g="dvol">Chênh lệch kỳ vọng − thực tế</span><b>${rv == null ? "-" : (cur - rv).toFixed(1) + " điểm"}</b></div>` +
      `<p class="note">Nghĩa là thị trường quyền chọn đang trả giá cho mức dao động khoảng ±${daily.toFixed(1)}% mỗi ngày trong 30 ngày tới. Vị trí ${pct.toFixed(0)}% trong 30 ngày: ${pct >= 80 ? "đang ở mức cao, thị trường đang lo sợ" : pct <= 20 ? "đang ở mức thấp, thị trường đang bình yên (thường đi trước một đợt biến động)" : "ở mức trung bình"}.</p>`;
    const cv = $("dvolCanvas"), F = cv._fit || (cv._fit = fitCanvas(cv, () => renderDvol())), ctx = F.ctx;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, F.w, F.h);
    const lo = Math.min(...d.map(x => x.v)), hi = Math.max(...d.map(x => x.v));
    ctx.strokeStyle = "#c678dd"; ctx.lineWidth = 1.5; ctx.beginPath();
    d.forEach((x, i) => { const px = i / (d.length - 1) * (F.w - 40), py = 8 + (hi - x.v) / (hi - lo || 1) * (F.h - 24); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
    ctx.fillStyle = T.muted; ctx.font = `11px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(hi.toFixed(0), F.w - 36, 14); ctx.fillText(lo.toFixed(0), F.w - 36, F.h - 12); ctx.fillText("DVOL 30 ngày", 4, F.h - 3);
  } catch (e) { box.innerHTML = `<p class="note">Không tải được DVOL từ Deribit: ${esc(e.message)}</p>`; }
}

// ---------- trang Backtest ----------
const btChart = new FlowChart($("btChart"), { emptyText: "Bấm \"Chạy backtest\" để xem điểm vào/ra lệnh trên biểu đồ" });
btChart.show = { ...btChart.show, liq: false, liqMap: false, cvd: false, oi: false, profile: false };
// ---------- chú thích khi rê chuột ----------
const tipEl = $("tip");
const fractal = initFractal({ $, S, ex, esc, table, log });
const backtest = initBacktest({ $, S, ex, esc, table, market, chart: btChart });
// nhấp đúp vào ô thông số (Backtest, FRACTAL) để trả về giá trị mặc định
document.addEventListener("dblclick", e => {
  const el = e.target.closest(".btform input[type=number], .btform input[type=text], .btform select, .hmcfg input, .hmcfg select"); if (!el) return;
  if (el.type === "checkbox") { el.checked = el.defaultChecked; } else if (el.tagName === "SELECT") { const d = [...el.options].findIndex(o => o.defaultSelected); el.selectedIndex = d < 0 ? 0 : d; } else el.value = el.defaultValue;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.classList.add("reset"); setTimeout(() => el.classList.remove("reset"), 500);
});
const CANVAS_TIP = { heat, flow, dom, tape, lmap, btChart, ...fractal.tips, ...backtest.tips };
let tipFrame = 0, lastMove = null;
function showTip(html, x, y) {
  tipEl.innerHTML = html; tipEl.hidden = false;
  const r = tipEl.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  let lx = x + 16, ly = y + 18;
  if (lx + r.width > W - 6) lx = Math.max(6, x - r.width - 16);
  if (ly + r.height > H - 6) ly = Math.max(6, y - r.height - 14);
  tipEl.style.left = lx + "px"; tipEl.style.top = ly + "px";
}
const hideTip = () => { tipEl.hidden = true; };
function tipFor(e) {
  const t = e.target;
  if (!(t instanceof Element) || document.body.classList.contains("resizing")) return hideTip();
  if (t.tagName === "CANVAS" && CANVAS_TIP[t.id]) {
    const c = CANVAS_TIP[t.id];
    if (c.drag) return hideTip();
    const r = t.getBoundingClientRect(), s = c.hitTest(e.clientX - r.left, e.clientY - r.top);
    return s ? showTip(esc(s), e.clientX, e.clientY) : hideTip();
  }
  const el = t.closest("[data-g],[data-tip]");
  if (!el) return hideTip();
  const g = el.dataset.g && GL.get(el.dataset.g);
  if (g) return showTip(`<b>${esc(g.term)}</b>${esc(g.short)}<small>Bấm vào để đọc giải thích đầy đủ</small>`, e.clientX, e.clientY);
  if (el.dataset.tip) return showTip(esc(el.dataset.tip), e.clientX, e.clientY);
  hideTip();
}
const noHover = matchMedia("(hover: none)").matches; // điện thoại: không có rê chuột
document.addEventListener("mousemove", e => { if (noHover) return; lastMove = e; if (!tipFrame) tipFrame = requestAnimationFrame(() => { tipFrame = 0; tipFor(lastMove); }); });
document.addEventListener("mouseleave", hideTip);
// điện thoại: giữ ngón tay khoảng nửa giây để xem ý nghĩa (thay cho rê chuột)
if (noHover) {
  let lp = null;
  const cancel = () => { if (lp) clearTimeout(lp.timer); lp = null; };
  document.addEventListener("touchstart", e => {
    cancel(); hideTip(); if (e.touches.length !== 1) return;
    const t = e.touches[0], ev = { target: e.target, clientX: t.clientX, clientY: t.clientY };
    lp = { x: t.clientX, y: t.clientY, timer: setTimeout(() => { tipFor(ev); navigator.vibrate?.(15); }, 450) };
  }, { passive: true });
  document.addEventListener("touchmove", e => { if (lp && Math.hypot(e.touches[0].clientX - lp.x, e.touches[0].clientY - lp.y) > 10) cancel(); }, { passive: true });
  document.addEventListener("touchend", cancel);
  document.addEventListener("contextmenu", e => { if (e.target.tagName === "CANVAS") e.preventDefault(); });
}
document.addEventListener("mousedown", hideTip);

// ---------- ngăn giải thích thuật ngữ ----------
function renderGlossary(filter = "") {
  const f = filter.trim().toLowerCase(), plain = s => s.replace(/<[^>]+>/g, " ").toLowerCase();
  let html = "";
  for (const grp of GROUPS) {
    const items = GLOSSARY.filter(g => g.group === grp && (!f || (g.term + " " + g.short + " " + plain(g.body)).toLowerCase().includes(f)));
    if (!items.length) continue;
    html += `<h4>${esc(grp)}</h4>` + items.map(g => `<details id="g-${g.id}"${f ? " open" : ""}><summary><span>${esc(g.term)}<small>${esc(g.short)}</small></span></summary><div class="gbody">${g.body}</div></details>`).join("");
  }
  $("glossBody").innerHTML = html || `<div class="empty">Không tìm thấy thuật ngữ nào.</div>`;
}
function openGloss(id) {
  $("glossary").hidden = false; $("glossBtn").classList.add("on");
  if (!id) return;
  if ($("glossSearch").value) { $("glossSearch").value = ""; renderGlossary(); }
  const d = document.getElementById("g-" + id); if (!d) return;
  d.open = true; d.scrollIntoView({ block: "start", behavior: "smooth" });
  d.classList.add("flash"); setTimeout(() => d.classList.remove("flash"), 1500);
}
const closeGloss = () => { $("glossary").hidden = true; $("glossBtn").classList.remove("on"); };
renderGlossary();
$("glossSearch").oninput = () => renderGlossary($("glossSearch").value);
$("glossBtn").onclick = () => $("glossary").hidden ? openGloss() : closeGloss();
$("glossClose").onclick = closeGloss;
document.addEventListener("click", e => {
  const el = e.target.closest(".q[data-g], th[data-g], span[data-g], .stat[data-g], .dom-cols [data-g]");
  if (el) { e.preventDefault(); openGloss(el.dataset.g); }
});

// ---------- màu giao diện ----------
function renderThemePanel() {
  $("themePresets").innerHTML = Object.entries(THEMES).map(([id, t]) => `<button data-preset="${id}"><i style="background:${t.bg}"></i><i style="background:${t.text}"></i><i style="background:${t.accent}"></i><i style="background:${t.up}"></i><i style="background:${t.down}"></i> ${esc(t.name)}</button>`).join("");
  $("themeColors").innerHTML = EDITABLE.map(([k, label]) => `<label for="c-${k}">${esc(label)}</label><input type="color" id="c-${k}" data-color="${k}" value="${T[k]}">`).join("");
}
renderThemePanel();
$("themeBtn").onclick = () => { const p = $("themePanel"); p.hidden = !p.hidden; $("themeBtn").classList.toggle("on", !p.hidden); };
$("themeClose").onclick = () => { $("themePanel").hidden = true; $("themeBtn").classList.remove("on"); };
$("themePresets").onclick = e => { const b = e.target.closest("[data-preset]"); if (b) { applyTheme({ ...THEMES[b.dataset.preset] }); renderThemePanel(); } };
$("themeColors").oninput = e => {
  const k = e.target.dataset.color; if (!k) return;
  const patch = { [k]: e.target.value };
  if (k === "panel") patch.panel2 = mix(e.target.value, "#ffffff", 0.06);
  if (k === "bg") patch.grid = mix(e.target.value, "#ffffff", 0.08);
  applyTheme(patch);
};
function mix(a, b, f) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, "0")).join("");
}
window.addEventListener("lailong-theme", () => {
  heat.dirty = flow.dirty = dom.dirty = tape.dirty = btChart.dirty = true;
  backtest.redraw();
  if (S.view === "analysis" && analysis) renderAnalysis();
});

// ---------- kéo giãn khung và phóng to ----------
const LAYOUT_KEY = "lailong.layout";
const ws = $("view-terminal");
const layout = (() => { try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}"); } catch { return {}; } })();
function setLayout(k, v) {
  if (v == null) { delete layout[k]; ws.style.removeProperty("--" + k); } else { layout[k] = v; ws.style.setProperty("--" + k, v + "px"); }
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* bỏ qua */ }
}
for (const k of ["rightW", "bottomH", "tapeW", "lmapW"]) if (layout[k]) ws.style.setProperty("--" + k, layout[k] + "px");
function splitter(el, k, calc) {
  el.addEventListener("pointerdown", e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing"); el.classList.add("drag"); hideTip();
    const move = ev => setLayout(k, Math.round(calc(ev, ws.getBoundingClientRect())));
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); document.body.classList.remove("resizing"); el.classList.remove("drag"); heat.dirty = flow.dirty = dom.dirty = tape.dirty = lmap.dirty = true; };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  });
  el.addEventListener("dblclick", () => setLayout(k, null));
}
splitter($("splitV"), "rightW", (e, r) => { const tw = $("tapePanel").offsetWidth + 6; return Math.min(r.width - tw - 320, Math.max(220, r.right - e.clientX - tw - 4)); });
splitter($("splitM"), "lmapW", e => Math.max(120, Math.min(900, $("lmapPanel").getBoundingClientRect().right - e.clientX - 3)));
splitter($("splitT"), "tapeW", (e, r) => Math.min(r.width - 600, Math.max(200, r.right - e.clientX - 4)));
splitter($("splitH"), "bottomH", (e, r) => Math.min(r.height - 160, Math.max(60, r.bottom - e.clientY - 4)));

function setMax(id) {
  const p = id && $(id), on = p && !p.classList.contains("maxed");
  document.querySelectorAll(".panel.maxed").forEach(x => x.classList.remove("maxed"));
  if (on) p.classList.add("maxed");
  heat.dirty = flow.dirty = dom.dirty = tape.dirty = true;
}
for (const b of document.querySelectorAll("[data-max]")) b.onclick = () => setMax(b.dataset.max);
const topH = () => document.documentElement.style.setProperty("--topH", document.querySelector(".menubar").getBoundingClientRect().height + "px");
new ResizeObserver(topH).observe(document.querySelector(".menubar"));
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("glossary").hidden) return closeGloss();
  if (!$("themePanel").hidden) { $("themePanel").hidden = true; $("themeBtn").classList.remove("on"); return; }
  setMax(null);
});

// ---------- điều khiển giao diện ----------
function setConn(text, ok) { const p = $("connPill"); p.className = "pill" + (ok === true ? " ok" : ok === false ? " bad" : ""); p.querySelector("span").textContent = text; }
function setView(v) {
  S.view = v; persist();
  for (const b of $("views").children) b.classList.toggle("on", b.dataset.view === v);
  for (const id of ["terminal", "analysis", "backtest", "fractal"]) $("view-" + id).hidden = id !== v;
  document.body.classList.toggle("not-terminal", v !== "terminal");
  heat.dirty = flow.dirty = btChart.dirty = dom.dirty = true;
  if (v === "analysis") renderAnalysis();
}
function setMode(m) {
  S.mode = m; persist();
  for (const b of $("chartMode").children) b.classList.toggle("on", b.dataset.mode === m);
  $("heat").hidden = m !== "heat"; $("flow").hidden = m === "heat";
  $("contrastBox").hidden = m !== "heat"; $("rowBox").hidden = m !== "box";
  $("chartHint").textContent = noHover ? (m === "heat" ? "Kéo: di chuyển · Chụm/mở hai ngón: phóng thời gian (ngang) và giá (dọc) · Chạm đúp: theo dõi · Giữ ngón tay: xem ý nghĩa" : "Kéo: di chuyển · Chụm/mở hai ngón: phóng nến · Chạm đúp: về hiện tại · Giữ ngón tay lên nến: xem ý nghĩa") : m === "heat" ? "Lăn chuột: phóng thời gian · Ctrl + lăn: phóng giá · Kéo: di chuyển · Bấm đúp: theo dõi · Rê chuột để xem ý nghĩa" : "Lăn chuột: phóng to · Kéo: di chuyển · Kéo trục giá: giãn giá · Bấm đúp: về hiện tại · Rê chuột lên nến để xem ý nghĩa";
  if (m !== "heat") flow.setType("box");
  if (m !== "heat") startFootprint();
  for (const el of document.querySelectorAll(".flowOnly")) el.hidden = m === "heat";
  for (const el of document.querySelectorAll(".heatOnly")) el.hidden = m !== "heat";
  $("selBtn").hidden = m === "heat";
  heat.dirty = flow.dirty = true;
}

$("exchange").innerHTML = Object.values(EXCHANGES).map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
$("exchange").value = S.ex; $("symbol").value = S.symbol;
$("exchange").onchange = () => { S.ex = $("exchange").value; loadSymbols(); load(); };
$("symbol").addEventListener("change", () => { const v = $("symbol").value.trim().toUpperCase(); if (v && v !== S.symbol) { S.symbol = v; load(); } });
$("symbol").addEventListener("keydown", e => { if (e.key === "Enter") $("symbol").blur(); });
$("intervals").innerHTML = Object.keys(INTERVALS).map(i => `<button data-i="${i}" class="${i === S.interval ? "on" : ""}">${i}</button>`).join("");
$("intervals").onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; S.interval = b.dataset.i; for (const x of $("intervals").children) x.classList.toggle("on", x === b); load(); };
$("views").onclick = e => { const b = e.target.closest("[data-view]"); if (b) setView(b.dataset.view); };
$("chartMode").onclick = e => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); };
$("layerBtn").onclick = e => { e.stopPropagation(); $("layerBtn").parentElement.classList.toggle("open"); };
$("hmCfgBtn").onclick = e => { e.stopPropagation(); $("hmCfgBtn").parentElement.classList.toggle("open"); };
// Cài đặt Bookmap: đọc từ máy, gắn vào từng ô, lưu lại mỗi khi đổi
{
  const KEY = "lailong.hmcfg";
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* bỏ qua */ }
  for (const [k, v] of Object.entries(saved)) if (k in HM_DEFAULTS && typeof v === typeof HM_DEFAULTS[k]) heat.cfg[k] = v;
  for (const el of document.querySelectorAll("[data-hm]")) {
    const k = el.dataset.hm, d = HM_DEFAULTS[k];
    if (el.type === "checkbox") el.checked = !!heat.cfg[k]; else el.value = String(heat.cfg[k]);
    el.addEventListener("change", () => {
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (typeof d === "number") { v = +v; if (!isFinite(v) || el.value === "") v = d; if (el.min !== "") v = Math.max(+el.min, v); if (el.max !== "") v = Math.min(+el.max, v); }
      heat.cfg[k] = v; heat._cut = null; heat.dirty = true;
      try { localStorage.setItem(KEY, JSON.stringify(heat.cfg)); } catch { /* bỏ qua */ }
    });
  }
}
document.addEventListener("click", e => { if (!e.target.closest(".dropdown")) document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open")); });
for (const cb of document.querySelectorAll("[data-layer]")) {
  cb.onchange = () => { const k = cb.dataset.layer; if (k in heat.show) heat.show[k] = cb.checked; if (k in flow.show) flow.show[k] = cb.checked; heat.dirty = flow.dirty = true; };
  cb.onchange();
}
$("contrast").oninput = () => { heat.contrast = lmap.contrast = +$("contrast").value; heat.dirty = lmap.dirty = true; };
$("rowSize").onchange = () => { flow.rowMult = $("rowSize").value; flow.dirty = true; };
$("domMult").onchange = () => dom.setMult(+$("domMult").value);
$("domCenter").onclick = () => dom.recenter();
$("tabs").onclick = e => { const b = e.target.closest("[data-tab]"); if (!b) return; if (layout.bottomOff) bottomShow(true); S.tab = b.dataset.tab; for (const x of $("tabs").querySelectorAll("[data-tab]")) x.classList.toggle("on", x === b); renderTab(); };
$("fullscreenBtn").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => toast("Trình duyệt không cho phép toàn màn hình, bấm F11", true)); };

// ---------- công cụ order flow ----------
$("paneMode").onchange = () => { flow.pane = $("paneMode").value; if (flow.pane === "groups") recomputePrints(); flow.dirty = true; };
$("selBtn").onclick = () => { flow.selecting = !flow.selecting; $("selBtn").classList.toggle("on", flow.selecting); $("flow").style.cursor = flow.selecting ? "col-resize" : ""; };
$("clusterBtn").onclick = e => { e.stopPropagation(); $("clusterBtn").parentElement.classList.toggle("open"); };
const clUpdate = () => { CL.on = $("clOn").checked; CL.metric = $("clMetric").value; CL.top = +$("clTop").value; CL.min = +$("clMin").value || 0; $("clusterBtn").classList.toggle("on", CL.on); recomputeFlow(); };
for (const id of ["clOn", "clMetric", "clTop", "clMin"]) $(id).onchange = clUpdate;
// cột Smart DOM, nhớ trên trình duyệt
// điện thoại chưa chọn cột: mặc định ít cột cho vừa màn hình nhỏ (đổi trong "Cột ▾")
const domColsSaved = (() => { try { return JSON.parse(localStorage.getItem("lailong.domcols") || "null"); } catch { return null; } })() || (matchMedia("(max-width: 600px)").matches ? ["bid", "sells", "buys", "ask", "walls"] : null);
$("domColMenu").innerHTML = DOM_COLS.filter(c => c.id !== "price").map(c => `<label data-tip="${esc(c.tip)}"><input type="checkbox" data-domcol="${c.id}" ${!domColsSaved || domColsSaved.includes(c.id) ? "checked" : ""}> ${esc(c.label)}</label>`).join("");
const domColUpdate = () => { const ids = [...document.querySelectorAll("[data-domcol]")].filter(x => x.checked).map(x => x.dataset.domcol); dom.setColumns(ids); try { localStorage.setItem("lailong.domcols", JSON.stringify(ids)); } catch { /* bỏ qua */ } };
$("domColMenu").onchange = domColUpdate; domColUpdate();
$("domColBtn").onclick = e => { e.stopPropagation(); $("domColBtn").parentElement.classList.toggle("open"); };
$("domClear").onclick = () => { market.tradedAt.clear(); dom.dirty = true; };
$("tapeSmart").onchange = () => { tape.smart = $("tapeSmart").checked; tape.dirty = true; };
$("tapeBig").onchange = () => { tape.bigOnly = $("tapeBig").checked; tape.dirty = true; };
$("tapeMin").oninput = () => { tape.minQ = +$("tapeMin").value || 0; tape.dirty = true; };
$("lmapWin").onchange = () => lmap.setWindow(+$("lmapWin").value);
const lmapShow = on => { ws.classList.toggle("nolmap", !on); $("lmapShow").checked = on; setLayout("lmapOff", on ? null : 1); heat.dirty = flow.dirty = dom.dirty = tape.dirty = lmap.dirty = true; };
$("lmapShow").onchange = () => lmapShow($("lmapShow").checked);
$("lmapHide").onclick = () => lmapShow(false);
if (layout.lmapOff) lmapShow(false);
// thu gọn khung dưới và ẩn thanh công cụ biểu đồ để biểu đồ cao hơn
const redrawAll = () => { heat.dirty = flow.dirty = dom.dirty = tape.dirty = lmap.dirty = true; };
const bottomShow = on => { ws.classList.toggle("nobottom", !on); $("bottomFold").textContent = on ? "▾" : "▴"; setLayout("bottomOff", on ? null : 1); redrawAll(); };
$("bottomFold").onclick = () => bottomShow(!!layout.bottomOff);
if (layout.bottomOff) bottomShow(false);
const toolsShow = on => { ws.classList.toggle("notools", !on); $("toolsBtn").classList.toggle("on", on); setLayout("toolsOff", on ? null : 1); redrawAll(); };
$("toolsBtn").onclick = () => toolsShow(!!layout.toolsOff);
if (layout.toolsOff) toolsShow(false);
// điện thoại: thanh dưới cùng chọn khung đang xem
const mShow = id => {
  for (const b of $("mnav").children) b.classList.toggle("on", b.dataset.panel === id);
  // sổ lệnh đi kèm bản đồ thanh khoản bên trái (cùng dòng giá)
  for (const p of ws.querySelectorAll(":scope > .panel")) p.classList.toggle("mshow", p.id === id || (id === "domPanel" && p.id === "lmapPanel"));
  try { localStorage.setItem("lailong.mpanel", id); } catch { /* bỏ qua */ }
  redrawAll();
};
$("mnav").onclick = e => { const b = e.target.closest("[data-panel]"); if (b) mShow(b.dataset.panel); };
{ let id = null; try { id = localStorage.getItem("lailong.mpanel"); } catch { /* bỏ qua */ } mShow(id && $(id) && $("mnav").querySelector(`[data-panel="${id}"]`) ? id : "mainPanel"); }
// cài như ứng dụng (PWA): chạy được khi mạng chập chờn, mở từ màn hình chính
let installEv = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEv = e; $("installBtn").hidden = false; });
addEventListener("appinstalled", () => { installEv = null; $("installBtn").hidden = true; });
$("installBtn").onclick = async () => { if (!installEv) return; installEv.prompt(); await installEv.userChoice.catch(() => {}); installEv = null; $("installBtn").hidden = true; };
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
$("tapeGroup").onchange = () => { tape.group = $("tapeGroup").value; tape.dirty = true; };

setMode(S.mode); setView(S.view);
loadSymbols(); load();
window.lailong = { market, heat, flow, dom, tape, walls, lmap, S, alpha }; // tiện kiểm tra trong DevTools
