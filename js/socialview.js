// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Mục Mạng xã hội trong tab Tin tức: chuyên gia, nhà đầu tư, trader, tổ chức lớn đang nói gì về thị trường.
// Dữ liệu: social.json (lailong/terminal/social.py), trên web đọc nhánh live như tin tức, bản laptop do máy chủ lấy.
// Nghiêng tích cực / tiêu cực chấm tự động theo từ khoá nên chỉ để xem xu hướng chung, có thể sai từng bài.
// Không bao giờ hiện tác giả, tổ chức hay nội dung Việt Nam (lọc ở máy chủ và lọc lại ở đây bằng isVN).

import { liveJson } from "./util.js?v=202611141528";
import { setFresh } from "./fresh.js?v=202611141528";
import { bi } from "./lang.js?v=202611141528";
import { isVN } from "./newsdigest.js?v=202611141528";

export const GROUP_ICON = { inst: "🏦", macro: "📊", fund: "💼", trader: "📈", crypto: "₿", cb: "🏛", media: "🎙", quoted: "📰" };
export const TOPICS = [["", "Tất cả"], ["macro", "Vĩ mô"], ["stocks", "Chứng khoán"], ["fx", "Forex"], ["comm", "Hàng hoá"], ["crypto", "Crypto"], ["bonds", "Trái phiếu"]];
const TOPIC_KEYS = { comm: ["gold", "energy", "commodities"] };
const PF = { bsky: ["Bluesky", "bs"], rss: ["Bài viết", "ss"], yt: ["YouTube", "yt"], news: ["Báo trích dẫn", "nw"] };
export const LEAN_NAME = { stocks: "chứng khoán", fx: "USD", gold: "vàng", energy: "dầu", crypto: "crypto" };

