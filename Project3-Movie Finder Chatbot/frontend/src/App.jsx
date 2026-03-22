import { useState, useRef, useEffect } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import './App.css';

const WELCOME = {
  id: 'welcome', role: 'bot', type: 'text',
  text: "👋 Hi! I'm your **Agentic Movie & Weather Planner**. Ask me about movies in any city — I'll check the weather and find what's playing!",
};
let counter = 0;
const uid = () => `msg-${++counter}-${Date.now()}`;

export default function App() {
  const [messages, setMessages] = useState([WELCOME]);
  const [loading, setLoading] = useState(false);
  // Conversation history kept for multi-turn context (role/content pairs only)
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const addMsg = (m) => setMessages((prev) => [...prev, { id: uid(), ...m }]);

  const handleSend = async (text) => {
    if (!text.trim() || loading) return;
    const userText = text.trim();
    addMsg({ role: 'user', type: 'text', text: userText });
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `Server error ${res.status}`);
      }
      const { reply, movies, toolsUsed } = await res.json();

      // Show the LLM's text reply
      addMsg({ role: 'bot', type: 'text', text: reply });

      // Show structured movie cards if the agent fetched them
      if (movies?.length) {
        addMsg({ role: 'bot', type: 'movies', movies });
      }

      // Append this turn to history for follow-up questions
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: reply },
      ]);

      if (toolsUsed?.length) {
        console.log('[Agent] Tools used:', toolsUsed.join(', '));
      }
    } catch (err) {
      addMsg({ role: 'bot', type: 'text', text: `⚠️ Oops! ${err.message}. Make sure the backend is running on port 5000.` });
    } finally { setLoading(false); }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">🤖</div>
        <h2 className="sidebar-title">Agentic Planner</h2>
        <p className="sidebar-subtitle">powered by Llama 3.1</p>
        <div className="sidebar-divider" />
        <p className="sidebar-hint">Try asking:</p>
        <ul className="sidebar-examples">
          {[
            'Movies in New York',
            'What\'s playing in London?',
            'Good movies for a rainy day in Tokyo',
            'What should I watch in Mumbai tonight?',
            'Movies in Sydney',
          ].map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="sidebar-footer"><span className="status-dot" /><span>Backend on :5001</span></div>
      </aside>
      <main className="chat-area">
        <header className="chat-header">
          <span className="chat-header-icon">🤖</span>
          <span className="chat-header-title">Agentic Movie & Weather Planner</span>
        </header>
        <ChatWindow messages={messages} loading={loading} />
        <div ref={bottomRef} />
        <ChatInput onSend={handleSend} disabled={loading} />
      </main>
    </div>
  );
}
