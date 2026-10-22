// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: kiểm tra tiến (forward test).
// Khoá một bộ thông số tại thời điểm T. Mọi lệnh sau T là dữ liệu chiến lược chưa từng "nhìn thấy" lúc chọn
// thông số, nên là bài kiểm tra trung thực nhất. Nến lịch sử luôn tải lại được từ sàn, vì vậy không cần
// máy chạy liên tục: mỗi lần mở trang, app chạy lại chiến lược trên nến mới và chỉ tính các lệnh vào sau T.

// pre: thống kê backtest lúc khoá; fwd: thống kê các lệnh sau khi khoá
export function forwardVerdict(pre, fwd) {
  if (!fwd.n) return { txt: "Chưa có lệnh mới", cls: "" };
  if (fwd.n < 10) return { txt: `Mới ${fwd.n} lệnh, chờ thêm`, cls: "" };
  if (fwd.n >= 30 && fwd.ci.lo > 0) return { txt: "Lợi thế được xác nhận", cls: "pos" };
  if (fwd.avgR <= 0) return fwd.n >= 20 ? { txt: "Mất lợi thế", cls: "neg" } : { txt: "Đang âm, theo dõi thêm", cls: "neg" };
  if (pre.avgR > 0 && fwd.avgR < pre.avgR * 0.5) return { txt: "Còn dương nhưng yếu đi rõ", cls: "" };
  return { txt: "Đang giữ được lợi thế", cls: "pos" };
}

// số nến cần tải: phần khởi động trước lúc khoá (để chỉ báo ổn định) cộng phần từ lúc khoá tới nay
export function barsNeeded(lockT, intervalMs, now = Date.now(), warmup = 600) {
  return Math.min(90000, warmup + Math.max(0, Math.ceil((now - lockT) / intervalMs)) + 2);
}
