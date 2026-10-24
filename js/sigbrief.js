// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: sổ tín hiệu gửi Telegram (phần soạn nội dung, không đụng giao diện).
// Tin danh sách: mỗi tín hiệu một dòng ở mốc chính, có lợi thế xếp trước, kèm bối cảnh lúc này và tín hiệu 24 giờ qua.
// Hàng nút bên dưới gửi lại "sig:<mã>:<khung>:<tín hiệu>" cho Desk đang mở (tgbot.js); Desk trả về bản chi tiết:
// kết quả theo từng mốc, bối cảnh chạy tốt hay kém, các lần gần nhất, giải thích để trong trích dẫn thu gọn.
import { SIGNALS, VERDICT, byContext, edgesFor, fmtH } from "./signals.js?v=202610240731";
import { describe } from "./context.js?v=202610240731";
import { escHtml } from "./discipline.js?v=202610240731";
import { iconOf } from "./icons.js?v=202610240731";

const H = 36e5;
const ORDER = { edge: 0, unclear: 1, lose: 2, few: 3 };
const DOT = { edge: "🟢", unclear: "⚪", lose: "🔴", few: "⚫" };
const HEAD = { edge: "CÓ LỢI THẾ", unclear: "CHƯA RÕ", lose: "THUA SAU PHÍ" };
// tên ngắn cho nút bấm (màn hình điện thoại chỉ hiện khoảng 18 chữ mỗi nút)
const SHORT = {
  "absorb.sell": "Hấp thụ bán ở đáy", "absorb.buy": "Hấp thụ mua ở đỉnh",
  "oi.longOpen": "OI: long mới", "oi.shortOpen": "OI: short mới", "oi.longExit": "OI: long xả", "oi.shortCover": "OI: short đóng",
  "crowd.whaleLong": "Tay to nghiêng long", "crowd.whaleShort": "Tay to nghiêng short",
  "zone.s2": "Hợp lưu 2,5–4,5 điểm", "zone.s3": "Hợp lưu từ 5 điểm", "wall.pulled": "Tường bị rút", "wall.eaten": "Tường bị ăn",
};
export const MAX_BTN = 12;
const CTX_MAX = 4;

const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const dm = t => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}`; };
const sgn = x => (x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`);
const pc = x => (x == null || !isFinite(x) ? "–" : `${Math.round(x * 100)}%`);
const nf = n => n.toLocaleString("en-US");
const px = (v, dec) => Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const sigOf = id => SIGNALS[id] || { name: id, group: "Khác", tip: "" };
export const shortName = id => SHORT[id] || sigOf(id).name.replace(/^Radar: /, "");
const head = r => `${iconOf(r.sym) ? iconOf(r.sym) + " " : ""}${escHtml(r.sym)} ${escHtml(r.tf)}`;

// bối cảnh của nến cuối (bỏ nhãn tin: chỉ đúng sau khi tin đã ra)
export function tagNowOf(r) {
  const t = { ...(r.tags[r.bars.length - 1] || {}) };
  delete t.news;
  return t;
}

// các dòng của sổ ở mốc chính: có lợi thế trước, rồi chưa rõ, thua sau phí, chưa đủ mẫu; trong nhóm thì kỳ vọng cao trước
export function sigRows(r) {
  return r.card.map(row => ({ sig: row.sig, st: row.h[r.hMain] })).filter(x => x.st)
    .sort((a, b) => ORDER[a.st.verdict] - ORDER[b.st.verdict] || b.st.net.mean - a.st.net.mean || b.st.n - a.st.n);
}

// tín hiệu có lợi thế đã kiểm chứng trong đúng bối cảnh lúc này
const fitNow = r => new Set(edgesFor(r.card, r.tags, tagNowOf(r), r.hMain, r.base).filter(e => e.best).map(e => e.sig));

