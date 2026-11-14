// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: hình vẽ trên biểu đồ footprint (thanh công cụ bên trái), lưu theo từng mã trong phiên.
//   line   đường ngang tại một giá            { p }
//   zone   vùng giá ngang hết biểu đồ           { p, p2 }
//   trend  đường xu hướng giữa hai điểm         { t1, p1, t2, p2 }
//   rect   hình chữ nhật thời gian × giá        { t1, p1, t2, p2 }
//   vline  đường dọc tại một thời điểm          { t }
//   fib    các mức Fibonacci giữa hai điểm      { t1, p1, t2, p2 }
//   text   ghi chú chữ                          { t, p, text }
//   avwap  VWAP neo từ một nến tới hiện tại      { t }
// Toạ độ thời gian là mốc ms của nến, đổi ra điểm ảnh qua xOfT nên hình đi theo khi kéo hay phóng biểu đồ.
// Bấm đúp lên hình để xoá.
const KEY = "lailong.draw.v1";
export const DRAW_COLORS = ["#ffd166", "#4dd0e1", "#ef476f", "#06d6a0", "#c792ea"];
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FONT = "11px 'IBM Plex Mono', Consolas, monospace";

// giá của từng mức Fibonacci: kéo từ p1 tới p2, mức 0 nằm ở p2, mức 1 nằm ở p1 (đo độ hồi về điểm đầu)
export function fibPrices(p1, p2, levels = FIB_LEVELS) { return levels.map(l => ({ l, p: p2 - (p2 - p1) * l })); }

// VWAP neo: từ nến chứa thời điểm t tới nến cuối, giá tiêu biểu (cao + thấp + đóng) / 3 nhân khối lượng
export function anchoredVwap(bars, i0) {
  const out = []; let pv = 0, v = 0;
  if (i0 < 0) return out;
  for (let i = i0; i < bars.length; i++) {
    const b = bars[i], q = b.v || 0; pv += (b.h + b.l + b.c) / 3 * q; v += q;
    out.push({ i, t: b.t, p: v > 0 ? pv / v : (b.h + b.l + b.c) / 3 });
  }
  return out;
}

// khoảng cách từ điểm tới đoạn thẳng (điểm ảnh)
export function segDist(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  const u = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0;
  return Math.hypot(x - (x1 + u * dx), y - (y1 + u * dy));
}

const pts = new WeakMap(); // điểm ảnh của đường VWAP neo ở lần vẽ gần nhất, để bấm đúp xoá

export class Drawings {
  constructor() {
    try { this.all = JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { this.all = {}; }
    this.sym = ""; this.tool = null; this.preview = null; this.colorI = 0;
  }
  save() { try { sessionStorage.setItem(KEY, JSON.stringify(this.all)); } catch { /* chế độ riêng tư */ } }
  list() { return this.all[this.sym] || []; }
  add(shape) { const s = { ...shape, color: shape.color || DRAW_COLORS[this.colorI++ % DRAW_COLORS.length], id: Date.now() + Math.random() }; (this.all[this.sym] || (this.all[this.sym] = [])).push(s); this.save(); return s; }
  remove(id) { this.all[this.sym] = this.list().filter(s => s.id !== id); this.save(); }
  clear() { delete this.all[this.sym]; this.save(); }
  // hình gần điểm (x, y) nhất trong 7 điểm ảnh; M = { yOf, xOfT, pw }
  hit(x, y, M) {
    let best = null, bd = 7;
    const take = (d, s) => { if (d < bd) { bd = d; best = s; } };
    for (const s of this.list()) {
      if (s.type === "line") take(Math.abs(M.yOf(s.p) - y), s);
      else if (s.type === "zone") { take(Math.abs(M.yOf(s.p) - y), s); take(Math.abs(M.yOf(s.p2) - y), s); }
      else if (s.type === "vline") take(Math.abs(M.xOfT(s.t) - x), s);
      else if (s.type === "trend") take(segDist(x, y, M.xOfT(s.t1), M.yOf(s.p1), M.xOfT(s.t2), M.yOf(s.p2)), s);
      else if (s.type === "rect") {
        const xa = M.xOfT(s.t1), xb = M.xOfT(s.t2), ya = M.yOf(s.p1), yb = M.yOf(s.p2);
        for (const [a, b, c, d] of [[xa, ya, xb, ya], [xb, ya, xb, yb], [xb, yb, xa, yb], [xa, yb, xa, ya]]) take(segDist(x, y, a, b, c, d), s);
      } else if (s.type === "fib") {
        const xa = Math.min(M.xOfT(s.t1), M.xOfT(s.t2));
        for (const f of fibPrices(s.p1, s.p2)) if (x >= xa - 4) take(Math.abs(M.yOf(f.p) - y), s);
      } else if (s.type === "text") {
        const tx = M.xOfT(s.t), ty = M.yOf(s.p), w = String(s.text || "").length * 7 + 10;
        if (x >= tx - 2 && x <= tx + w && y >= ty - 14 && y <= ty + 4) take(0, s);
      } else if (s.type === "avwap") {
        const p = pts.get(s) || [];
        for (let i = 1; i < p.length; i++) take(segDist(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]), s);
      }
    }
    return best;
  }
}

