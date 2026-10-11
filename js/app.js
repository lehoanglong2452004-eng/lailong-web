// Lai Long Web: ghép dữ liệu, biểu đồ, phân tích, giả lập lệnh và backtest thành một trang.

import { EXCHANGES, attachOi, inferTick } from "./exchanges.js";
import { MarketState } from "./market.js";
import { Heatmap } from "./heatmap.js";
import { FlowChart, drawEquity } from "./flowchart.js";
import { Dom } from "./dom.js";
import { PaperBroker } from "./paper.js";
import { srLevels, abnormalVolume, liquidationMap, summary, volumeProfile, isDeltaApprox, vwapReactions } from "./analytics.js";
import { STRATEGIES, defaultParams, runBacktest } from "./backtest.js";
import { fmtVol, fmtUsd, fmtPct, fmtTime, fmtDate, decimalsFor, INTERVALS, getJson, fitCanvas, MONO } from "./util.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- trạng thái ----------
const saved = (() => { try { return JSON.parse(localStorage.getItem("lailong.ui") || "{}"); } catch { return {}; } })();
const qs = new URLSearchParams(location.search);
const S = {
  ex: qs.get("ex") || saved.ex || "BINANCE",
  symbol: (qs.get("s") || saved.symbol || "BTCUSDT").toUpperCase(),
  interval: qs.get("i") || saved.interval || "1m",
  view: qs.get("v") || saved.view || "terminal",
  mode: saved.mode || "heat",
  tab: "positions", otype: "limit", maxPanel: null,
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

const market = new MarketState();
const logs = [];
function log(text) { logs.unshift({ t: Date.now(), text }); if (logs.length > 300) logs.pop(); if (S.tab === "logs") renderTab(); }
function toast(text, err) { const el = $("toast"); el.textContent = text; el.className = "toast" + (err ? " err" : ""); el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 4000); }

const paper = new PaperBroker(() => { renderAccount(); renderTab(); syncOwn(); });
const heat = new Heatmap($("heat"), market, { exchangeName: () => ex().name });
const flow = new FlowChart($("flow"));
const dom = new Dom($("dom"), market, { onClick: (price, side) => placeOrder(side, "limit", price) });

// ---------- tải dữ liệu một mã ----------
let conn = null, loadToken = 0, analysis = null;
async function load() {
  const token = ++loadToken; persist();
  if (conn) { conn.close(); conn = null; }
  market.reset({ symbol: S.symbol, exchange: S.ex, interval: S.interval });
  heat.resetView(); dom.reset(); flow.setData([], {}); analysis = null; renderSignals();
  setConn("Đang tải dữ liệu", null);
  $("tCoin").textContent = coin();
  let info = { tick: 0, ctVal: 1 };
  try { info = await ex().info(S.symbol); } catch (e) { log(`Không lấy được thông tin mã: ${e.message}`); }
  if (token !== loadToken) return;
  market.tick = info.tick;
  conn = ex().connect(S.symbol, info, market.book, {
    onBook: () => {
      if (token !== loadToken) return;
      if (!market.tick) { const s = market.book.sorted(); market.tick = inferTick(s.bids.slice(0, 30).map(x => x[0])); }
      market.onBook(); paper.onBook(key(), market.book); dom.update();
    },
    onTrades: list => { if (token !== loadToken) return; market.onTrades(list); paper.onTrades(key(), list); },
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
  } catch (e) {
    log(`Không tải được nến: ${e.message}`); toast(`Không tải được dữ liệu từ ${ex().name}: ${e.message}`, true);
  }
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
  renderSignals();
  if (S.view === "analysis") renderAnalysis();
}
market.on(kind => {
  if (kind === "newbar") recompute();
  if (kind === "trades" || kind === "liq") { flow.refresh(); scheduleUi(); }
});
let uiTimer = null;
function scheduleUi() { if (uiTimer) return; uiTimer = setTimeout(() => { uiTimer = null; renderAccount(); if (["positions", "orders", "liqs", "big"].includes(S.tab)) renderTab(); updateSummary(); }, 700); }
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
    `Xu hướng ${S.interval}: ${trendTag(t.label, t.score)} <b>${t.score == null ? "-" : t.score.toFixed(0)}</b>`,
    `Cấu trúc: <b>${esc(t.structure || "-")}</b>`,
    `Động lượng: ${trendTag(m.label, m.score)}`,
    `Biến động: <b>${esc(v.regime || "-")}</b> (${v.percentile == null ? "-" : v.percentile.toFixed(0)}%, ATR ${v.atrPct == null ? "-" : v.atrPct.toFixed(2)}%)`,
    `HT gần: <b class="pos">${sup ? sup.price.toFixed(dec) : "-"}</b>`,
    `KC gần: <b class="neg">${res ? res.price.toFixed(dec) : "-"}</b>`,
  ].map(x => `<span>${x}</span>`).join("");
}