export function ago(t, now = Date.now()) {
  const m = Math.max(0, Math.round((now - t) / 60e3));
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} giờ trước` : `${Math.round(h / 24)} ngày trước`;
}

// thị trường của một bài: thị trường người đó hay nói tới cộng thị trường được nhắc trong bài
export function postMarkets(p, src) {
  return new Set([...((src && src.markets) || []), ...Object.keys(p.lean || {})]);
}

export function filterPosts(data, { group = "", topic = "", who = "" } = {}) {
  if (!data) return [];
  const by = new Map((data.sources || []).map(s => [s.id, s]));
  const keys = topic ? TOPIC_KEYS[topic] || [topic] : null;
  return (data.posts || []).filter(p => {
    const s = by.get(p.who);
    if (!s || isVN({ source: s.name, title: `${p.head || ""} ${p.text || ""}`, link: p.link })) return false;
    if (who) return p.who === who;
    if (group && s.group !== group) return false;
    if (keys) { const mk = postMarkets(p, s); if (!keys.some(k => mk.has(k))) return false; }
    return true;
  });
}

// nhãn nghiêng của một bài, gộp các thị trường cùng chiều: [{cls, text}]
export function leanText(lean) {
  const up = [], dn = [];
  for (const [k, v] of Object.entries(lean || {})) (v > 0 ? up : dn).push(LEAN_NAME[k] || k);
  const out = [];
  if (up.length) out.push({ cls: "bull", text: `▲ Tích cực với ${up.join(", ")}` });
  if (dn.length) out.push({ cls: "bear", text: `▼ Tiêu cực với ${dn.join(", ")}` });
  return out;
}

const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const gaugeCls = v => v < 25 ? "dn" : v < 45 ? "md" : v <= 55 ? "" : "up";
const GAUGE_VI = { "extreme fear": "Cực kỳ sợ hãi", fear: "Sợ hãi", neutral: "Trung lập", greed: "Tham lam", "extreme greed": "Cực kỳ tham lam" };

export function initSocial({ $, esc }) {
  let data = null, group = "", topic = "", who = "";
  try { topic = sessionStorage.getItem("lailong.soctopic") || ""; } catch { /* bỏ qua */ }

  async function load() {
    const d = await liveJson("social.json").catch(() => null);
    if (d && Array.isArray(d.posts)) { data = d; render(); }
    else if (!data) render();
  }

  function renderSide() {
    const el = $("socWho"); if (!el) return;
    if (!data) { el.innerHTML = ""; return; }
    const srcs = (data.sources || []).filter(s => !isVN({ source: s.name }));
    const n = g => filterPosts(data, { group: g, topic }).length;
    const groups = Object.entries(data.groups || {});
    let h = `<div class="sochd">Người theo dõi (${srcs.length})</div>` +
      `<button class="socg${!group && !who ? " on" : ""}" data-group=""><span>Tất cả</span><small>${n("")}</small></button>` +
      groups.map(([id, nm]) => `<button class="socg${group === id && !who ? " on" : ""}" data-group="${id}"><span>${GROUP_ICON[id] || ""} ${esc(nm)}</span><small>${n(id)}</small></button>`).join("");
    // người đang đăng lên trước, im lặng lâu hay lỗi xuống cuối: danh sách tự "đổi người" khi ai đó ngừng đăng
    const rank = s => !s.ok ? 2 : s.stale ? 1 : 0;
    const list = srcs.filter(s => !group || s.group === group).sort((a, b) => rank(a) - rank(b) || (b.last || 0) - (a.last || 0));
    h += `<div class="sochd">${group ? esc(data.groups[group] || "") : "Tất cả nguồn"}</div>` + list.map(s => {
      const st = !s.ok ? ["err", `Lỗi: ${s.err}`] : s.stale ? ["stale", "Im lặng quá 30 ngày, nên cân nhắc bỏ"] : ["ok", (s.last ? `Bài mới nhất ${ago(s.last)}` : "Chưa có bài") + (s.via ? `, lấy qua ${s.via} (chỉ có tiêu đề)` : "")];
      return `<button class="socp${who === s.id ? " on" : ""}" data-who="${s.id}" title="${esc(s.role)} · ${esc(st[1])}"><i class="sdot ${st[0]}"></i><span>${esc(s.name)}</span><b class="tier t${s.tier}" title="${esc((data.tiers || {})[s.tier] || "")}">${s.tier}</b></button>`;
    }).join("");
    h += `<div class="sochd">Bậc tin cậy</div><div class="soctiers">${Object.entries(data.tiers || {}).map(([k, v]) => `<div><b class="tier t${k}">${k}</b> ${esc(v)}</div>`).join("")}</div>`;
    el.innerHTML = h;
  }

  function postHtml(p, src, now) {
    const [pf, pc] = PF[p.platform] || [p.platform, ""];
    const head = p.head ? `<a class="sochead" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${p.platform === "yt" ? "▶ " : ""}${bi(p.head, p.vi_head, esc)}</a>` : "";
    const short = (p.text || "").length > 320 ? p.text.slice(0, 320).replace(/\s+\S*$/, "") + "…" : p.text || "";
    const text = short ? `<div class="soctxt">${bi(short, p.vi_text, esc)}</div>` : "";
    const paper = p.paper ? `<div class="socpaper muted">Theo ${esc(p.paper)}</div>` : "";
    const lean = leanText(p.lean).map(l => `<span class="${l.cls}">${l.text}</span>`).join("");
    const mk = (src.markets || []).map(m => `<span class="tag">${esc((data.markets || {})[m] || m)}</span>`).join("");
    return `<div class="socpost"><div class="soch"><span class="av">${esc(initials(src.name))}</span><b>${esc(src.name)}</b><span class="muted">${esc(src.role)}</span><b class="tier t${src.tier}">${src.tier}</b><span class="pf ${pc}">${pf}</span>` +
      `<a class="muted socago" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${ago(p.t, now)}</a></div>${head}${text}${paper}<div class="socmeta">${lean}${mk}</div></div>`;
  }

  function renderFeed() {
    const el = $("socFeed"); if (!el) return;
    if (!data) { el.innerHTML = `<div class="empty">Chưa tải được bài mạng xã hội.</div>`; return; }
    const by = new Map(data.sources.map(s => [s.id, s])), now = Date.now();
    const posts = filterPosts(data, { group, topic, who });
    const label = who ? (by.get(who) || {}).name : group ? data.groups[group] : "";
    el.innerHTML = (label ? `<div class="socfilter">Đang xem: <b>${esc(label)}</b> <button class="icon" data-group="">✕</button></div>` : "") +
      (posts.length ? posts.slice(0, 120).map(p => postHtml(p, by.get(p.who), now)).join("") : `<div class="empty">Chưa có bài nào trong mục này.</div>`);
  }

  function renderRight() {
    const el = $("socRight"); if (!el) return;
    if (!data) { el.innerHTML = ""; return; }
    const g = data.gauges || {};
    const gauge = x => x ? `<div class="socg2">${esc(x.name)} <b class="${gaugeCls(x.value)}">${x.value} ${esc(GAUGE_VI[String(x.label).toLowerCase()] || x.label)}</b><div class="gauge"><i style="left:${Math.min(100, Math.max(0, x.value))}%"></i></div><small class="muted">Tuần trước: ${x.prev}</small></div>` : "";
    const rows = Object.entries(data.tally || {}).filter(([, v]) => v.bull + v.bear);
    el.innerHTML = `<h4>Tâm lý chung <button class="q" data-g="fear-greed">?</button></h4>${gauge(g.stocks) + gauge(g.crypto) || `<div class="muted">Chưa tải được chỉ số tâm lý.</div>`}` +
      `<h4>Chuyên gia đang nghiêng về đâu (24 giờ) <button class="q" data-g="social-lean">?</button></h4>` +
      (rows.length ? `<table class="soctally"><thead><tr><th>Thị trường</th><th class="r bull">Tích cực</th><th class="r bear">Tiêu cực</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(LEAN_NAME[k] || k)}</td><td class="r bull">${v.bull}</td><td class="r bear">${v.bear}</td></tr>`).join("")}</tbody></table>` : `<div class="muted">Chưa đủ bài trong 24 giờ.</div>`) +
      `<p class="note">Mỗi người một phiếu cho mỗi thị trường, lấy bài mới nhất. Chấm tự động theo từ khoá nên có thể sai, chỉ để xem xu hướng chung.</p>` +
      `<h4>Đang được nhắc nhiều</h4><div class="soctrend">${(data.trending || []).map(t => `<span class="chip" title="${t.n} người nhắc trong 24 giờ">${esc(t.term)} <small>${t.n}</small></span>`).join("") || `<span class="muted">Chưa có.</span>`}</div>`;
  }

  function render() {
    const tb = $("socTopics");
    if (tb) tb.innerHTML = TOPICS.map(([id, nm]) => `<button class="${id === topic ? "on" : ""}" data-topic="${id}">${nm}</button>`).join("");
    renderSide(); renderFeed(); renderRight();
    const bad = data ? data.sources.filter(s => !s.ok).length : 0;
    setFresh($("socFresh"), "delay", data ? data.updated : null, { label: `Mạng xã hội${data ? ` · ${data.sources.length - bad}/${data.sources.length} nguồn` : ""}`, expect: 20 * 60e3, note: "Bluesky, Substack, blog, YouTube và trang của tổ chức lớn; làm mới khoảng 5 phút một lần. Bản tiếng Việt là dịch máy" });
  }

  const pick = e => {
    const b = e.target.closest("[data-group], [data-who]"); if (!b) return;
    if (b.dataset.who != null) { who = who === b.dataset.who ? "" : b.dataset.who; }
    else { group = b.dataset.group; who = ""; }
    render();
  };
  if ($("socWho")) $("socWho").onclick = pick;
  if ($("socFeed")) $("socFeed").onclick = pick;
  if ($("socTopics")) $("socTopics").onclick = e => { const b = e.target.closest("[data-topic]"); if (!b) return; topic = b.dataset.topic; try { sessionStorage.setItem("lailong.soctopic", topic); } catch { /* bỏ qua */ } render(); };
  document.addEventListener("lailong-lang", () => render());
  load(); setInterval(() => { if (!document.hidden) load(); }, 3 * 60e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  return { render, load };
}
