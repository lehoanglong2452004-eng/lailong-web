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

UA = {"User-Agent": "Mozilla/5.0 (LaiLongDesk news fetcher)"}
# vài API lịch kinh tế chỉ trả lời trình duyệt thật
BROWSER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
}
CALENDAR_URLS = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
]
# (nguồn, đường dẫn, mục mặc định); mục thật của từng tin còn được chỉnh lại theo từ khoá.
# Nguồn nào bị chặn hay quá chậm chỉ bị bỏ qua sau vài giây, không làm chậm nguồn khác.
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
    # Trung Quốc, bản tiếng Anh (Caixin, SCMP, Yicai, China Daily, CGTN, Global Times)
    ("SCMP", "https://www.scmp.com/rss/92/feed", "fin"),
    ("SCMP", "https://www.scmp.com/rss/4/feed", "geo"),
    ("China Daily", "https://www.chinadaily.com.cn/rss/bizchina_rss.xml", "econ"),
    ("CGTN", "https://www.cgtn.com/subscribe/rss/section/business.xml", "econ"),
    ("Global Times", "https://www.globaltimes.cn/rss/outbrain.xml", "geo"),
    ("Google News", GN + "site:caixinglobal.com+when:2d", "econ"),
    ("Google News", GN + "site:yicaiglobal.com+when:2d", "fin"),
    ("Google News", GN + "site:scmp.com+(economy+OR+markets+OR+yuan+OR+PBOC)+when:1d", "econ"),
    (
        "Google News",
        GN + "China+(PBOC+OR+yuan+OR+%22property%22+OR+stimulus+OR+exports)+when:1d",
        "econ",
    ),
]

# Không bao giờ dùng tin của tác giả, báo hay tổ chức Việt Nam, kể cả tin tiếng Việt. Tin bị bỏ khi tên nguồn hay tên miền
# là của Việt Nam (đuôi .vn, vn.investing.com, VnExpress, CafeF, Tuổi Trẻ…) hoặc tiêu đề có dấu tiếng Việt.
# Google News ghi tên báo ở cuối tiêu đề, nên tin Google News lấy từ báo Việt Nam cũng bị bỏ.
# web/js/newsdigest.js lọc lại y như vậy trên trình duyệt.
_VN_CHARS = re.compile("[ăđơưĂĐƠƯ\u1ea0-\u1ef9]")
_VN_WORDS = re.compile(
    r"\b(viet\s?nam\w*|cafef|cafebiz|vnexpress|vietstock|vneconomy|vnanet|tuoi\s?tre|thanh\s?nien|dan\s?tri|znews|"
    r"zing\s?news|kenh14|ttxvn|bnews|baodautu|tinnhanhchungkhoan|saigon\w*|hanoi\w*|markettimes|petrotimes|"
    r"nhan\s?dan|lao\s?dong|tien\s?phong)\b",
    re.I,
)
# tên ngắn chỉ tính khi là cả tên nguồn, để không bắt nhầm chữ trong tên báo nước ngoài
_VN_NAMES = set("vn vtv vov vtc vir plo sggp nld soha 24h vndirect ssi fiingroup cand qdnd".split())
_VN_NAMES |= {"vtc news", "the investor"}


def is_vietnamese(item: dict) -> bool:
    """Tin của báo, tác giả, tổ chức Việt Nam hoặc viết bằng tiếng Việt."""
    src = (item.get("source") or "").strip()
    host = (urllib.parse.urlparse(item.get("link") or "").hostname or "").lower()
    return bool(
        _VN_CHARS.search(src)
        or len(_VN_CHARS.findall(item.get("title") or "")) >= 2
        or src.lower() in _VN_NAMES
        or _VN_WORDS.search(src)
        or host.endswith(".vn")
        or host.startswith("vn.")
        or _VN_WORDS.search(host.replace(".", " "))
    )


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


