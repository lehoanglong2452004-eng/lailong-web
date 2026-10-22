// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: phần tính toán của footprint (không vẽ, để kiểm thử được), theo các chế độ của ATAS.
//
// Mỗi nến có b.fp: Map(chỉ số tầng giá -> [KL bán chủ động, KL mua chủ động]).
//   - fpRows: gộp footprint theo dòng giá đang hiển thị
//   - barStats: số liệu cho bảng thống kê cụm (khối lượng, delta, delta %, delta lớn nhất/nhỏ nhất trong nến, số lệnh)
//   - auction: đỉnh/đáy nến là đấu giá đã xong hay chưa xong, có kiệt sức hay không
//   - unfinishedLevels: các mức đấu giá chưa xong còn mở (giá thường quay lại để "hoàn tất")
//   - deltaDivergence: giá lập đỉnh/đáy mới nhưng delta đi ngược

export const FP_MODES = {
  bidask: { name: "Mua × Bán", tip: "Mỗi ô ghi khối lượng bán chủ động (khớp vào giá chờ mua) bên trái và mua chủ động bên phải" },
  delta: { name: "Delta", tip: "Mỗi ô ghi mua chủ động trừ bán chủ động ở mức giá đó" },
  volume: { name: "Khối lượng", tip: "Mỗi ô ghi tổng khối lượng khớp ở mức giá đó" },
  bavol: { name: "Mua × Bán + tổng", tip: "Ba cột: bán chủ động, tổng khối lượng, mua chủ động" },
  histo: { name: "Thanh mua/bán", tip: "Thanh ngang trong nến: bên trái là bán chủ động, bên phải là mua chủ động, dài theo khối lượng" },
  profile: { name: "Hồ sơ trong nến", tip: "Hồ sơ khối lượng của riêng từng nến, màu theo delta của dòng; viền vàng là POC của nến" },
  ratio: { name: "Tỷ lệ chéo", tip: "Tỷ lệ mua chủ động ở dòng này so với bán chủ động ở dòng ngay dưới (đường chéo như ATAS); số lớn là phe đó áp đảo" },
};
export const FP_COLORS = {
  volume: { name: "Theo khối lượng", tip: "Ô càng đậm là khối lượng càng lớn; màu xanh/đỏ theo phe chiếm ưu thế" },
  delta: { name: "Theo delta", tip: "Ô càng đậm là delta của ô càng lớn; xanh là mua áp đảo, đỏ là bán áp đảo" },
  imbalance: { name: "Chỉ mất cân bằng", tip: "Chỉ tô ô có mất cân bằng chéo từ 3 lần trở lên" },
  candle: { name: "Theo nến", tip: "Tô cả nến một màu theo nến tăng/giảm, độ đậm theo khối lượng" },
};

// gộp footprint của một nến theo dòng giá (mult bước giá gốc mỗi dòng): Map(k -> [bán, mua])
export function fpRows(b, mult) {
  const rows = new Map();
  if (!b.fp) return rows;
  for (const [k0, cell] of b.fp) { const k = Math.floor(k0 / mult); const r = rows.get(k) || [0, 0]; r[0] += cell[0]; r[1] += cell[1]; rows.set(k, r); }
  return rows;
}

// cực trị trong các dòng của một nến, để chuẩn hoá độ đậm
export function rowExtremes(rows) {
  let maxTot = 0, maxSide = 0, maxAbsD = 0, pocK = null;
  for (const [k, r] of rows) {
    const t = r[0] + r[1];
    if (t > maxTot) { maxTot = t; pocK = k; }
    maxSide = Math.max(maxSide, r[0], r[1]); maxAbsD = Math.max(maxAbsD, Math.abs(r[1] - r[0]));
  }
  return { maxTot, maxSide, maxAbsD, pocK };
}

// tỷ lệ chéo của một dòng: mua ở k so với bán ở k − 1 (dương: mua áp đảo), bán ở k so với mua ở k + 1 (âm: bán áp đảo)
export function diagRatio(rows, k) {
  const r = rows.get(k); if (!r) return null;
  const below = rows.get(k - 1), above = rows.get(k + 1);
  const up = below ? (below[0] > 0 ? r[1] / below[0] : r[1] > 0 ? Infinity : 0) : null;
  const dn = above ? (above[1] > 0 ? r[0] / above[1] : r[0] > 0 ? Infinity : 0) : null;
  if (up == null && dn == null) return null;
  if ((up || 0) >= (dn || 0)) return { side: "buy", x: up };
  return { side: "sell", x: dn };
}