// vẽ mọi hình; o = { yOf, xOfT, pw, ph, dec, bars, iOfT }
export function drawShapes(ctx, shapes, preview, o) {
  const { yOf, pw, ph, dec } = o, xOfT = o.xOfT || (() => 0);
  ctx.save(); ctx.font = FONT; ctx.lineWidth = 1;
  for (const s of preview ? [...shapes, preview] : shapes) {
    const dash = s === preview ? [4, 3] : [];
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.setLineDash(dash);
    if (s.type === "zone") {
      const ya = yOf(Math.max(s.p, s.p2)), yb = yOf(Math.min(s.p, s.p2)); if (yb < 0 || ya > ph) continue;
      ctx.fillStyle = s.color + "22"; ctx.fillRect(0, ya, pw, Math.max(1, yb - ya));
      ctx.strokeRect(0.5, Math.round(ya) + 0.5, pw - 1, Math.max(1, Math.round(yb - ya)));
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = s.color;
      ctx.fillText(`${Math.min(s.p, s.p2).toFixed(dec)} – ${Math.max(s.p, s.p2).toFixed(dec)}`, 6, ya + 12);
    } else if (s.type === "line") {
      const y = Math.round(yOf(s.p)) + 0.5; if (y < 0 || y > ph) continue;
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke(); ctx.lineWidth = 1;
      tag(ctx, s.p.toFixed(dec), pw - 4, y, s.color);
    } else if (s.type === "vline") {
      const x = Math.round(xOfT(s.t)) + 0.5; if (x < 0 || x > pw) continue;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ph); ctx.stroke();
    } else if (s.type === "trend") {
      const x1 = xOfT(s.t1), y1 = yOf(s.p1), x2 = xOfT(s.t2), y2 = yOf(s.p2);
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.lineWidth = 1;
      for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
    } else if (s.type === "rect") {
      const x1 = xOfT(s.t1), y1 = yOf(s.p1), x2 = xOfT(s.t2), y2 = yOf(s.p2);
      ctx.fillStyle = s.color + "1f"; ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.strokeRect(Math.round(Math.min(x1, x2)) + 0.5, Math.round(Math.min(y1, y2)) + 0.5, Math.round(Math.abs(x2 - x1)), Math.round(Math.abs(y2 - y1)));
    } else if (s.type === "fib") {
      const x1 = xOfT(s.t1), x2 = xOfT(s.t2), xa = Math.min(x1, x2);
      ctx.setLineDash([]);
      ctx.strokeStyle = s.color + "88"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x1, yOf(s.p1)); ctx.lineTo(x2, yOf(s.p2)); ctx.stroke(); ctx.setLineDash(dash);
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      for (const f of fibPrices(s.p1, s.p2)) {
        const y = Math.round(yOf(f.p)) + 0.5; if (y < 0 || y > ph) continue;
        ctx.strokeStyle = f.l === 0.5 || f.l === 0.618 ? s.color : s.color + "aa"; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(pw, y); ctx.stroke();
        ctx.fillStyle = s.color; ctx.fillText(`${f.l} · ${f.p.toFixed(dec)}`, xa + 4, y - 2);
      }
    } else if (s.type === "text") {
      const x = xOfT(s.t), y = yOf(s.p), txt = String(s.text || ""); if (!txt || y < 0 || y > ph) continue;
      const w = ctx.measureText(txt).width + 10;
      ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(x, y - 14, w, 18); ctx.strokeRect(x + 0.5, y - 13.5, w - 1, 17);
      ctx.fillStyle = s.color; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(txt, x + 5, y - 5);
    } else if (s.type === "avwap" && o.bars) {
      const series = anchoredVwap(o.bars, o.iOfT ? o.iOfT(s.t) : -1), line = series.map(v => [xOfT(v.t), yOf(v.p)]);
      pts.set(s, line); if (!line.length) continue;
      ctx.lineWidth = 1.6; ctx.beginPath(); line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(line[0][0], line[0][1], 3.5, 0, Math.PI * 2); ctx.fill();
      const last = series[series.length - 1]; tag(ctx, `VWAP neo ${last.p.toFixed(dec)}`, pw - 4, line[line.length - 1][1], s.color);
    }
  }
  ctx.restore();
}

function tag(ctx, txt, xr, y, col) {
  ctx.setLineDash([]); ctx.font = FONT; const w = ctx.measureText(txt).width + 8;
  ctx.fillStyle = col; ctx.fillRect(xr - w, y - 8, w, 15); ctx.fillStyle = "#000"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(txt, xr - w + 4, y);
}
