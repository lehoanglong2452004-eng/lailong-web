// Lai Long Web: các chỉ số mà bàn giao dịch tổ chức theo dõi, trong tab Phân tích.
//   - Crypto (trực tiếp): OI, funding 3 sàn, long/short top trader và mọi tài khoản, mua/bán chủ động, chênh giá Coinbase,
//     put/call và DVOL của Deribit
//   - Biến động Mỹ (trễ ~15 phút, Yahoo): VIX và cấu trúc kỳ hạn, VVIX, SKEW, MOVE, VXN, GVZ, OVX; put/call SPX, SPY, QQQ (CBOE)
//   - COT của CFTC (hằng tuần): đầu cơ lớn và bên phòng hộ, chỉ số COT 3 năm
// Bản web đọc data/vol.json, data/cot.json do GitHub Actions cập nhật; bản laptop lấy qua máy chủ (lailong/terminal/macro.py).
import { getJson, fitCanvas, fmtUsd, MONO } from "./util.js?v=202610192356";
import { setFresh } from "./fresh.js?v=202610192356";
import { ivRank, putCall } from "./optpro.js?v=202610192356";

const FAPI = "https://fapi.binance.com", DERIBIT = "https://www.deribit.com/api/v2/public";
const COINS = ["BTC", "ETH", "SOL"];
const pct = (x, k = 2) => x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : ""}${x.toFixed(k)}%`;
const cls = x => x == null ? "" : x >= 0 ? "up" : "dn";

// ---------- phần tính (kiểm thử được) ----------
// đọc cấu trúc kỳ hạn VIX: tỷ lệ VIX/VIX3M > 1 là đảo ngược (hoảng loạn ngắn hạn)
export function readVol(items) {
  const g = s => items.find(x => x.sym === s), v = g("VIX"), v3 = g("VIX3M"), v9 = g("VIX9D"), vv = g("VVIX"), sk = g("SKEW"), mv = g("MOVE");
  const out = [];
  if (v && v3 && v.last && v3.last) {
    const r = v.last / v3.last;
    out.push({ dir: r > 1 ? -1 : r < 0.85 ? 1 : 0, text: `VIX/VIX3M = ${r.toFixed(2)}: ${r > 1 ? "cấu trúc kỳ hạn đảo ngược, thị trường đang hoảng loạn ngắn hạn (thường gần đáy ngắn hạn của chứng khoán khi tỷ lệ này rất cao)." : r < 0.85 ? "contango sâu, thị trường rất bình thản; bảo hiểm rẻ." : "contango nhẹ, bình thường."}` });
  }
  if (v9 && v && v9.last && v.last && v9.last > v.last * 1.08) out.push({ dir: -1, text: `VIX 9 ngày ${v9.last.toFixed(1)} cao hơn VIX ${v.last.toFixed(1)}: thị trường lo một sự kiện trong vài ngày tới.` });
  if (v && v.series && v.series.length > 30) {
    const r = ivRank(v.series.map(x => x[1]), v.last);
    if (r) out.push({ dir: r.rank > 0.8 ? -1 : 0, text: `VIX ${v.last.toFixed(1)}: rank ${Math.round(r.rank * 100)}% trong 1 năm (thấp nhất ${r.lo.toFixed(1)}, cao nhất ${r.hi.toFixed(1)}). ${v.last >= 30 ? "Trên 30 là vùng sợ hãi." : v.last <= 14 ? "Dưới 14 là vùng chủ quan." : ""}`.trim() });
  }
  if (vv && vv.last) out.push({ dir: vv.last > 110 ? -1 : 0, text: `VVIX ${vv.last.toFixed(0)}: ${vv.last > 110 ? "nhu cầu mua bảo hiểm cho chính VIX cao, tổ chức đang phòng hộ cú sốc." : vv.last < 85 ? "thấp, không ai lo VIX bùng." : "bình thường."}` });
  if (sk && sk.last) out.push({ dir: sk.last > 145 ? -1 : 0, text: `SKEW ${sk.last.toFixed(0)}: ${sk.last > 145 ? "giá bảo hiểm sập mạnh (rủi ro đuôi) đang cao: tổ chức mua put xa giá." : "rủi ro đuôi định giá bình thường."}` });
  if (mv && mv.last) out.push({ dir: mv.last > 120 ? -1 : 0, text: `MOVE ${mv.last.toFixed(0)}: ${mv.last > 120 ? "trái phiếu Mỹ biến động mạnh, thường kéo theo USD và chứng khoán." : "trái phiếu yên ổn."}` });
  return out;
}

// COT: ghi chú cho từng hợp đồng theo chỉ số COT 3 năm của đầu cơ lớn
export function cotNote(x) {
  if (x.specIdx == null) return "";
  if (x.specIdx >= 90) return "Đầu cơ lớn long gần mức cao nhất 3 năm: đám đông đã chật, dễ đảo chiều khi có tin xấu";
  if (x.specIdx <= 10) return "Đầu cơ lớn short gần mức cao nhất 3 năm: dễ bị ép mua lại (short squeeze)";
  if (x.commIdx != null && x.commIdx >= 90) return "Bên phòng hộ (hàng thật) mua ròng nhiều nhất 3 năm: thường là vùng giá tốt";
  if (x.commIdx != null && x.commIdx <= 10) return "Bên phòng hộ bán ròng nhiều nhất 3 năm: họ coi giá đang cao";
  return "";
}

export function initInst({ $, esc }) {
  let vol = null, cot = null, crypto = null, us = null, timer = null, busy = false, cotGroup = "";
  const cv = { vix: fitCanvas($("instVix"), () => drawVix()) };
  const get = async u => { try { return await getJson(`${u}?t=${Math.floor(Date.now() / 60e3)}`); } catch { return null; } };

  async function loadCrypto() {
    const safe = p => p.catch(() => null), now = Date.now();
    const rows = await Promise.all(COINS.map(async c => {
      const s = `${c}USDT`, q = `symbol=${s}&period=1h&limit=25`;
      const [oi, top, acc, tk, prem, by, ok, cb, bn] = await Promise.all([
        safe(getJson(`${FAPI}/futures/data/openInterestHist?${q}`)), safe(getJson(`${FAPI}/futures/data/topLongShortPositionRatio?${q}`)),
        safe(getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?${q}`)), safe(getJson(`${FAPI}/futures/data/takerlongshortRatio?${q}`)),
        safe(getJson(`${FAPI}/fapi/v1/premiumIndex?symbol=${s}`)), safe(getJson(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${s}`)),
        safe(getJson(`https://www.okx.com/api/v5/public/funding-rate?instId=${c}-USDT-SWAP`)),
        c === "SOL" ? null : safe(getJson(`https://api.exchange.coinbase.com/products/${c}-USD/ticker`)), safe(getJson(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`)),
      ]);
      const L = a => Array.isArray(a) && a.length ? a[a.length - 1] : null, F = a => Array.isArray(a) && a.length ? a[0] : null;
      const oiNow = L(oi) ? +L(oi).sumOpenInterestValue : null, oi24 = F(oi) ? +F(oi).sumOpenInterestValue : null;
      const cbp = cb && +cb.price, bnp = bn && +bn.price;
      return {
        c, oi: oiNow, oiChg: oiNow && oi24 ? (oiNow / oi24 - 1) * 100 : null,
        fBn: prem ? +prem.lastFundingRate * 100 : null, fBy: by && by.result && by.result.list && by.result.list[0] ? +by.result.list[0].fundingRate * 100 : null,
        fOk: ok && ok.data && ok.data[0] ? +ok.data[0].fundingRate * 100 : null,
        top: L(top) ? +L(top).longAccount : null, acc: L(acc) ? +L(acc).longAccount : null, taker: L(tk) ? +L(tk).buySellRatio : null,
        cbPrem: cbp && bnp ? (cbp / bnp - 1) * 100 : null,
      };
    }));
    // quyền chọn Deribit: put/call và DVOL hiện tại cho BTC, ETH
    await Promise.all(["BTC", "ETH"].map(async c => {
      const r = rows.find(x => x.c === c);
      const [bk, dv] = await Promise.all([safe(getJson(`${DERIBIT}/get_book_summary_by_currency?currency=${c}&kind=option`)), safe(getJson(`${DERIBIT}/get_volatility_index_data?currency=${c}&start_timestamp=${now - 3 * 36e5}&end_timestamp=${now}&resolution=3600`))]);
      if (bk && bk.result) { let co = 0, po = 0, cvv = 0, pv = 0; for (const o of bk.result) { const p = /-P$/.test(o.instrument_name); if (p) { po += +o.open_interest || 0; pv += +o.volume || 0; } else { co += +o.open_interest || 0; cvv += +o.volume || 0; } } r.pcOi = co ? po / co : null; r.pcVol = cvv ? pv / cvv : null; }
      if (dv && dv.result && dv.result.data && dv.result.data.length) r.dvol = +dv.result.data[dv.result.data.length - 1][4];
    }));
    crypto = { t: Date.now(), rows };
  }

  async function load() {
    if (busy) return; busy = true;
    try {
      const [v, c, spx, spy, qqq] = await Promise.all([get("data/vol.json"), get("data/cot.json"), get("data/gex_SPX.json"), get("data/gex_SPY.json"), get("data/gex_QQQ.json"), loadCrypto().catch(() => { crypto = null; })]);
      vol = v; cot = c;
      us = [["SPX", spx], ["SPY", spy], ["QQQ", qqq]].filter(x => x[1] && x[1].rows).map(([s, ch]) => ({ s, t: ch.updated, ...putCall(ch) }));
    } finally { busy = false; }
    render();
  }

  function render() { renderCrypto(); renderVol(); renderCot(); }

  function renderCrypto() {
    const el = $("instCrypto"); if (!el) return;
    if (!crypto) { el.innerHTML = `<div class="empty">Đang tải từ Binance, Bybit, OKX, Coinbase, Deribit…</div>`; return; }
    setFresh($("instCryptoFresh"), "live", crypto.t, { label: "Trực tiếp", expect: 6 * 60e3, note: "Lấy thẳng từ API công khai của Binance Futures, Bybit, OKX, Coinbase và Deribit, làm mới mỗi 2 phút khi đang mở Phân tích" });
    const r = crypto.rows, row = (name, tip, f) => `<tr><td class="t" data-tip="${esc(tip)}">${name}</td>${r.map(x => `<td>${f(x)}</td>`).join("")}</tr>`;
    const fund = v => v == null ? "–" : `<span class="${v > 0.03 ? "dn" : v < 0 ? "up" : ""}">${v.toFixed(4)}%</span>`;
    const lp = v => v == null ? "–" : `<span class="${v >= 0.6 ? "dn" : v <= 0.42 ? "up" : ""}">${(v * 100).toFixed(1)}%</span>`;
    el.innerHTML = `<table class="mktab insttab"><thead><tr><th></th>${r.map(x => `<th>${x.c}</th>`).join("")}</tr></thead><tbody>` +
      row("Open interest", "Tổng giá trị hợp đồng đang mở trên Binance Futures và thay đổi 24 giờ. OI tăng cùng giá là tiền mới vào theo xu hướng; OI tăng mà giá đứng là đang dồn đòn bẩy", x => x.oi == null ? "–" : `${fmtUsd(x.oi)} <small class="${cls(x.oiChg)}">${pct(x.oiChg, 1)}</small>`) +
      row("Funding Binance", "Phí giữ lệnh mỗi 8 giờ. Dương cao: long trả phí đắt, đám đông đang long. Âm: short đông", x => fund(x.fBn)) +
      row("Funding Bybit", "Như trên, sàn Bybit", x => fund(x.fBy)) +
      row("Funding OKX", "Như trên, sàn OKX", x => fund(x.fOk)) +
      row("Top trader đang long", "Phần trăm vị thế của nhóm tài khoản lớn nhất Binance đang long. Đây là tiền lớn", x => lp(x.top)) +
      row("Mọi tài khoản đang long", "Phần trăm tài khoản Binance đang long. Đây là đám đông; trên 60% là đám đông nghiêng long quá", x => lp(x.acc)) +
      row("Mua/bán chủ động 1 giờ", "Khối lượng mua chủ động chia bán chủ động trong giờ gần nhất. Trên 1 là bên mua đang đánh", x => x.taker == null ? "–" : `<span class="${x.taker >= 1 ? "up" : "dn"}">${x.taker.toFixed(2)}</span>`) +
      row("Chênh giá Coinbase", "Giá Coinbase (USD, nơi tổ chức Mỹ mua) so với Binance (USDT). Dương là người Mỹ đang mua mạnh hơn", x => x.cbPrem == null ? "–" : `<span class="${cls(x.cbPrem)}">${pct(x.cbPrem, 3)}</span>`) +
      row("Put/Call Deribit (OI · KL)", "Tỷ lệ put/call theo hợp đồng mở và theo khối lượng 24 giờ trên Deribit", x => x.pcOi == null ? "–" : `${x.pcOi.toFixed(2)} · ${x.pcVol != null ? x.pcVol.toFixed(2) : "–"}`) +
      row("DVOL", "Chỉ số biến động 30 ngày của Deribit (giống VIX cho crypto)", x => x.dvol == null ? "–" : x.dvol.toFixed(1)) +
      `</tbody></table>`;
  }

  function renderVol() {
    const el = $("instVol"); if (!el) return;
    if (!vol || !vol.items || !vol.items.length) { el.innerHTML = `<div class="empty">Chưa có dữ liệu biến động. Bản web cần chờ lần cập nhật tự động kế tiếp; bản laptop cần khởi động lại máy chủ.</div>`; drawVix(); return; }
    const last = vol.items.reduce((a, x) => Math.max(a, x.lastT || 0), 0);
    setFresh($("instVolFresh"), "delay", last || vol.updated, { label: "Trễ ~15 phút (Yahoo)", expect: 4 * 864e5, note: "Chỉ số của CBOE qua Yahoo Finance, trễ khoảng 15 phút trong giờ giao dịch Mỹ; ngoài giờ là giá đóng cửa. Bản web cập nhật mỗi 30 phút" });
    const kp = vol.items.map(x => {
      const s = x.series || [], prev = s.length > 1 ? s[s.length - 2][1] : null, ch = prev && x.last ? (x.last / prev - 1) * 100 : null, rk = s.length > 30 ? ivRank(s.map(p => p[1]), x.last) : null;
      return `<div data-tip="${esc(x.desc)}"><small>${esc(x.sym)}</small><b>${x.last != null ? x.last.toFixed(x.last >= 100 ? 0 : 2) : "–"} <small class="${ch == null ? "" : ch >= 0 ? "dn" : "up"}">${pct(ch, 1)}</small></b>${rk ? `<small>rank 1 năm ${Math.round(rk.rank * 100)}%</small>` : ""}</div>`;
    }).join("");
    const lines = readVol(vol.items);
    const pcs = us && us.length ? `<div class="mh">Put/call quyền chọn Mỹ (CBOE, trễ 15 phút)</div><div class="kpis">${us.map(u => `<div data-tip="Theo hợp đồng mở (OI) và theo khối lượng hôm nay"><small>${u.s}</small><b>${u.oi != null ? u.oi.toFixed(2) : "–"} <small>· KL ${u.vol != null ? u.vol.toFixed(2) : "–"}</small></b></div>`).join("")}</div>` : "";
    el.innerHTML = `<div class="kpis">${kp}</div><ul class="gexread optread">${lines.map(l => `<li class="${l.dir > 0 ? "pos" : l.dir < 0 ? "neg" : ""}">${esc(l.text)}</li>`).join("")}</ul>${pcs}`;
    drawVix();
  }

  function drawVix() {
    const { ctx, w, h } = cv.vix; ctx.clearRect(0, 0, w, h);
    const v = vol && vol.items && vol.items.find(x => x.sym === "VIX"), v3 = vol && vol.items && vol.items.find(x => x.sym === "VIX3M");
    if (!v || !v.series || v.series.length < 2) return;
    const s = v.series, pad = { l: 34, r: 150, t: 12, b: 16 }, t0 = s[0][0], t1 = s[s.length - 1][0];
    let lo = Math.min(...s.map(x => x[1])), hi = Math.max(...s.map(x => x[1])); lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1);
    const X = t => pad.l + (t - t0) / (t1 - t0 || 1) * (w - pad.l - pad.r), Y = y => h - pad.b - (y - lo) / (hi - lo) * (h - pad.t - pad.b);
    ctx.font = `10px ${MONO}`; ctx.fillStyle = "#a3a3a3"; ctx.strokeStyle = "#2b2b2b"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const y of [lo, (lo + hi) / 2, hi]) { ctx.beginPath(); ctx.moveTo(pad.l, Math.round(Y(y)) + 0.5); ctx.lineTo(w - pad.r, Math.round(Y(y)) + 0.5); ctx.stroke(); ctx.fillText(y.toFixed(0), pad.l - 4, Y(y)); }
    for (const [lv, col] of [[30, "rgba(229,72,77,.5)"], [14, "rgba(31,181,122,.5)"]]) if (lv > lo && lv < hi) { ctx.strokeStyle = col; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(pad.l, Y(lv)); ctx.lineTo(w - pad.r, Y(lv)); ctx.stroke(); ctx.setLineDash([]); }
    if (v3 && v3.series) { ctx.strokeStyle = "rgba(78,161,255,.7)"; ctx.lineWidth = 1; ctx.beginPath(); v3.series.filter(x => x[0] >= t0).forEach((x, i) => i ? ctx.lineTo(X(x[0]), Y(x[1])) : ctx.moveTo(X(x[0]), Y(x[1]))); ctx.stroke(); }
    ctx.strokeStyle = "#ff9f1c"; ctx.lineWidth = 1.6; ctx.beginPath(); s.forEach((x, i) => i ? ctx.lineTo(X(x[0]), Y(x[1])) : ctx.moveTo(X(x[0]), Y(x[1]))); ctx.stroke(); ctx.lineWidth = 1;
    ctx.textAlign = "left"; ctx.fillStyle = "#ff9f1c"; ctx.fillText("VIX 1 năm", pad.l + 4, pad.t); ctx.fillStyle = "#4ea1ff"; ctx.fillText("VIX3M", pad.l + 74, pad.t);
    // cấu trúc kỳ hạn hiện tại: 9 ngày, 30 ngày, 3 tháng, 6 tháng
    const ts = [["9n", "VIX9D"], ["30n", "VIX"], ["3th", "VIX3M"], ["6th", "VIX6M"]].map(([k, sy]) => [k, vol.items.find(x => x.sym === sy)]).filter(x => x[1] && x[1].last);
    if (ts.length >= 2) {
      const x0 = w - pad.r + 22, x1 = w - 12, vals = ts.map(x => x[1].last), l2 = Math.min(...vals) - 1, h2 = Math.max(...vals) + 1, Y2 = y => h - pad.b - (y - l2) / (h2 - l2) * (h - pad.t - pad.b - 14);
      const XX = i => x0 + i / (ts.length - 1) * (x1 - x0), back = ts[0][1].last > ts[ts.length - 1][1].last;
      ctx.fillStyle = "#a3a3a3"; ctx.textAlign = "center"; ctx.fillText(back ? "Kỳ hạn: đảo ngược" : "Kỳ hạn: contango", (x0 + x1) / 2, pad.t);
      ctx.strokeStyle = back ? "#e5484d" : "#1fb57a"; ctx.lineWidth = 2; ctx.beginPath(); ts.forEach((x, i) => i ? ctx.lineTo(XX(i), Y2(x[1].last)) : ctx.moveTo(XX(i), Y2(x[1].last))); ctx.stroke(); ctx.lineWidth = 1;
      ts.forEach((x, i) => { ctx.fillStyle = "#e6e6e6"; ctx.beginPath(); ctx.arc(XX(i), Y2(x[1].last), 2.5, 0, 7); ctx.fill(); ctx.fillStyle = "#a3a3a3"; ctx.fillText(x[0], XX(i), h - 5); ctx.fillText(x[1].last.toFixed(1), XX(i), Y2(x[1].last) - 9); });
    }
  }

  function renderCot() {
    const el = $("instCot"); if (!el) return;
    if (!cot || !cot.items || !cot.items.length) { el.innerHTML = `<div class="empty">Chưa có dữ liệu COT. Bản web cần chờ lần cập nhật tự động kế tiếp; bản laptop cần khởi động lại máy chủ.</div>`; return; }
    const d = cot.items.reduce((a, x) => x.date > a ? x.date : a, "");
    setFresh($("instCotFresh"), "weekly", Date.parse(d + "T20:30:00Z") + 3 * 864e5, { label: `Hằng tuần · số liệu ngày ${d.split("-").reverse().join("/")}`, expect: 10 * 864e5, note: "CFTC chốt vị thế mỗi thứ Ba, công bố chiều thứ Sáu giờ Mỹ (sáng thứ Bảy giờ Việt Nam). Số liệu luôn trễ 3 ngày so với ngày chốt" });
    const groups = [...new Set(cot.items.map(x => x.group))];
    $("instCotTabs").innerHTML = [["", "Tất cả"], ...groups.map(g => [g, g])].map(([g, n]) => `<button class="${g === cotGroup ? "on" : ""}" data-cg="${esc(g)}">${esc(n)}</button>`).join("");
    const bar = v => v == null ? "–" : `<span class="cotbar" data-tip="Chỉ số COT 3 năm: ${v.toFixed(0)} (0 = thấp nhất, 100 = cao nhất)"><i style="left:${v}%"></i></span> ${v.toFixed(0)}`;
    const n = v => v == null ? "–" : `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString("en-US")}`;
    const spark = x => { const hs = x.hist.map(r => r[1]), lo = Math.min(...hs), hi = Math.max(...hs), W = 90, H = 20; if (!(hi > lo)) return ""; const pts = hs.map((v, i) => `${(i / (hs.length - 1) * W).toFixed(1)},${(H - (v - lo) / (hi - lo) * H).toFixed(1)}`).join(" "); return `<svg width="${W}" height="${H}" class="spark"><polyline points="${pts}" fill="none" stroke="#ff9f1c" stroke-width="1.2"/></svg>`; };
    el.innerHTML = `<div class="tablewrap"><table class="mktab"><thead><tr><th>Hợp đồng</th><th data-tip="Đầu cơ lớn (non-commercial: quỹ, CTA): long trừ short">Đầu cơ ròng</th><th>Đổi tuần</th><th data-tip="Vị thế ròng của đầu cơ so với tổng hợp đồng mở">% OI</th><th data-tip="Vị trí vị thế ròng đầu cơ trong 3 năm">COT đầu cơ</th><th data-tip="Bên phòng hộ (commercial: nhà sản xuất, ngân hàng): vị trí vị thế ròng trong 3 năm">COT phòng hộ</th><th>3 năm</th><th>Ghi chú</th></tr></thead><tbody>` +
      cot.items.filter(x => !cotGroup || x.group === cotGroup).map(x => `<tr><td class="t"><b>${esc(x.sym)}</b> ${esc(x.name)}</td><td class="${cls(x.spec)}">${n(x.spec)}</td><td class="${cls(x.specChg)}">${n(x.specChg)}</td><td>${x.specPctOi != null ? x.specPctOi.toFixed(1) + "%" : "–"}</td><td>${bar(x.specIdx)}</td><td>${bar(x.commIdx)}</td><td>${spark(x)}</td><td class="t muted">${esc(cotNote(x))}</td></tr>`).join("") + `</tbody></table></div>`;
  }

  $("instCotTabs").onclick = e => { const b = e.target.closest("[data-cg]"); if (b) { cotGroup = b.dataset.cg; renderCot(); } };
  return {
    show() { load(); clearInterval(timer); timer = setInterval(load, 120e3); },
    hide() { clearInterval(timer); timer = null; },
  };
}
