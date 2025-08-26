# Overview

WebTextExtract is a modern, intelligent webnovel scraper featuring a complete Copilot-inspired design with horizontal header branding, URL history tracking, and comprehensive website information. The application automatically detects chapter patterns and enables seamless navigation between chapters with browser history support. Ready for deployment on GitHub and Render with complete project files and documentation.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## August 26, 2025 - Complete Copilot Redesign
- **Header**: Horizontal layout with logo on left, "WebTextExtract" centered, theme toggle on right
- **URL History**: Added comprehensive history section at bottom with domain previews and clear functionality  
- **Website Info**: Added detailed feature showcase with 6 information cards
- **Deployment Ready**: Complete project with README.md, LICENSE, .gitignore, Procfile, runtime.txt
- **Render Configuration**: Updated render.yaml for optimal deployment settings

# System Architecture

## Frontend Architecture
- **Single Page Application (SPA)**: Uses vanilla JavaScript with a class-based architecture (`WebnovelScraperApp`)
- **State Management**: Client-side state management using local storage for persistence of lock patterns and scraped content
- **UI Components**: Modern web interface with Copilot-inspired design system using CSS custom properties
- **Navigation**: Pattern-based navigation system with previous/next controls

## Backend Architecture
- **Framework**: Flask web framework with Python
- **Request Handling**: RESTful API endpoints for lock validation and content extraction
- **Memory Storage**: In-memory data storage using application-level dictionaries for patterns and content
- **Session Management**: Flask sessions with configurable secret key for security
- **Logging**: Comprehensive logging system for debugging and monitoring

## Chapter Navigation System
- **Smart Pattern Detection**: Automatically recognizes chapter formats (p1.html, ch1.html, chapter1.html, numeric patterns)
- **URL Template Generation**: Creates navigation templates for seamless chapter-to-chapter movement
- **Memory Persistence**: Stores chapter patterns and reading progress in browser storage
- **Navigation Controls**: Previous/Next buttons for instant chapter navigation

## Content Processing
- **Web Scraping Engine**: Uses Trafilatura library for intelligent text extraction from web pages
- **Content Storage**: Extracted content stored in application memory with navigation capabilities
- **Error Handling**: Comprehensive error handling for network failures and invalid URLs

# External Dependencies

## Core Libraries
- **Flask**: Web framework for Python backend
- **Trafilatura**: Advanced web scraping and text extraction library for clean content extraction

## Frontend Dependencies
- **Feather Icons**: Icon library for consistent UI iconography
- **Native Web APIs**: Local storage, fetch API, and DOM manipulation

## Development Environment
- **Python Runtime**: Requires Python environment for Flask application
- **Static File Serving**: Flask static file handling for CSS, JavaScript, and assets
- **Environment Variables**: Configurable session secret via environment variables

## Browser Compatibility
- **Modern Browsers**: Requires ES6+ support for class syntax and modern JavaScript features
- **CSS Grid/Flexbox**: Modern CSS layout techniques for responsive design