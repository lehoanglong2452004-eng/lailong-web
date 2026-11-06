"""Mạng xã hội: chuyên gia, nhà đầu tư, trader, tổ chức lớn đang nói gì về thị trường.

Chỉ dùng nguồn miễn phí, không cần khoá API:
  - Bluesky: API công khai public.api.bsky.app;
  - Substack, blog, trang nghiên cứu của tổ chức: RSS / Atom;
  - YouTube: RSS của kênh;
  - chỉ số tâm lý: Fear & Greed của CNN (chứng khoán Mỹ) và alternative.me (crypto).
X (Twitter) thu phí lấy dữ liệu nên không dùng.

Danh sách người theo dõi nằm trong SOURCES; bậc tin cậy:
  A = tổ chức chính thức (ngân hàng trung ương, quỹ, ngân hàng đầu tư, IMF),
  B = chuyên gia có tên tuổi đã đối chiếu tài khoản với trang của chính họ hoặc tổ chức của họ,
  C = trader / nhà phân tích độc lập nổi tiếng.
Không bao giờ dùng tác giả, tổ chức hay nội dung tiếng Việt (lọc bằng news.is_vietnamese).

Chạy tay: python social.py <thư mục ra>
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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import news  # noqa: E402

# nhóm hiển thị bên trái trang Mạng xã hội
GROUPS = {
    "inst": "Tổ chức lớn",
    "macro": "Nhà kinh tế vĩ mô",
    "fund": "Nhà đầu tư, quỹ",
    "trader": "Trader, phân tích độc lập",
    "crypto": "Crypto",
    "cb": "Ngân hàng trung ương",
    "media": "Phỏng vấn, kênh tài chính",
}
# (id, tên, vai trò, nhóm, bậc, nền tảng, địa chỉ, thị trường hay nói tới)
# nền tảng: bsky (địa chỉ là handle), rss (địa chỉ là link feed), yt (địa chỉ là channel id)
SOURCES = [
    # tổ chức lớn
    (
        "apollo",
        "Torsten Sløk",
        "Kinh tế trưởng, Apollo Global",
        "inst",
        "A",
        "rss",
        "https://www.apolloacademy.com/feed/",
        "macro stocks bonds",
    ),
    (
        "imf",
        "IMF Blog",
        "Quỹ Tiền tệ Quốc tế",
        "inst",
        "A",
        "rss",
        "https://www.imf.org/en/Blogs/rss",
        "macro fx",
    ),
    (
        "bis",
        "BIS",
        "Ngân hàng Thanh toán Quốc tế: bài phát biểu",
        "inst",
        "A",
        "rss",
        "https://www.bis.org/doclist/cbspeeches.rss",
        "macro",
    ),
    (
        "coinshares",
        "CoinShares",
        "Dòng tiền quỹ crypto hằng tuần",
        "inst",
        "A",
        "rss",
        "https://blog.coinshares.com/feed",
        "crypto",
    ),
    (
        "glassnode",
        "Glassnode",
        "Phân tích on-chain",
        "inst",
        "A",
        "rss",
        "https://insights.glassnode.com/rss/",
        "crypto",
    ),
    (
        "eia",
        "EIA",
        "Cơ quan Năng lượng Mỹ",
        "inst",
        "A",
        "rss",
        "https://www.eia.gov/rss/todayinenergy.xml",
        "energy",
    ),
    # nhà kinh tế vĩ mô
    (
        "krugman",
        "Paul Krugman",
        "Nobel kinh tế 2008",
        "macro",
        "B",
        "rss",
        "https://paulkrugman.substack.com/feed",
        "macro",
    ),
    (
        "tooze",
        "Adam Tooze",
        "Giáo sư sử học kinh tế, Columbia",
        "macro",
        "B",
        "rss",
        "https://adamtooze.substack.com/feed",
        "macro",
    ),
    (
        "noahpinion",
        "Noah Smith",
        "Nhà kinh tế, Noahpinion",
        "macro",
        "B",
        "rss",
        "https://www.noahpinion.blog/feed",
        "macro",
    ),
    (
        "calcrisk",
        "Calculated Risk",
        "Bill McBride: nhà ở, việc làm Mỹ",
        "macro",
        "B",
        "rss",
        "https://www.calculatedriskblog.com/feeds/posts/default",
        "macro",
    ),
    (
        "wolfers",
        "Justin Wolfers",
        "Giáo sư kinh tế, Đại học Michigan",
        "macro",
        "B",
        "bsky",
        "justinwolfers.bsky.social",
        "macro",
    ),
    (
        "furman",
        "Jason Furman",
        "Giáo sư Harvard, cựu Chủ tịch Hội đồng Cố vấn Kinh tế Mỹ",
        "macro",
        "B",
        "bsky",
        "jasonfurman.bsky.social",
        "macro",
    ),
    (
        "politano",
        "Joseph Politano",
        "Apricitas Economics: dữ liệu vĩ mô Mỹ",
        "macro",
        "B",
        "bsky",
        "josephpolitano.bsky.social",
        "macro",
    ),
    (
        "sahm",
        "Claudia Sahm",
        "Cha đẻ chỉ báo suy thoái Sahm Rule",
        "macro",
        "B",
        "bsky",
        "claudia-sahm.bsky.social",
        "macro",
    ),
    # nhà đầu tư, quỹ
    (
        "alden",
        "Lyn Alden",
        "Lyn Alden Investment Strategy",
        "fund",
        "B",
        "rss",
        "https://www.lynalden.com/feed/",
        "macro stocks gold crypto",
    ),
    (
        "doomberg",
        "Doomberg",
        "Năng lượng và hàng hoá",
        "fund",
        "B",
        "rss",
        "https://doomberg.substack.com/feed",
        "energy commodities",
    ),
    (
        "bitmex",
        "BitMEX Research",
        "Nghiên cứu của sàn BitMEX: on-chain, phái sinh crypto",
        "crypto",
        "A",
        "rss",
        "https://blog.bitmex.com/feed/",
        "crypto",
    ),
    # trader, phân tích độc lập
    (
        "kyla",
        "Kyla Scanlon",
        "Bình luận thị trường và tâm lý",
        "trader",
        "C",
        "rss",
        "https://kyla.substack.com/feed",
        "stocks macro",
    ),
    (
        "macrocompass",
        "Alfonso Peccatiello",
        "The Macro Compass, cựu trưởng đầu tư ING",
        "trader",
        "B",
        "rss",
        "https://themacrocompass.substack.com/feed",
        "macro bonds fx",
    ),
    # crypto
    (
        "hayes",
        "Arthur Hayes",
        "Đồng sáng lập BitMEX, Maelstrom",
        "crypto",
        "B",
        "rss",
        "https://cryptohayes.substack.com/feed",
        "crypto macro",
    ),
    # ngân hàng trung ương (bài phát biểu)
    (
        "fed",
        "Fed",
        "Bài phát biểu của thành viên Fed",
        "cb",
        "A",
        "rss",
        "https://www.federalreserve.gov/feeds/speeches.xml",
        "macro fx bonds",
    ),
    (
        "ecb",
        "ECB",
        "Bài phát biểu của ECB",
        "cb",
        "A",
        "rss",
        "https://www.ecb.europa.eu/rss/press.html",
        "macro fx",
    ),
    (
        "boe",
        "BoE",
        "Tin và bài phát biểu của BoE",
        "cb",
        "A",
        "rss",
        "https://www.bankofengland.co.uk/rss/speeches",
        "macro fx",
    ),
    (
        "boj",
        "BoJ",
        "Tin mới của BoJ",
        "cb",
        "A",
        "rss",
        "https://www.boj.or.jp/en/rss/whatsnew.xml",
        "macro fx",
    ),
    # phỏng vấn trên kênh tài chính lớn
    (
        "bbgtv",
        "Bloomberg Television",
        "Phỏng vấn nhà đầu tư, CEO, quan chức",
        "media",
        "A",
        "yt",
        "UCIALMKvObZNtJ6AmdCLP7Lg",
        "stocks macro",
    ),
    (
        "cnbctv",
        "CNBC Television",
        "Squawk Box, Fast Money, Closing Bell",
        "media",
        "A",
        "yt",
        "UCrp_UI8XtuYfpiqluWLD7Lw",
        "stocks macro",
    ),
    (
        "yahoofin",
        "Yahoo Finance",
        "Phỏng vấn và bình luận thị trường",
        "media",
        "A",
        "yt",
        "UCEAZeUIeJs0IjQiqTCdVSIg",
        "stocks macro",
    ),
]
TIERS = {
    "A": "Tổ chức chính thức",
    "B": "Chuyên gia đã xác minh",
    "C": "Phân tích độc lập nổi tiếng",
}
MARKETS = {
    "stocks": "Chứng khoán",
    "fx": "Forex / USD",
    "gold": "Vàng",
    "energy": "Dầu, năng lượng",
    "crypto": "Crypto",
    "bonds": "Trái phiếu",
    "macro": "Vĩ mô",
    "commodities": "Hàng hoá",
}

# ---------- nghiêng tích cực / tiêu cực theo từ khoá (thô, chỉ để đếm xu hướng chung) ----------
_ASSET = [
    ("stocks", r"\b(stocks?|equit\w+|s&p|nasdaq|dow|spx|shares|kospi|nikkei|dax)\b"),
    ("fx", r"\b(dollar|usd|dxy|yen|euro|sterling|currenc\w+)\b"),
    ("gold", r"\b(gold|bullion|silver)\b"),
    ("energy", r"\b(oil|crude|brent|wti|opec|natural gas|lng)\b"),
    ("crypto", r"\b(bitcoin|btc|crypto\w*|ether\w*|eth|solana)\b"),
]
_BULL = re.compile(
    r"\b(bull\w*|rall\w+|surg\w+|soar\w*|jump\w*|rebound\w*|breakout|buy(ing)?|upside|strong(er)?|"
    r"beat\w*|record high|all-time high|higher|gains?|outperform\w*|accumulat\w+|risk-on)\b",
    re.I,
)
_BEAR = re.compile(
    r"\b(bear\w*|sell-?off|selling|crash\w*|plung\w+|tumbl\w+|slump\w*|drop\w*|fall\w*|declin\w+|"
    r"downside|weak(er)?|miss\w*|recession|lower|loss(es)?|underperform\w*|capitulat\w+|risk-off|bubble)\b",
    re.I,
)


def lean(text: str) -> dict:
    """{thị trường: +1 / -1} cho các thị trường được nhắc tới trong bài; 0 thì bỏ.

    Chấm từng vế câu (cắt ở dấu chấm, phẩy, chấm phẩy) để "stocks lower, dollar stronger"
    ra chứng khoán tiêu cực, USD tích cực, không gộp chung cả câu.
    """
    score: dict[str, int] = {}
    for part in re.split(r"[.;,!?\n]+|\s[-–—]\s", text):
        tone = len(_BULL.findall(part)) - len(_BEAR.findall(part))
        if not tone:
            continue
        for a, pat in _ASSET:
            if re.search(pat, part, re.I):
                score[a] = score.get(a, 0) + (1 if tone > 0 else -1)
    return {a: (1 if v > 0 else -1) for a, v in score.items() if v}


# chủ đề thị trường đáng đếm (không đếm từ thường như "since", "data")
_TERMS = {
    "Fed": r"\bfed\b|fomc|powell",
    "Lãi suất": r"rate (cut|hike)s?|\bcuts?\b|hikes?",
    "Lạm phát": r"inflation|\bcpi\b|\bpce\b",
    "Việc làm": r"payrolls?|\bnfp\b|jobs|unemployment|labor market",
    "Suy thoái": r"recession|slowdown|hard landing|soft landing",
    "Thuế quan": r"tariffs?|trade war",
    "Lợi suất": r"yields?|treasur(y|ies)|bonds?\b",
    "USD": r"\bdollar\b|\bdxy\b|\busd\b",
    "Yên Nhật": r"\byen\b|\bboj\b|\bjpy\b",
    "Trung Quốc": r"china|chinese|yuan|beijing",
    "Vàng": r"\bgold\b|bullion",
    "Dầu": r"\boil\b|crude|opec|brent",
    "AI": r"\bai\b|nvidia|artificial intelligence",
    "Chip": r"semiconductor|chips?\b|tsmc|sk hynix|samsung",
    "Bitcoin": r"bitcoin|\bbtc\b",
    "ETF": r"\betfs?\b",
    "Ngân sách Mỹ": r"deficit|debt ceiling|fiscal",
    "Bất động sản": r"housing|home sales|mortgage",
    "Châu Âu": r"\becb\b|eurozone|euro area",
    "Hàn Quốc": r"korea|kospi",
    "Bong bóng": r"bubble|froth",
}
_TERM_RE = {k: re.compile(v, re.I) for k, v in _TERMS.items()}


def trending(posts: list[dict], now_ms: int, top: int = 12) -> list[dict]:
    """Chủ đề được nhiều người nhắc nhất trong 24 giờ, đếm mỗi người một lần."""
    cnt: dict[str, set] = {}
    for p in posts:
        if now_ms - p["t"] > 86400_000:
            continue
        text = f"{p.get('head', '')} {p.get('text', '')}"
        for term, rx in _TERM_RE.items():
            if rx.search(text):
                cnt.setdefault(term, set()).add(p["who"])
    rows = sorted(((t, len(w)) for t, w in cnt.items() if len(w) >= 2), key=lambda x: -x[1])
    return [{"term": t, "n": n} for t, n in rows[:top]]


def _clean(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", html.unescape(s or ""))
    return re.sub(r"\s+", " ", s).strip()


def _get(url: str, timeout: float = 10) -> bytes:
    # Substack và vài blog chặn tên trình lấy tin lạ: giả trình duyệt thường
    hdr = {
        **news.BROWSER,
        "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
    }
    req = urllib.request.Request(url, headers=hdr)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _rss(raw: bytes) -> list[tuple[str, str, str, str]]:
    """(tiêu đề, link, thời điểm, tóm tắt) của từng bài trong RSS / Atom."""
    import xml.etree.ElementTree as ET

    root = ET.fromstring(raw)
    out = []
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag not in ("item", "entry"):
            continue
        get = {c.tag.rsplit("}", 1)[-1]: c for c in el}
        title = _clean(get["title"].text if "title" in get else "")
        link = ""
        if "link" in get:
            link = get["link"].text or get["link"].attrib.get("href", "")
        pub = ""
        for k in ("pubDate", "published", "updated", "date"):
            if k in get and get[k].text:
                pub = get[k].text
                break
        summ = ""
        for k in ("description", "summary", "encoded", "content", "group"):
            if k in get:
                node = get[k]
                txt = node.text or ""
                if k == "group":  # YouTube: media:group/media:description
                    d = [c for c in node if c.tag.endswith("description")]
                    txt = d[0].text if d else ""
                summ = _clean(txt)
                if summ:
                    break
        out.append((title, link.strip(), pub, summ))
    return out


def _bsky(handle: str) -> list[tuple[str, str, int]]:
    url = (
        "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?filter=posts_no_replies&limit=25&actor="
        + urllib.parse.quote(handle)
    )
    feed = json.loads(_get(url)).get("feed", [])
    out = []
    for f in feed:
        if f.get("reason"):  # bài chia sẻ lại của người khác
            continue
        p = f.get("post", {})
        rec = p.get("record", {})
        text = rec.get("text", "")
        uri = p.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1]
        out.append(
            (
                text,
                f"https://bsky.app/profile/{handle}/post/{rkey}",
                news._when(rec.get("createdAt", "")),
            )
        )
    return out


def _via_google_news(feed_url: str) -> list[tuple[str, str, int, str]]:
    """Dự phòng khi trang chặn máy chủ đám mây (Substack, Cloudflare): lấy tiêu đề qua Google News.

    Chỉ có tiêu đề và đường dẫn, không có tóm tắt.
    """
    host = urllib.parse.urlparse(feed_url).hostname or ""
    raw = _get(news.GN + urllib.parse.quote(f"site:{host.removeprefix('www.')}"))
    out = []
    for title, link, pub in news.parse_feed(raw):
        if " - " in title:
            title = title.rsplit(" - ", 1)[0]
        out.append((title, link, news._when(pub), ""))
    if not out:
        raise RuntimeError("Google News không có bài")
    return sorted(out, key=lambda r: -r[2])


def fetch_source(src) -> tuple[list[dict], dict]:
    sid, name, role, group, tier, plat, addr, mk = src
    info = {
        "id": sid,
        "name": name,
        "role": role,
        "group": group,
        "tier": tier,
        "platform": plat,
        "markets": mk.split(),
        "ok": False,
        "err": "",
        "last": None,
        "n": 0,
    }
    posts = []
    try:
        if plat == "bsky":
            rows = [(t, link, when, "") for t, link, when in _bsky(addr)]
        else:
            url = (
                f"https://www.youtube.com/feeds/videos.xml?channel_id={addr}"
                if plat == "yt"
                else addr
            )
            try:
                rows = [(t, link, news._when(pub), summ) for t, link, pub, summ in _rss(_get(url))]
            except Exception:
                if plat != "rss":
                    raise
                rows = _via_google_news(addr)
                info["via"] = "Google News"
        for title, link, when, summ in rows[:20]:
            if plat == "bsky":
                text, head = title, ""
            else:
                head, text = title, summ[:600]
            item = {
                "t": when,
                "who": sid,
                "head": head,
                "text": text,
                "link": link,
                "platform": plat,
            }
            if news.is_vietnamese({"source": name, "title": f"{head} {text}", "link": link}):
                continue
            item["lean"] = lean(f"{head} {text}")
            posts.append(item)
        info["ok"] = True
        info["n"] = len(posts)
        info["last"] = max((p["t"] for p in posts), default=None)
    except Exception as exc:
        info["err"] = str(exc)[:160]
    return posts, info


def _json(url: str, referer: str = "") -> dict:
    hdr = {**news.BROWSER, "Accept": "application/json"}
    if referer:  # CNN trả 418 nếu không có trang gốc
        hdr |= {"Referer": referer, "Origin": referer.rstrip("/")}
    req = urllib.request.Request(url, headers=hdr)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def gauges() -> tuple[dict, list[str]]:
    out, errors = {}, []
    try:
        d = _json(
            "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
            "https://edition.cnn.com/",
        )["fear_and_greed"]
        out["stocks"] = {
            "name": "Fear & Greed CNN (chứng khoán Mỹ)",
            "value": round(d["score"]),
            "label": d.get("rating", ""),
            "prev": round(d.get("previous_1_week") or 0),
        }
    except Exception as exc:
        errors.append(f"CNN Fear & Greed: {exc}")
    try:
        d = _json("https://api.alternative.me/fng/?limit=8")["data"]
        out["crypto"] = {
            "name": "Fear & Greed crypto (alternative.me)",
            "value": int(d[0]["value"]),
            "label": d[0].get("value_classification", ""),
            "prev": int(d[-1]["value"]),
        }
    except Exception as exc:
        errors.append(f"Crypto Fear & Greed: {exc}")
    return out, errors


def tally(posts: list[dict], now_ms: int) -> dict:
    """Số người nghiêng tích cực / tiêu cực theo thị trường trong 24 giờ.

    Mỗi người một phiếu cho mỗi thị trường, lấy bài mới nhất của họ.
    """
    last: dict[tuple[str, str], int] = {}
    for p in sorted(posts, key=lambda p: p["t"]):
        if now_ms - p["t"] > 86400_000:
            continue
        for a, v in p.get("lean", {}).items():
            last[(a, p["who"])] = v
    out = {a: {"bull": 0, "bear": 0} for a, _ in _ASSET}
    for (a, _), v in last.items():
        out[a]["bull" if v > 0 else "bear"] += 1
    return out


def fetch_social(now_ms: int | None = None) -> dict:
    now_ms = now_ms or int(time.time() * 1000)
    posts, infos = [], []
    with ThreadPoolExecutor(12) as ex:
        for got, info in ex.map(fetch_source, SOURCES):
            posts += got
            # im lặng quá 30 ngày thì gợi ý bỏ khỏi danh sách
            info["stale"] = bool(
                info["ok"] and (not info["last"] or now_ms - info["last"] > 30 * 86400_000)
            )
            infos.append(info)
    posts = [p for p in posts if p["t"] <= now_ms + 3600_000 and now_ms - p["t"] < 21 * 86400_000]
    posts.sort(key=lambda p: -p["t"])
    g, gerr = gauges()
    return {
        "updated": now_ms,
        "groups": GROUPS,
        "tiers": TIERS,
        "markets": MARKETS,
        "sources": infos,
        "posts": posts[:400],
        "tally": tally(posts, now_ms),
        "trending": trending(posts, now_ms),
        "gauges": g,
        "errors": [f"{i['name']}: {i['err']}" for i in infos if i["err"]] + gerr,
    }


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    out.mkdir(parents=True, exist_ok=True)
    data = fetch_social()
    (out / "social.json").write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    ok = sum(i["ok"] for i in data["sources"])
    print(f"mạng xã hội: {len(data['posts'])} bài từ {ok}/{len(SOURCES)} nguồn")
    for e in data["errors"]:
        print("lỗi:", e)
