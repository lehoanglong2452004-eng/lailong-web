// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: bản đồ nhiệt kiểu ô vuông cho tab Thị trường. Ô càng lớn giá trị càng lớn, màu theo % thay đổi.
//   squarify: chia hình chữ nhật thành các ô gần vuông (Bruls, Huizing, van Wijk 2000), giữ thứ tự từ lớn đến nhỏ.
//   layoutGroups: chia theo nhóm trước (ngành, loại hàng hoá), rồi chia từng nhóm cho các mã trong nhóm.

export function squarify(items, x, y, w, h) {
  const list = items.filter(it => it.v > 0).slice().sort((a, b) => b.v - a.v), out = [];
  const total = list.reduce((a, b) => a + b.v, 0);
  if (!total || w <= 0 || h <= 0) return out;
  const scale = w * h / total;
  let rest = list.map(it => ({ it, a: it.v * scale })), rx = x, ry = y, rw = w, rh = h;
  while (rest.length) {
    const side = Math.min(rw, rh);
    const worst = row => {
      const s = row.reduce((a, b) => a + b.a, 0), mx = Math.max(...row.map(q => q.a)), mn = Math.min(...row.map(q => q.a));
      return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn));
    };
    const row = [rest[0]]; let i = 1;
    while (i < rest.length && worst([...row, rest[i]]) <= worst(row)) row.push(rest[i++]);
    const s = row.reduce((a, b) => a + b.a, 0);
    if (rw >= rh) {
      const cw = s / rh; let cy = ry;
      for (const q of row) { const ch = q.a / cw; out.push({ ...q.it, x: rx, y: cy, w: cw, h: ch }); cy += ch; }
      rx += cw; rw -= cw;
    } else {
      const ch = s / rw; let cx = rx;
      for (const q of row) { const qw = q.a / ch; out.push({ ...q.it, x: cx, y: ry, w: qw, h: ch }); cx += qw; }
      ry += ch; rh -= ch;
    }
    rest = rest.slice(i);
  }
  return out;
}

// items: [{ sym, group, v, chg }] → { groups: [{ name, x, y, w, h }], tiles: [{ sym, chg, x, y, w, h, ... }] }
export function layoutGroups(items, w, h) {
  const by = new Map();
  for (const it of items) { if (!(it.v > 0)) continue; const g = by.get(it.group) || []; g.push(it); by.set(it.group, g); }
  const groups = squarify([...by].map(([name, list]) => ({ name, v: list.reduce((a, b) => a + b.v, 0), list })), 0, 0, w, h);
  const tiles = groups.flatMap(g => squarify(g.list, g.x, g.y, g.w, g.h));
  return { groups: groups.map(({ name, x, y, w, h }) => ({ name, x, y, w, h })), tiles };
}

// màu theo % thay đổi, chia 7 bậc quanh 0; scale là mức % coi là "mạnh" (đậm nhất)
export const HEAT_COLORS = ["#c2363b", "#8f2a2e", "#5a2528", "#33373d", "#1d5a3e", "#17844f", "#1a9a62"];
export function heatColor(chg, scale) {
  if (chg == null || !isFinite(chg)) return HEAT_COLORS[3];
  const r = chg / scale;
  return HEAT_COLORS[r <= -0.6 ? 0 : r <= -0.3 ? 1 : r <= -0.06 ? 2 : r < 0.06 ? 3 : r < 0.3 ? 4 : r < 0.6 ? 5 : 6];
}

// nhóm của các coin phổ biến; coin khác vào "Khác"
const SECTOR = {
  "Lớp 1": "BTC ETH SOL BNB ADA AVAX TRX TON SUI DOT NEAR APT SEI ATOM ICP HBAR ALGO KAS INJ TIA",
  "Thanh toán": "XRP XLM LTC BCH",
  "DeFi": "LINK UNI AAVE MKR LDO CRV ENA ONDO HYPE PENDLE JUP DYDX",
  "Lớp 2": "ARB OP POL MATIC STRK MNT IMX ZK",
  "Meme": "DOGE SHIB PEPE WIF BONK FLOKI 1000PEPE 1000SHIB 1000BONK 1000FLOKI TRUMP FARTCOIN PNUT POPCAT",
  "AI": "TAO FET RENDER WLD VIRTUAL AI16Z ARKM",
  // hợp đồng hàng hoá TradFi trên Binance Futures (vàng, bạc, bạch kim, palađi, đồng, dầu WTI, dầu Brent, khí gas)
  "Hàng hoá": "XAU XAG XPT XPD COPPER CL BZ NATGAS",
};
export const COMMODITY_PERPS = SECTOR["Hàng hoá"].split(" ");
const SECTOR_OF = new Map(Object.entries(SECTOR).flatMap(([g, s]) => s.split(" ").map(c => [c, g])));
export const sectorOf = coin => SECTOR_OF.get(coin) || "Khác";

// bảng 24 giờ của Binance Futures → các ô: chỉ hợp đồng USDT vĩnh cửu, top n theo giá trị giao dịch
// hợp đồng hàng hoá (XAUUSDT, CLUSDT…) luôn có mặt dù không lọt top n
export function cryptoTiles(tickers, n = 40) {
  const all = tickers
    .filter(t => /USDT$/.test(t.symbol) && !/_/.test(t.symbol) && +t.quoteVolume > 0)
    .map(t => { const coin = t.symbol.replace(/USDT$/, ""); return { sym: coin, symbol: t.symbol, group: sectorOf(coin.replace(/^1000/, "")), v: +t.quoteVolume, chg: +t.priceChangePercent, price: +t.lastPrice }; })
    .sort((a, b) => b.v - a.v);
  const top = all.slice(0, n);
  return top.concat(all.slice(n).filter(t => t.group === "Hàng hoá"));
}
