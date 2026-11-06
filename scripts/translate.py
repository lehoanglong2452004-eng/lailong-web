"""Dịch sang tiếng Việt cho tiêu đề tin và bài mạng xã hội (song ngữ; nguồn tiếng Anh là chính).

Dùng dịch máy miễn phí, không cần khoá: Google Translate (điểm gtx công khai), lỗi thì thử MyMemory.
Câu đã dịch được lưu vào bộ nhớ đệm (file translations.json) nên mỗi câu chỉ dịch một lần.
Dịch máy chỉ ở mức dễ hiểu; bài gốc tiếng Anh luôn hiện kèm.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "Chrome/129.0 Safari/537.36"
}
GTX = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t"
MYMEMORY = "https://api.mymemory.translated.net/get?langpair=en|vi&q="
SEP = "\n"
KEEP = 4000  # số câu giữ trong bộ nhớ đệm


def _gtx(text: str) -> str:
    body = urllib.parse.urlencode({"q": text}).encode()
    req = urllib.request.Request(
        GTX, data=body, headers={**UA, "Content-Type": "application/x-www-form-urlencoded"}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
    return "".join(seg[0] for seg in data[0] if seg and seg[0])


def _mymemory(text: str) -> str:
    with urllib.request.urlopen(
        urllib.request.Request(MYMEMORY + urllib.parse.quote(text), headers=UA), timeout=15
    ) as r:
        d = json.loads(r.read())
    if int(d.get("responseStatus", 0)) != 200:
        raise RuntimeError(d.get("responseDetails", "MyMemory lỗi"))
    return d["responseData"]["translatedText"]


def batches(texts: list[str], limit: int = 1800) -> list[list[str]]:
    out, cur, n = [], [], 0
    for t in texts:
        if cur and n + len(t) + 1 > limit:
            out.append(cur)
            cur, n = [], 0
        cur.append(t)
        n += len(t) + 1
    if cur:
        out.append(cur)
    return out


class Translator:
    def __init__(self, path: Path | None = None, engines=None):
        self.path = path
        self.cache: dict[str, str] = {}
        self.errors: list[str] = []
        self.engines = engines or [("Google", _gtx), ("MyMemory", _mymemory)]
        self._down: dict[str, float] = {}  # nguồn lỗi thì nghỉ 10 phút
        self.dirty = False  # có câu mới chưa ghi ra file
        if path and path.exists():
            try:
                self.cache = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                self.cache = {}

    def _one_batch(self, chunk: list[str]) -> list[str] | None:
        for name, fn in self.engines:
            if time.time() < self._down.get(name, 0):
                continue
            try:
                if name == "MyMemory":  # MyMemory không giữ dòng: dịch từng câu
                    return [fn(t) for t in chunk]
                got = fn(SEP.join(chunk)).split(SEP)
                if len(got) == len(chunk):
                    return [g.strip() for g in got]
                return [fn(t).strip() for t in chunk]  # lệch dòng: dịch lại từng câu
            except Exception as exc:
                self._down[name] = time.time() + 600
                self.errors.append(f"{name}: {exc}"[:160])
        return None

    def run(self, texts: list[str], budget: int = 80) -> int:
        """Dịch tối đa `budget` câu mới; trả về số câu đã dịch thêm."""
        todo = [
            t
            for t in dict.fromkeys(x.strip() for x in texts if x and x.strip())
            if t not in self.cache
        ][:budget]
        done = 0
        for chunk in batches(todo):
            got = self._one_batch(chunk)
            if got is None:
                break
            for src, vi in zip(chunk, got, strict=False):
                if vi:
                    self.cache[src] = vi
                    done += 1
        self.dirty = self.dirty or done > 0
        return done

    def get(self, text: str) -> str:
        return self.cache.get((text or "").strip(), "")

    def save(self) -> None:
        if not self.path:
            return
        items = list(self.cache.items())[-KEEP:]
        self.cache = dict(items)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(self.cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        self.dirty = False


def add_vi_news(data: dict, tr: Translator, budget: int = 80) -> None:
    """Thêm trường `vi` (tiêu đề tiếng Việt) cho từng tin; tin mới dịch trước."""
    items = sorted(data.get("items", []), key=lambda x: -x.get("t", 0))
    tr.run([x["title"] for x in items], budget)
    for x in data.get("items", []):
        vi = tr.get(x["title"])
        if vi:
            x["vi"] = vi


def short(text: str, n: int = 320) -> str:
    text = (text or "").strip()
    if len(text) <= n:
        return text
    cut = text[:n].rsplit(" ", 1)[0]
    return cut + "…"


def add_vi_social(data: dict, tr: Translator, budget: int = 80) -> None:
    posts = sorted(data.get("posts", []), key=lambda p: -p.get("t", 0))
    texts = []
    for p in posts:
        texts += [p.get("head", ""), short(p.get("text", ""))]
    tr.run(texts, budget)
    for p in data.get("posts", []):
        h, t = tr.get(p.get("head", "")), tr.get(short(p.get("text", "")))
        if h:
            p["vi_head"] = h
        if t:
            p["vi_text"] = t
