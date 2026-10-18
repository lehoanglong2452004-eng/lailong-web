// Lai Long Web: bố cục Terminal tuỳ chỉnh kiểu lưới ghép (chỉ trên máy tính, màn hình rộng hơn 900px).
//   Bố cục là một cây: mỗi nút là một hàng ("row", xếp ngang) hoặc một cột ("col", xếp dọc) chứa các khung hoặc nút con.
//   size[i] là kích thước điểm ảnh của phần tử thứ i; phần tử "flex" nhận phần dư khi cửa sổ đổi kích thước.
//   Kéo tiêu đề khung thả lên khung khác: thả ở mép thì ghép bên cạnh, thả ở giữa thì đổi chỗ hai khung.
//   Thu nhỏ: khung nằm dưới thanh dưới cùng, bấm để mở lại đúng chỗ cũ. Mọi thứ lưu trên máy này.
const KEY = "lailong.layout.v2", PRESETS = "lailong.layout.presets";
const GAP = 5, MIN = 110;

export const NAMES = { mainPanel: "Biểu đồ", lmapPanel: "Thanh khoản", domPanel: "Sổ lệnh", tapePanel: "Smart Tape", wallPanel: "Nhật ký tường", orderPanel: "Lệnh giả lập" };

// bố cục mặc định giống bản cũ: biểu đồ co giãn, ba khung bên phải giữ độ rộng cố định
export function defaultTree(w = {}) {
  return { dir: "row", flex: 0, kids: ["mainPanel", "lmapPanel", "domPanel", "tapePanel"], size: [0, w.lmapW || 230, w.rightW || 430, w.tapeW || 340] };
}

const clone = x => JSON.parse(JSON.stringify(x));
const isNode = k => k && typeof k === "object";
export function panelsOf(n) { return n.kids.flatMap(k => isNode(k) ? panelsOf(k) : [k]); }

// bỏ một khung khỏi cây; nút chỉ còn một con thì gộp lên trên
export function removePanel(n, id) {
  const i = n.kids.indexOf(id);
  if (i >= 0) {
    n.kids.splice(i, 1); n.size.splice(i, 1);
    if (n.flex === i) n.flex = 0; else if (n.flex > i) n.flex--;
    return true;
  }
  for (let j = 0; j < n.kids.length; j++) {
    const k = n.kids[j];
    if (!isNode(k) || !removePanel(k, id)) continue;
    if (k.kids.length === 1) n.kids[j] = k.kids[0];
    else if (!k.kids.length) { n.kids.splice(j, 1); n.size.splice(j, 1); if (n.flex >= n.kids.length) n.flex = 0; }
    return true;
  }
  return false;
}

// đặt khung id cạnh khung target; side: left, right, top, bottom
export function insertPanel(n, target, id, side) {
  const i = n.kids.indexOf(target);
  if (i < 0) return n.kids.some(k => isNode(k) && insertPanel(k, target, id, side));
  const dir = side === "left" || side === "right" ? "row" : "col";
  const before = side === "left" || side === "top";
  // ghép cạnh nhau cùng chiều: chia đôi ô cũ; ghép trên / dưới trong một hàng: khung mới cao khoảng 320 điểm ảnh
  const half = n.dir === dir ? Math.max(MIN, Math.round((n.size[i] || 400) / 2)) : dir === "col" ? 320 : Math.max(MIN, Math.round((n.size[i] || 400) / 2));
  if (n.dir === dir) {
    const at = before ? i : i + 1;
    if (n.flex !== i) n.size[i] = half;
    n.kids.splice(at, 0, id); n.size.splice(at, 0, half);
    if (n.flex >= at) n.flex++;
  } else {
    n.kids[i] = { dir, flex: before ? 1 : 0, kids: before ? [id, target] : [target, id], size: [half, half] };
  }
  return true;
}

export function swapPanels(n, a, b) {
  const walk = x => { x.kids = x.kids.map(k => isNode(k) ? (walk(k), k) : k === a ? b : k === b ? a : k); };
  walk(n);
}

// tính vị trí từng khung; hidden là các khung đang thu nhỏ (phần chỗ của chúng chia cho phần tử flex)
export function computeRects(n, box, hidden = new Set(), out = { panels: {}, splits: [] }) {
  const vis = n.kids.map((k, i) => ({ k, i })).filter(({ k }) => isNode(k) ? panelsOf(k).some(p => !hidden.has(p)) : !hidden.has(k));
  if (!vis.length) return out;
  const horiz = n.dir === "row", total = (horiz ? box.w : box.h) - GAP * (vis.length - 1);
  let flex = vis.find(v => v.i === n.flex) || vis[0];
  const want = vis.map(v => v === flex ? 0 : Math.max(MIN, n.size[v.i] || MIN));
  let fixed = want.reduce((a, b) => a + b, 0);
  // chỗ không đủ: co đều các khung cố định, chừa ít nhất MIN cho khung co giãn
  const room = total - MIN;
  const k = fixed > room && fixed > 0 ? Math.max(0, room) / fixed : 1;
  const sizes = want.map((s, j) => vis[j] === flex ? 0 : Math.floor(s * k));
  fixed = sizes.reduce((a, b) => a + b, 0);
  sizes[vis.indexOf(flex)] = Math.max(0, total - fixed);
  let pos = horiz ? box.x : box.y;
  vis.forEach((v, j) => {
    const r = horiz ? { x: pos, y: box.y, w: sizes[j], h: box.h } : { x: box.x, y: pos, w: box.w, h: sizes[j] };
    if (isNode(v.k)) computeRects(v.k, r, hidden, out); else out.panels[v.k] = r;
    pos += sizes[j];
    if (j < vis.length - 1) {
      out.splits.push({ node: n, a: v.i, b: vis[j + 1].i, dir: n.dir, sizeA: sizes[j], sizeB: sizes[j + 1],
        r: horiz ? { x: pos, y: box.y, w: GAP, h: box.h } : { x: box.x, y: pos, w: box.w, h: GAP } });
      pos += GAP;
    }
  });
  return out;
}

