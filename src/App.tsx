import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { VideoPlayer } from './components/VideoPlayer';
import { ProgramGuide } from './components/ProgramGuide';
import { Toast } from './components/Toast';
import { channels } from './data/channels';
import type { Channel } from './types/channel';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './App.css';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

function App() {
  const [favorites, setFavorites] = useLocalStorage<string[]>('tv-favorites', []);
  const [lastChannelId, setLastChannelId] = useLocalStorage<string | null>('tv-last-channel', null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

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

  const handleSelectChannel = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    setLastChannelId(channel.id);
    setIsMobileMenuOpen(false);
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
      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isMobileMenuOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      <div className={`sidebar-wrapper ${isMobileMenuOpen ? 'open' : ''}`}>
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

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="main-content">
        <VideoPlayer
          channel={selectedChannel}
          isTheaterMode={isTheaterMode}
          onToggleTheater={handleToggleTheater}
          onOpenGuide={() => setIsGuideOpen(true)}
        />
      </main>

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
