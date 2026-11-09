// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: COT của CFTC và tin, thông báo của CFTC, trong tab Phân tích (Vĩ mô và dòng tiền).
//   - COT (hằng tuần): nhóm quỹ (quỹ quản lý với hàng hoá, quỹ đòn bẩy với tài chính), tổ chức và nhỏ lẻ; chỉ số COT 3 năm;
//     bấm một dòng để xem vị thế 3 năm của cả 3 nhóm. Thiếu báo cáo chi tiết thì dùng đầu cơ lớn của báo cáo Legacy.
//   - Tin CFTC: thông cáo báo chí (tách xử phạt), phát biểu, và mốc công bố báo cáo COT.
// Bản web đọc cot.json, cftc.json (máy chủ GitHub, xem lailong/terminal/live.py); bản laptop lấy qua máy chủ (macro.py).
// readVol vẫn giữ cho bảng tóm tắt và kiểm thử; bảng VIX cũ đã chuyển thành kim tâm lý (sentimentview.js).
import { liveJson } from "./util.js?v=202611090459";
import { setFresh } from "./fresh.js?v=202611090459";
import { ivRank } from "./optpro.js?v=202611090459";
import { nyClock, vnWhen } from "./sessions.js?v=202611090459";
import { getLang } from "./lang.js?v=202611090459";

const cls = x => x == null ? "" : x >= 0 ? "up" : "dn";

// ---------- phần tính (kiểm thử được) ----------
// đọc cấu trúc kỳ hạn VIX: tỷ lệ VIX/VIX3M > 1 là đảo ngược (hoảng loạn ngắn hạn)
export function readVol(items) {
  const g = s => items.find(x => x.sym === s), v = g("VIX"), v3 = g("VIX3M"), v9 = g("VIX9D"), vv = g("VVIX"), sk = g("SKEW"), mv = g("MOVE");
  const out = [];
  if (v && v3 && v.last && v3.last) {
    const r = v.last / v3.last;
    out.push({ dir: r > 1 ? -1 : r < 0.85 ? 1 : 0, text: `VIX/VIX3M = ${r.toFixed(2)}: ${r > 1 ? "cấu trúc kỳ hạn đảo ngược, thị trường đang hoảng loạn ngắn hạn (thường gần đáy ngắn hạn của chứng khoán khi tỷ lệ này rất cao)." : r < 0.85 ? "contango sâu, thị trường rất bình thản; bảo hiểm rẻ." : "contango nhẹ, bình thường."}` });
  }
  if (v9 && v && v9.last && v.last && v9.last > v.last * 1.08) out.push({ dir: -1, text: `VIX 9 ngày ${v9.last.toFixed(1)} cao hơn VIX ${v.last.toFixed(1)}: thị trường lo một sự kiện trong vài ngày tới.` });
  if (v && v.series && v.series.length > 30) {
    const r = ivRank(v.series.map(x => x[1]), v.last);
    if (r) out.push({ dir: r.rank > 0.8 ? -1 : 0, text: `VIX ${v.last.toFixed(1)}: rank ${Math.round(r.rank * 100)}% trong 1 năm (thấp nhất ${r.lo.toFixed(1)}, cao nhất ${r.hi.toFixed(1)}). ${v.last >= 30 ? "Trên 30 là vùng sợ hãi." : v.last <= 14 ? "Dưới 14 là vùng chủ quan." : ""}`.trim() });
  }
  if (vv && vv.last) out.push({ dir: vv.last > 110 ? -1 : 0, text: `VVIX ${vv.last.toFixed(0)}: ${vv.last > 110 ? "nhu cầu mua bảo hiểm cho chính VIX cao, tổ chức đang phòng hộ cú sốc." : vv.last < 85 ? "thấp, không ai lo VIX bùng." : "bình thường."}` });
  if (sk && sk.last) out.push({ dir: sk.last > 145 ? -1 : 0, text: `SKEW ${sk.last.toFixed(0)}: ${sk.last > 145 ? "giá bảo hiểm sập mạnh (rủi ro đuôi) đang cao: tổ chức mua put xa giá." : "rủi ro đuôi định giá bình thường."}` });
  if (mv && mv.last) out.push({ dir: mv.last > 120 ? -1 : 0, text: `MOVE ${mv.last.toFixed(0)}: ${mv.last > 120 ? "trái phiếu Mỹ biến động mạnh, thường kéo theo USD và chứng khoán." : "trái phiếu yên ổn."}` });
  return out;
}

