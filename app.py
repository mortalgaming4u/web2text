import os
import logging
import json
from flask import Flask, render_template, request, jsonify, session
from web_scraper import get_website_text_content

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")

# In-memory storage for patterns and content
app_memory = {
    'lock_patterns': [],
    'scraped_content': [],
    'url_queue': []
}

@app.route('/')
def index():
    """Serve the main application page."""
    return render_template('index.html')


@app.route('/check-lock', methods=['POST'])
def check_lock():
    """Auto-detect URL pattern with optional validation."""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'status': 'fail', 'message': 'URL is required'}), 400

        pattern = data.get('pattern', '')
        url = data['url']
        logging.debug(f"Processing URL: {url} with pattern: {pattern}")

        chapter_info = extract_chapter_info(url, pattern)
        if not chapter_info:
            logging.debug("Unable to detect chapter pattern")
            return jsonify({'status': 'fail', 'message': 'No chapter pattern detected in URL'})

        # Build pattern record
        url_pattern = {
            'base_url': chapter_info['base_url'],
            'pattern': chapter_info['pattern'],
            'current_chapter': chapter_info['current_chapter'],
            'url_template': chapter_info['url_template'],
            'chapter_format': chapter_info['chapter_format'],
            'timestamp': str(len(app_memory['lock_patterns']) + 1)
        }

        # Upsert into memory
        existing = next((i for i,p in enumerate(app_memory['lock_patterns'])
                         if isinstance(p, dict) and p.get('base_url') == chapter_info['base_url']), None)
        if existing is not None:
            app_memory['lock_patterns'][existing] = url_pattern
        else:
            app_memory['lock_patterns'].append(url_pattern)
        logging.debug("URL pattern saved to memory")

        return jsonify({
            'status': 'success',
            'chapter_info': chapter_info,
            'can_navigate': True,
            'auto_detected': chapter_info.get('auto_detected', False)
        })

    except Exception as e:
        logging.error(f"Error in pattern detection: {str(e)}")
        return jsonify({'status': 'fail', 'message': 'Server error'}), 500


@app.route('/scrape', methods=['POST'])
def scrape():
    """Scrape content from the provided URL."""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'status': 'error', 'message': 'URL is required'}), 400

        url = data['url'].strip()
        if not url:
            return jsonify({'status': 'error', 'message': 'URL cannot be empty'}), 400

        # Ensure protocol
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        logging.debug(f"Scraping URL: {url}")

        content = get_website_text_content(url)
        if content and content.strip():
            entry = {'url': url, 'content': content, 'timestamp': str(len(app_memory['scraped_content']) + 1)}
            app_memory['scraped_content'].append(entry)
            logging.debug("Content scraped successfully")
            return jsonify({'status': 'success', 'content': content, 'url': url})
        else:
            logging.warning(f"No content extracted from URL: {url}")
            return jsonify({'status': 'error', 'message': 'No readable content found on this page'})

    except Exception as e:
        logging.error(f"Failed to scrape content: {str(e)}")
        return jsonify({'status': 'error', 'message': f"Failed to scrape content: {str(e)}"}), 500


@app.route('/extract', methods=['POST'])
def extract():
    """Extract content and provide preview snippet."""
    try:
        if request.is_json:
            data = request.get_json()
            url = data.get('url')
        else:
            url = request.form.get('url')

        if not url:
            return jsonify({'status': 'error', 'message': 'URL is required', 'preview': 'No URL provided'}), 400

        url = url.strip()
        if not url:
            return jsonify({'status': 'error', 'message': 'URL cannot be empty', 'preview': 'Empty URL'}), 400

        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        logging.debug(f"Extracting preview from URL: {url}")

        content = get_website_text_content(url)
        if content and content.strip():
            preview = content.strip()[:200] + ('...' if len(content) > 200 else '')
            entry = {
                'url': url,
                'content': content,
                'preview': preview,
                'timestamp': str(len(app_memory['scraped_content']) + 1),
                'type': 'preview'
            }
            app_memory['scraped_content'].append(entry)
            logging.debug("Preview extracted successfully")
            return jsonify({
                'status': 'success',
                'preview': preview,
                'url': url,
                'full_content_available': True,
                'content_length': len(content)
            })
        else:
            logging.warning(f"No content found for preview extraction: {url}")
            return jsonify({
                'status': 'error',
                'message': 'Could not extract readable content from this URL',
                'preview': 'No readable content found on this page'
            })

    except Exception as e:
        logging.error(f"Failed to extract preview: {str(e)}")
        return jsonify({'status': 'error', 'message': f"Failed to extract preview: {str(e)}", 'preview': 'Error occurred during extraction'}), 500


