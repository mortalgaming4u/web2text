import os
import logging
from flask import Flask, render_template, request, flash, redirect, url_for, jsonify, make_response
from werkzeug.middleware.proxy_fix import ProxyFix
from web_scraper import extract_text_and_metadata, fetch_html, detect_chapter_links
import re
from urllib.parse import urlparse
import time

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "your-secret-key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'\n\s*\n', '\n\n', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scrape', methods=['POST'])
def scrape():
    data = request.json
    url = data.get("url")
    if not url:
        return jsonify({"error": "URL is required"}), 400

    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    if not is_valid_url(url):
        return jsonify({"error": "Invalid URL"}), 400

    try:
        html = fetch_html(url)
        result = extract_text_and_metadata(url)
        text = clean_text(result.get("text", ""))

        chapter_links = detect_chapter_links(url, html)

        return jsonify({
            "success": True,
            "url": url,
            "title": result.get("title", ""),
            "meta_description": result.get("meta_description", ""),
            "text": text,
            "word_count": len(text.split()),
            "method": result.get("method", ""),
            "navigation": chapter_links
        })
    except Exception as e:
        logging.error(f"Scraping error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": time.time()})