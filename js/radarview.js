// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: tab Radar. Khối lượng bất thường theo bối cảnh, phản ứng của thị trường (chính thức / tạm thời),
// lịch sử lặp lại của từng loại sự kiện, nhiên liệu đòn bẩy (crypto) và máy quét cho cả rổ tài sản.
// Crypto lấy thẳng từ Binance (và Coinbase); hợp đồng tương lai lấy qua máy chủ trên laptop (/api/bars, chậm ~15 phút).
import { setFresh } from "./fresh.js?v=202610240622";
import { getJson, fmtPct, fmtTime, fitCanvas, MONO } from "./util.js?v=202610240622";
import { analyze, narrate, typeStats, together, snapshot, TYPES, REGIMES, STATUS, TF, fmtLevel, fmtDur } from "./radar.js?v=202610240622";
import { SETUPS, RULE_DEF, trades as setupTrades, setupStats } from "./setups.js?v=202610240622";
import { alignHourly, rawSeries, readAt, COMPONENTS, HOUR } from "./lens.js?v=202610240622";

const FAPI = "https://fapi.binance.com", SAPI = "https://api.binance.com", CB = "https://api.exchange.coinbase.com";
export const CRYPTO = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX", "LINK", "SUI", "LTC", "TRX"];
export const FUTURES = [["GC", "Vàng"], ["SI", "Bạc"], ["CL", "Dầu WTI"], ["NG", "Khí"], ["HG", "Đồng"], ["6J", "Yên"], ["6E", "Euro"], ["ES", "S&P 500"], ["NQ", "Nasdaq"], ["ZN", "TP 10 năm"]];
const FUT = new Map(FUTURES);
const NO_CB = new Set(["BNB", "TRX"]);
const safe = p => p.catch(() => null);
const kl = r => (Array.isArray(r) ? r.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], qv: +k[7], tb: +k[9] })) : []);
const hist = (r, k) => (Array.isArray(r) ? r.map(x => ({ t: +x.timestamp, v: +x[k], long: x.longAccount != null ? +x.longAccount : null })) : []);
const name = id => FUT.get(id) || id;
const MARK = { wake: "Đ", climax: "C", spike: "K", absorb: "H", vacuum: "T", paradox: "N", drought: "Cạn" };

async function coinbase(base, hours) {
  if (NO_CB.has(base)) return [];
  const end = Math.floor(Date.now() / HOUR) * HOUR + HOUR, out = [];
  for (let e = end; e > end - hours * HOUR; e -= 299 * HOUR) {
    const s = Math.max(end - hours * HOUR, e - 299 * HOUR);
    const r = await safe(getJson(`${CB}/products/${base}-USD/candles?granularity=3600&start=${new Date(s).toISOString()}&end=${new Date(e).toISOString()}`));
    if (!Array.isArray(r)) break;
    for (const k of r) out.push({ t: k[0] * 1000, c: +k[4] });
  }
  return out;
}

export const TFS = Object.keys(TF);
async function bars(id, tf = "1h") {
  if (FUT.has(id)) return getJson(`api/bars?s=${encodeURIComponent(id)}&iv=${tf}`);
  return kl(await getJson(`${FAPI}/fapi/v1/klines?symbol=${id}USDT&interval=${tf}&limit=${tf === "5m" || tf === "15m" ? 1000 : 500}`));
}

