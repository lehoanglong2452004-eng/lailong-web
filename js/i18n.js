// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Dịch giao diện sang tiếng Anh khi bấm EN (nút ở góc trên bên phải).
//
// Chế độ VI: không làm gì, không tải gì thêm. Chế độ EN: tải bảng dịch (i18n-en.js, sinh bởi tools/i18n_build.py)
// một lần, rồi:
//   - dịch chữ trong trang và các chú thích (data-tip, title, placeholder, aria-label), kể cả phần trang vẽ thêm
//     sau này (theo dõi bằng MutationObserver);
//   - dịch chữ vẽ lên biểu đồ canvas (fillText / strokeText / measureText).
// Chuỗi không có chữ cái (giá, khối lượng, giờ) bỏ qua ngay; câu đã dịch được nhớ lại nên không dịch lại.
// Bấm VI thì trả lại đúng chữ gốc.

import { getLang } from "./lang.js?v=202611141528";

let S = null, PATS = null, BY = null, on = false, mo = null, patched = false;
const CACHE = new Map(), CACHE_MAX = 30000;
const LETTER = /[A-Za-zÀ-ỹĐđ]/, VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const VIG = new RegExp(VI.source, "gi");
const ATTRS = ["data-tip", "title", "placeholder", "aria-label"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);
// nội dung do người dùng hoặc nguồn ngoài viết (tin, bài mạng xã hội đã theo ngôn ngữ riêng): không dịch
const SKIP_SEL = "[data-noi18n]";

const norm = s => s.replace(/\s+/g, " ").trim();
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// nạp bảng dịch: { s: {câu: bản dịch}, p: [[mẫu có {0}.., bản dịch]] }
export function setDict(d) {
  S = new Map(Object.entries(d.s || {})); PATS = []; BY = new Map(); CACHE.clear();
  for (let [vi, en] of d.p || []) {
    const pre = vi.match(/^[^\p{L}{]+/u); // ", cấu trúc {0}" → "cấu trúc {0}" để khớp cả khi đứng riêng
    if (pre && en.startsWith(pre[0])) { vi = vi.slice(pre[0].length); en = en.slice(pre[0].length); }
    const parts = vi.split(/\{(\d)\}/), order = [];
    let re = "^";
    for (let i = 0; i < parts.length; i++) { if (i % 2) { re += "(.*?)"; order.push(+parts[i]); } else re += escRe(parts[i]); }
    const lead = parts[0].length >= 2 ? parts[0].slice(0, 2) : "";
    const item = { re: new RegExp(re + "$", "s"), order, en, n: vi.length };
    if (!BY.has(lead)) BY.set(lead, []);
    BY.get(lead).push(item);
  }
  for (const list of BY.values()) list.sort((a, b) => b.n - a.n); // mẫu dài (cụ thể hơn) thử trước
}

function viaPattern(k, depth) {
  for (const list of [BY.get(k.slice(0, 2)), BY.get("")]) {
    if (!list) continue;
    for (const it of list) {
      const m = it.re.exec(k); if (!m) continue;
      const vals = []; it.order.forEach((idx, j) => { vals[idx] = m[j + 1]; });
      return it.en.replace(/\{(\d)\}/g, (_, i) => { const v = vals[+i] == null ? "" : vals[+i]; return depth < 3 ? tr(v, depth + 1) : v; });
    }
  }
  return null;
}

const viCount = s => (s.match(VIG) || []).length;
// câu ghép từ nhiều mảnh (vd "Khung ngắn (5m, 15m): tăng nhẹ", "▣ Thanh khoản"): dịch từng mảnh giữa các dấu câu
const CUT = /(^[^\p{L}]+|\s*[·|;()]\s*|\s*:(?:\s+|$)|,\s+|\s+\/\s+)/u; // "2,5" và "20:11" không cắt
function viaPieces(k, depth) {
  const parts = k.split(CUT); if (parts.length < 2) return null;
  let hit = false;
  const out = parts.map((x, i) => { if (i % 2 || !x) return x; const e = tr(x, depth + 1); if (e !== x) hit = true; return e; }).join("");
  return hit ? out : null;
}

// dịch một chuỗi (giữ khoảng trắng đầu / cuối); không có bản dịch thì trả lại nguyên văn
export function tr(s, depth = 0) {
  if (!S || typeof s !== "string" || !s || !LETTER.test(s)) return s;
  const hit = CACHE.get(s); if (hit !== undefined) return hit;
  const k = norm(s);
  let en = S.get(k);
  if (en === undefined && /^\p{Ll}/u.test(k)) { const c = S.get(k[0].toUpperCase() + k.slice(1)); if (c !== undefined) en = c[0].toLowerCase() + c.slice(1); } // "chạm vùng" như "Chạm vùng"
  if (en === undefined && VI.test(k)) {
    en = viaPattern(k, depth);
    // mẫu khớp nhưng còn sót tiếng Việt: thử dịch từng mảnh, lấy bản sót ít hơn
    if ((en == null || VI.test(en)) && depth < 3) { const p = viaPieces(k, depth); if (p != null && (en == null || viCount(p) < viCount(en))) en = p; }
  }
  let out = s;
  if (en != null && en !== k) { const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0]; out = lead + en + tail; }
  if (!depth) { if (CACHE.size > CACHE_MAX) CACHE.clear(); CACHE.set(s, out); } // mức sâu có thể dịch thiếu, không nhớ
  return out;
}

