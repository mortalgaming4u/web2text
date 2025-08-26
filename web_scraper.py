import requests, trafilatura, logging, time
from bs4 import BeautifulSoup

MIN_LEN = 200
MAX_RETRIES = 3
logging.basicConfig(level=logging.INFO)

def extract_text_and_metadata(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': url
    }

    html = None
    for i in range(MAX_RETRIES):
        try:
            logging.info(f"Fetching {url} (attempt {i+1})")
            r = requests.get(url, headers=headers, timeout=20)
            r.raise_for_status()
            html = r.text
            break
        except Exception as e:
            logging.warning(f"Failed attempt {i+1}: {e}")
            time.sleep(1)
    if html is None:
        return {"text":"", "title":"", "meta_description":"", "method":"error", "error": "Fetch failed"}

    # Try Trafilatura
    extracted = trafilatura.extract(html, include_comments=False, include_tables=False)
    if extracted and len(extracted.strip()) > MIN_LEN:
        soup = BeautifulSoup(html, "html.parser")
        return {
            "text": extracted.strip(),
            "title": soup.title.text.strip() if soup.title else "",
            "meta_description": (soup.find("meta", {"name":"description"}) or {}).get("content","").strip(),
            "method": "trafilatura"
        }

    # Fallback with BS
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(['script','style','header','footer','nav','aside','form','iframe']):
        tag.decompose()

    candidates = []
    for tag in soup.find_all(['article','main','section','div']):
        text = tag.get_text(separator=" ", strip=True)
        ld = len(tag.find_all('a'))/(len(text.split())+1)
        if len(text) > MIN_LEN and ld < 0.15:
            candidates.append((len(text), text))

    if candidates:
        content = sorted(candidates, reverse=True)[0][1]
    else:
        content = soup.get_text(separator=" ", strip=True)

    return {
        "text": content.strip(),
        "title": soup.title.text.strip() if soup.title else "",
        "meta_description": "",
        "method": "fallback"
    }