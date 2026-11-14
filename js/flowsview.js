// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: dòng tiền tổ chức Mỹ theo dõi hằng ngày, trong tab Phân tích.
//   - Quỹ ETF Bitcoin/Ethereum giao ngay (Farside): tiền vào/ra ròng mỗi phiên và từng quỹ, luỹ kế từ khi ra mắt, chuỗi phiên.
//   - Stablecoin (DefiLlama): tổng lượng đang lưu hành, phát hành ròng mỗi ngày, từng đồng lớn và thị phần.
// Bản web đọc flows.json (máy chủ GitHub lấy lại mỗi giờ, xem lailong/terminal/live.py); bản laptop lấy qua máy chủ (flows.py).
import { getJson, liveJson } from "./util.js?v=202611141528";
import { setFresh } from "./fresh.js?v=202611141528";

const LLAMA = "https://stablecoins.llama.fi/stablecoins?includePrices=false";
const usdM = x => x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x) >= 1000 ? (Math.abs(x) / 1000).toFixed(2) + " tỷ" : Math.abs(x).toFixed(1) + " tr"}`;
const usdB = x => x == null || !isFinite(x) ? "–" : `${(x / 1e9).toFixed(2)} tỷ`;
const chgB = x => x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${(Math.abs(x) / 1e9).toFixed(2)} tỷ`;
const cls = x => x == null ? "" : x > 0 ? "up" : x < 0 ? "dn" : "";
const ddmm = t => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
export const ISSUER = {
  IBIT: "BlackRock", FBTC: "Fidelity", BITB: "Bitwise", ARKB: "Ark 21Shares", BTCO: "Invesco", EZBC: "Franklin", BRRR: "CoinShares",
  HODL: "VanEck", BTCW: "WisdomTree", GBTC: "Grayscale", BTC: "Grayscale Mini", ETHA: "BlackRock", FETH: "Fidelity", ETHW: "Bitwise",
  TETH: "21Shares", ETHV: "VanEck", QETH: "Invesco", EZET: "Franklin", ETHE: "Grayscale", ETH: "Grayscale Mini",
};

// ---------- phần tính (kiểm thử được) ----------
// rows: [[t, tổng, {quỹ: số}]] theo ngày tăng dần
export function etfSummary(d) {
  if (!d || !d.rows || !d.rows.length) return null;
  const r = d.rows, last = r[r.length - 1], sum = n => r.slice(-n).reduce((a, x) => a + x[1], 0);
  let streak = 0; const sg = Math.sign(last[1]); for (let i = r.length - 1; i >= 0 && Math.sign(r[i][1]) === sg && sg; i--) streak++;
  const funds = Object.entries(last[2] || {}).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const by20 = {}; for (const x of r.slice(-20)) for (const [k, v] of Object.entries(x[2] || {})) by20[k] = (by20[k] || 0) + v;
  return { t: last[0], last: last[1], d5: sum(5), d20: sum(20), streak: streak * sg, funds, top20: Object.entries(by20).sort((a, b) => b[1] - a[1]), cum: d.cumTotal != null ? d.cumTotal : null };
}

export function etfNote(name, s) {
  if (!s) return "";
  const dir = s.d5 > 0 ? "vào" : "ra";
  let t = `${name}: 5 phiên gần nhất tiền ${dir} ròng ${usdM(Math.abs(s.d5)).slice(1)} USD`;
  if (Math.abs(s.streak) >= 3) t += `, ${Math.abs(s.streak)} phiên liên tiếp ${s.streak > 0 ? "vào" : "ra"}`;
  t += s.d20 > 0 ? ". Tổ chức Mỹ đang gom qua quỹ ETF trong 20 phiên." : ". Tổ chức Mỹ đang rút khỏi quỹ ETF trong 20 phiên.";
  return t;
}

