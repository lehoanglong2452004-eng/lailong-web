// Lai Long Web: ghép dữ liệu, biểu đồ, phân tích và backtest thành một trang phân tích thuần giá và khối lượng.

import { EXCHANGES, attachOi, inferTick } from "./exchanges.js";
import { MarketState } from "./market.js";
import { Heatmap } from "./heatmap.js";
import { FlowChart, drawEquity } from "./flowchart.js";
import { Dom } from "./dom.js";
import { srLevels, abnormalVolume, liquidationMap, summary, volumeProfile, isDeltaApprox, vwapReactions } from "./analytics.js";
import { STRATEGIES, defaultParams, runBacktest } from "./backtest.js";
import { approxFootprint, exactFootprintBinance } from "./fphistory.js";
import { absorption, absorptionStats, clusterSearch } from "./orderflow.js";
import { Tape } from "./tape.js";
import { DOM_COLS } from "./dom.js";
import { GLOSSARY, GROUPS } from "./glossary.js";
import { T, THEMES, EDITABLE, applyTheme, loadTheme, alpha } from "./theme.js";
import { fmtVol, fmtUsd, fmtPct, fmtTime, fmtDate, decimalsFor, INTERVALS, getJson, fitCanvas, MONO } from "./util.js";

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
  mode: saved.mode || "heat",
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
flow.prints = () => [market.histPrints, market.prints];
flow.opts.onRange = () => { if (S.tab === "absorb") renderTab(); };

