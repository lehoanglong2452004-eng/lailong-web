// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: nhật ký tín hiệu trực tiếp. Những tín hiệu chỉ thấy được khi đang xem sổ lệnh (tường bị rút, tường
// bị ăn, iceberg giữ hoặc bị xuyên, Big Trade) được ghi lại ở đây để sổ tín hiệu chấm điểm về sau.
// Lưu trên máy này (localStorage, tối đa 5.000 sự kiện gần nhất); bản laptop gửi thêm về máy chủ (data/events)
// để không mất khi đổi trình duyệt.
export const EV_KEY = "lailong.events.v1";
const MAX = 5000;
let mem = null, queue = [], timer = null;
// máy chủ laptop chỉ chạy ở 127.0.0.1; bản web trên GitHub Pages không gọi
const LOCAL = typeof location !== "undefined" && /^(127\.0\.0\.1|localhost)$/.test(location.hostname);

const load = () => { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(EV_KEY) || "[]"); } catch { mem = []; } return mem; };
let saveT = null;
const save = () => { if (saveT) return; saveT = setTimeout(() => { saveT = null; try { localStorage.setItem(EV_KEY, JSON.stringify(mem.slice(-MAX))); } catch { /* đầy bộ nhớ: bỏ qua */ } }, 2000); };

// e: {sig, sym, ex, t, dir, price, ...}; id tự sinh để máy chủ bỏ trùng
export function logEvent(e) {
  const list = load(), ev = { id: `${e.sym}|${e.sig}|${e.t}|${e.price}`, ...e };
  if (list.length && list.some(x => x.id === ev.id)) return;
  list.push(ev); if (list.length > MAX) list.splice(0, list.length - MAX);
  save(); if (!LOCAL) return; queue.push(ev);
  if (!timer) timer = setTimeout(flush, 5000);
}
async function flush() {
  timer = null; if (!queue.length) return;
  const batch = queue.splice(0);
  try { const r = await fetch("api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: batch }) }); if (!r.ok) throw 0; }
  catch { /* bản web không có máy chủ: chỉ giữ trên máy này */ }
}

// mọi sự kiện đã ghi cho một mã (gộp máy này và máy chủ laptop nếu có)
export async function liveEvents(sym, days = 60) {
  const from = Date.now() - days * 864e5, by = new Map();
  for (const e of load()) if (e.sym === sym && e.t >= from) by.set(e.id, e);
  if (LOCAL) try {
    const r = await fetch(`api/events?days=${days}`);
    if (r.ok) for (const e of (await r.json()).events || []) if (e.sym === sym && e.t >= from) by.set(e.id, e);
  } catch { /* bỏ qua */ }
  return [...by.values()].sort((a, b) => a.t - b.t);
}
export const eventCount = () => load().length;

// đổi sự kiện của bộ theo dõi tường / iceberg / Big Trade thành sự kiện tín hiệu
export function fromWall(e, sym, ex) {
  if (e.kind === "spoof") return { sig: "wall.pulled", sym, ex, t: e.t, dir: e.side === "bid" ? -1 : 1, price: e.price, q: e.q };
  if (e.kind === "filled") return { sig: "wall.eaten", sym, ex, t: e.t, dir: e.side === "bid" ? -1 : 1, price: e.price, q: e.q };
  return null;
}
export function fromIce(e, sym, ex) {
  if (e.status === "held") return { sig: "ice.hold", sym, ex, t: e.tEnd || e.t1, dir: e.side === "bid" ? 1 : -1, price: e.price, q: e.filled };
  if (e.status === "broken") return { sig: "ice.break", sym, ex, t: e.tEnd || e.t1, dir: e.side === "bid" ? -1 : 1, price: e.price, q: e.filled };
  return null;
}
export const fromBig = (p, sym, ex) => ({ sig: p.side === "buy" ? "big.buy" : "big.sell", sym, ex, t: p.t, dir: p.side === "buy" ? 1 : -1, price: p.vwap, q: p.q });
