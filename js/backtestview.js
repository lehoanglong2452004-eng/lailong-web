// Lai Long Web: trang Backtest (giao diện). Chiến lược nằm trong strategies.js, bộ máy chạy lệnh trong backtest.js.
import { STRATEGIES, STRATEGY_ORDER, defaultParams } from "./strategies.js?v=202610141854";
import { simulate, tradeStats, splitTrades } from "./backtest.js?v=202610141854";
import { EquityChart } from "./fractalview.js?v=202610141854";
import { sampleLevel } from "./fractal.js?v=202610141854";
import { INTERVALS, fmtDate, decimalsFor } from "./util.js?v=202610141854";
import { isDeltaApprox } from "./analytics.js?v=202610141854";
import { robustness } from "./robust.js?v=202610141854";

const PIN_KEY = "lailong.btPins", SEL_KEY = "lailong.btStrat", LEG_KEY = "lailong.btLeg";
const sgn = (x, d = 2) => (x >= 0 ? "+" : "") + x.toFixed(d);
const fmtPF = x => isFinite(x) ? x.toFixed(2) : x === Infinity ? "∞" : "-";
const cls = v => v > 0 ? "pos" : v < 0 ? "neg" : "";
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } } };
// Kết luận: cần ít nhất 30 lệnh và cận dưới khoảng tin cậy 95% của kỳ vọng R phải trên 0
export function verdict(st) {
  if (!st.n) return { txt: "Không có lệnh", cls: "" };
  if (st.n < 30) return { txt: "Chưa đủ 30 lệnh", cls: "" };
  if (st.ci.lo > 0) return { txt: "Có lợi thế", cls: "pos" };
  if (st.ci.hi < 0) return { txt: "Lỗ rõ ràng", cls: "neg" };
  return { txt: "Chưa rõ lợi thế", cls: "" };
}

