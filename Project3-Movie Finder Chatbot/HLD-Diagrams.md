# HLD Diagrams — Movie Finder Chatbot

> **View interactively:** Open `HLD-Diagrams.html` in any browser for the full dark-themed rendered version.  
> GitHub renders the Mermaid blocks below natively.

---

## Diagram 1 — System Architecture Overview

```mermaid
graph TB
    subgraph CLIENT["🖥️  CLIENT — Browser (localhost:5173)"]
        direction TB
        subgraph COMPONENTS["UI Components"]
            CI["ChatInput"]
            CW["ChatWindow"]
            MSG["Message"]
            MC["MovieCard"]
            TI["TypingIndicator"]
        end
        APP["App.jsx — State · Fetch · Logic"]
        CI --> APP
        APP --> CW
        CW --> MSG
        MSG --> MC
        CW --> TI
    end

    subgraph SERVER["⚙️  SERVER — Node.js / Express (localhost:5000)"]
        direction TB
        CORS["CORS Middleware — whitelist :5173"]
        RT["POST /api/movies"]
        HEALTH["GET /health"]
        VALID["Input Validation — sanitise · length · type"]
        CORS --> RT
        CORS --> HEALTH
        RT --> VALID
        subgraph SCRAPER["🎭  Scraping Engine"]
            PW["Playwright — Headless Chromium"]
            MOCK["Mock Dataset — 8 movies in-memory"]
            PW -- "on failure" --> MOCK
        end
        VALID --> SCRAPER
    end

    subgraph EXTERNAL["🌐  EXTERNAL"]
        RT_WEB["Rotten Tomatoes\nrottentomatoes.com"]
    end

    APP -- "POST /api/movies {city}" --> SERVER
    SERVER -- "JSON {source, city, movies[]}" --> APP
    PW -- "Headless Chrome request" --> RT_WEB
```

---

## Diagram 2 — Request / Response Sequence

```mermaid
sequenceDiagram
    actor User
    participant CI as ChatInput
    participant App as App.jsx
    participant API as Express API :5000
    participant PW as Playwright
    participant RT as Rotten Tomatoes
    participant Mock as Mock Dataset

    User->>CI: Types city name + Enter
    CI->>App: onSend(city)
    App->>App: addMsg(user bubble) setLoading=true
    App->>API: POST /api/movies { city }

    API->>API: Validate + sanitise input

    alt Live scraping succeeds
        API->>PW: scrapeMovies(city)
        PW->>RT: GET /browse/movies_in_theaters/ (headless)
        RT-->>PW: HTML page
        PW->>PW: waitForSelector + evaluate() extract x8
        PW-->>API: movies[] source=live
        PW->>PW: browser.close()
    else Scraping fails — blocked / timeout / no results
        PW-->>API: throws Error
        API->>Mock: buildMockResponse()
        Mock-->>API: shuffle slice 6 source=mock
    end

    API-->>App: 200 JSON { source, city, movies[] }
    App->>App: setLoading=false addMsg(bot text + movies)
    App-->>User: MovieCard x N rendered in chat
```

---

## Diagram 3 — Detailed Data Flow

```mermaid
flowchart TD
    A([User types city name]) --> B[ChatInput onSend]
    B --> C{Input empty?}
    C -- Yes --> Z1([Silently ignored])
    C -- No --> D[App.jsx POST /api/movies]

    D --> E{Server reachable?}
    E -- No --> ERR1["Bot bubble: Cannot reach backend"]
    E -- Yes --> F{Validation passes?}
    F -- Fails --> ERR2["Bot bubble: 400 error message"]
    F -- Passes --> G[Launch Playwright Headless Chromium]

    G --> H[Navigate to Rotten Tomatoes]
    H --> I{Page loaded within 20s?}
    I -- Timeout --> FALL
    I -- Loaded --> J[waitForSelector discovery-media-list-item]
    J --> K{Selector found within 10s?}
    K -- Not found --> FALL
    K -- Found --> L[page.evaluate — extract title + score x8]
    L --> M{movies.length > 0?}
    M -- No --> FALL
    M -- Yes --> N["Return source=live"]

    FALL(["⚡ Fallback triggered"]) --> O["buildMockResponse — shuffle + slice 6"]
    O --> P["Return source=mock"]

    N --> Q[browser.close always]
    P --> Q
    Q --> R[setLoading=false]
    R --> S[Add bot text bubble with source badge]
    S --> T[Add bot movies message]
    T --> U([ChatWindow renders MovieCard x N])
```

---

## Diagram 4 — React Component Hierarchy

```mermaid
graph TD
    APP["App.jsx\nstate: messages[], loading\nfetch: POST /api/movies"]

    APP --> SIDEBAR["aside Sidebar\ncity hints · status dot"]
    APP --> MAIN["main Chat Area"]
    MAIN --> CW["ChatWindow\nscrollable list"]
    MAIN --> INPUT["ChatInput\ncontrolled input · Enter key"]

    CW --> MSG_USER["Message role=user\nright-aligned bubble"]
    CW --> MSG_BOT_TEXT["Message role=bot type=text\nMarkdown rendered"]
    CW --> MSG_BOT_MOVIES["Message role=bot type=movies\ngrid layout"]
    CW --> TI["TypingIndicator\nthree-dot bounce"]

    MSG_BOT_MOVIES --> MC1["MovieCard — icon · title · genre"]
    MSG_BOT_MOVIES --> MC2["MovieCard — score · rating badge"]
    MSG_BOT_MOVIES --> MC3["MovieCard — showtimes pills"]

    INPUT -- "onSend(city)" --> APP
    APP -- "messages[]" --> CW
    APP -- "loading" --> TI
```

---

## Diagram 5 — Security & Input Sanitization

```mermaid
flowchart LR
    RAW["Raw user input"] --> FE_MAX["Frontend maxLength=100"]
    FE_MAX --> FE_TRIM["JS trim()"]
    FE_TRIM --> FETCH["POST /api/movies JSON"]

    FETCH --> CORS_CHECK{"CORS Check\nOrigin === :5173?"}
    CORS_CHECK -- No --> REJECT_CORS["403 Blocked"]
    CORS_CHECK -- Yes --> TYPE_CHECK{"typeof city === string?"}
    TYPE_CHECK -- No --> REJECT_400["400 Bad Request"]
    TYPE_CHECK -- Yes --> EMPTY_CHECK{"city.trim().length > 0?"}
    EMPTY_CHECK -- No --> REJECT_400
    EMPTY_CHECK -- Yes --> LEN_CHECK{"length <= 100?"}
    LEN_CHECK -- No --> REJECT_400
    LEN_CHECK -- Yes --> SANITISE["strip  < > quote amp"]
    SANITISE --> DISPLAY["Display label only"]
    SANITISE --> HARDCODED_URL["URL is hardcoded — not injectable"]
    DISPLAY --> REACT_RENDER["React auto-escapes — XSS safe"]
```

---

*HLD Diagrams v1.0 — Movie Finder Chatbot — March 2026*
