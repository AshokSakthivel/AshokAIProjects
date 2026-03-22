import { useState, useRef, useEffect } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import './App.css';

const WELCOME = {
  id: 'welcome', role: 'bot', type: 'text',
  text: "👋 Hi! I'm **Movie Finder**. Type the name of a city and I'll tell you what movies are playing there right now!",
};
let counter = 0;
const uid = () => `msg-${++counter}-${Date.now()}`;

export default function App() {
  const [messages, setMessages] = useState([WELCOME]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const addMsg = (m) => setMessages((prev) => [...prev, { id: uid(), ...m }]);

  const handleSend = async (text) => {
    if (!text.trim() || loading) return;
    addMsg({ role: 'user', type: 'text', text: text.trim() });
    setLoading(true);
    try {
      const res = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: text.trim() }),
      });
      if (!res.ok) { const { error } = await res.json().catch(() => ({})); throw new Error(error || `Server error ${res.status}`); }
      const { movies, city, source } = await res.json();
      if (!movies?.length) {
        addMsg({ role: 'bot', type: 'text', text: `😕 No movies found for **${city}**. Try another city!` });
      } else {
        const note = source === 'live' ? '🌐 *Live data from Rotten Tomatoes*' : '🎭 *Demo data — live scraping unavailable for this region*';
        addMsg({ role: 'bot', type: 'text', text: `🎬 Found **${movies.length} movies** now playing in **${city}**!\n\n${note}` });
        addMsg({ role: 'bot', type: 'movies', movies });
      }
    } catch (err) {
      addMsg({ role: 'bot', type: 'text', text: `⚠️ Oops! ${err.message}. Make sure the backend is running on port 5000.` });
    } finally { setLoading(false); }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">🎬</div>
        <h2 className="sidebar-title">Movie Finder</h2>
        <p className="sidebar-subtitle">powered by Playwright</p>
        <div className="sidebar-divider" />
        <p className="sidebar-hint">Try typing one of these cities:</p>
        <ul className="sidebar-examples">
          {['New York', 'Mumbai', 'London', 'Tokyo', 'Sydney'].map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="sidebar-footer"><span className="status-dot" /><span>Backend on :5000</span></div>
      </aside>
      <main className="chat-area">
        <header className="chat-header">
          <span className="chat-header-icon">🎬</span>
          <span className="chat-header-title">Movie Finder Chatbot</span>
        </header>
        <ChatWindow messages={messages} loading={loading} />
        <div ref={bottomRef} />
        <ChatInput onSend={handleSend} disabled={loading} />
      </main>
    </div>
  );
}
