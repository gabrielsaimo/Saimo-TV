import { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react';
import type { Movie } from '../types/movie';
import { moviesData, movieCategories } from '../data/movies';
import './MovieCatalog.css';

interface MovieCatalogProps {
  onSelectMovie: (movie: Movie) => void;
  activeMovieId?: string | null;
  onBack: () => void;
}

// Componente de Card otimizado com lazy loading de imagem
const MovieCard = memo(function MovieCard({ 
  movie, 
  onSelect, 
  isActive 
}: { 
  movie: Movie; 
  onSelect: (movie: Movie) => void; 
  isActive?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(movie.name.substring(0, 2))}&background=6366f1&color=fff&size=200&bold=true`;

  return (
    <div 
      className={`movie-card ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(movie)}
    >
      <div className="movie-poster">
        {!imageLoaded && !imageError && (
          <div className="movie-placeholder loading">
            <div className="placeholder-shimmer" />
          </div>
        )}
        <img 
          src={imageError ? fallbackUrl : (movie.logo || fallbackUrl)}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={handleImageError}
          style={{ opacity: imageLoaded || imageError ? 1 : 0 }}
        />
        <div className="movie-overlay">
          <div className="play-icon">▶</div>
        </div>
        <span className="movie-type">{movie.type === 'series' ? '📺' : '🎬'}</span>
      </div>
      <p className="movie-title">{movie.name}</p>
    </div>
  );
});

// Componente de Carrossel otimizado - renderiza apenas itens visíveis
const CategoryCarousel = memo(function CategoryCarousel({
  category,
  movies,
  onSelect,
  activeMovieId,
  onSeeAll
}: {
  category: string;
  movies: Movie[];
  onSelect: (movie: Movie) => void;
  activeMovieId?: string | null;
  onSeeAll: () => void;
}) {
  // Limita a 15 itens por carrossel para performance
  const displayMovies = movies.slice(0, 15);

  return (
    <section className="category-section">
      <div className="category-header">
        <h2>{category}</h2>
        <span className="category-count">{movies.length}</span>
        <button className="see-all-btn" onClick={onSeeAll}>Ver todos →</button>
      </div>
      <div className="category-carousel">
        {displayMovies.map(movie => (
          <MovieCard
            key={movie.id}
            movie={movie}
            onSelect={onSelect}
            isActive={activeMovieId === movie.id}
          />
        ))}
      </div>
    </section>
  );
});

export function MovieCatalog({ onSelectMovie, activeMovieId, onBack }: MovieCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<'all' | 'movies' | 'series'>('all');
  const [visibleCount, setVisibleCount] = useState(50); // Para grid view
  const contentRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Filtra os filmes - usando useMemo com deps mínimas
  const filteredMovies = useMemo(() => {
    let result = moviesData;

    if (contentFilter === 'movies') {
      result = result.filter(m => m.type === 'movie');
    } else if (contentFilter === 'series') {
      result = result.filter(m => m.type === 'series');
    }

    if (selectedCategory) {
      result = result.filter(m => m.category === selectedCategory);
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      result = result.filter(m => {
        const name = m.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name.includes(query);
      });
    }

    return result;
  }, [contentFilter, selectedCategory, debouncedSearch]);

  // Agrupa por categoria apenas quando necessário
  const moviesByCategory = useMemo(() => {
    if (selectedCategory || debouncedSearch.trim()) return null;
    
    const grouped = new Map<string, Movie[]>();
    
    filteredMovies.forEach(movie => {
      if (!grouped.has(movie.category)) {
        grouped.set(movie.category, []);
      }
      grouped.get(movie.category)!.push(movie);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => {
        if (a.includes('Lançamento')) return -1;
        if (b.includes('Lançamento')) return 1;
        return a.localeCompare(b, 'pt-BR');
      })
      .slice(0, 20); // Limita a 20 categorias visíveis
  }, [filteredMovies, selectedCategory, debouncedSearch]);

  const handleCategoryClick = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setVisibleCount(50);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleMovieSelect = useCallback((movie: Movie) => {
    onSelectMovie(movie);
  }, [onSelectMovie]);

  // Infinite scroll para grid view
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 500) {
      setVisibleCount(prev => Math.min(prev + 30, filteredMovies.length));
    }
  }, [filteredMovies.length]);

  // Reset visível quando muda categoria
  useEffect(() => {
    setVisibleCount(50);
  }, [selectedCategory, contentFilter, debouncedSearch]);

  return (
    <div className="movie-catalog">
      {/* Header compacto */}
      <header className="catalog-header">
        <div className="header-top">
          <button className="back-btn" onClick={onBack}>← Voltar</button>
          <h1>🎬 Catálogo</h1>
          <span className="movie-count">{filteredMovies.length}</span>
        </div>

        <div className="catalog-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          <div className="filter-buttons">
            <button
              className={`filter-btn ${contentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setContentFilter('all')}
            >
              Todos
            </button>
            <button
              className={`filter-btn ${contentFilter === 'movies' ? 'active' : ''}`}
              onClick={() => setContentFilter('movies')}
            >
              Filmes
            </button>
            <button
              className={`filter-btn ${contentFilter === 'series' ? 'active' : ''}`}
              onClick={() => setContentFilter('series')}
            >
              Séries
            </button>
          </div>
        </div>

        {/* Tags de categorias - scrollável horizontal */}
        <div className="category-tags">
          <button
            className={`category-tag ${selectedCategory === null ? 'active' : ''}`}
            onClick={() => handleCategoryClick(null)}
          >
            Todas
          </button>
          {movieCategories.slice(0, 30).map(cat => (
            <button
              key={cat}
              className={`category-tag ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => handleCategoryClick(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Conteúdo */}
      <main className="catalog-content" ref={contentRef} onScroll={handleScroll}>
        {filteredMovies.length === 0 ? (
          <div className="no-results">
            <p>Nenhum resultado encontrado</p>
          </div>
        ) : selectedCategory || debouncedSearch.trim() ? (
          // Grid view com infinite scroll
          <div className="movies-grid">
            {filteredMovies.slice(0, visibleCount).map(movie => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onSelect={handleMovieSelect}
                isActive={activeMovieId === movie.id}
              />
            ))}
            {visibleCount < filteredMovies.length && (
              <div className="load-more">Carregando mais...</div>
            )}
          </div>
        ) : (
          // Carrossel por categoria
          moviesByCategory?.map(([category, categoryMovies]) => (
            <CategoryCarousel
              key={category}
              category={category}
              movies={categoryMovies}
              onSelect={handleMovieSelect}
              activeMovieId={activeMovieId}
              onSeeAll={() => handleCategoryClick(category)}
            />
          ))
        )}
      </main>
    </div>
  );
}
