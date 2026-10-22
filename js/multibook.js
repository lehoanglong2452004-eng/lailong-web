// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: Multibook: gộp sổ lệnh và lệnh khớp của nhiều sàn cho cùng một mã, kiểu Bookmap Multibook.
// Mỗi sàn ghi vào sổ lệnh riêng; sổ gộp được dựng lại tối đa 10 lần mỗi giây bằng cách cộng khối lượng
// ở cùng mức giá (giá làm tròn theo bước giá của sàn chính). Khối lượng các sàn đều đã đổi ra số coin.
// Giá các sàn lệch nhau vài bước giá là bình thường; phần chéo nhau ở giữa được bỏ khi sắp xếp sổ.
import { Book } from "./market.js?v=202610220403";

export const MULTI_EX = ["BINANCE", "OKX", "BYBIT"];
export const multiPeers = primary => primary === "SIM" ? ["SIM"] : MULTI_EX.includes(primary) ? MULTI_EX.filter(x => x !== primary) : [];

export function mergeBooks(target, books, tick) {
  target.bids.clear(); target.asks.clear();
  const dec = tick > 0 ? Math.max(0, Math.ceil(-Math.log10(tick) - 1e-9)) : 8;
  const key = p => tick > 0 ? +(Math.round(p / tick) * tick).toFixed(dec) : p;
  for (const b of books) {
    for (const [p, q] of b.bids) { const k = key(p); target.bids.set(k, (target.bids.get(k) || 0) + q); }
    for (const [p, q] of b.asks) { const k = key(p); target.asks.set(k, (target.asks.get(k) || 0) + q); }
  }
  target._sorted = null;
}

// Mở thêm kết nối tới các sàn khác. h: {onTrades, onLiq, onBook, log}; trả về {close(), books, names}
export function connectPeers(EXCHANGES, primary, symbol, h) {
  const peers = [], closed = { v: false };
  for (const id of multiPeers(primary)) {
    const X = EXCHANGES[id]; if (!X) continue;
    const entry = { id, name: X.name, book: new Book(), conn: null, ok: false };
    peers.push(entry);
    (async () => {
      try {
        const info = await X.info(symbol);
        if (closed.v) return;
        if (id !== "SIM" && !(info && info.tick > 0)) throw new Error("không có mã này");
        entry.conn = X.connect(symbol, info, entry.book, {
          onBook: () => { entry.ok = true; h.onBook(); },
          onTrades: list => h.onTrades(list.map(t => ({ ...t, ex: id }))),
          onLiq: list => h.onLiq(list),
          onStatus: (text, ok) => h.log(`[Multibook ${X.name}] ${text}`, ok),
        });
      } catch (e) { entry.err = e.message; h.log(`[Multibook] ${X.name} không có ${symbol}: ${e.message}`, false); }
    })();
  }
  return {
    peers,
    books: () => peers.filter(p => p.ok).map(p => p.book),
    names: () => peers.filter(p => p.ok).map(p => p.name),
    close() { closed.v = true; for (const p of peers) if (p.conn) p.conn.close(); },
  };
}
