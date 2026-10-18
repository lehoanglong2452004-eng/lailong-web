"""Chỉ số vĩ mô mà bàn giao dịch tổ chức theo dõi, từ nguồn miễn phí.

- Biến động (Yahoo Finance, trễ khoảng 15 phút trong giờ giao dịch Mỹ): VIX và cấu trúc kỳ hạn
  (VIX9D, VIX, VIX3M, VIX6M), VVIX, SKEW, MOVE (trái phiếu), VXN, GVZ (vàng), OVX (dầu).
- COT của CFTC (hằng tuần: số liệu chốt thứ Ba, công bố chiều thứ Sáu giờ Mỹ): vị thế của
  đầu cơ lớn (non-commercial) và bên phòng hộ (commercial) trên các hợp đồng tương lai lớn,
  kèm chỉ số COT 3 năm (0 = thấp nhất, 100 = cao nhất).

Chạy như script: python macro.py <thư mục> ghi vol.json và cot.json. Không phụ thuộc gói lailong
để GitHub Actions của bản web chạy được trực tiếp.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 LaiLongQuant"}
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
]

COT_URL = (
    "https://publicreporting.cftc.gov/resource/6dca-aqww.json"  # Legacy, chỉ hợp đồng tương lai
)
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


def fetch_cot(years: int = 3) -> dict:
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
    return {"updated": int(time.time() * 1000), "items": items, "errors": errors}


_cache: dict[str, tuple[float, dict]] = {}


def cached(name: str) -> dict:
    """Dùng cho máy chủ trên laptop: biến động lấy lại tối đa mỗi 10 phút, COT mỗi 6 giờ."""
    now = time.time()
    ttl = 600 if name == "vol" else 6 * 3600
    if name in _cache and now - _cache[name][0] < ttl:
        return _cache[name][1]
    data = fetch_vol() if name == "vol" else fetch_cot()
    _cache[name] = (now, data)
    return data


if __name__ == "__main__":
    outdir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    outdir.mkdir(parents=True, exist_ok=True)
    for name, fn in (("vol", fetch_vol), ("cot", fetch_cot)):
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
