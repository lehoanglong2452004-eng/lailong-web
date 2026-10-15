// Lai Long Web: lịch kinh tế, tin tức 6 mục, bản đồ tác động và phản ứng giá sau tin.
// Bản web đọc data/calendar.json, data/news.json, data/reactions.json do GitHub Actions cập nhật mỗi 30 phút;
// bản trên laptop dùng cùng đường dẫn nhưng máy chủ lấy trực tiếp (xem lailong/terminal/news.py).
import { getJson, fmtTime, fmtDate } from "./util.js?v=202610152106";

const FLAG = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CNY: "🇨🇳", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭" };
const VI = [[/CPI/i, "lạm phát CPI"], [/PPI/i, "giá sản xuất PPI"], [/Non-Farm|NFP/i, "việc làm phi nông nghiệp"], [/Unemployment/i, "thất nghiệp"],
  [/FOMC|Federal Funds|Fed Chair|Powell/i, "Fed"], [/Retail Sales/i, "doanh số bán lẻ"], [/GDP/i, "GDP"], [/PCE/i, "chi tiêu PCE (Fed hay dùng)"],
  [/ISM|PMI/i, "chỉ số PMI"], [/Jobless Claims/i, "trợ cấp thất nghiệp"], [/JOLTS/i, "việc làm trống JOLTS"], [/Employment Change/i, "thay đổi việc làm"],
  [/Interest Rate|Rate Decision|Cash Rate|Rate Statement|Policy Rate/i, "quyết định lãi suất"]];
const viName = t => { const m = VI.find(([re]) => re.test(t)); return m ? m[1] : ""; };

