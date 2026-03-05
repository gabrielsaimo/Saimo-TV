/**
 * MovieCatalog V2 - Catálogo de Filmes e Séries
 *
 * Dados carregados via API Supabase (ver API.md):
 * - get_home: carousels da tela inicial
 * - get_catalog: busca e filtros paginados server-side
 * - get_item: detalhe completo (elenco, episódios, URL)
 * - get_filmography: filmografia de ator
 * - get_categories: categorias disponíveis para filtros
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { EnrichedMovie, EnrichedSeries, EnrichedCastMember } from '../types/enrichedMovie';
import {
  getHome,
  getCatalog,
  getItem,
  getFilmography,
  getCategoriesCached,
  type HomeCategory,
  type CatalogOrderBy,
  type ApiCategories,
} from '../services/supabaseService';
import { getTrendingToday } from '../services/trendingService';
import { isFavorite, toggleFavorite, getFavorites } from '../services/favoritesService';
import './MovieCatalogV2.css';

// ============================================================
// TIPOS E INTERFACES
// ============================================================

interface MovieCatalogV2Props {
  onSelectMovie: (movie: EnrichedMovie, episodeUrl?: string) => void;
  onBack: () => void;
  isAdultUnlocked?: boolean;
}

interface CatalogFilters {
  type: 'all' | 'movie' | 'series';
  category: string | null;
  categoryLabel: string | null;
  sortBy: CatalogOrderBy;
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

const LazyImage = memo(function LazyImage({
  src,
  alt,
  className = '',
  fallback,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  if (!src || error) {
    return (
      <div className={`lazy-image placeholder ${className}`} ref={imgRef}>
        <div className="placeholder-content">
          <span>{fallback || alt.substring(0, 2).toUpperCase()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`lazy-image ${className}`} ref={imgRef}>
      {!loaded && <div className="image-skeleton" />}
      {isVisible && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
    </div>
  );
});

const RatingBadge = memo(function RatingBadge({ rating }: { rating: number }) {
  if (!rating || rating <= 0) return null;
  const level = rating >= 7.5 ? 'high' : rating >= 6 ? 'medium' : 'low';
  return (
    <div className={`rating-badge ${level}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
      <span>{rating.toFixed(1)}</span>
    </div>
  );
});

const CertificationBadge = memo(function CertificationBadge({ cert }: { cert: string | null | undefined }) {
  if (!cert) return null;
  const certClass = `cert-${cert.replace('+', '').toLowerCase()}`;
  return <div className={`certification-badge ${certClass}`}>{cert}</div>;
});

// ============================================================
// CARD DE FILME/SÉRIE
// ============================================================

const ContentCard = memo(function ContentCard({
  item,
  onSelect,
  size = 'normal',
}: {
  item: EnrichedMovie;
  onSelect: (item: EnrichedMovie) => void;
  size?: 'normal' | 'large' | 'small';
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isSeries = item.type === 'series';
  const tmdb = item.tmdb;
  const seasonCount = isSeries && 'totalSeasons' in item ? (item as EnrichedSeries).totalSeasons : 0;
  const episodeCount = isSeries && 'totalEpisodes' in item ? (item as EnrichedSeries).totalEpisodes : 0;

  return (
    <div
      className={`content-card ${size} ${isHovered ? 'hovered' : ''}`}
      onClick={() => onSelect(item)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item); }
      }}
    >
      <div className="card-poster">
        <LazyImage src={tmdb?.poster} alt={tmdb?.title || item.name} fallback={item.name.substring(0, 2)} />
        {tmdb?.rating && <RatingBadge rating={tmdb.rating} />}
        <CertificationBadge cert={tmdb?.certification} />
        <div className={`type-indicator ${isSeries ? 'series' : 'movie'}`}>
          {isSeries ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
              </svg>
              {seasonCount && <span>{seasonCount}T</span>}
            </>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
            </svg>
          )}
        </div>
        <div className="card-overlay">
          <div className="overlay-info">
            {tmdb?.year && <span className="year">{tmdb.year}</span>}
            {isSeries && episodeCount && <span className="episodes">{episodeCount} eps</span>}
          </div>
          <button className="play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        </div>
      </div>
      <div className="card-info">
        <h4 className="card-title">{tmdb?.title || item.name}</h4>
        {tmdb?.genres && tmdb.genres.length > 0 && (
          <p className="card-genres">{tmdb.genres.slice(0, 4).join(' • ')}</p>
        )}
      </div>
    </div>
  );
});

// ============================================================
// CARD DE ATOR
// ============================================================

const ActorCard = memo(function ActorCard({
  actor,
  onSelect,
}: {
  actor: EnrichedCastMember;
  onSelect: (actor: EnrichedCastMember) => void;
}) {
  return (
    <div
      className="actor-card"
      onClick={() => onSelect(actor)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(actor); }
      }}
    >
      <div className="actor-photo">
        <LazyImage src={actor.photo} alt={actor.name} fallback={actor.name.substring(0, 2)} />
      </div>
      <div className="actor-info">
        <h5 className="actor-name">{actor.name}</h5>
        {actor.character && <p className="actor-character">{actor.character}</p>}
      </div>
    </div>
  );
});

// ============================================================
// FILTROS
// ============================================================

const CatalogFiltersBar = memo(function CatalogFiltersBar({
  filters,
  categories,
  onChange,
  onClear,
  isAdultUnlocked,
}: {
  filters: CatalogFilters;
  categories: ApiCategories | null;
  onChange: (f: CatalogFilters) => void;
  onClear: () => void;
  isAdultUnlocked: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.category !== null ||
    filters.type !== 'all' ||
    filters.sortBy !== 'rating';

  // Categorias disponíveis de acordo com o tipo selecionado
  const availableCategories = categories
    ? filters.type === 'series'
      ? categories.series
      : filters.type === 'movie'
        ? [...categories.movies].filter(c => isAdultUnlocked || c.id !== 'hot-adultos')
        : [
            ...categories.movies.filter(c => isAdultUnlocked || c.id !== 'hot-adultos'),
            ...categories.series,
          ]
    : [];

  return (
    <div className={`advanced-filters ${isExpanded ? 'expanded' : ''}`}>
      <div className="filters-header">
        <button
          className={`filters-toggle ${hasActiveFilters ? 'has-filters' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          <span>Filtros</span>
          {hasActiveFilters && (
            <span className="filter-count">
              {(filters.category ? 1 : 0) + (filters.type !== 'all' ? 1 : 0) + (filters.sortBy !== 'rating' ? 1 : 0)}
            </span>
          )}
          <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {hasActiveFilters && (
          <button className="clear-filters" onClick={onClear}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Limpar
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filters-content">
          {/* Tipo */}
          <div className="filter-group">
            <h4>Tipo</h4>
            <div className="filter-options type-options">
              {(['all', 'movie', 'series'] as const).map(t => (
                <button
                  key={t}
                  className={`filter-chip ${filters.type === t ? 'active' : ''}`}
                  onClick={() => onChange({ ...filters, type: t, category: null, categoryLabel: null })}
                >
                  {t === 'all' ? 'Todos' : t === 'movie' ? 'Filmes' : 'Séries'}
                </button>
              ))}
            </div>
          </div>

          {/* Categoria */}
          {availableCategories.length > 0 && (
            <div className="filter-group">
              <h4>Categoria</h4>
              <div className="filter-options genre-options">
                {availableCategories.map(cat => (
                  <button
                    key={cat.id}
                    className={`filter-chip ${filters.category === cat.id ? 'active' : ''}`}
                    onClick={() =>
                      onChange({
                        ...filters,
                        category: filters.category === cat.id ? null : cat.id,
                        categoryLabel: filters.category === cat.id ? null : cat.label,
                      })
                    }
                  >
                    {cat.label}
                    <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '4px' }}>({cat.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ordenação */}
          <div className="filter-group">
            <h4>Ordenar por</h4>
            <div className="filter-options sort-options">
              <select
                value={filters.sortBy}
                onChange={(e) => onChange({ ...filters, sortBy: e.target.value as CatalogOrderBy })}
              >
                <option value="rating">Avaliação</option>
                <option value="new">Mais Recentes</option>
                <option value="name">Nome (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================
// BARRA DE BUSCA
// ============================================================

const SearchBar = memo(function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar filmes, séries...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`search-bar ${isFocused ? 'focused' : ''}`}>
      <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
      />
      {value && (
        <button className="clear-search" onClick={() => onChange('')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
});

// ============================================================
// CAROUSEL DE CATEGORIA
// ============================================================

const CategoryCarousel = memo(function CategoryCarousel({
  title,
  items,
  onSelect,
  onSeeAll,
  loading = false,
}: {
  title: string;
  items: EnrichedMovie[];
  onSelect: (item: EnrichedMovie) => void;
  onSeeAll?: () => void;
  loading?: boolean;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const el = carouselRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [checkScroll, items.length]);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -carouselRef.current.clientWidth * 0.8 : carouselRef.current.clientWidth * 0.8,
        behavior: 'smooth',
      });
    }
  };

  if (loading) {
    return (
      <section className="category-carousel-section">
        <div className="carousel-header"><h3>{title}</h3></div>
        <div className="carousel-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-card"><div className="skeleton-shimmer" /></div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="category-carousel-section">
      <div className="carousel-header">
        <h3>{title}</h3>
        {onSeeAll && (
          <button className="see-all-btn" onClick={onSeeAll}>
            Ver todos
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
      <div className="carousel-wrapper">
        {canScrollLeft && (
          <button className="carousel-nav prev" onClick={() => scroll('left')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="carousel-track" ref={carouselRef}>
          {items.map(item => (
            <ContentCard key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
        {canScrollRight && (
          <button className="carousel-nav next" onClick={() => scroll('right')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
});

// ============================================================
// HERO BANNER
// ============================================================

const HeroBanner = memo(function HeroBanner({
  items,
  onSelect,
}: {
  items: EnrichedMovie[];
  onSelect: (item: EnrichedMovie) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [items.length, isPaused]);

  if (items.length === 0) return null;

  const current = items[currentIndex];
  const tmdb = current.tmdb;

  return (
    <div
      className="hero-banner"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="hero-backdrop">
        {tmdb?.backdrop ? (
          <img src={tmdb.backdropHD || tmdb.backdrop} alt={tmdb.title} className="hero-image" />
        ) : tmdb?.poster ? (
          <img src={tmdb.posterHD || tmdb.poster} alt={tmdb.title} className="hero-image poster-fallback" />
        ) : null}
        <div className="hero-gradient" />
      </div>
      <div className="hero-content">
        <div className="hero-badge">
          {current.type === 'series' ? '📺 Série em Destaque' : '🎬 Filme em Destaque'}
        </div>
        <h1 className="hero-title">{tmdb?.title || current.name}</h1>
        <div className="hero-meta">
          {tmdb?.rating && tmdb.rating > 0 && (
            <span className={`hero-rating ${tmdb.rating >= 7 ? 'high' : tmdb.rating >= 5 ? 'medium' : 'low'}`}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              {tmdb.rating.toFixed(1)}
            </span>
          )}
          <CertificationBadge cert={tmdb?.certification} />
          {tmdb?.year && <span className="hero-year">{tmdb.year}</span>}
        </div>
        <div className="hero-actions">
          <button className="hero-play-btn" onClick={() => onSelect(current)}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Assistir
          </button>
          <button className="hero-info-btn" onClick={() => onSelect(current)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Mais Info
          </button>
        </div>
      </div>
      {items.length > 1 && (
        <div className="hero-indicators">
          {items.map((_, idx) => (
            <button
              key={idx}
              className={`hero-indicator ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
            />
          ))}
        </div>
      )}
      {items.length > 1 && (
        <>
          <button
            className="hero-nav prev"
            onClick={() => setCurrentIndex(prev => (prev === 0 ? items.length - 1 : prev - 1))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className="hero-nav next"
            onClick={() => setCurrentIndex(prev => (prev + 1) % items.length)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
});

// ============================================================
// MODAL DE DETALHES
// ============================================================

const MovieDetailsModal = memo(function MovieDetailsModal({
  slim,
  full,
  loading,
  onClose,
  onPlay,
  onActorClick,
  onFavoriteChange,
}: {
  slim: EnrichedMovie;
  full: EnrichedMovie | null;
  loading: boolean;
  onClose: () => void;
  onPlay: (item: EnrichedMovie, episodeUrl?: string) => void;
  onActorClick: (actor: EnrichedCastMember) => void;
  onFavoriteChange?: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(() => isFavorite(slim.id));

  // Usa full se disponível, caso contrário usa slim
  const item = full ?? slim;
  const tmdb = item.tmdb;
  const isSeries = item.type === 'series' && 'episodes' in item && Object.keys((item as EnrichedSeries).episodes).length > 0;
  const seriesItem = isSeries ? (item as EnrichedSeries) : null;

  const seasons = seriesItem
    ? Object.keys(seriesItem.episodes).sort((a, b) => parseInt(a) - parseInt(b))
    : [];

  useEffect(() => {
    if (seasons.length > 0 && !selectedSeason) setSelectedSeason(seasons[0]);
  }, [seasons, selectedSeason]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onClose();
  };

  const formatRuntime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const handleToggleFavorite = () => {
    const newState = toggleFavorite(slim.id, full ?? slim);
    setIsFav(newState);
    onFavoriteChange?.();
  };

  return (
    <div className="movie-modal-backdrop" ref={modalRef} onClick={handleBackdropClick}>
      <div className="movie-modal">
        {tmdb?.backdrop && (
          <div className="modal-backdrop">
            <img src={tmdb.backdropHD || tmdb.backdrop} alt="" />
            <div className="modal-backdrop-gradient" />
          </div>
        )}

        <div className="modal-top-buttons">
          <button
            className={`modal-favorite ${isFav ? 'active' : ''}`}
            onClick={handleToggleFavorite}
            title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <svg viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          <div className="modal-header">
            <div className="modal-poster">
              <LazyImage src={tmdb?.posterHD || tmdb?.poster} alt={tmdb?.title || item.name} />
              {tmdb?.certification && <CertificationBadge cert={tmdb.certification} />}
            </div>

            <div className="modal-info">
              <h1 className="modal-title">{tmdb?.title || item.name}</h1>

              {tmdb?.originalTitle && tmdb.originalTitle !== tmdb.title && (
                <p className="modal-original-title">{tmdb.originalTitle}</p>
              )}

              <div className="modal-meta">
                {tmdb?.rating && tmdb.rating > 0 && (
                  <div className={`rating-large ${tmdb.rating >= 7 ? 'high' : tmdb.rating >= 5 ? 'medium' : 'low'}`}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                    <span className="rating-value">{tmdb.rating.toFixed(1)}</span>
                    {tmdb.voteCount > 0 && (
                      <span className="rating-votes">({tmdb.voteCount.toLocaleString('pt-BR')} votos)</span>
                    )}
                  </div>
                )}
                {tmdb?.year && <span className="meta-item">{tmdb.year}</span>}
                {tmdb?.runtime && <span className="meta-item">{formatRuntime(tmdb.runtime)}</span>}
                {seriesItem && (
                  <span className="meta-item">
                    {seriesItem.totalSeasons} Temporada{(seriesItem.totalSeasons || 0) > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Sinopse */}
              {loading ? (
                <div className="modal-overview">
                  <div className="skeleton-text" style={{ height: '80px', borderRadius: '8px' }} />
                </div>
              ) : tmdb?.overview ? (
                <div className="modal-overview">
                  <h3>Sinopse</h3>
                  <p>{tmdb.overview}</p>
                </div>
              ) : null}

              {/* Gêneros */}
              {tmdb?.genres && tmdb.genres.length > 0 && (
                <div className="modal-genres">
                  {tmdb.genres.map(genre => (
                    <span key={genre} className="genre-tag">{genre}</span>
                  ))}
                </div>
              )}

              {/* Botão play para filmes */}
              {!item.type.includes('series') && (
                <div className="modal-actions">
                  <button className="play-btn-large" onClick={() => onPlay(item)}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    Assistir Agora
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Episódios */}
          {isSeries && seriesItem && seasons.length > 0 && (
            <div className="modal-episodes">
              <h3>Episódios</h3>
              <div className="season-tabs">
                {seasons.map(season => (
                  <button
                    key={season}
                    className={`season-tab ${selectedSeason === season ? 'active' : ''}`}
                    onClick={() => setSelectedSeason(season)}
                  >
                    Temporada {season}
                    <span className="episode-count">{seriesItem.episodes[season]?.length || 0} eps</span>
                  </button>
                ))}
              </div>
              {selectedSeason && seriesItem.episodes[selectedSeason] && (
                <div className="episodes-list">
                  {seriesItem.episodes[selectedSeason].map((episode, idx) => (
                    <button
                      key={episode.id || idx}
                      className="episode-item"
                      onClick={() => onPlay(item, episode.url)}
                    >
                      <div className="episode-number"><span>{episode.episode || idx + 1}</span></div>
                      <div className="episode-info">
                        <span className="episode-title">{episode.name || `Episódio ${episode.episode || idx + 1}`}</span>
                      </div>
                      <div className="episode-play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading spinner quando carregando detalhes */}
          {loading && (
            <div className="modal-loading">
              <div className="loading-spinner" />
              <p>Carregando detalhes...</p>
            </div>
          )}

          {/* Elenco */}
          {!loading && tmdb?.cast && tmdb.cast.length > 0 && (
            <div className="modal-cast">
              <h3>Elenco</h3>
              <div className="cast-grid">
                {tmdb.cast.slice(0, 30).map(actor => (
                  <ActorCard key={actor.id} actor={actor} onSelect={onActorClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================
// MODAL DE ATOR
// ============================================================

const ActorModal = memo(function ActorModal({
  actor,
  onClose,
  onSelectItem,
}: {
  actor: EnrichedCastMember;
  onClose: () => void;
  onSelectItem: (item: EnrichedMovie) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<EnrichedMovie[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getFilmography(actor.id, undefined, 1)
      .then(res => {
        setItems(res.items);
        setTotal(res.total);
        setPage(res.page);
        setTotalPages(res.totalPages);
      })
      .catch(err => console.error('Filmografia:', err))
      .finally(() => setLoading(false));
  }, [actor.id]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    getFilmography(actor.id, undefined, nextPage).then(res => {
      setItems(prev => [...prev, ...res.items]);
      setPage(res.page);
    });
  }, [actor.id, page]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onClose();
  };

  return (
    <div className="actor-modal-backdrop" ref={modalRef} onClick={handleBackdropClick}>
      <div className="actor-modal">
        <button className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="actor-modal-header">
          <div className="actor-modal-photo">
            <LazyImage src={actor.photo} alt={actor.name} fallback={actor.name.substring(0, 2)} />
          </div>
          <div>
            <h2>{actor.name}</h2>
            {!loading && <p>{total} título{total !== 1 ? 's' : ''}</p>}
          </div>
        </div>

        {loading ? (
          <div className="actor-modal-loading">
            <div className="loading-spinner" />
          </div>
        ) : items.length === 0 ? (
          <div className="actor-modal-empty">
            <p>Nenhum conteúdo encontrado para este ator.</p>
          </div>
        ) : (
          <div className="actor-modal-content">
            <div className="filmography-grid">
              {items.map(item => (
                <ContentCard key={item.id} item={item} onSelect={onSelectItem} size="small" />
              ))}
            </div>
            {page < totalPages && (
              <div className="load-more">
                <button onClick={loadMore}>
                  Carregar mais
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function MovieCatalogV2({ onSelectMovie, onBack, isAdultUnlocked = false }: MovieCatalogV2Props) {
  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>({
    type: 'all',
    category: null,
    categoryLabel: null,
    sortBy: 'rating',
  });

  // Home
  const [homeCategories, setHomeCategories] = useState<HomeCategory[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);

  // Categorias disponíveis para filtros
  const [apiCategories, setApiCategories] = useState<ApiCategories | null>(null);

  // Catalog (search / filtro ativo)
  const [catalogItems, setCatalogItems] = useState<EnrichedMovie[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotalPages, setCatalogTotalPages] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Modal de detalhe
  const [modalSlim, setModalSlim] = useState<EnrichedMovie | null>(null);
  const [modalFull, setModalFull] = useState<EnrichedMovie | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Modal de ator
  const [selectedActor, setSelectedActor] = useState<EnrichedCastMember | null>(null);

  // Favoritos
  const [favorites, setFavorites] = useState<EnrichedMovie[]>([]);

  // Hero (trending)
  const [heroItems, setHeroItems] = useState<EnrichedMovie[]>([]);
  const [heroLoading, setHeroLoading] = useState(true);

  // Debounce ref para busca
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determina se está em modo busca/filtro
  const isSearchMode = searchQuery.length >= 2 || filters.category !== null || filters.type !== 'all';

  // ---- Inicialização: home + categories + hero ----
  useEffect(() => {
    // Home carousels
    setHomeLoading(true);
    getHome(null, 20, 'rating')
      .then(async cats => {
        if (cats.length > 0) {
          setHomeCategories(cats);
        } else {
          // Fallback: carrega algumas categorias-chave via getCatalog
          console.warn('get_home retornou vazio — usando fallback por categoria');
          const fallbackCategories = [
            { id: 'netflix', label: 'Netflix', type: 'series' as const },
            { id: 'acao', label: 'Ação', type: 'movie' as const },
            { id: 'lancamentos', label: 'Lançamentos', type: 'movie' as const },
            { id: 'disney', label: 'Disney+', type: 'series' as const },
            { id: 'max', label: 'Max', type: 'series' as const },
          ];
          const results = await Promise.allSettled(
            fallbackCategories.map(fc =>
              getCatalog({ category: fc.id, orderBy: 'rating', page: 1 }).then(res => ({
                ...fc,
                items: res.items,
              })),
            ),
          );
          const loaded = results
            .filter((r): r is PromiseFulfilledResult<HomeCategory> => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(c => c.items.length > 0);
          setHomeCategories(loaded);
        }
      })
      .catch(err => console.error('get_home:', err))
      .finally(() => setHomeLoading(false));

    // Categorias para filtros
    getCategoriesCached()
      .then(cats => setApiCategories(cats))
      .catch(err => console.error('get_categories:', err));

    // Hero: trending ou primeiros da home
    setHeroLoading(true);
    getTrendingToday()
      .then(items => setHeroItems(items.slice(0, 10) as EnrichedMovie[]))
      .catch(() => {/* hero sem trending é OK */})
      .finally(() => setHeroLoading(false));

    // Favoritos
    setFavorites(getFavorites());
  }, []);

  // Listener de favoritos de outras abas
  useEffect(() => {
    const handler = () => setFavorites(getFavorites());
    window.addEventListener('favorites-changed', handler);
    return () => window.removeEventListener('favorites-changed', handler);
  }, []);

  // ---- Busca / Filtro → get_catalog ----
  useEffect(() => {
    if (!isSearchMode) {
      setCatalogItems([]);
      return;
    }

    // Cancela debounce anterior
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(() => {
      setCatalogLoading(true);
      setCatalogPage(1);

      getCatalog({
        type: filters.type !== 'all' ? filters.type : null,
        category: filters.category,
        search: searchQuery.length >= 2 ? searchQuery : null,
        orderBy: filters.sortBy,
        isAdult: isAdultUnlocked,
        page: 1,
      })
        .then(res => {
          setCatalogItems(res.items);
          setCatalogTotal(res.total);
          setCatalogTotalPages(res.totalPages);
          setCatalogPage(1);
        })
        .catch(err => console.error('get_catalog:', err))
        .finally(() => setCatalogLoading(false));
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, filters, isSearchMode, isAdultUnlocked]);

  // ---- Carrega mais páginas ----
  const loadMoreCatalog = useCallback(() => {
    const nextPage = catalogPage + 1;
    setCatalogLoading(true);

    getCatalog({
      type: filters.type !== 'all' ? filters.type : null,
      category: filters.category,
      search: searchQuery.length >= 2 ? searchQuery : null,
      orderBy: filters.sortBy,
      isAdult: isAdultUnlocked,
      page: nextPage,
    })
      .then(res => {
        setCatalogItems(prev => [...prev, ...res.items]);
        setCatalogPage(res.page);
      })
      .catch(err => console.error('get_catalog page:', err))
      .finally(() => setCatalogLoading(false));
  }, [catalogPage, filters, searchQuery, isAdultUnlocked]);

  // ---- Abre modal + carrega detalhes ----
  const handleSelectItem = useCallback((item: EnrichedMovie) => {
    setModalSlim(item);
    setModalFull(null);
    setModalLoading(true);

    getItem(item.id)
      .then(full => setModalFull(full))
      .catch(err => console.error('get_item:', err))
      .finally(() => setModalLoading(false));
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalSlim(null);
    setModalFull(null);
  }, []);

  const handlePlay = useCallback((item: EnrichedMovie, episodeUrl?: string) => {
    setModalSlim(null);
    setModalFull(null);
    onSelectMovie(item, episodeUrl);
  }, [onSelectMovie]);

  const handleActorClick = useCallback((actor: EnrichedCastMember) => {
    setSelectedActor(actor);
  }, []);

  const handleCloseActor = useCallback(() => setSelectedActor(null), []);

  const handleClearFilters = useCallback(() => {
    setFilters({ type: 'all', category: null, categoryLabel: null, sortBy: 'rating' });
    setSearchQuery('');
  }, []);

  const refreshFavorites = useCallback(() => setFavorites(getFavorites()), []);

  // Hero items: usa trending ou fallback para primeiros itens da home
  const heroData = heroItems.length > 0
    ? heroItems
    : homeCategories.flatMap(c => c.items.slice(0, 3)).slice(0, 10);

  // Loading inicial
  if (homeLoading && homeCategories.length === 0) {
    return (
      <div className="catalog-loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <h2>Carregando catálogo...</h2>
          <p>Conectando ao servidor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="movie-catalog-v2">
      {/* Header */}
      <header className="catalog-header">
        <button className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        <CatalogFiltersBar
          filters={filters}
          categories={apiCategories}
          onChange={setFilters}
          onClear={handleClearFilters}
          isAdultUnlocked={isAdultUnlocked}
        />
      </header>

      <main className="catalog-main">
        {/* ---- Modo busca/filtro ---- */}
        {isSearchMode ? (
          <>
            {catalogLoading && catalogItems.length === 0 ? (
              <div className="grid-skeleton">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="skeleton-card"><div className="skeleton-shimmer" /></div>
                ))}
              </div>
            ) : catalogItems.length === 0 ? (
              <section className="no-results">
                <div className="no-results-content">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <h3>Nenhum resultado encontrado</h3>
                  <p>Tente ajustar os filtros ou buscar por outro termo.</p>
                  <button className="clear-filters-btn" onClick={handleClearFilters}>
                    Limpar Filtros
                  </button>
                </div>
              </section>
            ) : (
              <section className="search-results">
                <h2>
                  {searchQuery.length >= 2
                    ? `Resultados para "${searchQuery}"`
                    : filters.categoryLabel || (filters.type !== 'all' ? (filters.type === 'movie' ? 'Filmes' : 'Séries') : 'Catálogo')}
                </h2>
                <p className="results-count">
                  {catalogTotal} {catalogTotal === 1 ? 'título encontrado' : 'títulos encontrados'}
                </p>
                <div className="content-grid">
                  {catalogItems.map(item => (
                    <ContentCard key={item.id} item={item} onSelect={handleSelectItem} />
                  ))}
                </div>
                {catalogPage < catalogTotalPages && (
                  <div className="load-more">
                    <button onClick={loadMoreCatalog} disabled={catalogLoading}>
                      {catalogLoading ? 'Carregando...' : `Carregar mais (${catalogTotal - catalogItems.length} restantes)`}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            {/* Hero Banner */}
            {!heroLoading && heroData.length > 0 && (
              <HeroBanner items={heroData} onSelect={handleSelectItem} />
            )}

            {/* Favoritos */}
            {favorites.length > 0 && (
              <CategoryCarousel
                title="Meus Favoritos"
                items={favorites.slice(0, 50)}
                onSelect={handleSelectItem}
              />
            )}

            {/* Carousels da home (get_home) */}
            {homeLoading
              ? [1, 2, 3].map(i => (
                  <CategoryCarousel key={i} title="" items={[]} onSelect={() => {}} loading />
                ))
              : homeCategories.map(cat => (
                  <CategoryCarousel
                    key={cat.id}
                    title={cat.label}
                    items={cat.items}
                    onSelect={handleSelectItem}
                    onSeeAll={() =>
                      setFilters(prev => ({
                        ...prev,
                        category: cat.id,
                        categoryLabel: cat.label,
                        type: cat.type,
                      }))
                    }
                  />
                ))}
          </>
        )}
      </main>

      {/* Modal de detalhe */}
      {modalSlim && (
        <MovieDetailsModal
          slim={modalSlim}
          full={modalFull}
          loading={modalLoading}
          onClose={handleCloseModal}
          onPlay={handlePlay}
          onActorClick={handleActorClick}
          onFavoriteChange={refreshFavorites}
        />
      )}

      {/* Modal de ator */}
      {selectedActor && (
        <ActorModal
          actor={selectedActor}
          onClose={handleCloseActor}
          onSelectItem={handleSelectItem}
        />
      )}
    </div>
  );
}
