// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: lọc tin Việt Nam và gom tin nóng thành bản tin Telegram (phần tính toán, không đụng giao diện).
//
// Không bao giờ dùng tin của tác giả, báo hay tổ chức Việt Nam, kể cả tin tiếng Việt. Máy chủ đã bỏ các tin này
// (lailong/terminal/news.py, is_vietnamese); trình duyệt lọc lại y như vậy để file tin cũ còn trong bộ nhớ đệm cũng sạch.
//
// Bản tin nóng: tối đa một bản mỗi 30 phút, chỉ gồm tin nóng trong 2 giờ qua chưa gửi lần nào. Cùng một câu chuyện
// nhiều báo đưa thì gộp thành một dòng. Chủ đề ảnh hưởng giá mạnh (Fed, lạm phát, việc làm, lãi suất) xếp trước;
// tin chỉ thuần chính trị (bầu cử, phát ngôn) vẫn xem được ở trang Phân tích nhưng không gửi.
import { escHtml } from "./discipline.js?v=202610260704";

export const CATS = [
  { id: "econ", name: "Kinh tế", icon: "🏛" }, { id: "fin", name: "Tài chính", icon: "💹" }, { id: "metal", name: "Kim loại quý", icon: "🥇" },
  { id: "energy", name: "Năng lượng", icon: "🛢" }, { id: "geo", name: "Địa chính trị", icon: "🌍" }, { id: "crypto", name: "Crypto", icon: "₿" },
];

const VN_CHARS = /[ăđơưĂĐƠƯẠ-ỹ]/g;
const VN_WORDS = new RegExp("\\b(viet\\s?nam\\w*|cafef|cafebiz|vnexpress|vietstock|vneconomy|vnanet|tuoi\\s?tre|thanh\\s?nien|dan\\s?tri|znews|" +
  "zing\\s?news|kenh14|ttxvn|bnews|baodautu|tinnhanhchungkhoan|saigon\\w*|hanoi\\w*|markettimes|petrotimes|nhan\\s?dan|lao\\s?dong|tien\\s?phong)\\b", "i");
// tên ngắn chỉ tính khi là cả tên nguồn, để không bắt nhầm chữ trong tên báo nước ngoài
const VN_NAMES = new Set([..."vn vtv vov vtc vir plo sggp nld soha 24h vndirect ssi fiingroup cand qdnd".split(" "), "vtc news", "the investor"]);

export function isVN(x) {
  const src = String(x.source || "").trim(), title = String(x.title || "");
  let host = ""; try { host = new URL(x.link).hostname.toLowerCase(); } catch { /* đường dẫn hỏng */ }
  return /[ăđơưĂĐƠƯẠ-ỹ]/.test(src) || (title.match(VN_CHARS) || []).length >= 2 || VN_NAMES.has(src.toLowerCase()) ||
    VN_WORDS.test(src) || host.endsWith(".vn") || host.startsWith("vn.") || VN_WORDS.test(host.replace(/\./g, " "));
}

export const DIGEST_GAP = 30 * 60e3, DIGEST_AGE = 2 * 3600e3, DIGEST_MAX = 8;
const WEIGHT = { fed: 3, infl: 3, jobs: 3, cb: 3, trade: 2, oil: 2, opec: 2, mideast: 2, ruukr: 2, gold: 2, usd: 2, bonds: 2, banks: 2, china: 2, btc: 2, eth: 2, etf: 2, reg: 2, hack: 2 };
const CB = new Set(["Fed", "ECB"]);
const score = x => Math.max(1, ...(x.topics || []).map(t => WEIGHT[t] || 1)) + (CB.has(x.source) ? 2 : 0);
const STOP = new Set("that this with from after says said will over into amid their have more than what about could would when they been were just your here".split(" "));
const words = t => new Set((String(t).toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !STOP.has(w)));
// cùng một câu chuyện: chung từ 3 từ và chiếm từ nửa số từ của tiêu đề ngắn hơn
function sameStory(a, b) {
  let n = 0; for (const w of a) if (b.has(w)) n++;
  return n >= 3 && n >= Math.min(a.size, b.size) / 2;
}

// tin nóng chưa gửi trong 2 giờ qua, gộp theo câu chuyện, quan trọng trước.
// Trả về list (mỗi câu chuyện một dòng, also là các báo khác cùng đưa) và links (mọi tin đã xét, để đánh dấu đã gửi).
export function pickDigest(items, sent, now = Date.now()) {
  const fresh = (items || []).filter(x => x.hot && x.link && !sent.has(x.link) && !isVN(x) && now - x.t <= DIGEST_AGE && x.t <= now + 3600e3 &&
    !((x.topics || []).length && x.topics.every(t => t === "politics")));
  fresh.sort((a, b) => score(b) - score(a) || b.t - a.t);
  const list = [];
  for (const x of fresh) {
    const w = words(x.title), g = list.find(y => sameStory(y.w, w));
    if (g) { if (x.source !== g.source && !g.also.includes(x.source)) g.also.push(x.source); continue; }
    list.push({ ...x, w, also: [] });
  }
  return { list: list.map(({ w, ...x }) => x), links: fresh.map(x => x.link) };
}

const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const attr = s => escHtml(s).replace(/"/g, "&quot;");
// FinancialJuice ghi tên mình ở đầu tiêu đề: "FinancialJuice: Trump says…"
const title = x => x.title.startsWith(x.source + ": ") ? x.title.slice(x.source.length + 2) : x.title;

export function digestHtml(list, now = Date.now(), max = DIGEST_MAX) {
  const top = list.slice(0, max), out = [`📰 <b>TIN NÓNG</b> · ${hm(now)} · ${list.length} tin mới`];
  for (const c of CATS) {
    const g = top.filter(x => (x.cat || "crypto") === c.id).sort((a, b) => b.t - a.t);
    if (!g.length) continue;
    out.push("", `${c.icon} <b>${c.name}</b>`);
    for (const x of g) out.push(`• <a href="${attr(x.link)}">${escHtml(title(x))}</a>\n   <i>${escHtml([x.source, ...x.also.slice(0, 2)].join(", "))} · ${hm(x.t)}</i>`);
  }
  if (list.length > max) out.push("", `<i>+${list.length - max} tin nóng khác ở trang Phân tích.</i>`);
  return out.join("\n");
}
export const digestText = list => `Tin nóng: ${list.length} tin mới. ${title(list[0])}${list.length > 1 ? ` và ${list.length - 1} tin khác` : ""}`;
