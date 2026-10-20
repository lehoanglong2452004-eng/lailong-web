// Lai Long Web: báo cáo hiệu suất theo tháng (lợi nhuận, sụt giảm tối đa, tỷ lệ thắng, kỳ vọng mỗi lệnh).
// Nguồn: nhật ký trên máy này, lịch sử lãi/lỗ thật của Binance (qua máy chủ laptop, khoá API chỉ đọc),
// hoặc file CSV xuất từ sàn. Nút "In / lưu PDF" tạo bản báo cáo sạch để gửi nhà đầu tư.
import { fromJournal, fromIncome, parseCsv, report } from "./perf.js?v=202610200119";
import { getJson, postJson, fmtVol } from "./util.js?v=202610200119";

const STORE = "lailong.perf.v1";
const pct = (x, k = 1) => x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(k)}%`;
const usd = x => x == null || !isFinite(x) ? "–" : `${x >= 0 ? "+" : "−"}${fmtVol(Math.abs(x))}`;
const cls = x => x > 0 ? "pos" : x < 0 ? "neg" : "";
const pf = x => isFinite(x) ? x.toFixed(2) : x === Infinity ? "∞" : "–";

export function initPerf({ $, esc, toast, journal }) {
  let src = "journal", income = null, csvRows = null, last = null;
  try { const s = JSON.parse(localStorage.getItem(STORE) || "{}"); src = s.src || src; csvRows = s.csv || null; income = s.income || null; } catch { /* bỏ qua */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ src, csv: csvRows, income })); } catch { /* đầy bộ nhớ: bỏ qua */ } };

  function data() {
    if (src === "binance") return income ? fromIncome(income.rows) : null;
    if (src === "csv") return csvRows ? fromIncome(csvRows) : null;
    return fromJournal(journal.trades());
  }

  function render() {
    for (const b of $("perfSrc").querySelectorAll("[data-ps]")) b.classList.toggle("on", b.dataset.ps === src);
    $("perfKeys").hidden = src !== "binance"; $("perfCsvBox").hidden = src !== "csv";
    const cap = +$("perfCap").value || journal.capital();
    const d = data(), R = d && report(d, { capital: cap });
    last = R;
    const srcTxt = src === "binance" ? (income ? `Binance USDT-M, ${income.rows.length} dòng, tải lúc ${new Date(income.updated).toLocaleString("vi-VN")}` : "Chưa tải từ Binance") : src === "csv" ? (csvRows ? `File CSV, ${csvRows.length} dòng` : "Chưa nhập file") : "Nhật ký trên máy này";
    $("perfNote").textContent = srcTxt;
    if (!R) { $("perfOut").innerHTML = `<div class="empty">${src === "journal" ? "Chưa có lệnh đã đóng trong nhật ký." : src === "binance" ? "Nhập khoá API chỉ đọc rồi bấm Tải lịch sử. Chỉ chạy được trên bản laptop." : "Bấm Chọn file để nhập lịch sử lệnh xuất từ sàn."}</div>`; return; }
    const T = R.total, box = (k, v, c = "", tip = "") => `<div class="stat"${tip ? ` data-tip="${esc(tip)}"` : ""}><span>${k}</span><b class="${c}">${v}</b></div>`;
    $("perfOut").innerHTML = `<div class="statgrid">` + [
      box("Lợi nhuận", `${usd(T.pnl)} USDT`, cls(T.pnl)), box("Lợi nhuận %", pct(T.ret), cls(T.ret), "So với vốn ban đầu, đã loại tiền nạp/rút"),
      box("Sụt giảm tối đa", pct(-T.maxDD), "neg", "Từ đỉnh vốn xuống đáy sâu nhất"), box("Tỷ lệ thắng", isFinite(T.wr) ? `${(T.wr * 100).toFixed(0)}%` : "–"),
      box("Kỳ vọng mỗi lệnh", `${usd(T.avg)} USDT${T.avgR != null ? ` · ${T.avgR >= 0 ? "+" : ""}${T.avgR.toFixed(2)}R` : ""}`, cls(T.avg), "Trung bình mỗi lệnh lời hay lỗ bao nhiêu, đã trừ phí"),
      box("Profit factor", pf(T.pf), "", "Tổng lãi chia tổng lỗ"), box("Số lệnh", `${T.n}`), box("Tháng có lãi", `${T.posMonths} / ${R.months.length}`),
      box("Sharpe (năm)", isFinite(T.sharpe) ? T.sharpe.toFixed(2) : "–", "", "Lợi nhuận ngày trung bình chia độ lệch chuẩn, nhân căn 365. Trên 1 là tốt, trên 2 là rất tốt"),
      box("Phí đã trả", `${fmtVol(Math.abs(T.fees))} USDT`), box("Funding", `${usd(T.funding)} USDT`, cls(T.funding)),
    ].join("") + `</div>` +
      `<table class="mktab perftab"><thead><tr><th>Tháng</th><th>Vốn đầu tháng</th><th>Lợi nhuận</th><th>%</th><th>Sụt giảm tối đa</th><th>Số lệnh</th><th>Tỷ lệ thắng</th><th>Kỳ vọng / lệnh</th><th>PF</th><th>Lệnh tốt nhất</th><th>Lệnh tệ nhất</th><th>Phí</th><th>Funding</th></tr></thead><tbody>` +
      R.months.slice().reverse().map(m => `<tr><td><b>${m.key}</b></td><td>${fmtVol(m.start)}</td><td class="${cls(m.pnl)}">${usd(m.pnl)}</td><td class="${cls(m.ret)}">${pct(m.ret)}</td><td class="neg">${pct(-m.dd)}</td><td>${m.n}</td><td>${isFinite(m.wr) ? (m.wr * 100).toFixed(0) + "%" : "–"}</td><td class="${cls(m.avg)}">${usd(m.avg)}</td><td>${pf(m.pf)}</td><td class="pos">${isFinite(m.best) ? usd(m.best) : "–"}</td><td class="neg">${isFinite(m.worst) ? usd(m.worst) : "–"}</td><td>${fmtVol(Math.abs(m.fees))}</td><td class="${cls(m.funding)}">${usd(m.funding)}</td></tr>`).join("") +
      `</tbody></table><p class="note">Từ ${new Date(T.from).toLocaleDateString("vi-VN")} tới ${new Date(T.to).toLocaleDateString("vi-VN")}. Lãi/lỗ mỗi lệnh đã trừ phí. Với lịch sử sàn, các lần khớp đóng cùng một mã cách nhau dưới 1 phút gộp thành một lệnh; phí từ sau lần đóng trước tới lần đóng này tính cho lệnh đó. Funding và nạp/rút tính riêng, không tính là lệnh.</p>`;
  }

  $("perfSrc").onclick = e => { const b = e.target.closest("[data-ps]"); if (b) { src = b.dataset.ps; save(); render(); } };
  $("perfCap").onchange = render;
  $("perfKeySave").onclick = async () => {
    try { const r = await postJson("api/account/keys", { exchange: "binance", key: $("perfKey").value, secret: $("perfSecret").value }); $("perfKey").value = $("perfSecret").value = ""; toast(r.binance ? `Đã lưu khoá ${r.binance.key} trên laptop` : "Đã xoá khoá"); keyStatus(); }
    catch (e) { toast(`Không lưu được khoá (chỉ chạy trên bản laptop): ${e.message}`, true); }
  };
  $("perfLoad").onclick = async () => {
    $("perfLoad").disabled = true; $("perfNote").textContent = "Đang tải lịch sử từ Binance…";
    try {
      const r = await fetch(`api/account/income?days=${$("perfDays").value}`), j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}: bản web không có máy chủ, dùng File CSV`);
      income = j; save(); toast(`Đã tải ${income.rows.length} dòng lãi/lỗ, phí, funding`);
    } catch (e) { toast(`Không tải được: ${e.message}`, true); }
    $("perfLoad").disabled = false; render();
  };
  async function keyStatus() { try { const s = await getJson("api/account/status"); $("perfKeyState").textContent = s.binance ? `Đã có khoá ${s.binance.key}` : "Chưa có khoá"; } catch { $("perfKeyState").textContent = "Bản web không có máy chủ: dùng File CSV"; } }
  $("perfPick").onclick = () => $("perfFile").click();
  $("perfFile").onchange = async () => {
    const f = $("perfFile").files[0]; if (!f) return;
    try { csvRows = parseCsv(await f.text()); save(); toast(`Đã nhập ${csvRows.length} dòng từ ${f.name}`); } catch (e) { toast(`Không đọc được file: ${e.message}`, true); }
    $("perfFile").value = ""; render();
  };
  $("perfPrint").onclick = () => {
    if (!last) return toast("Chưa có số liệu để in", true);
    const w = window.open("", "_blank"); if (!w) return toast("Trình duyệt chặn cửa sổ mới", true);
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Báo cáo hiệu suất Lai Long</title><style>body{font:12px 'IBM Plex Mono',Consolas,monospace;color:#111;margin:24px}h1{font-size:18px;letter-spacing:.05em}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border-bottom:1px solid #ccc;padding:4px 6px;text-align:right}th:first-child,td:first-child{text-align:left}.statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.stat{border:1px solid #ccc;padding:6px}.stat span{display:block;color:#555;font-size:11px}.pos{color:#0a7d4f}.neg{color:#b42318}.note{color:#555}</style><h1>LAI LONG · BÁO CÁO HIỆU SUẤT</h1><p>${esc($("perfNote").textContent)} · Vốn ban đầu ${fmtVol(+$("perfCap").value || journal.capital())} USDT · Lập ngày ${new Date().toLocaleDateString("vi-VN")}</p>${$("perfOut").innerHTML}`);
    w.document.close(); setTimeout(() => w.print(), 300);
  };

  $("perfCap").value = journal.capital();
  return { render, show() { keyStatus(); render(); } };
}
