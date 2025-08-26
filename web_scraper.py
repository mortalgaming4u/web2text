import re
import requests
import trafilatura
from bs4 import BeautifulSoup

def extract_text_and_metadata(url):
    headers = {'User-Agent': 'Mozilla/5.0'}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    html = resp.text

    # Try Trafilatura first
    text = trafilatura.extract(html)
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.strip() if soup.title else ""

    if text and len(text) > 200:
        return {"text": text, "title": title, "method": "trafilatura"}

    # Fallback: Clean with BS4
    for tag in soup(['script', 'style', 'nav', 'footer']):
        tag.decompose()
    raw_text = soup.get_text(separator="\n", strip=True)
    return {"text": raw_text, "title": title, "method": "bs4"}

def detect_chapter_info(url):
    # Detect chapter number from URL
    match = re.search(r'chapter[-_\s]?(\d+)|ch[-_\s]?(\d+)|p[-_\s]?(\d+)|第(\d+)章', url, re.I)
    if match:
        for g in match.groups():
            if g: return int(g)
    return None

def generate_next_prev_url(url, current_chapter, direction):
    if current_chapter is None:
        return None
    new_chapter = current_chapter + (1 if direction == "next" else -1)
    return re.sub(r'(\d+)(?!.*\d)', str(new_chapter), url)