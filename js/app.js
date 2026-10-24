// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: ghép dữ liệu, biểu đồ, phân tích và backtest thành một trang phân tích thuần giá và khối lượng.

import { EXCHANGES, attachOi, attachFunding, inferTick, candleCountdown } from "./exchanges.js?v=202610240610";
import { MarketState, Book } from "./market.js?v=202610240610";
import { connectPeers, mergeBooks, multiPeers } from "./multibook.js?v=202610240610";
import { Heatmap, HM_DEFAULTS } from "./heatmap.js?v=202610240610";
import { FlowChart } from "./flowchart.js?v=202610240610";
import { TpoChart } from "./tpo.js?v=202610240610";
import { Dom } from "./dom.js?v=202610240610";
import { srLevels, abnormalVolume, liquidationMap, summary, volumeProfile, isDeltaApprox } from "./analytics.js?v=202610240610";
import { initBacktest } from "./backtestview.js?v=202610240610";
import { approxFootprint, exactFootprintBinance } from "./fphistory.js?v=202610240610";
import { absorption, absorptionStats, clusterSearch } from "./orderflow.js?v=202610240610";
import { Tape } from "./tape.js?v=202610240610";
import { LiqMap } from "./liqmap.js?v=202610240610";
import { vpin, percentileOf, groupFlow, algoRuns, signalScore, SCORE_PARTS, atrSeries } from "./flowtools.js?v=202610240610";
import { WallTracker, WALL_KIND, wallStats } from "./walls.js?v=202610240610";
import { Alerts } from "./alerts.js?v=202610240610";
import { binanceDerivs, deribitOptions } from "./derivs.js?v=202610240610";
import { initNews } from "./newsview.js?v=202610240610";
import { initMarkets } from "./marketsview.js?v=202610240610";
import { initGex } from "./gexview.js?v=202610240610";
import { initInst } from "./instview.js?v=202610240610";
import { setFresh, tickFresh } from "./fresh.js?v=202610240610";
import { initRadar } from "./radarview.js?v=202610240610";
import { Drawings } from "./drawings.js?v=202610240610";
import { Layout, NAMES as PANEL_NAMES, defaultTree } from "./layout.js?v=202610240610";
import { PaperBroker } from "./paper.js?v=202610240610";
import { OrderLines } from "./orderlines.js?v=202610240610";
import { MultiChart } from "./multichart.js?v=202610240610";
import { DOM_COLS } from "./dom.js?v=202610240610";
import { initFractal } from "./fractalview.js?v=202610240610";
import { initJournal } from "./journalview.js?v=202610240610";
import { installHealth, clockSkew } from "./health.js?v=202610240610";
import { initHealth } from "./healthview.js?v=202610240610";
import { initFlows } from "./flowsview.js?v=202610240610";
import { initPerf } from "./perfview.js?v=202610240610";
import { initShock } from "./shockview.js?v=202610240610";
import { initCompass } from "./compassview.js?v=202610240610";
import { initConsensus } from "./consensusview.js?v=202610240610";
import { initBackup, KEEP_KEYS } from "./backup.js?v=202610240610";
import { initSignals, isVerified, VERIFIED_KEY } from "./signalsview.js?v=202610240610";
import { logEvent, fromWall, fromIce, fromBig } from "./eventlog.js?v=202610240610";
import { liveZones, BUCKETS, bucketOf, KINDS as LEVEL_KINDS, CONFL_MIN } from "./levels.js?v=202610240610";
import { fromDeribit, pick as gexPick, levels as gexLevels } from "./gex.js?v=202610240610";
import { GLOSSARY, GROUPS } from "./glossary.js?v=202610240610";
import { T, THEMES, EDITABLE, applyTheme, loadTheme, alpha } from "./theme.js?v=202610240610";
import { fmtVol, fmtUsd, fmtPct, fmtTime, fmtDate, decimalsFor, INTERVALS, getJson, postJson, sleep, fitCanvas, MONO } from "./util.js?v=202610240610";

const $ = id => document.getElementById(id);
installHealth(); // ghi lại mọi lần gọi dữ liệu ra ngoài cho trang Sức khoẻ dữ liệu
// Tuỳ chỉnh (bố cục, cột, khung, màu, cài đặt biểu đồ…) chỉ giữ trong lúc tab còn mở (sessionStorage).
// Đóng tab rồi mở lại là về mặc định. Chỉ giữ lâu dài: nhật ký, tài khoản giả lập, bố cục bro tự bấm "Lưu",
// báo cáo hiệu suất, chiến lược đang forward test và mã Telegram (danh sách trong backup.js).
const KEEP = new Set(KEEP_KEYS);
try { for (const k of Object.keys(localStorage)) if (k.startsWith("lailong.") && !KEEP.has(k)) localStorage.removeItem(k); } catch { /* bỏ qua */ }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
loadTheme();

