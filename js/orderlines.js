// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: đường lệnh giả lập trên biểu đồ (Bookmap và Footprint), kiểu ATAS/Quantower.
//   - Lệnh chờ, giá vào, cắt lỗ (SL), chốt lời (TP) và giá thanh lý được vẽ thành đường ngang có nhãn.
//   - Kéo đường lệnh chờ, SL hoặc TP để sửa giá. Bấm đúp lên nhãn để huỷ lệnh hoặc bỏ SL/TP.
//   - Alt + bấm chuột lên biểu đồ để đặt nhanh lệnh limit tại giá đó (dưới giá hiện tại là MUA, trên là BÁN).
import { T } from "./theme.js?v=202610300405";
import { decimalsFor, fmtVol } from "./util.js?v=202610300405";

const GRAB = 6;

// lãi/lỗ (USDT) nếu vị thế đóng ở giá px
export const pnlAt = (pos, px) => pos && pos.qty ? (px - pos.avg) * pos.qty : 0;

export class OrderLines {
  // chart: có yOf(p), pAt(y), _L (pw, chiều cao vùng giá), dirty
  constructor(chart, canvas, { tick, plotH, onDrag, onCancel, onPlace, mark } = {}) {
    Object.assign(this, { chart, canvas, tick, plotH, onDrag, onCancel, onPlace, mark });
    this.orders = []; this.position = null; this.drag = null; this.targets = [];
    const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const hit = p => this.targets.find(t => Math.abs(t.y - p.y) <= GRAB && p.x <= chart._L.pw);
    canvas.addEventListener("mousedown", e => {
      if (e.button !== 0 || !chart._L) return;
      const p = pos(e), t = hit(p);
      if (t && t.drag) { e.preventDefault(); e.stopImmediatePropagation(); this.drag = { ...t, price: t.price }; canvas.style.cursor = "ns-resize"; return; }
      if (e.altKey && p.x <= chart._L.pw && this.onPlace) { e.preventDefault(); e.stopImmediatePropagation(); this.onPlace(this.snap(chart.pAt(p.y))); }
    }, true);
    canvas.addEventListener("dblclick", e => {
      const t = chart._L && hit(pos(e)); if (!t || !t.cancel) return;
      e.preventDefault(); e.stopImmediatePropagation(); this.onCancel && this.onCancel(t.kind, t.id);
    }, true);
    canvas.addEventListener("mousemove", e => {
      if (this.drag || !chart._L) return;
      const t = hit(pos(e)); canvas.style.cursor = t && t.drag ? "ns-resize" : "";
    });
    window.addEventListener("mousemove", e => {
      if (!this.drag) return;
      this.drag.price = this.snap(chart.pAt(pos(e).y)); chart.dirty = true;
    });
    window.addEventListener("mouseup", () => {
      if (!this.drag) return;
      const d = this.drag; this.drag = null; canvas.style.cursor = "";
      if (Math.abs(d.price - d.orig) > 1e-12 && this.onDrag) this.onDrag(d.kind, d.id, d.price);
      chart.dirty = true;
    });
  }
  snap(p) { const t = this.tick() || 0; return t ? Math.round(p / t) * t : p; }
  set(orders, position) { this.orders = orders || []; this.position = position; this.chart.dirty = true; }

  // vẽ; gọi từ hàm vẽ của biểu đồ
  draw(ctx, L) {
    const ph = this.plotH(L), dec = decimalsFor(this.tick() || 0.01), out = [];
    const d = this.drag, cur = (kind, id, p) => d && d.kind === kind && d.id === id ? d.price : p;
    const line = (t, price, color, text, dash) => {
      const y = Math.round(this.chart.yOf(price)) + 0.5; out.push({ ...t, y, price: t.orig, orig: t.orig });
      if (y < 0 || y > ph) return;
      ctx.save(); ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.lineWidth = t.drag ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "11px 'IBM Plex Mono', Consolas, monospace"; const label = (t.drag ? "⇕ " : "") + text, tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = color; ctx.fillRect(L.pw - tw - 4, y - 8, tw, 16);
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(label, L.pw - tw + 1, y);
      ctx.restore();
    };
    for (const o of this.orders) {
      const px = cur("order", o.id, o.price);
      line({ kind: "order", id: o.id, drag: true, cancel: true, orig: o.price }, px, o.side === "buy" ? T.up : T.down,
        `${o.side === "buy" ? "MUA" : "BÁN"} ${+o.remaining.toFixed(6)} @ ${px.toFixed(dec)}${o.queueAhead ? ` · trước ${fmtVol(o.queueAhead)}` : ""}`, [5, 4]);
    }
    const p = this.position;
    if (p && p.qty) {
      line({ kind: "entry", orig: p.avg }, p.avg, p.qty > 0 ? T.up : T.down, `${p.qty > 0 ? "LONG" : "SHORT"} ${+Math.abs(p.qty).toFixed(6)} @ ${p.avg.toFixed(dec)} · ${p.upnl >= 0 ? "+" : ""}${p.upnl.toFixed(2)} USDT`, []);
      if (p.liq > 0) line({ kind: "liq", orig: p.liq }, p.liq, "#a8711a", `Thanh lý ${p.liq.toFixed(dec)}`, [2, 3]);
      for (const [k, col] of [["sl", "#d9363e"], ["tp", "#159a64"]]) {
        if (p[k] == null) continue;
        const px = cur(k, k, p[k]), v = pnlAt(p, px);
        line({ kind: k, id: k, drag: true, cancel: true, orig: p[k] }, px, col, `${k.toUpperCase()} ${px.toFixed(dec)} · ${v >= 0 ? "+" : ""}${v.toFixed(2)} USDT`, [6, 3]);
      }
    }
    this.targets = out;
  }
  hitTest(x, y) {
    const t = this.chart._L && x <= this.chart._L.pw && this.targets.find(t => Math.abs(t.y - y) <= GRAB);
    if (!t) return null;
    if (t.kind === "order") return "Lệnh chờ giả lập. Kéo lên/xuống để đổi giá, bấm đúp để huỷ.";
    if (t.kind === "sl") return "Cắt lỗ (SL): giá chạm mức này thì đóng vị thế bằng lệnh market. Kéo để dời, bấm đúp để bỏ.";
    if (t.kind === "tp") return "Chốt lời (TP): giá chạm mức này thì đóng vị thế bằng lệnh market. Kéo để dời, bấm đúp để bỏ.";
    if (t.kind === "liq") return "Giá thanh lý ước tính của vị thế giả lập (ký quỹ cô lập).";
    return "Giá vào trung bình của vị thế giả lập và lãi/lỗ đang mở.";
  }
}
