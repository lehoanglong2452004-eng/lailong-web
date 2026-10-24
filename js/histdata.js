// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: nạp lịch sử cho sổ tín hiệu.
//   Bản laptop: kho lịch sử tải từ data.binance.vision (lệnh khớp có tách cá voi, OI và tỷ lệ long/short 5 phút,
//   footprint 5 phút) qua máy chủ: /api/hist/*. Dài tới nhiều năm.
//   Bản web (hoặc khi kho chưa có mã đó): nến Binance qua API công khai (có mua chủ động), OI và tỷ lệ long/short
//   chỉ 30 ngày gần nhất. Sàn khác: chỉ có nến.
import { EXCHANGES, attachOi } from "./exchanges.js?v=202610240531";
import { getJson, INTERVALS } from "./util.js?v=202610240531";

const FAPI = "https://fapi.binance.com";
const DAY = 864e5;

const LOCAL = typeof location !== "undefined" && /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
export async function storeStatus() {
  if (!LOCAL) return null;
  try { return await getJson("api/hist/status"); } catch { return null; }
}
export async function startFetch(symbols, days) {
  const r = await fetch("api/hist/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbols, days }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// hàng [t, o, h, l, c, ...] + tên cột → nến
export function rowsToBars(res) {
  const ix = Object.fromEntries(res.cols.map((c, i) => [c, i]));
  const val = (r, k) => (ix[k] == null ? null : r[ix[k]]);
  return res.rows.map(r => ({
    t: r[ix.t], o: r[ix.o], h: r[ix.h], l: r[ix.l], c: r[ix.c], v: r[ix.v], bv: val(r, "bv"), qv: val(r, "qv"), n: val(r, "n"),
    wb: val(r, "wb"), ws: val(r, "ws"), oi: val(r, "oi"), top: val(r, "top"), topA: val(r, "topA"), acc: val(r, "acc"),
  }));
}

// gắn footprint lịch sử (hàng [t, p, sv, bv], p là giá đáy của tầng) vào nến: b.fp = Map(chỉ số tầng giá → [bán, mua]),
// cùng quy ước với market.js: chỉ số k = floor(giá / bước)
export function attachFp(bars, res) {
  if (!res || !res.rows || !res.step) return 0;
  const by = new Map(bars.map(b => [b.t, b])), ix = Object.fromEntries(res.cols.map((c, i) => [c, i]));
  let n = 0;
  for (const r of res.rows) {
    const b = by.get(r[ix.t]); if (!b) continue;
    if (!b.fp) { b.fp = new Map(); n++; }
    const k = Math.round(r[ix.p] / res.step), c = b.fp.get(k) || [0, 0];
    c[0] += r[ix.sv]; c[1] += r[ix.bv]; b.fp.set(k, c);
  }
  return n;
}

// gắn chuỗi theo thời gian {t, v} vào nến theo kiểu "giá trị gần nhất đã có lúc nến đóng"
function asOf(bars, series, key, tfMs) {
  const s = [...series].sort((a, b) => a.t - b.t); let j = -1;
  for (const b of bars) { while (j + 1 < s.length && s[j + 1].t <= b.t + tfMs) j++; if (j >= 0 && b.t + tfMs - s[j].t <= 2 * Math.max(tfMs, 3e5)) b[key] = s[j].v; }
}
async function ratioHist(path, symbol, period, from) {
  const out = []; let end = Date.now();
  for (let g = 0; g < 12 && end > from; g++) {
    const rows = await getJson(`${FAPI}/futures/data/${path}?symbol=${symbol}&period=${period}&limit=500&endTime=${end}`);
    if (!rows.length) break;
    for (const r of rows) out.push({ t: +r.timestamp, v: +r.longShortRatio });
    const first = Math.min(...rows.map(r => +r.timestamp)); if (first >= end) break; end = first - 1;
  }
  return out;
}

// trả về { bars, src, note, flow, metrics, fp }
export async function loadHistory({ ex = "BINANCE", symbol, tf = "1h", days = 90, store = null, withFp = true, onStatus = () => {} }) {
  const tfMs = INTERVALS[tf];
  const inStore = store && store.symbols && store.symbols[symbol] && store.symbols[symbol].flow;
  if (ex === "BINANCE" && inStore) {
    onStatus("Đang đọc kho lịch sử trên laptop…");
    const res = await getJson(`api/hist/bars?s=${symbol}&tf=${tf}&days=${days}`);
    const bars = rowsToBars(res);
    let fp = 0, fpStep = 0;
    if (withFp && tfMs >= 3e5 && tfMs <= 36e5) {
      try { const r = await getJson(`api/hist/fp?s=${symbol}&tf=${tf}&days=${Math.min(days, 30)}`); fp = attachFp(bars, r); fpStep = fp ? r.step : 0; } catch { /* không có footprint */ }
    }
    return { bars, src: "Kho lịch sử data.binance.vision (laptop)", flow: true, metrics: bars.some(b => b.oi != null), fp, fpStep, note: fp ? `footprint thật cho ${fp} nến gần nhất` : "" };
  }
  const X = EXCHANGES[ex] || EXCHANGES.BINANCE, n = Math.min(Math.ceil(days * DAY / tfMs), 20000);
  onStatus(`Đang tải ${n} nến ${tf} từ ${X.name || ex}…`);
  const bars = (await X.klines(symbol, tf, n)).filter(b => b.t + tfMs <= Date.now());
  let metrics = false;
  if (X.oiHistory) {
    try { onStatus("Đang tải open interest…"); attachOi(bars, await X.oiHistory(symbol, tf, bars[0].t), tfMs); metrics = bars.some(b => b.oi != null); } catch { /* sàn không cho */ }
  }
  if (ex === "BINANCE") {
    const period = tfMs <= 3e5 ? "5m" : tfMs <= 9e5 ? "15m" : tfMs <= 36e5 ? "1h" : "4h", from = Math.max(bars[0].t, Date.now() - 29.5 * DAY);
    try {
      onStatus("Đang tải tỷ lệ long/short…");
      const [top, acc] = await Promise.all([ratioHist("topLongShortPositionRatio", symbol, period, from), ratioHist("globalLongShortAccountRatio", symbol, period, from)]);
      asOf(bars, top, "top", tfMs); asOf(bars, acc, "acc", tfMs);
    } catch { /* bỏ qua */ }
  }
  return { bars, src: `Nến ${X.name || ex} qua API công khai`, flow: false, metrics, fp: 0, fpStep: 0, note: ex === "BINANCE" ? "OI và tỷ lệ long/short chỉ có 30 ngày gần nhất; mở bản laptop và tải kho lịch sử để có nhiều năm" : "" };
}
