// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: ghép dữ liệu, biểu đồ, phân tích và backtest thành một trang phân tích thuần giá và khối lượng.

import { EXCHANGES, attachOi, attachFunding, inferTick, candleCountdown } from "./exchanges.js?v=202611150608";
import { MarketState } from "./market.js?v=202611150608";
import { FlowChart } from "./flowchart.js?v=202611150608";
import { Dom } from "./dom.js?v=202611150608";
import { srLevels, abnormalVolume, liquidationMap, summary, isDeltaApprox } from "./analytics.js?v=202611150608";
import { initBacktest } from "./backtestview.js?v=202611150608";
import { approxFootprint, exactFootprintBinance } from "./fphistory.js?v=202611150608";
import { absorption, clusterSearch } from "./orderflow.js?v=202611150608";
import { Tape } from "./tape.js?v=202611150608";
import { vpin, percentileOf, groupFlow, algoRuns, signalScore, SCORE_PARTS, atrSeries } from "./flowtools.js?v=202611150608";
import { WallTracker, WALL_KIND, wallStats } from "./walls.js?v=202611150608";
import { Alerts } from "./alerts.js?v=202611150608";
import { setVenue } from "./venue.js?v=202611150608";
import { initNews } from "./newsview.js?v=202611150608";
import { initSocial } from "./socialview.js?v=202611150608";
import { initMarkets } from "./marketsview.js?v=202611150608";
import { initTgBot } from "./tgbot.js?v=202611150608";
import { initInst } from "./instview.js?v=202611150608";
import { setFresh, tickFresh } from "./fresh.js?v=202611150608";
import { initRadar } from "./radarview.js?v=202611150608";
import { Drawings } from "./drawings.js?v=202611150608";
import { Layout, NAMES as PANEL_NAMES } from "./layout.js?v=202611150608";
import { MultiChart } from "./multichart.js?v=202611150608";
import { DOM_COLS } from "./dom.js?v=202611150608";
import { initFractal } from "./fractalview.js?v=202611150608";
import { initJournal } from "./journalview.js?v=202611150608";
import { installHealth, clockSkew } from "./health.js?v=202611150608";
import { initHealth } from "./healthview.js?v=202611150608";
import { initFlows } from "./flowsview.js?v=202611150608";
import { initSentiment } from "./sentimentview.js?v=202611150608";
import { initPerf } from "./perfview.js?v=202611150608";
import { initShock } from "./shockview.js?v=202611150608";
import { initCompass } from "./compassview.js?v=202611150608";
import { initConsensus } from "./consensusview.js?v=202611150608";
import { initBackup, KEEP_KEYS } from "./backup.js?v=202611150608";
import { initSignals, isVerified, VERIFIED_KEY } from "./signalsview.js?v=202611150608";
import { logEvent, fromWall, fromIce, fromBig } from "./eventlog.js?v=202611150608";
import { liveZones, BUCKETS, bucketOf, KINDS as LEVEL_KINDS, CONFL_MIN } from "./levels.js?v=202611150608";
import { fromDeribit, pick as gexPick, levels as gexLevels } from "./gex.js?v=202611150608";
import { GLOSSARY, GROUPS } from "./glossary.js?v=202611150608";
import { T, THEMES, COLOR_GROUPS, DEFAULT_THEME, applyTheme, loadTheme, saveTheme, resetTheme, cleanTheme, alpha } from "./theme.js?v=202611150608";
import { mountLang } from "./lang.js?v=202611150608";
import { initI18n } from "./i18n.js?v=202611150608";
import { ProfPanel, PROF_MODES, PROF_SRC } from "./profpanel.js?v=202611150608";
import { IND_KEYS, cotIndex, seasonal, candleProfiles, SUB_IV } from "./indicators.js?v=202611150608";
import { linkOf } from "./consensus.js?v=202611150608";
import { zoneStep, niceStep, bookZones, historyZones, mergeZones, loadWallHist, saveWallHist, trimWallHist } from "./zones.js?v=202611150608";
import { fmtVol, fmtUsd, fmtPct, fmtTime, fmtDate, decimalsFor, INTERVALS, getJson, binanceBudget, pad2, ivLabel } from "./util.js?v=202611150608";

