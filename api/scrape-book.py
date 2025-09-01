from web_scraper import scrape_full_book

def handler(request):
    try:
        body = request.json()
        url = body.get("url")

        if not url or not isinstance(url, str):
            return {
                "status": "error",
                "message": "Missing or invalid 'url' in request body"
            }

        print(f"[INFO] Starting scrape for: {url}")
        result = scrape_full_book(url)

        # Optional: preview first chapter
        preview = result["chapters"][0][:300] if result["chapters"] else ""

        return {
            "status": "success",
            "chapters_scraped": len(result["chapters"]),
            "preview": preview
        }

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }
