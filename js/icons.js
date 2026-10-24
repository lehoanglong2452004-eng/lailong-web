// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: biểu tượng cho từng mã trong tin Telegram và bản tin.
// Coin dùng ký hiệu của chính coin đó (Unicode chưa có logo BTC, ETH nên dùng ₿ và Ξ), coin lạ dùng 🪙.
// Hàng hoá dùng vật: 🛢️ dầu, 🥇 vàng, 🥈 bạc (chưa có emoji thỏi vàng, thỏi bạc), 🪨 quặng đồng, 🔥 khí đốt, 🌽 ngô…
// Ngoại hối dùng cờ của hai nước trong cặp, chỉ số chứng khoán dùng 📈.
import { FLAG } from "./util.js?v=202610240629";

export const CCY = {
  ...FLAG, SGD: "🇸🇬", HKD: "🇭🇰", KRW: "🇰🇷", INR: "🇮🇳", MXN: "🇲🇽", BRL: "🇧🇷", TRY: "🇹🇷", ZAR: "🇿🇦",
  SEK: "🇸🇪", NOK: "🇳🇴", DKK: "🇩🇰", PLN: "🇵🇱", THB: "🇹🇭", VND: "🇻🇳", CNH: "🇨🇳",
};

// coin theo tên gốc của mã Binance (BTC trong BTCUSDT)
const COIN = {
  BTC: "₿", ETH: "Ξ", SOL: "◎", BNB: "🔶", XRP: "💧", DOGE: "🐕", SHIB: "🐕", PEPE: "🐸", ADA: "₳", LTC: "Ł",
  TON: "💎", LINK: "🔗", AVAX: "🔺", TRX: "🔻", USDC: "💵", USDT: "💵",
};
// hàng hoá, chỉ số và mã COT
const ASSET = {
  XAU: "🥇", GOLD: "🥇", PAXG: "🥇", GC: "🥇", XAG: "🥈", SILVER: "🥈", SI: "🥈", XPT: "⚪", XPD: "⚪",
  XCU: "🪨", COPPER: "🪨", HG: "🪨",
  CL: "🛢️", WTI: "🛢️", USOIL: "🛢️", OIL: "🛢️", BZ: "🛢️", BRENT: "🛢️", UKOIL: "🛢️",
  NG: "🔥", NATGAS: "🔥", ZC: "🌽", ZS: "🫘", ZW: "🌾", KC: "☕", SB: "🍬", CC: "🍫", LE: "🐄", HE: "🐖",
  ES: "📈", SPX: "📈", NQ: "📈", NDX: "📈", RTY: "📈", YM: "📈", DJI: "📈", VX: "🌡️", VIX: "🌡️",
  ZN: "📜", ZT: "📜", ZB: "📜", DX: "💵", DXY: "💵",
  "6E": CCY.EUR, "6J": CCY.JPY, "6B": CCY.GBP, "6A": CCY.AUD, "6C": CCY.CAD, "6S": CCY.CHF, "6N": CCY.NZD,
};
// nhóm của La bàn
export const GROUP = { Coin: "🪙", "Vàng": "🥇", "Dầu": "🛢️" };

const QUOTE = /^(?:1000)?([A-Z0-9]{2,}?)(USDT|USDC|USD|PERP)$/;

// biểu tượng của một mã: BTCUSDT, XAUUSDT, EURUSD, mã COT (GC, 6E…); không biết thì trả chuỗi rỗng
export function iconOf(sym) {
  const s = String(sym || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (ASSET[s] || COIN[s]) return ASSET[s] || COIN[s];
  const fx = s.match(/^([A-Z]{3})([A-Z]{3})$/);
  if (fx && CCY[fx[1]] && CCY[fx[2]]) return CCY[fx[1]] + CCY[fx[2]];
  const m = s.match(QUOTE);
  return m ? ASSET[m[1]] || COIN[m[1]] || "🪙" : "";
}

// gắn biểu tượng trước các mã giao dịch trong tin (BTCUSDT, XAUUSDT, EURUSD…). Chỉ nhận mã có đuôi USDT/USDC/USD
// hoặc cặp ngoại hối đủ hai đồng, nên chữ thường như "100 USDT", "USD CPI" giữ nguyên. Mã đã có biểu tượng thì bỏ qua.
export function withIcons(text) {
  return String(text ?? "").replace(/\b(?:1000)?[A-Z0-9]{2,16}\b/g, (tok, at, all) => {
    const fx = tok.match(/^([A-Z]{3})([A-Z]{3})$/), pair = (fx && CCY[fx[1]] && CCY[fx[2]]) || (QUOTE.test(tok) && !COIN[tok]);
    if (!pair) return tok;
    const ic = iconOf(tok);
    return all.slice(Math.max(0, at - ic.length - 1), at) === ic + " " ? tok : `${ic} ${tok}`;
  });
}
