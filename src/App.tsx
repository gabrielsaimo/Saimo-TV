import { useState, useCallback, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { Toast } from './components/Toast';
import { getAllChannels } from './data/channels';
import type { Channel } from './types/channel';
import type { Movie } from './types/movie';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { DpadNavigationProvider } from './contexts/DpadContext';
import './App.css';

// Lazy loading dos componentes pesados
const Sidebar = lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));
const VideoPlayer = lazy(() => import('./components/VideoPlayer').then(m => ({ default: m.VideoPlayer })));
const MoviePlayer = lazy(() => import('./components/MoviePlayer').then(m => ({ default: m.MoviePlayer })));
const ProgramGuide = lazy(() => import('./components/ProgramGuide').then(m => ({ default: m.ProgramGuide })));
const MovieCatalogV2 = lazy(() => import('./components/MovieCatalogV2').then(m => ({ default: m.MovieCatalogV2 })));
const HomeSelector = lazy(() => import('./components/HomeSelector').then(m => ({ default: m.HomeSelector })));
const StreamTester = lazy(() => import('./components/StreamTester').then(m => ({ default: m.StreamTester })));
const AppDownload = lazy(() => import('./components/AppDownload').then(m => ({ default: m.AppDownload })));

// Loading fallback
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    background: 'var(--bg-primary, #0a0a0a)',
    color: 'var(--text-primary, #fff)'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📺</div>
      <div>Carregando...</div>
    </div>
  </div>
);

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

type MobileTab = 'player' | 'channels';

// Contexto para estado adulto global
interface AdultModeContextType {
  isAdultUnlocked: boolean;
  unlockAdult: () => void;
  lockAdult: () => void;
}

const AdultModeContext = createContext<AdultModeContextType>({
  isAdultUnlocked: false,
  unlockAdult: () => {},
  lockAdult: () => {},
});

export const useAdultMode = () => useContext(AdultModeContext);

// Componente Home
function HomePage() {
  const navigate = useNavigate();
  
  const handleSelect = (mode: 'tv' | 'movies') => {
    navigate(`/${mode}`);
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeSelector onSelect={handleSelect} />
    </Suspense>
  );
}

