"""Danh sách thị trường cho Lai Long: hàng hoá, forex và lãi suất điều hành, crypto (tổ chức, ETF, cá voi).

Chỉ dùng thư viện chuẩn. Nguồn miễn phí, chấp nhận chậm:
  - Yahoo Finance: giá hợp đồng tương lai theo từng kỳ hạn, tỷ giá, DXY (chậm 10 đến 30 phút);
  - BIS: lãi suất điều hành của ngân hàng trung ương;
  - CoinGecko: top 10 crypto theo vốn hoá, các công ty nắm giữ BTC và ETH;
  - Farside: dòng tiền ETF BTC và ETH theo ngày;
  - Hyperliquid: vị thế của các ví lớn nhất (dữ liệu công khai trên chuỗi).

Chạy tay: python markets.py <thư mục ra>   (ghi ra markets.json và whales.json)
"""

from __future__ import annotations

import csv
import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    "Accept": "*/*",
}
MONTH_CODES = "FGHJKMNQUVXZ"
ALL = MONTH_CODES

# (mã, tên tiếng Việt, nhóm, sàn trên Yahoo, chu kỳ tháng giao dịch chính, hệ số ra USD mỗi hợp đồng, đơn vị giá)
# hệ số: giá × hệ số = giá trị một hợp đồng bằng USD (giá nông sản tính bằng cent)
COMMODITIES = [
    ("CL", "Dầu thô WTI", "Năng lượng", "NYM", ALL, 1000, "USD/thùng"),
    ("BZ", "Dầu Brent", "Năng lượng", "NYM", ALL, 1000, "USD/thùng"),
    ("NG", "Khí tự nhiên", "Năng lượng", "NYM", ALL, 10000, "USD/MMBtu"),
    ("RB", "Xăng RBOB", "Năng lượng", "NYM", ALL, 42000, "USD/gallon"),
    ("HO", "Dầu sưởi / diesel", "Năng lượng", "NYM", ALL, 42000, "USD/gallon"),
    ("GC", "Vàng", "Kim loại quý", "CMX", "GJMQVZ", 100, "USD/oz"),
    ("SI", "Bạc", "Kim loại quý", "CMX", "HKNUZ", 5000, "USD/oz"),
    ("PL", "Bạch kim", "Kim loại quý", "NYM", "FJNV", 50, "USD/oz"),
    ("PA", "Palladium", "Kim loại quý", "NYM", "HMUZ", 100, "USD/oz"),
    ("HG", "Đồng", "Kim loại công nghiệp", "CMX", "HKNUZ", 25000, "USD/pound"),
    ("ZC", "Ngô", "Nông sản", "CBT", "HKNUZ", 50, "cent/giạ"),
    ("ZS", "Đậu nành", "Nông sản", "CBT", "FHKNQUX", 50, "cent/giạ"),
    ("ZW", "Lúa mì", "Nông sản", "CBT", "HKNUZ", 50, "cent/giạ"),
    ("KC", "Cà phê Arabica", "Nông sản", "NYB", "HKNUZ", 375, "cent/pound"),
    ("SB", "Đường", "Nông sản", "NYB", "HKNV", 1120, "cent/pound"),
    ("CC", "Ca cao", "Nông sản", "NYB", "HKNUZ", 10, "USD/tấn"),
    ("CT", "Bông", "Nông sản", "NYB", "HKNVZ", 500, "cent/pound"),
    ("LE", "Bò sống", "Nông sản", "CME", "GJMQVZ", 400, "cent/pound"),
    ("HE", "Heo nạc", "Nông sản", "CME", "GJKMNQVZ", 400, "cent/pound"),
]

