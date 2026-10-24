// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: tab Quyền chọn, phần "Nguồn dữ liệu" (mỗi thành phần lấy từ đâu, trực tiếp hay trễ)
// và bảng chuỗi quyền chọn (depth view): call bên trái, put bên phải theo strike cho một hạn.
import { fmtUsd, fmtVol } from "./util.js?v=202610240629";
import { freshTag } from "./fresh.js?v=202610240629";
import { chainTable } from "./chain.js?v=202610240629";

const DAY = 864e5;
const dstr = t => { const d = new Date(t); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

// các thành phần dữ liệu của tab Quyền chọn theo loại tài sản
// t: hàm lấy thời điểm cập nhật từ trạng thái {chain, ex}
export function optSources(live, { chain, extraT, volName } = {}) {
  const ct = chain ? chain.updated || (chain.quoteTime ? Date.parse(chain.quoteTime) : null) : null;
  if (live) return [
    { what: "Chuỗi quyền chọn: OI, IV, giá mua/bán, khối lượng 24 giờ", src: "Deribit (API công khai)", kind: "live", t: ct, label: "Trực tiếp", every: "làm mới mỗi 1 đến 2 phút khi đang mở tab" },
    { what: "Lệnh quyền chọn đã khớp (dòng lệnh lớn, lệnh khối)", src: "Deribit (1.000 lệnh gần nhất)", kind: "live", t: extraT, label: "Trực tiếp", every: "mỗi 2 phút" },
    { what: `${volName || "DVOL"}: chỉ số biến động 30 ngày`, src: "Deribit", kind: "live", t: extraT, label: "Trực tiếp", every: "chuỗi theo ngày, điểm cuối là hiện tại" },
    { what: "Giá đóng cửa ngày (tính biến động thực tế)", src: "Binance Futures", kind: "live", t: extraT, label: "Trực tiếp", every: "nến ngày, bỏ nến đang chạy" },
    { what: "GEX, delta, max pain, biên độ dự kiến, cấu trúc kỳ hạn", src: "Tự tính trong trình duyệt từ chuỗi trên (Black-Scholes)", kind: "live", t: ct, label: "Theo chuỗi", every: "tính lại mỗi lần chuỗi đổi" },
  ];
  return [
    { what: "Chuỗi quyền chọn: OI, IV, giá mua/bán, khối lượng trong ngày", src: "CBOE delayed quotes (cdn.cboe.com)", kind: "delay", t: ct, label: "Trễ 15 phút", every: "bản web cập nhật mỗi 30 phút, bản laptop mỗi 15 phút; ngoài giờ Mỹ đứng yên", expect: 3 * 3600e3 },
    { what: `${volName || "Chỉ số biến động"} (VIX, VXN…)`, src: "Yahoo Finance (chỉ số CBOE)", kind: "eod", t: chain && chain.volIdx && chain.volIdx.t, label: "Cuối ngày", every: "chuỗi giá đóng cửa theo ngày" },
    { what: "Giá đóng cửa ngày của tài sản cơ sở", src: "Yahoo Finance / CBOE", kind: "eod", t: ct, label: "Cuối ngày", every: "60 phiên gần nhất" },
    { what: "Dòng lệnh khớp từng lệnh", src: "Không có nguồn miễn phí: thay bằng hợp đồng có khối lượng lớn trong ngày", kind: "delay", t: ct, label: "Trễ 15 phút", every: "theo chuỗi CBOE", expect: 3 * 3600e3 },
    { what: "GEX, delta, max pain, biên độ dự kiến, cấu trúc kỳ hạn", src: "Tự tính trong trình duyệt từ chuỗi CBOE (Black-Scholes)", kind: "delay", t: ct, label: "Theo chuỗi (trễ)", every: "tính lại mỗi lần chuỗi đổi", expect: 3 * 3600e3 },
  ];
}

export function initChain({ $, esc }) {
  let S = null, ei = null, n = 12, lastAsset = null;
  try { n = +JSON.parse(sessionStorage.getItem("lailong.chain") || "{}").n || 12; } catch { /* bỏ qua */ }

  function update(asset, chain, live, extra = {}) {
    if (asset !== lastAsset) { ei = null; lastAsset = asset; }
    S = { asset, chain, live, extra };
    render();
  }

  function renderSources() {
    const el = $("optSources"); if (!el || !S) return;
    const list = optSources(S.live, { chain: S.chain, extraT: S.extra.t, volName: S.extra.volName });
    el.innerHTML = `<table class="srctab"><thead><tr><th>Dữ liệu</th><th>Nguồn</th><th>Trạng thái</th><th>Nhịp cập nhật</th></tr></thead><tbody>` +
      list.map(x => `<tr><td class="t">${esc(x.what)}</td><td class="t">${esc(x.src)}</td><td>${freshTag(x.kind, x.t, { label: x.label, expect: x.expect, note: `${x.src}: ${x.every}` })}</td><td class="t muted">${esc(x.every)}</td></tr>`).join("") + `</tbody></table>`;
  }

  function render() {
    renderSources();
    const box = $("chainBody"), tabs = $("chainExps"); if (!box) return;
    if (!S || !S.chain || !S.chain.rows.length) { box.innerHTML = `<div class="empty">Đang tải chuỗi quyền chọn…</div>`; tabs.innerHTML = ""; return; }
    const ch = S.chain, now = Date.now(), live = S.live;
    const exps = ch.exps.map((t, i) => [t, i]).filter(([t]) => t > now).slice(0, 30);
    if (ei == null || !exps.some(x => x[1] === ei)) { const f = exps.find(([t]) => t - now > 0.5 * DAY) || exps[0]; ei = f ? f[1] : null; }
    tabs.innerHTML = exps.map(([t, i]) => `<button class="${i === ei ? "on" : ""}" data-ce="${i}">${dstr(t)} <small>${Math.max(0, Math.round((t - now) / DAY))}n</small></button>`).join("");
    $("chainFresh").innerHTML = freshTag(live ? "live" : "delay", ch.updated || (ch.quoteTime ? Date.parse(ch.quoteTime) : null), live
      ? { label: "Trực tiếp · Deribit", expect: 6 * 60e3, note: "Chuỗi quyền chọn lấy thẳng từ Deribit trong trình duyệt" }
      : { label: "Trễ 15 phút · CBOE", expect: 3 * 3600e3, note: "Chuỗi quyền chọn CBOE chậm 15 phút, bản web cập nhật mỗi 30 phút; ngoài giờ giao dịch Mỹ số liệu đứng yên" });
    const T = ei == null ? null : chainTable(ch, ei, { n, now });
    if (!T) { box.innerHTML = `<div class="empty">Không có hợp đồng nào cho hạn này.</div>`; return; }
    const S0 = T.spot, dp = S0 >= 1000 ? 0 : S0 >= 100 ? 1 : 2, kf = k => k.toLocaleString("en-US", { maximumFractionDigits: dp === 0 ? 0 : 2 });
    const px = v => v == null ? "–" : v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3);
    const iv = x => x ? (x.iv * 100).toFixed(1) : "–", dl = x => x ? x.delta.toFixed(2) : "–";
    const oiCell = (x, right) => {
      if (!x) return `<td></td>`;
      const w = Math.min(100, x.oi / T.maxOi * 100), hot = x.vol > x.oi;
      return `<td class="oi" data-tip="Hợp đồng mở ${fmtVol(x.oi)}${hot ? " · khối lượng hôm nay vượt OI: có người mở vị thế mới lớn" : ""}"><i class="${right ? "p" : "c"}" style="width:${w.toFixed(1)}%"></i><span>${hot ? "⚑ " : ""}${fmtVol(x.oi)}</span></td>`;
    };
    const mark = k => [k === T.callWall ? `<b class="cw" data-tip="Tường call của hạn này: strike có OI call lớn nhất">CW</b>` : "", k === T.putWall ? `<b class="pw" data-tip="Tường put của hạn này: strike có OI put lớn nhất">PW</b>` : "", k === T.maxPain ? `<b class="mp" data-tip="Max pain: mức giá làm người mua quyền chọn lỗ nhiều nhất lúc đáo hạn">MP</b>` : ""].join("");
    let spotDone = false;
    const rows = T.rows.map(e => {
      let pre = "";
      if (!spotDone && e.k >= S0) { spotDone = true; pre = `<tr class="spotrow"><td colspan="13">Giá ${kf(S0)}</td></tr>`; }
      const cItm = e.k < S0, pItm = e.k > S0;
      return pre + `<tr class="${e.k === T.atmK ? "atm" : ""}">` +
        oiCell(e.c, false) + `<td class="${cItm ? "itm" : ""}">${e.c ? fmtVol(e.c.vol) : ""}</td><td class="${cItm ? "itm" : ""}">${iv(e.c)}</td><td class="${cItm ? "itm" : ""}">${dl(e.c)}</td><td class="${cItm ? "itm" : ""} up">${px(e.c && e.c.bid)}</td><td class="${cItm ? "itm" : ""} dn">${px(e.c && e.c.ask)}</td>` +
        `<td class="k">${kf(e.k)} ${mark(e.k)}</td>` +
        `<td class="${pItm ? "itm" : ""} up">${px(e.p && e.p.bid)}</td><td class="${pItm ? "itm" : ""} dn">${px(e.p && e.p.ask)}</td><td class="${pItm ? "itm" : ""}">${dl(e.p)}</td><td class="${pItm ? "itm" : ""}">${iv(e.p)}</td><td class="${pItm ? "itm" : ""}">${e.p ? fmtVol(e.p.vol) : ""}</td>` + oiCell(e.p, true) + `</tr>`;
    }).join("") + (spotDone ? "" : `<tr class="spotrow"><td colspan="13">Giá ${kf(S0)}</td></tr>`);
    const unit = live ? `USD mỗi 1 ${esc(S.asset)}` : "USD mỗi cổ phiếu (1 hợp đồng = 100)";
    const old = box.querySelector(".chainwrap"), key = `${T.exp}|${n}`, keep = old && box.dataset.k === key ? old.scrollTop : null;
    box.dataset.k = key;
    box.innerHTML = `<div class="kpis chainkpis">` +
      [["Đáo hạn", `${dstr(T.exp)} · ${T.days.toFixed(T.days < 2 ? 1 : 0)} ngày`, "Deribit đáo hạn 08:00 UTC, CBOE khoảng 16:00 giờ New York"],
        ["Biên độ dự kiến", `±${kf(T.move)} <small>(±${T.movePct.toFixed(2)}%)</small>`, T.moveSrc === "straddle" ? "Theo giá straddle ATM (call + put tại strike sát giá): thị trường đang định giá giá đi khoảng chừng này tới ngày đáo hạn" : "Theo IV ATM × căn thời gian (không có giá mua/bán)"],
        ["Put/Call OI", T.pcrOi != null ? T.pcrOi.toFixed(2) : "–", "Tổng OI put chia OI call của hạn này. Trên 1 là nghiêng phòng hộ giảm"],
        ["Put/Call KL", T.pcrVol != null ? T.pcrVol.toFixed(2) : "–", live ? "Theo khối lượng 24 giờ" : "Theo khối lượng hôm nay"],
        ["Tường call / put", `${kf(T.callWall)} / ${kf(T.putWall)}`, "Strike có OI call / put lớn nhất của hạn này"],
        ["Max pain", T.maxPain != null ? kf(T.maxPain) : "–", "Gần đáo hạn giá hay bị hút về mức này"],
      ].map(([a, b, t]) => `<div data-tip="${esc(t)}"><small>${a}</small><b>${b}</b></div>`).join("") + `</div>` +
      `<div class="tablewrap chainwrap"><table class="chaintab"><thead><tr><th colspan="6" class="ch">CALL</th><th></th><th colspan="6" class="ph">PUT</th></tr>` +
      `<tr><th data-tip="Hợp đồng mở">OI</th><th data-tip="${live ? "Khối lượng 24 giờ" : "Khối lượng hôm nay"}">KL</th><th data-tip="Độ biến động ngụ ý (%)">IV</th><th data-tip="Delta Black-Scholes tính từ IV">Δ</th><th data-tip="Giá mua tốt nhất, ${unit}">Mua</th><th data-tip="Giá bán tốt nhất, ${unit}">Bán</th>` +
      `<th>Strike</th><th>Mua</th><th>Bán</th><th>Δ</th><th>IV</th><th>KL</th><th>OI</th></tr></thead><tbody>${rows}</tbody></table></div>` +
      `<p class="note">Vùng tô đậm là quyền chọn đang có lãi nội tại (ITM). ⚑: khối lượng vượt hợp đồng mở. Giá tính bằng ${unit}.${live ? "" : " Ngoài giờ giao dịch Mỹ giá mua/bán có thể bằng 0 và hiện là –."}</p>`;
    // Bảng cuộn trong khung: giữ vị trí người dùng đã cuộn, lần đầu đưa dòng giá về giữa.
    const wrap = box.querySelector(".chainwrap"), spot = wrap.querySelector(".spotrow");
    if (keep != null) wrap.scrollTop = keep;
    else if (spot) wrap.scrollTop = Math.max(0, spot.getBoundingClientRect().top - wrap.getBoundingClientRect().top - wrap.clientHeight / 2);
  }

  $("chainExps").onclick = e => { const b = e.target.closest("[data-ce]"); if (b) { ei = +b.dataset.ce; render(); } };
  const sel = $("chainN"); sel.value = String(n);
  sel.onchange = () => { n = +sel.value; try { sessionStorage.setItem("lailong.chain", JSON.stringify({ n })); } catch { /* bỏ qua */ } render(); };
  return { update };
}
