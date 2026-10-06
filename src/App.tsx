import { useState, useCallback, useEffect, useMemo, createContext, useContext, lazy, Suspense } from 'react';
import { HashRouter, BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { Toast } from './components/Toast';
import { AtalhosAjuda } from './components/AtalhosAjuda';
import { NavegacaoMobile } from './components/NavegacaoMobile';
import { useVoltarFecha } from './hooks/useVoltarFecha';
import { getAllChannels, adultChannels } from './data/channels';
import { fetchChannels, cachedChannels } from './services/catalogService';
import { atualizar as atualizarFontesDesativadas, VALIDADE_MS as FONTES_MS } from './services/fontesDesativadas';
import { registerChannels, fetchRealEPG } from './services/epgService';
import type { Channel } from './types/channel';
import type { Movie, SeriesEpisodeInfo } from './types/movie';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { DpadNavigationProvider } from './contexts/DpadContext';
import './App.css';

// Lazy loading dos componentes pesados
const Sidebar = lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));
const VideoPlayer = lazy(() => import('./components/VideoPlayer').then(m => ({ default: m.VideoPlayer })));
const MoviePlayer = lazy(() => import('./components/MoviePlayer').then(m => ({ default: m.MoviePlayer })));
const ProgramGuide = lazy(() => import('./components/ProgramGuide').then(m => ({ default: m.ProgramGuide })));
const VodCatalog = lazy(() => import('./components/VodCatalog').then(m => ({ default: m.VodCatalog })));
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

