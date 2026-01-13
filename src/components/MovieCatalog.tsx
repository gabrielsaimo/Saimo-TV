import { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react';
import type { Movie } from '../types/movie';
import { 
  initialMoviesData, 
  categoryIndex,
  loadCategory,
  type MovieWithAdult,
  type CategoryIndex
} from '../data/movies';
import './MovieCatalog.css';

interface MovieCatalogProps {
  onSelectMovie: (movie: Movie) => void;
  activeMovieId?: string | null;
  onBack: () => void;
  isAdultUnlocked?: boolean;
}

// Interface para série agrupada
interface GroupedSeries {
  id: string;
  name: string;
  logo?: string;
  category: string;
  type: 'series';
  seasons: Map<number, Movie[]>;
  episodeCount: number;
  seasonCount: number;
}

// Constantes de paginação otimizadas
const ITEMS_PER_PAGE = 20;
const CATEGORIES_PER_LOAD = 5;
const SEARCH_RESULTS_PER_PAGE = 30;

// Cache global para parsing de séries
const seriesCache = new Map<string, { baseName: string; season: number; episode: number } | null>();

// Padrões regex compilados uma única vez
const seriesPatterns = [
  /^(.+?)\s*S(\d+)\s*E(\d+)/i,
  /^(.+?)\s*T(\d+)\s*E(\d+)/i,
  /^(.+?)\s*(\d+)\s*x\s*(\d+)/i,
  /^(.+?)\s*(?:Temporada|Temp\.?)\s*(\d+)\s*(?:Episodio|Ep\.?|Episódio)\s*(\d+)/i,
  /^(.+?)\s*(?:Season|S)\.?(\d+)\.?\s*(?:Episode|E)\.?(\d+)/i,
];

function parseSeriesInfo(name: string): { baseName: string; season: number; episode: number } | null {
  if (seriesCache.has(name)) {
    return seriesCache.get(name)!;
  }
  
  for (const pattern of seriesPatterns) {
    const match = name.match(pattern);
    if (match) {
      const result = {
        baseName: match[1].trim().replace(/[-_.\s]+$/, '').trim(),
        season: parseInt(match[2]),
        episode: parseInt(match[3])
      };
      seriesCache.set(name, result);
      return result;
    }
  }
  seriesCache.set(name, null);
  return null;
}

// Agrupa episódios de séries - OTIMIZADO
function groupSeriesEpisodes(movies: Movie[]): { series: GroupedSeries[]; standalone: Movie[] } {
  const seriesMap = new Map<string, GroupedSeries>();
  const standalone: Movie[] = [];
  
  for (const movie of movies) {
    if (movie.type !== 'series') {
      standalone.push(movie);
      continue;
    }
    
    const info = parseSeriesInfo(movie.name);
    if (!info) {
      standalone.push(movie);
      continue;
    }
    
    const seriesKey = info.baseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    let series = seriesMap.get(seriesKey);
    if (!series) {
      series = {
        id: `series-${seriesKey}`,
        name: info.baseName,
        logo: movie.logo,
        category: movie.category,
        type: 'series',
        seasons: new Map(),
        episodeCount: 0,
        seasonCount: 0
      };
      seriesMap.set(seriesKey, series);
    }
    
    if (!series.seasons.has(info.season)) {
      series.seasons.set(info.season, []);
      series.seasonCount++;
    }
    
    series.seasons.get(info.season)!.push(movie);
    series.episodeCount++;
    
    if (!series.logo && movie.logo) {
      series.logo = movie.logo;
    }
  }
  
  return {
    series: Array.from(seriesMap.values()),
    standalone
  };
}

// =============== LAZY IMAGE COMPONENT ===============
const LazyImage = memo(function LazyImage({ 
  src, 
  alt, 
  fallbackText,
  className = ''
}: { 
  src?: string; 
  alt: string; 
  fallbackText: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackText)}&background=8b5cf6&color=fff&size=400&bold=true`;

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

  return (
    <div className={`lazy-image-container ${className}`} ref={imgRef as any}>
      {!loaded && !error && (
        <div className="image-placeholder">
          <div className="placeholder-shimmer" />
        </div>
      )}
      {isVisible && (
        <img 
          src={error ? fallbackUrl : (src || fallbackUrl)}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ opacity: loaded || error ? 1 : 0 }}
        />
      )}
    </div>
  );
});

// =============== MOVIE CARD - OTIMIZADO ===============
const MovieCard = memo(function MovieCard({
  movie,
  onSelect,
  isActive,
  size = 'normal'
}: {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  isActive?: boolean;
  size?: 'normal' | 'large';
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`movie-card ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''} ${size}`}
      onClick={() => onSelect(movie)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="movie-poster">
        <LazyImage 
          src={movie.logo} 
          alt={movie.name}
          fallbackText={movie.name.substring(0, 2)}
        />
        
        {isHovered && (
          <div className="movie-overlay">
            <div className="overlay-content">
              <button className="play-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
            <div className="overlay-gradient" />
          </div>
        )}
        
        <div className={`type-indicator ${movie.type === 'series' ? 'series-indicator' : 'movie-indicator'}`}>
          {movie.type === 'series' ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
            </svg>
          )}
        </div>
      </div>
      
      <div className="movie-info">
        <h4 className="movie-title">{movie.name}</h4>
        <p className="movie-subtitle">{movie.category}</p>
      </div>
    </div>
  );
});

// =============== SERIES CARD - OTIMIZADO ===============
const SeriesCard = memo(function SeriesCard({
  series,
  onSelect,
  isActive
}: {
  series: GroupedSeries;
  onSelect: (series: GroupedSeries) => void;
  isActive?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`movie-card ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
      onClick={() => onSelect(series)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="movie-poster">
        <LazyImage 
          src={series.logo} 
          alt={series.name}
          fallbackText={series.name.substring(0, 2)}
        />
        
        {isHovered && (
          <div className="movie-overlay">
            <div className="overlay-content">
              <button className="play-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
                </svg>
              </button>
              <div className="movie-meta">
                <span className="movie-type-badge series-badge">
                  {series.seasonCount} Temp{series.seasonCount > 1 ? 's' : ''}
                </span>
                <span className="movie-type-badge episodes-badge">
                  {series.episodeCount} Eps
                </span>
              </div>
            </div>
            <div className="overlay-gradient" />
          </div>
        )}
        
        <div className="type-indicator series-indicator">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
          </svg>
          <span className="season-badge">{series.seasonCount}T</span>
        </div>
      </div>
      
      <div className="movie-info">
        <h4 className="movie-title">{series.name}</h4>
        <p className="movie-subtitle">{series.category}</p>
      </div>
    </div>
  );
});

