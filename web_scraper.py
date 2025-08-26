import trafilatura
import logging
import requests
from bs4 import BeautifulSoup

def get_website_text_content(url: str) -> str:
    """Extracts readable text from any website using Trafilatura first, then BeautifulSoup fallback."""
    try:
        # Primary extractor: Trafilatura
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
            if text:
                logging.debug(f"Trafilatura extracted {len(text)} characters from {url}")
                return text

        # Fallback extractor: BeautifulSoup
        logging.warning(f"Trafilatura failed or returned empty for {url}, using fallback.")
        soup = get_soup(url)
        return fallback_extract(soup)

    except Exception as e:
        logging.error(f"Error extracting content from {url}: {str(e)}")
        return "Extraction error."

def get_soup(url: str) -> BeautifulSoup:
    """Fetches and parses HTML content into a BeautifulSoup object."""
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return BeautifulSoup(response.text, 'html.parser')

def fallback_extract(soup: BeautifulSoup) -> str:
    """Heuristic fallback for extracting readable content from HTML."""
    candidates = soup.find_all(['article', 'main', 'section', 'div'])
    scored = [
        (len(tag.get_text(strip=True)), tag)
        for tag in candidates
        if len(tag.get_text(strip=True)) > 200
    ]
    if not scored:
        return "No readable content found."

    best_tag = max(scored, key=lambda x: x[0])[1]
    return clean_text(best_tag)

def clean_text(tag) -> str:
    """Sanitizes extracted HTML content."""
    for script in tag(['script', 'style', 'noscript']):
        script.decompose()
    text = tag.get_text(separator='\n', strip=True)
    return '\n'.join(line for line in text.splitlines() if line.strip())