const $ = id => document.getElementById(id);
installHealth(); // ghi lại mọi lần gọi dữ liệu ra ngoài cho trang Sức khoẻ dữ liệu
// Tuỳ chỉnh (bố cục, cột, khung, màu, cài đặt biểu đồ…) chỉ giữ trong lúc tab còn mở (sessionStorage).
// Đóng tab rồi mở lại là về mặc định. Chỉ giữ lâu dài: nhật ký, màu bro bấm "Lưu", báo cáo hiệu suất,
// chiến lược đang forward test và mã Telegram (danh sách trong backup.js).
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
  tab: "clusters",
  grid: [1, 2, 4, 6].includes(saved.grid) ? saved.grid : 1, // số biểu đồ trong khung Biểu đồ
};
if (!EXCHANGES[S.ex]) S.ex = "BINANCE";
if (!INTERVALS[S.interval]) S.interval = "1m";
const persist = () => {
  try { sessionStorage.setItem("lailong.ui", JSON.stringify({ ex: S.ex, symbol: S.symbol, interval: S.interval, view: S.view, grid: S.grid })); } catch { /* bỏ qua */ }
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

const flow = new FlowChart($("flow"));
flow.setType("box"); // Terminal thuần order flow: luôn là footprint
Object.defineProperty(flow, "book", { get: () => market.book }); // Depth Of Market: sổ lệnh lên biểu đồ nến / footprint (sổ đổi khi đổi mã)
// sổ lệnh đổi liên tục: vẽ lại biểu đồ 4 lần mỗi giây khi đang xem nến / footprint và bật Depth Of Market
setInterval(() => { if (flow.show.depth && !document.hidden && S.grid === 1) flow.dirty = true; }, 250);
const dom = new Dom($("dom"), market);
const tape = new Tape($("tape"), market);
// ô KL theo giá: mặc định theo vùng đang xem trên biểu đồ; 4g · 1N · 1T tải nến nhỏ của khoảng đó
const prof = new ProfPanel($("prof"));
let profMode = (() => { try { const m = localStorage.getItem("lailong.profMode"); return PROF_MODES.some(x => x[0] === m) ? m : "chart"; } catch { return "chart"; } })();
const profSrc = new Map(); let profSig = "", profVis = null; // profVis: số nến tính từ cuối của vùng đang xem lần gần nhất biểu đồ hiện trên màn hình
function renderProfChips() { $("profChips").innerHTML = PROF_MODES.map(([id, name]) => `<button class="chip${id === profMode ? " on" : ""}" data-pm="${id}">${name}</button>`).join(""); }
$("profChips").onclick = e => { const b = e.target.closest("[data-pm]"); if (!b) return; profMode = b.dataset.pm; try { localStorage.setItem("lailong.profMode", profMode); } catch { /* bỏ qua */ } renderProfChips(); profSig = ""; updateProf(); };
function updateProf() {
  const p = market.last ? market.last.p : market.book.mid(); prof.setPrice(p);
  if (!$("profPanel").offsetWidth) return;
  if (profMode === "chart") {
    const bars = flow.bars; if (!bars.length || !flow._L) return;
    let [a, b] = flow._visible(), n = bars.length;
    if ($("flow").offsetWidth > 60 && b >= a) profVis = [n - 1 - a, n - 1 - b]; // điện thoại: biểu đồ đang ẩn thì dùng vùng xem gần nhất
    else { const v = profVis || [Math.min(n - 1, 99), 0]; a = Math.max(0, n - 1 - v[0]); b = Math.max(a, n - 1 - v[1]); }
    const lb = bars[b] || {}, sig = `c:${S.symbol}:${S.interval}:${a}:${b}:${bars.length}:${lb.v}`; if (sig === profSig) return; profSig = sig;
    prof.set(bars.slice(a, b + 1), { fpStep: market.fpStep, tick: market.tick, price: p, label: `${b - a + 1} nến ${ivLabel(S.interval)} đang xem trên biểu đồ` });
    return;
  }
  const [iv, n] = PROF_SRC[profMode], k = `${key()}:${profMode}`, c = profSrc.get(k);
  if (!c || Date.now() - c.t > 60e3) {
    if (!c || !c.busy) { const e = c || { t: 0, bars: [] }; e.busy = true; profSrc.set(k, e); ex().klines(S.symbol, iv, n).then(bars => { profSrc.set(k, { t: Date.now(), bars }); profSig = ""; updateProf(); }).catch(err => { e.busy = false; e.t = Date.now(); log(`Không tải được nến ${iv} cho KL theo giá: ${err.message}`); }); }
    if (!c || !c.bars.length) { if (profSig !== k + ":wait") { profSig = k + ":wait"; prof.set([], { label: "" }); } return; }
  }
  const sig = `${k}:${c.t}`; if (sig === profSig) return; profSig = sig;
  prof.set(c.bars, { tick: market.tick, price: p, label: `${{ "4h": "4 giờ", "1d": "1 ngày", "1w": "1 tuần" }[profMode]} gần nhất · nến ${iv}` });
}
setInterval(updateProf, 1000);
const walls = new WallTracker(); dom.walls = walls; flow.walls = walls; // vùng lệnh chờ lớn đang đứng vẽ lên footprint
const redrawAll = () => { flow.dirty = dom.dirty = tape.dirty = prof.dirty = true; };
flow.prints = () => [market.histPrints, market.prints];
flow.opts.onRange = () => {};

// ---------- tải dữ liệu một mã ----------
let conn = null, loadToken = 0, analysis = null, fpState = null;
// trạng thái phát lại, đo nhịp sổ lệnh và độ trễ cho thanh trạng thái
const RP = { on: false, end: 0, play: false, speed: 1, timer: null, picking: false };
const sb = { bookT: 0, bookGap: null, lat: null };
// thẻ các mã đã mở gần đây, như hàng thẻ mã của Bookmap (nhớ trong phiên)
const TABS_KEY = "lailong.symtabs";
let symTabs = (() => { try { return JSON.parse(sessionStorage.getItem(TABS_KEY) || "[]"); } catch { return []; } })();
function renderTabs() {
  $("symTabs").innerHTML = symTabs.map(t => { const on = t.ex === S.ex && t.s === S.symbol; return `<span class="stab${on ? " on" : ""}" data-ex="${esc(t.ex)}" data-s="${esc(t.s)}" data-i="${esc(t.i || "")}" data-tip="${esc(EXCHANGES[t.ex] ? EXCHANGES[t.ex].name : t.ex)}"><b>${esc(t.s)}</b><i>${esc(on ? S.interval : t.i || "")}</i>${on ? "" : `<button class="x" data-tip="Đóng thẻ này">×</button>`}</span>`; }).join("");
}
function rememberTab() {
  symTabs = [{ ex: S.ex, s: S.symbol, i: S.interval }, ...symTabs.filter(t => !(t.ex === S.ex && t.s === S.symbol))].slice(0, 10);
  try { sessionStorage.setItem(TABS_KEY, JSON.stringify(symTabs)); } catch { /* bỏ qua */ }
  renderTabs();
}
$("symTabs").onclick = e => {
  const tab = e.target.closest(".stab"); if (!tab) return;
  if (e.target.closest(".x")) { symTabs = symTabs.filter(t => !(t.ex === tab.dataset.ex && t.s === tab.dataset.s)); try { sessionStorage.setItem(TABS_KEY, JSON.stringify(symTabs)); } catch { /* bỏ qua */ } renderTabs(); return; }
  if (tab.dataset.ex === S.ex && tab.dataset.s === S.symbol) return;
  const exChanged = S.ex !== tab.dataset.ex; S.ex = tab.dataset.ex; S.symbol = tab.dataset.s; if (INTERVALS[tab.dataset.i]) { S.interval = tab.dataset.i; ivPaint(); } $("exchange").value = S.ex; $("symbol").value = S.symbol; if (exChanged) loadSymbols(); load();
};
async function load() {
  setVenue(S.ex); // các tab crypto khác lấy theo sàn này
  const token = ++loadToken; persist(); rememberTab();
  if (RP.on) replayStop();
  if (conn) { conn.close(); conn = null; }
  market.reset({ symbol: S.symbol, exchange: S.ex, interval: S.interval });
  draw.sym = S.symbol;
  alPrevP = null;
  dom.reset(); flow.setData([], {}); flow.fpProgress = ""; flow.ranges = []; analysis = null; fpState = null; absorb = []; clusters = null; scores = null; algo = []; walls.reset(); conflZones = []; flow.setOverlays({ confl: [], spoofs: walls.events, algoRuns: [], scores: [], vpinVals: null, groupVals: null, zonesBook: null, candleProf: null }); tape.reset(); renderSignals(); renderTab();
  setConn("Đang tải dữ liệu", null);
  let info = { tick: 0, ctVal: 1 };
  try { info = await ex().info(S.symbol); } catch (e) { log(`Không lấy được thông tin mã: ${e.message}`); }
  if (token !== loadToken) return;
  market.tick = info.tick; tape.pv.reset(info.tick || 0); syncAlertLines();
  const pBook = market.book;
  const onBook = () => {
    if (token !== loadToken) return;
    const now = performance.now(); if (sb.bookT) sb.bookGap = sb.bookGap == null ? now - sb.bookT : sb.bookGap * 0.9 + (now - sb.bookT) * 0.1; sb.bookT = now;
    if (!market.tick) { const s = pBook.sorted(); market.tick = inferTick(s.bids.slice(0, 30).map(x => x[0])); }
    market.onBook(); dom.update();
  };
  const c0 = ex().connect(S.symbol, info, pBook, {
    onBook,
    onTrades: list => {
      if (token !== loadToken) return; market.onTrades(list); tape.addTrades(list);
      const t = list[list.length - 1]; if (t) { const l = Date.now() + clockSkew() - t.t; sb.lat = sb.lat == null ? l : sb.lat * 0.9 + l * 0.1; }
    },
    onLiq: list => { if (token !== loadToken) return; market.onLiq(list); },
    onStatus: (text, ok) => { if (token === loadToken) { setConn(text, ok); log(text); } },
  });
  conn = c0;
  try {
    const bars = await ex().klines(S.symbol, S.interval, 1500);
    if (ex().hasOi && bars.length && !BIG_IV.has(S.interval)) {
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
    startFootprint();
    seedDayVolume(token);
    loadCandleProf(token); loadIndData();
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
  flow.setOverlays({ levels, zones, liqMap, marks: priceMarks(bars) });
  recomputeFlow();
  renderSignals();
  updateConfl();
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
  tape.absorbEvents = absorb;
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
setInterval(() => recomputePrints(), 5000);
// tường lệnh chờ: so sổ lệnh mỗi giây
setInterval(() => {
  const cols = market.cols; let col = null; for (let i = cols.length - 1; i >= Math.max(0, cols.length - 4); i--) if (cols[i].keys) { col = cols[i]; break; }
  const done = walls.step(Date.now(), col, market.book.mid(), market.grid, market.tradedGrid);
  for (const e of done) { const ev = canLog() && fromWall(e, S.symbol, S.ex); if (ev) logEvent(ev); }
  logIce();
  for (const e of done) if (e.kind === "spoof" && alerts.cfg.spoof && gate("wall.pulled")) alerts.fire("spoof", `${S.symbol}: tường ${e.side === "bid" ? "chờ mua" : "chờ bán"} ${fmtVol(e.q)} tại ${e.price.toFixed(decimalsFor(market.tick))} bị rút khi giá tới gần (nghi tường giả)`, e.side === "bid" ? "down" : "up");
  // tường lớn mới xuất hiện gần giá: lớn hơn 1,5 lần trung vị cỡ tường trong phiên, cách giá ≤ 0,3%
  const born = walls.born.splice(0), mid = market.book.mid();
  if (born.length) { const t = Date.now(); for (const w of born) wallHist.push({ t, side: w.side, price: w.p, q: w.q }); wallHistDirty = true; }
  if (born.length && alerts.cfg.wallNew && mid && walls.log.length >= 8) {
    const qs = walls.log.map(x => x.q).sort((a, b) => a - b), med = qs[qs.length >> 1];
    const big = born.filter(w => w.q >= 1.5 * med && Math.abs(w.p - mid) / mid <= 0.003).sort((a, b) => b.q - a.q)[0];
    if (big) alerts.fire("wallNew", `${S.symbol}: tường ${big.side === "bid" ? "chờ mua" : "chờ bán"} ${fmtVol(big.q)} xuất hiện tại ${big.p.toFixed(decimalsFor(market.tick))} (cách giá ${(Math.abs(big.p - mid) / mid * 100).toFixed(2)}%, gấp ${(big.q / med).toFixed(1)} lần tường thường gặp)`, big.side === "bid" ? "up" : "down");
  }
  if (done.length) flow.dirty = true;
}, 1000);
// ---------- nhật ký tường ----------
let wallSeg = "log", wallSig = "";
// nhật ký tường lớn lưu trên máy theo mã (30 ngày, tối đa 3000 dòng): khung lớn dùng để vẽ vùng từng có tường
let wallHist = [], wallHistSym = "", wallHistDirty = false;
function wallHistFor(sym) { if (sym !== wallHistSym) { flushWallHist(); wallHist = trimWallHist(loadWallHist(sym)); wallHistSym = sym; } return wallHist; }
function flushWallHist() { if (wallHistDirty && wallHistSym) { wallHist = trimWallHist(wallHist); saveWallHist(wallHistSym, wallHist); } wallHistDirty = false; }
setInterval(flushWallHist, 30e3); addEventListener("pagehide", flushWallHist);
// khung từ 1h: sổ lệnh gộp theo nấc thô thành vùng chờ mua/bán, cộng vùng từng có tường trong nhật ký
function updateZones() {
  wallHistFor(S.symbol);
  if (!flow.bigTf()) { if (flow.zonesBook) flow.setOverlays({ zonesBook: null }); return; }
  const mid = market.book.mid(); let step = zoneStep(S.interval, mid); if (!step) return;
  const s = market.book.sorted(), lo = s.bids.length ? s.bids[s.bids.length - 1][0] : mid, hi = s.asks.length ? s.asks[s.asks.length - 1][0] : mid;
  if ((hi - lo) / step < 12) step = Math.max(niceStep((hi - lo) / 12), market.tick || 0); // sổ lệnh sàn trả về hẹp: thu nấc để vẫn thấy cấu trúc
  if (!(step > 0)) return;
  flow.setOverlays({ zonesBook: mergeZones(bookZones(s.bids, s.asks, step), historyZones(wallHist, step)), zoneStep: step });
}
setInterval(updateZones, 3000);
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
function syncAlertLines() { const a = alerts.levelsOf(S.symbol).map(l => l.price); if (a.join() !== (flow.alertLevels || []).join()) { flow.alertLevels = a; flow.dirty = true; } }
setInterval(() => syncAlertLines(), 2000);
function renderAlertMenu() {
  syncAlertLines();
  const dec = decimalsFor(market.tick), lv = alerts.levelsOf(S.symbol);
  for (const cb of document.querySelectorAll("[data-al]")) cb.checked = !!alerts.cfg[cb.dataset.al];
  $("alList").innerHTML = lv.length ? lv.map(l => `<div class="alrow"><span>${esc(S.symbol)} chạm <b>${l.price.toFixed(dec)}</b></span><button class="icon" data-alrm="${l.i}" data-tip="Xoá">✕</button></div>`).join("") : `<div class="muted">Chưa có mức giá nào cho ${esc(S.symbol)}.</div>`;
  $("alHist").innerHTML = alerts.hist.length ? "<b>Vừa kêu</b>" + alerts.hist.slice(0, 6).map(h => `<div>${fmtTime(h.t, true)} · ${esc(h.text)}</div>`).join("") : "";
}
alerts.onFire = () => { if ($("alertBtn").parentElement.classList.contains("open")) renderAlertMenu(); };
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
const newsView = initNews({ $, esc, alerts, coin });
mountLang($("langBtn")); initI18n(); // nút VI / EN góc trên bên phải: đổi ngôn ngữ cả trang
const socialView = initSocial({ $, esc });
const marketsView = initMarkets({ $, esc });
initTgBot({ alerts, onTap: d => (d.startsWith("sig:") ? signalsView.onTap(d) : null) });
const instView = initInst({ $, esc });
const radarView = initRadar({ $, esc, onPick: sym => { if (S.ex === "SIM") S.ex = "BINANCE"; $("exchange").value = S.ex; S.symbol = sym; $("symbol").value = sym; load(); setView("terminal"); } });
const multiChart = new MultiChart($("mcRoot"), { ex: () => ex() }); // lưới 2/4/6 biểu đồ trong khung Biểu đồ

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
  if (S.grid !== 1) setGrid(1);
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
// tab con của Phân tích: mỗi khối gắn data-at với các tab nó thuộc về; nhớ tab đang chọn trong phiên.
// Mục Thị trường (trước là trang riêng) chỉ tải dữ liệu khi đang mở.
let aTab = "macro"; try { aTab = sessionStorage.getItem("lailong.atab") || aTab; } catch { /* bỏ qua */ }
if (![...$("aTabs").children].some(b => b.dataset.at === aTab)) aTab = "macro"; // Tin tức, Mức giá, Tổng quan, Phái sinh đã bỏ
function syncMarkets() { if (S.view === "analysis" && aTab === "markets") marketsView.show(); else marketsView.hide(); }
function anTab(at) {
  if (at) aTab = at;
  for (const b of $("aTabs").children) b.classList.toggle("on", b.dataset.at === aTab);
  for (const sec of document.querySelectorAll("#view-analysis section[data-at]")) sec.hidden = !sec.dataset.at.split(" ").includes(aTab);
  $("view-markets").hidden = aTab !== "markets";
  try { sessionStorage.setItem("lailong.atab", aTab); } catch { /* bỏ qua */ }
  if (typeof marketsView !== "undefined") syncMarkets();
}
// tab con của Tin tức: Tin tức (lịch kinh tế, tin, bản đồ tác động) và Mạng xã hội
let nTabCur = "news"; try { nTabCur = sessionStorage.getItem("lailong.ntab") === "social" ? "social" : "news"; } catch { /* bỏ qua */ }
function nTab(t) {
  if (t) nTabCur = t;
  for (const b of $("nTabs").children) b.classList.toggle("on", b.dataset.nt === nTabCur);
  $("newsPane").hidden = nTabCur !== "news"; $("view-social").hidden = nTabCur !== "social";
  try { sessionStorage.setItem("lailong.ntab", nTabCur); } catch { /* bỏ qua */ }
  if (S.view === "news" && typeof socialView !== "undefined") { if (nTabCur === "social") socialView.render(); else newsView.render(); }
}
$("nTabs").onclick = e => { const b = e.target.closest("[data-nt]"); if (b) nTab(b.dataset.nt); };
$("aTabs").onclick = e => { const b = e.target.closest("[data-at]"); if (b) anTab(b.dataset.at); };
anTab(); nTab();


// ---------- trang Backtest ----------
const btChart = new FlowChart($("btChart"), { emptyText: "Bấm \"Chạy backtest\" để xem điểm vào/ra lệnh trên biểu đồ" });
btChart.show = { ...btChart.show, liq: false, liqMap: false, profile: false };
// ---------- chú thích khi rê chuột ----------
const tipEl = $("tip");
const fractal = initFractal({ $, S, ex, esc, table, log });
const backtest = initBacktest({ $, S, ex, esc, table, market, chart: btChart });
initBackup({ $, toast });
const journal = initJournal({ $, S, esc, table, market, toast, events: () => newsView.events(), ctx: { macro: () => compassView.data(), flip: gexFlip }, notify: (kind, text, html, showToast) => {
  if (alerts.cfg.disc) alerts.fire("disc-" + kind, text, "down", true, { html, toast: showToast });
}, onLock: lk => {
  const bar = $("riskLockBar"); bar.hidden = !lk;
  if (lk) bar.textContent = `ĐANG KHOÁ GIAO DỊCH tới ${fmtDate(lk.until)}: ${lk.why}.`;
} });
const perfView = initPerf({ $, esc, toast, journal });
const compassView = initCompass({ $, esc, toast, alerts, journal, events: () => newsView.events() });
const consensusView = initConsensus({ $, esc, toast, alerts, journal, events: () => newsView.events(), macro: () => compassView.data() });
const shockView = initShock({ $, esc, table, alerts, journal, events: () => newsView.events(), reactions: () => newsView.reactions() });
const healthView = initHealth({ $, esc });
const flowsView = initFlows({ $, esc });
const sentView = initSentiment({ $, esc });

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
// điểm lật gamma Deribit của BTC, ETH cho bối cảnh lúc vào lệnh; dùng lại bản đã tải trong 10 phút
async function gexFlip(sym) {
  const c = sym.replace(/(USDT|USDC|USD)$/, "");
  if (!["BTC", "ETH"].includes(c)) return null;
  if (!gexLv[c] || Date.now() - (gexT[c] || 0) >= 10 * 60e3) {
    const r = await getJson(`https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${c}&kind=option`);
    gexLv[c] = gexLevels(gexPick(fromDeribit(r.result || []), { maxDays: 30 })); gexT[c] = Date.now();
  }
  return gexLv[c].flip > 0 ? gexLv[c].flip : null;
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
    flow.setOverlays({ confl: zs });
  } finally { conflBusy = false; }
}
const signalsView = initSignals({ $, esc, S, toast, alerts, liveSources });
// nhấp đúp vào ô thông số (Backtest, FRACTAL) để trả về giá trị mặc định
document.addEventListener("dblclick", e => {
  const el = e.target.closest(".btform input[type=number], .btform input[type=text], .btform select"); if (!el) return;
  if (el.type === "checkbox") { el.checked = el.defaultChecked; } else if (el.tagName === "SELECT") { const d = [...el.options].findIndex(o => o.defaultSelected); el.selectedIndex = d < 0 ? 0 : d; } else el.value = el.defaultValue;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.classList.add("reset"); setTimeout(() => el.classList.remove("reset"), 500);
});
const CANVAS_TIP = { flow, dom, tape, prof, btChart, ...fractal.tips, ...backtest.tips, ...multiChart.tips };
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
    return s ? showTip(esc(s).replace(/\n/g, "<br>"), e.clientX, e.clientY) : hideTip();
  }
  const el = t.closest("[data-g],[data-tip]");
  if (!el) return hideTip();
  const g = el.dataset.g && GL.get(el.dataset.g);
  if (g) return showTip(`<b>${esc(g.term)}</b>${esc(g.short)}<small>Bấm vào để đọc giải thích đầy đủ</small>`, e.clientX, e.clientY);
  if (el.dataset.tip) return showTip(esc(el.dataset.tip).replace(/\n/g, "<br>"), e.clientX, e.clientY);
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
$("glossBtn").onclick = () => { gearClose(); if ($("glossary").hidden) openGloss(); else closeGloss(); };
$("glossClose").onclick = closeGloss;
document.addEventListener("click", e => {
  const el = e.target.closest(".q[data-g], th[data-g], span[data-g], .stat[data-g], .dom-cols [data-g]");
  if (el) { e.preventDefault(); openGloss(el.dataset.g); }
});

// ---------- màu sắc: hộp thoại theo nhóm, xem trước ngay, Lưu thì giữ lâu dài ----------
// Mỗi dòng: tên, ô màu, mã hex. Bấm ô màu mở bảng màu (ô màu sẵn, ô nhập mã, bảng màu của máy).
const SWATCHES = ["#ffffff", "#c8d0dc", "#8a93a6", "#4a5266", "#1d222c", "#0b0d12", "#ffd23f", "#ffd166", "#ff9f1c", "#f0b429", "#6b5a12", "#e5484d",
  "#ff5a5f", "#b8323a", "#ff4fa0", "#a78bfa", "#4dd0e1", "#3e8ed0", "#1d3a66", "#14995a", "#1fb57a", "#2fd18b", "#7dffb2", "#9be15d"];
let themeSnap = null, palKey = null;
const hexOk = v => /^#[0-9a-f]{6}$/i.test(v);
function renderThemePanel() {
  $("themePresets").innerHTML = Object.entries(THEMES).map(([id, t]) => `<button data-preset="${id}"><i style="background:${t.bg}"></i><i style="background:${t.text}"></i><i style="background:${t.accent}"></i><i style="background:${t.up}"></i><i style="background:${t.down}"></i> ${esc(t.name)}</button>`).join("");
  $("themeColors").innerHTML = COLOR_GROUPS.map(([g, rows]) => `<div class="cgrp"><h5>${esc(g)}</h5>${rows.map(([k, label]) =>
    `<div class="crow${palKey === k ? " on" : ""}" data-ck="${k}"><span class="cl">${esc(label)}</span><button class="csw" data-ck="${k}" style="background:${T[k]}" aria-label="${esc(label)}"></button><input class="chex" data-hex="${k}" value="${T[k]}" maxlength="7" spellcheck="false" aria-label="${esc(label)}"></div>`).join("")}</div>`).join("");
}
function paintPalette() {
  const p = $("themePal"); if (!palKey) { p.hidden = true; return; }
  const v = T[palKey], label = COLOR_GROUPS.flatMap(g => g[1]).find(r => r[0] === palKey);
  p.innerHTML = `<div class="ph"><b>${esc(label ? label[1] : palKey)}</b><button class="icon" data-pal="x" aria-label="Đóng">✕</button></div>` +
    `<div class="pgrid">${SWATCHES.map(c => `<button data-sw="${c}" class="${c.toLowerCase() === v.toLowerCase() ? "on" : ""}" style="background:${c}" aria-label="${c}"></button>`).join("")}</div>` +
    `<div class="prow"><i style="background:${v}"></i><input id="palHex" value="${v}" maxlength="7" spellcheck="false" aria-label="Mã màu"><input type="color" id="palNative" value="${v}" data-tip="Bảng màu của máy"></div>`;
  p.hidden = false;
  const row = $("themeColors").querySelector(`.crow[data-ck="${palKey}"]`), box = $("themePanel").getBoundingClientRect();
  if (row) { const r = row.getBoundingClientRect(); p.style.top = Math.max(8, Math.min(innerHeight - 260, r.top)) + "px"; p.style.left = (box.right + 246 <= innerWidth ? box.right + 10 : Math.max(8, box.left - 236)) + "px"; } // bảng màu bật ra cạnh hộp thoại, không che dòng màu
}
function setColor(k, v) {
  if (!hexOk(v)) return;
  const patch = { [k]: v.toLowerCase() };
  if (k === "panel") patch.panel2 = mix(v, "#ffffff", 0.06);
  if (k === "bg") patch.grid = mix(v, "#ffffff", 0.08);
  applyTheme(patch);
  const row = $("themeColors").querySelector(`.crow[data-ck="${k}"]`);
  if (row) { row.querySelector(".csw").style.background = v; const h = row.querySelector(".chex"); if (document.activeElement !== h) h.value = v.toLowerCase(); }
  if (palKey === k) paintPalette();
}
const themeOpen = () => { themeSnap = { ...T }; palKey = null; renderThemePanel(); paintPalette(); $("themePanel").hidden = false; $("themeBtn").classList.add("on"); };
const themeHide = () => { palKey = null; paintPalette(); $("themePanel").hidden = true; $("themeBtn").classList.remove("on"); };
const themeCancel = () => { if (themeSnap) applyTheme(cleanTheme(themeSnap)); themeSnap = null; themeHide(); };
$("themeBtn").onclick = () => { gearClose(); if ($("themePanel").hidden) themeOpen(); else themeCancel(); };
$("themeClose").onclick = themeCancel;
$("themeCancel").onclick = themeCancel;
$("themeSave").onclick = () => { saveTheme(); themeSnap = null; themeHide(); toast("Đã lưu màu. Mở lại trang vẫn giữ màu này"); };
$("themeReset").onclick = () => { resetTheme(); palKey = null; renderThemePanel(); paintPalette(); toast("Đã về màu mặc định. Bấm Lưu để giữ, Hủy để quay lại màu cũ"); };
$("themePresets").onclick = e => { const b = e.target.closest("[data-preset]"); if (b) { applyTheme({ ...THEMES[b.dataset.preset] }); renderThemePanel(); paintPalette(); } };
$("themeColors").onclick = e => { const b = e.target.closest(".csw"); if (!b) return; palKey = palKey === b.dataset.ck ? null : b.dataset.ck; for (const r of $("themeColors").querySelectorAll(".crow")) r.classList.toggle("on", r.dataset.ck === palKey); paintPalette(); };
$("themeColors").oninput = e => { const k = e.target.dataset.hex; if (!k) return; let v = e.target.value.trim(); if (!v.startsWith("#")) v = "#" + v; if (hexOk(v)) setColor(k, v); };
$("themePal").onclick = e => { if (e.target.closest("[data-pal]")) { palKey = null; paintPalette(); renderThemePanel(); return; } const b = e.target.closest("[data-sw]"); if (b) setColor(palKey, b.dataset.sw); };
$("themePal").oninput = e => { if (e.target.id === "palNative") setColor(palKey, e.target.value); else if (e.target.id === "palHex") { let v = e.target.value.trim(); if (!v.startsWith("#")) v = "#" + v; if (hexOk(v)) { applyTheme({ [palKey]: v.toLowerCase() }); const row = $("themeColors").querySelector(`.crow[data-ck="${palKey}"]`); if (row) { row.querySelector(".csw").style.background = v; row.querySelector(".chex").value = v.toLowerCase(); } } } };
function mix(a, b, f) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, "0")).join("");
}
window.addEventListener("lailong-theme", () => {
  flow.dirty = dom.dirty = tape.dirty = btChart.dirty = true;
  backtest.redraw();
}); void DEFAULT_THEME;

// ---------- phóng to một khung ----------
const ws = $("view-terminal");
function setMax(id) {
  const p = id && $(id), on = p && !p.classList.contains("maxed");
  document.querySelectorAll(".panel.maxed").forEach(x => x.classList.remove("maxed"));
  if (on) p.classList.add("maxed");
  redrawAll();
}
for (const b of document.querySelectorAll("[data-max]")) b.onclick = () => setMax(b.dataset.max);
// chiều cao thanh trên cùng, cho các ngăn cố định (giải thích, màu, khung phóng to) không bị che
const topH = () => document.documentElement.style.setProperty("--topH", document.querySelector(".menubar").getBoundingClientRect().height + "px");
new ResizeObserver(topH).observe(document.querySelector(".menubar"));
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("glossary").hidden) return closeGloss();
  if (!$("themePanel").hidden) { if (palKey) { palKey = null; paintPalette(); renderThemePanel(); } else themeCancel(); return; }
  setMax(null);
});

// ---------- điều khiển giao diện ----------
function setConn(text, ok) {
  const p = $("connPill"); p.className = "pill" + (ok === true ? " ok" : ok === false ? " bad" : ""); p.querySelector("span").textContent = text;
  const c = $("sbConn"); c.className = "sb-conn" + (ok === true ? " ok" : ok === false ? " bad" : ""); c.dataset.tip = text;
  flow.liveTxt = ok === true ? "trực tiếp" : text; flow.liveOk = ok; flow.dirty = true;
}
// các trang đã gỡ khỏi thanh menu theo yêu cầu (Backtest, FRACTAL, Nhật ký): link cũ mở về Terminal
const DROPPED_VIEWS = new Set(["backtest", "fractal", "journal", "radar", "signals", "depth"]); // Radar, Tín hiệu: bro bỏ khỏi menu, code vẫn giữ
function setView(v) {
  if (v === "markets") { anTab("markets"); v = "analysis"; } // Thị trường đã thành một mục trong tab Phân tích
  if (v === "social") { nTab("social"); v = "news"; } // Mạng xã hội đã thành một mục trong tab Tin tức
  if (DROPPED_VIEWS.has(v) || !$("view-" + v)) v = "terminal";
  S.view = v; persist();
  for (const b of $("views").querySelectorAll("[data-view]")) b.classList.toggle("on", b.dataset.view === v);
  if (v === "terminal") $("railTools").append(alertDD); else gearDD.before(alertDD); // chuông Cảnh báo nằm trên thanh công cụ bên trái khi ở Orderflow
  alertDD.classList.toggle("inrail", v === "terminal");
  if (tiles) renderMinDock();
  for (const id of ["terminal", "radar", "signals", "news", "analysis", "backtest", "fractal", "journal", "health"]) $("view-" + id).hidden = id !== v;
  document.body.classList.toggle("not-terminal", v !== "terminal"); document.body.dataset.view = v; // ô mã, khung thời gian chỉ hiện ở Orderflow
  topH();
  flow.dirty = btChart.dirty = dom.dirty = true;
  if (v === "signals") signalsView.show(); else signalsView.hide();
  if (v === "news") { if (nTabCur === "social") socialView.render(); else newsView.render(); }
  if (v === "analysis") { instView.show(); flowsView.show(); sentView.show(); } else { instView.hide(); flowsView.hide(); sentView.hide(); }
  if (v === "journal") { journal.show(); perfView.show(); compassView.render(); consensusView.render(); shockView.render(); }
  if (v === "health") healthView.show(); else healthView.hide();
  syncMarkets();
  if (v === "radar") radarView.show(); else radarView.hide();
  if (v === "terminal" && S.grid > 1) multiChart.show(); else multiChart.hide();
}
// ---------- lưới 1/2/4/6 biểu đồ trong khung Biểu đồ ----------
function setGrid(n) {
  n = [1, 2, 4, 6].includes(+n) ? +n : 1; S.grid = n; persist();
  for (const b of $("gridSeg").children) b.classList.toggle("on", +b.dataset.n === n);
  const one = n === 1;
  if (!one && RP.on) replayStop();
  $("chartBody").hidden = !one; $("mcRoot").hidden = one; $("chartHint").hidden = !one; $("toolRail").hidden = !one;
  if (one) { multiChart.hide(); flow.dirty = true; }
  else if (S.view === "terminal") { multiChart.setCount(n); multiChart.show(); }
  else multiChart.setCount(n);
}
$("gridSeg").onclick = e => { const b = e.target.closest("[data-n]"); if (b) setGrid(+b.dataset.n); };
$("chartHint").textContent = noHover ? "Kéo: di chuyển · Chụm/mở hai ngón: phóng nến · Chạm đúp: về hiện tại · Giữ ngón tay lên nến: xem ý nghĩa" : "Lăn chuột: phóng to · Kéo: di chuyển · Kéo trục giá: giãn giá · Bấm đúp: về hiện tại · Rê chuột lên nến hoặc vùng lệnh chờ để xem ý nghĩa";