// nhiên liệu đòn bẩy cho crypto: OI, top trader, đám đông, funding, spot, Coinbase
async function fuel(base, perp, n = 500) {
  const sym = base + "USDT", q = `symbol=${sym}&period=1h&limit=${Math.min(500, n)}`;
  const [spot, oi, top, acc, fund, cb] = await Promise.all([
    safe(getJson(`${SAPI}/api/v3/klines?symbol=${sym}&interval=1h&limit=${n}`)),
    safe(getJson(`${FAPI}/futures/data/openInterestHist?${q}`)),
    safe(getJson(`${FAPI}/futures/data/topLongShortPositionRatio?${q}`)),
    safe(getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?${q}`)),
    safe(getJson(`${FAPI}/fapi/v1/fundingRate?symbol=${sym}&limit=200`)),
    coinbase(base, n),
  ]);
  const rows = alignHourly({ perp, spot: kl(spot), cb, oi: hist(oi, "sumOpenInterestValue"), top: hist(top, "longShortRatio"), acc: hist(acc, "longShortRatio"), funding: Array.isArray(fund) ? fund.map(f => ({ t: +f.fundingTime, v: +f.fundingRate })) : [] });
  const raw = rawSeries(rows);
  return { rows, raw, read: readAt(rows, raw, rows.length - 1) };
}

const pct = x => (isFinite(x) ? Math.round(x * 100) + "%" : "–");
const atrTxt = x => (x == null || !isFinite(x) ? "–" : (x >= 0 ? "+" : "") + x.toFixed(2));
const zCls = z => (z == null ? "" : z >= 2 ? "z3p" : z >= 1 ? "z2p" : z >= 0.5 ? "z1p" : z <= -2 ? "z3n" : z <= -1 ? "z2n" : z <= -0.5 ? "z1n" : "");
const zTxt = z => (z == null ? "–" : (z >= 0 ? "+" : "") + z.toFixed(1));
const ago = (t, now = Date.now()) => (now - t < 6e4 ? "vừa xong" : `${fmtDur(now - t)} trước`);

export function initRadar({ $, esc, onPick }) {
  let asset = "BTC", tf = "1h", cur = null, err = "", loading = false, timer = null, visible = false, pool = "asset";
  let scan = [], scanAt = 0, scanning = false, pooled = null, hover = null;
  try { const s = JSON.parse(sessionStorage.getItem("lailong.radar") || "{}"); asset = s.asset || asset; pool = s.pool || pool; tf = TF[s.tf] ? s.tf : tf; } catch { /* bỏ qua */ }
  const save = () => { try { sessionStorage.setItem("lailong.radar", JSON.stringify({ asset, pool, tf })); } catch { /* bỏ qua */ } };
  const cv = fitCanvas($("radarChart"), () => draw());
  const tip = $("radarTip");

  async function load(force = false) {
    if (!force && cur && cur.id === asset && Date.now() - cur.at < 120e3) { pickTf(); return render(); }
    loading = true; err = ""; renderHead();
    const want = asset;
    try {
      // mọi khung cùng lúc cho bảng đa khung; khung chính phải tải được
      const got = await Promise.all(TFS.map(k => (k === tf ? bars(want, k) : safe(bars(want, k)))));
      if (want !== asset) return;
      const multi = {}, raw = {};
      TFS.forEach((k, j) => { if (got[j] && got[j].length > 60) { raw[k] = got[j]; multi[k] = analyze(got[j], TF[k].ms); } });
      cur = { id: want, at: Date.now(), raw, multi, fuel: null };
      pickTf(); render();
      if (!FUT.has(want) && raw["1h"]) { const f = await safe(fuel(want, raw["1h"])); if (want === asset && cur && cur.id === want) { cur.fuel = f; renderFuel(); } }
    } catch (e) {
      if (want === asset) { err = FUT.has(want) ? `Không tải được ${name(want)}: hợp đồng tương lai chỉ xem được trên bản chạy ở laptop (${e.message})` : `Không tải được ${want}: ${e.message}`; cur = null; }
    }
    loading = false; render();
  }

  function pickTf() { if (cur) { cur.bars = cur.raw[tf] || []; cur.an = cur.multi[tf] || null; } }

  async function runScan(force = false) {
    if (scanning || (!force && Date.now() - scanAt < 300e3)) return renderScan();
    scanning = true; renderScan();
    const ids = [...CRYPTO, ...FUTURES.map(f => f[0])], res = [];
    for (let k = 0; k < ids.length; k += 4) {
      const part = await Promise.all(ids.slice(k, k + 4).map(async id => { const b = await safe(bars(id, "1h")); return b && b.length > 120 ? { id, bars: b, an: analyze(b, HOUR) } : null; }));
      res.push(...part.filter(Boolean));
    }
    scan = res; scanAt = Date.now(); scanning = false;
    pooled = typeStats(res.flatMap(x => x.an.items));
    renderScan(); render();
  }

  function renderHead() {
    $("radarAssets").innerHTML = CRYPTO.map(b => `<button class="${b === asset ? "on" : ""}" data-ra="${b}">${b}</button>`).join("") + `<span class="sep"></span>` +
      FUTURES.map(([id, nm]) => `<button class="${id === asset ? "on" : ""}" data-ra="${id}" data-tip="Hợp đồng tương lai ${esc(nm)} (${id}), nến 1 giờ, chậm ~15 phút">${esc(nm)}</button>`).join("");
    $("radarTfs").innerHTML = TFS.map(k => `<button class="${k === tf ? "on" : ""}" data-rt="${k}">${k}</button>`).join("");
    const rs = $("radarSrc");
    if (loading) rs.textContent = "đang tải…";
    else if (cur && cur.bars.length) setFresh(rs, FUT.has(cur.id) ? "delay" : "live", cur.at, FUT.has(cur.id) ? { label: `Trễ 10–15 phút (Yahoo) · ${cur.bars.length} nến ${tf}`, expect: 30 * 60e3, note: "Nến hợp đồng tương lai từ Yahoo Finance, chậm 10 đến 15 phút; chỉ có khi mở bản trên laptop" } : { label: `Trực tiếp (Binance) · ${cur.bars.length} nến ${tf} (${fmtDur(cur.bars[cur.bars.length - 1].t - cur.bars[0].t)})`, expect: 6 * 60e3, note: "Nến Binance Futures, làm mới mỗi 2 phút khi đang mở Radar" });
    else rs.textContent = "";
    $("radarOpen").hidden = FUT.has(asset);
  }

  const stats = () => (pool === "all" && pooled && tf === "1h" ? pooled : cur && cur.an ? cur.an.stats : {});

  function render() {
    renderHead();
    renderMulti();
    if (err || !cur || !cur.an) { $("radarAnswer").innerHTML = `<p class="muted">${esc(err || (loading ? "Đang tải…" : "Chưa có dữ liệu"))}</p>`; $("radarEvents").innerHTML = $("radarStats").innerHTML = ""; renderFuel(); draw(); return; }
    const an = cur.an, R = an.regNow;
    const S = tf === "1h" && pooled ? pooled : an.stats, P = an.tf, Hm = P.horizons[1], last = cur.bars[cur.bars.length - 1].c;
    $("radarAnswer").innerHTML = `<b>${tf}</b> ${R ? `<span class="tag" data-tip="${esc(REGIMES[R.id].tip)}">${REGIMES[R.id].name}</span> ` : ""}${narrate(an, S).map(esc).join(" ")}`;
    const items = an.items.slice(-15).reverse();
    $("radarEvents").innerHTML = items.length ? `<table class="mktab lenstab"><thead><tr><th>Lúc</th><th>Sự kiện</th><th>Bối cảnh</th><th>Hướng</th><th>Mức giá</th><th data-tip="Khối lượng so với cùng giờ các ngày trước">KL ×</th><th>Phản ứng</th><th data-tip="Giá thay đổi sau ${fmtDur(Hm * P.ms)} theo hướng sự kiện, đơn vị ATR">Sau ${fmtDur(Hm * P.ms)}</th><th data-tip="Loại này trong lịch sử (cả rổ khi đã quét xong): % chính thức">Lịch sử</th></tr></thead><tbody>${items.map(e => {
      const s = S[e.type], st = STATUS[e.r.status];
      return `<tr><td>${ago(e.t + P.ms)}</td><td class="t" data-tip="${esc(TYPES[e.type].tip)}"><b>${esc(TYPES[e.type].name)}</b></td><td class="t">${REGIMES[e.regime].name}</td><td class="${e.dir > 0 ? "up" : "dn"}">${e.dir > 0 ? "▲" : "▼"}</td>
        <td data-tip="${fmtPct((last / e.level - 1) * 100, 2)} so với giá hiện tại">${fmtLevel(e.level)}</td><td>${e.vRel.toFixed(1)}</td><td class="t ${st.cls}" data-tip="${esc(st.tip)}">${st.name}${e.r.at ? ` <small class="muted">sau ${fmtDur(e.r.at * P.ms)}</small>` : ""}</td>
        <td class="${e.r.fwd[Hm] > 0 ? "up" : e.r.fwd[Hm] < 0 ? "dn" : ""}">${atrTxt(e.r.fwd[Hm])}</td><td>${s && s.done >= 5 ? `${pct(s.acceptRate)} <small class="muted">/${s.done}</small>` : "–"}</td></tr>`;
    }).join("")}</tbody></table>` : `<p class="muted">Không có sự kiện nào trong ${cur.bars.length} nến ${tf}.</p>`;
    renderStats(); renderSetups(); renderFuel(); draw();
  }

  // luật vào/ra cho 2 setup và thống kê sau phí: tài sản đang xem (khung đang chọn) và cả rổ (1h)
  function rules() { const n = id => { const v = parseFloat($(id).value); return isFinite(v) && v >= 0 ? v : null; }; return { ...RULE_DEF, fee: n("rsFee") ?? RULE_DEF.fee, slip: n("rsSlip") ?? RULE_DEF.slip, tp: n("rsTp") || RULE_DEF.tp }; }
  function renderSetups() {
    const box = $("radarSetups"); if (!box) return;
    if (!cur || !cur.an) { box.innerHTML = ""; return; }
    const P = rules(), rows = [], f2 = x => (x == null || !isFinite(x) ? "–" : (x >= 0 ? "+" : "") + x.toFixed(2));
    const line = (label, list, few) => { const st = setupStats(list); return `<tr class="${few || st.n < 30 ? "few" : ""}"><td class="t">${label}</td><td>${st.n}</td><td>${st.n ? Math.round(st.wr * 100) + "%" : "–"}</td><td>${f2(st.grossAvgR)}</td><td class="dn">${st.n ? "−" + st.costR.toFixed(2) : "–"}</td><td class="${st.avgR > 0 ? "up" : st.avgR < 0 ? "dn" : ""}"><b>${f2(st.avgR)}</b></td><td>${st.n >= 5 ? `${f2(st.ci.lo)} … ${f2(st.ci.hi)}` : "–"}</td><td>${isFinite(st.pf) ? st.pf.toFixed(2) : "–"}</td><td class="${st.totalR > 0 ? "up" : "dn"}">${f2(st.totalR)}</td><td class="dn">${st.n ? "−" + st.maxDDR.toFixed(1) : "–"}</td><td>${st.byWhy.target}/${st.byWhy.stop}/${st.byWhy.time}</td></tr>`; };
    const mine = {};
    for (const k of Object.keys(SETUPS)) {
      mine[k] = setupTrades(cur.bars, cur.an.items, k, { ...P, maxBars: cur.an.tf.maxBars });
      rows.push(line(`<b>${SETUPS[k].name}</b> · ${esc(name(cur.id))} ${tf}`, mine[k]));
      if (scan.length) rows.push(line(`${SETUPS[k].name} · cả rổ ${scan.length} tài sản 1h`, scan.flatMap(x => setupTrades(x.bars, x.an.items, k, P))));
    }
    const recent = Object.values(mine).flat().sort((a, b) => b.t - a.t).slice(0, 8);
    box.innerHTML = `<table class="mktab lenstab"><thead><tr><th>Setup</th><th>Số lệnh</th><th>Thắng</th><th data-tip="Kỳ vọng mỗi lệnh trước phí, đơn vị R (bội số khoảng cắt lỗ)">Trước phí</th><th data-tip="Phí taker 2 chiều + trượt giá 2 chiều, đổi ra R">Chi phí</th><th data-tip="Kỳ vọng mỗi lệnh sau phí">Sau phí</th><th data-tip="Khoảng tin cậy 95% của kỳ vọng sau phí: cận dưới trên 0 thì lợi thế có thật">KTC 95%</th><th>PF</th><th>Tổng R</th><th>Sụt giảm</th><th data-tip="Chốt lời / cắt lỗ / hết giờ">CL/CL/H</th></tr></thead><tbody>${rows.join("")}</tbody></table>` +
      (recent.length ? `<p class="small"><b>Lệnh gần nhất theo luật (${esc(name(cur.id))} ${tf}):</b> ${recent.map(x => `<span class="${x.R > 0 ? "up" : "dn"}" data-tip="${esc(SETUPS[x.setup].name)} ${x.dir > 0 ? "LONG" : "SHORT"} vào ${fmtLevel(x.entry)}, cắt lỗ ${fmtLevel(x.stop)}, ra ${fmtLevel(x.exit)} (${x.why === "target" ? "chốt lời" : x.why === "stop" ? "cắt lỗ" : "hết giờ"})">${new Date(x.t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} ${x.dir > 0 ? "▲" : "▼"} ${f2(x.R)}R</span>`).join(" · ")}</p>` : "") +
      `<p class="muted small"><b>Đánh thức</b> (theo hướng): chờ 1 nến trong 3 nến sau đóng cửa vượt nến sự kiện, vào ở giá mở nến kế. Cắt lỗ ở đáy/đỉnh nến sự kiện thêm 0,25 ATR. <b>Cạn khối lượng</b> (đánh ngược): chờ 1 nến trong 6 nến sau đóng cửa thủng nến trước nó, vào ở giá mở nến kế. Cắt lỗ ở đỉnh/đáy từ lúc sự kiện thêm 0,25 ATR. Cả hai chốt lời ở ${P.tp}R, hết ${cur.an.tf.maxBars} nến thì đóng; nến chạm cả hai mức tính là cắt lỗ. Dòng mờ là dưới 30 lệnh, chưa đủ để tin.</p>`;
  }

  function renderStats() {
    const S = stats(), keys = Object.keys(TYPES).filter(k => S[k]);
    $("radarPool").innerHTML = `<button class="${pool === "asset" ? "on" : ""}" data-rp="asset">${esc(name(asset))}</button><button class="${pool === "all" ? "on" : ""}" data-rp="all" ${pooled && tf === "1h" ? "" : "disabled"} data-tip="Gộp mọi tài sản trong máy quét (khung 1h) để có nhiều mẫu hơn">Cả rổ</button>`;
    const P = cur && cur.an ? cur.an.tf : TF["1h"], hz = P.horizons;
    $("radarStats").innerHTML = keys.length ? `<table class="mktab lenstab"><thead><tr><th>Sự kiện</th><th>Số lần</th><th>Chính thức</th><th>Tạm thời</th><th data-tip="Trung vị số giờ tới khi ra kết quả">Ra kết quả sau</th>${hz.map((H, j) => `<th ${j ? "" : `data-tip="Giá thay đổi trung bình theo hướng sự kiện, đơn vị ATR"`}>TB ${fmtDur(H * P.ms)}</th>`).join("")}<th data-tip="Tỷ lệ lần giá đi đúng hướng sự kiện sau ${fmtDur(hz[1] * P.ms)}">Đúng hướng ${fmtDur(hz[1] * P.ms)}</th></tr></thead><tbody>${keys.map(k => {
      const s = S[k], f = s.fwd, few = s.done < 20;
      return `<tr class="${few ? "few" : ""}"><td class="t" data-tip="${esc(TYPES[k].tip)}">${esc(TYPES[k].name)}</td><td>${s.n}</td><td class="up">${pct(s.acceptRate)}</td><td class="dn">${pct(s.rejectRate)}</td>
        <td>${isFinite(s.medBars.accepted) ? fmtDur(s.medBars.accepted * P.ms) : "–"} / ${isFinite(s.medBars.rejected) ? fmtDur(s.medBars.rejected * P.ms) : "–"}</td>
        ${hz.map(H => `<td class="${f[H] && f[H].avg > 0 ? "up" : f[H] && f[H].avg < 0 ? "dn" : ""}">${f[H] ? atrTxt(f[H].avg) : "–"}</td>`).join("")}<td>${f[hz[1]] ? pct(f[hz[1]].pos) : "–"}</td></tr>`;
    }).join("")}</tbody></table><p class="muted small">"Ra kết quả sau": số giờ trung vị tới khi chính thức / tạm thời. Dòng mờ là dưới 20 lần có kết quả, chưa đủ để tin. Mọi số đo theo hướng của sự kiện (▲ là lên).</p>` : `<p class="muted">Chưa có sự kiện để thống kê.</p>`;
  }

  function renderFuel() {
    const box = $("radarFuel");
    if (!cur || FUT.has(cur.id)) { box.innerHTML = `<p class="muted">Chỉ có cho crypto: hợp đồng tương lai không công bố vị thế theo giờ (báo cáo COT chậm 3 ngày).</p>`; return; }
    if (!cur.fuel) { box.innerHTML = `<p class="muted">Đang tải OI, funding, tỷ lệ long/short…</p>`; return; }
    const { read: r, raw, rows } = cur.fuel, i = rows.length - 1;
    const now = { tilt: x => x != null ? `×${Math.exp(x).toFixed(2)}` : "–", spotFlow: x => x != null ? fmtPct(x * 100, 1) : "–", prem: x => x != null ? (x * 100).toFixed(3) + "%" : "–", crowd: x => x != null ? (x * 100).toFixed(1) + "%" : "–", fund: x => x != null ? (x * 100).toFixed(4) + "%" : "–", perpFlow: x => x != null ? fmtPct(x * 100, 1) : "–" };
    box.innerHTML = `<p class="small"><b>${esc(r.quad.label)}</b>: ${esc(r.quad.who)}.</p><table class="mktab lenstab"><thead><tr><th>Phép đo</th><th>Hiện tại</th><th data-tip="So với 7 ngày trước đó">z-score</th></tr></thead><tbody>${COMPONENTS.map(c => `<tr data-tip="${esc(c.tip)}"><td class="t">${esc(c.name)}</td><td>${now[c.id](raw[c.id][i])}</td><td class="${zCls(r.z[c.id])}">${zTxt(r.z[c.id])}</td></tr>`).join("")}</tbody></table>
      <p class="muted small">Đòn bẩy dồn một phía là nhiên liệu cho vòng phản thân: giá đi, người đến sau đuổi theo, đến khi hết người mua (bán) thì tự điều chỉnh. Funding và đám đông lệch mạnh (ô đậm) mà khối lượng cạn là dấu hiệu nhiên liệu sắp hết.</p>`;
  }

  // biểu đồ: giá, mức giá của sự kiện (nét đứt theo trạng thái), cột khối lượng tô theo độ bất thường
  let geo = null;
  function draw() {
    const { ctx, w, h } = cv; ctx.clearRect(0, 0, w, h); geo = null;
    if (!cur || !cur.an || !cur.bars.length) return;
    const st = getComputedStyle(document.body), col = n => st.getPropertyValue(n).trim() || "#888";
    const B = cur.bars, an = cur.an, n = B.length, padL = 8, padR = 62, top = 8, ph = h * 0.7, vh = h - ph - 24;
    const X = i => padL + (w - padL - padR) * (i + 0.5) / n, bw = Math.max(1, (w - padL - padR) / n - 0.5);
    let lo = Infinity, hi = -Infinity; for (const b of B) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); }
    const Y = p => top + (ph - top) * (1 - (p - lo) / (hi - lo || 1));
    const up = col("--buy"), dn = col("--sell"), ink = col("--ink"), mut = col("--muted");
    // nến
    for (let i = 0; i < n; i++) { const b = B[i]; ctx.strokeStyle = ctx.fillStyle = b.c >= b.o ? up : dn; ctx.beginPath(); ctx.moveTo(X(i), Y(b.h)); ctx.lineTo(X(i), Y(b.l)); ctx.stroke(); if (bw > 2) ctx.fillRect(X(i) - bw / 2, Math.min(Y(b.o), Y(b.c)), bw, Math.max(1, Math.abs(Y(b.o) - Y(b.c)))); }
    // mức giá của sự kiện 72 giờ gần nhất kéo tới hiện tại
    const pts = [];
    ctx.font = `10px ${MONO}`;
    for (const e of an.items) {
      const x = X(e.i), y = Y(e.level), stc = e.r.status === "accepted" ? up : e.r.status === "rejected" ? dn : col("--warn");
      if (e.i >= n - 48) { ctx.strokeStyle = stc; ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.fillStyle = stc; ctx.fillText(fmtLevel(e.level), w - padR + 3, y + 3); }
      ctx.fillStyle = stc; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = ink; ctx.fillText(MARK[e.type], x - 3, e.dir > 0 ? Y(B[e.i].l) + 12 : Y(B[e.i].h) - 4);
      pts.push({ x, y, e });
    }
    ctx.fillStyle = mut; ctx.fillText(fmtLevel(hi), w - padR + 3, top + 8); ctx.fillText(fmtLevel(lo), w - padR + 3, ph);
    // khối lượng tương đối
    const vy = ph + 16;
    for (let i = 0; i < n; i++) { const v = an.vr[i]; if (v == null) continue; const hh = Math.min(1, v / 5) * vh; ctx.fillStyle = v >= 3 ? col("--accent") : v >= 1.5 ? "rgba(245,165,36,.55)" : v < 0.6 ? "rgba(120,120,120,.35)" : "rgba(160,160,160,.55)"; ctx.fillRect(X(i) - bw / 2, vy + vh - hh, bw, hh); }
    ctx.strokeStyle = col("--line"); ctx.beginPath(); ctx.moveTo(padL, vy + vh - vh / 5); ctx.lineTo(w - padR, vy + vh - vh / 5); ctx.stroke();
    ctx.fillStyle = mut; ctx.fillText("KL ×1", w - padR + 3, vy + vh - vh / 5 + 3); ctx.fillText("×5", w - padR + 3, vy + 8);
    ctx.fillText(new Date(B[0].t).toLocaleDateString("vi-VN"), padL, h - 2);
    geo = { pts };
  }

  $("radarChart").addEventListener("mousemove", ev => {
    if (!geo) return;
    const r = ev.target.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    const p = geo.pts.reduce((a, q) => { const d = Math.hypot(q.x - x, q.y - y); return d < 10 && (!a || d < a.d) ? { ...q, d } : a; }, null);
    if (!p) { tip.hidden = true; hover = null; return; }
    if (hover === p.e) return; hover = p.e;
    const e = p.e, st = STATUS[e.r.status];
    tip.innerHTML = `<b>${esc(TYPES[e.type].name)}</b> ${e.dir > 0 ? "▲" : "▼"} · ${new Date(e.t).toLocaleString("vi-VN")}<br>${esc(TYPES[e.type].tip)}<br>Bối cảnh: ${REGIMES[e.regime].name} · KL ×${e.vRel.toFixed(1)} · mức ${fmtLevel(e.level)}${e.share != null ? ` · mua chủ động ${Math.round(e.share * 100)}%` : ""}<br>Phản ứng: <b class="${st.cls}">${st.name}</b>${e.r.at ? ` sau ${fmtDur(e.r.at * cur.an.tf.ms)}` : ""} · sau ${cur.an.tf.horizons.map(H => fmtDur(H * cur.an.tf.ms)).join(" / ")}: ${cur.an.tf.horizons.map(H => atrTxt(e.r.fwd[H])).join(" / ")} ATR`;
    tip.hidden = false; tip.style.left = Math.min(r.width - 300, p.x + 12) + "px"; tip.style.top = p.y + 12 + "px";
  });
  $("radarChart").addEventListener("mouseleave", () => { tip.hidden = true; hover = null; });

  function renderScan() {
    $("radarScanSrc").textContent = scanning ? "đang quét…" : scanAt ? `quét lúc ${fmtTime(scanAt)} · ${scan.length} tài sản · tự quét lại mỗi 5 phút khi đang mở tab` : "";
    const now = Date.now(), rows = [];
    for (const s of scan) { const n = s.bars.length, last = s.bars[n - 1].c; for (const e of s.an.items) if (e.i >= n - 49) rows.push({ id: s.id, e, last, reg: s.an.regNow }); }
    rows.sort((a, b) => b.e.t - a.e.t);
    renderTogether();
    if (!rows.length) { $("radarScan").innerHTML = scanning ? "" : `<p class="muted">${scanAt ? "48 giờ qua không có sự kiện bất thường nào." : "Chưa quét."}</p>`; return; }
    const S = pooled || {};
    $("radarScan").innerHTML = `<table class="mktab lenstab scan"><thead><tr><th>Lúc</th><th>Tài sản</th><th>Sự kiện</th><th>Bối cảnh</th><th>Hướng</th><th>Mức giá</th><th data-tip="Giá hiện tại so với mức giá của sự kiện">Giá đang cách</th><th>KL ×</th><th>Phản ứng</th><th data-tip="Loại này trên cả rổ: % chính thức / số lần có kết quả">Lịch sử cả rổ</th></tr></thead><tbody>${rows.map(({ id, e, last }) => {
      const st = STATUS[e.r.status], s = S[e.type];
      return `<tr data-rs="${id}" class="${id === asset ? "sel" : ""}"><td>${ago(e.t + HOUR, now)}</td><td class="t"><b>${esc(name(id))}</b></td><td class="t" data-tip="${esc(TYPES[e.type].tip)}">${esc(TYPES[e.type].name)}</td><td class="t">${REGIMES[e.regime].name}</td><td class="${e.dir > 0 ? "up" : "dn"}">${e.dir > 0 ? "▲" : "▼"}</td><td>${fmtLevel(e.level)}</td><td>${fmtPct((last / e.level - 1) * 100, 2)}</td><td>${e.vRel.toFixed(1)}</td><td class="t ${st.cls}">${st.name}</td><td>${s && s.done >= 5 ? `${pct(s.acceptRate)} <small class="muted">/${s.done}</small>` : "–"}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  // bảng đa khung: mỗi khung đang ở bối cảnh nào, nến vừa đóng có bất thường không, sự kiện gần nhất
  function renderMulti() {
    const box = $("radarMulti");
    if (!cur || !cur.multi) { box.innerHTML = ""; return; }
    box.innerHTML = `<table class="mktab lenstab mtf"><thead><tr><th>Khung</th><th>Bối cảnh</th><th data-tip="Khối lượng nến vừa đóng so với cùng thời điểm các ngày trước">KL nến vừa đóng</th><th data-tip="Số sự kiện trong 48 nến gần nhất">Sự kiện 48 nến</th><th>Gần nhất</th><th>Mức giá</th><th>Phản ứng</th></tr></thead><tbody>${TFS.map(k => {
      const an = cur.multi[k]; if (!an) return `<tr data-rt="${k}"><td>${k}</td><td class="t muted" colspan="6">không tải được</td></tr>`;
      const sn = snapshot(an), e = sn.last, st = e && STATUS[e.r.status];
      return `<tr data-rt="${k}" class="${k === tf ? "sel" : ""}"><td><b>${k}</b></td><td class="t">${sn.regime ? REGIMES[sn.regime].name : "–"}</td><td class="${sn.vr >= 3 ? "z3p" : sn.vr >= 1.5 ? "z1p" : sn.vr != null && sn.vr < 0.6 ? "z1n" : ""}">${sn.vr != null ? "×" + sn.vr.toFixed(2) : "–"}</td><td>${sn.count}</td>
        <td class="t">${e ? `<span class="${e.dir > 0 ? "up" : "dn"}">${e.dir > 0 ? "▲" : "▼"}</span> ${esc(TYPES[e.type].name)} <small class="muted">${fmtDur((sn.barsAgo(e) + 1) * an.tf.ms)} trước</small>` : `<span class="muted">im</span>`}</td><td>${e ? fmtLevel(e.level) : "–"}</td><td class="t ${st ? st.cls : ""}">${st ? st.name : ""}</td></tr>`;
    }).join("")}</tbody></table><p class="muted small">Bấm một dòng để xem khung đó. Khung nhỏ báo sớm nhưng nhiễu; cùng một mức giá được khung lớn xác nhận mới đáng tin.</p>`;
  }

  // đồng loạt: từ 3 tài sản trở lên cùng có sự kiện trong cùng một giờ
  function renderTogether() {
    const box = $("radarTogether"), rows = [];
    for (const s of scan) for (const item of s.an.items) rows.push({ id: s.id, item });
    const g = together(rows).slice(0, 12);
    if (!g.length) { box.innerHTML = `<p class="muted">${scanAt ? "3 tuần qua chưa có giờ nào từ 3 tài sản trở lên cùng bất thường." : "Đang chờ máy quét…"}</p>`; return; }
    box.innerHTML = `<table class="mktab lenstab"><thead><tr><th>Lúc</th><th>Số tài sản</th><th>Hướng</th><th>Những tài sản</th></tr></thead><tbody>${g.map(x => `<tr><td>${new Date(x.t).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>${x.list.length}</td><td><span class="up">${x.up}▲</span> <span class="dn">${x.down}▼</span></td>
      <td class="t">${x.list.map(({ id, item }) => `<span class="${item.dir > 0 ? "up" : "dn"}" data-tip="${esc(TYPES[item.type].name)}, ${STATUS[item.r.status].name.toLowerCase()}">${esc(name(id))}</span>`).join(", ")}</td></tr>`).join("")}</tbody></table>`;
  }

  $("radarTfs").onclick = e => { const b = e.target.closest("[data-rt]"); if (b && b.dataset.rt !== tf) { tf = b.dataset.rt; save(); pickTf(); render(); } };
  $("radarMulti").onclick = e => { const r = e.target.closest("[data-rt]"); if (r && r.dataset.rt !== tf) { tf = r.dataset.rt; save(); pickTf(); render(); } };
  $("radarAssets").onclick = e => { const b = e.target.closest("[data-ra]"); if (b && b.dataset.ra !== asset) { asset = b.dataset.ra; save(); load(); renderScan(); } };
  $("radarScan").onclick = e => { const tr = e.target.closest("[data-rs]"); if (tr) { asset = tr.dataset.rs; save(); load(); renderScan(); } };
  $("radarPool").onclick = e => { const b = e.target.closest("[data-rp]"); if (b && !b.disabled) { pool = b.dataset.rp; save(); renderStats(); } };
  for (const id of ["rsFee", "rsSlip", "rsTp"]) $(id).onchange = renderSetups;
  $("radarReload").onclick = () => { load(true); runScan(true); };
  $("radarOpen").onclick = () => onPick && onPick(asset + "USDT");

  return {
    show() { visible = true; load(); runScan(); clearInterval(timer); timer = setInterval(() => { if (visible) { load(true); runScan(); } }, 120e3); },
    hide() { visible = false; clearInterval(timer); timer = null; tip.hidden = true; },
  };
}
