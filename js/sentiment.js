// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: kim tâm lý thị trường cho Crypto và Chứng khoán Mỹ (tab Phân tích, Vĩ mô và dòng tiền).
// Mỗi thành phần được chấm 0 đến 100 (0 = sợ hãi, bán tháo; 100 = tham lam, mua mạnh) rồi lấy trung bình có trọng số.
//   Crypto: dòng tiền ETF 5 phiên, stablecoin 7 ngày, funding BTC/ETH Binance, tỷ lệ tài khoản long Binance (tín hiệu ngược),
//           Fear & Greed của alternative.me, giá BTC so với trung bình 50 ngày.
//   Mỹ:     VIX so với 1 năm, cấu trúc kỳ hạn VIX/VIX3M, VVIX và SKEW (rủi ro đuôi), MOVE (trái phiếu), S&P 500 so với MA 50 ngày.
// Điểm quá khứ (hôm qua, tuần trước, tháng trước) tính lại bằng chính các chuỗi đó tại thời điểm cũ; thành phần nào không có
// lịch sử tới lúc đó thì bỏ qua.

export const STATES = [
  [20, "Bán tháo", "Sợ hãi cực độ", "dn"], [40, "Bán", "Sợ hãi", "dn"], [60, "Trung lập", "Trung lập", ""],
  [80, "Mua", "Lạc quan", "up"], [Infinity, "Mua mạnh", "Tham lam", "up"],
];
export function stateOf(v) {
  if (v == null || !isFinite(v)) return { name: "Chưa đủ dữ liệu", mood: "", cls: "", i: -1 };
  const i = STATES.findIndex(s => v < s[0]);
  return { name: STATES[i][1], mood: STATES[i][2], cls: STATES[i][3], i };
}
const clamp = v => Math.max(0, Math.min(100, v));
const th = (x, s) => 50 + 50 * Math.tanh(x / s);
const D = 864e5;
const sign = (x, k = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(k)}`;
const usdM = x => `${x >= 0 ? "+" : "−"}${Math.abs(x) >= 1000 ? (Math.abs(x) / 1000).toFixed(2) + " tỷ" : Math.abs(x).toFixed(0) + " tr"} USD`;

// điểm cuối cùng của chuỗi [[t, v]] (tăng dần) có t <= T
export function at(s, T) {
  if (!s || !s.length) return null;
  let lo = 0, hi = s.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m][0] <= T) { r = m; lo = m + 1; } else hi = m - 1; }
  return r < 0 ? null : s[r];
}
// tỷ lệ số ngày trong 1 năm trước T có giá trị thấp hơn giá trị tại T (0 đến 1); cần ít nhất 60 điểm
export function rankAt(s, T, span = 365 * D) {
  const p = at(s, T); if (!p) return null;
  const w = s.filter(x => x[0] <= T && x[0] > T - span); if (w.length < 60) return null;
  return w.filter(x => x[1] < p[1]).length / (w.length - 1 || 1);
}
// độ lệch % của giá tại T so với trung bình n điểm gần nhất
export function maDev(s, T, n = 50) {
  if (!s) return null;
  const w = s.filter(x => x[0] <= T).slice(-n); if (w.length < n) return null;
  const ma = w.reduce((a, x) => a + x[1], 0) / n, last = w[w.length - 1][1];
  return (last / ma - 1) * 100;
}
// trung bình có trọng số của các thành phần có điểm; cần ít nhất 2 thành phần
export function blend(parts) {
  const ok = parts.filter(p => p && p.score != null && isFinite(p.score));
  if (ok.length < 2) return null;
  const w = ok.reduce((a, p) => a + p.w, 0);
  return ok.reduce((a, p) => a + p.score * p.w, 0) / w;
}
const tone = s => s == null ? "" : s >= 60 ? "up" : s <= 40 ? "dn" : "";

// ---------- Chứng khoán Mỹ (vol.json: VIX, VIX3M, VVIX, SKEW, MOVE, SPX, mỗi mục có series ngày) ----------
export function usParts(items, T) {
  const S = k => { const x = (items || []).find(y => y.sym === k); return x && x.series && x.series.length ? x.series : null; };
  const vix = S("VIX"), v3 = S("VIX3M"), vv = S("VVIX"), sk = S("SKEW"), mv = S("MOVE"), spx = S("SPX");
  const out = [];
  const pv = at(vix, T), rk = rankAt(vix, T);
  if (pv && rk != null) out.push({ key: "vix", label: "VIX", w: 1.5, score: clamp(100 * (1 - rk)),
    text: `${pv[1].toFixed(1)} · cao hơn ${Math.round(rk * 100)}% số ngày trong 1 năm`,
    tip: "Chỉ số sợ hãi của S&P 500. Càng cao so với 1 năm qua thì thị trường càng sợ. Trên 30 là vùng hoảng loạn, dưới 14 là chủ quan" });
  const p3 = at(v3, T);
  if (pv && p3 && p3[1]) {
    const r = pv[1] / p3[1];
    out.push({ key: "term", label: "Cấu trúc kỳ hạn VIX", w: 1.25, score: clamp(50 + (0.93 - r) * 350),
      text: `${r.toFixed(2)} · ${r > 1 ? "đảo ngược, hoảng loạn ngắn hạn" : r < 0.85 ? "contango sâu, rất bình thản" : "contango, bình thường"}`,
      tip: "VIX 30 ngày chia VIX 3 tháng. Trên 1 là đảo ngược: người ta trả đắt để phòng hộ ngay bây giờ, thường chỉ thấy lúc thị trường sập" });
  }
  const a = at(vv, T), b = at(sk, T);
  if (a || b) {
    const sc = [a && clamp(50 - (a[1] - 100) * 1.8), b && clamp(50 - (b[1] - 140) * 2)].filter(x => x != null);
    out.push({ key: "tail", label: "VVIX, SKEW", w: 0.75, score: sc.reduce((x, y) => x + y, 0) / sc.length,
      text: `${a ? `VVIX ${a[1].toFixed(0)}` : ""}${a && b ? " · " : ""}${b ? `SKEW ${b[1].toFixed(0)}` : ""}${(a && a[1] > 110) || (b && b[1] > 145) ? " · đang lo rủi ro đuôi" : " · không có dấu hiệu lo đuôi"}`,
      tip: "VVIX: nhu cầu mua bảo hiểm cho chính VIX (trên 110 là cao). SKEW: giá của bảo hiểm sập mạnh trên S&P 500 (trên 145 là cao)" });
  }
  const pm = at(mv, T), rm = rankAt(mv, T);
  if (pm && rm != null) out.push({ key: "move", label: "MOVE (trái phiếu)", w: 0.75, score: clamp(100 * (1 - rm)),
    text: `${pm[1].toFixed(0)} · ${rm > 0.7 ? "cao" : rm < 0.3 ? "thấp" : "trung bình"} so với 1 năm`,
    tip: "Biến động trái phiếu chính phủ Mỹ. Trái phiếu biến động mạnh thường kéo theo USD và chứng khoán" });
  const dv = maDev(spx, T);
  if (dv != null) out.push({ key: "spx", label: "S&P 500 so với MA 50 ngày", w: 1.5, score: th(dv, 4),
    text: `${dv >= 0 ? "trên" : "dưới"} ${Math.abs(dv).toFixed(1)}%`,
    tip: "Giá đóng cửa S&P 500 so với trung bình 50 phiên. Trên là xu hướng tăng, dưới là xu hướng giảm" });
  return out;
}

// ---------- Crypto ----------
// d: { flows (flows.json), fng: [[t, 0..100]], fund: [[t, % mỗi 8 giờ]], acc: [[t, tỷ lệ tài khoản long 0..1]], btc: [[t, giá đóng cửa ngày]] }
const FNG_VI = v => v < 25 ? "sợ hãi cực độ" : v < 45 ? "sợ hãi" : v <= 55 ? "trung lập" : v < 75 ? "tham lam" : "tham lam cực độ";
export function cryptoParts(d, T) {
  const out = [], f = d.flows || {};
  const etf = ["btc", "eth"].map(k => (f[k] && f[k].rows || []).filter(r => r[0] <= T).slice(-5)).filter(r => r.length);
  if (etf.length) {
    const s = etf.reduce((a, r) => a + r.reduce((b, x) => b + x[1], 0), 0);
    out.push({ key: "etf", label: "Dòng tiền ETF 5 phiên", w: 1.5, score: th(s, 800), text: usdM(s),
      tip: "Tiền vào/ra ròng 5 phiên gần nhất của các quỹ ETF Bitcoin và Ethereum giao ngay ở Mỹ (Farside). Đây là tiền của tổ chức Mỹ" });
  }
  const ss = f.stable && f.stable.series, s0 = at(ss, T), s7 = at(ss, T - 7 * D);
  if (s0 && s7 && T - s0[0] < 3 * D) {
    const c = s0[1] - s7[1];
    out.push({ key: "stable", label: "Stablecoin 7 ngày", w: 1, score: th(c, 3e9), text: `${c >= 0 ? "+" : "−"}${(Math.abs(c) / 1e9).toFixed(2)} tỷ USD`,
      tip: "Tổng stablecoin đang lưu hành thay đổi trong 7 ngày (DefiLlama). Tăng là tiền mới vào hệ crypto, giảm là tiền rút ra" });
  }
  const fw = (d.fund || []).filter(x => x[0] <= T && x[0] > T - D);
  if (fw.length) {
    const v = fw.reduce((a, x) => a + x[1], 0) / fw.length;
    out.push({ key: "fund", label: "Funding BTC, ETH (Binance)", w: 1, score: th(v - 0.01, 0.015),
      text: `${sign(v, 4)}% · ${v > 0.03 ? "đắt, long đang đông" : v < 0 ? "âm, short đang đông" : "bình thường"}`,
      tip: "Phí giữ lệnh mỗi 8 giờ, trung bình 24 giờ qua. Dương cao là đám đông trả đắt để long (hưng phấn); âm là phe short đông (sợ hãi)" });
  }
  const pa = at(d.acc, T);
  if (pa && T - pa[0] < 2 * D) out.push({ key: "acc", label: "Tài khoản long Binance", w: 0.75, score: th(-(pa[1] - 0.55), 0.2),
    text: `${(pa[1] * 100).toFixed(0)}% · ${pa[1] >= 0.6 ? "đám đông long" : pa[1] <= 0.45 ? "đám đông short" : "cân bằng"}`,
    tip: "Phần trăm tài khoản BTCUSDT trên Binance đang long. Đây là tín hiệu ngược: nhỏ lẻ thường long nhiều khi giá đang giảm, nên càng đông long càng tính là xấu" });
  const pf = at(d.fng, T);
  if (pf && T - pf[0] < 2 * D) out.push({ key: "fng", label: "Fear & Greed (alternative.me)", w: 1.5, score: pf[1], text: `${pf[1]} · ${FNG_VI(pf[1])}`,
    tip: "Chỉ số sợ hãi và tham lam của crypto do alternative.me tính mỗi ngày (biến động, khối lượng, mạng xã hội, độ thống trị của BTC)" });
  const dv = maDev(d.btc, T);
  if (dv != null) out.push({ key: "ma", label: "BTC so với MA 50 ngày", w: 1.25, score: th(dv, 12), text: `${dv >= 0 ? "trên" : "dưới"} ${Math.abs(dv).toFixed(1)}%`,
    tip: "Giá BTC so với trung bình 50 ngày. Trên là xu hướng tăng, dưới là xu hướng giảm" });
  return out;
}

// điểm hiện tại, thành phần và điểm quá khứ. back: các mốc [nhãn, thời điểm]
export function gaugeRead(partsAt, T, back) {
  const parts = partsAt(T), score = blend(parts);
  return { score, parts: parts.map(p => ({ ...p, cls: tone(p.score) })), state: stateOf(score), hist: back.map(([k, t]) => [k, blend(partsAt(t))]) };
}

// ---------- vẽ kim ----------
const SEG = ["#b3262b", "#e5484d", "#6b6b6b", "#1fb57a", "#10804f"];
export function gaugeSvg(v, labels = STATES.map(s => s[1].toUpperCase()), ends = ["Sợ hãi", "Tham lam"]) {
  const cx = 175, cy = 170, R = 135, r = R - 30, on = v == null ? -1 : Math.min(4, Math.floor(v / 20));
  const pt = (a, rr) => [cx + rr * Math.cos(Math.PI * (1 - a)), cy - rr * Math.sin(Math.PI * (1 - a))].map(n => n.toFixed(1));
  let s = `<svg viewBox="0 0 350 196" class="sgsvg" role="img" aria-label="${v == null ? "" : Math.round(v) + "/100"}">`;
  SEG.forEach((c, i) => {
    const a0 = i / 5 + 0.004, a1 = (i + 1) / 5 - 0.004, [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, r), [x3, y3] = pt(a0, r), [lx, ly] = pt((i + 0.5) / 5, R + 12);
    s += `<path d="M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 0 0 ${x3},${y3}Z" fill="${c}" opacity="${on === i ? 1 : 0.4}"/>`;
    s += `<text x="${lx}" y="${ly}" text-anchor="middle" class="gl">${labels[i]}</text>`;
  });
  if (v != null) {
    const [nx, ny] = pt(v / 100, r - 8);
    s += `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="var(--fg,#fff)" stroke-width="4" stroke-linecap="round"/>`;
    s += `<text x="${cx}" y="${cy - 30}" text-anchor="middle" class="gv">${Math.round(v)}</text>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="8" fill="var(--fg,#fff)"/>`;
  s += `<text x="14" y="192" class="ge dn">${ends[0]}</text><text x="336" y="192" text-anchor="end" class="ge up">${ends[1]}</text></svg>`;
  return s;
}