# 10 đồng tiền giao dịch nhiều nhất (BIS 2022). Mã BIS của khu vực, mã cặp trên Yahoo (giá theo USD)
CURRENCIES = [
    ("USD", "Đô la Mỹ", "US", None, "Fed"),
    ("EUR", "Euro", "XM", "EURUSD=X", "ECB"),
    ("JPY", "Yên Nhật", "JP", "JPY=X", "BOJ"),
    ("GBP", "Bảng Anh", "GB", "GBPUSD=X", "BOE"),
    ("CNY", "Nhân dân tệ", "CN", "CNY=X", "PBOC"),
    ("AUD", "Đô la Úc", "AU", "AUDUSD=X", "RBA"),
    ("CAD", "Đô la Canada", "CA", "CAD=X", "BOC"),
    ("CHF", "Franc Thuỵ Sĩ", "CH", "CHF=X", "SNB"),
    ("HKD", "Đô la Hồng Kông", "HK", "HKD=X", "HKMA"),
    ("SGD", "Đô la Singapore", "SG", "SGD=X", "MAS"),
]


def _get(url: str, timeout: float = 20, data: bytes | None = None) -> bytes:
    headers = dict(UA)
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _yahoo_daily(symbol: str, rng: str = "1mo") -> dict | None:
    """Nến ngày gần nhất của một mã Yahoo: giá, thay đổi trong ngày, khối lượng, lịch sử giá đóng cửa."""
    q = urllib.parse.quote(symbol)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{q}?range={rng}&interval=1d"
    try:
        r = json.loads(_get(url))["chart"]["result"][0]
    except Exception:
        return None
    ts = r.get("timestamp") or []
    qd = r["indicators"]["quote"][0]
    rows = [
        (t, c, v)
        for t, c, v in zip(ts, qd.get("close") or [], qd.get("volume") or [], strict=False)
        if c is not None
    ]
    if not rows:
        return None
    last_t, last_c, last_v = rows[-1]
    prev = rows[-2][1] if len(rows) > 1 else None
    meta = r.get("meta", {})
    return {
        "symbol": symbol,
        "t": int(last_t) * 1000,
        "price": meta.get("regularMarketPrice") or last_c,
        "prev": prev,
        "chg": None if not prev else round((last_c / prev - 1) * 100, 3),
        "volume": last_v or 0,
        "closes": [round(c, 6) for _, c, _ in rows[-22:]],
    }


def _months_ahead(cycle: str, now: datetime, n: int = 6) -> list[tuple[str, int]]:
    """n kỳ hạn tiếp theo theo chu kỳ tháng, bắt đầu từ tháng hiện tại."""
    out, y, m = [], now.year, now.month
    while len(out) < n:
        code = MONTH_CODES[m - 1]
        if code in cycle:
            out.append((code, y))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def term_structure(front: float, nxt: float, months_apart: int) -> dict:
    """Contango: kỳ hạn sau đắt hơn kỳ hạn gần (thị trường dư cung, phải trả phí lưu kho).
    Backwardation: kỳ hạn gần đắt hơn (đang thiếu hàng ngay bây giờ)."""
    spread = nxt - front
    pct = spread / front * 100 if front else 0
    ann = pct * 12 / max(1, months_apart)
    state = "contango" if spread > 0 else "backwardation" if spread < 0 else "flat"
    return {
        "spread": round(spread, 6),
        "pct": round(pct, 3),
        "annual": round(ann, 2),
        "state": state,
    }