// ---------- trạng thái ----------
const saved = (() => { try { return JSON.parse(sessionStorage.getItem("lailong.ui") || "{}"); } catch { return {}; } })();
const qs = new URLSearchParams(location.search);
const S = {
  ex: qs.get("ex") || saved.ex || "BINANCE",
  symbol: (qs.get("s") || saved.symbol || "BTCUSDT").toUpperCase(),
  interval: qs.get("i") || saved.interval || "1m",
  view: qs.get("v") || saved.view || "terminal",
  mode: saved.mode === "box" ? "box" : "heat", // trang Nến đã bỏ: chỉ còn Bookmap và Footprint
  tab: "clusters",
  multi: !!saved.multi, // Multibook: gộp sổ lệnh nhiều sàn
};
if (!EXCHANGES[S.ex]) S.ex = "BINANCE";
if (!INTERVALS[S.interval]) S.interval = "1m";
const persist = () => {
  try { sessionStorage.setItem("lailong.ui", JSON.stringify({ ex: S.ex, symbol: S.symbol, interval: S.interval, view: S.view, mode: S.mode, multi: S.multi })); } catch { /* bỏ qua */ }
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

let peers = null;
const heat = new Heatmap($("heat"), market, { exchangeName: () => peers && peers.names().length ? [ex().name, ...peers.names()].join(" + ") : ex().name });
const flow = new FlowChart($("flow"));
const tpo = new TpoChart($("tpo"));
let tpoTimer = null;
{ // phiên TPO và khung "Đọc phiên"
  let ts = {}; try { ts = JSON.parse(sessionStorage.getItem("lailong.tpo") || "{}"); } catch { /* bỏ qua */ }
  if (ts.sess) { $("tpoSess").value = ts.sess; tpo.sessKind = ts.sess; }
  const saveTs = () => { try { sessionStorage.setItem("lailong.tpo", JSON.stringify({ sess: $("tpoSess").value, open: !$("tpoReadList").hidden })); } catch { /* bỏ qua */ } };
  if (ts.open === false) $("tpoReadList").hidden = true;
  $("tpoSess").onchange = () => { tpo.setSession($("tpoSess").value); saveTs(); };
  $("tpoReadBtn").onclick = () => { $("tpoReadList").hidden = !$("tpoReadList").hidden; saveTs(); };
  tpo.onRead = lines => { $("tpoReadList").innerHTML = lines.length ? lines.map(l => `<li>${esc(l)}</li>`).join("") : "<li>Chưa đủ dữ liệu để đọc phiên.</li>"; };
}
// TPO dựng từ nến 5 phút của 30 ngày gần nhất (đủ để thống kê kiểu ngày), cập nhật nến mới mỗi 20 giây
async function loadTpo() {
  const token = loadToken, sym = S.symbol;
  tpo.setBars([], market.tick);
  try {
    const bars = await ex().klines(sym, "5m", 288 * 30);
    if (token !== loadToken || S.mode !== "tpo") return;
    tpo.setBars(bars, market.tick);
  } catch (e) { log(`Không tải được nến 5 phút cho TPO: ${e.message}`); }
  clearInterval(tpoTimer);
  tpoTimer = setInterval(async () => {
    if (S.mode !== "tpo" || token !== loadToken) return clearInterval(tpoTimer);
    try { for (const b of await ex().klines(sym, "5m", 2)) tpo.update(b); } catch { /* lần sau thử lại */ }
  }, 20e3);
}
const dom = new Dom($("dom"), market);
const tape = new Tape($("tape"), market);
const walls = new WallTracker(); dom.walls = walls;
const lmap = new LiqMap($("lmap"), market, dom); lmap.walls = walls;
flow.prints = () => [market.histPrints, market.prints];
flow.opts.onRange = () => {};

// ---------- tải dữ liệu một mã ----------
let conn = null, loadToken = 0, analysis = null, fpState = null;
async function load() {
  const token = ++loadToken; persist();
  if (conn) { conn.close(); conn = null; }
  market.reset({ symbol: S.symbol, exchange: S.ex, interval: S.interval });
  draw.sym = S.symbol;
  alPrevP = null; heat.setOverlays({ alertLevels: alerts.levelsOf(S.symbol) });
  heat.resetView(); dom.reset(); flow.setData([], {}); flow.fpProgress = ""; flow.ranges = []; analysis = null; fpState = null; absorb = []; clusters = null; scores = null; algo = []; walls.reset(); conflZones = []; heat.setOverlays({ confl: [] }); flow.setOverlays({ confl: [], spoofs: walls.events, algoRuns: [], scores: [], vpinVals: null, groupVals: null }); tape.reset(); renderSignals(); renderTab();
  setConn("Đang tải dữ liệu", null);
  let info = { tick: 0, ctVal: 1 };
  try { info = await ex().info(S.symbol); } catch (e) { log(`Không lấy được thông tin mã: ${e.message}`); }
  if (token !== loadToken) return;
  market.tick = info.tick;
  // Multibook: sàn chính ghi vào sổ riêng, các sàn khác cũng vậy; sổ của market là bản gộp
  const multi = S.multi && multiPeers(S.ex).length > 0, pBook = multi ? new Book() : market.book;
  let mergeT = 0, mergeTimer = null;
  const afterBook = () => {
    if (!market.tick) { const s = pBook.sorted(); market.tick = inferTick(s.bids.slice(0, 30).map(x => x[0])); }
    if (multi) { mergeTimer = null; mergeT = Date.now(); mergeBooks(market.book, [pBook, ...peers.books()], market.tick); }
    market.onBook(); dom.update();
  };
  const onBook = () => { if (token !== loadToken) return; if (!multi || Date.now() - mergeT > 100) afterBook(); else if (!mergeTimer) mergeTimer = setTimeout(() => token === loadToken && afterBook(), 100); };
  peers = multi ? connectPeers(EXCHANGES, S.ex, S.symbol, {
    onBook, onTrades: list => { if (token === loadToken) market.onTrades(list); }, onLiq: list => { if (token === loadToken) market.onLiq(list); },
    log: text => { if (token === loadToken) log(text); },
  }) : null;
  const c0 = ex().connect(S.symbol, info, pBook, {
    onBook,
    onTrades: list => { if (token !== loadToken) return; market.onTrades(list); paperTrades(list); },
    onLiq: list => { if (token !== loadToken) return; market.onLiq(list); },
    onStatus: (text, ok) => { if (token === loadToken) { setConn(multi ? `${text} · Multibook` : text, ok); log(text); } },
  });
  const pr = peers; conn = { close() { c0.close(); if (pr) pr.close(); } };
  if (laptop) loadRecorded(token);
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
    if (S.mode === "box") startFootprint();
    if (S.mode === "tpo") loadTpo();
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
  updateConfl();
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
  if (kind === "trades") checkAlerts();
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
  if (["clusters", "score"].includes(S.tab)) renderTab();
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
  for (const e of done) { const ev = canLog() && fromWall(e, S.symbol, S.ex); if (ev) logEvent(ev); }
  logIce();
  for (const e of done) if (e.kind === "spoof" && alerts.cfg.spoof && gate("wall.pulled")) alerts.fire("spoof", `${S.symbol}: tường ${e.side === "bid" ? "chờ mua" : "chờ bán"} ${fmtVol(e.q)} tại ${e.price.toFixed(decimalsFor(market.tick))} bị rút khi giá tới gần (nghi tường giả)`, e.side === "bid" ? "down" : "up");
  // tường lớn mới xuất hiện gần giá: lớn hơn 1,5 lần trung vị cỡ tường trong phiên, cách giá ≤ 0,3%
  const born = walls.born.splice(0), mid = market.book.mid();
  if (born.length && alerts.cfg.wallNew && mid && walls.log.length >= 8) {
    const qs = walls.log.map(x => x.q).sort((a, b) => a - b), med = qs[qs.length >> 1];
    const big = born.filter(w => w.q >= 1.5 * med && Math.abs(w.p - mid) / mid <= 0.003).sort((a, b) => b.q - a.q)[0];
    if (big) alerts.fire("wallNew", `${S.symbol}: tường ${big.side === "bid" ? "chờ mua" : "chờ bán"} ${fmtVol(big.q)} xuất hiện tại ${big.p.toFixed(decimalsFor(market.tick))} (cách giá ${(Math.abs(big.p - mid) / mid * 100).toFixed(2)}%, gấp ${(big.q / med).toFixed(1)} lần tường thường gặp)`, big.side === "bid" ? "up" : "down");
  }
  if (done.length) flow.dirty = true;
}, 1000);
// ---------- nhật ký tường ----------
let wallSeg = "log", wallSig = "";
function renderWalls(force) {
  const body = $("wallBody"); if (!body || (!force && tiles && tiles.isMin("wallPanel"))) return;
  const dec = decimalsFor(market.tick), mid = market.book.mid(), now = Date.now();
  const ev = walls.events, act = walls.active();
  const sig = `${wallSeg}|${ev.length}|${ev.filter(e => e.r60).length}|${ev.filter(e => e.r300).length}|${act.length}|${wallSeg === "live" ? Math.floor(now / 2000) : ""}`;
  if (!force && sig === wallSig) return; wallSig = sig;
  const sideTd = s => `<td class="${s === "bid" ? "pos" : "neg"}">${s === "bid" ? "Mua" : "Bán"}</td>`;
  const mv = r => r ? `<span class="${r.end >= 0 ? "pos" : "neg"}">${r.end >= 0 ? "+" : ""}${r.end.toFixed(2)}%</span>` : `<span class="muted">chờ</span>`;
  const pct = x => x == null ? "–" : `${Math.round(x * 100)}%`, sgn = x => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;
  const st = wallStats(ev);
  const strip = `<div class="wallstrip"><span data-tip="Tường chờ mua: số lần bị rút khi giá tới gần / bị ăn / rút khi còn xa">Mua: <b class="neg">${st.bid.spoof}</b> rút gần · <b class="pos">${st.bid.filled}</b> bị ăn · ${st.bid.pulled} rút xa</span><span data-tip="Tường chờ bán: số lần bị rút khi giá tới gần / bị ăn / rút khi còn xa">Bán: <b class="neg">${st.ask.spoof}</b> rút gần · <b class="pos">${st.ask.filled}</b> bị ăn · ${st.ask.pulled} rút xa</span><span>Đang đứng <b>${act.length}</b></span></div>`;
  let html = strip;
  if (wallSeg === "log") {
    const rows = ev.slice().reverse().slice(0, 300).map(e => { const k = WALL_KIND[e.kind]; return `<tr><td>${fmtTime(e.t)}</td>${sideTd(e.side)}<td>${e.price.toFixed(dec)}</td><td>${fmtVol(e.q)}</td><td>${(e.life / 1000).toFixed(0)}s</td><td class="t ${k.cls}" data-tip="${esc(k.note)}. Cách giá lúc dựng ${e.dist0.toFixed(dec)}, lúc mất ${e.dist.toFixed(dec)}; đã khớp tại đó ${fmtVol(e.traded)} (${e.q ? Math.round(e.traded / e.q * 100) : 0}% tường)">${k.label}</td><td>${mv(e.r60)}</td><td>${mv(e.r300)}</td></tr>`; });
    html += table(["Lúc", "Phía", "Giá", "KL", "Đứng", ["Kết cục", "spoofing"], "Sau 1′", "Sau 5′"], rows, "Chưa có tường nào biến mất. Bộ theo dõi chạy từ lúc mở trang; bro để trang mở một lúc là có dữ liệu.");
  } else if (wallSeg === "live") {
    const rows = act.slice().sort((a, b) => b.p - a.p).map(w => `<tr>${sideTd(w.side)}<td>${w.p.toFixed(dec)}</td><td>${fmtVol(w.q)}</td><td>${fmtVol(w.maxQ)}</td><td>${mid ? (Math.abs(w.p - mid) / mid * 100).toFixed(2) + "%" : "–"}</td><td>${((now - w.t0) / 1000).toFixed(0)}s</td></tr>`);
    html += table(["Phía", "Giá", "Đang có", "Lớn nhất", "Cách giá", "Đã đứng"], rows, "Không có tường nào trong ±1% quanh giá.");
  } else {
    const R = st.react, line = (name, r, tip) => r ? `<tr><td class="t" data-tip="${esc(tip)}">${name}</td><td>${r.n}</td><td class="${r.move >= 0 ? "pos" : "neg"}">${sgn(r.move)}</td><td>${sgn(r.fav)}</td><td>${sgn(-r.adv)}</td><td>${pct(r.hold)}</td></tr>` : `<tr><td class="t">${name}</td><td colspan="5" class="muted">chưa đủ 1 phút sau kết cục</td></tr>`;
    html += `<div class="mh">Ai hay dựng tường giả</div><table><thead><tr><th>Phía</th><th>Tường đã mất</th><th data-tip="Trong các tường bị giá chạm tới: phần trăm bị rút ngay trước khi bị ăn">Tỷ lệ rút khi giá tới gần</th><th>Đứng trung bình</th></tr></thead><tbody>` +
      [["bid", "Chờ mua"], ["ask", "Chờ bán"]].map(([k, n]) => { const x = st[k]; return `<tr><td class="${k === "bid" ? "pos" : "neg"}">${n}</td><td>${x.n}</td><td><b>${pct(x.spoofRate)}</b></td><td>${x.life ? (x.life / 1000).toFixed(0) + "s" : "–"}</td></tr>`; }).join("") + `</tbody></table>` +
      `<div class="mh">Giá đi thế nào 1 phút sau kết cục (theo phía tường bảo vệ)</div><table><thead><tr><th>Kết cục</th><th>Lần</th><th data-tip="Trung bình giá sau 1 phút, dương là giá đi theo hướng tường bảo vệ: tường mua thì giá lên, tường bán thì giá xuống">Sau 1′</th><th data-tip="Trung bình mức xa nhất giá đi theo hướng tường bảo vệ trong 1 phút">Bật xa nhất</th><th data-tip="Trung bình mức xa nhất giá đi ngược hướng tường trong 1 phút">Ngược xa nhất</th><th data-tip="Phần trăm số lần giá sau 1 phút nằm phía tường bảo vệ">Giữ được</th></tr></thead><tbody>` +
      line("Bị ăn (tường thật)", R.filled, "Tường bị khớp vào hoặc giá đi xuyên qua. Dương: tường hấp thụ xong giá bật lại; âm: giá phá tường và chạy tiếp") +
      line("Rút khi giá tới gần", R.spoof, "Nghi tường giả. Âm nghĩa là sau khi tường rút giá đi ngược hướng tường: tường được dựng để doạ, rút ra thì giá đi đúng ý người dựng") +
      line("Rút khi giá còn xa", R.pulled, "Đổi ý bình thường, ít ý nghĩa") + `</tbody></table>` +
      (st.hot.length ? `<div class="mh">Mức giá bị rút tường nhiều lần</div><table><thead><tr><th>Giá</th><th>Phía</th><th>Số lần</th><th>Tổng KL</th></tr></thead><tbody>${st.hot.map(x => `<tr><td>${x.price.toFixed(dec)}</td>${sideTd(x.side)}<td><b>${x.n}</b></td><td>${fmtVol(x.q)}</td></tr>`).join("")}</tbody></table>` : "") +
      `<p class="note">Tính từ lúc mở trang cho ${esc(S.symbol)}. Cần vài chục lần mỗi loại thì con số mới đáng tin.</p>`;
  }
  body.innerHTML = html;
}
$("wallSeg").onclick = e => { const b = e.target.closest("[data-ws]"); if (!b) return; wallSeg = b.dataset.ws; for (const x of $("wallSeg").children) x.classList.toggle("on", x === b); renderWalls(true); };
setInterval(() => renderWalls(), 1000);

