import { memo } from 'react';
import type { Movie } from '../types/movie';
import './MovieCard.css';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  isActive?: boolean;
}

export const MovieCard = memo(function MovieCard({ movie, onSelect, isActive }: MovieCardProps) {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    // Fallback para placeholder se a imagem não carregar
    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(movie.name.substring(0, 2))}&background=6366f1&color=fff&size=300&bold=true`;
  };

  return (
    <div 
      className={`movie-card ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(movie)}
      title={movie.name}
    >
      <div className="movie-poster">
        {movie.logo ? (
          <img 
            src={movie.logo} 
            alt={movie.name}
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div className="movie-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="movie-overlay">
          <button className="play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
        <span className={`movie-type ${movie.type}`}>
          {movie.type === 'series' ? '📺' : '🎬'}
        </span>
      </div>
      <div className="movie-info">
        <h4 className="movie-title">{movie.name}</h4>
      </div>
    </div>
  );
});
