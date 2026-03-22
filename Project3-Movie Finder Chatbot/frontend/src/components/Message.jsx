import MovieCard from './MovieCard';
import './Message.css';

function renderMd(text) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    parts.push(raw.startsWith('**')
      ? <strong key={m.index}>{raw.slice(2,-2)}</strong>
      : <em key={m.index}>{raw.slice(1,-1)}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function parseText(text) {
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>{renderMd(line)}{i < arr.length - 1 && <br />}</span>
  ));
}

export default function Message({ message }) {
  const isUser = message.role === 'user';
  if (message.type === 'movies') {
    return (
      <div className="message-row bot">
        <div className="avatar bot-avatar">🎬</div>
        <div className="movie-grid">{message.movies.map((mv, i) => <MovieCard key={i} movie={mv} />)}</div>
      </div>
    );
  }
  return (
    <div className={`message-row ${isUser ? 'user' : 'bot'}`}>
      {!isUser && <div className="avatar bot-avatar">🤖</div>}
      <div className={`bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>{parseText(message.text)}</div>
      {isUser && <div className="avatar user-avatar">👤</div>}
    </div>
  );
}
