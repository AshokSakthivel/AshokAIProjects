# High-Level Design (HLD) — Agentic Movie & Weather Planner

**Document Version:** 2.0
**Date:** March 23, 2026
**Author:** Ashok Sakthivel
**Repository:** https://github.com/AshokSakthivel/AshokAIProjects
**Status:** Approved

> **Revision history:**
> v1.0 — Movie Finder Chatbot (Playwright scraper, POST /api/movies)
> v2.0 — Agentic Planner (NVIDIA Llama 3.1 function calling, POST /api/chat)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture Diagrams](#3-architecture-diagrams)
   - 3.1 High-Level System Diagram
   - 3.2 Layered Architecture
   - 3.3 Agent Loop Flowchart
4. [Component Breakdown](#4-component-breakdown)
   - 4.1 Frontend (React + Vite)
   - 4.2 Backend Agent Loop (Node.js + Express)
   - 4.3 Tool Definitions & Dispatcher
   - 4.4 NVIDIA NIM Integration
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

**Agentic Movie & Weather Planner** is a full-stack AI chatbot that upgrades the original Movie Finder Chatbot from a hardcoded scraping pipeline to a **native LLM function-calling agent**.

The system uses NVIDIA NIM's `meta/llama-3.1-70b-instruct` model with the OpenAI-compatible tool-calling API. When a user asks about movies in a city, the model autonomously decides to call `get_weather(city)` and `get_movies(city)` as JavaScript functions, reads their results, and synthesizes a weather-aware movie recommendation in natural language.

**Key upgrade from v1.0:**

| Feature                  | v1.0 (Playwright)                   | v2.0 (Agentic Planner)                     |
|--------------------------|-------------------------------------|--------------------------------------------|
| Data source              | Rotten Tomatoes scraping            | Mock JS tools (expandable to real APIs)    |
| LLM role                 | None                                | Llama 3.1-70B decision maker               |
| API endpoint             | `POST /api/movies`                  | `POST /api/chat`                           |
| Response type            | Structured movies only              | Natural language reply + structured cards  |
| Multi-turn conversation  | No                                  | Yes (history array forwarded to LLM)       |
| Weather awareness        | No                                  | Yes (`get_weather` tool)                   |
| Extensibility            | Hard — requires new scraper logic   | Easy — add a new tool definition           |

---

## 2. System Overview

```
+------------------+          HTTP / REST           +------------------------+
|                  |  POST /api/chat                 |                        |
|  React Frontend  | ------------------------------> |   Node.js / Express    |
|  (Vite :5173)    | <------------------------------ |   Backend (:5001)      |
|                  |  { reply, movies, toolsUsed }   |                        |
+------------------+                                 +----------+-------------+
                                                                 |
                                                    NVIDIA NIM   |  HTTPS
                                                    REST API     |
                                                                 v
                                              +----------------------------------+
                                              |  NVIDIA NIM API                  |
                                              |  integrate.api.nvidia.com/v1     |
                                              |  model: llama-3.1-70b-instruct   |
                                              |  tool_choice: auto               |
                                              +----------------------------------+
                                                      |
                                         finish_reason: "tool_calls"
                                                      |
                                                      v
                                       +--------------+---------------+
                                       |  Local Tool Execution        |
                                       |  (Node.js, same process)     |
                                       |                              |
                                       |  get_weather(city)           |
                                       |  → { condition, recommendation } |
                                       |                              |
                                       |  get_movies(city)            |
                                       |  → { movies[] }              |
                                       +--------------+---------------+
                                                      |
                                         Tool results appended
                                         to messages[], loop back
                                                      |
                                         finish_reason: "stop"
                                                      |
                                                      v
                                       +------------------------------+
                                       |  Final LLM text reply        |
                                       |  + collected movies array    |
                                       |  returned to frontend        |
                                       +------------------------------+
```

---

## 3. Architecture Diagrams

### 3.1 Layered Architecture

```
+===========================================================================+
|                         PRESENTATION LAYER  (:5173)                       |
|                                                                           |
|  +-------------+  +-------------+  +-----------+  +--------------------+ |
|  | ChatInput   |  | ChatWindow  |  | MovieCard |  | TypingIndicator    | |
|  | Component   |  | Component   |  | Component |  | Component          | |
|  +------+------+  +------+------+  +-----------+  +--------------------+ |
|         |                |                                                 |
|         +----------------v---------+                                       |
|                      App.jsx                                               |
|             State: messages[], history[], loading                          |
+=======================================+===================================+
                                        |
                         POST /api/chat |  (Vite proxy → :5001)
                                        |
+=======================================v===================================+
|                         API GATEWAY LAYER  (:5001)                        |
|                                                                           |
|   Express Router                                                          |
|   POST /api/chat  → Input validation → sanitisedMessage                   |
|   GET  /health    → { status, mode, model }                               |
+=======================================+===================================+
                                        |
+=======================================v===================================+
|                         AGENT LOOP  (runAgentLoop)                        |
|                                                                           |
|   messages[] = [ system, ...history, user ]                               |
|                                                                           |
|   ┌─────────────────────────────────────────────────────────────────┐    |
|   │  ITERATION 1..N  (max 8 iterations safety limit)                │    |
|   │                                                                 │    |
|   │  callNvidiaAPI(messages, TOOL_DEFINITIONS)                      │    |
|   │         │                                                       │    |
|   │         ├── finish_reason: "tool_calls"                         │    |
|   │         │     └── executeToolCall() for each requested tool     │    |
|   │         │           ├── get_weather(city) → condition           │    |
|   │         │           └── get_movies(city)  → movies[]            │    |
|   │         │     └── append tool results to messages[]             │    |
|   │         │     └── LOOP BACK ↺                                   │    |
|   │         │                                                       │    |
|   │         └── finish_reason: "stop"                               │    |
|   │               └── return { reply, movies, toolsUsed }           │    |
|   └─────────────────────────────────────────────────────────────────┘    |
+=======================================+===================================+
                                        |
+=======================================v===================================+
|                         TOOL LAYER  (Local JS)                            |
|                                                                           |
|   get_weather(city)                   get_movies(city)                    |
|   → random Sunny/Rain                 → shuffle(MOCK_MOVIES).slice(0,5)  |
|   → weather recommendation            → structured movie objects          |
+===========================================================================+
                                        |
+=======================================v===================================+
|                         EXTERNAL LAYER                                    |
|                                                                           |
|   NVIDIA NIM REST API                                                     |
|   https://integrate.api.nvidia.com/v1/chat/completions                    |
|   Bearer: NVIDIA_API_KEY (from .env)                                      |
+===========================================================================+
```

### 3.2 Agent Loop Flowchart

```
                       ┌──────────────────────┐
                       │  User sends message   │
                       │  e.g. "Movies in NYC" │
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                       │  Build messages[]    │
                       │  [system, history,   │
                       │   user message]      │
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                  ┌───►│  callNvidiaAPI()      │
                  │    │  Llama 3.1-70B +      │
                  │    │  tool_definitions     │
                  │    └──────────┬────────────┘
                  │               │
                  │    ┌──────────▼────────────┐
                  │    │  Check finish_reason  │
                  │    └──────────┬────────────┘
                  │               │
          ┌───────┴──────┐        │        ┌─────────────────────┐
          │ "tool_calls" │        │        │       "stop"        │
          └───────┬──────┘        │        └──────────┬──────────┘
                  │               │                   │
          ┌───────▼──────┐        │        ┌──────────▼──────────┐
          │  Append       │        │        │  Return to frontend │
          │  assistantMsg │        │        │  {reply, movies,    │
          │  to messages[]│        │        │   toolsUsed}        │
          └───────┬──────┘                  └─────────────────────┘
                  │
          ┌───────▼──────────────────────────┐
          │  For each tool_call:              │
          │  executeToolCall()                │
          │  ├── get_weather → {condition}    │
          │  └── get_movies  → {movies[]}     │
          └───────┬──────────────────────────┘
                  │
          ┌───────▼──────┐
          │  Append tool  │
          │  result msgs  │
          │  to messages[]│
          └───────┬──────┘
                  │
                  └─────────────► callNvidiaAPI() again ↺
```

---

## 4. Component Breakdown

### 4.1 Frontend (React + Vite)

#### Component Tree

```
App.jsx  (state: messages[], history[], loading)
├── <aside> Sidebar
│     ├── Logo + Title ("Agentic Planner")
│     ├── Example prompt list
│     └── Backend status indicator (port 5001)
│
└── <main> Chat Area
      ├── ChatHeader
      ├── ChatWindow.jsx
      │     ├── Message.jsx (user text bubble)
      │     ├── Message.jsx (bot text bubble — LLM reply)
      │     ├── Message.jsx (type="movies")
      │     │     └── MovieCard.jsx ×N
      │     └── TypingIndicator.jsx
      └── ChatInput.jsx
```

#### State Shape

```javascript
// App.jsx state
messages : Array<Message>         // full rendered chat history
history  : Array<{role, content}> // last 10 turns forwarded to LLM
loading  : boolean                // true while agent loop running

// Message shape
{
  id    : string,
  role  : 'user' | 'bot',
  type  : 'text' | 'movies',
  text? : string,       // for type='text'
  movies?: object[]     // for type='movies'
}
```

#### API Call (App.jsx → Backend)

```javascript
POST /api/chat
Body: { message: string, history: [{role, content}] }
Response: { reply: string, movies: object[]|null, toolsUsed: string[] }
```

The frontend:
1. Shows the `reply` as a bot text bubble
2. If `movies` is present, shows MovieCard grid below
3. Appends the turn to `history` for multi-turn context

---

### 4.2 Backend Agent Loop

#### Middleware Stack

```
Request
  │
  ▼
CORS Middleware          ← Whitelist: localhost:5173 and 5174
  │
  ▼
express.json()           ← Parse JSON body
  │
  ▼
POST /api/chat handler
  │
  ▼
Input Validation         ← message trim, 500-char cap
                           history: filter role/content strings, last 10
  │
  ▼
runAgentLoop()           ← agent loop (up to 8 iterations)
  │
  ├─ callNvidiaAPI()     ← HTTPS POST to NVIDIA NIM
  ├─ executeToolCall()   ← local JS function dispatch
  └─ return result
  │
  ▼
JSON Response: { reply, movies, toolsUsed }
```

#### Routes

| Method | Path        | Description                                              |
|--------|-------------|----------------------------------------------------------|
| POST   | /api/chat   | Main agent endpoint — accepts message + history          |
| GET    | /health     | Returns `{ status, mode, model }`                        |

---

### 4.3 Tool Definitions & Dispatcher

#### Tool Schema (sent to LLM each request)

```javascript
TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Returns current weather condition for a city.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name' }
        },
        required: ['city']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_movies',
      description: 'Returns movies currently playing in theaters in a city.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name' }
        },
        required: ['city']
      }
    }
  }
]
```

#### Tool Implementations

| Tool            | Input    | Output                                          | Data Source     |
|-----------------|----------|-------------------------------------------------|-----------------|
| `get_weather`   | `city`   | `{ city, condition: 'Sunny'|'Rain', recommendation }` | Random (mock)   |
| `get_movies`    | `city`   | `{ city, movies[] }` (5 movies)                 | In-memory dataset |

#### Dispatcher Logic (executeToolCall)

```javascript
executeToolCall(toolCall):
  1. JSON.parse(toolCall.function.arguments)  → catch malformed JSON
  2. Sanitise city: trim, slice(0, 100)        → prevent oversized inputs
  3. switch(toolCall.function.name):
       'get_weather' → get_weather(city)
       'get_movies'  → get_movies(city)
       default       → { error: 'Unknown tool' }
```

---

### 4.4 NVIDIA NIM Integration

#### API Call Shape

```http
POST https://integrate.api.nvidia.com/v1/chat/completions
Authorization: Bearer nvapi-...
Content-Type: application/json

{
  "model": "meta/llama-3.1-70b-instruct",
  "messages": [ ... ],
  "tools": [ ... ],
  "tool_choice": "auto",
  "max_tokens": 1024,
  "temperature": 0.7
}
```

#### Response Handling

| `finish_reason` | Meaning                        | Action                              |
|-----------------|--------------------------------|-------------------------------------|
| `"tool_calls"`  | LLM wants to invoke tools      | Execute tools, loop back            |
| `"stop"`        | LLM produced final text reply  | Return to frontend                  |
| other           | Unexpected                     | Throw error                         |

#### Known Quirk — Null Content Guard

Llama's prompt template crashes with HTTP 500 if `content: null` appears in an
assistant message. This is patched in the agent loop:

```javascript
if (assistantMsg.content === null || assistantMsg.content === undefined) {
  assistantMsg.content = '';
}
```

---

## 5. Data Flow

### Full Agent Turn (Happy Path)

```
User: "Movies in Tokyo"
    │
    ▼
App.jsx — POST /api/chat { message: "Movies in Tokyo", history: [] }
    │  (Vite proxy → localhost:5001)
    ▼
Express validates input → runAgentLoop("Movies in Tokyo", [])
    │
    ▼  Iteration 1
callNvidiaAPI([system, user])
→ finish_reason: "tool_calls"
→ tool: get_weather("Tokyo")
→ executeToolCall → { city:"Tokyo", condition:"Sunny", recommendation:"..." }
→ append to messages[]
    │
    ▼  Iteration 2
callNvidiaAPI([system, user, assistant, tool-weather])
→ finish_reason: "tool_calls"
→ tool: get_movies("Tokyo")
→ executeToolCall → { city:"Tokyo", movies:[...5 films] }
→ collectedMovies = movies
→ append to messages[]
    │
    ▼  Iteration 3
callNvidiaAPI([system, user, assistant, tool-weather, assistant, tool-movies])
→ finish_reason: "stop"
→ reply: "It's sunny in Tokyo! I recommend Laughter in Lahore..."
    │
    ▼
Return: { reply, movies: collectedMovies, toolsUsed: ["get_weather","get_movies"] }
    │
    ▼
App.jsx:
  addMsg({ role:'bot', type:'text',   text: reply  })
  addMsg({ role:'bot', type:'movies', movies })
  history.push({ role:'user', content: message })
  history.push({ role:'assistant', content: reply })
```

### Off-Topic Turn (No Tools Called)

```
User: "Tell me a joke"
    │
    ▼
callNvidiaAPI → finish_reason: "stop"  (LLM answers without tools)
    │
    ▼
Return: { reply: "Why don't scientists trust atoms?...", movies: null, toolsUsed: [] }
```

---

## 6. API Design

### POST /api/chat

**Request**
```json
{
  "message": "Movies in London",
  "history": [
    { "role": "user",      "content": "Hi" },
    { "role": "assistant", "content": "Hello! Ask me about movies in any city." }
  ]
}
```

**Validation Rules**

| Field     | Rule                                                       |
|-----------|------------------------------------------------------------|
| `message` | Required, non-empty string, max 500 characters             |
| `history` | Optional array; each item must have `role` and `content` as strings; at most last 10 items used |

**Success Response (200)**
```json
{
  "reply": "It's raining in London! Perfect time for a thriller — Echoes of Tomorrow or The Batman: Shadow of Gotham.",
  "movies": [
    {
      "title": "Echoes of Tomorrow",
      "genre": "Thriller / Mystery",
      "rating": "R",
      "score": "7.6/10 ⭐",
      "description": "A detective discovers she can receive messages from her future self.",
      "showtimes": ["12:00 PM", "3:15 PM", "6:45 PM", "10:00 PM"],
      "icon": "🔍"
    }
  ],
  "toolsUsed": ["get_weather", "get_movies"]
}
```

**Error Responses**

| Status | Scenario                              | Body                                                    |
|--------|---------------------------------------|---------------------------------------------------------|
| 400    | Missing or empty `message`            | `{ "error": "Please provide a non-empty message." }`    |
| 500    | Missing `NVIDIA_API_KEY` in .env      | `{ "error": "NVIDIA_API_KEY is not set..." }`           |
| 500    | NVIDIA API call failed                | `{ "error": "NVIDIA API responded with 5xx: ..." }`     |
| 500    | Agent loop exceeded 8 iterations      | `{ "error": "Agent loop hit the 8-iteration safety limit..." }` |

### GET /health

```json
{ "status": "ok", "mode": "agentic", "model": "meta/llama-3.1-70b-instruct" }
```

---

## 7. Technology Stack

### Frontend

| Technology           | Version  | Purpose                                    |
|----------------------|----------|--------------------------------------------|
| React                | 18.2.0   | UI component framework                     |
| Vite                 | 6.4.1    | Build tool, dev server, API proxy (:5001)  |
| @vitejs/plugin-react | 4.5.2    | Babel JSX + Fast Refresh                   |
| CSS (plain)          | —        | Component-scoped styling                   |

### Backend

| Technology  | Version  | Purpose                                         |
|-------------|----------|-------------------------------------------------|
| Node.js     | 24.14.0  | JavaScript runtime                              |
| Express     | 4.18.2   | HTTP server, routing, middleware                |
| dotenv      | 16.4.5   | Load NVIDIA_API_KEY from .env                   |
| cors        | 2.8.5    | CORS origin whitelist                           |
| nodemon     | 3.1.0    | Dev-mode auto-restart (devDependency)           |
| fetch (built-in) | Node 18+ | HTTPS calls to NVIDIA NIM API            |

### AI / External

| Service         | Details                                              |
|-----------------|------------------------------------------------------|
| NVIDIA NIM API  | `https://integrate.api.nvidia.com/v1`                |
| Model           | `meta/llama-3.1-70b-instruct`                        |
| Protocol        | OpenAI-compatible REST w/ function calling           |
| Auth            | Bearer token (`NVIDIA_API_KEY`)                      |

### Infrastructure

| Tool    | Purpose                                 |
|---------|-----------------------------------------|
| Git     | Version control                         |
| GitHub  | Remote repo — AshokSakthivel/AshokAIProjects |
| npm     | Package management                      |

---

## 8. Security Design

### Threat Model & Mitigations

| Threat                      | OWASP Category              | Mitigation                                              |
|-----------------------------|-----------------------------|---------------------------------------------------------|
| API key exposure             | A02 Cryptographic Failure   | Stored in `.env`, excluded from git via `.gitignore`    |
| Prompt injection via user msg| A03 Injection               | User input capped at 500 chars; system prompt is fixed  |
| XSS via LLM reply            | A03 Injection               | React auto-escapes all text; no `dangerouslySetInnerHTML` |
| CORS abuse                   | A01 Broken Access Control   | Origin whitelist: only `localhost:5173/5174`            |
| Unbounded LLM loops          | —                           | Hard cap: 8 iterations max in agent loop                |
| Malformed tool arguments     | A03 Injection               | `JSON.parse` in try/catch; city sanitised + capped at 100 chars |
| History poisoning            | A03 Injection               | History items validated (role + content must be strings); at most 10 items accepted |
| Dependency vulnerabilities   | A06 Vulnerable Components   | `npm audit` clean; Playwright removed, reducing attack surface |

### API Key Best Practice

```
✅  backend/.env          ← NVIDIA_API_KEY stored here
✅  backend/.gitignore    ← .env excluded
✅  backend/.env.example  ← committed as safe template
❌  NEVER hardcode key in server.js or commit .env
```

---

## 9. Error Handling & Resilience

### Frontend Error States

| Scenario                        | User-Visible Message                                          |
|---------------------------------|---------------------------------------------------------------|
| Backend not running             | "⚠️ Oops! connect ECONNREFUSED. Make sure the backend is running on port 5000." |
| Missing API key (500)           | "⚠️ Oops! NVIDIA_API_KEY is not set."                         |
| NVIDIA API error (500)          | "⚠️ Oops! NVIDIA API responded with 5xx."                     |
| LLM loop limit hit              | "⚠️ Oops! Agent loop hit the 8-iteration safety limit."       |

### Backend Resilience

```
runAgentLoop()
├── MAX_ITERATIONS = 8  (prevents infinite loop / runaway billing)
├── callNvidiaAPI()
│     └── response.ok check → throws on non-2xx with full error body
├── executeToolCall()
│     ├── JSON.parse in try/catch → returns { error } on failure
│     └── city sanitisation before tool execution
└── content: null guard on assistantMsg before appending
```

### Loading State

The `loading` flag in `App.jsx` disables ChatInput during an active agent loop, preventing duplicate requests.

---

## 10. Folder Structure

```
AshokAIProjects/                              ← Git repo root
├── .gitignore                                ← Ignores node_modules, dist, .env
│
└── Project3-Movie Finder Chatbot/
    │
    ├── README.md                             ← Quick-start guide (v2.0)
    ├── HLD.md                                ← This document (v2.0)
    │
    ├── backend/
    │   ├── .env                              ← NVIDIA_API_KEY (never committed)
    │   ├── .env.example                      ← Safe template (committed)
    │   ├── package.json                      ← express, dotenv, cors, nodemon
    │   ├── package-lock.json
    │   └── server.js                         ← Agent loop + tool definitions + Express
    │
    └── frontend/
        ├── package.json                      ← react, vite, @vitejs/plugin-react
        ├── package-lock.json
        ├── vite.config.js                    ← Proxy /api → localhost:5001
        ├── index.html                        ← HTML shell
        └── src/
            ├── main.jsx                      ← ReactDOM.createRoot entry point
            ├── App.jsx                       ← State (messages, history, loading) + fetch
            ├── App.css                       ← Layout: sidebar + chat area
            ├── index.css                     ← CSS variables, resets
            └── components/
                ├── ChatWindow.jsx / .css     ← Scrollable message list
                ├── Message.jsx / .css        ← Text bubble + movie grid renderer
                ├── MovieCard.jsx / .css      ← Individual movie info card
                ├── ChatInput.jsx / .css      ← Text input + submit button
                └── TypingIndicator.jsx / .css ← Animated loading dots
```

---

## 11. Non-Functional Requirements

### Performance

| Metric                         | Target / Actual                                         |
|--------------------------------|---------------------------------------------------------|
| Agent loop response time       | ~5–15 seconds (2–3 LLM round-trips @ 70B model)        |
| Mock tool execution time       | < 1ms per tool call                                     |
| Frontend build size            | ~149 KB JS (gzipped: ~48 KB)                           |
| Vite cold start                | < 500ms                                                 |
| Max LLM iterations per request | 8 (hard cap)                                           |

### Scalability

- Stateless design — each `/api/chat` request is independent
- No in-memory session — history is passed by the client
- Can be horizontally scaled behind a load balancer with no changes

### Availability

- If NVIDIA NIM is unavailable, the backend returns a 500 with a clear message
- Frontend always shows an error bubble — never hangs silently

---

## 12. Future Enhancements

| Enhancement                  | Description                                               | Priority |
|------------------------------|-----------------------------------------------------------|----------|
| Real weather tool            | Replace mock with OpenWeatherMap API call                 | High     |
| Real showtimes tool          | Integrate Fandango / SeatGeek / Google Movies API         | High     |
| Streaming LLM responses      | Use SSE to stream tokens to UI as they arrive             | Medium   |
| Rate limiting                | Throttle `/api/chat` to N requests/min per IP             | Medium   |
| Persistent chat history      | Store history in LocalStorage or IndexedDB                | Medium   |
| More tools                   | `get_trailers`, `get_reviews`, `book_tickets`             | Medium   |
| Docker Compose               | Single-command startup for both services                  | Low      |
| CI/CD Pipeline               | GitHub Actions: lint → build → test → deploy on push      | Low      |
| Deployment                   | Vercel (frontend) + Railway/Render (backend)              | Low      |

---

*End of HLD — Agentic Movie & Weather Planner v2.0*
