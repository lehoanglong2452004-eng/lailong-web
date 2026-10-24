// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: dòng tiền tổ chức Mỹ theo dõi hằng ngày, trong tab Phân tích.
//   - Quỹ ETF Bitcoin/Ethereum giao ngay (Farside): tiền vào/ra ròng mỗi ngày, triệu USD. Cuối ngày.
//   - Stablecoin (DefiLlama): tổng lượng đang lưu hành, thay đổi 1/7/30 ngày. Cuối ngày.
// Bản web đọc data/flows.json do GitHub Actions cập nhật; bản laptop lấy qua máy chủ (lailong/terminal/flows.py).
import { getJson, fitCanvas, MONO } from "./util.js?v=202610240703";
import { setFresh } from "./fresh.js?v=202610240703";

const LLAMA = "https://stablecoins.llama.fi/stablecoins?includePrices=false";
const usdM = x => x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x) >= 1000 ? (Math.abs(x) / 1000).toFixed(2) + " tỷ" : Math.abs(x).toFixed(1) + " tr"}`;
const usdB = x => x == null || !isFinite(x) ? "–" : `${(x / 1e9).toFixed(2)} tỷ`;
const chgB = x => x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${(Math.abs(x) / 1e9).toFixed(2)} tỷ`;
const cls = x => x == null ? "" : x > 0 ? "up" : x < 0 ? "dn" : "";

// ---------- phần tính (kiểm thử được) ----------
// rows: [[t, tổng, {quỹ: số}]] theo ngày tăng dần
export function etfSummary(d) {
  if (!d || !d.rows || !d.rows.length) return null;
  const r = d.rows, last = r[r.length - 1], sum = n => r.slice(-n).reduce((a, x) => a + x[1], 0);
  let streak = 0; const sg = Math.sign(last[1]); for (let i = r.length - 1; i >= 0 && Math.sign(r[i][1]) === sg && sg; i--) streak++;
  const funds = Object.entries(last[2] || {}).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const by20 = {}; for (const x of r.slice(-20)) for (const [k, v] of Object.entries(x[2] || {})) by20[k] = (by20[k] || 0) + v;
  return { t: last[0], last: last[1], d5: sum(5), d20: sum(20), streak: streak * sg, funds, top20: Object.entries(by20).sort((a, b) => b[1] - a[1]) };
}

export function etfNote(name, s) {
  if (!s) return "";
  const dir = s.d5 > 0 ? "vào" : "ra";
  let t = `${name}: 5 phiên gần nhất tiền ${dir} ròng ${usdM(Math.abs(s.d5)).slice(1)} USD`;
  if (Math.abs(s.streak) >= 3) t += `, ${Math.abs(s.streak)} phiên liên tiếp ${s.streak > 0 ? "vào" : "ra"}`;
  t += s.d20 > 0 ? ". Tổ chức Mỹ đang gom qua quỹ ETF trong 20 phiên." : ". Tổ chức Mỹ đang rút khỏi quỹ ETF trong 20 phiên.";
  return t;
}

export function stableSummary(st) {
  // có chuỗi tổng theo ngày thì dùng tổng của mọi stablecoin, không chỉ 8 đồng lớn nhất
  const S = st && st.series;
  if (S && S.length > 31) { const v = k => S[S.length - 1 - k][1]; return { now: v(0), d1: v(0) - v(1), d7: v(0) - v(7), d30: v(0) - v(30) }; }
  if (!st || !st.coins || !st.coins.length) return null;
  const tot = k => st.coins.reduce((a, c) => a + (c[k] || 0), 0), now = tot("now");
  const ch = k => { const p = st.coins.every(c => c[k]) ? tot(k) : null; return p ? now - p : null; };
  return { now, d1: ch("d1"), d7: ch("d7"), d30: ch("d30") };
}

