/**
 * MovieCatalog V2 - Catálogo de Filmes e Séries
 * 
 * Usa dados enriched pré-carregados do TMDB.
 * Features:
 * - Filtros avançados (gênero, ano, rating, classificação)
 * - Busca por texto, ator, keyword
 * - Modal detalhado com elenco clicável
 * - Recomendações e similares navegáveis
 * - Página de ator com filmografia
 */

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import type { 
  EnrichedMovie, 
  EnrichedSeries, 
  EnrichedCastMember,
  FilterOptions
} from '../types/enrichedMovie';
import {
  loadEnrichedCategory,
  initializeEnrichedData,
  getAvailableGenres,
  getAvailableYears,
  getAvailableCertifications,
  searchContent,
  filterContent,
  filterAllContent,
  getActorFilmography,
  searchActors,
  getAvailableRecommendations,
  getSimilarByGenre,
  getFeaturedItems,
  getRecentReleases,
  STREAMING_CATEGORIES,
  GENRE_CATEGORIES,
  ADULT_CATEGORIES
} from '../services/enrichedDataService';
import './MovieCatalogV2.css';

// ============================================================
// TIPOS E INTERFACES
// ============================================================

interface MovieCatalogV2Props {
  onSelectMovie: (movie: EnrichedMovie, episodeUrl?: string) => void;
  onBack: () => void;
  isAdultUnlocked?: boolean;
}

