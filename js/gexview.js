// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: tab Quyền chọn. GEX theo strike, đường GEX theo giá (điểm lật gamma), OI, nụ cười IV và bề mặt IV 3D.
// BTC/ETH lấy trực tiếp từ Deribit trong trình duyệt; chỉ số và ETF Mỹ đọc data/gex_<mã>.json (CBOE, chậm 15 phút)
// do GitHub Actions cập nhật mỗi 30 phút, hoặc máy chủ laptop lấy trực tiếp (lailong/terminal/gex.py).
import { getJson, fitCanvas, fmtUsd, fmtTime, MONO } from "./util.js?v=202610240531";
import { setFresh } from "./fresh.js?v=202610240531";
import { initOptPro } from "./optview.js?v=202610240531";
import { initChain } from "./chainview.js?v=202610240531";
import { fromDeribit, pick, levels, smile, atmIv, ivSurface } from "./gex.js?v=202610240531";

export const ASSETS = [
  { id: "BTC", src: "deribit", name: "Bitcoin (Deribit)" }, { id: "ETH", src: "deribit", name: "Ethereum (Deribit)" },
  { id: "SPX", name: "S&P 500" }, { id: "NDX", name: "Nasdaq 100" }, { id: "SPY", name: "ETF S&P 500" }, { id: "QQQ", name: "ETF Nasdaq 100" },
  { id: "IWM", name: "Russell 2000" }, { id: "GLD", name: "Vàng (ETF)" }, { id: "SLV", name: "Bạc (ETF)" }, { id: "USO", name: "Dầu (ETF)" }, { id: "TLT", name: "Trái phiếu 20 năm" },
];
const HORIZ = [{ id: "7", name: "≤ 7 ngày" }, { id: "30", name: "≤ 30 ngày" }, { id: "90", name: "≤ 90 ngày" }, { id: "all", name: "Mọi hạn" }];
const C = { call: "#1fb57a", put: "#e5484d", net: "#ff9f1c", spot: "#ffffff", flip: "#b48cff", grid: "#2b2b2b", muted: "#a3a3a3" };
const DAY = 864e5;