export function sigListHtml(r, now = Date.now()) {
  const H0 = fmtH(r.hMain, r.tfMs), rows = sigRows(r), fit = fitNow(r);
  const out = [`📒 <b>SỔ TÍN HIỆU · ${head(r)}</b> · ${hm(now)}`,
    `<i>${r.days ? `${r.days} ngày · ` : ""}${nf(r.bars.length)} nến · mốc chính ${H0} · kỳ vọng mỗi lần sau phí, đơn vị ATR</i>`];
  const ctx = describe(tagNowOf(r));
  if (ctx.length) out.push("", `🧭 <b>Lúc này</b>: ${escHtml(ctx.join(" · "))}`);
  for (const v of ["edge", "unclear", "lose"]) {
    const g = rows.filter(x => x.st.verdict === v);
    if (!g.length) continue;
    out.push("", `${DOT[v]} <b>${HEAD[v]}</b>`);
    for (const { sig, st } of g) out.push(`• ${escHtml(sigOf(sig).name)} · ${st.n} lần · <b>${sgn(st.net.mean)}</b> · đúng ${pc(st.hit.p)}${fit.has(sig) ? " · 🎯 hợp lúc này" : ""}`);
  }
  const few = rows.filter(x => x.st.verdict === "few");
  if (few.length) out.push("", `${DOT.few} <i>Chưa đủ mẫu (dưới 30 lần): ${escHtml(few.map(x => shortName(x.sig)).join(", "))}</i>`);
  if (!rows.length) out.push("", "<i>Không tìm thấy tín hiệu nào trong giai đoạn này.</i>");
  const last = r.scored.filter(e => e.t >= now - 24 * H && e.t <= now).sort((a, b) => b.t - a.t).slice(0, 4);
  if (last.length) {
    out.push("", "🕒 <b>24 GIỜ QUA</b>");
    for (const e of last) out.push(`${e.dir > 0 ? "⬆" : "⬇"} ${hm(e.t)} ${escHtml(sigOf(e.sig).name)} tại ${px(e.price, r.dec)}`);
  }
  out.push("", "👇 Bấm một tín hiệu để xem nó chạy tốt trong bối cảnh nào.",
    `<blockquote expandable>Cách đọc: mỗi dòng là một loại tín hiệu Desk tự tìm lại trong lịch sử rồi chấm như một lệnh thật: vào ở giá mở của nến ngay sau tín hiệu, ra sau ${H0}, đã trừ phí và trượt giá hai chiều.
Số lần: số lần đã xuất hiện và đủ thời gian để chấm.
Kỳ vọng: lãi lỗ trung bình mỗi lần, tính bằng ATR (biên độ trung bình một nến lúc có tín hiệu). +0.20 nghĩa là mỗi lần trung bình lời 0.2 ATR sau phí.
Đúng: tỷ lệ số lần giá đi đúng hướng tín hiệu.
Có lợi thế: 70% số lần đầu có kỳ vọng dương chắc chắn (khoảng tin cậy 95% nằm trên 0) và 30% số lần gần nhất, phần chưa dùng để đánh giá, vẫn dương.
Chưa rõ: chưa chắc lời hay lỗ. Thua sau phí: đi theo tín hiệu này thường lỗ sau khi trừ phí.
🎯 hợp lúc này: tín hiệu đã có lợi thế trong đúng bối cảnh đang diễn ra.</blockquote>`,
    "<i>Thống kê quá khứ, không phải lời khuyên vào lệnh.</i>");
  return out.join("\n");
}

export function sigListText(r) {
  const rows = sigRows(r), n = v => rows.filter(x => x.st.verdict === v).length;
  return `Sổ tín hiệu ${r.sym} ${r.tf}: ${n("edge")} có lợi thế, ${n("unclear")} chưa rõ, ${n("lose")} thua sau phí`;
}

