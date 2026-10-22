// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: tab Tín hiệu. Kho lịch sử, sổ tín hiệu tự chấm điểm, thống kê theo bối cảnh, kế hoạch trước phiên.
// Phần tính nằm ở signals.js, context.js, levels.js, plan.js; phần nạp dữ liệu ở histdata.js và eventlog.js.
import { SIGNALS, VERDICT, prepBars, detectAll, placeEvents, scoreEvents, baseline, scorecard, byContext, edgesFor, horizonsFor, fmtH } from "./signals.js?v=202610220403";
import { contextSeries, sessionOf } from "./context.js?v=202610220403";
import { liveZones } from "./levels.js?v=202610220403";
import { buildPlan, planText, sessionWindow } from "./plan.js?v=202610220403";
import { storeStatus, startFetch, loadHistory } from "./histdata.js?v=202610220403";
import { liveEvents, eventCount } from "./eventlog.js?v=202610220403";
import { getJson, INTERVALS, decimalsFor, fmtTime } from "./util.js?v=202610220403";

export const VERIFIED_KEY = "lailong.verified";
const TFS = ["5m", "15m", "1h", "4h"];
const sgn = x => (x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`);
const pc = x => (x == null || !isFinite(x) ? "–" : `${Math.round(x * 100)}%`);
const cls = x => (x == null || !isFinite(x) ? "" : x > 0 ? "pos" : x < 0 ? "neg" : "");

// tín hiệu đã kiểm chứng cho mã này (cho bộ lọc cảnh báo): có lợi thế chung, hoặc trong phiên đang chạy
export function isVerified(sym, sig, now = Date.now()) {
  try {
    const v = JSON.parse(localStorage.getItem(VERIFIED_KEY) || "{}")[sym]; if (!v || !v[sig]) return false;
    return v[sig].all === "edge" || (v[sig].ctx || []).includes(`session=${sessionOf(now)}`);
  } catch { return false; }
}

export function initSignals({ $, esc, S, toast, alerts, liveSources = () => [] }) {
  let ui = { sym: "", tf: "1h", days: 180, fee: 0.05, slip: 2, h: null, sel: null, autoTg: false };
  try { ui = { ...ui, ...JSON.parse(sessionStorage.getItem("lailong.sig") || "{}") }; } catch { /* bỏ qua */ }
  const saveUi = () => { try { sessionStorage.setItem("lailong.sig", JSON.stringify(ui)); } catch { /* bỏ qua */ } };
  let res = null, busy = false, store = null, poll = null, visible = false, lastSession = sessionWindow().id;

  // ---------- kho lịch sử ----------
  async function renderStore() {
    store = await storeStatus();
    const el = $("sgStore");
    if (!store) {
      el.innerHTML = `<p class="small">Bản web không có kho lịch sử: sổ tín hiệu dùng nến Binance qua API công khai (OI và tỷ lệ long/short chỉ 30 ngày, không tách được lệnh cá voi).</p><p class="muted small">Mở bản laptop (Mo Lai Long.bat) để tải nhiều năm lệnh khớp, OI, tỷ lệ long/short và độ sâu sổ lệnh miễn phí từ data.binance.vision.</p>`;
      return;
    }
    const syms = Object.entries(store.symbols || {}), job = store.job || {};
    const row = ([s, x]) => { const f = x.flow || {}, m = x.metrics || {}, d = x.depth || {}; return `<tr><td class="t"><b>${esc(s)}</b></td><td>${f.days || 0} ngày<br><small class="muted">${f.first || "–"} → ${f.last || "–"}</small></td><td>${m.days || 0}</td><td>${d.days || 0}</td><td>${x.step || "–"}</td><td>${((x.bytes || 0) / 1e6).toFixed(0)} MB</td></tr>`; };
    el.innerHTML = (syms.length ? `<table class="mktab"><thead><tr><th>Mã</th><th data-tip="Lệnh khớp từng lệnh, đã gom thành nến 1 phút có tách mua/bán chủ động và lệnh cá voi; kèm footprint 5 phút và danh sách lệnh lớn">Lệnh khớp</th><th data-tip="OI và tỷ lệ long/short top trader, mọi tài khoản, theo 5 phút">OI và long/short (ngày)</th><th data-tip="Độ sâu sổ lệnh trong ±1%, ±2%, ±5% quanh giá">Độ sâu sổ (ngày)</th><th>Bước footprint</th><th>Dung lượng</th></tr></thead><tbody>${syms.map(row).join("")}</tbody></table>` : `<p class="small">Kho đang trống. Nhập mã rồi bấm Tải về.</p>`) +
      `<div class="bkrow"><label class="small">Mã <input id="sgStSyms" type="text" value="${esc(syms.length ? syms.map(x => x[0]).join(", ") : "BTCUSDT, ETHUSDT")}" spellcheck="false" style="width:180px"></label><label class="small">Số ngày <input id="sgStDays" type="number" min="1" max="1100" value="365" style="width:70px"></label><button class="tool" id="sgStGo" ${job.running ? "disabled" : ""}>⬇ Tải về / cập nhật</button><span class="small ${job.errors && job.errors.length ? "warn" : "muted"}" id="sgStJob">${esc(jobText(job))}</span></div>` +
      `<p class="muted small">Nguồn: data.binance.vision (Binance công bố miễn phí, số của mỗi ngày có từ hôm sau). Ngày đã tải sẽ được bỏ qua. BTC khoảng vài chục MB mỗi tháng sau khi gom.</p>`;
    $("sgStGo").onclick = async () => {
      const symbols = $("sgStSyms").value.toUpperCase().split(/[\s,]+/).filter(Boolean), days = +$("sgStDays").value || 365;
      try { const r = await startFetch(symbols, days); if (!r.started) toast("Đang có lượt tải khác chạy", true); watch(); } catch (e) { toast(`Không bắt đầu tải được: ${e.message}`, true); }
      renderStore();
    };
    if (job.running) watch();
  }
  function jobText(j) {
    if (!j || (!j.running && !j.finished)) return "";
    if (j.running) return `Đang tải ${j.sym || ""} ${j.kind || ""} ${j.day || ""} · ${j.done || 0}/${j.total || "?"}${j.msg ? " · " + j.msg : ""}`;
    return `Lượt tải xong lúc ${fmtTime(j.finished)}${j.errors && j.errors.length ? ` · ${j.errors.length} lỗi: ${j.errors.slice(-2).join("; ")}` : ""}`;
  }
  function watch() {
    if (poll) return;
    poll = setInterval(async () => {
      const st = await storeStatus(); if (!st) return;
      const el = $("sgStJob"); if (el) el.textContent = jobText(st.job);
      if (!st.job || !st.job.running) { clearInterval(poll); poll = null; renderStore(); }
    }, 2000);
  }

  // ---------- chạy chấm điểm ----------
  async function run() {
    if (busy) return; busy = true;
    const sym = (ui.sym || S.symbol).toUpperCase(), tf = ui.tf, tfMs = INTERVALS[tf], ex = S.ex;
    const say = t => { $("sgStatus").textContent = t; };
    $("sgRun").disabled = true;
    try {
      if (store === null) store = await storeStatus();
      const hist = await loadHistory({ ex, symbol: sym, tf, days: ui.days, store, onStatus: say });
      if (hist.bars.length < 100) throw new Error(`chỉ có ${hist.bars.length} nến, chưa đủ để chấm`);
      say("Đang tìm tín hiệu trong lịch sử…");
      await new Promise(r => setTimeout(r, 0));
      const bars = prepBars(hist.bars), horizons = horizonsFor(tfMs);
      const step = hist.fpStep || 0;
      const found = detectAll(bars, { tfMs, step });
      const live = placeEvents(await liveEvents(sym), bars, tfMs);
      say("Đang chấm điểm…");
      let news = [];
      try { news = ((await getJson(`data/calendar.json?t=${Math.floor(Date.now() / 6e5)}`)).events || []).filter(e => e.impact === "High").map(e => e.t); } catch { /* không có lịch */ }
      const zl = liveSources(sym), flip = (zl.find(x => x.kind === "flip") || {}).price || null;
      const tags = contextSeries(bars, { tfMs, news, gammaFlip: flip, liveFrom: Date.now() - 3 * tfMs });
      const scored = scoreEvents([...found, ...live], bars, { horizons, feePct: ui.fee, slipBps: ui.slip });
      const base = baseline(bars, horizons), card = scorecard(scored, horizons, base);
      const hMain = horizons.includes(ui.h) ? ui.h : horizons[Math.min(1, horizons.length - 1)];
      res = { sym, tf, tfMs, ex, hist, bars, horizons, hMain, scored, base, card, tags, live: live.length, at: Date.now(), dec: decimalsFor(bars.at(-1).c / 1e4) };
      saveVerified();
      say(`${hist.src} · ${bars.length.toLocaleString("vi-VN")} nến ${tf} từ ${new Date(bars[0].t).toLocaleDateString("vi-VN")} · ${scored.length.toLocaleString("vi-VN")} tín hiệu (${live.length} ghi trực tiếp)${hist.note ? " · " + hist.note : ""}`);
      render(); renderPlan();
    } catch (e) { say(`Lỗi: ${e.message}`); }
    busy = false; $("sgRun").disabled = false;
  }
  function saveVerified() {
    try {
      const all = JSON.parse(localStorage.getItem(VERIFIED_KEY) || "{}"), m = {};
      for (const row of res.card) {
        const ctx = byContext(row.list, res.tags, res.hMain, res.base).flatMap(g => g.rows.filter(r => r.st.verdict === "edge").map(r => `${g.key}=${r.v}`));
        const st = row.h[res.hMain];
        m[row.sig] = { all: st.verdict, ctx, n: st.n, hit: st.hit.p, net: st.net.mean, h: fmtH(res.hMain, res.tfMs) };
      }
      all[res.sym] = { ...m, _at: res.at, _tf: res.tf };
      localStorage.setItem(VERIFIED_KEY, JSON.stringify(all));
    } catch { /* bỏ qua */ }
  }

  // ---------- vẽ sổ tín hiệu ----------
  function render() {
    if (!res) return;
    const { card, horizons, hMain, tfMs } = res;
    $("sgH").innerHTML = horizons.map(h => `<option value="${h}" ${h === hMain ? "selected" : ""}>${fmtH(h, tfMs)}</option>`).join("");
    const head = `<tr><th>Tín hiệu</th><th data-tip="Số lần đã đủ thời gian để chấm ở mốc chính">Lần</th>${horizons.map(h => `<th data-tip="Kỳ vọng mỗi lần sau phí, đơn vị ATR, và tỷ lệ giá đi đúng hướng sau ${fmtH(h, tfMs)}">${fmtH(h, tfMs)}${h === hMain ? " ★" : ""}</th>`).join("")}<th data-tip="Khoảng tin cậy 95% của kỳ vọng sau phí ở mốc chính">KTC 95%</th><th data-tip="Kỳ vọng trước phí trừ đi mức giá tự trôi cùng hướng (vào ngẫu nhiên ở mọi nến)">Hơn nền</th><th data-tip="Kỳ vọng sau phí của 30% sự kiện gần nhất, phần không dùng để đánh giá">30% cuối</th><th>Kết luận</th></tr>`;
    let group = "", rows = "";
    for (const r of card) {
      const sg = SIGNALS[r.sig] || { name: r.sig, group: "Khác" }, m = r.h[hMain];
      if (sg.group !== group) { group = sg.group; rows += `<tr class="grp"><td colspan="${horizons.length + 6}">${esc(group)}</td></tr>`; }
      const V = VERDICT[m.verdict];
      rows += `<tr class="click ${ui.sel === r.sig ? "sel" : ""}" data-sig="${esc(r.sig)}"><td class="t" data-tip="${esc(sg.tip || "")}">${esc(sg.name)}</td><td>${m.n}${m.pending ? `<small class="muted"> +${m.pending}</small>` : ""}</td>` +
        horizons.map(h => { const x = r.h[h]; return `<td class="${x.n >= 30 ? cls(x.net.mean) : "muted"}">${sgn(x.net.mean)}<br><small>${pc(x.hit.p)}</small></td>`; }).join("") +
        `<td class="small">${sgn(m.net.lo)} … ${sgn(m.net.hi)}</td><td class="${cls(m.edge)}">${sgn(m.edge)}</td><td class="${cls(m.oos.mean)}">${sgn(m.oos.mean)}<br><small class="muted">${m.oosN} lần</small></td><td class="${V.cls}"><b>${V.name}</b></td></tr>`;
    }
    const missing = Object.entries(SIGNALS).filter(([k, v]) => !card.some(r => r.sig === k) && v.need !== "bars").map(([, v]) => v);
    const have = { flow: res.hist.flow, metrics: res.hist.metrics };
    const why = nd => (have[nd] ? "Chưa xuất hiện lần nào trong giai đoạn này" : { flow: "Cần kho lịch sử trên laptop", metrics: "Cần OI và tỷ lệ long/short", live: "Ghi khi đang xem Terminal" }[nd]);
    const miss = [...new Set(missing.map(v => v.need))].map(nd => `${why(nd)}: ${missing.filter(v => v.need === nd).map(v => v.name).join(", ")}`);
    $("sgCard").innerHTML = `<div class="tablewrap sgwrap"><table class="mktab sgtab"><thead>${head}</thead><tbody>${rows || `<tr><td colspan="9" class="muted">Không tìm thấy tín hiệu nào.</td></tr>`}</tbody></table></div>` +
      (miss.length ? `<p class="muted small">Chưa có trong lần chấm này. ${miss.map(esc).join(" · ")}. Đã ghi trực tiếp trên máy này ${eventCount()} sự kiện.</p>` : "");
    renderDetail();
  }

  function renderDetail() {
    const el = $("sgDetail");
    const row = res && res.card.find(r => r.sig === ui.sel);
    if (!row) { el.innerHTML = `<p class="muted small">Bấm vào một tín hiệu để xem nó chạy tốt trong bối cảnh nào.</p>`; return; }
    const { hMain, tfMs, horizons, dec } = res, sg = SIGNALS[row.sig] || { name: row.sig };
    const ctx = byContext(row.list, res.tags, hMain, res.base);
    const ctxHtml = ctx.map(g => `<div class="sgctx"><div class="mh">${esc(g.name)}</div><table class="mktab"><tbody>${g.rows.map(r => `<tr><td class="t">${esc(r.name)}</td><td>${r.st.n}</td><td class="${r.st.n >= 15 ? cls(r.st.net.mean) : "muted"}">${sgn(r.st.net.mean)}</td><td>${pc(r.st.hit.p)}</td><td class="${VERDICT[r.st.verdict].cls}">${VERDICT[r.st.verdict].name}</td></tr>`).join("")}</tbody></table></div>`).join("");
    const recent = row.list.slice().sort((a, b) => b.t - a.t).slice(0, 25);
    el.innerHTML = `<h4>${esc(sg.name)} <small class="muted">mốc ${fmtH(hMain, tfMs)}, kỳ vọng sau phí theo ATR</small></h4>` +
      (ctxHtml ? `<div class="sgctxs">${ctxHtml}</div>` : `<p class="muted small">Chưa đủ dữ liệu để tách theo bối cảnh.</p>`) +
      `<div class="mh">Các lần gần nhất</div><div class="tablewrap"><table class="mktab"><thead><tr><th>Lúc</th><th>Hướng</th><th>Giá</th>${horizons.map(h => `<th>${fmtH(h, tfMs)}</th>`).join("")}<th>Bối cảnh</th></tr></thead><tbody>${recent.map(e => `<tr><td>${fmtTime(e.t, true)}</td><td class="${e.dir > 0 ? "pos" : "neg"}">${e.dir > 0 ? "Lên" : "Xuống"}</td><td>${(+e.price).toFixed(dec)}</td>${horizons.map(h => `<td class="${e.r[h] ? cls(e.r[h].net) : "muted"}">${e.r[h] ? sgn(e.r[h].net) : "chờ"}</td>`).join("")}<td class="small muted">${esc(Object.values(res.tags[e.i] || {}).length ? tagShort(res.tags[e.i]) : "")}</td></tr>`).join("")}</tbody></table></div>`;
  }
  const tagShort = t => [t.session && { asia: "Á", eu: "Âu", us: "Mỹ", off: "ngoài giờ" }[t.session], t.vol && `biến động ${({ low: "thấp", mid: "vừa", high: "cao" })[t.vol]}`, t.trend && ({ up: "xu hướng lên", down: "xu hướng xuống", range: "đi ngang" })[t.trend]].filter(Boolean).join(", ");

  // ---------- kế hoạch phiên ----------
  let plan = null;
  function renderPlan() {
    const el = $("sgPlan");
    if (!res) { el.innerHTML = `<p class="muted small">Bấm Chấm điểm để soạn kế hoạch.</p>`; return; }
    const { bars, tags, card, hMain, base, scored, dec, sym, tfMs } = res, i = bars.length - 1;
    const tagNow = { ...tags[i] };
    if (tagNow.news) delete tagNow.news;
    const zones = liveZones(bars.slice(-Math.round(10 * 864e5 / tfMs)), liveSources(sym));
    const edges = edgesFor(card, tags, tagNow, hMain, base);
    let news = [];
    try { news = (window.__llCalendar || []).filter(e => e.impact === "High"); } catch { /* bỏ qua */ }
    const verdictOf = sig => { const r = card.find(x => x.sig === sig); return r ? r.h[hMain].verdict : null; };
    plan = buildPlan({ sym, price: bars[i].c, dec, tagNow, zones, edges, news, recent: scored.map(e => ({ ...e, verdict: verdictOf(e.sig) })), hName: fmtH(hMain, tfMs) });
    el.innerHTML = `<div class="plan">${plan.sections.map(s => `<div class="plansec"><div class="mh">${esc(s.name)}</div><ul class="readout">${s.items.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div><p class="muted small">Soạn lúc ${fmtTime(plan.at, true)} từ ${esc(res.tf)} · phiên tiếp theo app tự soạn lại khi tab này đang mở${alerts && alerts.tg && alerts.tg.on ? " và có thể tự gửi Telegram" : ""}.</p>`;
  }
  async function loadCalendar() {
    try { window.__llCalendar = (await getJson(`data/calendar.json?t=${Math.floor(Date.now() / 6e5)}`)).events || []; } catch { window.__llCalendar = []; }
  }

  // ---------- điều khiển ----------
  $("sgSym").value = ui.sym || ""; $("sgSym").placeholder = S.symbol;
  $("sgTf").innerHTML = TFS.map(t => `<option ${t === ui.tf ? "selected" : ""}>${t}</option>`).join("");
  $("sgDays").value = ui.days; $("sgFee").value = ui.fee; $("sgSlip").value = ui.slip; $("sgAutoTg").checked = ui.autoTg;
  const read = () => { ui.sym = $("sgSym").value.trim().toUpperCase(); ui.tf = $("sgTf").value; ui.days = Math.max(7, Math.min(ui.tf === "5m" ? 60 : 1100, +$("sgDays").value || 180)); ui.fee = +$("sgFee").value || 0; ui.slip = +$("sgSlip").value || 0; saveUi(); };
  $("sgRun").onclick = () => { read(); run(); };
  for (const id of ["sgTf", "sgDays"]) $(id).onchange = () => { read(); run(); };
  for (const id of ["sgFee", "sgSlip"]) $(id).onchange = () => { read(); if (res) { const card = scoreEvents(res.scored, res.bars, { horizons: res.horizons, feePct: ui.fee, slipBps: ui.slip }); res.scored = card; res.card = scorecard(card, res.horizons, res.base); saveVerified(); render(); renderPlan(); } };
  $("sgH").onchange = () => { ui.h = +$("sgH").value; saveUi(); if (res) { res.hMain = ui.h; saveVerified(); render(); renderPlan(); } };
  $("sgCard").onclick = e => { const tr = e.target.closest("[data-sig]"); if (!tr) return; ui.sel = tr.dataset.sig; saveUi(); render(); };
  $("sgPlanRe").onclick = async () => { await loadCalendar(); renderPlan(); };
  $("sgPlanTg").onclick = () => {
    if (!plan) return toast("Chưa có kế hoạch", true);
    if (!alerts || !alerts.tg || !alerts.tg.token) return toast("Chưa cài Telegram (nút 🔔)", true);
    alerts.telegram(planText(plan), true); toast("Đã gửi kế hoạch qua Telegram");
  };
  $("sgAutoTg").onchange = () => { ui.autoTg = $("sgAutoTg").checked; saveUi(); };
  // sang phiên mới: soạn lại kế hoạch (và gửi Telegram nếu bật)
  setInterval(async () => {
    const s = sessionWindow().id; if (s === lastSession) return; lastSession = s;
    if (!visible && !ui.autoTg) return;
    await loadCalendar(); await run();
    if (ui.autoTg && plan && alerts && alerts.tg && alerts.tg.on) alerts.telegram(planText(plan), true);
  }, 60e3);

  return {
    async show() { visible = true; await loadCalendar(); renderStore(); if (!res || res.sym !== (ui.sym || S.symbol).toUpperCase()) run(); else { render(); renderPlan(); } },
    hide() { visible = false; },
    refreshPlan() { if (res) renderPlan(); },
  };
}
