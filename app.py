from flask import Flask, request, jsonify
from web_scraper import extract_text_and_metadata, detect_chapter_info, generate_next_prev_url

app = Flask(__name__)

@app.route('/scrape', methods=['POST'])
def scrape():
    data = request.json
    url = data.get('url')
    if not url:
        return jsonify({"status": "error", "message": "URL is required"}), 400

    result = extract_text_and_metadata(url)
    chapter = detect_chapter_info(url)
    return jsonify({
        "status": "success",
        "content": result.get("text", ""),
        "chapter_info": {"current_chapter": chapter} if chapter else None
    })

@app.route('/navigate', methods=['POST'])
def navigate():
    data = request.json
    direction = data.get('direction')
    current_url = data.get('current_url')
    chapter = detect_chapter_info(current_url)

    if not current_url or not direction or chapter is None:
        return jsonify({"status": "error", "message": "Cannot navigate"}), 400

    new_url = generate_next_prev_url(current_url, chapter, direction)
    return jsonify({"status": "success", "new_url": new_url, "chapter": chapter + (1 if direction == "next" else -1)})

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})