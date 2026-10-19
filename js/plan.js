// Lai Long Web: bản kế hoạch trước phiên (phần soạn nội dung, không vẽ). Trước mỗi phiên Á, Âu, Mỹ, gom cho một
// tài sản: bối cảnh lúc này, các vùng hợp lưu gần giá, những tín hiệu có lợi thế đã kiểm chứng trong đúng bối cảnh
// đó, tin mạnh sắp ra, và các tín hiệu vừa xuất hiện. Mục tiêu: vào phiên với kế hoạch, không mở app ra mới nghĩ.
import { TAGS, describe, sessionOf } from "./context.js?v=202610192356";
import { SIGNALS, VERDICT } from "./signals.js?v=202610192356";
import { KINDS } from "./levels.js?v=202610192356";

const H = 36e5;
export const SESSION_START = { asia: 0, eu: 7 * 60, us: 13 * 60 + 30, off: 20 * 60 }; // phút UTC

// phiên kế tiếp (hoặc đang chạy) và lúc bắt đầu
export function sessionWindow(now = Date.now()) {
  const cur = sessionOf(now), day = Math.floor(now / 864e5) * 864e5;
  return { id: cur, name: TAGS.session.vals[cur], start: day + SESSION_START[cur] * 6e4 };
}

const fmtP = (x, dec) => (x == null || !isFinite(x) ? "–" : x.toFixed(dec));
const sgn = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`;

// inp: {sym, price, dec, tagNow, zones, edges, news:[{t,title,country}], recent:[{sig,t,dir,price,verdict}], hName, now}
export function buildPlan(inp) {
  const { sym, price, dec = 2, tagNow = {}, zones = [], edges = [], news = [], recent = [], hName = "", now = Date.now() } = inp;
  const s = sessionWindow(now), out = { title: `${sym} · kế hoạch phiên ${s.name}`, at: now, sections: [] };
  out.sections.push({ name: "Bối cảnh lúc này", items: describe(tagNow).length ? describe(tagNow) : ["Chưa đủ dữ liệu để gắn bối cảnh"] });
  const near = zones.filter(z => Math.abs(z.dist) <= 3).slice(0, 6).sort((a, b) => b.mid - a.mid);
  out.sections.push({
    name: "Vùng hợp lưu gần giá (±3 ATR)",
    items: near.length ? near.map(z => `${z.mid >= price ? "Trên" : "Dưới"} ${fmtP(z.lo, dec)}–${fmtP(z.hi, dec)} · ${z.score.toFixed(1)} điểm · ${z.kinds.map(k => (KINDS[k] ? KINDS[k].name : k)).join(", ")}`) : ["Không có vùng nào trong ±3 ATR"],
  });
  out.sections.push({
    name: `Tín hiệu có lợi thế trong bối cảnh này (mốc ${hName}, sau phí)`,
    items: edges.length ? edges.slice(0, 6).map(e => {
      const st = e.best ? e.best.st : e.all, where = e.best ? ` khi ${TAGS[e.best.key].name.toLowerCase()} là ${TAGS[e.best.key].vals[e.best.v].toLowerCase()}` : "";
      return `${SIGNALS[e.sig] ? SIGNALS[e.sig].name : e.sig}${where}: ${st.n} lần, đúng ${Math.round(st.hit.p * 100)}%, kỳ vọng ${sgn(st.net.mean)} ATR`;
    }) : ["Chưa có tín hiệu nào qua kiểm chứng trong bối cảnh này. Ưu tiên đứng ngoài hoặc giảm khối lượng."],
  });
  const soon = news.filter(n => n.t >= now - H && n.t <= now + 12 * H).sort((a, b) => a.t - b.t).slice(0, 6);
  out.sections.push({
    name: "Tin mạnh trong 12 giờ tới",
    items: soon.length ? soon.map(n => `${new Date(n.t).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })} · ${n.country ? n.country + " · " : ""}${n.title}`) : ["Không có tin mạnh"],
  });
  const last = recent.filter(e => e.t >= now - 24 * H).slice(-6).reverse();
  out.sections.push({
    name: "Tín hiệu trong 24 giờ qua",
    items: last.length ? last.map(e => `${new Date(e.t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${SIGNALS[e.sig] ? SIGNALS[e.sig].name : e.sig} (${e.dir > 0 ? "lên" : "xuống"}) tại ${fmtP(e.price, dec)} · ${VERDICT[e.verdict] ? VERDICT[e.verdict].name : "chưa chấm"}`) : ["Không có"],
  });
  return out;
}

export function planText(p) {
  return [`📋 ${p.title}`, ...p.sections.flatMap(s => ["", `■ ${s.name}`, ...s.items.map(x => `• ${x}`)])].join("\n");
}
