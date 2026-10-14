import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { HashRouter, BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { BarraTopo } from './components/BarraTopo';
import { AdultModeContext, useAdultMode } from './contexts/adultoContexto';
import { Inicio } from './telas/Inicio';
import { Eventos } from './telas/Eventos';
import { Radios } from './telas/Radios';
import { Favoritos } from './telas/Favoritos';
import { Busca } from './telas/Busca';
import { parar as pararRadio } from './services/radioPlayer';
import { Ajustes } from './telas/Ajustes';
import { locais as locaisPersonalizados, aoMudar as aoMudarPersonalizados } from './services/canaisPersonalizados';
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

/**
 * Celular: tela estreita, ou celular deitado. Deitado ele passa dos 768 px de
 * largura e caía no layout de computador (menu no alto, lista ao lado e o
 * vídeo espremido num canto); toque e pouca altura dizem que é celular.
 */
function ehCelular(): boolean {
  return window.innerWidth <= 768
    || (window.matchMedia('(pointer: coarse)').matches && window.innerHeight <= 500);
}

// Lazy loading dos componentes pesados
const VideoPlayer = lazy(() => import('./components/VideoPlayer').then(m => ({ default: m.VideoPlayer })));
const PainelDeCanais = lazy(() => import('./components/PainelDeCanais').then(m => ({ default: m.PainelDeCanais })));
const MoviePlayer = lazy(() => import('./components/MoviePlayer').then(m => ({ default: m.MoviePlayer })));
const ProgramGuide = lazy(() => import('./components/ProgramGuide').then(m => ({ default: m.ProgramGuide })));
const VodCatalog = lazy(() => import('./components/VodCatalog').then(m => ({ default: m.VodCatalog })));
const StreamTester = lazy(() => import('./components/StreamTester').then(m => ({ default: m.StreamTester })));
const AppDownload = lazy(() => import('./components/AppDownload').then(m => ({ default: m.AppDownload })));
const Novidades = lazy(() => import('./components/Novidades').then(m => ({ default: m.Novidades })));

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
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginBottom: '1rem', opacity: 0.7 }} aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M17 2l-5 5-5-5" />
      </svg>
      <div>Carregando...</div>
    </div>
  </div>
);

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}


