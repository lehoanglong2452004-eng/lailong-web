// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: tab Đa biểu đồ. Tối đa 6 biểu đồ nến, mỗi ô chọn mã và khung thời gian riêng.
//   Bố cục dùng chung lưới ghép với Terminal: kéo tiêu đề để đổi chỗ, kéo đường chia để đổi cỡ, nút — để thu nhỏ.
//   Nút 1 / 2 / 3 / 4 / 6 dựng lại lưới đều theo số ô. Mọi tuỳ chỉnh chỉ giữ trong lúc tab còn mở.
import { FlowChart } from "./flowchart.js?v=202611041854";
import { Layout } from "./layout.js?v=202611041854";
import { deltaOf, footprintStep } from "./market.js?v=202611041854";
import { INTERVALS, niceStep } from "./util.js?v=202611041854";
import { analyze } from "./radar.js?v=202611041854";
import { EXCHANGES, lastBarsFailover, candleCountdown } from "./exchanges.js?v=202611041854";
import { clockSkew } from "./health.js?v=202611041854";
import { approxFootprint, approxBar } from "./fphistory.js?v=202611041854";

const MAX = 6, KEY = "lailong.multi.v2", POLL = 3000;
const IDS = Array.from({ length: MAX }, (_, i) => "mc" + i);
// types: kiểu biểu đồ từng ô ("candle" nến, "fp" footprint ước tính từ nến nhỏ hơn)
// groups: nhóm liên kết từng ô ("A", "B" hoặc "" là đứng riêng); sync: trong một nhóm, đổi gì thì các ô cùng nhóm đổi theo
export const MC_DEFAULT = {
  n: 4,
  cells: [["BTCUSDT", "1m"], ["ETHUSDT", "1m"], ["BTCUSDT", "15m"], ["SOLUSDT", "5m"], ["BTCUSDT", "1h"], ["ETHUSDT", "4h"]],
  types: ["candle", "candle", "candle", "candle", "candle", "candle"],
  groups: ["A", "A", "B", "B", "A", "B"],
  sync: { sym: false, iv: false, cross: true },
};
// hai mẫu dựng sẵn: (a) nhiều mã cùng một khung, (c) một mã nhiều kiểu biểu đồ và khung
export const MC_PRESETS = {
  symbols: { n: 4, cells: [["BTCUSDT", "5m"], ["ETHUSDT", "5m"], ["SOLUSDT", "5m"], ["XRPUSDT", "5m"], ["BNBUSDT", "5m"], ["DOGEUSDT", "5m"]], types: Array(MAX).fill("candle"), groups: Array(MAX).fill("A"), sync: { sym: false, iv: true, cross: true } },
  mixed: { n: 4, cells: [["BTCUSDT", "1m"], ["BTCUSDT", "5m"], ["BTCUSDT", "15m"], ["BTCUSDT", "1h"], ["ETHUSDT", "5m"], ["ETHUSDT", "1h"]], types: ["fp", "candle", "fp", "candle", "fp", "candle"], groups: ["A", "A", "A", "A", "B", "B"], sync: { sym: true, iv: false, cross: true } },
};
// trạng thái lưu từ bản cũ thiếu trường mới thì lấy theo mặc định
export function fixState(st) {
  const d = JSON.parse(JSON.stringify(MC_DEFAULT));
  if (!st || !Array.isArray(st.cells) || st.cells.length !== MAX) return d;
  const ok = (a, f) => Array.isArray(a) && a.length === MAX && a.every(f);
  return {
    n: [1, 2, 3, 4, 6].includes(st.n) ? st.n : d.n, cells: st.cells,
    types: ok(st.types, t => t === "candle" || t === "fp") ? st.types : d.types,
    groups: ok(st.groups, g => g === "A" || g === "B" || g === "") ? st.groups : d.groups,
    sync: st.sync && typeof st.sync === "object" ? { ...d.sync, ...st.sync } : d.sync,
  };
}
// các ô cùng nhóm với ô i (không gồm i); ô đứng riêng thì không có
export function groupMates(groups, i) {
  const g = groups[i]; if (!g) return [];
  return groups.map((x, j) => (x === g && j !== i ? j : -1)).filter(j => j >= 0);
}
const ROWS = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 6: [3, 3] };