const fmtG = v => (v >= 0 ? "+" : "-") + fmtUsd(Math.abs(v));
const fmtK = (k, spot) => spot >= 1000 ? Math.round(k).toLocaleString("en-US") : spot >= 100 ? k.toFixed(k % 1 ? 1 : 0) : k.toFixed(2);
const dstr = t => { const d = new Date(t); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

// lời giải thích tự động theo vị trí giá so với các mức
export function readGex(L, spot) {
  if (!L) return [];
  const out = [];
  out.push(L.net >= 0
    ? "GEX tổng dương: nhà tạo lập đang ở thế gamma dương, họ bán khi giá lên và mua khi giá xuống để cân vị thế. Giá thường đi trong biên độ hẹp, các cú phá vỡ dễ bị kéo ngược lại."
    : "GEX tổng âm: nhà tạo lập ở thế gamma âm, họ phải mua đuổi khi giá lên và bán đuổi khi giá xuống. Biến động dễ bị khuếch đại, xu hướng chạy xa hơn bình thường.");
  if (L.flip) out.push(spot > L.flip
    ? `Giá đang trên điểm lật gamma ${fmtK(L.flip, spot)}: vùng ổn định hơn. Rơi xuống dưới mức này thì biến động có thể tăng nhanh.`
    : `Giá đang dưới điểm lật gamma ${fmtK(L.flip, spot)}: vùng biến động mạnh. Lấy lại được mức này thì thị trường thường dịu lại.`);
  out.push(`Tường call ${fmtK(L.callWall, spot)} thường là kháng cự, tường put ${fmtK(L.putWall, spot)} thường là hỗ trợ trong ngắn hạn.`);
  if (L.maxPain) out.push(`Max pain ${fmtK(L.maxPain, spot)}: gần ngày đáo hạn giá hay bị hút về quanh mức này, nhất là khi GEX dương.`);
  return out;
}

export function initGex({ $, esc }) {
  let asset = "BTC", horiz = "30", exp = null, zoom = 0.1, mode = "gex", chain = null, L = null, err = "", loading = false, rot = { a: -0.6, b: 0.85 };
  try { const s = JSON.parse(sessionStorage.getItem("lailong.gex") || "{}"); asset = s.asset || asset; horiz = s.horiz || horiz; } catch { /* bỏ qua */ }
  const save = () => { try { sessionStorage.setItem("lailong.gex", JSON.stringify({ asset, horiz })); } catch { /* bỏ qua */ } };
  const cache = new Map(), pro = initOptPro({ $, esc }), chainView = initChain({ $, esc });
  const cvs = { bars: fitCanvas($("gexBars"), () => drawBars()), prof: fitCanvas($("gexProf"), () => drawProf()), smile: fitCanvas($("gexSmile"), () => drawSmile()), surf: fitCanvas($("gexSurf"), () => drawSurf()) };
  let hoverK = null;

  async function load() {
    const a = ASSETS.find(x => x.id === asset), key = asset, c = cache.get(key);
    if (c && Date.now() - c.t < (a.src ? 60e3 : 300e3)) { chain = c.ch; return compute(); }
    loading = true; err = ""; renderHead();
    try {
      let ch;
      if (a.src === "deribit") {
        const r = await getJson(`https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${asset}&kind=option`);
        ch = { ...fromDeribit(r.result || []), updated: Date.now(), live: true };
      } else ch = await getJson(`data/gex_${asset}.json?t=${Math.floor(Date.now() / 60e3)}`);
      cache.set(key, { t: Date.now(), ch });
      if (key === asset) chain = ch;
    } catch (e) { err = `Không tải được chuỗi quyền chọn ${asset}: ${e.message}`; chain = null; }
    loading = false; compute();
  }

  function sub() {
    if (!chain) return null;
    return exp ? pick(chain, { exp }) : pick(chain, { maxDays: horiz === "all" ? Infinity : +horiz });
  }
  function compute() {
    const s = sub(); L = s && s.rows.length ? levels(s) : null;
    render();
    const a = ASSETS.find(x => x.id === asset);
    const live = !!(a && a.src), cur = asset, ch = chain;
    chainView.update(cur, ch, live);
    pro.update(asset, chain, live, chain && chain.rows.length ? levels(pick(chain, { maxDays: 30 })) : null)
      .then(ex => { if (ex && cur === asset && ch === chain) chainView.update(cur, ch, live, ex); }).catch(() => { /* bỏ qua */ });
  }

  function renderHead() {
    $("gexAssets").innerHTML = ASSETS.map((a, i) => `${i === 2 ? `<span class="sep"></span>` : ""}<button class="${a.id === asset ? "on" : ""}" data-ga="${a.id}" data-tip="${esc(a.name)}">${a.id}</button>`).join("");
    const exps = chain ? chain.exps.filter(t => t > Date.now()).slice(0, 24) : [];
    $("gexHoriz").innerHTML = HORIZ.map(h => `<button class="${!exp && h.id === horiz ? "on" : ""}" data-gh="${h.id}">${h.name}</button>`).join("") +
      `<select id="gexExp"><option value="">Một hạn cụ thể…</option>${exps.map(t => `<option value="${t}" ${t === exp ? "selected" : ""}>${dstr(t)} (${Math.max(0, Math.round((t - Date.now()) / DAY))} ngày)</option>`).join("")}</select>`;
    $("gexExp").onchange = e => { exp = +e.target.value || null; compute(); };
    const a = ASSETS.find(x => x.id === asset);
    if (loading && !chain) $("gexSrc").textContent = "đang tải…";
    else if (chain) setFresh($("gexSrc"), a.src ? "live" : "delay", chain.updated || (chain.quoteTime ? Date.parse(chain.quoteTime) : null),
      a.src ? { label: "Trực tiếp (Deribit, làm mới mỗi 2 phút)", expect: 6 * 60e3, note: "Lấy thẳng từ Deribit trong trình duyệt: giá, IV, OI của mọi quyền chọn, làm mới mỗi 2 phút" }
        : { label: "Trễ 15 phút (CBOE)", expect: 3 * 3600e3, note: `Chuỗi quyền chọn CBOE chậm 15 phút${chain.quoteTime ? `, giá chốt lúc ${chain.quoteTime.slice(5, 16).replace("T", " ")} giờ New York` : ""}. Bản web cập nhật mỗi 30 phút, bản laptop mỗi 15 phút; ngoài giờ giao dịch Mỹ số liệu đứng yên` });
  }

  function renderKpis() {
    const el = $("gexKpis");
    if (err) { el.innerHTML = `<div class="empty">${esc(err)}</div>`; return; }
    if (!chain || !L) { el.innerHTML = `<div class="empty">${loading ? "Đang tải chuỗi quyền chọn…" : "Không có hợp đồng nào trong khoảng hạn này."}</div>`; return; }
    const sp = chain.spot, atm = atmIv(chain, 0), k = v => fmtK(v, sp);
    const pc = v => `<small class="${v >= sp ? "up" : "dn"}">${((v / sp - 1) * 100).toFixed(1)}%</small>`;
    el.innerHTML = [
      ["Giá", k(sp) + (chain.chg != null ? ` <small class="${chain.chg >= 0 ? "up" : "dn"}">${chain.chg >= 0 ? "+" : ""}${(+chain.chg).toFixed(2)}%</small>` : ""), "Giá tài sản cơ sở lúc lấy dữ liệu"],
      ["GEX tổng", `<span class="${L.net >= 0 ? "up" : "dn"}">${fmtG(L.net)}</span> <small>${L.net >= 0 ? "gamma dương" : "gamma âm"}</small>`, "Số USD nhà tạo lập phải mua/bán thêm khi giá đi 1%. Dương: họ đi ngược giá (giảm biến động). Âm: họ đi theo giá (tăng biến động)."],
      ["Tường call", `${k(L.callWall)} ${pc(L.callWall)}`, "Strike trên giá có gamma call lớn nhất: thường là kháng cự"],
      ["Tường put", `${k(L.putWall)} ${pc(L.putWall)}`, "Strike dưới giá có gamma put lớn nhất: thường là hỗ trợ"],
      ["Điểm lật gamma", L.flip ? `${k(L.flip)} ${pc(L.flip)}` : "–", "Mức giá mà GEX tổng đổi dấu. Trên mức này thị trường thường êm, dưới mức này dễ biến động mạnh."],
      ["Max pain", L.maxPain ? `${k(L.maxPain)} ${pc(L.maxPain)}` : "–", "Giá đáo hạn làm người mua quyền chọn lỗ nhiều nhất"],
      ["Put/Call OI", L.pcr != null ? L.pcr.toFixed(2) : "–", "Tỷ lệ hợp đồng put mở so với call. Trên 1: nhiều người mua bảo hiểm giảm giá."],
      ["IV ATM gần nhất", atm ? (atm * 100).toFixed(1) + "%" : "–", "Độ biến động ngụ ý của hạn gần nhất, ở strike sát giá"],
    ].map(([t, v, tip]) => `<div data-tip="${esc(tip)}"><small>${t}</small><b>${v}</b></div>`).join("");
    $("gexRead").innerHTML = readGex(L, sp).map(x => `<li>${esc(x)}</li>`).join("");
  }

  // ---------- biểu đồ GEX / OI theo strike (thanh ngang) ----------
  function visStrikes() {
    if (!L) return [];
    const sp = chain.spot;
    return L.strikes.filter(x => Math.abs(x.k / sp - 1) <= zoom);
  }
  function drawBars() {
    const { ctx, w, h } = cvs.bars; ctx.clearRect(0, 0, w, h);
    const st = visStrikes(); if (!st.length) return;
    const sp = chain.spot, top = 8, bot = h - 18, lx = 64;
    const kLo = st[0].k, kHi = st[st.length - 1].k, y = k => bot - (k - kLo) / ((kHi - kLo) || 1) * (bot - top);
    const val = x => mode === "gex" ? [x.call, x.put] : [x.callOi, -x.putOi];
    const mx = Math.max(1e-9, ...st.map(x => Math.max(Math.abs(val(x)[0]), Math.abs(val(x)[1]))));
    const cx = lx + (w - lx - 8) / 2, sc = (w - lx - 8) / 2 / mx;
    const bh = Math.max(1, Math.min(14, (bot - top) / st.length - 1));
    ctx.font = `10px ${MONO}`; ctx.textBaseline = "middle";
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bot); ctx.stroke();
    const every = Math.ceil(st.length / Math.max(1, (bot - top) / 13));
    const marks = [L.callWall, L.putWall, hoverK].filter(k => k != null).map(y);
    st.forEach((x, i) => {
      const yy = y(x.k), [c, p] = val(x);
      ctx.fillStyle = C.call; ctx.fillRect(cx, yy - bh / 2, c * sc, bh);
      ctx.fillStyle = C.put; ctx.fillRect(cx, yy - bh / 2, p * sc, bh);
      if (mode === "gex") { ctx.fillStyle = C.net; ctx.fillRect(cx + x.net * sc - 1, yy - bh / 2, 2, bh); }
      const mark = x.k === L.callWall || x.k === L.putWall || x.k === hoverK;
      const near = !mark && marks.some(m => Math.abs(m - yy) < 11);
      if ((i % every === 0 && !near) || mark) { ctx.fillStyle = mark ? "#fff" : C.muted; ctx.textAlign = "right"; ctx.fillText(fmtK(x.k, sp), lx - 6, yy); }
    });
    // đường các mức chính; nhãn được giãn ra để không đè nhau
    const lines = [[sp, C.spot, `Giá ${fmtK(sp, sp)}`, false], [L.flip, C.flip, `Lật gamma ${fmtK(L.flip || 0, sp)}`, true],
      [L.callWall, C.call, `Tường call ${fmtK(L.callWall, sp)}`, true], [L.putWall, C.put, `Tường put ${fmtK(L.putWall, sp)}`, true]]
      .filter(([k]) => k != null && k >= kLo && k <= kHi).map(l => [...l, y(l[0])]).sort((a, b) => a[4] - b[4]);
    let lastY = -1e9;
    for (const [, col, label, dash, yy] of lines) {
      ctx.strokeStyle = col; ctx.setLineDash(dash ? [4, 3] : []); ctx.beginPath(); ctx.moveTo(lx, yy); ctx.lineTo(w, yy); ctx.stroke(); ctx.setLineDash([]);
      const ty = Math.max(yy - 7, lastY + 12); lastY = ty;
      ctx.fillStyle = col; ctx.textAlign = "right"; ctx.fillText(label, w - 4, ty);
    }
    ctx.fillStyle = C.muted; ctx.textAlign = "center";
    ctx.fillText(mode === "gex" ? `← put (âm)   ${fmtUsd(mx)} / 1%   call (dương) →` : `← OI put   ${Math.round(mx).toLocaleString("en-US")} hợp đồng   OI call →`, cx, h - 7);
  }

  // ---------- GEX tổng theo giá ----------
  function drawProf() {
    const { ctx, w, h } = cvs.prof; ctx.clearRect(0, 0, w, h);
    if (!L) return;
    const pts = L.profile, sp = chain.spot, l = 8, r = w - 8, top = 10, bot = h - 18;
    const lo = pts[0].S, hi = pts[pts.length - 1].S, gmx = Math.max(1e-9, ...pts.map(p => Math.abs(p.g)));
    const x = S => l + (S - lo) / (hi - lo) * (r - l), y = g => (top + bot) / 2 - g / gmx * (bot - top) / 2;
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(l, y(0)); ctx.lineTo(r, y(0)); ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = 1; i < pts.length; i++) {
      ctx.strokeStyle = (pts[i].g + pts[i - 1].g) / 2 >= 0 ? C.call : C.put;
      ctx.beginPath(); ctx.moveTo(x(pts[i - 1].S), y(pts[i - 1].g)); ctx.lineTo(x(pts[i].S), y(pts[i].g)); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.font = `10px ${MONO}`; ctx.textBaseline = "alphabetic";
    let row = 0;
    const v = (S, col, label) => { if (S == null) return; const ty = top + 10 + 12 * row++; ctx.strokeStyle = col; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x(S), top); ctx.lineTo(x(S), bot); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = col; ctx.textAlign = x(S) > w - 90 ? "right" : "left"; ctx.fillText(label, x(S) + (x(S) > w - 90 ? -4 : 4), ty); };
    v(sp, C.spot, "Giá"); v(L.flip, C.flip, "Lật gamma");
    ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.fillText(fmtK(lo, sp), l, h - 5); ctx.textAlign = "right"; ctx.fillText(fmtK(hi, sp), r, h - 5);
    ctx.textAlign = "center"; ctx.fillText(`GEX tổng nếu giá ở mức này (đỉnh ${fmtUsd(gmx)})`, w / 2, h - 5);
  }

  // ---------- nụ cười IV các hạn gần + IV ATM theo hạn ----------
  function drawSmile() {
    const { ctx, w, h } = cvs.smile; ctx.clearRect(0, 0, w, h);
    if (!chain) return;
    const sp = chain.spot, ies = chain.exps.map((t, i) => [t, i]).filter(([t]) => t - Date.now() > 2 * DAY).slice(0, 5);
    const band = ["BTC", "ETH"].includes(asset) ? 0.25 : 0.1;
    const lines = ies.map(([t, i]) => ({ t, s: smile(chain, i).filter(p => Math.abs(p.k / sp - 1) <= band) })).filter(l => l.s.length > 3);
    if (!lines.length) return;
    const all = lines.flatMap(l => l.s), kLo = Math.min(...all.map(p => p.k)), kHi = Math.max(...all.map(p => p.k));
    const ivLo = Math.min(...all.map(p => p.iv)), ivHi = Math.min(Math.max(...all.map(p => p.iv)), ivLo * 6);
    const l = 34, r = w - 8, top = 10, bot = h - 30, x = k => l + (k - kLo) / (kHi - kLo || 1) * (r - l), y = v => bot - (Math.min(v, ivHi) - ivLo) / (ivHi - ivLo || 1) * (bot - top);
    const cols = ["#ff9f1c", "#4ea1ff", "#b48cff", "#1fb57a", "#e5484d"];
    ctx.font = `10px ${MONO}`;
    for (let g = 0; g <= 4; g++) { const v = ivLo + (ivHi - ivLo) * g / 4; ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(l, y(v)); ctx.lineTo(r, y(v)); ctx.stroke(); ctx.fillStyle = C.muted; ctx.textAlign = "right"; ctx.fillText((v * 100).toFixed(0) + "%", l - 4, y(v) + 3); }
    lines.forEach((ln, j) => { ctx.strokeStyle = cols[j]; ctx.lineWidth = 1.6; ctx.beginPath(); ln.s.forEach((p, i) => i ? ctx.lineTo(x(p.k), y(p.iv)) : ctx.moveTo(x(p.k), y(p.iv))); ctx.stroke(); });
    ctx.lineWidth = 1; ctx.strokeStyle = C.spot; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x(sp), top); ctx.lineTo(x(sp), bot); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = "left"; let lx = l;
    lines.forEach((ln, j) => { const t = `■ ${dstr(ln.t)}`; ctx.fillStyle = cols[j]; ctx.fillText(t, lx, h - 16); lx += ctx.measureText(t).width + 10; });
    ctx.fillStyle = C.muted; ctx.fillText(fmtK(kLo, sp), l, h - 3); ctx.textAlign = "right"; ctx.fillText(fmtK(kHi, sp), r, h - 3);
    ctx.textAlign = "center"; ctx.fillText("Strike (đường đứt: giá hiện tại)", (l + r) / 2, h - 3);
  }

  // ---------- bề mặt IV 3D: kéo chuột để xoay ----------
  function drawSurf() {
    const { ctx, w, h } = cvs.surf; ctx.clearRect(0, 0, w, h);
    if (!chain) return;
    const sf = ivSurface(chain, { mny: [-0.2, -0.15, -0.1, -0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2].filter(m => Math.abs(m) <= (asset === "BTC" || asset === "ETH" ? 0.2 : 0.15)), maxExp: 400 });
    // chọn các hạn rải đều từ 3 ngày tới 1 năm để mặt không bị dồn vào các hạn hằng ngày
    const cand = sf.rows.filter(r => r.days >= 2), rows = [];
    for (const d of [3, 7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365]) {
      const r = cand.reduce((a, b) => !a || Math.abs(b.days - d) < Math.abs(a.days - d) ? b : a, null);
      if (r && !rows.includes(r) && Math.abs(r.days - d) / d < 0.5) rows.push(r);
    }
    rows.sort((a, b) => a.days - b.days);
    if (rows.length < 2) return;
    const vals = rows.flatMap(r => r.iv).filter(v => v != null), lo = Math.min(...vals), hi = Math.min(Math.max(...vals), lo * 3.5);
    const nx = sf.mny.length, ny = rows.length;
    const ca = Math.cos(rot.a), sa = Math.sin(rot.a), cb = Math.cos(rot.b), sb = Math.sin(rot.b), S = Math.min((h - 40) / 2, (w - 120) / 1.6);
    const P = (i, j, v) => { // i: độ lệch giá, j: hạn, v: iv -> toạ độ màn hình
      const X = (i / (nx - 1) - 0.5) * 0.9, Y = (j / (ny - 1) - 0.5) * 0.9, Z = (Math.min(v, hi) - lo) / (hi - lo || 1) * 0.55 - 0.275;
      const x1 = X * ca - Y * sa, y1 = X * sa + Y * ca;
      return [w / 2 + x1 * S, h / 2 + 10 - (Z * cb - y1 * sb) * S, y1 * cb + Z * sb];
    };
    const color = v => { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1))); return `hsl(${(1 - t) * 230},85%,${45 + t * 10}%)`; };
    const quads = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const v = [rows[j].iv[i], rows[j].iv[i + 1], rows[j + 1].iv[i + 1], rows[j + 1].iv[i]]; if (v.some(x => x == null)) continue;
      const p = [P(i, j, v[0]), P(i + 1, j, v[1]), P(i + 1, j + 1, v[2]), P(i, j + 1, v[3])];
      quads.push({ p, z: p.reduce((s, q) => s + q[2], 0), v: v.reduce((s, x) => s + x, 0) / 4 });
    }
    quads.sort((a, b) => b.z - a.z);
    for (const q of quads) { ctx.fillStyle = color(q.v); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); q.p.forEach((pt, k) => k ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.font = `10px ${MONO}`; ctx.fillStyle = C.muted;
    const lab = (i, j, v, t, al) => { const p = P(i, j, v); ctx.textAlign = al; ctx.fillText(t, p[0], p[1]); };
    lab(0, -0.6, lo, `${(sf.mny[0] * 100).toFixed(0)}%`, "center"); lab(nx - 1, -0.6, lo, `+${(sf.mny[nx - 1] * 100).toFixed(0)}%`, "center");
    lab(nx - 1 + 0.6, 0, lo, `${Math.round(rows[0].days)} ngày`, "left"); lab(nx - 1 + 0.6, ny - 1, lo, `${Math.round(rows[ny - 1].days)} ngày`, "left");
    ctx.textAlign = "left"; ctx.fillText(`IV ${(lo * 100).toFixed(0)}% → ${(hi * 100).toFixed(0)}% (xanh thấp, đỏ cao) · kéo để xoay`, 6, 12);
  }

  function render() {
    renderHead(); renderKpis();
    for (const b of $("gexMode").children) b.classList.toggle("on", b.dataset.gm === mode);
    for (const b of $("gexZoom").children) b.classList.toggle("on", +b.dataset.gz === zoom);
    drawBars(); drawProf(); drawSmile(); drawSurf();
  }

  $("gexAssets").onclick = e => { const b = e.target.closest("[data-ga]"); if (!b) return; asset = b.dataset.ga; exp = null; zoom = ["BTC", "ETH"].includes(asset) ? 0.15 : 0.06; save(); chain = null; L = null; render(); load(); };
  $("gexHoriz").onclick = e => { const b = e.target.closest("[data-gh]"); if (!b) return; horiz = b.dataset.gh; exp = null; save(); compute(); };
  $("gexMode").onclick = e => { const b = e.target.closest("[data-gm]"); if (b) { mode = b.dataset.gm; render(); } };
  $("gexZoom").onclick = e => { const b = e.target.closest("[data-gz]"); if (b) { zoom = +b.dataset.gz; render(); } };
  $("gexBars").onmousemove = e => {
    const st = visStrikes(); if (!st.length) return;
    const r = e.target.getBoundingClientRect(), top = 8, bot = cvs.bars.h - 18, kLo = st[0].k, kHi = st[st.length - 1].k;
    const k = kLo + (bot - (e.clientY - r.top)) / (bot - top) * (kHi - kLo), x = st.reduce((a, b) => Math.abs(b.k - k) < Math.abs(a.k - k) ? b : a);
    if (x.k !== hoverK) { hoverK = x.k; drawBars(); }
    e.target.dataset.tip = `Strike ${fmtK(x.k, chain.spot)}: GEX call ${fmtUsd(x.call)}, put -${fmtUsd(-x.put)}, ròng ${fmtG(x.net)}. OI call ${Math.round(x.callOi).toLocaleString("en-US")}, OI put ${Math.round(x.putOi).toLocaleString("en-US")}.`;
  };
  $("gexBars").onmouseleave = () => { hoverK = null; drawBars(); };
  let drag = null;
  const sv = $("gexSurf");
  sv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, a: rot.a, b: rot.b }; sv.setPointerCapture(e.pointerId); };
  sv.onpointermove = e => { if (!drag) return; rot = { a: drag.a + (e.clientX - drag.x) / 120, b: Math.max(0.05, Math.min(1.4, drag.b + (e.clientY - drag.y) / 150)) }; drawSurf(); };
  sv.onpointerup = sv.onpointercancel = () => { drag = null; };

  let timer = null;
  return {
    show() { zoom = ["BTC", "ETH"].includes(asset) ? 0.15 : 0.06; load(); if (!timer) timer = setInterval(() => { cache.delete(asset); load(); }, 120e3); },
    hide() { clearInterval(timer); timer = null; },
  };
}
