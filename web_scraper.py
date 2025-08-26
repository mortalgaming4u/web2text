# web_scraper.py
import re
import time
from html import unescape
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# Optional trafilatura support
try:
    import trafilatura
    TRAFILATURA = True
except Exception:
    TRAFILATURA = False

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

_NEXT_WORDS = [
    "next", "next chapter", "next page", "下一章", "下一页", "下一頁", "下页", "下一節", "続き",
    "suivant", "›", "»", "→", ">>"
]
_PREV_WORDS = [
    "prev", "previous", "previous chapter", "上一章", "上一页", "上一頁", "上页", "上一節",
    "前へ", "précédent", "‹", "«", "←", "<<"
]

_CHAPTER_PATTERNS = [
    r"(?:^|[-_/])(?:chapter|chap|ch)[-_ ]?(\d+)(?:\D|$)",
    r"(?:^|[-_/])c(\d+)(?:\D|$)",
    r"(?:^|[-_/])p?(\d+)\.html?$",
    r"(?:^|[-_/])(\d+)(?:/|$)",
]


def fetch_html(url: str, timeout: int = 20, retries: int = 2):
    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)
    for attempt in range(retries + 1):
        try:
            resp = session.get(url, timeout=timeout, allow_redirects=True)
            if resp.status_code >= 400 and resp.status_code not in (403, 503):
                return None, None
            resp.encoding = resp.apparent_encoding or resp.encoding
            return resp.text, str(resp.url)
        except Exception:
            time.sleep(0.3)
    return None, None


def _clean_visible_text_from_soup(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "noscript", "iframe", "header", "footer", "nav", "form", "aside"]):
        tag.decompose()

    junk_selectors = [
        ".nav", ".navbar", ".site-nav", ".pagination", ".pager",
        ".ads", ".advert", ".advertisement", ".share", ".social",
        ".breadcrumbs", ".comments", "#comments", ".related",
    ]
    for sel in junk_selectors:
        for t in soup.select(sel):
            t.decompose()

    candidate_selectors = [
        "article", "main", "#content", "#main", ".content", ".post-content", ".entry-content",
        ".article-content", ".chapter-content", ".chapterContent", ".read-content",
        ".read__content", ".content-body", ".story-content"
    ]
    candidates = []
    for sel in candidate_selectors:
        candidates.extend(soup.select(sel))

    def score(node):
        paragraph_text = " ".join(p.get_text(" ", strip=True) for p in node.find_all("p"))
        return len(paragraph_text)

    best = None
    best_score = 0
    for c in candidates:
        s = score(c)
        if s > best_score:
            best_score = s
            best = c

    if best is None:
        best = soup.body or soup

    parts = []
    for p in best.find_all(["p", "div"]):
        txt = p.get_text(" ", strip=True)
        if txt:
            parts.append(txt)

    text = "\n\n".join(parts)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return unescape("\n".join(lines)).strip()


def extract_text(html: str, base_url: str) -> str:
    if TRAFILATURA:
        try:
            out = trafilatura.extract(html, include_comments=False, include_tables=False, include_links=False, url=base_url)
            if out and out.strip():
                return out.strip()
        except Exception:
            pass

    soup = BeautifulSoup(html, "lxml")
    return _clean_visible_text_from_soup(soup)


def detect_nav_links(html: str, base_url: str) -> dict:
    result = {"next": None, "previous": None}
    soup = BeautifulSoup(html, "lxml")

    for link in soup.find_all("link"):
        rels = " ".join(link.get("rel", [])).lower()
        href = link.get("href")
        if not href:
            continue
        abs_href = urljoin(base_url, href)
        if "next" in rels and not result["next"]:
            result["next"] = abs_href
        if "prev" in rels or "previous" in rels:
            if not result["previous"]:
                result["previous"] = abs_href

    for a in soup.find_all("a"):
        rels = " ".join(a.get("rel", [])).lower()
        href = a.get("href")
        if not href:
            continue
        abs_href = urljoin(base_url, href)
        if "next" in rels and not result["next"]:
            result["next"] = abs_href
        if ("prev" in rels or "previous" in rels) and not result["previous"]:
            result["previous"] = abs_href

    for a in soup.find_all("a"):
        href = a.get("href")
        if not href:
            continue
        txt = a.get_text(" ", strip=True).lower()
        abs_href = urljoin(base_url, href)
        for w in _NEXT_WORDS:
            if w in txt and not result["next"]:
                result["next"] = abs_href
                break
        for w in _PREV_WORDS:
            if w in txt and not result["previous"]:
                result["previous"] = abs_href
                break

    return result


def detect_chapter_number_from_url_or_html(url: str, html: str):
    try:
        p = urlparse(url).path.lower()
    except Exception:
        p = url.lower()

    for pat in _CHAPTER_PATTERNS:
        m = re.search(pat, p)
        if m:
            try:
                return int(m.group(1))
            except Exception:
                pass

    soup = BeautifulSoup(html, "lxml")
    title = (soup.title.get_text(" ", strip=True) if soup.title else "") or ""
    heading = ""
    h = soup.find(["h1", "h2", "h3"])
    if h:
        heading = h.get_text(" ", strip=True)

    for txt in (title, heading):
        for pat in [r"chapter\s+(\d+)", r"chap\.*\s*(\d+)", r"第\s*(\d+)\s*章", r"p\s*(\d+)$"]:
            m = re.search(pat, txt, re.IGNORECASE)
            if m:
                try:
                    return int(m.group(1))
                except Exception:
                    pass

    return None


def infer_chapter_pattern(url: str, html: str) -> dict:
    parsed = urlparse(url)
    path = parsed.path

    m = re.search(r"(p)(\d+)(\.html?)$", path, re.IGNORECASE)
    if m:
        prefix = path[: m.start(2)]
        suffix = path[m.end(2) :]
        template = f"{parsed.scheme}://{parsed.netloc}{prefix}${{n}}{suffix}"
        return {"pattern_type": "pN_html", "template": template}

    m = re.search(r"(\d+)(?:\.html?)?$", path)
    if m:
        start, end = m.span(1)
        template = parsed._replace(path=path[:start] + "${n}" + path[end:]).geturl()
        return {"pattern_type": "numeric_segment", "template": template}

    m = re.search(r"(chapter)[-_ ]?(\d+)", path, re.IGNORECASE)
    if m:
        prefix = path[: m.start(2)]
        suffix = path[m.end(2) :]
        template = parsed._replace(path=prefix + "${n}" + suffix).geturl()
        return {"pattern_type": "chapter_prefix", "template": template}

    return {"pattern_type": "unknown", "template": None}


def guess_url_step(url: str, step: int) -> str | None:
    parsed = urlparse(url)
    path = parsed.path
    matches = list(re.finditer(r"(\d+)", path))
    if not matches:
        return None

    for m in reversed(matches):
        s, e = m.span(1)
        num = int(m.group(1))
        new_num = num + step
        if new_num < 0:
            continue
        new_path = path[:s] + str(new_num) + path[e:]
        return parsed._replace(path=new_path).geturl()
    return None