export const CATS = [
  { id: "econ", name: "Kinh tế", icon: "🏛" }, { id: "fin", name: "Tài chính", icon: "💹" }, { id: "metal", name: "Kim loại quý", icon: "🥇" },
  { id: "energy", name: "Năng lượng", icon: "🛢" }, { id: "geo", name: "Địa chính trị", icon: "🌍" }, { id: "crypto", name: "Crypto", icon: "₿" },
];
// cách đọc từng chủ đề: phản ứng thường thấy, không phải lúc nào cũng đúng
const HOWTO = {
  fed: "Fed nghiêng về giữ lãi suất cao (diều hâu): USD và lợi suất tăng; vàng, chứng khoán, BTC thường giảm. Nghiêng về giảm lãi suất (bồ câu) thì ngược lại.",
  cb: "Ngân hàng trung ương nước nào tăng lãi suất hoặc nói cứng rắn thì đồng tiền nước đó thường mạnh lên.",
  infl: "Lạm phát cao hơn dự báo: thị trường lo Fed giữ lãi suất cao, USD và lợi suất tăng, vàng và BTC thường giảm ngay sau tin. Thấp hơn dự báo thì ngược lại.",
  jobs: "Việc làm mạnh hơn dự báo: kinh tế khoẻ, ít lý do giảm lãi suất, USD tăng. Yếu hơn dự báo: USD giảm, vàng tăng.",
  growth: "Tăng trưởng mạnh hỗ trợ chứng khoán và đồng tiền nước đó; yếu quá thì lo suy thoái, tiền chạy sang trái phiếu, vàng, JPY, CHF.",
  trade: "Thuế quan và căng thẳng thương mại thường làm CNY, AUD, đồng và chứng khoán giảm; vàng và USD được tìm đến như nơi trú ẩn.",
  usd: "USD mạnh thường làm vàng, hàng hoá và crypto giảm vì chúng được định giá bằng USD.",
  bonds: "Lợi suất tăng làm vàng (không trả lãi) và cổ phiếu công nghệ kém hấp dẫn hơn; USD thường mạnh theo.",
  stocks: "Chứng khoán Mỹ và BTC thường chạy cùng chiều khi thị trường ưa rủi ro hoặc sợ rủi ro.",
  banks: "Lo ngại ngân hàng, tín dụng: tiền chạy vào trái phiếu và vàng; lãi suất kỳ vọng giảm.",
  gold: "Vàng tăng khi USD và lợi suất thực giảm, hoặc khi có bất ổn địa chính trị.",
  silver: "Bạc và bạch kim đi theo vàng nhưng biến động mạnh hơn, và còn phụ thuộc nhu cầu công nghiệp.",
  copper: "Đồng là thước đo sức khoẻ kinh tế toàn cầu, nhất là Trung Quốc; đồng tăng thường đi cùng AUD tăng.",
  oil: "Dầu tăng đẩy lạm phát kỳ vọng và lợi suất lên; CAD và NOK thường mạnh theo dầu.",
  opec: "OPEC+ cắt sản lượng thì dầu tăng; tăng sản lượng thì dầu giảm.",
  gas: "Khí đốt tăng mạnh gây áp lực lạm phát châu Âu và làm EUR yếu.",
  mideast: "Căng thẳng Trung Đông, nhất là quanh eo biển Hormuz: dầu và vàng tăng, chứng khoán và crypto thường giảm trong ngắn hạn.",
  ruukr: "Leo thang Nga – Ukraine: khí đốt châu Âu, lúa mì, vàng tăng; EUR yếu.",
  china: "Tin xấu về Trung Quốc làm AUD, đồng, quặng sắt giảm; kích thích kinh tế thì ngược lại.",
  politics: "Bất ổn chính trị Mỹ (đóng cửa chính phủ, bầu cử) làm biến động tăng; vàng thường được lợi.",
  btc: "Tin về BTC ảnh hưởng toàn thị trường crypto; altcoin thường biến động mạnh hơn BTC.",
  eth: "Tin về ETH ảnh hưởng mạnh tới DeFi và các mạng lớp 2.",
  etf: "Dòng tiền ETF và các công ty mua BTC/ETH là lực mua thật của tổ chức; dòng tiền rút ra liên tục là dấu hiệu yếu.",
  reg: "Tin pháp lý tích cực (ETF được duyệt, luật rõ ràng) đẩy giá lên; kiện tụng hoặc cấm đoán thì ngược lại.",
  hack: "Hack và sự cố làm coin liên quan giảm mạnh; nếu là sàn lớn có thể kéo cả thị trường.",
};
// loại tin trong lịch kinh tế thuộc chủ đề nào (để nối phản ứng giá vào bản đồ)
const EV_TOPIC = [[/CPI|PPI|PCE|Inflation/i, "infl"], [/Non-Farm|Employment|Unemployment|Jobless|JOLTS|Payroll|Claimant/i, "jobs"],
  [/FOMC|Federal Funds|Fed Chair|Powell/i, "fed"], [/Rate Decision|Cash Rate|Rate Statement|Policy Rate|Interest Rate|Monetary Policy/i, "cb"],
  [/GDP|PMI|ISM|Retail Sales|Industrial/i, "growth"]];
const evTopic = t => { const m = EV_TOPIC.find(([re]) => re.test(t)); return m ? m[1] : null; };

const DAY = 864e5;
const sign = v => v > 0 ? "up" : v < 0 ? "dn" : "";
const pct = (v, bp) => v == null ? "–" : `${v > 0 ? "+" : ""}${bp ? v.toFixed(1) + "bp" : v.toFixed(2) + "%"}`;

// điểm nóng của từng chủ đề trong 24 giờ: tin nóng tính gấp đôi, tin càng cũ càng nhẹ
export function topicHeat(items, topics, now = Date.now()) {
  const out = Object.fromEntries(topics.map(t => [t.id, { ...t, n: 0, heat: 0, items: [] }]));
  for (const x of items) {
    const age = now - x.t; if (age > DAY || age < -3600e3) continue;
    const w = (x.hot ? 2 : 1) * Math.exp(-Math.max(0, age) / (12 * 3600e3));
    for (const id of x.topics || []) if (out[id]) { out[id].n++; out[id].heat += w; out[id].items.push(x); }
  }
  return Object.values(out).filter(t => t.n > 0).sort((a, b) => b.heat - a.heat);
}