def _commodity(row, now: datetime) -> dict:
    code, name, group, ex, cycle, mult, unit = row
    gen = _yahoo_daily(f"{code}=F")
    out = {"code": code, "name": name, "group": group, "unit": unit, "mult": mult}
    if gen:
        out.update(price=gen["price"], chg=gen["chg"], volume=gen["volume"], closes=gen["closes"])
        cents = unit.startswith("cent")
        out["notional"] = round(gen["volume"] * gen["price"] * mult * (0.01 if cents else 1))
    legs = []
    fresh = now.timestamp() * 1000 - 6 * 86400_000
    for mc, y in _months_ahead(cycle, now, 6):
        d = _yahoo_daily(f"{code}{mc}{y % 100:02d}.{ex}", "10d")
        if not d or d["t"] < fresh:
            continue  # kỳ hạn đã đáo hạn hoặc chưa có giao dịch
        legs.append(
            {
                "contract": f"{code}{mc}{y % 100:02d}",
                "month": f"{MONTH_CODES.index(mc) + 1:02d}/{y}",
                "price": d["price"],
                "volume": d["volume"],
                "_m": y * 12 + MONTH_CODES.index(mc),
            }
        )
        if len(legs) == 4:
            break
    # hợp đồng chính = kỳ hạn có khối lượng lớn nhất trong các kỳ gần; so với kỳ hạn liền sau nó
    if legs:
        i = max(range(min(3, len(legs))), key=lambda k: legs[k]["volume"] or 0)
        legs = legs[i : i + 2]
    if len(legs) == 2:
        out["curve"] = term_structure(
            legs[0]["price"], legs[1]["price"], legs[1]["_m"] - legs[0]["_m"]
        )
    for x in legs:
        x.pop("_m")
    out["legs"] = legs
    return out


