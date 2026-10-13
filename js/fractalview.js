// Lai Long Web: trang FRACTAL (giao diện). Phần tính toán nằm trong fractal.js.
import { HOLDS, buildIndex, search, summarize, paths, quantiles, walkForward, sampleLevel, breakeven } from "./fractal.js?v=202610132049";
import { T, alpha } from "./theme.js?v=202610132049";
import { fitCanvas, MONO, INTERVALS, fmtDate, decimalsFor } from "./util.js?v=202610132049";

const TFS = ["5m", "15m", "1h", "4h", "1d"];
const TREND = { 1: "H1 tăng", 0: "H1 ngang", "-1": "H1 giảm" }, POS = ["đáy H4", "giữa H4", "đỉnh H4"];
const holdLabel = ms => ms < 36e5 ? `${Math.round(ms / 60e3)} phút` : `${+(ms / 36e5).toFixed(1)} giờ`;
const sgn = (x, d = 2) => (x >= 0 ? "+" : "") + x.toFixed(d);
const pct = x => isFinite(x) ? (x * 100).toFixed(1) + "%" : "-";

// ---------- biểu đồ quạt ----------
export class FractalChart {
  constructor(cv) {
    this.cv = cv; this.S = fitCanvas(cv, () => this.draw()); this.data = null; this.mouse = null;
    cv.addEventListener("mousemove", e => { const r = cv.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; this.draw(); });
    cv.addEventListener("mouseleave", () => { this.mouse = null; this.draw(); });
    window.addEventListener("lailong-theme", () => this.draw());
  }
  set(d) { this.data = d; this.draw(); }
  _geo() {
    const d = this.data, { w, h } = this.S, L0 = 46, R0 = 64, T0 = 22, B0 = 24;
    const all = [d.cur, ...d.q].flat().filter(v => v != null);
    let lo = Math.min(-d.sl * 1.2, ...all), hi = Math.max(d.tp * 1.2, ...all); const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const n = d.L - 1 + d.H, x = k => L0 + (k + d.L - 1) / n * (w - L0 - R0), y = v => T0 + (hi - v) / (hi - lo) * (h - T0 - B0);
    return { L0, R0, T0, B0, w, h, lo, hi, n, x, y, kAt: px => Math.round((px - L0) / (w - L0 - R0) * n) - (d.L - 1) };
  }
  draw() {
    const { ctx, w, h } = this.S, d = this.data;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h);
    ctx.font = `11px ${MONO}`; ctx.textBaseline = "middle";
    if (!d) { ctx.fillStyle = T.muted; ctx.textAlign = "center"; ctx.fillText("Bấm \"Tìm mẫu lúc này\" để xem các lần giống trước đây, giá đã đi thế nào", w / 2, h / 2); return; }
    const g = this._geo(), { x, y } = g;
    // lưới ATR
    ctx.textAlign = "right";
    for (let v = Math.ceil(g.lo); v <= Math.floor(g.hi); v++) {
      ctx.strokeStyle = v === 0 ? alpha(T.text, 0.35) : T.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.L0, y(v)); ctx.lineTo(w - g.R0, y(v)); ctx.stroke();
      ctx.fillStyle = T.muted; ctx.fillText(`${v > 0 ? "+" : ""}${v} ATR`, g.L0 - 4, y(v));
    }
    // chốt lời / cắt lỗ của lệnh LONG
    const hl = (v, col, text) => { ctx.setLineDash([5, 4]); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x(0), y(v)); ctx.lineTo(w - g.R0, y(v)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = col; ctx.textAlign = "left"; ctx.fillText(text, w - g.R0 + 4, y(v)); };
    hl(d.tp, T.up, `+${d.tp} ATR`); hl(-d.sl, T.down, `−${d.sl} ATR`);
    // từng mẫu
    const line = (p, from, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); let on = false; p.forEach((v, idx) => { if (v == null) { on = false; return; } const k = idx - (d.L - 1) + from; on ? ctx.lineTo(x(k), y(v)) : ctx.moveTo(x(k), y(v)); on = true; }); ctx.stroke(); };
    for (const p of d.paths) { const f = p[p.length - 1]; line(p, 0, alpha(f == null ? T.muted : f > 0 ? T.up : T.down, 0.13), 1); }
    // dải 10–90% và 25–75%
    const band = (a, b, al) => {
      ctx.fillStyle = alpha(T.accent, al); ctx.beginPath(); let first = true;
      for (let k = 0; k <= d.H; k++) { const v = a[k + d.L - 1]; if (v == null) continue; first ? ctx.moveTo(x(k), y(v)) : ctx.lineTo(x(k), y(v)); first = false; }
      for (let k = d.H; k >= 0; k--) { const v = b[k + d.L - 1]; if (v != null) ctx.lineTo(x(k), y(v)); }
      ctx.closePath(); ctx.fill();
    };
    band(d.q[0], d.q[4], 0.10); band(d.q[1], d.q[3], 0.20);
    line(d.q[2].map((v, i) => (i < d.L - 1 ? null : v)), 0, T.accent, 2.5);
    // mẫu hiện tại
    line(d.cur, 0, T.text, 2.5);
    ctx.strokeStyle = alpha(T.text, 0.5); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x(0), g.T0); ctx.lineTo(x(0), h - g.B0); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = T.text; ctx.textAlign = "center"; ctx.fillText("BÂY GIỜ", x(0), g.T0 - 10);
    // trục thời gian
    ctx.fillStyle = T.muted;
    const ticks = [-(d.L - 1), 0, Math.round(d.H / 2), d.H];
    for (const k of ticks) ctx.fillText(k === 0 ? "0" : (k < 0 ? "−" : "+") + holdLabel(Math.abs(k) * d.baseMs), x(k), h - g.B0 + 12);
    ctx.textAlign = "right"; ctx.fillStyle = T.muted;
    if (w > 760) ctx.fillText(`Trắng: ${d.L} nến gần nhất · Cam: trung vị ${d.paths.length} mẫu · Dải: 50% và 80% ở giữa`, w - g.R0 - 4, h - g.B0 - 8);
    if (this.mouse) {
      const k = Math.max(-(d.L - 1), Math.min(d.H, g.kAt(this.mouse.x)));
      ctx.strokeStyle = alpha(T.text, 0.3); ctx.beginPath(); ctx.moveTo(x(k), g.T0); ctx.lineTo(x(k), h - g.B0); ctx.stroke();
    }
  }
  hitTest(px) {
    const d = this.data; if (!d) return null;
    const g = this._geo(), k = Math.max(-(d.L - 1), Math.min(d.H, g.kAt(px))), idx = k + d.L - 1, q = d.q.map(a => a[idx]);
    if (k <= 0) return `${k === 0 ? "Nến vừa đóng cửa" : `${-k} nến trước`}: giá hiện tại ${sgn(d.cur[idx] ?? 0)} ATR so với bây giờ. Đường trắng là ${d.L} nến gần nhất, các đường mờ là ${d.paths.length} mẫu giống nhất đã được căn cùng điểm "bây giờ".`;
    if (q[2] == null) return null;
    return `Sau ${k} nến (${holdLabel(k * d.baseMs)}): trung vị ${sgn(q[2])} ATR, 50% ở giữa từ ${sgn(q[1])} đến ${sgn(q[3])} ATR, 80% ở giữa từ ${sgn(q[0])} đến ${sgn(q[4])} ATR.`;
  }
}

