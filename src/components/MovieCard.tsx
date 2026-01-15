import { memo, useState, useCallback, useEffect } from 'react';
import type { Movie } from '../types/movie';
import { searchImage } from '../services/imageService';
import './MovieCard.css';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  isActive?: boolean;
}

export const MovieCard = memo(function MovieCard({ movie, onSelect, isActive }: MovieCardProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);
  const [loadingFallback, setLoadingFallback] = useState(false);

  // Busca imagem do TMDB quando a imagem original falha
  useEffect(() => {
    if (imageError && !fallbackImage && !loadingFallback) {
      setLoadingFallback(true);
      searchImage(movie.name, movie.type as 'movie' | 'series')
        .then(url => {
          setFallbackImage(url);
          setLoadingFallback(false);
        })
        .catch(() => setLoadingFallback(false));
    }
  }, [imageError, movie.name, movie.type, fallbackImage, loadingFallback]);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(movie);
    }
  }, [onSelect, movie]);

  return (
    <div 
      className={`movie-card ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
      onClick={() => onSelect(movie)}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      title={movie.name}
      role="button"
      tabIndex={0}
      data-focusable="true"
    >
      <div className="movie-poster">
        {(movie.logo && !imageError) || fallbackImage ? (
          <img 
            src={fallbackImage || movie.logo} 
            alt={movie.name}
            loading="lazy"
            onError={handleImageError}
          />
        ) : loadingFallback ? (
          <div className="movie-placeholder-styled">
            <div className="placeholder-gradient" />
            <div className="placeholder-content">
              <div className="loading-spinner" />
            </div>
          </div>
        ) : (
          <div className="movie-placeholder-styled">
            <div className="placeholder-gradient" />
            <div className="placeholder-content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="placeholder-title">{movie.name.substring(0, 20)}{movie.name.length > 20 ? '...' : ''}</span>
            </div>
          </div>
        )}
        <div className="movie-overlay">
          <button className="play-btn" tabIndex={-1}>
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
