// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: tab Đa biểu đồ. Tối đa 6 biểu đồ nến, mỗi ô chọn mã và khung thời gian riêng.
//   Bố cục dùng chung lưới ghép với Terminal: kéo tiêu đề để đổi chỗ, kéo đường chia để đổi cỡ, nút — để thu nhỏ.
//   Nút 1 / 2 / 3 / 4 / 6 dựng lại lưới đều theo số ô. Mọi tuỳ chỉnh chỉ giữ trong lúc tab còn mở.
//   Nút Cung / cầu: vùng Supply/Demand và FVG đa khung (supdem.js) trên mọi ô, ⚙ để chỉnh như bản Pine.
import { FlowChart } from "./flowchart.js?v=202610300405";
import { Layout } from "./layout.js?v=202610300405";
import { deltaOf, footprintStep } from "./market.js?v=202610300405";
import { INTERVALS, niceStep } from "./util.js?v=202610300405";
import { analyze } from "./radar.js?v=202610300405";
import { EXCHANGES, lastBarsFailover, candleCountdown } from "./exchanges.js?v=202610300405";
import { clockSkew } from "./health.js?v=202610300405";
import { SD_TFS, SD_DEFAULT, SD_H1M15, supplyDemand, autoPip, weekly } from "./supdem.js?v=202610300405";