export function initBacktest({ $, S, ex, esc, table, market, chart }) {
  let pins = store.get(PIN_KEY, []), cur = store.get(SEL_KEY, "midoti"), leg = store.get(LEG_KEY, 2), last = null, rank = null, rob = null;
  const eq = {}; for (const id of ["btEqBoth", "btEqLong", "btEqShort"]) eq[id] = new EquityChart($(id));
  const status = t => { $("btStatus").textContent = t; };

  // ---------- danh sách chiến lược + ghim ----------
  function renderList() {
    const item = id => `<div class="it${id === cur ? " sel" : ""}" data-id="${id}"><button class="star${pins.includes(id) ? " on" : ""}" data-star="${id}" title="${pins.includes(id) ? "Bỏ ghim" : "Ghim lên đầu"}">${pins.includes(id) ? "★" : "☆"}</button><span class="nm">${esc(STRATEGIES[id].name)}</span></div>`;
    const pinned = STRATEGY_ORDER.filter(id => pins.includes(id)), rest = STRATEGY_ORDER.filter(id => !pins.includes(id));
    $("btList").innerHTML = (pinned.length ? `<div class="grp">⭐ Đã ghim</div>${pinned.map(item).join("")}<div class="grp">Các chiến lược khác</div>` : "") + rest.map(item).join("");
  }
  $("btList").onclick = e => {
    const st = e.target.closest("[data-star]");
    if (st) { const id = st.dataset.star; pins = pins.includes(id) ? pins.filter(x => x !== id) : [...pins, id]; store.set(PIN_KEY, pins); renderList(); if (rank) renderRank(); return; }
    const it = e.target.closest("[data-id]"); if (!it || it.dataset.id === cur) return;
    cur = it.dataset.id; store.set(SEL_KEY, cur); renderList(); renderForm();
  };
  function renderForm() {
    const st = STRATEGIES[cur];
    $("btDesc").innerHTML = `${esc(st.description)} <button class="q" data-g="bt-strategies">?</button>`;
    $("btParams").innerHTML = st.params.map(p => {
      const lab = p.g ? `data-g="${p.g}"` : `data-tip="${esc(p.label)}"`;
      const ctl = p.options
        ? `<select data-param="${p.key}">${p.options.map((o, k) => `<option value="${k}"${k === p.default ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
        : `<input type="number" data-param="${p.key}" value="${p.default}" min="${p.min}" max="${p.max}" step="${p.step}">`;
      return `<label class="row" ${lab}>${esc(p.label)} ${ctl}</label>`;
    }).join("");
  }
  const clampNum = (el, lo, hi, def) => { const v = +el.value; return isFinite(v) && el.value !== "" ? Math.min(hi, Math.max(lo, v)) : def; };
  function readParams() {
    const out = defaultParams(cur);
    for (const p of STRATEGIES[cur].params) { const el = $("btParams").querySelector(`[data-param="${p.key}"]`); if (el) out[p.key] = p.options ? +el.value : clampNum(el, p.min, p.max, p.default); }
    return out;
  }
  function common() {
    const tf = $("btInterval").value, num = (id, lo, hi, def) => clampNum($(id), lo, hi, def);
    const holdH = num("btHold", 0.25, 720, 48), o = {
      tf, n: Math.round(num("btBars", 300, 90000, 20000)), capital: num("btCapital", 10, 1e12, 10000), holdH,
      sim: { riskPct: num("btRisk", 0.1, 20, 1), maxLeverage: num("btLev", 1, 125, 20), feeRate: num("btFee", 0, 5, 0.05) / 100, slippageBps: num("btSlip", 0, 500, 2),
        tp1R: num("btTp1", 0.2, 20, 1), tp2R: num("btTp2", 0.2, 20, 2), maxHoldBars: Math.max(1, Math.round(holdH * 36e5 / INTERVALS[tf])), intervalMs: INTERVALS[tf] },
    };
    return o;
  }
  const cache = new Map();
  async function loadBars(tf, n, symbol = S.symbol) {
    const k = `${S.ex}:${symbol}:${tf}:${n}`;
    if (cache.has(k) && Date.now() - cache.get(k).t < 5 * 60e3) return cache.get(k).bars;
    let bars = await ex().klines(symbol, tf, n);
    const ms = INTERVALS[tf], now = Date.now();
    bars = bars.filter(b => b.t + ms <= now); // chỉ dùng nến đã đóng cửa
    cache.set(k, { t: Date.now(), bars });
    return bars;
  }
  const busy = on => { $("btRun").disabled = $("btRunAll").disabled = $("btRobustRun").disabled = on; };

  // ---------- chạy một chiến lược ----------
  async function run() {
    const o = common(), id = cur, params = readParams();
    busy(true); status(`Đang tải ${o.n} nến ${o.tf} ${S.symbol} từ ${ex().name}...`);
    try {
      const bars = await loadBars(o.tf, o.n);
      if (bars.length < 300) throw new Error("không đủ dữ liệu");
      status(`Đang chạy ${STRATEGIES[id].short} trên ${bars.length} nến...`); await new Promise(r => setTimeout(r, 20));
      const res = {}; for (const side of ["both", "long", "short"]) res[side] = simulate(bars, id, params, { ...o.sim, side });
      last = { bars, o, id, params, res, symbol: S.symbol, exName: ex().name };
      render();
      const warn = id === "midoti" && INTERVALS[o.tf] > 36e5 ? " MIDOTI chỉ chạy từ khung 1 phút tới 1 giờ, khung này sẽ không có lệnh." : "";
      status(`Xong: ${bars.length} nến từ ${fmtDate(bars[0].t)} đến ${fmtDate(bars[bars.length - 1].t)}. Đã tính phí và trượt giá.${warn}`);
    } catch (e) { status(`Lỗi: ${e.message}`); }
    busy(false);
  }
  $("btRun").onclick = run;
  $("btLegBar").onclick = e => { const b = e.target.closest("[data-leg]"); if (!b) return; leg = +b.dataset.leg; store.set(LEG_KEY, leg); if (last) render(); if (rank) renderRank(); if (rob) renderRobust(); };

  function statRows(title, st, risk, capital) {
    const v = verdict(st);
    return `<div class="h ${cls(st.totalR)}">${title}</div>` +
      `<span data-g="bt-scen">Số lệnh</span><b>${st.n} <small class="${sampleLevel(st.n).cls}">${sampleLevel(st.n).label}</small></b>` +
      `<span data-g="bt-scen">WR (thắng sau phí)</span><b>${st.n ? (st.wr * 100).toFixed(1) + "%" : "-"}</b>` +
      `<span data-g="bt-scen">PF</span><b class="${st.pf > 1 ? "pos" : st.pf < 1 ? "neg" : ""}">${fmtPF(st.pf)}</b>` +
      `<span data-g="bt-scen">Tổng R</span><b class="${cls(st.totalR)}">${sgn(st.totalR, 1)}R</b>` +
      `<span data-g="bt-scen">Vốn (rủi ro ${risk}%/lệnh)</span><b class="${cls(st.finalPct)}">${sgn(st.finalPct, 1)}% · ${(capital * (1 + st.finalPct / 100)).toFixed(0)}</b>` +
      `<span data-g="bt-scen">Kỳ vọng / lệnh (95%)</span><b class="${st.ci.lo > 0 ? "pos" : st.ci.hi < 0 ? "neg" : ""}">${st.n ? `${sgn(st.avgR)} <small>${sgn(st.ci.lo)}…${sgn(st.ci.hi)}</small>` : "-"}</b>` +
      `<span data-g="bt-scen">Sụt giảm tối đa</span><b class="neg">${st.maxDDR.toFixed(1)}R · ${st.maxDDPct.toFixed(1)}%</b>` +
      `<span data-g="bt-scen">Chuỗi thua dài nhất</span><b>${st.maxLossStreak} lệnh</b>` +
      `<span data-g="bt-scen">Kết luận</span><b class="txt ${v.cls}">${v.txt}</b>`;
  }

  function render() {
    const { bars, o, id, res, symbol, exName } = last, risk = o.sim.riskPct, k = leg === 1 ? "r1" : "r2";
    const tpTxt = leg === 1 ? `TP1 ${o.sim.tp1R}R` : `TP2 ${o.sim.tp2R}R`;
    $("btLegBar").hidden = false;
    for (const b of $("btLegBar").querySelectorAll("[data-leg]")) { b.classList.toggle("on", +b.dataset.leg === leg); b.textContent = b.dataset.leg === "1" ? `TP1 · ${o.sim.tp1R}R` : `TP2 · ${o.sim.tp2R}R`; }
    $("btLegNote").textContent = "· cùng giá vào và SL, chỉ khác điểm chốt lời. Đổi để so hai kịch bản.";
    const sts = {}; for (const s of ["both", "long", "short"]) sts[s] = tradeStats(res[s].trades, leg, risk);
    const a = sts.both, v = verdict(a), card = (g, kk, val, c = "") => `<div class="stat" data-g="${g}"><span>${kk}</span><b class="${c}">${val}</b></div>`;
    const nL = res.both.trades.filter(t => t.side === "long").length;
    $("btStats").innerHTML =
      card("bt-strategies", "Chiến lược", esc(STRATEGIES[id].short), "txt") +
      card("bt-trades", "Số lệnh", `${a.n} (L ${nL} / S ${a.n - nL})`) +
      card("bt-winrate", "WR (thắng sau phí)", a.n ? (a.wr * 100).toFixed(1) + "%" : "-") +
      card("bt-pf", "Profit factor", fmtPF(a.pf), a.pf > 1 ? "pos" : a.pf < 1 ? "neg" : "") +
      card("bt-scen", "Kỳ vọng / lệnh (95%)", a.n ? `${sgn(a.avgR)}R <small>${sgn(a.ci.lo)}…${sgn(a.ci.hi)}</small>` : "-", a.ci.lo > 0 ? "pos" : a.ci.hi < 0 ? "neg" : "") +
      card("bt-scen", "Tổng R", `${sgn(a.totalR, 1)}R`, cls(a.totalR)) +
      card("bt-net", "Vốn cuối", `${(o.capital * (1 + a.finalPct / 100)).toFixed(2)} (${sgn(a.finalPct, 1)}%)`, cls(a.finalPct)) +
      card("bt-mdd", "Sụt giảm tối đa", `${a.maxDDR.toFixed(1)}R · ${a.maxDDPct.toFixed(1)}%`, "neg") +
      card("bt-avgbars", "Giữ lệnh trung bình", a.n ? `${a.avgBars.toFixed(1)} nến` : "-") +
      card("bt-scen", "Kết luận", v.txt, v.cls + " txt");
    // ba kịch bản, dùng chung thang R
    const { cut } = splitTrades([], bars);
    const rows = [
      { id: "btEqBoth", title: "Theo chiến lược (cả LONG và SHORT)", color: "accent", tr: res.both.trades, st: sts.both },
      { id: "btEqLong", title: "Chỉ lệnh LONG", color: "up", tr: res.long.trades, st: sts.long },
      { id: "btEqShort", title: "Chỉ lệnh SHORT", color: "down", tr: res.short.trades, st: sts.short },
    ];
    const all = rows.flatMap(r => r.st.curve); let lo = Math.min(0, ...all), hi = Math.max(0, ...all); const pad = Math.max(0.5, (hi - lo) * 0.08); lo -= pad; hi += pad;
    for (const r of rows) {
      eq[r.id].set({ title: r.title, long: `${r.title} · ${tpTxt}`, color: r.color, Rs: r.tr.map(t => t[k]), ts: r.tr.map(t => t.t), tags: r.tr.map(t => `${t.side === "long" ? "LONG" : "SHORT"} ${t.tag}`), st: r.st, range: [lo, hi], splitK: r.tr.filter(t => t.t < cut).length });
      $(r.id + "S").innerHTML = statRows(r.title, r.st, risk, o.capital);
    }
    $("btScen").hidden = false;
    $("btScenSub").textContent = `${symbol} · ${exName} · ${o.tf} · ${bars.length} nến · ${tpTxt} · SL theo chiến lược · giữ tối đa ${o.holdH} giờ · rủi ro ${risk}%/lệnh`;
    renderValid(cut); renderTags(); renderChart(); renderTrades();
  }

  // ---------- kiểm chứng 70% đầu / 30% cuối ----------
  function renderValid(cut) {
    const { bars, o, res } = last, risk = o.sim.riskPct, rowsHtml = [];
    for (const [s, name] of [["both", "Theo chiến lược"], ["long", "Chỉ LONG"], ["short", "Chỉ SHORT"]]) {
      const sp = splitTrades(res[s].trades, bars);
      for (const [part, tr] of [["70% đầu", sp.ins], ["30% cuối (ngoài mẫu)", sp.oos]]) {
        const st = tradeStats(tr, leg, risk), v = verdict(st);
        rowsHtml.push(`<tr><td class="t">${name}</td><td class="t">${part}</td><td>${st.n}</td><td>${st.n ? (st.wr * 100).toFixed(1) + "%" : "-"}</td><td class="${st.pf > 1 ? "pos" : st.pf < 1 ? "neg" : ""}">${fmtPF(st.pf)}</td><td class="${st.ci.lo > 0 ? "pos" : st.ci.hi < 0 ? "neg" : ""}">${st.n ? `${sgn(st.avgR)} <small>(${sgn(st.ci.lo)}…${sgn(st.ci.hi)})</small>` : "-"}</td><td class="${cls(st.totalR)}">${sgn(st.totalR, 1)}R</td><td class="neg">${st.maxDDR.toFixed(1)}R</td><td class="t ${v.cls}">${v.txt}</td></tr>`);
      }
    }
    const both = splitTrades(res.both.trades, bars), si = tradeStats(both.ins, leg, risk), so = tradeStats(both.oos, leg, risk);
    const note = !si.n ? "Chưa có lệnh để so." : si.avgR > 0 && so.avgR > 0 ? "Kỳ vọng R dương ở cả hai phần, lợi thế có vẻ ổn định qua thời gian." : si.avgR > 0 && !(so.avgR > 0) ? "Phần đầu dương nhưng 30% cuối không còn dương: có thể quá khớp, hoặc thị trường gần đây đã đổi tính chất." : !(si.avgR > 0) && so.avgR > 0 ? "Phần đầu âm nhưng 30% cuối dương: chưa đủ để tin, cần thêm dữ liệu." : "Cả hai phần đều không dương.";
    $("btValid").hidden = false;
    $("btValid").innerHTML = `<h3>Kiểm chứng: 70% dữ liệu đầu so với 30% cuối <button class="q" data-g="bt-oos">?</button> <small>mốc chia ${fmtDate(cut)} · ${leg === 1 ? "TP1" : "TP2"}</small></h3>` +
      table(["Kịch bản", "Phần dữ liệu", "Số lệnh", "WR", "PF", "Kỳ vọng / lệnh (95%)", "Tổng R", "Sụt giảm", "Kết luận"], rowsHtml, "") + `<p class="note">${note}</p>`;
  }
  // ---------- theo từng thiết lập (tag) ----------
  function renderTags() {
    const { o, res } = last, g = new Map();
    for (const t of res.both.trades) { const key = `${t.side === "long" ? "LONG" : "SHORT"} · ${t.tag}`; if (!g.has(key)) g.set(key, []); g.get(key).push(t); }
    const rows = [...g.entries()].map(([key, tr]) => ({ key, st: tradeStats(tr, leg, o.sim.riskPct) })).sort((x, y) => y.st.n - x.st.n);
    $("btTags").hidden = rows.length < 2;
    $("btTags").innerHTML = `<h3>Theo từng thiết lập <small>kịch bản theo chiến lược · ${leg === 1 ? "TP1" : "TP2"}</small></h3>` +
      table(["Thiết lập", "Số lệnh", "WR", "PF", "Kỳ vọng / lệnh (95%)", "Tổng R"], rows.map(({ key, st }) => `<tr><td class="t">${esc(key)}</td><td>${st.n}</td><td>${(st.wr * 100).toFixed(1)}%</td><td>${fmtPF(st.pf)}</td><td class="${st.ci.lo > 0 ? "pos" : st.ci.hi < 0 ? "neg" : ""}">${sgn(st.avgR)} <small>(${sgn(st.ci.lo)}…${sgn(st.ci.hi)})</small></td><td class="${cls(st.totalR)}">${sgn(st.totalR, 1)}R</td></tr>`), "");
  }
  function renderChart() {
    const { bars, o, res } = last;
    const bb = bars.map(b => ({ ...b, d: b.bv != null ? 2 * b.bv - b.v : (b.h > b.l ? b.v * (b.c - b.o) / (b.h - b.l) : 0) }));
    chart.setData(bb, { step: market.fpStep || 1, tick: market.tick, intervalMs: INTERVALS[o.tf], symbol: last.symbol, exchangeName: last.exName, interval: o.tf, deltaApprox: isDeltaApprox(bars) });
    const markers = [];
    for (const t of res.both.trades) {
      const dir = t.side === "long" ? 1 : -1, x = leg === 1 ? t.exit1 : t.exit2, r = leg === 1 ? t.r1 : t.r2;
      markers.push({ t: t.t, price: t.entryPx, dir, link: { t: x.t, price: x.px, win: r > 0 } }, { t: x.t, price: x.px, dir, exit: true });
    }
    chart.setOverlays({ markers, levels: [], zones: [], lines: [] });
  }
  function renderTrades() {
    const { res } = last, tr = res.both.trades, dec = decimalsFor(market.tick || 0.01), shown = tr.slice(-500).reverse();
    const legCell = (r, why, px) => `<td class="${cls(r)}">${sgn(r)}R</td><td class="t">${esc(why)}</td><td>${px.toFixed(dec)}</td>`;
    $("btTrades").innerHTML = (tr.length > 500 ? `<p class="note">Hiện 500 lệnh gần nhất trong ${tr.length} lệnh.</p>` : "") + table(
      ["#", "Phía", "Thiết lập", "Vào lúc", "Giá vào", "SL", ["TP1: R", "bt-tp"], ["Lý do", "bt-reason"], "Giá ra", ["TP2: R", "bt-tp"], ["Lý do", "bt-reason"], "Giá ra", ["Nến", "bt-avgbars"]],
      shown.map((t, j) => `<tr><td>${tr.length - j}</td><td class="${t.side === "long" ? "pos" : "neg"}">${t.side === "long" ? "LONG" : "SHORT"}</td><td class="t">${esc(t.tag)}${t.f < 1 ? ' <small title="Khối lượng bị giới hạn bởi đòn bẩy tối đa">⚠ đòn bẩy</small>' : ""}</td><td>${fmtDate(t.t)}</td><td>${t.entryPx.toFixed(dec)}</td><td>${t.stop.toFixed(dec)}</td>${legCell(t.r1, t.why1, t.exit1.px)}${legCell(t.r2, t.why2, t.exit2.px)}<td>${Math.max(t.bars1, t.bars2)}</td></tr>`),
      "Chiến lược không có lệnh nào trên dữ liệu này. Thử nới ngưỡng, đổi khung nến hoặc tăng số nến.");
  }

  // ---------- chạy tất cả, xếp hạng ----------
  $("btRunAll").onclick = async () => {
    const o = common();
    busy(true); status(`Đang tải ${o.n} nến ${o.tf} ${S.symbol} từ ${ex().name}...`);
    try {
      const bars = await loadBars(o.tf, o.n);
      if (bars.length < 300) throw new Error("không đủ dữ liệu");
      const out = [];
      for (const [j, id] of STRATEGY_ORDER.entries()) {
        status(`Đang chạy ${j + 1}/${STRATEGY_ORDER.length}: ${STRATEGIES[id].short}...`); await new Promise(r => setTimeout(r, 0));
        out.push({ id, res: simulate(bars, id, {}, { ...o.sim, side: "both" }) });
      }
      rank = { bars, o, out, symbol: S.symbol, exName: ex().name };
      renderRank();
      status(`Xong bảng xếp hạng: ${STRATEGY_ORDER.length} chiến lược, thông số mặc định, ${bars.length} nến từ ${fmtDate(bars[0].t)} đến ${fmtDate(bars[bars.length - 1].t)}.`);
    } catch (e) { status(`Lỗi: ${e.message}`); }
    busy(false);
  };
  function renderRank() {
    const { bars, o, out, symbol, exName } = rank, risk = o.sim.riskPct;
    $("btLegBar").hidden = false;
    const rows = out.map(({ id, res }) => { const st = tradeStats(res.trades, leg, risk), sp = splitTrades(res.trades, bars); return { id, st, oos: tradeStats(sp.oos, leg, risk) }; })
      .sort((x, y) => (isFinite(y.st.ci.lo) ? y.st.ci.lo : -1e9) - (isFinite(x.st.ci.lo) ? x.st.ci.lo : -1e9));
    $("btRank").hidden = false;
    $("btRank").innerHTML = `<h3>Bảng xếp hạng chiến lược <button class="q" data-g="bt-rank">?</button> <small>${esc(symbol)} · ${esc(exName)} · ${o.tf} · ${bars.length} nến · ${leg === 1 ? `TP1 ${o.sim.tp1R}R` : `TP2 ${o.sim.tp2R}R`} · thông số mặc định · bấm một dòng để xem chi tiết</small></h3>` +
      `<div class="rank">` + table(["", "Chiến lược", "Số lệnh", "WR", "PF", ["Kỳ vọng / lệnh (95%)", "bt-scen"], "Tổng R", "Sụt giảm", ["30% cuối: kỳ vọng", "bt-oos"], "Kết luận"],
        rows.map(({ id, st, oos }) => { const v = verdict(st); return `<tr class="click${id === cur ? " cur" : ""}" data-rank="${id}"><td>${pins.includes(id) ? "⭐" : ""}</td><td class="t">${esc(STRATEGIES[id].name)}</td><td>${st.n}</td><td>${st.n ? (st.wr * 100).toFixed(1) + "%" : "-"}</td><td class="${st.pf > 1 ? "pos" : st.pf < 1 ? "neg" : ""}">${fmtPF(st.pf)}</td><td class="${st.ci.lo > 0 ? "pos" : st.ci.hi < 0 ? "neg" : ""}">${st.n ? `${sgn(st.avgR)} <small>(${sgn(st.ci.lo)}…${sgn(st.ci.hi)})</small>` : "-"}</td><td class="${cls(st.totalR)}">${sgn(st.totalR, 1)}R</td><td class="neg">${st.n ? st.maxDDR.toFixed(1) + "R" : "-"}</td><td class="${cls(oos.avgR)}">${oos.n ? `${sgn(oos.avgR)} <small>(${oos.n} lệnh)</small>` : "-"}</td><td class="t ${v.cls}">${v.txt}</td></tr>`; }), "") + `</div>` +
      `<p class="note">Xếp theo cận dưới khoảng tin cậy 95% của kỳ vọng R mỗi lệnh. Chạy nhiều chiến lược rồi chọn cái đứng đầu cũng có phần may rủi, nên xem thêm cột 30% cuối và thử trên mã khác.</p>`;
  }
  $("btRank").onclick = e => {
    const tr = e.target.closest("[data-rank]"); if (!tr) return;
    cur = tr.dataset.rank; store.set(SEL_KEY, cur); renderList(); renderForm(); renderRank(); run();
  };

  // ---------- kiểm tra độ bền: nhiều coin, nhiều đoạn thời gian, theo trạng thái thị trường ----------
  $("btRobustRun").onclick = async () => {
    const o = common(), id = cur, params = readParams();
    const syms = [...new Set($("btSyms").value.toUpperCase().split(/[\s,;]+/).filter(Boolean))].slice(0, 12);
    const K = Math.round(clampNum($("btSegs"), 2, 12, 5));
    if (!syms.length) { status("Nhập ít nhất một coin, ví dụ BTCUSDT, ETHUSDT."); return; }
    busy(true);
    const sets = [], failed = [];
    for (const [j, sym] of syms.entries()) {
      status(`Đang tải và chạy ${j + 1}/${syms.length}: ${sym} (${o.n} nến ${o.tf} từ ${ex().name})...`); await new Promise(r => setTimeout(r, 0));
      try {
        const bars = await loadBars(o.tf, o.n, sym);
        if (bars.length < 300) throw new Error("không đủ dữ liệu");
        sets.push({ symbol: sym, bars, trades: simulate(bars, id, params, { ...o.sim, side: "both" }).trades });
      } catch (e) { failed.push(`${sym} (${e.message})`); }
    }
    if (sets.length) { rob = { sets, o, id, K, failed, exName: ex().name }; renderRobust(); status(`Xong kiểm tra độ bền: ${STRATEGIES[id].short} trên ${sets.length} coin.${failed.length ? ` Bỏ qua: ${failed.join(", ")}.` : ""}`); }
    else status(`Lỗi: không tải được coin nào. ${failed.join(", ")}`);
    busy(false);
  };
  function renderRobust() {
    const { sets, o, id, K, exName } = rob, risk = o.sim.riskPct, R = robustness(sets, { segments: K, leg, riskPct: risk });
    $("btLegBar").hidden = false;
    const ev = st => st.n ? `${sgn(st.avgR)} <small>(${sgn(st.ci.lo)}…${sgn(st.ci.hi)})</small>` : "-";
    const evCls = st => st.ci.lo > 0 ? "pos" : st.ci.hi < 0 ? "neg" : "";
    const cell = st => `<td class="cell ${st.n ? cls(st.avgR) : ""}${st.n < 5 ? " few" : ""}" title="${st.n} lệnh">${st.n ? `${sgn(st.avgR)}<br><small>${st.n} lệnh</small>` : "-"}</td>`;
    const day = t => fmtDate(t).slice(0, 10);
    const head = ["Coin", "Số lệnh", "WR", "PF", ["Kỳ vọng / lệnh (95%)", "bt-scen"], "Tổng R", "Sụt giảm", ["30% cuối: kỳ vọng", "bt-oos"], "Kết luận"];
    const row = (name, st, oos) => { const v = verdict(st); return `<tr><td class="t">${esc(name)}</td><td>${st.n}</td><td>${st.n ? (st.wr * 100).toFixed(1) + "%" : "-"}</td><td class="${st.pf > 1 ? "pos" : st.pf < 1 ? "neg" : ""}">${fmtPF(st.pf)}</td><td class="${evCls(st)}">${ev(st)}</td><td class="${cls(st.totalR)}">${sgn(st.totalR, 1)}R</td><td class="neg">${st.n ? st.maxDDR.toFixed(1) + "R" : "-"}</td><td class="${oos ? cls(oos.avgR) : ""}">${oos && oos.n ? `${sgn(oos.avgR)} <small>(${oos.n} lệnh)</small>` : "-"}</td><td class="t ${v.cls}">${v.txt}</td></tr>`; };
    $("btRobust").hidden = false;
    $("btRobust").innerHTML = `<h3>Kiểm tra độ bền: ${esc(STRATEGIES[id].name)} <button class="q" data-g="bt-robust">?</button> <small>${esc(exName)} · ${o.tf} · ${o.n} nến mỗi coin · ${leg === 1 ? `TP1 ${o.sim.tp1R}R` : `TP2 ${o.sim.tp2R}R`} · cùng một bộ thông số cho mọi coin</small></h3>` +
      `<div class="robust"><p class="verdict ${R.verdict.cls}">${R.verdict.txt}</p><ul class="checks">${R.checks.map(c => `<li class="${c.ok ? "ok" : ""}">${esc(c.txt)}</li>`).join("")}</ul>` +
      `<h3>Từng coin</h3>` + table(head, [...R.coins.map(c => row(c.symbol, c.st, c.oos)), row("Gộp tất cả", R.pooled, null)], "") +
      `<h3>Từng đoạn thời gian <button class="q" data-g="bt-segs">?</button> <small>kỳ vọng R mỗi lệnh, ô xanh là dương, ô đỏ là âm, ô mờ là dưới 5 lệnh</small></h3>` +
      table(["Coin", ...R.segs.map((g, k) => `Đoạn ${k + 1}<br><small>${day(g.from)}</small>`)],
        [...R.coins.map(c => `<tr><td class="t">${esc(c.symbol)}</td>${c.cells.map(cell).join("")}</tr>`), `<tr><td class="t"><b>Gộp</b></td>${R.segs.map(g => cell(g.st)).join("")}</tr>`], "") +
      `<h3>Theo trạng thái thị trường <button class="q" data-g="bt-regime">?</button> <small>gộp mọi coin, xét lúc có tín hiệu</small></h3>` +
      table(["Trạng thái", "Số lệnh", "WR", "PF", "Kỳ vọng / lệnh (95%)", "Tổng R"], R.regimes.map(({ name, st }) => `<tr><td class="t">${name}</td><td>${st.n}</td><td>${st.n ? (st.wr * 100).toFixed(1) + "%" : "-"}</td><td class="${st.pf > 1 ? "pos" : st.pf < 1 ? "neg" : ""}">${fmtPF(st.pf)}</td><td class="${evCls(st)}">${ev(st)}</td><td class="${cls(st.totalR)}">${sgn(st.totalR, 1)}R</td></tr>`), "") +
      `<p class="note">${R.regNote.length ? `Chiến lược kiếm được tiền khi ${R.regNote.join(", ")}.` : "Chưa thấy trạng thái thị trường nào cho kỳ vọng dương."} Mỗi đoạn thời gian dùng đúng thông số đặt từ trước, không chỉnh lại theo dữ liệu, nên mỗi đoạn là một lần thử độc lập. Nếu bro chỉnh thông số cho đến khi bảng này đẹp thì nó lại mất tác dụng.</p></div>`;
  }

  // MIDOTI nằm ở file riêng, chỉ có trong bản trên máy của Lai Long; không có thì bỏ qua
  import("./midoti.js").catch(() => null).finally(() => { if (!STRATEGIES[cur]) cur = STRATEGY_ORDER[0]; renderList(); renderForm(); });
  return { tips: eq, redraw() { for (const c of Object.values(eq)) c.draw(); } };
}