export function initFlows({ $, esc }) {
  let data = null, timer = null;
  const cv = fitCanvas($("flowsChart"), () => draw());

  async function load() {
    try { data = await getJson(`data/flows.json?t=${Math.floor(Date.now() / 60e3)}`); } catch { data = data || { errors: ["chưa có data/flows.json"] }; }
    if (!data.stable) {
      try {
        const l = await getJson(LLAMA);
        data.stable = { coins: (l.peggedAssets || []).filter(c => c.pegType === "peggedUSD" && c.circulating && c.circulating.peggedUSD).map(c => ({ sym: c.symbol, name: c.name, now: c.circulating.peggedUSD, d1: (c.circulatingPrevDay || {}).peggedUSD, d7: (c.circulatingPrevWeek || {}).peggedUSD, d30: (c.circulatingPrevMonth || {}).peggedUSD })).sort((a, b) => b.now - a.now).slice(0, 8), series: [], direct: Date.now() };
      } catch { /* bỏ qua */ }
    }
    render();
  }

  function render() {
    const d = data || {}, b = etfSummary(d.btc), e = etfSummary(d.eth), s = stableSummary(d.stable);
    const lastDay = Math.max(b ? b.t : 0, e ? e.t : 0);
    if (d.updated) setFresh($("flowsFresh"), "eod", d.updated, { label: `Cuối ngày${lastDay ? ` · phiên ${new Date(lastDay).toLocaleDateString("vi-VN")}` : ""}`, expect: 30 * 36e5, note: "Farside chốt số sau phiên Mỹ; DefiLlama cập nhật theo ngày" });
    const card = (nm, x, src) => x ? `<div><small>${nm} phiên gần nhất</small><b class="${cls(x.last)}">${usdM(x.last)}</b><small>5 phiên ${usdM(x.d5)} · 20 phiên ${usdM(x.d20)}${src && src.stale ? " · số cũ" : ""}</small></div>` : `<div><small>${nm}</small><b>–</b><small>chưa lấy được</small></div>`;
    $("flowsKpis").innerHTML = card("ETF Bitcoin", b, d.btc) + card("ETF Ethereum", e, d.eth) +
      (s ? `<div><small>Stablecoin đang lưu hành</small><b>${usdB(s.now)}</b><small class="${cls(s.d7)}">7 ngày ${chgB(s.d7)} · 30 ngày ${chgB(s.d30)}</small></div>` : `<div><small>Stablecoin</small><b>–</b><small>chưa lấy được</small></div>`);
    const notes = [etfNote("ETF Bitcoin", b), etfNote("ETF Ethereum", e)].filter(Boolean);
    if (s && s.d30 != null) notes.push(`Stablecoin ${s.d30 >= 0 ? "tăng" : "giảm"} ${chgB(Math.abs(s.d30)).replace(/^[+−]/, "")} USD trong 30 ngày: ${s.d30 >= 0 ? "tiền mới đang chảy vào hệ crypto, là nhiên liệu cho giá." : "tiền đang rút khỏi hệ crypto."}`);
    const fundRow = x => x ? x.funds.slice(0, 6).map(([k, v]) => `<span class="${cls(v)}">${esc(k)} ${usdM(v)}</span>`).join(" · ") : "";
    $("flowsBody").innerHTML = (notes.length ? `<ul class="readout">${notes.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : "") +
      (b ? `<p class="small">Quỹ BTC phiên gần nhất: ${fundRow(b)}</p>` : "") + (e ? `<p class="small">Quỹ ETH phiên gần nhất: ${fundRow(e)}</p>` : "") +
      (d.stable && d.stable.coins ? `<table class="mktab"><thead><tr><th>Stablecoin</th><th>Đang lưu hành</th><th>1 ngày</th><th>7 ngày</th><th>30 ngày</th></tr></thead><tbody>${d.stable.coins.map(c => `<tr><td class="t">${esc(c.sym)}</td><td>${usdB(c.now)}</td>${["d1", "d7", "d30"].map(k => `<td class="${cls(c[k] ? c.now - c[k] : null)}">${c[k] ? chgB(c.now - c[k]) : "–"}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "") +
      (d.errors && d.errors.length ? `<p class="muted small">Nguồn lỗi lần cập nhật gần nhất: ${esc(d.errors.join("; "))}</p>` : "") +
      `<p class="muted small">Đơn vị ETF: USD (tr = triệu, tỷ = tỷ). Nguồn: Farside Investors (quỹ ETF), DefiLlama (stablecoin).</p>`;
    draw();
  }

  // cột tiền vào/ra mỗi ngày của ETF BTC và ETH, 60 phiên gần nhất
  function draw() {
    const { ctx, w, h } = cv; ctx.clearRect(0, 0, w, h);
    const sets = [["BTC", data && data.btc], ["ETH", data && data.eth]].filter(x => x[1] && x[1].rows && x[1].rows.length);
    if (!sets.length) return;
    ctx.font = `10px ${MONO}`; ctx.textBaseline = "middle";
    const gap = 14, hh = (h - gap * (sets.length - 1)) / sets.length;
    sets.forEach(([nm, d], k) => {
      const rows = d.rows.slice(-60), y0 = k * (hh + gap), pad = { l: 66, r: 8, t: 14, b: 4 };
      const m = Math.max(1, ...rows.map(r => Math.abs(r[1]))), mid = y0 + pad.t + (hh - pad.t - pad.b) / 2, sc = (hh - pad.t - pad.b) / 2 / m;
      const bw = (w - pad.l - pad.r) / rows.length;
      ctx.fillStyle = "#a3a3a3"; ctx.textAlign = "left"; ctx.fillText(`ETF ${nm}: tiền vào/ra mỗi phiên (60 phiên)`, pad.l, y0 + 6);
      ctx.textAlign = "right"; ctx.fillText(usdM(m), pad.l - 4, mid - m * sc + 4); ctx.fillText(usdM(-m), pad.l - 4, mid + m * sc - 4);
      ctx.strokeStyle = "#2b2b2b"; ctx.beginPath(); ctx.moveTo(pad.l, Math.round(mid) + 0.5); ctx.lineTo(w - pad.r, Math.round(mid) + 0.5); ctx.stroke();
      rows.forEach((r, i) => { ctx.fillStyle = r[1] >= 0 ? "#1fb57a" : "#e5484d"; const y = r[1] >= 0 ? mid - r[1] * sc : mid; ctx.fillRect(pad.l + i * bw + 1, y, Math.max(1, bw - 2), Math.abs(r[1]) * sc); });
    });
  }

  return {
    show() { load(); clearInterval(timer); timer = setInterval(load, 600e3); },
    hide() { clearInterval(timer); timer = null; },
  };
}