# ---------- tin nhanh Trung Quốc (7x24) mà trader, nhà phân tích bên đó theo dõi ----------
# Kim Thập (Jin10), Tài Liên Xã (Cailian), Hoa Nhĩ Nhai Kiến Văn (Wallstreetcn), Sina 7x24, Eastmoney 7x24.
# Đều là API JSON công khai mà chính trang web của họ gọi. Tiêu đề tiếng Trung được dịch sang tiếng Anh
# (Google Translate, bản miễn phí) để xếp mục theo từ khoá như mọi tin khác; bản gốc giữ ở "orig".
# Dịch lỗi thì giữ tiếng Trung và xếp mục theo từ khoá tiếng Trung (CN_CAT_WORDS).
CN_TZ = 8 * 3600  # giờ Bắc Kinh
CN_PER_SOURCE = 50
JIN10 = {"x-app-id": "bVBF4FyRTn5NJF5n", "x-version": "1.0.0", "Referer": "https://www.jin10.com/"}
CN_CAT_WORDS = [
    ("metal", "黄金|白银|金价|银价|铜价|铂|钯|贵金属|锂|镍"),
    ("energy", "原油|石油|布伦特|欧佩克|OPEC|天然气|LNG|汽油|柴油|炼油|能源"),
    (
        "geo",
        "战争|军事|导弹|空袭|制裁|伊朗|以色列|加沙|乌克兰|俄罗斯|台湾|北约|停火|霍尔木兹|胡塞|朝鲜|地缘|入侵",
    ),
    (
        "econ",
        "通胀|CPI|PPI|PCE|GDP|非农|失业|零售销售|PMI|美联储|FOMC|欧洲央行|日本央行|英国央行|央行|人民银行|"
        "利率|降息|加息|降准|LPR|MLF|逆回购|经济|关税|衰退",
    ),
    ("crypto", "比特币|以太坊|加密货币|数字货币|BTC|ETH|稳定币"),
    (
        "fin",
        "股|A股|港股|美股|恒指|恒生|沪指|深成指|创业板|债|收益率|国债|银行|财报|IPO|美元|人民币|汇率|日元|欧元",
    ),
]
_CN_CAT_RE = [(c, re.compile(w)) for c, w in CN_CAT_WORDS]
CN_HOT = re.compile(
    "美联储|降息|加息|降准|关税|制裁|特朗普|鲍威尔|暴跌|暴涨|熔断|创历史新高|突发|紧急"
)
_CN_CHARS = re.compile("[\u4e00-\u9fff]")
_TAGS = re.compile(r"<[^>]+>")


def _cn_text(content: str, title: str = "", limit: int = 160) -> str:
    """Tiêu đề ngắn từ một tin nhanh: lấy phần 【…】 nếu có, không thì câu đầu, cắt ở `limit` chữ."""
    content = _TAGS.sub("", content or "").replace("&nbsp;", " ").strip()
    title = _TAGS.sub("", title or "").strip()
    m = re.match(r"^\s*【([^】]{4,})】", content)
    text = title or (m.group(1) if m else content)
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _cn_time(s: str) -> int:
    """'2026-11-04 18:49:00' giờ Bắc Kinh → mili giây UTC."""
    dt = datetime.strptime(s.strip()[:19], "%Y-%m-%d %H:%M:%S")
    return int((dt.replace(tzinfo=UTC).timestamp() - CN_TZ) * 1000)


