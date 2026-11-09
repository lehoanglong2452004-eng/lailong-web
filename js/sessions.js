// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: giờ mở cửa của các thị trường để biết giá đứng yên là do nghỉ (bình thường) hay do nguồn chậm (cần xem lại).
// Tính theo giờ New York nên tự đúng khi Mỹ đổi giờ mùa hè. Không tính ngày lễ.
//   fx:     Chủ nhật 17:00 tới thứ Sáu 17:00 (New York)
//   cme:    hàng hoá CME/NYMEX/COMEX: Chủ nhật 18:00 tới thứ Sáu 17:00, nghỉ 17:00–18:00 mỗi ngày
//   us:     chứng khoán Mỹ: thứ Hai tới thứ Sáu 09:30–16:00
//   crypto: luôn mở

const NY = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
// thứ (0 = Chủ nhật) và phút trong ngày theo giờ New York
export function nyClock(t) {
  const p = Object.fromEntries(NY.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { wd: WD[p.weekday], min: +p.hour * 60 + +p.minute };
}
export function isOpen(kind, t = Date.now()) {
  if (kind === "crypto") return true;
  const { wd, min } = nyClock(t);
  if (kind === "us") return wd >= 1 && wd <= 5 && min >= 570 && min < 960;
  if (kind === "fx") return (wd === 0 && min >= 1020) || (wd >= 1 && wd <= 4) || (wd === 5 && min < 1020);
  if (kind === "cme") {
    if (wd === 6 || (wd === 0 && min < 1080) || (wd === 5 && min >= 1020)) return false;
    return !(min >= 1020 && min < 1080);
  }
  return true;
}
// lúc mở cửa lại gần nhất (ms), dò từng 15 phút trong 4 ngày tới
export function nextOpen(kind, t = Date.now()) {
  if (isOpen(kind, t)) return t;
  const s = Math.ceil(t / 900e3) * 900e3;
  for (let x = s; x < t + 4 * 864e5; x += 900e3) if (isOpen(kind, x)) return x;
  return null;
}
const VN_DAY = ["Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"];
const VN = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
// "05:00 thứ Hai" theo giờ Việt Nam; cùng ngày thì chỉ giờ
export function vnWhen(t, now = Date.now()) {
  const p = o => Object.fromEntries(VN.formatToParts(new Date(o)).map(x => [x.type, x.value]));
  const a = p(t), b = p(now), hm = `${a.hour}:${a.minute}`;
  return a.weekday === b.weekday && t - now < 864e5 ? hm : `${hm} ${VN_DAY[WD[a.weekday]]}`;
}
export const vnTime = t => { const a = Object.fromEntries(VN.formatToParts(new Date(t)).map(x => [x.type, x.value])); return `${a.hour}:${a.minute}`; };
// trạng thái gọn để gắn nhãn: { open, label } — label "Đóng cửa · mở lại 05:00 thứ Hai" khi đang nghỉ
export function marketStatus(kind, t = Date.now()) {
  if (isOpen(kind, t)) return { open: true, label: "" };
  const r = nextOpen(kind, t);
  return { open: false, label: r ? `Đóng cửa · mở lại ${vnWhen(r, t)}` : "Đóng cửa" };
}
