// Lai Long Web: tab Kính lúp. Đọc tay to và nhỏ lẻ cho một tài sản (lens.js), kèm lịch sử trạng thái
// và máy quét bất thường cho cả rổ tài sản. Lấy thẳng từ API công khai: Binance Futures, Binance spot, Coinbase.
import { getJson, fmtPct, fmtTime, fitCanvas, MONO } from "./util.js?v=202611041901";
import { alignHourly, rawSeries, readAt, verdict, stateHistory, scanRow, COMPONENTS, HOUR } from "./lens.js?v=202611041901";
import { wilson } from "./fractal.js?v=202611041901";

const FAPI = "https://fapi.binance.com", SAPI = "https://api.binance.com", CB = "https://api.exchange.coinbase.com";
export const LENS_ASSETS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX", "LINK", "SUI", "LTC", "TRX"];
const NO_CB = new Set(["BNB", "TRX"]);
const safe = p => p.catch(() => null);
const kl = r => (Array.isArray(r) ? r.map(k => ({ t: +k[0], c: +k[4], v: +k[5], tb: +k[9] })) : []);
const hist = (r, k) => (Array.isArray(r) ? r.map(x => ({ t: +x.timestamp, v: +x[k], long: x.longAccount != null ? +x.longAccount : null })) : []);

async function coinbase(base, hours) {
  if (NO_CB.has(base)) return [];
  // Coinbase trả tối đa 300 nến mỗi lần; tính cả nến giờ đang chạy
  const end = Math.floor(Date.now() / HOUR) * HOUR + HOUR, out = [];
  for (let e = end; e > end - hours * HOUR; e -= 299 * HOUR) {
    const s = Math.max(end - hours * HOUR, e - 299 * HOUR);
    const r = await safe(getJson(`${CB}/products/${base}-USD/candles?granularity=3600&start=${new Date(s).toISOString()}&end=${new Date(e).toISOString()}`));
    if (!Array.isArray(r)) break;
    for (const k of r) out.push({ t: k[0] * 1000, c: +k[4] });
  }
  return out;
}

export async function loadAsset(base, n = 500) {
  const sym = base + "USDT", q = `symbol=${sym}&period=1h&limit=${Math.min(500, n)}`;
  const [perp, spot, oi, top, acc, fund, cb] = await Promise.all([
    getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=1h&limit=${n}`),
    safe(getJson(`${SAPI}/api/v3/klines?symbol=${sym}&interval=1h&limit=${n}`)),
    safe(getJson(`${FAPI}/futures/data/openInterestHist?${q}`)),
    safe(getJson(`${FAPI}/futures/data/topLongShortPositionRatio?${q}`)),
    safe(getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?${q}`)),
    safe(getJson(`${FAPI}/fapi/v1/fundingRate?symbol=${sym}&limit=200`)),
    coinbase(base, n),
  ]);
  const rows = alignHourly({
    perp: kl(perp), spot: kl(spot), cb,
    oi: hist(oi, "sumOpenInterestValue"), top: hist(top, "longShortRatio"), acc: hist(acc, "longShortRatio"),
    funding: Array.isArray(fund) ? fund.map(f => ({ t: +f.fundingTime, v: +f.fundingRate })) : [],
  });
  const missing = [!spot && "spot", !cb.length && !NO_CB.has(base) && "Coinbase", !oi && "OI", !top && "top trader", !acc && "đám đông"].filter(Boolean);
  return { rows, missing, at: Date.now() };
}

const zCls = z => (z == null ? "" : z >= 2 ? "z3p" : z >= 1 ? "z2p" : z >= 0.5 ? "z1p" : z <= -2 ? "z3n" : z <= -1 ? "z2n" : z <= -0.5 ? "z1n" : "");
const zTxt = z => (z == null ? "–" : (z >= 0 ? "+" : "") + z.toFixed(1));
const side = x => (x == null ? "–" : x >= 0.75 ? "MUA" : x <= -0.75 ? "BÁN" : "trung tính");
const sideCls = x => (x == null ? "" : x >= 0.75 ? "up" : x <= -0.75 ? "dn" : "");

