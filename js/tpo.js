// Lai Long Web: biểu đồ TPO (Market Profile). Mỗi phiên là một ngày UTC, mỗi 30 phút là một chữ cái (A, B, C…);
// chữ được đặt vào mọi mức giá mà giá đã chạm trong 30 phút đó. Từ đó ra POC (mức nhiều chữ nhất), vùng giá trị 70%,
// biên độ đầu phiên IB (2 chữ đầu), các chữ đơn lẻ (single print) và POC chưa bị chạm lại (naked POC).
import { fitCanvas, fmtVol, decimalsFor, niceStep, pad2, MONO } from "./util.js?v=202610152113";
import { T, alpha } from "./theme.js?v=202610152113";

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXabcdefghijklmnopqrstuvwx";
const PERIOD = 30 * 60e3, DAY = 864e5;

// dựng các phiên từ nến nhỏ (5 phút); step là độ cao một tầng giá
export function buildTpo(bars, step, { session = DAY, period = PERIOD } = {}) {
  const map = new Map();
  for (const b of bars) {
    const s0 = Math.floor(b.t / session) * session, p = Math.floor((b.t - s0) / period);
    let s = map.get(s0);
    if (!s) map.set(s0, s = { start: s0, rows: new Map(), vol: new Map(), open: b.o, close: b.c, high: -Infinity, low: Infinity, periods: new Set(), last: b.t });
    s.close = b.c; s.high = Math.max(s.high, b.h); s.low = Math.min(s.low, b.l); s.last = Math.max(s.last, b.t); s.periods.add(p);
    const k1 = Math.floor(b.l / step + 1e-9), k2 = Math.floor(b.h / step + 1e-9);
    for (let k = k1; k <= k2; k++) {
      const set = s.rows.get(k) || new Set(); set.add(p); s.rows.set(k, set);
      s.vol.set(k, (s.vol.get(k) || 0) + b.v / (k2 - k1 + 1));
    }
  }
  return [...map.values()].sort((a, b) => a.start - b.start).map(s => finish(s, step));
}

function finish(s, step) {
  const ks = [...s.rows.keys()].sort((a, b) => a - b), cnt = k => s.rows.get(k)?.size || 0;
  const total = ks.reduce((a, k) => a + cnt(k), 0);
  // POC: nhiều chữ nhất; hoà thì lấy mức gần giữa biên độ phiên
  const mid = (s.high + s.low) / 2 / step;
  const poc = ks.reduce((a, k) => cnt(k) > cnt(a) || (cnt(k) === cnt(a) && Math.abs(k - mid) < Math.abs(a - mid)) ? k : a, ks[0]);
  let lo = poc, hi = poc, acc = cnt(poc);
  while (acc < total * 0.7 && (lo > ks[0] || hi < ks[ks.length - 1])) {
    const up = hi < ks[ks.length - 1] ? cnt(hi + 1) : -1, dn = lo > ks[0] ? cnt(lo - 1) : -1;
    if (up >= dn) { hi++; acc += up; } else { lo--; acc += dn; }
  }
  const ps = [...s.periods].sort((a, b) => a - b), ib = ps.slice(0, 2);
  const ibRows = ks.filter(k => ib.some(p => s.rows.get(k).has(p)));
  // chữ đơn lẻ: mức chỉ có 1 chữ, nằm giữa phiên (không tính 2 đầu mút)
  const singles = ks.filter((k, i) => i > 0 && i < ks.length - 1 && cnt(k) === 1);
  return {
    start: s.start, last: s.last, open: s.open, close: s.close, high: s.high, low: s.low, rows: s.rows, vol: s.vol, keys: ks, total,
    poc, vah: hi, val: lo, ibHigh: ibRows.length ? Math.max(...ibRows) : null, ibLow: ibRows.length ? Math.min(...ibRows) : null,
    singles, maxCount: cnt(poc), periods: ps.length,
  };
}

// POC của phiên trước chưa bị giá quay lại chạm: thường là nam châm hút giá
export function nakedPocs(sessions) {
  const out = [];
  sessions.forEach((s, i) => {
    const later = sessions.slice(i + 1);
    if (later.length && !later.some(n => n.rows.has(s.poc))) out.push({ k: s.poc, from: s.start });
  });
  return out;
}

