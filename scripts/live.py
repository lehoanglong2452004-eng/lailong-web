"""Vòng cập nhật nhanh cho trang web công khai: lịch kinh tế, số thực tế, tin tức và phản ứng giá.

GitHub chỉ chạy lịch hẹn giờ vài tiếng một lần với repo nhỏ, nên thay vì chạy mỗi 30 phút,
một lần chạy GitHub Actions giữ vòng lặp này gần 6 tiếng, cứ vài phút lấy lại dữ liệu và đẩy lên
nhánh `live` (một commit duy nhất, ghi đè, để repo không phình). Trang web đọc thẳng nhánh này.

    python live.py --out live --minutes 340 --push

Chỉ dùng thư viện chuẩn. Không bao giờ lấy nguồn tin của Việt Nam (lọc trong news.py).
"""

from __future__ import annotations

import argparse
import copy
import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import news  # noqa: E402

KEY = ("t", "country", "title")


# chỉ số theo dõi để báo biến động bất thường:
# (tên, mã Yahoo, ngưỡng % trong 30 phút, từ khoá tìm tin liên quan)
WATCH = [
    ("KOSPI", "^KS11", 1.5, "kospi|kosdaq|korea|seoul|samsung|sk hynix"),
    ("Nikkei 225", "^N225", 1.5, "nikkei|topix|japan|tokyo|yen"),
    ("Hang Seng", "^HSI", 1.5, "hang seng|hong kong|china|chinese"),
    ("Shanghai", "000001.SS", 1.5, "shanghai|china|chinese|yuan|csi"),
    ("ASX 200", "^AXJO", 1.2, "asx|australia"),
    ("DAX", "^GDAXI", 1.2, "dax|germany|german|europe"),
    ("S&P 500 fut", "ES=F", 1.0, "s&p|wall street|stocks|equit"),
    ("Nasdaq fut", "NQ=F", 1.3, "nasdaq|tech|chip|semiconductor"),
    ("DXY", "DX-Y.NYB", 0.5, "dollar|dxy|fed|treasury"),
    ("USDJPY", "JPY=X", 0.7, "yen|boj|japan"),
    ("Vàng", "GC=F", 1.0, "gold|bullion"),
    ("Dầu WTI", "CL=F", 2.0, "oil|crude|opec|brent"),
    ("BTC", "BTC-USD", 2.5, "bitcoin|btc|crypto"),
]


def movers(now_ms: int, fetch=None) -> dict:
    """Giá và % thay đổi 30 phút của các chỉ số trong WATCH; báo động khi vượt ngưỡng."""
    fetch = fetch or (lambda sym: news._yahoo_5m(sym, "1d"))
    quotes, alerts, errors = [], [], []
    for name, sym, thr, words in WATCH:
        try:
            s = fetch(sym)
        except Exception as exc:
            errors.append(f"{name}: {exc}")
            continue
        if len(s) < 2:
            continue
        t1, p1 = s[-1]
        base = [p for t, p in s if t <= t1 - 30 * 60_000]
        p30 = base[-1] if base else s[0][1]
        chg30 = (p1 / p30 - 1) * 100 if p30 else 0.0
        chg_day = (p1 / s[0][1] - 1) * 100 if s[0][1] else 0.0
        q = {"name": name, "sym": sym, "t": t1, "last": p1, "chg30": round(chg30, 2)}
        q["chgDay"] = round(chg_day, 2)
        quotes.append(q)
        # chỉ báo khi giá còn mới (trong 40 phút) để phiên đã đóng không báo mãi
        if abs(chg30) >= thr and now_ms - t1 < 40 * 60_000:
            alerts.append({**q, "thr": thr, "words": words})
    return {"updated": now_ms, "quotes": quotes, "alerts": alerts, "errors": errors}


def carry_actuals(events: list[dict], prev: list[dict]) -> None:
    """Giữ số thực tế đã tìm được ở vòng trước để khỏi hỏi lại nguồn."""
    old = {tuple(e[k] for k in KEY): e.get("actual") for e in prev if e.get("actual")}
    for e in events:
        if not e.get("actual"):
            a = old.get(tuple(e[k] for k in KEY))
            if a:
                e["actual"] = a


