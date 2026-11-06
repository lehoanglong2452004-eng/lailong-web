// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: trang Market Depth (độ sâu thị trường và vị thế), cách trình bày theo kiểu FXSSI Order Book.
//
// Trái: lệnh chờ (limit) đang nằm trên sổ lệnh của nhiều sàn crypto miễn phí (Binance futures và spot, OKX, Bybit,
// Coinbase), gom theo vùng giá. Trên giá hiện tại là lệnh chờ bán, dưới là lệnh chờ mua.
// Phải: vị thế ƯỚC TÍNH theo giá vào lệnh, dựng từ nến 1 phút Binance futures: khối lượng mua chủ động coi như
// long mở ở vùng giá của nến, bán chủ động coi như short. Long vào dưới giá hiện tại là đang lãi, trên là đang lỗ;
// short ngược lại. Đây là ước tính thô (lệnh mua chủ động cũng có thể là short đóng lệnh), không phải dữ liệu vị thế thật.
// Cứ mỗi phút khi trang đang mở thì chụp lại sổ lệnh một lần để xem lại và so Tăng–Giảm.

import { getJson, niceStep } from "./util.js?v=202611062023";

const FAPI = "https://fapi.binance.com", SAPI = "https://api.binance.com";
export const DEPTH_COINS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "LINK", "AVAX", "SUI"];
export const DEPTH_PERIODS = [[20, "20 phút"], [60, "1 giờ"], [240, "4 giờ"], [720, "12 giờ"], [1440, "24 giờ"]];
export const DEPTH_RANGES = [1, 2, 3, 5, 10];
export const DEPTH_VIEWS = [["all", "Tất cả"], ["net", "Ròng"], ["diff", "Tăng–Giảm"]];
const KEEP_SNAPS = 180;

// các nguồn sổ lệnh: mỗi hàm trả về { bids: [[giá, số coin]], asks } (số lượng đã là số coin)
const num = a => a.map(r => [+r[0], +r[1]]);
export const BOOK_SOURCES = [
  { id: "bnf", name: "Binance Futures", get: c => getJson(`${FAPI}/fapi/v1/depth?symbol=${c}USDT&limit=1000`).then(d => ({ bids: num(d.bids), asks: num(d.asks) })) },
  { id: "bns", name: "Binance Spot", get: c => getJson(`${SAPI}/api/v3/depth?symbol=${c}USDT&limit=5000`).then(d => ({ bids: num(d.bids), asks: num(d.asks) })) },
  { id: "okx", name: "OKX Spot", get: c => getJson(`https://www.okx.com/api/v5/market/books?instId=${c}-USDT&sz=400`).then(d => ({ bids: num(d.data[0].bids), asks: num(d.data[0].asks) })) },
  { id: "byb", name: "Bybit Futures", get: c => getJson(`https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${c}USDT&limit=500`).then(d => ({ bids: num(d.result.b), asks: num(d.result.a) })) },
  { id: "cb", name: "Coinbase", skip: c => c === "BNB", get: c => getJson(`https://api.exchange.coinbase.com/products/${c}-USD/book?level=2`).then(d => ({ bids: num(d.bids), asks: num(d.asks) })) },
];

// bước gom giá: khoảng ±range% chia khoảng 70 dòng, làm tròn số đẹp
export function depthStep(price, rangePct) { return niceStep(price * rangePct / 100 * 2 / 70); }

// gom các mức giá vào ô: key = floor(giá / step); trả về Map(key -> số coin)
export function bucketize(levels, step, into = new Map()) {
  for (const [p, q] of levels) {
    if (!(q > 0) || !(p > 0)) continue;
    const k = Math.floor(p / step + 1e-9);
    into.set(k, (into.get(k) || 0) + q);
  }
  return into;
}

// sổ lệnh gộp của nhiều sàn: { bids: Map, asks: Map, mid, ok: [tên sàn], err: [..] }
export function mergeDepth(books, step) {
  const bids = new Map(), asks = new Map(), ok = [], err = [];
  let bestBid = 0, bestAsk = Infinity;
  for (const b of books) {
    if (!b || b.error) { if (b) err.push(`${b.name}: ${b.error}`); continue; }
    ok.push(b.name);
    bucketize(b.bids, step, bids); bucketize(b.asks, step, asks);
    if (b.bids.length) bestBid = Math.max(bestBid, b.bids[0][0]);
    if (b.asks.length) bestAsk = Math.min(bestAsk, b.asks[0][0]);
  }
  const mid = bestBid > 0 && isFinite(bestAsk) ? (bestBid + bestAsk) / 2 : bestBid || null;
  return { bids, asks, mid, ok, err };
}

