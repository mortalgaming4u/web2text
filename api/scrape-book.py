from http.server import BaseHTTPRequestHandler
import json
from web_scraper import scrape_full_book  # use the new full book scraper

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/scrape-book":
            try:
                content_length = int(self.headers['Content-Length'])
                body = self.rfile.read(content_length)
                data = json.loads(body)

                url = data.get("url")
                if not url:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"status":"error","message":"Missing URL"}')
                    return

                chapters, text = scrape_full_book(url, max_chapters=2000)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                response = {
                    "status": "success",
                    "chapters_scraped": chapters,
                    "preview": text[:500]  # send snippet only
                }
                self.wfile.write(json.dumps(response).encode())

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                error_response = {
                    "status": "error",
                    "message": str(e)
                }
                self.wfile.write(json.dumps(error_response).encode())
