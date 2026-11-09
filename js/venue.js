// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: sàn chung cho mọi tab crypto. Ô Sàn trên cùng đổi sàn thì Terminal, Đa biểu đồ, bản đồ nhiệt
// crypto, Nhật ký, Đồng thuận, Kịch bản sốc… đều lấy dữ liệu của sàn đó. Chế độ Giả lập dùng Binance cho các tab khác.
// Dữ liệu Yahoo (chứng khoán, forex, hàng hoá), tin tức và mạng xã hội không đổi theo sàn.
import { EXCHANGES } from "./exchanges.js?v=202611090440";

let cur = "BINANCE";
export const getVenue = () => cur;
export const venueName = (v = cur) => (EXCHANGES[v] ? EXCHANGES[v].name : v);
export function setVenue(v) {
  v = v && v !== "SIM" && EXCHANGES[v] ? v : "BINANCE";
  if (v === cur) return;
  cur = v;
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("lailong-venue", { detail: v }));
}
export function onVenue(f) { if (typeof document !== "undefined") document.addEventListener("lailong-venue", e => f(e.detail)); }

// nến của sàn đang chọn: [{ t, o, h, l, c, v, bv }] (bv: khối lượng mua chủ động, chỉ Binance có, sàn khác là null)
export function venueBars(symbol, interval, n, v = cur) { return EXCHANGES[v].klines(symbol, interval, n); }
// bảng giá 24 giờ của sàn đang chọn: [{ symbol, last, change, volUsd }]
export function venueTickers(v = cur) { return EXCHANGES[v].listSymbols(); }