// =============== SERIES MODAL ===============
const SeriesModal = memo(function SeriesModal({
  series,
  onClose,
  onSelectEpisode
}: {
  series: GroupedSeries;
  onClose: () => void;
  onSelectEpisode: (episode: Movie) => void;
}) {
  const [selectedSeason, setSelectedSeason] = useState<number>(
    Math.min(...Array.from(series.seasons.keys()))
  );
  const [episodePage, setEpisodePage] = useState(1);
  const modalRef = useRef<HTMLDivElement>(null);
  const episodesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Reset page quando muda temporada
  useEffect(() => {
    setEpisodePage(1);
    episodesRef.current?.scrollTo({ top: 0 });
  }, [selectedSeason]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  const sortedSeasons = Array.from(series.seasons.keys()).sort((a, b) => a - b);
  const allEpisodes = series.seasons.get(selectedSeason) || [];
  const displayedEpisodes = allEpisodes.slice(0, episodePage * 20);
  const hasMoreEpisodes = displayedEpisodes.length < allEpisodes.length;

  // Infinite scroll dentro do modal
  const handleEpisodesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100 && hasMoreEpisodes) {
      setEpisodePage(p => p + 1);
    }
  }, [hasMoreEpisodes]);

  return (
    <div className="series-modal-backdrop" ref={modalRef} onClick={handleBackdropClick}>
      <div className="series-modal">
        <div className="modal-header">
          <div className="modal-poster">
            <LazyImage 
              src={series.logo} 
              alt={series.name}
              fallbackText={series.name.substring(0, 2)}
            />
          </div>
          <div className="modal-info">
            <h2>{series.name}</h2>
            <div className="modal-meta">
              <span className="meta-badge">{series.seasonCount} Temporada{series.seasonCount > 1 ? 's' : ''}</span>
              <span className="meta-badge">{series.episodeCount} Episódios</span>
              <span className="meta-category">{series.category}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="season-selector">
          <h3>Temporadas</h3>
          <div className="season-tabs">
            {sortedSeasons.map(season => (
              <button
                key={season}
                className={`season-tab ${selectedSeason === season ? 'active' : ''}`}
                onClick={() => setSelectedSeason(season)}
              >
                <span className="season-number">T{season}</span>
                <span className="episode-count">{series.seasons.get(season)?.length} eps</span>
              </button>
            ))}
          </div>
        </div>

        <div className="episodes-container" ref={episodesRef} onScroll={handleEpisodesScroll}>
          <h3>Temporada {selectedSeason} ({allEpisodes.length} episódios)</h3>
          <div className="episodes-grid">
            {displayedEpisodes.map((episode, index) => {
              const info = parseSeriesInfo(episode.name);
              return (
                <button
                  key={episode.id}
                  className="episode-card"
                  onClick={() => onSelectEpisode(episode)}
                >
                  <div className="episode-number">
                    <span>{info?.episode || index + 1}</span>
                  </div>
                  <div className="episode-info">
                    <span className="episode-title">Episódio {info?.episode || index + 1}</span>
                    <span className="episode-full-name">{episode.name}</span>
                  </div>
                  <div className="episode-play">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
          {hasMoreEpisodes && (
            <div className="episodes-load-more">
              <div className="loading-spinner" />
              <span>Carregando mais episódios...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// =============== HERO BANNER ===============
const HeroBanner = memo(function HeroBanner({
  movie,
  onSelect
}: {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}) {
  const fallbackUrl = `https://picsum.photos/1920/800?random=${movie.id}`;

  return (
    <div className="hero-banner" onClick={() => onSelect(movie)}>
      <div className="hero-backdrop">
        <LazyImage 
          src={movie.logo || fallbackUrl} 
          alt={movie.name}
          fallbackText={movie.name}
          className="hero-image"
        />
        <div className="hero-gradient" />
      </div>
      
      <div className="hero-content">
        <div className="hero-badge">
          {movie.type === 'series' ? '📺 Série em Destaque' : '🎬 Filme em Destaque'}
        </div>
        <h1 className="hero-title">{movie.name}</h1>
        <p className="hero-category">{movie.category}</p>
        
        <div className="hero-actions">
          <button className="hero-play-btn" onClick={(e) => { e.stopPropagation(); onSelect(movie); }}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Assistir
          </button>
        </div>
      </div>
    </div>
  );
});

// =============== LAZY CATEGORY ROW ASYNC - Carrega dados sob demanda ===============
const LazyCategoryRowAsync = memo(function LazyCategoryRowAsync({
  categoryInfo,
  onSelect,
  onSelectSeries,
  onSeeAll,
  isLarge = false,
  contentFilter = 'all'
}: {
  categoryInfo: CategoryIndex;
  onSelect: (movie: Movie) => void;
  onSelectSeries: (series: GroupedSeries) => void;
  onSeeAll: () => void;
  isLarge?: boolean;
  contentFilter?: 'all' | 'movies' | 'series';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [movies, setMovies] = useState<MovieWithAdult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [page, setPage] = useState(1);

  // Intersection Observer para lazy loading da categoria
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Carrega dados quando visível
  useEffect(() => {
    if (isVisible && movies.length === 0 && !isLoading) {
      setIsLoading(true);
      loadCategory(categoryInfo.name).then(data => {
        setMovies(data);
        setIsLoading(false);
      });
    }
  }, [isVisible, movies.length, isLoading, categoryInfo.name]);

  // Agrupa quando tiver dados - filtrando por tipo
  const groupedData = useMemo(() => {
    if (movies.length === 0) return { series: [], standalone: [] };
    
    // Filtra por tipo antes de agrupar
    let filteredMovies = movies;
    if (contentFilter === 'movies') {
      filteredMovies = movies.filter(m => m.type === 'movie');
    } else if (contentFilter === 'series') {
      filteredMovies = movies.filter(m => m.type === 'series');
    }
    
    return groupSeriesEpisodes(filteredMovies);
  }, [movies, contentFilter]);

  // Items paginados
  const displayItems = useMemo(() => {
    if (movies.length === 0) return [];
    
    const items: { type: 'movie' | 'series'; data: Movie | GroupedSeries }[] = [];
    
    // Se filtro é séries, só mostra séries agrupadas
    if (contentFilter !== 'movies') {
      groupedData.series.forEach(series => {
        items.push({ type: 'series', data: series });
      });
    }
    
    // Se filtro é filmes ou todos, mostra filmes standalone
    if (contentFilter !== 'series') {
      groupedData.standalone.forEach(movie => {
        items.push({ type: 'movie', data: movie });
      });
    }
    
    return items.slice(0, page * ITEMS_PER_PAGE);
  }, [groupedData, page, movies.length, contentFilter]);

  const totalItems = groupedData.series.length + groupedData.standalone.length;
  const hasMore = displayItems.length < totalItems;

  const checkScroll = useCallback(() => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = carouselRef.current.clientWidth * 0.8;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      
      if (direction === 'right' && hasMore) {
        setTimeout(() => {
          if (carouselRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
            if (scrollLeft > scrollWidth - clientWidth - 200) {
              setPage(p => p + 1);
            }
          }
        }, 400);
      }
    }
  };

  useEffect(() => {
    checkScroll();
    const el = carouselRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [checkScroll, displayItems.length]);

  return (
    <section className={`category-section ${isLarge ? 'large' : ''}`} ref={containerRef}>
      <div className="category-header">
        <h2>{categoryInfo.name}</h2>
        <div className="category-header-right">
          <span className="category-count">{categoryInfo.count.toLocaleString('pt-BR')} títulos</span>
          <button className="see-all-btn" onClick={onSeeAll}>
            Ver todos
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>
      
      {!isVisible || isLoading ? (
        <div className="carousel-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : (
        <div className="carousel-wrapper">
          {canScrollLeft && (
            <button className="carousel-nav prev" onClick={() => scroll('left')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          )}
          
          <div className="category-carousel" ref={carouselRef}>
            {displayItems.map(item => (
              item.type === 'series' ? (
                <SeriesCard
                  key={(item.data as GroupedSeries).id}
                  series={item.data as GroupedSeries}
                  onSelect={onSelectSeries}
                  isActive={false}
                />
              ) : (
                <MovieCard
                  key={(item.data as Movie).id}
                  movie={item.data as Movie}
                  onSelect={onSelect}
                  isActive={false}
                  size={isLarge ? 'large' : 'normal'}
                />
              )
            ))}
            {hasMore && (
              <button className="load-more-card" onClick={() => setPage(p => p + 1)}>
                <span>+{(totalItems - displayItems.length).toLocaleString('pt-BR')}</span>
                <small>Ver mais</small>
              </button>
            )}
          </div>
          
          {canScrollRight && (
            <button className="carousel-nav next" onClick={() => scroll('right')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          )}
        </div>
      )}
    </section>
  );
});

// =============== PAGINATED GRID ===============
const PaginatedGrid = memo(function PaginatedGrid({
  items,
  type,
  onSelectMovie,
  onSelectSeries,
  title
}: {
  items: Movie[] | GroupedSeries[];
  type: 'movies' | 'series';
  onSelectMovie: (movie: Movie) => void;
  onSelectSeries: (series: GroupedSeries) => void;
  title: string;
}) {
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const displayItems = items.slice(0, page * SEARCH_RESULTS_PER_PAGE);
  const hasMore = displayItems.length < items.length;

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          setIsLoading(true);
          setTimeout(() => {
            setPage(p => p + 1);
            setIsLoading(false);
          }, 100);
        }
      },
      { rootMargin: '200px' }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  if (items.length === 0) return null;

  return (
    <div className="results-section">
      <h3 className="results-section-title">
        {type === 'series' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
          </svg>
        )}
        {title} ({items.length.toLocaleString('pt-BR')})
      </h3>
      <div className="movies-grid">
        {displayItems.map(item => (
          type === 'series' ? (
            <SeriesCard
              key={(item as GroupedSeries).id}
              series={item as GroupedSeries}
              onSelect={onSelectSeries}
            />
          ) : (
            <MovieCard
              key={(item as Movie).id}
              movie={item as Movie}
              onSelect={onSelectMovie}
            />
          )
        ))}
      </div>
      
      {hasMore && (
        <div ref={loaderRef} className="load-more">
          <div className="loading-spinner" />
          <span>Carregando mais... ({displayItems.length.toLocaleString('pt-BR')}/{items.length.toLocaleString('pt-BR')})</span>
        </div>
      )}
    </div>
  );
});

// =============== COMPONENTE PRINCIPAL ===============
export function MovieCatalog({ onSelectMovie, isAdultUnlocked = false }: MovieCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<'all' | 'movies' | 'series'>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<GroupedSeries | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibleCategories, setVisibleCategories] = useState(CATEGORIES_PER_LOAD);
  const [loadedCategoryData, setLoadedCategoryData] = useState<Map<string, MovieWithAdult[]>>(new Map());
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ series: GroupedSeries[]; standalone: Movie[] } | null>(null);
  const [categoryTypeInfo, setCategoryTypeInfo] = useState<Map<string, { hasMovies: boolean; hasSeries: boolean }>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Categorias disponíveis filtradas por modo adulto
  const availableCategoryIndex = useMemo(() => {
    return isAdultUnlocked 
      ? categoryIndex 
      : categoryIndex.filter(c => !c.isAdult);
  }, [isAdultUnlocked]);

  // Categorias filtradas por tipo de conteúdo selecionado
  const filteredCategoryIndex = useMemo(() => {
    if (contentFilter === 'all') return availableCategoryIndex;
    
    return availableCategoryIndex.filter(cat => {
      const typeInfo = categoryTypeInfo.get(cat.name);
      if (!typeInfo) return true; // Mostra se ainda não carregou info
      
      if (contentFilter === 'movies') return typeInfo.hasMovies;
      if (contentFilter === 'series') return typeInfo.hasSeries;
      return true;
    });
  }, [availableCategoryIndex, contentFilter, categoryTypeInfo]);

  // Obter tipo predominante de uma categoria para colorir
  const getCategoryType = useCallback((catName: string): 'movies' | 'series' | 'mixed' | 'unknown' => {
    const typeInfo = categoryTypeInfo.get(catName);
    if (!typeInfo) return 'unknown';
    if (typeInfo.hasMovies && typeInfo.hasSeries) return 'mixed';
    if (typeInfo.hasMovies) return 'movies';
    if (typeInfo.hasSeries) return 'series';
    return 'unknown';
  }, [categoryTypeInfo]);

  // Dados iniciais filtrados
  const availableInitialMovies = useMemo(() => {
    if (isAdultUnlocked) return initialMoviesData;
    return initialMoviesData.filter(m => !m.isAdult);
  }, [isAdultUnlocked]);
  
  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Carrega categoria quando selecionada
  useEffect(() => {
    if (selectedCategory && !loadedCategoryData.has(selectedCategory)) {
      loadCategory(selectedCategory).then(movies => {
        setLoadedCategoryData(prev => {
          const newMap = new Map(prev);
          newMap.set(selectedCategory, movies);
          return newMap;
        });
        // Analisa tipos de conteúdo na categoria
        const hasMovies = movies.some(m => m.type === 'movie');
        const hasSeries = movies.some(m => m.type === 'series');
        setCategoryTypeInfo(prev => {
          const newMap = new Map(prev);
          newMap.set(selectedCategory, { hasMovies, hasSeries });
          return newMap;
        });
      });
    }
  }, [selectedCategory, loadedCategoryData]);

  // Pré-carrega informações de tipo para categorias visíveis
  useEffect(() => {
    const loadCategoryTypes = async () => {
      const categoriesToCheck = availableCategoryIndex.slice(0, Math.min(visibleCategories + 5, availableCategoryIndex.length));
      for (const cat of categoriesToCheck) {
        if (!categoryTypeInfo.has(cat.name)) {
          const movies = await loadCategory(cat.name);
          const hasMovies = movies.some(m => m.type === 'movie');
          const hasSeries = movies.some(m => m.type === 'series');
          setCategoryTypeInfo(prev => {
            const newMap = new Map(prev);
            newMap.set(cat.name, { hasMovies, hasSeries });
            return newMap;
          });
        }
      }
    };
    loadCategoryTypes();
  }, [availableCategoryIndex, visibleCategories, categoryTypeInfo]);

  // Busca quando há query
  useEffect(() => {
    if (!debouncedSearch.trim() && !selectedCategory) {
      setSearchResults(null);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      
      let moviesToSearch: MovieWithAdult[] = [];
      
      if (selectedCategory) {
        // Busca em categoria específica
        if (loadedCategoryData.has(selectedCategory)) {
          moviesToSearch = loadedCategoryData.get(selectedCategory) || [];
        } else {
          moviesToSearch = await loadCategory(selectedCategory);
          setLoadedCategoryData(prev => {
            const newMap = new Map(prev);
            newMap.set(selectedCategory, moviesToSearch);
            return newMap;
          });
        }
      } else if (debouncedSearch.trim()) {
        // Busca global - carrega categorias progressivamente
        const query = debouncedSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Primeiro busca nos dados iniciais
        moviesToSearch = availableInitialMovies.filter(m => {
          const name = m.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return name.includes(query);
        });
        
        // Se não achou muito, carrega mais categorias
        if (moviesToSearch.length < 50) {
          const categoriesToLoad = availableCategoryIndex.slice(0, 10);
          for (const cat of categoriesToLoad) {
            if (!loadedCategoryData.has(cat.name)) {
              const movies = await loadCategory(cat.name);
              setLoadedCategoryData(prev => {
                const newMap = new Map(prev);
                newMap.set(cat.name, movies);
                return newMap;
              });
              
              const filtered = movies.filter(m => {
                const name = m.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return name.includes(query);
              });
              moviesToSearch.push(...filtered);
            }
          }
        }
      }

      // Aplica filtro de tipo
      if (contentFilter === 'movies') {
        moviesToSearch = moviesToSearch.filter(m => m.type === 'movie');
      } else if (contentFilter === 'series') {
        moviesToSearch = moviesToSearch.filter(m => m.type === 'series');
      }

      // Aplica filtro de busca
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        moviesToSearch = moviesToSearch.filter(m => {
          const name = m.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const info = parseSeriesInfo(m.name);
          const baseName = info ? info.baseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
          return name.includes(query) || baseName.includes(query);
        });
      }

      const grouped = groupSeriesEpisodes(moviesToSearch);
      setSearchResults(grouped);
      setIsSearching(false);
    };

    performSearch();
  }, [debouncedSearch, selectedCategory, contentFilter, availableCategoryIndex, availableInitialMovies, loadedCategoryData]);

  // Filme em destaque
  const featuredContent = useMemo(() => {
    const featured = availableInitialMovies.filter(m => 
      m.category.toLowerCase().includes('lançamento') || 
      m.category.toLowerCase().includes('lancamento') ||
      m.category.toLowerCase().includes('cinema') ||
      m.category.toLowerCase().includes('netflix')
    ).slice(0, 10);
    return featured.length > 0 
      ? featured[Math.floor(Math.random() * featured.length)] 
      : availableInitialMovies[0];
  }, [availableInitialMovies]);

  // Load more categories on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !selectedCategory && !debouncedSearch.trim()) {
          setVisibleCategories(v => Math.min(v + CATEGORIES_PER_LOAD, filteredCategoryIndex.length));
        }
      },
      { rootMargin: '500px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [selectedCategory, debouncedSearch, filteredCategoryIndex.length]);

  const handleCategoryClick = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setVisibleCategories(CATEGORIES_PER_LOAD);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleMovieSelect = useCallback((movie: Movie) => {
    onSelectMovie(movie);
  }, [onSelectMovie]);

  const handleSeriesSelect = useCallback((series: GroupedSeries) => {
    setSelectedSeries(series);
  }, []);

  const handleEpisodeSelect = useCallback((episode: Movie) => {
    setSelectedSeries(null);
    onSelectMovie(episode);
  }, [onSelectMovie]);

  useEffect(() => {
    setVisibleCategories(CATEGORIES_PER_LOAD);
  }, [selectedCategory, contentFilter, debouncedSearch]);

  const isShowingResults = debouncedSearch.trim() || selectedCategory;

  // Contagens para stats usando o índice de categorias
  const totalStats = useMemo(() => {
    const filtered = isAdultUnlocked ? categoryIndex : categoryIndex.filter(c => !c.isAdult);
    const total = filtered.reduce((acc, cat) => acc + cat.count, 0);
    return { total, categories: filtered.length };
  }, [isAdultUnlocked]);

  return (
    <div className="movie-catalog premium">
      {/* Modal de Série */}
      {selectedSeries && (
        <SeriesModal
          series={selectedSeries}
          onClose={() => setSelectedSeries(null)}
          onSelectEpisode={handleEpisodeSelect}
        />
      )}

      {/* Header do Catálogo */}
      <header className={`catalog-header ${isSearchFocused || searchQuery ? 'search-active' : ''}`}>
        <div className="header-content">
          <nav className="content-nav">
            <button
              className={`nav-btn ${contentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setContentFilter('all')}
            >
              Todos
            </button>
            <button
              className={`nav-btn ${contentFilter === 'movies' ? 'active' : ''}`}
              onClick={() => setContentFilter('movies')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
              </svg>
              Filmes
            </button>
            <button
              className={`nav-btn ${contentFilter === 'series' ? 'active' : ''}`}
              onClick={() => setContentFilter('series')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
              </svg>
              Séries
            </button>
          </nav>

          <div className={`search-container ${isSearchFocused || searchQuery ? 'expanded' : ''}`}>
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar títulos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
              {searchQuery && (
                <button className="clear-btn" onClick={() => setSearchQuery('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Categorias */}
        <div className="categories-bar">
          <div className="categories-scroll">
            <button
              className={`category-chip ${selectedCategory === null ? 'active' : ''}`}
              onClick={() => handleCategoryClick(null)}
            >
              Todas
            </button>
            {filteredCategoryIndex.map(cat => {
              const catType = getCategoryType(cat.name);
              return (
                <button
                  key={cat.name}
                  className={`category-chip ${selectedCategory === cat.name ? 'active' : ''} type-${catType}`}
                  onClick={() => handleCategoryClick(cat.name)}
                  title={catType === 'movies' ? 'Categoria de Filmes' : catType === 'series' ? 'Categoria de Séries' : catType === 'mixed' ? 'Filmes e Séries' : ''}
                >
                  {catType === 'movies' && <span className="type-icon">🎬</span>}
                  {catType === 'series' && <span className="type-icon">📺</span>}
                  {catType === 'mixed' && <span className="type-icon">🎭</span>}
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="catalog-content" ref={contentRef}>
        {isSearching ? (
          <div className="loading-state">
            <div className="loading-spinner large" />
            <span>Buscando...</span>
          </div>
        ) : isShowingResults && searchResults ? (
          searchResults.series.length === 0 && searchResults.standalone.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>
              <h3>Nenhum resultado encontrado</h3>
              <p>Tente buscar por outro termo ou categoria</p>
              <button className="reset-btn" onClick={() => {
                setSearchQuery('');
                setSelectedCategory(null);
              }}>
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              <div className="results-header">
                <h2>
                  {selectedCategory ? selectedCategory : `Resultados para "${debouncedSearch}"`}
                </h2>
                <span className="results-count">
                  {(searchResults.series.length + searchResults.standalone.length).toLocaleString('pt-BR')} títulos
                </span>
              </div>
              
              {/* Séries Agrupadas - PAGINADO */}
              <PaginatedGrid
                items={searchResults.series}
                type="series"
                onSelectMovie={handleMovieSelect}
                onSelectSeries={handleSeriesSelect}
                title="Séries"
              />
              
              {/* Filmes - PAGINADO */}
              <PaginatedGrid
                items={searchResults.standalone}
                type="movies"
                onSelectMovie={handleMovieSelect}
                onSelectSeries={handleSeriesSelect}
                title="Filmes"
              />
            </>
          )
        ) : (
          <>
            {featuredContent && (
              <HeroBanner movie={featuredContent} onSelect={handleMovieSelect} />
            )}
            
            <div className="carousels-container">
              {filteredCategoryIndex.slice(0, visibleCategories).map((cat, index) => (
                <LazyCategoryRowAsync
                  key={cat.name}
                  categoryInfo={cat}
                  onSelect={handleMovieSelect}
                  onSelectSeries={handleSeriesSelect}
                  onSeeAll={() => handleCategoryClick(cat.name)}
                  isLarge={index === 0}
                  contentFilter={contentFilter}
                />
              ))}
              
              {/* Load more trigger */}
              {visibleCategories < filteredCategoryIndex.length && (
                <div ref={loadMoreRef} className="load-more-categories">
                  <div className="loading-spinner" />
                  <span>Carregando mais categorias... ({visibleCategories}/{filteredCategoryIndex.length})</span>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="catalog-footer">
        <div className="stats">
          <span>{totalStats.total.toLocaleString('pt-BR')} Títulos</span>
          <span className="separator">•</span>
          <span>{totalStats.categories} Categorias</span>
          {isAdultUnlocked && <span className="adult-indicator">+18</span>}
        </div>
      </footer>
    </div>
  );
}
