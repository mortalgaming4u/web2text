import requests
import trafilatura
from bs4 import BeautifulSoup
import logging

MIN_TEXT_LENGTH = 200  # Minimum characters for valid extraction

def extract_text_and_metadata(url):
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/115.0.0.0 Safari/537.36'
        )
    }

    # 1️⃣ Fetch page
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.encoding = resp.apparent_encoding
        resp.raise_for_status()
        html = resp.text
    except Exception as e:
        logging.error(f"Request failed for {url}: {e}")
        return {"error": f"Failed to fetch the URL: {e}"}

    # 2️⃣ Try Trafilatura extraction
    downloaded = trafilatura.extract(html, include_comments=False, include_tables=False)
    if downloaded and len(downloaded.strip()) > MIN_TEXT_LENGTH:
        soup = BeautifulSoup(html, "html.parser")
        return {
            "text": clean_text(downloaded),
            "title": get_title(soup),
            "meta_description": get_meta_description(soup),
            "method": "trafilatura"
        }

    # 3️⃣ Fallback heuristic with BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")

    # Remove unnecessary tags
    for tag in soup(['script', 'style', 'noscript', 'header', 'footer', 'nav', 'aside', 'form', 'iframe']):
        tag.decompose()

    title = get_title(soup)
    meta_desc = get_meta_description(soup)

    # Score content blocks
    candidates = []
    for tag in soup.find_all(['article', 'main', 'section', 'div']):
        text = tag.get_text(separator=" ", strip=True)
        link_density = len(tag.find_all('a')) / (len(text.split()) + 1)
        if len(text) > MIN_TEXT_LENGTH and link_density < 0.15:
            score = len(text) + (len(tag.find_all('p')) * 50)  # bonus for paragraphs
            candidates.append((score, text))

    content = candidates[0][1] if candidates else soup.get_text(separator=" ", strip=True)
    content = clean_text(content)

    return {
        "text": content,
        "title": title,
        "meta_description": meta_desc,
        "method": "fallback"
    }

# ✅ Helper functions
def get_title(soup):
    return soup.title.string.strip() if soup.title else ""

def get_meta_description(soup):
    tag = soup.find("meta", attrs={"name": "description"}) or \
          soup.find("meta", attrs={"property": "og:description"})
    return tag["content"].strip() if tag and tag.get("content") else ""

def clean_text(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


# ✅ Example usage
if __name__ == "__main__":
    url = "https://en.m.wikipedia.org/wiki/Wikipedia"
    result = extract_text_and_metadata(url)
    print("Method:", result.get("method"))
    print("Title:", result.get("title"))
    print("Meta Description:", result.get("meta_description"))
    print("Extracted Text:\n", result.get("text")[:2000])  # first 2000 chars