// bản chi tiết một tín hiệu
export function sigDetailHtml(r, sig, now = Date.now()) {
  const row = r.card.find(x => x.sig === sig);
  if (!row) return null;
  const sg = sigOf(sig), st = row.h[r.hMain], V = VERDICT[st.verdict], H0 = fmtH(r.hMain, r.tfMs);
  const out = [`📒 <b>${escHtml(sg.name)}</b> · ${head(r)} · ${hm(now)}`, `<i>${escHtml(sg.group)}${r.days ? ` · ${r.days} ngày lịch sử` : ""} · mốc chính ${H0}</i>`];

  out.push("", `${DOT[st.verdict]} <b>Kết luận: ${V.name}</b>`,
    `${st.n} lần · đúng hướng ${pc(st.hit.p)} · kỳ vọng <b>${sgn(st.net.mean)} ATR</b> mỗi lần sau phí`);
  if (st.n >= 2) out.push(`<i>Khoảng tin cậy 95%: ${sgn(st.net.lo)} … ${sgn(st.net.hi)}${st.edge != null ? ` · hơn nền ${sgn(st.edge)}` : ""}${st.oosN ? ` · 30% cuối ${sgn(st.oos.mean)} (${st.oosN} lần)` : ""}</i>`);

  out.push("", "📊 <b>THEO MỐC THỜI GIAN</b>");
  for (const h of r.horizons) {
    const x = row.h[h];
    out.push(`${fmtH(h, r.tfMs)}${h === r.hMain ? " ★" : ""}: ${x.n ? `<b>${sgn(x.net.mean)}</b> · đúng ${pc(x.hit.p)}` : "chưa chấm được"}${x.n && x.n < 30 ? " · ít mẫu" : ""}`);
  }
  out.push(`<blockquote expandable>Mỗi mốc là thời gian giữ lệnh: vào ở giá mở của nến ngay sau tín hiệu, ra ở giá đóng sau mốc đó. Số càng dương càng tốt; mốc nào dương rõ nhất là thời gian giữ hợp với tín hiệu này.
Khoảng tin cậy 95%: kỳ vọng thật gần như chắc nằm trong khoảng này. Cả khoảng trên 0 mới là lời chắc chắn.
Hơn nền: so với vào ngẫu nhiên ở mọi nến cùng hướng. Dương nghĩa là tín hiệu có ích thật, không chỉ ăn theo xu hướng chung.
30% cuối: các lần gần nhất, không dùng để kết luận, để xem lợi thế còn giữ được không.</blockquote>`);

  // bối cảnh: chỉ nêu nhóm có kết luận rõ (đủ 15 lần, khoảng tin cậy 99%)
  const tagNow = tagNowOf(r), good = [], bad = [];
  for (const g of byContext(row.list, r.tags, r.hMain, r.base)) {
    for (const x of g.rows) {
      const line = { now: tagNow[g.key] === x.v, mean: x.st.net.mean, text: `${escHtml(g.name)}: ${escHtml(x.name)} · ${x.st.n} lần · <b>${sgn(x.st.net.mean)}</b> · đúng ${pc(x.st.hit.p)}` };
      if (x.st.verdict === "edge") good.push(line); else if (x.st.verdict === "lose") bad.push(line);
    }
  }
  out.push("", "🧭 <b>BỐI CẢNH</b>");
  if (!good.length && !bad.length) out.push("<i>Chưa có bối cảnh nào tách bạch rõ (cần từ 15 lần và khoảng tin cậy 99%).</i>");
  // mỗi phía tối đa 4 dòng: bối cảnh đang diễn ra trước, rồi chênh lệch lớn trước
  const top = (ls, sign) => ls.sort((a, b) => b.now - a.now || sign * (b.mean - a.mean)).slice(0, CTX_MAX);
  for (const l of top(good, 1)) out.push(`🟢 ${l.text}${l.now ? " · <b>đang là lúc này</b>" : ""}`);
  for (const l of top(bad, -1)) out.push(`🔴 ${l.text}${l.now ? " · <b>đang là lúc này</b>" : ""}`);
  const more = Math.max(0, good.length - CTX_MAX) + Math.max(0, bad.length - CTX_MAX);
  if (more) out.push(`<i>+${more} bối cảnh khác ở tab Tín hiệu trên Desk.</i>`);
  const nowGood = good.some(l => l.now), nowBad = bad.some(l => l.now);
  if (nowGood || nowBad) out.push(`<i>Lúc này đang ở bối cảnh ${nowGood && !nowBad ? "tín hiệu chạy tốt" : nowBad && !nowGood ? "tín hiệu chạy kém" : "vừa tốt vừa kém, nên đứng ngoài"}.</i>`);
  out.push(`<blockquote expandable>Cùng một tín hiệu nhưng xảy ra ở phiên Á hay phiên Mỹ, biến động thấp hay cao, thì kết quả rất khác. Desk tách các lần xuất hiện theo từng bối cảnh rồi chấm lại.
Ở đây dùng khoảng tin cậy 99% thay vì 95%, vì soi nhiều nhóm cùng lúc thì dễ có nhóm đẹp do may.
🟢 là bối cảnh tín hiệu chạy tốt, nên ưu tiên. 🔴 là bối cảnh nên bỏ qua tín hiệu.</blockquote>`);

  const recent = row.list.slice().sort((a, b) => b.t - a.t).slice(0, 5);
  if (recent.length) {
    out.push("", "🕒 <b>CÁC LẦN GẦN NHẤT</b>");
    for (const e of recent) {
      const x = e.r && e.r[r.hMain];
      out.push(`${x ? (x.net > 0 ? "🟢" : "🔴") : "⏳"} ${dm(e.t)} ${hm(e.t)} · ${e.dir > 0 ? "Lên" : "Xuống"} tại ${px(e.price, r.dec)} · ${H0}: ${x ? `<b>${sgn(x.net)}</b>` : "đang chờ"}`);
    }
  }
  out.push("", `<blockquote expandable>💡 ${escHtml(sg.tip || sg.name)}</blockquote>`, "<i>Thống kê quá khứ, không phải lời khuyên vào lệnh.</i>");
  return out.join("\n");
}