// từng quỹ: phiên gần nhất, 5 phiên, 20 phiên, luỹ kế từ khi ra mắt; các quỹ nhỏ gộp thành "Khác"
export function fundTable(d, top = 6) {
  if (!d || !d.rows || !d.rows.length) return [];
  const r = d.rows, names = d.funds && d.funds.length ? d.funds : Object.keys(r[r.length - 1][2] || {});
  const s = (k, n) => r.slice(-n).reduce((a, x) => a + ((x[2] || {})[k] || 0), 0);
  const rows = names.map(k => ({ k, last: s(k, 1), d5: s(k, 5), d20: s(k, 20), cum: d.cum && d.cum[k] != null ? d.cum[k] : null }))
    .sort((a, b) => Math.abs(b.d20) + Math.abs(b.cum || 0) / 50 - (Math.abs(a.d20) + Math.abs(a.cum || 0) / 50));
  if (rows.length <= top + 1) return rows;
  const rest = rows.slice(top), add = f => rest.reduce((a, x) => (x[f] == null || a == null ? null : a + x[f]), 0);
  return [...rows.slice(0, top), { k: rest.map(x => x.k).slice(0, 3).join(" · ") + (rest.length > 3 ? "…" : ""), other: rest.length, last: add("last"), d5: add("d5"), d20: add("d20"), cum: add("cum") }];
}

// đường luỹ kế cho cột: có tổng từ khi ra mắt thì lùi dần từ tổng đó, không thì cộng dồn từ đầu khung
export function cumLine(d, n = 30) {
  const r = d.rows.slice(-n);
  if (d.cumTotal != null) { let c = d.cumTotal; const out = []; for (let i = r.length - 1; i >= 0; i--) { out[i] = c; c -= r[i][1]; } return { pts: out, since: true }; }
  let c = 0; return { pts: r.map(x => (c += x[1])), since: false };
}

export function stableSummary(st) {
  // có chuỗi tổng theo ngày thì dùng tổng của mọi stablecoin, không chỉ 8 đồng lớn nhất
  const S = st && st.series;
  if (S && S.length > 31) { const v = k => S[S.length - 1 - k][1]; return { now: v(0), d1: v(0) - v(1), d7: v(0) - v(7), d30: v(0) - v(30), t: S[S.length - 1][0] }; }
  if (!st || !st.coins || !st.coins.length) return null;
  const tot = k => st.coins.reduce((a, c) => a + (c[k] || 0), 0), now = tot("now");
  const ch = k => { const p = st.coins.every(c => c[k]) ? tot(k) : null; return p ? now - p : null; };
  return { now, d1: ch("d1"), d7: ch("d7"), d30: ch("d30") };
}
// phát hành ròng mỗi ngày (USD), n ngày gần nhất
export function dailyMint(st, n = 30) {
  const S = st && st.series; if (!S || S.length < 2) return [];
  return S.slice(-n - 1).slice(1).map((x, i) => [x[0], x[1] - S.slice(-n - 1)[i][1]]);
}
// đọc ETF và stablecoin cùng nhau
export function flowRead(etf5, st7) {
  if (etf5 == null || st7 == null) return "";
  if (etf5 < 0 && st7 > 0) return "ETF đang rút nhưng stablecoin vẫn tăng: tiền đang đứng ngoài chờ, chưa rời hệ crypto.";
  if (etf5 < 0 && st7 < 0) return "ETF rút và stablecoin cũng giảm: tiền đang rời hệ crypto, tín hiệu xấu nhất.";
  if (etf5 > 0 && st7 > 0) return "ETF hút tiền và stablecoin tăng: tiền mới vào cả hai cửa, tín hiệu tốt nhất.";
  return "ETF hút tiền nhưng stablecoin giảm: tổ chức Mỹ mua, còn dòng tiền trong hệ crypto đang yếu.";
}

