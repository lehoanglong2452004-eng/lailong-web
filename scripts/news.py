"""Lịch kinh tế và tin crypto nóng cho Lai Long.

Chỉ dùng thư viện chuẩn để chạy được ở cả hai nơi:
  - máy chủ terminal trên laptop (lấy trực tiếp, lưu tạm 10 phút);
  - GitHub Actions của trang web công khai (chạy định kỳ, ghi ra data/calendar.json
    và data/news.json).

Chạy tay: python news.py <thư mục ra>
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (LaiLongQuant news fetcher)"}
CALENDAR_URLS = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
]
FEEDS = [
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Cointelegraph", "https://cointelegraph.com/rss"),
    ("Decrypt", "https://decrypt.co/feed"),
    ("The Block", "https://www.theblock.co/rss.xml"),
    ("Bitcoin Magazine", "https://bitcoinmagazine.com/.rss/full/"),
]
# tin có các từ này được đánh dấu "nóng"
HOT = re.compile(
    r"\b(SEC|ETF|hack(ed)?|exploit|Fed|FOMC|CPI|rate (cut|hike)|liquidat\w*|ban(s|ned)?|"
    r"approv\w*|lawsuit|Trump|tariff|Powell|BlackRock|bankrupt\w*|delist\w*|halt\w*|"
    r"outage|crash\w*|surge\w*|plunge\w*|record high)\b",
    re.I,
)
COINS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX", "LINK", "TON", "SUI", "HYPE"]
COIN_WORDS = {
    "BTC": r"bitcoin|btc",
    "ETH": r"ethereum|ether\b|eth\b",
    "SOL": r"solana|\bsol\b",
    "XRP": r"\bxrp\b|ripple",
    "BNB": r"\bbnb\b|binance coin",
    "DOGE": r"doge",
    "ADA": r"cardano|\bada\b",
    "AVAX": r"avalanche|avax",
    "LINK": r"chainlink",
    "TON": r"\btoncoin\b|\bton\b",
    "SUI": r"\bsui\b",
    "HYPE": r"hyperliquid",
}


def _get(url: str, timeout: float = 15) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_calendar() -> dict:
    events, errors = [], []
    for url in CALENDAR_URLS:
        try:
            for e in json.loads(_get(url)):
                ts = datetime.fromisoformat(e["date"]).astimezone(UTC)
                impact = e.get("impact", "")
                country = e.get("country", "")
                # giữ tin tác động mạnh của mọi nước và tin trung bình của Mỹ
                # (crypto chạy theo đồng USD)
                if impact != "High" and not (impact == "Medium" and country == "USD"):
                    continue
                events.append(
                    {
                        "t": int(ts.timestamp() * 1000),
                        "title": e.get("title", ""),
                        "country": country,
                        "impact": impact,
                        "forecast": e.get("forecast", ""),
                        "previous": e.get("previous", ""),
                        "actual": e.get("actual", ""),
                    }
                )
        except Exception as exc:  # tuần sau đôi khi chưa có
            errors.append(f"{url.rsplit('/', 1)[-1]}: {exc}")
    uniq = {(e["t"], e["title"], e["country"]): e for e in events}
    return {
        "updated": int(time.time() * 1000),
        "events": sorted(uniq.values(), key=lambda e: e["t"]),
        "errors": errors,
    }


def _text(el, tag):
    x = el.find(tag)
    return (x.text or "").strip() if x is not None and x.text else ""


def fetch_news(limit: int = 80) -> dict:
    items, errors = [], []
    for source, url in FEEDS:
        try:
            root = ET.fromstring(_get(url))
            for it in root.iter("item"):
                title = re.sub(r"\s+", " ", _text(it, "title"))
                link = _text(it, "link")
                pub = _text(it, "pubDate")
                if not title or not link:
                    continue
                try:
                    t = int(parsedate_to_datetime(pub).timestamp() * 1000)
                except Exception:
                    t = int(time.time() * 1000)
                coins = [c for c in COINS if re.search(COIN_WORDS[c], title, re.I)]
                items.append(
                    {
                        "t": t,
                        "title": title,
                        "link": link,
                        "source": source,
                        "hot": bool(HOT.search(title)),
                        "coins": coins,
                    }
                )
        except Exception as exc:
            errors.append(f"{source}: {exc}")
    seen, out = set(), []
    for it in sorted(items, key=lambda x: -x["t"]):
        key = it["title"].lower()[:80]
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return {"updated": int(time.time() * 1000), "items": out[:limit], "errors": errors}


_cache: dict[str, tuple[float, dict]] = {}


def cached(name: str, ttl: float = 600) -> dict:
    """Dùng cho máy chủ trên laptop: lấy lại tối đa mỗi 10 phút."""
    now = time.time()
    if name in _cache and now - _cache[name][0] < ttl:
        return _cache[name][1]
    data = fetch_calendar() if name == "calendar" else fetch_news()
    _cache[name] = (now, data)
    return data


def _write_if_changed(path: Path, data: dict, keys: str) -> bool:
    old = None
    if path.exists():
        try:
            old = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            old = None
    if old is not None and old.get(keys) == data.get(keys):
        return False  # nội dung không đổi thì không ghi, để khỏi tạo commit thừa
    if not data.get(keys) and old and old.get(keys):
        return False  # lần lấy này lỗi hết: giữ bản cũ
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return True


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    out.mkdir(parents=True, exist_ok=True)
    cal, news = fetch_calendar(), fetch_news()
    a = _write_if_changed(out / "calendar.json", cal, "events")
    b = _write_if_changed(out / "news.json", news, "items")
    print(
        f"lịch: {len(cal['events'])} sự kiện {'(đã ghi)' if a else '(không đổi)'}; "
        f"tin: {len(news['items'])} {'(đã ghi)' if b else '(không đổi)'}"
    )
    for e in cal["errors"] + news["errors"]:
        print("lỗi:", e)
