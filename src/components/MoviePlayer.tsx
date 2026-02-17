import { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import Hls from 'hls.js';
import type { Movie } from '../types/movie';
import { getProxiedUrl, needsProxy } from '../utils/proxyUrl';
import castService, { type CastMethod, type CastState } from '../services/castService';
import './MoviePlayer.css';

// Interface para informações de série
export interface SeriesEpisodeInfo {
  currentEpisode: number;
  currentSeason: number;
  totalEpisodes: number;
  episodes: Movie[]; // Lista de episódios da temporada atual
  seriesName: string;
}

interface MoviePlayerProps {
  movie: Movie | null;
  onBack: () => void;
  seriesInfo?: SeriesEpisodeInfo | null;
  onNextEpisode?: (episode: Movie) => void;
}

export const MoviePlayer = memo(function MoviePlayer({ movie, onBack, seriesInfo, onNextEpisode }: MoviePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);
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
  const [isProxyBlocked, setIsProxyBlocked] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showExternalMenu, setShowExternalMenu] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [skipTime, setSkipTime] = useState(() => {
    const saved = localStorage.getItem('movie-skip-time');
    return saved ? parseInt(saved) : 10;
  });
  const [brightness, setBrightness] = useState(100);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'auto' | '16:9' | '4:3' | '21:9'>('auto');
  const [videoResolution, setVideoResolution] = useState<string | null>(null);
  
  // Cast states
  const [castState, setCastState] = useState<CastState>({ isConnected: false, deviceName: null, method: null });
  const [showCastModal, setShowCastModal] = useState(false);
  const [castMessage, setCastMessage] = useState<string | null>(null);
  const [showExternalCastPlayers, setShowExternalCastPlayers] = useState(false);
  
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
    const url = getProxiedUrl(movie.url);

    // Resetar estados para o novo vídeo
    setIsLoading(true);
    setError(null);
    setIsProxyBlocked(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowNextEpisodeButton(false);

    // Função para salvar progresso do vídeo anterior (se houver)
    const savePreviousProgress = () => {
      const previousMovieId = localStorage.getItem('current-movie-id');
      const previousTime = video.currentTime;
      const previousDuration = video.duration;

      if (previousMovieId && previousTime > 30 && previousDuration) {
        const progress = (previousTime / previousDuration) * 100;
        if (progress < 95) { // Só salva se não terminou
          localStorage.setItem(`movie-progress-${previousMovieId}`, previousTime.toString());
        } else {
          localStorage.removeItem(`movie-progress-${previousMovieId}`);
        }
      }
    };
    savePreviousProgress();
    localStorage.setItem('current-movie-id', movie.id);

    // Função para carregar progresso salvo do vídeo atual
    const loadProgress = () => {
      const saved = localStorage.getItem(`movie-progress-${movie.id}`);
      if (saved) {
        const time = parseFloat(saved);
        if (!isNaN(time) && time > 0) {
          video.currentTime = time;
        }
      }
    };

    // Limpeza da instância HLS anterior
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const handleAutoplay = () => {
      video.play().catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {
          console.log('Autoplay bloqueado, aguardando interação do usuário');
        });
      });
    };

    const handleGenericError = (e: Event) => {
      setIsLoading(false);
      const videoError = (e.currentTarget as HTMLVideoElement)?.error;
      const code = videoError?.code;
      let message = 'Erro ao carregar o vídeo.';

      switch (code) {
        case 1: message = 'Carregamento do vídeo foi cancelado.'; break;
        case 2: message = 'Erro de rede. Verifique sua conexão.'; break;
        case 3: message = 'Erro ao decodificar o vídeo.'; break;
        case 4:
          if (needsProxy(movie.url)) {
            // Tenta verificar se é bloqueio do proxy (403 do servidor de CDN)
            const proxyUrl = getProxiedUrl(movie.url);
            fetch(proxyUrl, { method: 'HEAD' })
              .then(r => {
                if (r.status === 403) {
                  setIsProxyBlocked(true);
                  setError('O servidor de CDN está bloqueando o proxy. Use um player externo.');
                } else {
                  setError('Vídeo não pôde ser carregado. Tente um player externo.');
                }
              })
              .catch(() => {
                setError('Vídeo não pôde ser carregado. Tente um player externo.');
              });
            return; // Sai cedo; o state será definido no .then()
          }
          message = 'Formato de vídeo não suportado ou URL inválida.';
          break;
      }

      console.log('[MoviePlayer Error]', { code, message, url: movie.url });
      setError(message);
    };

    // Lógica para carregar HLS ou vídeo nativo
    if (url.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setDuration(video.duration);
        setIsLoading(false);
        loadProgress();
        handleAutoplay();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('HLS Network error', data);
              setError('Erro de rede ao carregar o stream.');
              hls.startLoad(); // Tenta reconectar
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('HLS Media error', data);
              setError('Erro de mídia no stream, tentando recuperar...');
              hls.recoverMediaError();
              break;
            default:
              setError('Ocorreu um erro fatal ao carregar o vídeo.');
              setIsLoading(false);
              hls.destroy();
              break;
          }
        }
      });
    } else {
      // Fallback para vídeo nativo (MP4, WebM, etc) ou Safari com HLS nativo
      video.src = url;
      video.load();

      const onLoadedMetadata = () => {
        setDuration(video.duration);
        setIsLoading(false);
        loadProgress();
        handleAutoplay();
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', handleGenericError);
    }
    
    // Listeners gerais
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    const handleCanPlay = () => setIsLoading(false);
    
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);

    // Salvar progresso ao sair
    const saveOnExit = () => savePreviousProgress();
    window.addEventListener('beforeunload', saveOnExit);

    return () => {
      savePreviousProgress();
      localStorage.removeItem('current-movie-id');
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      
      window.removeEventListener('beforeunload', saveOnExit);
      video.removeEventListener('error', handleGenericError);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      // Remove specific listener for native video if it was added
      // A reference to the function is needed to remove it.
      // video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [movie]);


  // Calcula próximo episódio - DEVE vir antes do useEffect que o usa
  const nextEpisode = useMemo(() => {
    if (!seriesInfo || !movie) return null;
    
    const currentIndex = seriesInfo.episodes.findIndex(ep => ep.id === movie.id);
    if (currentIndex === -1 || currentIndex >= seriesInfo.episodes.length - 1) return null;
    
    return seriesInfo.episodes[currentIndex + 1];
  }, [seriesInfo, movie]);

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
      // Mostra botão de próximo episódio quando o vídeo termina
      if (nextEpisode) {
        setShowNextEpisodeButton(true);
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
  }, [movie, nextEpisode]);

  // Função para abrir em nova aba
  const openInNewTab = useCallback(() => {
    if (!movie) return;
    console.log('[openInNewTab] Abrindo:', movie.url);
    window.open(movie.url, '_blank');
  }, [movie]);

  // Mostra botão de próximo episódio quando faltam 30 segundos
  useEffect(() => {
    if (!nextEpisode || !duration) return;
    
    const timeRemaining = duration - currentTime;
    if (timeRemaining <= 30 && timeRemaining > 0) {
      setShowNextEpisodeButton(true);
    } else if (currentTime < duration - 35) {
      setShowNextEpisodeButton(false);
    }
  }, [currentTime, duration, nextEpisode]);

  const handleNextEpisode = useCallback(() => {
    if (nextEpisode && onNextEpisode) {
      onNextEpisode(nextEpisode);
    }
  }, [nextEpisode, onNextEpisode]);

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

  // Picture-in-Picture
  useEffect(() => {
    const handlePiPChange = () => {
      setIsPiP(document.pictureInPictureElement === videoRef.current);
    };

    const video = videoRef.current;
    if (video) {
      video.addEventListener('enterpictureinpicture', handlePiPChange);
      video.addEventListener('leavepictureinpicture', handlePiPChange);
    }

    return () => {
      if (video) {
        video.removeEventListener('enterpictureinpicture', handlePiPChange);
        video.removeEventListener('leavepictureinpicture', handlePiPChange);
      }
    };
  }, []);

  // Skip intro detection (show button in first 5 minutes)
  useEffect(() => {
    if (currentTime > 30 && currentTime < 300 && seriesInfo) {
      setShowSkipIntro(true);
    } else {
      setShowSkipIntro(false);
    }
  }, [currentTime, seriesInfo]);

  // Save skip time preference
  useEffect(() => {
    localStorage.setItem('movie-skip-time', skipTime.toString());
  }, [skipTime]);

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
  }, [movie]);

  // Cast state listener
  useEffect(() => {
    const unsubscribe = castService.onStateChange((state) => {
      setCastState(state);
    });

    // Load initial state
    setCastState(castService.getState());

    return unsubscribe;
  }, []);

  // Callback functions - defined before keyboard shortcuts useEffect
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

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  // Picture-in-Picture toggle
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

  // Cast toggle
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
    if (!movie) return;

    if (method === 'openExternal') {
      setShowExternalCastPlayers(true);
      return;
    }

    const result = await castService.cast(
      method,
      movie.url,
      movie.name,
      videoRef.current || undefined,
      undefined // movie image
    );

    setCastMessage(result.message);
    setTimeout(() => setCastMessage(null), 4000);
    
    if (result.success || method === 'copyLink' || method === 'share') {
      setShowCastModal(false);
    }
  }, [movie]);

  const handleCastExternalPlayer = useCallback((playerUrl: string) => {
    castService.openInExternalPlayer(playerUrl);
    setCastMessage('Abrindo player externo...');
    setTimeout(() => setCastMessage(null), 3000);
    setShowExternalCastPlayers(false);
    setShowCastModal(false);
  }, []);

  // Skip intro (30 seconds forward)
  const skipIntro = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration, video.currentTime + 30);
    setShowSkipIntro(false);
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
          seek(-skipTime);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(skipTime);
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
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
        case 'c':
          e.preventDefault();
          toggleCast();
          break;
        case 'j':
          e.preventDefault();
          seek(-10);
          break;
        case 'l':
          e.preventDefault();
          seek(10);
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          if (videoRef.current) {
            const percent = parseInt(e.key) * 10;
            videoRef.current.currentTime = (percent / 100) * videoRef.current.duration;
          }
          break;
        case 'Home':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = 0;
          break;
        case 'End':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = videoRef.current.duration - 1;
          break;
        case 's':
          e.preventDefault();
          skipIntro();
          break;
        case ',':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 1/30);
          break;
        case '.':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 1/30);
          break;
        case '<':
          e.preventDefault();
          setPlaybackRate(r => Math.max(0.25, r - 0.25));
          break;
        case '>':
          e.preventDefault();
          setPlaybackRate(r => Math.min(3, r + 0.25));
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
  }, [isFullscreen, onBack, skipTime, togglePiP, toggleCast, skipIntro, togglePlay, seek, toggleFullscreen]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * video.duration;
  }, []);

  const handleRetry = useCallback(() => {
    if (videoRef.current && movie) {
      setError(null);
      setIsProxyBlocked(false);
      setIsLoading(true);
      // This will trigger the main useEffect to re-run and attempt to load the source again.
      // A more direct way would be to call a "load" function, but this is simpler with the current structure.
      const video = videoRef.current;
      if (hlsRef.current) {
        hlsRef.current.loadSource(getProxiedUrl(movie.url));
      } else {
        video.load();
      }
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
      <div className="video-container" style={{ filter: `brightness(${brightness}%)` }}>
        <video
          ref={videoRef}
          className={`movie-video aspect-${aspectRatio}`}
          playsInline
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Skip Intro Button */}
      {showSkipIntro && (
        <button 
          className="skip-intro-btn" 
          onClick={(e) => { e.stopPropagation(); skipIntro(); }}
          data-focusable="true"
          data-nav-group="player-actions"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              skipIntro();
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
          Pular Intro
        </button>
      )}

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
          {isProxyBlocked ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <h3>Servidor bloqueando proxy</h3>
              <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '8px 0 16px' }}>
                O CDN deste vídeo bloqueia servidores proxy. Use um player externo para assistir.
              </p>
              <div className="external-players" style={{ marginTop: 0 }}>
                <p>Abrir em player externo:</p>
                <div className="player-buttons">
                  <button
                    onClick={() => openInExternalPlayer('vlc')}
                    title="VLC Media Player"
                    data-focusable="true"
                    data-nav-group="external-players"
                    autoFocus
                  >
                    🎬 VLC
                  </button>
                  <button
                    onClick={() => openInExternalPlayer('iina')}
                    title="IINA (macOS)"
                    data-focusable="true"
                    data-nav-group="external-players"
                  >
                    🎥 IINA
                  </button>
                  <button
                    onClick={() => openInExternalPlayer('potplayer')}
                    title="PotPlayer"
                    data-focusable="true"
                    data-nav-group="external-players"
                  >
                    ▶️ PotPlayer
                  </button>
                  <button
                    onClick={openInNewTab}
                    title="Abrir no navegador"
                    data-focusable="true"
                    data-nav-group="external-players"
                  >
                    🌐 Nova aba
                  </button>
                  <button
                    onClick={() => openInExternalPlayer('copy')}
                    title="Copiar URL"
                    data-focusable="true"
                    data-nav-group="external-players"
                  >
                    📋 Copiar URL
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <h3>{error}</h3>
              <div className="error-actions">
                <button
                  onClick={handleRetry}
                  data-focusable="true"
                  data-nav-group="error-actions"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRetry();
                    }
                  }}
                >
                  Tentar novamente
                </button>
                <button
                  onClick={openInNewTab}
                  data-focusable="true"
                  data-nav-group="error-actions"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openInNewTab();
                    }
                  }}
                >
                  Abrir em nova aba
                </button>
              </div>
              <div className="external-players">
                <p>Abrir em player externo:</p>
                <div className="player-buttons">
                  <button
                    onClick={() => openInExternalPlayer('vlc')}
                    title="VLC Media Player"
                    data-focusable="true"
                    data-nav-group="external-players"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('vlc');
                      }
                    }}
                  >
                    VLC
                  </button>
                  <button
                    onClick={() => openInExternalPlayer('iina')}
                    title="IINA (macOS)"
                    data-focusable="true"
                    data-nav-group="external-players"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('iina');
                      }
                    }}
                  >
                    IINA
                  </button>
                  <button
                    onClick={() => openInExternalPlayer('potplayer')}
                    title="PotPlayer"
                    data-focusable="true"
                    data-nav-group="external-players"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('potplayer');
                      }
                    }}
                  >
                    PotPlayer
                  </button>
                  <button
                    onClick={() => openInExternalPlayer('copy')}
                    title="Copiar URL"
                    data-focusable="true"
                    data-nav-group="external-players"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('copy');
                      }
                    }}
                  >
                    📋 Copiar URL
                  </button>
                </div>
              </div>
              <p className="error-hint">
                💡 Dica: Se o vídeo não carregar, abra em um player externo como VLC
              </p>
            </>
          )}
        </div>
      )}

      {/* Next Episode Overlay - Aparece nos últimos 30 segundos ou quando o vídeo termina */}
      {showNextEpisodeButton && nextEpisode && (
        <div className="next-episode-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="next-episode-card">
            <div className="next-episode-info">
              <span className="next-label">Próximo episódio</span>
              <h4>{nextEpisode.name}</h4>
              {seriesInfo && (
                <span className="next-episode-number">
                  T{seriesInfo.currentSeason} E{seriesInfo.currentEpisode + 1}
                </span>
              )}
            </div>
            <button 
              className="next-episode-btn" 
              onClick={handleNextEpisode}
              data-focusable="true"
              data-nav-group="next-episode"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNextEpisode();
                }
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
              <span>Reproduzir</span>
            </button>
            <button 
              className="next-dismiss-btn" 
              onClick={() => setShowNextEpisodeButton(false)}
              data-focusable="true"
              data-nav-group="next-episode"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                  e.preventDefault();
                  setShowNextEpisodeButton(false);
                }
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={`player-controls ${showControls ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="controls-top">
          <button 
            className="control-btn back-btn" 
            onClick={onBack} 
            title="Voltar (Esc)"
            data-focusable="true"
            data-nav-group="player-top"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onBack();
              }
            }}
          >
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
                data-focusable="true"
                data-nav-group="player-top"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowExternalMenu(!showExternalMenu);
                  } else if (e.key === 'Escape' && showExternalMenu) {
                    e.preventDefault();
                    setShowExternalMenu(false);
                  }
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <path d="M15 3h6v6M10 14L21 3" />
                </svg>
              </button>
              {showExternalMenu && (
                <div className="external-dropdown">
                  <button 
                    onClick={() => { openInExternalPlayer('vlc'); setShowExternalMenu(false); }}
                    data-focusable="true"
                    data-nav-group="external-menu"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('vlc');
                        setShowExternalMenu(false);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowExternalMenu(false);
                      }
                    }}
                  >
                    🎬 VLC Player
                  </button>
                  <button 
                    onClick={() => { openInExternalPlayer('iina'); setShowExternalMenu(false); }}
                    data-focusable="true"
                    data-nav-group="external-menu"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('iina');
                        setShowExternalMenu(false);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowExternalMenu(false);
                      }
                    }}
                  >
                    🎥 IINA (macOS)
                  </button>
                  <button 
                    onClick={() => { openInExternalPlayer('potplayer'); setShowExternalMenu(false); }}
                    data-focusable="true"
                    data-nav-group="external-menu"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('potplayer');
                        setShowExternalMenu(false);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowExternalMenu(false);
                      }
                    }}
                  >
                    ▶️ PotPlayer
                  </button>
                  <button 
                    onClick={() => { openInExternalPlayer('newtab'); setShowExternalMenu(false); }}
                    data-focusable="true"
                    data-nav-group="external-menu"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('newtab');
                        setShowExternalMenu(false);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowExternalMenu(false);
                      }
                    }}
                  >
                    🌐 Nova aba
                  </button>
                  <hr />
                  <button 
                    onClick={() => { openInExternalPlayer('copy'); setShowExternalMenu(false); }}
                    data-focusable="true"
                    data-nav-group="external-menu"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openInExternalPlayer('copy');
                        setShowExternalMenu(false);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowExternalMenu(false);
                      }
                    }}
                  >
                    📋 Copiar URL
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center play button */}
        {!isPlaying && !isLoading && !error && (
          <button 
            className="center-play" 
            onClick={togglePlay}
            data-focusable="true"
            data-nav-group="player-center"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePlay();
              }
            }}
          >
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
              <button 
                className="control-btn" 
                onClick={togglePlay} 
                title={isPlaying ? 'Pausar (K)' : 'Reproduzir (K)'}
                data-focusable="true"
                data-nav-group="player-controls"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    togglePlay();
                  }
                }}
              >
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

              {/* Rewind */}
              <button 
                className="control-btn" 
                onClick={() => seek(-skipTime)} 
                title={`Voltar ${skipTime}s (←)`}
                data-focusable="true"
                data-nav-group="player-controls"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    seek(-skipTime);
                  }
                }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                  <text x="12" y="15" fontSize="7" fill="currentColor" textAnchor="middle" fontWeight="bold">{skipTime}</text>
                </svg>
              </button>

              {/* Forward */}
              <button 
                className="control-btn" 
                onClick={() => seek(skipTime)} 
                title={`Avançar ${skipTime}s (→)`}
                data-focusable="true"
                data-nav-group="player-controls"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    seek(skipTime);
                  }
                }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                  <text x="12" y="15" fontSize="7" fill="currentColor" textAnchor="middle" fontWeight="bold">{skipTime}</text>
                </svg>
              </button>

              {/* Volume */}
              <div className="volume-control">
                <button 
                  className="control-btn" 
                  onClick={() => setIsMuted(m => !m)} 
                  title="Mudo (M)"
                  data-focusable="true"
                  data-nav-group="player-controls"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsMuted(m => !m);
                    }
                  }}
                >
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
                  data-focusable="true"
                  data-nav-group="player-controls"
                />
              </div>

              {/* Time and Resolution */}
              <div className="time-resolution-display">
                <span className="time-display">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                {videoResolution && (
                  <span className="video-resolution">{videoResolution}</span>
                )}
              </div>
            </div>

            <div className="controls-right">
              {/* Cast Button */}
              <button
                className={`control-btn cast-btn ${castState.isConnected ? 'active casting' : ''}`}
                onClick={toggleCast}
                title={castState.isConnected ? `Transmitindo para ${castState.deviceName}` : 'Transmitir (C)'}
                data-focusable="true"
                data-nav-group="player-controls"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCast();
                  }
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                  <circle cx="2" cy="20" r="2" fill="currentColor" />
                </svg>
              </button>

              {/* Next Episode Button */}
              {nextEpisode && (
                <button 
                  className="control-btn next-ep-btn" 
                  onClick={handleNextEpisode} 
                  title="Próximo episódio (N)"
                  data-focusable="true"
                  data-nav-group="player-controls"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNextEpisode();
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>
              )}

              {/* Settings Menu */}
              <div className="settings-menu-wrapper">
                <button 
                  className="control-btn" 
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  title="Configurações"
                  data-focusable="true"
                  data-nav-group="player-controls"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowSettingsMenu(!showSettingsMenu);
                    } else if (e.key === 'Escape' && showSettingsMenu) {
                      e.preventDefault();
                      setShowSettingsMenu(false);
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                </button>
                {showSettingsMenu && (
                  <div className="settings-dropdown" onClick={(e) => e.stopPropagation()}>
                    <div className="settings-section">
                      <label>Velocidade</label>
                      <select 
                        value={playbackRate}
                        onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                        data-focusable="true"
                        data-nav-group="settings-menu"
                      >
                        <option value="0.25">0.25x</option>
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1">Normal</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="1.75">1.75x</option>
                        <option value="2">2x</option>
                        <option value="2.5">2.5x</option>
                        <option value="3">3x</option>
                      </select>
                    </div>
                    <div className="settings-section">
                      <label>Pular (segundos)</label>
                      <select 
                        value={skipTime}
                        onChange={(e) => setSkipTime(parseInt(e.target.value))}
                        data-focusable="true"
                        data-nav-group="settings-menu"
                      >
                        <option value="5">5s</option>
                        <option value="10">10s</option>
                        <option value="15">15s</option>
                        <option value="30">30s</option>
                        <option value="60">1 min</option>
                      </select>
                    </div>
                    <div className="settings-section">
                      <label>Proporção</label>
                      <select 
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                        data-focusable="true"
                        data-nav-group="settings-menu"
                      >
                        <option value="auto">Auto</option>
                        <option value="16:9">16:9</option>
                        <option value="4:3">4:3</option>
                        <option value="21:9">21:9 (Cinema)</option>
                      </select>
                    </div>
                    <div className="settings-section">
                      <label>Brilho: {brightness}%</label>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="settings-slider"
                        data-focusable="true"
                        data-nav-group="settings-menu"
                      />
                    </div>
                    <hr />
                    <div className="settings-shortcuts">
                      <h4>Atalhos de Teclado</h4>
                      <ul>
                        <li><kbd>Espaço</kbd> / <kbd>K</kbd> - Play/Pause</li>
                        <li><kbd>←</kbd> / <kbd>→</kbd> - Pular {skipTime}s</li>
                        <li><kbd>J</kbd> / <kbd>L</kbd> - Pular 10s</li>
                        <li><kbd>↑</kbd> / <kbd>↓</kbd> - Volume</li>
                        <li><kbd>M</kbd> - Mudo</li>
                        <li><kbd>F</kbd> - Tela cheia</li>
                        <li><kbd>P</kbd> - Picture-in-Picture</li>
                        <li><kbd>S</kbd> - Pular intro</li>
                        <li><kbd>0-9</kbd> - Pular para %</li>
                        <li><kbd>&lt;</kbd> / <kbd>&gt;</kbd> - Velocidade</li>
                        <li><kbd>,</kbd> / <kbd>.</kbd> - Frame a frame</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Picture-in-Picture */}
              {document.pictureInPictureEnabled && (
                <button 
                  className="control-btn" 
                  onClick={togglePiP} 
                  title="Picture-in-Picture (P)"
                  data-focusable="true"
                  data-nav-group="player-controls"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePiP();
                    }
                  }}
                >
                  {isPiP ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="14" rx="2"/>
                      <rect x="10" y="9" width="10" height="7" rx="1" fill="currentColor"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="14" rx="2"/>
                      <rect x="11" y="10" width="8" height="6" rx="1"/>
                    </svg>
                  )}
                </button>
              )}

              {/* Playback speed indicator */}
              {playbackRate !== 1 && (
                <span className="speed-indicator">{playbackRate}x</span>
              )}

              {/* Fullscreen */}
              <button 
                className="control-btn" 
                onClick={toggleFullscreen} 
                title="Tela cheia (F)"
                data-focusable="true"
                data-nav-group="player-controls"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFullscreen();
                  }
                }}
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

      {/* Modal de Cast */}
      {showCastModal && (
        <div className="cast-modal-overlay" onClick={() => { setShowCastModal(false); setShowExternalCastPlayers(false); }}>
          <div className="cast-modal" onClick={(e) => e.stopPropagation()}>
            {!showExternalCastPlayers ? (
              <>
                <h3>Transmitir para dispositivo</h3>
                <p>Escolha como deseja transmitir "{movie?.name}"</p>
                
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
                <p>Escolha um player para abrir o vídeo</p>
                
                <div className="cast-options external-players">
                  {movie && castService.getExternalPlayerLinks(movie.url).map((player) => (
                    <button 
                      key={player.name}
                      className="cast-option" 
                      onClick={() => handleCastExternalPlayer(player.url)}
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

                <button className="cast-modal-back" onClick={() => setShowExternalCastPlayers(false)}>
                  ← Voltar
                </button>
              </>
            )}

            <button className="cast-modal-close" onClick={() => { setShowCastModal(false); setShowExternalCastPlayers(false); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
});