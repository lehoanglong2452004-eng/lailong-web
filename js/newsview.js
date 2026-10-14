// Lai Long Web: lịch kinh tế và tin crypto nóng.
// Bản web đọc data/calendar.json và data/news.json do GitHub Actions cập nhật mỗi 30 phút;
// bản trên laptop dùng cùng đường dẫn nhưng máy chủ lấy trực tiếp (xem lailong/terminal/news.py).
import { getJson, fmtTime, fmtDate } from "./util.js?v=202610142021";

const FLAG = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CNY: "🇨🇳", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭" };
const VI = [[/CPI/i, "lạm phát CPI"], [/PPI/i, "giá sản xuất PPI"], [/Non-Farm|NFP/i, "việc làm phi nông nghiệp"], [/Unemployment/i, "thất nghiệp"],
  [/FOMC|Federal Funds|Fed Chair|Powell/i, "Fed"], [/Retail Sales/i, "doanh số bán lẻ"], [/GDP/i, "GDP"], [/PCE/i, "chi tiêu PCE (Fed hay dùng)"],
  [/ISM|PMI/i, "chỉ số PMI"], [/Jobless Claims/i, "trợ cấp thất nghiệp"], [/JOLTS/i, "việc làm trống JOLTS"], [/Interest Rate|Rate Decision|Cash Rate/i, "quyết định lãi suất"]];
const viName = t => { const m = VI.find(([re]) => re.test(t)); return m ? m[1] : ""; };

export function initNews({ $, esc, alerts, coin }) {
  let cal = null, news = null, onlyCoin = false, seenHot = null; const firedEv = new Set();
  async function load() {
    const get = async u => { try { return await getJson(`${u}?t=${Math.floor(Date.now() / 60e3)}`); } catch { return null; } };
    const [c, n] = await Promise.all([get("data/calendar.json"), get("data/news.json")]);
    if (c) cal = c; if (n) news = n;
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
  function render() {
    const cb = $("calBody"), nb = $("newsBody"); if (!cb) return;
    const evs = upcoming(), hasAct = evs.some(e => e.actual);
    cb.innerHTML = !cal ? `<div class="empty">Chưa tải được lịch kinh tế.</div>` : !evs.length ? `<div class="empty">Không có sự kiện mạnh nào trong tuần này.</div>` :
      `<table><thead><tr><th>Lúc</th><th>Sự kiện</th><th>Dự báo</th><th>Kỳ trước</th>${hasAct ? "<th>Thực tế</th>" : ""}</tr></thead><tbody>` + evs.slice(0, 40).map(e => {
        const past = e.t < Date.now(), soon = !past && e.t - Date.now() < 3 * 3600e3;
        return `<tr class="${past ? "muted" : ""}${soon ? " evsoon" : ""}"><td>${fmtDate(e.t).slice(0, 16)}</td><td class="t"><span class="imp ${e.impact === "High" ? "hi" : "md"}"></span>${FLAG[e.country] || esc(e.country)} ${esc(e.title)}${viName(e.title) ? ` <small class="muted">${viName(e.title)}</small>` : ""}</td><td>${esc(e.forecast || "-")}</td><td>${esc(e.previous || "-")}</td>${hasAct ? `<td>${esc(e.actual || "-")}</td>` : ""}</tr>`;
      }).join("") + `</tbody></table>`;
    const c = coin(), items = news ? news.items.filter(x => !onlyCoin || x.coins.includes(c)) : [];
    $("newsOnly").textContent = onlyCoin ? `Chỉ tin về ${c}` : "Mọi tin";
    nb.innerHTML = !news ? `<div class="empty">Chưa tải được tin.</div>` : !items.length ? `<div class="empty">Không có tin nào về ${esc(c)} gần đây.</div>` :
      items.slice(0, 40).map(x => `<a class="newsit${x.hot ? " hot" : ""}" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer"><span class="nt">${fmtTime(x.t, true).slice(0, 11)} · ${esc(x.source)}${x.coins.length ? " · " + esc(x.coins.join(", ")) : ""}</span>${x.hot ? "🔥 " : ""}${esc(x.title)}</a>`).join("");
    $("newsUpd").textContent = [cal && `lịch cập nhật ${fmtTime(cal.updated)}`, news && `tin cập nhật ${fmtTime(news.updated)}`].filter(Boolean).join(" · ");
  }
  $("newsOnly").onclick = () => { onlyCoin = !onlyCoin; render(); };
  load(); setInterval(load, 5 * 60e3); setInterval(tick, 30e3);
  return { render, load };
}
