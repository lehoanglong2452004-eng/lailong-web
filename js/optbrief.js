// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bản tin Quyền chọn gửi Telegram (phần tính toán và soạn tin, không đụng giao diện).
// Một dòng "Tóm lại", các mức cần nhớ (tường call, tường put, điểm lật gamma, max pain), biên độ dự kiến 3 hạn gần nhất,
// tâm lý và 3 lệnh lớn gần nhất. Mỗi phần có ô giải thích thu gọn (<blockquote expandable> của Telegram), bấm ⌄ để mở.
// Các mức tính trên những hạn trong 30 ngày, giống bảng "Đọc tâm lý quyền chọn"; max pain lấy hạn có OI lớn nhất trong 8 ngày.
import { termStructure, ivRank, realizedVol, putCall, flowSummary, readSentiment } from "./optpro.js?v=202610300405";
import { pick, levels, maxPain } from "./gex.js?v=202610300405";
import { refOf } from "./chain.js?v=202610300405";
import { escHtml } from "./discipline.js?v=202610300405";
import { iconOf } from "./icons.js?v=202610300405";

const DAY = 864e5;
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DOT = { 1: "🟢", "-1": "🔴", 0: "⚪" };
const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const dstr = t => { const d = new Date(t); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
const fmtM = v => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`;
// giá và strike: từ 1000 làm tròn, strike chẵn giữ nguyên, còn lại 2 số lẻ
const px = (v, spot) => spot >= 1000 ? Math.round(v).toLocaleString("en-US") : Number.isInteger(v) ? String(v) : v.toFixed(2);
// hạn của hợp đồng Deribit: BTC-26DEC26-90000-C → 26/12
export const expOf = name => { const m = /-(\d{1,2})([A-Z]{3})\d{2}-/.exec(name || ""); return m ? `${+m[1]}/${MON.indexOf(m[2]) + 1}` : ""; };

// mọi số liệu của bản tin; ex: { vol, trades, closes } như optview.js tải về. L truyền sẵn thì dùng luôn.
export function briefState({ asset, chain, live, ex = {}, L, now = Date.now() }) {
  const ts = termStructure(chain, now), pc = putCall(chain, now);
  const volVals = ex.vol ? ex.vol.map(r => r[1]) : [], rank = volVals.length ? ivRank(volVals) : null;
  const rv = ex.closes ? realizedVol(ex.closes, 30, live ? 365 : 252) : null;
  const flow = ex.trades ? flowSummary(ex.trades, { now, bigUsd: asset === "ETH" ? 50e3 : 100e3 }) : null;
  if (L === undefined) { const s = pick(chain, { maxDays: 30, now }); L = s.rows.length ? levels(s, now) : null; }
  // max pain của hạn lớn nhất (nhiều OI nhất) trong 8 ngày tới
  const oi = new Map();
  for (const r of chain.rows) { const t = chain.exps[r[1]]; if (t > now && t - now <= 8 * DAY) oi.set(t, (oi.get(t) || 0) + r[3]); }
  const big = [...oi].sort((a, b) => b[1] - a[1])[0], mp = big ? { exp: big[0], k: maxPain(pick(chain, { exp: big[0], now })) } : null;
  return { asset, chain, live, ts, pc, rank, rv, flow, ex, L, mp, now, lines: readSentiment({ ts, pc, rank, rv, flow, spot: chain.spot, gex: L }) };
}

// nghiêng tăng / giảm từ các câu tâm lý (mỗi câu +1, −1 hoặc 0)
export function leanOf(lines) {
  const score = lines.reduce((a, l) => a + l.dir, 0), up = lines.filter(l => l.dir > 0).length, dn = lines.filter(l => l.dir < 0).length;
  const text = score >= 2 ? "nghiêng tăng" : score <= -2 ? "nghiêng giảm" : score === 1 ? "trung lập, hơi nghiêng tăng" : score === -1 ? "trung lập, hơi nghiêng giảm" : "trung lập";
  return { score, up, dn, flat: lines.length - up - dn, text };
}

export function optBriefHtml(st) {
  const { asset, chain, live, ts, pc, rank, rv, flow, L, mp, lines, now } = st, spot = chain.spot;
  // GLD, SLV, USO: kèm giá vàng, bạc, dầu tương ứng ("≈ vàng 4,047")
  const R = refOf(chain), k = v => px(v, spot), g = v => R ? ` ≈ ${R.low} ${R.fmt(v)}` : "";
  const away = v => `${v >= spot ? "+" : ""}${((v / spot - 1) * 100).toFixed(1)}%`;
  const c30 = ts.cm[30] || {}, lean = leanOf(lines), ic = iconOf(asset), out = [];
  out.push(`📊 <b>QUYỀN CHỌN ${ic ? ic + " " : ""}${escHtml(asset)}</b> · ${hm(now)}`);
  out.push(`<i>Giá ${k(spot)}${g(spot)} · ${live ? "Deribit trực tiếp" : "CBOE trễ 15 phút"} · các hạn trong 30 ngày</i>`);
  const regime = !L ? "" : L.net >= 0 ? `, thị trường dễ đi ngang trong khoảng ${k(L.putWall)} – ${k(L.callWall)}` : ", biến động dễ bị khuếch đại, xu hướng dễ chạy xa";
  out.push("", `🎯 <b>Tóm lại: ${lean.text}</b>${regime}.`, `<i>${lean.up} dấu hiệu tăng · ${lean.dn} giảm · ${lean.flat} trung lập</i>`);

  if (L) {
    out.push("", "🧱 <b>CÁC MỨC CẦN NHỚ</b>",
      `🟥 Tường call <b>${k(L.callWall)}</b> (${away(L.callWall)})${g(L.callWall)}: kháng cự`,
      `🟩 Tường put <b>${k(L.putWall)}</b> (${away(L.putWall)})${g(L.putWall)}: hỗ trợ`);
    if (L.flip) out.push(`🟪 Điểm lật gamma <b>${k(L.flip)}</b>${g(L.flip)}: giá đang ${spot > L.flip ? "TRÊN, thị trường êm" : "DƯỚI, dễ giật mạnh"}`);
    if (mp && mp.k) out.push(`🧲 Max pain hạn ${dstr(mp.exp)}: <b>${k(mp.k)}</b>${g(mp.k)}, giá hay bị hút về đây sát giờ đáo hạn`);
    out.push(`<blockquote expandable>Tường call: giá thực hiện có nhiều call nhất phía trên giá. Nhà tạo lập đã bán các call này nên khi giá lên gần, họ bán ra để phòng hộ, tạo lực cản.
Tường put: tương tự ở phía dưới, họ mua vào khi giá xuống gần nên thành vùng đỡ.
Điểm lật gamma: trên mức này nhà tạo lập mua khi giá giảm và bán khi giá tăng (kéo giá về giữa); dưới mức này họ làm ngược lại (đẩy giá chạy xa hơn).
Max pain: mức giá làm người mua quyền chọn lỗ nhiều nhất lúc đáo hạn; sát ngày đáo hạn giá hay bị hút về đây.</blockquote>`);
  }

  const moves = ts.rows.slice(0, 3);
  if (moves.length) {
    out.push("", "📏 <b>BIÊN ĐỘ DỰ KIẾN</b>");
    for (const m of moves) {
      const em = m.atm * spot * Math.sqrt(m.days / 365);
      out.push(`Hạn ${dstr(m.exp)} (còn ${m.days < 2 ? m.days.toFixed(1) : Math.round(m.days)} ngày): <b>±${k(em)}</b> (±${(em / spot * 100).toFixed(2)}%) → ${k(spot - em)} – ${k(spot + em)}${R ? `\n   <i>≈ ${R.low} ${R.fmt(spot - em)} – ${R.fmt(spot + em)}</i>` : ""}`);
    }
    out.push(`<blockquote expandable>Tính từ IV của quyền chọn ngay giá hiện tại: biên độ = IV × giá × √(số ngày còn lại / 365). Quyền chọn đang định giá khoảng 68% khả năng giá vẫn nằm trong vùng này lúc đáo hạn. Giá ra ngoài vùng là thị trường bị bất ngờ. Cách dùng thường gặp: đặt cắt lỗ ngoài vùng, chốt lời trong vùng.</blockquote>`);
  }

  // tâm lý: mỗi dòng một ý ngắn; giải thích đầy đủ (readSentiment) để trong ô thu gọn
  const short = [];
  if (c30.rr != null) { const rr = c30.rr * 100; short.push([rr <= -3 ? -1 : rr >= 3 ? 1 : 0, `Skew ${rr >= 0 ? "+" : ""}${rr.toFixed(1)}: ${rr <= -3 ? "put đắt hơn call, đang sợ giảm" : rr >= 3 ? "call đắt hơn put, đang tham" : "call và put ngang giá"}`]); }
  if (ts.shape) short.push([ts.shape === "back" ? -1 : 0, ts.shape === "back" ? "Kỳ hạn đảo ngược: đang lo chuyện sắp tới" : ts.shape === "contango" ? "Kỳ hạn bình thường: không sợ ngắn hạn" : "Kỳ hạn phẳng: đang chuyển trạng thái"]);
  if (rank) { const r = Math.round(rank.rank * 100); short.push([0, `IV rank ${r}%: quyền chọn ${r >= 80 ? "rất đắt" : r <= 20 ? "rẻ, biến động dễ sắp bùng" : "giá trung bình"}`]); }
  if (rv != null && c30.atm != null) { const v = (c30.atm - rv) * 100; short.push([0, `IV ${(c30.atm * 100).toFixed(0)}% so với dao động thật ${(rv * 100).toFixed(0)}%: ${v > 8 ? "quyền chọn đắt" : v < -2 ? "thị trường đang bị bất ngờ" : "chênh bình thường"}`]); }
  if (pc && pc.oi != null) short.push([pc.oi > 1 ? -1 : pc.oi < 0.5 ? 1 : 0, `Put/call OI ${pc.oi.toFixed(2)}${pc.vol != null ? `, hôm nay ${pc.vol.toFixed(2)}` : ""}`]);
  if (flow && flow.n) { const tl = Math.round(flow.tilt * 100); short.push([tl > 20 ? 1 : tl < -20 ? -1 : 0, `Dòng tiền 24 giờ: phía tăng ${fmtM(flow.bull)}, phía giảm ${fmtM(flow.bear)}`]); }
  if (L && L.flip) short.push([spot > L.flip ? 1 : -1, `Giá ${spot > L.flip ? "trên" : "dưới"} điểm lật gamma`]);
  if (short.length) {
    out.push("", "🌡 <b>TÂM LÝ</b>", ...short.map(([dir, t]) => `${DOT[dir]} ${t}`));
    if (lines.length) out.push(`<blockquote expandable>${lines.map(l => escHtml(l.text)).join("\n\n")}</blockquote>`);
  }

  if (flow && flow.big.length) {
    out.push("", "🐋 <b>LỆNH LỚN GẦN NHẤT</b>");
    for (const b of flow.big.slice(0, 3)) {
      const e = expOf(b.name);
      out.push(`${(b.side === "buy") === b.call ? "🟢" : "🔴"} ${hm(b.t)} ${b.side === "buy" ? "Mua" : "Bán"} ${b.call ? "call" : "put"} ${k(b.strike)}${e ? ` hạn ${e}` : ""} · phí <b>${fmtM(b.prem)}</b>${b.block ? " · lệnh khối" : ""}`);
    }
  }
  out.push("", "<i>Bối cảnh để đọc thị trường, không phải tín hiệu vào lệnh.</i>");
  return out.join("\n");
}

export const optBriefText = st => {
  const L = st.L, lean = leanOf(st.lines);
  return `Quyền chọn ${st.asset}: ${lean.text}${L ? `, tường call ${Math.round(L.callWall)}, tường put ${Math.round(L.putWall)}` : ""}`;
};

// tin danh sách: mỗi tài sản một dòng (giá, nghiêng về đâu, khoảng giữa tường put và tường call); bấm nút bên dưới để xem bản đầy đủ
export function optListHtml(states, now = Date.now()) {
  const out = [`📊 <b>QUYỀN CHỌN · TỔNG QUAN</b> · ${hm(now)}`, "<i>Giá · nghiêng về đâu · tường put – tường call (hạn trong 30 ngày)</i>", ""];
  for (const st of states) {
    const spot = st.chain.spot, k = v => px(v, spot);
    const lean = leanOf(st.lines), dot = DOT[Math.sign(lean.score)], ic = iconOf(st.asset);
    out.push(`${ic ? ic + " " : ""}<b>${escHtml(st.asset)}</b> ${k(spot)} · ${dot} ${lean.text.replace("trung lập, ", "")}${st.L ? ` · ${k(st.L.putWall)} – ${k(st.L.callWall)}` : ""}`);
    const R = refOf(st.chain); // GLD, SLV, USO: thêm dòng quy ra giá vàng, bạc, dầu
    if (R) out.push(`   <i>≈ ${R.low} ${R.fmt(spot)}${st.L ? ` · ${R.fmt(st.L.putWall)} – ${R.fmt(st.L.callWall)}` : ""}</i>`);
  }
  out.push("", "👇 Bấm một mã để xem bản tin đầy đủ kèm giải thích.");
  return out.join("\n");
}

// hàng nút bên dưới tin: mỗi nút gửi lại "opt:<mã>" cho Desk đang mở
export const optKeyboard = ids => {
  const rows = [ids.filter(x => x === "BTC" || x === "ETH"), ids.filter(x => ["SPX", "NDX", "SPY", "QQQ"].includes(x)), ids.filter(x => !["BTC", "ETH", "SPX", "NDX", "SPY", "QQQ"].includes(x))];
  return { inline_keyboard: rows.filter(r => r.length).map(r => r.map(id => ({ text: `${iconOf(id)} ${id}`.trim(), callback_data: `opt:${id}` }))) };
};
