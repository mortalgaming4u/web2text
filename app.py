import re
import os
from urllib.parse import urljoin, urlparse
from flask import Flask, request, jsonify, render_template, send_from_directory
from web_scraper import (
    fetch_html,
    extract_text,
    detect_nav_links,
    detect_chapter_number_from_url_or_html,
    guess_url_step,
)

app = Flask(__name__, static_folder="static", template_folder="templates")


# ---------- Helpers ----------
def _bad_request(msg, code=400):
    return jsonify({"status": "error", "message": msg}), code


# ---------- UI (keeps your existing index + static) ----------
@app.route("/", methods=["GET"])
def index():
    """
    Renders your index.html (already in your repo) and lets the JS read ?url=
    Nothing to change in your HTML/CSS.
    """
    # If you don't have templates/index.html, comment this out and return the static file instead.
    try:
        return render_template("index.html")
    except Exception:
        # Fallback if templates not present — serve a minimal page to load your static assets.
        html = """
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>web2text</title>
            <link rel="stylesheet" href="/static/style.css" />
          </head>
          <body>
            <div id="app"></div>
            <script src="/static/script.js"></script>
          </body>
        </html>
        """
        return html, 200


# ---------- API: /check-lock ----------
@app.route("/check-lock", methods=["POST"])
def check_lock():
    """
    Auto-detect 'novel-like' navigation & chapter number.
    Your frontend sends: { pattern: "", url: "..." }
    We don’t require a pattern — we auto-detect and return chapter info.
    """
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return _bad_request("Missing 'url'.")

    try:
        html, final_url = fetch_html(url)
        if html is None:
            return _bad_request("Could not fetch the page (blocked or timed out).", 502)

        nav = detect_nav_links(html, final_url)
        chapter = detect_chapter_number_from_url_or_html(final_url, html)

        chapter_info = {
            "current_chapter": chapter if chapter is not None else "Unknown",
            "has_previous": bool(nav.get("previous")),
            "has_next": bool(nav.get("next")),
            "auto_detected": True,
        }

        return jsonify(
            {
                "status": "success",
                "auto_detected": True,
                "chapter_info": chapter_info,
            }
        )

    except Exception as e:
        return _bad_request(f"Lock detection failed: {e}", 500)


# ---------- API: /scrape ----------
@app.route("/scrape", methods=["POST"])
def scrape():
    """
    Extracts clean text with Trafilatura -> BeautifulSoup fallback.
    Frontend sends: { url: "..." }
    """
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return _bad_request("Missing 'url'.")

    try:
        html, final_url = fetch_html(url)
        if html is None:
            return _bad_request("Could not fetch the page (blocked or timed out).", 502)

        text = extract_text(html, final_url)
        if not text or not text.strip():
            return _bad_request("No textual content found on this page.", 422)

        return jsonify({"status": "success", "content": text})

    except Exception as e:
        return _bad_request(f"Scrape failed: {e}", 500)


# ---------- API: /navigate ----------
@app.route("/navigate", methods=["POST"])
def navigate():
    """
    Resolves next/previous chapter.
    1) Use parsed nav links (rel/anchor text).
    2) Fallback to URL arithmetic (e.g., .../p12.html -> /p13.html).
    Returns: { status, new_url, chapter }
    """
    data = request.get_json(silent=True) or {}
    direction = (data.get("direction") or "").strip().lower()
    current_url = (data.get("current_url") or "").strip()

    if direction not in {"next", "previous"}:
        return _bad_request("Invalid 'direction' (use 'next' or 'previous').")
    if not current_url:
        return _bad_request("Missing 'current_url'.")

    try:
        html, final_url = fetch_html(current_url)
        if html is None:
            return _bad_request("Could not fetch the page to navigate from.", 502)

        # First, try nav links on the page
        nav = detect_nav_links(html, final_url)
        candidate = nav.get(direction)

        # Fallback to numeric stepping
        if not candidate:
            step = 1 if direction == "next" else -1
            candidate = guess_url_step(final_url, step)

        if not candidate:
            return jsonify(
                {"status": "error", "message": f"No {direction} chapter link found."}
            )

        # Compute chapter number for new page from candidate URL (best-effort)
        new_html, new_final = fetch_html(candidate)
        new_chapter = None
        if new_html is not None:
            new_chapter = detect_chapter_number_from_url_or_html(new_final, new_html)
            # if extraction fails, we still return URL; frontend will call /scrape

        return jsonify(
            {
                "status": "success",
                "new_url": candidate,
                "chapter": new_chapter if new_chapter is not None else "Unknown",
            }
        )

    except Exception as e:
        return _bad_request(f"Navigation failed: {e}", 500)


# ---------- Static passthrough (if you need it) ----------
@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(app.static_folder, filename)


# Render.com uses $PORT
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port, debug=False)