// ---------- chữ trong trang ----------
const ORIG_T = new WeakMap(), ORIG_A = new WeakMap();
const skipEl = el => !el || SKIP_TAGS.has(el.tagName) || (el.closest && el.closest(SKIP_SEL));

function doText(n) {
  const v = n.nodeValue; if (!v || !LETTER.test(v)) return;
  const rec = ORIG_T.get(n);
  if (rec && rec.en === v) return; // chính mình vừa ghi
  if (skipEl(n.parentElement)) return;
  const en = tr(v); if (en === v) { ORIG_T.delete(n); return; }
  ORIG_T.set(n, { vi: v, en }); n.nodeValue = en;
}
function doAttrs(el) {
  if (skipEl(el)) return;
  if (el.tagName === "OPTION" && !el.hasAttribute("value")) el.setAttribute("value", el.textContent); // giữ giá trị chọn khi đổi chữ
  let rec = ORIG_A.get(el);
  for (const a of ATTRS) {
    const v = el.getAttribute(a); if (!v || !LETTER.test(v)) continue;
    if (rec && rec[a] && rec[a].en === v) continue;
    const en = tr(v); if (en === v) continue;
    if (!rec) ORIG_A.set(el, rec = {});
    rec[a] = { vi: v, en }; el.setAttribute(a, en);
  }
}
function walk(root, fn) {
  if (root.nodeType === 3) { fn.text(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) { if (SKIP_TAGS.has(root.tagName)) return; fn.el(root); }
  const w = document.createTreeWalker(root, 5, { acceptNode: n => n.nodeType === 1 && SKIP_TAGS.has(n.tagName) ? 2 : 1 });
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? fn.text(n) : fn.el(n);
}
const TO_EN = { text: doText, el: doAttrs };
const TO_VI = {
  text: n => { const r = ORIG_T.get(n); if (r && n.nodeValue === r.en) n.nodeValue = r.vi; ORIG_T.delete(n); },
  el: el => { const r = ORIG_A.get(el); if (!r) return; for (const a in r) if (el.getAttribute(a) === r[a].en) el.setAttribute(a, r[a].vi); ORIG_A.delete(el); },
};

let pending = new Set(), queued = false;
function flush() {
  queued = false; const list = pending; pending = new Set();
  if (on) for (const n of list) if (n.isConnected) walk(n, TO_EN);
}
function observe() {
  mo = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === "childList") r.addedNodes.forEach(n => pending.add(n));
      else if (r.type === "characterData") pending.add(r.target);
      else pending.add(r.target.nodeType === 1 ? r.target : r.target.parentNode);
    }
    if (!queued && pending.size) { queued = true; queueMicrotask(flush); }
  });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// ---------- chữ trên biểu đồ ----------
function patchCanvas() {
  if (patched || typeof CanvasRenderingContext2D === "undefined") return; patched = true;
  const P = CanvasRenderingContext2D.prototype;
  for (const fn of ["fillText", "strokeText", "measureText"]) {
    const orig = P[fn];
    P[fn] = function (t, ...rest) { return orig.call(this, on && typeof t === "string" ? tr(t) : t, ...rest); };
  }
}

const redraw = () => { try { window.dispatchEvent(new Event("resize")); } catch { /* bỏ qua */ } };

async function apply(lang) {
  if (lang === "en") {
    if (!S) { try { setDict((await import("./i18n-en.js")).default); } catch (e) { console.warn("Không tải được bảng dịch", e); return; } }
    if (getLang() !== "en") return;
    on = true; patchCanvas();
    document.documentElement.lang = "en";
    walk(document.body, TO_EN); if (!mo) observe();
  } else {
    on = false; if (mo) { mo.disconnect(); mo = null; } pending.clear();
    document.documentElement.lang = "vi";
    walk(document.body, TO_VI);
  }
  redraw();
}

export function initI18n() {
  if (typeof document === "undefined") return;
  document.addEventListener("lailong-lang", e => apply(e.detail));
  if (getLang() === "en") apply("en");
}
