// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: mục Thị trường trong tab Phân tích. Hàng hoá phái sinh (contango/backwardation), forex và lãi suất điều hành,
// crypto top 10, công ty và quỹ ETF nắm giữ BTC/ETH, cá voi dùng đòn bẩy trên Hyperliquid, thanh lý lớn trực tiếp.
// Bản web đọc markets.json ở nhánh live (máy chủ GitHub lấy giá Yahoo mỗi 10 phút, lailong/terminal/live.py) hoặc data/,
// bản nào mới hơn; bản trên laptop máy chủ lấy trực tiếp (xem lailong/terminal/markets.py).
// Hàng hoá đuôi USDT và BTC, ETH lấy thẳng từ sàn crypto trong trình duyệt (usdtboard.js), chạy từng giây.
import { getJson, liveJson, fmtUsd, fmtVol, fmtTime, fmtPct } from "./util.js?v=202611090506";
import { setFresh, freshTag } from "./fresh.js?v=202611090506";
import { layoutGroups, heatColor, HEAT_COLORS } from "./treemap.js?v=202611090506";
import { EXCHANGES } from "./exchanges.js?v=202611090506";
import { BOARD, VENUE_SHORT, liveBoard } from "./usdtboard.js?v=202611090506";
import { marketStatus, vnTime } from "./sessions.js?v=202611090506";

const HL = "https://api.hyperliquid.xyz/info";
const LIQ_WS = "wss://fstream.binance.com/market/ws/!forceOrder@arr";
const FLAG = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CNY: "🇨🇳", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭", HKD: "🇭🇰", SGD: "🇸🇬" };
// từ khoá để lọc tin theo từng đồng tiền
const FX_WORDS = {
  USD: /\b(Fed|FOMC|Powell|U\.?S\.?|dollar|Treasur(y|ies)|Wall Street|White House|payrolls?)\b/i,
  EUR: /\b(ECB|Lagarde|euro(zone)?|Germany|German|France|French|Italy|EU)\b/i,
  JPY: /\b(BOJ|BoJ|Bank of Japan|Ueda|yen|Japan(ese)?)\b/i,
  GBP: /\b(BOE|BoE|Bank of England|Bailey|sterling|pound|UK|Britain|British)\b/i,
  CNY: /\b(PBOC|PBoC|yuan|renminbi|China|Chinese|Beijing)\b/i,
  AUD: /\b(RBA|Reserve Bank of Australia|Australia(n)?|Aussie)\b/i,
  CAD: /\b(Bank of Canada|BoC|Canada|Canadian|loonie)\b/i,
  CHF: /\b(SNB|Swiss|franc|Switzerland)\b/i,
  HKD: /\b(HKMA|Hong Kong)\b/i,
  SGD: /\b(MAS|Singapore)\b/i,
};
const FX_NOTE = {
  USD: "Giá là chỉ số DXY (USD so với rổ 6 đồng tiền lớn).",
  HKD: "HKD neo vào USD trong biên 7,75 – 7,85 nên lãi suất HKMA đi theo Fed.",
  SGD: "Singapore không dùng lãi suất điều hành: MAS điều chỉnh tỷ giá SGD trong một biên độ, nên không có mức lãi suất neo.",
  CNY: "CNY được quản lý quanh tỷ giá trung tâm PBOC công bố mỗi sáng; lãi suất là LPR 1 năm.",
};

// tỷ trọng giao dịch ngoại hối theo đồng tiền (BIS, %): làm cỡ ô cho bản đồ nhiệt forex
const FX_SHARE = { USD: 88, EUR: 31, JPY: 17, GBP: 13, CNY: 7, AUD: 6.4, CAD: 6.2, CHF: 5.2, HKD: 2.6, SGD: 2.4 };
const FX_REGION = { USD: "Đô la Mỹ", EUR: "Châu Âu", GBP: "Châu Âu", CHF: "Châu Âu", JPY: "Châu Á", CNY: "Châu Á", HKD: "Châu Á", SGD: "Châu Á", AUD: "Hàng hoá", CAD: "Hàng hoá" };
// % thay đổi sau `days` phiên từ chuỗi giá đóng cửa ngày (1 phiên thì dùng chg có sẵn)
export function chgOver(x, days) {
  if (days <= 1 || !Array.isArray(x.closes) || x.closes.length <= days) return x.chg;
  const c = x.closes, a = c[c.length - 1 - days], b = c[c.length - 1];
  return a > 0 ? (b / a - 1) * 100 : x.chg;
}
// các ô của bản đồ nhiệt theo lớp tài sản: { sym, group, v (cỡ ô), chg (màu), href? }
export function heatItems(cls, mk, days = 1) {
  if (cls === "comm") return ((mk && mk.commodities) || []).map(c => ({ sym: c.name, sub: c.code, group: c.group || "Khác", v: (c.price || 0) * (c.volume || 0) * (c.mult || 1), chg: chgOver(c, days) }));
  if (cls === "stocks") return ((mk && mk.stocks) || []).map(x => ({ sym: x.code, group: x.sector || "Khác", v: x.value || 0, chg: chgOver(x, days) }));
  if (cls === "fx") return ((mk && mk.fx) || []).map(f => ({ sym: f.code, sub: f.name, group: FX_REGION[f.code] || "Khác", v: FX_SHARE[f.code] || 1, chg: fxStrength({ ...f, chg: chgOver(f, days) }) }));
  return [];
}