export class TpoChart {
  constructor(canvas) {
    this.cv = canvas; this.S = fitCanvas(canvas, () => { this.dirty = true; }); this.ctx = this.S.ctx;
    this.bars = []; this.step = 0; this.stepMult = 1; this.sessions = []; this.tick = 0.1;
    this.yOff = 0; this.xOff = 0; this.rowH = 12; this.mouse = null; this.drag = null; this.dirty = true; this.mode = "letters";
    this._bind();
    const loop = () => { if (this.dirty) { this.dirty = false; this._draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  setBars(bars, tick) {
    this.bars = bars; this.tick = tick || this.tick;
    const day = bars.filter(b => b.t > Date.now() - DAY);
    const rng = day.length ? Math.max(...day.map(b => b.h)) - Math.min(...day.map(b => b.l)) : 0;
    this.baseStep = Math.max(this.tick, niceStep(rng / 45 || this.tick));
    this.rebuild(); this.yOff = 0; this.xOff = 0;
  }
  update(bar) { // nến 5 phút mới hoặc đang chạy
    const last = this.bars[this.bars.length - 1];
    if (last && last.t === bar.t) this.bars[this.bars.length - 1] = bar; else if (!last || bar.t > last.t) this.bars.push(bar); else return;
    this.rebuild();
  }
  rebuild() {
    if (!this.bars.length) { this.sessions = []; this.dirty = true; return; }
    this.step = this.baseStep * this.stepMult;
    this.sessions = buildTpo(this.bars, this.step); this.naked = nakedPocs(this.sessions); this.dirty = true;
  }
  _layout() {
    const { w, h } = this.S, cw = this.mode === "letters" ? 7 : 4;
    const cols = this.sessions.map(s => Math.max(60, s.maxCount * cw + 70));
    return { w, h, cw, cols, top: 22, bot: h - 4, axisW: 70 };
  }
  _draw() {
    const ctx = this.ctx, { w, h, cw, cols, top, bot, axisW } = this._layout();
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h);
    if (!this.sessions.length) { ctx.fillStyle = T.muted; ctx.font = `12px ${MONO}`; ctx.textAlign = "center"; ctx.fillText("Đang tải nến 5 phút để dựng TPO…", w / 2, h / 2); return; }
    const step = this.step, dec = decimalsFor(step), last = this.sessions[this.sessions.length - 1];
    const rh = this.rowH, midK = (last.close / step) + this.yOff;
    const yOf = k => (top + bot) / 2 - (k - midK) * rh;
    // vị trí các cột: phiên mới nhất sát trục giá bên phải
    let x = w - axisW - 8 + this.xOff; const xs = [];
    for (let i = this.sessions.length - 1; i >= 0; i--) { x -= cols[i]; xs[i] = x; }
    ctx.font = `${Math.min(11, rh)}px ${MONO}`; ctx.textBaseline = "middle";
    this._hit = [];
    // naked POC kéo dài sang phải
    for (const n of this.naked) {
      const i = this.sessions.findIndex(s => s.start === n.from), y = yOf(n.k + 0.5);
      if (i < 0 || y < top || y > bot) continue;
      ctx.strokeStyle = alpha(T.accent, 0.55); ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(xs[i] + cols[i] - 30, y); ctx.lineTo(w - axisW, y); ctx.stroke(); ctx.setLineDash([]);
    }
    this.sessions.forEach((s, i) => {
      const x0 = xs[i]; if (x0 > w - axisW || x0 + cols[i] < 0) return;
      const lx = x0 + 14;
      // nền vùng giá trị
      ctx.fillStyle = alpha(T.accent, 0.07); ctx.fillRect(x0 + 10, yOf(s.vah + 1), cols[i] - 14, (s.vah - s.val + 1) * rh);
      // IB: vạch dọc bên trái
      if (s.ibHigh != null) { ctx.fillStyle = "#4ea1ff"; ctx.fillRect(x0 + 6, yOf(s.ibHigh + 1), 3, (s.ibHigh - s.ibLow + 1) * rh); }
      const maxV = Math.max(...s.vol.values());
      for (const k of s.keys) {
        const y = yOf(k + 1), yc = y + rh / 2; if (yc < top - rh || yc > bot + rh) continue;
        const ps = [...s.rows.get(k)].sort((a, b) => a - b), inVa = k >= s.val && k <= s.vah;
        // cột khối lượng mờ phía sau
        ctx.fillStyle = alpha(T.muted, 0.08); ctx.fillRect(lx, y + 1, (s.vol.get(k) / maxV) * (cols[i] - 30), rh - 1);
        if (k === s.poc) { ctx.fillStyle = alpha(T.accent, 0.28); ctx.fillRect(lx - 2, y, ps.length * cw + 4, rh); }
        if (s.singles.includes(k)) { ctx.fillStyle = "#d16bff"; ctx.fillRect(x0 + 10, y + 1, 2, rh - 2); }
        ps.forEach((p, j) => {
          const col = `hsl(${200 - p / 48 * 200},70%,${inVa ? 62 : 45}%)`;
          if (this.mode === "letters" && rh >= 8) { ctx.fillStyle = k === s.poc ? T.accent : col; ctx.textAlign = "left"; ctx.fillText(LETTERS[p], lx + j * cw, yc); }
          else { ctx.fillStyle = k === s.poc ? T.accent : col; ctx.fillRect(lx + j * cw, y + 1, cw - 1, Math.max(1, rh - 1)); }
        });
        this._hit.push({ x0: lx, x1: x0 + cols[i], y0: y, y1: y + rh, s, k, ps });
      }
      // giá mở / đóng phiên
      const ko = Math.floor(s.open / step + 1e-9), kc = Math.floor(s.close / step + 1e-9);
      ctx.fillStyle = T.text; ctx.textAlign = "right"; ctx.fillText("▸", x0 + 6, yOf(ko + 0.5)); ctx.fillText("◂", x0 + cols[i] - 2, yOf(kc + 0.5));
      // tiêu đề phiên
      const d = new Date(s.start);
      ctx.fillStyle = T.muted; ctx.textAlign = "left"; ctx.font = `10.5px ${MONO}`;
      ctx.fillText(`${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}${i === this.sessions.length - 1 ? " · đang chạy" : ""}`, x0 + 10, 10);
      ctx.font = `${Math.min(11, rh)}px ${MONO}`;
      ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(x0 + cols[i] - 0.5, top); ctx.lineTo(x0 + cols[i] - 0.5, bot); ctx.stroke();
    });
    // trục giá
    ctx.fillStyle = T.panel; ctx.fillRect(w - axisW, 0, axisW, h);
    ctx.fillStyle = T.muted; ctx.textAlign = "right"; ctx.font = `10px ${MONO}`;
    const every = Math.max(1, Math.ceil(14 / rh));
    const kTop = Math.ceil(midK + ((top + bot) / 2 - top) / rh), kBot = Math.floor(midK - (bot - (top + bot) / 2) / rh);
    for (let k = kBot; k <= kTop; k++) if (k % every === 0) ctx.fillText((k * step).toFixed(dec), w - 6, yOf(k) );
    const yl = yOf(last.close / step);
    ctx.fillStyle = T.accent; ctx.fillRect(w - axisW, yl - 8, axisW, 16); ctx.fillStyle = "#000"; ctx.fillText(last.close.toFixed(decimalsFor(this.tick)), w - 6, yl);
    ctx.fillStyle = T.muted; ctx.textAlign = "left";
    ctx.fillText(`Tầng giá ${step.toFixed(dec)} · phiên theo ngày UTC · mỗi chữ 30 phút`, 8, h - 8);
  }
  hitTest(x, y) {
    const hit = (this._hit || []).find(r => x >= r.x0 - 12 && x <= r.x1 && y >= r.y0 && y < r.y1);
    if (!hit) return null;
    const { s, k, ps } = hit, dec = decimalsFor(this.step), P = v => (v * this.step).toFixed(dec);
    const t = p => { const d = new Date(s.start + p * PERIOD); return `${LETTERS[p]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
    return `Mức ${P(k)} – ${P(k + 1)}: ${ps.length} chữ (${ps.map(t).join(", ")}). Khối lượng ${fmtVol(s.vol.get(k) || 0)}.` +
      ` Phiên này: POC ${P(s.poc)}, vùng giá trị ${P(s.val)} – ${P(s.vah + 1)}${s.ibHigh != null ? `, IB ${P(s.ibLow)} – ${P(s.ibHigh + 1)}` : ""}.` +
      (k === s.poc ? " Đây là POC: mức giá thị trường chấp nhận nhiều thời gian nhất." : s.singles.includes(k) ? " Chữ đơn lẻ: giá đi qua rất nhanh, thường để lại vùng mất cân bằng mà giá hay quay lại lấp." : "");
  }
  _bind() {
    const cv = this.cv;
    cv.addEventListener("wheel", e => {
      e.preventDefault();
      if (e.ctrlKey || e.shiftKey) { this.rowH = Math.max(3, Math.min(24, this.rowH * (e.deltaY > 0 ? 0.9 : 1.1))); }
      else { const ms = [0.25, 0.5, 1, 2, 4, 8], i = ms.indexOf(this.stepMult); this.stepMult = ms[Math.max(0, Math.min(ms.length - 1, i + (e.deltaY > 0 ? 1 : -1)))]; this.rebuild(); }
      this.dirty = true;
    }, { passive: false });
    cv.addEventListener("pointerdown", e => { this.drag = { x: e.clientX, y: e.clientY, xo: this.xOff, yo: this.yOff }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => { if (!this.drag) return; this.xOff = this.drag.xo + (e.clientX - this.drag.x); this.yOff = this.drag.yo + (e.clientY - this.drag.y) / this.rowH; this.dirty = true; });
    const up = () => { this.drag = null; };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("dblclick", () => { this.xOff = 0; this.yOff = 0; this.dirty = true; });
  }
}
