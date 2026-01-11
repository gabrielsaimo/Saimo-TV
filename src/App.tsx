import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { VideoPlayer } from './components/VideoPlayer';
import { ProgramGuide } from './components/ProgramGuide';
import { Toast } from './components/Toast';
import { getAllChannels } from './data/channels';
import type { Channel } from './types/channel';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './App.css';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

type MobileTab = 'player' | 'channels';

function App() {
  const [favorites, setFavorites] = useLocalStorage<string[]>('tv-favorites', []);
  const [lastChannelId, setLastChannelId] = useLocalStorage<string | null>('tv-last-channel', null);
  const [adultModeUnlocked, setAdultModeUnlocked] = useLocalStorage<boolean>('tv-adult-mode', false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
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
    setLastChannelId(channel.id);
    setIsMobileMenuOpen(false);
    setMobileTab('player'); // Volta para o player ao selecionar canal
    showToast(`Assistindo: ${channel.name}`, 'info');
  }, [setLastChannelId, showToast]);

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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTheater: handleToggleTheater,
    onNextChannel: handleNextChannel,
    onPrevChannel: handlePrevChannel,
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
              channel={selectedChannel}
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
            channel={selectedChannel}
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