$("exchange").innerHTML = Object.values(EXCHANGES).map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
$("exchange").value = S.ex; $("symbol").value = S.symbol;
$("exchange").onchange = () => { S.ex = $("exchange").value; loadSymbols(); load(); if (S.view === "signals") signalsView.show(); };
$("symbol").addEventListener("change", () => { const v = $("symbol").value.trim().toUpperCase(); if (v && v !== S.symbol) { S.symbol = v; load(); if (S.view === "signals") signalsView.show(); } });
$("symbol").addEventListener("keydown", e => { if (e.key === "Enter") $("symbol").blur(); });
// khung thời gian: một ô, bấm vào thì thả danh sách các khung
const IV_QUICK = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"].filter(i => INTERVALS[i]); // các khung đặt sẵn trên thanh trên cùng; điện thoại chọn trong "Khác"
const ivPaint = () => { $("ivBtn").innerHTML = `${IV_QUICK.includes(S.interval) ? "Khác" : ivLabel(S.interval)} <small>▾</small>`; $("ivBtn").classList.toggle("on", !IV_QUICK.includes(S.interval)); for (const x of $("intervals").children) x.classList.toggle("on", x.dataset.i === S.interval); for (const x of $("ivSeg").children) x.classList.toggle("on", x.dataset.i === S.interval); };
$("intervals").innerHTML = Object.keys(INTERVALS).map(i => `<button data-i="${i}">${ivLabel(i)}</button>`).join("");
$("ivSeg").innerHTML = IV_QUICK.map(i => `<button data-i="${i}">${ivLabel(i)}</button>`).join("");
// khung tuần, tháng: tự chuyển sang nến (mỗi nến có hồ sơ khối lượng riêng); quay lại khung nhỏ thì trả lại footprint nếu đã tự đổi
const BIG_IV = new Set(["1w", "1M"]); let autoCandle = false, spBefore = null;
const fitType = () => {
  if (BIG_IV.has(S.interval)) {
    if (flow.type === "box") { flow.setType("candle"); autoCandle = true; }
    if (spBefore == null) { spBefore = flow.spacing.candle; flow.spacing.candle = Math.max(flow.spacing.candle, 24); } // nến rộng hơn để thấy hồ sơ từng nến
  } else {
    if (spBefore != null) { flow.spacing.candle = spBefore; spBefore = null; }
    if (autoCandle) { flow.setType("box"); autoCandle = false; }
  }
  if (ready) paintChartBtns();
};
let ready = false;
const setInterval_ = i => { if (!INTERVALS[i] || i === S.interval) return; S.interval = i; ivPaint(); fitType(); load(); };
$("ivSeg").onclick = e => { const b = e.target.closest("[data-i]"); if (b) setInterval_(b.dataset.i); };
// danh sách khung nổi ngay dưới nút (vị trí cố định): trên điện thoại thanh mã cuộn ngang nên menu bên trong bị cắt mất
$("ivBtn").onclick = e => {
  e.stopPropagation(); const dd = $("ivBtn").parentElement, m = $("intervals");
  document.querySelectorAll(".dropdown.open").forEach(x => { if (x !== dd) x.classList.remove("open"); });
  if (!dd.classList.toggle("open")) return;
  const r = $("ivBtn").getBoundingClientRect(); m.style.position = "fixed"; m.style.top = `${r.bottom + 4}px`; m.style.marginTop = "0";
  m.style.left = `${Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8))}px`;
};
$("intervals").onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; $("ivBtn").parentElement.classList.remove("open"); setInterval_(b.dataset.i); };
ivPaint();
// đồng hồ đếm ngược tới lúc đóng nến của khung đang xem
setInterval(() => { const el = $("cdTerm"), cd = candleCountdown(INTERVALS[S.interval], Date.now() + clockSkew(), S.interval); el.textContent = `⏱ ${cd.text}`; el.classList.toggle("warn", cd.soon); }, 1000);
// ngân sách gọi REST Binance trong 60 giây qua; đỏ khi sàn đang tạm chặn (lúc đó trang tự ngừng gọi)
setInterval(() => {
  const b = binanceBudget(), el = $("apiPill");
  const pct = Math.round(b.used / b.limit * 100);
  el.className = "pill apipill" + (b.blockedFor ? " bad" : pct >= 60 ? " warn" : "");
  $("gearDot").hidden = !b.blockedFor && pct < 60; $("gearDot").className = b.blockedFor ? "bad" : "";
  el.textContent = b.blockedFor ? `API Binance tạm chặn ${Math.ceil(b.blockedFor / 1000)}s` : `API ${pct}%`;
  el.dataset.tip = b.blockedFor ? `Binance trả lỗi ${b.status} vì gọi quá nhiều. Trang tự ngừng gọi REST tới khi hết hạn; dữ liệu trực tiếp qua WebSocket vẫn chạy` : `Đã dùng ${b.used}/${b.limit} trọng số gọi REST Binance trong 60 giây qua. Trang tự chờ khi chạm 75% để không bị chặn`;
}, 1000);
// ---------- nút ⚙: ngôn ngữ, màu, giải thích, sức khoẻ dữ liệu, sao lưu, cài app ----------
const gearClose = () => $("gearBtn").parentElement.classList.remove("open");
const gearSw = () => { const c = getComputedStyle(document.documentElement); $("gearSw").innerHTML = ["--bg", "--accent", "--buy", "--sell"].map(k => `<i style="background:${c.getPropertyValue(k)}"></i>`).join(""); };
$("gearBtn").onclick = e => { e.stopPropagation(); const d = $("gearBtn").parentElement; d.classList.toggle("open"); if (d.classList.contains("open")) gearSw(); };
$("gearHealth").onclick = () => { gearClose(); setView("health"); };
$("gearBackup").onclick = () => { gearClose(); setView("health"); const c = $("backupCard"); if (c) c.scrollIntoView({ block: "start", behavior: "smooth" }); };
$("views").onclick = e => { const b = e.target.closest("[data-view]"); if (b) setView(b.dataset.view); };
const alertDD = $("alertBtn").parentElement, gearDD = $("gearBtn").parentElement;
$("layerBtn").onclick = e => { e.stopPropagation(); const d = $("layerBtn").parentElement, was = d.classList.contains("open"); document.querySelectorAll(".dropdown.open").forEach(x => x.classList.remove("open")); if (!was) d.classList.add("open"); };
$("layerMenu").onclick = e => e.stopPropagation();
// ---------- chỉ báo nút ƒx: lựa chọn lưu trên máy ----------
const IND_SAVE = "lailong.ind";
flow.ind = (() => { try { const o = JSON.parse(localStorage.getItem(IND_SAVE) || "{}"); return Object.fromEntries(IND_KEYS.map(k => [k, !!o[k]])); } catch { return {}; } })();
function renderInd() {
  for (const b of document.querySelectorAll("[data-ind]")) b.checked = !!flow.ind[b.dataset.ind];
  const n = IND_KEYS.filter(k => flow.ind[k]).length; $("indCount").textContent = n; $("indCount").classList.toggle("on", n > 0); $("indBtn").classList.toggle("on", n > 0);
}
$("indBtn").onclick = e => { e.stopPropagation(); const d = $("indBtn").parentElement, was = d.classList.contains("open"); document.querySelectorAll(".dropdown.open").forEach(x => x.classList.remove("open")); if (!was) d.classList.add("open"); };
$("indMenu").onclick = e => e.stopPropagation();
$("indMenu").onchange = e => {
  const k = e.target.dataset.ind; if (!k) return;
  flow.ind = { ...flow.ind, [k]: e.target.checked }; try { localStorage.setItem(IND_SAVE, JSON.stringify(flow.ind)); } catch { /* bỏ qua */ }
  renderInd(); loadIndData(); flow.dirty = true;
};
let cotReq = null; const seasReq = new Map();
// dữ liệu cho COT index (data/cot.json, số liệu CFTC theo tuần) và Seasonal (nến ngày ~5 năm), tải khi bật
async function loadIndData() {
  const sym = S.symbol, k2 = key();
  if (flow.ind.cot) {
    if (!cotReq) cotReq = getJson(`data/cot.json?t=${Math.floor(Date.now() / 36e5)}`).catch(() => null);
    const d = await cotReq, lk = linkOf(sym), it = lk.cot && d && (d.items || []).find(i => i.sym === lk.cot);
    if (sym !== S.symbol) return;
    if (!d) cotReq = null; // lần sau thử lại
    flow.setOverlays({ indData: { ...flow.indData, cot: it && it.hist ? { pts: cotIndex(it.hist, 26), name: `${it.name || it.sym}${lk.proxy ? ", đại diện" : ""}` } : { msg: !d ? "chưa tải được dữ liệu COT" : "chưa có COT cho mã này" } } });
  }
  if (flow.ind.seasonal) {
    if (!seasReq.has(k2)) seasReq.set(k2, ex().klines(sym, "1d", 2200).then(b => seasonal(b)).catch(e => ({ err: e.message })));
    const s = await seasReq.get(k2); if (k2 !== key()) return;
    if (s && s.err) seasReq.delete(k2);
    flow.setOverlays({ indData: { ...flow.indData, seas: s && s.avg ? s : null, seasMsg: s && s.err ? "chưa tải được nến ngày" : "chưa đủ một năm trọn dữ liệu ngày" } });
  }
}
// khung tuần, tháng: hồ sơ khối lượng từng nến dựng từ nến 4h (tuần) hoặc nến ngày (tháng)
async function loadCandleProf(token) {
  const sub = SUB_IV[S.interval]; if (!sub) return;
  try { const bars = await ex().klines(S.symbol, sub, 1500); if (token === loadToken) flow.setOverlays({ candleProf: candleProfiles(market.bars, bars) }); }
  catch (e) { log(`Không tải được nến ${sub} để dựng hồ sơ từng nến: ${e.message}`); }
}
document.addEventListener("click", e => { if (!e.target.closest(".dropdown")) document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open")); });
// lớp hiển thị: lớp phân tích mặc định tắt hết, bật trong nút Lớp trên thanh bên trái.
// Phần lõi (vạch lệnh chờ lớn, mất cân bằng, hồ sơ khối lượng, dòng số dưới nến, Depth Of Market) không tính vào số lớp đang bật.
const CORE_LAYERS = new Set(["stats", "depth", "walls", "imb", "profile"]);
const LAYER_BOX = {};
function renderLayerCount() {
  const n = Object.keys(LAYER_BOX).filter(k => !CORE_LAYERS.has(k) && LAYER_BOX[k].checked).length;
  $("layerCount").textContent = n; $("layerCount").classList.toggle("on", n > 0);
}
// nút Footprint / Nến / Hồ sơ trên thanh bên trái
function paintChartBtns() {
  const fp = flow.type === "box"; $("fpBtn").classList.toggle("on", fp); $("candleBtn").classList.toggle("on", !fp);
  $("profBtn").classList.toggle("on", !!(LAYER_BOX.profile && LAYER_BOX.profile.checked));
}

// ---------- thanh công cụ bên trái: 6 công cụ vẽ ----------
const draw = new Drawings(); draw.sym = S.symbol; flow.drawings = draw; draw.magnet = false;
// id, tên (chú thích khi rê chuột), nét vẽ biểu tượng 24×24 hoặc chữ. Bấm lại công cụ đang cầm (hoặc Esc) để về chữ thập.
const RAIL = [
  { id: "trend", name: "Đường xu hướng: kéo từ điểm đầu tới điểm cuối (hoặc bấm hai điểm)", d: "M4 19L20 5" },
  { id: "line", name: "Đường ngang tại một giá: bấm vào biểu đồ", d: "M3 12h18" },
  { id: "rect", name: "Hình chữ nhật: kéo chéo để đánh dấu một vùng giá trong một khoảng thời gian", d: "M4 7h16v10H4z" },
  { id: "fib", name: "Fibonacci: kéo từ đáy lên đỉnh (hoặc đỉnh xuống đáy) để vẽ các mức hồi 23,6% · 38,2% · 50% · 61,8% · 78,6%", txt: "FIB" },
  { id: "brush", name: "Brush: giữ chuột rồi vẽ tự do lên biểu đồ", d: "M3 20c3 0 5-1.5 5-4 0-1.7 1.3-3 3-3M11 13l9-9M14 10l2 2" },
  { id: "path", name: "Path: bấm từng điểm để vẽ đường gấp khúc có mũi tên ở cuối; bấm đúp hoặc Enter để xong", d: "M3 19l5-7 5 4 7-10M16 6h4v4" },
  { id: "measure", name: "Thước đo: kéo để xem chênh giá, %, số nến, thời gian, khối lượng. Không cần chọn công cụ: giữ Alt rồi kéo", d: "M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2" },
];
let tool = "cross";
function renderRail() {
  $("toolRail").innerHTML = RAIL.map(r => `<button class="rt${tool === r.id ? " on" : ""}" data-rl="${r.id}" aria-pressed="${tool === r.id}" aria-label="${esc(r.name)}" data-tip="${esc(r.name)}">${r.txt ? `<b>${esc(r.txt)}</b>` : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${r.d}"/></svg>`}</button>`).join("");
  renderLayerCount();
}
function railToast(text) {
  const el = $("railToast"); el.textContent = text; el.hidden = false;
  clearTimeout(railToast._t); railToast._t = setTimeout(() => { el.hidden = true; }, 2600);
}
const TOOL_HINT = {
  trend: "Kéo từ điểm đầu tới điểm cuối của đường xu hướng", line: "Bấm vào mức giá cần kẻ đường ngang", rect: "Kéo chéo để vẽ hình chữ nhật",
  vline: "Bấm vào thời điểm cần kẻ đường dọc", brush: "Giữ chuột rồi vẽ tự do", path: "Bấm từng điểm, bấm đúp hoặc Enter để xong", fib: "Kéo từ đáy lên đỉnh (hoặc đỉnh xuống đáy) để vẽ Fibonacci", measure: "Kéo để đo. Lần sau chỉ cần giữ Alt rồi kéo",
};
function setTool(t) {
  tool = t || "cross"; draw.pending = null; draw.preview = null;
  flow.crossOn = tool !== "cursor";
  $("flow").style.cursor = flow.selecting ? "col-resize" : tool === "cross" ? "crosshair" : tool === "cursor" ? "default" : "copy";
  if (TOOL_HINT[tool]) railToast(TOOL_HINT[tool] + " · Esc để huỷ");
  renderRail(); flow.dirty = true;
}
$("toolRail").onclick = e => {
  const b = e.target.closest("[data-rl]"); if (!b) return;
  const id = b.dataset.rl;
  if (flow.selecting) flow.selecting = false;
  setTool(tool === id ? "cross" : id);
};
$("drawClear").onclick = () => {
  $("fpMenu").parentElement.classList.remove("open");
  if (!draw.list().length) { railToast("Chưa có hình nào để xoá"); return; }
  if (confirm(`Xoá mọi hình đã vẽ của ${S.symbol}?`)) { draw.clear(); flow.measure = null; flow.dirty = true; }
};
for (const cb of document.querySelectorAll("[data-layer]")) {
  LAYER_BOX[cb.dataset.layer] = cb;
  cb.onchange = () => {
    const k = cb.dataset.layer; if (k in flow.show) flow.show[k] = cb.checked;
    if (k === "profile" || k === "depth") flow.offset = flow._defOff(); // chừa chỗ bên phải cho hồ sơ / sổ lệnh
    flow.dirty = true; renderRail(); paintChartBtns();
  };
  cb.onchange();
}
// vẽ trên biểu đồ: chạy trước các thao tác kéo / đặt lệnh của biểu đồ (bắt sự kiện ở pha capture)
{
  const cv = $("flow"), ms = () => flow.info.intervalMs || 60e3;
  const tSnap = x => { const n = flow.bars.length; return n ? flow.bars[n - 1].t + (Math.round(flow.fAt(x)) - (n - 1)) * ms() : 0; };
  const pSnap = (x, p) => { // nam châm: hút vào giá mở / cao / thấp / đóng của nến dưới con trỏ, trong 14 điểm ảnh
    if (!draw.magnet || !flow.bars.length) return p;
    const b = flow.bars[Math.min(flow.bars.length - 1, Math.max(0, flow.iAt(x)))]; let best = p, bd = 14;
    for (const v of [b.o, b.h, b.l, b.c]) { const d = Math.abs(flow.yOf(v) - flow.yOf(p)); if (d < bd) { bd = d; best = v; } }
    return best;
  };
  const at = e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return { x, y, t: tSnap(x), p: pSnap(x, flow.pAt(y)) }; };
  const TWO = new Set(["trend", "rect", "fib", "measure"]);
  const shape2 = (type, a, b) => ({ type, t1: a.t, p1: a.p, t2: b.t, p2: b.p });
  let start = null; // điểm bấm xuống của công cụ hai điểm (hoặc Alt + kéo để đo)
  let brush = null; // nét vẽ tay đang vẽ
  const tRaw = x => { const n = flow.bars.length; return n ? flow.bars[n - 1].t + (flow.fAt(x) - (n - 1)) * ms() : 0; }; // vẽ tay: không hút vào nến
  const finishPath = () => {
    const q = draw.pending && draw.pending.type === "path" ? draw.pending.pts.filter((v, i, a) => !i || v[0] !== a[i - 1][0] || v[1] !== a[i - 1][1]) : [];
    if (q.length >= 2) draw.add({ type: "path", pts: q });
    draw.preview = null; draw.pending = null; setTool("cross"); flow.dirty = true;
  };
  const finish = (type, a, b) => {
    if (type === "measure") flow.measure = shape2(type, a, b);
    else draw.add({ ...shape2(type, a, b), color: type === "fib" ? "#ff9f1c" : undefined });
    draw.preview = null; draw.pending = null; setTool("cross"); flow.dirty = true;
  };
  const preview = (type, a, b) => { if (type === "measure") flow.measure = shape2(type, a, b); else draw.preview = { ...shape2(type, a, b), color: "#ffffff" }; flow.dirty = true; };
  cv.addEventListener("mousedown", e => {
    if (e.button !== 0 || !flow.bars.length || !flow._L || flow.selecting || e.shiftKey) return;
    const P = at(e); if (P.x > flow._L.pw || P.y > flow._L.priceH) return;
    if (tool === "brush") { // vẽ tay: giữ chuột rồi kéo
      e.stopImmediatePropagation(); e.preventDefault();
      brush = { pts: [[tRaw(P.x), P.p]], x: P.x, y: P.y }; draw.preview = { type: "brush", pts: brush.pts, color: "#ffffff" }; flow.dirty = true; return;
    }
    if (tool === "path") { // đường gấp khúc: mỗi lần bấm thêm một điểm
      e.stopImmediatePropagation(); e.preventDefault();
      if (!draw.pending || draw.pending.type !== "path") draw.pending = { type: "path", pts: [] };
      draw.pending.pts.push([P.t, P.p]); draw.preview = { type: "path", pts: [...draw.pending.pts], color: "#ffffff" }; flow.dirty = true; return;
    }
    const two = TWO.has(tool) || (e.altKey && (tool === "cross" || tool === "cursor"));
    if (!two && tool !== "cross" && tool !== "cursor") { // công cụ một điểm
      e.stopImmediatePropagation(); e.preventDefault();
      const dec = decimalsFor(market.tick || flow.step);
      if (tool === "line") draw.add({ type: "line", p: P.p });
      else if (tool === "vline") draw.add({ type: "vline", t: P.t });
      else if (tool === "avwap") draw.add({ type: "avwap", t: P.t, color: "#4dd0e1" });
      else if (tool === "text") { const s = (prompt(`Ghi chú tại ${P.p.toFixed(dec)}`) || "").trim().slice(0, 80); if (s) draw.add({ type: "text", t: P.t, p: P.p, text: s }); }
      else if (tool === "alert") { alerts.addLevel(S.symbol, +P.p.toFixed(dec)); syncAlertLines(); toast(`🔔 Sẽ báo khi ${S.symbol} chạm ${P.p.toFixed(dec)}`); }
      setTool("cross"); return;
    }
    if (!two) { if (flow.measure) { flow.measure = null; flow.dirty = true; } return; } // để biểu đồ tự kéo
    e.stopImmediatePropagation(); e.preventDefault();
    if (draw.pending) { finish(draw.pending.type, draw.pending.a, P); return; } // bấm điểm thứ hai
    const type = TWO.has(tool) ? tool : "measure";
    start = { type, a: P, x: P.x, y: P.y, alt: !TWO.has(tool) };
    preview(type, P, P);
  }, true);
  window.addEventListener("mousemove", e => {
    if (brush) { const P = at(e); if (Math.hypot(P.x - brush.x, P.y - brush.y) >= 3) { brush.pts.push([tRaw(P.x), flow.pAt(P.y)]); brush.x = P.x; brush.y = P.y; flow.dirty = true; } return; }
    if (draw.pending && draw.pending.type === "path") { const P = at(e); draw.preview = { type: "path", pts: [...draw.pending.pts, [P.t, P.p]], color: "#ffffff" }; flow.dirty = true; return; }
    const s = start || draw.pending; if (s) preview(s.type, s.a, at(e));
  }, true);
  window.addEventListener("mouseup", e => {
    if (brush) { const q = brush.pts; brush = null; draw.preview = null; if (q.length >= 2) draw.add({ type: "brush", pts: q }); setTool("cross"); flow.dirty = true; return; }
    if (!start) return;
    const s = start; start = null; const P = at(e);
    if (Math.hypot(P.x - s.x, P.y - s.y) > 4) { finish(s.type, s.a, P); return; }
    if (s.alt) { flow.measure = null; flow.dirty = true; return; } // Alt + bấm mà không kéo: không làm gì
    draw.pending = { type: s.type, a: s.a }; // bấm một lần: chờ bấm điểm thứ hai
    railToast("Bấm điểm thứ hai trên biểu đồ · Esc để huỷ");
  }, true);
  cv.addEventListener("dblclick", e => {
    if (draw.pending && draw.pending.type === "path") { e.stopImmediatePropagation(); finishPath(); return; }
    const r = cv.getBoundingClientRect(), s = draw.hit(e.clientX - r.left, e.clientY - r.top, { yOf: p => flow.yOf(p), xOfT: t => flow.xOfT(t) }); if (!s) return;
    e.stopImmediatePropagation(); draw.remove(s.id); flow.dirty = true; toast("Đã xoá hình");
  }, true);
  document.addEventListener("keydown", e => { if (e.key === "Enter" && draw.pending && draw.pending.type === "path") { e.preventDefault(); finishPath(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && (tool !== "cross" || draw.pending || flow.measure || flow.selecting)) { flow.measure = null; flow.selecting = false; setTool("cross"); } });
}
$("layersOff").onclick = () => { for (const [k, cb] of Object.entries(LAYER_BOX)) if (!CORE_LAYERS.has(k) && cb.checked) { cb.checked = false; cb.onchange(); } };
$("rowSize").onchange = () => { flow.rowMult = $("rowSize").value; flow.dirty = true; };
{ // chế độ ô và cách tô màu của footprint, nhớ trong phiên
  let fp = {}; try { fp = JSON.parse(sessionStorage.getItem("lailong.fp") || "{}"); } catch { /* bỏ qua */ }
  if (fp.mode) $("fpMode").value = fp.mode; if (fp.color && [...$("fpColor").options].some(o => o.value === fp.color)) $("fpColor").value = fp.color;
  const apply = () => { flow.fpMode = $("fpMode").value; flow.fpColor = $("fpColor").value; flow.dirty = true; try { sessionStorage.setItem("lailong.fp", JSON.stringify({ mode: flow.fpMode, color: flow.fpColor })); } catch { /* bỏ qua */ } };
  $("fpMode").onchange = $("fpColor").onchange = apply; apply();
}
$("domMult").onchange = () => dom.setMult(+$("domMult").value);
$("domCenter").onclick = () => dom.recenter();
$("fullscreenBtn").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => toast("Trình duyệt không cho phép toàn màn hình, bấm F11", true)); };

// ---------- công cụ order flow ----------
$("paneMode").onchange = () => { flow.pane = $("paneMode").value; if (flow.pane === "groups") recomputePrints(); flow.dirty = true; };
flow.pane = $("paneMode").value;
const clUpdate = () => { CL.on = $("clOn").checked; CL.metric = $("clMetric").value; CL.top = +$("clTop").value; CL.min = +$("clMin").value || 0; recomputeFlow(); renderLayerCount(); };
for (const id of ["clOn", "clMetric", "clTop", "clMin"]) $(id).onchange = clUpdate;
// cột Smart DOM, nhớ trên trình duyệt
// điện thoại chưa chọn cột: mặc định ít cột cho vừa màn hình nhỏ (đổi trong "Cột ▾")
// bản bố trí mới (bậc thang kiểu DOM chuyên nghiệp) dùng khoá mới để ai cũng thấy mặc định mới một lần
const domColsSaved = (() => {
  try { return JSON.parse(sessionStorage.getItem("lailong.domcols4") || "null"); } catch { return null; }
})() || (matchMedia("(max-width: 600px)").matches ? ["bid", "ask", "bidChg", "askChg"] : null);
$("domColMenu").innerHTML = DOM_COLS.filter(c => c.id !== "price").map(c => `<label data-tip="${esc(c.tip)}"><input type="checkbox" data-domcol="${c.id}" ${domColsSaved ? (domColsSaved.includes(c.id) ? "checked" : "") : c.off ? "" : "checked"}> ${esc(c.menu || c.label)}</label>`).join("");
const domColUpdate = () => { const ids = [...document.querySelectorAll("[data-domcol]")].filter(x => x.checked).map(x => x.dataset.domcol); dom.setColumns(ids); try { sessionStorage.setItem("lailong.domcols4", JSON.stringify(ids)); } catch { /* bỏ qua */ } };
$("domColMenu").onchange = domColUpdate; domColUpdate();
$("domSetMenu").onclick = e => e.stopPropagation(); // bấm trong menu cột không đóng menu
$("domClear").onclick = () => { market.tradedAt.clear(); dom.dirty = true; };
$("tapeSmart").onclick = () => { tape.smart = !tape.smart; $("tapeSmart").classList.toggle("on", tape.smart); tape.dirty = true; };
$("tapeTabs").onclick = e => { const b = e.target.closest("[data-tt]"); if (!b) return; tape.mode = b.dataset.tt; tape.scroll = 0; for (const x of $("tapeTabs").children) x.classList.toggle("on", x === b); tape.dirty = true; };
$("tapeMin").oninput = () => { tape.minQ = +$("tapeMin").value || 0; tape.dirty = true; };
// bố cục lưới ghép: kéo tiêu đề khung để đổi chỗ. Nút ─ thu nhỏ, ✕ đóng: khung thành nút nhỏ "Đã thu nhỏ" trên thanh trên cùng.
// mặc định: biểu đồ bên trái, cột phải là Smart DOM trên Smart Tape; Nhật ký tường thu nhỏ sẵn.
let tiles = null;
const railW = () => { const r = $("sideRail"); return r && getComputedStyle(r).position === "absolute" ? r.offsetWidth + 2 : 0; };
tiles = new Layout(ws, ["mainPanel", "profPanel", "domPanel", "tapePanel", "wallPanel"], {
  key: "lailong.layout.v7", dock: false, inset: () => ({ left: railW() }),
  tree: () => ({ dir: "row", flex: 0, kids: ["mainPanel", "profPanel", { dir: "col", flex: 0, kids: ["domPanel", "tapePanel", "wallPanel"], size: [0, Math.max(300, Math.round(innerHeight * 0.38)), 260] }], size: [0, Math.max(170, Math.min(230, Math.round(innerWidth * 0.13))), Math.max(360, Math.round(innerWidth * 0.24))] }),
  hiddenDefault: ["wallPanel"],
  onChange: () => { if (!tiles) return; redrawAll(); renderMinDock(); },
});
// nút nhỏ trên thanh trên cùng cho các khung đang thu nhỏ / đã đóng: bấm để mở lại đúng chỗ cũ
function renderMinDock() {
  const el = $("minDock"), ids = tiles.ids.filter(id => tiles.isMin(id)), show = ids.length && S.view === "terminal";
  el.hidden = !show; if (!show) return;
  el.innerHTML = `<span class="md-l">Đã thu nhỏ:</span>` + ids.map(id => `<button data-restore="${id}" data-tip="Mở lại khung ${esc(PANEL_NAMES[id] || id)}">▣ ${esc(PANEL_NAMES[id] || id)}</button>`).join("");
}
$("minDock").onclick = e => { const b = e.target.closest("[data-restore]"); if (b) { tiles.restore(b.dataset.restore); mShow(b.dataset.restore); } };
// nút ⚙ trên tiêu đề khung: mở menu cài đặt của khung đó
for (const b of document.querySelectorAll(".pset")) b.onclick = e => { e.stopPropagation(); const d = b.parentElement, was = d.classList.contains("open"); document.querySelectorAll(".dropdown.open").forEach(x => x.classList.remove("open")); if (!was) d.classList.add("open"); };
for (const b of document.querySelectorAll("[data-min]")) b.onclick = e => { e.stopPropagation(); setMax(null); tiles.minimize(b.dataset.min); };
// điện thoại: thanh dưới cùng chọn khung đang xem
const mShow = id => {
  for (const b of $("mnav").children) b.classList.toggle("on", b.dataset.panel === id);
  for (const p of ws.querySelectorAll(":scope > .panel")) p.classList.toggle("mshow", p.id === id);
  try { sessionStorage.setItem("lailong.mpanel", id); } catch { /* bỏ qua */ }
  redrawAll();
};
$("mnav").onclick = e => { const b = e.target.closest("[data-panel]"); if (b) mShow(b.dataset.panel); };
{ let id = null; try { id = sessionStorage.getItem("lailong.mpanel"); } catch { /* bỏ qua */ } mShow(id && $(id) && $("mnav").querySelector(`[data-panel="${id}"]`) ? id : "mainPanel"); }
// cài như ứng dụng (PWA): chạy được khi mạng chập chờn, mở từ màn hình chính
let installEv = null;
const installShow = on => { $("installBtn").hidden = !on; $("installNo").hidden = on; };
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEv = e; installShow(true); });
addEventListener("appinstalled", () => { installEv = null; installShow(false); });
$("installBtn").onclick = async () => { gearClose(); if (!installEv) return; installEv.prompt(); await installEv.userChoice.catch(() => {}); installEv = null; installShow(false); };
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
$("tapeGroup").onchange = () => { tape.group = $("tapeGroup").value; tape.dirty = true; };
// ---------- nút Footprint / Nến / Hồ sơ trên thanh bên trái ----------
const chartSetDD = $("fpMenu").parentElement;
$("fpBtn").onclick = e => { e.stopPropagation(); if (flow.type === "box") { const was = chartSetDD.classList.contains("open"); document.querySelectorAll(".dropdown.open").forEach(x => x.classList.remove("open")); if (!was) chartSetDD.classList.add("open"); } else { flow.setType("box"); paintChartBtns(); } };
$("candleBtn").onclick = () => { flow.setType("candle"); paintChartBtns(); };
$("profBtn").onclick = () => { const cb = LAYER_BOX.profile; cb.checked = !cb.checked; cb.onchange(); };
$("fpMenu").onclick = e => e.stopPropagation();
$("symAdd").onclick = () => { const el = $("symbol"); el.focus(); el.select(); toast("Gõ mã mới vào ô mã trên thanh trên cùng rồi Enter: mã đó mở thành một thẻ mới"); };

// ---------- Smart DOM: dòng chip trên cùng ----------
const MULTS_DOM = [1, 2, 5, 10, 25, 50, 100];
let domChipSig = "";
function renderDomChips() {
  const D = dom._D, tk = dom.tick, now = Date.now(), bi = D ? D.bookImb : null;
  const ice = market.ice ? market.ice.events.filter(e => e.status === "live").length : 0, pulled = walls.events.filter(e => e.kind === "spoof" && now - e.t <= 600e3).length;
  const lean = bi == null ? "" : Math.abs(bi) < 0.1 ? "sổ cân bằng" : `sổ lệch ${Math.round(Math.abs(bi) * 100)}% ${bi > 0 ? "chờ mua" : "chờ bán"}`;
  const sig = `${tk}|${dom.mult}|${lean}|${ice}|${pulled}`; if (sig === domChipSig) return; domChipSig = sig;
  $("domChips").innerHTML = `<span class="chip" data-tip="Bước giá mỗi dòng (bước giá của sàn × gộp)">bước ${tk ? +tk.toFixed(decimalsFor(tk)) : "–"}</span>` +
    `<button class="chip dmchip" data-dm aria-haspopup="menu" data-tip="Gộp nhiều bước giá vào một dòng. Bấm để chọn mức gộp">gộp ×${dom.mult} <small>▾</small></button>` +
    (lean ? `<span class="chip ${bi > 0.1 ? "lean-b" : bi < -0.1 ? "lean-s" : ""}" data-tip="So tổng lệnh chờ 10 mức gần nhất mỗi bên. Lệch về chờ mua: phía dưới dày hơn, giá dễ được đỡ; lệch về chờ bán: phía trên dày hơn">${lean}</span>` : "") +
    `<span class="chip${ice ? " ice" : ""}" data-g="iceberg">◆ iceberg ${ice}</span><span class="chip${pulled ? " pull" : ""}" data-g="spoofing">× tường rút ${pulled}</span>`;
}
// chip gộp: bấm để thả danh sách ×1 … ×100 rồi tự chọn (menu nổi vị trí cố định vì dòng chip cuộn ngang)
const dmClose = () => { $("dmMenu").hidden = true; };
$("domChips").onclick = e => {
  const b = e.target.closest("[data-dm]"); if (!b) return; e.stopPropagation();
  const m = $("dmMenu"); if (!m.hidden) return dmClose();
  m.innerHTML = MULTS_DOM.map(k => `<button role="menuitemradio" aria-checked="${k === dom.mult}" class="${k === dom.mult ? "on" : ""}" data-k="${k}">×${k}</button>`).join("");
  m.hidden = false; const r = b.getBoundingClientRect(); m.style.top = `${r.bottom + 4}px`; m.style.left = `${Math.max(6, Math.min(r.left, innerWidth - m.offsetWidth - 6))}px`;
};
$("dmMenu").onclick = e => { const b = e.target.closest("[data-k]"); if (!b) return; e.stopPropagation(); const k = +b.dataset.k; $("domMult").value = k; dom.setMult(k); domChipSig = ""; renderDomChips(); dmClose(); };
document.addEventListener("click", e => { if (!e.target.closest("#dmMenu")) dmClose(); });
addEventListener("keydown", e => { if (e.key === "Escape") dmClose(); });
$("domMult").addEventListener("change", () => { domChipSig = ""; });

// ---------- thanh trạng thái dưới cùng: kết nối, độ trễ, nhịp sổ lệnh, số lệnh khớp, giờ Việt Nam ----------
const tapeChips = () => {
  const st = tape.stats, up = st.speed != null && st.speed >= 2, dn = st.speed != null && st.speed < 0.6;
  $("tapeSpeed").innerHTML = `tốc độ <b>${st.rate.toFixed(st.rate < 10 ? 1 : 0)} lệnh/s</b>${up ? ` <b class="pos">▲</b>` : dn ? ` <b class="neg">▼</b>` : ""}`;
  $("tape5m").innerHTML = `5 phút: <b class="pos">${fmtVol(st.buy5)}</b> / <b class="neg">${fmtVol(st.sell5)}</b>`;
  $("tapeCoin").textContent = coin();
};
setInterval(() => {
  if (S.view !== "terminal" || document.hidden) return;
  $("sbEx").textContent = ex().name;
  $("sbLat").textContent = sb.lat != null && S.ex !== "SIM" ? `· ${Math.max(0, Math.round(sb.lat))} ms` : "";
  $("sbBook").textContent = sb.bookGap != null ? `Sổ lệnh: ${Math.round(sb.bookGap)} ms` : "Sổ lệnh: chờ";
  let n = 0; const tr = market.trades, now = Date.now() + clockSkew(); for (let i = tr.length - 1; i >= 0 && now - tr[i].t <= 60e3; i--) n++;
  $("sbTrades").textContent = `Lệnh khớp: ${n.toLocaleString("vi-VN")}/phút`;
  $("sbFp").textContent = flow.fpProgress || ""; $("sbFp").hidden = !flow.fpProgress;
  const d = new Date(Date.now() + clockSkew() + 7 * 3600e3); $("sbClock").textContent = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} VN`;
  renderDomChips(); tapeChips();
}, 1000);

// ---------- Phát lại: chạy lại từng nến từ một điểm trong quá khứ (sổ lệnh và băng lệnh vẫn trực tiếp) ----------
function replayApply() { flow.bars = market.bars.slice(0, RP.end + 1); flow.refresh(); flow.replay = true; flow.dirty = true; renderReplayBar(); }
function replayStart() {
  if (S.grid !== 1) setGrid(1);
  if (market.bars.length < 30) { toast("Chưa đủ nến để phát lại", true); return; }
  RP.on = true; RP.end = Math.max(20, market.bars.length - 120); RP.play = false; RP.picking = true;
  $("replayBtn").classList.add("on"); $("replayBar").hidden = false; replayApply();
  railToast("Phát lại: bấm vào một nến trên biểu đồ để chọn điểm bắt đầu, hoặc bấm ▶ để chạy từ 120 nến trước");
}
function replayStop() {
  RP.on = false; RP.play = false; RP.picking = false; clearInterval(RP.timer); RP.timer = null;
  flow.replay = false; flow.bars = market.bars; flow.refresh(); flow.offset = flow._defOff();
  $("replayBtn").classList.remove("on"); $("replayBar").hidden = true; flow.dirty = true;
}
function replayStep(n) { RP.end = Math.max(1, RP.end + n); if (RP.end >= market.bars.length - 1) { replayStop(); toast("Đã phát tới nến hiện tại, về chế độ trực tiếp"); return; } replayApply(); }
function replayPlay(on) { RP.play = on; clearInterval(RP.timer); RP.timer = on ? setInterval(() => replayStep(1), 1000 / RP.speed) : null; RP.picking = false; renderReplayBar(); }
function renderReplayBar() {
  const b = market.bars[RP.end];
  $("replayBar").innerHTML = `<b>⟲ Phát lại</b><button data-rp="back" data-tip="Lùi một nến">⏮</button><button data-rp="play" class="play" data-tip="${RP.play ? "Tạm dừng" : "Chạy"}">${RP.play ? "⏸" : "▶"}</button><button data-rp="fwd" data-tip="Tới một nến">⏭</button>` +
    `<select data-rp="speed" data-tip="Tốc độ phát">${[1, 2, 5, 10].map(v => `<option value="${v}"${v === RP.speed ? " selected" : ""}>${v} nến/giây</option>`).join("")}</select>` +
    `<span class="muted">${b ? fmtDate(b.t) : ""} · nến ${RP.end + 1}/${market.bars.length}</span>` +
    `<button data-rp="pick" class="${RP.picking ? "on" : ""}" data-tip="Bấm vào một nến trên biểu đồ để phát lại từ đó">Chọn điểm</button><button data-rp="exit" data-tip="Thoát phát lại, về dữ liệu trực tiếp">✕ Thoát</button>`;
}
$("replayBtn").onclick = () => (RP.on ? replayStop() : replayStart());
$("replayBar").onclick = e => {
  const b = e.target.closest("[data-rp]"); if (!b || b.tagName === "SELECT") return;
  const a = b.dataset.rp;
  if (a === "back") { replayPlay(false); replayStep(-1); } else if (a === "fwd") replayStep(1); else if (a === "play") replayPlay(!RP.play);
  else if (a === "pick") { RP.picking = !RP.picking; renderReplayBar(); } else if (a === "exit") replayStop();
};
$("replayBar").onchange = e => { if (e.target.dataset.rp === "speed") { RP.speed = +e.target.value; if (RP.play) replayPlay(true); } };
$("flow").addEventListener("mousedown", e => { // đang chọn điểm phát lại: bấm vào nến nào thì phát từ nến đó
  if (!RP.on || !RP.picking || e.button !== 0 || !flow._L) return;
  const r = $("flow").getBoundingClientRect(), x = e.clientX - r.left; if (x > flow._L.pw) return;
  e.stopImmediatePropagation(); e.preventDefault();
  RP.end = Math.max(20, Math.min(market.bars.length - 2, flow.iAt(x))); RP.picking = false; replayApply(); railToast("Bấm ▶ để chạy, ⏭ để đi từng nến");
}, true);

renderRail(); paintChartBtns(); setGrid(S.grid); setView(S.view); renderMinDock();
ready = true; fitType(); renderInd(); renderProfChips();
loadSymbols(); load();
window.lailong = { market, flow, dom, tape, walls, S, alpha, alerts, tiles, RP, draw }; // tiện kiểm tra trong DevTools
setInterval(() => tickFresh(), 1000); // chữ "N trước" và trạng thái đỏ của các nhãn dữ liệu