// phản ứng trung bình theo loại tin (cùng tên, cùng nước), chỉ tính các lần đã có đủ 60 phút
export function avgReaction(events, assets) {
  const g = {};
  for (const e of events) {
    const k = e.country + "|" + e.title, x = g[k] || (g[k] = { country: e.country, title: e.title, n: 0, sum: {}, cnt: {} });
    x.n++;
    for (const a of assets) { const v = e.moves[a] && e.moves[a]["60"]; if (v != null) { x.sum[a] = (x.sum[a] || 0) + Math.abs(v); x.cnt[a] = (x.cnt[a] || 0) + 1; } }
  }
  return Object.values(g).filter(x => x.n >= 2).map(x => ({ ...x, avg: Object.fromEntries(assets.map(a => [a, x.cnt[a] ? x.sum[a] / x.cnt[a] : null])) }));
}

export function initNews({ $, esc, alerts, coin }) {
  let cal = null, news = null, react = null, onlyCoin = false, cat = "", seenHot = null, sel = null; const firedEv = new Set();
  try { cat = localStorage.getItem("lailong.newscat") || ""; } catch { /* bỏ qua */ }
  async function load() {
    const get = async u => { try { return await getJson(`${u}?t=${Math.floor(Date.now() / 60e3)}`); } catch { return null; } };
    const [c, n, r] = await Promise.all([get("data/calendar.json"), get("data/news.json"), get("data/reactions.json")]);
    if (c) cal = c; if (n) news = n; if (r) react = r;
    if (news && alerts.cfg.newsHot) {
      const hot = news.items.filter(x => x.hot && Date.now() - x.t < 3 * 3600e3);
      if (seenHot) for (const x of hot) if (!seenHot.has(x.link)) alerts.fire("newsHot", `Tin nóng (${x.source}): ${x.title}`, "price");
      seenHot = new Set(hot.map(x => x.link));
    } else if (news) seenHot = new Set(news.items.map(x => x.link));
    render(); tick();
  }
  const upcoming = () => cal ? cal.events.filter(e => e.t > Date.now() - 2 * 3600e3) : [];
  // thanh nhắc trên menu: sự kiện mạnh tiếp theo trong 3 giờ tới
  function tick() {
    const pill = $("evPill"), now = Date.now();
    const next = cal && cal.events.find(e => e.impact === "High" && e.t > now - 5 * 60e3);
    if (!next || next.t - now > 3 * 3600e3) { pill.hidden = true; return; }
    const min = Math.round((next.t - now) / 60e3);
    pill.hidden = false; pill.className = "pill evpill" + (min <= 30 ? " hot" : "");
    pill.innerHTML = `⚠ <span>${esc(next.country)} ${esc(next.title)} ${min > 0 ? `sau ${min >= 60 ? Math.floor(min / 60) + " giờ " : ""}${min % 60} phút` : "đang ra tin"}</span>`;
    pill.dataset.tip = `${FLAG[next.country] || ""} ${next.title}${viName(next.title) ? ` (${viName(next.title)})` : ""} lúc ${fmtTime(next.t)}. Dự báo ${next.forecast || "-"}, kỳ trước ${next.previous || "-"}. Quanh giờ ra tin giá thường giật mạnh hai chiều, chênh lệch giá mua bán giãn ra: nên đứng ngoài hoặc giảm khối lượng.`;
    if (alerts.cfg.newsEv && min <= 15 && min >= 0 && !firedEv.has(next.t + next.title) && firedEv.add(next.t + next.title)) alerts.fire("ev" + next.t + next.title, `Còn ${min} phút nữa ra tin ${next.country} ${next.title}${viName(next.title) ? ` (${viName(next.title)})` : ""}. Cân nhắc đứng ngoài.`, "price");
  }

  const newsRow = x => `<a class="newsit${x.hot ? " hot" : ""}" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer"><span class="nt">${fmtTime(x.t, true).slice(0, 11)} · ${esc(x.source)}${x.cat && !cat ? " · " + esc((CATS.find(c => c.id === x.cat) || {}).name || "") : ""}${x.coins && x.coins.length ? " · " + esc(x.coins.join(", ")) : ""}</span>${x.hot ? "🔥 " : ""}${esc(x.title)}</a>`;

  function renderCal() {
    const cb = $("calBody"); if (!cb) return;
    const evs = upcoming(), hasAct = evs.some(e => e.actual);
    cb.innerHTML = !cal ? `<div class="empty">Chưa tải được lịch kinh tế.</div>` : !evs.length ? `<div class="empty">Không có sự kiện mạnh nào trong tuần này.</div>` :
      `<table><thead><tr><th>Lúc</th><th>Sự kiện</th><th>Dự báo</th><th>Kỳ trước</th>${hasAct ? "<th>Thực tế</th>" : ""}</tr></thead><tbody>` + evs.slice(0, 60).map(e => {
        const past = e.t < Date.now(), soon = !past && e.t - Date.now() < 3 * 3600e3;
        return `<tr class="${past ? "muted" : ""}${soon ? " evsoon" : ""}"><td>${fmtDate(e.t).slice(0, 16)}</td><td class="t"><span class="imp ${e.impact === "High" ? "hi" : "md"}"></span>${FLAG[e.country] || esc(e.country)} ${esc(e.title)}${viName(e.title) ? ` <small class="muted">${viName(e.title)}</small>` : ""}</td><td>${esc(e.forecast || "-")}</td><td>${esc(e.previous || "-")}</td>${hasAct ? `<td>${esc(e.actual || "-")}</td>` : ""}</tr>`;
      }).join("") + `</tbody></table>`;
  }

  function renderNews() {
    const nb = $("newsBody"); if (!nb) return;
    const c = coin(), counts = {};
    if (news) for (const x of news.items) counts[x.cat || "crypto"] = (counts[x.cat || "crypto"] || 0) + 1;
    $("newsTabs").innerHTML = [{ id: "", name: "Tất cả", icon: "" }, ...CATS].map(k => `<button class="${k.id === cat ? "on" : ""}" data-cat="${k.id}">${k.icon ? k.icon + " " : ""}${k.name}${k.id && counts[k.id] ? ` <small>${counts[k.id]}</small>` : ""}</button>`).join("");
    $("newsOnly").hidden = cat !== "crypto";
    $("newsOnly").textContent = onlyCoin ? `Chỉ tin về ${c}` : "Mọi coin";
    const items = news ? news.items.filter(x => (!cat || (x.cat || "crypto") === cat) && (cat !== "crypto" || !onlyCoin || (x.coins || []).includes(c))) : [];
    nb.innerHTML = !news ? `<div class="empty">Chưa tải được tin.</div>` : !items.length ? `<div class="empty">Không có tin nào trong mục này.</div>` : items.slice(0, 60).map(newsRow).join("");
    $("newsUpd").textContent = [cal && `lịch ${fmtTime(cal.updated)}`, news && `tin ${fmtTime(news.updated)}`].filter(Boolean).join(" · ");
  }

  // bản đồ tác động: mỗi ô là một chủ đề, ô càng đỏ càng nóng, ô to là 3 chủ đề nóng nhất
  function renderMap() {
    const mb = $("impactMap"); if (!mb) return;
    if (!news || !news.topics) { mb.innerHTML = `<div class="empty">Chưa tải được tin.</div>`; return; }
    const hs = topicHeat(news.items, news.topics), max = hs.length ? hs[0].heat : 1;
    const byCat = CATS.map(c => ({ ...c, ts: hs.filter(t => t.cat === c.id) }));
    mb.innerHTML = byCat.map(c => `<div class="imcol"><div class="imh">${c.icon} ${c.name}</div>${c.ts.length ? c.ts.map(t => {
      const k = t.heat / max, rank = hs.indexOf(t);
      return `<button class="imtile${rank < 3 ? " big" : ""}${sel === t.id ? " sel" : ""}" data-topic="${t.id}" style="--h:${k.toFixed(2)}"><span class="ic">${t.icon}</span><span class="nm">${esc(t.name)}</span><span class="ct">${t.n} tin${t.items.some(x => x.hot) ? " · 🔥" : ""}</span></button>`;
    }).join("") : `<div class="imnone">Yên ắng</div>`}</div>`).join("");
    $("impactUpd").textContent = `24 giờ qua · ${news.items.filter(x => Date.now() - x.t < DAY).length} tin · cập nhật ${fmtTime(news.updated)}`;
    renderDetail(hs);
  }

  function renderDetail(hs) {
    const db = $("impactDetail"); if (!db) return;
    const t = hs && hs.find(x => x.id === sel);
    if (!t) { db.innerHTML = `<div class="hint">Rê chuột lên một ô để xem nhanh, bấm vào ô để xem đầy đủ tin, cách đọc và giá đã phản ứng thế nào.</div>`; return; }
    const evs = react ? react.events.filter(e => evTopic(e.title) === t.id).slice(0, 6) : [];
    db.innerHTML = `<div class="imdh"><span class="ic">${t.icon}</span><b>${esc(t.name)}</b><span class="muted">${t.n} tin trong 24 giờ</span><button class="icon" data-topic="">✕</button></div>
      <div class="imdg"><div><div class="mh">Hay ảnh hưởng tới</div><p>${esc(t.assets)}</p><div class="mh">Cách đọc</div><p>${esc(HOWTO[t.id] || "")}</p>
      ${evs.length ? `<div class="mh">Giá đã phản ứng sau các tin gần đây (60 phút)</div>${reactTable(evs, [60])}` : ""}</div>
      <div class="imdn">${t.items.slice(0, 20).map(newsRow).join("")}</div></div>`;
  }

  // các tin ra cùng một lúc (CPI m/m, CPI y/y, Core CPI...) gộp thành một dòng vì giá chỉ phản ứng một lần
  function groupSameTime(evs) {
    const out = [];
    for (const e of evs) {
      const g = out.find(x => x.t === e.t && x.country === e.country);
      if (g) g.list.push(e); else out.push({ ...e, list: [e] });
    }
    return out;
  }
  function reactTable(evs, hz) {
    const as = react.assets;
    evs = groupSameTime(evs);
    return `<div class="tablewrap"><table class="rtab"><thead><tr><th>Lúc</th><th>Tin</th><th>Thực tế / Dự báo</th>${as.map(a => `<th colspan="${hz.length}">${esc(a)}</th>`).join("")}</tr>
      ${hz.length > 1 ? `<tr><th></th><th></th><th></th>${as.map(() => hz.map(h => `<th class="sub">${h}′</th>`).join("")).join("")}</tr>` : ""}</thead><tbody>` +
      evs.map(e => `<tr><td>${fmtDate(e.t).slice(0, 5)} ${fmtDate(e.t).slice(11, 16)}</td><td class="t">${FLAG[e.country] || esc(e.country)} ${e.list.map(x => esc(x.title)).join(", ")}${viName(e.title) ? ` <small class="muted">${viName(e.title)}</small>` : ""}</td>
        <td>${e.list.map(x => `${esc(x.actual || "–")} / ${esc(x.forecast || "–")}${x.surprise ? ` <span class="${x.surprise > 0 ? "up" : "dn"}">${x.surprise > 0 ? "▲" : "▼"}</span>` : ""}`).join("<br>")}</td>
        ${as.map(a => hz.map(h => { const v = e.moves[a] && e.moves[a][String(h)]; return `<td class="${sign(v)}">${pct(v, a.startsWith("Lợi suất"))}</td>`; }).join("")).join("")}</tr>`).join("") + `</tbody></table></div>`;
  }

  function renderReact() {
    const rb = $("reactBody"); if (!rb) return;
    if (!react) { rb.innerHTML = `<div class="empty">Chưa tải được dữ liệu phản ứng giá.</div>`; return; }
    const evs = react.events.filter(e => Object.keys(e.moves).length);
    const avg = avgReaction(react.events, react.assets);
    rb.innerHTML = !evs.length ? `<div class="empty">Chưa có tin mạnh nào ra trong 5 ngày qua.</div>` : reactTable(evs.slice(0, 40), [15, 60]) +
      (avg.length ? `<div class="mh" style="margin-top:10px">Mức chạy trung bình 60 phút sau tin (giá trị tuyệt đối, từ ${avg.reduce((a, x) => a + x.n, 0)} lần ra tin đã lưu)</div>
      <div class="tablewrap"><table class="rtab"><thead><tr><th>Tin</th><th>Số lần</th>${react.assets.map(a => `<th>${esc(a)}</th>`).join("")}</tr></thead><tbody>` +
      avg.sort((a, b) => (b.avg.DXY || 0) - (a.avg.DXY || 0)).map(x => `<tr><td class="t">${FLAG[x.country] || esc(x.country)} ${esc(x.title)}</td><td>${x.n}</td>${react.assets.map(a => `<td>${x.avg[a] == null ? "–" : (a.startsWith("Lợi suất") ? x.avg[a].toFixed(1) + "bp" : x.avg[a].toFixed(2) + "%")}</td>`).join("")}</tr>`).join("") + `</tbody></table></div>` : "");
  }

  function render() { renderCal(); renderNews(); renderMap(); renderReact(); }

  // xem nhanh khi rê chuột lên ô
  const pop = document.createElement("div"); pop.className = "impop"; pop.hidden = true; document.body.appendChild(pop);
  const mapEl = $("impactMap");
  if (mapEl) {
    mapEl.addEventListener("mousemove", e => {
      const b = e.target.closest("[data-topic]");
      if (!b || !news) { pop.hidden = true; return; }
      const t = topicHeat(news.items, news.topics).find(x => x.id === b.dataset.topic); if (!t) return;
      pop.innerHTML = `<b>${t.icon} ${esc(t.name)}</b><div class="muted">Hay ảnh hưởng: ${esc(t.assets)}</div>` + t.items.slice(0, 4).map(x => `<div class="pi">${x.hot ? "🔥 " : ""}${esc(x.title)} <span class="muted">· ${esc(x.source)}, ${fmtTime(x.t)}</span></div>`).join("") + `<div class="muted">Bấm để xem đầy đủ</div>`;
      pop.hidden = false;
      const w = 380, x = Math.min(e.clientX + 14, innerWidth - w - 8), y = Math.min(e.clientY + 14, innerHeight - pop.offsetHeight - 8);
      Object.assign(pop.style, { left: x + "px", top: y + "px", width: w + "px" });
    });
    mapEl.addEventListener("mouseleave", () => { pop.hidden = true; });
    document.addEventListener("click", e => {
      const b = e.target.closest("#impactMap [data-topic], #impactDetail [data-topic]"); if (!b) return;
      sel = b.dataset.topic && b.dataset.topic !== sel ? b.dataset.topic : null; pop.hidden = true; renderMap();
      if (sel) $("impactDetail").scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
  $("newsTabs").onclick = e => { const b = e.target.closest("[data-cat]"); if (!b) return; cat = b.dataset.cat; try { localStorage.setItem("lailong.newscat", cat); } catch { /* bỏ qua */ } renderNews(); };
  $("newsOnly").onclick = () => { onlyCoin = !onlyCoin; renderNews(); };
  load(); setInterval(load, 5 * 60e3); setInterval(tick, 30e3);
  return { render, load };
}
