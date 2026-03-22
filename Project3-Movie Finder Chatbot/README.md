# Movie Finder Chatbot

A full-stack web app: type a city, get movies currently playing in theaters.

## Tech Stack
- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Scraping: Playwright (Chromium) with mock-data fallback

## Project Structure
```
Project3-Movie Finder Chatbot/
  backend/
    package.json
    server.js
  frontend/
    package.json
    vite.config.js
    index.html
    src/
      main.jsx  App.jsx  App.css  index.css
      components/  (ChatWindow, Message, MovieCard, ChatInput, TypingIndicator)
  README.md
```

## Quick Start

### 1. Install backend
```bash
cd backend
npm install
npx playwright install chromium
```

### 2. Install frontend
```bash
cd ../frontend
npm install
```

### 3. Start backend (Terminal 1)
```bash
cd backend
npm start
# Runs at http://localhost:5000
```

### 4. Start frontend (Terminal 2)
```bash
cd frontend
npm run dev
# Open http://localhost:5173
```

## Usage
1. Open http://localhost:5173
2. Type a city name (e.g. New York, Mumbai, London)
3. Press Enter — see movies displayed as cards in the chat

## How Scraping Works
- Backend launches a headless Chromium browser via Playwright
- Attempts to scrape "Now in Theaters" from Rotten Tomatoes
- If blocked/unavailable, automatically falls back to demo movie data
- No database — data flows directly: scraper -> API -> chat UI

## API
POST /api/movies
Body: { "city": "London" }
Response: { "source": "live"|"mock", "city": "London", "movies": [...] }
