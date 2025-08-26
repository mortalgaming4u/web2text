import os
import logging
from flask import Flask, render_template, request, flash, redirect, url_for, jsonify, make_response
from werkzeug.middleware.proxy_fix import ProxyFix
from web_scraper import extract_text_and_metadata
import re
from urllib.parse import urlparse
import time

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "your-secret-key-here")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

def is_valid_url(url):
    """Validate if the provided string is a valid URL"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

def clean_text(text):
    """Clean and format extracted text"""
    if not text:
        return ""
    
    # Remove extra whitespace and normalize line breaks
    text = re.sub(r'\n\s*\n', '\n\n', text)
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text

@app.route('/', methods=['GET', 'POST'])
def index():
    """Main page with URL input form and results"""
    results = []
    urls_input = ''
    
    if request.method == 'POST':
        urls_input = request.form.get('urls', '').strip()
        
        if not urls_input:
            flash('Please enter at least one URL', 'error')
        else:
            # Split URLs by newlines and clean them
            urls = [url.strip() for url in urls_input.split('\n') if url.strip()]
            
            if not urls:
                flash('Please enter valid URLs', 'error')
            else:
                for url in urls:
                    # Add protocol if missing
                    if not url.startswith(('http://', 'https://')):
                        url = 'https://' + url
                    
                    if not is_valid_url(url):
                        results.append({
                            'url': url,
                            'success': False,
                            'error': 'Invalid URL format',
                            'text': ''
                        })
                        continue
                    
                    try:
                        app.logger.info(f"Extracting text from: {url}")
                        result = extract_text_and_metadata(url)
                        raw_text = result.get("text", "")
                        
                        if raw_text:
                            cleaned_text = clean_text(raw_text)
                            results.append({
                                'url': url,
                                'success': True,
                                'error': None,
                                'text': cleaned_text,
                                'word_count': len(cleaned_text.split()) if cleaned_text else 0,
                                'title': result.get("title", ""),
                                'meta_description': result.get("meta_description", ""),
                                'method': result.get("method", "")
                            })
                            app.logger.info(f"Successfully extracted {len(cleaned_text)} characters from {url}")
                        else:
                            results.append({
                                'url': url,
                                'success': False,
                                'error': 'No text content found on this page',
                                'text': ''
                            })
                            
                    except Exception as e:
                        app.logger.error(f"Error extracting from {url}: {str(e)}")
                        results.append({
                            'url': url,
                            'success': False,
                            'error': f'Failed to extract text: {str(e)}',
                            'text': ''
                        })
    
    return render_template('index.html', results=results, urls_input=urls_input)


@app.route('/export')
def export_text():
    """Export extracted text as a plain text file"""
    text_content = request.args.get('content', '')
    filename = request.args.get('filename', 'extracted_text.txt')
    
    if not text_content:
        flash('No content to export', 'error')
        return redirect(url_for('index'))
    
    response = make_response(text_content)
    response.headers['Content-Type'] = 'text/plain'
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': time.time()})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)