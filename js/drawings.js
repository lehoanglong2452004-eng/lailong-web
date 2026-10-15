// Lai Long Web: vẽ đường ngang và vùng giá lên Bookmap và Footprint, lưu theo từng mã trên máy này.
//   Bấm "─ Đường" rồi bấm vào biểu đồ: một đường ngang tại giá đó.
//   Bấm "▤ Vùng" rồi kéo dọc trên biểu đồ: một vùng giá (hỗ trợ / kháng cự tự đánh dấu).
//   Bấm đúp lên đường hoặc mép vùng để xoá. Muốn được báo khi giá chạm thì đặt mức giá trong nút 🔔.
const KEY = "lailong.draw.v1";
export const DRAW_COLORS = ["#ffd166", "#4dd0e1", "#ef476f", "#06d6a0", "#c792ea"];

export class Drawings {
  constructor() {
    try { this.all = JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { this.all = {}; }
    this.sym = ""; this.tool = null; this.preview = null; this.colorI = 0;
  }
  save() { try { sessionStorage.setItem(KEY, JSON.stringify(this.all)); } catch { /* chế độ riêng tư */ } }
  list() { return this.all[this.sym] || []; }
  add(shape) { (this.all[this.sym] || (this.all[this.sym] = [])).push({ ...shape, color: DRAW_COLORS[this.colorI++ % DRAW_COLORS.length], id: Date.now() + Math.random() }); this.save(); }
  remove(id) { this.all[this.sym] = this.list().filter(s => s.id !== id); this.save(); }
  clear() { delete this.all[this.sym]; this.save(); }
  // tìm hình gần điểm y (điểm ảnh) nhất, trong 6 điểm ảnh
  hit(y, yOf) {
    let best = null, bd = 7;
    for (const s of this.list()) for (const p of s.type === "zone" ? [s.p, s.p2] : [s.p]) { const d = Math.abs(yOf(p) - y); if (d < bd) { bd = d; best = s; } }
    return best;
  }
}

// vẽ chung cho cả hai biểu đồ; trả về các nhãn để gắn lên trục giá
export function drawShapes(ctx, shapes, preview, { yOf, pw, ph, dec }) {
  const tags = [];
  for (const s of preview ? [...shapes, preview] : shapes) {
    if (s.type === "zone") {
      const ya = yOf(Math.max(s.p, s.p2)), yb = yOf(Math.min(s.p, s.p2)); if (yb < 0 || ya > ph) continue;
      ctx.fillStyle = s.color + "22"; ctx.fillRect(0, ya, pw, Math.max(1, yb - ya));
      ctx.strokeStyle = s.color; ctx.lineWidth = 1; ctx.setLineDash(s === preview ? [4, 3] : []);
      ctx.strokeRect(0.5, Math.round(ya) + 0.5, pw - 1, Math.max(1, Math.round(yb - ya))); ctx.setLineDash([]);
      ctx.font = "11px Segoe UI, sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = s.color;
      ctx.fillText(`${Math.min(s.p, s.p2).toFixed(dec)} – ${Math.max(s.p, s.p2).toFixed(dec)}`, 6, ya + 12);
      tags.push({ y: ya, col: s.color, txt: Math.max(s.p, s.p2).toFixed(dec) }, { y: yb, col: s.color, txt: Math.min(s.p, s.p2).toFixed(dec) });
    } else {
      const y = Math.round(yOf(s.p)) + 0.5; if (y < 0 || y > ph) continue;
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.5; ctx.setLineDash(s === preview ? [4, 3] : []);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
      tags.push({ y, col: s.color, txt: s.p.toFixed(dec) });
    }
  }
  return tags;
}
