import { useRef, useEffect, useState, useCallback, memo } from 'react';
import Hls from 'hls.js';
import type { Channel } from '../types/channel';
import { ProgramInfo } from './ProgramInfo';
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
  const [isCasting, setIsCasting] = useState(false);
  const [showCastModal, setShowCastModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  // Initialize HLS
  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);
    intentionalPauseRef.current = false; // Reset pausa intencional ao trocar de canal

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
          setError('Erro ao carregar o canal. Tente novamente.');
          setIsLoading(false);
          
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Try to recover
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
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

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
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

  // Cast availability listener
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check for Remote Playback API support
    if ('remote' in video) {
      const remote = (video as any).remote;

      const handleConnecting = () => setIsCasting(true);
      const handleConnect = () => setIsCasting(true);
      const handleDisconnect = () => setIsCasting(false);

      remote.addEventListener('connecting', handleConnecting);
      remote.addEventListener('connect', handleConnect);
      remote.addEventListener('disconnect', handleDisconnect);

      return () => {
        remote.removeEventListener('connecting', handleConnecting);
        remote.removeEventListener('connect', handleConnect);
        remote.removeEventListener('disconnect', handleDisconnect);
      };
    }
  }, [channel]);

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
    const video = videoRef.current;
    if (!video) return;

    // Primeiro tenta a Remote Playback API nativa
    if ('remote' in video) {
      try {
        const remote = (video as any).remote;
        await remote.prompt();
        return;
      } catch (err) {
        // Se falhar, mostra o modal com opções
        console.log('Remote Playback não disponível, mostrando modal');
      }
    }

    // Mostra o modal de opções de cast
    setShowCastModal(true);
  }, []);

  const handleCastOption = useCallback(async (option: 'airplay' | 'copy' | 'share') => {
    const video = videoRef.current;
    
    switch (option) {
      case 'airplay':
        // Tenta usar AirPlay (Safari)
        if (video && 'webkitShowPlaybackTargetPicker' in video) {
          (video as any).webkitShowPlaybackTargetPicker();
        } else {
          alert('AirPlay não está disponível neste navegador. Use Safari no Mac ou iOS.');
        }
        break;
      
      case 'copy':
        // Copia o link do canal
        if (channel) {
          try {
            await navigator.clipboard.writeText(channel.url);
            alert('Link copiado! Cole em outro dispositivo ou app de streaming.');
          } catch {
            // Fallback para navegadores antigos
            const textArea = document.createElement('textarea');
            textArea.value = channel.url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('Link copiado!');
          }
        }
        break;
      
      case 'share':
        // Usa Web Share API se disponível
        if (navigator.share && channel) {
          try {
            await navigator.share({
              title: `Assistir ${channel.name}`,
              text: `Assista ${channel.name} ao vivo`,
              url: channel.url,
            });
          } catch {
            // User cancelled
          }
        } else {
          alert('Compartilhamento não suportado neste navegador.');
        }
        break;
    }
    
    setShowCastModal(false);
  }, [channel]);

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
                <button className="control-btn" onClick={() => { resetControlsTimeout(); toggleMute(); }} title={isMuted ? 'Ativar som (M)' : 'Mudo (M)'}>
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
                />
              </div>

              <div className="channel-indicator">
                <span className="live-badge">AO VIVO</span>
                <span className="channel-name">{channel.name}</span>
              </div>
            </div>

            <div className="controls-right">
              <button
                className={`control-btn ${isMirrored ? 'active' : ''}`}
                onClick={() => { resetControlsTimeout(); toggleMirror(); }}
                title="Espelhar vídeo (R)"
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
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <rect x="11" y="9" width="9" height="6" rx="1" />
                </svg>
              </button>

              <button
                className={`control-btn cast-btn ${isCasting ? 'active casting' : ''}`}
                onClick={() => { resetControlsTimeout(); toggleCast(); }}
                title={isCasting ? 'Transmitindo...' : 'Transmitir (C)'}
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
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                </svg>
              </button>

              <button
                className={`control-btn ${isFullscreen ? 'active' : ''}`}
                onClick={() => { resetControlsTimeout(); toggleFullscreen(); }}
                title="Tela cheia (F)"
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

          {/* Modal de Cast */}
          {showCastModal && (
            <div className="cast-modal-overlay" onClick={() => setShowCastModal(false)}>
              <div className="cast-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Transmitir para dispositivo</h3>
                <p>Escolha como deseja transmitir "{channel.name}"</p>
                
                <div className="cast-options">
                  <button className="cast-option" onClick={() => handleCastOption('airplay')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" />
                      <polygon points="12 15 17 21 7 21 12 15" />
                    </svg>
                    <span>AirPlay</span>
                    <small>Para Apple TV, Mac, iOS</small>
                  </button>

                  <button className="cast-option" onClick={() => handleCastOption('copy')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copiar Link</span>
                    <small>Cole em Smart TV ou outro app</small>
                  </button>

                  {'share' in navigator && (
                    <button className="cast-option" onClick={() => handleCastOption('share')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      <span>Compartilhar</span>
                      <small>Enviar para outro dispositivo</small>
                    </button>
                  )}
                </div>

                <button className="cast-modal-close" onClick={() => setShowCastModal(false)}>
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
