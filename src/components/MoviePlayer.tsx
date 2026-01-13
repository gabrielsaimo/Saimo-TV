import { useRef, useEffect, useState, useCallback, memo } from 'react';
import type { Movie } from '../types/movie';
import './MoviePlayer.css';

interface MoviePlayerProps {
  movie: Movie | null;
  onBack: () => void;
}

export const MoviePlayer = memo(function MoviePlayer({ movie, onBack }: MoviePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('movie-volume');
    return saved ? parseFloat(saved) : 1;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showExternalMenu, setShowExternalMenu] = useState(false);
  
  const controlsTimeoutRef = useRef<number | null>(null);

  // Formatar tempo (segundos -> HH:MM:SS ou MM:SS)
  const formatTime = useCallback((seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Carregar vídeo quando movie mudar
  useEffect(() => {
    if (!movie || !videoRef.current) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    // Salvar progresso do vídeo anterior
    const saveProgress = () => {
      if (video.currentTime > 30 && video.duration) {
        const progress = (video.currentTime / video.duration) * 100;
        if (progress < 95) { // Só salva se não terminou
          localStorage.setItem(`movie-progress-${movie.id}`, video.currentTime.toString());
        } else {
          localStorage.removeItem(`movie-progress-${movie.id}`);
        }
      }
    };

    // Carregar progresso salvo
    const loadProgress = () => {
      const saved = localStorage.getItem(`movie-progress-${movie.id}`);
      if (saved) {
        const time = parseFloat(saved);
        if (!isNaN(time) && time > 0) {
          video.currentTime = time;
        }
      }
    };

    video.src = movie.url;
    video.load();

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
      loadProgress();
      
      // Tentar autoplay
      video.play().catch(() => {
        // Se falhar, tenta mutado
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {
          // Falhou mesmo mutado, usuário precisa clicar
          console.log('Autoplay bloqueado, aguardando interação do usuário');
        });
      });
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setIsLoading(false);
      const errorCode = video.error?.code;
      let errorMessage = 'Erro ao carregar o vídeo.';
      
      switch (errorCode) {
        case 1: // MEDIA_ERR_ABORTED
          errorMessage = 'Carregamento do vídeo foi cancelado.';
          break;
        case 2: // MEDIA_ERR_NETWORK
          errorMessage = 'Erro de rede. Verifique sua conexão.';
          break;
        case 3: // MEDIA_ERR_DECODE
          errorMessage = 'Erro ao decodificar o vídeo.';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorMessage = 'Formato de vídeo não suportado ou URL inválida.';
          break;
      }
      
      setError(errorMessage);
    };

    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    // Salvar progresso periodicamente e ao sair
    const progressInterval = setInterval(saveProgress, 10000);
    window.addEventListener('beforeunload', saveProgress);

    return () => {
      saveProgress();
      clearInterval(progressInterval);
      window.removeEventListener('beforeunload', saveProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [movie]);

  // Atualizar tempo/buffer
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (movie) {
        localStorage.removeItem(`movie-progress-${movie.id}`);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [movie]);

  // Volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
    localStorage.setItem('movie-volume', volume.toString());
  }, [volume, isMuted]);

  // Playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Auto-hide controls
  useEffect(() => {
    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      
      if (isPlaying) {
        controlsTimeoutRef.current = window.setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', resetControlsTimeout);
      container.addEventListener('touchstart', resetControlsTimeout);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', resetControlsTimeout);
        container.removeEventListener('touchstart', resetControlsTimeout);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'm':
          e.preventDefault();
          setIsMuted(m => !m);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onBack();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onBack]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * video.duration;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (videoRef.current && movie) {
      setError(null);
      setIsLoading(true);
      videoRef.current.load();
    }
  }, [movie]);

  // Abrir em player externo
  const openInExternalPlayer = useCallback((player: string) => {
    if (!movie) return;
    
    let url = '';
    switch (player) {
      case 'vlc':
        url = `vlc://${movie.url}`;
        break;
      case 'mx':
        url = `intent:${movie.url}#Intent;package=com.mxtech.videoplayer.ad;end`;
        break;
      case 'iina':
        url = `iina://open?url=${encodeURIComponent(movie.url)}`;
        break;
      case 'potplayer':
        url = `potplayer://${movie.url}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(movie.url).then(() => {
          // Feedback visual poderia ser adicionado aqui
        });
        return;
      case 'newtab':
        window.open(movie.url, '_blank');
        return;
    }
    
    if (url) {
      window.location.href = url;
    }
  }, [movie]);

  if (!movie) {
    return (
      <div className="movie-player empty">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3>Selecione um filme ou série</h3>
          <p>Escolha algo para assistir no catálogo</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`movie-player ${isFullscreen ? 'fullscreen' : ''} ${showControls ? '' : 'hide-cursor'}`}
      onClick={togglePlay}
    >
      {/* Video Container - com tamanho máximo fixo */}
      <div className="video-container">
        <video
          ref={videoRef}
          className="movie-video"
          playsInline
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="player-overlay loading">
          <div className="spinner" />
          <span>Carregando...</span>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="player-overlay error" onClick={(e) => e.stopPropagation()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <h3>{error}</h3>
          <div className="error-actions">
            <button onClick={handleRetry}>Tentar novamente</button>
            <button onClick={() => openInExternalPlayer('newtab')}>Abrir em nova aba</button>
          </div>
          <div className="external-players">
            <p>Abrir em player externo:</p>
            <div className="player-buttons">
              <button onClick={() => openInExternalPlayer('vlc')} title="VLC Media Player">VLC</button>
              <button onClick={() => openInExternalPlayer('iina')} title="IINA (macOS)">IINA</button>
              <button onClick={() => openInExternalPlayer('potplayer')} title="PotPlayer">PotPlayer</button>
              <button onClick={() => openInExternalPlayer('copy')} title="Copiar URL">📋 Copiar URL</button>
            </div>
          </div>
          <p className="error-hint">
            💡 Dica: Se o vídeo não carregar, abra em um player externo como VLC
          </p>
        </div>
      )}

      {/* Controls */}
      <div className={`player-controls ${showControls ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="controls-top">
          <button className="control-btn back-btn" onClick={onBack} title="Voltar (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="movie-title-bar">
            <h2>{movie.name}</h2>
            <span className="movie-category">{movie.category}</span>
          </div>
          <div className="top-actions">
            <div className="external-menu-wrapper">
              <button 
                className="control-btn" 
                onClick={() => setShowExternalMenu(!showExternalMenu)}
                title="Abrir em player externo"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <path d="M15 3h6v6M10 14L21 3" />
                </svg>
              </button>
              {showExternalMenu && (
                <div className="external-dropdown">
                  <button onClick={() => { openInExternalPlayer('vlc'); setShowExternalMenu(false); }}>
                    🎬 VLC Player
                  </button>
                  <button onClick={() => { openInExternalPlayer('iina'); setShowExternalMenu(false); }}>
                    🎥 IINA (macOS)
                  </button>
                  <button onClick={() => { openInExternalPlayer('potplayer'); setShowExternalMenu(false); }}>
                    ▶️ PotPlayer
                  </button>
                  <button onClick={() => { openInExternalPlayer('newtab'); setShowExternalMenu(false); }}>
                    🌐 Nova aba
                  </button>
                  <hr />
                  <button onClick={() => { openInExternalPlayer('copy'); setShowExternalMenu(false); }}>
                    📋 Copiar URL
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center play button */}
        {!isPlaying && !isLoading && !error && (
          <button className="center-play" onClick={togglePlay}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}

        {/* Bottom bar */}
        <div className="controls-bottom">
          {/* Progress bar */}
          <div className="progress-container" ref={progressRef} onClick={handleProgressClick}>
            <div className="progress-buffered" style={{ width: `${buffered}%` }} />
            <div className="progress-played" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
            <div 
              className="progress-thumb" 
              style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }} 
            />
          </div>

          {/* Controls row */}
          <div className="controls-row">
            <div className="controls-left">
              {/* Play/Pause */}
              <button className="control-btn" onClick={togglePlay} title={isPlaying ? 'Pausar (K)' : 'Reproduzir (K)'}>
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Rewind 10s */}
              <button className="control-btn" onClick={() => seek(-10)} title="Voltar 10s (←)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12.5 8L8 12l4.5 4" />
                  <path d="M16 12H8" />
                  <text x="12" y="20" fontSize="6" fill="currentColor" textAnchor="middle">10</text>
                </svg>
              </button>

              {/* Forward 10s */}
              <button className="control-btn" onClick={() => seek(10)} title="Avançar 10s (→)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11.5 8L16 12l-4.5 4" />
                  <path d="M8 12h8" />
                  <text x="12" y="20" fontSize="6" fill="currentColor" textAnchor="middle">10</text>
                </svg>
              </button>

              {/* Volume */}
              <div className="volume-control">
                <button className="control-btn" onClick={() => setIsMuted(m => !m)} title="Mudo (M)">
                  {isMuted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M23 9l-6 6M17 9l6 6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="volume-slider"
                />
              </div>

              {/* Time */}
              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="controls-right">
              {/* Playback speed */}
              <select 
                className="speed-select"
                value={playbackRate}
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                title="Velocidade"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>

              {/* Fullscreen */}
              <button className="control-btn" onClick={toggleFullscreen} title="Tela cheia (F)">
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
        </div>
      </div>
    </div>
  );
});