const useAdultMode = () => useContext(AdultModeContext);

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
  const { slug } = useParams<{slug?: string}>();
  const navigate = useNavigate();
  const { isAdultUnlocked, unlockAdult, lockAdult } = useAdultMode();
  const [favorites, setFavorites] = useLocalStorage<string[]>('tv-favorites', []);
  const [lastChannelId, setLastChannelId] = useLocalStorage<string | null>('tv-last-channel', null);
  const [canalEscolhido, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [remoteChannels, setRemoteChannels] = useState<Channel[] | null>(() => cachedChannels());

  /*
   * A grade vem do mesmo repositório que o aplicativo lê, para que um link
   * corrigido lá valha aqui sem publicar o site de novo. A lista compilada fica
   * de piso: se a rede falhar na primeira visita, ainda há canais na tela.
   */
  const channels = useMemo(() => remoteChannels
    ? (isAdultUnlocked ? [...remoteChannels, ...adultChannels] : remoteChannels)
    : getAllChannels(isAdultUnlocked), [remoteChannels, isAdultUnlocked]);

  // Sem canal escolhido nesta visita, vale o último da visita anterior — assim
  // que a lista (que vem da rede) o trouxer. Derivado, e não copiado para o
  // estado num efeito: a lista chegando depois não troca um canal escolhido.
  const selectedChannel = canalEscolhido
    ?? (lastChannelId ? channels.find((ch) => ch.id === lastChannelId) ?? null : null);

  useEffect(() => {
    // O que veio da visita anterior já está na tela e fica nela; a lista
    // publicada é rebuscada sempre, por trás, e só troca a tela se chegar.
    // Esperar o cache envelhecer (seis horas) escondia canal recém-publicado
    // de quem tinha aberto o site no mesmo dia — foi assim com o ESPN 5.
    let vivo = true;
    // A lista de servidores desligados vem antes do catálogo: chegando depois,
    // a tela mostraria por um instante canais que já não abrem.
    atualizarFontesDesativadas()
      .catch(() => false)
      .then(() => fetchChannels())
      .then((lista) => { if (vivo && lista) setRemoteChannels(lista); })
      .catch((err) => console.error('Erro ao carregar catálogo remoto:', err));
    return () => { vivo = false; };
    // Uma vez por montagem: a lista não muda enquanto a pessoa assiste.
  }, []);

  /*
   * Um servidor desligado no painel tem que sumir da tela em minutos, que é o
   * tempo que alguém aguenta um canal quebrado — sem recarregar a página. A
   * lista é remontada do que já está em disco: nada é rebaixado da rede, só o
   * que está morto sai e o que foi religado volta.
   */
  useEffect(() => {
    const relogio = window.setInterval(() => {
      void atualizarFontesDesativadas().then((mudou) => {
        if (!mudou) return;
        const lista = cachedChannels();
        if (lista) setRemoteChannels(lista);
      });
    }, FONTES_MS);
    return () => window.clearInterval(relogio);
  }, []);

  /*
   * O guia procura a programação pelo nome do canal, então ele só pode começar
   * depois de a grade existir. Registrar e disparar aqui é o que garante que
   * um canal recém-chegado ao catálogo já entre com programação.
   */
  useEffect(() => {
    if (!channels.length) return;
    registerChannels(channels);
    // Só o catálogo publicado vale a montagem: a lista compilada é um piso
    // provisório, e montar o guia por ela gastaria dezoito megabytes com nomes
    // que a tela não vai mostrar.
    if (remoteChannels) void fetchRealEPG();
  }, [channels, remoteChannels]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);


  useEffect(() => {
    if (slug && channels.length > 0) {
      const slugLimpo = slug.replace(/-/g, '').toLowerCase();
      let channel = channels.find(c => c.id.replace(/-/g, '').toLowerCase() === slugLimpo);
      if (!channel) {
        channel = channels.find(c => c.name.replace(/[\s-]/g, '').toLowerCase() === slugLimpo);
      }
      if (channel && channel.id !== canalEscolhido?.id) {
        setSelectedChannel(channel);
        setLastChannelId(channel.id);
      }
    }
  }, [slug, channels, canalEscolhido, setLastChannelId]);

  const handleSelectChannel = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    setSelectedMovie(null);
    setLastChannelId(channel.id);
    setIsMobileMenuOpen(false);
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

        {/* Celular: o vídeo fica no alto, e a lista de canais rola embaixo
            dele — trocar de canal não esconde o que está passando. Sem nada
            passando (primeira visita), não há vídeo: o aviso "Selecione um
            canal" esticava o bloco a quase metade da tela e sobrava lugar
            para um canal só. A lista ocupa tudo até a pessoa escolher. */}
        {isMobile && (
          <div className="mobile-content">
            {(selectedMovie || selectedChannel) && (
              <div className="mobile-player">
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
            )}
            <div className="mobile-canais">
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
  const { isAdultUnlocked } = useAdultMode();
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<SeriesEpisodeInfo | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSelectMovie = useCallback((movie: Movie, info?: SeriesEpisodeInfo | null) => {
    setSelectedMovie(movie);
    setSeriesInfo(info ?? null);
    showToast(`Assistindo: ${movie.name}`, 'info');
  }, [showToast]);

  const handleEpisodeChange = useCallback((episode: Movie) => {
    setSelectedMovie(episode);
    setSeriesInfo((atual) => atual ? {
      ...atual,
      currentSeason: episode.seasonNumber ?? atual.currentSeason,
      currentEpisode: episode.episodeNumber ?? atual.currentEpisode,
    } : null);
  }, []);

  const handleBackFromMovie = useCallback(() => {
    setSelectedMovie(null);
    setSeriesInfo(null);
  }, []);
  // O voltar do celular fecha o player e volta à ficha.
  useVoltarFecha(!!selectedMovie, handleBackFromMovie);

  const handleBackFromCatalog = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <div className="page-container movies-page">
      {/* O player tem cabeçalho próprio, como nos apps de streaming: sem uma
          segunda barra global ocupando espaço e duplicando o botão de voltar. */}
      {/* Catálogo lido do repositório, o mesmo que o aplicativo usa */}
      <Suspense fallback={<LoadingFallback />}>
        <div className={`catalog-container ${selectedMovie ? 'hidden-catalog' : ''}`}>
          <VodCatalog
            onSelectMovie={handleSelectMovie}
            onBack={handleBackFromCatalog}
            isAdultUnlocked={isAdultUnlocked}
            playerOpen={!!selectedMovie}
            activeMovie={selectedMovie}
          />
        </div>
      </Suspense>

      {/* Player como overlay quando tem filme selecionado */}
      {selectedMovie && (
        <div className="movie-player-overlay">
          <Suspense fallback={<LoadingFallback />}>
            <div className="movie-player-container">
              <MoviePlayer 
                key={selectedMovie.id}
                movie={selectedMovie} 
                onBack={handleBackFromMovie}
                seriesInfo={seriesInfo}
                onEpisodeChange={handleEpisodeChange}
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
    <>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/tv" element={<TVPage />} />
      <Route path="/tv/:slug" element={<TVPage />} />
            <Route path="/movies" element={<MoviesPage />} />
      <Route path="/app" element={
        <Suspense fallback={<LoadingFallback />}>
          <AppDownload />
        </Suspense>
      } />
      {/* Ferramenta interna: só para quem ligou o modo de testes no navegador. */}
      {localStorage.getItem('saimo-dev') === '1' && (
        <Route path="/teste" element={
          <Suspense fallback={<LoadingFallback />}>
            <StreamTester />
          </Suspense>
        } />
      )}
    </Routes>
    <NavegacaoMobile />
    </>
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

/*
 * No site as páginas têm endereço limpo (/tv, /movies, /app), que dá para
 * mandar a alguém. No app de desktop (tauri://, sem raiz de site) continua o
 * endereço com #. Um link antigo com # que chega ao site é convertido.
 */
const noSite = import.meta.env.BASE_URL === '/';
if (noSite && window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1));
}
const Roteador = noSite ? BrowserRouter : HashRouter;

function App() {
  return (
    <Roteador>
      <DpadNavigationProvider>
        <AdultModeProvider>
          <AppLayout />
          <AtalhosAjuda />
        </AdultModeProvider>
      </DpadNavigationProvider>
    </Roteador>
  );
}

export default App;