def _get_json(url: str, headers: dict | None = None, timeout: float = 8):
    req = urllib.request.Request(url, headers={**BROWSER, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def parse_jin10(raw: dict) -> list[dict]:
    out = []
    for x in raw.get("data") or []:
        d = x.get("data") or {}
        text = _cn_text(d.get("content") or "", d.get("title") or "")
        if text and x.get("time"):
            link = d.get("link") or f"https://flash.jin10.com/detail/{x.get('id')}"
            out.append(
                {
                    "t": _cn_time(x["time"]),
                    "orig": text,
                    "link": link,
                    "imp": bool(x.get("important")),
                }
            )
    return out


def parse_cls(raw: dict) -> list[dict]:
    out = []
    for x in (raw.get("data") or {}).get("roll_data") or []:
        text = _cn_text(x.get("content") or x.get("brief") or "", x.get("title") or "")
        if text and x.get("ctime"):
            out.append(
                {
                    "t": int(x["ctime"]) * 1000,
                    "orig": text,
                    "link": f"https://www.cls.cn/detail/{x.get('id')}",
                    "imp": x.get("level") in ("A", "B"),
                }
            )
    return out


def parse_wscn(raw: dict) -> list[dict]:
    out = []
    for x in (raw.get("data") or {}).get("items") or []:
        text = _cn_text(x.get("content_text") or x.get("content") or "", x.get("title") or "")
        if text and x.get("display_time"):
            link = x.get("uri") or f"https://wallstreetcn.com/livenews/{x.get('id')}"
            out.append(
                {
                    "t": int(x["display_time"]) * 1000,
                    "orig": text,
                    "link": link,
                    "imp": (x.get("score") or 0) >= 2,
                }
            )
    return out


def parse_sina(raw: dict) -> list[dict]:
    feed = (((raw.get("result") or {}).get("data") or {}).get("feed") or {}).get("list") or []
    out = []
    for x in feed:
        text = _cn_text(x.get("rich_text") or "")
        if text and x.get("create_time"):
            link = (
                x.get("docurl")
                or f"https://finance.sina.com.cn/7x24/notification.shtml?id={x.get('id')}"
            )
            tags = " ".join(t.get("name", "") for t in x.get("tag") or [] if isinstance(t, dict))
            out.append(
                {"t": _cn_time(x["create_time"]), "orig": text, "link": link, "imp": "焦点" in tags}
            )
    return out


def parse_eastmoney(raw: dict) -> list[dict]:
    out = []
    for x in (raw.get("data") or {}).get("fastNewsList") or []:
        text = _cn_text(x.get("summary") or "", x.get("title") or "")
        if text and x.get("showTime"):
            link = f"https://finance.eastmoney.com/a/{x.get('code')}.html"
            out.append({"t": _cn_time(x["showTime"]), "orig": text, "link": link, "imp": False})
    return out


# (nguồn, đường dẫn, header riêng, hàm đọc, mục mặc định)
CN_FEEDS = [
    (
        "Jin10",
        "https://flash-api.jin10.com/get_flash_list?channel=-8200&vip=1",
        JIN10,
        parse_jin10,
        "econ",
    ),
    (
        "Cailian",
        f"https://www.cls.cn/nodeapi/updateTelegraphList?app=CailianpressWeb&os=web&rn={CN_PER_SOURCE}",
        {"Referer": "https://www.cls.cn/telegraph"},
        parse_cls,
        "fin",
    ),
    (
        "Wallstreetcn",
        f"https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&limit={CN_PER_SOURCE}",
        {"Referer": "https://wallstreetcn.com/"},
        parse_wscn,
        "econ",
    ),
    (
        "Sina 7x24",
        f"https://zhibo.sina.com.cn/api/zhibo/feed?page=1&page_size={CN_PER_SOURCE}&zhibo_id=152",
        {"Referer": "https://finance.sina.com.cn/7x24/"},
        parse_sina,
        "econ",
    ),
    (
        "Eastmoney",
        "https://np-weblist.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724"
        f"&fastColumn=102&sortEnd=&pageSize={CN_PER_SOURCE}&req_trace=lailong",
        {"Referer": "https://kuaixun.eastmoney.com/"},
        parse_eastmoney,
        "fin",
    ),
]
TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t"


def translate_zh(texts: list[str], chunk: int = 3000) -> list[str | None]:
    """Dịch nhiều câu tiếng Trung sang tiếng Anh, gộp thành từng gói ~3000 chữ, mỗi câu một dòng.
    Gói nào lỗi hay số dòng trả về không khớp thì các câu trong gói đó là None."""
    out: list[str | None] = [None] * len(texts)
    batches, cur, size = [], [], 0
    for i, t in enumerate(texts):
        if cur and size + len(t) > chunk:
            batches.append(cur)
            cur, size = [], 0
        cur.append(i)
        size += len(t) + 1

    if cur:
        batches.append(cur)

    def one(idx: list[int]) -> None:
        body = urllib.parse.urlencode(
            {"q": "\n".join(texts[i].replace("\n", " ") for i in idx)}
        ).encode()
        req = urllib.request.Request(TRANSLATE_URL, data=body, headers=BROWSER)
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                raw = json.loads(r.read())
            lines = "".join(seg[0] for seg in raw[0] if seg and seg[0]).split("\n")
        except Exception:
            return
        if len(lines) == len(idx):
            for i, line in zip(idx, lines, strict=True):
                out[i] = line.strip() or None

    with ThreadPoolExecutor(4) as ex:
        list(ex.map(one, batches))
    return out


def _cn_classify(text: str, default: str) -> str:
    for cat, rx in _CN_CAT_RE:
        if rx.search(text):
            return cat
    return default


def _one_cn(feed) -> tuple[list[dict], str | None]:
    source, url, headers, parse, default = feed
    try:
        rows = parse(_get_json(url, headers))
    except Exception as exc:
        return [], f"{source}: {exc}"
    return [{**r, "source": source, "default": default} for r in rows[:CN_PER_SOURCE]], None


def fetch_cn(translate: bool = True) -> tuple[list[dict], list[str]]:
    """Tin nhanh của các nguồn Trung Quốc, đã dịch và xếp mục. Trả về (tin, lỗi)."""
    rows, errors = [], []
    with ThreadPoolExecutor(len(CN_FEEDS)) as ex:
        for got, err in ex.map(_one_cn, CN_FEEDS):
            rows += got
            if err:
                errors.append(err)
    # cùng một tin thường ra ở vài nguồn: gộp theo 24 chữ Hán đầu, giữ bản ra sớm nhất
    seen, uniq = set(), []
    for r in sorted(rows, key=lambda r: r["t"]):
        key = "".join(_CN_CHARS.findall(r["orig"]))[:24] or r["orig"][:40]
        if key in seen:
            continue
        seen.add(key)
        uniq.append(r)
    en = translate_zh([r["orig"] for r in uniq]) if translate and uniq else [None] * len(uniq)
    if uniq and translate and not any(en):
        errors.append("Dịch tin Trung Quốc lỗi: giữ tiêu đề tiếng Trung")
    items = []
    for r, title in zip(uniq, en, strict=True):
        if title:
            cat, topics = classify(title, r["default"])
            if cat == r["default"]:
                cat = _cn_classify(r["orig"], r["default"])
        else:
            title, cat, topics = r["orig"], _cn_classify(r["orig"], r["default"]), []
        hot = r["imp"] or bool(HOT.search(title)) or bool(CN_HOT.search(r["orig"]))
        coins = (
            [c for c in COINS if re.search(COIN_WORDS[c], title, re.I)] if cat == "crypto" else []
        )
        items.append(
            {
                "t": r["t"],
                "title": title,
                "orig": r["orig"],
                "link": r["link"],
                "source": r["source"],
                "cn": True,
                "cat": cat,
                "topics": topics,
                "hot": hot,
                "coins": coins,
            }
        )
    return items, errors


# ---------- Đông ↔ Tây: báo Trung Quốc nói gì về phương Tây và ngược lại ----------
# Bên Đông: tin nhanh Trung Quốc (cn) và báo Trung Quốc, Hồng Kông viết tiếng Anh. Còn lại là bên Tây.
# Tin bên Đông nhắc tới Mỹ, châu Âu là "Đông nói về Tây"; tin bên Tây nhắc tới Trung Quốc là "Tây nói về Đông".
# Giọng căng hay dịu chỉ đếm từ khoá trong tiêu đề, là chỉ báo thô chứ không phải phân tích ngữ nghĩa.
EAST_SOURCES = {
    "scmp", "south china morning post", "china daily", "cgtn", "global times", "caixin global", "caixin",
    "yicai global", "yicai", "xinhua", "people's daily", "chinadaily.com.cn", "the standard",
}  # fmt: skip
WEST_EN = re.compile(
    r"\b(U\.?S\.?|USA|America\w*|Washington|White House|Trump|Biden|Fed|Powell|Treasury|Congress|"
    r"Pentagon|EU|European|Europe|Brussels|NATO|Britain|UK|Germany|France|G7|West\w*)\b"
)
WEST_ZH = re.compile(
    "美国|美方|美联储|特朗普|白宫|华盛顿|美债|美财长|五角大楼|国会|欧盟|欧洲|英国|德国|法国|北约|七国集团|西方"
)
EAST_EN = re.compile(
    r"\b(China|Chinese|Beijing|Xi|PBOC|PBoC|yuan|renminbi|Hong Kong|Shanghai|Shenzhen|Taiwan\w*|CCP|"
    r"Huawei|Alibaba|Tencent|BYD|Sino\w*)\b"
)
TENSE = re.compile(
    r"\b(sanction\w*|tariff\w*|ban(s|ned)?|curb\w*|restrict\w*|blacklist\w*|export controls?|threat\w*|"
    r"warn\w*|retaliat\w*|condemn\w*|tension\w*|probe|accus\w*|crackdown|decoupl\w*|spy\w*|"
    r"military|drills?|escalat\w*|trade war)\b|制裁|关税|禁令|限制|出口管制|威胁|警告|反制|报复|谴责|紧张|调查|指责|打压|脱钩|军演|升级|贸易战",
    re.I,
)
EASE = re.compile(
    r"\b(talks?|deal|agree\w*|truce|cooperat\w*|dialogue|meet(s|ing)?|summit|eas(e|es|ing)|"
    r"exempt\w*|thaw|visit\w*|resum\w*|purchase\w*|lift\w*|pause\w*|extend\w*)\b|会谈|会晤|协议|达成|休战|合作|对话|峰会|缓和|豁免|访问|恢复|采购|取消|暂停|延长",
    re.I,
)


def side_of(item: dict) -> str:
    src = (item.get("source") or "").strip().lower()
    return "east" if item.get("cn") or src in EAST_SOURCES else "west"


def tag_east_west(item: dict) -> str | None:
    """'e2w' nếu bên Đông nói về phương Tây, 'w2e' nếu bên Tây nói về Trung Quốc, không thì None."""
    title, orig = item.get("title") or "", item.get("orig") or ""
    if side_of(item) == "east":
        return "e2w" if WEST_EN.search(title) or WEST_ZH.search(orig) else None
    return "w2e" if EAST_EN.search(title) else None


def east_west(items: list[dict], now: int | None = None, hours: int = 24) -> dict:
    """Tổng hợp 24 giờ: mỗi chiều bao nhiêu tin, chủ đề nào, giọng căng (−) hay dịu (+), vài tin mới nhất."""
    now = now or int(time.time() * 1000)
    out = {}
    for k in ("e2w", "w2e"):
        rows = [x for x in items if x.get("ew") == k and now - x["t"] <= hours * 3_600_000]
        tense = sum(1 for x in rows if TENSE.search(x["title"] + " " + (x.get("orig") or "")))
        ease = sum(1 for x in rows if EASE.search(x["title"] + " " + (x.get("orig") or "")))
        topics: dict[str, int] = {}
        for x in rows:
            for t in x.get("topics") or []:
                topics[t] = topics.get(t, 0) + 1
        srcs: dict[str, int] = {}
        for x in rows:
            srcs[x["source"]] = srcs.get(x["source"], 0) + 1
        out[k] = {
            "n": len(rows),
            "tense": tense,
            "ease": ease,
            # −100 (toàn tin căng) .. +100 (toàn tin dịu)
            "tone": round(100 * (ease - tense) / max(tense + ease, 1)),
            "topics": sorted(topics.items(), key=lambda kv: -kv[1])[:6],
            "sources": sorted(srcs.items(), key=lambda kv: -kv[1])[:6],
        }
    return out


def fetch_news(per_cat: int = 150) -> dict:
    """Lấy mọi nguồn cùng lúc (16 luồng): nguồn chậm hay bị chặn không làm chậm nguồn khác."""
    items, errors = [], []
    with ThreadPoolExecutor(16) as ex:
        cn = ex.submit(fetch_cn)
        for got, err in ex.map(_one_feed, FEEDS):
            items += got
            if err:
                errors.append(err)
        got, errs = cn.result()
        items += got
        errors += errs
    now = int(time.time() * 1000)
    # bỏ tin ghi giờ tương lai và mọi tin của Việt Nam
    items = [x for x in items if x["t"] <= now + 3_600_000 and not is_vietnamese(x)]
    seen, out, per = set(), [], {c: 0 for c in CATS}
    for it in sorted(items, key=lambda x: -x["t"]):
        key = re.sub(r"\W+", " ", it["title"].lower())[:80]
        if key in seen or per[it["cat"]] >= per_cat:
            continue
        seen.add(key)
        per[it["cat"]] += 1
        out.append(it)
    for it in out:
        ew = tag_east_west(it)
        if ew:
            it["ew"] = ew
    topics = [{"id": t[0], "name": t[1], "icon": t[2], "cat": t[3], "assets": t[5]} for t in TOPICS]
    return {
        "updated": int(time.time() * 1000),
        "items": out,
        "topics": topics,
        "eastwest": east_west(out, now),
        "errors": errors,
    }


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