// COT: ghi chú cho từng hợp đồng theo chỉ số COT 3 năm của đầu cơ lớn
export function cotNote(x) {
  if (x.specIdx == null) return "";
  if (x.specIdx >= 90) return "Đầu cơ lớn long gần mức cao nhất 3 năm: đám đông đã chật, dễ đảo chiều khi có tin xấu";
  if (x.specIdx <= 10) return "Đầu cơ lớn short gần mức cao nhất 3 năm: dễ bị ép mua lại (short squeeze)";
  if (x.commIdx != null && x.commIdx >= 90) return "Bên phòng hộ (hàng thật) mua ròng nhiều nhất 3 năm: thường là vùng giá tốt";
  if (x.commIdx != null && x.commIdx <= 10) return "Bên phòng hộ bán ròng nhiều nhất 3 năm: họ coi giá đang cao";
  return "";
}

// mốc công bố báo cáo COT: thứ Sáu 15:30 giờ New York (sau ngày chốt thứ Ba 3 ngày); không tính ngày lễ
export function cotRelease(tue) {
  const fri = Date.parse(tue + "T00:00:00Z") + 3 * 864e5;
  for (const h of [19, 20]) { const t = fri + h * 36e5 + 30 * 60e3, c = nyClock(t); if (c.wd === 5 && c.min === 930) return t; }
  return fri + 20 * 36e5 + 30 * 60e3;
}
export function nextCotRelease(now = Date.now()) {
  for (let x = Math.ceil(now / 900e3) * 900e3; x < now + 8 * 864e5; x += 900e3) { const c = nyClock(x); if (c.wd === 5 && c.min === 930) return x; }
  return null;
}
// dòng COT dùng nhóm chi tiết khi có, không thì đầu cơ lớn của Legacy
export function cotView(x) {
  if (x.fund != null) return { who: x.who[0], net: x.fund, chg: x.fundChg, idx: x.fundIdx, pctOi: x.fundPctOi, hedge: x.rep === "dis" ? x.instIdx : null, hist: (x.h3 || []).map(r => r[1]) };
  return { who: "Đầu cơ lớn", net: x.spec, chg: x.specChg, idx: x.specIdx, pctOi: x.specPctOi, hedge: x.commIdx, hist: (x.hist || []).map(r => r[1]) };
}
export function cotRowNote(x) {
  const v = cotView(x), w = v.who;
  if (v.idx == null) return "";
  if (v.idx >= 90) return `${w} long gần mức cao nhất 3 năm: đám đông đã chật, dễ đảo chiều khi có tin xấu`;
  if (v.idx <= 10) return `${w} short gần mức cao nhất 3 năm: dễ bị ép mua lại (short squeeze)`;
  if (v.hedge != null && v.hedge >= 90) return "Bên phòng hộ (hàng thật) mua ròng nhiều nhất 3 năm: thường là vùng giá tốt";
  if (v.hedge != null && v.hedge <= 10) return "Bên phòng hộ bán ròng nhiều nhất 3 năm: họ coi giá đang cao";
  if (v.chg != null && v.net && Math.abs(v.chg) / Math.abs(v.net) > 0.15) return `${w} ${v.chg > 0 ? "tăng" : "giảm"} ròng mạnh trong tuần`;
  return "";
}
export const CFTC_CATS = { press: "Thông cáo", enforce: "Xử phạt", speech: "Phát biểu", report: "Báo cáo" };

