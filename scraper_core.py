import requests
from bs4 import BeautifulSoup
import trafilatura
from urllib.parse import urljoin, urlparse
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def fetch_html(url):
    """Fetch raw HTML from the URL"""
    response = requests.get(url, headers=HEADERS, timeout=15)
    response.raise_for_status()
    return response.text

def extract_text_and_metadata(url):
    """Extract text, title, and meta description from a URL."""
    result = {
        "url": url,
        "text": "",
        "title": "",
        "meta_description": "",
        "method": ""
    }
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(downloaded, include_comments=False, include_formatting=False)
            if text and len(text) > 300:  # Only accept if content is substantial
                result["text"] = text.strip()
                result["method"] = "trafilatura"
        
        # Fallback to BeautifulSoup if Trafilatura fails or text is too small
        if not result["text"]:
            html = fetch_html(url)
            soup = BeautifulSoup(html, "lxml")

            # Get title
            title_tag = soup.find("title")
            if title_tag:
                result["title"] = title_tag.get_text(strip=True)

            # Meta description
            meta_tag = soup.find("meta", attrs={"name": "description"})
            if meta_tag and meta_tag.get("content"):
                result["meta_description"] = meta_tag["content"].strip()

            # Extract main content
            for script in soup(["script", "style", "noscript"]):
                script.extract()

            paragraphs = soup.find_all(["p", "div"])
            text_content = " ".join(p.get_text(" ", strip=True) for p in paragraphs)
            text_content = re.sub(r"\s+", " ", text_content).strip()

            result["text"] = text_content
            result["method"] = "beautifulsoup"

        return result
    except Exception as e:
        result["error"] = str(e)
        return result

def detect_chapter_links(url, html):
    """Find previous and next chapter links for novel sites."""
    soup = BeautifulSoup(html, "lxml")
    prev_link, next_link = None, None

    for link in soup.find_all("a", href=True):
        text = link.get_text().lower()
        if "prev" in text or "previous" in text or "上一章" in text:
            prev_link = urljoin(url, link["href"])
        if "next" in text or "下一章" in text or "chapter" in text or "ch" in text:
            next_link = urljoin(url, link["href"])

    return {"previous": prev_link, "next": next_link}