// Componente de TV
function TVPage() {
  const { slug } = useParams<{slug?: string}>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdultUnlocked } = useAdultMode();
  // O ao vivo toma o som: a rádio para ao abrir esta tela.
  useEffect(() => { pararRadio(); }, []);
  const [favorites, setFavorites] = useLocalStorage<string[]>('tv-favorites', []);
  const [lastChannelId, setLastChannelId] = useLocalStorage<string | null>('tv-last-channel', null);
  // O canal escolhido guarda junto o link (/tv/:slug) em que foi escolhido:
  // abrir outro link passa a valer o canal dele, e escolher na lista vale até
  // o link mudar.
  const [escolha, setEscolha] = useState<{ canal: Channel; slug?: string } | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMobile, setIsMobile] = useState(ehCelular);
  const [deitado, setDeitado] = useState(() => ehCelular() && window.innerWidth > window.innerHeight);
  const [remoteChannels, setRemoteChannels] = useState<Channel[] | null>(() => cachedChannels());
  const [isMultiScreen, setIsMultiScreen] = useState(false);
  const [secondChannel, setSecondChannel] = useState<Channel | null>(null);
  const [activeSide, setActiveSide] = useState<'primary' | 'secondary'>('primary');
  // Canais já vêm abertos no lado ao entrar no Ao vivo
  const [isChannelsPanelOpen, setIsChannelsPanelOpen] = useState(() => window.innerWidth > 640 || !ehCelular());
  const [controlsVisible, setControlsVisible] = useState(true);
  const [personalizados, setPersonalizados] = useState<Channel[]>(locaisPersonalizados);

  // Ao navegar para /tv novamente, reabre os canais
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    if (window.innerWidth > 640 || !ehCelular()) {
      setIsChannelsPanelOpen(true);
    }
  }

  useEffect(() => aoMudarPersonalizados(() => setPersonalizados(locaisPersonalizados())), []);

  /*
   * A grade vem do mesmo repositório que o aplicativo lê, para que um link
   * corrigido lá valha aqui sem publicar o site de novo. A lista compilada fica
   * de piso: se a rede falhar na primeira visita, ainda há canais na tela.
   */
  const channels = useMemo(() => {
    const base = remoteChannels
      ? (isAdultUnlocked ? [...remoteChannels, ...adultChannels] : remoteChannels)
      : getAllChannels(isAdultUnlocked);
    return personalizados.length ? [...base, ...personalizados] : base;
  }, [remoteChannels, isAdultUnlocked, personalizados]);

  // Sem canal escolhido nesta visita, vale o último da visita anterior — assim
  // que a lista (que vem da rede) o trouxer. Derivado, e não copiado para o
  // estado num efeito: a lista chegando depois não troca um canal escolhido.
  const canalDoLink = useMemo(() => {
    if (!slug || channels.length === 0) return null;
    const slugLimpo = slug.replace(/-/g, '').toLowerCase();
    return channels.find((c) => c.id.replace(/-/g, '').toLowerCase() === slugLimpo)
      ?? channels.find((c) => c.name.replace(/[\s-]/g, '').toLowerCase() === slugLimpo)
      ?? null;
  }, [slug, channels]);
  const canalEscolhido = escolha && escolha.slug === slug ? escolha.canal : null;
  const selectedChannel = canalEscolhido
    ?? canalDoLink
    ?? escolha?.canal
    ?? (lastChannelId ? channels.find((ch) => ch.id === lastChannelId) ?? null : null);
  const setSelectedChannel = useCallback((canal: Channel | null) => {
    setEscolha(canal ? { canal, slug } : null);
  }, [slug]);

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
    const handleResize = () => {
      const celular = ehCelular();
      setIsMobile(celular);
      setDeitado(celular && window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);



  const handleSelectChannel = useCallback((channel: Channel) => {
    if (isMultiScreen && activeSide === 'secondary') {
      setSecondChannel(channel);
      showToast(`Tela 2: ${channel.name}`, 'info');
      return;
    }
    setSelectedChannel(channel);
    setSelectedMovie(null);
    setLastChannelId(channel.id);
    showToast(isMultiScreen ? `Tela 1: ${channel.name}` : `Assistindo: ${channel.name}`, 'info');
  }, [isMultiScreen, activeSide, setLastChannelId, showToast, setSelectedChannel]);

  const handleToggleMultiScreen = useCallback(() => {
    setIsMultiScreen((prev) => {
      const next = !prev;
      if (next) {
        setSecondChannel(null);
        setActiveSide('secondary');
        setIsChannelsPanelOpen(true);
        showToast('Multi-Tela ativada: Escolha o canal da Tela 2 na lista', 'info');
      } else {
        setSecondChannel(null);
        setActiveSide('primary');
        showToast('Multi-Tela desativada', 'info');
      }
      return next;
    });
  }, [showToast]);

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
  }, []);

  const handleNextChannel = useCallback(() => {
    const cur = (isMultiScreen && activeSide === 'secondary') ? secondChannel : selectedChannel;
    const currentIndex = channels.findIndex((ch) => ch.id === cur?.id);
    const nextIndex = (currentIndex + 1) % channels.length;
    handleSelectChannel(channels[nextIndex]);
  }, [selectedChannel, secondChannel, isMultiScreen, activeSide, handleSelectChannel, channels]);

  const handlePrevChannel = useCallback(() => {
    const cur = (isMultiScreen && activeSide === 'secondary') ? secondChannel : selectedChannel;
    const currentIndex = channels.findIndex((ch) => ch.id === cur?.id);
    const prevIndex = currentIndex <= 0 ? channels.length - 1 : currentIndex - 1;
    handleSelectChannel(channels[prevIndex]);
  }, [selectedChannel, secondChannel, isMultiScreen, activeSide, handleSelectChannel, channels]);

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
    onMultiScreen: handleToggleMultiScreen,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Um "g" ou "c" digitado na busca do guia (ou em qualquer campo) é texto, não atalho.
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'g' || e.key === 'G') {
        setIsGuideOpen((prev) => !prev);
      }
      if (e.key === 'c' || e.key === 'C') {
        setIsChannelsPanelOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isChannelsPanelOpen) {
        setIsChannelsPanelOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isChannelsPanelOpen]);

  return (
    <div className={`page-container tv-page ${isTheaterMode ? 'theater-mode' : ''} ${deitado ? 'deitado' : ''} ${deitado && (selectedMovie || selectedChannel) ? 'tocando' : ''}`}>
      {/* Header Global com auto-hide no Live TV (aparece apenas ao passar o mouse no topo da tela) */}
      {!isTheaterMode && <BarraTopo autoHide={true} />}

      <Suspense fallback={<LoadingFallback />}>
        {/* Celular: o vídeo fica no alto, e a lista de canais rola embaixo dele */}
        {isMobile && (
          <div className="mobile-content">
            {(selectedMovie || selectedChannel) && (
              <div className="mobile-player">
                {selectedMovie ? (
                  <MoviePlayer movie={selectedMovie} onBack={handleBackFromMovie} />
                ) : (
                  <VideoPlayer
                    channel={selectedChannel}
                    channelNumber={channels.findIndex((c) => c.id === selectedChannel?.id) + 1}
                    isTheaterMode={isTheaterMode}
                    onToggleTheater={handleToggleTheater}
                    onOpenGuide={() => setIsGuideOpen(true)}
                    isChannelsPanelOpen={isChannelsPanelOpen}
                    onToggleChannelsPanel={() => setIsChannelsPanelOpen((v) => !v)}
                    onNextChannel={handleNextChannel}
                    onPrevChannel={handlePrevChannel}
                    onControlsVisibilityChange={setControlsVisible}
                  />
                )}
              </div>
            )}
            <div className="mobile-canais">
              <PainelDeCanais
                channels={channels}
                activeChannelId={selectedChannel?.id || null}
                favorites={favorites}
                isOpen={true}
                onClose={() => {}}
                onSelectChannel={handleSelectChannel}
                onToggleFavorite={handleToggleFavorite}
                isMobileInline={true}
              />
            </div>

            {/* Gaveta flutuante de canais quando em tela cheia ou celular deitado */}
            {(isTheaterMode || deitado) && isChannelsPanelOpen && (
              <PainelDeCanais
                channels={channels}
                activeChannelId={selectedChannel?.id || null}
                favorites={favorites}
                isOpen={isChannelsPanelOpen}
                onClose={() => setIsChannelsPanelOpen(false)}
                onSelectChannel={(ch) => {
                  handleSelectChannel(ch);
                  setIsChannelsPanelOpen(false);
                }}
                onToggleFavorite={handleToggleFavorite}
              />
            )}
          </div>
        )}

        {/* Desktop: Stage 100% idêntico ao macOS SaimoPlayer (AoVivo.swift / ContentView.swift) */}
        {!isMobile && (
          <div className="stage-aovivo-mac">
            {selectedMovie ? (
              <MoviePlayer movie={selectedMovie} onBack={handleBackFromMovie} />
            ) : isMultiScreen ? (
              <div className="multitela-stage-mac">
                <div
                  className={`multitela-lado-mac ${activeSide === 'primary' ? 'ativo' : ''}`}
                  onClick={() => setActiveSide('primary')}
                >
                  <div className={`multitela-moldura-mac ${controlsVisible ? 'visivel' : ''}`}>
                    <div className="multitela-rotulo-mac">
                      <span className="multitela-som-icone">
                        {activeSide === 'primary' || !secondChannel ? '🔊' : '🔇'}
                      </span>
                      <span className="multitela-nome">{selectedChannel?.name || 'Tela 1'}</span>
                      {(activeSide === 'primary' || !secondChannel) && <span className="multitela-badge">Áudio ativo</span>}
                    </div>
                    <button
                      className="multitela-fechar"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMultiScreen(false);
                        setSecondChannel(null);
                        setActiveSide('primary');
                        showToast('Multi-Tela desativada', 'info');
                      }}
                      title="Fechar multi tela"
                    >
                      ✕
                    </button>
                  </div>
                  <VideoPlayer
                    channel={selectedChannel}
                    channelNumber={channels.findIndex((c) => c.id === selectedChannel?.id) + 1}
                    isTheaterMode={false}
                    onToggleTheater={handleToggleTheater}
                    onOpenGuide={() => setIsGuideOpen(true)}
                    isMultiScreen={true}
                    onToggleMultiScreen={handleToggleMultiScreen}
                    isSplitActive={activeSide === 'primary'}
                    onActivateSplit={() => setActiveSide('primary')}
                    onCloseSplit={() => {
                      setIsMultiScreen(false);
                      setSecondChannel(null);
                      setActiveSide('primary');
                      showToast('Multi-Tela desativada', 'info');
                    }}
                    forceMuted={isMultiScreen && Boolean(secondChannel) && activeSide !== 'primary'}
                    splitLabel="Tela 1"
                    isChannelsPanelOpen={isChannelsPanelOpen}
                    onToggleChannelsPanel={() => setIsChannelsPanelOpen((v) => !v)}
                    onNextChannel={handleNextChannel}
                    onPrevChannel={handlePrevChannel}
                    onControlsVisibilityChange={setControlsVisible}
                    hideFloatingCartao={true}
                  />
                </div>
                <div
                  className={`multitela-lado-mac ${activeSide === 'secondary' ? 'ativo' : ''} ${!secondChannel ? 'vazio' : ''}`}
                  onClick={() => {
                    setActiveSide('secondary');
                    if (!secondChannel) {
                      setIsChannelsPanelOpen(true);
                    }
                  }}
                >
                  <div className={`multitela-moldura-mac ${controlsVisible || !secondChannel ? 'visivel' : ''}`}>
                    <div className="multitela-rotulo-mac">
                      <span className="multitela-som-icone">
                        {secondChannel ? (activeSide === 'secondary' ? '🔊' : '🔇') : '📺'}
                      </span>
                      <span className="multitela-nome">{secondChannel ? secondChannel.name : 'Tela 2 (Escolha o canal)'}</span>
                      {secondChannel && activeSide === 'secondary' && <span className="multitela-badge">Áudio ativo</span>}
                      {!secondChannel && <span className="multitela-badge vazio">Aguardando canal</span>}
                    </div>
                    <button
                      className="multitela-fechar"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMultiScreen(false);
                        setSecondChannel(null);
                        setActiveSide('primary');
                        showToast('Multi-Tela desativada', 'info');
                      }}
                      title="Fechar multi tela"
                    >
                      ✕
                    </button>
                  </div>
                  {secondChannel ? (
                    <VideoPlayer
                      channel={secondChannel}
                      channelNumber={channels.findIndex((c) => c.id === secondChannel?.id) + 1}
                      isTheaterMode={false}
                      onToggleTheater={handleToggleTheater}
                      onOpenGuide={() => setIsGuideOpen(true)}
                      isMultiScreen={true}
                      onToggleMultiScreen={handleToggleMultiScreen}
                      isSplitActive={activeSide === 'secondary'}
                      onActivateSplit={() => setActiveSide('secondary')}
                      onCloseSplit={() => {
                        setIsMultiScreen(false);
                        setSecondChannel(null);
                        setActiveSide('primary');
                        showToast('Multi-Tela desativada', 'info');
                      }}
                      forceMuted={activeSide !== 'secondary'}
                      splitLabel="Tela 2"
                      isChannelsPanelOpen={isChannelsPanelOpen}
                      onToggleChannelsPanel={() => setIsChannelsPanelOpen((v) => !v)}
                      onNextChannel={handleNextChannel}
                      onPrevChannel={handlePrevChannel}
                      onControlsVisibilityChange={setControlsVisible}
                      hideFloatingCartao={true}
                    />
                  ) : (
                    <div
                      className="multitela-placeholder-escolha"
                      onClick={() => {
                        setActiveSide('secondary');
                        setIsChannelsPanelOpen(true);
                      }}
                    >
                      <div className="multitela-placeholder-conteudo">
                        <div className="multitela-placeholder-icone">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="15" rx="3" />
                            <line x1="12" y1="9" x2="12" y2="15" />
                            <line x1="9" y1="12" x2="15" y2="12" />
                          </svg>
                        </div>
                        <h3 className="multitela-placeholder-titulo">Escolha o canal da Tela 2</h3>
                        <p className="multitela-placeholder-desc">
                          Selecione qualquer canal na lista ao lado para assistir em multi tela simultânea.
                        </p>
                        <button
                          type="button"
                          className="multitela-btn-abrir-canais"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSide('secondary');
                            setIsChannelsPanelOpen(true);
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                          </svg>
                          <span>Abrir lista de canais</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <VideoPlayer
                channel={selectedChannel}
                channelNumber={channels.findIndex((c) => c.id === selectedChannel?.id) + 1}
                isTheaterMode={isTheaterMode}
                onToggleTheater={handleToggleTheater}
                onOpenGuide={() => setIsGuideOpen(true)}
                isMultiScreen={false}
                onToggleMultiScreen={handleToggleMultiScreen}
                isChannelsPanelOpen={isChannelsPanelOpen}
                onToggleChannelsPanel={() => setIsChannelsPanelOpen((v) => !v)}
                onNextChannel={handleNextChannel}
                onPrevChannel={handlePrevChannel}
                onControlsVisibilityChange={setControlsVisible}
              />
            )}

            {/* Painel de Canais Flutuante de Vidro como no macOS AoVivo.swift */}
            <PainelDeCanais
              channels={channels}
              activeChannelId={
                isMultiScreen && activeSide === 'secondary'
                  ? secondChannel?.id || null
                  : selectedChannel?.id || null
              }
              favorites={favorites}
              isOpen={isChannelsPanelOpen}
              onClose={() => setIsChannelsPanelOpen(false)}
              onSelectChannel={handleSelectChannel}
              onToggleFavorite={handleToggleFavorite}
              onOpenOtherScreen={(ch) => {
                if (!isMultiScreen) setIsMultiScreen(true);
                if (activeSide === 'secondary') {
                  setSelectedChannel(ch);
                  setLastChannelId(ch.id);
                  showToast(`Tela 1: ${ch.name}`, 'info');
                } else {
                  setSecondChannel(ch);
                  setActiveSide('secondary');
                  showToast(`Tela 2: ${ch.name}`, 'info');
                }
              }}
              isMultiScreen={isMultiScreen}
              activeSide={activeSide}
              onSelectSide={setActiveSide}
              hasSecondChannel={Boolean(secondChannel)}
            />
          </div>
        )}

        {/* Guia de Programação */}
        <ProgramGuide
          channels={channels}
          currentChannel={selectedChannel}
          onSelectChannel={handleSelectChannel}
          onClose={() => setIsGuideOpen(false)}
          isOpen={isGuideOpen}
        />
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
      {!selectedMovie && <BarraTopo />}
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
      <Route path="/" element={<Inicio />} />
      <Route path="/busca" element={<Busca />} />
      <Route path="/eventos" element={<Eventos />} />
      <Route path="/favoritos" element={<Favoritos />} />
      <Route path="/radios" element={<Radios />} />
      <Route path="/ajustes" element={<Ajustes />} />
      <Route path="/tv" element={<TVPage />} />
      <Route path="/tv/:slug" element={<TVPage />} />
            <Route path="/movies" element={<MoviesPage />} />
      <Route path="/app" element={
        <Suspense fallback={<LoadingFallback />}>
          <AppDownload />
        </Suspense>
      } />
      {/* O que cada rodada da atualização trouxe. Sem link em lugar nenhum. */}
      <Route path="/novidades" element={
        <Suspense fallback={<LoadingFallback />}>
          <Novidades />
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