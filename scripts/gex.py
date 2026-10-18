"""Chuỗi quyền chọn Mỹ (CBOE, chậm 15 phút) cho GEX, tường call/put và bề mặt IV.

CBOE công bố miễn phí toàn bộ chuỗi quyền chọn kèm IV và OI tại cdn.cboe.com. Tệp gốc rất lớn
(SPX khoảng 13 MB) nên ở đây chỉ giữ phần cần cho phân tích: hợp đồng còn OI, IV hợp lệ,
strike trong khoảng ±25% quanh giá và hạn tối đa khoảng 13 tháng.
Phần tính GEX nằm ở web/js/gex.js để bản web và bản laptop dùng chung một cách tính;
BTC/ETH lấy trực tiếp từ Deribit trong trình duyệt.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

URL = "https://cdn.cboe.com/api/global/delayed_quotes/options/{}.json"
# (mã hiển thị, mã CBOE, tên)
SYMBOLS = [
    ("SPX", "_SPX", "Chỉ số S&P 500"),
    ("NDX", "_NDX", "Chỉ số Nasdaq 100"),
    ("SPY", "SPY", "Quỹ ETF S&P 500"),
    ("QQQ", "QQQ", "Quỹ ETF Nasdaq 100"),
    ("IWM", "IWM", "Quỹ ETF Russell 2000"),
    ("GLD", "GLD", "Quỹ ETF vàng"),
    ("SLV", "SLV", "Quỹ ETF bạc"),
    ("USO", "USO", "Quỹ ETF dầu"),
    ("TLT", "TLT", "Quỹ ETF trái phiếu Mỹ 20 năm"),
]
# giá đóng cửa ngày của tài sản cơ sở và chỉ số biến động tương ứng (Yahoo Finance, trễ)
YAHOO_SPOT = {"SPX": "^GSPC", "NDX": "^NDX"}
VOL_INDEX = {
    "SPX": ("^VIX", "VIX"),
    "SPY": ("^VIX", "VIX"),
    "NDX": ("^VXN", "VXN"),
    "QQQ": ("^VXN", "VXN"),
    "IWM": ("^RVX", "RVX"),
    "GLD": ("^GVZ", "GVZ (vàng)"),
    "USO": ("^OVX", "OVX (dầu)"),
    "TLT": ("^MOVE", "MOVE (trái phiếu)"),
}
YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{}?range=1y&interval=1d"
OPT = re.compile(r"^([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$")
MAX_DAYS = 400
BAND = 0.25


def _get(url: str, timeout: float = 40) -> bytes:
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 LaiLongQuant", "Accept-Encoding": "gzip"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        b = r.read()
        return gzip.decompress(b) if r.headers.get("Content-Encoding") == "gzip" else b


def compact(raw: dict, now_ms: int | None = None) -> dict:
    """Rút gọn tệp CBOE về {spot, exps, rows: [[strike, i_hạn, ±1, OI, iv, KL trong ngày]]}."""
    now_ms = now_ms or int(time.time() * 1000)
    d = raw.get("data") or {}
    spot = float(d.get("current_price") or d.get("close") or 0)
    exps: list[int] = []
    idx: dict[int, int] = {}
    rows = []
    for o in d.get("options") or []:
        m = OPT.match(o.get("option", ""))
        if not m:
            continue
        oi, iv = float(o.get("open_interest") or 0), float(o.get("iv") or 0)
        k = int(m[6]) / 1000
        if oi <= 0 or not 0.01 < iv < 5 or not spot or abs(k / spot - 1) > BAND:
            continue
        # hết hạn khoảng 16:00 giờ New York = 20:00 UTC
        t = int(datetime(2000 + int(m[2]), int(m[3]), int(m[4]), 20, tzinfo=UTC).timestamp() * 1000)
        if t <= now_ms or t - now_ms > MAX_DAYS * 86400_000:
            continue
        if t not in idx:
            idx[t] = len(exps)
            exps.append(t)
        rows.append(
            [
                k,
                idx[t],
                1 if m[5] == "C" else -1,
                oi,
                round(iv, 4),
                int(float(o.get("volume") or 0)),
            ]
        )
    order = sorted(range(len(exps)), key=lambda i: exps[i])
    remap = {old: new for new, old in enumerate(order)}
    return {
        "spot": spot,
        "chg": d.get("price_change_percent"),
        "iv30": d.get("iv30"),
        "mult": 100,
        "exps": [exps[i] for i in order],
        "rows": [[r[0], remap[r[1]], *r[2:]] for r in rows],
    }


def yahoo_daily(ysym: str) -> list[list[float]]:
    """[[thời gian ms, giá đóng cửa]] 1 năm theo ngày từ Yahoo; bỏ ngày thiếu giá."""
    raw = json.loads(_get(YAHOO.format(urllib.parse.quote(ysym)), timeout=20))
    return parse_daily(raw)


def parse_daily(raw: dict) -> list[list[float]]:
    r = raw["chart"]["result"][0]
    closes = r["indicators"]["quote"][0].get("close") or []
    return [
        [int(t) * 1000, round(c, 4)]
        for t, c in zip(r.get("timestamp") or [], closes, strict=False)
        if c is not None
    ]


def fetch(sym: str) -> dict:
    code, cboe, name = next(x for x in SYMBOLS if x[0] == sym)
    raw = json.loads(_get(URL.format(cboe)))
    out = compact(raw)
    out.update({"sym": code, "name": name, "quoteTime": raw.get("timestamp")})
    try:
        out["closes"] = [c for _, c in yahoo_daily(YAHOO_SPOT.get(code, code))][-60:]
    except Exception:
        pass
    if code in VOL_INDEX:
        ysym, vname = VOL_INDEX[code]
        try:
            out["volIdx"] = {
                "name": vname,
                "series": yahoo_daily(ysym),
                "t": int(time.time() * 1000),
            }
        except Exception:
            pass
    out["updated"] = int(time.time() * 1000)
    return out


def build(outdir: Path) -> dict:
    started = time.time()
    errors, sizes = [], {}

    def one(sym):
        try:
            data = fetch(sym)
            body = json.dumps(data, separators=(",", ":"))
            (outdir / f"gex_{sym}.json").write_text(body, encoding="utf-8")
            sizes[sym] = (len(data["rows"]), len(body))
        except Exception as exc:
            errors.append(f"{sym}: {exc}")

    with ThreadPoolExecutor(4) as ex:
        list(ex.map(one, [s[0] for s in SYMBOLS]))
    return {"sizes": sizes, "errors": errors, "seconds": round(time.time() - started, 1)}


_cache: dict[str, tuple[float, dict]] = {}


def cached(sym: str, ttl: float = 900) -> dict:
    """Dùng cho máy chủ trên laptop: lấy lại tối đa mỗi 15 phút."""
    now = time.time()
    if sym in _cache and now - _cache[sym][0] < ttl:
        return _cache[sym][1]
    data = fetch(sym)
    _cache[sym] = (now, data)
    return data


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    out.mkdir(parents=True, exist_ok=True)
    r = build(out)
    for s, (n, b) in sorted(r["sizes"].items()):
        print(f"{s}: {n} hợp đồng, {b // 1024} KB")
    print(f"{r['seconds']} giây")
    for e in r["errors"]:
        print("lỗi:", e)