// ---------- cảnh báo ----------
const alerts = new Alerts(text => toast("🔔 " + text));
let alPrevP = null, alPrintT = 0;
function checkAlerts() {
  const dec = decimalsFor(market.tick), cur = market.last ? market.last.p : null;
  alerts.checkPrice(S.symbol, alPrevP, cur, dec); alPrevP = cur;
  for (const e of market.newIce.splice(0)) if (alerts.cfg.ice && !alerts.cfg.verifiedOnly) alerts.fire("ice", `${S.symbol}: nghi lệnh băng chìm ${e.side === "bid" ? "CHỜ MUA" : "CHỜ BÁN"} tại ${e.price.toFixed(dec)}, đã khớp ${fmtVol(e.filled)} trong khi sổ chỉ hiện ${fmtVol(e.disp)}`, "ice");
  const pr = market.prints;
  if (isFinite(market.bigPrint)) {
    let p = null;
    for (let i = pr.length - 1; i >= 0 && pr[i].t > alPrintT; i--) if (pr[i].q >= market.bigPrint) { p = pr[i]; break; }
    if (p) {
      const sig = p.side === "buy" ? "big.buy" : "big.sell";
      // ghi vào sổ tín hiệu tối đa một lần mỗi phút mỗi phía, để sổ không bị lệnh lớn liên tiếp làm đầy
      if (canLog() && p.t - (bigLogT[sig] || 0) >= 60e3) { bigLogT[sig] = p.t; logEvent(fromBig(p, S.symbol, S.ex)); }
      if (alerts.cfg.big && gate(sig)) alerts.fire("big", `${S.symbol}: Big Trade ${p.side === "buy" ? "MUA" : "BÁN"} ${fmtVol(p.q)} tại ${p.vwap.toFixed(dec)} (${fmtUsd(p.vwap * p.q)})${alerts.cfg.verifiedOnly ? " · tín hiệu đã kiểm chứng" : ""}`, p.side === "buy" ? "up" : "down");
    }
  }
  if (pr.length) alPrintT = pr[pr.length - 1].t;
}
// sổ tín hiệu: ghi các tín hiệu chỉ thấy khi xem trực tiếp (không ghi dữ liệu giả lập)
const canLog = () => S.ex !== "SIM";
const bigLogT = {}, iceSeen = new WeakSet();
// lọc cảnh báo: khi bật "chỉ báo tín hiệu đã kiểm chứng", chỉ kêu loại mà sổ tín hiệu đã chấm là có lợi thế cho mã này
const gate = sig => !alerts.cfg.verifiedOnly || isVerified(S.symbol, sig);
function logIce() {
  for (const e of market.ice.events) {
    if ((e.status !== "held" && e.status !== "broken") || iceSeen.has(e)) continue;
    iceSeen.add(e);
    const ev = fromIce(e, S.symbol, S.ex); if (!ev) continue;
    if (canLog()) logEvent(ev);
    if (alerts.cfg.ice && alerts.cfg.verifiedOnly && isVerified(S.symbol, ev.sig)) alerts.fire("ice", `${S.symbol}: iceberg ${e.side === "bid" ? "chờ mua" : "chờ bán"} tại ${e.price.toFixed(decimalsFor(market.tick))} ${e.status === "held" ? "đã giữ được giá" : "vừa bị xuyên"} (tín hiệu đã kiểm chứng)`, "ice");
  }
}
function renderAlertMenu() {
  const dec = decimalsFor(market.tick), lv = alerts.levelsOf(S.symbol);
  for (const cb of document.querySelectorAll("[data-al]")) cb.checked = !!alerts.cfg[cb.dataset.al];
  $("alList").innerHTML = lv.length ? lv.map(l => `<div class="alrow"><span>${esc(S.symbol)} chạm <b>${l.price.toFixed(dec)}</b></span><button class="icon" data-alrm="${l.i}" data-tip="Xoá">✕</button></div>`).join("") : `<div class="muted">Chưa có mức giá nào cho ${esc(S.symbol)}.</div>`;
  $("alHist").innerHTML = alerts.hist.length ? "<b>Vừa kêu</b>" + alerts.hist.slice(0, 6).map(h => `<div>${fmtTime(h.t, true)} · ${esc(h.text)}</div>`).join("") : "";
  heat.setOverlays({ alertLevels: lv });
}
alerts.onFire = () => { if ($("alertBtn").parentElement.classList.contains("open")) renderAlertMenu(); else heat.setOverlays({ alertLevels: alerts.levelsOf(S.symbol) }); };
$("alertBtn").onclick = e => { e.stopPropagation(); const d = $("alertBtn").parentElement; d.classList.toggle("open"); if (d.classList.contains("open")) { if (market.last && !$("alPrice").value) $("alPrice").value = market.last.p; renderAlertMenu(); } };
for (const cb of document.querySelectorAll("[data-al]")) cb.onchange = async () => {
  alerts.cfg[cb.dataset.al] = cb.checked; alerts.save();
  if (cb.dataset.al === "notify" && cb.checked && typeof Notification !== "undefined" && Notification.permission !== "granted") {
    const r = await Notification.requestPermission().catch(() => "denied");
    if (r !== "granted") { alerts.cfg.notify = false; alerts.save(); cb.checked = false; toast("Trình duyệt chưa cho phép thông báo", true); }
  }
  if (cb.dataset.al === "sound" && cb.checked) alerts.beep("price");
};
// Telegram
const tgSync = () => { $("tgOn").checked = alerts.tg.on; $("tgToken").value = alerts.tg.token; $("tgChat").value = alerts.tg.chat; $("tgBox").hidden = !alerts.tg.on; };
tgSync();
$("tgOn").onchange = () => { alerts.tg.on = $("tgOn").checked; alerts.saveTg(); tgSync(); };
$("tgToken").onchange = () => { alerts.tg.token = $("tgToken").value.trim(); alerts.saveTg(); };
$("tgChat").onchange = () => { alerts.tg.chat = $("tgChat").value.trim(); alerts.saveTg(); };
$("tgTest").onclick = () => { alerts.tg.token = $("tgToken").value.trim(); alerts.tg.chat = $("tgChat").value.trim(); alerts.saveTg(); toast(alerts.telegram(`thử cảnh báo (${S.symbol})`, true) ? "Đã gửi thử. Nếu Telegram không nhận được tin, kiểm tra lại mã bot và chat id (bro phải nhắn cho bot trước một lần)" : "Nhập mã bot và chat id trước", !alerts.tg.token || !alerts.tg.chat); };
$("alAdd").onclick = () => { const p = parseFloat($("alPrice").value); if (!(p > 0)) return toast("Nhập mức giá cần cảnh báo", true); alerts.addLevel(S.symbol, p); $("alPrice").value = ""; renderAlertMenu(); };
$("alPrice").onkeydown = e => { if (e.key === "Enter") $("alAdd").click(); };
$("alList").onclick = e => { const b = e.target.closest("[data-alrm]"); if (b) { alerts.removeLevel(+b.dataset.alrm); renderAlertMenu(); } };
heat.setOverlays({ alertLevels: alerts.levelsOf(S.symbol) });
const newsView = initNews({ $, esc, alerts, coin });
const marketsView = initMarkets({ $, esc });
const gexView = initGex({ $, esc });
const instView = initInst({ $, esc });
const radarView = initRadar({ $, esc, onPick: sym => { S.ex = "BINANCE"; $("exchange").value = S.ex; S.symbol = sym; $("symbol").value = sym; load(); setView("terminal"); } });
const multiChart = new MultiChart($("view-multi"), { ex: () => ex() });

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
  const body = $("tabBody"); if (!body) return;
  const dec = decimalsFor(market.tick);
  const coinName = coin();
  if (S.tab === "clusters") {
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
  } else if (S.tab === "symbols") {
    const f = symbolFilter.toUpperCase(), rows = symbolRows.filter(r => !f || r.symbol.includes(f)).slice(0, 300);
    body.innerHTML = `<div class="signalbar"><input id="symFilter" placeholder="Tìm mã..." value="${esc(symbolFilter)}" style="width:160px"></div>` +
      table(["Mã", "Giá", "24h", "Khối lượng 24h"], rows.map(r => `<tr class="click${r.symbol === S.symbol ? " active" : ""}" data-sym="${esc(r.symbol)}"><td>${esc(r.symbol)}</td><td>${r.last}</td><td class="${r.change >= 0 ? "pos" : "neg"}">${fmtPct(r.change)}</td><td>${fmtUsd(r.volUsd)}</td></tr>`), "Đang tải danh sách mã...");
    const inp = $("symFilter"); inp.oninput = () => { symbolFilter = inp.value; renderTab(); const i2 = $("symFilter"); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); };
  } else if (S.tab === "logs") {
    body.innerHTML = table(["Thời gian", "Nội dung"], logs.map(x => `<tr><td>${fmtTime(x.t, true)}</td><td class="t">${esc(x.text)}</td></tr>`), "Chưa có nhật ký.");
  }
}
// đưa biểu đồ nến/footprint tới nến chứa thời điểm t
function goToTime(t) {
  if (S.mode !== "box") setMode("box");
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
// nến các khung khác cho tab Phân tích: tải song song, dùng chung một bộ nhớ đệm 60 giây và gộp các lần hỏi trùng
const tfCache = new Map();
function tfBars(tf) {
  if (tf === S.interval) return Promise.resolve(market.bars);
  const ck = `${S.ex}:${S.symbol}:${tf}`, c = tfCache.get(ck);
  if (c && Date.now() - c.t < 60e3) return c.p;
  const p = ex().klines(S.symbol, tf, 500);
  tfCache.set(ck, { t: Date.now(), p });
  p.catch(() => tfCache.delete(ck));
  return p;
}
let analysisBusy = false, analysisAgain = false;
async function renderAnalysis() {
  if (analysisBusy) { analysisAgain = true; return; } // đang vẽ thì chỉ hẹn vẽ lại một lần, không chồng nhiều lượt
  analysisBusy = true;
  try { await renderAnalysisNow(); } finally { analysisBusy = false; if (analysisAgain) { analysisAgain = false; renderAnalysis(); } }
}
async function renderAnalysisNow() {
  if (!analysis) { $("mtfTable").innerHTML = `<div class="empty">Đang tải dữ liệu...</div>`; return; }
  const dec = decimalsFor(market.tick || market.fpStep), last = market.bars[market.bars.length - 1].c;
  $("srInfo").textContent = `khung ${S.interval}, giá ${last.toFixed(dec)}`;
  setFresh($("fsMtf"), S.ex === "SIM" ? "delay" : "live", Date.now(), { label: S.ex === "SIM" ? "Dữ liệu giả lập" : `Trực tiếp (${ex().name})`, expect: 5 * 60e3, note: "Nến lấy thẳng từ sàn; các khung được tải lại tối đa mỗi 60 giây khi đang mở Phân tích" });
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
  renderDvol(); renderDerivs(); newsView.render();
  const tfs = ["5m", "15m", "1h", "4h", "1d"], rows = [];
  const got = await Promise.allSettled(tfs.map(tfBars));
  for (const [j, tf] of tfs.entries()) {
    const g = got[j];
    if (g.status === "rejected") { rows.push(`<tr><td>${tf}</td><td colspan="7" class="t muted">Lỗi: ${esc(g.reason.message)}</td></tr>`); continue; }
    const { trend: t, momentum: m, volatility: v } = summary(g.value, INTERVALS[tf]);
    const sc = x => x == null ? "-" : `<span class="bar"><i style="${x >= 0 ? "left:50%" : `left:${50 + x / 2}%`};width:${Math.abs(x) / 2}%;background:${x >= 0 ? "var(--buy)" : "var(--sell)"}"></i></span>${x.toFixed(0)}`;
    rows.push(`<tr><td>${tf}</td><td>${trendTag(t.label, t.score)}</td><td>${sc(t.score)}</td><td class="t">${esc(t.structure || "-")}</td><td>${trendTag(m.label, m.score)} ${sc(m.score)}</td><td>${fmtPct(m.roc10)}</td><td class="t">${esc(v.regime || "-")} (${v.percentile == null ? "-" : v.percentile.toFixed(0)}%)</td><td>${v.realized == null ? "-" : v.realized.toFixed(0) + "%"} · ATR ${v.atrPct == null ? "-" : v.atrPct.toFixed(2) + "%"}</td></tr>`);
  }
  $("mtfTable").innerHTML = table([["Khung", "mtf"], "Xu hướng", ["Điểm xu hướng", "trend-score"], ["Cấu trúc", "structure"], ["Động lượng", "momentum"], ["Thay đổi 10 nến", "roc"], ["Chế độ biến động", "vol-regime"], ["Biến động năm hoá", "realized-vol"]], rows, "");
}

const absCache = new Map();
async function renderAbsorptionCard() {
  const rows = [], tfs = ["5m", "15m", "1h", "4h", "1d"], got = await Promise.allSettled(tfs.map(tfBars));
  for (const [j, tf] of tfs.entries()) {
    let c;
    if (tf === S.interval) c = { ev: absorb, bars: market.bars };
    else if (got[j].status === "rejected") { rows.push(`<tr><td>${tf}</td><td colspan="7" class="t muted">Lỗi: ${esc(got[j].reason.message)}</td></tr>`); continue; }
    else { const bars = got[j].value, ck = `${S.ex}:${S.symbol}:${tf}`, old = absCache.get(ck); c = old && old.bars === bars ? old : { ev: absorption(bars), bars }; absCache.set(ck, c); }
    const st = absorptionStats(c.ev), last = c.ev[c.ev.length - 1], dec = decimalsFor(market.tick || 0.01), pct = g => isFinite(g.pct) ? `${g.pct.toFixed(0)}%` : "-";
    rows.push(`<tr><td>${tf}${tf === S.interval ? " ★" : ""}</td><td>${c.bars.length}</td><td class="neg">${st.sell.n}</td><td class="pos">${pct(st.sell)}</td><td class="pos">${st.buy.n}</td><td class="pos">${pct(st.buy)}</td><td class="t">${last ? `${last.side === "sell" ? "Hấp thụ bán" : "Hấp thụ mua"} ${last.price.toFixed(dec)} lúc ${fmtDate(last.t)}` : "-"}</td></tr>`);
  }
  $("absInfo").textContent = `${S.symbol} · ${ex().name}`;
  $("absTable").innerHTML = table([["Khung", "mtf"], "Số nến", ["Hấp thụ bán", "absorption"], "Đúng", ["Hấp thụ mua", "absorption"], "Đúng", "Gần nhất"], rows, "");
}

// ---------- dữ liệu phái sinh ----------
let drvCache = null, optCache = null;
async function renderDerivs() {
  const sym = S.symbol, c = coin(), box = $("drvStats"), ob = $("optStats");
  setFresh($("drvInfo"), "live", Date.now(), { label: `Trực tiếp · ${sym} · Binance khung 1 giờ, 48 giờ`, expect: 10 * 60e3, note: "Long/short, mua/bán chủ động, funding, OI lấy thẳng từ Binance Futures (làm mới mỗi 2 phút); quyền chọn từ Deribit (mỗi 5 phút)" });
  try {
    if (!drvCache || drvCache.sym !== sym || Date.now() - drvCache.t > 120e3) drvCache = { sym, t: Date.now(), d: await binanceDerivs(sym) };
    const d = drvCache.d, lv = a => a && a.length ? a[a.length - 1].v : null, ch = a => a && a.length > 24 ? a[a.length - 1].v - a[a.length - 25].v : null;
    const f2 = (x, k = 2) => x == null || !isFinite(x) ? "-" : x.toFixed(k), sg = (x, k = 2) => x == null || !isFinite(x) ? "" : ` <small class="${x >= 0 ? "pos" : "neg"}">(${x >= 0 ? "+" : ""}${x.toFixed(k)} / 24h)</small>`;
    const accL = d.accLong, topL = d.topLong, fr = d.funding, tk = lv(d.taker), oi = lv(d.oi), oiCh = d.oi && d.oi.length > 24 ? (lv(d.oi) / d.oi[d.oi.length - 25].v - 1) * 100 : null;
    const crowd = accL == null ? "" : accL >= 0.65 ? "Đám đông nghiêng hẳn về LONG: dễ bị quét xuống trước khi đi tiếp." : accL <= 0.4 ? "Đám đông nghiêng hẳn về SHORT: dễ bị ép lên (short squeeze)." : "Đám đông khá cân bằng.";
    const smart = accL != null && topL != null ? (topL - accL >= 0.05 ? " Top trader long nhiều hơn đám đông: tiền lớn đang nghiêng về phía mua." : accL - topL >= 0.05 ? " Top trader long ít hơn đám đông: tiền lớn thận trọng hơn nhỏ lẻ." : "") : "";
    box.innerHTML = d.errors.length >= 5 ? `<p class="note">Binance Futures không có dữ liệu phái sinh cho ${esc(sym)}: ${esc(d.errors[0])}</p>` :
      `<div class="kv"><span data-g="ls-ratio">Tài khoản đang LONG (mọi người)</span><b>${accL == null ? "-" : (accL * 100).toFixed(1) + "%"}</b>` +
      `<span data-g="ls-ratio">Tỷ lệ long/short mọi tài khoản</span><b>${f2(lv(d.acc))}${sg(ch(d.acc))}</b>` +
      `<span data-g="ls-ratio">Top trader: vị thế LONG</span><b>${topL == null ? "-" : (topL * 100).toFixed(1) + "%"}</b>` +
      `<span data-g="taker-ratio">Mua/bán chủ động (1 giờ gần nhất)</span><b class="${tk >= 1 ? "pos" : "neg"}">${f2(tk)}</b>` +
      `<span data-g="funding">Funding hiện tại (mỗi 8 giờ)</span><b class="${fr >= 0 ? "pos" : "neg"}">${fr == null ? "-" : (fr * 100).toFixed(4) + "%"}</b>` +
      `<span data-g="oi">Open interest</span><b>${oi == null ? "-" : fmtUsd(oi)}${oiCh == null ? "" : ` <small class="${oiCh >= 0 ? "pos" : "neg"}">(${oiCh >= 0 ? "+" : ""}${oiCh.toFixed(1)}% / 24h)</small>`}</b></div>` +
      `<p class="note">${crowd}${smart}${fr != null && Math.abs(fr) >= 0.0005 ? ` Funding ${fr > 0 ? "dương" : "âm"} cao: phe ${fr > 0 ? "long" : "short"} đang trả phí đắt để giữ lệnh, dễ bị xả.` : ""}</p>`;
    drawDerivs(d);
  } catch (e) { box.innerHTML = `<p class="note">Không tải được dữ liệu phái sinh từ Binance: ${esc(e.message)}</p>`; }
  if (c !== "BTC" && c !== "ETH") { ob.innerHTML = `<p class="note">Deribit chỉ có quyền chọn đủ thanh khoản cho BTC và ETH.</p>`; return; }
  try {
    if (!optCache || optCache.c !== c || Date.now() - optCache.t > 300e3) optCache = { c, t: Date.now(), o: await deribitOptions(c) };
    const o = optCache.o; if (!o) { ob.innerHTML = `<p class="note">Deribit chưa có dữ liệu quyền chọn.</p>`; return; }
    const day = t => new Date(t).toISOString().slice(0, 10), strikes = a => a.map(x => `${fmtVol(x.strike)} (${fmtVol(x.oi)})`).join(", ");
    ob.innerHTML = `<div class="kv"><span data-g="put-call">Put/Call theo OI</span><b class="${o.pcOi > 1 ? "neg" : "pos"}">${o.pcOi == null ? "-" : o.pcOi.toFixed(2)}</b>` +
      `<span data-g="put-call">Put/Call theo khối lượng 24h</span><b class="${o.pcVol > 1 ? "neg" : "pos"}">${o.pcVol == null ? "-" : o.pcVol.toFixed(2)}</b>` +
      `<span data-g="max-pain">Max pain kỳ ${day(o.mainExpiry)}</span><b>${fmtVol(o.maxPain)}</b>` +
      `<span data-g="max-pain">Max pain kỳ lớn nhất ${day(o.bigExpiry)}</span><b>${fmtVol(o.bigMaxPain)}</b>` +
      `<span>Call OI lớn nhất (kỳ ${day(o.mainExpiry)})</span><b class="pos">${strikes(o.topCalls)}</b>` +
      `<span>Put OI lớn nhất</span><b class="neg">${strikes(o.topPuts)}</b>` +
      `<span data-g="iv-skew">Lệch IV put − call (cách 10%)</span><b class="${o.skew > 0 ? "neg" : "pos"}">${o.skew == null ? "-" : (o.skew >= 0 ? "+" : "") + o.skew.toFixed(1) + " điểm"}</b></div>` +
      `<p class="note">Giá spot ${o.under ? fmtVol(o.under) : "-"}. Put/Call trên 1 là thị trường mua bảo hiểm giảm giá nhiều hơn. Gần ngày đáo hạn, giá hay bị hút về max pain và các giá thực hiện có OI lớn.</p>`;
  } catch (e) { ob.innerHTML = `<p class="note">Không tải được quyền chọn từ Deribit: ${esc(e.message)}</p>`; }
}
function drawDerivs(d) {
  const cv = $("drvCanvas"), F = cv._fit || (cv._fit = fitCanvas(cv, () => drvCache && drawDerivs(drvCache.d))), ctx = F.ctx;
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, F.w, F.h);
  const lines = [[d.acc, "#f5c542", "Long/short mọi TK"], [d.top, "#56b6ff", "Long/short top trader"], [d.taker, "#c678dd", "Mua/bán chủ động"]].filter(x => x[0] && x[0].length > 1);
  if (!lines.length) return;
  const all = lines.flatMap(x => x[0].map(p => p.v)), lo = Math.min(1, ...all), hi = Math.max(1, ...all), t0 = Math.min(...lines.map(x => x[0][0].t)), t1 = Math.max(...lines.map(x => x[0][x[0].length - 1].t));
  const X = t => 4 + (t - t0) / (t1 - t0 || 1) * (F.w - 48), Y = v => 18 + (hi - v) / (hi - lo || 1) * (F.h - 34);
  ctx.strokeStyle = alpha(T.text, 0.35); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(4, Y(1)); ctx.lineTo(F.w - 44, Y(1)); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `11px ${MONO}`; let lx = 6;
  for (const [a, col, name] of lines) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); a.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(p.v)) : ctx.moveTo(X(p.t), Y(p.v))); ctx.stroke();
    ctx.fillStyle = col; ctx.textAlign = "left"; ctx.fillText(name, lx, 11); lx += ctx.measureText(name).width + 14;
  }
  ctx.fillStyle = T.muted; ctx.textAlign = "left"; ctx.fillText(hi.toFixed(2), F.w - 40, 22); ctx.fillText(lo.toFixed(2), F.w - 40, F.h - 14); ctx.fillText("1.00", F.w - 40, Y(1) + 4);
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
initBackup({ $, toast });
const journal = initJournal({ $, S, esc, table, market, toast, events: () => newsView.events(), notify: (kind, text, html, showToast) => {
  if (alerts.cfg.disc) alerts.fire("disc-" + kind, text, "down", true, { html, toast: showToast });
}, onLock: lk => {
  const bar = $("riskLockBar"); bar.hidden = !lk;
  if (lk) bar.textContent = `ĐANG KHOÁ GIAO DỊCH tới ${fmtDate(lk.until)}: ${lk.why}. Lệnh giả lập mới bị chặn, chỉ được đóng bớt vị thế.`;
} });
const perfView = initPerf({ $, esc, toast, journal });
const compassView = initCompass({ $, esc, toast, alerts, journal, events: () => newsView.events() });
const consensusView = initConsensus({ $, esc, toast, alerts, journal, events: () => newsView.events(), macro: () => compassView.data() });
const shockView = initShock({ $, esc, table, alerts, journal, events: () => newsView.events(), reactions: () => newsView.reactions() });
const healthView = initHealth({ $, esc });
const flowsView = initFlows({ $, esc });

