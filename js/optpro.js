// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: các chỉ số quyền chọn mà bàn giao dịch tổ chức theo dõi (không vẽ, để kiểm thử được).
//
//   termStructure: IV ATM, skew 25 delta (risk reversal) và butterfly của từng hạn; nội suy về hạn cố định 7/30/90 ngày
//   ivRank: vị trí của chỉ số biến động (DVOL, VIX) trong 1 năm: IV rank và IV percentile
//   realizedVol: biến động thực tế từ giá đóng cửa ngày; VRP = IV − biến động thực tế (quyền chọn đắt hay rẻ)
//   putCall: tỷ lệ put/call theo OI và theo khối lượng, toàn bộ và hạn gần
//   flowSummary: dòng lệnh quyền chọn Deribit: ai mua/bán chủ động call/put, phí bảo hiểm, lệnh khối
//   readSentiment: các câu đọc tâm lý từ các số trên
// Chuỗi quyền chọn theo dạng thống nhất của gex.js: rows [[strike, iExp, ±1, OI, iv, KL?]].

const YEAR = 365 * 864e5, DAY = 864e5;
const ncdf = x => { // xấp xỉ Abramowitz-Stegun, sai số < 1e-7
  const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
};

// delta Black-Scholes (lãi suất 0, giá kỳ hạn ≈ giá hiện tại): call 0..1, put −1..0
export function bsDelta(S, K, T, iv, cp) {
  if (!(S > 0 && K > 0 && T > 0 && iv > 0)) return cp > 0 ? (S >= K ? 1 : 0) : (S <= K ? -1 : 0);
  const d1 = (Math.log(S / K) + 0.5 * iv * iv * T) / (iv * Math.sqrt(T));
  return cp > 0 ? ncdf(d1) : ncdf(d1) - 1;
}

// nội suy tuyến tính y theo x trên các điểm đã sắp theo x
function interp(pts, x, kx = "x", ky = "y") {
  if (!pts.length) return null;
  if (x <= pts[0][kx]) return pts[0][ky];
  if (x >= pts[pts.length - 1][kx]) return pts[pts.length - 1][ky];
  const j = pts.findIndex(p => p[kx] >= x), a = pts[j - 1], b = pts[j];
  return a[ky] + (b[ky] - a[ky]) * (x - a[kx]) / (b[kx] - a[kx]);
}

// một hạn: IV ATM (nội suy tại giá hiện tại), IV ở call 25 delta và put 25 delta
export function expiryVols(ch, ie, now = Date.now()) {
  const T = (ch.exps[ie] - now) / YEAR; if (!(T > 0)) return null;
  const S = ch.spot, calls = [], puts = [], all = new Map();
  for (const r of ch.rows) {
    if (r[1] !== ie || !(r[4] > 0)) continue;
    const [k, , cp, , iv] = r;
    if (cp > 0 && k >= S * 0.98) calls.push({ k, iv, d: bsDelta(S, k, T, iv, 1) });
    if (cp < 0 && k <= S * 1.02) puts.push({ k, iv, d: -bsDelta(S, k, T, iv, -1) });
    if ((cp > 0 && k >= S) || (cp < 0 && k < S) || !all.has(k)) all.set(k, iv);
  }
  const sm = [...all].map(([x, y]) => ({ x, y })).sort((a, b) => a.x - b.x);
  if (sm.length < 3) return null;
  const atm = interp(sm, S);
  // delta call giảm dần khi strike tăng; put (lấy trị tuyệt đối) tăng dần khi strike tăng
  const c = calls.sort((a, b) => a.d - b.d), p = puts.sort((a, b) => a.d - b.d);
  const okC = c.length >= 2 && c[0].d <= 0.25 && c[c.length - 1].d >= 0.25, okP = p.length >= 2 && p[0].d <= 0.25 && p[p.length - 1].d >= 0.25;
  const c25 = okC ? interp(c, 0.25, "d", "iv") : null, p25 = okP ? interp(p, 0.25, "d", "iv") : null;
  return {
    exp: ch.exps[ie], days: T * 365, atm,
    c25, p25, rr: c25 != null && p25 != null ? c25 - p25 : null, bf: c25 != null && p25 != null && atm != null ? (c25 + p25) / 2 - atm : null,
  };
}

// cấu trúc kỳ hạn: mọi hạn còn ≥ 1 ngày, kèm IV ATM, RR, BF nội suy về hạn cố định (theo phương sai cho ATM)
export function termStructure(ch, now = Date.now(), { fixed = [7, 30, 90, 180] } = {}) {
  const rows = [];
  for (let ie = 0; ie < ch.exps.length; ie++) { const v = expiryVols(ch, ie, now); if (v && v.days >= 1 && v.atm != null) rows.push(v); }
  const cm = {};
  for (const d of fixed) {
    if (!rows.length || d < rows[0].days * 0.5 || d > rows[rows.length - 1].days * 1.5) { cm[d] = null; continue; }
    const varPts = rows.map(r => ({ x: r.days, y: r.atm * r.atm * r.days })), w = interp(varPts, d);
    const rr = interp(rows.filter(r => r.rr != null).map(r => ({ x: r.days, y: r.rr })), d), bf = interp(rows.filter(r => r.bf != null).map(r => ({ x: r.days, y: r.bf })), d);
    cm[d] = { atm: w > 0 ? Math.sqrt(w / d) : interp(rows.map(r => ({ x: r.days, y: r.atm })), d), rr, bf };
  }
  const s = cm[7] && cm[7].atm, l = cm[90] && cm[90].atm || cm[30] && cm[30].atm;
  const shape = s != null && l != null ? (s > l + 0.01 ? "back" : s < l - 0.01 ? "contango" : "flat") : null;
  return { rows, cm, shape };
}

