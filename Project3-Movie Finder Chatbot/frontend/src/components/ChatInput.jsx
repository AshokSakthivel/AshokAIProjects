import { useState } from 'react';
import './ChatInput.css';
export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const submit = () => { if (!value.trim() || disabled) return; onSend(value.trim()); setValue(''); };
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };
  return (
    <div className="input-bar">
      <input
        className="chat-input"
        type="text"
        placeholder="Enter a city name (e.g. New York, Mumbai, London)..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        maxLength={100}
        autoFocus
      />
      <button className="send-btn" onClick={submit} disabled={disabled || !value.trim()} title="Search movies">
        {disabled ? '⏳' : '🔍'}
      </button>
    </div>
  );
}