interface ModalState {
  type: 'movie' | 'series' | 'actor' | null;
  data: EnrichedMovie | EnrichedSeries | EnrichedCastMember | null;
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

// Lazy Image com fallback
const LazyImage = memo(function LazyImage({ 
  src, 
  alt, 
  className = '',
  fallback
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
      { rootMargin: '200px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

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

// Badge de Rating
const RatingBadge = memo(function RatingBadge({ rating }: { rating: number }) {
  if (!rating || rating <= 0) return null;
  
  const level = rating >= 7.5 ? 'high' : rating >= 6 ? 'medium' : 'low';
  
  return (
    <div className={`rating-badge ${level}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>
      <span>{rating.toFixed(1)}</span>
    </div>
  );
});

// Badge de Certificação
const CertificationBadge = memo(function CertificationBadge({ cert }: { cert: string | null | undefined }) {
  if (!cert) return null;
  
  const certClass = `cert-${cert.replace('+', '').toLowerCase()}`;
  
  return (
    <div className={`certification-badge ${certClass}`}>
      {cert}
    </div>
  );
});

// ============================================================
// CARD DE FILME/SÉRIE
// ============================================================

const ContentCard = memo(function ContentCard({
  item,
  onSelect,
  size = 'normal'
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
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
    >
      <div className="card-poster">
        <LazyImage 
          src={tmdb?.poster} 
          alt={tmdb?.title || item.name}
          fallback={item.name.substring(0, 2)}
        />
        
        {tmdb?.rating && <RatingBadge rating={tmdb.rating} />}
        
        <CertificationBadge cert={tmdb?.certification} />
        
        {/* Type indicator */}
        <div className={`type-indicator ${isSeries ? 'series' : 'movie'}`}>
          {isSeries ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
              </svg>
              {seasonCount && <span>{seasonCount}T</span>}
            </>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
            </svg>
          )}
        </div>
        
        {/* Hover overlay */}
        <div className="card-overlay">
          <div className="overlay-info">
            {tmdb?.year && <span className="year">{tmdb.year}</span>}
            {isSeries && episodeCount && (
              <span className="episodes">{episodeCount} eps</span>
            )}
          </div>
          <button className="play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="card-info">
        <h4 className="card-title">{tmdb?.title || item.name}</h4>
        {tmdb?.genres && tmdb.genres.length > 0 && (
          <p className="card-genres">{tmdb.genres.slice(0, 2).join(' • ')}</p>
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
  onSelect
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
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(actor);
        }
      }}
    >
      <div className="actor-photo">
        <LazyImage 
          src={actor.photo} 
          alt={actor.name}
          fallback={actor.name.substring(0, 2)}
        />
      </div>
      <div className="actor-info">
        <h5 className="actor-name">{actor.name}</h5>
        {actor.character && (
          <p className="actor-character">{actor.character}</p>
        )}
      </div>
    </div>
  );
});

// ============================================================
// FILTROS AVANÇADOS
// ============================================================

const AdvancedFilters = memo(function AdvancedFilters({
  filters,
  onChange,
  availableGenres,
  availableYears,
  availableCertifications,
  onClear
}: {
  filters: Partial<FilterOptions>;
  onChange: (filters: Partial<FilterOptions>) => void;
  availableGenres: string[];
  availableYears: string[];
  availableCertifications: string[];
  onClear: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasActiveFilters = Boolean(
    filters.genres?.length || 
    filters.years?.length || 
    filters.certifications?.length ||
    filters.type !== 'all' ||
    filters.sortBy !== 'popularity'
  );

  const toggleGenre = (genre: string) => {
    const current = filters.genres || [];
    const updated = current.includes(genre)
      ? current.filter(g => g !== genre)
      : [...current, genre];
    onChange({ ...filters, genres: updated });
  };

  const toggleYear = (year: string) => {
    const current = filters.years || [];
    const updated = current.includes(year)
      ? current.filter(y => y !== year)
      : [...current, year];
    onChange({ ...filters, years: updated });
  };

  const toggleCertification = (cert: string) => {
    const current = filters.certifications || [];
    const updated = current.includes(cert)
      ? current.filter(c => c !== cert)
      : [...current, cert];
    onChange({ ...filters, certifications: updated });
  };

  return (
    <div className={`advanced-filters ${isExpanded ? 'expanded' : ''}`}>
      <div className="filters-header">
        <button 
          className={`filters-toggle ${hasActiveFilters ? 'has-filters' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
          </svg>
          <span>Filtros</span>
          {hasActiveFilters && <span className="filter-count">{
            (filters.genres?.length || 0) + 
            (filters.years?.length || 0) + 
            (filters.certifications?.length || 0)
          }</span>}
          <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        
        {hasActiveFilters && (
          <button className="clear-filters" onClick={onClear}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
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
              {(['all', 'movie', 'series'] as const).map(type => (
                <button
                  key={type}
                  className={`filter-chip ${filters.type === type ? 'active' : ''}`}
                  onClick={() => onChange({ ...filters, type })}
                >
                  {type === 'all' ? 'Todos' : type === 'movie' ? 'Filmes' : 'Séries'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Gêneros */}
          <div className="filter-group">
            <h4>Gêneros</h4>
            <div className="filter-options genre-options">
              {availableGenres.slice(0, 15).map(genre => (
                <button
                  key={genre}
                  className={`filter-chip ${filters.genres?.includes(genre) ? 'active' : ''}`}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
          
          {/* Anos */}
          <div className="filter-group">
            <h4>Ano</h4>
            <div className="filter-options year-options">
              {availableYears.slice(0, 10).map(year => (
                <button
                  key={year}
                  className={`filter-chip ${filters.years?.includes(year) ? 'active' : ''}`}
                  onClick={() => toggleYear(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
          
          {/* Classificação */}
          <div className="filter-group">
            <h4>Classificação Indicativa</h4>
            <div className="filter-options cert-options">
              {availableCertifications.map(cert => (
                <button
                  key={cert}
                  className={`filter-chip cert-chip cert-${cert.replace('+', '').toLowerCase()} ${
                    filters.certifications?.includes(cert) ? 'active' : ''
                  }`}
                  onClick={() => toggleCertification(cert)}
                >
                  {cert}
                </button>
              ))}
            </div>
          </div>
          
          {/* Ordenação */}
          <div className="filter-group">
            <h4>Ordenar por</h4>
            <div className="filter-options sort-options">
              <select 
                value={filters.sortBy || 'popularity'}
                onChange={(e) => onChange({ ...filters, sortBy: e.target.value as FilterOptions['sortBy'] })}
              >
                <option value="popularity">Popularidade</option>
                <option value="rating">Avaliação</option>
                <option value="year">Ano</option>
                <option value="name">Nome</option>
              </select>
              <button
                className={`sort-order ${filters.sortOrder === 'asc' ? 'asc' : 'desc'}`}
                onClick={() => onChange({ 
                  ...filters, 
                  sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
                })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
              </button>
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
  onActorSelect,
  placeholder = "Buscar filmes, séries, atores..."
}: {
  value: string;
  onChange: (value: string) => void;
  onActorSelect?: (actor: EnrichedCastMember) => void;
  placeholder?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [actorSuggestions, setActorSuggestions] = useState<EnrichedCastMember[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    
    if (value.length >= 2) {
      debounceRef.current = window.setTimeout(() => {
        const actors = searchActors(value);
        setActorSuggestions(actors.slice(0, 5));
      }, 300);
    } else {
      setActorSuggestions([]);
    }
    
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  const handleActorClick = (actor: EnrichedCastMember) => {
    setActorSuggestions([]);
    onChange('');
    onActorSelect?.(actor);
  };

  return (
    <div className={`search-bar ${isFocused ? 'focused' : ''}`}>
      <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
      </svg>
      
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        placeholder={placeholder}
      />
      
      {value && (
        <button className="clear-search" onClick={() => onChange('')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}
      
      {/* Sugestões de atores */}
      {actorSuggestions.length > 0 && isFocused && (
        <div className="actor-suggestions">
          <p className="suggestions-title">Atores encontrados:</p>
          {actorSuggestions.map(actor => (
            <button
              key={actor.id}
              className="actor-suggestion"
              onMouseDown={() => handleActorClick(actor)}
            >
              <div className="suggestion-photo">
                <LazyImage src={actor.photo} alt={actor.name} />
              </div>
              <span>{actor.name}</span>
            </button>
          ))}
        </div>
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
  loading = false
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
      const scrollAmount = carouselRef.current.clientWidth * 0.8;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <section className="category-carousel-section">
        <div className="carousel-header">
          <h3>{title}</h3>
        </div>
        <div className="carousel-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-shimmer" />
            </div>
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
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        )}
      </div>
      
      <div className="carousel-wrapper">
        {canScrollLeft && (
          <button className="carousel-nav prev" onClick={() => scroll('left')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}
        
        <div className="carousel-track" ref={carouselRef}>
          {items.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onSelect={onSelect}
            />
          ))}
        </div>
        
        {canScrollRight && (
          <button className="carousel-nav next" onClick={() => scroll('right')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
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
  onSelect
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
          <img 
            src={tmdb.backdropHD || tmdb.backdrop} 
            alt={tmdb.title}
            className="hero-image"
          />
        ) : tmdb?.poster ? (
          <img 
            src={tmdb.posterHD || tmdb.poster} 
            alt={tmdb.title}
            className="hero-image poster-fallback"
          />
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
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
              {tmdb.rating.toFixed(1)}
            </span>
          )}
          
          <CertificationBadge cert={tmdb?.certification} />
          
          {tmdb?.year && <span className="hero-year">{tmdb.year}</span>}
          
          {tmdb?.runtime && (
            <span className="hero-runtime">
              {Math.floor(tmdb.runtime / 60)}h {tmdb.runtime % 60}min
            </span>
          )}
          
          {tmdb?.genres && (
            <span className="hero-genres">{tmdb.genres.slice(0, 3).join(' • ')}</span>
          )}
        </div>
        
        {tmdb?.overview && (
          <p className="hero-overview">
            {tmdb.overview.length > 250 
              ? tmdb.overview.substring(0, 250) + '...'
              : tmdb.overview
            }
          </p>
        )}
        
        <div className="hero-actions">
          <button className="hero-play-btn" onClick={() => onSelect(current)}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Assistir
          </button>
          <button className="hero-info-btn" onClick={() => onSelect(current)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            Mais Info
          </button>
        </div>
      </div>
      
      {/* Indicadores */}
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
      
      {/* Navegação */}
      {items.length > 1 && (
        <>
          <button 
            className="hero-nav prev"
            onClick={() => setCurrentIndex(prev => prev === 0 ? items.length - 1 : prev - 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button 
            className="hero-nav next"
            onClick={() => setCurrentIndex(prev => (prev + 1) % items.length)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
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
  item,
  onClose,
  onPlay,
  onActorClick,
  onRecommendationClick
}: {
  item: EnrichedMovie;
  onClose: () => void;
  onPlay: (item: EnrichedMovie, episodeUrl?: string) => void;
  onActorClick: (actor: EnrichedCastMember) => void;
  onRecommendationClick: (item: EnrichedMovie) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  
  const tmdb = item.tmdb;
  const isSeries = item.type === 'series' && 'episodes' in item;
  const seriesItem = isSeries ? item as EnrichedSeries : null;
  
  // Obter recomendações disponíveis
  const recommendations = useMemo(() => getAvailableRecommendations(item), [item]);
  const similar = useMemo(() => getSimilarByGenre(item, 6), [item]);

  // Ordena temporadas
  const seasons = useMemo(() => {
    if (!seriesItem?.episodes) return [];
    return Object.keys(seriesItem.episodes).sort((a, b) => parseInt(a) - parseInt(b));
  }, [seriesItem]);

  useEffect(() => {
    if (seasons.length > 0 && !selectedSeason) {
      setSelectedSeason(seasons[0]);
    }
  }, [seasons, selectedSeason]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onClose();
  };

  const formatRuntime = (minutes: number) => {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const playEpisode = (episode: { url: string }) => {
    onPlay(item, episode.url);
  };

  return (
    <div className="movie-modal-backdrop" ref={modalRef} onClick={handleBackdropClick}>
      <div className="movie-modal">
        {/* Backdrop */}
        {tmdb?.backdrop && (
          <div className="modal-backdrop">
            <img src={tmdb.backdropHD || tmdb.backdrop} alt="" />
            <div className="modal-backdrop-gradient" />
          </div>
        )}
        
        {/* Close button */}
        <button className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        
        <div className="modal-content">
          {/* Header com poster e info */}
          <div className="modal-header">
            <div className="modal-poster">
              <LazyImage 
                src={tmdb?.posterHD || tmdb?.poster} 
                alt={tmdb?.title || item.name}
              />
            </div>
            
            <div className="modal-info">
              <h1 className="modal-title">{tmdb?.title || item.name}</h1>
              
              {tmdb?.originalTitle && tmdb.originalTitle !== tmdb.title && (
                <p className="modal-original-title">{tmdb.originalTitle}</p>
              )}
              
              {tmdb?.tagline && (
                <p className="modal-tagline">"{tmdb.tagline}"</p>
              )}
              
              <div className="modal-meta">
                {tmdb?.rating && tmdb.rating > 0 && (
                  <div className={`rating-large ${tmdb.rating >= 7 ? 'high' : tmdb.rating >= 5 ? 'medium' : 'low'}`}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                    <span className="rating-value">{tmdb.rating.toFixed(1)}</span>
                    <span className="rating-votes">({tmdb.voteCount?.toLocaleString('pt-BR')} votos)</span>
                  </div>
                )}
                
                <CertificationBadge cert={tmdb?.certification} />
                
                {tmdb?.year && <span className="meta-item">{tmdb.year}</span>}
                
                {tmdb?.runtime && (
                  <span className="meta-item">{formatRuntime(tmdb.runtime)}</span>
                )}
                
                {seriesItem && (
                  <span className="meta-item">
                    {seriesItem.totalSeasons} Temporada{(seriesItem.totalSeasons || 0) > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              
              {/* Gêneros */}
              {tmdb?.genres && tmdb.genres.length > 0 && (
                <div className="modal-genres">
                  {tmdb.genres.map(genre => (
                    <span key={genre} className="genre-tag">{genre}</span>
                  ))}
                </div>
              )}
              
              {/* Sinopse */}
              {tmdb?.overview && (
                <div className="modal-overview">
                  <h3>Sinopse</h3>
                  <p>{tmdb.overview}</p>
                </div>
              )}
              
              {/* Botão de play para filmes */}
              {!isSeries && (
                <div className="modal-actions">
                  <button className="play-btn-large" onClick={() => onPlay(item)}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Assistir Agora
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Episódios (para séries) */}
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
                    <span className="episode-count">
                      {seriesItem.episodes[season]?.length || 0} eps
                    </span>
                  </button>
                ))}
              </div>
              
              {selectedSeason && seriesItem.episodes[selectedSeason] && (
                <div className="episodes-list">
                  {seriesItem.episodes[selectedSeason].map((episode, idx) => (
                    <button
                      key={episode.id || idx}
                      className="episode-item"
                      onClick={() => playEpisode(episode)}
                    >
                      <div className="episode-number">
                        <span>{episode.episode || idx + 1}</span>
                      </div>
                      <div className="episode-info">
                        <span className="episode-title">Episódio {episode.episode || idx + 1}</span>
                      </div>
                      <div className="episode-play">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Elenco */}
          {tmdb?.cast && tmdb.cast.length > 0 && (
            <div className="modal-cast">
              <h3>Elenco</h3>
              <div className="cast-grid">
                {tmdb.cast.slice(0, 12).map(actor => (
                  <ActorCard
                    key={actor.id}
                    actor={actor}
                    onSelect={onActorClick}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Recomendações */}
          {recommendations.length > 0 && (
            <div className="modal-recommendations">
              <h3>Também pode gostar</h3>
              <div className="recommendations-grid">
                {recommendations.map(rec => (
                  <ContentCard
                    key={rec.id}
                    item={rec}
                    onSelect={onRecommendationClick}
                    size="small"
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Similares por gênero */}
          {similar.length > 0 && (
            <div className="modal-similar">
              <h3>Títulos Similares</h3>
              <div className="similar-grid">
                {similar.map(sim => (
                  <ContentCard
                    key={sim.id}
                    item={sim}
                    onSelect={onRecommendationClick}
                    size="small"
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Info adicional */}
          <div className="modal-extra-info">
            {tmdb?.companies && tmdb.companies.length > 0 && (
              <p><strong>Produção:</strong> {tmdb.companies.join(', ')}</p>
            )}
            {tmdb?.countries && tmdb.countries.length > 0 && (
              <p><strong>País:</strong> {tmdb.countries.join(', ')}</p>
            )}
            {tmdb?.keywords && tmdb.keywords.length > 0 && (
              <div className="keywords">
                <strong>Tags:</strong>
                <div className="keyword-list">
                  {tmdb.keywords.slice(0, 10).map(kw => (
                    <span key={kw} className="keyword">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
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
  onSelectItem
}: {
  actor: EnrichedCastMember;
  onClose: () => void;
  onSelectItem: (item: EnrichedMovie) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const filmography = useMemo(() => getActorFilmography(actor.id), [actor.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onClose();
  };

  if (!filmography) {
    return (
      <div className="actor-modal-backdrop" ref={modalRef} onClick={handleBackdropClick}>
        <div className="actor-modal">
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div className="actor-modal-empty">
            <p>Nenhum conteúdo encontrado para este ator.</p>
          </div>
        </div>
      </div>
    );
  }

  const totalWorks = filmography.movies.length + filmography.series.length;

  return (
    <div className="actor-modal-backdrop" ref={modalRef} onClick={handleBackdropClick}>
      <div className="actor-modal">
        <button className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        
        <div className="actor-modal-content">
          <div className="actor-modal-header">
            <div className="actor-modal-photo">
              <LazyImage 
                src={actor.photo} 
                alt={actor.name}
                fallback={actor.name.substring(0, 2)}
              />
            </div>
            <div className="actor-modal-info">
              <h1>{actor.name}</h1>
              <p className="actor-works-count">
                {totalWorks} título{totalWorks > 1 ? 's' : ''} no catálogo
              </p>
            </div>
          </div>
          
          {filmography.movies.length > 0 && (
            <div className="actor-filmography-section">
              <h3>Filmes ({filmography.movies.length})</h3>
              <div className="filmography-grid">
                {filmography.movies.map(movie => (
                  <ContentCard
                    key={movie.id}
                    item={movie}
                    onSelect={onSelectItem}
                    size="small"
                  />
                ))}
              </div>
            </div>
          )}
          
          {filmography.series.length > 0 && (
            <div className="actor-filmography-section">
              <h3>Séries ({filmography.series.length})</h3>
              <div className="filmography-grid">
                {filmography.series.map(series => (
                  <ContentCard
                    key={series.id}
                    item={series}
                    onSelect={onSelectItem}
                    size="small"
                  />
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
// GRID DE CATEGORIA
// ============================================================

const CategoryGrid = memo(function CategoryGrid({
  categoryName,
  filters,
  onSelect,
  onBack
}: {
  categoryName: string;
  filters: Partial<FilterOptions>;
  onSelect: (item: EnrichedMovie) => void;
  onBack: () => void;
}) {
  const [items, setItems] = useState<EnrichedMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  useEffect(() => {
    setLoading(true);
    loadEnrichedCategory(categoryName).then(data => {
      const filtered = filterContent(categoryName, filters);
      setItems(filtered.length > 0 ? filtered : data);
      setLoading(false);
    });
  }, [categoryName, filters]);

  const displayedItems = items.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = displayedItems.length < items.length;

  const loadMore = () => {
    setPage(p => p + 1);
  };

  if (loading) {
    return (
      <div className="category-grid-page">
        <div className="grid-header">
          <button className="back-btn" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Voltar
          </button>
          <h2>{categoryName}</h2>
        </div>
        <div className="grid-skeleton">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="category-grid-page">
      <div className="grid-header">
        <button className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Voltar
        </button>
        <h2>{categoryName}</h2>
        <span className="items-count">{items.length} títulos</span>
      </div>
      
      <div className="content-grid">
        {displayedItems.map(item => (
          <ContentCard
            key={item.id}
            item={item}
            onSelect={onSelect}
          />
        ))}
      </div>
      
      {hasMore && (
        <div className="load-more">
          <button onClick={loadMore}>
            Carregar mais
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function MovieCatalogV2({ onSelectMovie, onBack }: MovieCatalogV2Props) {
  // Estados
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EnrichedMovie[]>([]);
  const [filters, setFilters] = useState<Partial<FilterOptions>>({
    type: 'all',
    sortBy: 'popularity',
    sortOrder: 'desc'
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ type: null, data: null });
  
  // Dados
  const [featuredItems, setFeaturedItems] = useState<EnrichedMovie[]>([]);
  const [categoryData, setCategoryData] = useState<Map<string, EnrichedMovie[]>>(new Map());
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableCertifications, setAvailableCertifications] = useState<string[]>([]);

  // Inicialização
  useEffect(() => {
    initializeEnrichedData().then(() => {
      setIsInitialized(true);
      
      // Carrega dados iniciais
      setFeaturedItems(getFeaturedItems('movie', 8));
      setAvailableGenres(getAvailableGenres());
      setAvailableYears(getAvailableYears());
      setAvailableCertifications(getAvailableCertifications());
      
      // Carrega categorias principais
      STREAMING_CATEGORIES.slice(0, 5).forEach(cat => {
        loadEnrichedCategory(cat).then(data => {
          setCategoryData(prev => new Map(prev).set(cat, data));
        });
      });
    });
  }, []);

  // Verifica se há filtros ativos (além dos padrões)
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.genres?.length || 
      filters.years?.length || 
      filters.certifications?.length ||
      (filters.type && filters.type !== 'all')
    );
  }, [filters]);

  // Busca e filtragem
  useEffect(() => {
    if (searchQuery.length >= 2) {
      // Busca por texto com filtros
      const results = searchContent(searchQuery, filters);
      setSearchResults(results);
    } else if (hasActiveFilters) {
      // Só filtros ativos, sem texto de busca
      const results = filterAllContent(filters);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, filters, hasActiveFilters]);

  // Handlers
  const handleSelectItem = useCallback((item: EnrichedMovie) => {
    setModalState({ type: item.type, data: item });
  }, []);

  const handlePlay = useCallback((item: EnrichedMovie, episodeUrl?: string) => {
    setModalState({ type: null, data: null });
    onSelectMovie(item, episodeUrl);
  }, [onSelectMovie]);

  const handleActorClick = useCallback((actor: EnrichedCastMember) => {
    setModalState({ type: 'actor', data: actor });
  }, []);

  const handleRecommendationClick = useCallback((item: EnrichedMovie) => {
    setModalState({ type: item.type, data: item });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState({ type: null, data: null });
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      type: 'all',
      sortBy: 'popularity',
      sortOrder: 'desc'
    });
  }, []);

  const handleSeeAll = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleBackFromCategory = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  // Loading state
  if (!isInitialized) {
    return (
      <div className="catalog-loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <h2>Carregando catálogo...</h2>
          <p>Preparando sua experiência de streaming</p>
        </div>
      </div>
    );
  }

  // Tela de categoria específica
  if (selectedCategory) {
    return (
      <div className="movie-catalog-v2">
        <CategoryGrid
          categoryName={selectedCategory}
          filters={filters}
          onSelect={handleSelectItem}
          onBack={handleBackFromCategory}
        />
        
        {/* Modais */}
        {modalState.type === 'movie' || modalState.type === 'series' ? (
          <MovieDetailsModal
            item={modalState.data as EnrichedMovie}
            onClose={handleCloseModal}
            onPlay={handlePlay}
            onActorClick={handleActorClick}
            onRecommendationClick={handleRecommendationClick}
          />
        ) : modalState.type === 'actor' ? (
          <ActorModal
            actor={modalState.data as EnrichedCastMember}
            onClose={handleCloseModal}
            onSelectItem={handleSelectItem}
          />
        ) : null}
      </div>
    );
  }

  // Tela principal
  return (
    <div className="movie-catalog-v2">
      {/* Header */}
      <header className="catalog-header">
        <button className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onActorSelect={handleActorClick}
        />
        
        <AdvancedFilters
          filters={filters}
          onChange={setFilters}
          availableGenres={availableGenres}
          availableYears={availableYears}
          availableCertifications={availableCertifications}
          onClear={handleClearFilters}
        />
      </header>
      
      {/* Conteúdo principal */}
      <main className="catalog-main">
        {/* Resultados de busca/filtros */}
        {searchResults.length > 0 ? (
          <section className="search-results">
            <h2>
              {searchQuery.length >= 2 
                ? `Resultados para "${searchQuery}"` 
                : 'Conteúdo Filtrado'}
            </h2>
            <p className="results-count">
              {searchResults.length} {searchResults.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
              {hasActiveFilters && (
                <span className="filter-info">
                  {' • '}
                  {filters.type !== 'all' && (filters.type === 'movie' ? 'Filmes' : 'Séries')}
                  {filters.genres?.length ? ` • ${filters.genres.join(', ')}` : ''}
                  {filters.years?.length ? ` • ${filters.years.join(', ')}` : ''}
                </span>
              )}
            </p>
            <div className="content-grid">
              {searchResults.slice(0, 60).map(item => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onSelect={handleSelectItem}
                />
              ))}
            </div>
            {searchResults.length > 60 && (
              <p className="more-results">Mostrando 60 de {searchResults.length} resultados</p>
            )}
          </section>
        ) : (searchQuery.length > 0 || hasActiveFilters) ? (
          <section className="no-results">
            <div className="no-results-content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <h3>Nenhum resultado encontrado</h3>
              <p>
                {hasActiveFilters 
                  ? 'Tente ajustar os filtros ou limpar a seleção.'
                  : 'Tente buscar por outro termo.'}
              </p>
              {hasActiveFilters && (
                <button className="clear-filters-btn" onClick={handleClearFilters}>
                  Limpar Filtros
                </button>
              )}
            </div>
          </section>
        ) : (
          <>
            {/* Hero Banner */}
            <HeroBanner
              items={featuredItems}
              onSelect={handleSelectItem}
            />
            
            {/* Categorias de Streaming */}
            {STREAMING_CATEGORIES.slice(0, 6).map(cat => {
              const data = categoryData.get(cat) || [];
              return (
                <CategoryCarousel
                  key={cat}
                  title={cat}
                  items={data.slice(0, 20)}
                  onSelect={handleSelectItem}
                  onSeeAll={() => handleSeeAll(cat)}
                  loading={!categoryData.has(cat)}
                />
              );
            })}
            
            {/* Lançamentos */}
            <CategoryCarousel
              title="🎬 Lançamentos"
              items={getRecentReleases(20)}
              onSelect={handleSelectItem}
              onSeeAll={() => handleSeeAll('🎬 Lançamentos')}
            />
            
            {/* Mais categorias */}
            {GENRE_CATEGORIES.slice(0, 4).map(cat => {
              const data = categoryData.get(cat) || [];
              if (!categoryData.has(cat)) {
                loadEnrichedCategory(cat).then(d => {
                  setCategoryData(prev => new Map(prev).set(cat, d));
                });
              }
              return (
                <CategoryCarousel
                  key={cat}
                  title={cat}
                  items={data.slice(0, 20)}
                  onSelect={handleSelectItem}
                  onSeeAll={() => handleSeeAll(cat)}
                  loading={!categoryData.has(cat)}
                />
              );
            })}
            
            {/* Categorias Adultas - só aparecem quando desbloqueado */}
            {isAdultUnlocked && ADULT_CATEGORIES.map(cat => {
              const catName = cat.name;
              const data = categoryData.get(catName) || [];
              if (!categoryData.has(catName)) {
                loadEnrichedCategory(catName).then(d => {
                  setCategoryData(prev => new Map(prev).set(catName, d));
                });
              }
              return (
                <CategoryCarousel
                  key={catName}
                  title={catName}
                  items={data.slice(0, 20)}
                  onSelect={handleSelectItem}
                  onSeeAll={() => handleSeeAll(catName)}
                  loading={!categoryData.has(catName)}
                />
              );
            })}
          </>
        )}
      </main>
      
      {/* Modais */}
      {modalState.type === 'movie' || modalState.type === 'series' ? (
        <MovieDetailsModal
          item={modalState.data as EnrichedMovie}
          onClose={handleCloseModal}
          onPlay={handlePlay}
          onActorClick={handleActorClick}
          onRecommendationClick={handleRecommendationClick}
        />
      ) : modalState.type === 'actor' ? (
        <ActorModal
          actor={modalState.data as EnrichedCastMember}
          onClose={handleCloseModal}
          onSelectItem={handleSelectItem}
        />
      ) : null}
    </div>
  );
}

export default MovieCatalogV2;
