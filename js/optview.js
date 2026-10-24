// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: phần "chuẩn tổ chức" của tab Quyền chọn: đọc tâm lý, cấu trúc kỳ hạn IV và skew 25 delta,
// chỉ số biến động 1 năm (DVOL của Deribit cho BTC/ETH, VIX/VXN/GVZ/OVX… cho tài sản Mỹ), dòng lệnh quyền chọn lớn.
// BTC/ETH: Deribit trực tiếp (DVOL, lệnh khớp) + nến ngày Binance cho biến động thực tế.
// Tài sản Mỹ: data/gex_<mã>.json có thêm closes (giá đóng cửa ngày) và volIdx (chỉ số biến động) từ Yahoo, trễ.
import { getJson, fitCanvas, fmtUsd, fmtTime, MONO } from "./util.js?v=202610240731";
import { setFresh } from "./fresh.js?v=202610240731";
import { briefState } from "./optbrief.js?v=202610240731";

const DERIBIT = "https://www.deribit.com/api/v2/public";
const C = { atm: "#ff9f1c", call: "#1fb57a", put: "#e5484d", grid: "#2b2b2b", muted: "#a3a3a3", text: "#e6e6e6", rv: "#4ea1ff" };
const p1 = x => x == null ? "–" : (x * 100).toFixed(1) + "%";
const pt = x => x == null ? "–" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;
const dstr = t => { const d = new Date(t); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

export function initOptPro({ $, esc }) {
  const extra = new Map(); // tài sản -> { t, vol: [[t, v]], trades, closes }
  let S = null; // trạng thái đang hiển thị
  const cv = { term: fitCanvas($("optTerm"), () => drawTerm()), vol: fitCanvas($("optVol"), () => drawVol()) };

  async function loadExtras(asset, chain, live) {
    const c = extra.get(asset);
    if (c && Date.now() - c.t < 110e3) return c;
    const out = { t: Date.now(), vol: null, trades: null, closes: null, volName: null, err: [] };
    if (live) {
      const now = Date.now(), safe = p => p.catch(e => { out.err.push(e.message); return null; });
      const [dv, tr, kl] = await Promise.all([
        safe(getJson(`${DERIBIT}/get_volatility_index_data?currency=${asset}&start_timestamp=${now - 370 * 864e5}&end_timestamp=${now}&resolution=1D`)),
        safe(getJson(`${DERIBIT}/get_last_trades_by_currency?currency=${asset}&kind=option&count=1000&sorting=desc`)),
        safe(getJson(`https://fapi.binance.com/fapi/v1/klines?symbol=${asset}USDT&interval=1d&limit=40`)),
      ]);
      out.vol = dv && dv.result && dv.result.data ? dv.result.data.map(r => [r[0], +r[4]]) : null;
      out.volName = `DVOL ${asset}`;
      out.trades = tr && tr.result ? tr.result.trades || [] : null;
      out.closes = kl ? kl.slice(0, -1).map(r => +r[4]) : null; // bỏ nến ngày đang chạy
    } else {
      out.vol = chain.volIdx && chain.volIdx.series || null; out.volName = chain.volIdx && chain.volIdx.name || null;
      out.closes = chain.closes || null; out.volT = chain.volIdx && chain.volIdx.t;
    }
    extra.set(asset, out); return out;
  }

  async function update(asset, chain, live, L) {
    if (!chain) { S = null; return render(); }
    const ex = await loadExtras(asset, chain, live);
    S = briefState({ asset, chain, live, ex, L });
    render();
    return ex;
  }

  function render() {
    const kp = $("optKpis"), rd = $("optRead");
    if (!S) { kp.innerHTML = ""; rd.innerHTML = `<li>Đang tải…</li>`; $("optFlow").innerHTML = ""; $("optTermTab").innerHTML = ""; drawTerm(); drawVol(); return; }
    const { ts, pc, rank, rv, flow, ex, live, chain } = S, c30 = ts.cm[30] || {}, c7 = ts.cm[7] || {};
    setFresh($("optFresh"), live ? "live" : "delay", live ? ex.t : chain.updated, live ? { label: "Trực tiếp (Deribit)", expect: 6 * 60e3, note: "Chuỗi quyền chọn, DVOL và lệnh khớp lấy thẳng từ Deribit, làm mới mỗi 2 phút" } : { label: "Trễ 15 phút (CBOE)", expect: 3 * 3600e3, note: "Chuỗi quyền chọn CBOE chậm 15 phút; chỉ số biến động và giá đóng cửa từ Yahoo" });
    kp.innerHTML = [
      ["IV ATM 30 ngày", p1(c30.atm), "Độ biến động ngụ ý ở strike sát giá, nội suy về đúng 30 ngày"],
      ["IV ATM 7 ngày", p1(c7.atm), "Nội suy về 7 ngày. Cao hơn 30 ngày là thị trường lo chuyện ngắn hạn"],
      ["Skew 25Δ 30 ngày", c30.rr != null ? `<span class="${c30.rr >= 0 ? "up" : "dn"}">${pt(c30.rr)}</span>` : "–", "Risk reversal: IV call 25 delta trừ IV put 25 delta (điểm %). Âm: put đắt hơn, thị trường sợ giảm. Dương: call đắt hơn, thị trường tham"],
      ["Butterfly 25Δ", pt(c30.bf), "Trung bình IV hai cánh trừ IV ATM: cao là thị trường trả giá cho cú biến động lớn ở cả hai phía"],
      [ex.volName ? `${ex.volName}` : "Chỉ số biến động", rank ? `${rank.cur.toFixed(1)} <small>rank ${Math.round(rank.rank * 100)}%</small>` : "–", "Vị trí của chỉ số biến động trong 1 năm: rank 0% là thấp nhất năm, 100% là cao nhất năm"],
      ["Biến động thực tế 30 ngày", p1(rv), "Độ lệch chuẩn lợi nhuận ngày 30 ngày qua, năm hoá"],
      ["IV − thực tế", c30.atm != null && rv != null ? `<span class="${c30.atm - rv >= 0 ? "" : "dn"}">${pt(c30.atm - rv)}</span>` : "–", "Phần bù rủi ro biến động (VRP). Dương: quyền chọn đắt hơn mức giá đang dao động"],
      ["Put/Call OI · KL", `${pc.oi != null ? pc.oi.toFixed(2) : "–"} · ${pc.vol != null ? pc.vol.toFixed(2) : "–"}`, "Tỷ lệ put/call theo hợp đồng mở và theo khối lượng hôm nay"],
    ].map(([t, v, tip]) => `<div data-tip="${esc(tip)}"><small>${t}</small><b>${v}</b></div>`).join("");
    rd.innerHTML = S.lines.length ? S.lines.map(l => `<li class="${l.dir > 0 ? "pos" : l.dir < 0 ? "neg" : ""}">${esc(l.text)}</li>`).join("") : `<li>Chưa đủ dữ liệu.</li>`;
    // bảng cấu trúc kỳ hạn
    $("optTermTab").innerHTML = ts.rows.length ? `<table class="mktab"><thead><tr><th>Hạn</th><th>Ngày</th><th>IV ATM</th><th data-tip="IV của put 25 delta">Put 25Δ</th><th data-tip="IV của call 25 delta">Call 25Δ</th><th data-tip="Call 25Δ − put 25Δ">Skew</th><th data-tip="(call + put)/2 − ATM">BF</th></tr></thead><tbody>` +
      ts.rows.slice(0, 14).map(r => `<tr><td>${dstr(r.exp)}</td><td>${r.days.toFixed(r.days < 3 ? 1 : 0)}</td><td>${p1(r.atm)}</td><td>${p1(r.p25)}</td><td>${p1(r.c25)}</td><td class="${r.rr == null ? "" : r.rr >= 0 ? "up" : "dn"}">${pt(r.rr)}</td><td>${pt(r.bf)}</td></tr>`).join("") + `</tbody></table>` : `<div class="empty">Không đủ hạn để dựng cấu trúc kỳ hạn.</div>`;
    // chỉ số biến động
    $("optVolName").textContent = ex.volName || "Chỉ số biến động";
    if (ex.vol && ex.vol.length) setFresh($("optVolFresh"), live ? "live" : "delay", live ? ex.t : ex.volT || chain.updated, live ? { label: "Trực tiếp", expect: 6 * 60e3, note: "DVOL: chỉ số biến động 30 ngày của Deribit, tính từ giá quyền chọn, giống VIX" } : { label: "Trễ (Yahoo)", expect: 3 * 3600e3, note: "Chỉ số biến động của CBOE qua Yahoo Finance, điểm cuối ngày cộng giá gần nhất trễ khoảng 15 phút" });
    else $("optVolFresh").innerHTML = "";
    $("optVolNote").textContent = rank ? `Thấp nhất năm ${rank.lo.toFixed(1)}, cao nhất ${rank.hi.toFixed(1)}, hiện tại ${rank.cur.toFixed(1)}: cao hơn ${Math.round(rank.pct * 100)}% số ngày trong năm.${rv != null ? ` Đường xanh nhạt là biến động thực tế 30 ngày (${p1(rv)}) để so.` : ""}` : "Chưa có chuỗi chỉ số biến động cho tài sản này.";
    renderFlow(); drawTerm(); drawVol();
  }

  function renderFlow() {
    const el = $("optFlow"), { flow, chain, live } = S;
    if (live && flow) {
      setFresh($("optFlowFresh"), "live", S.ex.t, { label: "Trực tiếp (Deribit)", expect: 6 * 60e3, note: "1000 lệnh khớp quyền chọn gần nhất trên Deribit; phía là phía chủ động (người khớp ngay)" });
      const tot = flow.bull + flow.bear || 1, name = (b) => `${b.side === "buy" ? "Mua" : "Bán"} ${b.call ? "call" : "put"}`;
      const h = flow.to && flow.from ? `${Math.max(1, Math.round((flow.to - flow.from) / 36e5))} giờ gần nhất, ${flow.n} lệnh` : `${flow.n} lệnh`;
      el.innerHTML = `<div class="flowbar" data-tip="Phí bảo hiểm của lệnh chủ động: mua call + bán put (nghiêng tăng) so với mua put + bán call (nghiêng giảm/phòng hộ)"><i class="pos" style="width:${(flow.bull / tot * 100).toFixed(1)}%"></i><i class="neg" style="width:${(flow.bear / tot * 100).toFixed(1)}%"></i></div>
        <div class="muted flowsum">${h}: nghiêng tăng ${fmtUsd(flow.bull)} (mua call ${fmtUsd(flow.prem.buyCall)}, bán put ${fmtUsd(flow.prem.sellPut)}) · nghiêng giảm ${fmtUsd(flow.bear)} (mua put ${fmtUsd(flow.prem.buyPut)}, bán call ${fmtUsd(flow.prem.sellCall)})${flow.block ? ` · lệnh khối ${fmtUsd(flow.block)}` : ""}</div>` +
        (flow.big.length ? `<div class="tablewrap"><table class="mktab"><thead><tr><th>Giờ</th><th>Hợp đồng</th><th>Lệnh</th><th>Số lượng</th><th>Phí</th><th>Giá trị danh nghĩa</th><th>IV</th><th></th></tr></thead><tbody>` +
          flow.big.slice(0, 25).map(b => `<tr><td>${fmtTime(b.t)}</td><td class="t">${esc(b.name)}</td><td class="t ${(b.side === "buy") === b.call ? "up" : "dn"}">${name(b)}</td><td>${b.amount}</td><td><b>${fmtUsd(b.prem)}</b></td><td>${fmtUsd(b.notional)}</td><td>${b.iv != null ? b.iv.toFixed(1) + "%" : "–"}</td><td>${b.block ? `<span class="tag" data-tip="Lệnh khối: giao dịch thoả thuận riêng giữa tổ chức, báo lên sàn">khối</span>` : ""}</td></tr>`).join("") + `</tbody></table></div>`
          : `<div class="empty">Không có lệnh nào có phí từ ${fmtUsd(S.asset === "ETH" ? 50e3 : 100e3)} trong khoảng này.</div>`);
      $("optFlowH").firstChild.textContent = "Dòng lệnh quyền chọn lớn ";
      return;
    }
    // tài sản Mỹ: không có lệnh khớp miễn phí, dùng khối lượng trong ngày theo hợp đồng
    $("optFlowH").firstChild.textContent = "Hợp đồng giao dịch nhiều nhất hôm nay ";
    setFresh($("optFlowFresh"), "delay", chain.updated, { label: "Trễ 15 phút (CBOE)", expect: 3 * 3600e3, note: "Khối lượng trong ngày theo từng hợp đồng từ CBOE. KL lớn hơn OI là hoạt động bất thường: có người mở vị thế mới lớn" });
    const rows = chain.rows.filter(r => r[5] > 0).sort((a, b) => b[5] - a[5]).slice(0, 20);
    el.innerHTML = rows.length ? `<div class="tablewrap"><table class="mktab"><thead><tr><th>Hạn</th><th>Strike</th><th>Loại</th><th>KL hôm nay</th><th>OI</th><th data-tip="Khối lượng chia hợp đồng mở: trên 1 là bất thường">KL/OI</th><th>IV</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td>${dstr(chain.exps[r[1]])}</td><td>${r[0]}</td><td class="t ${r[2] > 0 ? "up" : "dn"}">${r[2] > 0 ? "Call" : "Put"}</td><td><b>${Math.round(r[5]).toLocaleString("en-US")}</b></td><td>${Math.round(r[3]).toLocaleString("en-US")}</td><td class="${r[5] > r[3] ? "up" : ""}">${(r[5] / r[3]).toFixed(2)}${r[5] > r[3] ? " ⚑" : ""}</td><td>${(r[4] * 100).toFixed(1)}%</td></tr>`).join("") + `</tbody></table></div>`
      : `<div class="empty">Chưa có khối lượng trong ngày (dữ liệu cũ chưa có cột khối lượng, hoặc ngoài giờ giao dịch Mỹ).</div>`;
  }

  function axes(ctx, w, h, pad, lo, hi, fmt) {
    ctx.strokeStyle = C.grid; ctx.fillStyle = C.muted; ctx.font = `10px ${MONO}`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = h - pad.b - (h - pad.t - pad.b) * i / 4; ctx.beginPath(); ctx.moveTo(pad.l, Math.round(y) + 0.5); ctx.lineTo(w - pad.r, Math.round(y) + 0.5); ctx.stroke(); ctx.fillText(fmt(v), pad.l - 4, y); }
  }

  function drawTerm() {
    const { ctx, w, h } = cv.term; ctx.clearRect(0, 0, w, h);
    if (!S || !S.ts.rows.length) return;
    const rows = S.ts.rows.filter(r => r.days <= 400), pad = { l: 44, r: 10, t: 18, b: 20 };
    const vals = rows.flatMap(r => [r.atm, r.c25, r.p25]).filter(v => v != null);
    let lo = Math.min(...vals), hi = Math.max(...vals); const m = (hi - lo) * 0.1 || 0.02; lo -= m; hi += m;
    const dMax = Math.max(...rows.map(r => r.days)), X = d => pad.l + Math.sqrt(d / dMax) * (w - pad.l - pad.r), Y = v => h - pad.b - (v - lo) / (hi - lo) * (h - pad.t - pad.b);
    axes(ctx, w, h, pad, lo, hi, v => (v * 100).toFixed(0) + "%");
    for (const [key, col, dash] of [["p25", C.put, [4, 3]], ["c25", C.call, [4, 3]], ["atm", C.atm, []]]) {
      ctx.strokeStyle = col; ctx.lineWidth = key === "atm" ? 2 : 1.3; ctx.setLineDash(dash); ctx.beginPath(); let on = false;
      for (const r of rows) { if (r[key] == null) { on = false; continue; } const x = X(r.days), y = Y(r[key]); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = C.atm; for (const r of rows) { ctx.beginPath(); ctx.arc(X(r.days), Y(r.atm), 2.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = C.muted; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    for (const d of [1, 7, 30, 90, 180, 365]) if (d <= dMax) ctx.fillText(d + "n", X(d), h - 5);
    ctx.textAlign = "left"; ctx.fillStyle = C.atm; ctx.fillText("IV ATM", pad.l + 4, 12); ctx.fillStyle = C.put; ctx.fillText("put 25Δ", pad.l + 60, 12); ctx.fillStyle = C.call; ctx.fillText("call 25Δ", pad.l + 120, 12);
    ctx.fillStyle = C.muted; const sh = S.ts.shape; ctx.fillText(sh === "back" ? "đảo ngược: ngắn hạn sợ" : sh === "contango" ? "contango: bình thường" : sh === "flat" ? "phẳng" : "", pad.l + 190, 12);
  }

  function drawVol() {
    const { ctx, w, h } = cv.vol; ctx.clearRect(0, 0, w, h);
    if (!S || !S.ex.vol || S.ex.vol.length < 2) return;
    const s = S.ex.vol, pad = { l: 40, r: 10, t: 10, b: 18 }, t0 = s[0][0], t1 = s[s.length - 1][0];
    const vs = s.map(r => r[1]); let lo = Math.min(...vs), hi = Math.max(...vs);
    const rvv = S.rv != null ? S.rv * 100 : null; if (rvv != null) { lo = Math.min(lo, rvv); hi = Math.max(hi, rvv); }
    const m = (hi - lo) * 0.08 || 1; lo -= m; hi += m;
    const X = t => pad.l + (t - t0) / (t1 - t0 || 1) * (w - pad.l - pad.r), Y = v => h - pad.b - (v - lo) / (hi - lo) * (h - pad.t - pad.b);
    axes(ctx, w, h, pad, lo, hi, v => v.toFixed(0));
    ctx.strokeStyle = C.atm; ctx.lineWidth = 1.5; ctx.beginPath(); s.forEach((r, i) => i ? ctx.lineTo(X(r[0]), Y(r[1])) : ctx.moveTo(X(r[0]), Y(r[1]))); ctx.stroke();
    if (rvv != null) { ctx.strokeStyle = C.rv; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, Y(rvv)); ctx.lineTo(w - pad.r, Y(rvv)); ctx.stroke(); ctx.setLineDash([]); }
    const last = s[s.length - 1]; ctx.fillStyle = C.atm; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = C.muted; ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const d0 = new Date(t0); ctx.fillText(`${d0.getUTCMonth() + 1}/${d0.getUTCFullYear()}`, pad.l, h - 4); ctx.textAlign = "right"; ctx.fillText("nay", w - pad.r, h - 4);
  }

  return { update, extras: loadExtras };
}
