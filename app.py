from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import trafilatura
import re
from urllib.parse import urlparse, urlunparse
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

def extract_chapter_number(url):
    """Extract chapter number from URL using pattern matching"""
    patterns = [
        r'/chapter-(\d+)',
        r'/ch(\d+)',
        r'/chapter(\d+)',
        r'/p(\d+)',
        r'/(\d+)/?$',
        r'[^0-9](\d+)[^0-9]*$'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                continue
    return None

def generate_next_url(current_url, direction):
    """Generate next/previous chapter URL"""
    try:
        current_chapter = extract_chapter_number(current_url)
        if current_chapter is None:
            return None
            
        if direction == 'next':
            new_chapter = current_chapter + 1
        else:  # previous
            new_chapter = max(1, current_chapter - 1)
        
        # Replace chapter number in URL
        patterns = [
            (r'/chapter-(\d+)', f'/chapter-{new_chapter}'),
            (r'/ch(\d+)', f'/ch{new_chapter}'),
            (r'/chapter(\d+)', f'/chapter{new_chapter}'),
            (r'/p(\d+)', f'/p{new_chapter}'),
            (r'/(\d+)/?$', f'/{new_chapter}'),
        ]
        
        for pattern, replacement in patterns:
            if re.search(pattern, current_url):
                new_url = re.sub(pattern, replacement, current_url)
                return new_url
        
        # Fallback: append /increment at the end
        if re.search(r'/\d+$', current_url):
            return re.sub(r'/\d+$', f'/{new_chapter}', current_url)
        else:
            return f"{current_url.rstrip('/')}/{new_chapter}"
            
    except Exception as e:
        logging.error(f"Error generating URL: {str(e)}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scrape', methods=['POST'])
def scrape():
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'status': 'error', 'message': 'No URL provided'})
        
        logging.info(f"Scraping URL: {url}")
        
        # Use trafilatura to extract content
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return jsonify({'status': 'error', 'message': 'Failed to download content'})
        
        text = trafilatura.extract(downloaded)
        if text:
            return jsonify({
                'status': 'success',
                'content': text,
                'message': 'Content extracted successfully'
            })
        else:
            return jsonify({'status': 'error', 'message': 'No text content found'})
            
    except Exception as e:
        logging.error(f"Scraping error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Internal server error'})

@app.route('/check-lock', methods=['POST'])
def check_lock():
    try:
        data = request.get_json()
        url = data.get('url')
        pattern = data.get('pattern', '')
        
        chapter_number = extract_chapter_number(url)
        if chapter_number is not None:
            return jsonify({
                'status': 'success',
                'auto_detected': True,
                'chapter_info': {
                    'current_chapter': chapter_number,
                    'total_chapters': None  # Can't determine total from single URL
                },
                'message': 'Chapter pattern auto-detected'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Could not auto-detect chapter pattern'
            })
            
    except Exception as e:
        logging.error(f"Check-lock error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Internal server error'})

@app.route('/navigate', methods=['POST'])
def navigate():
    try:
        data = request.get_json()
        direction = data.get('direction')
        current_url = data.get('current_url')
        
        if direction not in ['previous', 'next']:
            return jsonify({'status': 'error', 'message': 'Invalid direction'})
        
        new_url = generate_next_url(current_url, direction)
        if new_url:
            new_chapter = extract_chapter_number(new_url)
            return jsonify({
                'status': 'success',
                'new_url': new_url,
                'chapter': new_chapter,
                'message': f'Navigated to {direction} chapter'
            })
        else:
            return jsonify({'status': 'error', 'message': 'Could not generate navigation URL'})
            
    except Exception as e:
        logging.error(f"Navigation error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Internal server error'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)