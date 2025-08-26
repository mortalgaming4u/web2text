import requests
import trafilatura
from bs4 import BeautifulSoup
import logging
import time

logging.basicConfig(level=logging.INFO)

def extract_text_and_metadata(url, max_retries=3):
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/115.0.0.0 Safari/537.36'
        )
    }
    
    # Retry mechanism for better reliability
    for attempt in range(1, max_retries + 1):
        try:
            logging.info(f"[Attempt {attempt}] Fetching URL: {url}")
            start_time = time.time()
            resp = requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            html = resp.text
            logging.info(f"Fetched {len(html)} characters from {url} in {round(time.time()-start_time, 2)}s")
            break
        except Exception as e:
            logging.warning(f"Request attempt {attempt} failed: {e}")
            if attempt == max_retries:
                return {"error": f"Failed to fetch the URL after {max_retries} attempts: {e}"}
            time.sleep(2)
    
    # === 1️⃣ Try Trafilatura first ===
    extracted = trafilatura.extract(html, include_comments=False, include_tables=False)
    if extracted and len(extracted.strip()) > 200:
        logging.info(f"[Trafilatura] Successfully extracted text from {url}")
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.string.strip() if soup.title else ""
        meta_desc = ""
        desc_tag = soup.find("meta", attrs={"name": "description"})
        if desc_tag and desc_tag.get("content"):
            meta_desc = desc_tag["content"].strip()
        return {
            "text": extracted,
            "title": title,
            "meta_description": meta_desc,
            "method": "trafilatura"
        }
    
    # === 2️⃣ Fallback: BeautifulSoup heuristics ===
    logging.info(f"[Fallback] Using BeautifulSoup for {url}")
    soup = BeautifulSoup(html, "html.parser")
    
    # Remove unwanted tags
    for tag in soup(['script', 'style', 'noscript', 'header', 'footer', 'nav', 'aside', 'form', 'iframe']):
        tag.decompose()
    
    title = soup.title.string.strip() if soup.title else ""
    meta_desc = ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag and desc_tag.get("content"):
        meta_desc = desc_tag["content"].strip()
    
    # Find best content blocks
    candidates = []
    for tag in soup.find_all(['article', 'main', 'section', 'div']):
        text = tag.get_text(separator=" ", strip=True)
        link_density = len(tag.find_all('a')) / (len(text.split()) + 1)
        if len(text) > 200 and link_density < 0.15:
            candidates.append((len(text), text))
    
    if candidates:
        candidates.sort(reverse=True)
        content = candidates[0][1]
    else:
        content = soup.get_text(separator=" ", strip=True)
    
    # Clean text
    content = "\n".join([line.strip() for line in content.splitlines() if line.strip()])
    
    return {
        "text": content,
        "title": title,
        "meta_description": meta_desc,
        "method": "fallback"
    }