// vị thế ước tính theo giá vào lệnh từ nến [t, o, h, l, c, v, ..., takerBuyV (chỉ số 9)]:
// khối lượng mỗi nến rải đều trên khoảng thấp–cao của nến. Trả về { long: Map, short: Map }
export function entryProfile(klines, step) {
  const long = new Map(), short = new Map();
  for (const k of klines) {
    const h = +k[2], l = +k[3], v = +k[5], bv = +k[9];
    if (!(v > 0) || !(h > 0)) continue;
    const sv = Math.max(0, v - bv), k0 = Math.floor(l / step + 1e-9), k1 = Math.floor(h / step + 1e-9), n = k1 - k0 + 1;
    for (let k = k0; k <= k1; k++) {
      long.set(k, (long.get(k) || 0) + bv / n);
      short.set(k, (short.get(k) || 0) + sv / n);
    }
  }
  return { long, short };
}

// tổng trong khoảng ±pct% quanh giá: lệnh chờ mua / bán, vị thế lãi / lỗ
export function depthRatios(depth, pos, price, step, pct = 2) {
  const lo = Math.floor(price * (1 - pct / 100) / step), hi = Math.floor(price * (1 + pct / 100) / step), pk = Math.floor(price / step);
  let bid = 0, ask = 0, win = 0, lose = 0, lg = 0, sh = 0;
  for (let k = lo; k <= hi; k++) {
    bid += depth.bids.get(k) || 0; ask += depth.asks.get(k) || 0;
    const L = pos ? pos.long.get(k) || 0 : 0, S = pos ? pos.short.get(k) || 0 : 0;
    lg += L; sh += S;
    if (k < pk) { win += L; lose += S; } else if (k > pk) { win += S; lose += L; }
  }
  const r = (a, b) => a + b > 0 ? a / (a + b) : null;
  return { bid: r(bid, ask), long: r(lg, sh), win: r(win, lose), bidQ: bid, askQ: ask };
}

// chênh lệch lệnh chờ giữa hai lần chụp: Map(key -> thay đổi, dương là thêm lệnh, âm là rút)
export function depthDiff(cur, prev) {
  const out = new Map();
  for (const side of ["bids", "asks"]) {
    const a = cur[side], b = prev[side];
    for (const [k, q] of a) out.set(k, (out.get(k) || 0) + q - (b.get(k) || 0));
    for (const [k, q] of b) if (!a.has(k)) out.set(k, (out.get(k) || 0) - q);
  }
  return out;
}

// vùng lệnh chờ lớn nhất mỗi phía (để ghi nhãn): [{ k, q, side }]
export function topWalls(depth, price, step, n = 3) {
  const pk = Math.floor(price / step), pick = (m, side, f) => [...m].filter(([k]) => f(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, q]) => ({ k, q, side }));
  return [...pick(depth.asks, "ask", k => k >= pk), ...pick(depth.bids, "bid", k => k <= pk)];
}

const fmtQ = q => !q ? "0" : q >= 1e6 ? (q / 1e6).toFixed(1) + "M" : q >= 1e4 ? (q / 1e3).toFixed(0) + "K" : q >= 1e3 ? (q / 1e3).toFixed(1) + "K" : q >= 100 ? q.toFixed(0) : q >= 10 ? q.toFixed(1) : q.toFixed(2);
const pctTxt = r => r == null ? "–" : Math.round(r * 100) + "%";