// ---------- bản đồ mức giá hợp lưu ----------
// nguồn từ nến 15 phút 10 ngày (POC, VAH/VAL, đỉnh/đáy hôm qua, POC tuần, POC chưa chạm, HT/KC, VWAP) cộng các nguồn
// trực tiếp: tường lệnh đang đứng, iceberg đang sống, cụm thanh lý ước tính lớn nhất, mức quyền chọn Deribit (BTC, ETH)
let conflZones = [], conflBars = null, conflKey = "", conflT = 0;
const gexLv = {}, gexT = {};
async function refreshConflBars() {
  const k = key();
  if (conflKey === k && Date.now() - conflT < 10 * 60e3) return;
  conflT = Date.now(); conflKey = k;
  try { const b = await ex().klines(S.symbol, "15m", 960); if (k === key()) conflBars = b; } catch { if (k === key()) conflBars = null; }
}
async function refreshGex() {
  const c = coin(); if (S.ex === "SIM" || !["BTC", "ETH"].includes(c) || Date.now() - (gexT[c] || 0) < 10 * 60e3) return;
  gexT[c] = Date.now();
  try { const r = await getJson(`https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${c}&kind=option`); gexLv[c] = gexLevels(gexPick(fromDeribit(r.result || []), { maxDays: 30 })); } catch { /* bỏ qua */ }
}
function liveSources(sym) {
  const out = [], g = gexLv[sym.replace(/(USDT|USDC|USD)$/, "")];
  if (g) for (const k of ["callWall", "putWall", "flip", "maxPain"]) if (g[k] > 0) out.push({ kind: k, price: g[k] });
  if (sym !== S.symbol) return out;
  for (const w of walls.active().slice().sort((a, b) => b.q - a.q).slice(0, 4)) out.push({ kind: "wall", price: w.p });
  for (const e of market.ice.events) if (e.status === "live") out.push({ kind: "ice", price: e.price });
  const lm = analysis && analysis.liqMap;
  if (lm) for (const side of ["longs", "shorts"]) for (const x of (lm[side] || []).slice().sort((a, b) => b.notional - a.notional).slice(0, 2)) out.push({ kind: "liq", price: x.price });
  return out;
}
let conflBusy = false;
async function updateConfl() {
  if (conflBusy) return; conflBusy = true;
  try {
    await Promise.all([refreshConflBars(), refreshGex()]);
    const bars = conflBars && conflBars.length > 100 ? conflBars : market.bars;
    const price = market.last ? market.last.p : bars.length ? bars[bars.length - 1].c : null;
    const zs = liveZones(bars, liveSources(S.symbol));
    const A = bars.length > 20 ? atrSeries(bars).at(-1) : 0; // khoảng cách tính theo giá trực tiếp
    if (zs.length && price && A > 0) { for (const z of zs) z.dist = (z.mid - price) / A; zs.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist)); }
    conflZones = zs;
    heat.setOverlays({ confl: zs }); flow.setOverlays({ confl: zs });
    if (S.view === "analysis") renderConfl();
  } finally { conflBusy = false; }
}
function renderConfl() {
  const dec = decimalsFor(market.tick || market.fpStep), zs = conflZones.filter(z => Math.abs(z.dist) <= 4).sort((a, b) => b.mid - a.mid);
  let ver = {}; try { ver = JSON.parse(localStorage.getItem(VERIFIED_KEY) || "{}")[S.symbol] || {}; } catch { /* bỏ qua */ }
  $("conflInfo").textContent = `${S.symbol} · ${conflBars ? "nến 15 phút 10 ngày" : `nến ${S.interval} đang xem`} cộng nguồn trực tiếp · ±4 ATR quanh giá`;
  const hist = b => { const v = ver[b.id]; return v && v.n ? `<span class="${v.all === "edge" ? "pos" : v.all === "lose" ? "neg" : "muted"}">${v.n} lần, bật đúng ${Math.round(v.hit * 100)}%, ${v.net >= 0 ? "+" : "−"}${Math.abs(v.net).toFixed(2)} ATR sau ${esc(v.h || "")}</span>` : `<span class="muted">chưa chấm (tab Tín hiệu)</span>`; };
  $("conflBody").innerHTML = table(["Vùng giá", "Cách giá", ["Điểm", "confluence"], "Nguồn trùng nhau", ["Lịch sử vùng cùng hạng", "signals-book"]],
    zs.map(z => { const b = bucketOf(z.score); return `<tr class="${z.score >= CONFL_MIN ? "" : "muted"}"><td>${z.lo.toFixed(dec)} – ${z.hi.toFixed(dec)}</td><td class="${z.dist >= 0 ? "neg" : "pos"}">${z.dist >= 0 ? "+" : "−"}${Math.abs(z.dist).toFixed(1)} ATR</td><td><b>${z.score.toFixed(1)}</b></td><td class="t">${esc(z.kinds.map(k => (LEVEL_KINDS[k] ? LEVEL_KINDS[k].name : k)).join(", "))}</td><td class="t small">${esc(b.name)}: ${hist(b)}</td></tr>`; }),
    "Chưa đủ dữ liệu để dựng vùng (cần ít nhất 30 nến và một ngày trước đó).") +
    `<p class="note">Điểm = tổng trọng số các loại nguồn trong vùng (mỗi loại tính một lần). Vùng từ ${CONFL_MIN} điểm được tô vàng trên Bookmap và footprint. Cột cuối là kết quả sổ tín hiệu đã chấm cho lần đầu giá chạm vùng cùng hạng trong lịch sử (${BUCKETS.map(b => b.name.toLowerCase()).join("; ")}).</p>`;
}
const signalsView = initSignals({ $, esc, S, toast, alerts, liveSources });
// khoá rủi ro: chặn lệnh giả lập làm tăng vị thế, vẫn cho đóng bớt
const lockBlocks = (side, qty) => {
  const lk = journal.lock(); if (!lk) return false;
  const pv = paper.positionView(pkey()), reduce = pv.qty && (side === "sell") === (pv.qty > 0) && qty <= Math.abs(pv.qty) + 1e-12;
  if (reduce) return false;
  toast(`Đang khoá giao dịch tới ${fmtDate(lk.until)}: ${lk.why}`, true); return true;
};
// nhấp đúp vào ô thông số (Backtest, FRACTAL) để trả về giá trị mặc định
document.addEventListener("dblclick", e => {
  const el = e.target.closest(".btform input[type=number], .btform input[type=text], .btform select, .hmcfg input:not(#multiBook), .hmcfg select"); if (!el) return;
  if (el.type === "checkbox") { el.checked = el.defaultChecked; } else if (el.tagName === "SELECT") { const d = [...el.options].findIndex(o => o.defaultSelected); el.selectedIndex = d < 0 ? 0 : d; } else el.value = el.defaultValue;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.classList.add("reset"); setTimeout(() => el.classList.remove("reset"), 500);
});
const CANVAS_TIP = { heat, flow, tpo, dom, tape, lmap, btChart, ...fractal.tips, ...backtest.tips, ...multiChart.tips };
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
const layout = (() => { try { return JSON.parse(sessionStorage.getItem(LAYOUT_KEY) || "{}"); } catch { return {}; } })();
function setLayout(k, v) {
  if (v == null) { delete layout[k]; ws.style.removeProperty("--" + k); } else { layout[k] = v; ws.style.setProperty("--" + k, v + "px"); }
  try { sessionStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* bỏ qua */ }
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
  for (const id of ["terminal", "radar", "signals", "multi", "analysis", "markets", "options", "backtest", "fractal", "journal", "health"]) $("view-" + id).hidden = id !== v;
  document.body.classList.toggle("not-terminal", v !== "terminal");
  heat.dirty = flow.dirty = btChart.dirty = dom.dirty = true;
  if (v === "signals") signalsView.show(); else signalsView.hide();
  if (v === "analysis") { renderAnalysis(); renderConfl(); instView.show(); flowsView.show(); } else { instView.hide(); flowsView.hide(); }
  if (v === "journal") { journal.show(); perfView.show(); compassView.render(); consensusView.render(); shockView.render(); }
  if (v === "health") healthView.show(); else healthView.hide();
  if (v === "markets") marketsView.show(); else marketsView.hide();
  if (v === "options") gexView.show(); else gexView.hide();
  if (v === "radar") radarView.show(); else radarView.hide();
  if (v === "multi") multiChart.show(); else multiChart.hide();
}
function setMode(m) {
  S.mode = m; persist();
  for (const b of $("chartMode").children) b.classList.toggle("on", b.dataset.mode === m);
  $("heat").hidden = m !== "heat"; $("flow").hidden = m !== "box"; $("tpo").hidden = m !== "tpo";
  $("tpoSessBox").hidden = $("tpoRead").hidden = m !== "tpo";
  $("contrastBox").hidden = m !== "heat"; $("rowBox").hidden = $("fpModeBox").hidden = $("fpColorBox").hidden = m !== "box";
  $("chartHint").textContent = noHover ? (m === "heat" ? "Kéo: di chuyển · Chụm/mở hai ngón: phóng thời gian (ngang) và giá (dọc) · Chạm đúp: theo dõi · Giữ ngón tay: xem ý nghĩa" : "Kéo: di chuyển · Chụm/mở hai ngón: phóng nến · Chạm đúp: về hiện tại · Giữ ngón tay lên nến: xem ý nghĩa") : m === "heat" ? "Lăn chuột: phóng thời gian · Ctrl + lăn: phóng giá · Kéo: di chuyển · Bấm đúp: theo dõi · Rê chuột để xem ý nghĩa" : "Lăn chuột: phóng to · Kéo: di chuyển · Kéo trục giá: giãn giá · Bấm đúp: về hiện tại · Rê chuột lên nến để xem ý nghĩa";
  if (m === "box") { flow.setType("box"); startFootprint(); }
  if (m === "tpo") { loadTpo(); $("chartHint").textContent = noHover ? "Kéo: di chuyển · Chạm đúp: về hiện tại · Giữ ngón tay: xem ý nghĩa" : "Lăn chuột: đổi độ cao tầng giá · Ctrl + lăn: giãn dòng · Kéo: di chuyển · Bấm đúp: về hiện tại · Rê chuột để xem ý nghĩa"; }
  else clearInterval(tpoTimer);
  for (const el of document.querySelectorAll(".flowOnly")) el.hidden = m !== "box";
  for (const el of document.querySelectorAll(".heatOnly")) el.hidden = m !== "heat";
  $("selBtn").hidden = m !== "box";
  heat.dirty = flow.dirty = tpo.dirty = true;
}

