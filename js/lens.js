// Lai Long Web: Kính lúp. Tay to đang làm gì, nhỏ lẻ đang làm gì, nhỏ lẻ có đang bị dắt không.
// Ghép các phép đo công khai theo từng giờ rồi quy về z-score so với chính lịch sử của tài sản đó:
//   tay to:  top trader so với đám đông (Binance), dòng tiền spot (tiền thật), Coinbase premium (tổ chức Mỹ)
//   nhỏ lẻ:  tỷ lệ tài khoản đang long, funding, dòng tiền perp (đòn bẩy)
//   OI và giá theo 4 góc: ai đang mở, ai đang đóng vị thế.
// Mọi z-score chỉ dùng dữ liệu trước thời điểm đang xét, nên phần "lịch sử" không nhìn trước tương lai.

export const HOUR = 36e5;
const clip = (x, a = 3) => Math.max(-a, Math.min(a, x));
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;

// ghép các chuỗi về cùng mốc giờ của nến perp. Ảnh chụp (OI, tỷ lệ) lấy ở lúc nến đóng, thiếu thì lấy lúc mở.
export function alignHourly({ perp = [], spot = [], cb = [], oi = [], top = [], acc = [], funding = [] }) {
  const key = t => Math.floor(t / HOUR) * HOUR;
  const map = arr => new Map(arr.map(x => [key(x.t), x]));
  const S = map(spot), C = map(cb), O = map(oi), T = map(top), A = map(acc);
  const snap = (M, t) => M.get(t + HOUR) ?? M.get(t);
  const fund = [...funding].sort((a, b) => a.t - b.t);
  let fi = -1;
  return perp.map(b => {
    while (fi + 1 < fund.length && fund[fi + 1].t <= b.t + HOUR) fi++;
    const s = S.get(key(b.t)), c = C.get(key(b.t)), o = snap(O, key(b.t)), tp = snap(T, key(b.t)), ac = snap(A, key(b.t));
    return {
      t: b.t, c: b.c, v: b.v, tb: b.tb,
      sc: s ? s.c : null, sv: s ? s.v : null, stb: s ? s.tb : null,
      cb: c ? c.c : null,
      oi: o ? o.v : null, top: tp ? tp.v : null, acc: ac ? ac.v : null, accLong: ac && ac.long != null ? ac.long : null,
      fund: fi >= 0 ? fund[fi].v : null,
    };
  });
}

// z-score của giá trị ở i so với W giá trị trước đó (không gồm chính nó); thiếu dữ liệu thì null
export function zAt(vals, i, W = 168, minN = 24) {
  const x = vals[i]; if (x == null || !isFinite(x)) return null;
  const h = [];
  for (let j = Math.max(0, i - W); j < i; j++) if (vals[j] != null && isFinite(vals[j])) h.push(vals[j]);
  if (h.length < minN) return null;
  const m = mean(h), sd = Math.sqrt(h.reduce((s, y) => s + (y - m) ** 2, 0) / (h.length - 1));
  return sd > 0 ? (x - m) / sd : 0;
}

// tỷ lệ mua chủ động ròng trong L nến: (mua - bán) / tổng, từ -1 tới 1
function flowAt(rows, i, L, vk, bk) {
  let v = 0, d = 0;
  for (let j = Math.max(0, i - L + 1); j <= i; j++) {
    const r = rows[j]; if (r[vk] == null || r[bk] == null) return null;
    v += r[vk]; d += 2 * r[bk] - r[vk];
  }
  return v > 0 ? d / v : null;
}
const chg = (rows, i, L, k) => (i >= L && rows[i][k] != null && rows[i - L][k] ? rows[i][k] / rows[i - L][k] - 1 : null);

