import os
import logging
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
    'url_queue': []  # New queue for URLs
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

        pattern = data.get('pattern', '')  # Pattern is now optional
        url = data['url']

        logging.debug(f"Processing URL: {url} with pattern: {pattern}")

        # Extract chapter info (auto-detect if no pattern provided)
        chapter_info = extract_chapter_info(url, pattern)

        if chapter_info:
            # Store URL pattern in memory
            url_pattern = {
                'base_url': chapter_info['base_url'],
                'pattern': chapter_info['pattern'],
                'current_chapter': chapter_info['current_chapter'],
                'url_template': chapter_info['url_template'],
                'chapter_format': chapter_info['chapter_format'],
                'timestamp': str(len(app_memory['lock_patterns']) + 1)
            }

            # Update or add pattern
            existing_pattern = None
            for i, p in enumerate(app_memory['lock_patterns']):
                if isinstance(p, dict) and p.get('base_url') == chapter_info['base_url']:
                    existing_pattern = i
                    break

            if existing_pattern is not None:
                app_memory['lock_patterns'][existing_pattern] = url_pattern
            else:
                app_memory['lock_patterns'].append(url_pattern)

            logging.debug(f"URL pattern {'updated' if existing_pattern else 'saved'} to memory")

            return jsonify({
                'status': 'success',
                'chapter_info': chapter_info,
                'can_navigate': True,
                'auto_detected': chapter_info.get('auto_detected', False)
            })
        else:
            logging.debug("Unable to detect chapter pattern")
            return jsonify({'status': 'fail', 'message': 'No chapter pattern detected in URL'})

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

        # Add protocol if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        logging.debug(f"Scraping URL: {url}")

        # Extract content using trafilatura
        content = get_website_text_content(url)

        if content and content.strip():
            # Store scraped content in memory
            content_entry = {
                'url': url,
                'content': content,
                'timestamp': str(len(app_memory['scraped_content']) + 1)
            }
            app_memory['scraped_content'].append(content_entry)

            logging.debug(f"Content scraped successfully. Total entries: {len(app_memory['scraped_content'])}")
            return jsonify({
                'status': 'success',
                'content': content,
                'url': url
            })
        else:
            logging.warning(f"No content extracted from URL: {url}")
            return jsonify({
                'status': 'error',
                'message': 'No readable content found on this page'
            })

    except Exception as e:
        error_message = f"Failed to scrape content: {str(e)}"
        logging.error(error_message)
        return jsonify({'status': 'error', 'message': error_message}), 500

@app.route('/extract', methods=['POST'])
def extract():
    """Extract content and provide preview snippet."""
    try:
        # Handle both JSON and form data
        if request.is_json:
            data = request.get_json()
            url = data.get('url') if data else None
        else:
            url = request.form.get('url')
        
        if not url:
            return jsonify({
                'status': 'error', 
                'message': 'URL is required',
                'preview': 'No URL provided'
            }), 400

        url = url.strip()
        if not url:
            return jsonify({
                'status': 'error', 
                'message': 'URL cannot be empty',
                'preview': 'Empty URL'
            }), 400

        # Add protocol if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        logging.debug(f"Extracting preview from URL: {url}")

        # Extract full content
        content = get_website_text_content(url)

        if content and content.strip():
            # Generate preview snippet (first 200 characters)
            preview = content.strip()[:200]
            if len(content) > 200:
                preview += "..."
            
            # Store in memory for potential full extraction later
            content_entry = {
                'url': url,
                'content': content,
                'preview': preview,
                'timestamp': str(len(app_memory['scraped_content']) + 1),
                'type': 'preview'
            }
            app_memory['scraped_content'].append(content_entry)

            logging.debug(f"Preview extracted successfully for URL: {url}")
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
        error_message = f"Failed to extract preview: {str(e)}"
        logging.error(error_message)
        return jsonify({
            'status': 'error', 
            'message': error_message,
            'preview': 'Error occurred during extraction'
        }), 500

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

        # Add protocol if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        # Add to queue
        queue_entry = {
            'url': url,
            'action': action,
            'timestamp': str(len(app_memory['url_queue']) + 1),
            'status': 'queued'
        }
        
        # Avoid duplicates
        existing_urls = [entry['url'] for entry in app_memory['url_queue'] if entry['status'] == 'queued']
        if url not in existing_urls:
            app_memory['url_queue'].append(queue_entry)
            logging.debug(f"URL queued: {url}")
            
            return jsonify({
                'status': 'success',
                'message': f'URL queued successfully',
                'queue_position': len(app_memory['url_queue']),
                'url': url
            })
        else:
            return jsonify({
                'status': 'warning',
                'message': 'URL already in queue',
                'url': url
            })

    except Exception as e:
        error_message = f"Failed to queue URL: {str(e)}"
        logging.error(error_message)
        return jsonify({'status': 'error', 'message': error_message}), 500