export const sigDetailText = (r, sig) => {
  const row = r.card.find(x => x.sig === sig), st = row && row.h[r.hMain];
  return st ? `${sigOf(sig).name} (${r.sym} ${r.tf}): ${VERDICT[st.verdict].name}, ${st.n} lần, kỳ vọng ${sgn(st.net.mean)} ATR` : `${r.sym}: chưa có ${sigOf(sig).name}`;
};

// hàng nút: các tín hiệu đủ mẫu (có lợi thế trước), hai nút một hàng; cuối cùng là nút sổ và kế hoạch phiên
export function sigKeyboard(r, { list = true, plan = true } = {}) {
  const cb = x => `sig:${r.sym}:${r.tf}:${x}`;
  const btn = sigRows(r).filter(x => x.st.verdict !== "few").slice(0, MAX_BTN).map(x => ({ text: `${DOT[x.st.verdict]} ${shortName(x.sig)}`, callback_data: cb(x.sig) }));
  const rows = [];
  for (let i = 0; i < btn.length; i += 2) rows.push(btn.slice(i, i + 2));
  const last = [list && { text: "📒 Cả sổ", callback_data: cb("list") }, plan && { text: "📋 Kế hoạch phiên", callback_data: cb("plan") }].filter(Boolean);
  if (last.length) rows.push(last);
  return { inline_keyboard: rows };
}

// "sig:BTCUSDT:1h:div.bull" → { sym, tf, what }
export function parseSigTap(data) {
  const m = /^sig:([A-Z0-9]{2,20}):(\d{1,2}[mhd]):([a-zA-Z0-9.]{1,24})$/.exec(data || "");
  return m && { sym: m[1], tf: m[2], what: m[3] };
}

