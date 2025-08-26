import os
import logging
from flask import Flask, render_template, request, jsonify, make_response
from werkzeug.middleware.proxy_fix import ProxyFix
from web_scraper import extract_text_and_metadata, find_navigation_links
from urllib.parse import urlparse
import time

# Configure logging
logging.basicConfig(level=logging.INFO)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "your-secret-key-here")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)


def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False


@app.route('/')
def index():
    return render_template('index.html')


# ✅ Endpoint: Check lock / auto-detect pattern
@app.route('/check-lock', methods=['POST'])
def check_lock():
    data = request.get_json()
    url = data.get('url')
    pattern = data.get('pattern', '')

    if not is_valid_url(url):
        return jsonify({"status": "error", "message": "Invalid URL"}), 400

    # Auto-detect chapters (dummy logic for now)
    # Later we can detect by parsing HTML structure
    auto_detected = True
    chapter_info = {
        "current_chapter": 1,
        "auto_detected": True
    }

    return jsonify({
        "status": "success",
        "message": "Pattern detected",
        "auto_detected": auto_detected,
        "chapter_info": chapter_info
    })


# ✅ Endpoint: Extract main content
@app.route('/scrape', methods=['POST'])
def scrape():
    data = request.get_json()
    url = data.get('url')

    if not is_valid_url(url):
        return jsonify({"status": "error", "message": "Invalid URL"}), 400

    try:
        result = extract_text_and_metadata(url)
        if result.get("text"):
            return jsonify({
                "status": "success",
                "content": result.get("text", ""),
                "title": result.get("title", ""),
                "meta_description": result.get("meta_description", "")
            })
        else:
            return jsonify({"status": "error", "message": "No text content found"}), 404
    except Exception as e:
        logging.error(f"Scraping error for {url}: {e}")
        return jsonify({"status": "error", "message": f"Extraction failed: {str(e)}"}), 500


# ✅ Endpoint: Navigate next/previous
@app.route('/navigate', methods=['POST'])
def navigate():
    data = request.get_json()
    direction = data.get('direction')
    current_url = data.get('current_url')

    if not is_valid_url(current_url):
        return jsonify({"status": "error", "message": "Invalid current URL"}), 400

    try:
        nav_links = find_navigation_links(current_url)
        new_url = nav_links.get(direction)

        if new_url:
            return jsonify({
                "status": "success",
                "new_url": new_url,
                "chapter": direction
            })
        else:
            return jsonify({"status": "error", "message": f"No {direction} link found"}), 404
    except Exception as e:
        logging.error(f"Navigation error: {e}")
        return jsonify({"status": "error", "message": f"Navigation failed: {str(e)}"}), 500


@app.route('/export')
def export_text():
    text_content = request.args.get('content', '')
    filename = request.args.get('filename', 'extracted_text.txt')

    response = make_response(text_content)
    response.headers['Content-Type'] = 'text/plain'
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'

    return response


@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': time.time()})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)