// ---------- trang ----------
export function initFractal({ $, S, ex, esc, table, log }) {
  const chart = new FractalChart($("frChart"));
  const cache = new Map();
  let last = null; // lần tìm gần nhất
  const opt = () => {
    const tf = $("frTf").value, holdMs = +$("frHold").value, baseMs = INTERVALS[tf];
    return {
      tf, baseMs, holdMs, L: +$("frL").value, H: Math.max(1, Math.round(holdMs / baseMs)), tp: +$("frTp").value, sl: +$("frSl").value,
      K: +$("frK").value, n: Math.min(90000, Math.max(3000, +$("frBars").value || 30000)), sameCtx: $("frCtx").checked, multi: $("frMulti").checked,
      fee: +$("frFee").value, slip: +$("frSlip").value, costPct: 2 * ((+$("frFee").value || 0) / 100 + (+$("frSlip").value || 0) / 1e4),
    };
  };
  const status = t => { $("frStatus").textContent = t; };
  async function load(tf, n) {
    const k = `${S.ex}:${S.symbol}:${tf}:${n}`;
    if (cache.has(k) && Date.now() - cache.get(k).t < 5 * 60e3) return cache.get(k).bars;
    let bars = await ex().klines(S.symbol, tf, n);
    const ms = INTERVALS[tf], now = Date.now();
    bars = bars.filter(b => b.t + ms <= now); // bỏ nến đang chạy: chỉ dùng nến đã đóng cửa
    cache.set(k, { t: Date.now(), bars }); return bars;
  }
  async function prepare(o) {
    status(`Đang tải ${o.n.toLocaleString("vi-VN")} nến ${o.tf} ${S.symbol} từ ${ex().name}...`);
    const base = await load(o.tf, o.n);
    if (base.length < o.L + o.H + 200) throw new Error(`chỉ có ${base.length} nến, quá ít để so`);
    const libs = [buildIndex(base, { L: o.L, intervalMs: o.baseMs, label: o.tf })];
    if (o.multi) for (const tf of TFS.slice(TFS.indexOf(o.tf) + 1, TFS.indexOf(o.tf) + 3)) {
      status(`Đang tải thêm nến ${tf} để tìm cùng hình ở khung lớn hơn...`);
      try { const b = await load(tf, Math.min(o.n, 20000)); if (b.length > o.L + o.H + 100) libs.push(buildIndex(b, { L: o.L, intervalMs: INTERVALS[tf], label: tf })); }
      catch (e) { log?.(`FRACTAL: không tải được ${tf}: ${e.message}`); }
    }
    return libs;
  }

  $("frRun").onclick = async () => {
    const o = opt(); $("frRun").disabled = $("frValidate").disabled = true;
    try {
      const libs = await prepare(o), ix = libs[0], qi = ix.bars.length - 1;
      if (!ix.valid[qi]) throw new Error("nến cuối chưa đủ dữ liệu để mô tả");
      status("Đang so với lịch sử...");
      await new Promise(r => setTimeout(r, 20));
      const m = search({ ix, i: qi }, libs, { K: o.K, H: o.H, sameCtx: o.sameCtx });
      const st = summarize(m, { H: o.H, tp: o.tp, sl: o.sl, costPct: o.costPct, holds: HOLDS, baseMs: o.baseMs });
      last = { o, libs, ix, qi, m, st };
      render(last);
      status(`Xong: so ${libs.map(l => `${l.bars.length.toLocaleString("vi-VN")} nến ${l.label}`).join(", ")}. Mẫu ${o.tf} từ ${fmtDate(ix.bars[0].t)} đến ${fmtDate(ix.bars[qi].t)}.`);
    } catch (e) { status(`Lỗi: ${e.message}`); }
    $("frRun").disabled = $("frValidate").disabled = false;
  };

  $("frValidate").onclick = async () => {
    const o = opt(); $("frRun").disabled = $("frValidate").disabled = true;
    try {
      const ix = last && JSON.stringify(last.o) === JSON.stringify(o) && last.sym === `${S.ex}:${S.symbol}` ? last.ix : (await prepare(o))[0];
      status("Đang kiểm chứng ngoài mẫu: chỉ dùng quá khứ của từng điểm thử...");
      const wf = await walkForward(ix, { K: o.K, H: o.H, tp: o.tp, sl: o.sl, costPct: o.costPct, sameCtx: o.sameCtx, onProgress: (a, b) => status(`Đang kiểm chứng ngoài mẫu... ${Math.min(100, Math.round(a / b * 100))}%`) });
      if (!wf) throw new Error("không đủ dữ liệu cho phần ngoài mẫu");
      renderValid(wf, o);
      status(`Kiểm chứng xong: ${wf.tests} điểm thử từ ${fmtDate(wf.from)} đến ${fmtDate(wf.to)}.`);
    } catch (e) { status(`Lỗi: ${e.message}`); }
    $("frRun").disabled = $("frValidate").disabled = false;
  };

  function render({ o, ix, qi, m, st }) {
    last.sym = `${S.ex}:${S.symbol}`;
    const a = ix.atr[qi], px = ix.bars[qi].c, dec = decimalsFor(Math.abs(px) / 1e5), hl = holdLabel(o.H * o.baseMs);
    const card = (g, k, v, cls = "") => `<div class="stat" ${g ? `data-g="${g}"` : ""}><span>${k}</span><b class="${cls}">${v}</b></div>`;
    const byTf = {}; for (const x of m) byTf[x.lib.label] = (byTf[x.lib.label] || 0) + 1;
    const sideCard = s => { const x = st[s]; return card("fr-rule", `${s.toUpperCase()} thắng (95%)`, x.n ? `${pct(x.ci.p)} <small>${pct(x.ci.lo)}–${pct(x.ci.hi)}</small>` : "-", x.n && x.ci.lo > st.breakeven ? "pos" : "") + card("fr-rule", `${s.toUpperCase()} kỳ vọng / lệnh`, x.n ? `${sgn(x.expR)} R` : "-", x.expR > 0 ? "pos" : "neg"); };
    $("frStats").innerHTML =
      card("fr-sample", "Số mẫu", `${st.n} <small class="${st.level.cls}">${st.level.label}</small>`) +
      card("fractal", "Theo khung", Object.entries(byTf).map(([k, v]) => `${k} ${v}`).join(" · ") || "-") +
      card("", `Giá cao hơn sau ${hl}`, st.n ? (st.up / st.n * 100).toFixed(0) + "%" : "-") +
      card("atr", `Trung vị sau ${hl}`, isFinite(st.median) ? `${sgn(st.median)} ATR` : "-", st.median > 0 ? "pos" : "neg") +
      sideCard("long") + sideCard("short") +
      card("fr-cost", "Cần thắng để hoà vốn", `${pct(st.breakeven)} <small>phí ${st.costR.toFixed(2)} R/lệnh</small>`) +
      card("fr-sample", "Kết luận", st.edge ? `Nghiêng ${st.edge.toUpperCase()}` : "Chưa có lợi thế", "txt " + (st.edge === "long" ? "pos" : st.edge === "short" ? "neg" : ""));
    const ps = paths(m, o.L, o.H), cur = []; for (let k = qi - o.L + 1; k <= qi; k++) cur.push((ix.bars[k].c - px) / a);
    chart.set({ cur, paths: ps, q: quantiles(ps), L: o.L, H: o.H, tp: o.tp, sl: o.sl, baseMs: o.baseMs });
    const ctxNow = ix.ctx.trend[qi] == null ? "chưa đủ nến H1/H4" : `${TREND[ix.ctx.trend[qi]]}, ${POS[ix.ctx.pos[qi]]}`;
    const verdict = st.n < 30 ? `Mới có ${st.n} mẫu, chưa đủ 30 nên chưa kết luận được. Thử tắt lọc bối cảnh, tăng số nến lịch sử hoặc bật tìm ở khung lớn hơn.`
      : st.edge ? `Trong ${st.n} lần giống trước đây, vào ${st.edge.toUpperCase()} theo luật này thắng ${pct(st[st.edge].ci.p)} (95% chắc chắn nằm trong ${pct(st[st.edge].ci.lo)} đến ${pct(st[st.edge].ci.hi)}), cao hơn mức hoà vốn ${pct(st.breakeven)}, kỳ vọng ${sgn(st[st.edge].expR)} R mỗi lệnh sau phí. Vẫn cần xem kiểm chứng ngoài mẫu trước khi tin.`
      : `Trong ${st.n} lần giống trước đây, cả LONG lẫn SHORT đều chưa vượt mức hoà vốn ${pct(st.breakeven)} một cách chắc chắn. Nghĩa là hình này không cho lợi thế rõ với luật chốt lời ${o.tp} ATR, cắt lỗ ${o.sl} ATR trong ${hl}.`;
    $("frHolds").hidden = false;
    $("frHolds").innerHTML = `<h3>Sau đó giá đã đi đâu? <button class="q" data-g="fractal">?</button> <small>${esc(S.symbol)} · ${o.tf} · ${o.L} nến · bối cảnh bây giờ: ${ctxNow} · 1 ATR lúc này ≈ ${a.toFixed(dec)} (${(a / px * 100).toFixed(2)}%)</small></h3>` +
      `<p class="note">${verdict}</p>` +
      table(["Thời gian giữ", ["Số mẫu", "fr-sample"], "Giá cao hơn", ["Trung vị", "atr"], "50% ở giữa"],
        st.holds.map(h => `<tr><td class="t">${h.label}</td><td>${h.n} <small class="${sampleLevel(h.n).cls}">${sampleLevel(h.n).label}</small></td><td>${isFinite(h.upPct) ? h.upPct.toFixed(0) + "%" : "-"}</td><td class="${h.median >= 0 ? "pos" : "neg"}">${isFinite(h.median) ? sgn(h.median) + " ATR" : "-"}</td><td>${isFinite(h.q1) ? `${sgn(h.q1)} đến ${sgn(h.q3)} ATR` : "-"}</td></tr>`), "Chưa có mẫu.") +
      `<p class="note">Bạn giữ lệnh từ dưới 30 phút đến tối đa 48 giờ, nên bảng cho cả 4 mốc. Mẫu ở khung lớn hơn được tính cùng số nến (cùng hình thì cùng nhịp, chỉ khác cỡ).</p>`;
    const res = r => r ? `<span class="${r.r === "win" ? "pos" : r.r === "loss" ? "neg" : "muted"}">${r.r === "win" ? "Thắng" : r.r === "loss" ? "Thua" : "Hết giờ"} ${sgn(r.R)}R</span>` : "-";
    $("frMatches").hidden = false;
    $("frMatches").innerHTML = `<h3>${Math.min(30, m.length)} mẫu giống nhất <small>trong ${m.length} mẫu đã dùng</small></h3>` +
      table(["#", "Khung", "Lúc kết thúc mẫu", ["Độ giống", "fractal"], ["Bối cảnh", "fr-context"], `Sau ${hl}`, "LONG", "SHORT"],
        m.slice(0, 30).map((x, k) => { const c = x.lib.ctx; return `<tr><td>${k + 1}</td><td>${x.lib.label}</td><td>${fmtDate(x.lib.bars[x.j].t + x.lib.intervalMs)}</td><td>${(100 / (1 + Math.sqrt(x.d))).toFixed(0)}%</td><td class="t">${c.trend[x.j] == null ? "-" : `${TREND[c.trend[x.j]]}, ${POS[c.pos[x.j]]}`}</td><td class="${x.out && x.out.final >= 0 ? "pos" : "neg"}">${x.out ? sgn(x.out.final) + " ATR" : "-"}</td><td>${res(x.out && x.out.long)}</td><td>${res(x.out && x.out.short)}</td></tr>`; }), "Không tìm thấy mẫu nào. Thử tắt lọc bối cảnh.");
    help(o, a, px, dec);
  }

  function renderValid(wf, o) {
    const r = wf.res, hl = holdLabel(o.H * o.baseMs), lvl = sampleLevel(r.n);
    const ok = r.n >= 30 && r.avgR > 0 && r.ci.lo > wf.breakeven, better = r.avgR > Math.max(wf.baseLong, wf.baseShort);
    const verdict = r.n < 30 ? `Chỉ có ${r.n} lệnh trên đoạn ngoài mẫu, chưa đủ 30 để kết luận. Tăng số nến lịch sử để có thêm điểm thử.`
      : ok ? `Trên đoạn dữ liệu phương pháp chưa từng thấy, vào lệnh theo mẫu giống nhau thắng ${pct(r.ci.p)} (cận dưới ${pct(r.ci.lo)} vẫn trên mức hoà vốn ${pct(wf.breakeven)}), trung bình ${sgn(r.avgR)} R mỗi lệnh sau phí. Đây là dấu hiệu lợi thế thật với cài đặt này.`
      : `Trên đoạn ngoài mẫu, phương pháp ${better ? "có tốt hơn vào lệnh bừa" : "không tốt hơn vào lệnh bừa"} nhưng chưa chứng minh được lợi thế: cận dưới tỷ lệ thắng ${pct(r.ci.lo)} chưa vượt mức hoà vốn ${pct(wf.breakeven)} hoặc kỳ vọng sau phí chưa dương. Thử đổi luật chốt lời, khung hoặc thời gian giữ.`;
    $("frValid").hidden = false;
    $("frValid").innerHTML = `<h3>Kiểm chứng ngoài mẫu <button class="q" data-g="fr-oos">?</button> <small>${o.tf} · giữ ${hl} · chốt lời ${o.tp} ATR, cắt lỗ ${o.sl} ATR · phí và trượt giá ${(o.costPct * 100).toFixed(2)}% khứ hồi</small></h3>` +
      `<p class="note">${verdict}</p>` +
      table(["", "Số lệnh", "Thắng (95%)", "R trung bình / lệnh", "Tổng R"], [
        `<tr><td class="t">Theo mẫu giống nhau</td><td>${r.n} <small class="${lvl.cls}">${lvl.label}</small></td><td>${pct(r.ci.p)} <small>${pct(r.ci.lo)}–${pct(r.ci.hi)}</small></td><td class="${r.avgR > 0 ? "pos" : "neg"}">${isFinite(r.avgR) ? sgn(r.avgR) : "-"}</td><td>${sgn(r.totalR, 1)}</td></tr>`,
        `<tr><td class="t">· trong đó LONG</td><td>${wf.long.n}</td><td>${pct(wf.long.ci.p)}</td><td>${isFinite(wf.long.avgR) ? sgn(wf.long.avgR) : "-"}</td><td>${sgn(wf.long.totalR, 1)}</td></tr>`,
        `<tr><td class="t">· trong đó SHORT</td><td>${wf.short.n}</td><td>${pct(wf.short.ci.p)}</td><td>${isFinite(wf.short.avgR) ? sgn(wf.short.avgR) : "-"}</td><td>${sgn(wf.short.totalR, 1)}</td></tr>`,
        `<tr><td class="t">So sánh: LONG ở mọi điểm thử</td><td>${wf.tests}</td><td>-</td><td>${sgn(wf.baseLong)}</td><td>-</td></tr>`,
        `<tr><td class="t">So sánh: SHORT ở mọi điểm thử</td><td>${wf.tests}</td><td>-</td><td>${sgn(wf.baseShort)}</td><td>-</td></tr>`,
      ], "") +
      `<p class="note">${wf.tests} điểm thử, cách nhau ${wf.step} nến, từ ${fmtDate(wf.from)} đến ${fmtDate(wf.to)}. Đứng ngoài ${wf.skipped} lần vì mẫu không cho kỳ vọng dương. Mức hoà vốn ${pct(wf.breakeven)} đã tính phí.</p>`;
  }

  function help(o, a, px, dec) {
    const be = breakeven(o.tp, o.sl, 0), atrTxt = a ? ` Lúc này 1 ATR ${o.tf} ≈ ${a.toFixed(dec)}, tức chốt lời cách ${(o.tp * a).toFixed(dec)} và cắt lỗ cách ${(o.sl * a).toFixed(dec)}.` : "";
    $("frHelp").innerHTML = `<h3>Luật kiểm chứng đang dùng</h3><ul class="note">
      <li><b>ATR</b> là biên độ dao động trung bình một nến (14 nến gần nhất). Đo bằng ATR thì cùng một hình so được giữa BTC và vàng, giữa khung 5 phút và 1 giờ.${atrTxt}</li>
      <li><b>Thắng / thua:</b> vào ở giá đóng cửa nến cuối của mẫu. LONG thắng khi giá lên ${o.tp} ATR trước khi xuống ${o.sl} ATR, trong tối đa ${holdLabel(o.H * o.baseMs)} (${o.H} nến). SHORT ngược lại. Nến chạm cả hai tính là thua. Hết giờ thì tính theo giá lúc đó.</li>
      <li><b>Đổi luật:</b> chốt lời ${o.tp} : cắt lỗ ${o.sl} cần thắng ${pct(be)} trước phí. Chốt lời 2 : 1 chỉ cần khoảng 33%, nhưng giá phải đi xa hơn nên thắng ít hơn. Bảng trên cho biết luật nào hợp với hình hiện tại.</li>
      <li><b>Đủ mẫu:</b> dưới 30 chưa nói được gì, từ 100 đủ tin theo thông lệ, từ 300 sai số còn khoảng ±5%. Chỉ gọi là <b>có lợi thế</b> khi cận dưới khoảng tin cậy 95% vẫn trên mức hoà vốn đã tính phí.</li>
      <li><b>Không nhìn trước:</b> chỉ dùng nến đã đóng cửa và những mẫu đã biết kết quả. Bấm <b>Kiểm chứng ngoài mẫu</b> để thử phương pháp trên 30% dữ liệu cuối như giao dịch thật.</li></ul>`;
  }
  help(opt(), 0, 0, 2);
  return { chart };
}
