import { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react';
import type { Movie } from '../types/movie';
import { 
  initialMoviesData, 
  categoryIndex,
  loadCategory,
  type MovieWithAdult,
  type CategoryIndex
} from '../data/movies';
import type { SeriesEpisodeInfo } from './MoviePlayer';
import './MovieCatalog.css';

// Interface para informações de seleção de filme/episódio
export interface MovieSelection {
  movie: Movie;
  seriesInfo?: SeriesEpisodeInfo | null;
  seriesData?: GroupedSeries | null;
}

interface MovieCatalogProps {
  onSelectMovie: (selection: MovieSelection) => void;
  activeMovieId?: string | null;
  onBack: () => void;
  isAdultUnlocked?: boolean;
  // Para restaurar estado quando voltar do player
  initialSeriesModal?: GroupedSeries | null;
  onSeriesModalChange?: (series: GroupedSeries | null) => void;
}

// Interface para série agrupada - exportada
export interface GroupedSeries {
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

// ============================================================
// CATEGORIAS PRINCIPAIS - Streamings e Destaques (exibidos em cards)
// ============================================================
const FEATURED_CATEGORIES = [
  '🎬 Lançamentos',
  '📺 Netflix',
  '📺 Prime Video',
  '📺 Disney+',
  '📺 Max',
  '📺 Apple TV+',
  '📺 Paramount+',
  '📺 Globoplay',
  '📺 Star+',
  '📺 Crunchyroll',
  '📺 Discovery+',
  '🎬 4K UHD',
  '⭐ Sugestão da Semana',
];

// Logos/cores das plataformas de streaming com SVG icons REAIS
const PLATFORM_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  '📺 Netflix': { 
    color: '#E50914', 
    icon: <svg viewBox="0 0 111 30" fill="#E50914" width="36" height="24"><path d="M105.062 14.28L111 30c-1.75-.25-3.5-.42-5.25-.42-1.75 0-3.5.17-5.25.42l-3.25-9.17-3.25 9.17c-1.75-.25-3.5-.42-5.25-.42-1.75 0-3.5.17-5.25.42l5.94-15.72L83.75 0c1.75.25 3.5.42 5.25.42 1.75 0 3.5-.17 5.25-.42l3.25 8.86 3.25-8.86c1.75.25 3.5.42 5.25.42 1.75 0 3.5-.17 5.25-.42l-5.94 14.28zM90.28 0v.14c-.17 0-.33.01-.5.02V30h5.25V0h-4.75zM76.46 0c-1.75.25-3.5.42-5.25.42-1.75 0-3.5-.17-5.25-.42v17.17c0 2.5-.56 4.31-1.67 5.44-1.11 1.14-2.78 1.71-5 1.71-2.22 0-3.89-.57-5-1.71-1.11-1.14-1.67-2.94-1.67-5.44V0c-1.75.25-3.5.42-5.25.42-1.75 0-3.5-.17-5.25-.42v17.17c0 4.44 1.28 7.86 3.83 10.28 2.56 2.42 6.11 3.63 10.67 3.63 4.56 0 8.11-1.21 10.67-3.63 2.56-2.42 3.83-5.83 3.83-10.28V0h-.67zM26.32 0v17.03l-9.25-17.03c-1.75.25-3.5.42-5.25.42-1.75 0-3.5-.17-5.25-.42v30c1.75-.25 3.5-.42 5.25-.42 1.75 0 3.5.17 5.25.42V12.97l9.25 17.03c1.75-.25 3.5-.42 5.25-.42 1.75 0 3.5.17 5.25.42V0c-1.75.25-3.5.42-5.25.42-1.75 0-3.5-.17-5.25-.42z"/></svg>
  },
  '📺 Prime Video': { 
    color: '#00A8E1', 
    icon: <svg viewBox="0 0 24 24" fill="#00A8E1" width="32" height="32"><path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.503.14.086.14.065.276-.064.415-.141.127-.333.266-.575.416-1.454.91-3.074 1.61-4.86 2.098a18.64 18.64 0 0 1-5.357.73c-2.236 0-4.35-.355-6.343-1.063-1.993-.71-3.803-1.746-5.424-3.11-.09-.08-.135-.17-.135-.27s.03-.17.09-.237l-.108.602zm6.629-3.09V9.27c0-.44.1-.8.3-1.08.2-.28.53-.42.98-.42.46 0 .8.14 1.02.42.22.28.33.64.33 1.08v5.66c0 .44-.11.8-.33 1.08-.22.28-.56.42-1.02.42-.45 0-.78-.14-.98-.42-.2-.28-.3-.64-.3-1.08zm4.66 0V9.27c0-.44.1-.8.3-1.08.2-.28.53-.42.98-.42.46 0 .8.14 1.02.42.22.28.33.64.33 1.08v5.66c0 .44-.11.8-.33 1.08-.22.28-.56.42-1.02.42-.45 0-.78-.14-.98-.42-.2-.28-.3-.64-.3-1.08zm-5.96-7.07c-.7 0-1.32.13-1.86.39-.54.26-.96.62-1.26 1.08-.3.46-.45 1-.45 1.62 0 .58.13 1.08.39 1.5.26.42.64.75 1.14.99.5.24 1.1.36 1.8.36h.48c.16 0 .28.12.28.28v.72c0 .16-.12.28-.28.28h-.48c-1.24 0-2.22-.3-2.94-.9-.72-.6-1.08-1.46-1.08-2.58 0-.86.2-1.6.6-2.22.4-.62.96-1.1 1.68-1.44.72-.34 1.54-.51 2.46-.51.48 0 .94.04 1.38.12.44.08.82.2 1.14.36l-.36 1.26c-.54-.24-1.2-.36-1.98-.36h.02zm17.07 7.68c-.2-.26-.34-.12-.26.04.32.55 1.04 1.8.71 2.1-.33.3-1.86.22-2.5.11-.2-.04-.23.15-.05.27.59.43 1.92.89 2.58.76.67-.14 1.05-.64 1-1.34-.03-.42-.23-1.23-.48-1.94z"/></svg>
  },
  '📺 Disney+': { 
    color: '#113CCF', 
    icon: <svg viewBox="0 0 107.59 39.43" fill="#113CCF" width="36" height="24"><path d="M32.62,23.8h.19l2.87,8h-5.93Zm19.89,12.33h0a35,35,0,0,1-5.58.48c-4.5,0-7.24-1.92-7.24-6.49,0-4.14,2.53-6.59,7.24-6.59A32,32,0,0,1,52.51,24l-.2-3.74a43.5,43.5,0,0,0-5.47-.36c-7.52,0-12.83,4.13-12.83,10.77,0,6.24,4.69,10.08,11.59,10.08a50.43,50.43,0,0,0,7.12-.62Zm6.18-26.94c0,3,.65,4.18,3.53,4.18h3.24V9.63H64.22C54.49,9.63,50.25,14,50.25,23.8c0,.89,0,1.73.08,2.54h4.85c-.11-1-.18-2.07-.18-3.21,0-6.86,2.64-10,9.48-10h1.74V9.37H64.48c-3.77,0-5.65,1-5.79-3.57Zm37.56,2.42H93.49L87,27.71l-6-16.1H78.14V36h4V18l6.54,18H92l6.27-18V36h4ZM44.75,7.3V3H33.62l-5.87,16.81L21.88,3H10.75V7.3h8.17L8.81,36.13H14L21.5,16.65h.18L29.18,36.13h5.23L24.31,7.3Zm34.51-7.3L64.22,0l-.23,3.63h8.87V3.37l6.4.26Z"/><path d="M107.59,36.66a2.77,2.77,0,1,1-2.77-2.77,2.77,2.77,0,0,1,2.77,2.77Zm-4.82,0a2.06,2.06,0,1,0,2.05-2.21A2.08,2.08,0,0,0,102.77,36.66Zm1.64,1.43H103.6V35.32a4.86,4.86,0,0,1,.94-.08,1.54,1.54,0,0,1,.88.2.73.73,0,0,1,.25.58.66.66,0,0,1-.53.62v0c.25.08.39.31.47.69a2.16,2.16,0,0,0,.19.69h-.83a2.35,2.35,0,0,1-.21-.67c-.05-.3-.22-.44-.56-.44h-.27Zm0-1.54h.27c.34,0,.63-.11.63-.4s-.16-.41-.58-.41a1.54,1.54,0,0,0-.32,0Z"/></svg>
  },
  '📺 Max': { 
    color: '#002BE7', 
    icon: <svg viewBox="0 0 48 16" fill="#fff" width="42" height="20"><path d="M4 2h3.5l2.5 6.5L12.5 2H16v12h-3V7l-3 7H8l-3-7v7H2V2h2zm16 0h4l4 12h-3.5l-.7-2.5h-3.6l-.7 2.5H16l4-12zm1.2 7h2.6l-1.3-4.5-1.3 4.5zM28 2h3.5l2.5 3.5L36.5 2H40l-4.5 6 4.8 6h-3.8l-2.7-3.8L31 14h-3.5l4.8-6L28 2z"/></svg>
  },
  '📺 Apple TV+': { 
    color: '#000000', 
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
  },
  '📺 Paramount+': { 
    color: '#0064FF', 
    icon: <svg viewBox="0 0 24 24" fill="#0064FF" width="32" height="32"><path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 3L7.5 16h2.25l.75-2.25h3l.75 2.25h2.25L12 5zm0 3.75L13.5 13h-3l1.5-4.25z"/></svg>
  },
  '📺 Globoplay': { 
    color: '#FF5A00', 
    icon: <svg viewBox="0 0 24 24" fill="#FF5A00" width="32" height="32"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z"/><circle cx="12" cy="12" r="4"/></svg>
  },
  '📺 Star+': { 
    color: '#C724B1', 
    icon: <svg viewBox="0 0 24 24" fill="#C724B1" width="28" height="28"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  },
  '📺 Crunchyroll': { 
    color: '#F47521', 
    icon: <svg viewBox="0 0 24 24" fill="#F47521" width="28" height="28"><path d="M2.933 13.467a10.56 10.56 0 0 1-.6-3.467C2.333 4.477 6.81 0 12.333 0S22.333 4.477 22.333 10c0 3.38-1.68 6.37-4.25 8.18.93-1.37 1.47-3.02 1.47-4.8 0-4.693-3.807-8.5-8.5-8.5s-8.5 3.807-8.5 8.5c0 .036.002.072.002.107h.378zm5.6-3.6a4.133 4.133 0 1 0 4.134-4.134 4.133 4.133 0 0 0-4.134 4.134zm2.067 0a2.067 2.067 0 1 1 2.067 2.066 2.067 2.067 0 0 1-2.067-2.066z"/></svg>
  },
  '📺 Discovery+': { 
    color: '#003B6F', 
    icon: <svg viewBox="0 0 24 24" fill="#003B6F" width="28" height="28"><circle cx="12" cy="12" r="10"/><path fill="#fff" d="M9 8v8l7-4z"/></svg>
  },
  '🎬 Lançamentos': { 
    color: '#DC2626', 
    icon: <svg viewBox="0 0 24 24" fill="#DC2626" width="28" height="28"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zm-6.75 11.25L10 18l-1.25-2.75L6 14l2.75-1.25L10 10l1.25 2.75L14 14l-2.75 1.25zm5.69-3.31L16 14l-.94-2.06L13 11l2.06-.94L16 8l.94 2.06L19 11l-2.06.94z"/></svg>
  },
  '🎬 4K UHD': { 
    color: '#8B5CF6', 
    icon: <svg viewBox="0 0 24 24" fill="#8B5CF6" width="28" height="28"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm2-6h4c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1h-4V9zm1.5 4.5h2v-3h-2v3z"/></svg>
  },
  '⭐ Sugestão da Semana': { 
    color: '#F59E0B', 
    icon: <svg viewBox="0 0 24 24" fill="#F59E0B" width="28" height="28"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
  },
};

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
  onSelectEpisode: (episode: Movie, series: GroupedSeries) => void;
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
                  onClick={() => onSelectEpisode(episode, series)}
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
export function MovieCatalog({ 
  onSelectMovie, 
  isAdultUnlocked = false,
  initialSeriesModal = null,
  onSeriesModalChange
}: MovieCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<'all' | 'movies' | 'series'>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<GroupedSeries | null>(initialSeriesModal);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibleCategories, setVisibleCategories] = useState(CATEGORIES_PER_LOAD);
  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState(false);
  const [loadedCategoryData, setLoadedCategoryData] = useState<Map<string, MovieWithAdult[]>>(new Map());
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ series: GroupedSeries[]; standalone: Movie[] } | null>(null);
  const [categoryTypeInfo, setCategoryTypeInfo] = useState<Map<string, { hasMovies: boolean; hasSeries: boolean }>>(new Map());
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);

  // Atualiza o estado da série no componente pai quando muda
  useEffect(() => {
    if (onSeriesModalChange) {
      onSeriesModalChange(selectedSeries);
    }
  }, [selectedSeries, onSeriesModalChange]);

  // Restaura o modal da série quando voltar do player
  useEffect(() => {
    if (initialSeriesModal && !selectedSeries) {
      setSelectedSeries(initialSeriesModal);
    }
  }, [initialSeriesModal]);
  
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

  // Separar categorias principais (streamings) das outras
  const { featuredCategories, otherCategories } = useMemo(() => {
    const featured: CategoryIndex[] = [];
    const others: CategoryIndex[] = [];
    
    for (const cat of filteredCategoryIndex) {
      if (FEATURED_CATEGORIES.includes(cat.name)) {
        featured.push(cat);
      } else {
        others.push(cat);
      }
    }
    
    // Ordena as principais pela ordem definida em FEATURED_CATEGORIES
    featured.sort((a, b) => {
      const indexA = FEATURED_CATEGORIES.indexOf(a.name);
      const indexB = FEATURED_CATEGORIES.indexOf(b.name);
      return indexA - indexB;
    });
    
    return { featuredCategories: featured, otherCategories: others };
  }, [filteredCategoryIndex]);

  // Agrupa outras categorias por tipo para o modal
  const groupedOtherCategories = useMemo(() => {
    const groups: Record<string, CategoryIndex[]> = {
      'Gêneros': [],
      'Plataformas': [],
      'Especiais': [],
      'Outros': [],
    };
    
    for (const cat of otherCategories) {
      const name = cat.name.toLowerCase();
      
      // Plataformas de streaming restantes
      if (name.includes('📺') || name.includes('directv') || name.includes('funimation') || 
          name.includes('sbt') || name.includes('claro') || name.includes('univer') || 
          name.includes('brasil paralelo') || name.includes('play plus') || name.includes('pluto')) {
        groups['Plataformas'].push(cat);
      }
      // Gêneros de filmes
      else if (name.includes('🎬') && (
        name.includes('ação') || name.includes('comédia') || name.includes('drama') ||
        name.includes('terror') || name.includes('romance') || name.includes('suspense') ||
        name.includes('animação') || name.includes('aventura') || name.includes('fantasia') ||
        name.includes('ficção') || name.includes('crime') || name.includes('guerra') ||
        name.includes('documentário') || name.includes('família') || name.includes('faroeste')
      )) {
        groups['Gêneros'].push(cat);
      }
      // Coleções e especiais
      else if (name.includes('coleção') || name.includes('oscar') || name.includes('marvel') ||
               name.includes('nacionais') || name.includes('legendados') || name.includes('religiosos') ||
               name.includes('infantil') || name.includes('dublagem')) {
        groups['Especiais'].push(cat);
      }
      // Séries específicas (Novelas, Doramas, etc)
      else if (name.includes('novela') || name.includes('dorama') || name.includes('legendadas') ||
               name.includes('programas') || name.includes('shows') || name.includes('stand up')) {
        groups['Plataformas'].push(cat);
      }
      // Resto
      else {
        groups['Outros'].push(cat);
      }
    }
    
    // Remove grupos vazios
    return Object.fromEntries(
      Object.entries(groups).filter(([, cats]) => cats.length > 0)
    );
  }, [otherCategories]);

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
        
        // Também busca nos dados já carregados em memória
        loadedCategoryData.forEach((movies) => {
          const filtered = movies.filter(m => {
            const name = m.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return name.includes(query);
          });
          moviesToSearch.push(...filtered);
        });
        
        // Remove duplicatas por URL
        const seenUrls = new Set<string>();
        moviesToSearch = moviesToSearch.filter(m => {
          if (seenUrls.has(m.url)) return false;
          seenUrls.add(m.url);
          return true;
        });
        
        // Se não achou, carrega as 20 principais categorias (incluindo Netflix, Prime, etc)
        if (moviesToSearch.length < 20) {
          const categoriesToLoad = availableCategoryIndex.slice(0, 25);
          for (const cat of categoriesToLoad) {
            if (!loadedCategoryData.has(cat.name)) {
              try {
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
                
                // Adiciona sem duplicatas
                for (const m of filtered) {
                  if (!seenUrls.has(m.url)) {
                    seenUrls.add(m.url);
                    moviesToSearch.push(m);
                  }
                }
                
                // Se já encontrou resultados suficientes, para de carregar
                if (moviesToSearch.length >= 50) break;
              } catch (e) {
                // Ignora erros de carregamento de categoria
                console.log(`Erro ao carregar categoria ${cat.name}:`, e);
              }
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
    // Para filmes, não passa informações de série
    onSelectMovie({ movie, seriesInfo: null, seriesData: null });
  }, [onSelectMovie]);

  const handleSeriesSelect = useCallback((series: GroupedSeries) => {
    setSelectedSeries(series);
  }, []);

  const handleEpisodeSelect = useCallback((episode: Movie, series: GroupedSeries) => {
    // Mantém o modal da série aberto (não fecha mais)
    // setSelectedSeries(null); -- removido para manter estado
    
    // Calcula informações do episódio para o player
    const info = parseSeriesInfo(episode.name);
    const currentSeason = info?.season || 1;
    const currentEpisode = info?.episode || 1;
    
    // Pega todos os episódios da temporada atual, ordenados
    const seasonEpisodes = series.seasons.get(currentSeason) || [];
    const sortedEpisodes = [...seasonEpisodes].sort((a, b) => {
      const infoA = parseSeriesInfo(a.name);
      const infoB = parseSeriesInfo(b.name);
      return (infoA?.episode || 0) - (infoB?.episode || 0);
    });
    
    const seriesInfo: SeriesEpisodeInfo = {
      currentEpisode,
      currentSeason,
      totalEpisodes: sortedEpisodes.length,
      episodes: sortedEpisodes,
      seriesName: series.name
    };
    
    onSelectMovie({ movie: episode, seriesInfo, seriesData: series });
  }, [onSelectMovie]);

  useEffect(() => {
    setVisibleCategories(CATEGORIES_PER_LOAD);
  }, [selectedCategory, contentFilter, debouncedSearch]);

  // Detecta scroll para colapsar/expandir header
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const handleScroll = () => {
      const scrollTop = content.scrollTop;
      const delta = scrollTop - lastScrollTop.current;
      
      // Colapsa ao rolar para baixo mais de 50px
      if (delta > 10 && scrollTop > 100) {
        setIsHeaderCollapsed(true);
      }
      // Expande ao rolar para cima
      if (delta < -10 || scrollTop < 50) {
        setIsHeaderCollapsed(false);
      }
      
      lastScrollTop.current = scrollTop;
    };

    content.addEventListener('scroll', handleScroll, { passive: true });
    return () => content.removeEventListener('scroll', handleScroll);
  }, []);

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
      <header className={`catalog-header ${isSearchFocused || searchQuery ? 'search-active' : ''} ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-content">
          {/* Filtro de tipo - Compacto */}
          <nav className="content-nav">
            <button
              className={`nav-btn ${contentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setContentFilter('all')}
            >
              <span className="nav-label">Todos</span>
            </button>
            <button
              className={`nav-btn ${contentFilter === 'movies' ? 'active' : ''}`}
              onClick={() => setContentFilter('movies')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
              </svg>
              <span className="nav-label">Filmes</span>
            </button>
            <button
              className={`nav-btn ${contentFilter === 'series' ? 'active' : ''}`}
              onClick={() => setContentFilter('series')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.89 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
              </svg>
              <span className="nav-label">Séries</span>
            </button>
          </nav>

          {/* Dropdown de Categoria - Mobile */}
          <div className="category-dropdown-container">
            <button 
              className={`category-dropdown-btn ${selectedCategory ? 'has-selection' : ''}`}
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M4 6h16v2H4zm4 5h12v2H8zm6 5h6v2h-6z"/>
              </svg>
              <span>{selectedCategory || 'Categorias'}</span>
              <svg className={`dropdown-arrow ${showCategoryDropdown ? 'open' : ''}`} viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
            {showCategoryDropdown && (
              <div className="category-dropdown-menu">
                <button
                  className={`dropdown-item ${selectedCategory === null ? 'active' : ''}`}
                  onClick={() => { handleCategoryClick(null); setShowCategoryDropdown(false); }}
                >
                  Todas as Categorias
                </button>
                {filteredCategoryIndex.map(cat => (
                  <button
                    key={cat.name}
                    className={`dropdown-item ${selectedCategory === cat.name ? 'active' : ''}`}
                    onClick={() => { handleCategoryClick(cat.name); setShowCategoryDropdown(false); }}
                  >
                    {getCategoryType(cat.name) === 'movies' && '🎬 '}
                    {getCategoryType(cat.name) === 'series' && '📺 '}
                    {getCategoryType(cat.name) === 'mixed' && '🎭 '}
                    {cat.name}
                    <span className="dropdown-count">{cat.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Busca */}
          <div className={`search-container ${isSearchFocused || searchQuery ? 'expanded' : ''}`}>
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar..."
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

        {/* Categorias - Desktop (scroll horizontal) - Só aparece quando uma categoria está selecionada */}
        {selectedCategory && (
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
        )}
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
            
            {/* Cards de Categorias Principais (Streamings) */}
            <section className="featured-categories-section">
              <div className="section-header">
                <h2>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                  </svg>
                  Plataformas de Streaming
                </h2>
                <button 
                  className="see-all-categories-btn"
                  onClick={() => setShowAllCategoriesModal(true)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M4 6h16v2H4zm4 5h12v2H8zm6 5h6v2h-6z"/>
                  </svg>
                  Todas as Categorias ({filteredCategoryIndex.length})
                </button>
              </div>
              
              <div className="featured-categories-grid">
                {featuredCategories.map(cat => {
                  const style = PLATFORM_STYLES[cat.name] || { 
                    color: '#6B7280', 
                    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                  };
                  return (
                    <button
                      key={cat.name}
                      className="platform-card"
                      onClick={() => handleCategoryClick(cat.name)}
                      style={{ '--platform-color': style.color } as React.CSSProperties}
                    >
                      <div className="platform-icon">
                        {style.icon}
                      </div>
                      <div className="platform-info">
                        <span className="platform-name">{cat.name.replace(/^[📺🎬⭐]\s*/, '')}</span>
                        <span className="platform-count">{cat.count.toLocaleString('pt-BR')} títulos</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
            
            {/* Carrosséis de Conteúdo */}
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

      {/* Modal de Todas as Categorias */}
      {showAllCategoriesModal && (
        <div className="categories-modal-overlay" onClick={() => setShowAllCategoriesModal(false)}>
          <div className="categories-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M4 6h16v2H4zm4 5h12v2H8zm6 5h6v2h-6z"/>
                </svg>
                Todas as Categorias
              </h2>
              <button className="modal-close" onClick={() => setShowAllCategoriesModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              {/* Categorias Principais */}
              <div className="category-group">
                <h3>
                  <span className="group-icon">⭐</span>
                  Principais
                </h3>
                <div className="category-group-items">
                  {featuredCategories.map(cat => (
                    <button
                      key={cat.name}
                      className="category-item"
                      onClick={() => { handleCategoryClick(cat.name); setShowAllCategoriesModal(false); }}
                    >
                      <span className="category-name">{cat.name}</span>
                      <span className="category-count">{cat.count.toLocaleString('pt-BR')}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Outras Categorias Agrupadas */}
              {Object.entries(groupedOtherCategories).map(([groupName, cats]) => (
                <div key={groupName} className="category-group">
                  <h3>
                    <span className="group-icon">
                      {groupName === 'Gêneros' ? '🎭' : 
                       groupName === 'Plataformas' ? '📺' : 
                       groupName === 'Especiais' ? '✨' : '📁'}
                    </span>
                    {groupName}
                  </h3>
                  <div className="category-group-items">
                    {cats.map(cat => (
                      <button
                        key={cat.name}
                        className="category-item"
                        onClick={() => { handleCategoryClick(cat.name); setShowAllCategoriesModal(false); }}
                      >
                        <span className="category-name">{cat.name}</span>
                        <span className="category-count">{cat.count.toLocaleString('pt-BR')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