// ---------- tải dữ liệu một mã ----------
let conn = null, loadToken = 0, analysis = null, fpState = null;
async function load() {
  const token = ++loadToken; persist();
  if (conn) { conn.close(); conn = null; }
  market.reset({ symbol: S.symbol, exchange: S.ex, interval: S.interval });
  heat.resetView(); dom.reset(); flow.setData([], {}); flow.fpProgress = ""; flow.ranges = []; analysis = null; fpState = null; absorb = []; clusters = null; tape.reset(); renderSignals(); renderTab();
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
  heat.setOverlays({ levels, zones, liqMap });
  flow.setOverlays({ levels, zones, liqMap });
  recomputeFlow();
  renderSignals();
  if (S.view === "analysis") renderAnalysis();
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
let absorb = [], clusters = null, flowTimer = null;
const CL = { on: false, metric: "volume", top: 0.005, min: 0 };
function recomputeFlow() {
  if (market.bars.length < 60) return;
  absorb = absorption(market.bars, { step: market.fpStep });
  clusters = CL.on ? clusterSearch(market.bars, { metric: CL.metric, topPct: CL.top, minValue: CL.min, step: market.fpStep }) : null;
  flow.setOverlays({ absorb, clusters: clusters ? clusters.cells : [] });
  flow.bigQ = market.bigPrint;
  if (["absorb", "clusters"].includes(S.tab)) renderTab();
}
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
const PARAM_G = { rr: "bt-rr", maxHold: "bt-maxhold", zThreshold: "sigma", tolAtr: "atr", stopAtr: "atr", atrBuffer: "atr", anchor: "vwap", rollLen: "vwap" };
const STRAT_G = { volBreakout: "strat-volbreakout", srRetest: "strat-srretest", vwapTouch: "strat-vwap" };
function renderStrategyForm() {
  const id = $("btStrategy").value, st = STRATEGIES[id];
  $("btDesc").innerHTML = `${esc(st.description)} <button class="q" data-g="${STRAT_G[id] || "backtest"}">?</button>`;
  $("btParams").innerHTML = st.params.map(p => `<label class="row" ${PARAM_G[p.key] ? `data-g="${PARAM_G[p.key]}"` : `data-tip="${esc(p.label)}"`}>${esc(p.label)} <input type="number" data-param="${p.key}" value="${p.default}" min="${p.min}" max="${p.max}" step="${p.step}"></label>`).join("");
}
$("btStrategy").innerHTML = Object.entries(STRATEGIES).map(([id, s]) => `<option value="${id}">${esc(s.name)}</option>`).join("");
$("btStrategy").onchange = renderStrategyForm; renderStrategyForm();
const btCache = new Map();
$("btRun").onclick = async () => {
  const id = $("btStrategy").value, tf = $("btInterval").value, n = Math.min(20000, Math.max(200, +$("btBars").value || 5000));
  const params = { ...defaultParams(id) }; for (const el of document.querySelectorAll("[data-param]")) params[el.dataset.param] = +el.value;
  const status = $("btStatus"); status.textContent = `Đang tải ${n} nến ${tf} ${S.symbol} từ ${ex().name}...`; $("btRun").disabled = true;
  try {
    const ck = `${S.ex}:${S.symbol}:${tf}:${n}`; let bars = btCache.get(ck);
    if (!bars) { bars = await ex().klines(S.symbol, tf, n); btCache.set(ck, bars); }
    if (bars.length < 100) throw new Error("không đủ dữ liệu");
    status.textContent = `Đang chạy trên ${bars.length} nến...`; await new Promise(r => setTimeout(r, 30));
    const capital = +$("btCapital").value || 10000;
    const res = runBacktest(bars, id, params, { capital, riskPct: +$("btRisk").value, maxLeverage: +$("btLev").value, feeRate: +$("btFee").value / 100, slippageBps: +$("btSlip").value, intervalMs: INTERVALS[tf] });
    renderBacktest(res, bars, tf, capital, id, params);
    status.textContent = `Xong: ${bars.length} nến từ ${fmtDate(bars[0].t)} đến ${fmtDate(bars[bars.length - 1].t)}. Lệnh vào ở giá mở cửa nến sau tín hiệu, đã tính phí và trượt giá.`;
  } catch (e) { status.textContent = `Lỗi: ${e.message}`; }
  $("btRun").disabled = false;
};
function renderBacktest(res, bars, tf, capital, id, params) {
  const s = res.stats, card = (g, k, v, cls = "") => `<div class="stat" data-g="${g}"><span>${k}</span><b class="${cls}">${v}</b></div>`;
  $("btStats").innerHTML = card("bt-net", "Lợi nhuận ròng", `${s.netProfit >= 0 ? "+" : ""}${s.netProfit.toFixed(2)} (${fmtPct(s.netPct)})`, s.netProfit >= 0 ? "pos" : "neg") +
    card("bt-trades", "Số lệnh", `${s.trades} (L ${s.longs} / S ${s.shorts})`) + card("bt-winrate", "Tỷ lệ thắng", s.trades ? s.winRate.toFixed(1) + "%" : "-") +
    card("bt-pf", "Profit factor", isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞") + card("bt-avgr", "R trung bình", s.trades ? s.avgR.toFixed(2) : "-") +
    card("bt-expectancy", "Kỳ vọng mỗi lệnh", s.trades ? s.expectancy.toFixed(2) + " USDT" : "-") + card("bt-mdd", "Sụt giảm tối đa", s.maxDrawdownPct.toFixed(2) + "%", "neg") +
    card("bt-sharpe", "Sharpe (năm hoá)", isFinite(s.sharpe) ? s.sharpe.toFixed(2) : "-") + card("bt-avgbars", "Giữ lệnh trung bình", s.trades ? s.avgBars.toFixed(1) + " nến" : "-") +
    card("bt-exposure", "Thời gian có vị thế", s.exposurePct.toFixed(1) + "%");
  drawEquity($("btEquity"), res.equity, capital);
  const bb = bars.map(b => ({ ...b, d: b.bv != null ? 2 * b.bv - b.v : (b.h > b.l ? b.v * (b.c - b.o) / (b.h - b.l) : 0) }));
  btChart.setData(bb, { step: market.fpStep || 1, tick: market.tick, intervalMs: INTERVALS[tf], symbol: S.symbol, exchangeName: ex().name, interval: tf, deltaApprox: isDeltaApprox(bars) });
  const markers = [];
  for (const t of res.trades) {
    const dir = t.side === "long" ? 1 : -1;
    markers.push({ t: t.entryT, price: t.entryPx, dir, link: { t: t.exitT, price: t.exitPx, win: t.pnl > 0 } }, { t: t.exitT, price: t.exitPx, dir, exit: true });
  }
  btChart.setOverlays({ markers, levels: [], zones: [], lines: [] });
  const box = $("btVwap"); box.hidden = id !== "vwapTouch";
  if (id === "vwapTouch") {
    const w = STRATEGIES.vwapTouch.vwap(bars, params), anchor = ["ngày", "tuần", `cuộn ${params.rollLen} nến`][Math.round(params.anchor)] || "ngày";
    const resets = Math.round(params.anchor) === 2 ? null : bars.map((b, i) => i > 0 && (Math.round(params.anchor) === 1 ? Math.floor((b.t / 864e5 + 3) / 7) !== Math.floor((bars[i - 1].t / 864e5 + 3) / 7) : Math.floor(b.t / 864e5) !== Math.floor(bars[i - 1].t / 864e5)));
    btChart.setOverlays({ lines: [{ values: w, color: "#c678dd", name: `VWAP ${anchor}`, resets }] });
    const horizon = 12, rx = vwapReactions(bars, w, { tolAtr: params.tolAtr, horizon, moveAtr: 1 });
    const row = (name, g) => `<tr><td class="t">${name}</td><td>${g.touches}</td><td class="pos">${g.bounce} (${isFinite(g.bouncePct) ? g.bouncePct.toFixed(1) : "-"}%)</td><td class="neg">${g.breaks} (${isFinite(g.breakPct) ? g.breakPct.toFixed(1) : "-"}%)</td><td>${g.unclear}</td><td class="${g.avgFwdPct >= 0 ? "pos" : "neg"}">${fmtPct(g.avgFwdPct, 3)}</td></tr>`;
    const verdict = g => !g.touches ? "chưa có lần chạm nào" : g.bouncePct >= 55 ? "thường BẬT LẠI" : g.breakPct >= 55 ? "thường XUYÊN QUA" : "không nghiêng hẳn về bên nào";
    box.innerHTML = `<h3>Giá chạm VWAP ${anchor} thì bật lại hay xuyên qua? <button class="q" data-g="vwap">?</button> <small>${bars.length} nến ${tf}, ${esc(S.symbol)} ${esc(ex().name)}</small></h3>` +
      table(["Khi chạm VWAP", "Số lần chạm", "Bật lại", "Xuyên qua", "Không rõ", `Lợi nhuận TB sau ${horizon} nến (theo hướng bật lại)`],
        [row("Từ trên xuống (VWAP là hỗ trợ)", rx.support), row("Từ dưới lên (VWAP là kháng cự)", rx.resistance)], "") +
      `<p class="note">Kết luận trên dữ liệu này: khi VWAP là hỗ trợ, giá ${verdict(rx.support)}; khi VWAP là kháng cự, giá ${verdict(rx.resistance)}. "Bật lại" nghĩa là trong ${horizon} nến giá đi tiếp về phía cũ được 1 ATR trước khi đóng cửa xuyên qua VWAP. "Xuyên qua" nghĩa là đóng cửa ở phía bên kia VWAP trước.</p>`;
  }
  const dec = decimalsFor(market.tick);
  $("btTrades").innerHTML = table(["#", "Phía", "Vào lúc", "Giá vào", "Ra lúc", "Giá ra", "Khối lượng", "Lãi/lỗ", ["R", "bt-avgr"], ["Lý do", "bt-reason"], ["Số nến", "bt-avgbars"]],
    res.trades.slice().reverse().map((t, k) => `<tr><td>${res.trades.length - k}</td><td class="${t.side === "long" ? "pos" : "neg"}">${t.side === "long" ? "LONG" : "SHORT"}</td><td>${fmtDate(t.entryT)}</td><td>${t.entryPx.toFixed(dec)}</td><td>${fmtDate(t.exitT)}</td><td>${t.exitPx.toFixed(dec)}</td><td>${+t.qty.toPrecision(5)}</td><td class="${t.pnl >= 0 ? "pos" : "neg"}">${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}</td><td>${t.r.toFixed(2)}</td><td class="t">${esc(t.reason)}</td><td>${t.bars}</td></tr>`),
    "Chiến lược không có lệnh nào trên dữ liệu này. Thử nới ngưỡng hoặc tăng số nến.");
}

// ---------- chú thích khi rê chuột ----------
const tipEl = $("tip");
const CANVAS_TIP = { heat, flow, dom, tape, btChart };
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
  const eq = $("btEquity"); if (eq._fit) drawEquity(eq, eq._eq, eq._cap);
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
for (const k of ["rightW", "bottomH", "tapeW"]) if (layout[k]) ws.style.setProperty("--" + k, layout[k] + "px");
function splitter(el, k, calc) {
  el.addEventListener("pointerdown", e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing"); el.classList.add("drag"); hideTip();
    const move = ev => setLayout(k, Math.round(calc(ev, ws.getBoundingClientRect())));
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); document.body.classList.remove("resizing"); el.classList.remove("drag"); heat.dirty = flow.dirty = dom.dirty = tape.dirty = true; };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  });
  el.addEventListener("dblclick", () => setLayout(k, null));
}
splitter($("splitV"), "rightW", (e, r) => { const tw = $("tapePanel").offsetWidth + 6; return Math.min(r.width - tw - 320, Math.max(220, r.right - e.clientX - tw - 4)); });
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
  for (const id of ["terminal", "analysis", "backtest"]) $("view-" + id).hidden = id !== v;
  heat.dirty = flow.dirty = btChart.dirty = dom.dirty = true;
  if (v === "analysis") renderAnalysis();
}
function setMode(m) {
  S.mode = m; persist();
  for (const b of $("chartMode").children) b.classList.toggle("on", b.dataset.mode === m);
  $("heat").hidden = m !== "heat"; $("flow").hidden = m === "heat";
  $("contrastBox").hidden = m !== "heat"; $("rowBox").hidden = m !== "box";
  $("chartHint").textContent = m === "heat" ? "Lăn chuột: phóng thời gian · Ctrl + lăn: phóng giá · Kéo: di chuyển · Bấm đúp: theo dõi · Rê chuột để xem ý nghĩa" : "Lăn chuột: phóng to · Kéo: di chuyển · Kéo trục giá: giãn giá · Bấm đúp: về hiện tại · Rê chuột lên nến để xem ý nghĩa";
  if (m !== "heat") flow.setType(m === "box" ? "box" : "candle");
  if (m !== "heat") startFootprint();
  for (const el of document.querySelectorAll(".flowOnly")) el.hidden = m === "heat";
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
document.addEventListener("click", e => { if (!e.target.closest(".dropdown")) document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open")); });
for (const cb of document.querySelectorAll("[data-layer]")) {
  cb.onchange = () => { const k = cb.dataset.layer; if (k in heat.show) heat.show[k] = cb.checked; if (k in flow.show) flow.show[k] = cb.checked; heat.dirty = flow.dirty = true; };
  cb.onchange();
}
$("contrast").oninput = () => { heat.contrast = +$("contrast").value; heat.dirty = true; };
$("rowSize").onchange = () => { flow.rowMult = $("rowSize").value; flow.dirty = true; };
$("domMult").onchange = () => dom.setMult(+$("domMult").value);
$("domCenter").onclick = () => dom.recenter();
$("tabs").onclick = e => { const b = e.target.closest("[data-tab]"); if (!b) return; S.tab = b.dataset.tab; for (const x of $("tabs").querySelectorAll("[data-tab]")) x.classList.toggle("on", x === b); renderTab(); };
$("fullscreenBtn").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => toast("Trình duyệt không cho phép toàn màn hình, bấm F11", true)); };

// ---------- công cụ order flow ----------
$("paneMode").onchange = () => { flow.pane = $("paneMode").value; flow.dirty = true; };
$("selBtn").onclick = () => { flow.selecting = !flow.selecting; $("selBtn").classList.toggle("on", flow.selecting); $("flow").style.cursor = flow.selecting ? "col-resize" : ""; };
$("clusterBtn").onclick = e => { e.stopPropagation(); $("clusterBtn").parentElement.classList.toggle("open"); };
const clUpdate = () => { CL.on = $("clOn").checked; CL.metric = $("clMetric").value; CL.top = +$("clTop").value; CL.min = +$("clMin").value || 0; $("clusterBtn").classList.toggle("on", CL.on); recomputeFlow(); };
for (const id of ["clOn", "clMetric", "clTop", "clMin"]) $(id).onchange = clUpdate;
// cột Smart DOM, nhớ trên trình duyệt
const domColsSaved = (() => { try { return JSON.parse(localStorage.getItem("lailong.domcols") || "null"); } catch { return null; } })();
$("domColMenu").innerHTML = DOM_COLS.filter(c => c.id !== "price").map(c => `<label data-tip="${esc(c.tip)}"><input type="checkbox" data-domcol="${c.id}" ${!domColsSaved || domColsSaved.includes(c.id) ? "checked" : ""}> ${esc(c.label)}</label>`).join("");
const domColUpdate = () => { const ids = [...document.querySelectorAll("[data-domcol]")].filter(x => x.checked).map(x => x.dataset.domcol); dom.setColumns(ids); try { localStorage.setItem("lailong.domcols", JSON.stringify(ids)); } catch { /* bỏ qua */ } };
$("domColMenu").onchange = domColUpdate; domColUpdate();
$("domColBtn").onclick = e => { e.stopPropagation(); $("domColBtn").parentElement.classList.toggle("open"); };
$("domClear").onclick = () => { market.tradedAt.clear(); dom.dirty = true; };
$("tapeSmart").onchange = () => { tape.smart = $("tapeSmart").checked; tape.dirty = true; };
$("tapeBig").onchange = () => { tape.bigOnly = $("tapeBig").checked; tape.dirty = true; };
$("tapeMin").oninput = () => { tape.minQ = +$("tapeMin").value || 0; tape.dirty = true; };

setMode(S.mode); setView(S.view);
loadSymbols(); load();
window.lailong = { market, heat, flow, dom, tape, S, alpha }; // tiện kiểm tra trong DevTools
