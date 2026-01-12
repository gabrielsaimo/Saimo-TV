import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { VideoPlayer } from './components/VideoPlayer';
import { ProgramGuide } from './components/ProgramGuide';
import { MovieCatalog } from './components/MovieCatalog';
import { Toast } from './components/Toast';
import { getAllChannels } from './data/channels';
import type { Channel } from './types/channel';
import type { Movie } from './types/movie';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './App.css';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

type MobileTab = 'player' | 'channels';
type AppView = 'tv' | 'movies';

function App() {
  const [favorites, setFavorites] = useLocalStorage<string[]>('tv-favorites', []);
  const [lastChannelId, setLastChannelId] = useLocalStorage<string | null>('tv-last-channel', null);
  const [adultModeUnlocked, setAdultModeUnlocked] = useLocalStorage<boolean>('tv-adult-mode', false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('tv');
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('player');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Lista de canais baseada no modo adulto
  const channels = getAllChannels(adultModeUnlocked);

  // Detectar se é mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load last channel on mount
  useEffect(() => {
    if (lastChannelId) {
      const channel = channels.find((ch) => ch.id === lastChannelId);
      if (channel) {
        setSelectedChannel(channel);
      }
    }
  }, [lastChannelId]);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Handler para desbloquear modo adulto
  const handleUnlockAdultMode = useCallback(() => {
    setAdultModeUnlocked(true);
    showToast('🔓 Modo secreto desbloqueado!', 'success');
  }, [setAdultModeUnlocked, showToast]);

  // Handler para bloquear modo adulto
  const handleLockAdultMode = useCallback(() => {
    setAdultModeUnlocked(false);
    showToast('🔒 Canais adultos ocultados', 'info');
  }, [setAdultModeUnlocked, showToast]);

  const handleSelectChannel = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    setSelectedMovie(null); // Limpa filme ao selecionar canal
    setLastChannelId(channel.id);
    setIsMobileMenuOpen(false);
    setMobileTab('player'); // Volta para o player ao selecionar canal
    showToast(`Assistindo: ${channel.name}`, 'info');
  }, [setLastChannelId, showToast]);

  // Handler para selecionar filme/série
  const handleSelectMovie = useCallback((movie: Movie) => {
    setSelectedMovie(movie);
    setSelectedChannel(null); // Limpa canal ao selecionar filme
    setCurrentView('tv'); // Volta para a view de TV (player)
    showToast(`Assistindo: ${movie.name}`, 'info');
  }, [showToast]);

  // Handler para voltar do catálogo de filmes
  const handleBackFromMovies = useCallback(() => {
    setCurrentView('tv');
  }, []);

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
  }, [setFavorites, showToast]);

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
  }, [selectedChannel, handleSelectChannel]);

  const handlePrevChannel = useCallback(() => {
    const currentIndex = channels.findIndex((ch) => ch.id === selectedChannel?.id);
    const prevIndex = currentIndex <= 0 ? channels.length - 1 : currentIndex - 1;
    handleSelectChannel(channels[prevIndex]);
  }, [selectedChannel, handleSelectChannel]);

  // Handler para trocar de canal por número
  const handleChannelNumber = useCallback((channelNumber: number) => {
    const channel = channels.find((ch) => ch.channelNumber === channelNumber);
    if (channel) {
      handleSelectChannel(channel);
    } else {
      showToast(`Canal ${channelNumber} não encontrado`, 'error');
    }
  }, [channels, handleSelectChannel, showToast]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTheater: handleToggleTheater,
    onNextChannel: handleNextChannel,
    onPrevChannel: handlePrevChannel,
    onChannelNumber: handleChannelNumber,
  });

  // Atalho G para abrir guia
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
    <div className={`app ${isTheaterMode ? 'theater-mode' : ''}`}>
      {/* Navigation Bar Principal */}
      <nav className="main-nav">
        <button
          className={`nav-item ${currentView === 'tv' ? 'active' : ''}`}
          onClick={() => setCurrentView('tv')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <span>TV ao Vivo</span>
        </button>
        <button
          className={`nav-item ${currentView === 'movies' ? 'active' : ''}`}
          onClick={() => setCurrentView('movies')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Filmes e Séries</span>
        </button>
      </nav>

      {/* View de Filmes/Séries */}
      {currentView === 'movies' && (
        <div className="movies-view">
          <MovieCatalog
            onSelectMovie={handleSelectMovie}
            activeMovieId={selectedMovie?.id}
            onBack={handleBackFromMovies}
          />
        </div>
      )}

      {/* View de TV */}
      {currentView === 'tv' && (
        <div className="tv-view">
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
              onUnlockAdultMode={handleUnlockAdultMode}
              onLockAdultMode={handleLockAdultMode}
              isAdultModeUnlocked={adultModeUnlocked}
            />
          </div>

          {/* Mobile overlay */}
          {isMobileMenuOpen && (
            <div
              className="mobile-overlay"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Mobile Content - Só renderiza no mobile */}
          {isMobile && (
            <div className="mobile-content">
              <div className={`mobile-view ${mobileTab === 'player' ? 'active' : ''}`}>
                <VideoPlayer
                  channel={selectedMovie ? { 
                    id: selectedMovie.id, 
                    name: selectedMovie.name, 
                    url: selectedMovie.url, 
                    logo: selectedMovie.logo,
                    category: selectedMovie.category 
                  } : selectedChannel}
                  isTheaterMode={isTheaterMode}
                  onToggleTheater={handleToggleTheater}
                  onOpenGuide={() => setIsGuideOpen(true)}
                />
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
                  onUnlockAdultMode={handleUnlockAdultMode}
                  onLockAdultMode={handleLockAdultMode}
                  isAdultModeUnlocked={adultModeUnlocked}
                />
              </div>
            </div>
          )}

          {/* Desktop Main Content - Só renderiza no desktop */}
          {!isMobile && (
            <main className="main-content">
              <VideoPlayer
                channel={selectedMovie ? { 
                  id: selectedMovie.id, 
                  name: selectedMovie.name, 
                  url: selectedMovie.url, 
                  logo: selectedMovie.logo,
                  category: selectedMovie.category 
                } : selectedChannel}
                isTheaterMode={isTheaterMode}
                onToggleTheater={handleToggleTheater}
                onOpenGuide={() => setIsGuideOpen(true)}
              />
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
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