// Componente de TV
function TVPage() {
  const navigate = useNavigate();
  const { isAdultUnlocked, unlockAdult, lockAdult } = useAdultMode();
  const [favorites, setFavorites] = useLocalStorage<string[]>('tv-favorites', []);
  const [lastChannelId, setLastChannelId] = useLocalStorage<string | null>('tv-last-channel', null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('player');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const channels = getAllChannels(isAdultUnlocked);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (lastChannelId) {
      const channel = channels.find((ch) => ch.id === lastChannelId);
      if (channel) setSelectedChannel(channel);
    }
  }, [lastChannelId]);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSelectChannel = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    setSelectedMovie(null);
    setLastChannelId(channel.id);
    setIsMobileMenuOpen(false);
    setMobileTab('player');
    showToast(`Assistindo: ${channel.name}`, 'info');
  }, [setLastChannelId, showToast]);

  const handleBackFromMovie = useCallback(() => {
    setSelectedMovie(null);
    navigate('/movies');
  }, [navigate]);

  const handleToggleFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      const isFav = prev.includes(channelId);
      const channel = channels.find((ch) => ch.id === channelId);
      if (isFav) {
        showToast(`${channel?.name} removido dos favoritos`, 'info');
        return prev.filter((id) => id !== channelId);
      } else {
        showToast(`${channel?.name} adicionado aos favoritos`, 'success');
        return [...prev, channelId];
      }
    });
  }, [setFavorites, showToast, channels]);

  const handleToggleTheater = useCallback(() => {
    setIsTheaterMode((prev) => !prev);
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const handleNextChannel = useCallback(() => {
    const currentIndex = channels.findIndex((ch) => ch.id === selectedChannel?.id);
    const nextIndex = (currentIndex + 1) % channels.length;
    handleSelectChannel(channels[nextIndex]);
  }, [selectedChannel, handleSelectChannel, channels]);

  const handlePrevChannel = useCallback(() => {
    const currentIndex = channels.findIndex((ch) => ch.id === selectedChannel?.id);
    const prevIndex = currentIndex <= 0 ? channels.length - 1 : currentIndex - 1;
    handleSelectChannel(channels[prevIndex]);
  }, [selectedChannel, handleSelectChannel, channels]);

  const handleChannelNumber = useCallback((channelNumber: number) => {
    const channel = channels.find((ch) => ch.channelNumber === channelNumber);
    if (channel) {
      handleSelectChannel(channel);
    } else {
      showToast(`Canal ${channelNumber} não encontrado`, 'error');
    }
  }, [channels, handleSelectChannel, showToast]);

  useKeyboardShortcuts({
    onTheater: handleToggleTheater,
    onNextChannel: handleNextChannel,
    onPrevChannel: handlePrevChannel,
    onChannelNumber: handleChannelNumber,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'g' || e.key === 'G') {
        setIsGuideOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`page-container tv-page ${isTheaterMode ? 'theater-mode' : ''}`}>
      {/* Header Global */}
      {!isTheaterMode && <AppHeader transparent isAdultUnlocked={isAdultUnlocked} onUnlockAdult={unlockAdult} onLockAdult={lockAdult} />}

      <Suspense fallback={<LoadingFallback />}>
        <div className="tv-layout">
          {/* Mobile Tab Navigation */}
          <nav className="mobile-tabs">
            <button
              className={`mobile-tab ${mobileTab === 'player' ? 'active' : ''}`}
              onClick={() => setMobileTab('player')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <span>Player</span>
            </button>
            <button
              className={`mobile-tab ${mobileTab === 'channels' ? 'active' : ''}`}
              onClick={() => setMobileTab('channels')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Canais</span>
              <span className="tab-badge">{channels.length}</span>
            </button>
          </nav>

          {/* Desktop Sidebar */}
          <div className={`sidebar-wrapper desktop-only ${isMobileMenuOpen ? 'open' : ''}`}>
            <Sidebar
              channels={channels}
              activeChannelId={selectedChannel?.id || null}
            favorites={favorites}
            onSelectChannel={handleSelectChannel}
            onToggleFavorite={handleToggleFavorite}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
          />
        </div>

        {isMobileMenuOpen && (
          <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* Mobile Content */}
        {isMobile && (
          <div className="mobile-content">
            <div className={`mobile-view ${mobileTab === 'player' ? 'active' : ''}`}>
              {selectedMovie ? (
                <MoviePlayer movie={selectedMovie} onBack={handleBackFromMovie} />
              ) : (
                <VideoPlayer
                  channel={selectedChannel}
                  isTheaterMode={isTheaterMode}
                  onToggleTheater={handleToggleTheater}
                  onOpenGuide={() => setIsGuideOpen(true)}
                />
              )}
            </div>
            <div className={`mobile-view ${mobileTab === 'channels' ? 'active' : ''}`}>
              <Sidebar
                channels={channels}
                activeChannelId={selectedChannel?.id || null}
                favorites={favorites}
                onSelectChannel={handleSelectChannel}
                onToggleFavorite={handleToggleFavorite}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                isMobileView={true}
              />
            </div>
          </div>
        )}

        {/* Desktop Main Content */}
        {!isMobile && (
          <main className="main-content">
            {selectedMovie ? (
              <MoviePlayer movie={selectedMovie} onBack={handleBackFromMovie} />
            ) : (
              <VideoPlayer
                channel={selectedChannel}
                isTheaterMode={isTheaterMode}
                onToggleTheater={handleToggleTheater}
                onOpenGuide={() => setIsGuideOpen(true)}
              />
            )}
          </main>
        )}

        {/* Guia de Programação */}
        <ProgramGuide
          channels={channels}
          currentChannel={selectedChannel}
          onSelectChannel={handleSelectChannel}
          onClose={() => setIsGuideOpen(false)}
          isOpen={isGuideOpen}
        />
        </div>
      </Suspense>

      {toast && (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

// Componente de Filmes
function MoviesPage() {
  const navigate = useNavigate();
  const { isAdultUnlocked, unlockAdult, lockAdult } = useAdultMode();
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSelectMovie = useCallback((movie: any, episodeUrl?: string) => {
    // Converte EnrichedMovie para Movie para o player
    const movieForPlayer: Movie = {
      id: movie.id,
      name: movie.tmdb?.title || movie.name,
      url: episodeUrl || movie.url || '',
      logo: movie.tmdb?.poster || undefined,
      category: movie.category,
      type: movie.type,
      rating: movie.tmdb?.rating
    };
    
    setSelectedMovie(movieForPlayer);
    showToast(`Assistindo: ${movieForPlayer.name}`, 'info');
  }, [showToast]);

  const handleBackFromMovie = useCallback(() => {
    setSelectedMovie(null);
  }, []);

  const handleBackFromCatalog = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <div className="page-container movies-page">
      {/* AppHeader só aparece quando está reproduzindo um filme */}
      {selectedMovie && (
        <AppHeader 
          isAdultUnlocked={isAdultUnlocked} 
          onUnlockAdult={unlockAdult}
          onLockAdult={lockAdult}
          showBackButton={true}
          onBack={handleBackFromMovie}
          title={selectedMovie?.name}
        />
      )}
      
      {/* Novo Catálogo V2 */}
      <Suspense fallback={<LoadingFallback />}>
        <div className={`catalog-container ${selectedMovie ? 'hidden-catalog' : ''}`}>
          <MovieCatalogV2
            onSelectMovie={handleSelectMovie}
            onBack={handleBackFromCatalog}
            isAdultUnlocked={isAdultUnlocked}
          />
        </div>
      </Suspense>

      {/* Player como overlay quando tem filme selecionado */}
      {selectedMovie && (
        <div className="movie-player-overlay">
          <Suspense fallback={<LoadingFallback />}>
            <div className="movie-player-container">
              <MoviePlayer 
                movie={selectedMovie} 
                onBack={handleBackFromMovie}
              />
            </div>
          </Suspense>
        </div>
      )}

      {toast && (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

// Layout principal que gerencia scroll
function AppLayout() {
  const location = useLocation();
  
  // Reset scroll on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/tv" element={<TVPage />} />
      <Route path="/movies" element={<MoviesPage />} />
      <Route path="/app" element={
        <Suspense fallback={<LoadingFallback />}>
          <AppDownload />
        </Suspense>
      } />
      <Route path="/teste" element={
        <Suspense fallback={<LoadingFallback />}>
          <StreamTester />
        </Suspense>
      } />
    </Routes>
  );
}

// Provedor de contexto adulto
function AdultModeProvider({ children }: { children: React.ReactNode }) {
  const [isAdultUnlocked, setIsAdultUnlocked] = useLocalStorage<boolean>('adult-mode-global', false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const unlockAdult = useCallback(() => {
    setIsAdultUnlocked(true);
    setToast({ message: '🔓 Modo adulto desbloqueado!', type: 'success', id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, [setIsAdultUnlocked]);

  const lockAdult = useCallback(() => {
    setIsAdultUnlocked(false);
    setToast({ message: '🔒 Modo adulto bloqueado', type: 'info', id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, [setIsAdultUnlocked]);

  return (
    <AdultModeContext.Provider value={{ isAdultUnlocked, unlockAdult, lockAdult }}>
      {children}
      {toast && (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdultModeContext.Provider>
  );
}

function App() {
  return (
    <HashRouter>
      <DpadNavigationProvider>
        <AdultModeProvider>
          <AppLayout />
        </AdultModeProvider>
      </DpadNavigationProvider>
    </HashRouter>
  );
}

export default App;