"""Lịch kinh tế, tin tức theo 6 mục và phản ứng giá sau tin cho Lai Long.

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
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (LaiLongQuant news fetcher)"}
# vài API lịch kinh tế chỉ trả lời trình duyệt thật
BROWSER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
}
CALENDAR_URLS = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
]
# (nguồn, đường dẫn, mục mặc định); mục thật của từng tin còn được chỉnh lại theo từ khoá.
# Nguồn nào bị chặn (ví dụ Investing.com ở Việt Nam) chỉ bị bỏ qua sau vài giây, không làm chậm nguồn khác.
GN = "https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q="
FEEDS = [
    # crypto
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/", "crypto"),
    ("Cointelegraph", "https://cointelegraph.com/rss", "crypto"),
    ("Decrypt", "https://decrypt.co/feed", "crypto"),
    ("The Block", "https://www.theblock.co/rss.xml", "crypto"),
    ("Bitcoin Magazine", "https://bitcoinmagazine.com/.rss/full/", "crypto"),
    ("CryptoSlate", "https://cryptoslate.com/feed/", "crypto"),
    ("Blockworks", "https://blockworks.co/feed", "crypto"),
    ("Bitcoinist", "https://bitcoinist.com/feed/", "crypto"),
    ("The Defiant", "https://thedefiant.io/api/feed", "crypto"),
    # kinh tế, ngân hàng trung ương
    ("CNBC", "https://www.cnbc.com/id/20910258/device/rss/rss.html", "econ"),
    ("Bloomberg", "https://feeds.bloomberg.com/economics/news.rss", "econ"),
    ("ForexLive", "https://www.forexlive.com/feed/news", "econ"),
    ("FXStreet", "https://www.fxstreet.com/rss/news", "econ"),
    ("FinancialJuice", "https://www.financialjuice.com/feed.ashx?xy=rss", "econ"),
    ("Investing.com", "https://www.investing.com/rss/news_14.rss", "econ"),
    ("Fed", "https://www.federalreserve.gov/feeds/press_all.xml", "econ"),
    ("Fed", "https://www.federalreserve.gov/feeds/speeches.xml", "econ"),
    ("ECB", "https://www.ecb.europa.eu/rss/press.html", "econ"),
    ("BoE", "https://www.bankofengland.co.uk/rss/news", "econ"),
    ("BoJ", "https://www.boj.or.jp/en/rss/whatsnew.xml", "econ"),
    ("Google News", GN + "%22central+bank%22+OR+inflation+OR+%22rate+decision%22+when:1d", "econ"),
    # tài chính, chứng khoán, trái phiếu
    ("CNBC", "https://www.cnbc.com/id/10000664/device/rss/rss.html", "fin"),
    ("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html", "fin"),
    ("CNBC", "https://www.cnbc.com/id/15839069/device/rss/rss.html", "fin"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories", "fin"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines", "fin"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", "fin"),
    ("WSJ", "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", "fin"),
    ("Bloomberg", "https://feeds.bloomberg.com/markets/news.rss", "fin"),
    ("Financial Times", "https://www.ft.com/markets?format=rss", "fin"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex", "fin"),
    ("NYT", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", "fin"),
    ("Investing.com", "https://www.investing.com/rss/news_1.rss", "fin"),
    ("Google News", GN + "site:reuters.com+markets+when:1d", "fin"),
    # kim loại
    ("Google News", GN + "gold+OR+silver+OR+copper+OR+platinum+price+when:2d", "metal"),
    ("Mining.com", "https://www.mining.com/feed/", "metal"),
    ("Kitco", "https://www.kitco.com/news/category/mining/rss", "metal"),
    # năng lượng
    ("OilPrice", "https://oilprice.com/rss/main", "energy"),
    ("Rigzone", "https://www.rigzone.com/news/rss/rigzone_latest.aspx", "energy"),
    ("EIA", "https://www.eia.gov/rss/todayinenergy.xml", "energy"),
    ("Investing.com", "https://www.investing.com/rss/news_11.rss", "energy"),
    ("Google News", GN + "oil+OR+OPEC+OR+%22natural+gas%22+price+when:2d", "energy"),
    # địa chính trị
    ("CNBC", "https://www.cnbc.com/id/100727362/device/rss/rss.html", "geo"),
    ("BBC", "https://feeds.bbci.co.uk/news/world/rss.xml", "geo"),
    ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "geo"),
    ("The Guardian", "https://www.theguardian.com/world/rss", "geo"),
    ("NYT", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "geo"),
    ("DW", "https://rss.dw.com/rdf/rss-en-world", "geo"),
    ("Financial Times", "https://www.ft.com/world?format=rss", "geo"),
    ("Bloomberg", "https://feeds.bloomberg.com/politics/news.rss", "geo"),
    ("Google News", GN + "site:reuters.com+world+when:1d", "geo"),
    # tiếng Việt
    ("VnExpress", "https://vnexpress.net/rss/kinh-doanh.rss", "fin"),
    ("VnExpress", "https://vnexpress.net/rss/the-gioi.rss", "geo"),
    ("CafeF", "https://cafef.vn/thi-truong-chung-khoan.rss", "fin"),
    ("CafeF", "https://cafef.vn/tai-chinh-quoc-te.rss", "fin"),
    ("Vietstock", "https://vietstock.vn/830/the-gioi/tai-chinh-quoc-te.rss", "fin"),
]
CATS = ["econ", "fin", "metal", "energy", "geo", "crypto"]
# thứ tự ưu tiên khi một tin khớp nhiều mục
CAT_WORDS = [
    ("metal", r"\b(gold|silver|copper|platinum|palladium|bullion|precious metal|lithium|nickel)\b"),
    (
        "energy",
        r"\b(oil|crude|brent|wti|opec\+?|natural gas|lng|gasoline|diesel|refiner\w*|barrels?|energy)\b",
    ),
    (
        "geo",
        r"\b(war|military|missiles?|airstrikes?|sanctions?|iran\w*|israel\w*|gaza|ukrain\w*|russia\w*|"
        r"taiwan|nato|ceasefire|hormuz|houthis?|north korea|geopolitic\w*|troops|invasion|coup)\b",
    ),
    (
        "econ",
        r"\b(inflation|cpi|ppi|pce|gdp|payrolls?|nonfarm|jobless|unemployment|retail sales|pmi|"
        r"fed|fomc|ecb|boj|boe|pboc|central bank|interest rates?|rate (cut|hike)s?|recession|economy|tariffs?)\b",
    ),
    (
        "fin",
        r"\b(stocks?|shares|s&p|nasdaq|dow|bonds?|yields?|treasur\w*|banks?|earnings|ipo|dollar|"
        r"currenc\w*|forex|yen|euro|sterling|yuan)\b",
    ),
]
# chủ đề cho bản đồ tác động: (mã, tên, ký hiệu, mục, từ khoá, tài sản hay bị ảnh hưởng)
TOPICS = [
    (
        "fed",
        "Fed và lãi suất",
        "🏦",
        "econ",
        r"\b(fed|fomc|powell|warsh|rate (cut|hike)s?|interest rates?|federal reserve)\b",
        "DXY, lợi suất Mỹ, vàng, chứng khoán, BTC",
    ),
    (
        "cb",
        "Ngân hàng trung ương khác",
        "🏛",
        "econ",
        r"\b(ecb|lagarde|boj|ueda|boe|bailey|pboc|rba|boc|snb|rbnz)\b",
        "EUR, JPY, GBP, CNY, AUD, CAD, CHF",
    ),
    (
        "infl",
        "Lạm phát",
        "📈",
        "econ",
        r"\b(inflation|cpi|ppi|pce|consumer prices?|deflation)\b",
        "DXY, lợi suất, vàng, BTC",
    ),
    (
        "jobs",
        "Việc làm",
        "👷",
        "econ",
        r"\b(payrolls?|nonfarm|nfp|jobless|unemployment|labor market|jobs report|jolts)\b",
        "DXY, lợi suất, chứng khoán",
    ),
    (
        "growth",
        "Tăng trưởng",
        "🏭",
        "econ",
        r"\b(gdp|pmi|retail sales|recession|industrial production|consumer spending)\b",
        "Chứng khoán, đồng tiền nước đó, dầu",
    ),
    (
        "trade",
        "Thuế quan, thương mại",
        "🚢",
        "econ",
        r"\b(tariffs?|trade (war|deal|talks)|exports?|imports?|wto)\b",
        "CNY, chứng khoán, đồng, đậu nành",
    ),
    ("usd", "Đồng USD", "💵", "fin", r"\b(dollar|dxy|greenback|usd)\b", "Vàng, EUR, JPY, hàng hoá"),
    (
        "bonds",
        "Trái phiếu, lợi suất",
        "📜",
        "fin",
        r"\b(bonds?|yields?|treasur\w*|gilts?|bund)\b",
        "USD, vàng, cổ phiếu tăng trưởng",
    ),
    (
        "stocks",
        "Chứng khoán",
        "📊",
        "fin",
        r"\b(stocks?|s&p|nasdaq|dow|equit\w*|earnings|wall street)\b",
        "BTC, ETH, AUD, JPY",
    ),
    (
        "banks",
        "Ngân hàng, tín dụng",
        "🏦",
        "fin",
        r"\b(banks?|banking|credit|default|bailout)\b",
        "Lợi suất, vàng, USD",
    ),
    ("gold", "Vàng", "🥇", "metal", r"\b(gold|bullion)\b", "XAU, bạc, AUD"),
    (
        "silver",
        "Bạc, bạch kim",
        "🥈",
        "metal",
        r"\b(silver|platinum|palladium)\b",
        "Vàng, kim loại công nghiệp",
    ),
    (
        "copper",
        "Đồng, kim loại công nghiệp",
        "🟠",
        "metal",
        r"\b(copper|nickel|aluminium|aluminum|zinc|iron ore|lithium)\b",
        "AUD, CLP, chứng khoán Trung Quốc",
    ),
    (
        "oil",
        "Dầu",
        "🛢",
        "energy",
        r"\b(oil|crude|brent|wti|barrels?|refiner\w*|gasoline)\b",
        "CAD, NOK, lạm phát, lợi suất",
    ),
    ("opec", "OPEC+", "🛢", "energy", r"\bopec\+?\b", "Dầu, CAD, Rúp"),
    (
        "gas",
        "Khí đốt, điện",
        "🔥",
        "energy",
        r"\b(natural gas|lng|power prices?|electricity)\b",
        "EUR, lạm phát châu Âu",
    ),
    (
        "mideast",
        "Trung Đông",
        "⚔",
        "geo",
        r"\b(iran\w*|israel\w*|gaza|hezbollah|houthis?|hormuz|saudi|yemen|syria\w*)\b",
        "Dầu, vàng, USD",
    ),
    (
        "ruukr",
        "Nga, Ukraine, NATO",
        "🛡",
        "geo",
        r"\b(russia\w*|ukrain\w*|putin|zelensk\w*|nato|kremlin)\b",
        "Khí đốt châu Âu, lúa mì, EUR, vàng",
    ),
    (
        "china",
        "Trung Quốc, Đài Loan",
        "🐉",
        "geo",
        r"\b(china|chinese|beijing|xi jinping|taiwan)\b",
        "CNY, AUD, đồng, chứng khoán châu Á",
    ),
    (
        "politics",
        "Chính trị, bầu cử",
        "🗳",
        "geo",
        r"\b(election|trump|white house|congress|senate|shutdown|parliament)\b",
        "USD, chứng khoán, trái phiếu",
    ),
    ("btc", "Bitcoin", "₿", "crypto", r"\b(bitcoin|btc)\b", "Toàn thị trường crypto"),
    ("eth", "Ethereum", "Ξ", "crypto", r"\b(ethereum|ether|eth)\b", "Altcoin, DeFi"),
    (
        "etf",
        "Quỹ ETF, tổ chức",
        "🏢",
        "crypto",
        r"\b(etfs?|blackrock|fidelity|grayscale|strategy|microstrategy|saylor|treasury firm)\b",
        "BTC, ETH",
    ),
    (
        "reg",
        "Pháp lý crypto",
        "⚖",
        "crypto",
        r"\b(sec|cftc|regulat\w*|lawsuit|stablecoin bill|mica)\b",
        "Toàn thị trường crypto",
    ),
    (
        "hack",
        "Hack, sự cố",
        "🛡",
        "crypto",
        r"\b(hack(ed|s)?|exploit\w*|drain\w*|outage|stolen)\b",
        "Coin bị ảnh hưởng, DeFi",
    ),
]
_CAT_RE = [(c, re.compile(w, re.I)) for c, w in CAT_WORDS]
_TOPIC_RE = [(t[0], re.compile(t[4], re.I), t[3]) for t in TOPICS]
CB_SOURCES = {"Fed", "ECB"}
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


MAJORS = {"USD", "EUR", "JPY", "GBP", "CNY", "AUD", "CAD", "CHF", "NZD"}


def classify(title: str, default: str) -> tuple[str, list[str]]:
    """Trả về (mục, các chủ đề) của một tiêu đề."""
    topics = [tid for tid, rx, _ in _TOPIC_RE if rx.search(title)]
    if default == "crypto":
        return "crypto", topics
    for cat, rx in _CAT_RE:
        if rx.search(title):
            return cat, [t for t in topics if t not in ("btc", "eth", "etf", "reg", "hack")]
    return default, [t for t in topics if t not in ("btc", "eth", "etf", "reg", "hack")]


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
                # giữ tin tác động mạnh của mọi nước và tin trung bình của các đồng tiền lớn
                if impact != "High" and not (impact == "Medium" and country in MAJORS):
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
    evs = sorted(uniq.values(), key=lambda e: e["t"])
    try:  # lịch ForexFactory không có số thực tế: bù từ FXStreet, rồi Nasdaq
        errors += fill_actuals(evs)
    except Exception as exc:
        errors.append(f"số thực tế: {exc}")
    return {"updated": int(time.time() * 1000), "events": evs, "errors": errors}


# ---------- số thực tế của tin đã ra ----------
FXS_URL = "https://calendar-api.fxstreet.com/en/api/v1/eventDates/{}/{}"
NASDAQ_URL = "https://api.nasdaq.com/api/calendar/economicevents?date={}"
# tên nước trong lịch Nasdaq -> mã tiền tệ như ForexFactory
NASDAQ_COUNTRY = {
    "United States": "USD",
    "Euro Zone": "EUR",
    "Euro Area": "EUR",
    "Germany": "EUR",
    "France": "EUR",
    "Italy": "EUR",
    "Spain": "EUR",
    "Japan": "JPY",
    "United Kingdom": "GBP",
    "China": "CNY",
    "Canada": "CAD",
    "Australia": "AUD",
    "New Zealand": "NZD",
    "Switzerland": "CHF",
}
_SYN = [
    (r"\bm/m\b", " mom "),
    (r"\by/y\b", " yoy "),
    (r"\bq/q\b", " qoq "),
    (r"month[- ]over[- ]month|\(mom\)", " mom "),
    (r"year[- ]over[- ]year|\(yoy\)", " yoy "),
    (r"consumer price index", " cpi "),
    (r"producer price index", " ppi "),
    (r"non[- ]?farm (employment change|payrolls)", " nfp "),
    (r"gross domestic product", " gdp "),
    (r"purchasing managers'? index", " pmi "),
    (r"unemployment rate", " unemployment "),
    (r"retail sales", " retail "),
    (r"continuing (jobless )?claims", " continuing claims "),
    (r"(initial )?jobless claims|unemployment claims", " initial claims "),
]
# các chữ phân biệt hai tin khác nhau cùng giờ: lệch nhau là không phải cùng một tin
_STRICT = {"core", "continuing", "initial"}
_PERIOD = {"mom", "yoy", "qoq"}
_SCALE = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}


def _val(x: str) -> tuple[float, str] | None:
    m = re.match(r"\s*(-?[\d,]*\.?\d+)\s*([KMBT%]?)", x or "")
    return (float(m.group(1).replace(",", "")), m.group(2)) if m else None


def _plausible(act: str, ev: dict) -> str | None:
    """Số thực tế phải cùng cỡ với dự báo hoặc kỳ trước: tránh gắn nhầm số của tin khác.
    Nguồn không ghi đơn vị (200 thay vì 200K) thì mượn đơn vị của dự báo."""
    a = _val(act)
    refs = [r for r in (_val(ev.get("forecast", "")), _val(ev.get("previous", ""))) if r]
    if not a or not refs:
        return act
    ref = refs[0]
    if (ref[1] == "%") != (a[1] == "%"):  # tỷ lệ % không ghép với chỉ số mức (338.9)
        return None
    if not a[1] and ref[1] in _SCALE:
        cands = [(a[0], ref[1]), (a[0] / _SCALE[ref[1]], ref[1])]
    else:
        cands = [a]
    for v, unit in cands:
        av = v * _SCALE.get(unit, 1)
        ok = any(
            abs(r[0] * _SCALE.get(r[1], 1)) < 10
            or abs(av) < 10
            or 0.2 <= abs(av) / abs(r[0] * _SCALE.get(r[1], 1)) <= 5
            for r in refs
        )
        if ok:
            if (v, unit) == a:
                return act
            return (f"{v:,.2f}".rstrip("0").rstrip(".") if v % 1 else f"{v:,.0f}") + unit
    return None


def _tokens(title: str) -> set[str]:
    t = " " + title.lower() + " "
    for pat, rep in _SYN:
        t = re.sub(pat, rep, t)
    return {
        w
        for w in re.findall(r"[a-z0-9]+", t)
        if w not in {"the", "of", "s", "and", "sa", "nsa", "prel", "final"}
    }


def _fmt_val(v, unit: str = "") -> str:
    if v is None or v == "":
        return ""
    if isinstance(v, (int, float)):
        s = f"{v:.2f}".rstrip("0").rstrip(".") if abs(v) < 1000 else f"{v:,.0f}"
        return s + (unit or "")
    return str(v).strip()


def parse_fxstreet(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows or []:
        try:
            t = int(
                datetime.fromisoformat(str(r["dateUtc"]).replace("Z", "+00:00")).timestamp() * 1000
            )
        except Exception:
            continue
        act = _fmt_val(r.get("actual"), r.get("unit") or "")
        if act:
            out.append(
                {
                    "t": t,
                    "cur": r.get("currencyCode") or "",
                    "title": r.get("name") or "",
                    "actual": act,
                }
            )
    return out


def parse_nasdaq(raw: dict, day: str) -> list[dict]:
    out = []
    for r in ((raw or {}).get("data") or {}).get("rows") or []:
        act, gmt = (r.get("actual") or "").strip(), (r.get("gmt") or "").strip()
        cur = NASDAQ_COUNTRY.get((r.get("country") or "").strip())
        if not act or act in ("-", "&nbsp;") or not cur or not re.match(r"^\d{1,2}:\d{2}$", gmt):
            continue
        t = int(datetime.fromisoformat(f"{day}T{gmt.zfill(5)}:00+00:00").timestamp() * 1000)
        out.append({"t": t, "cur": cur, "title": r.get("eventName") or "", "actual": act})
    return out


def match_actuals(events: list[dict], found: list[dict]) -> int:
    """Gắn số thực tế cho tin cùng tiền tệ, cùng giờ (lệch ≤ 2 phút), tên giống nhau nhất."""
    n = 0
    for e in events:
        if e.get("actual"):
            continue
        cand = [f for f in found if f["cur"] == e["country"] and abs(f["t"] - e["t"]) <= 120_000]
        if not cand:
            continue
        te = _tokens(e["title"])

        def same(f, te=te):
            tf = _tokens(f["title"])
            pe, pf = te & _PERIOD, tf & _PERIOD
            return (te & _STRICT) == (tf & _STRICT) and not (pe and pf and pe != pf)

        cand = [f for f in cand if same(f)]
        if not cand:
            continue
        best = max(
            cand,
            key=lambda f: len(te & _tokens(f["title"])) / max(1, len(te | _tokens(f["title"]))),
        )
        score = len(te & _tokens(best["title"]))
        act = _plausible(best["actual"], e) if score >= 1 or len(cand) == 1 else None
        if act:
            e["actual"] = act
            n += 1
    return n


def fill_actuals(events: list[dict], now_ms: int | None = None) -> list[str]:
    now_ms = now_ms or int(time.time() * 1000)
    need = [
        e
        for e in events
        if not e.get("actual") and e["t"] < now_ms - 60_000 and e["impact"] in ("High", "Medium")
    ]
    if not need:
        return []
    errors = []
    d0 = datetime.fromtimestamp(min(e["t"] for e in need) / 1000, UTC).strftime(
        "%Y-%m-%dT00:00:00Z"
    )
    d1 = datetime.fromtimestamp(now_ms / 1000, UTC).strftime("%Y-%m-%dT23:59:59Z")
    try:
        req = urllib.request.Request(
            FXS_URL.format(d0, d1),
            headers={
                **BROWSER,
                "Referer": "https://www.fxstreet.com/",
                "Origin": "https://www.fxstreet.com",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            match_actuals(need, parse_fxstreet(json.loads(r.read())))
    except Exception as exc:
        errors.append(f"FXStreet: {exc}")
    days = sorted(
        {
            datetime.fromtimestamp(e["t"] / 1000, UTC).strftime("%Y-%m-%d")
            for e in need
            if not e.get("actual")
        }
    )
    for day in days[-7:]:
        try:
            req = urllib.request.Request(
                NASDAQ_URL.format(day), headers={**BROWSER, "Accept": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                match_actuals(need, parse_nasdaq(json.loads(r.read()), day))
        except Exception as exc:
            errors.append(f"Nasdaq {day}: {exc}")
    return errors


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child(el, *names: str):
    for x in el:
        if _local(x.tag) in names:
            return x
    return None


def _ctext(el, *names: str) -> str:
    x = _child(el, *names)
    return (x.text or "").strip() if x is not None and x.text else ""


def parse_feed(raw: bytes) -> list[tuple[str, str, str]]:
    """(tiêu đề, đường dẫn, thời gian) từ RSS 2.0, RSS 1.0 (RDF) hoặc Atom, không phụ thuộc namespace."""
    out = []
    for it in ET.fromstring(raw).iter():
        if _local(it.tag) not in ("item", "entry"):
            continue
        title = re.sub(r"\s+", " ", _ctext(it, "title"))
        link = _ctext(it, "link")
        if not link:
            ln = _child(it, "link")
            link = (ln.get("href") or "").strip() if ln is not None else ""
        pub = _ctext(it, "pubDate", "published", "updated", "date")
        if title and link:
            out.append((title, link, pub))
    return out


def _when(pub: str) -> int:
    try:
        return int(parsedate_to_datetime(pub).timestamp() * 1000)
    except Exception:
        pass
    try:
        return int(datetime.fromisoformat(pub.replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        return int(time.time() * 1000)


def _one_feed(feed) -> tuple[list[dict], str | None]:
    source, url, default = feed
    try:
        rows = parse_feed(_get(url, timeout=8))
    except Exception as exc:
        return [], f"{source}: {exc}"
    items = []
    for title, link, pub in rows[:60]:
        src = source
        if source == "Google News" and " - " in title:
            # Google News ghi tên báo ở cuối tiêu đề: "Tiêu đề - Reuters"
            title, src = title.rsplit(" - ", 1)
        cat, topics = classify(title, default)
        hot = bool(HOT.search(title)) or source in CB_SOURCES
        coins = (
            [c for c in COINS if re.search(COIN_WORDS[c], title, re.I)] if cat == "crypto" else []
        )
        items.append(
            {
                "t": _when(pub),
                "title": title,
                "link": link,
                "source": src,
                "cat": cat,
                "topics": topics,
                "hot": hot,
                "coins": coins,
            }
        )
    return items, None


def fetch_news(per_cat: int = 80) -> dict:
    """Lấy mọi nguồn cùng lúc (16 luồng): nguồn chậm hay bị chặn không làm chậm nguồn khác."""
    items, errors = [], []
    with ThreadPoolExecutor(16) as ex:
        for got, err in ex.map(_one_feed, FEEDS):
            items += got
            if err:
                errors.append(err)
    now = int(time.time() * 1000)
    items = [x for x in items if x["t"] <= now + 3_600_000]  # bỏ tin ghi giờ tương lai
    seen, out, per = set(), [], {c: 0 for c in CATS}
    for it in sorted(items, key=lambda x: -x["t"]):
        key = re.sub(r"\W+", " ", it["title"].lower())[:80]
        if key in seen or per[it["cat"]] >= per_cat:
            continue
        seen.add(key)
        per[it["cat"]] += 1
        out.append(it)
    topics = [{"id": t[0], "name": t[1], "icon": t[2], "cat": t[3], "assets": t[5]} for t in TOPICS]
    return {"updated": int(time.time() * 1000), "items": out, "topics": topics, "errors": errors}


# ---------- phản ứng giá sau tin (Yahoo Finance, nến 5 phút, chậm khoảng 15 phút) ----------
ASSETS = [
    ("DXY", "DX-Y.NYB"),
    ("Vàng", "GC=F"),
    ("Dầu WTI", "CL=F"),
    ("Lợi suất 10 năm", "^TNX"),
    ("S&P 500", "ES=F"),
    ("BTC", "BTC-USD"),
]
HORIZONS = [15, 30, 60]


def _yahoo_5m(symbol: str, rng: str = "5d") -> list[tuple[int, float]]:
    q = urllib.parse.quote(symbol)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{q}?range={rng}&interval=5m"
    r = json.loads(_get(url))["chart"]["result"][0]
    ts, closes = r.get("timestamp") or [], r["indicators"]["quote"][0].get("close") or []
    return [(int(t) * 1000, c) for t, c in zip(ts, closes, strict=False) if c is not None]


def _at(series: list[tuple[int, float]], t: int) -> float | None:
    """Giá đóng cửa của nến 5 phút cuối cùng bắt đầu trước thời điểm t (trong vòng 30 phút)."""
    best = None
    for ts, c in series:
        if ts + 5 * 60_000 <= t + 1:
            best = (ts, c)
        else:
            break
    return best[1] if best and t - best[0] <= 35 * 60_000 else None


def _num(x: str) -> float | None:
    m = re.match(r"\s*(-?[\d.]+)\s*([KMBT%]?)", x or "")
    return float(m.group(1)) if m else None


def reactions(events: list[dict], now_ms: int | None = None) -> dict:
    """Với mỗi tin mạnh đã ra trong 5 ngày, đo các tài sản chạy bao nhiêu % sau 15, 30, 60 phút.
    Lợi suất đo bằng điểm cơ bản (bp)."""
    now_ms = now_ms or int(time.time() * 1000)
    past = [
        e
        for e in events
        if e["impact"] == "High"
        and e["country"] in MAJORS
        and now_ms - 5 * 86400_000 < e["t"] < now_ms - 15 * 60_000
    ]
    series, errors = {}, []
    if past:
        for name, sym in ASSETS:
            try:
                series[name] = _yahoo_5m(sym)
            except Exception as exc:
                errors.append(f"{name}: {exc}")
    out = []
    for e in past:
        moves = {}
        for name, _ in ASSETS:
            s = series.get(name)
            if not s:
                continue
            p0 = _at(s, e["t"])
            if not p0:
                continue
            row = {}
            for h in HORIZONS:
                if e["t"] + h * 60_000 > now_ms:
                    continue
                p1 = _at(s, e["t"] + h * 60_000)
                if p1:
                    row[str(h)] = (
                        round((p1 - p0) * 100, 1)
                        if name == "Lợi suất 10 năm"
                        else round((p1 / p0 - 1) * 100, 3)
                    )
            if row:
                moves[name] = row
        a, f = _num(e.get("actual", "")), _num(e.get("forecast", ""))
        surprise = None if a is None or f is None else (1 if a > f else -1 if a < f else 0)
        out.append({**e, "surprise": surprise, "moves": moves})
    return {
        "updated": now_ms,
        "assets": [a for a, _ in ASSETS],
        "horizons": HORIZONS,
        "events": out,
        "errors": errors,
    }


def merge_history(old: dict | None, new: dict, keep_days: int = 400) -> dict:
    """Giữ lại phản ứng của các lần ra tin trước để tính phản ứng trung bình theo từng loại tin."""
    cutoff = new["updated"] - keep_days * 86400_000
    rows = {
        f"{e['t']}|{e['country']}|{e['title']}": e
        for e in (old or {}).get("events", [])
        if e["t"] > cutoff
    }
    for e in new["events"]:
        if e["moves"]:
            rows[f"{e['t']}|{e['country']}|{e['title']}"] = e
    return {**new, "events": sorted(rows.values(), key=lambda e: -e["t"])}


_cache: dict[str, tuple[float, dict]] = {}


def cached(name: str, ttl: float = 600) -> dict:
    """Dùng cho máy chủ trên laptop: lấy lại tối đa mỗi 10 phút."""
    now = time.time()
    if name in _cache and now - _cache[name][0] < ttl:
        return _cache[name][1]
    if name == "reactions":
        data = reactions(cached("calendar")["events"])
    else:
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
    rp = out / "reactions.json"
    try:
        old = json.loads(rp.read_text(encoding="utf-8")) if rp.exists() else None
    except Exception:
        old = None
    re_ = merge_history(old, reactions(cal["events"]))
    c = _write_if_changed(rp, re_, "events")
    print(
        f"lịch: {len(cal['events'])} sự kiện {'(đã ghi)' if a else '(không đổi)'}; "
        f"tin: {len(news['items'])} {'(đã ghi)' if b else '(không đổi)'}; "
        f"phản ứng: {len(re_['events'])} {'(đã ghi)' if c else '(không đổi)'}"
    )
    for e in cal["errors"] + news["errors"] + re_["errors"]:
        print("lỗi:", e)