// khoảng cách từ giá hiện tại tới giá thanh lý, % (dương = còn xa)
export function liqDistance(p) {
  if (!p.liq || !p.size || !p.value) return null;
  const mark = p.value / p.size;
  return p.side === "LONG" ? (mark - p.liq) / mark * 100 : (p.liq - mark) / mark * 100;
}

// đồng tiền mạnh lên (+) hay yếu đi (-) so với USD: EURUSD=X là giá của EUR, JPY=X là giá USD tính bằng JPY
export const fxStrength = f => f.chg == null ? null : f.pair === "DXY" || /USD=X$/.test(f.pair) ? f.chg : -f.chg;
export const fxPairName = f => f.pair === "DXY" ? "DXY" : /USD=X$/.test(f.pair) ? `${f.code}/USD` : `USD/${f.code}`;

// tổng vị thế cá voi theo coin: long, short, chênh lệch
export function whaleBias(whales, coins = ["BTC", "ETH"]) {
  const out = Object.fromEntries(coins.map(c => [c, { coin: c, long: 0, short: 0, nLong: 0, nShort: 0 }]));
  for (const w of whales) for (const p of w.positions || []) {
    const o = out[p.coin]; if (!o) continue;
    if (p.side === "LONG") { o.long += p.value; o.nLong++; } else { o.short += p.value; o.nShort++; }
  }
  return coins.map(c => ({ ...out[c], net: out[c].long - out[c].short }));
}

// tin liên quan tới một đồng tiền (mới nhất trước)
export function currencyNews(items, code, n = 8) {
  const re = FX_WORDS[code]; if (!re) return [];
  return items.filter(x => ["econ", "fin", "geo"].includes(x.cat) && re.test(x.title)).slice(0, n);
}

// tóm tắt dòng tiền ETF: các ngày đã có số, tổng 5 và 20 phiên
export function etfSummary(etf) {
  if (!etf || !etf.days || !etf.days.length) return null;
  const ti = etf.funds.length - 1, days = etf.days.filter(d => d.flows[ti] != null);
  const sum = k => days.slice(-k).reduce((s, d) => s + d.flows[ti], 0);
  return { days, last: days[days.length - 1], d5: sum(5), d20: sum(20), ti };
}

