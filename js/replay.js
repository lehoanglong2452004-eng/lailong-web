// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: phát lại sổ lệnh đã ghi bằng máy ghi 24/7 (như chế độ Replay của Bookmap).
//
// Dữ liệu là các dòng 2 giây của máy ghi. Phát lại dựng một MarketState riêng: các cột được thêm dần theo
// đồng hồ ảo (tốc độ x1 tới x60), sổ lệnh COB dựng lại từ dòng mới nhất. Bản đồ chỉ cần đổi nguồn sang
// thị trường phát lại và dùng đồng hồ ảo; kết nối trực tiếp vẫn chạy ngầm.
import { MarketState } from "./market.js?v=202611042121";

export class Replay {
  // rows: dòng của máy ghi (đã sắp theo thời gian); tick: bước giá của mã
  constructor(rows, { symbol = "", tick = 0 } = {}) {
    const m = this.m = new MarketState();
    m.reset({ symbol, tick, exchange: "BINANCE" });
    m.grid = rows.length ? rows[rows.length - 1].g : 0;
    m.addRecorded(rows);
    this.all = m.cols; m.cols = [];
    this.t0 = this.all.length ? this.all[0].t : 0;
    const last = this.all[this.all.length - 1];
    this.t1 = last ? last.t + (last.span || 2000) : 0;
    this.speed = 5; this.playing = false; this.vt = this.t0; this.i = 0;
  }
  get ready() { return this.all.length > 0; }
  now() { return this.vt; }

  // nhảy tới thời điểm t (trong khoảng đã tải)
  seek(t) {
    this.vt = Math.max(this.t0, Math.min(this.t1, t));
    this.i = upper(this.all, this.vt);
    this.m.cols = this.all.slice(0, this.i);
    this._book();
  }

  // gọi mỗi khung hình với số mili giây thật đã trôi qua
  advance(dtMs) {
    if (!this.playing || !this.ready) return false;
    this.vt = Math.min(this.t1, this.vt + dtMs * this.speed);
    const n0 = this.i;
    while (this.i < this.all.length && this.all[this.i].t <= this.vt) this.m.cols.push(this.all[this.i++]);
    if (this.i !== n0) this._book();
    if (this.vt >= this.t1) this.playing = false;
    return true;
  }

  // sổ lệnh tại thời điểm hiện tại: dựng lại từ cột mới nhất (ô lưới của máy ghi)
  _book() {
    const c = this.m.cols[this.m.cols.length - 1], b = this.m.book, g = this.m.grid;
    b.clear();
    if (!c || !c.keys) return;
    for (let j = 0; j < c.keys.length; j++) b.set(j < c.knb ? "bid" : "ask", +(c.keys[j] * g).toPrecision(12), c.sizes[j]);
    b.ts = c.t;
    if (c.lp != null) this.m.last = { p: c.lp, q: 0, side: c.bv >= c.sv ? "buy" : "sell", t: c.t };
  }
}

function upper(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t <= t) lo = m + 1; else hi = m; }
  return lo;
}
