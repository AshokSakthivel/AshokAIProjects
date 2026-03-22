# High-Level Design (HLD) — Movie Finder Chatbot

**Document Version:** 1.0  
**Date:** March 22, 2026  
**Author:** Ashok Sakthivel  
**Repository:** https://github.com/AshokSakthivel/AshokAIProjects  
**Status:** Approved

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Component Breakdown](#4-component-breakdown)
   - 4.1 Frontend (React + Vite)
   - 4.2 Backend (Node.js + Express)
   - 4.3 Scraping Engine (Playwright)
   - 4.4 Mock Data Fallback
5. [Data Flow](#5-data-flow)
6. [API Design](#6-api-design)
7. [Technology Stack](#7-technology-stack)
8. [Security Design](#8-security-design)
9. [Error Handling & Resilience](#9-error-handling--resilience)
10. [Folder Structure](#10-folder-structure)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Future Enhancements](#12-future-enhancements)

---

## 1. Executive Summary

**Movie Finder Chatbot** is a full-stack web application that provides a conversational interface for users to discover movies currently showing in theaters in any city. The user types a city name into a chat input; the system scrapes live movie data from Rotten Tomatoes using a headless browser (Playwright), and presents the results as visual movie cards within the chat window.

The application is designed to be stateless — no database, no login, no persistent session. All data flows in real time from the scraping engine through the REST API directly to the chat UI.

---

## 2. System Overview

```
+------------------+        HTTP (REST)        +----------------------+
|                  |  POST /api/movies          |                      |
|   React Frontend | -------------------------> |  Node.js / Express   |
|   (Vite)         | <------------------------- |  Backend Server      |
|   :5173          |   JSON response            |  :5000               |
|                  |                            |                      |
+------------------+                            +----------+-----------+
                                                           |
                                                           | Playwright
                                                           | (Headless Chromium)
                                                           v
                                              +------------------------+
                                              |  Rotten Tomatoes       |
                                              |  rottentomatoes.com    |
                                              |  /browse/movies_in_    |
                                              |   theaters/            |
                                              +------------------------+
                                                           |
                                              (on failure) | fallback
                                                           v
                                              +------------------------+
                                              |  Mock Movie Dataset    |
                                              |  (in-memory, 8 movies) |
                                              +------------------------+
```

### Key Design Principles

| Principle         | Implementation                                              |
|-------------------|-------------------------------------------------------------|
| Stateless          | No DB, no sessions — each request is fully independent      |
| Resilient          | Scraping failure triggers automatic mock-data fallback      |
| Separation of Concerns | Frontend and Backend are independently deployable      |
| Security-First     | Input sanitization, CORS whitelist, no sensitive data stored|
| Progressive Enhancement | Works fully on demo data when live scraping is blocked|

---

## 3. Architecture Diagram

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  ┌──────────┐ │
│  │  ChatInput  │  │ ChatWindow  │  │MovieCard  │  │ Typing   │ │
│  │  Component  │  │  Component  │  │ Component │  │Indicator │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┘  └──────────┘ │
│         │                │                                        │
│         └────────────────▼────────────────────────────────────── │
│                       App.jsx (State Manager)                     │
└─────────────────────────────┬───────────────────────────────────┘
                               │  fetch('/api/movies')
                               │  Vite proxy → :5000
┌─────────────────────────────▼───────────────────────────────────┐
│                        API / BUSINESS LOGIC LAYER                │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Express Router                           │  │
│  │  POST /api/movies   ─────────────────► Input Validation   │  │
│  │  GET  /health       ─────────────────► Health Check       │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                                │                                   │
│  ┌─────────────────────────────▼──────────────────────────────┐  │
│  │                  scrapeMovies(city)                        │  │
│  │                                                            │  │
│  │   ┌──────────────────┐        ┌──────────────────────┐   │  │
│  │   │ Playwright Engine │        │  Mock Data Fallback   │   │  │
│  │   │ (Headless Chrome) │──fail─►│  (8 curated movies)  │   │  │
│  │   └──────────────────┘        └──────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Breakdown

### 4.1 Frontend (React + Vite)

The frontend is a single-page application (SPA) built with React 18. It uses Vite as the build tool and development server.

#### Component Tree

```
App.jsx
├── <aside> Sidebar
│     ├── Logo + Title
│     ├── City suggestion list
│     └── Backend status indicator
│
└── <main> Chat Area
      ├── ChatHeader
      ├── ChatWindow.jsx
      │     ├── Message.jsx (text bubble — user)
      │     ├── Message.jsx (text bubble — bot)
      │     ├── Message.jsx (type="movies")
      │     │     └── MovieCard.jsx  ×N
      │     └── TypingIndicator.jsx
      └── ChatInput.jsx
```

#### Component Responsibilities

| Component         | Responsibility                                              |
|-------------------|-------------------------------------------------------------|
| `App.jsx`         | Global state (messages[], loading), fetch orchestration     |
| `ChatWindow.jsx`  | Renders the scrollable message list                         |
| `Message.jsx`     | Renders user/bot text bubbles with inline Markdown support  |
| `MovieCard.jsx`   | Displays a single movie: icon, title, genre, score, times   |
| `ChatInput.jsx`   | Controlled input, Enter-to-submit, disabled state           |
| `TypingIndicator` | Three-dot animated bubble shown during API call             |

#### State Management

All state is managed locally in `App.jsx` using React hooks — no Redux or external state library is needed for this scope.

```
App state:
  messages : Array<Message>   // full chat history
  loading  : boolean          // true while awaiting API response

Message shape:
  { id, role: 'user'|'bot', type: 'text'|'movies', text?, movies? }
```

#### Routing & Proxy

Vite's built-in dev proxy forwards all `/api/*` requests to `http://localhost:5000`, eliminating CORS issues during development.

```javascript
// vite.config.js
proxy: {
  '/api': { target: 'http://localhost:5000', changeOrigin: true }
}
```

---

### 4.2 Backend (Node.js + Express)

The backend is a lightweight REST API server.

#### Middleware Stack

```
Request
  │
  ▼
CORS Middleware          ← Whitelists localhost:5173 only
  │
  ▼
express.json()           ← Parses JSON request body
  │
  ▼
Route Handler            ← POST /api/movies
  │
  ▼
Input Validation         ← Type check, empty check, length limit, XSS strip
  │
  ▼
scrapeMovies(city)       ← Playwright or Mock fallback
  │
  ▼
JSON Response            ← { source, city, movies[] }
```

#### Routes

| Method | Path          | Description                               |
|--------|---------------|-------------------------------------------|
| POST   | /api/movies   | Main endpoint — accepts city, returns movies |
| GET    | /health       | Health check — returns `{ status: "ok" }` |

---

### 4.3 Scraping Engine (Playwright)

Playwright controls a headless Chromium browser to scrape the Rotten Tomatoes "Now in Theaters" page.

#### Scraping Flow

```
chromium.launch({ headless: true })
          │
          ▼
newContext({ userAgent: '...Chrome/122...', viewport: 1280×720 })
          │
          ▼
page.goto('https://www.rottentomatoes.com/browse/movies_in_theaters/')
   waitUntil: 'domcontentloaded', timeout: 20s
          │
          ▼
page.waitForSelector('[data-qa="discovery-media-list-item"]')
          │
          ▼
page.evaluate()  ← DOM traversal inside the browser context
   - Extracts: title, tomatometer score
   - Maps to movie object shape
   - Returns top 8 results
          │
          ▼
browser.close()   ← Always called in finally block
```

#### Target DOM Selectors

| Data Point | CSS Selector                                      |
|------------|---------------------------------------------------|
| Movie tile | `[data-qa="discovery-media-list-item"]`           |
| Title      | `[data-qa="discovery-media-list-item-title"]`     |
| Score      | `[data-qa="tomatometer"]`                         |

#### Resilience Strategy

The entire scrape is wrapped in `try/catch`. Any failure (network timeout, selector change, bot detection, CAPTCHA) is caught and transparently reroutes to the mock data fallback. The browser is always closed in the `finally` block to prevent resource leaks.

---

### 4.4 Mock Data Fallback

A curated in-memory dataset of 8 movies is used whenever live scraping fails. Movies are shuffled randomly per request to simulate variety, and 6 are returned per response.

| Title                        | Genre              | MPAA | Score  |
|------------------------------|--------------------|------|--------|
| Dune: Part Three             | Sci-Fi / Adventure | PG-13| 8.4/10 |
| The Batman: Shadow of Gotham | Action / Crime      | PG-13| 8.1/10 |
| Interstellar: Beyond         | Sci-Fi / Drama      | PG   | 8.7/10 |
| Avengers: New Legacy         | Action / Superhero  | PG-13| 7.9/10 |
| The Grand Budapest Heist     | Comedy / Crime      | PG-13| 8.0/10 |
| Echoes of Tomorrow           | Thriller / Mystery  | R    | 7.6/10 |
| Wildfire                     | Action / Disaster   | PG-13| 7.3/10 |
| Laughter in Lahore           | Comedy / Romance    | PG   | 7.8/10 |

The UI displays a clearly labelled badge: `🌐 Live data` vs `🎭 Demo data`.

---

## 5. Data Flow

### Happy Path (Live Scraping)

```
User types "New York" → presses Enter
    │
    ▼
ChatInput.jsx calls onSend("New York")
    │
    ▼
App.jsx adds user message to messages[]
App.jsx sets loading = true
    │
    ▼
fetch POST /api/movies  { city: "New York" }
    │  (via Vite proxy → localhost:5000)
    ▼
Express validates input → calls scrapeMovies("New York")
    │
    ▼
Playwright launches Chromium (headless)
→ navigates to rottentomatoes.com/browse/movies_in_theaters/
→ extracts 8 movie tiles from DOM
→ closes browser
    │
    ▼
Returns JSON: { source: "live", city: "New York", movies: [...8 items] }
    │
    ▼
App.jsx sets loading = false
App.jsx appends bot text message + bot movies message to messages[]
    │
    ▼
ChatWindow renders MovieCard × 8
```

### Fallback Path (Scraping Blocked)

```
Playwright throws (timeout / bot-block / selector missing)
    │
    ▼
catch block calls buildMockResponse()
→ shuffles MOCK_MOVIES, returns 6
    │
    ▼
Returns JSON: { source: "mock", city: "New York", movies: [...6 items] }
    │
    ▼
UI shows: "🎭 Demo data — live scraping unavailable for this region"
```

---

## 6. API Design

### POST /api/movies

**Request**
```
POST http://localhost:5000/api/movies
Content-Type: application/json

{
  "city": "London"
}
```

**Validation Rules**
- `city` must be a non-empty string
- Maximum 100 characters
- Characters `< > " ' &` are stripped (XSS prevention)

**Success Response (200)**
```json
{
  "source": "live",
  "city": "London",
  "movies": [
    {
      "title": "Dune: Part Three",
      "genre": "Sci-Fi / Adventure",
      "rating": "PG-13",
      "score": "94% 🍅",
      "description": "Now playing in theaters near you.",
      "showtimes": ["Check local theater for showtimes"],
      "icon": "🎬"
    }
  ]
}
```

**`source` Field Values**

| Value  | Meaning                                      |
|--------|----------------------------------------------|
| `live` | Data scraped in real time from Rotten Tomatoes|
| `mock` | Demo data from in-memory fallback dataset     |

**Error Responses**

| Status | Scenario                         | Body                                          |
|--------|----------------------------------|-----------------------------------------------|
| 400    | Missing or empty city            | `{ "error": "Please provide a valid city name." }` |
| 400    | City exceeds 100 characters      | `{ "error": "City name is too long." }`       |
| 500    | Unexpected server error          | `{ "error": "Internal server error..." }`     |

### GET /health

```
GET http://localhost:5000/health
→ 200 OK  { "status": "ok" }
```

---

## 7. Technology Stack

### Frontend

| Technology          | Version  | Purpose                                    |
|---------------------|----------|--------------------------------------------|
| React               | 18.2.0   | UI component framework                     |
| Vite                | 6.4.1    | Build tool, dev server, API proxy          |
| @vitejs/plugin-react| 4.5.2    | Babel-based JSX/Fast Refresh support       |
| CSS Modules (plain) | —        | Component-scoped styling (no CSS-in-JS)    |
| Inter (Google Fonts)| —        | Primary typeface                           |

### Backend

| Technology    | Version  | Purpose                                         |
|---------------|----------|-------------------------------------------------|
| Node.js       | 24.14.0  | JavaScript runtime                              |
| Express       | 4.18.2   | HTTP server and routing                         |
| Playwright    | 1.42.1   | Headless browser automation for scraping        |
| Chromium      | bundled  | Browser engine used by Playwright               |
| cors          | 2.8.5    | CORS header management                          |
| nodemon       | 3.1.0    | Dev-mode auto-restart (devDependency)           |

### Infrastructure / Tooling

| Tool       | Purpose                                 |
|------------|-----------------------------------------|
| Git        | Version control                         |
| GitHub CLI | Repo creation and push automation       |
| GitHub     | Remote code hosting (AshokSakthivel)    |
| npm        | Package management (both frontend/backend)|
| winget     | Node.js installation on Windows         |

---

## 8. Security Design

### Threat Model & Mitigations

| Threat                     | OWASP Category              | Mitigation                                              |
|----------------------------|-----------------------------|---------------------------------------------------------|
| XSS via city input         | A03 Injection               | Strip `< > " ' &` before use; never rendered as HTML    |
| SSRF via city input        | A10 SSRF                    | City is only used as a display label; URL is hardcoded  |
| Unbounded input length     | A03 Injection               | Server rejects city > 100 chars; client `maxLength=100` |
| CORS abuse                 | A01 Broken Access Control   | CORS origin whitelist: only `localhost:5173` allowed    |
| Dependency vulnerabilities | A06 Vulnerable Components   | `npm audit` clean; Vite upgraded to 6.4.1 to patch CVEs |
| Rogue DOM content injection| A03 Injection               | Scraped text rendered via React (auto-escaped), not innerHTML |
| Bot detection evasion      | —                           | Realistic User-Agent and viewport set; graceful fallback |

### Input Sanitization Flow

```
Raw input: "  <script>alert(1)</script>  "
                │
                ▼ city.trim()
"<script>alert(1)</script>"
                │
                ▼ .replace(/[<>"'&]/g, '')
"scriptalert(1)/script"
                │
                ▼ length check (≤ 100)
Passes — used only as display label, not in any URL or query
```

---

## 9. Error Handling & Resilience

### Frontend Error States

| Scenario                     | User-Visible Message                                     |
|------------------------------|----------------------------------------------------------|
| Backend not running          | "⚠️ Oops! Failed to fetch. Make sure the backend is running on port 5000." |
| Server 400 (bad input)       | "⚠️ Oops! [server error message]"                         |
| Server 500 (crash)           | "⚠️ Oops! Internal server error. Please try again."       |
| No movies returned           | "😕 No movies found for [city]. Try another city!"        |

### Backend Error Handling

```
scrapeMovies(city)
├── try
│     ├── Playwright launch & navigate
│     ├── DOM extraction
│     └── Return { source: 'live', ... }
├── catch (any error)
│     └── Return { source: 'mock', ... }  ← never crashes the API
└── finally
      └── browser.close()               ← no resource leaks
```

### Loading State

The `loading` flag in `App.jsx` disables the input and send button during a pending API call, preventing duplicate requests.

---

## 10. Folder Structure

```
AshokAIProjects/                          ← Git repo root
├── .gitignore                            ← Ignores node_modules, dist, .env
│
└── Project3-Movie Finder Chatbot/
    │
    ├── README.md                         ← Quick-start guide
    ├── HLD.md                            ← This document
    │
    ├── backend/
    │   ├── package.json                  ← express, playwright, cors, nodemon
    │   ├── package-lock.json
    │   └── server.js                     ← Express app + Playwright scraper
    │
    └── frontend/
        ├── package.json                  ← react, vite, @vitejs/plugin-react
        ├── package-lock.json
        ├── vite.config.js                ← Dev server config + API proxy
        ├── index.html                    ← HTML shell, Google Fonts
        └── src/
            ├── main.jsx                  ← ReactDOM.createRoot entry point
            ├── App.jsx                   ← Root component + state + fetch logic
            ├── App.css                   ← Layout: sidebar + chat area
            ├── index.css                 ← CSS variables, global resets, scrollbar
            └── components/
                ├── ChatWindow.jsx / .css ← Scrollable message list container
                ├── Message.jsx / .css    ← Text bubble + movie grid renderer
                ├── MovieCard.jsx / .css  ← Individual movie info card
                ├── ChatInput.jsx / .css  ← Text input + submit button
                └── TypingIndicator.jsx / .css  ← Animated loading dots
```

---

## 11. Non-Functional Requirements

### Performance

| Metric                        | Target / Actual                                   |
|-------------------------------|---------------------------------------------------|
| Frontend production build size| 149 KB JS + 6.4 KB CSS (gzipped: 48 KB + 1.9 KB) |
| Vite cold start               | < 500ms                                           |
| Live scrape response time     | ~5–10 seconds (Playwright cold start + DOM fetch) |
| Mock data response time       | < 100ms                                           |
| Concurrent requests           | Stateless — each request creates a new browser context |

### Availability

- No single point of failure for demo use — mock fallback ensures the UI is always functional.
- Backend can be restarted independently without affecting the frontend build.

### Maintainability

- Components are small, single-responsibility, and individually styled.
- The mock dataset is a plain JS array — trivially editable.
- DOM selectors are isolated in a single `page.evaluate()` call — easy to update if Rotten Tomatoes changes their markup.

### Browser Compatibility

| Browser         | Support |
|-----------------|---------|
| Chrome / Edge   | ✅ Full  |
| Firefox         | ✅ Full  |
| Safari          | ✅ Full  |
| Mobile (> 640px)| ✅ Full  |
| Mobile (< 640px)| ✅ Sidebar hidden, chat full-width |

---

## 12. Future Enhancements

| Enhancement                    | Description                                              | Priority |
|--------------------------------|----------------------------------------------------------|----------|
| Showtimes by City              | Integrate a real showtimes API (e.g. Fandango, SeatGeek) | High     |
| Caching Layer                  | Redis/in-memory cache to avoid re-scraping within 10 min | Medium   |
| Rate Limiting                  | Throttle `/api/movies` to N requests/minute per IP        | Medium   |
| Multiple Scrape Sources        | Fall through IMDB → Google Movies → mock                  | Medium   |
| Movie Detail Page              | Click a card to see trailers, cast, reviews              | Low      |
| Chat History Persistence       | LocalStorage or IndexedDB to save sessions               | Low      |
| Docker Compose                 | Single-command startup for frontend + backend            | Low      |
| CI/CD Pipeline                 | GitHub Actions: lint → build → deploy on push            | Low      |
| Deployment                     | Vercel (frontend) + Railway/Render (backend)             | Low      |

---

*End of HLD — Movie Finder Chatbot v1.0*
