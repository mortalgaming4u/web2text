from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        data = json.loads(body)

        url = data.get("url")
        if not url:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"status":"error","message":"Missing URL"}')
            return

        # Replace with your actual scraping logic
        chapters_scraped = 42  # dummy value

        self.send_response(200)
        self.end_headers()
        response = {
            "status": "success",
            "chapters_scraped": chapters_scraped
        }
        self.wfile.write(json.dumps(response).encode())