// ---------- đặt lệnh giả lập ----------
function lastPrice() { return market.last ? market.last.p : market.book.mid(); }
function placeOrder(side, type, price) {
  const lev = +$("tLev").value || 1;
  let qty = +$("tQty").value;
  const px = type === "market" ? lastPrice() : price;
  if (!(qty > 0)) { const margin = +$("tMargin").value; qty = px ? margin * lev / px : 0; }
  qty = +qty.toPrecision(6);
  const r = paper.place({ key: key(), side, type, qty, price: type === "limit" ? price : 0, lev }, market.book);
  if (r.error) toast(`Lệnh bị từ chối: ${r.error}`, true);
  else toast(`${side === "buy" ? "MUA" : "BÁN"} ${type} ${qty} ${coin()}${type === "limit" ? " @ " + price : ""}: ${r.order.status === "filled" ? "đã khớp" : r.order.filled ? "khớp một phần, phần còn lại đang chờ" : "đang chờ khớp"}`);
}
function syncOwn() {
  const own = paper.openOrders(key()), pos = paper.positionView(key());
  dom.setOwn(own); heat.setOverlays({ orders: own, position: pos }); flow.setOverlays({ orders: own, position: pos });
}
function ticketPrice() { return S.otype === "market" ? lastPrice() : +$("tPrice").value || lastPrice(); }
function updateSummary(from) {
  const px = ticketPrice(), lev = +$("tLev").value || 1;
  if (!px) { $("tSummary").textContent = ""; return; }
  if (from === "qty") $("tMargin").value = (+$("tQty").value * px / lev).toFixed(2);
  else if (from !== "none") $("tQty").value = +((+$("tMargin").value * lev / px) || 0).toPrecision(6);
  const qty = +$("tQty").value, notional = qty * px;
  $("tSummary").textContent = `Giá trị ${notional.toFixed(2)} USDT · phí taker ~${(notional * 0.0005).toFixed(2)}`;
}
function renderAccount() {
  const a = paper.account(), p = paper.positionView(key());
  const row = (k, v, cls = "") => `<span>${k}</span><b class="${cls}">${v}</b>`;
  $("account").innerHTML = row("Số dư", a.balance.toFixed(2)) + row("Tài sản ròng", a.equity.toFixed(2)) + row("Lãi/lỗ chưa chốt", (a.upnl >= 0 ? "+" : "") + a.upnl.toFixed(2), a.upnl >= 0 ? "pos" : "neg") +
    row("Ký quỹ đang dùng", (a.posMargin + a.ordMargin).toFixed(2)) + row("Khả dụng", a.available.toFixed(2)) +
    (p.qty ? row("Vị thế", `${p.qty > 0 ? "LONG" : "SHORT"} ${Math.abs(p.qty)} @ ${p.avg.toFixed(decimalsFor(market.tick))}`, p.qty > 0 ? "pos" : "neg") + row("Giá thanh lý", p.liq.toFixed(decimalsFor(market.tick)), "warn") : "");
  syncOwn();
}