def _read(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    except Exception:
        return None


def _write(path: Path, data: dict, keys: str) -> bool:
    old = _read(path)
    if old is not None and old.get(keys) == data.get(keys):
        return False
    if not data.get(keys) and old and old.get(keys):
        return False  # lần lấy này lỗi hết: giữ bản cũ
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return True


def _push(out: Path) -> None:
    git = ["git", "-C", str(out)]
    subprocess.run([*git, "add", "-A"], check=True)
    if subprocess.run([*git, "diff", "--cached", "--quiet"]).returncode == 0:
        return
    has_head = (
        subprocess.run(
            [*git, "rev-parse", "-q", "--verify", "HEAD"], capture_output=True
        ).returncode
        == 0
    )
    msg = ["-m", "Dữ liệu nhanh"]
    subprocess.run([*git, "commit", "-q", *(["--amend"] if has_head else []), *msg], check=True)
    for _ in range(3):
        if subprocess.run([*git, "push", "-q", "-f", "origin", "HEAD:live"]).returncode == 0:
            return
        time.sleep(5)
    print("không đẩy được lên nhánh live", flush=True)


def step(
    out: Path, state: dict, now: float, cal_every: float, news_every: float, react_every: float
) -> list[str]:
    """Một vòng: trả về tên các file vừa thay đổi."""
    changed = []
    if state.get("raw") is None or now - state.get("t_raw", 0) >= cal_every:
        try:
            raw, errs = news.fetch_calendar_raw()
            if raw:
                state["raw"], state["raw_err"], state["t_raw"] = raw, errs, now
        except Exception as exc:
            print("lịch lỗi:", exc, flush=True)
    if state.get("raw"):
        evs = copy.deepcopy(state["raw"])
        carry_actuals(
            evs, state.get("events") or (_read(out / "calendar.json") or {}).get("events", [])
        )
        errs = list(state.get("raw_err") or [])
        try:  # chỉ tìm số cho tin trong 36 giờ qua để khỏi gọi thừa nguồn
            errs += news.fill_actuals(evs, window_ms=36 * 3600_000)
        except Exception as exc:
            errs.append(f"số thực tế: {exc}")
        state["events"] = evs
        if _write(
            out / "calendar.json",
            {"updated": int(now * 1000), "events": evs, "errors": errs},
            "events",
        ):
            changed.append("calendar.json")
    if now - state.get("t_news", -1e18) >= news_every:
        state["t_news"] = now
        try:
            if _write(out / "news.json", news.fetch_news(), "items"):
                changed.append("news.json")
        except Exception as exc:
            print("tin lỗi:", exc, flush=True)
    if state.get("events") and now - state.get("t_react", -1e18) >= react_every:
        state["t_react"] = now
        try:
            rp = out / "reactions.json"
            if _write(rp, news.merge_history(_read(rp), news.reactions(state["events"])), "events"):
                changed.append("reactions.json")
        except Exception as exc:
            print("phản ứng lỗi:", exc, flush=True)
    if now - state.get("t_move", -1e18) >= 180:
        state["t_move"] = now
        try:
            if _write(out / "movers.json", movers(int(now * 1000)), "quotes"):
                changed.append("movers.json")
        except Exception as exc:
            print("biến động lỗi:", exc, flush=True)
    return changed


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="live")
    ap.add_argument("--minutes", type=float, default=340)
    ap.add_argument("--every", type=float, default=90, help="giây giữa hai vòng tìm số thực tế")
    ap.add_argument("--news-every", type=float, default=150)
    ap.add_argument(
        "--cal-every", type=float, default=900, help="giây giữa hai lần tải lại lịch ForexFactory"
    )
    ap.add_argument("--react-every", type=float, default=300)
    ap.add_argument("--push", action="store_true")
    a = ap.parse_args(argv)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    state: dict = {}
    end = time.time() + a.minutes * 60
    while True:
        t0 = time.time()
        changed = step(out, state, t0, a.cal_every, a.news_every, a.react_every)
        if changed:
            (out / "live.json").write_text(
                json.dumps({"updated": int(t0 * 1000), "files": changed}), encoding="utf-8"
            )
            if a.push:
                _push(out)
        print(time.strftime("%H:%M:%S"), "đổi:", ", ".join(changed) or "không", flush=True)
        if time.time() + a.every > end:
            break
        time.sleep(max(5, a.every - (time.time() - t0)))


if __name__ == "__main__":
    main()