export class Layout {
  // key: chỗ lưu trong phiên; tree: hàm dựng bố cục mặc định; hiddenDefault: các khung thu nhỏ sẵn khi mở
  constructor(ws, ids, { legacy = {}, onChange = () => {}, key = KEY, tree = defaultTree, hiddenDefault = [], names = NAMES, presets = PRESETS } = {}) {
    this.ws = ws; this.ids = ids; this.onChange = onChange; this.legacy = legacy;
    this.key = key; this.makeTree = () => tree(legacy); this.hiddenDefault = hiddenDefault; this.names = names; this.presetsKey = presets;
    this.mq = matchMedia("(min-width: 901px)");
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(key) || "null"); } catch { /* bỏ qua */ }
    if (saved) saved = this.repair(saved);
    const ok = saved && this.valid(saved.tree);
    this.tree = ok ? saved.tree : this.makeTree();
    this.hidden = new Set(ok && Array.isArray(saved.hidden) ? saved.hidden.filter(id => ids.includes(id)) : hiddenDefault);
    this.splitEls = [];
    this.dock = document.createElement("div"); this.dock.className = "dock"; this.dock.hidden = true;
    ws.appendChild(this.dock);
    this.dock.onclick = e => { const b = e.target.closest("[data-restore]"); if (b) this.restore(b.dataset.restore); };
    new ResizeObserver(() => this.apply()).observe(ws);
    this.mq.addEventListener("change", () => this.apply());
    this.bindDrag();
    this.apply();
  }
  // bố cục lưu từ bản cũ thiếu khung mới: thêm khung đó vào cuối, thu nhỏ sẵn
  repair(x) {
    try {
      const have = panelsOf(x.tree), miss = this.ids.filter(id => !have.includes(id));
      if (!miss.length || have.some(id => !this.ids.includes(id))) return x;
      const t = clone(x.tree); for (const id of miss) { t.kids.push(id); t.size.push(300); }
      return { tree: t, hidden: [...(x.hidden || []), ...miss] };
    } catch { return x; }
  }
  valid(t) { try { const p = panelsOf(t); return p.length === this.ids.length && this.ids.every(id => p.includes(id)); } catch { return false; } }
  save() { try { sessionStorage.setItem(this.key, JSON.stringify({ tree: this.tree, hidden: [...this.hidden] })); } catch { /* bỏ qua */ } }
  get on() { return this.mq.matches; }

  apply() {
    const ws = this.ws;
    for (const el of this.splitEls) el.remove();
    this.splitEls = [];
    ws.classList.toggle("tiled", this.on);
    if (!this.on) {
      for (const id of this.ids) { const p = document.getElementById(id); p.style.cssText = ""; p.classList.remove("minimized"); }
      this.dock.hidden = true; return;
    }
    const pad = 4, dockH = this.hidden.size ? 30 : 0;
    const box = { x: pad, y: pad, w: ws.clientWidth - pad * 2, h: ws.clientHeight - pad * 2 - dockH };
    const { panels, splits } = computeRects(this.tree, box, this.hidden);
    for (const id of this.ids) {
      const p = document.getElementById(id), r = panels[id];
      p.classList.toggle("minimized", !r);
      if (r) Object.assign(p.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
    }
    for (const s of splits) {
      const el = document.createElement("div");
      el.className = "tsplit " + (s.dir === "row" ? "v" : "h");
      Object.assign(el.style, { left: s.r.x + "px", top: s.r.y + "px", width: s.r.w + "px", height: s.r.h + "px" });
      el.dataset.tip = "Kéo để đổi kích thước. Bấm đúp để chia đều hai khung";
      this.bindSplit(el, s);
      ws.appendChild(el); this.splitEls.push(el);
    }
    this.dock.hidden = !this.hidden.size;
    this.dock.innerHTML = `<span class="dock-l">Đã thu nhỏ:</span>` + [...this.hidden].map(id => `<button data-restore="${id}" data-tip="Mở lại khung này">▣ ${this.names[id] || id}</button>`).join("");
    this.onChange();
  }

  bindSplit(el, s) {
    const n = s.node, horiz = s.dir === "row";
    el.addEventListener("pointerdown", e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      document.body.classList.add("resizing"); el.classList.add("drag");
      const start = horiz ? e.clientX : e.clientY, a0 = s.sizeA, b0 = s.sizeB;
      const move = ev => {
        const d = Math.max(MIN - a0, Math.min(b0 - MIN, (horiz ? ev.clientX : ev.clientY) - start));
        if (n.flex !== s.a) n.size[s.a] = a0 + d;
        if (n.flex !== s.b) n.size[s.b] = b0 - d;
        this.apply();
      };
      const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); document.body.classList.remove("resizing"); this.save(); };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
    });
    el.addEventListener("dblclick", () => {
      const avg = Math.round((s.sizeA + s.sizeB) / 2);
      if (n.flex !== s.a) n.size[s.a] = avg;
      if (n.flex !== s.b) n.size[s.b] = avg;
      this.apply(); this.save();
    });
  }

  minimize(id) { if (this.hidden.size >= this.ids.length - 1) return; this.hidden.add(id); this.apply(); this.save(); }
  restore(id) { this.hidden.delete(id); this.apply(); this.save(); }
  isMin(id) { return this.hidden.has(id); }
  reset() { this.tree = this.makeTree(); this.hidden = new Set(this.hiddenDefault); this.apply(); this.save(); }
  move(id, target, side) {
    if (id === target) return;
    if (side === "center") swapPanels(this.tree, id, target);
    else { removePanel(this.tree, id); insertPanel(this.tree, target, id, side); }
    if (!this.valid(this.tree)) this.tree = this.makeTree();
    this.apply(); this.save();
  }

  presets() { try { return JSON.parse(localStorage.getItem(this.presetsKey) || "{}"); } catch { return {}; } }
  savePreset(name) { const p = this.presets(); p[name] = { tree: clone(this.tree), hidden: [...this.hidden] }; try { localStorage.setItem(this.presetsKey, JSON.stringify(p)); } catch { /* bỏ qua */ } }
  loadPreset(name) { const x = this.repair(this.presets()[name] || {}); if (!x || !this.valid(x.tree)) return; this.tree = clone(x.tree); this.hidden = new Set(x.hidden || []); this.apply(); this.save(); }
  deletePreset(name) { const p = this.presets(); delete p[name]; try { localStorage.setItem(this.presetsKey, JSON.stringify(p)); } catch { /* bỏ qua */ } }

  // kéo tiêu đề khung: hiện vùng thả trên khung đang rê tới
  bindDrag() {
    const ov = document.createElement("div"); ov.className = "dropzone"; ov.hidden = true; this.ws.appendChild(ov);
    let drag = null;
    const sideOf = (r, x, y) => {
      const fx = (x - r.left) / r.width, fy = (y - r.top) / r.height;
      if (fx > 0.3 && fx < 0.7 && fy > 0.3 && fy < 0.7) return "center";
      const d = { left: fx, right: 1 - fx, top: fy, bottom: 1 - fy };
      return Object.keys(d).reduce((a, b) => d[a] <= d[b] ? a : b);
    };
    this.ws.addEventListener("pointerdown", e => {
      if (!this.on || e.button !== 0) return;
      const head = e.target.closest(".panel-head");
      if (!head || e.target.closest("button, select, input, label, a, .dropdown, .menu")) return;
      const p = head.closest(".panel");
      if (!p || !this.ids.includes(p.id) || p.classList.contains("maxed")) return;
      drag = { id: p.id, x: e.clientX, y: e.clientY, on: false };
    });
    window.addEventListener("pointermove", e => {
      if (!drag) return;
      if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      if (!drag.on) { drag.on = true; document.body.classList.add("resizing", "dragging-panel"); document.getElementById(drag.id).classList.add("dragsrc"); }
      const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest(".panel");
      drag.target = drag.side = null; ov.hidden = true;
      if (!t || t.id === drag.id || !this.ids.includes(t.id)) return;
      const r = t.getBoundingClientRect(), w = this.ws.getBoundingClientRect(), side = sideOf(r, e.clientX, e.clientY);
      drag.target = t.id; drag.side = side;
      const z = { left: [0, 0, .5, 1], right: [.5, 0, .5, 1], top: [0, 0, 1, .5], bottom: [0, .5, 1, .5], center: [.2, .2, .6, .6] }[side];
      Object.assign(ov.style, { left: r.left - w.left + r.width * z[0] + "px", top: r.top - w.top + r.height * z[1] + "px", width: r.width * z[2] + "px", height: r.height * z[3] + "px" });
      ov.textContent = side === "center" ? "Đổi chỗ" : "Đặt ở đây";
      ov.hidden = false;
    });
    window.addEventListener("pointerup", () => {
      if (!drag) return;
      const d = drag; drag = null; ov.hidden = true;
      document.body.classList.remove("resizing", "dragging-panel");
      document.getElementById(d.id).classList.remove("dragsrc");
      if (d.on && d.target) this.move(d.id, d.target, d.side);
    });
  }
}
