# api/index.py
from app import app as vercel_app

def handler(environ, start_response):
    return vercel_app(environ, start_response)