const spark = (vals, w = 90, h = 22) => {
  const v = (vals || []).filter(x => x != null); if (v.length < 2) return "";
  const lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(h - 2 - (x - lo) / r * (h - 4)).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${v[v.length - 1] >= v[0] ? "var(--buy)" : "var(--sell)"}" stroke-width="1.4"/></svg>`;
};
const cls = v => v > 0 ? "up" : v < 0 ? "dn" : "";
const px = v => v == null ? "–" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toPrecision(4);
const short = a => a.slice(0, 6) + "…" + a.slice(-4);
const mflow = v => v == null ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(1)}M`;

export function initMarkets({ $, esc }) {
  let mk = null, wh = null, news = null, cal = null, fxSel = "USD", trCoin = "btc", openW = null, live = false;
  let showAll = false, sock = null, liqs = [], liqMin = 100e3, timer = null;
  let hmDays = 1, hmTimer = null, ubVenue = "BINANCE";
  try { ubVenue = sessionStorage.getItem("lailong.ubvenue") || ubVenue; } catch { /* bỏ qua */ }
  const board = liveBoard(() => { renderBoard(); paintLive(); });
  board.setVenue(ubVenue);
  try { liqMin = +sessionStorage.getItem("lailong.liqmin") || liqMin; } catch { /* bỏ qua */ }

  async function load() {
    const get = async u => { try { return await getJson(`${u}?t=${Math.floor(Date.now() / 60e3)}`); } catch { return null; } };
    const [m, w, n, c] = await Promise.all([liveJson("markets.json").catch(() => null), get("data/whales.json"), get("data/news.json"), get("data/calendar.json")]);
    if (m) mk = m; if (w && !live) wh = w; if (n) news = n; if (c) cal = c;
    render();
  }

  function renderCommodities() {
    const el = $("cmdBody"); if (!el) return;
    if (!mk || !mk.commodities) { el.innerHTML = `<div class="empty">Chưa tải được dữ liệu hàng hoá.</div>`; return; }
    const rows = showAll ? mk.commodities : mk.commodities.slice(0, 10);
    $("cmdAll").textContent = showAll ? "Chỉ top 10" : `Xem cả ${mk.commodities.length}`;
    el.innerHTML = `<table class="mktab"><thead><tr><th>#</th><th>Hàng hoá</th><th>Giá</th><th>Ngày</th><th>1 tháng</th>
      <th data-tip="Giá trị danh nghĩa giao dịch trong ngày của hợp đồng gần nhất = khối lượng × giá × hệ số hợp đồng">Giá trị GD</th>
      <th>HĐ gần</th><th>HĐ kế tiếp</th><th data-tip="Chênh lệch giá HĐ kế tiếp so với HĐ gần, và quy ra % mỗi năm">Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>` +
      rows.map(c => {
        const [a, b] = c.legs || [], cv = c.curve;
        const leg = l => l ? `<b>${esc(l.contract)}</b> <small class="muted">${esc(l.month)}</small><br>${px(l.price)} <small class="muted">KL ${fmtVol(l.volume)}</small>` : "–";
        const st = !cv ? "–" : cv.state === "contango"
          ? `<span class="tag ctg" data-tip="Contango: hợp đồng xa đắt hơn hợp đồng gần. Hàng đang dư, người giữ hàng phải tốn phí lưu kho và lãi vốn. Bên giữ long cuộn sang tháng sau sẽ bị lỗ phần chênh lệch.">Contango</span>`
          : `<span class="tag bwd" data-tip="Backwardation: hợp đồng gần đắt hơn hợp đồng xa. Thị trường đang thiếu hàng ngay lúc này, người mua chịu trả thêm để có hàng sớm. Thường là dấu hiệu cầu mạnh.">Backwardation</span>`;
        return `<tr><td>${c.rank}</td><td class="t"><b>${esc(c.name)}</b> <small class="muted">${esc(c.code)} · ${esc(c.group)}</small></td>
          <td>${px(c.price)} <small class="muted">${esc(c.unit)}</small></td><td class="${cls(c.chg)}">${fmtPct(c.chg)}</td><td>${spark(c.closes)}</td>
          <td>${fmtUsd(c.notional)}</td><td>${leg(a)}</td><td>${leg(b)}</td>
          <td class="${cv ? cls(cv.spread) : ""}">${cv ? `${fmtPct(cv.pct)}<br><small>${fmtPct(cv.annual, 1)}/năm</small>` : "–"}</td><td>${st}</td></tr>`;
      }).join("") + `</tbody></table>`;
  }

  function renderFx() {
    const el = $("fxBody"); if (!el) return;
    if (!mk || !mk.fx) { el.innerHTML = `<div class="empty">Chưa tải được dữ liệu forex.</div>`; return; }
    el.innerHTML = `<table class="mktab fxtab"><thead><tr><th>Đồng tiền</th><th>Tỷ giá</th><th>Ngày</th><th>1 tháng</th><th>Lãi suất</th><th>Lần đổi gần nhất</th><th>Ngân hàng TW</th></tr></thead><tbody>` +
      mk.fx.map(f => {
        const r = f.rate, d = r && r.prev ? r.rate - r.prev.rate : null;
        const chg = d == null ? "–" : `<span class="${cls(d)}">${d > 0 ? "▲ tăng" : d < 0 ? "▼ giảm" : "giữ"} ${Math.abs(d * 100).toFixed(0)} điểm</span> <small class="muted">từ ${esc(r.since.split("-").reverse().join("/"))}</small>`;
        return `<tr class="${f.code === fxSel ? "sel" : ""}" data-fx="${f.code}"><td class="t">${FLAG[f.code] || ""} <b>${f.code}</b> <small class="muted">${esc(f.name)}</small></td>
          <td>${px(f.price)} <small class="muted">${esc(fxPairName(f))}</small></td><td class="${cls(fxStrength(f))}">${fmtPct(f.chg)}</td>
          <td>${spark(f.closes)}</td><td><b>${r ? r.rate.toFixed(2) + "%" : "–"}</b></td><td>${chg}</td><td>${esc(f.bank)}</td></tr>`;
      }).join("") + `</tbody></table><p class="note">Cột "Ngày" tô xanh khi đồng tiền đó mạnh lên so với USD (với USD là DXY tăng). Lãi suất từ BIS, cập nhật theo ngày. Bấm một dòng để xem tin và lịch của nước đó.</p>`;
    renderFxDetail();
  }

  function renderFxDetail() {
    const el = $("fxDetail"); if (!el || !mk) return;
    const f = mk.fx.find(x => x.code === fxSel); if (!f) { el.innerHTML = ""; return; }
    const evs = cal ? cal.events.filter(e => e.country === f.code && e.t > Date.now() - 3 * 864e5).slice(0, 12) : [];
    const items = news ? currencyNews(news.items, f.code, 10) : [];
    el.innerHTML = `<div class="mh">${FLAG[f.code] || ""} ${f.code}: ${esc(f.name)} · ${esc(f.bank)}${f.rate ? ` · lãi suất ${f.rate.rate.toFixed(2)}%` : ""}</div>
      ${FX_NOTE[f.code] ? `<p class="note">${esc(FX_NOTE[f.code])}</p>` : ""}
      <div class="fxcols"><div><div class="mh">Lịch dữ liệu</div>${evs.length ? `<table class="mktab"><tbody>${evs.map(e => `<tr class="${e.t < Date.now() ? "muted" : ""}"><td>${fmtTime(e.t, true).slice(0, 11)}</td><td class="t"><span class="imp ${e.impact === "High" ? "hi" : "md"}"></span>${esc(e.title)}</td><td><small>dự báo</small> ${esc(e.forecast || "-")}</td><td><small>trước</small> ${esc(e.previous || "-")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Không có tin mạnh hoặc vừa trong tuần.</div>`}</div>
      <div><div class="mh">Tin liên quan</div>${items.length ? items.map(x => `<a class="newsit" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer"><span class="nt">${fmtTime(x.t, true).slice(0, 11)} · ${esc(x.source)}</span>${esc(x.title)}</a>`).join("") : `<div class="empty">Chưa có tin nào nhắc tới ${f.code} trong 24 giờ qua.</div>`}</div></div>`;
  }

  function renderCrypto() {
    const el = $("cryBody"); if (!el) return;
    const top = mk && mk.crypto && mk.crypto.top;
    if (!top) { el.innerHTML = `<div class="empty">Chưa tải được dữ liệu crypto.</div>`; return; }
    const total = top.reduce((s, c) => s + c.market_cap, 0);
    el.innerHTML = `<table class="mktab"><thead><tr><th>#</th><th>Coin</th><th>Giá</th><th>24 giờ</th><th>Vốn hoá</th><th data-tip="Phần trăm vốn hoá trong nhóm top 10">Tỷ trọng</th><th>KL 24 giờ</th></tr></thead><tbody>` +
      top.map((c, i) => `<tr class="${["btc", "eth"].includes(c.symbol) ? "focus" : ""}"><td>${i + 1}</td><td class="t"><b>${esc(c.symbol.toUpperCase())}</b> <small class="muted">${esc(c.name)}</small></td>
        <td>$${px(c.current_price)}</td><td class="${cls(c.price_change_percentage_24h)}">${fmtPct(c.price_change_percentage_24h)}</td><td>${fmtUsd(c.market_cap)}</td>
        <td><span class="bar" style="--w:${(c.market_cap / total * 100).toFixed(1)}%"></span>${(c.market_cap / total * 100).toFixed(1)}%</td><td>${fmtUsd(c.total_volume)}</td></tr>`).join("") + `</tbody></table>`;
  }

  function renderTreasury() {
    const el = $("trBody"); if (!el) return;
    const t = mk && mk.crypto && mk.crypto["treasury_" + (trCoin === "btc" ? "bitcoin" : "ethereum")];
    for (const b of $("trTabs").children) b.classList.toggle("on", b.dataset.tr === trCoin);
    if (!t) { el.innerHTML = `<div class="empty">Chưa tải được danh sách công ty.</div>`; return; }
    const U = trCoin.toUpperCase();
    el.innerHTML = `<div class="kpis"><div><small>Tổng ${U} các công ty giữ</small><b>${fmtVol(t.total)} ${U}</b></div><div><small>Giá trị</small><b>${fmtUsd(t.value)}</b></div><div><small>Tỷ lệ trên tổng cung</small><b>${t.dominance}%</b></div></div>
      <div class="tablewrap"><table class="mktab"><thead><tr><th>Công ty</th><th>Mã</th><th>Nước</th><th>Số ${U}</th><th>Giá trị</th><th>% tổng cung</th></tr></thead><tbody>` +
      t.companies.map(c => `<tr><td class="t">${esc(c.name)}</td><td>${esc(c.symbol)}</td><td>${esc(c.country || "")}</td><td>${fmtVol(c.total_holdings)}</td><td>${fmtUsd(c.total_current_value_usd)}</td><td>${c.percentage_of_total_supply.toFixed(3)}%</td></tr>`).join("") + `</tbody></table></div>`;
  }

  function posChip(p) {
    const d = liqDistance(p), near = d != null && d < 10;
    return `<span class="pchip ${p.side === "LONG" ? "lg" : "sh"}${near ? " near" : ""}" data-tip="Vào lệnh ${px(p.entry)}, lãi/lỗ đang mở ${fmtUsd(p.pnl)}${p.liq ? `, giá thanh lý ${px(p.liq)}` : ""}">${esc(p.coin)} ${p.side === "LONG" ? "LONG" : "SHORT"} ${p.lev || "?"}x ${fmtUsd(p.value)}${d != null ? ` · cách thanh lý ${d > 100 ? "trên 100" : d.toFixed(0)}%` : ""}</span>`;
  }

  function renderWhales() {
    const el = $("whBody"); if (!el) return;
    if (!wh || !wh.whales) { el.innerHTML = `<div class="empty">Chưa tải được dữ liệu cá voi.</div>`; return; }
    setFresh($("whUpd"), live ? "live" : "delay", wh.updated, { label: live ? "Trực tiếp lúc bấm" : "Bản chụp", expect: live ? 15 * 60e3 : 2 * 3600e3, note: live ? "Vị thế lấy thẳng từ Hyperliquid lúc bấm nút, không tự làm mới" : "Bản chụp do máy chủ lấy định kỳ; bấm Lấy lại trực tiếp để lấy mới từ Hyperliquid" });
    const bias = whaleBias(wh.whales);
    const lq = wh.whales.flatMap(w => (w.liquidations || []).map(l => ({ ...l, addr: w.addr }))).sort((a, b) => b.t - a.t);
    el.innerHTML = `<div class="kpis">${bias.map(b => `<div data-tip="${b.nLong} ví long, ${b.nShort} ví short trong nhóm này"><small>Cá voi ${b.coin}: long ${fmtUsd(b.long)} / short ${fmtUsd(b.short)}</small><b class="${cls(b.net)}">${b.net >= 0 ? "Nghiêng LONG" : "Nghiêng SHORT"} ${fmtUsd(Math.abs(b.net))}</b></div>`).join("")}</div>
      <div class="tablewrap whwrap"><table class="mktab whtab"><thead><tr><th>Ví</th><th>Tài khoản</th><th data-tip="Tổng giá trị các vị thế đang mở">Vị thế mở</th><th data-tip="Vị thế mở chia cho tài khoản">Đòn bẩy thực</th><th>Lãi/lỗ hôm nay</th><th>Vị thế lớn nhất</th></tr></thead><tbody>` +
      wh.whales.map(w => {
        const open = openW === w.addr, ps = w.positions || [];
        return `<tr class="wrow${open ? " sel" : ""}" data-w="${w.addr}"><td class="t"><a href="https://hypurrscan.io/address/${w.addr}" target="_blank" rel="noopener noreferrer">${esc(w.name || short(w.addr))}</a></td>
          <td>${fmtUsd(w.account)}</td><td>${fmtUsd(w.exposure)}</td><td>${w.account ? (w.exposure / w.account).toFixed(1) + "x" : "–"}</td>
          <td class="${cls(w.pnlDay)}">${w.pnlDay == null ? "–" : fmtUsd(w.pnlDay)}</td><td class="t">${ps.slice(0, 2).map(posChip).join(" ")}${ps.length > 2 ? ` <small class="muted">+${ps.length - 2} vị thế</small>` : ""}</td></tr>` +
          (open ? `<tr class="wdet"><td colspan="6">${ps.map(posChip).join(" ") || `<span class="muted">Không còn vị thế mở.</span>`}${(w.liquidations || []).length ? `<div class="mh">Bị thanh lý 7 ngày qua</div>${w.liquidations.map(l => `<span class="pchip near">${fmtTime(l.t, true).slice(0, 11)} ${esc(l.coin)} ${px(l.px)} × ${fmtVol(l.size)}</span>`).join(" ")}` : ""}</td></tr>` : "");
      }).join("") + `</tbody></table></div>
      <div class="mh">Cá voi bị thanh lý 7 ngày qua</div>${lq.length ? lq.slice(0, 12).map(l => `<span class="pchip near" data-tip="${esc(l.addr)}">${fmtTime(l.t, true).slice(0, 11)} ${esc(short(l.addr))} ${esc(l.coin)} ${esc(l.dir || "")} ${px(l.px)} × ${fmtVol(l.size)} (${fmtUsd(l.px * l.size)})</span>`).join(" ") : `<span class="muted">Không ví nào trong nhóm bị thanh lý tuần này.</span>`}`;
  }

  // lấy lại vị thế các ví ngay từ Hyperliquid (trình duyệt gọi thẳng, không cần máy chủ)
  async function refreshLive() {
    if (!wh) return;
    const btn = $("whLive"); btn.disabled = true; btn.textContent = "Đang lấy…";
    const one = async w => {
      try {
        const r = await fetch(HL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "clearinghouseState", user: w.addr }) });
        const st = await r.json();
        const positions = (st.assetPositions || []).map(a => a.position).filter(p => +p.szi).map(p => ({
          coin: p.coin, side: +p.szi > 0 ? "LONG" : "SHORT", size: Math.abs(+p.szi), value: +p.positionValue, entry: +p.entryPx,
          liq: p.liquidationPx ? +p.liquidationPx : null, lev: p.leverage && p.leverage.value, pnl: +p.unrealizedPnl,
        })).sort((a, b) => b.value - a.value);
        return { ...w, positions, account: +(st.marginSummary || {}).accountValue || w.account, exposure: positions.reduce((s, p) => s + p.value, 0) };
      } catch { return w; }
    };
    const out = [];
    for (let i = 0; i < wh.whales.length; i += 8) out.push(...await Promise.all(wh.whales.slice(i, i + 8).map(one)));
    wh = { updated: Date.now(), whales: out.sort((a, b) => b.exposure - a.exposure) }; live = true;
    btn.disabled = false; btn.textContent = "Lấy lại trực tiếp";
    renderWhales();
  }

  // thanh lý lớn trên toàn sàn Binance Futures, nhận trực tiếp
  function startLiq() {
    if (sock) return;
    try { sock = new WebSocket(LIQ_WS); } catch { return; }
    sock.onopen = () => renderLiq();
    sock.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      for (const e of [].concat(m)) {
        const o = e.o || (e.data && e.data.o); if (!o) continue;
        const usd = (+o.ap || +o.p) * (+o.z || +o.q); if (usd < liqMin) continue;
        liqs.unshift({ t: o.T, sym: o.s, side: o.S === "SELL" ? "long" : "short", px: +o.ap || +o.p, usd });
        if (liqs.length > 60) liqs.length = 60;
      }
      renderLiq();
    };
    sock.onclose = () => { sock = null; if (!$("view-markets").hidden) setTimeout(startLiq, 5000); };
  }
  function renderLiq() {
    const el = $("liqBody"); if (!el) return;
    const on = sock && sock.readyState === 1;
    setFresh($("fsLiq"), on ? "live" : "delay", null, { label: on ? "Trực tiếp" : "Đang kết nối…", note: "Luồng WebSocket thanh lý của Binance Futures, từng lệnh ngay khi xảy ra" });
    el.innerHTML = !liqs.length ? `<div class="empty">Đang chờ lệnh thanh lý từ ${fmtUsd(liqMin)} trở lên…</div>` :
      `<table class="mktab"><tbody>${liqs.map(l => `<tr><td>${fmtTime(l.t)}</td><td class="t"><b>${esc(l.sym)}</b></td><td class="${l.side === "long" ? "dn" : "up"}">${l.side === "long" ? "LONG bị thanh lý" : "SHORT bị thanh lý"}</td><td>${px(l.px)}</td><td><b>${fmtUsd(l.usd)}</b></td></tr>`).join("")}</tbody></table>`;
  }

  // ---------- bản đồ nhiệt: 4 nhóm, mỗi nhóm ghi nguồn, giờ cập nhật và trạng thái ----------
  // % thay đổi theo tuần, tháng của hàng hoá đuôi USDT và BTC, ETH: tính từ nến ngày của sàn đang chọn, nhớ 10 phút
  const dayCache = new Map();
  async function boardDays(days) {
    const V = board.venue === "ALL" ? "BINANCE" : board.venue, out = {};
    await Promise.all(BOARD.map(async ([c]) => {
      const k = `${V}:${c}`; let e = dayCache.get(k);
      if (!e || Date.now() - e.t > 600e3) {
        try { e = { t: Date.now(), bars: await EXCHANGES[V].klines(c + "USDT", "1d", 25) }; } catch { e = { t: Date.now(), bars: [] }; }
        dayCache.set(k, e);
      }
      const b = e.bars, r = board.data().rows[c];
      if (b.length > days && r && r.price) out[c] = (r.price / b[b.length - 1 - days].c - 1) * 100;
    }));
    return out;
  }
  // nhãn trạng thái cho nhóm lấy từ Yahoo: đang nghỉ thì "Đóng cửa · mở lại …", đang mở thì "Trễ … · giá lúc …"
  function yahooTag(kind, list, delay) {
    const qt = Math.max(0, ...(list || []).map(x => x.qt || 0)), st = marketStatus(kind);
    if (!qt && !(mk && mk.updated)) return freshTag("delay", null, { label: "Đang tải…" });
    if (!st.open) return freshTag("eod", null, { label: `${st.label}${qt ? ` · giá chốt ${vnTime(qt)}` : ""}`, note: "Thị trường đang nghỉ nên giá đứng yên là bình thường" });
    return freshTag("delay", qt || mk.updated, { label: `Trễ ${delay}${qt ? ` · giá lúc ${vnTime(qt)}` : ""}`, expect: 40 * 60e3, note: `Yahoo Finance chậm ${delay}; máy chủ lấy lại mỗi 10 phút. Đỏ khi giá cũ hơn 40 phút dù thị trường đang mở` });
  }
  function liveTag() {
    const d = board.data(), vn = d.venue === "ALL" ? "gộp các sàn" : VENUE_SHORT[d.venue];
    if (!d.at) return freshTag("delay", null, { label: d.errors.length ? `Lỗi: ${d.errors.join(", ")}` : `Đang kết nối ${vn}…` });
    return freshTag("live", d.at, { label: d.live ? "Trực tiếp" : "Vài giây một lần", expect: 90e3, note: `Lấy thẳng từ ${vn} trong trình duyệt` });
  }
  const tilesHtml = (items, W, H, scale, href) => {
    const { groups, tiles } = layoutGroups(items, W, H), pct = (a, b) => (a / b * 100).toFixed(3) + "%";
    return tiles.map(t => {
      const m = Math.min(t.w, t.h), fs = m > 140 ? 24 : m > 90 ? 18 : m > 56 ? 14 : m > 34 ? 11 : 0;
      const ch = t.chg == null ? "–" : (t.chg >= 0 ? "+" : "") + t.chg.toFixed(2) + "%";
      const tip = `${t.sym}${t.sub ? " · " + t.sub : ""}: ${ch}${href ? ". Bấm để mở trong Terminal" : ""}`;
      const tag = t.href ? "a" : "div", hr = t.href ? ` href="${esc(t.href)}"` : "";
      return `<${tag}${hr} class="hmtile" style="left:${pct(t.x, W)};top:${pct(t.y, H)};width:${pct(t.w, W)};height:${pct(t.h, H)};background:${heatColor(t.chg, scale)}" data-tip="${esc(tip)}">${fs ? `<b style="font-size:${fs}px">${esc(t.sym)}</b>${fs >= 11 && t.h > 30 ? `${t.sub && t.h > 64 ? `<small>${esc(t.sub)}</small>` : ""}<span style="font-size:${Math.max(10, Math.round(fs * 0.62))}px">${ch}</span>` : ""}` : ""}</${tag}>`;
    }).join("") + (groups.length > 1 ? groups.map(g => `<span class="hmgroup" style="left:${pct(g.x, W)};top:${pct(g.y, H)}">${esc(g.name)}</span>`).join("") : "");
  };
  let hmBusy = false;
  async function renderHeat() {
    const box = $("hm4"); if (!box || hmBusy) return;
    for (const b of $("hmDays").children) b.classList.toggle("on", +b.dataset.hd === hmDays);
    hmBusy = true;
    let periodChg = null;
    try { if (hmDays > 1) periodChg = await boardDays(hmDays); } finally { hmBusy = false; }
    const d = board.data(), V = d.venue === "ALL" ? "BINANCE" : d.venue;
    const boardItems = grp => BOARD.filter(x => x[2] === grp).map(([c, name]) => {
      const r = d.rows[c]; if (!r || !r.price) return null;
      return { sym: grp === "crypto" ? c : name, sub: c + "USDT", group: grp, v: Math.sqrt(r.vol || 1), // căn bậc hai để ô nhỏ vẫn đọc được
      chg: hmDays > 1 ? (periodChg && periodChg[c]) : r.chg, href: `?ex=${V}&s=${c}USDT&v=terminal` };
    }).filter(Boolean);
    const groups = [
      { id: "comm", name: "Hàng hoá", tag: liveTag(), src: `${d.venue === "ALL" ? "Gộp các sàn" : VENUE_SHORT[d.venue]} · XAUUSDT, CLUSDT… · đổi sàn ở bảng bên dưới`, items: boardItems("comm"), scale: 3 * Math.sqrt(hmDays), href: true },
      { id: "crypto", name: "Crypto", tag: liveTag(), src: `${d.venue === "ALL" ? "Gộp các sàn" : VENUE_SHORT[d.venue]} · chỉ BTC và ETH`, items: boardItems("crypto"), scale: 5 * Math.sqrt(hmDays), href: true },
      { id: "stocks", name: "Chứng khoán Mỹ", tag: yahooTag("us", mk && mk.stocks, "15 phút"), src: "Yahoo Finance · 48 cổ phiếu lớn · cỡ ô: giá trị giao dịch", items: heatItems("stocks", mk, hmDays), scale: 2.5 * Math.sqrt(hmDays) },
      { id: "fx", name: "Forex", tag: yahooTag("fx", mk && mk.fx, "vài phút"), src: "Yahoo Finance · mạnh lên (xanh) hay yếu đi (đỏ) so với USD", items: heatItems("fx", mk, hmDays), scale: 0.8 * Math.sqrt(hmDays) },
    ];
    // giữ khung các nhóm, chỉ thay ô bên trong để không nháy
    if (box.children.length !== groups.length) box.innerHTML = groups.map(g => `<div class="hmg hmg-${g.id}"><div class="hmgh"><b>${esc(g.name)}</b><span class="hmgtag"></span></div><div class="hmgs"></div><div class="hmbox"></div></div>`).join("");
    groups.forEach((g, i) => {
      const el = box.children[i], area = el.querySelector(".hmbox");
      el.querySelector(".hmgtag").innerHTML = g.tag; el.querySelector(".hmgs").textContent = g.src;
      const W = area.clientWidth || 300, H = area.clientHeight || 300;
      area.innerHTML = g.items.length ? tilesHtml(g.items, W, H, g.scale, g.href) : `<div class="empty">${g.id === "comm" || g.id === "crypto" ? "Đang lấy giá…" : "Chưa tải được dữ liệu."}</div>`;
    });
    const th = [-0.6, -0.3, -0.06, 0, 0.06, 0.3, 0.6], sc = 3 * Math.sqrt(hmDays);
    $("hmLegend").innerHTML = HEAT_COLORS.map((c, i) => `<span style="background:${c}">${i === 3 ? "0" : (th[i] > 0 ? "+" : "−") + Math.abs(th[i] * sc).toFixed(1) + "%"}</span>`).join("") +
      `<small class="muted">Thang màu của nhóm Hàng hoá; mỗi nhóm có thang riêng theo độ biến động thường gặp. ${hmDays === 1 ? "Ngày: thay đổi 24 giờ (hàng hoá, crypto) hoặc so với phiên trước (cổ phiếu, forex)" : `${hmDays === 5 ? "Tuần" : "Tháng"}: thay đổi ${hmDays} phiên`}. Bấm ô hàng hoá, crypto để mở Terminal.</small>`;
  }
  // chỉ cập nhật nhãn và ô của 2 nhóm chạy trực tiếp, không vẽ lại cả bản đồ mỗi giây
  let paintT = 0, paintLater = null;
  function paintLive() {
    if (!shown || paintLater) return;
    const wait = Math.max(0, 2000 - (Date.now() - paintT)); // tối đa một lần mỗi 2 giây, lần cuối luôn được vẽ
    paintLater = setTimeout(() => { paintLater = null; paintT = Date.now(); renderHeat(); }, wait);
  }

  // ---------- bảng hàng hoá và crypto đuôi USDT ----------
  const fundTxt = (f, h) => f == null ? "–" : `${f >= 0 ? "+" : ""}${(f * 100).toFixed(4)}%<small class="muted"> /${h}h</small>`;
  function renderBoard() {
    const el = $("ubBody"); if (!el) return;
    const d = board.data(), all = d.venue === "ALL";
    for (const b of $("ubVenue").children) b.classList.toggle("on", b.dataset.ub === d.venue);
    setFresh($("fsUb"), d.at ? "live" : "delay", d.at || null, { label: d.at ? (d.live ? "Trực tiếp" : "Cập nhật vài giây một lần") : d.errors.length ? `Lỗi: ${d.errors.join(", ")}` : "Đang kết nối…", expect: 90e3,
      note: d.venue === "BINANCE" ? "Giá, % 24 giờ, khối lượng chạy từng giây qua WebSocket Binance; funding và OI hỏi lại mỗi phút" : all ? "Hỏi lại cả 4 sàn mỗi 20 giây" : "Hỏi lại bảng giá của sàn mỗi 10 đến 15 giây" });
    const V = all ? "BINANCE" : d.venue;
    el.innerHTML = `<table class="mktab ubtab"><thead><tr><th>Mã</th><th>Tên</th><th>Giá</th><th>24 giờ</th><th data-tip="Tổng giá trị giao dịch 24 giờ (USD)">KL 24 giờ</th><th data-tip="Hợp đồng mở: tổng giá trị các vị thế đang mở (USD)">Hợp đồng mở (OI)</th><th data-tip="${all ? "Trung bình theo OI, quy về kỳ 8 giờ" : "Funding của kỳ gần nhất; /8h là mỗi 8 giờ, /1h là mỗi giờ"}">Funding${all ? " (quy về 8 giờ)" : ""}</th>${all ? "<th>Sàn có mã</th>" : ""}</tr></thead><tbody>` +
      BOARD.map(([c, name]) => {
        const r = d.rows[c];
        if (!r || !r.price) return `<tr class="muted"><td class="t"><b>${c}USDT</b></td><td class="t">${esc(name)}</td><td colspan="${all ? 6 : 5}" class="t muted">${d.at ? `${all ? "Không sàn nào" : esc(VENUE_SHORT[d.venue])} có mã này` : "Đang lấy…"}</td></tr>`;
        return `<tr class="click" data-ubs="${c}USDT"><td class="t"><a href="?ex=${V}&s=${c}USDT&v=terminal"><b>${c}USDT</b></a></td><td class="t">${esc(name)}</td><td><b>${px(r.price)}</b></td><td class="${cls(r.chg)}">${fmtPct(r.chg)}</td><td>${r.vol ? fmtUsd(r.vol) : "–"}</td><td>${r.oi ? fmtUsd(r.oi) : "–"}</td><td class="${cls(r.fund)}">${fundTxt(r.fund, r.fundH)}</td>${all ? `<td class="t"><small>${(r.venues || []).map(v => VENUE_SHORT[v]).join(", ")}</small></td>` : ""}</tr>`;
      }).join("") + `</tbody></table><p class="note">Bấm một dòng để mở mã đó ở Terminal (sàn ${esc(VENUE_SHORT[V])}). Funding dương: phe long trả phí cho phe short, tức đang đông người long. Hợp đồng hàng hoá chạy 24/7 trên sàn crypto kể cả khi CME nghỉ, nên cuối tuần giá vẫn chạy.</p>`;
  }

  function render() {
    renderHeat(); renderBoard();
    renderCommodities(); renderFx(); renderCrypto(); renderTreasury(); renderWhales(); renderLiq();
    const t = mk && mk.updated, snap = "Bản trên web lấy lại mỗi 10 phút (giá), kỳ hạn và lãi suất mỗi giờ; bản trên laptop lấy mới tối đa mỗi 15 phút";
    $("mkUpd").innerHTML = mk ? yahooTag("cme", mk.commodities, "10–15 phút") : "";
    $("fsFx").innerHTML = mk ? yahooTag("fx", mk.fx, "vài phút") : "";
    setFresh($("fsCry"), "delay", t, { label: "Bản chụp", note: `CoinGecko, giá trung bình nhiều sàn. ${snap}. Giá trực tiếp xem ở Terminal` });
    setFresh($("fsTr"), "eod", t, { note: "CoinGecko: lượng coin các công ty niêm yết công bố nắm giữ, cập nhật khi công ty báo cáo" });
  }

  $("cmdAll").onclick = () => { showAll = !showAll; renderCommodities(); };
  $("ubVenue").onclick = e => { const b = e.target.closest("[data-ub]"); if (!b) return; ubVenue = b.dataset.ub; try { sessionStorage.setItem("lailong.ubvenue", ubVenue); } catch { /* bỏ qua */ } board.setVenue(ubVenue); renderBoard(); renderHeat(); };
  $("ubBody").onclick = e => { if (e.target.closest("a")) return; const r = e.target.closest("[data-ubs]"); if (r) location.href = `?ex=${board.venue === "ALL" ? "BINANCE" : board.venue}&s=${r.dataset.ubs}&v=terminal`; };
  $("hmDays").onclick = e => { const b = e.target.closest("[data-hd]"); if (b) { hmDays = +b.dataset.hd; renderHeat(); } };
  { let rt = null; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if ($("hm4").clientWidth) { $("hm4").innerHTML = ""; renderHeat(); } }, 150); }).observe($("hm4")); }
  $("fxBody").onclick = e => { const r = e.target.closest("[data-fx]"); if (r) { fxSel = r.dataset.fx; renderFx(); } };
  $("trTabs").onclick = e => { const b = e.target.closest("[data-tr]"); if (b) { trCoin = b.dataset.tr; renderTreasury(); } };
  $("whBody").onclick = e => { if (e.target.closest("a")) return; const r = e.target.closest("[data-w]"); if (r) { openW = openW === r.dataset.w ? null : r.dataset.w; renderWhales(); } };
  $("whLive").onclick = refreshLive;
  $("liqMin").value = String(liqMin);
  $("liqMin").onchange = () => { liqMin = +$("liqMin").value; try { sessionStorage.setItem("lailong.liqmin", liqMin); } catch { /* bỏ qua */ } liqs = liqs.filter(l => l.usd >= liqMin); renderLiq(); };

  let loaded = false, shown = false;
  const tickFreshTags = () => { if (mk) { renderHeat(); $("mkUpd").innerHTML = yahooTag("cme", mk.commodities, "10–15 phút"); $("fsFx").innerHTML = yahooTag("fx", mk.fx, "vài phút"); } };
  return {
    show() {
      shown = true;
      if (!loaded) { loaded = true; load(); }
      startLiq();
      board.show();
      if (!timer) timer = setInterval(load, 2 * 60e3);
      if (!hmTimer) hmTimer = setInterval(() => { tickFreshTags(); }, 30e3); // nhãn Đóng cửa / mở lại tự đổi theo giờ
    },
    hide() { shown = false; board.hide(); clearInterval(hmTimer); hmTimer = null; if (sock) { const s = sock; sock = null; s.onclose = null; s.close(); } clearInterval(timer); timer = null; },
  };
}