// IV rank = (hiện tại − thấp nhất) / (cao nhất − thấp nhất); percentile = % số ngày thấp hơn hiện tại
export function ivRank(series, cur = series[series.length - 1]) {
  const v = series.filter(x => x > 0); if (v.length < 20 || !(cur > 0)) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  return { cur, lo, hi, rank: hi > lo ? (cur - lo) / (hi - lo) : 0.5, pct: v.filter(x => x < cur).length / v.length };
}

// biến động thực tế năm hoá từ giá đóng cửa ngày (độ lệch chuẩn log return × √365)
export function realizedVol(closes, n = 30, perYear = 365) {
  const c = closes.slice(-(n + 1)); if (c.length < Math.min(n, 10) + 1) return null;
  const r = []; for (let i = 1; i < c.length; i++) if (c[i] > 0 && c[i - 1] > 0) r.push(Math.log(c[i] / c[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length, v = r.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, r.length - 1);
  return Math.sqrt(v * perYear);
}

// tỷ lệ put/call theo OI và theo khối lượng (cột 5 nếu có), toàn bộ và các hạn trong `nearDays` ngày
export function putCall(ch, now = Date.now(), nearDays = 30) {
  const acc = { oi: [0, 0], vol: [0, 0], nOi: [0, 0], nVol: [0, 0] };
  let hasVol = false;
  for (const r of ch.rows) {
    const j = r[2] > 0 ? 0 : 1, near = ch.exps[r[1]] - now <= nearDays * DAY;
    acc.oi[j] += r[3]; if (near) acc.nOi[j] += r[3];
    if (r[5] != null) { hasVol = true; acc.vol[j] += r[5]; if (near) acc.nVol[j] += r[5]; }
  }
  const q = ([c, p]) => c > 0 ? p / c : null;
  return { oi: q(acc.oi), nearOi: q(acc.nOi), vol: hasVol ? q(acc.vol) : null, nearVol: hasVol ? q(acc.nVol) : null, callOi: acc.oi[0], putOi: acc.oi[1], callVol: acc.vol[0], putVol: acc.vol[1] };
}

// dòng lệnh Deribit (get_last_trades_by_currency, kind=option). direction là phía chủ động (taker).
// Mua call / bán put = nghiêng tăng; mua put / bán call = nghiêng giảm hoặc phòng hộ.
export function flowSummary(trades, { bigUsd = 100e3, now = Date.now(), windowMs = 864e5 } = {}) {
  const out = { n: 0, prem: { buyCall: 0, sellCall: 0, buyPut: 0, sellPut: 0 }, notional: { call: 0, put: 0 }, block: 0, big: [], from: null, to: null };
  for (const t of trades) {
    if (now - t.timestamp > windowMs) continue;
    const m = /-(\d+)-([CP])$/.exec(t.instrument_name || ""); if (!m) continue;
    const call = m[2] === "C", px = t.index_price || 0, prem = (t.price || 0) * px * (t.amount || 0), notional = (t.amount || 0) * px;
    const key = (t.direction === "buy" ? "buy" : "sell") + (call ? "Call" : "Put");
    out.prem[key] += prem; out.notional[call ? "call" : "put"] += notional; out.n++;
    if (t.block_trade_id) out.block += prem;
    out.from = out.from == null ? t.timestamp : Math.min(out.from, t.timestamp); out.to = out.to == null ? t.timestamp : Math.max(out.to, t.timestamp);
    if (prem >= bigUsd) out.big.push({ t: t.timestamp, name: t.instrument_name, call, strike: +m[1], side: t.direction, amount: t.amount, prem, notional, iv: t.iv, block: !!t.block_trade_id });
  }
  const p = out.prem, bull = p.buyCall + p.sellPut, bear = p.buyPut + p.sellCall;
  out.bull = bull; out.bear = bear; out.tilt = bull + bear > 0 ? (bull - bear) / (bull + bear) : 0;
  out.big.sort((a, b) => b.t - a.t);
  return out;
}

const pct = x => (x * 100).toFixed(1);

// các câu đọc tâm lý; mỗi câu kèm "dir" (+1 nghiêng tăng / −1 nghiêng giảm / 0) để tô màu
export function readSentiment({ ts, pc, rank, rv, flow, spot, gex } = {}) {
  const out = [], say = (dir, text) => out.push({ dir, text });
  const c30 = ts && ts.cm && ts.cm[30];
  if (c30 && c30.rr != null) {
    const rr = c30.rr * 100;
    if (rr <= -3) say(-1, `Skew 25 delta 30 ngày ${rr.toFixed(1)} điểm: put đắt hơn call rõ rệt. Thị trường đang trả giá cao để mua bảo hiểm giảm giá, tức là đang sợ.`);
    else if (rr >= 3) say(1, `Skew 25 delta 30 ngày +${rr.toFixed(1)} điểm: call đắt hơn put. Người chơi đang đuổi theo đà tăng (FOMO), tham lam.`);
    else say(0, `Skew 25 delta 30 ngày ${rr >= 0 ? "+" : ""}${rr.toFixed(1)} điểm: call và put giá gần ngang nhau, chưa nghiêng hẳn về sợ hay tham.`);
  }
  if (ts && ts.shape) {
    const s = ts.cm[7] && ts.cm[7].atm, l = (ts.cm[90] && ts.cm[90].atm) || (ts.cm[30] && ts.cm[30].atm);
    if (ts.shape === "back") say(-1, `Cấu trúc kỳ hạn đảo ngược: IV 7 ngày ${pct(s)}% cao hơn hạn dài ${pct(l)}%. Thị trường đang lo một chuyện sắp xảy ra (tin, sự kiện, bán tháo); thường đi kèm biến động mạnh.`);
    else if (ts.shape === "contango") say(0, `Cấu trúc kỳ hạn bình thường (contango): IV 7 ngày ${pct(s)}% thấp hơn hạn dài ${pct(l)}%. Không có nỗi sợ ngắn hạn.`);
    else say(0, `Cấu trúc kỳ hạn gần như phẳng: IV ngắn hạn ${pct(s)}% bằng hạn dài. Đang chuyển trạng thái, theo dõi xem đầu ngắn có vọt lên không.`);
  }
  if (rank) {
    const r = Math.round(rank.rank * 100);
    say(0, `Chỉ số biến động ${rank.cur.toFixed(1)}: IV rank ${r}%, percentile ${Math.round(rank.pct * 100)}% trong 1 năm. ${r >= 80 ? "Quyền chọn đang rất đắt: thị trường đã sợ sẵn; mua quyền chọn lúc này bất lợi." : r <= 20 ? "Quyền chọn đang rẻ: thị trường chủ quan; biến động hay bùng ra từ vùng này." : "Mức trung bình."}`);
  }
  if (rv != null && c30 && c30.atm != null) {
    const vrp = (c30.atm - rv) * 100;
    say(0, `IV 30 ngày ${pct(c30.atm)}% so với biến động thực tế 30 ngày ${pct(rv)}%: chênh ${vrp >= 0 ? "+" : ""}${vrp.toFixed(1)} điểm. ${vrp > 8 ? "Quyền chọn đắt hơn nhiều so với giá thực sự dao động: bên bán quyền chọn có lợi thế." : vrp < -2 ? "Giá đang dao động mạnh hơn mức quyền chọn định giá: bên mua quyền chọn có lợi thế, thị trường đang bị bất ngờ." : "Chênh lệch bình thường."}`);
  }
  if (pc && pc.oi != null) {
    say(pc.oi > 1 ? -1 : pc.oi < 0.5 ? 1 : 0, `Put/call theo OI ${pc.oi.toFixed(2)}${pc.vol != null ? `, theo khối lượng 24 giờ ${pc.vol.toFixed(2)}` : ""}. ${pc.vol != null && pc.oi > 0 && pc.vol > pc.oi * 1.3 ? "Hôm nay put được giao dịch nhiều bất thường so với vị thế đang mở: có người vội mua bảo hiểm." : pc.vol != null && pc.vol < pc.oi * 0.7 ? "Hôm nay call được giao dịch nhiều hơn hẳn thường lệ." : ""}`.trim());
  }
  if (flow && flow.n) {
    const tl = Math.round(flow.tilt * 100), h = flow.to && flow.from ? Math.max(1, Math.round((flow.to - flow.from) / 36e5)) : null;
    say(tl > 20 ? 1 : tl < -20 ? -1 : 0, `Dòng lệnh ${h ? `${h} giờ gần nhất` : "gần nhất"}: mua call + bán put ${fmtM(flow.bull)}, mua put + bán call ${fmtM(flow.bear)} (phí bảo hiểm). ${tl > 20 ? "Tiền chủ động nghiêng về phía tăng." : tl < -20 ? "Tiền chủ động nghiêng về phía giảm hoặc phòng hộ." : "Hai phía cân nhau."}${flow.block > 0 ? ` Lệnh khối (giao dịch thoả thuận của tổ chức) ${fmtM(flow.block)}.` : ""}`);
  }
  if (gex && spot) {
    if (gex.flip) say(spot > gex.flip ? 1 : -1, `Giá ${spot > gex.flip ? "trên" : "dưới"} điểm lật gamma ${Math.round(gex.flip).toLocaleString("en-US")}: ${spot > gex.flip ? "nhà tạo lập đi ngược giá, thị trường dễ êm và bị kéo về các tường" : "nhà tạo lập đi theo giá, biến động dễ bị khuếch đại"}.`);
  }
  return out;
}
const fmtM = v => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`;
