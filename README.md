# WebTextExtract - Copilot Style

A modern, intelligent webnovel scraper with Copilot-inspired design and smart chapter navigation capabilities. Extract clean content from webnovel sites with automatic pattern detection and seamless chapter-to-chapter navigation.

![WebTextExtract Demo](https://img.shields.io/badge/Demo-Live-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![Flask](https://img.shields.io/badge/Flask-Latest-red)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 🔍 Smart Pattern Detection
- **Auto-Detection**: Automatically recognizes chapter patterns from URLs
- **Multiple Formats**: Supports p1.html, ch1.html, chapter1.html, numeric patterns, and more
- **No Manual Input**: Just paste the URL and let the app figure out the rest

### 🧭 Seamless Navigation
- **Previous/Next Buttons**: Navigate between chapters with intelligent URL generation
- **Auto-Extraction**: Automatically extracts content when navigating
- **Browser History**: Full browser back/forward support with URL updates

### 🎨 Copilot-Inspired Design
- **Modern Interface**: Clean, distraction-free layout matching Microsoft Copilot
- **Professional Typography**: Uses Inter font with blue-to-purple gradients
- **Responsive**: Works perfectly on desktop, tablet, and mobile devices
- **Dark/Light Themes**: Toggle between reading modes with persistent preferences

### 💾 Memory & History
- **URL History**: Tracks recently extracted URLs with domain and chapter info
- **Reading Progress**: Remembers your last URL and chapter position
- **Pattern Memory**: Stores detected patterns for quick recognition

### 🛠️ Advanced Features
- **Clean Text Extraction**: Removes ads, navigation, and clutter using Trafilatura
- **Copy to Clipboard**: One-click content copying with visual feedback
- **Word Count**: Live word count display for extracted content
- **Status Indicators**: Real-time status updates with inline icons

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/webtextextract.git
   cd webtextextract
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set environment variables**
   ```bash
   export SESSION_SECRET=your-secret-key-here
   ```

4. **Run the application**
   ```bash
   python main.py
   ```

5. **Open in browser**
   ```
   http://localhost:5000
   ```

### Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Fork this repository
2. Connect your GitHub account to Render
3. Create a new Web Service
4. Connect your forked repository
5. Set environment variables in Render dashboard
6. Deploy automatically

## 📁 Project Structure

```
webtextextract/
├── static/
│   ├── style.css          # Copilot-inspired styles
│   └── script.js          # Modern JavaScript app
├── templates/
│   └── index.html         # Single-page application
├── app.py                 # Flask application
├── web_scraper.py         # Content extraction logic
├── main.py               # Application entry point
├── requirements.txt       # Python dependencies
├── render.yaml           # Render deployment config
├── replit.md            # Project documentation
└── README.md            # This file
```

## 🛠️ Technology Stack

- **Backend**: Python Flask with Gunicorn
- **Frontend**: Vanilla JavaScript (ES6+), CSS Grid/Flexbox
- **Content Extraction**: Trafilatura library
- **Styling**: CSS Custom Properties, Inter font
- **Icons**: Feather Icons (SVG)
- **Database**: In-memory storage for patterns and history

## 📖 Usage Examples

### Basic Usage
1. Enter any webnovel chapter URL (e.g., `https://site.com/novel/ch1.html`)
2. Click "Extract" - the app auto-detects the chapter pattern
3. Use Previous/Next buttons to navigate between chapters
4. Copy content with the top-right copy button

### Supported URL Formats
- `https://site.com/novel/p1.html` → `p2.html`, `p3.html`, etc.
- `https://site.com/novel/ch001.html` → `ch002.html`, `ch003.html`, etc.
- `https://site.com/novel/chapter1.html` → `chapter2.html`, etc.
- `https://site.com/novel/1.html` → `2.html`, `3.html`, etc.

## 🎯 API Endpoints

- `GET /` - Main application page
- `POST /check-lock` - Pattern detection and validation
- `POST /scrape` - Content extraction from URL
- `POST /navigate` - Chapter navigation logic

## ⚙️ Configuration

### Environment Variables
- `SESSION_SECRET`: Secret key for Flask sessions (required)
- `PORT`: Server port (default: 5000)

### Features Configuration
- **Theme**: Auto-detected from user preference, toggleable
- **History Limit**: Stores last 10 URLs in browser storage
- **Pattern Memory**: Automatic pattern detection and storage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- **Microsoft Copilot** for design inspiration
- **Trafilatura** for excellent content extraction
- **Flask** for the lightweight web framework
- **Inter Font** for beautiful typography

## 📊 Features Roadmap

- [ ] Multiple site templates support
- [ ] Batch chapter downloading
- [ ] EPUB export functionality
- [ ] Advanced filtering options
- [ ] Reading statistics dashboard
- [ ] Bookmarking system

## 🐛 Bug Reports

Found a bug? Please open an issue on GitHub with:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Sample URL (if applicable)

## 💬 Support

Need help? 
- Check the [Issues](https://github.com/yourusername/webtextextract/issues) page
- Create a new issue with the "question" label
- Join our [Discussions](https://github.com/yourusername/webtextextract/discussions)

---

Made with ❤️ for webnovel readers worldwide