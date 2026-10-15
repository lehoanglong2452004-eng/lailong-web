// Lai Long Web: trang Nhật ký: quản lý rủi ro, tính khối lượng lệnh, ghi lệnh và thống kê bản thân.
// Dữ liệu chỉ lưu trên trình duyệt của máy này (localStorage); nút Xuất file để sao lưu hoặc chuyển máy.
import { MISTAKES, SETTINGS_DEF, sizeFor, result, guard, journalStats, toCsv } from "./journal.js?v=202610152106";
import { STRATEGIES, STRATEGY_ORDER } from "./strategies.js?v=202610152106";
import { EquityChart } from "./fractalview.js?v=202610152106";
import { fmtVol, fmtDate, decimalsFor } from "./util.js?v=202610152106";

const STORE = "lailong.journal.v1";
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const EMO = [[1, "1 · Rất bình tĩnh"], [2, "2 · Bình tĩnh"], [3, "3 · Bình thường"], [4, "4 · Hồi hộp"], [5, "5 · Rất căng thẳng"]];

export function initJournal({ $, S, esc, table, market, toast }) {
  let db;
  try { db = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { db = null; }
  db = db || { cfg: { ...SETTINGS_DEF }, trades: [], seq: 1 };
  db.cfg = { ...SETTINGS_DEF, ...db.cfg };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch { toast("Trình duyệt không cho lưu, hãy xuất file để giữ dữ liệu", true); } };
  const eq = new EquityChart($("jEq"));
  let editId = null;

  // danh sách chiến lược (MIDOTI nạp sau nên dựng lại mỗi lần mở trang)
  function fillStrats() {
    const cur = $("jStrat").value, names = ["midoti", ...STRATEGY_ORDER].filter((id, i, a) => STRATEGIES[id] && a.indexOf(id) === i).map(id => STRATEGIES[id].short || STRATEGIES[id].name);
    for (const t of db.trades) if (t.strat && !names.includes(t.strat)) names.push(t.strat);
    $("jStrat").innerHTML = [...names, "Order flow / Bookmap", "Khác"].filter((n, i, a) => a.indexOf(n) === i).map(n => `<option>${esc(n)}</option>`).join("");
    if (cur && editId != null) $("jStrat").value = cur;
  }
  fillStrats();
  $("jEmo").innerHTML = `<option value="">-</option>` + EMO.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  $("jMistakes").innerHTML = MISTAKES.map(([k, l]) => `<label><input type="checkbox" value="${k}"> ${l}</label>`).join("");
  const mName = k => (MISTAKES.find(m => m[0] === k) || [k, k])[1];

  // ----- cài đặt tài khoản -----
  for (const inp of document.querySelectorAll("[data-jc]")) {
    inp.value = db.cfg[inp.dataset.jc];
    inp.onchange = () => { const v = parseFloat(inp.value); if (isFinite(v) && v >= 0) db.cfg[inp.dataset.jc] = v; else inp.value = db.cfg[inp.dataset.jc]; save(); render(); };
  }

  // ----- tính khối lượng lệnh -----
  const num = id => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
  function calc() {
    const g = guard(db.trades, db.cfg), dec = decimalsFor(market.tick || 0.01);
    const r = sizeFor({ equity: g.equity, riskPct: db.cfg.riskPct, entry: num("szEntry"), stop: num("szStop"), target: num("szTarget"), fee: db.cfg.fee, lev: num("szLev") || 10, mmr: db.cfg.mmr });
    if (!r) { $("szOut").innerHTML = `<div class="muted">Nhập giá vào và giá cắt lỗ.</div>`; return null; }
    const line = (k, v, cls = "") => `<span>${k}</span><b class="${cls}">${v}</b>`;
    $("szOut").innerHTML = `<div class="kv">` +
      line("Phía", r.side === "long" ? "LONG" : "SHORT", r.side === "long" ? "pos" : "neg") +
      line("Khối lượng", `${fmtVol(r.qty)} ${esc(coinOf($("szSym").value))}`) +
      line("Giá trị lệnh", `${fmtVol(r.notional)} USDT`) +
      line("Rủi ro", `${fmtVol(r.riskUsd)} USDT (${db.cfg.riskPct}%)`) +
      line("Khoảng cắt lỗ", `${r.distPct.toFixed(2)}%`) +
      line("Phí hai chiều", `${fmtVol(r.feeUsd)} USDT`) +
      line("Ký quỹ cần", `${fmtVol(r.margin)} USDT`) +
      line("Giá thanh lý ước tính", r.liq.toFixed(dec), r.stopBeyondLiq ? "neg" : "") +
      (r.rr != null ? line("Lời / lỗ (R:R)", `1 : ${r.rr.toFixed(2)}`, r.rr >= 1.5 ? "pos" : r.rr < 1 ? "neg" : "") : "") +
      `</div>` +
      (r.stopBeyondLiq ? `<div class="jwarn stop">Cắt lỗ nằm sau giá thanh lý: sẽ bị thanh lý trước khi kịp cắt lỗ. Giảm đòn bẩy.</div>` : "") +
      (r.minLev > 3 ? `<div class="jwarn">Giá trị lệnh bằng ${r.minLev.toFixed(1)} lần vốn: cắt lỗ đang quá gần, dễ bị quét bởi nhiễu.</div>` : "");
    return r;
  }
  const coinOf = s => String(s || "").toUpperCase().replace(/USDT$|USD$|USDC$/, "") || "coin";
  for (const id of ["szEntry", "szStop", "szTarget", "szLev", "szSym"]) $(id).oninput = calc;
  $("szNow").onclick = () => { if (market.last) { $("szEntry").value = market.last.p; $("szSym").value = S.symbol; calc(); } else toast("Chưa có giá trực tiếp, mở Terminal trước", true); };
  $("szToJournal").onclick = () => {
    const r = calc(); if (!r) return toast("Nhập giá vào và cắt lỗ trước", true);
    resetForm();
    $("jSym").value = $("szSym").value || S.symbol; $("jSide").value = r.side; $("jEntry").value = $("szEntry").value; $("jStop").value = $("szStop").value;
    $("jTarget").value = $("szTarget").value; $("jQty").value = +r.qty.toPrecision(6); $("jTime").value = localInput(Date.now());
    $("jForm").scrollIntoView({ behavior: "smooth", block: "start" }); $("jReason").focus();
  };

  // ----- thêm / sửa lệnh -----
  const localInput = t => { const d = new Date(t - new Date(t).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
  const fromInput = v => v ? new Date(v).getTime() : null;
  function resetForm() {
    editId = null; $("jSave").textContent = "Lưu lệnh"; $("jCancel").hidden = true;
    for (const id of ["jEntry", "jStop", "jTarget", "jQty", "jExit", "jFee", "jReason", "jNote", "jTExit"]) $(id).value = "";
    $("jSym").value = S.symbol; $("jSide").value = "long"; $("jEmo").value = ""; $("jTime").value = localInput(Date.now());
    for (const cb of $("jMistakes").querySelectorAll("input")) cb.checked = false;
  }
  function fillForm(t) {
    editId = t.id; $("jSave").textContent = "Lưu thay đổi"; $("jCancel").hidden = false;
    $("jTime").value = localInput(t.t); $("jSym").value = t.sym; $("jSide").value = t.side; $("jStrat").value = t.strat;
    for (const [id, k] of [["jEntry", "entry"], ["jStop", "stop"], ["jTarget", "target"], ["jQty", "qty"], ["jExit", "exit"], ["jFee", "fee"], ["jReason", "reason"], ["jNote", "note"]]) $(id).value = t[k] ?? "";
    $("jTExit").value = t.tExit ? localInput(t.tExit) : ""; $("jEmo").value = t.emo || "";
    for (const cb of $("jMistakes").querySelectorAll("input")) cb.checked = (t.mistakes || []).includes(cb.value);
    $("jForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("jSave").onclick = () => {
    const t = {
      id: editId || db.seq++, t: fromInput($("jTime").value) || Date.now(), sym: ($("jSym").value || S.symbol).toUpperCase().trim(), side: $("jSide").value, strat: $("jStrat").value,
      entry: num("jEntry"), stop: num("jStop"), target: num("jTarget"), qty: num("jQty"), exit: num("jExit"), tExit: fromInput($("jTExit").value), fee: num("jFee"),
      emo: +$("jEmo").value || null, mistakes: [...$("jMistakes").querySelectorAll("input:checked")].map(c => c.value), reason: $("jReason").value.trim(), note: $("jNote").value.trim(),
    };
    if (!(t.entry > 0) || !(t.stop > 0) || t.entry === t.stop) return toast("Cần giá vào và giá cắt lỗ (khác nhau) để tính R", true);
    if ((t.side === "long") !== (t.stop < t.entry)) return toast(t.side === "long" ? "Lệnh LONG thì cắt lỗ phải dưới giá vào" : "Lệnh SHORT thì cắt lỗ phải trên giá vào", true);
    if (t.exit > 0 && !t.tExit) t.tExit = Date.now();
    if (t.fee == null && t.qty > 0 && t.exit > 0) t.fee = +((t.entry + t.exit) * t.qty * db.cfg.fee / 100).toFixed(4); // ước tính phí taker hai chiều
    const i = db.trades.findIndex(x => x.id === t.id);
    if (i >= 0) db.trades[i] = t; else db.trades.push(t);
    save(); resetForm(); render(); toast(i >= 0 ? "Đã lưu thay đổi" : "Đã ghi lệnh vào nhật ký");
  };
  $("jCancel").onclick = () => resetForm();
  $("jTrades").onclick = e => {
    const ed = e.target.closest("[data-jedit]"), del = e.target.closest("[data-jdel]");
    if (ed) { const t = db.trades.find(x => x.id === +ed.dataset.jedit); if (t) fillForm(t); }
    if (del) { const t = db.trades.find(x => x.id === +del.dataset.jdel); if (t && confirm(`Xoá lệnh ${t.sym} ${t.side.toUpperCase()} lúc ${fmtDate(t.t)}?`)) { db.trades = db.trades.filter(x => x !== t); save(); render(); } }
  };

  // ----- xuất / nhập -----
  const download = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const stamp = () => new Date().toISOString().slice(0, 10);
  $("jExport").onclick = () => download(`lailong-nhatky-${stamp()}.json`, JSON.stringify(db, null, 1), "application/json");
  $("jCsv").onclick = () => download(`lailong-nhatky-${stamp()}.csv`, "﻿" + toCsv(db.trades), "text/csv");
  $("jImport").onclick = () => $("jFile").click();
  $("jFile").onchange = async () => {
    const f = $("jFile").files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text()); if (!Array.isArray(d.trades)) throw new Error("không phải file nhật ký");
      const wasEmpty = !db.trades.length, have = new Set(db.trades.map(t => `${t.t}|${t.sym}|${t.entry}`)); let add = 0;
      for (const t of d.trades) { const k = `${t.t}|${t.sym}|${t.entry}`; if (have.has(k)) continue; db.trades.push({ ...t, id: db.seq++ }); add++; }
      if (d.cfg && wasEmpty) { db.cfg = { ...SETTINGS_DEF, ...d.cfg }; for (const inp of document.querySelectorAll("[data-jc]")) inp.value = db.cfg[inp.dataset.jc]; }
      save(); render(); toast(`Đã nhập ${add} lệnh mới (bỏ qua ${d.trades.length - add} lệnh trùng)`);
    } catch (e) { toast(`Không đọc được file: ${e.message}`, true); }
    $("jFile").value = "";
  };

  // ----- hiển thị -----
  const sgn = x => (x > 0 ? "+" : "") + x.toFixed(2);
  const cls = x => x > 0 ? "pos" : x < 0 ? "neg" : "";
  const pf = x => isFinite(x) ? x.toFixed(2) : x === Infinity ? "∞" : "-";
  function groupTable(title, gs, label) {
    if (!gs.length) return "";
    return `<h4>${title}</h4>` + table(["Nhóm", "Số lệnh", "Tỷ lệ thắng", "Kỳ vọng (R)", "Tổng R", "PF", "Lãi/lỗ USDT"], gs.map(g => `<tr><td class="t">${esc(label(g.key))}</td><td>${g.n}</td><td>${(g.st.wr * 100).toFixed(0)}%</td><td class="${cls(g.st.avgR)}">${sgn(g.st.avgR)}</td><td class="${cls(g.st.totalR)}">${sgn(g.st.totalR)}</td><td>${pf(g.st.pf)}</td><td class="${cls(g.pnl)}">${fmtVol(g.pnl)}</td></tr>`), "Chưa có lệnh đã đóng.");
  }
  function render() {
    const g = guard(db.trades, db.cfg), js = journalStats(db.trades, db.cfg), st = js.st;
    $("jGuard").innerHTML = `<div class="kv"><span>Vốn hiện tại</span><b>${fmtVol(g.equity)} USDT</b><span>Lãi/lỗ hôm nay</span><b class="${cls(g.dayPnl)}">${fmtVol(g.dayPnl)} / −${fmtVol(g.limitUsd)}</b><span>Lệnh hôm nay</span><b>${g.todayN} / ${db.cfg.maxTrades}</b><span>Rủi ro đang mở</span><b>${fmtVol(g.openRisk)} USDT (${g.openRiskPct.toFixed(1)}%)</b></div>` +
      (g.warn.length ? g.warn.map(w => `<div class="jwarn ${w.lvl}">${esc(w.txt)}</div>`).join("") : `<div class="jok">Trong giới hạn an toàn.</div>`);
    const box = (k, v, c = "", tip = "") => `<div class="stat"${tip ? ` data-tip="${esc(tip)}"` : ""}><span>${k}</span><b class="${c}">${v}</b></div>`;
    $("jStats").innerHTML = st.n ? [
      box("Lệnh đã đóng", `${st.n}`), box("Tỷ lệ thắng", `${(st.wr * 100).toFixed(0)}%`),
      box("Kỳ vọng mỗi lệnh", `${sgn(st.avgR)}R`, cls(st.avgR), "Trung bình mỗi lệnh lời hay lỗ bao nhiêu lần rủi ro"),
      box("Khoảng tin cậy 95%", st.n >= 5 ? `${sgn(st.ci.lo)} … ${sgn(st.ci.hi)}R` : "-", st.ci.lo > 0 ? "pos" : "", "Cận dưới trên 0 thì lợi thế có thật, không phải may mắn. Cần ít nhất khoảng 30 lệnh"),
      box("Profit factor", pf(st.pf)), box("Tổng", `${sgn(st.totalR)}R`, cls(st.totalR)),
      box("Lãi/lỗ", `${fmtVol(js.pnl)} USDT`, cls(js.pnl)), box("Sụt giảm lớn nhất", `${st.maxDDR.toFixed(2)}R`, "neg"),
      box("Chuỗi thua dài nhất", `${st.maxLossStreak}`),
      box("Lệnh không mắc lỗi", js.clean.n ? `${sgn(js.clean.avgR)}R × ${js.clean.n}` : "-", cls(js.clean.avgR), "Kỳ vọng của các lệnh không đánh dấu lỗi nào"),
      box("Lệnh có mắc lỗi", js.dirty.n ? `${sgn(js.dirty.avgR)}R × ${js.dirty.n}` : "-", cls(js.dirty.avgR), "Kỳ vọng của các lệnh có ít nhất một lỗi"),
    ].join("") : `<div class="empty">Chưa có lệnh đã đóng. Ghi lệnh ở cột bên trái, điền giá ra khi đóng lệnh để có thống kê.</div>`;
    $("jEqCard").hidden = !st.n;
    if (st.n) { const all = st.curve, lo = Math.min(0, ...all), hi = Math.max(0, ...all), pad = Math.max(0.5, (hi - lo) * 0.08); eq.set({ title: "Đường vốn theo R", color: "accent", Rs: js.rows.map(r => r.R), ts: js.rows.map(r => r.t.tExit || r.t.t), st, range: [lo - pad, hi + pad], tags: js.rows.map(r => `${r.t.sym} ${r.t.strat}`) }); }
    const mistakeNote = js.byMistake.length ? `<p class="note">Lỗi gây thiệt hại nhiều nhất: <b>${esc(mName(js.byMistake[0].key))}</b> (${sgn(js.byMistake[0].st.totalR)}R qua ${js.byMistake[0].n} lệnh).${js.dirty.n && js.clean.n ? ` Nếu bỏ hết các lệnh có lỗi, kỳ vọng sẽ là ${sgn(js.clean.avgR)}R thay vì ${sgn(st.avgR)}R mỗi lệnh.` : ""}</p>` : "";
    $("jGroups").innerHTML = !st.n ? `<div class="empty">Thống kê theo nhóm sẽ hiện khi có lệnh đã đóng.</div>` :
      `<p class="note">Nhóm nào có kỳ vọng âm sau khoảng 20 lệnh trở lên thì nên bỏ hoặc sửa. Nhóm ít lệnh chỉ để tham khảo.</p>` +
      groupTable("Theo chiến lược", js.byStrat, k => k) + mistakeNote + groupTable("Theo lỗi đã mắc", js.byMistake, mName) +
      groupTable("Theo phía", js.bySide, k => k === "long" ? "LONG" : "SHORT") +
      groupTable("Theo giờ vào lệnh (giờ máy)", js.byHour, k => `${String(k).padStart(2, "0")}:00 – ${String(k).padStart(2, "0")}:59`) +
      groupTable("Theo thứ trong tuần", js.byWeekday, k => WD[k]) + groupTable("Theo cảm xúc lúc vào", js.byEmo, k => (EMO.find(e => e[0] === k) || [0, k])[1]);
    const rows = db.trades.slice().sort((a, b) => b.t - a.t);
    $("jTrades").innerHTML = table(["Vào lúc", "Mã", "Phía", "Chiến lược", "Giá vào", "Cắt lỗ", "Giá ra", "R", "USDT", "Lỗi", "Lý do", ""], rows.map(t => {
      const r = result(t);
      return `<tr><td>${fmtDate(t.t)}</td><td>${esc(t.sym)}</td><td class="${t.side === "long" ? "pos" : "neg"}">${t.side === "long" ? "LONG" : "SHORT"}</td><td class="t">${esc(t.strat || "")}</td><td>${t.entry}</td><td>${t.stop}</td><td>${t.exit > 0 ? t.exit : `<span class="tag flat">đang mở</span>`}</td><td class="${r ? cls(r.R) : ""}">${r ? sgn(r.R) : "-"}</td><td class="${r ? cls(r.pnl) : ""}">${r && t.qty ? fmtVol(r.pnl) : "-"}</td><td class="t">${esc((t.mistakes || []).map(mName).join(", "))}</td><td class="t jreason">${esc(t.reason || "")}</td><td class="t"><button class="icon" data-jedit="${t.id}" data-tip="Sửa hoặc đóng lệnh">✎</button><button class="icon" data-jdel="${t.id}" data-tip="Xoá">✕</button></td></tr>`;
    }), "Chưa có lệnh nào trong nhật ký.");
    calc();
  }
  resetForm(); $("szSym").value = S.symbol; $("szLev").value = 10;
  render();
  return { render, show() { fillStrats(); if (!$("szEntry").value && market.last) { $("szEntry").value = market.last.p; $("szSym").value = S.symbol; } render(); } };
}
