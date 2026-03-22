import Message from './Message';
import TypingIndicator from './TypingIndicator';
import './ChatWindow.css';
export default function ChatWindow({ messages, loading }) {
  return (
    <div className="chat-window">
      {messages.map((m) => <Message key={m.id} message={m} />)}
      {loading && <TypingIndicator />}
    </div>
  );
}