// cột quanh trục giữa + đường luỹ kế (tuỳ chọn); trả về SVG co giãn theo chiều ngang
export function barsSvg(vals, line = null, H = 120) {
  if (!vals.length) return "";
  const W = vals.length * 10, m = Math.max(1e-9, ...vals.map(Math.abs)), mid = H / 2;
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="fbars"><line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="ax"/>`;
  vals.forEach((v, i) => { const h = Math.abs(v) / m * (mid - 4); s += `<rect x="${i * 10 + 1}" width="8" y="${(v >= 0 ? mid - h : mid).toFixed(1)}" height="${Math.max(0.5, h).toFixed(1)}" class="${v >= 0 ? "bu" : "bd"}"/>`; });
  if (line && line.length > 1) {
    const lo = Math.min(...line), hi = Math.max(...line), y = v => (H - 6 - (v - lo) / (hi - lo || 1) * (H - 12)).toFixed(1);
    s += `<polyline points="${line.map((v, i) => `${i * 10 + 5},${y(v)}`).join(" ")}" class="cl" vector-effect="non-scaling-stroke"/>`;
  }
  return s + "</svg>";
}

export function initFlows({ $, esc }) {
  let data = null, timer = null, coin = "btc";
  try { coin = sessionStorage.getItem("lailong.etfcoin") === "eth" ? "eth" : "btc"; } catch { /* bỏ qua */ }

  async function load() {
    const d = await liveJson("flows.json").catch(() => null);
    data = d || data || { errors: ["chưa có flows.json"] };
    if (!data.stable) {
      try {
        const l = await getJson(LLAMA);
        data.stable = { coins: (l.peggedAssets || []).filter(c => c.pegType === "peggedUSD" && c.circulating && c.circulating.peggedUSD).map(c => ({ sym: c.symbol, name: c.name, now: c.circulating.peggedUSD, d1: (c.circulatingPrevDay || {}).peggedUSD, d7: (c.circulatingPrevWeek || {}).peggedUSD, d30: (c.circulatingPrevMonth || {}).peggedUSD })).sort((a, b) => b.now - a.now).slice(0, 8), series: [], direct: Date.now() };
      } catch { /* bỏ qua */ }
    }
    render();
  }

  function renderEtf() {
    const d = data || {}, src = d[coin], x = etfSummary(src), nm = coin === "btc" ? "Bitcoin" : "Ethereum";
    $("etfCoin").querySelectorAll("[data-ec]").forEach(b => b.classList.toggle("on", b.dataset.ec === coin));
    if (x) setFresh($("etfFresh"), "eod", d.updated, { label: `Phiên ${ddmm(x.t)} · chốt sau phiên Mỹ${src.stale ? " · số cũ" : ""}`, expect: 4 * 864e5, note: "Farside Investors chốt số sau phiên Mỹ (sáng hôm sau giờ Việt Nam). Máy chủ lấy lại mỗi giờ" });
    if (!x) { $("etfKpis").innerHTML = ""; $("etfBody").innerHTML = `<div class="empty">Chưa lấy được dòng tiền ETF ${nm}.</div>`; return; }
    const st = x.streak;
    $("etfKpis").innerHTML = `<div><small>Phiên ${ddmm(x.t)}</small><b class="${cls(x.last)}">${usdM(x.last)}</b></div>` +
      `<div><small>5 phiên</small><b class="${cls(x.d5)}">${usdM(x.d5)}</b></div><div><small>20 phiên</small><b class="${cls(x.d20)}">${usdM(x.d20)}</b></div>` +
      (x.cum != null ? `<div data-tip="Tổng tiền vào ròng của mọi quỹ ${nm} giao ngay từ ngày ra mắt"><small>Từ khi ra mắt</small><b class="${cls(x.cum)}">${usdM(x.cum)}</b></div>` : "") +
      `<div><small>Chuỗi</small><b class="${cls(st)}">${st ? `${Math.abs(st)} phiên ${st > 0 ? "vào" : "rút"}` : "–"}</b></div>`;
    const r30 = src.rows.slice(-30), cl = cumLine(src);
    const rows = fundTable(src), hasCum = rows.some(f => f.cum != null);
    $("etfBody").innerHTML = `<div class="fbarw">${barsSvg(r30.map(r => r[1]), cl.pts)}<div class="fbx"><span>${ddmm(r30[0][0])}</span><span>${ddmm(r30[r30.length - 1][0])}</span></div></div>` +
      `<p class="note">Cột: tiền vào/ra ròng mỗi phiên (30 phiên, đơn vị USD: tr = triệu, tỷ = tỷ) · đường vàng: luỹ kế${cl.since ? " từ khi ra mắt" : " trong 30 phiên"}</p>` +
      `<div class="tablewrap"><table class="mktab fundtab"><thead><tr><th>Quỹ</th><th>Phiên gần nhất</th><th>5 phiên</th><th>20 phiên</th>${hasCum ? `<th data-tip="Tiền vào ròng từ ngày quỹ ra mắt">Luỹ kế</th>` : ""}</tr></thead><tbody>` +
      rows.map(f => `<tr><td class="t"><b>${esc(f.k)}</b> <small class="muted">${f.other ? `${f.other} quỹ khác` : esc(ISSUER[f.k] || "")}</small></td>${["last", "d5", "d20", ...(hasCum ? ["cum"] : [])].map(k => `<td class="${cls(f[k])}">${usdM(f[k])}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></div><ul class="readout"><li>${esc(etfNote(`ETF ${nm}`, x))}</li></ul>`;
  }

  function renderStable() {
    const d = data || {}, st = d.stable, s = stableSummary(st);
    if (!s) { $("stbKpis").innerHTML = ""; $("stbBody").innerHTML = `<div class="empty">Chưa lấy được số liệu stablecoin.</div>`; return; }
    setFresh($("stbFresh"), "eod", st.direct || d.updated, { label: `Ngày ${s.t ? ddmm(s.t) : "hôm nay"} · DefiLlama`, expect: 3 * 864e5, note: "DefiLlama cập nhật tổng cung theo ngày. Máy chủ lấy lại mỗi giờ" });
    const coins = st.coins || [], c = k => coins.find(x => x.sym === k);
    $("stbKpis").innerHTML = `<div><small>Tổng cung</small><b>${usdB(s.now)}</b></div><div><small>7 ngày</small><b class="${cls(s.d7)}">${chgB(s.d7)}</b></div><div><small>30 ngày</small><b class="${cls(s.d30)}">${chgB(s.d30)}</b></div>` +
      ["USDT", "USDC"].map(k => c(k) ? `<div><small>${k}</small><b>${usdB(c(k).now)}</b></div>` : "").join("");
    const mint = dailyMint(st), top = coins.slice(0, 5), rest = s.now - top.reduce((a, x) => a + x.now, 0);
    const b = etfSummary(d.btc), e = etfSummary(d.eth), read = flowRead(b || e ? (b ? b.d5 : 0) + (e ? e.d5 : 0) : null, s.d7);
    $("stbBody").innerHTML = (mint.length ? `<div class="fbarw">${barsSvg(mint.map(x => x[1]))}<div class="fbx"><span>${ddmm(mint[0][0])}</span><span>${ddmm(mint[mint.length - 1][0])}</span></div></div><p class="note">Cột: phát hành ròng mỗi ngày (30 ngày), xanh là in thêm, đỏ là đốt bớt</p>` : "") +
      `<div class="tablewrap"><table class="mktab fundtab"><thead><tr><th>Stablecoin</th><th>Tổng cung</th><th>7 ngày</th><th>30 ngày</th><th>Thị phần</th></tr></thead><tbody>` +
      top.map(x => `<tr><td class="t"><b>${esc(x.sym)}</b> <small class="muted">${esc(x.name || "")}</small></td><td>${usdB(x.now)}</td>${["d7", "d30"].map(k => `<td class="${cls(x[k] ? x.now - x[k] : null)}">${x[k] ? chgB(x.now - x[k]) : "–"}</td>`).join("")}<td>${(x.now / s.now * 100).toFixed(0)}%</td></tr>`).join("") +
      (rest > 0 && st.series && st.series.length ? `<tr><td class="t muted">Còn lại</td><td>${usdB(rest)}</td><td></td><td></td><td>${(rest / s.now * 100).toFixed(0)}%</td></tr>` : "") +
      `</tbody></table></div>` + (read ? `<ul class="readout"><li>${esc(read)}</li></ul>` : "") +
      `<p class="note">Cách đọc: stablecoin tăng đều trong khi ETF rút là tiền đang đứng ngoài chờ, chưa bỏ đi. Cả hai cùng giảm là tín hiệu xấu nhất.</p>` +
      (d.errors && d.errors.length ? `<p class="muted small">Nguồn lỗi lần cập nhật gần nhất: ${esc(d.errors.join("; "))}</p>` : "");
  }

  function render() { renderEtf(); renderStable(); }

  $("etfCoin").onclick = ev => { const b = ev.target.closest("[data-ec]"); if (!b) return; coin = b.dataset.ec; try { sessionStorage.setItem("lailong.etfcoin", coin); } catch { /* bỏ qua */ } renderEtf(); };
  return {
    show() { load(); clearInterval(timer); timer = setInterval(load, 600e3); },
    hide() { clearInterval(timer); timer = null; },
  };
}