const MAX = 6, KEY = "lailong.multi.v1", POLL = 3000;
const IDS = Array.from({ length: MAX }, (_, i) => "mc" + i);
export const MC_DEFAULT = {
  n: 4,
  cells: [["BTCUSDT", "1m"], ["ETHUSDT", "1m"], ["BTCUSDT", "15m"], ["SOLUSDT", "5m"], ["BTCUSDT", "1h"], ["ETHUSDT", "4h"]],
};
const ROWS = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 6: [3, 3] };
const SD_KEY = "lailong.multi.sd", SD_N = 500;
// ô số trong bảng cài đặt Cung / cầu: [khoá, nhãn, nhỏ nhất, lớn nhất, bước]
const SD_NUM = {
  tf: [["piv", "Đỉnh/đáy = cao/thấp nhất trong X nến mỗi bên", 1, 20, 1], ["merge", "Gộp đỉnh/đáy cách vùng ≤ (pip)", 0, 1000, 1],
    ["minThk", "Độ dày vùng tối thiểu (pip)", 0, 1000, 1], ["pip", "1 pip = (0 = tự động; vàng 0,1)", 0, 1e6, "any"]],
  zone: [["maxBig", "Số vùng tối đa: Tuần / Ngày / H4", 1, 20, 1], ["maxSmall", "Số vùng tối đa: H1 / M15 / M5", 1, 20, 1],
    ["strongN", "Vùng mạnh khi bị test ≥ (lần)", 1, 50, 1]],
  fvg: [["minFvg", "Khoảng trống tối thiểu (pip)", 0, 1000, 1], ["maxF", "Số FVG tối đa mỗi khung", 1, 20, 1]],
};
export function sdMenu() {
  const num = ([k, t, mn, mx, st]) => `<label class="row">${t} <input type="number" data-sd="${k}" min="${mn}" max="${mx}" step="${st}"></label>`;
  const tfs = attr => `<div class="sdtf">${SD_TFS.map(x => `<label><input type="checkbox" data-${attr}="${x.name}"> ${x.vn}</label>`).join("")}</div>`;
  const col = (k, t) => `<label><input type="color" data-sd="${k}"> ${t}</label>`;
  return `<p class="note">Price Action + Supply&amp;Demand, chỉ dùng giá. Mỗi ô chỉ vẽ các khung ≥ khung của ô đó. Nhấp đúp vào ô số để về mặc định.</p>
    <h4>Khung &amp; đỉnh/đáy</h4>${tfs("sdtf")}${SD_NUM.tf.map(num).join("")}
    <h4>Vùng Supply / Demand</h4>${SD_NUM.zone.map(num).join("")}
    <h4>FVG</h4><label><input type="checkbox" data-sd="fvg"> Hiện FVG</label>${tfs("sdfvg")}${SD_NUM.fvg.map(num).join("")}
    <label data-tip="Tắt: giá phải lấp hết khoảng trống. FVG đã lấp sẽ bị xoá"><input type="checkbox" data-sd="half"> Tính đã lấp khi chạm 50%</label>
    <h4>Màu</h4><div class="sdtf">${col("cSup", "Supply")}${col("cDem", "Demand")}${col("cFvg", "FVG")}</div>
    <div class="sdbtns"><button data-sdpreset="h1m15" data-tip="Như bản Pine H1-M15: chỉ vùng và FVG của H1 và M15">Chỉ H1 + M15</button><button data-sdpreset="reset">Về mặc định</button></div>`;
}
// cài đặt đã lưu -> cài đặt dùng được (khoá lạ hoặc sai kiểu thì bỏ, thiếu thì lấy mặc định)
export function sdLoadOpts(saved) {
  const o = JSON.parse(JSON.stringify({ on: true, ...SD_DEFAULT }));
  if (!saved || typeof saved !== "object") return o;
  for (const [k, v] of Object.entries(saved)) {
    if (k === "tf" || k === "fvgTf") { for (const x of SD_TFS) if (typeof v?.[x.name] === "boolean") o[k][x.name] = v[x.name]; }
    else if (k in o && typeof v === typeof o[k]) o[k] = v;
  }
  return o;
}

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
    this.htf = new Map(); this.infos = new Map();
    let sd = null; try { sd = JSON.parse(sessionStorage.getItem(SD_KEY) || "null"); } catch { /* bỏ qua */ }
    this.sdo = sdLoadOpts(sd);
    let st = null;
    try { st = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { /* bỏ qua */ }
    this.st = st && Array.isArray(st.cells) && st.cells.length === MAX ? st : JSON.parse(JSON.stringify(MC_DEFAULT));
    const ivs = Object.keys(INTERVALS);
    root.innerHTML = `<div class="mcbar">
        <span class="title">Đa biểu đồ</span>
        <span class="muted">Số ô</span><div class="seg" id="mcCount">${Object.keys(ROWS).map(k => `<button data-n="${k}">${k}</button>`).join("")}</div>
        <button id="mcSync" data-tip="Đổi mã của mọi ô thành mã của ô 1">Cùng mã ô 1</button>
        <button id="mcRadar" class="on" data-tip="Hiện sự kiện Radar trên mọi ô: khối lượng bất thường theo bối cảnh, mức giá và phản ứng (xanh: chính thức, đỏ: tạm thời, vàng: chưa rõ)">Radar</button>
        <button id="mcSD" class="${this.sdo.on ? "on" : ""}" data-g="supply-demand" data-tip="Price Action + Supply&amp;Demand đa khung trên mọi ô: vùng cung (đỏ) từ râu trên tới đỉnh thân của đỉnh, vùng cầu (xanh) từ râu dưới tới đáy thân của đáy, FVG (xanh dương). Khung càng lớn viền càng đậm. Rê chuột vào vùng để xem số lần test">Cung / cầu</button>
        <div class="dropdown"><button id="mcSDCfg" data-tip="Cài đặt Cung / cầu: khung, đỉnh/đáy, số vùng, FVG, màu">⚙ ▾</button><div class="menu hmcfg" id="mcSDMenu">${sdMenu()}</div></div>
        <button id="mcReset" data-tip="Về 4 ô mặc định: BTC 1m, ETH 1m, BTC 15m, SOL 5m">Về mặc định</button>
        <span class="hint">Kéo tiêu đề ô để đổi chỗ · kéo đường chia để đổi cỡ · lăn chuột: phóng to · kéo: di chuyển · bấm đúp: về hiện tại</span>
      </div>
      <div class="mcws" id="mcws">${IDS.map((id, i) => `<section class="panel mc-panel" id="${id}">
        <div class="panel-head"><b class="mcnum">${i + 1}</b>
          <input class="mcsym" list="symbolList" spellcheck="false" aria-label="Mã ô ${i + 1}">
          <select class="mciv" aria-label="Khung thời gian ô ${i + 1}">${ivs.map(v => `<option>${v}</option>`).join("")}</select>
          <span class="mcpx"></span><span class="mccd" data-tip="Thời gian còn lại tới lúc đóng nến của ô này (giờ sàn)"></span><span class="hint"></span>
          <button class="icon max" data-mcmax="${id}" data-tip="Phóng to / thu lại ô này">⤢</button>
          <button class="icon" data-mcmin="${id}" data-tip="Thu nhỏ ô này xuống thanh dưới">—</button>
        </div>
        <div class="chart-wrap"><canvas id="${id}c"></canvas></div></section>`).join("")}</div>`;
    this.ws = root.querySelector("#mcws");
    this.charts = IDS.map(id => {
      const c = new FlowChart(document.getElementById(id + "c"), { emptyText: "Đang tải nến..." });
      c.pane = "delta";
      c.show.radar = true; c.show.sd = this.sdo.on;
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
    });
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
    root.querySelector("#mcSD").onclick = e => {
      this.sdo.on = !this.sdo.on; e.currentTarget.classList.toggle("on", this.sdo.on); this.sdSave();
      this.charts.forEach((c, i) => { c.show.sd = this.sdo.on; if (this.sdo.on) this.sdCalc(i); c.dirty = true; });
    };
    root.querySelector("#mcSDCfg").onclick = e => { e.stopPropagation(); e.currentTarget.parentElement.classList.toggle("open"); };
    this.sdBind(root.querySelector("#mcSDMenu"));
    root.querySelector("#mcSync").onclick = () => { for (let i = 1; i < MAX; i++) this.setCell(i, this.st.cells[0][0], null); };
    root.querySelector("#mcReset").onclick = () => {
      this.st = JSON.parse(JSON.stringify(MC_DEFAULT));
      IDS.forEach((id, i) => { const p = document.getElementById(id); p.querySelector(".mcsym").value = this.st.cells[i][0]; p.querySelector(".mciv").value = this.st.cells[i][1]; this.loaded[i] = null; });
      this.setCount(this.st.n);
    };
    this.ws.addEventListener("click", e => {
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
  setCell(i, sym, iv) {
    const c = this.st.cells[i];
    if (sym) c[0] = sym;
    if (iv) c[1] = iv;
    const p = document.getElementById(IDS[i]); p.querySelector(".mcsym").value = c[0]; p.querySelector(".mciv").value = c[1];
    this.save(); this.loaded[i] = null; this.rename();
    if (this.visible && this.shown(i)) { this.load(i); this.stream(); }
  }
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
      this.price(i); this.radar(i); this.sdCalc(i);
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
  // bảng cài đặt Cung / cầu: điền giá trị, đổi là tính lại mọi ô
  sdBind(m) {
    const fill = () => {
      for (const el of m.querySelectorAll("[data-sd]")) { const v = this.sdo[el.dataset.sd]; if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); }
      for (const el of m.querySelectorAll("[data-sdtf]")) el.checked = !!this.sdo.tf[el.dataset.sdtf];
      for (const el of m.querySelectorAll("[data-sdfvg]")) el.checked = !!this.sdo.fvgTf[el.dataset.sdfvg];
    };
    const apply = () => { this.sdSave(); fill(); this.sdAll(); };
    m.addEventListener("change", e => {
      const el = e.target, k = el.dataset.sd;
      if (el.dataset.sdtf) this.sdo.tf[el.dataset.sdtf] = el.checked;
      else if (el.dataset.sdfvg) this.sdo.fvgTf[el.dataset.sdfvg] = el.checked;
      else if (el.type === "checkbox") this.sdo[k] = el.checked;
      else if (el.type === "number") {
        let v = +el.value; if (!isFinite(v) || el.value === "") v = SD_DEFAULT[k];
        this.sdo[k] = Math.min(+el.max, Math.max(+el.min, v));
      } else if (k) this.sdo[k] = el.value;
      apply();
    });
    m.addEventListener("dblclick", e => { const el = e.target.closest("input[type=number][data-sd]"); if (el) { this.sdo[el.dataset.sd] = SD_DEFAULT[el.dataset.sd]; apply(); } });
    m.addEventListener("click", e => {
      const b = e.target.closest("[data-sdpreset]"); if (!b) return;
      if (b.dataset.sdpreset === "h1m15") { this.sdo.tf = { ...SD_H1M15.tf }; this.sdo.fvgTf = { ...SD_H1M15.fvgTf }; }
      else this.sdo = { ...sdLoadOpts(null), on: this.sdo.on };
      apply();
    });
    fill();
  }
  sdSave() { try { sessionStorage.setItem(SD_KEY, JSON.stringify(this.sdo)); } catch { /* bỏ qua */ } }
  sdAll() { for (let i = 0; i < MAX; i++) if (this.shown(i)) this.sdCalc(i); }
  // nến khung lớn của (sàn, mã, khung): giữ lại tới khi khung đó có nến mới đóng
  htfBars(exn, sym, iv) {
    const k = `${exn.id}|${sym}|${iv}`, ms = INTERVALS[iv], now = Date.now() + clockSkew(), e = this.htf.get(k);
    if (e && Math.floor(e.at / ms) === Math.floor(now / ms)) return e.p;
    const p = exn.klines(sym, iv, SD_N).catch(err => { this.htf.delete(k); throw err; });
    this.htf.set(k, { at: now, p }); return p;
  }
  symInfo(exn, sym) {
    const k = exn.id + "|" + sym;
    if (!this.infos.has(k)) this.infos.set(k, exn.info(sym).catch(() => ({ tick: 0 })));
    return this.infos.get(k);
  }
  // vùng Supply/Demand và FVG cho ô i: tải nến các khung ≥ khung ô đang bật (Tuần gộp từ nến ngày)
  async sdCalc(i) {
    const c = this.charts[i], tag = this.loaded[i];
    if (!c.show.sd || !tag || tag.err || !c.bars.length) { c.setOverlays({ sd: null }); return; }
    const [sym, iv] = this.st.cells[i], ms = INTERVALS[iv], exn = this.ex(), o = this.sdo;
    const need = SD_TFS.filter(x => x.ms >= ms && (o.tf[x.name] || (o.fvg && o.fvgTf[x.name])));
    const srcs = [...new Set(need.map(x => x.src))].filter(s => s !== iv);
    try {
      const [got, info] = await Promise.all([Promise.all(srcs.map(s => this.htfBars(exn, sym, s))), this.symInfo(exn, sym)]);
      if (this.loaded[i] !== tag) return;
      const by = { [iv]: c.bars }, tf = {};
      srcs.forEach((s, k) => { by[s] = got[k]; });
      for (const x of need) tf[x.name] = x.name === "W" ? weekly(by["1d"]) : by[x.src];
      const pip = o.pip > 0 ? o.pip : autoPip(sym, info.tick, c.bars[c.bars.length - 1].c);
      c.setOverlays({ sd: supplyDemand({ chart: c.bars, chartMs: ms, tf, now: Date.now() + clockSkew() }, o, pip) });
    } catch { if (this.loaded[i] === tag) c.setOverlays({ sd: null }); }
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
    mergeBars(c.bars, fresh); c.refresh(); this.price(i);
    if (c.bars.length !== n0) { this.radar(i); this.sdCalc(i); } // có nến mới đóng thì tính lại Radar và vùng cung cầu
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
