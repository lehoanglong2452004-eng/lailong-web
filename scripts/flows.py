"""Dòng tiền tổ chức Mỹ theo dõi hằng ngày, từ nguồn miễn phí.

- Quỹ ETF Bitcoin/Ethereum giao ngay (Farside Investors): tiền vào/ra ròng mỗi ngày của từng quỹ,
  đơn vị triệu USD. Số liệu chốt sau phiên Mỹ, nên là dữ liệu cuối ngày.
- Lượng stablecoin đang lưu hành (DefiLlama): tổng và từng đồng lớn, thay đổi 1/7/30 ngày.
  Stablecoin tăng là tiền mới vào hệ crypto, giảm là tiền rút ra.

Chạy như script: python flows.py <thư mục> ghi flows.json. Không phụ thuộc gói lailong
để GitHub Actions của bản web chạy được trực tiếp.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
}
FARSIDE = {
    "btc": [
        "https://farside.co.uk/bitcoin-etf-flow-all-data/",
        "https://farside.co.uk/btc/",
    ],
    "eth": [
        "https://farside.co.uk/ethereum-etf-flow-all-data/",
        "https://farside.co.uk/eth/",
    ],
}
LLAMA_LIST = "https://stablecoins.llama.fi/stablecoins?includePrices=false"
LLAMA_CHART = "https://stablecoins.llama.fi/stablecoincharts/all"
KEEP_DAYS = 120


def _get(url: str, timeout: float = 25) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


class _Table(HTMLParser):
    """Gom mọi dòng <tr> của trang thành danh sách ô chữ."""

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._row is not None and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def _flow(s: str) -> float | None:
    """'(12.3)' là -12.3 triệu USD, '-' là 0, ô trống là chưa có số."""
    s = s.replace(",", "").replace("$", "").strip()
    if s in ("-", "–", "0"):
        return 0.0
    m = re.fullmatch(r"\((\d+(?:\.\d+)?)\)|(-?\d+(?:\.\d+)?)", s)
    if not m:
        return None
    return -float(m.group(1)) if m.group(1) else float(m.group(2))


def _day(s: str) -> int | None:
    for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d"):
        try:
            return int(datetime.strptime(s.strip(), fmt).replace(tzinfo=UTC).timestamp() * 1000)
        except ValueError:
            continue
    return None


def parse_farside(html: str) -> dict:
    """Bảng Farside: dòng tiêu đề có mã quỹ và 'Total', mỗi dòng sau là một ngày."""
    p = _Table()
    p.feed(html)
    head: list[str] | None = None
    rows = []
    for r in p.rows:
        if head is None:
            if any(c.lower() == "total" for c in r) and len(r) >= 3:
                head = r
            continue
        t = _day(r[0]) if r else None
        if t is None or len(r) != len(head):
            continue
        vals = [_flow(c) for c in r[1:]]
        ti = [c.lower() for c in head].index("total") - 1
        total = vals[ti]
        if total is None:
            continue
        funds = {head[k + 1]: v for k, v in enumerate(vals) if k != ti and v is not None}
        rows.append([t, total, funds])
    rows.sort(key=lambda x: x[0])
    funds = [c for c in head[1:] if c.lower() != "total"] if head else []
    return {"funds": funds, "rows": rows[-KEEP_DAYS:]}


def fetch_etf(asset: str) -> dict:
    last_err = ""
    for url in FARSIDE[asset]:
        try:
            d = parse_farside(_get(url).decode("utf-8", "replace"))
            if d["rows"]:
                return {**d, "src": url}
            last_err = f"{url}: không thấy bảng"
        except Exception as exc:
            last_err = f"{url}: {exc}"
    raise RuntimeError(last_err)


def parse_stables(lst: dict, chart: list) -> dict:
    coins = []
    for c in lst.get("peggedAssets", []):
        now = (c.get("circulating") or {}).get("peggedUSD")
        if not now or c.get("pegType") != "peggedUSD":
            continue

        def prev(k, c=c):
            return (c.get(k) or {}).get("peggedUSD")

        coins.append(
            {
                "sym": c.get("symbol"),
                "name": c.get("name"),
                "now": now,
                "d1": prev("circulatingPrevDay"),
                "d7": prev("circulatingPrevWeek"),
                "d30": prev("circulatingPrevMonth"),
            }
        )
    coins.sort(key=lambda x: -x["now"])
    series = []
    for p in chart:
        v = (p.get("totalCirculatingUSD") or {}).get("peggedUSD")
        if v:
            series.append([int(p["date"]) * 1000, round(v)])
    return {"coins": coins[:8], "series": series[-400:]}


def fetch_stables() -> dict:
    lst = json.loads(_get(LLAMA_LIST))
    chart = json.loads(_get(LLAMA_CHART))
    return parse_stables(lst, chart)


def fetch_all() -> dict:
    out: dict = {"updated": int(time.time() * 1000), "errors": []}
    for asset in ("btc", "eth"):
        try:
            out[asset] = fetch_etf(asset)
        except Exception as exc:
            out["errors"].append(f"ETF {asset.upper()}: {exc}")
    try:
        out["stable"] = fetch_stables()
    except Exception as exc:
        out["errors"].append(f"stablecoin: {exc}")
    return out


_cache: tuple[float, dict] | None = None


def cached() -> dict:
    """Dùng cho máy chủ trên laptop: lấy lại tối đa mỗi 30 phút."""
    global _cache
    if _cache and time.time() - _cache[0] < 1800:
        return _cache[1]
    data = fetch_all()
    _cache = (time.time(), data)
    return data


if __name__ == "__main__":
    outdir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    outdir.mkdir(parents=True, exist_ok=True)
    data = fetch_all()
    old = outdir / "flows.json"
    # nguồn nào lỗi lần này thì giữ số của lần trước
    if old.exists():
        try:
            prev = json.loads(old.read_text(encoding="utf-8"))
            for k in ("btc", "eth", "stable"):
                if k not in data and k in prev:
                    data[k] = {**prev[k], "stale": True}
        except ValueError:
            pass
    if any(k in data for k in ("btc", "eth", "stable")):
        old.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    for k in ("btc", "eth"):
        if k in data:
            print(f"ETF {k}: {len(data[k]['rows'])} ngày, {len(data[k]['funds'])} quỹ")
    if "stable" in data:
        print(
            f"stablecoin: {len(data['stable']['coins'])} đồng, {len(data['stable']['series'])} ngày"
        )
    for e in data["errors"]:
        print("lỗi:", e)