// ---------- các tab phía dưới ----------
let symbolRows = [], symbolFilter = "";
function table(head, rows, empty) {
  if (!rows.length) return `<div class="empty">${empty}</div>`;
  return `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}
function renderTab() {
  const body = $("tabBody"), st = paper.s, dec = decimalsFor(market.tick);
  const positions = Object.values(st.positions).filter(p => p.qty);
  $("posCount").textContent = positions.length || ""; $("ordCount").textContent = paper.openOrders().length || "";
  if (S.tab === "positions") {
    body.innerHTML = table(["Mã", "Phía", "Khối lượng", "Giá vào", "Giá hiện tại", "Đòn bẩy", "Ký quỹ", "Lãi/lỗ", "Giá thanh lý", ""],
      positions.map(p => { const v = paper.positionView(p.key); return `<tr><td>${esc(p.key)}</td><td class="${p.qty > 0 ? "pos" : "neg"}">${p.qty > 0 ? "LONG" : "SHORT"}</td><td>${Math.abs(p.qty)}</td><td>${p.avg.toFixed(dec)}</td><td>${p.mark.toFixed(dec)}</td><td>${p.lev}x</td><td>${v.margin.toFixed(2)}</td><td class="${v.upnl >= 0 ? "pos" : "neg"}">${v.upnl >= 0 ? "+" : ""}${v.upnl.toFixed(2)}</td><td class="warn">${v.liq.toFixed(dec)}</td><td>${p.key === key() ? `<button data-close="1">Đóng</button>` : ""}</td></tr>`; }),
      "Chưa có vị thế. Đặt lệnh ở khung bên phải hoặc bấm vào sổ lệnh.");
  } else if (S.tab === "orders") {
    body.innerHTML = table(["Thời gian", "Mã", "Phía", "Loại", "Giá", "Đặt", "Đã khớp", "Còn lại", "Đứng trước mình", ""],
      paper.openOrders().map(o => `<tr><td>${fmtTime(o.t)}</td><td>${esc(o.key)}</td><td class="${o.side === "buy" ? "pos" : "neg"}">${o.side === "buy" ? "MUA" : "BÁN"}</td><td class="t">${o.type}</td><td>${o.price}</td><td>${o.qty}</td><td>${+o.filled.toFixed(6)}</td><td>${o.remaining}</td><td>${fmtVol(o.queueAhead)}</td><td><button data-cancel="${o.id}">Huỷ</button></td></tr>`),
      "Không có lệnh chờ.");
  } else if (S.tab === "fills") {
    body.innerHTML = table(["Thời gian", "Mã", "Phía", "Khối lượng", "Giá", "Phí", "Kiểu"],
      st.fills.slice(0, 200).map(f => `<tr><td>${fmtTime(f.t, true)}</td><td>${esc(f.key)}</td><td class="${f.side === "buy" ? "pos" : "neg"}">${f.side === "buy" ? "MUA" : "BÁN"}</td><td>${f.qty}</td><td>${f.price}</td><td>${f.fee.toFixed(4)}</td><td class="t">${f.liquidity}</td></tr>`),
      "Chưa có lệnh khớp.");
  } else if (S.tab === "liqs") {
    const sum = ms => { let l = 0, s = 0; const t0 = Date.now() - ms; for (const x of market.liqs) if (x.t >= t0) { if (x.side === "long") l += x.p * x.q; else s += x.p * x.q; } return [l, s]; };
    const [l5, s5] = sum(5 * 60e3), [l60, s60] = sum(3600e3);
    const head = ex().hasLiq ? `<div class="signalbar"><span>5 phút: long <b class="neg">${fmtUsd(l5)}</b> · short <b class="pos">${fmtUsd(s5)}</b></span><span>1 giờ: long <b class="neg">${fmtUsd(l60)}</b> · short <b class="pos">${fmtUsd(s60)}</b></span><span class="muted">tính từ lúc mở trang</span></div>` : `<div class="empty">${ex().name} không công bố lệnh thanh lý công khai.</div>`;
    body.innerHTML = head + table(["Thời gian", "Vị thế bị thanh lý", "Giá", "Khối lượng", "Giá trị"],
      market.liqs.slice(-200).reverse().map(x => `<tr><td>${fmtTime(x.t)}</td><td class="${x.side === "long" ? "neg" : "pos"}">${x.side === "long" ? "LONG" : "SHORT"}</td><td>${x.p.toFixed(dec)}</td><td>${fmtVol(x.q)}</td><td>${fmtUsd(x.p * x.q)}</td></tr>`),
      ex().hasLiq ? "Chưa có lệnh thanh lý nào kể từ lúc mở trang." : "");
  } else if (S.tab === "big") {
    const big = market.trades.filter(t => t.q >= market.bigTrade).slice(-150).reverse();
    body.innerHTML = `<div class="signalbar"><span>Ngưỡng lệnh lớn (top 0,5%): <b>${isFinite(market.bigTrade) ? fmtVol(market.bigTrade) + " " + coin() : "đang tính"}</b></span></div>` +
      table(["Thời gian", "Phía", "Giá", "Khối lượng", "Giá trị"], big.map(t => `<tr><td>${fmtTime(t.t)}</td><td class="${t.side === "buy" ? "pos" : "neg"}">${t.side === "buy" ? "MUA" : "BÁN"}</td><td>${t.p.toFixed(dec)}</td><td>${fmtVol(t.q)}</td><td>${fmtUsd(t.p * t.q)}</td></tr>`), "Chưa có lệnh lớn.");
  } else if (S.tab === "symbols") {
    const f = symbolFilter.toUpperCase(), rows = symbolRows.filter(r => !f || r.symbol.includes(f)).slice(0, 300);
    body.innerHTML = `<div class="signalbar"><input id="symFilter" placeholder="Tìm mã..." value="${esc(symbolFilter)}" style="width:160px"></div>` +
      table(["Mã", "Giá", "24h", "Khối lượng 24h"], rows.map(r => `<tr class="click${r.symbol === S.symbol ? " active" : ""}" data-sym="${esc(r.symbol)}"><td>${esc(r.symbol)}</td><td>${r.last}</td><td class="${r.change >= 0 ? "pos" : "neg"}">${fmtPct(r.change)}</td><td>${fmtUsd(r.volUsd)}</td></tr>`), "Đang tải danh sách mã...");
    const inp = $("symFilter"); inp.oninput = () => { symbolFilter = inp.value; renderTab(); const i2 = $("symFilter"); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); };
  } else if (S.tab === "logs") {
    const all = logs.concat(st.logs.map(x => ({ ...x, text: "[Giả lập] " + x.text }))).sort((a, b) => b.t - a.t).slice(0, 300);
    body.innerHTML = table(["Thời gian", "Nội dung"], all.map(x => `<tr><td>${fmtTime(x.t, true)}</td><td class="t">${esc(x.text)}</td></tr>`), "Chưa có nhật ký.");
  }
}
$("tabBody").addEventListener("click", e => {
  const c = e.target.closest("[data-cancel]"); if (c) return paper.cancel(c.dataset.cancel);
  if (e.target.closest("[data-close]")) return paper.closePosition(key(), market.book);
  const r = e.target.closest("[data-sym]"); if (r) { S.symbol = r.dataset.sym; $("symbol").value = S.symbol; load(); }
});
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
  // hỗ trợ / kháng cự
  $("srInfo").textContent = `khung ${S.interval}, giá ${last.toFixed(dec)}`;
  $("srTable").innerHTML = table(["Mức giá", "Loại", "Khoảng cách", "Số lần chạm", "Số lần test", "Test gần nhất", "Trạng thái", "Độ mạnh"],
    analysis.levels.slice().sort((a, b) => b.price - a.price).map(l => `<tr><td>${l.price.toFixed(dec)}</td><td class="t ${l.kind === "support" ? "pos" : "neg"}">${l.kind === "support" ? "Hỗ trợ" : "Kháng cự"}</td><td>${fmtPct(l.distancePct)}</td><td>${l.touches}</td><td>${l.tests}</td><td>${l.lastTestT ? fmtDate(l.lastTestT) : "-"}</td><td class="t">${l.flipped ? "Đã đảo vai" : l.broken ? "Đã bị phá" : "Còn giữ"}</td><td><span class="bar"><i style="left:0;width:${l.strength}%;background:var(--accent)"></i></span>${l.strength.toFixed(0)}</td></tr>`),
    "Chưa đủ dữ liệu.");
  // vùng khối lượng bất thường
  $("zoneTable").innerHTML = table(["Thời gian", "Phía", "Vùng giá", "Độ lệch", "Khối lượng", "Trạng thái"],
    analysis.zonesAll.slice(-25).reverse().map(z => `<tr><td>${fmtDate(z.t)}</td><td class="t ${z.side === "buy" ? "pos" : "neg"}">${z.side === "buy" ? "Mua chủ động" : "Bán chủ động"}</td><td>${z.low.toFixed(dec)} – ${z.high.toFixed(dec)}</td><td>${z.z.toFixed(1)}σ</td><td>${fmtVol(z.volume)}</td><td class="t">${z.active ? "Còn hiệu lực" : "Đã bị xuyên qua"}</td></tr>`),
    "Không có nến khối lượng bất thường trong dữ liệu đã tải.");
  renderLiqCard(last, dec);
  // hồ sơ khối lượng
  const vp = volumeProfile(market.bars.slice(-500));
  const near = (arr, n) => arr.slice().sort((a, b) => Math.abs(a - last) - Math.abs(b - last)).slice(0, n).sort((a, b) => b - a).map(x => x.toFixed(dec)).join(", ") || "-";
  $("vpStats").innerHTML = `<div class="kv"><span>Phạm vi</span><b>500 nến ${S.interval} gần nhất</b><span>POC (giá nhiều KL nhất)</span><b>${vp.poc == null ? "-" : vp.poc.toFixed(dec)}</b><span>Vùng giá trị 70%</span><b>${vp.val == null ? "-" : vp.val.toFixed(dec) + " – " + vp.vah.toFixed(dec)}</b><span>Nút khối lượng cao (HVN)</span><b>${near(vp.hvn, 6)}</b><span>Nút khối lượng thấp (LVN)</span><b>${near(vp.lvn, 6)}</b></div><p class="note">HVN thường là vùng giá dễ bị hút về và đi ngang; LVN là vùng giá dễ chạy nhanh qua.</p>`;
  renderDvol();
  // đa khung thời gian
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
  $("mtfTable").innerHTML = table(["Khung", "Xu hướng", "Điểm xu hướng", "Cấu trúc", "Động lượng", "Thay đổi 10 nến", "Chế độ biến động", "Biến động năm hoá"], rows, "");
}

function renderLiqCard(last, dec) {
  const sum = ms => { let l = 0, s = 0; const t0 = Date.now() - ms; for (const x of market.liqs) if (x.t >= t0) { if (x.side === "long") l += x.p * x.q; else s += x.p * x.q; } return [l, s]; };
  const [l60, s60] = sum(3600e3), m = analysis.liqMap;
  let html = `<div class="kv">`;
  html += ex().hasLiq ? `<span>Thanh lý thật 1 giờ (từ lúc mở trang)</span><b><span class="neg">long ${fmtUsd(l60)}</span> · <span class="pos">short ${fmtUsd(s60)}</span></b>` : `<span>Thanh lý thật</span><b>${ex().name} không công bố</b>`;
  if (m) {
    const top = (list, dir) => list.filter(b => dir > 0 ? b.price > last : b.price < last).sort((a, b) => b.notional - a.notional).slice(0, 3).sort((a, b) => dir * (a.price - b.price)).map(b => `${b.price.toFixed(dec)} (${fmtUsd(b.notional)})`).join(", ") || "-";
    html += `<span>Cụm short sẽ bị thanh lý (phía trên)</span><b>${top(m.shorts, 1)}</b><span>Cụm long sẽ bị thanh lý (phía dưới)</span><b>${top(m.longs, -1)}</b><span>Tổng ước tính</span><b>long ${fmtUsd(m.totalLong)} · short ${fmtUsd(m.totalShort)}</b>`;
  } else html += `<span>Bản đồ ước tính</span><b>${ex().hasOi ? "đang chờ dữ liệu open interest" : ex().name + " không có lịch sử open interest"}</b>`;
  $("liqStats").innerHTML = html + `</div>`;
  const cv = $("liqCanvas"), F = cv._fit || (cv._fit = fitCanvas(cv, () => renderLiqCard(last, dec))), ctx = F.ctx;
  ctx.fillStyle = "#0f1218"; ctx.fillRect(0, 0, F.w, F.h);
  if (!m) return;
  const lo = last * 0.88, hi = last * 1.12, n = 120, bins = new Array(n).fill(0).map(() => [0, 0]);
  for (const [list, s] of [[m.longs, 0], [m.shorts, 1]]) for (const b of list) { const k = Math.floor((b.price - lo) / (hi - lo) * n); if (k >= 0 && k < n) bins[k][s] += b.notional; }
  const maxN = Math.max(1, ...bins.map(b => b[0] + b[1])), bw = F.w / n;
  bins.forEach((b, k) => { const x = k * bw; let y = F.h - 16; for (const [v, col] of [[b[0], "#ff3df2"], [b[1], "#ffd400"]]) { const hh = v / maxN * (F.h - 30); ctx.fillStyle = col; ctx.fillRect(x, y - hh, Math.max(1, bw - 1), hh); y -= hh; } });
  const xl = (last - lo) / (hi - lo) * F.w; ctx.strokeStyle = "#fff"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xl, 0); ctx.lineTo(xl, F.h - 16); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#7d8899"; ctx.font = `11px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(lo.toFixed(dec), 2, F.h - 3); ctx.textAlign = "right"; ctx.fillText(hi.toFixed(dec), F.w - 2, F.h - 3); ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(last.toFixed(dec), xl, F.h - 3);
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
    box.innerHTML = `<div class="kv"><span>DVOL hiện tại (biến động kỳ vọng 30 ngày)</span><b>${cur.toFixed(1)}%</b><span>Thay đổi 24 giờ</span><b class="${cur >= day ? "pos" : "neg"}">${(cur - day >= 0 ? "+" : "") + (cur - day).toFixed(1)} điểm</b><span>Vị trí trong 30 ngày</span><b>${pct.toFixed(0)}%</b><span>Biến động thực tế (${S.interval})</span><b>${rv == null ? "-" : rv.toFixed(1) + "%"}</b><span>Chênh lệch kỳ vọng − thực tế</span><b>${rv == null ? "-" : (cur - rv).toFixed(1) + " điểm"}</b></div>`;
    const cv = $("dvolCanvas"), F = cv._fit || (cv._fit = fitCanvas(cv, () => renderDvol())), ctx = F.ctx;
    ctx.fillStyle = "#0f1218"; ctx.fillRect(0, 0, F.w, F.h);
    const lo = Math.min(...d.map(x => x.v)), hi = Math.max(...d.map(x => x.v));
    ctx.strokeStyle = "#c678dd"; ctx.lineWidth = 1.5; ctx.beginPath();
    d.forEach((x, i) => { const px = i / (d.length - 1) * (F.w - 40), py = 8 + (hi - x.v) / (hi - lo || 1) * (F.h - 24); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
    ctx.fillStyle = "#7d8899"; ctx.font = `11px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(hi.toFixed(0), F.w - 36, 14); ctx.fillText(lo.toFixed(0), F.w - 36, F.h - 12); ctx.fillText("DVOL 30 ngày", 4, F.h - 3);
  } catch (e) { box.innerHTML = `<p class="note">Không tải được DVOL từ Deribit: ${esc(e.message)}</p>`; }
}

// ---------- trang Backtest ----------
const btChart = new FlowChart($("btChart"), { emptyText: "Bấm \"Chạy backtest\" để xem điểm vào/ra lệnh trên biểu đồ" });
btChart.show = { ...btChart.show, liq: false, liqMap: false, cvd: false, oi: false, profile: false };
function renderStrategyForm() {
  const id = $("btStrategy").value, st = STRATEGIES[id];
  $("btDesc").textContent = st.description;
  $("btParams").innerHTML = st.params.map(p => `<label class="row">${esc(p.label)} <input type="number" data-param="${p.key}" value="${p.default}" min="${p.min}" max="${p.max}" step="${p.step}"></label>`).join("");
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
  const s = res.stats, card = (k, v, cls = "") => `<div class="stat"><span>${k}</span><b class="${cls}">${v}</b></div>`;
  $("btStats").innerHTML = card("Lợi nhuận ròng", `${s.netProfit >= 0 ? "+" : ""}${s.netProfit.toFixed(2)} (${fmtPct(s.netPct)})`, s.netProfit >= 0 ? "pos" : "neg") +
    card("Số lệnh", `${s.trades} (L ${s.longs} / S ${s.shorts})`) + card("Tỷ lệ thắng", s.trades ? s.winRate.toFixed(1) + "%" : "-") +
    card("Profit factor", isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞") + card("R trung bình", s.trades ? s.avgR.toFixed(2) : "-") +
    card("Kỳ vọng mỗi lệnh", s.trades ? s.expectancy.toFixed(2) + " USDT" : "-") + card("Sụt giảm tối đa", s.maxDrawdownPct.toFixed(2) + "%", "neg") +
    card("Sharpe (năm hoá)", isFinite(s.sharpe) ? s.sharpe.toFixed(2) : "-") + card("Giữ lệnh trung bình", s.trades ? s.avgBars.toFixed(1) + " nến" : "-") +
    card("Thời gian có vị thế", s.exposurePct.toFixed(1) + "%");
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
    box.innerHTML = `<h3>Giá chạm VWAP ${anchor} thì bật lại hay xuyên qua? <small>${bars.length} nến ${tf}, ${esc(S.symbol)} ${esc(ex().name)}</small></h3>` +
      table(["Khi chạm VWAP", "Số lần chạm", "Bật lại", "Xuyên qua", "Không rõ", `Lợi nhuận TB sau ${horizon} nến (theo hướng bật lại)`],
        [row("Từ trên xuống (VWAP là hỗ trợ)", rx.support), row("Từ dưới lên (VWAP là kháng cự)", rx.resistance)], "") +
      `<p class="note">Kết luận trên dữ liệu này: khi VWAP là hỗ trợ, giá ${verdict(rx.support)}; khi VWAP là kháng cự, giá ${verdict(rx.resistance)}. "Bật lại" nghĩa là trong ${horizon} nến giá đi tiếp về phía cũ được 1 ATR trước khi đóng cửa xuyên qua VWAP. "Xuyên qua" nghĩa là đóng cửa ở phía bên kia VWAP trước.</p>`;
  }
  const dec = decimalsFor(market.tick);
  $("btTrades").innerHTML = table(["#", "Phía", "Vào lúc", "Giá vào", "Ra lúc", "Giá ra", "Khối lượng", "Lãi/lỗ", "R", "Lý do", "Số nến"],
    res.trades.slice().reverse().map((t, k) => `<tr><td>${res.trades.length - k}</td><td class="${t.side === "long" ? "pos" : "neg"}">${t.side === "long" ? "LONG" : "SHORT"}</td><td>${fmtDate(t.entryT)}</td><td>${t.entryPx.toFixed(dec)}</td><td>${fmtDate(t.exitT)}</td><td>${t.exitPx.toFixed(dec)}</td><td>${+t.qty.toPrecision(5)}</td><td class="${t.pnl >= 0 ? "pos" : "neg"}">${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}</td><td>${t.r.toFixed(2)}</td><td class="t">${esc(t.reason)}</td><td>${t.bars}</td></tr>`),
    "Chiến lược không có lệnh nào trên dữ liệu này. Thử nới ngưỡng hoặc tăng số nến.");
}

// ---------- điều khiển giao diện ----------
function setConn(text, ok) { const p = $("connPill"); p.className = "pill" + (ok === true ? " ok" : ok === false ? " bad" : ""); p.querySelector("span").textContent = text; }
function setView(v) {
  S.view = v; persist();
  for (const b of $("views").children) b.classList.toggle("on", b.dataset.view === v);
  for (const id of ["terminal", "analysis", "backtest"]) $("view-" + id).hidden = id !== v;
  heat.dirty = flow.dirty = btChart.dirty = true;
  if (v === "analysis") renderAnalysis();
}
function setMode(m) {
  S.mode = m; persist();
  for (const b of $("chartMode").children) b.classList.toggle("on", b.dataset.mode === m);
  $("heat").hidden = m !== "heat"; $("flow").hidden = m === "heat";
  $("contrastBox").hidden = m !== "heat"; $("rowBox").hidden = m !== "box";
  $("chartHint").textContent = m === "heat" ? "Lăn chuột: phóng thời gian · Ctrl + lăn: phóng giá · Kéo: di chuyển · Bấm đúp: theo dõi" : "Lăn chuột: phóng to · Kéo: di chuyển · Kéo trục giá: giãn giá · Bấm đúp: về hiện tại";
  if (m !== "heat") flow.setType(m === "box" ? "box" : "candle");
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
$("orderType").onclick = e => { const b = e.target.closest("[data-otype]"); if (!b) return; S.otype = b.dataset.otype; for (const x of $("orderType").children) x.classList.toggle("on", x === b); $("priceRow").style.visibility = S.otype === "market" ? "hidden" : "visible"; updateSummary(); };
$("tMargin").oninput = () => updateSummary("margin");
$("tQty").oninput = () => updateSummary("qty");
$("tPrice").oninput = () => updateSummary();
$("tLev").oninput = () => { $("tLevRange").value = $("tLev").value; updateSummary(); };
$("tLevRange").oninput = () => { $("tLev").value = $("tLevRange").value; updateSummary(); };
$("pcts").onclick = e => { const b = e.target.closest("[data-pct]"); if (!b) return; $("tMargin").value = (Math.max(0, paper.account().available) * +b.dataset.pct / 100 * 0.995).toFixed(2); updateSummary("margin"); };
const submit = side => { const px = +$("tPrice").value || (side === "buy" ? market.book.bestBid() : market.book.bestAsk()); if (S.otype === "limit" && !$("tPrice").value) $("tPrice").value = px; placeOrder(side, S.otype, px); };
$("buyBtn").onclick = () => submit("buy");
$("sellBtn").onclick = () => submit("sell");
$("cancelAllBtn").onclick = () => paper.cancelAll(key());
$("closePosBtn").onclick = () => paper.closePosition(key(), market.book);
$("fullscreenBtn").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => toast("Trình duyệt không cho phép toàn màn hình, bấm F11", true)); };
for (const b of document.querySelectorAll("[data-max]")) b.onclick = () => {
  const ws = $("view-terminal"), cls = "max-" + b.dataset.max;
  [...ws.classList].filter(c => c.startsWith("max-")).forEach(c => { if (c !== cls) ws.classList.remove(c); });
  ws.classList.toggle(cls);
};

setMode(S.mode); setView(S.view); renderTab(); renderAccount();
loadSymbols(); load();
window.lailong = { market, paper, heat, flow, dom, S }; // tiện kiểm tra trong DevTools
