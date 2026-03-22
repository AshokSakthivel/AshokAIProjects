# 🤖 Agentic Movie & Weather Planner

A full-stack AI-powered chatbot that uses **NVIDIA Llama 3.1** (function calling) to act as an autonomous agent — checking the weather and finding movies for any city you ask about.

> **Upgraded from:** Movie Finder Chatbot (Playwright scraper) → **Agentic Planner** (LLM-driven tool calling)

---

## ✨ What Makes This "Agentic"?

Instead of hardcoded logic, the backend runs an **agent loop**:

```
User message
    ↓
Send to Llama 3.1 (70B) with tool definitions
    ↓
LLM decides to call get_weather("Tokyo")  ← tool_call
    ↓  execute locally in Node.js
Send result back to LLM
    ↓
LLM decides to call get_movies("Tokyo")   ← tool_call
    ↓  execute locally in Node.js
Send result back to LLM
    ↓
LLM writes final human-friendly reply     ← finish_reason: stop
    ↓
Return reply + structured movie cards to UI
```

---

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18 + Vite                     |
| Backend    | Node.js + Express                   |
| LLM        | NVIDIA NIM — `meta/llama-3.1-70b-instruct` |
| API        | NVIDIA NIM REST API (OpenAI-compatible) |
| Tools      | `get_weather(city)`, `get_movies(city)` — mock JS functions |

---

## 📁 Project Structure

```
Project3-Movie Finder Chatbot/
├── README.md
├── HLD.md
├── backend/
│   ├── .env                  ← YOUR API KEY (never commit this)
│   ├── .env.example          ← Template
│   ├── package.json
│   └── server.js             ← Agent loop + tool execution
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx            ← Chat state + history management
        ├── App.css
        ├── index.css
        ├── main.jsx
        └── components/
            ├── ChatWindow.jsx / .css
            ├── Message.jsx / .css
            ├── MovieCard.jsx / .css
            ├── ChatInput.jsx / .css
            └── TypingIndicator.jsx / .css
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+ (tested on v24.14.0)
- An NVIDIA NIM API key → get one free at https://build.nvidia.com

### Step 1 — Clone the repo

```bash
git clone https://github.com/AshokSakthivel/AshokAIProjects.git
cd "AshokAIProjects/Project3-Movie Finder Chatbot"
```

### Step 2 — Add your API key

```bash
# Inside the backend/ folder, create a .env file:
cd backend
copy .env.example .env
```

Open `backend/.env` and set:
```
NVIDIA_API_KEY=nvapi-your-key-here
PORT=5001
```

### Step 3 — Install backend dependencies

```bash
cd backend
npm install
```

### Step 4 — Install frontend dependencies

```bash
cd ../frontend
npm install
```

### Step 5 — Start the backend (Terminal 1)

```bash
cd backend
npm run dev
# ✅ Agentic Planner backend running at http://localhost:5001
```

### Step 6 — Start the frontend (Terminal 2)

```bash
cd frontend
npm run dev
# ✅ VITE ready at http://localhost:5173
```

### Step 7 — Open the app

Navigate to **http://localhost:5173**

---

## 💬 Example Prompts

| Prompt | What the agent does |
|--------|---------------------|
| `Movies in Tokyo` | Calls `get_weather` + `get_movies`, replies with weather-aware suggestion |
| `What's playing in London tonight?` | Natural language — same tool chain |
| `Good movies for a rainy day in Sydney` | Agent connects rain condition to genre recommendations |
| `Tell me a joke` | No tools called — LLM answers directly |

---

## 🔌 API Reference

### `POST /api/chat`

**Request**
```json
{
  "message": "Movies in Tokyo",
  "history": []
}
```

**Response (200)**
```json
{
  "reply": "It's sunny in Tokyo! Great day for Laughter in Lahore or Dune: Part Three...",
  "movies": [ { "title": "...", "genre": "...", "showtimes": [...] } ],
  "toolsUsed": ["get_weather", "get_movies"]
}
```

### `GET /health`
```json
{ "status": "ok", "mode": "agentic", "model": "meta/llama-3.1-70b-instruct" }
```

---

## 🔐 Security Notes

- `NVIDIA_API_KEY` is loaded from `.env` — **never hardcode it in source**
- `.env` is excluded from git via `.gitignore`
- All user input is trimmed and capped at 500 characters before reaching the LLM
- Conversation history is validated (role + content must be strings) before being forwarded

---

## 🗺️ GitHub

**Repository:** https://github.com/AshokSakthivel/AshokAIProjects

```bash
# Push latest changes
git add .
git commit -m "feat: upgrade to agentic planner with NVIDIA function calling"
git push origin main
```

---

## 🔮 Future Enhancements

| Enhancement | Description |
|---|---|
| Real weather API | Replace mock with OpenWeatherMap |
| Real showtimes | Integrate Fandango / SeatGeek API |
| Streaming responses | Use SSE to stream LLM tokens to the UI |
| Rate limiting | Throttle `/api/chat` per IP |
| Docker Compose | Single-command startup |
| Deployment | Vercel (frontend) + Railway (backend) |
