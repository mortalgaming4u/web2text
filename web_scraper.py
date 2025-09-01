import requests
from bs4 import BeautifulSoup
import time

MAX_CHAPTERS = 50
RETRY_LIMIT = 3
RETRY_DELAY = 2  # seconds

def fetch_with_retry(url):
    for attempt in range(RETRY_LIMIT):
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"[WARN] Retry {attempt+1}/{RETRY_LIMIT} failed for {url}: {e}")
            time.sleep(RETRY_DELAY)
    raise Exception(f"Failed to fetch {url} after {RETRY_LIMIT} retries")

def scrape_full_book(start_url):
    chapters = []
    visited = set()
    current_url = start_url

    for i in range(MAX_CHAPTERS):
        if current_url in visited:
            print(f"[INFO] Loop detected at {current_url}, stopping.")
            break

        print(f"[INFO] Scraping chapter {i+1}: {current_url}")
        visited.add(current_url)

        html = fetch_with_retry(current_url)
        soup = BeautifulSoup(html, "html.parser")

        # Extract chapter text
        content = soup.find("div", class_="chapter-content")
        if not content:
            print(f"[WARN] No content found at {current_url}")
            break
        chapters.append(content.get_text(strip=True))

        # Find next chapter link
        next_link = soup.find("a", class_="next")
        if not next_link or not next_link.get("href"):
            print(f"[INFO] No next link found at chapter {i+1}")
            break

        current_url = next_link["href"]

    return {"chapters": chapters}