@app.route('/queue', methods=['POST'])
def queue_url():
    """Add URL to processing queue."""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'status': 'error', 'message': 'URL is required'}), 400

        url = data['url'].strip()
        action = data.get('action', 'queue')
        if not url:
            return jsonify({'status': 'error', 'message': 'URL cannot be empty'}), 400

        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        entry = {'url': url, 'action': action, 'timestamp': str(len(app_memory['url_queue']) + 1), 'status': 'queued'}
        existing = [e['url'] for e in app_memory['url_queue'] if e['status'] == 'queued']
        if url not in existing:
            app_memory['url_queue'].append(entry)
            logging.debug(f"URL queued: {url}")
            return jsonify({'status': 'success', 'message': 'URL queued successfully', 'queue_position': len(app_memory['url_queue']), 'url': url})
        else:
            return jsonify({'status': 'warning', 'message': 'URL already in queue', 'url': url})

    except Exception as e:
        logging.error(f"Failed to queue URL: {str(e)}")
        return jsonify({'status': 'error', 'message': f"Failed to queue URL: {str(e)}"}), 500


def extract_chapter_info(url, pattern):
    """Auto-detect chapter information from URL, with optional pattern validation."""
    import re
    chapter_patterns = [
        r'/p(\d+)\.html$', r'/ch(\d+)\.html$', r'/chapter(\d+)\.html$',
        r'/(\d+)\.html$', r'/(\d+)$',
        r'chapter[_-]?(\d+)', r'ch[_-]?(\d+)', r'p[_-]?(\d+)'
    ]

    for regex in chapter_patterns:
        match = re.search(regex, url, re.IGNORECASE)
        if not match:
            continue
        current = int(match.group(1))

        if pattern:
            expected = [f"p{current}", f"ch{current}", f"chapter{current}", str(current)]
            if pattern.lower().strip() not in expected:
                continue

        base = url[:match.start()]
        suffix = url[match.end():]
        template = base + '{chapter}' + suffix

        return {
            'base_url': base,
            'pattern': regex,
            'current_chapter': current,
            'url_template': template,
            'chapter_format': match.group(0).replace(str(current), '{chapter}'),
            'auto_detected': not bool(pattern)
        }

    return None


def generate_chapter_url(url_template, chapter_format, chapter_num):
    """Generate URL for specific chapter number."""
    formatted = chapter_format.replace('{chapter}', str(chapter_num))
    return url_template.replace('{chapter}', formatted)


@app.route('/navigate', methods=['POST'])
def navigate_chapter():
    """Navigate to next/previous chapter."""
    try:
        data = request.get_json()
        direction = data.get('direction')
        current_url = data.get('current_url')
        if not direction or not current_url:
            return jsonify({'status': 'error', 'message': 'Direction and current URL required'}), 400

        for patt in app_memory['lock_patterns']:
            if isinstance(patt, dict) and current_url.startswith(patt['base_url']):
                curr = patt['current_chapter']
                new = curr + 1 if direction == 'next' else curr - 1
                if new < 1:
                    return jsonify({'status': 'error', 'message': 'Cannot navigate to chapter less than 1'})

                new_url = generate_chapter_url(patt['url_template'], patt['chapter_format'], new)
                patt['current_chapter'] = new
                return jsonify({'status': 'success', 'new_url': new_url, 'chapter': new})

        return jsonify({'status': 'error', 'message': 'No matching URL pattern found'})

    except Exception as e:
        logging.error(f"Error in navigation: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Navigation error'}), 500


@app.route('/memory-state', methods=['GET'])
def get_memory_state():
    """Get current memory state for debugging."""
    return jsonify({
        'lock_patterns_count': len(app_memory['lock_patterns']),
        'scraped_content_count': len(app_memory['scraped_content']),
        'url_queue_count': len(app_memory['url_queue']),
        'patterns': app_memory['lock_patterns'],
        'recent_content': [
            {'url': c['url'], 'timestamp': c['timestamp']}
            for c in app_memory['scraped_content'][-5:]
        ]
    })


# -----------------------------------------------------------------------------
# New: Full-Book Reader Routes
# -----------------------------------------------------------------------------

# Load the cached book data (generated once via scraper.py)
with open("book_data.json", encoding="utf-8") as f:
    BOOK = json.load(f)

@app.route('/read')
def read():
    """Serve a single chapter from the full book cache."""
    chapter = request.args.get("chapter", "1")
    content = BOOK.get(chapter, {}).get("content", "Chapter not found.")
    return render_template("reader.html", content=content, chapter=int(chapter))


@app.route('/catalog')
def catalog():
    """Serve the table of contents for the full book."""
    return render_template("catalog.html", chapters=BOOK)


if __name__ == '__main__':
    # Launch the Flask dev server
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))