export function initLens({ $, esc, onPick }) {
  let asset = "BTC", data = null, H = null, err = "", loading = false, timer = null, visible = false, scan = [], scanAt = 0, scanning = false;
  try { asset = JSON.parse(sessionStorage.getItem("lailong.lens") || "{}").asset || asset; } catch { /* bỏ qua */ }
  const save = () => { try { sessionStorage.setItem("lailong.lens", JSON.stringify({ asset })); } catch { /* bỏ qua */ } };
  const cv = fitCanvas($("lensChart"), () => draw());

  async function load(force = false) {
    if (!force && data && data.base === asset && Date.now() - data.at < 120e3) return render();
    loading = true; err = ""; renderHead();
    const want = asset;
    try {
      const d = await loadAsset(want);
      if (want !== asset) return;
      data = { ...d, base: want };
      const raw = rawSeries(data.rows); data.raw = raw;
      H = stateHistory(data.rows, raw);
    } catch (e) { if (want === asset) { err = `Không tải được dữ liệu ${want}: ${e.message}`; data = null; H = null; } }
    loading = false; render();
  }

  async function runScan(force = false) {
    if (scanning || (!force && Date.now() - scanAt < 300e3)) return renderScan();
    scanning = true; renderScan();
    const res = [];
    for (let k = 0; k < LENS_ASSETS.length; k += 4) {
      const part = await Promise.all(LENS_ASSETS.slice(k, k + 4).map(async b => {
        const sym = b + "USDT", q = `symbol=${sym}&period=1h&limit=200`;
        const [perp, oi, top, acc, fund] = await Promise.all([
          safe(getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=1h&limit=200`)),
          safe(getJson(`${FAPI}/futures/data/openInterestHist?${q}`)),
          safe(getJson(`${FAPI}/futures/data/topLongShortPositionRatio?${q}`)),
          safe(getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?${q}`)),
          safe(getJson(`${FAPI}/fapi/v1/fundingRate?symbol=${sym}&limit=80`)),
        ]);
        if (!perp) return null;
        const rows = alignHourly({ perp: kl(perp), oi: hist(oi, "sumOpenInterestValue"), top: hist(top, "longShortRatio"), acc: hist(acc, "longShortRatio"), funding: Array.isArray(fund) ? fund.map(f => ({ t: +f.fundingTime, v: +f.fundingRate })) : [] });
        const s = scanRow(rows);
        return s && { base: b, ...s };
      }));
      res.push(...part.filter(Boolean));
    }
    scan = res.sort((a, b) => b.anomaly - a.anomaly); scanAt = Date.now(); scanning = false;
    renderScan();
  }

  function renderHead() {
    $("lensAssets").innerHTML = LENS_ASSETS.map(b => `<button class="${b === asset ? "on" : ""}" data-la="${b}">${b}</button>`).join("");
    $("lensSrc").textContent = loading ? "đang tải…" : data ? `Binance + Coinbase, nến 1 giờ · cập nhật ${fmtTime(data.at)}${data.missing.length ? ` · thiếu: ${data.missing.join(", ")}` : ""}` : "";
  }

  function render() {
    renderHead();
    if (err || !data || !data.rows.length) { $("lensVerdict").innerHTML = `<p class="muted">${esc(err || (loading ? "Đang tải…" : "Chưa có dữ liệu"))}</p>`; $("lensKpis").innerHTML = $("lensParts").innerHTML = $("lensHist").innerHTML = ""; draw(); return; }
    const rows = data.rows, raw = data.raw, r = readAt(rows, raw, rows.length - 1), v = verdict(r);
    $("lensVerdict").className = "lensverdict " + (v.tone > 0 ? "up" : v.tone < 0 ? "dn" : "");
    $("lensVerdict").innerHTML = `${r.trap ? `<span class="tag trap">BẪY NHỎ LẺ</span> ` : ""}${esc(v.text)}`;
    const last = rows[rows.length - 1], prem = raw.prem[rows.length - 1];
    $("lensKpis").innerHTML = [
      ["Tay to", `<span class="${sideCls(r.whale)}">${side(r.whale)}</span> <small>${zTxt(r.whale)}</small>`, "Trung bình z-score của top trader so với đám đông, dòng tiền spot, Coinbase premium"],
      ["Nhỏ lẻ", `<span class="${sideCls(r.retail)}">${side(r.retail)}</span> <small>${zTxt(r.retail)}</small>`, "Trung bình z-score của tỷ lệ tài khoản long, funding, dòng tiền perp"],
      ["OI 4 giờ", `${esc(r.quad.label)}`, r.quad.who],
      ["Đám đông long", last.accLong != null ? (last.accLong * 100).toFixed(1) + "%" : "–", "Tỷ lệ số tài khoản Binance đang long"],
      ["Funding", last.fund != null ? (last.fund * 100).toFixed(4) + "%" : "–", "Funding gần nhất mỗi kỳ"],
      ["Coinbase premium", prem != null ? (prem * 100).toFixed(3) + "%" : "–", "Giá Coinbase so với Binance spot; xem z-score ở bảng dưới vì USD/USDT luôn chênh một chút"],
    ].map(([k, val, tip]) => `<div data-tip="${esc(tip)}"><small>${k}</small><b>${val}</b></div>`).join("");
    const cur = { tilt: x => x != null ? `top/đám đông ×${Math.exp(x).toFixed(2)}` : "–", spotFlow: x => x != null ? fmtPct(x * 100, 1) : "–", prem: x => x != null ? (x * 100).toFixed(3) + "%" : "–", crowd: x => x != null ? (x * 100).toFixed(1) + "% long" : "–", fund: x => x != null ? (x * 100).toFixed(4) + "%" : "–", perpFlow: x => x != null ? fmtPct(x * 100, 1) : "–" };
    $("lensParts").innerHTML = `<table class="mktab lenstab"><thead><tr><th>Phe</th><th>Phép đo</th><th>Hiện tại</th><th>z-score</th><th>Đọc</th></tr></thead><tbody>${COMPONENTS.map(c => {
      const z = r.z[c.id], x = raw[c.id][rows.length - 1];
      const read = z == null ? "thiếu dữ liệu" : Math.abs(z) < 0.75 ? "bình thường" : (z > 0 ? "nghiêng mua" : "nghiêng bán") + (Math.abs(z) >= 2 ? " mạnh, bất thường" : "");
      return `<tr data-tip="${esc(c.tip)}"><td class="t">${c.side === "whale" ? "Tay to" : "Nhỏ lẻ"}</td><td class="t">${esc(c.name)}</td><td>${cur[c.id](x)}</td><td class="${zCls(z)}">${zTxt(z)}</td><td class="t ${z == null ? "" : z >= 0.75 ? "up" : z <= -0.75 ? "dn" : ""}">${read}</td></tr>`;
    }).join("")}</tbody></table>`;
    renderHist(); draw();
  }

  function renderHist() {
    if (!H || !H.key) { $("lensHist").innerHTML = `<p class="muted">Chưa đủ dữ liệu để thống kê.</p>`; return; }
    const pct = x => (isFinite(x) ? (x * 100).toFixed(0) + "%" : "–"), ret = x => (isFinite(x) ? fmtPct(x * 100, 2) : "–");
    const [w, rt] = H.key.split("|").map(Number), name = x => (x > 0 ? "mua" : x < 0 ? "bán" : "trung tính");
    $("lensHist").innerHTML = `<p class="muted">Trong ${Math.round(data.rows.length / 24)} ngày qua, những giờ có cùng trạng thái như bây giờ (tay to ${name(w)}, nhỏ lẻ ${name(rt)}) thì sau đó giá đi đâu, so với mọi giờ.</p>
      <table class="mktab lenstab"><thead><tr><th>Sau</th><th>Số giờ giống</th><th data-tip="Kèm khoảng tin cậy 95%">% giá lên</th><th>TB thay đổi</th><th data-tip="Mọi giờ">Nền: % lên</th><th>Nền: TB</th></tr></thead><tbody>${H.out.map(o => {
        const ci = wilson(o.upCount, o.same.n), edge = o.same.n >= 20 && (ci.lo > o.base.up || ci.hi < o.base.up);
        return `<tr><td>${o.H} giờ</td><td>${o.same.n}</td><td class="${edge ? (o.same.up > o.base.up ? "up" : "dn") : ""}">${pct(o.same.up)}${o.same.n ? ` <small class="muted">(${pct(ci.lo)}–${pct(ci.hi)})</small>` : ""}</td><td class="${o.same.avg > 0 ? "up" : o.same.avg < 0 ? "dn" : ""}">${ret(o.same.avg)}</td><td>${pct(o.base.up)}</td><td>${ret(o.base.avg)}</td></tr>`;
      }).join("")}</tbody></table>
      <p class="muted small">Ô tô màu khi khoảng tin cậy nằm hẳn trên hoặc dưới mức nền (và có từ 20 giờ giống trở lên). Các giờ liền nhau chồng lấn nhau nên số mẫu độc lập ít hơn con số trên: đây là gợi ý, chưa phải chiến lược đã kiểm chứng.</p>`;
  }

  function draw() {
    const { ctx, w, h } = cv; ctx.clearRect(0, 0, w, h);
    if (!H || !data) return;
    const st = getComputedStyle(document.body), col = n => st.getPropertyValue(n).trim() || "#888";
    const reads = H.reads, rows = data.rows, n = rows.length, pad = 46, top = h * 0.55;
    const X = i => pad + (w - pad - 8) * i / Math.max(1, n - 1);
    let lo = Infinity, hi = -Infinity; for (const r of rows) { lo = Math.min(lo, r.c); hi = Math.max(hi, r.c); }
    const Y = p => 8 + (top - 16) * (1 - (p - lo) / (hi - lo || 1));
    ctx.font = `10px ${MONO}`; ctx.fillStyle = col("--muted");
    ctx.fillText(hi.toPrecision(6), 2, 14); ctx.fillText(lo.toPrecision(6), 2, top - 6);
    // tô nền theo trạng thái bẫy: xanh là tay to mua còn nhỏ lẻ bán, đỏ là ngược lại
    for (let i = 0; i < n; i++) if (reads[i].trap) { ctx.fillStyle = reads[i].whale > 0 ? "rgba(38,166,154,.18)" : "rgba(239,83,80,.18)"; ctx.fillRect(X(i) - 1, 0, Math.max(2, (w - pad) / n), top); }
    ctx.strokeStyle = col("--ink"); ctx.lineWidth = 1.2; ctx.beginPath();
    rows.forEach((r, i) => (i ? ctx.lineTo(X(i), Y(r.c)) : ctx.moveTo(X(i), Y(r.c)))); ctx.stroke();
    // điểm tay to và nhỏ lẻ (−3..3)
    const y0 = top + 10, hh = h - y0 - 14, Z = z => y0 + hh / 2 - (hh / 2) * z / 3;
    ctx.strokeStyle = col("--line"); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, Z(0)); ctx.lineTo(w - 8, Z(0)); ctx.stroke();
    ctx.setLineDash([3, 3]); for (const z of [0.75, -0.75]) { ctx.beginPath(); ctx.moveTo(pad, Z(z)); ctx.lineTo(w - 8, Z(z)); ctx.stroke(); } ctx.setLineDash([]);
    const line = (k, c) => { ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.beginPath(); let on = false; reads.forEach((r, i) => { if (r[k] == null) { on = false; return; } on ? ctx.lineTo(X(i), Z(r[k])) : ctx.moveTo(X(i), Z(r[k])); on = true; }); ctx.stroke(); };
    line("whale", "#26a69a"); line("retail", "#ff9800");
    ctx.fillStyle = "#26a69a"; ctx.fillText("Tay to", pad, y0 + 2); ctx.fillStyle = "#ff9800"; ctx.fillText("Nhỏ lẻ", pad + 50, y0 + 2);
    ctx.fillStyle = col("--muted"); ctx.fillText("+3", 2, Z(3) + 8); ctx.fillText("−3", 2, Z(-3)); ctx.fillText(new Date(rows[0].t).toLocaleDateString("vi-VN"), pad, h - 2);
  }

  function renderScan() {
    $("lensScanSrc").textContent = scanning ? "đang quét…" : scanAt ? `quét lúc ${fmtTime(scanAt)} · tự quét lại mỗi 5 phút khi đang mở tab` : "";
    if (!scan.length) { $("lensScan").innerHTML = scanning ? "" : `<p class="muted">Chưa quét.</p>`; return; }
    $("lensScan").innerHTML = `<table class="mktab lenstab scan"><thead><tr><th>Mã</th><th>Giá</th><th>24 giờ</th><th data-tip="Khối lượng giờ gần nhất so với 7 ngày">KL</th><th data-tip="Thay đổi OI 4 giờ so với bình thường">OI</th><th data-tip="Top trader so với đám đông">Top/ĐĐ</th><th data-tip="Tỷ lệ tài khoản long">Đám đông</th><th>Funding</th><th data-tip="Mua/bán chủ động trên perp 4 giờ">Dòng perp</th><th>Tay to</th><th>Nhỏ lẻ</th><th>OI 4 góc</th></tr></thead><tbody>${scan.map(s => `<tr data-ls="${s.base}" class="${s.base === asset ? "sel" : ""}">
      <td class="t"><b>${s.base}</b>${s.trap ? ` <span class="tag trap">bẫy</span>` : ""}</td><td>${s.price.toPrecision(5)}</td><td class="${s.d24 > 0 ? "up" : s.d24 < 0 ? "dn" : ""}">${fmtPct(s.d24 * 100, 1)}</td>
      <td class="${zCls(s.zVol)}">${zTxt(s.zVol)}</td><td class="${zCls(s.zOI)}">${zTxt(s.zOI)}</td><td class="${zCls(s.z.tilt)}">${zTxt(s.z.tilt)}</td><td class="${zCls(s.z.crowd)}">${zTxt(s.z.crowd)}</td><td class="${zCls(s.z.fund)}">${zTxt(s.z.fund)}</td><td class="${zCls(s.z.perpFlow)}">${zTxt(s.z.perpFlow)}</td>
      <td class="${sideCls(s.whale)}">${side(s.whale)}</td><td class="${sideCls(s.retail)}">${side(s.retail)}</td><td class="t" data-tip="${esc(s.quad.who)}">${esc(s.quad.label)}</td></tr>`).join("")}</tbody></table>`;
  }

  $("lensAssets").onclick = e => { const b = e.target.closest("[data-la]"); if (b && b.dataset.la !== asset) { asset = b.dataset.la; save(); load(); renderScan(); } };
  $("lensScan").onclick = e => { const tr = e.target.closest("[data-ls]"); if (tr) { asset = tr.dataset.ls; save(); load(); renderScan(); } };
  $("lensReload").onclick = () => { load(true); runScan(true); };
  $("lensOpen").onclick = () => onPick && onPick(asset + "USDT");

  return {
    show() { visible = true; load(); runScan(); clearInterval(timer); timer = setInterval(() => { if (visible) { load(true); runScan(); } }, 120e3); },
    hide() { visible = false; clearInterval(timer); timer = null; },
  };
}
