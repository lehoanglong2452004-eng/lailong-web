"""Chỉ số vĩ mô mà bàn giao dịch tổ chức theo dõi, từ nguồn miễn phí.

- Biến động (Yahoo Finance, trễ khoảng 15 phút trong giờ giao dịch Mỹ): VIX và cấu trúc kỳ hạn
  (VIX9D, VIX, VIX3M, VIX6M), VVIX, SKEW, MOVE (trái phiếu), VXN, GVZ (vàng), OVX (dầu).
- COT của CFTC (hằng tuần: số liệu chốt thứ Ba, công bố chiều thứ Sáu giờ Mỹ): vị thế của
  đầu cơ lớn (non-commercial) và bên phòng hộ (commercial) trên các hợp đồng tương lai lớn,
  kèm chỉ số COT 3 năm (0 = thấp nhất, 100 = cao nhất). Thêm nhóm chi tiết: quỹ quản lý
  (báo cáo Disaggregated, hàng hoá) hoặc quỹ đòn bẩy (báo cáo TFF, tài chính).
- Tin của CFTC: thông cáo báo chí (có tách xử phạt) và phát biểu, đọc từ trang danh sách
  công khai của cftc.gov (CFTC tạm tắt RSS từ 10/2026).

Chạy như script: python macro.py <thư mục> ghi vol.json, cot.json và cftc.json.
Không phụ thuộc gói lailong để GitHub Actions của bản web chạy được trực tiếp.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 LaiLongDesk"}
YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{}?range=1y&interval=1d"
# (mã Yahoo, tên ngắn, mô tả)
VOL = [
    ("^VIX9D", "VIX9D", "Biến động S&P 500 kỳ 9 ngày"),
    ("^VIX", "VIX", "Biến động S&P 500 kỳ 30 ngày, chỉ số sợ hãi"),
    ("^VIX3M", "VIX3M", "Biến động S&P 500 kỳ 3 tháng"),
    ("^VIX6M", "VIX6M", "Biến động S&P 500 kỳ 6 tháng"),
    ("^VVIX", "VVIX", "Biến động của chính VIX: nhu cầu mua bảo hiểm cho VIX"),
    ("^SKEW", "SKEW", "Giá của rủi ro đuôi (sập mạnh) trên S&P 500"),
    ("^MOVE", "MOVE", "Biến động trái phiếu chính phủ Mỹ"),
    ("^VXN", "VXN", "Biến động Nasdaq 100"),
    ("^GVZ", "GVZ", "Biến động vàng"),
    ("^OVX", "OVX", "Biến động dầu thô"),
    ("^GSPC", "SPX", "Chỉ số S&P 500, để so với đường trung bình 50 ngày"),
]

COT_URL = (
    "https://publicreporting.cftc.gov/resource/6dca-aqww.json"  # Legacy, chỉ hợp đồng tương lai
)
# báo cáo chi tiết theo nhóm: hàng hoá (Disaggregated) và tài chính (Traders in Financial Futures)
COT_DIS = "https://publicreporting.cftc.gov/resource/72hh-3qpy.json"
COT_TFF = "https://publicreporting.cftc.gov/resource/gpe5-46if.json"
# nhóm quỹ, nhóm tổ chức, cột long/short của từng nhóm; nhỏ lẻ là nonrept ở cả hai báo cáo
COT_GROUPS = {
    "dis": (
        ("Quỹ quản lý", "m_money_positions_long_all", "m_money_positions_short_all"),
        (
            "Nhà sản xuất và phòng hộ",
            ("prod_merc_positions_long", "swap_positions_long_all"),
            ("prod_merc_positions_short", "swap__positions_short_all"),
        ),
    ),
    "tff": (
        ("Quỹ đòn bẩy", "lev_money_positions_long", "lev_money_positions_short"),
        ("Quỹ quản lý tài sản", "asset_mgr_positions_long", "asset_mgr_positions_short"),
    ),
}
COT_DIS_GROUPS = {"Kim loại", "Năng lượng", "Nông sản"}
# (mã CFTC, mã ngắn, tên, nhóm)
COT = [
    ("088691", "GC", "Vàng", "Kim loại"),
    ("084691", "SI", "Bạc", "Kim loại"),
    ("085692", "HG", "Đồng", "Kim loại"),
    ("067651", "CL", "Dầu WTI", "Năng lượng"),
    ("023651", "NG", "Khí tự nhiên", "Năng lượng"),
    ("13874A", "ES", "S&P 500 mini", "Chứng khoán"),
    ("209742", "NQ", "Nasdaq 100 mini", "Chứng khoán"),
    ("239742", "RTY", "Russell 2000 mini", "Chứng khoán"),
    ("1170E1", "VX", "Hợp đồng VIX", "Chứng khoán"),
    ("043602", "ZN", "Trái phiếu 10 năm", "Lãi suất"),
    ("042601", "ZT", "Trái phiếu 2 năm", "Lãi suất"),
    ("098662", "DX", "Chỉ số USD", "Tiền tệ"),
    ("099741", "6E", "Euro", "Tiền tệ"),
    ("097741", "6J", "Yên Nhật", "Tiền tệ"),
    ("096742", "6B", "Bảng Anh", "Tiền tệ"),
    ("232741", "6A", "Đô la Úc", "Tiền tệ"),
    ("090741", "6C", "Đô la Canada", "Tiền tệ"),
    ("133741", "BTC", "Bitcoin CME", "Crypto"),
    ("146021", "ETH", "Ether CME", "Crypto"),
    ("002602", "ZC", "Ngô", "Nông sản"),
    ("005602", "ZS", "Đậu tương", "Nông sản"),
    ("001602", "ZW", "Lúa mì", "Nông sản"),
]
COT_FIELDS = [
    "report_date_as_yyyy_mm_dd",
    "cftc_contract_market_code",
    "market_and_exchange_names",
    "open_interest_all",
    "noncomm_positions_long_all",
    "noncomm_positions_short_all",
    "comm_positions_long_all",
    "comm_positions_short_all",
    "nonrept_positions_long_all",
    "nonrept_positions_short_all",
]


def _get(url: str, timeout: float = 25) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


# ---------- biến động ----------
def parse_chart(raw: dict) -> dict:
    """Chuỗi ngày [[ms, đóng cửa]] và giá gần nhất từ API chart của Yahoo."""
    r = raw["chart"]["result"][0]
    meta = r.get("meta") or {}
    closes = r["indicators"]["quote"][0].get("close") or []
    series = [
        [int(t) * 1000, round(c, 3)]
        for t, c in zip(r.get("timestamp") or [], closes, strict=False)
        if c is not None
    ]
    last = meta.get("regularMarketPrice")
    last_t = meta.get("regularMarketTime")
    return {
        "series": series,
        "last": round(float(last), 3) if last is not None else (series[-1][1] if series else None),
        "lastT": int(last_t) * 1000 if last_t else (series[-1][0] if series else None),
    }


def fetch_vol() -> dict:
    out, errors = [], []

    def one(item):
        ysym, code, desc = item
        try:
            d = parse_chart(json.loads(_get(YAHOO.format(urllib.parse.quote(ysym)))))
            return {"sym": code, "desc": desc, **d}
        except Exception as exc:
            errors.append(f"{code}: {exc}")
            return None

    with ThreadPoolExecutor(6) as ex:
        out = [x for x in ex.map(one, VOL) if x]
    return {"updated": int(time.time() * 1000), "items": out, "errors": errors}


# ---------- COT ----------
def _num(x) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def cot_index(values: list[float], cur: float) -> float | None:
    """Vị trí của giá trị hiện tại trong khoảng thấp nhất - cao nhất (0 đến 100)."""
    if len(values) < 10:
        return None
    lo, hi = min(values), max(values)
    return round((cur - lo) / (hi - lo) * 100, 1) if hi > lo else 50.0


def parse_cot(rows: list[dict]) -> list[dict]:
    """Gom các dòng CFTC theo hợp đồng, tính vị thế ròng, thay đổi tuần và chỉ số COT 3 năm."""
    meta = {c[0]: c for c in COT}
    by: dict[str, list[dict]] = {}
    for r in rows:
        code = r.get("cftc_contract_market_code")
        if code not in meta:
            continue
        d = (r.get("report_date_as_yyyy_mm_dd") or "")[:10]
        if not d:
            continue
        by.setdefault(code, []).append(
            {
                "d": d,
                "oi": _num(r.get("open_interest_all")),
                "spec": _num(r.get("noncomm_positions_long_all"))
                - _num(r.get("noncomm_positions_short_all")),
                "comm": _num(r.get("comm_positions_long_all"))
                - _num(r.get("comm_positions_short_all")),
                "small": _num(r.get("nonrept_positions_long_all"))
                - _num(r.get("nonrept_positions_short_all")),
                "specL": _num(r.get("noncomm_positions_long_all")),
                "specS": _num(r.get("noncomm_positions_short_all")),
            }
        )
    out = []
    for code, ws in by.items():
        ws = sorted({w["d"]: w for w in ws}.values(), key=lambda w: w["d"])
        last, prev = ws[-1], ws[-2] if len(ws) > 1 else None
        spec = [w["spec"] for w in ws]
        comm = [w["comm"] for w in ws]
        _, short, name, group = meta[code]
        out.append(
            {
                "code": code,
                "sym": short,
                "name": name,
                "group": group,
                "date": last["d"],
                "oi": last["oi"],
                "spec": last["spec"],
                "specChg": last["spec"] - prev["spec"] if prev else None,
                "comm": last["comm"],
                "small": last["small"],
                "specPctOi": round(last["spec"] / last["oi"] * 100, 1) if last["oi"] else None,
                "specLongPct": round(last["specL"] / (last["specL"] + last["specS"]) * 100, 1)
                if last["specL"] + last["specS"]
                else None,
                "specIdx": cot_index(spec, last["spec"]),
                "commIdx": cot_index(comm, last["comm"]),
                "hist": [[w["d"], w["spec"], w["comm"]] for w in ws[-156:]],
            }
        )
    order = {c[0]: i for i, c in enumerate(COT)}
    return sorted(out, key=lambda x: order[x["code"]])


def fetch_cot(years: int = 3, detail: bool = True) -> dict:
    since = (datetime.now(UTC) - timedelta(days=365 * years + 14)).strftime("%Y-%m-%d")
    codes = ",".join(f"'{c[0]}'" for c in COT)
    q = {
        "$where": (
            f"cftc_contract_market_code in({codes}) AND report_date_as_yyyy_mm_dd >= '{since}'"
        ),
        "$order": "report_date_as_yyyy_mm_dd",
        "$limit": "50000",
    }
    errors = []
    try:  # chỉ lấy các cột cần; nếu CFTC đổi tên cột thì lấy cả dòng
        rows = json.loads(
            _get(
                f"{COT_URL}?{urllib.parse.urlencode({**q, '$select': ','.join(COT_FIELDS)})}",
                timeout=60,
            )
        )
    except Exception as exc:
        errors.append(f"select: {exc}")
        rows = json.loads(_get(f"{COT_URL}?{urllib.parse.urlencode(q)}", timeout=90))
    items = parse_cot(rows)
    missing = [c[1] for c in COT if c[0] not in {x["code"] for x in items}]
    if missing:
        errors.append("không có dữ liệu: " + ", ".join(missing))
    out = {"updated": int(time.time() * 1000), "items": items, "errors": errors}
    if detail and items:
        add_cot_detail(out, years)
    return out


def _sum(r: dict, cols) -> float:
    return sum(_num(r.get(c)) for c in ((cols,) if isinstance(cols, str) else cols))


def parse_cot_detail(rows: list[dict], rep: str) -> dict[str, dict]:
    """Vị thế ròng 3 nhóm (quỹ, tổ chức, nhỏ lẻ) theo tuần của báo cáo chi tiết."""
    (fname, fl, fs), (iname, il, is_) = COT_GROUPS[rep]
    by: dict[str, dict[str, list]] = {}
    for r in rows:
        code, d = (
            r.get("cftc_contract_market_code"),
            (r.get("report_date_as_yyyy_mm_dd") or "")[:10],
        )
        if not code or not d:
            continue
        by.setdefault(code, {})[d] = [
            d,
            _sum(r, fl) - _sum(r, fs),
            _sum(r, il) - _sum(r, is_),
            _num(r.get("nonrept_positions_long_all")) - _num(r.get("nonrept_positions_short_all")),
            _num(r.get("open_interest_all")),
        ]
    out = {}
    for code, days in by.items():
        ws = [days[k] for k in sorted(days)]
        last, prev = ws[-1], ws[-2] if len(ws) > 1 else None
        out[code] = {
            "rep": rep,
            "who": [fname, iname, "Nhỏ lẻ"],
            "fund": last[1],
            "fundChg": last[1] - prev[1] if prev else None,
            "fundPctOi": round(last[1] / last[4] * 100, 1) if last[4] else None,
            "fundIdx": cot_index([w[1] for w in ws], last[1]),
            "instIdx": cot_index([w[2] for w in ws], last[2]),
            "smallIdx": cot_index([w[3] for w in ws], last[3]),
            "h3": [w[:4] for w in ws[-156:]],
        }
    return out


def _socrata(url: str, codes: list[str], since: str) -> list[dict]:
    q = {
        "$where": (
            f"cftc_contract_market_code in({','.join(repr(c) for c in codes)})"
            f" AND report_date_as_yyyy_mm_dd >= '{since}'"
        ),
        "$order": "report_date_as_yyyy_mm_dd",
        "$limit": "50000",
    }
    return json.loads(_get(f"{url}?{urllib.parse.urlencode(q)}", timeout=90))


def add_cot_detail(data: dict, years: int = 3) -> None:
    """Gắn nhóm quỹ quản lý (hàng hoá) hoặc quỹ đòn bẩy (tài chính) vào từng hợp đồng."""
    since = (datetime.now(UTC) - timedelta(days=365 * years + 14)).strftime("%Y-%m-%d")
    dis = [c[0] for c in COT if c[3] in COT_DIS_GROUPS]
    tff = [c[0] for c in COT if c[3] not in COT_DIS_GROUPS]
    found: dict[str, dict] = {}
    for rep, url, codes in (("dis", COT_DIS, dis), ("tff", COT_TFF, tff)):
        try:
            found.update(parse_cot_detail(_socrata(url, codes, since), rep))
        except Exception as exc:
            data.setdefault("errors", []).append(f"COT chi tiết {rep}: {exc}")
    for x in data.get("items", []):
        if x["code"] in found:
            x.update(found[x["code"]])


# ---------- tin và thông báo của CFTC ----------
# CFTC tạm tắt RSS từ 10/2026 nên đọc thẳng trang danh sách (bảng Ngày | Tiêu đề)
CFTC = "https://www.cftc.gov"
CFTC_PAGES = [
    ("press", f"{CFTC}/PressRoom/PressReleases", r"/PressRoom/PressReleases/(?!index)[\w-]+"),
    (
        "speech",
        f"{CFTC}/PressRoom/SpeechesTestimony",
        r"/PressRoom/SpeechesTestimony/(?!index)[\w-]+",
    ),
]
# thông cáo nói về xử phạt: toà án, phạt tiền, buộc tội, gian lận
ENFORCE = re.compile(
    r"\b(court|charges|charged|fraud|penalt|to pay|sanction|enforcement|complaint|judgment|"
    r"restitution|disgorge|manipulat|ponzi|indict|liable|spoof)",
    re.I,
)
_TR = re.compile(r"<tr\b.*?</tr>", re.S | re.I)
_A = re.compile(r"<a\b[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>", re.S | re.I)
_DATE = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
_TAG = re.compile(r"<[^>]+>")


def _text(h: str) -> str:
    return " ".join(html.unescape(_TAG.sub(" ", h)).split())


def parse_cftc_list(page: str, kind: str, path_re: str) -> list[dict]:
    """Các dòng của bảng danh sách: ngày (tháng/ngày/năm giờ Mỹ), tiêu đề, đường dẫn, loại."""
    pr = re.compile(path_re)
    out = []
    rows = _TR.findall(page)
    if not rows:  # không phải bảng: mỗi đường dẫn đi kèm ngày đứng ngay trước nó
        rows = [page[max(0, m.start() - 400) : m.end()] for m in _A.finditer(page)]
    for tr in rows:
        d = _DATE.search(_text(tr))
        link = next(((u, t) for u, t in _A.findall(tr) if pr.search(u)), None)
        if not d or not link:
            continue
        url = link[0] if link[0].startswith("http") else CFTC + link[0]
        title = _text(link[1])
        if not title:
            continue
        mo, dd, yy = (int(x) for x in d.groups())
        # trang chỉ ghi ngày: tính 12:00 trưa giờ Mỹ (17:00 UTC) để ngày không lệch khi đổi giờ VN
        t = int(datetime(yy, mo, dd, 17, tzinfo=UTC).timestamp() * 1000)
        cat = kind if kind != "press" else ("enforce" if ENFORCE.search(title) else "press")
        out.append(
            {"t": t, "date": f"{yy}-{mo:02d}-{dd:02d}", "title": title, "url": url, "cat": cat}
        )
    return out


def fetch_cftc(prev: dict | None = None) -> dict:
    items, errors = [], []
    for kind, url, path_re in CFTC_PAGES:
        try:
            got = parse_cftc_list(_get(url, timeout=30).decode("utf-8", "replace"), kind, path_re)
            if not got:
                raise ValueError("không thấy bảng danh sách")
            items += got[:30]
        except Exception as exc:
            errors.append(f"{kind}: {exc}")
            items += [x for x in (prev or {}).get("items", []) if x.get("cat") in _KIND_CATS[kind]]
    seen, uniq = set(), []
    for x in sorted(items, key=lambda x: -x["t"]):
        if x["url"] not in seen:
            seen.add(x["url"])
            uniq.append(x)
    old = {x["url"]: x.get("vi") for x in (prev or {}).get("items", []) if x.get("vi")}
    for x in uniq:
        if not x.get("vi") and old.get(x["url"]):
            x["vi"] = old[x["url"]]
    return {"updated": int(time.time() * 1000), "items": uniq[:60], "errors": errors}


_KIND_CATS = {"press": ("press", "enforce"), "speech": ("speech",)}


_cache: dict[str, tuple[float, dict]] = {}


def cached(name: str) -> dict:
    """Dùng cho máy chủ trên laptop: biến động lấy lại tối đa mỗi 10 phút, tin CFTC mỗi 30 phút,
    COT mỗi 6 giờ."""
    now = time.time()
    ttl = {"vol": 600, "cftc": 1800}.get(name, 6 * 3600)
    if name in _cache and now - _cache[name][0] < ttl:
        return _cache[name][1]
    try:
        fn = {"vol": fetch_vol, "cftc": lambda: fetch_cftc(_cache.get("cftc", (0, None))[1])}
        data = fn.get(name, fetch_cot)()
        if not data["items"]:
            raise ValueError("; ".join(data["errors"]) or "không có dữ liệu")
    except Exception as exc:
        # máy CFTC/Yahoo hay lỗi tạm thời: lấy bản GitHub Actions đã chép lên trang web,
        # không được thì dùng bản cũ trong bộ nhớ; thử lại nguồn gốc sau 10 phút
        data = _mirror(name, exc) or (_cache[name][1] if name in _cache else None)
        if data is None:
            raise
        _cache[name] = (now - ttl + 600, data)
        return data
    _cache[name] = (now, data)
    return data


MIRROR = "https://lehoanglong2452004-eng.github.io/lailong-web/data/{}.json"


def _mirror(name: str, exc: Exception) -> dict | None:
    try:
        data = json.loads(_get(MIRROR.format(name)))
    except Exception:
        return None
    if not data.get("items"):
        return None
    data["errors"] = [*data.get("errors", []), f"nguồn gốc lỗi ({exc}), đang dùng bản sao trên web"]
    return data


if __name__ == "__main__":
    outdir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    outdir.mkdir(parents=True, exist_ok=True)

    def _cftc():
        try:
            prev = json.loads((outdir / "cftc.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            prev = None
        return fetch_cftc(prev)

    for name, fn in (("vol", fetch_vol), ("cot", fetch_cot), ("cftc", _cftc)):
        try:
            data = fn()
            if data["items"]:
                (outdir / f"{name}.json").write_text(
                    json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
                )
            print(
                f"{name}: {len(data['items'])} mục",
                *(f"lỗi: {e}" for e in data["errors"]),
                sep="\n",
            )
        except Exception as exc:
            print(f"{name} lỗi: {exc}")
