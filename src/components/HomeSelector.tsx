import { useState, useEffect, useCallback, useRef } from 'react';
import { useDpad } from '../contexts/DpadContext';
import './HomeSelector.css';

interface HomeSelectorProps {
  onSelect: (mode: 'tv' | 'movies') => void;
}

export function HomeSelector({ onSelect }: HomeSelectorProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<'tv' | 'movies' | null>(null);
  const { focusFirst, isUsingDpad } = useDpad();
  
  const tvCardRef = useRef<HTMLButtonElement>(null);
  const moviesCardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Trigger entrada com animação
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-foca no primeiro card quando usando D-pad
  useEffect(() => {
    if (isLoaded && isUsingDpad) {
      setTimeout(() => focusFirst(), 200);
    }
  }, [isLoaded, isUsingDpad, focusFirst]);

  // Atualiza o estado visual quando focado via D-pad
  const handleTvFocus = useCallback(() => {
    setHoveredCard('tv');
  }, []);

  const handleMoviesFocus = useCallback(() => {
    setHoveredCard('movies');
  }, []);

  const handleBlur = useCallback(() => {
    if (!isUsingDpad) {
      setHoveredCard(null);
    }
  }, [isUsingDpad]);

  return (
    <div className={`home-selector ${isLoaded ? 'loaded' : ''}`}>
      {/* Background animado */}
      <div className="home-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="noise-overlay" />
      </div>

      {/* Logo/Brand */}
      <header className="home-header">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 48 48" fill="none">
              <path d="M8 12C8 9.79086 9.79086 8 12 8H36C38.2091 8 40 9.79086 40 12V32C40 34.2091 38.2091 36 36 36H12C9.79086 36 8 34.2091 8 32V12Z" fill="url(#paint0_linear)" />
              <path d="M18 18L32 24L18 30V18Z" fill="white" />
              <path d="M16 40H32" stroke="url(#paint1_linear)" strokeWidth="3" strokeLinecap="round" />
              <path d="M24 36V40" stroke="url(#paint2_linear)" strokeWidth="3" strokeLinecap="round" />
              <defs>
                <linearGradient id="paint0_linear" x1="8" y1="8" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#EC4899" />
                </linearGradient>
                <linearGradient id="paint1_linear" x1="16" y1="40" x2="32" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#EC4899" />
                </linearGradient>
                <linearGradient id="paint2_linear" x1="24" y1="36" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="brand-text">
            <h1>Saimo<span>TV</span></h1>
            <p>Entretenimento sem limites</p>
          </div>
        </div>
      </header>

      {/* Seletor de modo */}
      <main className="home-main">
        <h2 className="select-title">O que você quer assistir?</h2>
        
        <div className="mode-cards">
          {/* Card TV ao Vivo */}
          <button 
            ref={tvCardRef}
            className={`mode-card tv-card ${hoveredCard === 'tv' ? 'hovered' : ''}`}
            onClick={() => onSelect('tv')}
            onMouseEnter={() => setHoveredCard('tv')}
            onMouseLeave={() => setHoveredCard(null)}
            onFocus={handleTvFocus}
            onBlur={handleBlur}
            data-focusable="true"
            data-focus-key="tv-card"
          >
            <div className="card-bg">
              <div className="card-gradient" />
              <div className="card-pattern" />
            </div>
            
            <div className="card-content">
              <div className="card-icon">
                <svg viewBox="0 0 64 64" fill="none">
                  <rect x="4" y="8" width="56" height="36" rx="4" stroke="currentColor" strokeWidth="3" />
                  <path d="M24 44H40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <path d="M32 44V52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <path d="M20 52H44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  {/* Antenna */}
                  <path d="M24 8L32 0L40 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Signal waves */}
                  <path d="M48 16C48 16 52 18 52 26C52 34 48 36 48 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                  <path d="M52 12C52 12 58 16 58 26C58 36 52 40 52 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
                </svg>
              </div>
              
              <div className="card-info">
                <h3>TV ao Vivo</h3>
                <p>Canais de TV em tempo real</p>
                <ul className="card-features">
                  <li>📺 +150 canais</li>
                  <li>⚡ Streaming HD</li>
                  <li>📡 Programação EPG</li>
                </ul>
              </div>
              
              <div className="card-action">
                <span>Assistir agora</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            
            <div className="card-glow" />
          </button>

          {/* Divisor */}
          <div className="mode-divider">
            <span>ou</span>
          </div>

          {/* Card Filmes e Séries */}
          <button 
            ref={moviesCardRef}
            className={`mode-card movies-card ${hoveredCard === 'movies' ? 'hovered' : ''}`}
            onClick={() => onSelect('movies')}
            onMouseEnter={() => setHoveredCard('movies')}
            onMouseLeave={() => setHoveredCard(null)}
            onFocus={handleMoviesFocus}
            onBlur={handleBlur}
            data-focusable="true"
            data-focus-key="movies-card"
          >
            <div className="card-bg">
              <div className="card-gradient" />
              <div className="card-pattern" />
            </div>
            
            <div className="card-content">
              <div className="card-icon">
                <svg viewBox="0 0 64 64" fill="none">
                  {/* Film reel */}
                  <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="3" />
                  {/* Film holes left */}
                  <circle cx="16" cy="20" r="3" stroke="currentColor" strokeWidth="2" />
                  <circle cx="16" cy="32" r="3" stroke="currentColor" strokeWidth="2" />
                  <circle cx="16" cy="44" r="3" stroke="currentColor" strokeWidth="2" />
                  {/* Film holes right */}
                  <circle cx="48" cy="20" r="3" stroke="currentColor" strokeWidth="2" />
                  <circle cx="48" cy="32" r="3" stroke="currentColor" strokeWidth="2" />
                  <circle cx="48" cy="44" r="3" stroke="currentColor" strokeWidth="2" />
                  {/* Play button */}
                  <path d="M28 24L40 32L28 40V24Z" fill="currentColor" />
                  {/* Popcorn stars */}
                  <path d="M4 8L6 12L2 12L4 8Z" fill="currentColor" opacity="0.5" />
                  <path d="M60 8L62 12L58 12L60 8Z" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
              
              <div className="card-info">
                <h3>Filmes e Séries</h3>
                <p>Catálogo completo sob demanda</p>
                <ul className="card-features">
                  <li>🎬 +500.000 títulos</li>
                  <li>🌟 Lançamentos</li>
                  <li>📚 Todas as categorias</li>
                </ul>
              </div>
              
              <div className="card-action">
                <span>Explorar catálogo</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            
            <div className="card-glow" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <p>© 2024 SaimoTV • Streaming gratuito de qualidade</p>
        <div className="footer-links">
          <span>Feito com ❤️</span>
        </div>
      </footer>
    </div>
  );
}
