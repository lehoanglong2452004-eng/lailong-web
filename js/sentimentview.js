// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: thẻ Tâm lý thị trường với hai kim (Crypto, Chứng khoán Mỹ). Cách chấm điểm ở sentiment.js.
// Dữ liệu: vol.json và flows.json (máy chủ GitHub lấy lại mỗi 10 phút và mỗi giờ), Binance và alternative.me lấy thẳng
// trong trình duyệt. Làm mới mỗi 5 phút khi đang mở tab.
import { getJson, liveJson } from "./util.js?v=202611090506";
import { freshTag } from "./fresh.js?v=202611090506";
import { usParts, cryptoParts, gaugeRead, gaugeSvg } from "./sentiment.js?v=202611090506";
import { marketStatus, vnTime } from "./sessions.js?v=202611090506";

const FAPI = "https://fapi.binance.com", D = 864e5;

export function initSentiment({ $, esc }) {
  let vol = null, flows = null, cx = {}, at = 0, timer = null, busy = false;

  async function loadCrypto() {
    const safe = p => p.catch(() => null);
    const [fb, fe, acc, kl, fng] = await Promise.all([
      safe(getJson(`${FAPI}/fapi/v1/fundingRate?symbol=BTCUSDT&limit=100`)), safe(getJson(`${FAPI}/fapi/v1/fundingRate?symbol=ETHUSDT&limit=100`)),
      safe(getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1d&limit=31`)),
      safe(getJson(`${FAPI}/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=90`)),
      safe(getJson("https://api.alternative.me/fng/?limit=40")),
    ]);
    // funding BTC và ETH cùng kỳ (8 giờ): lấy trung bình hai đồng, đơn vị %
    const fm = new Map();
    for (const a of [fb, fe]) for (const x of a || []) { const k = Math.round(+x.fundingTime / 36e5); const o = fm.get(k) || []; o.push(+x.fundingRate * 100); fm.set(k, o); }
    return {
      fund: [...fm].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k * 36e5, v.reduce((s, y) => s + y, 0) / v.length]),
      acc: (acc || []).map(x => [+x.timestamp, +x.longAccount]).sort((a, b) => a[0] - b[0]),
      btc: (kl || []).slice(0, -1).map(k => [+k[6], +k[4]]), // bỏ nến ngày đang chạy dở
      fng: ((fng && fng.data) || []).map(x => [+x.timestamp * 1000, +x.value]).sort((a, b) => a[0] - b[0]),
      ok: { fund: !!(fb || fe), acc: !!acc, btc: !!kl, fng: !!fng },
    };
  }

  async function load() {
    if (busy) return; busy = true;
    try {
      const [v, f, c] = await Promise.all([liveJson("vol.json").catch(() => null), liveJson("flows.json").catch(() => null), loadCrypto().catch(() => ({}))]);
      vol = v || vol; flows = f || flows; cx = c; at = Date.now();
    } finally { busy = false; }
    render();
  }

  const box = (g, title, tag, note) => `<div class="sgw">${gaugeSvg(g.score)}</div><div class="sgi">
    <h4>${esc(title)} ${tag}</h4>
    <div class="sgstate ${g.state.cls}">${g.score == null ? esc(g.state.name) : `${esc(g.state.name.toUpperCase())} · ${esc(g.state.mood)}`}</div>
    ${g.score == null ? "" : `<span class="muted">điểm ${Math.round(g.score)}/100</span>`}
    <ul class="sgwhy">${g.parts.map(p => `<li data-tip="${esc(p.tip)} · điểm ${Math.round(p.score)}/100">${esc(p.label)}<span class="${p.cls}">${esc(p.text)}</span></li>`).join("")}</ul>
    <div class="sghist">${g.hist.filter(h => h[1] != null).map(([k, v]) => `${esc(k)} <b class="${v >= 60 ? "up" : v <= 40 ? "dn" : ""}">${Math.round(v)}</b>`).join(" · ")}</div>
    ${note ? `<p class="note">${note}</p>` : ""}</div>`;

  function render() {
    const now = Date.now();
    const c = gaugeRead(T => cryptoParts({ flows, ...cx }, T), now, [["Hôm qua", now - D], ["Tuần trước", now - 7 * D], ["Tháng trước", now - 30 * D]]);
    const miss = Object.entries(cx.ok || {}).filter(([, ok]) => !ok).map(([k]) => ({ fund: "funding", acc: "tỷ lệ long", btc: "giá BTC", fng: "Fear & Greed" })[k]);
    $("sgCrypto").innerHTML = box(c, "Crypto (BTC, ETH)",
      freshTag("live", at || null, { label: "Vài phút một lần", expect: 20 * 60e3, note: "Funding, tỷ lệ long, giá BTC lấy thẳng từ Binance; Fear & Greed từ alternative.me; ETF chốt sau phiên Mỹ, stablecoin theo ngày. Làm mới mỗi 5 phút khi đang mở tab" }),
      miss.length ? `Chưa lấy được: ${esc(miss.join(", "))}. Điểm tính trên các thành phần còn lại.` : "");
    const items = (vol && vol.items) || [], vix = items.find(x => x.sym === "VIX"), s = vix && vix.series;
    const T = vix && vix.lastT ? Math.max(vix.lastT, s && s.length ? s[s.length - 1][0] : 0) : now;
    const prevT = s && s.length > 1 ? s[s.length - 2][0] : T - D;
    const u = gaugeRead(t => usParts(items, t), T, [["Phiên trước", prevT], ["Tuần trước", T - 7 * D], ["Tháng trước", T - 30 * D]]);
    const st = marketStatus("us"), q = vix && vix.lastT;
    const tag = st.open
      ? freshTag("delay", q || null, { label: `Trễ 15 phút${q ? ` · giá lúc ${vnTime(q)}` : ""}`, expect: 60 * 60e3, note: "Chỉ số của CBOE và S&P 500 qua Yahoo Finance, trễ khoảng 15 phút; máy chủ lấy lại mỗi 10 phút" })
      : freshTag("eod", q || null, { label: `${st.label || "Đóng cửa"}${q ? ` · giá chốt ${vnTime(q)}` : ""}`, expect: 4 * D, note: "Thị trường Mỹ đang nghỉ nên kim đứng yên là bình thường" });
    $("sgUs").innerHTML = box(u, "Chứng khoán Mỹ", tag, items.length ? "" : "Chưa có dữ liệu VIX. Bản web cần chờ lần cập nhật tự động kế tiếp; bản laptop cần khởi động lại máy chủ.");
  }

  return {
    show() { load(); clearInterval(timer); timer = setInterval(load, 300e3); },
    hide() { clearInterval(timer); timer = null; },
  };
}
