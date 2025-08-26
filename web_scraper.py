import trafilatura
import logging


def get_website_text_content(url: str) -> str:
    """
    This function takes a url and returns the main text content of the website.
    The text content is extracted using trafilatura and easier to understand.
    The results is not directly readable, better to be summarized by LLM before consume
    by the user.

    Some common website to crawl information from:
    MLB scores: https://www.mlb.com/scores/YYYY-MM-DD
    """
    try:
        # Send a request to the website
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            logging.warning(f"Failed to download content from {url}")
            return ""
        
        text = trafilatura.extract(downloaded)
        if text:
            logging.debug(f"Successfully extracted {len(text)} characters from {url}")
            return text
        else:
            logging.warning(f"No text content extracted from {url}")
            return ""
            
    except Exception as e:
        logging.error(f"Error extracting content from {url}: {str(e)}")
        return ""