def fetch_commodities(now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(UTC)
    with ThreadPoolExecutor(6) as ex:
        rows = list(ex.map(lambda r: _commodity(r, now), COMMODITIES))
    rows = [r for r in rows if r.get("price")]
    rows.sort(key=lambda r: -(r.get("notional") or 0))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows


def parse_bis_cbpol(text: str) -> dict:
    """Lãi suất điều hành mới nhất của từng nước, từ ngày nào, và mức trước đó (từ CSV của BIS)."""
    by: dict[str, list[tuple[str, float]]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        try:
            v = float(row["OBS_VALUE"])
        except (KeyError, ValueError):
            continue
        if v != v:  # NaN: ngày không có số liệu
            continue
        by.setdefault(row["REF_AREA"], []).append((row["TIME_PERIOD"], v))
    out = {}
    for area, obs in by.items():
        obs.sort()
        last_d, last_v = obs[-1]
        since, prev = obs[0][0], None
        for d, v in reversed(obs):
            if v != last_v:
                prev = {"date": d, "rate": v}
                break
            since = d
        out[area] = {"rate": last_v, "date": last_d, "since": since, "prev": prev}
    return out


def fetch_policy_rates() -> dict:
    areas = "+".join(c[2] for c in CURRENCIES)
    url = f"https://stats.bis.org/api/v1/data/WS_CBPOL/D.{areas}/all?startPeriod={datetime.now(UTC).year - 3}-01-01&format=csv"
    return parse_bis_cbpol(_get(url, timeout=40).decode("utf-8", "replace"))


def fetch_fx() -> list[dict]:
    try:
        rates = fetch_policy_rates()
        err = None
    except Exception as exc:
        rates, err = {}, str(exc)
    syms = [c[3] for c in CURRENCIES if c[3]] + ["DX-Y.NYB"]
    with ThreadPoolExecutor(6) as ex:
        quotes = dict(zip(syms, ex.map(_yahoo_daily, syms), strict=False))
    out = []
    for code, name, area, sym, bank in CURRENCIES:
        q = quotes.get(sym) if sym else quotes.get("DX-Y.NYB")
        row = {
            "code": code,
            "name": name,
            "bank": bank,
            "pair": sym or "DXY",
            "rate": rates.get(area),
        }
        if q:
            row.update(price=q["price"], chg=q["chg"], closes=q["closes"])
        out.append(row)
    return out if not err else [*out, {"error": err}]


STABLE_OR_WRAPPED = re.compile(
    r"usd|eur|dai$|^w(btc|eth|steth|eeth|bnb)$|^(st|we|cb|r|ez|ws)eth$|heloc|^bsc-usd$", re.I
)


def _skip_coin(c: dict) -> bool:
    """Bỏ stablecoin, coin bọc (wrapped) và token staking để top 10 chỉ còn tài sản thật."""
    name = (c.get("name") or "").lower()
    return bool(
        STABLE_OR_WRAPPED.search(c.get("symbol") or "")
        or STABLE_OR_WRAPPED.search(c.get("id") or "")
        or any(w in name for w in ("wrapped", "staked", "bridged", "stablecoin", "usd"))
    )


def fetch_crypto() -> dict:
    out: dict = {}
    try:
        coins = json.loads(
            _get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=40")
        )
        out["top"] = [
            {
                k: c.get(k)
                for k in (
                    "id",
                    "symbol",
                    "name",
                    "current_price",
                    "market_cap",
                    "total_volume",
                    "price_change_percentage_24h",
                    "market_cap_rank",
                    "image",
                )
            }
            for c in coins
            if not _skip_coin(c)
        ][:10]
    except Exception as exc:
        out["top_error"] = str(exc)
    for coin in ("bitcoin", "ethereum"):
        try:
            d = json.loads(
                _get(f"https://api.coingecko.com/api/v3/companies/public_treasury/{coin}")
            )
            out[f"treasury_{coin}"] = {
                "total": d.get("total_holdings"),
                "value": d.get("total_value_usd"),
                "dominance": d.get("market_cap_dominance"),
                "companies": [
                    {
                        k: c.get(k)
                        for k in (
                            "name",
                            "symbol",
                            "country",
                            "total_holdings",
                            "total_current_value_usd",
                            "percentage_of_total_supply",
                        )
                    }
                    for c in d.get("companies", [])[:25]
                ],
            }
        except Exception as exc:
            out[f"treasury_{coin}_error"] = str(exc)
    for coin, path in (("btc", "btc"), ("eth", "eth")):
        try:
            out[f"etf_{coin}"] = parse_farside(
                _get(f"https://farside.co.uk/{path}/", timeout=40).decode("utf-8", "replace")
            )
        except Exception as exc:
            out[f"etf_{coin}_error"] = str(exc)
    return out


def _cell(x: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", x)).strip()


def parse_farside(page: str, days: int = 30) -> dict:
    """Bảng dòng tiền ETF của Farside (triệu USD mỗi ngày): trả về tên quỹ và các ngày gần nhất."""
    tables = re.findall(r"<table[^>]*>(.*?)</table>", page, re.S | re.I)
    best = max(tables, key=len) if tables else ""
    rows = [
        [_cell(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S | re.I)]
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", best, re.S | re.I)
    ]
    head = next(
        (
            r
            for r in rows
            if len(r) > 3 and any(x.upper() in ("IBIT", "ETHA", "FBTC", "FETH") for x in r)
        ),
        None,
    )
    if not head:
        return {"funds": [], "days": []}
    funds = [x or "Tổng" for x in head[1:]]
    out = []
    for r in rows:
        if len(r) != len(head):
            continue
        try:
            d = datetime.strptime(r[0], "%d %b %Y").date().isoformat()
        except ValueError:
            continue

        def num(x: str) -> float | None:
            x = x.replace(",", "").strip()
            if x in ("", "-"):
                return None
            neg = x.startswith("(") and x.endswith(")")
            try:
                v = float(x.strip("()"))
            except ValueError:
                return None
            return -v if neg else v

        vals = [num(x) for x in r[1:]]
        if all(v is None for v in vals[:-1]):
            continue  # ngày chưa có số liệu
        out.append({"date": d, "flows": vals})
    return {"funds": funds, "days": out[-days:]}


# ---------- cá voi trên Hyperliquid ----------
HL = "https://api.hyperliquid.xyz/info"


def _hl(body: dict) -> object:
    return json.loads(_get(HL, data=json.dumps(body).encode(), timeout=20))


def top_whales(n: int = 150) -> list[dict]:
    """Các ví có tài khoản lớn nhất trên bảng xếp hạng Hyperliquid (bỏ ví của sàn và ví quỹ)."""
    data = json.loads(_get("https://stats-data.hyperliquid.xyz/Mainnet/leaderboard", timeout=90))
    rows = []
    for r in data.get("leaderboardRows", []):
        try:
            av = float(r.get("accountValue") or 0)
        except ValueError:
            continue
        perf = {
            p[0]: p[1]
            for p in r.get("windowPerformances", [])
            if isinstance(p, list) and len(p) == 2
        }
        rows.append(
            {
                "addr": r.get("ethAddress"),
                "name": r.get("displayName"),
                "account": av,
                "pnlDay": float((perf.get("day") or {}).get("pnl") or 0),
                "pnlMonth": float((perf.get("month") or {}).get("pnl") or 0),
                "pnlAll": float((perf.get("allTime") or {}).get("pnl") or 0),
            }
        )
    rows.sort(key=lambda x: -x["account"])
    return rows[:n]


def whale_positions(whales: list[dict], now_ms: int | None = None) -> dict:
    now_ms = now_ms or int(time.time() * 1000)

    def one(w):
        try:
            st = _hl({"type": "clearinghouseState", "user": w["addr"]})
        except Exception:
            return w, [], []
        pos = []
        for ap in st.get("assetPositions", []):
            p = ap.get("position", {})
            try:
                szi = float(p.get("szi") or 0)
            except ValueError:
                continue
            if not szi:
                continue
            lev = p.get("leverage") or {}
            pos.append(
                {
                    "coin": p.get("coin"),
                    "side": "LONG" if szi > 0 else "SHORT",
                    "size": abs(szi),
                    "value": float(p.get("positionValue") or 0),
                    "entry": float(p.get("entryPx") or 0),
                    "liq": float(p["liquidationPx"]) if p.get("liquidationPx") else None,
                    "lev": lev.get("value"),
                    "pnl": float(p.get("unrealizedPnl") or 0),
                }
            )
        liqs = []
        try:
            fills = _hl(
                {"type": "userFillsByTime", "user": w["addr"], "startTime": now_ms - 7 * 86400_000}
            )
            for f in fills or []:
                lq = f.get("liquidation") or {}
                # chỉ tính khi chính ví này bị thanh lý (không tính lúc ví đứng ra nhận lệnh thanh lý)
                if str(lq.get("liquidatedUser", "")).lower() == w["addr"].lower():
                    liqs.append(
                        {
                            "t": f.get("time"),
                            "coin": f.get("coin"),
                            "px": float(f.get("px") or 0),
                            "size": float(f.get("sz") or 0),
                            "dir": f.get("dir"),
                            "pnl": float(f.get("closedPnl") or 0),
                        }
                    )
        except Exception:
            pass
        return w, pos, liqs

    with ThreadPoolExecutor(10) as ex:
        res = list(ex.map(one, whales))
    out = []
    for w, pos, liqs in res:
        if not pos and not liqs:
            continue  # ví quỹ, ví sàn hoặc đang không giữ vị thế
        out.append(
            {
                **w,
                "positions": sorted(pos, key=lambda p: -p["value"]),
                "liquidations": liqs,
                "exposure": round(sum(p["value"] for p in pos)),
            }
        )
    out.sort(key=lambda w: -w["exposure"])
    return {"updated": now_ms, "whales": out[:40]}


def build(outdir: Path) -> dict:
    now = datetime.now(UTC)
    started = time.time()
    errors = []
    res = {"updated": int(now.timestamp() * 1000)}
    for key, fn in (("commodities", fetch_commodities), ("fx", fetch_fx), ("crypto", fetch_crypto)):
        try:
            res[key] = fn()
        except Exception as exc:
            errors.append(f"{key}: {exc}")
    res["errors"] = errors
    (outdir / "markets.json").write_text(
        json.dumps(res, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    try:
        wh = whale_positions(top_whales())
        (outdir / "whales.json").write_text(
            json.dumps(wh, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    except Exception as exc:
        errors.append(f"whales: {exc}")
    res["seconds"] = round(time.time() - started, 1)
    return res


_cache: dict[str, tuple[float, dict]] = {}


def cached(name: str, ttl: float = 900) -> dict:
    """Dùng cho máy chủ trên laptop: lấy lại tối đa mỗi 15 phút."""
    now = time.time()
    if name in _cache and now - _cache[name][0] < ttl:
        return _cache[name][1]
    if name == "whales":
        data = whale_positions(top_whales())
    else:
        data = {
            "updated": int(now * 1000),
            "commodities": fetch_commodities(),
            "fx": fetch_fx(),
            "crypto": fetch_crypto(),
        }
    _cache[name] = (now, data)
    return data


# Hợp đồng tương lai cho Radar (nến 1 giờ, chậm 10 đến 15 phút theo Yahoo): mã gửi từ trình duyệt -> mã Yahoo
RADAR_FUTURES = {
    "GC": ("GC=F", "Vàng"),
    "SI": ("SI=F", "Bạc"),
    "CL": ("CL=F", "Dầu WTI"),
    "NG": ("NG=F", "Khí tự nhiên"),
    "HG": ("HG=F", "Đồng"),
    "6J": ("6J=F", "Yên Nhật"),
    "6E": ("6E=F", "Euro"),
    "ES": ("ES=F", "S&P 500"),
    "NQ": ("NQ=F", "Nasdaq 100"),
    "ZN": ("ZN=F", "Trái phiếu 10 năm"),
}
_bars_cache: dict[str, tuple[float, list[dict]]] = {}


def parse_yahoo_bars(raw: dict) -> list[dict]:
    """Nến từ API chart của Yahoo, bỏ nến thiếu giá; t tính bằng mili giây."""
    r = raw["chart"]["result"][0]
    q = r["indicators"]["quote"][0]
    out = []
    col = {k: q.get(k) or [] for k in ("open", "high", "low", "close", "volume")}
    for i, t in enumerate(r.get("timestamp") or []):
        o, h, lo, c, v = (col[k][i] if i < len(col[k]) else None for k in col)
        if None in (o, h, lo, c):
            continue
        out.append({"t": int(t) * 1000, "o": o, "h": h, "l": lo, "c": c, "v": v or 0})
    return out


# khung của Radar -> (khoảng Yahoo, độ dài lịch sử, gộp thành mấy giờ); Yahoo không có nến 4 giờ nên gộp từ nến 1 giờ
RADAR_IV = {
    "5m": ("5m", "5d", 0),
    "15m": ("15m", "1mo", 0),
    "1h": ("60m", "3mo", 0),
    "4h": ("60m", "6mo", 4),
    "1d": ("1d", "2y", 0),
}


def group_bars(bars: list[dict], hours: int) -> list[dict]:
    """Gộp nến theo mốc UTC chia hết cho `hours` giờ."""
    ms = hours * 3_600_000
    out: list[dict] = []
    for b in bars:
        t = b["t"] // ms * ms
        if out and out[-1]["t"] == t:
            o = out[-1]
            o["h"], o["l"], o["c"], o["v"] = (
                max(o["h"], b["h"]),
                min(o["l"], b["l"]),
                b["c"],
                o["v"] + b["v"],
            )
        else:
            out.append({**b, "t": t})
    return out


def radar_bars(code: str, iv: str = "1h", ttl: float = 300) -> list[dict]:
    key = f"{code}:{iv}"
    now = time.time()
    if key in _bars_cache and now - _bars_cache[key][0] < ttl:
        return _bars_cache[key][1]
    yiv, rng, group = RADAR_IV[iv]
    sym = urllib.parse.quote(RADAR_FUTURES[code][0])
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range={rng}&interval={yiv}"
    bars = parse_yahoo_bars(json.loads(_get(url)))
    if group:
        bars = group_bars(bars, group)
    _bars_cache[key] = (now, bars)
    return bars


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    out.mkdir(parents=True, exist_ok=True)
    r = build(out)
    print(
        f"hàng hoá: {len(r.get('commodities', []))}; forex: {len(r.get('fx', []))}; "
        f"crypto: {len((r.get('crypto') or {}).get('top', []))}; {r['seconds']} giây"
    )
    for e in r["errors"]:
        print("lỗi:", e)
