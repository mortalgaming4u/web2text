import trafilatura
import logging

def get_website_text_content(url: str, force: bool = False) -> str:
    """
    Extracts main text content from a given URL using Trafilatura.
    Falls back to html2txt if structured extraction fails or if force is True.

    Parameters:
    - url (str): The target webpage URL.
    - force (bool): If True, skips structured extraction and uses raw text.

    Returns:
    - str: Extracted text content or empty string if extraction fails.
    """
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            logging.warning(f"❌ Failed to download content from {url}")
            return ""

        if force:
            fallback = trafilatura.html2txt(downloaded)
            if fallback:
                logging.info(f"⚠️ Forced fallback extract used for {url}")
                return fallback
            else:
                logging.warning(f"⚠️ Forced fallback failed for {url}")
                return ""

        # Try structured extraction first
        text = trafilatura.extract(downloaded)
        if text:
            logging.debug(f"✅ Structured extract: {len(text)} characters from {url}")
            return text

        # Fallback to raw text extraction
        fallback = trafilatura.html2txt(downloaded)
        if fallback:
            logging.info(f"⚠️ Fallback extract used for {url}")
            return fallback

        logging.warning(f"❌ No extractable text found from {url}")
        return ""

    except Exception as e:
        logging.error(f"🔥 Error extracting content from {url}: {str(e)}")
        return ""