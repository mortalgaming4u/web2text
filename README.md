# Web2Text Extractor

A mobile-first, memory-driven webnovel extractor with Copilot-inspired UX. Built for immersive reading, seamless translation, and persistent navigation across chapters.

## ✨ Features
- Universal chapter navigation with persistent memory
- Copilot-style UI: distraction-free, fluid, and responsive
- Seamless mobile + desktop support via Termux and GitHub
- Integrated translation prompt for emotionally resonant output
- Modular backend with Flask, Gunicorn, and custom scraper

## 🚀 Setup
```bash
git clone https://github.com/mortalgaming4u/web2text.git
cd web2text
pip install -r requirements.txt
python app.py
```

## 📁 Structure
- app.py – Flask app and routing
- web_scraper.py – Core extraction logic
- templates/ – HTML views
- static/ – CSS/JS assets
- requirements.txt – Dependencies

## 🧠 Translation Prompt
Stored in config.json (optional). Automatically applied during extraction.

## 📜 License
MIT – free to use, modify, and share.
