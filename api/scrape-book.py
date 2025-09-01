# api/scrape-book.py

from web_scraper import scrape_full_book

def handler(request):
    # 1. Only support POST
    if request.method != "POST":
        return (
            {"status": "error", "message": "Method Not Allowed"},
            405
        )

    # 2. Parse JSON safely
    try:
        body = request.json()
    except Exception as e:
        print(f"[ERROR] JSON parse failed: {e}")
        return (
            {"status": "error", "message": "Invalid JSON body"},
            400
        )

    # 3. Validate URL
    url = body.get("url") if isinstance(body, dict) else None
    if not url or not isinstance(url, str):
        return (
            {"status": "error", "message": "Missing or invalid 'url'"},
            400
        )

    print(f"[INFO] Starting scrape for: {url}")

    try:
        result = scrape_full_book(url)
        chapters = result.get("chapters", [])

        # 4. Build full JSON response
        response_body = {
            "status": "success",
            "chapters": chapters,
            "chapters_scraped": len(chapters),
            "preview": chapters[0][:300] if chapters else ""
        }
        return (response_body, 200)

    except Exception as e:
        # 5. Catch scraper/runtime errors
        print(f"[ERROR] scrape_full_book failed:", e)
        return (
            {"status": "error", "message": str(e)},
            500
        )