// chuỗi đặc trưng thô cho mọi giờ (L: số giờ nhìn lại cho phần "đang thay đổi")
export function rawSeries(rows, L = 4) {
  return {
    dP: rows.map((_, i) => chg(rows, i, L, "c")),
    dOI: rows.map((_, i) => chg(rows, i, L, "oi")),
    tilt: rows.map(r => (r.top > 0 && r.acc > 0 ? Math.log(r.top / r.acc) : null)),
    crowd: rows.map(r => r.accLong),
    fund: rows.map(r => r.fund),
    perpFlow: rows.map((_, i) => flowAt(rows, i, L, "v", "tb")),
    spotFlow: rows.map((_, i) => flowAt(rows, i, L, "sv", "stb")),
    prem: rows.map(r => (r.cb && r.sc ? r.cb / r.sc - 1 : null)),
    vol: rows.map(r => (r.v > 0 ? Math.log(r.v) : null)),
  };
}

// OI và giá: 4 góc. zOI là z-score của thay đổi OI; |zOI| < 0,5 coi như OI đứng yên.
export function oiQuadrant(dP, dOI, zOI) {
  if (dP == null || dOI == null) return { id: "na", label: "Thiếu dữ liệu OI", who: "" };
  if (zOI != null && Math.abs(zOI) < 0.5) return { id: "flat", label: "OI gần như đứng yên", who: "Giá chạy chủ yếu nhờ lệnh spot hoặc vị thế cũ, không có đòn bẩy mới vào" };
  if (dP >= 0 && dOI >= 0) return { id: "longOpen", label: "Giá lên, OI lên", who: "Long mới đang mở: có tiền mới đặt cược giá lên" };
  if (dP >= 0) return { id: "shortCover", label: "Giá lên, OI giảm", who: "Short đang đóng (cover): cú tăng do bên bán khống bỏ chạy, ít tiền mới" };
  if (dOI >= 0) return { id: "shortOpen", label: "Giá giảm, OI lên", who: "Short mới đang mở: có tiền mới đặt cược giá xuống" };
  return { id: "longExit", label: "Giá giảm, OI giảm", who: "Long đang xả hoặc bị thanh lý: phe mua rút lui" };
}

export const COMPONENTS = [
  { id: "tilt", side: "whale", name: "Top trader so với đám đông", tip: "Top 20% tài khoản theo ký quỹ nghiêng long nhiều hơn đám đông (+) hay ít hơn (−)" },
  { id: "spotFlow", side: "whale", name: "Dòng tiền spot", tip: "Mua/bán chủ động trên thị trường spot: tiền thật, không đòn bẩy" },
  { id: "prem", side: "whale", name: "Coinbase premium", tip: "Giá Coinbase cao hơn Binance bất thường: tổ chức và quỹ Mỹ đang mua" },
  { id: "crowd", side: "retail", name: "Đám đông đang long", tip: "Tỷ lệ số tài khoản Binance đang long, so với bình thường" },
  { id: "fund", side: "retail", name: "Funding", tip: "Phí giữ vị thế: dương cao là phe long đông và trả tiền cho phe short" },
  { id: "perpFlow", side: "retail", name: "Dòng tiền perp", tip: "Mua/bán chủ động trên hợp đồng vĩnh cửu: chủ yếu đòn bẩy" },
];

// đọc trạng thái ở giờ i: điểm tay to, điểm nhỏ lẻ (−3..3, dương là nghiêng mua), OI 4 góc, cảnh báo bẫy
export function readAt(rows, raw, i, { W = 168 } = {}) {
  const z = {};
  for (const c of COMPONENTS) z[c.id] = zAt(raw[c.id], i, W);
  const zOI = zAt(raw.dOI, i, W), zVol = zAt(raw.vol, i, W);
  const avg = side => { const v = COMPONENTS.filter(c => c.side === side && z[c.id] != null).map(c => clip(z[c.id])); return v.length ? mean(v) : null; };
  const whale = avg("whale"), retail = avg("retail");
  const quad = oiQuadrant(raw.dP[i], raw.dOI[i], zOI);
  const trap = whale != null && retail != null && Math.abs(whale) >= 0.75 && Math.abs(retail) >= 0.75 && Math.sign(whale) !== Math.sign(retail);
  return { t: rows[i].t, i, z, zOI, zVol, whale, retail, quad, trap, price: rows[i].c, fund: rows[i].fund, crowd: rows[i].accLong };
}

const bucket = x => (x == null ? null : x >= 0.75 ? 1 : x <= -0.75 ? -1 : 0);
export const stateKey = r => (bucket(r.whale) == null || bucket(r.retail) == null ? null : `${bucket(r.whale)}|${bucket(r.retail)}`);

const SIDE = { 1: "mua", "-1": "bán", 0: "đứng ngoài" };
// một câu kết luận cho người đọc
export function verdict(r) {
  if (r.whale == null && r.retail == null) return { tone: 0, text: "Chưa đủ dữ liệu để đọc." };
  const bw = bucket(r.whale), br = bucket(r.retail);
  const parts = [];
  parts.push(bw == null ? "Chưa đọc được tay to" : bw === 0 ? "Tay to chưa lộ ý đồ rõ" : `Tay to đang nghiêng ${SIDE[bw]}`);
  parts.push(br == null ? "chưa đọc được nhỏ lẻ" : br === 0 ? "nhỏ lẻ đang cân bằng" : `nhỏ lẻ đang dồn phe ${SIDE[br]}`);
  let text = parts.join(", ") + ".";
  if (r.trap) text += ` Hai bên ngược nhau: nhỏ lẻ phe ${SIDE[br]} dễ bị quét nếu giá chạy theo tay to.`;
  else if (bw && br && bw === br) text += " Cả hai cùng một phía: đám đông đã vào, coi chừng đuối và quét ngược.";
  if (r.quad.id !== "na") text += ` ${r.quad.who}.`;
  return { tone: r.trap ? bw : bw || 0, text };
}

// lịch sử: mọi giờ có cùng trạng thái (tay to, nhỏ lẻ) như bây giờ thì sau H giờ giá đi đâu,
// so với nền là mọi giờ. Các mẫu liền nhau chồng lấn nên số mẫu "thật" nhỏ hơn n.
export function stateHistory(rows, raw, { horizons = [4, 12, 24], W = 168, key = null } = {}) {
  const reads = rows.map((_, i) => readAt(rows, raw, i, { W }));
  const now = reads[reads.length - 1], k = key ?? stateKey(now);
  const out = horizons.map(H => {
    const all = [], same = [];
    for (let i = 0; i + H < rows.length; i++) {
      const r = reads[i]; if (stateKey(r) == null) continue;
      const fwd = rows[i + H].c / rows[i].c - 1;
      all.push(fwd); if (stateKey(r) === k) same.push(fwd);
    }
    const st = a => ({ n: a.length, up: a.length ? a.filter(x => x > 0).length / a.length : NaN, avg: a.length ? mean(a) : NaN });
    return { H, same: st(same), base: st(all), upCount: same.filter(x => x > 0).length };
  });
  return { key: k, now, reads, out };
}

// tóm tắt cho máy quét: một hàng mỗi tài sản, mọi cột là z-score trừ khi ghi khác
export function scanRow(rows, { L = 4, W = 168 } = {}) {
  if (rows.length < 30) return null;
  const raw = rawSeries(rows, L), i = rows.length - 1, r = readAt(rows, raw, i, { W });
  const d24 = rows.length > 24 ? rows[i].c / rows[i - 24].c - 1 : null;
  const zs = [r.zVol, r.zOI, r.z.tilt, r.z.crowd, r.z.fund, r.z.perpFlow].filter(x => x != null);
  return { ...r, d24, dOI: raw.dOI[i], anomaly: zs.length ? Math.max(...zs.map(Math.abs)) : 0 };
}