def extract_chapter_info(url, pattern):
    """Auto-detect chapter information from URL, with optional pattern validation."""
    import re

    # Common chapter patterns
    chapter_patterns = [
        r'/p(\d+)\.html$',      # p1.html, p2.html
        r'/ch(\d+)\.html$',     # ch1.html, ch2.html  
        r'/chapter(\d+)\.html$', # chapter1.html
        r'/(\d+)\.html$',       # 1.html, 2.html
        r'/(\d+)$',             # ends with number
        r'chapter[_-]?(\d+)',   # chapter_1, chapter-1
        r'ch[_-]?(\d+)',        # ch_1, ch-1
        r'p[_-]?(\d+)',         # p_1, p-1
    ]

    # Auto-detect pattern from URL
    for regex in chapter_patterns:
        match = re.search(regex, url, re.IGNORECASE)
        if match:
            current_chapter = int(match.group(1))

            # If pattern is provided, validate it matches
            if pattern:
                expected_patterns = [
                    'p' + str(current_chapter), 
                    'ch' + str(current_chapter), 
                    'chapter' + str(current_chapter), 
                    str(current_chapter)
                ]
                if pattern.lower().strip() not in expected_patterns:
                    continue  # Try next pattern

            # Create URL template
            base_url = url[:match.start()]
            suffix = url[match.end():]
            url_template = base_url + '{chapter}' + suffix

            return {
                'base_url': base_url,
                'pattern': regex,
                'current_chapter': current_chapter,
                'url_template': url_template,
                'chapter_format': match.group(0).replace(str(current_chapter), '{chapter}'),
                'auto_detected': not pattern  # Flag for auto-detection
            }

    return None

def generate_chapter_url(url_template, chapter_format, chapter_num):
    """Generate URL for specific chapter number."""
    formatted_chapter = chapter_format.replace('{chapter}', str(chapter_num))
    return url_template.replace('{chapter}', formatted_chapter)

@app.route('/navigate', methods=['POST'])
def navigate_chapter():
    """Navigate to next/previous chapter."""
    try:
        data = request.get_json()
        if not data or 'direction' not in data or 'current_url' not in data:
            return jsonify({'status': 'error', 'message': 'Direction and current URL required'}), 400

        direction = data['direction']  # 'next' or 'prev'
        current_url = data['current_url']

        # Find matching pattern in memory
        for pattern in app_memory['lock_patterns']:
            if isinstance(pattern, dict) and current_url.startswith(pattern['base_url']):
                current_chapter = pattern['current_chapter']
                new_chapter = current_chapter + 1 if direction == 'next' else current_chapter - 1

                if new_chapter < 1:
                    return jsonify({'status': 'error', 'message': 'Cannot navigate to chapter less than 1'})

                new_url = generate_chapter_url(
                    pattern['url_template'], 
                    pattern['chapter_format'], 
                    new_chapter
                )

                # Update current chapter in memory
                pattern['current_chapter'] = new_chapter

                return jsonify({
                    'status': 'success',
                    'new_url': new_url,
                    'chapter': new_chapter
                })

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
            {
                'url': entry['url'], 
                'timestamp': entry['timestamp'],
                'content_length': len(entry.get('content', '')),
                'type': entry.get('type', 'full')
            } 
            for entry in app_memory['scraped_content'][-5:]  # Last 5 entries
        ],
        'queue_status': [
            {
                'url': entry['url'],
                'status': entry['status'],
                'timestamp': entry['timestamp']
            }
            for entry in app_memory['url_queue'][-10:]  # Last 10 queue entries
        ]
    })

@app.route('/clear-memory', methods=['POST'])
def clear_memory():
    """Clear all memory storage (useful for development/testing)."""
    try:
        memory_type = request.get_json().get('type', 'all') if request.is_json else 'all'
        
        if memory_type == 'all':
            app_memory['lock_patterns'].clear()
            app_memory['scraped_content'].clear()
            app_memory['url_queue'].clear()
            message = "All memory cleared"
        elif memory_type == 'patterns':
            app_memory['lock_patterns'].clear()
            message = "URL patterns cleared"
        elif memory_type == 'content':
            app_memory['scraped_content'].clear()
            message = "Scraped content cleared"
        elif memory_type == 'queue':
            app_memory['url_queue'].clear()
            message = "URL queue cleared"
        else:
            return jsonify({'status': 'error', 'message': 'Invalid memory type'}), 400
            
        logging.info(f"Memory cleared: {memory_type}")
        return jsonify({'status': 'success', 'message': message})
        
    except Exception as e:
        error_message = f"Failed to clear memory: {str(e)}"
        logging.error(error_message)
        return jsonify({'status': 'error', 'message': error_message}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)