export function initDepth({ $, esc }) {
  const cv = $("depthCanvas"); if (!cv) return { show() {}, hide() {} };
  const ctx = cv.getContext("2d");
  const S = { coin: "BTC", period: 60, range: 3, view: "all", snaps: [], at: -1, pos: null, ls: null, timer: null, visible: false, busy: false, sent: {}, err: [] };
  try { Object.assign(S, JSON.parse(localStorage.getItem("lailong.depth") || "{}"), { snaps: [], at: -1, pos: null, ls: null, timer: null, visible: false, busy: false, sent: {}, err: [] }); } catch { /* bỏ qua */ }
  if (!DEPTH_COINS.includes(S.coin)) S.coin = "BTC";
  const save = () => { try { localStorage.setItem("lailong.depth", JSON.stringify({ coin: S.coin, period: S.period, range: S.range, view: S.view })); } catch { /* bỏ qua */ } };

  async function snap() {
    const got = await Promise.all(BOOK_SOURCES.filter(s => !(s.skip && s.skip(S.coin))).map(s => s.get(S.coin).then(b => ({ ...b, name: s.name }), e => ({ name: s.name, error: String(e.message || e).slice(0, 80) }))));
    const ref = got.find(b => !b.error && b.bids.length);
    if (!ref) { S.err = got.map(b => `${b.name}: ${b.error}`); return null; }
    // giữ nguyên các mức giá gốc để đổi bước gom khi đổi khoảng giá
    return { t: Date.now(), books: got, price: (ref.bids[0][0] + ref.asks[0][0]) / 2 };
  }
  async function loadPos() {
    const n = Math.min(1500, S.period);
    const [kl, acc, top] = await Promise.all([
      getJson(`${FAPI}/fapi/v1/klines?symbol=${S.coin}USDT&interval=1m&limit=${n}`).catch(() => null),
      getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${S.coin}USDT&period=5m&limit=1`).catch(() => null),
      getJson(`${FAPI}/futures/data/topLongShortPositionRatio?symbol=${S.coin}USDT&period=5m&limit=1`).catch(() => null),
    ]);
    S.pos = kl; S.ls = { acc: acc && acc[0] ? +acc[0].longAccount : null, top: top && top[0] ? +top[0].longAccount : null };
  }
  async function loadQuick() {
    if (S.quick && Date.now() - S.quick.t < 5 * 60e3) return;
    const rows = await Promise.all(DEPTH_COINS.map(c => getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${c}USDT&period=5m&limit=1`).then(d => [c, d && d[0] ? +d[0].longAccount : null], () => [c, null])));
    S.quick = { t: Date.now(), rows };
  }
  async function tick(full) {
    if (S.busy) return; S.busy = true;
    try {
      const sn = await snap();
      if (sn) {
        const follow = S.at < 0 || S.at === S.snaps.length - 1; // đang xem lần chụp cũ thì giữ nguyên chỗ đang xem
        S.snaps.push(sn);
        if (S.snaps.length > KEEP_SNAPS) { S.snaps.shift(); if (!follow) S.at = Math.max(0, S.at - 1); }
        if (follow) S.at = S.snaps.length - 1;
      }
      if (full || !S.pos || Date.now() - (S.posAt || 0) > 60e3) { await loadPos(); S.posAt = Date.now(); }
      loadQuick().then(renderSide, () => {});
    } finally { S.busy = false; }
    render();
  }

  function data() {
    const sn = S.snaps[S.at]; if (!sn) return null;
    const step = depthStep(sn.price, S.range), depth = mergeDepth(sn.books, step), price = depth.mid || sn.price;
    const pos = S.pos ? entryProfile(S.pos, step) : null;
    // Tăng–Giảm: so với lần chụp cách đó khoảng một "khoảng thời gian", hoặc lần đầu nếu chưa đủ lâu
    let diff = null, base = null;
    if (S.view === "diff") {
      base = S.snaps.slice(0, S.at).reverse().find(x => sn.t - x.t >= S.period * 60e3) || S.snaps[0];
      if (base && base !== sn) diff = depthDiff(depth, mergeDepth(base.books, step));
    }
    return { sn, step, depth, price, pos, diff, base };
  }

  function render() {
    renderBar();
    const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(320, r.width), H = Math.max(360, r.height);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.body), C = k => css.getPropertyValue(k).trim(), MONO = C("--mono") || "monospace";
    const up = C("--buy") || "#1fb57a", dn = C("--sell") || "#e5484d", ink = C("--ink") || "#fff", muted = C("--muted") || "#999", line = C("--line") || "#2b2b2b";
    ctx.fillStyle = C("--panel") || "#0b0b0b"; ctx.fillRect(0, 0, W, H);
    const D = data(); S.layout = null;
    ctx.font = `12px ${MONO}`; ctx.textBaseline = "middle";
    if (!D) { ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.fillText(S.err.length ? "Chưa lấy được sổ lệnh: " + S.err.join(" · ") : "Đang tải sổ lệnh…", W / 2, H / 2); return; }
    const { step, depth, price, pos, diff } = D, top = 26, bot = 8, ph = H - top - bot, AX = 76, cx = W / 2, half = cx - AX / 2 - 8;
    const lo = Math.floor(price * (1 - S.range / 100) / step), hi = Math.floor(price * (1 + S.range / 100) / step), rows = hi - lo + 1, rowH = ph / rows;
    const yOf = k => top + (hi - k) * rowH, pk = Math.floor(price / step);
    S.layout = { top, rowH, hi, lo, step, cx, AX, D };
    // trái: lệnh chờ hoặc thay đổi lệnh chờ
    let mxL = 0, mxR = 0;
    for (let k = lo; k <= hi; k++) {
      mxL = Math.max(mxL, diff ? Math.abs(diff.get(k) || 0) : (depth.bids.get(k) || 0) + (depth.asks.get(k) || 0));
      if (pos) mxR = Math.max(mxR, S.view === "net" ? Math.abs((pos.long.get(k) || 0) - (pos.short.get(k) || 0)) : (pos.long.get(k) || 0) + (pos.short.get(k) || 0));
    }
    const walls = new Set(topWalls(depth, price, step).map(w => w.k));
    const hgt = Math.max(1, rowH - (rowH > 5 ? 1.5 : 0.5));
    ctx.textAlign = "left"; ctx.font = `bold 11px ${MONO}`;
    for (let k = lo; k <= hi; k++) {
      const y = yOf(k);
      if (diff) {
        const d = diff.get(k) || 0, len = mxL ? Math.abs(d) / mxL * half : 0;
        ctx.fillStyle = d >= 0 ? up : dn; ctx.globalAlpha = 0.8; ctx.fillRect(cx - AX / 2 - len, y, len, hgt); ctx.globalAlpha = 1;
      } else {
        const q = k >= pk ? depth.asks.get(k) || 0 : depth.bids.get(k) || 0, len = mxL ? q / mxL * half : 0;
        ctx.fillStyle = k >= pk ? dn : up; ctx.globalAlpha = 0.8; ctx.fillRect(cx - AX / 2 - len, y, len, hgt); ctx.globalAlpha = 1;
        if (walls.has(k) && q > 0 && rowH >= 6) { ctx.fillStyle = ink; ctx.fillText(`${fmtQ(q)} ${S.coin}`, Math.max(4, cx - AX / 2 - len + 4), y + hgt / 2); }
      }
      if (pos && mxR) {
        const L = pos.long.get(k) || 0, Sh = pos.short.get(k) || 0, sc = (half - 4) / mxR, x0 = cx + AX / 2;
        if (S.view === "net") { const d = L - Sh; ctx.fillStyle = d >= 0 ? up : dn; ctx.globalAlpha = 0.85; ctx.fillRect(x0, y, Math.abs(d) * sc, hgt); }
        else {
          ctx.fillStyle = up; ctx.globalAlpha = k < pk ? 0.9 : 0.35; ctx.fillRect(x0, y, L * sc, hgt);
          ctx.fillStyle = dn; ctx.globalAlpha = k > pk ? 0.9 : 0.35; ctx.fillRect(x0 + L * sc, y, Sh * sc, hgt);
        }
        ctx.globalAlpha = 1;
      }
    }
    // trục giá giữa
    ctx.fillStyle = C("--panel-2") || "#151515"; ctx.fillRect(cx - AX / 2, top, AX, ph);
    ctx.fillStyle = muted; ctx.font = `11px ${MONO}`; ctx.textAlign = "center";
    const every = Math.max(1, Math.ceil(16 / rowH)), dec = step < 1 ? Math.min(6, Math.ceil(-Math.log10(step))) : 0;
    for (let k = hi; k >= lo; k -= every) ctx.fillText((k * step).toFixed(dec), cx, yOf(k) + rowH / 2);
    const yp = yOf(pk) + rowH / 2;
    ctx.strokeStyle = "#33ff66"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, yp); ctx.lineTo(W, yp); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = "#33ff66"; ctx.fillRect(cx - AX / 2, yp - 9, AX, 18); ctx.fillStyle = "#000"; ctx.font = `bold 12px ${MONO}`; ctx.fillText(price.toFixed(dec), cx, yp);
    // tiêu đề hai bên và nhãn góc
    ctx.font = `bold 12px ${MONO}`; ctx.fillStyle = C("--accent") || "#ff9f1c";
    const narrow = W < 760;
    ctx.fillText(diff ? (narrow ? "THÊM / RÚT" : `LỆNH CHỜ THÊM / RÚT so với ${new Date(D.base.t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`) : narrow ? "LỆNH CHỜ" : S.view === "diff" ? "LỆNH CHỜ TRÊN SÀN · Tăng–Giảm cần lần chụp kế tiếp (mỗi phút)" : "LỆNH CHỜ TRÊN SÀN", cx / 2, 12);
    ctx.fillText(narrow ? "VỊ THẾ ƯỚC TÍNH" : S.view === "net" ? "VỊ THẾ ƯỚC TÍNH: LONG − SHORT" : "VỊ THẾ ƯỚC TÍNH (giá vào lệnh)", cx + cx / 2, 12);
    if (!narrow) {
      ctx.font = `11px ${MONO}`; ctx.fillStyle = muted; ctx.globalAlpha = 0.8;
      ctx.textAlign = "left"; ctx.fillText(diff ? "xanh: lệnh mới đặt thêm · đỏ: lệnh bị rút" : "LỆNH CHỜ BÁN", 6, top + 10); if (!diff) ctx.fillText("LỆNH CHỜ MUA", 6, top + ph - 10);
      ctx.textAlign = "right"; ctx.fillText("LONG ĐANG LỖ · SHORT ĐANG LÃI", W - 6, top + 10); ctx.fillText("LONG ĐANG LÃI · SHORT ĐANG LỖ", W - 6, top + ph - 10);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = line; ctx.strokeRect(0.5, top - 0.5, W - 1, ph + 1);
    renderRatios(D);
  }

  function renderBar() {
    const bar = $("depthBar"); if (!bar) return;
    const chips = (list, cur, attr) => list.map(([v, n]) => `<button class="${String(v) === String(cur) ? "on" : ""}" data-${attr}="${v}">${n}</button>`).join("");
    bar.innerHTML = `<select id="depthCoin" class="tool">${DEPTH_COINS.map(c => `<option${c === S.coin ? " selected" : ""}>${c}</option>`).join("")}</select>` +
      `<span class="dpgrp"><span class="muted">Khoảng</span><span class="newstabs inl">${chips(DEPTH_PERIODS, S.period, "period")}</span></span>` +
      `<span class="dpgrp"><span class="muted">Giá ±</span><span class="newstabs inl">${chips(DEPTH_RANGES.map(r => [r, r + "%"]), S.range, "range")}</span></span>` +
      `<span class="dpgrp"><span class="muted">Xem</span><span class="newstabs inl">${chips(DEPTH_VIEWS, S.view, "view")}</span></span>`;
    const sl = $("depthSnap"), sn = S.snaps[S.at];
    if (sl) {
      sl.max = Math.max(0, S.snaps.length - 1); sl.value = Math.max(0, S.at);
      $("depthSnapInfo").textContent = sn ? `Lần chụp ${new Date(sn.t).toLocaleTimeString("vi-VN")} · ${S.at + 1}/${S.snaps.length} · tự chụp mỗi phút khi trang đang mở` : "";
    }
  }

  function renderRatios(D) {
    const el = $("depthRatios"); if (!el) return;
    const r = depthRatios(D.depth, D.pos, D.price, D.step, 2);
    const bar = (name, a, la, lb, ca, cb, tip) => a == null ? "" : `<div class="dprow" title="${esc(tip)}"><span class="dpn">${name}</span><div class="dpbar"><i style="width:${(a * 100).toFixed(1)}%;background:${ca}"><b>${la} ${pctTxt(a)}</b></i><i style="width:${(100 - a * 100).toFixed(1)}%;background:${cb}"><b>${pctTxt(1 - a)} ${lb}</b></i></div></div>`;
    const ls = S.ls || {};
    el.innerHTML = bar("Lệnh chờ mua / bán (±2%)", r.bid, "Mua", "Bán", "var(--buy)", "var(--sell)", `Tổng lệnh chờ mua ${fmtQ(r.bidQ)} ${S.coin}, chờ bán ${fmtQ(r.askQ)} ${S.coin} trong khoảng ±2% quanh giá`) +
      bar("Tài khoản long / short (Binance)", ls.acc, "Long", "Short", "var(--buy)", "var(--sell)", "Tỷ lệ tài khoản đang long trên Binance Futures, số công khai của sàn, 5 phút một lần") +
      bar("Vị thế top trader long / short", ls.top, "Long", "Short", "var(--buy)", "var(--sell)", "Tỷ lệ khối lượng vị thế long của nhóm tài khoản lớn nhất Binance Futures") +
      bar("Vị thế ước tính lãi / lỗ (±2%)", r.win, "Lãi", "Lỗ", "#4aa3ff", "#6b6b6b", "Ước tính từ khối lượng khớp chủ động theo giá vào lệnh trong khoảng thời gian đang chọn") +
      `<p class="note">Nguồn sổ lệnh: ${esc(D.depth.ok.join(", ") || "chưa có")}${D.depth.err.length ? ` · lỗi: ${esc(D.depth.err.join("; "))}` : ""}. Mỗi ô gom ${D.step} USD. Vị thế bên phải là ước tính, không phải dữ liệu thật của sàn.</p>`;
  }

  function renderSide() {
    const el = $("depthQuick"); if (!el || !S.quick) return;
    el.innerHTML = `<h4>Tâm lý nhanh <button class="q" data-g="market-depth">?</button></h4>` + S.quick.rows.map(([c, p]) => p == null ? "" : `<button class="dpq${c === S.coin ? " on" : ""}" data-coin="${c}"><span>${c}</span><span class="dpbar sm"><i style="width:${(p * 100).toFixed(0)}%;background:var(--buy)"><b>${Math.round(p * 100)}%</b></i><i style="width:${(100 - p * 100).toFixed(0)}%;background:var(--sell)"></i></span><small class="${p >= 0.7 ? "dn" : p <= 0.4 ? "up" : "muted"}">${p >= 0.7 ? "Đông long" : p <= 0.4 ? "Đông short" : ""}</small></button>`).join("") +
      `<p class="note">% tài khoản đang long trên Binance Futures. Khi đám đông dồn quá về một phía (trên 70% hay dưới 40%), giá hay đi ngược để quét họ.</p>`;
  }

  // rê chuột: số liệu của ô giá
  const tip = $("depthTip");
  cv.addEventListener("mousemove", e => {
    const L = S.layout; if (!L || !tip) return;
    const rc = cv.getBoundingClientRect(), y = e.clientY - rc.top, k = L.hi - Math.floor((y - L.top) / L.rowH);
    if (k < L.lo || k > L.hi) { tip.hidden = true; return; }
    const { depth, pos, diff, step } = L.D, p0 = k * step, dec = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
    const L1 = pos ? pos.long.get(k) || 0 : 0, S1 = pos ? pos.short.get(k) || 0 : 0;
    tip.innerHTML = `<b>${p0.toFixed(dec)} – ${(p0 + step).toFixed(dec)}</b><br>Chờ mua ${fmtQ(depth.bids.get(k) || 0)} · chờ bán ${fmtQ(depth.asks.get(k) || 0)} ${S.coin}` +
      (diff ? `<br>Thay đổi ${(diff.get(k) || 0) < 0 ? "−" : "+"}${fmtQ(Math.abs(diff.get(k) || 0))} ${S.coin}` : "") +
      (pos ? `<br>Long ước tính ${fmtQ(L1)} · short ${fmtQ(S1)} ${S.coin}` : "");
    tip.hidden = false; tip.style.left = Math.min(e.clientX + 14, innerWidth - 260) + "px"; tip.style.top = e.clientY + 14 + "px";
  });
  cv.addEventListener("mouseleave", () => { if (tip) tip.hidden = true; });

  document.addEventListener("click", e => {
    if (!S.visible) return;
    const b = e.target.closest("#depthBar [data-period], #depthBar [data-range], #depthBar [data-view], #depthQuick [data-coin]"); if (!b) return;
    if (b.dataset.period) { S.period = +b.dataset.period; save(); tick(true); return; }
    if (b.dataset.range) { S.range = +b.dataset.range; save(); render(); return; }
    if (b.dataset.view) { S.view = b.dataset.view; save(); render(); return; }
    if (b.dataset.coin) setCoin(b.dataset.coin);
  });
  document.addEventListener("change", e => { if (e.target.id === "depthCoin") setCoin(e.target.value); });
  function setCoin(c) { if (c === S.coin) return; S.coin = c; S.snaps = []; S.at = -1; S.pos = null; save(); render(); tick(true); renderSide(); }
  const sl = $("depthSnap"); if (sl) sl.oninput = () => { S.at = +sl.value; render(); };
  new ResizeObserver(() => { if (S.visible) render(); }).observe(cv.parentElement);

  return {
    show() { S.visible = true; render(); tick(!S.pos); if (!S.timer) S.timer = setInterval(() => { if (!document.hidden && S.visible) tick(false); }, 60e3); },
    hide() { S.visible = false; if (S.timer) { clearInterval(S.timer); S.timer = null; } },
  };
}