$("exchange").innerHTML = Object.values(EXCHANGES).map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
$("exchange").value = S.ex; $("symbol").value = S.symbol;
$("exchange").onchange = () => { S.ex = $("exchange").value; loadSymbols(); load(); };
$("symbol").addEventListener("change", () => { const v = $("symbol").value.trim().toUpperCase(); if (v && v !== S.symbol) { S.symbol = v; load(); } });
$("symbol").addEventListener("keydown", e => { if (e.key === "Enter") $("symbol").blur(); });
$("intervals").innerHTML = Object.keys(INTERVALS).map(i => `<button data-i="${i}" class="${i === S.interval ? "on" : ""}">${i}</button>`).join("");
$("intervals").onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; S.interval = b.dataset.i; for (const x of $("intervals").children) x.classList.toggle("on", x === b); load(); };
// đồng hồ đếm ngược tới lúc đóng nến của khung đang xem
setInterval(() => { const el = $("cdTerm"), cd = candleCountdown(INTERVALS[S.interval], Date.now() + clockSkew()); el.textContent = `⏱ ${cd.text}`; el.classList.toggle("warn", cd.soon); }, 1000);
$("views").onclick = e => { const b = e.target.closest("[data-view]"); if (b) setView(b.dataset.view); };
$("chartMode").onclick = e => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); };
$("layerBtn").onclick = e => { e.stopPropagation(); $("layerBtn").parentElement.classList.toggle("open"); };
$("hmCfgBtn").onclick = e => { e.stopPropagation(); $("hmCfgBtn").parentElement.classList.toggle("open"); };
// ---------- máy ghi 24/7 (chỉ khi chạy trên laptop) ----------
let laptop = null;
const recHours = () => { const v = +sessionStorage.getItem("lailong.recHours"); return isFinite(v) && sessionStorage.getItem("lailong.recHours") != null ? v : 6; };
async function checkLaptop() {
  try { laptop = await getJson("/api/record/info"); } catch { laptop = null; }
  $("recWrap").hidden = !laptop; if (!laptop) return;
  const syms = Object.entries(laptop.symbols || {});
  $("recStatus").innerHTML = laptop.running ? `<b class="pos">Đang ghi</b>: ${syms.map(([k, v]) => `${esc(k)} (${fmtVol(v.lines)} dòng, ${esc(v.status)})`).join(", ") || "chưa có mã"}` : `<b class="neg">Máy ghi chưa chạy.</b> Bấm đúp "Ghi du lieu 24-7.bat" trong thư mục Lai Long.`;
  if (document.activeElement !== $("recSyms")) $("recSyms").value = (laptop.config.symbols || []).join(", ");
  $("recKeep").value = laptop.config.keep_days; $("recHours").value = recHours();
}
$("recSave").onclick = async () => {
  try {
    const cfg = await postJson("/api/record/config", { symbols: $("recSyms").value.split(/[\s,;]+/).filter(Boolean), keep_days: +$("recKeep").value || 7 });
    try { sessionStorage.setItem("lailong.recHours", String(Math.max(0, Math.min(72, +$("recHours").value || 0)))); } catch { /* bỏ qua */ }
    toast(`Đã lưu: ghi ${cfg.symbols.join(", ") || "không mã nào"}, giữ ${cfg.keep_days} ngày. Máy ghi tự nhận sau khoảng 1 phút.`); checkLaptop();
  } catch (e) { toast(`Không lưu được: ${e.message}`, true); }
};
// nạp lịch sử đã ghi vào bản đồ nhiệt, ngay khi biết bước gộp giá
async function loadRecorded(token) {
  if (!laptop || S.ex !== "BINANCE" || !recHours()) return;
  if (!(laptop.config.symbols || []).includes(S.symbol) && !(laptop.symbols || {})[S.symbol]) return;
  for (let i = 0; i < 50 && !market.grid; i++) await sleep(200);
  if (token !== loadToken || !market.grid) return;
  try {
    const rows = await getJson(`/api/record/cols?symbol=${S.symbol}&hours=${recHours()}`);
    if (token !== loadToken) return;
    const n = market.addRecorded(rows);
    if (n) { heat.dirty = true; log(`Đã nạp ${n} cột lịch sử (${((rows[rows.length - 1].t - rows[0].t) / 36e5).toFixed(1)} giờ) từ máy ghi 24/7`); toast(`Đã nạp ${((rows[rows.length - 1].t - rows[0].t) / 36e5).toFixed(1)} giờ lịch sử sổ lệnh từ máy ghi`); }
  } catch (e) { log(`Không nạp được lịch sử máy ghi: ${e.message}`); }
}
checkLaptop().then(() => { if (laptop) loadRecorded(loadToken); }); setInterval(checkLaptop, 30e3);

