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
    'scraped_content': []
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
        'patterns': app_memory['lock_patterns']
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
