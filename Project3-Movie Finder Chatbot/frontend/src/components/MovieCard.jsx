import './MovieCard.css';
export default function MovieCard({ movie }) {
  return (
    <div className="movie-card">
      <div className="movie-card-header">
        <span className="movie-icon">{movie.icon || '🎬'}</span>
        <div className="movie-meta">
          <span className="movie-rating-badge">{movie.rating}</span>
          <span className="movie-score">{movie.score}</span>
        </div>
      </div>
      <h3 className="movie-title">{movie.title}</h3>
      <p className="movie-genre">{movie.genre}</p>
      <p className="movie-description">{movie.description}</p>
      <div className="movie-showtimes">
        <span className="showtimes-label">🕐 Showtimes</span>
        <div className="times-row">
          {movie.showtimes.map((t, i) => <span key={i} className="time-pill">{t}</span>)}
        </div>
      </div>
    </div>
  );
}
