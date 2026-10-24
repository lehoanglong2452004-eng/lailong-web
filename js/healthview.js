// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Lai Long Web: trang Sức khoẻ dữ liệu. Mỗi nguồn: đang chạy hay chết, độ trễ đo được, lần cập nhật cuối.
import { SOURCES, healthState, status, median, probeAll, onHealth, clockSkew } from "./health.js?v=202610240731";
import { freshTag, ageText } from "./fresh.js?v=202610240731";

const ST = {
  run: { name: "Đang chạy", cls: "up" }, slow: { name: "Cũ quá mức", cls: "warn" }, dead: { name: "Lỗi", cls: "dn" },
  idle: { name: "Phiên này chưa dùng", cls: "muted" }, none: { name: "Chưa kết nối", cls: "muted" },
};
const ms = x => x == null ? "–" : x < 1000 ? `${Math.round(x)} ms` : `${(x / 1000).toFixed(1)} giây`;

export function initHealth({ $, esc }) {
  let visible = false, timer = null, probing = false;

  function render() {
    if (!visible) return;
    const now = Date.now();
    const rows = SOURCES.map(src => {
      const s = healthState(src.id), st = status(src, s, now), S = ST[st];
      const lat = src.file ? null : median(s.lag.length ? s.lag : s.rtt);
      const latTxt = src.file ? (s.age ? ageText(now - s.age).replace(" trước", "") : "–") : s.lag.length ? `${ms(lat)} <small class="muted">sàn → máy</small>` : s.rtt.length ? `${ms(lat)} <small class="muted">khứ hồi</small>` : "–";
      const kind = src.kind === "none" ? `<span class="fresh eod"><b>●</b> Không có</span>` : freshTag(src.kind, null, { label: { live: "Trực tiếp", delay: "Trễ", eod: "Cuối ngày", weekly: "Hằng tuần" }[src.kind] });
      return `<tr><td class="t"><b>${esc(src.name)}</b><br><small class="muted">${esc(src.feeds)}</small></td><td>${kind}</td>
        <td class="${S.cls}"><b>●</b> ${S.name}${st === "dead" && s.err ? `<br><small>${esc(s.err)}</small>` : ""}</td>
        <td>${latTxt}</td><td>${s.lastOk ? ageText(now - s.lastOk) : "–"}</td>
        <td>${src.hosts && src.id.endsWith("ws") ? `${s.socks} kết nối · ${s.msgs.toLocaleString("vi-VN")} tin` : `${s.ok} được / ${s.fail} lỗi`}</td></tr>`;
    });
    const by = k => SOURCES.filter(src => status(src, healthState(src.id), now) === k).length;
    $("healthSum").innerHTML = `<div><small>Đang chạy</small><b class="up">${by("run")}</b></div><div><small>Lỗi</small><b class="dn">${by("dead")}</b></div><div><small>Cũ quá mức</small><b class="warn">${by("slow")}</b></div><div><small>Chưa dùng trong phiên</small><b>${by("idle")}</b></div><div><small>Lệch đồng hồ máy so với Binance</small><b>${clockSkew() ? ms(Math.abs(clockSkew())) + (clockSkew() > 0 ? " chậm" : " nhanh") : "–"}</b></div>`;
    $("healthBody").innerHTML = `<table class="srctab healthtab"><thead><tr><th>Nguồn</th><th>Loại</th><th>Trạng thái</th><th data-tip="WebSocket: thời gian từ lúc sàn ghi tin tới lúc máy nhận (trung vị). REST: thời gian khứ hồi một lần gọi. File dữ liệu: tuổi của file">Độ trễ đo được</th><th>Lần nhận cuối</th><th>Số lần</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
    $("healthProbe").disabled = probing;
  }

  $("healthProbe").onclick = async () => { probing = true; render(); await probeAll(); probing = false; render(); };
  onHealth(() => { if (visible) render(); });

  return {
    show() { visible = true; render(); clearInterval(timer); timer = setInterval(render, 2000); if (!probing) $("healthProbe").click(); },
    hide() { visible = false; clearInterval(timer); timer = null; },
  };
}