export function initInst({ $, esc }) {
  let cot = null, news = null, timer = null, busy = false, cotGroup = "", open = "", cat = "";
  async function load() {
    if (busy) return; busy = true;
    try {
      const [c, n] = await Promise.all([liveJson("cot.json").catch(() => null), liveJson("cftc.json").catch(() => null)]);
      cot = c || cot; news = n || news;
    } finally { busy = false; }
    render();
  }
  function render() { renderCot(); renderNews(); }

  const n0 = v => v == null ? "–" : `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
  const ddmm = t => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const spark = (hs, W = 110, H = 22) => {
    const v = hs.slice(-52), lo = Math.min(...v), hi = Math.max(...v); if (v.length < 2 || !(hi > lo)) return "";
    const up = v[v.length - 1] >= v[0], pts = v.map((y, i) => `${(i / (v.length - 1) * W).toFixed(1)},${(H - 2 - (y - lo) / (hi - lo) * (H - 4)).toFixed(1)}`).join(" ");
    return `<svg width="${W}" height="${H}" class="spark"><polyline points="${pts}" fill="none" class="${up ? "su" : "sd"}" stroke-width="1.3"/></svg>`;
  };
  const bar = v => v == null ? "–" : `<span class="cotbar" data-tip="Chỉ số COT 3 năm: ${v.toFixed(0)} (0 = ngắn nhất, 100 = dài nhất trong 3 năm)"><i style="left:${v}%"></i></span> <b class="${v >= 90 || v <= 10 ? "warn" : ""}">${v.toFixed(0)}</b>`;
  // biểu đồ 3 năm của 3 nhóm (quỹ, tổ chức, nhỏ lẻ)
  function chart3(x) {
    const H3 = x.h3 && x.h3.length > 2 ? x.h3 : (x.hist || []).map(r => [r[0], r[1], r[2], null]);
    if (H3.length < 3) return `<div class="empty">Chưa đủ lịch sử.</div>`;
    const who = x.who || ["Đầu cơ lớn", "Bên phòng hộ", "Nhỏ lẻ"], W = 900, H = 200, P = 6;
    const all = H3.flatMap(r => [r[1], r[2], r[3]]).filter(v => v != null), lo = Math.min(0, ...all), hi = Math.max(0, ...all);
    const X = i => (P + i / (H3.length - 1) * (W - 2 * P)).toFixed(1), Y = v => (H - P - (v - lo) / (hi - lo || 1) * (H - 2 * P)).toFixed(1);
    const line = (k, c) => H3.some(r => r[k] != null) ? `<polyline points="${H3.map((r, i) => r[k] == null ? "" : `${X(i)},${Y(r[k])}`).join(" ")}" class="${c}" fill="none" vector-effect="non-scaling-stroke"/>` : "";
    const yr = H3.map((r, i) => [r[0].slice(0, 4), i]).filter((r, i, a) => i && r[0] !== a[i - 1][0]);
    return `<div class="cot3"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" class="ax"/>${yr.map(([, i]) => `<line x1="${X(i)}" x2="${X(i)}" y1="0" y2="${H}" class="gr"/>`).join("")}${line(1, "l1")}${line(2, "l2")}${line(3, "l3")}</svg>` +
      `<div class="fbx abs"><span style="left:0">${esc(H3[0][0].split("-").reverse().join("/"))}</span>${yr.map(([y, i]) => `<span class="mid" style="left:${(+X(i) / W * 100).toFixed(1)}%">${esc(y)}</span>`).join("")}<span style="right:0">${esc(H3[H3.length - 1][0].split("-").reverse().join("/"))}</span></div>` +
      `<p class="note"><b class="k1">━ ${esc(who[0])}</b> · <b class="k2">━ ${esc(who[1])}</b>${H3.some(r => r[3] != null) ? ` · <b class="k3">━ ${esc(who[2])}</b>` : ""} · vị thế ròng (long trừ short), số hợp đồng, ${H3.length} tuần. Cao nhất ${n0(hi)}, thấp nhất ${n0(lo)}</p></div>`;
  }

  function renderCot() {
    const el = $("instCot"); if (!el) return;
    if (!cot || !cot.items || !cot.items.length) { el.innerHTML = `<div class="empty">Chưa có dữ liệu COT. Bản web cần chờ lần cập nhật tự động kế tiếp; bản laptop cần khởi động lại máy chủ.</div>`; return; }
    const d = cot.items.reduce((a, x) => x.date > a ? x.date : a, ""), rel = cotRelease(d), nx = nextCotRelease();
    setFresh($("instCotFresh"), "weekly", rel, { label: `Báo cáo ${ddmm(rel)} (số liệu thứ Ba ${ddmm(Date.parse(d))})`, expect: 10 * 864e5, note: "CFTC chốt vị thế mỗi thứ Ba, công bố 15:30 thứ Sáu giờ New York. Tuần có ngày lễ Mỹ thì lùi lại" });
    $("instCotNext").textContent = nx ? `kỳ tới: ${vnWhen(nx)} ${ddmm(nx + 7 * 36e5)} giờ VN` : "";
    const groups = [...new Set(cot.items.map(x => x.group))];
    $("instCotTabs").innerHTML = [["", "Tất cả"], ...groups.map(g => [g, g])].map(([g, nm]) => `<button class="${g === cotGroup ? "on" : ""}" data-cg="${esc(g)}">${esc(nm)}</button>`).join("");
    const rows = cot.items.filter(x => !cotGroup || x.group === cotGroup);
    el.innerHTML = `<div class="tablewrap"><table class="mktab cottab"><thead><tr><th>Thị trường</th><th data-tip="Quỹ quản lý (báo cáo Disaggregated) với hàng hoá, quỹ đòn bẩy (báo cáo TFF) với tài chính; thiếu thì dùng đầu cơ lớn (Legacy)">Nhóm theo dõi</th><th>Vị thế ròng</th><th>Đổi trong tuần</th><th data-tip="Vị thế ròng so với tổng hợp đồng mở">% OI</th><th>Chỉ số COT 3 năm</th><th>52 tuần</th><th>Nhận xét</th></tr></thead><tbody>` +
      rows.map(x => { const v = cotView(x), note = cotRowNote(x), on = open === x.sym;
        return `<tr class="cotrow${on ? " on" : ""}" data-cs="${esc(x.sym)}"><td class="t"><b>${esc(x.name)}</b> <small class="muted">${esc(x.sym)}</small></td><td class="t muted">${esc(v.who)}</td><td class="${cls(v.net)}">${n0(v.net)}</td><td class="${cls(v.chg)}">${n0(v.chg)}</td><td>${v.pctOi != null ? v.pctOi.toFixed(1) + "%" : "–"}</td><td>${bar(v.idx)}</td><td>${spark(v.hist)}</td><td class="t ${v.idx >= 90 || v.idx <= 10 ? "warn" : "muted"}">${esc(note)}</td></tr>` +
          (on ? `<tr class="cotx"><td colspan="8">${chart3(x)}</td></tr>` : ""); }).join("") +
      `</tbody></table></div>`;
  }

  function renderNews() {
    const el = $("cftcBody"); if (!el) return;
    const items = [...((news && news.items) || [])];
    if (cot && cot.items && cot.items.length) {
      const d = cot.items.reduce((a, x) => x.date > a ? x.date : a, ""), t = cotRelease(d);
      items.push({ t, cat: "report", title: "Commitments of Traders weekly report released", vi: `Báo cáo COT tuần đã công bố (số liệu thứ Ba ${ddmm(Date.parse(d))})`, url: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm", exact: true });
    }
    items.sort((a, b) => b.t - a.t);
    $("cftcCats").innerHTML = [["", "Tất cả"], ...Object.entries(CFTC_CATS)].map(([k, nm]) => `<button class="${k === cat ? "on" : ""}" data-cc="${k}">${esc(nm)}</button>`).join("");
    if (news) setFresh($("cftcFresh"), "delay", news.updated, { label: "Lấy lại mỗi 30 phút", expect: 4 * 36e5, note: "Đọc trang danh sách thông cáo và phát biểu công khai của cftc.gov (CFTC tạm tắt RSS). Trang chỉ ghi ngày nên giờ hiện là ngày đăng" });
    const shown = items.filter(x => !cat || x.cat === cat).slice(0, 25), vi = getLang() === "vi";
    el.innerHTML = shown.length ? shown.map(x => `<a class="cfti" href="${esc(x.url)}" target="_blank" rel="noopener"><span class="muted">${x.exact ? `${ddmm(x.t + 7 * 36e5)} ${vnWhen(x.t, x.t)}` : ddmm(x.t)}</span><span class="cftc ${esc(x.cat)}">${esc(CFTC_CATS[x.cat] || x.cat)}</span><span>${esc(vi && x.vi ? x.vi : x.title)}<small>${vi && x.vi && x.vi !== x.title ? `${esc(x.title)} · ` : ""}cftc.gov</small></span></a>`).join("")
      : `<div class="empty">${news ? "Không có tin trong mục này." : "Chưa có tin CFTC. Bản web cần chờ lần cập nhật tự động kế tiếp."}</div>`;
    if (news && news.errors && news.errors.length) el.insertAdjacentHTML("beforeend", `<p class="muted small">Nguồn lỗi lần gần nhất: ${esc(news.errors.join("; "))}</p>`);
  }

  $("instCotTabs").onclick = e => { const b = e.target.closest("[data-cg]"); if (b) { cotGroup = b.dataset.cg; renderCot(); } };
  $("instCot").onclick = e => { const r = e.target.closest("[data-cs]"); if (r) { open = open === r.dataset.cs ? "" : r.dataset.cs; renderCot(); } };
  if (typeof document !== "undefined") document.addEventListener("lailong-lang", () => renderNews());
  $("cftcCats").onclick = e => { const b = e.target.closest("[data-cc]"); if (b) { cat = b.dataset.cc; renderNews(); } };
  return {
    show() { load(); clearInterval(timer); timer = setInterval(load, 600e3); },
    hide() { clearInterval(timer); timer = null; },
  };
}
