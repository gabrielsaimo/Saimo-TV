import { useRef, useEffect, useState, useCallback, memo } from 'react';
import Hls from 'hls.js';
import type { Channel } from '../types/channel';
import { ProgramInfo } from './ProgramInfo';
import castService, { type CastMethod, type CastState } from '../services/castService';
import './VideoPlayer.css';

interface VideoPlayerProps {
  channel: Channel | null;
  isTheaterMode: boolean;
  onToggleTheater: () => void;
  onOpenGuide: () => void;
}

export const VideoPlayer = memo(function VideoPlayer({
  channel,
  isTheaterMode,
  onToggleTheater,
  onOpenGuide,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const intentionalPauseRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [pendingUnmute, setPendingUnmute] = useState(false); // Aguardando primeira interação para desmutar
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('tv-volume');
    return saved ? parseFloat(saved) : 1;
  });
  
  // Refs para manter valores atuais acessíveis nos callbacks
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const pendingUnmuteRef = useRef(false);
  
  // Atualiza refs quando states mudam
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  
  useEffect(() => {
    pendingUnmuteRef.current = pendingUnmute;
  }, [pendingUnmute]);
  
  const [isMirrored, setIsMirrored] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [castState, setCastState] = useState<CastState>({ isConnected: false, deviceName: null, method: null });
  const [showCastModal, setShowCastModal] = useState(false);
  const [castMessage, setCastMessage] = useState<string | null>(null);
  const [showExternalPlayers, setShowExternalPlayers] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [videoResolution, setVideoResolution] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  const maxRecoveryAttempts = 3;

  // Initialize HLS
  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);
    intentionalPauseRef.current = false; // Reset pausa intencional ao trocar de canal
    recoveryAttemptsRef.current = 0; // Reset tentativas de recuperação ao trocar de canal

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(channel.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        recoveryAttemptsRef.current = 0; // Reset tentativas quando manifest carregou com sucesso
        video.volume = volumeRef.current;
        video.muted = false;
        
        // Tenta primeiro com som
        video.play().catch(() => {
          // Se falhar, inicia mutado e agenda desmutar na primeira interação
          video.muted = true;
          setIsMuted(true);
          setPendingUnmute(true);
          video.play().catch(() => {});
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          recoveryAttemptsRef.current++;
          
          // Se excedeu tentativas de recuperação, mostra erro
          if (recoveryAttemptsRef.current > maxRecoveryAttempts) {
            setError('Erro ao carregar o canal. Tente novamente.');
            setIsLoading(false);
            return;
          }
          
          // Tenta recuperar primeiro, só mostra erro se falhar múltiplas vezes
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Tenta recuperar erro de rede
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            // Tenta recuperar erro de mídia
            hls.recoverMediaError();
          } else {
            // Erro irrecuperável
            setError('Erro ao carregar o canal. Tente novamente.');
            setIsLoading(false);
          }
        }
      });

      // Listener para detectar quando recuperou com sucesso após erro
      hls.on(Hls.Events.FRAG_LOADED, () => {
        // Se fragmento carregou, limpa qualquer erro anterior e reseta tentativas
        setError(null);
        recoveryAttemptsRef.current = 0;
      });

      hls.on(Hls.Events.LEVEL_LOADED, () => {
        // Se nível carregou, limpa qualquer erro anterior e reseta tentativas
        setError(null);
        recoveryAttemptsRef.current = 0;
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      video.src = channel.url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.volume = volumeRef.current;
        video.muted = false;
        
        // Tenta primeiro com som
        video.play().catch(() => {
          // Se falhar, inicia mutado e agenda desmutar na primeira interação
          video.muted = true;
          setIsMuted(true);
          setPendingUnmute(true);
          video.play().catch(() => {});
        });
      });
    } else {
      setError('Seu navegador não suporta reprodução de vídeo HLS.');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  // Volume sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
    localStorage.setItem('tv-volume', volume.toString());
  }, [volume, isMuted]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setError(null); // Limpa erro quando o vídeo começa a reproduzir
      intentionalPauseRef.current = false;
    };
    const handlePause = () => {
      setIsPlaying(false);
      // Auto-resume: se o vídeo pausar e NÃO foi pausa intencional do usuário
      if (!intentionalPauseRef.current && channel && video.readyState >= 2) {
        video.play().catch(() => {
          // Se falhar, tenta mutado
          video.muted = true;
          setIsMuted(true);
          setPendingUnmute(true);
          video.play().catch(() => {});
        });
      }
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null); // Limpa erro quando o vídeo está pronto para reproduzir
      // Quando o vídeo estiver pronto para reproduzir, garante que está em play
      if (video.paused && channel && !intentionalPauseRef.current) {
        video.play().catch(() => {
          // Se falhar, tenta mutado
          video.muted = true;
          setIsMuted(true);
          setPendingUnmute(true);
          video.play().catch(() => {});
        });
      }
    };
    
    // Evento quando o vídeo está reproduzindo dados (frames)
    const handlePlaying = () => {
      setIsLoading(false);
      setError(null); // Limpa erro - vídeo está definitivamente funcionando
      recoveryAttemptsRef.current = 0;
    };
    
    // Evento timeupdate indica que o vídeo está progredindo
    // Usamos um throttle simples para evitar muitas chamadas
    let lastTimeUpdate = 0;
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdate < 1000) return; // Throttle a cada 1 segundo
      lastTimeUpdate = now;
      
      // Se o vídeo está avançando, não há erro real
      setError((currentError) => currentError ? null : currentError);
      recoveryAttemptsRef.current = 0;
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [channel]);

  // Auto-unmute na primeira interação do usuário (quando autoplay precisou de mute)
  useEffect(() => {
    if (!pendingUnmute) return;
    
    const handleUserInteraction = () => {
      const video = videoRef.current;
      if (video && pendingUnmuteRef.current) {
        video.muted = false;
        setIsMuted(false);
        setPendingUnmute(false);
      }
    };
    
    // Escuta qualquer interação do usuário
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [pendingUnmute]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // PiP change listener
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePiPEnter = () => setIsPiP(true);
    const handlePiPLeave = () => setIsPiP(false);

    video.addEventListener('enterpictureinpicture', handlePiPEnter);
    video.addEventListener('leavepictureinpicture', handlePiPLeave);

    return () => {
      video.removeEventListener('enterpictureinpicture', handlePiPEnter);
      video.removeEventListener('leavepictureinpicture', handlePiPLeave);
    };
  }, []);

  // Video resolution detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateResolution = () => {
      if (video.videoWidth && video.videoHeight) {
        const height = video.videoHeight;
        let label = '';
        if (height >= 2160) label = '4K';
        else if (height >= 1440) label = '2K';
        else if (height >= 1080) label = '1080p';
        else if (height >= 720) label = '720p';
        else if (height >= 480) label = '480p';
        else if (height >= 360) label = '360p';
        else label = `${height}p`;
        setVideoResolution(label);
      } else {
        setVideoResolution(null);
      }
    };

    // Update on loadedmetadata and resize events
    video.addEventListener('loadedmetadata', updateResolution);
    video.addEventListener('resize', updateResolution);
    
    // Also update periodically in case resolution changes during stream
    const interval = setInterval(updateResolution, 2000);
    
    // Initial check
    updateResolution();

    return () => {
      video.removeEventListener('loadedmetadata', updateResolution);
      video.removeEventListener('resize', updateResolution);
      clearInterval(interval);
    };
  }, [channel]);

  // Cast state listener - escuta mudanças do serviço de cast
  useEffect(() => {
    const unsubscribe = castService.onStateChange((state) => {
      setCastState(state);
    });

    // Carrega estado inicial
    setCastState(castService.getState());

    return unsubscribe;
  }, []);

  // Control handlers - declarados antes do useEffect que os usa
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      intentionalPauseRef.current = false;
      video.play();
    } else {
      intentionalPauseRef.current = true;
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    // Se o usuário manualmente mutar/desmutar, cancela o pendingUnmute
    setPendingUnmute(false);
    setIsMuted((prev) => !prev);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  }, []);

  const toggleCast = useCallback(async () => {
    // Se já está transmitindo, oferece parar
    if (castState.isConnected) {
      castService.stopCasting();
      setCastMessage('Transmissão encerrada');
      setTimeout(() => setCastMessage(null), 3000);
      return;
    }

    // Sempre mostra o modal com todas as opções
    setShowCastModal(true);
  }, [castState.isConnected]);

  const handleCastOption = useCallback(async (method: CastMethod) => {
    if (!channel) return;

    if (method === 'openExternal') {
      setShowExternalPlayers(true);
      return;
    }

    const result = await castService.cast(
      method,
      channel.url,
      channel.name,
      videoRef.current || undefined,
      channel.logo
    );

    setCastMessage(result.message);
    setTimeout(() => setCastMessage(null), 4000);
    
    if (result.success || method === 'copyLink' || method === 'share') {
      setShowCastModal(false);
    }
  }, [channel]);

  const handleExternalPlayer = useCallback((playerUrl: string) => {
    castService.openInExternalPlayer(playerUrl);
    setCastMessage('Abrindo player externo...');
    setTimeout(() => setCastMessage(null), 3000);
    setShowExternalPlayers(false);
    setShowCastModal(false);
  }, []);

  const toggleMirror = useCallback(() => {
    setIsMirrored((prev) => !prev);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
  }, []);

  const retryLoad = useCallback(() => {
    if (hlsRef.current && channel) {
      setError(null);
      setIsLoading(true);
      hlsRef.current.loadSource(channel.url);
    }
  }, [channel]);

  // Mantém ref atualizada para usar no timeout
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Auto-hide controls - 5 seconds timeout
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlayingRef.current) {
        setShowControls(false);
      }
    }, 5000); // 5 segundos
  }, []);

  // Keyboard controls for showing controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Mostrar controles em qualquer tecla de navegação
      const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Escape'];
      if (navigationKeys.includes(e.key) || e.key.length === 1) {
        resetControlsTimeout();
      }

      // Ações específicas de teclas
      switch (e.key) {
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'c':
          e.preventDefault();
          toggleCast();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.1));
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
      }
    };

    // Global keyboard listener
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [resetControlsTimeout, togglePlay, toggleFullscreen, toggleMute, toggleCast]);

  // Show controls on initial load
  useEffect(() => {
    if (channel) {
      resetControlsTimeout();
    }
  }, [channel, resetControlsTimeout]);

  // Listener para mostrar controles quando D-pad navegar para o player
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDpadEnter = () => {
      // Mostra controles quando D-pad entrar no player
      resetControlsTimeout();
    };

    container.addEventListener('dpad-enter', handleDpadEnter);
    return () => container.removeEventListener('dpad-enter', handleDpadEnter);
  }, [resetControlsTimeout]);

  // Handle video click - apenas toggle controles (não pausa mais)
  const handleVideoClick = useCallback(() => {
    if (showControls) {
      // Se controles estão visíveis, esconde
      setShowControls(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      // Se controles estão escondidos, mostra e reinicia timeout
      resetControlsTimeout();
    }
  }, [showControls, resetControlsTimeout]);

  // Handle double click for fullscreen
  const handleVideoDoubleClick = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`video-player-container ${isTheaterMode ? 'theater' : ''} ${showControls ? 'show-controls' : ''}`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {!channel ? (
        <div className="no-channel">
          <div className="no-channel-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M10 9l5 3-5 3V9z" />
            </svg>
            <h2>Selecione um canal</h2>
            <p>Escolha um canal na lista ao lado para começar a assistir</p>
          </div>
        </div>
      ) : (
        <>
          {/* Informações do programa atual */}
          <ProgramInfo 
            channel={channel} 
            isVisible={showControls}
            onOpenGuide={onOpenGuide}
          />

          <video
            ref={videoRef}
            className={`video-element ${isMirrored ? 'mirrored' : ''}`}
            playsInline
            onClick={handleVideoClick}
            onDoubleClick={handleVideoDoubleClick}
          />

          {/* Botão central de play/pause focável via D-pad */}
          {showControls && !isLoading && !error && (
            <button
              className="center-play-btn"
              onClick={() => { resetControlsTimeout(); togglePlay(); }}
              data-focusable="true"
              data-focus-key="btn-play-center"
              aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          )}

          {isLoading && (
            <div className="loading-overlay">
              <div className="loader">
                <div className="loader-ring"></div>
                <div className="loader-ring"></div>
                <div className="loader-ring"></div>
              </div>
              <p>Carregando {channel.name}...</p>
            </div>
          )}

          {error && (
            <div className="error-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p>{error}</p>
              <button onClick={retryLoad} className="retry-btn">
                Tentar novamente
              </button>
            </div>
          )}

          <div className="video-controls" onMouseMove={resetControlsTimeout}>
            <div className="controls-left">
              <div className="volume-control">
                <button 
                  className="control-btn" 
                  onClick={() => { resetControlsTimeout(); toggleMute(); }} 
                  title={isMuted ? 'Ativar som (M)' : 'Mudo (M)'}
                  data-focusable="true"
                  data-focus-key="btn-mute"
                >
                  {isMuted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => { resetControlsTimeout(); handleVolumeChange(e); }}
                  className="volume-slider"
                  title={`Volume: ${Math.round(volume * 100)}%`}
                  data-focusable="true"
                  data-focus-key="volume-slider"
                />
              </div>

              <div className="channel-indicator">
                <span className="live-badge">AO VIVO</span>
                <div className="channel-info">
                  <span className="channel-name">{channel.name}</span>
                  {videoResolution && (
                    <span className="video-resolution">{videoResolution}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="controls-right">
              <button
                className={`control-btn ${isMirrored ? 'active' : ''}`}
                onClick={() => { resetControlsTimeout(); toggleMirror(); }}
                title="Espelhar vídeo (R)"
                data-focusable="true"
                data-focus-key="btn-mirror"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 3v18" />
                  <path d="M8 12l4-4 4 4M8 12l4 4 4-4" />
                </svg>
              </button>

              <button
                className={`control-btn ${isPiP ? 'active' : ''}`}
                onClick={() => { resetControlsTimeout(); togglePiP(); }}
                title="Picture in Picture (P)"
                data-focusable="true"
                data-focus-key="btn-pip"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <rect x="11" y="9" width="9" height="6" rx="1" />
                </svg>
              </button>

              <button
                className={`control-btn cast-btn ${castState.isConnected ? 'active casting' : ''}`}
                onClick={() => { resetControlsTimeout(); toggleCast(); }}
                title={castState.isConnected ? `Transmitindo para ${castState.deviceName}` : 'Transmitir (C)'}
                data-focusable="true"
                data-focus-key="btn-cast"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                  <circle cx="2" cy="20" r="2" fill="currentColor" />
                </svg>
              </button>

              <button
                className={`control-btn ${isTheaterMode ? 'active' : ''}`}
                onClick={() => { resetControlsTimeout(); onToggleTheater(); }}
                title="Modo Teatro (T)"
                data-focusable="true"
                data-focus-key="btn-theater"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                </svg>
              </button>

              <button
                className={`control-btn ${isFullscreen ? 'active' : ''}`}
                onClick={() => { resetControlsTimeout(); toggleFullscreen(); }}
                title="Tela cheia (F)"
                data-focusable="true"
                data-focus-key="btn-fullscreen"
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mensagem de cast */}
          {castMessage && (
            <div className="cast-message">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                <circle cx="2" cy="20" r="2" fill="currentColor" />
              </svg>
              <span>{castMessage}</span>
            </div>
          )}

          {/* Indicador de transmissão ativa */}
          {castState.isConnected && (
            <div className="cast-active-indicator">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                <circle cx="2" cy="20" r="2" fill="currentColor" />
              </svg>
              <span>Transmitindo para {castState.deviceName}</span>
              <button onClick={() => castService.stopCasting()}>Parar</button>
            </div>
          )}

          {/* Modal de Cast Melhorado */}
          {showCastModal && (
            <div className="cast-modal-overlay" onClick={() => { setShowCastModal(false); setShowExternalPlayers(false); }}>
              <div className="cast-modal" onClick={(e) => e.stopPropagation()}>
                {!showExternalPlayers ? (
                  <>
                    <h3>Transmitir para dispositivo</h3>
                    <p>Escolha como deseja transmitir "{channel.name}"</p>
                    
                    <div className="cast-options">
                      {castService.getAvailableMethods().map((method) => (
                        <button 
                          key={method.method}
                          className="cast-option" 
                          onClick={() => handleCastOption(method.method)}
                        >
                          {method.icon === 'chromecast' && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                              <circle cx="2" cy="20" r="2" fill="currentColor" />
                            </svg>
                          )}
                          {method.icon === 'airplay' && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" />
                              <polygon points="12 15 17 21 7 21 12 15" />
                            </svg>
                          )}
                          {method.icon === 'tv' && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="3" width="20" height="14" rx="2" />
                              <path d="M8 21h8M12 17v4" />
                            </svg>
                          )}
                          {method.icon === 'share' && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="18" cy="5" r="3" />
                              <circle cx="6" cy="12" r="3" />
                              <circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                          )}
                          {method.icon === 'copy' && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                          {method.icon === 'external' && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          )}
                          <span>{method.name}</span>
                          <small>{method.description}</small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Abrir em player externo</h3>
                    <p>Escolha um player para abrir o stream</p>
                    
                    <div className="cast-options external-players">
                      {castService.getExternalPlayerLinks(channel.url).map((player) => (
                        <button 
                          key={player.name}
                          className="cast-option" 
                          onClick={() => handleExternalPlayer(player.url)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          <span>{player.name}</span>
                          <small>{player.platforms.join(', ')}</small>
                        </button>
                      ))}
                      
                      <button 
                        className="cast-option copy-url"
                        onClick={() => handleCastOption('copyLink')}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copiar URL do stream</span>
                        <small>Para colar manualmente no player</small>
                      </button>
                    </div>

                    <button className="cast-modal-back" onClick={() => setShowExternalPlayers(false)}>
                      ← Voltar
                    </button>
                  </>
                )}

                <button className="cast-modal-close" onClick={() => { setShowCastModal(false); setShowExternalPlayers(false); }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});