// ---------- vẽ đường / vùng giá ----------
const draw = new Drawings(); draw.sym = S.symbol; heat.drawings = flow.drawings = draw;
const setTool = t => { draw.tool = t; for (const b of $("drawTools").querySelectorAll("[data-draw]")) b.classList.toggle("on", b.dataset.draw === t); for (const id of ["heat", "flow"]) $(id).style.cursor = t ? "crosshair" : ""; };
$("drawTools").onclick = e => {
  const b = e.target.closest("[data-draw]"); if (!b) return;
  if (b.dataset.draw === "clear") { if (draw.list().length && confirm(`Xoá mọi đường và vùng đã vẽ của ${S.symbol}?`)) { draw.clear(); heat.dirty = flow.dirty = true; } return; }
  setTool(draw.tool === b.dataset.draw ? null : b.dataset.draw);
  if (draw.tool) toast(draw.tool === "line" ? "Bấm vào biểu đồ để đặt đường ngang. Bấm đúp lên đường để xoá." : "Kéo dọc trên biểu đồ để đánh dấu vùng giá. Bấm đúp lên mép vùng để xoá.");
};
for (const [id, chart] of [["heat", heat], ["flow", flow]]) {
  const cv = $(id), yAt = e => { const r = cv.getBoundingClientRect(); return (e.touches ? e.touches[0] || e.changedTouches[0] : e).clientY - r.top; };
  let start = null;
  const down = e => {
    if (!draw.tool || (e.button != null && e.button !== 0)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    start = { y: yAt(e), p: chart.pAt(yAt(e)) };
    if (draw.tool === "zone") draw.preview = { type: "zone", p: start.p, p2: start.p, color: "#ffffff" };
  };
  const move = e => { if (!start || draw.tool !== "zone") return; e.stopImmediatePropagation(); draw.preview.p2 = chart.pAt(yAt(e)); chart.dirty = true; };
  const up = e => {
    if (!start) return; e.stopImmediatePropagation();
    const p2 = chart.pAt(yAt(e));
    if (draw.tool === "line") draw.add({ type: "line", p: start.p });
    else if (Math.abs(yAt(e) - start.y) > 4) draw.add({ type: "zone", p: start.p, p2 });
    start = null; draw.preview = null; setTool(null); heat.dirty = flow.dirty = true;
  };
  cv.addEventListener("mousedown", down, true); cv.addEventListener("touchstart", down, { capture: true, passive: false });
  window.addEventListener("mousemove", move, true); cv.addEventListener("touchmove", move, { capture: true, passive: false });
  window.addEventListener("mouseup", up, true); cv.addEventListener("touchend", up, true);
  cv.addEventListener("dblclick", e => {
    const y = yAt(e), s = draw.hit(y, p => chart.yOf(p)); if (!s) return;
    e.stopImmediatePropagation(); draw.remove(s.id); heat.dirty = flow.dirty = true; toast("Đã xoá");
  }, true);
}

$("multiBook").checked = S.multi;
$("multiBook").onchange = () => {
  S.multi = $("multiBook").checked; persist();
  if (S.multi && !multiPeers(S.ex).length) toast("Multibook chỉ có cho Binance, OKX và Bybit", true);
  else { toast(S.multi ? "Đang gộp sổ lệnh Binance + OKX + Bybit..." : "Đã tắt Multibook, chỉ dùng một sàn"); load(); }
};
// Cài đặt Bookmap: đọc từ máy, gắn vào từng ô, lưu lại mỗi khi đổi
{
  const KEY = "lailong.hmcfg";
  let saved = {}; try { saved = JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { /* bỏ qua */ }
  for (const [k, v] of Object.entries(saved)) if (k in HM_DEFAULTS && typeof v === typeof HM_DEFAULTS[k]) heat.cfg[k] = v;
  for (const el of document.querySelectorAll("[data-hm]")) {
    const k = el.dataset.hm, d = HM_DEFAULTS[k];
    if (el.type === "checkbox") el.checked = !!heat.cfg[k]; else el.value = String(heat.cfg[k]);
    el.addEventListener("change", () => {
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (typeof d === "number") { v = +v; if (!isFinite(v) || el.value === "") v = d; if (el.min !== "") v = Math.max(+el.min, v); if (el.max !== "") v = Math.min(+el.max, v); }
      heat.cfg[k] = v; heat._cut = null; heat.dirty = true;
      try { sessionStorage.setItem(KEY, JSON.stringify(heat.cfg)); } catch { /* bỏ qua */ }
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
{ // chế độ ô và cách tô màu của footprint, nhớ trong phiên
  let fp = {}; try { fp = JSON.parse(sessionStorage.getItem("lailong.fp") || "{}"); } catch { /* bỏ qua */ }
  if (fp.mode) $("fpMode").value = fp.mode; if (fp.color) $("fpColor").value = fp.color;
  const apply = () => { flow.fpMode = $("fpMode").value; flow.fpColor = $("fpColor").value; flow.dirty = true; try { sessionStorage.setItem("lailong.fp", JSON.stringify({ mode: flow.fpMode, color: flow.fpColor })); } catch { /* bỏ qua */ } };
  $("fpMode").onchange = $("fpColor").onchange = apply; apply();
}
$("domMult").onchange = () => dom.setMult(+$("domMult").value);
$("domCenter").onclick = () => dom.recenter();
$("fullscreenBtn").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => toast("Trình duyệt không cho phép toàn màn hình, bấm F11", true)); };

// ---------- công cụ order flow ----------
$("paneMode").onchange = () => { flow.pane = $("paneMode").value; if (flow.pane === "groups") recomputePrints(); flow.dirty = true; };
$("selBtn").onclick = () => { flow.selecting = !flow.selecting; $("selBtn").classList.toggle("on", flow.selecting); $("flow").style.cursor = flow.selecting ? "col-resize" : ""; };
$("clusterBtn").onclick = e => { e.stopPropagation(); $("clusterBtn").parentElement.classList.toggle("open"); };
const clUpdate = () => { CL.on = $("clOn").checked; CL.metric = $("clMetric").value; CL.top = +$("clTop").value; CL.min = +$("clMin").value || 0; $("clusterBtn").classList.toggle("on", CL.on); recomputeFlow(); };
for (const id of ["clOn", "clMetric", "clTop", "clMin"]) $(id).onchange = clUpdate;
// cột Smart DOM, nhớ trên trình duyệt
// điện thoại chưa chọn cột: mặc định ít cột cho vừa màn hình nhỏ (đổi trong "Cột ▾")
const domColsSaved = (() => {
  try {
    const v = JSON.parse(sessionStorage.getItem("lailong.domcols") || "null");
    // bản mới thêm cột "Cân bằng": bật một lần cho người đã lưu lựa chọn cột trước đó
    if (v && !sessionStorage.getItem("lailong.domcols.v2")) { sessionStorage.setItem("lailong.domcols.v2", "1"); if (!matchMedia("(max-width: 600px)").matches) v.push("imb"); sessionStorage.setItem("lailong.domcols", JSON.stringify(v)); }
    return v;
  } catch { return null; }
})() || (matchMedia("(max-width: 600px)").matches ? ["bid", "sells", "buys", "ask", "walls"] : null);
$("domColMenu").innerHTML = DOM_COLS.filter(c => c.id !== "price").map(c => `<label data-tip="${esc(c.tip)}"><input type="checkbox" data-domcol="${c.id}" ${domColsSaved ? (domColsSaved.includes(c.id) ? "checked" : "") : c.off ? "" : "checked"}> ${esc(c.label)}</label>`).join("");
const domColUpdate = () => { const ids = [...document.querySelectorAll("[data-domcol]")].filter(x => x.checked).map(x => x.dataset.domcol); dom.setColumns(ids); try { sessionStorage.setItem("lailong.domcols", JSON.stringify(ids)); } catch { /* bỏ qua */ } };
$("domColMenu").onchange = domColUpdate; domColUpdate();
$("domColBtn").onclick = e => { e.stopPropagation(); $("domColBtn").parentElement.classList.toggle("open"); };
$("domClear").onclick = () => { market.tradedAt.clear(); dom.dirty = true; };
$("tapeSmart").onchange = () => { tape.smart = $("tapeSmart").checked; tape.dirty = true; };
$("tapeBig").onchange = () => { tape.bigOnly = $("tapeBig").checked; tape.dirty = true; };
$("tapeMin").oninput = () => { tape.minQ = +$("tapeMin").value || 0; tape.dirty = true; };
$("lmapWin").onchange = () => lmap.setWindow(+$("lmapWin").value);
// ---------- lệnh giả lập: khung đặt lệnh và đường lệnh kéo được trên biểu đồ ----------
const paper = new PaperBroker(() => schedulePaper());
const pkey = () => `${S.ex}:${S.symbol}`;
let paperTimer = null, ptType = "market";
function schedulePaper() { if (!paperTimer) paperTimer = setTimeout(() => { paperTimer = null; renderPaper(); }, 150); }
function paperTrades(list) {
  const k = pkey(); if (!paper.openOrders(k).length && !paper.pos(k).qty) return;
  paper.onTrades(k, list); paper.checkBrackets(k, market.book); schedulePaper();
}
const olOpts = plotH => ({
  tick: () => market.tick, plotH,
  onDrag: (kind, id, price) => kind === "order" ? paper.modify(id, price, market.book) : paper.setBracket(pkey(), kind, price),
  onCancel: (kind, id) => kind === "order" ? paper.cancel(id) : paper.setBracket(pkey(), kind, null),
  onPlace: price => {
    const qty = +$("ptQty").value, mid = market.book.mid();
    if (!(qty > 0)) { toast("Nhập khối lượng trong khung Lệnh giả lập trước", true); if (tiles.isMin("orderPanel")) tiles.restore("orderPanel"); return; }
    const side = mid != null && price > mid ? "sell" : "buy";
    if (lockBlocks(side, qty)) return;
    const r = paper.place({ key: pkey(), side, type: "limit", qty, price, lev: +$("ptLev").value }, market.book);
    if (r.error) toast(r.error, true);
  },
});
heat.ol = new OrderLines(heat, $("heat"), olOpts(L => L.ph));
flow.ol = new OrderLines(flow, $("flow"), olOpts(L => L.priceH));
for (const c of [heat, flow]) { const h = c.hitTest.bind(c); c.hitTest = (x, y) => c.ol.hitTest(x, y) || h(x, y); }
function renderPaper() {
  const k = pkey(), pv = paper.positionView(k), orders = paper.openOrders(k), a = paper.account(), dec = decimalsFor(market.tick || 0.01);
  heat.ol.set(orders, pv); flow.ol.set(orders, pv);
  $("ptAcct").textContent = `Vốn ${a.equity.toFixed(2)} · khả dụng ${a.available.toFixed(2)} USDT`;
  $("ptPos").innerHTML = pv.qty ? `<div class="ptpos"><b class="${pv.qty > 0 ? "up" : "dn"}">${pv.qty > 0 ? "LONG" : "SHORT"} ${+Math.abs(pv.qty).toFixed(6)} ${esc(coin())}</b> @ ${pv.avg.toFixed(dec)} · x${pv.lev}<br>
    Lãi/lỗ <b class="${pv.upnl >= 0 ? "up" : "dn"}">${pv.upnl >= 0 ? "+" : ""}${pv.upnl.toFixed(2)} USDT</b> · thanh lý ${pv.liq.toFixed(dec)}<br>
    SL ${pv.sl != null ? pv.sl.toFixed(dec) : "–"} · TP ${pv.tp != null ? pv.tp.toFixed(dec) : "–"}
    <div class="ptrow"><button data-pa="close">Đóng vị thế</button><button data-pa="sl" data-tip="Đặt SL theo ô SL ở trên">Đặt SL</button><button data-pa="tp" data-tip="Đặt TP theo ô TP ở trên">Đặt TP</button></div></div>` : `<div class="muted">Chưa có vị thế ${esc(S.symbol)}.</div>`;
  $("ptOrders").innerHTML = orders.length ? `<table><tbody>${orders.map(o => `<tr><td class="${o.side === "buy" ? "pos" : "neg"}">${o.side === "buy" ? "MUA" : "BÁN"}</td><td>${+o.remaining.toFixed(6)}</td><td>@ ${o.price.toFixed(dec)}</td><td><button class="icon" data-pc="${o.id}" data-tip="Huỷ lệnh">✕</button></td></tr>`).join("")}</tbody></table>` : "";
  const fills = paper.s.fills.filter(f => f.key === k).slice(0, 5);
  $("ptFills").innerHTML = fills.length ? `<div class="mh">Khớp gần đây</div><table><tbody>${fills.map(f => `<tr><td>${fmtTime(f.t)}</td><td class="${f.side === "buy" ? "pos" : "neg"}">${f.side === "buy" ? "MUA" : "BÁN"}</td><td>${+f.qty.toFixed(6)}</td><td>@ ${f.price.toFixed(dec)}</td></tr>`).join("")}</tbody></table>` : "";
}
$("ptType").onclick = e => { const b = e.target.closest("[data-pt]"); if (!b) return; ptType = b.dataset.pt; for (const x of $("ptType").children) x.classList.toggle("on", x === b); $("ptPriceBox").hidden = ptType !== "limit"; if (ptType === "limit" && !$("ptPrice").value) { const m = market.book.mid(); if (m != null) $("ptPrice").value = (Math.round(m / (market.tick || 1)) * (market.tick || 1)).toFixed(decimalsFor(market.tick || 0.01)); } };
const ptPlace = side => {
  if (lockBlocks(side, +$("ptQty").value)) return;
  const r = paper.place({ key: pkey(), side, type: ptType, qty: +$("ptQty").value, price: +$("ptPrice").value, lev: +$("ptLev").value, sl: $("ptSl").value || null, tp: $("ptTp").value || null }, market.book);
  if (r.error) toast(r.error, true);
};
$("ptBuy").onclick = () => ptPlace("buy"); $("ptSell").onclick = () => ptPlace("sell");
$("ptReset").onclick = () => { if (confirm("Đặt lại tài khoản giả lập về 10.000 USDT? Mọi lệnh và vị thế giả lập sẽ bị xoá.")) paper.reset(); };
$("ptOrders").onclick = e => { const b = e.target.closest("[data-pc]"); if (b) paper.cancel(b.dataset.pc); };
$("ptPos").onclick = e => {
  const b = e.target.closest("[data-pa]"); if (!b) return;
  if (b.dataset.pa === "close") paper.closePosition(pkey(), market.book);
  else { const v = +$(b.dataset.pa === "sl" ? "ptSl" : "ptTp").value; if (v > 0) paper.setBracket(pkey(), b.dataset.pa, v); else toast("Nhập giá vào ô " + b.dataset.pa.toUpperCase(), true); }
};
setInterval(() => { const k = pkey(); if (paper.openOrders(k).length) paper.onBook(k, market.book); if (paper.pos(k).qty) { const m = market.book.mid(); if (m != null) paper.pos(k).mark = market.last ? market.last.p : m; schedulePaper(); } }, 1000);
renderPaper();

// bố cục lưới ghép: kéo tiêu đề khung để đổi chỗ, nút — để thu nhỏ, menu ▦ Bố cục để lưu / về mặc định
let tiles = null;
tiles = new Layout(ws, ["mainPanel", "lmapPanel", "domPanel", "tapePanel", "wallPanel", "orderPanel"], {
  legacy: { lmapW: layout.lmapW, rightW: layout.rightW, tapeW: layout.tapeW },
  // mặc định như bản cũ; nhật ký tường và khung Lệnh giả lập (thu nhỏ sẵn) nằm dưới Smart Tape
  tree: legacy => { const t = defaultTree(legacy); t.kids[3] = { dir: "col", flex: 0, kids: ["tapePanel", "wallPanel", "orderPanel"], size: [0, 300, 380] }; return t; },
  hiddenDefault: ["orderPanel"],
  onChange: () => {
    if (!tiles) return;
    const off = tiles.isMin("lmapPanel");
    ws.classList.toggle("nolmap", off); $("lmapShow").checked = !off;
    heat.dirty = flow.dirty = dom.dirty = tape.dirty = lmap.dirty = true;
  },
});
if (layout.lmapOff && !tiles.isMin("lmapPanel")) { tiles.minimize("lmapPanel"); setLayout("lmapOff", null); }
tiles.onChange();
const lmapShow = on => on ? tiles.restore("lmapPanel") : tiles.minimize("lmapPanel");
$("lmapShow").onchange = () => lmapShow($("lmapShow").checked);
$("lmapHide").onclick = () => lmapShow(false);
for (const b of document.querySelectorAll("[data-min]")) b.onclick = e => { e.stopPropagation(); setMax(null); tiles.minimize(b.dataset.min); };
function renderLayoutMenu() {
  const pr = Object.keys(tiles.presets()), mins = tiles.ids.filter(id => tiles.isMin(id));
  $("layoutMenu").innerHTML = `<div class="mh">Bố cục</div>
    <div class="li"><button data-lay="reset">↺ Về mặc định</button></div>
    <div class="li"><button data-lay="save">＋ Lưu bố cục đang dùng…</button></div>
    ${pr.length ? `<div class="mh">Đã lưu</div>` + pr.map(n => `<div class="li"><button data-lay="load" data-n="${esc(n)}">${esc(n)}</button><button class="icon" data-lay="del" data-n="${esc(n)}" data-tip="Xoá bố cục này">✕</button></div>`).join("") : ""}
    ${mins.length ? `<div class="mh">Đang thu nhỏ</div>` + mins.map(id => `<div class="li"><button data-lay="restore" data-n="${id}">▣ ${PANEL_NAMES[id]}</button></div>`).join("") : ""}
    <div class="hint">Kéo tiêu đề một khung thả lên khung khác: mép trái, phải, trên, dưới để ghép cạnh; giữa để đổi chỗ. Kéo đường chia để đổi kích thước. Nút — thu nhỏ, ⤢ phóng to.</div>`;
}
$("layoutBtn").onclick = e => { e.stopPropagation(); const d = $("layoutBtn").parentElement; d.classList.toggle("open"); if (d.classList.contains("open")) renderLayoutMenu(); };
$("layoutMenu").onclick = e => {
  const b = e.target.closest("[data-lay]"); if (!b) return;
  e.stopPropagation();
  const a = b.dataset.lay, n = b.dataset.n;
  if (a === "reset") tiles.reset();
  else if (a === "save") { const name = (prompt("Đặt tên cho bố cục này (ví dụ: Scalp, Swing)") || "").trim().slice(0, 30); if (name) tiles.savePreset(name); }
  else if (a === "load") tiles.loadPreset(n);
  else if (a === "del") tiles.deletePreset(n);
  else if (a === "restore") tiles.restore(n);
  renderLayoutMenu();
};
// thu gọn khung dưới và ẩn thanh công cụ biểu đồ để biểu đồ cao hơn
const redrawAll = () => { heat.dirty = flow.dirty = dom.dirty = tape.dirty = lmap.dirty = true; };
const toolsShow = on => { ws.classList.toggle("notools", !on); $("toolsBtn").classList.toggle("on", on); setLayout("toolsOff", on ? null : 1); redrawAll(); };
$("toolsBtn").onclick = () => toolsShow(!!layout.toolsOff);
if (layout.toolsOff) toolsShow(false);
// điện thoại: thanh dưới cùng chọn khung đang xem
const mShow = id => {
  for (const b of $("mnav").children) b.classList.toggle("on", b.dataset.panel === id);
  // sổ lệnh đi kèm bản đồ thanh khoản bên trái (cùng dòng giá)
  for (const p of ws.querySelectorAll(":scope > .panel")) p.classList.toggle("mshow", p.id === id || (id === "domPanel" && p.id === "lmapPanel"));
  try { sessionStorage.setItem("lailong.mpanel", id); } catch { /* bỏ qua */ }
  redrawAll();
};
$("mnav").onclick = e => { const b = e.target.closest("[data-panel]"); if (b) mShow(b.dataset.panel); };
{ let id = null; try { id = sessionStorage.getItem("lailong.mpanel"); } catch { /* bỏ qua */ } mShow(id && $(id) && $("mnav").querySelector(`[data-panel="${id}"]`) ? id : "mainPanel"); }
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
setInterval(() => tickFresh(), 1000); // chữ "N trước" và trạng thái đỏ của các nhãn dữ liệu