// lưới đều cho n ô đầu; các ô còn lại nằm cuối hàng cuối (đang thu nhỏ)
export function gridTree(n, W = 1200, H = 700) {
  const spec = ROWS[n] || ROWS[4], rows = [];
  let at = 0;
  for (const c of spec) { rows.push({ c, kids: IDS.slice(at, at + c) }); at += c; }
  rows[rows.length - 1].kids.push(...IDS.slice(at));
  const nodes = rows.map(r => ({ dir: "row", flex: 0, kids: r.kids, size: r.kids.map(() => Math.round(W / r.c)) }));
  return nodes.length === 1 ? nodes[0] : { dir: "col", flex: 0, kids: nodes, size: nodes.map(() => Math.round(H / nodes.length)) };
}

// gộp nến mới (cùng thời điểm thì thay, mới hơn thì nối thêm)
export function mergeBars(bars, fresh) {
  for (const b of fresh) {
    const x = { ...b, d: deltaOf(b) }, last = bars[bars.length - 1];
    if (!last || x.t > last.t) bars.push(x);
    else if (x.t === last.t) bars[bars.length - 1] = x;
    else { const i = bars.findIndex(y => y.t === x.t); if (i >= 0) bars[i] = x; }
  }
  return bars;
}

export class MultiChart {
  constructor(root, { ex }) {
    this.ex = ex; this.visible = false; this.timer = null; this.loaded = [];
    let st = null;
    try { st = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { /* bỏ qua */ }
    this.st = fixState(st);
    const ivs = Object.keys(INTERVALS);
    root.innerHTML = `<div class="mcbar">
        <span class="title">Đa biểu đồ</span>
        <span class="muted">Mẫu</span><div class="seg" id="mcPreset">
          <button data-preset="symbols" data-tip="4 mã khác nhau cùng khung 5 phút, cùng nhóm A, đổi khung một ô thì cả nhóm đổi theo">Nhiều mã cùng khung</button>
          <button data-preset="mixed" data-tip="BTC ở nhiều khung, trộn footprint và nến; đổi mã một ô thì cả nhóm đổi theo">Trộn kiểu biểu đồ</button>
        </div>
        <span class="muted">Số ô</span><div class="seg" id="mcCount">${Object.keys(ROWS).map(k => `<button data-n="${k}">${k}</button>`).join("")}</div>
        <span class="muted" data-tip="Các ô cùng màu nhóm (A cam, B xanh) đồng bộ với nhau. Bấm ô vuông màu ở đầu mỗi ô để đổi nhóm">Đồng bộ trong nhóm</span>
        <label class="field small"><input type="checkbox" id="mcSyncSym"> Mã</label>
        <label class="field small"><input type="checkbox" id="mcSyncIv"> Khung</label>
        <label class="field small"><input type="checkbox" id="mcSyncCross"> Con trỏ</label>
        <button id="mcSync" data-tip="Đổi mã của mọi ô thành mã của ô 1">Cùng mã ô 1</button>
        <button id="mcRadar" class="on" data-tip="Hiện sự kiện Radar trên mọi ô: khối lượng bất thường theo bối cảnh, mức giá và phản ứng (xanh: chính thức, đỏ: tạm thời, vàng: chưa rõ)">Radar</button>
        <button id="mcReset" data-tip="Về 4 ô mặc định: BTC 1m, ETH 1m, BTC 15m, SOL 5m">Về mặc định</button>
        <span class="hint">Kéo tiêu đề ô để đổi chỗ · kéo đường chia để đổi cỡ · lăn chuột: phóng to · kéo: di chuyển · bấm đúp: về hiện tại</span>
      </div>
      <div class="mcws" id="mcws">${IDS.map((id, i) => `<section class="panel mc-panel" id="${id}">
        <div class="panel-head"><button class="mcgrp" data-mcgrp="${i}" aria-label="Nhóm liên kết ô ${i + 1}"></button><b class="mcnum">${i + 1}</b>
          <input class="mcsym" list="symbolList" spellcheck="false" aria-label="Mã ô ${i + 1}">
          <select class="mciv" aria-label="Khung thời gian ô ${i + 1}">${ivs.map(v => `<option>${v}</option>`).join("")}</select>
          <select class="mctype" aria-label="Kiểu biểu đồ ô ${i + 1}" data-tip="Kiểu biểu đồ của ô này. Footprint ở đây là ước tính từ nến nhỏ hơn (viền nét đứt), footprint thật từng lệnh khớp có ở Terminal"><option value="candle">Nến</option><option value="fp">Footprint</option></select>
          <span class="mcpx"></span><span class="mccd" data-tip="Thời gian còn lại tới lúc đóng nến của ô này (giờ sàn)"></span><span class="hint"></span>
          <button class="icon max" data-mcmax="${id}" data-tip="Phóng to / thu lại ô này">⤢</button>
          <button class="icon" data-mcmin="${id}" data-tip="Thu nhỏ ô này xuống thanh dưới">—</button>
        </div>
        <div class="chart-wrap"><canvas id="${id}c"></canvas></div></section>`).join("")}</div>`;
    this.ws = root.querySelector("#mcws");
    this.charts = IDS.map(id => {
      const c = new FlowChart(document.getElementById(id + "c"), { emptyText: "Đang tải nến..." });
      c.pane = "delta";
      c.show.radar = true;
      for (const k of ["cvd", "oi", "liq", "liqMap", "absorb", "big", "cluster", "algo", "spoof", "score", "levels", "zones"]) c.show[k] = false;
      return c;
    });
    this.tips = Object.fromEntries(IDS.map((id, i) => [id + "c", this.charts[i]]));
    this.names = {};
    IDS.forEach((id, i) => {
      const p = document.getElementById(id), [sym, iv] = this.st.cells[i];
      p.querySelector(".mcsym").value = sym; p.querySelector(".mciv").value = iv;
      p.querySelector(".mcsym").addEventListener("change", e => this.setCell(i, e.target.value.trim().toUpperCase() || sym, null));
      p.querySelector(".mcsym").addEventListener("keydown", e => { if (e.key === "Enter") e.target.blur(); });
      p.querySelector(".mciv").onchange = e => this.setCell(i, null, e.target.value);
      p.querySelector(".mctype").onchange = e => this.setType(i, e.target.value);
      // con trỏ đồng bộ: rê chuột trên một ô thì các ô cùng nhóm hiện vạch dọc ở cùng thời điểm
      const cv = document.getElementById(id + "c");
      cv.addEventListener("mousemove", () => this.crossFrom(i));
      cv.addEventListener("mouseleave", () => this.crossFrom(i, true));
    });
    const sy = { mcSyncSym: "sym", mcSyncIv: "iv", mcSyncCross: "cross" };
    for (const [elId, k] of Object.entries(sy)) {
      const cb = root.querySelector("#" + elId); cb.checked = !!this.st.sync[k];
      cb.onchange = () => { this.st.sync[k] = cb.checked; this.save(); if (k === "cross" && !cb.checked) this.crossClear(); };
    }
    root.querySelector("#mcPreset").onclick = e => { const b = e.target.closest("[data-preset]"); if (b) this.applyPreset(b.dataset.preset); };
    this.charts.forEach((c, i) => c.setType(this.st.types[i] === "fp" ? "box" : "candle"));
    this.paintHeads();
    this.layout = new Layout(this.ws, IDS, {
      key: "lailong.multi.layout", presets: "lailong.multi.presets", names: this.names,
      tree: () => gridTree(this.st.n, this.ws.clientWidth || innerWidth, (this.ws.clientHeight || innerHeight - 120)),
      hiddenDefault: IDS.slice(this.st.n),
      onChange: () => this.changed(),
    });
    this.rename();
    root.querySelector("#mcCount").onclick = e => { const b = e.target.closest("[data-n]"); if (b) this.setCount(+b.dataset.n); };
    root.querySelector("#mcRadar").onclick = e => {
      const on = !e.currentTarget.classList.contains("on"); e.currentTarget.classList.toggle("on", on);
      this.charts.forEach((c, i) => { c.show.radar = on; if (on) this.radar(i); c.dirty = true; });
    };
    root.querySelector("#mcSync").onclick = () => { for (let i = 1; i < MAX; i++) this.setCell(i, this.st.cells[0][0], null); };
    root.querySelector("#mcReset").onclick = () => this.applyState(JSON.parse(JSON.stringify(MC_DEFAULT)));
    this.ws.addEventListener("click", e => {
      const gb = e.target.closest("[data-mcgrp]");
      if (gb) { e.stopPropagation(); const i = +gb.dataset.mcgrp, g = this.st.groups[i]; this.st.groups[i] = g === "A" ? "B" : g === "B" ? "" : "A"; this.save(); this.paintHeads(); return; }
      const mn = e.target.closest("[data-mcmin]"), mx = e.target.closest("[data-mcmax]");
      if (mn) { e.stopPropagation(); document.getElementById(mn.dataset.mcmin).classList.remove("maxed"); this.layout.minimize(mn.dataset.mcmin); }
      if (mx) { const p = document.getElementById(mx.dataset.mcmax), on = !p.classList.contains("maxed"); for (const x of this.ws.querySelectorAll(".maxed")) x.classList.remove("maxed"); p.classList.toggle("maxed", on); this.dirty(); }
    });
    this.markCount();
  }

  save() { try { sessionStorage.setItem(KEY, JSON.stringify(this.st)); } catch { /* bỏ qua */ } }
  dirty() { for (const c of this.charts) c.dirty = true; }
  rename() { IDS.forEach((id, i) => { this.names[id] = `${i + 1}: ${this.st.cells[i][0]} ${this.st.cells[i][1]}`; }); this.layout.apply(); }
  markCount() {
    for (const b of document.querySelectorAll("#mcCount [data-n]")) b.classList.toggle("on", +b.dataset.n === this.st.n);
    IDS.forEach((id, i) => document.getElementById(id).classList.toggle("mcoff", i >= this.st.n)); // màn hình nhỏ: chỉ hiện n ô đầu
  }
  shown(i) { return this.layout.on ? !this.layout.isMin(IDS[i]) : i < this.st.n; }

  setCount(n) {
    this.st.n = n; this.save(); this.markCount();
    this.layout.hiddenDefault = IDS.slice(n); this.layout.reset(); this.changed();
  }
  setCell(i, sym, iv, follow = false) {
    const c = this.st.cells[i];
    if ((!sym || sym === c[0]) && (!iv || iv === c[1]) && follow) return;
    if (sym) c[0] = sym;
    if (iv) c[1] = iv;
    const p = document.getElementById(IDS[i]); p.querySelector(".mcsym").value = c[0]; p.querySelector(".mciv").value = c[1];
    this.save(); this.loaded[i] = null; this.rename();
    if (this.visible && this.shown(i)) { this.load(i); this.stream(); }
    // ô cùng nhóm đổi theo (chỉ phần đang bật đồng bộ)
    if (!follow) for (const j of groupMates(this.st.groups, i)) {
      const s2 = this.st.sync.sym ? sym : null, i2 = this.st.sync.iv ? iv : null;
      if (s2 || i2) this.setCell(j, s2, i2, true);
    }
  }
  setType(i, t) {
    this.st.types[i] = t; this.save();
    const p = document.getElementById(IDS[i]); p.querySelector(".mctype").value = t;
    this.charts[i].setType(t === "fp" ? "box" : "candle");
    if (t === "fp" && this.charts[i].bars.length) this.footprint(i);
  }
  // footprint ước tính cho ô i: chia khối lượng mua/bán của các nến nhỏ hơn lên khoảng giá của chúng
  async footprint(i) {
    const c = this.charts[i], tag = this.loaded[i], [sym, iv] = this.st.cells[i];
    if (!tag || tag.err || !c.bars.length) return;
    const shim = { bars: c.bars, fpStep: c.step, intervalMs: INTERVALS[iv], interval: iv, emit: () => c.refresh() };
    try { await approxFootprint(this.ex(), sym, shim, () => this.loaded[i] === tag); } catch { /* giữ dạng nến */ }
  }
  applyPreset(name) { this.applyState(JSON.parse(JSON.stringify(MC_PRESETS[name]))); }
  applyState(st) {
    this.st = fixState(st);
    IDS.forEach((id, i) => {
      const p = document.getElementById(id); p.querySelector(".mcsym").value = this.st.cells[i][0]; p.querySelector(".mciv").value = this.st.cells[i][1];
      p.querySelector(".mctype").value = this.st.types[i]; this.charts[i].setType(this.st.types[i] === "fp" ? "box" : "candle"); this.loaded[i] = null;
    });
    for (const [elId, k] of [["mcSyncSym", "sym"], ["mcSyncIv", "iv"], ["mcSyncCross", "cross"]]) document.getElementById(elId).checked = !!this.st.sync[k];
    this.paintHeads(); this.rename(); this.setCount(this.st.n);
  }
  paintHeads() {
    IDS.forEach((id, i) => {
      const g = this.st.groups[i], b = document.getElementById(id).querySelector(".mcgrp");
      b.textContent = g || "·"; b.className = "mcgrp" + (g ? " g" + g : "");
      b.dataset.tip = g ? `Nhóm ${g}: ô cùng nhóm đồng bộ theo các ô Mã / Khung / Con trỏ trên thanh. Bấm để đổi nhóm` : "Ô đứng riêng, không đồng bộ. Bấm để đưa vào nhóm A";
      document.getElementById(id).querySelector(".mctype").value = this.st.types[i];
    });
  }
  // vạch dọc ở cùng thời điểm trên các ô cùng nhóm khi rê chuột trên ô i
  crossFrom(i, leave = false) {
    if (!this.st.sync.cross) return;
    const src = this.charts[i];
    let t = null;
    if (!leave && src.mouse && src._L && src.bars.length) { const k = Math.min(src.bars.length - 1, Math.max(0, src.iAt(src.mouse.x))); t = src.bars[k].t + INTERVALS[this.st.cells[i][1]] * (src.fAt(src.mouse.x) - k); }
    for (const j of groupMates(this.st.groups, i)) {
      const c = this.charts[j]; if (!c.bars.length || !c._L) continue;
      if (t == null) { c.mouse = null; c.dirty = true; continue; }
      const ms = INTERVALS[this.st.cells[j][1]], b0 = c.bars[0].t, f = (t - b0) / ms;
      if (f < 0 || f > c.bars.length + 5) { c.mouse = null; c.dirty = true; continue; }
      const x = c._L.pw - (c.bars.length - 1 - f + c.offset) * c.sp - c.sp / 2;
      c.mouse = { x, y: -1, synced: true }; c.dirty = true;
    }
  }
  crossClear() { for (const c of this.charts) if (c.mouse && c.mouse.synced) { c.mouse = null; c.dirty = true; } }
  changed() {
    this.dirty();
    if (this.visible) { for (let i = 0; i < MAX; i++) if (this.shown(i) && !this.fresh(i)) this.load(i); this.stream(); }
  }
  fresh(i) { const l = this.loaded[i]; return l && l.ex === this.ex().id && l.sym === this.st.cells[i][0] && l.iv === this.st.cells[i][1]; }

  async load(i) {
    const [sym, iv] = this.st.cells[i], exn = this.ex(), tag = { ex: exn.id, sym, iv }, chart = this.charts[i];
    this.loaded[i] = tag;
    const head = document.getElementById(IDS[i]).querySelector(".hint");
    chart.opts.emptyText = "Đang tải nến..."; chart.setData([], {}); head.textContent = "";
    try {
      const raw = await exn.klines(sym, iv, 400);
      if (this.loaded[i] !== tag) return;
      if (!raw.length) throw new Error("không có dữ liệu");
      const bars = mergeBars([], raw), last = bars[bars.length - 1].c;
      chart.setData(bars, { step: footprintStep(last, INTERVALS[iv], 0), tick: niceStep(last * 1e-5), intervalMs: INTERVALS[iv], symbol: sym, exchangeName: exn.name, interval: iv });
      chart.setType(this.st.types[i] === "fp" ? "box" : "candle");
      this.price(i); this.radar(i);
      if (this.st.types[i] === "fp") this.footprint(i);
    } catch (e) {
      if (this.loaded[i] !== tag) return;
      chart.opts.emptyText = `Không tải được ${sym} ${iv}: ${e.message}`; chart.dirty = true;
      head.textContent = "lỗi"; this.loaded[i] = { ...tag, err: true };
    }
  }
  // sự kiện Radar cho ô i (khung không có trong Radar như 1m thì tính theo tham số gần nhất)
  radar(i) {
    const c = this.charts[i]; if (!c.show.radar || c.bars.length < 120) { c.setOverlays({ radar: [] }); return; }
    const ms = INTERVALS[this.st.cells[i][1]];
    try { c.setOverlays({ radar: analyze(c.bars.map(b => ({ ...b, tb: b.bv ?? null })), ms).items }); } catch { c.setOverlays({ radar: [] }); }
  }
  price(i) {
    const b = this.charts[i].bars, el = document.getElementById(IDS[i]).querySelector(".mcpx");
    if (b.length < 2) { el.textContent = ""; return; }
    const ref = b[Math.max(0, b.length - 1 - Math.round(864e5 / INTERVALS[this.st.cells[i][1]]))] || b[0];
    const last = b[b.length - 1].c, ch = (last / ref.c - 1) * 100;
    el.innerHTML = `${+last.toPrecision(7)} <span class="${ch >= 0 ? "pos" : "neg"}">${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%</span>`;
    el.dataset.tip = "Giá cuối và thay đổi so với khoảng 24 giờ trước (theo nến đang xem)";
  }
  // ghi rõ trên ô khi giá đang lấy tạm từ sàn khác (sàn chính nghẽn); giá các sàn lệch nhau vài chục USD là bình thường
  source(i, exId) {
    const h = document.getElementById(IDS[i]).querySelector(".hint"), tag = this.loaded[i];
    if (!tag || exId === tag.ex) { if (h.dataset.alt) { h.textContent = ""; h.className = "hint"; delete h.dataset.alt; } return; }
    h.dataset.alt = exId; h.className = "hint warn";
    h.textContent = `giá tạm từ ${EXCHANGES[exId].name}`; h.dataset.tip = `${EXCHANGES[tag.ex].name} đang nghẽn, nên ô này lấy giá từ ${EXCHANGES[exId].name} mỗi 3 giây. Giá giữa các sàn có thể lệch nhẹ. Tự quay lại sàn chính khi sàn chính trả lời lại`;
  }
  countdown() {
    const now = Date.now() + clockSkew();
    for (let i = 0; i < MAX; i++) {
      if (!this.shown(i)) continue;
      const el = document.getElementById(IDS[i]).querySelector(".mccd"), cd = candleCountdown(INTERVALS[this.st.cells[i][1]], now);
      el.textContent = `⏱ ${cd.text}`; el.classList.toggle("warn", cd.soon);
    }
  }
  // nhận một nến mới hoặc nến đang chạy cho ô i
  push(i, fresh) {
    const c = this.charts[i], n0 = c.bars.length;
    mergeBars(c.bars, fresh);
    if (this.st.types[i] === "fp") for (let k = Math.max(0, c.bars.length - 2); k < c.bars.length; k++) if (!c.bars[k].fp) approxBar(c.bars[k], c.step);
    c.refresh(); this.price(i);
    if (c.bars.length !== n0) this.radar(i); // có nến mới đóng thì tính lại Radar
  }
  // sàn có WebSocket nến (Binance): mọi ô dùng chung một kết nối, cập nhật ngay từng lệnh khớp;
  // sàn khác: hỏi lại 2 nến cuối của mọi ô cùng lúc mỗi POLL ms
  stream() {
    const exn = this.ex(), pairs = [];
    for (let i = 0; i < MAX; i++) if (this.shown(i)) pairs.push(this.st.cells[i]);
    const key = exn.id + "|" + pairs.map(p => p.join(":")).sort().join(",");
    if (this.sock && this.sockKey === key) return;
    if (this.sock) { this.sock.close(); this.sock = null; }
    this.sockKey = key; this.sockOk = false;
    if (!exn.klineStream || !pairs.length) return;
    this.lastMsg = Date.now();
    this.sock = exn.klineStream(pairs, (sym, iv, bar) => {
      this.lastMsg = Date.now();
      for (let i = 0; i < MAX; i++) {
        const tag = this.loaded[i];
        if (tag && !tag.err && tag.sym === sym && tag.iv === iv && this.charts[i].bars.length) { this.push(i, [bar]); this.source(i, tag.ex); }
      }
    }, (_, ok) => { this.sockOk = ok; });
  }
  async poll() {
    // WebSocket đang chạy và có tin trong 10 giây qua; mất kết nối hoặc im lặng thì hỏi lại bằng REST
    if (this.sock && this.sockOk && Date.now() - this.lastMsg < 10e3) return;
    await Promise.all(Array.from({ length: MAX }, async (_, i) => {
      if (!this.visible || !this.shown(i)) return;
      const tag = this.loaded[i]; if (!tag || tag.err || !this.charts[i].bars.length) return;
      try {
        const r = await lastBarsFailover(tag.ex, tag.sym, tag.iv);
        if (this.loaded[i] !== tag) return;
        this.push(i, r.bars); this.source(i, r.ex);
      } catch { /* lần sau thử lại */ }
    }));
  }

  show() {
    this.visible = true; this.layout.apply(); this.changed(); // màn hình nhỏ: lưới ghép tắt nên tự gọi
    if (!this.timer) this.timer = setInterval(() => { this.stream(); this.poll(); }, POLL);
    if (!this.cdTimer) this.cdTimer = setInterval(() => this.countdown(), 1000);
    this.countdown();
    this.stream();
  }
  hide() { this.visible = false; clearInterval(this.timer); this.timer = null; clearInterval(this.cdTimer); this.cdTimer = null; if (this.sock) { this.sock.close(); this.sock = null; this.sockKey = null; } }
}
