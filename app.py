# app.py
import os
import time
from flask import Flask, request, jsonify, render_template, send_from_directory
from urllib.parse import urljoin

from web_scraper import (
    fetch_html,
    extract_text,
    detect_nav_links,
    detect_chapter_number_from_url_or_html,
    infer_chapter_pattern,
    guess_url_step,
)

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["JSON_SORT_KEYS"] = False


def _error(msg, code=400):
    return jsonify({"status": "error", "message": msg}), code


@app.route("/", methods=["GET"])
def index():
    # Serve templates/index.html if present, otherwise fallback to static index
    try:
        return render_template("index.html")
    except Exception:
        return send_from_directory("templates", "index.html")


@app.route("/check-lock", methods=["POST"])
def check_lock():
    """
    Body: { pattern: "", url: "..." }
    Response: { status: "success", auto_detected: True, chapter_info: {...}, pattern: {...}, nav: {...} }
    """
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return _error("Missing 'url' parameter.")

    html, final_url = fetch_html(url, retries=2)
    if html is None:
        return _error("Failed to fetch URL (maybe blocked).", 502)

    nav = detect_nav_links(html, final_url)
    chapter_num = detect_chapter_number_from_url_or_html(final_url, html)
    pattern = infer_chapter_pattern(final_url, html)

    chapter_info = {
        "current_chapter": chapter_num if chapter_num is not None else "Unknown",
        "has_previous": bool(nav.get("previous")),
        "has_next": bool(nav.get("next")),
        "auto_detected": True,
    }

    return jsonify(
        {
            "status": "success",
            "auto_detected": True,
            "chapter_info": chapter_info,
            "pattern": pattern,
            "nav": nav,
            "final_url": final_url,
        }
    )


@app.route("/scrape", methods=["POST"])
def scrape():
    """
    Body: { url: "..." }
    Response: { status: "success", content: "...", final_url: "..." }
    """
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return _error("Missing 'url' parameter.")

    html, final_url = fetch_html(url, retries=2)
    if html is None:
        return _error("Failed to fetch URL (maybe blocked).", 502)

    text = extract_text(html, final_url)
    if not text or not text.strip():
        return _error("No textual content found", 422)

    return jsonify({"status": "success", "content": text, "final_url": final_url})


@app.route("/navigate", methods=["POST"])
def navigate():
    """
    Body: { direction: "next"|'previous', current_url: "..." }
    Response: { status: "success", new_url: "...", chapter: ... }
    """
    data = request.get_json(silent=True) or {}
    direction = (data.get("direction") or "").strip().lower()
    current_url = (data.get("current_url") or "").strip()
    if direction not in {"next", "previous"}:
        return _error("Invalid direction (use 'next' or 'previous').")
    if not current_url:
        return _error("Missing 'current_url' parameter.")

    html, final_url = fetch_html(current_url, retries=2)
    if html is None:
        return _error("Failed to fetch current URL for navigation.", 502)

    nav = detect_nav_links(html, final_url)
    candidate = nav.get(direction)

    # Fallback: numeric stepping in URL
    if not candidate:
        step = 1 if direction == "next" else -1
        candidate = guess_url_step(final_url, step)

    if not candidate:
        return jsonify({"status": "error", "message": f"No {direction} link found."})

    # Fetch and detect new chapter number (best-effort)
    new_html, new_final = fetch_html(candidate, retries=1)
    chapter = None
    if new_html:
        chapter = detect_chapter_number_from_url_or_html(new_final, new_html)

    return jsonify({"status": "success", "new_url": candidate, "chapter": chapter or "Unknown"})


# Static files passthrough for Render
@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(app.static_folder, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)