// số liệu cho bảng thống kê cụm; dMax/dMin là delta cao nhất/thấp nhất trong lúc nến chạy (nếu có theo dõi)
export function barStats(b) {
  let buy = 0, sell = 0;
  if (b.fp && b.fp.size) for (const c of b.fp.values()) { sell += c[0]; buy += c[1]; }
  else if (typeof b.bv === "number" && isFinite(b.bv)) { buy = b.bv; sell = b.v - b.bv; }
  const v = b.v || buy + sell, d = b.d != null ? b.d : buy - sell;
  return {
    v, buy, sell, d, dPct: v > 0 ? d / v : 0,
    dMax: b.cvdH != null ? b.cvdH : null, dMin: b.cvdL != null ? b.cvdL : null,
    n: b.n != null ? b.n : null, approx: !!b.fpApprox || !b.fp || !b.fp.size,
  };
}

// đỉnh/đáy của nến: đấu giá chưa xong khi ở dòng cực trị vẫn còn cả hai phe khớp (thường bị quay lại);
// kiệt sức khi lực chủ động giảm dần 3 dòng liền về phía cực trị và dòng cuối chỉ còn ≤ 30% dòng thứ ba.
export function auction(rows) {
  if (!rows.size) return null;
  let kLo = Infinity, kHi = -Infinity;
  for (const k of rows.keys()) { if (k < kLo) kLo = k; if (k > kHi) kHi = k; }
  if (kHi - kLo < 2) return { kLo, kHi, top: null, bot: null, exTop: false, exBot: false };
  const g = k => rows.get(k) || [0, 0], hi = g(kHi), lo = g(kLo);
  const top = hi[0] > 0 && hi[1] > 0 ? "unfinished" : "finished", bot = lo[0] > 0 && lo[1] > 0 ? "unfinished" : "finished";
  const b1 = g(kHi)[1], b2 = g(kHi - 1)[1], b3 = g(kHi - 2)[1];
  const s1 = g(kLo)[0], s2 = g(kLo + 1)[0], s3 = g(kLo + 2)[0];
  const exTop = b3 > 0 && b2 < b3 && b1 < b2 && b1 <= 0.3 * b3;
  const exBot = s3 > 0 && s2 < s3 && s1 < s2 && s1 <= 0.3 * s3;
  return { kLo, kHi, top, bot, exTop, exBot };
}

// các mức đấu giá chưa xong, kéo tới khi giá giao dịch xuyên qua (end = chỉ số nến đó) hoặc còn mở (end = null)
export function unfinishedLevels(bars, rowStep, step, { lookback = 400 } = {}) {
  const mult = Math.max(1, Math.round(rowStep / step)), out = [], from = Math.max(0, bars.length - lookback);
  for (let i = from; i < bars.length - 1; i++) {
    const b = bars[i]; if (!b.fp || !b.fp.size || b.fpApprox) continue;
    const a = auction(fpRows(b, mult)); if (!a) continue;
    const mk = (side, price) => {
      let end = null;
      for (let j = i + 1; j < bars.length; j++) if (side === "high" ? bars[j].h > price : bars[j].l < price) { end = j; break; }
      out.push({ i, t: b.t, side, price, end });
    };
    if (a.top === "unfinished") mk("high", b.h);
    if (a.bot === "unfinished") mk("low", b.l);
  }
  return out;
}

// phân kỳ delta: nến lập đỉnh cao hơn `look` nến trước mà delta âm (bên mua yếu), hoặc đáy thấp hơn mà delta dương
export function deltaDivergence(bars, { look = 3, minPct = 0.05 } = {}) {
  const out = [];
  for (let i = look; i < bars.length; i++) {
    const b = bars[i], d = b.d || 0, v = b.v || 0; if (!v || Math.abs(d) < v * minPct) continue;
    let hh = -Infinity, ll = Infinity;
    for (let j = i - look; j < i; j++) { hh = Math.max(hh, bars[j].h); ll = Math.min(ll, bars[j].l); }
    if (b.h > hh && d < 0) out.push({ i, side: "bear" });
    else if (b.l < ll && d > 0) out.push({ i, side: "bull" });
  }
  return out;
}

// delta lớn nhất / nhỏ nhất trong nến và số lệnh, từ danh sách lệnh khớp theo đúng thứ tự thời gian
export function intrabar(trades) {
  let d = 0, hi = 0, lo = 0;
  for (const [, sq] of trades) { d += sq; if (d > hi) hi = d; if (d < lo) lo = d; }
  return { cvdH: hi, cvdL: lo, n: trades.length };
}
