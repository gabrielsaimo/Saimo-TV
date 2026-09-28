import { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { rota } from '../utils/rotas';
import { useMediaSession } from '../hooks/useMediaSession';
import { registrar as registrarAndamento } from '../services/continuar';
import { buscarPulos, trechoEm, inicioDosCreditos, rotuloTrecho, type Trecho } from '../services/pulos';
import Hls from 'hls.js';
import type { Movie, SeriesEpisodeInfo } from '../types/movie';
import { getProxiedUrl, needsProxy } from '../utils/proxyUrl';
import { isHls } from '../utils/streamUrl';
import castService, { type CastMethod, type CastState } from '../services/castService';
import * as telemetria from '../services/telemetria';
import './MoviePlayer.css';
import './AvisoApp.css';

interface MoviePlayerProps {
  movie: Movie | null;
  onBack: () => void;
  seriesInfo?: SeriesEpisodeInfo | null;
  onEpisodeChange?: (episode: Movie) => void;
}

export const MoviePlayer = memo(function MoviePlayer({ movie, onBack, seriesInfo, onEpisodeChange }: MoviePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  /** Geração da reprodução: qualquer callback antigo vira no-op ao trocar rápido de episódio/fonte. */
  const loadGenerationRef = useRef(0);
  
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
  /*
   * Qual das fontes do título está em uso.
   *
   * O catálogo entrega várias — idiomas diferentes e servidores diferentes — e
   * até aqui o player abria a primeira e pronto. Trocar exigia voltar à lista,
   * que é justamente o que não dá para fazer quando a tela mostra um aviso no
   * lugar do vídeo.
   */
  const [fonteIdx, setFonteIdx] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showExternalMenu, setShowExternalMenu] = useState(false);
  const [showEpisodeMenu, setShowEpisodeMenu] = useState(false);
  const [episodeMenuSeason, setEpisodeMenuSeason] = useState<number | null>(null);
  const [isPiP, setIsPiP] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [skipTime, setSkipTime] = useState(() => {
    const saved = localStorage.getItem('movie-skip-time');
    return saved ? parseInt(saved) : 10;
  });
  const [brightness, setBrightness] = useState(100);
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [trechoPulado, setTrechoPulado] = useState<Trecho | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'auto' | '16:9' | '4:3' | '21:9'>('auto');
  const [videoResolution, setVideoResolution] = useState<string | null>(null);
  const [qualityLevels, setQualityLevels] = useState<Array<{ id: number; label: string }>>([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; label: string }>>([]);
  const [selectedAudio, setSelectedAudio] = useState(-1);
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{ id: number; label: string }>>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
  
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

  /*
   * Endereço http não abre no site, e insistir só atrasa o aviso.
   *
   * O navegador recusa vídeo http dentro de uma página https, e o proxy, que
   * serviria de ponte, leva 403 desses servidores: eles recusam a faixa de IPs
   * da Cloudflare, onde o site mora. Foi medido em todas as fontes http do
   * catálogo, nenhuma passa — então o caminho é a aba separada, e ela aparece
   * de saída em vez de depois de um minuto de espera.
   */
  const fontes = useMemo(() => {
    if (!movie) return [];
    return movie.sources?.length ? movie.sources : [{ url: movie.url }];
  }, [movie]);

  const urlAtiva = fontes[fonteIdx]?.url ?? movie?.url ?? '';

  // Título novo recomeça pela fonte preferida, não pela que sobrou do anterior.
  useEffect(() => { setFonteIdx(0); }, [movie?.id]);

  const noDesktop = !(globalThis as { __SAIMO_DESKTOP__?: boolean }).__SAIMO_DESKTOP__;
  const soHttp = noDesktop && !!urlAtiva && urlAtiva.startsWith('http://');

  /** O servidor de uma fonte, que é o que distingue uma da outra na lista. */
  const servidorDe = (endereco: string) => {
    try { return new URL(endereco).hostname; } catch { return endereco.slice(0, 30); }
  };

  // Carregar vídeo quando movie/fonte mudar.
  //
  // A regra central é "a última escolha vence": cada execução recebe uma
  // geração. Eventos HLS, fetches e callbacks do vídeo de uma geração anterior
  // são ignorados. Isso elimina o erro fantasma que aparecia ao clicar E2, E3,
  // E4 rapidamente e receber depois a falha atrasada do E2.
  useEffect(() => {
    if (!movie || !videoRef.current || !urlAtiva) return;

    const geracao = ++loadGenerationRef.current;
    const atual = () => loadGenerationRef.current === geracao;
    const video = videoRef.current;
    const abortador = new AbortController();
    let hlsDaVez: Hls | null = null;
    let onLoadedMetadata: (() => void) | null = null;
    let erroNativoLigado = false;
    let tentouRecuperarMidia = false;

    const seguro = (acao: () => void) => {
      if (atual()) acao();
    };

    const salvarProgresso = () => {
      const tempo = video.currentTime;
      const duracao = video.duration;
      if (!Number.isFinite(tempo) || !Number.isFinite(duracao) || tempo <= 30 || duracao <= 0) return;
      const progresso = (tempo / duracao) * 100;
      if (progresso < 95) localStorage.setItem(`movie-progress-${movie.id}`, String(tempo));
      else localStorage.removeItem(`movie-progress-${movie.id}`);
      if (movie.origem) registrarAndamento(movie.origem, movie.name, tempo, duracao);
    };

    const carregarProgresso = () => {
      if (!atual()) return;
      const salvo = Number(localStorage.getItem(`movie-progress-${movie.id}`));
      if (Number.isFinite(salvo) && salvo > 0 && Number.isFinite(video.duration) && salvo < video.duration - 5) {
        video.currentTime = salvo;
      }
    };

    // O efeito anterior já salvou seu progresso no cleanup. Agora é seguro
    // desmontar qualquer mídia que ainda tenha ficado presa ao elemento.
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();

    setIsLoading(true);
    setError(null);
    setIsProxyBlocked(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setIsPlaying(false);
    setShowNextEpisodeButton(false);
    setQualityLevels([]);
    setSelectedQuality(-1);
    setAudioTracks([]);
    setSelectedAudio(-1);
    setSubtitleTracks([]);
    setSelectedSubtitle(-1);

    localStorage.setItem('current-movie-id', movie.id);

    if (soHttp) {
      setIsLoading(false);
      setIsProxyBlocked(true);
      setError('Este vídeo só existe em http.');
      return () => {
        if (atual()) loadGenerationRef.current += 1;
        abortador.abort();
        salvarProgresso();
      };
    }

    const url = getProxiedUrl(urlAtiva);
    const tituloMonitor = seriesInfo?.seriesName || movie.seriesName || movie.name;
    telemetria.comecou('vod', tituloMonitor, urlAtiva, 1);
    const abertura = { titulo: tituloMonitor, url: urlAtiva, desde: performance.now(), avisado: false, falhou: false };

    const avisarFalha = (detalhe: string) => {
      if (!atual() || abertura.falhou) return;
      abertura.falhou = true;
      telemetria.falhou('vod', abertura.titulo, abertura.url, 1, detalhe);
      if (!abertura.avisado) telemetria.caiu('vod', abertura.titulo, 1);
    };

    const tentarProximaFonte = (detalhe: string): boolean => {
      if (!atual() || fonteIdx >= fontes.length - 1) return false;
      console.info(`fonte ${fonteIdx + 1} de ${fontes.length} falhou (${detalhe}); tentando a seguinte`);
      // Falha de uma origem não derruba o título: tenta a próxima em silêncio.
      // Só a última fonte esgotada vira erro/telemetria de indisponibilidade.
      setError(null);
      setIsProxyBlocked(false);
      setIsLoading(true);
      setFonteIdx((indice) => indice === fonteIdx ? indice + 1 : indice);
      return true;
    };

    const reproduzir = () => {
      if (!atual()) return;
      video.play().catch(() => {
        if (!atual()) return;
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => { /* interação manual continua disponível */ });
      });
    };

    const handleGenericError = (event: Event) => {
      if (!atual()) return;
      const videoError = (event.currentTarget as HTMLVideoElement)?.error;
      const code = videoError?.code;
      if (tentarProximaFonte(`vídeo: código ${code ?? '?'}`)) return;

      setIsLoading(false);
      avisarFalha(`código ${code ?? '?'}`);
      let message = 'Não foi possível reproduzir este vídeo nas fontes disponíveis.';

      switch (code) {
        case 1: message = 'O carregamento foi cancelado.'; break;
        case 2: message = 'Erro de rede ao carregar as fontes disponíveis.'; break;
        case 3: message = 'O vídeo não pôde ser decodificado.'; break;
        case 4:
          if (needsProxy(urlAtiva)) {
            fetch(getProxiedUrl(urlAtiva), { method: 'HEAD', signal: abortador.signal })
              .then((resposta) => seguro(() => {
                if (resposta.status === 403) {
                  setIsProxyBlocked(true);
                  setError('O servidor recusou esta fonte. Tente outra fonte ou um player externo.');
                } else {
                  setError('Não foi possível reproduzir este vídeo nas fontes disponíveis.');
                }
              }))
              .catch((erro: unknown) => {
                if ((erro as { name?: string })?.name === 'AbortError') return;
                seguro(() => setError('Não foi possível reproduzir este vídeo nas fontes disponíveis.'));
              });
            return;
          }
          message = 'Formato de vídeo não suportado ou endereço inválido.';
          break;
      }
      console.log('[MoviePlayer Error]', { code, message, url: urlAtiva, geracao });
      setError(message);
    };

    if (isHls(urlAtiva) && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsDaVez = hls;
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => seguro(() => {
        setQualityLevels(hls.levels.map((level, id) => ({
          id,
          label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`,
        })));
        setAudioTracks(hls.audioTracks.map((track, id) => ({
          id,
          label: track.name || track.lang || `Áudio ${id + 1}`,
        })));
        setSubtitleTracks(hls.subtitleTracks.map((track, id) => ({
          id,
          label: track.name || track.lang || `Legenda ${id + 1}`,
        })));
        setDuration(Number.isFinite(video.duration) ? video.duration : 0);
        setIsLoading(false);
        carregarProgresso();
        reproduzir();
      }));

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => seguro(() => setSelectedAudio(data.id)));
      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_event, data) => seguro(() => setSelectedSubtitle(data.id)));

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!atual() || !data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (!tentarProximaFonte(`hls rede: ${data.details}`)) {
              avisarFalha(`hls rede: ${data.details}`);
              setIsLoading(false);
              setError('Erro de rede nas fontes disponíveis.');
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            if (!tentouRecuperarMidia) {
              tentouRecuperarMidia = true;
              hls.recoverMediaError();
            } else if (!tentarProximaFonte(`hls mídia: ${data.details}`)) {
              avisarFalha(`hls mídia: ${data.details}`);
              setIsLoading(false);
              setError('Erro de mídia nas fontes disponíveis.');
            }
            break;
          default:
            if (!tentarProximaFonte(`hls: ${data.details}`)) {
              avisarFalha(`hls: ${data.details}`);
              setError('Não foi possível reproduzir este vídeo nas fontes disponíveis.');
              setIsLoading(false);
            }
            break;
        }
      });
    } else {
      video.src = url;
      onLoadedMetadata = () => seguro(() => {
        setDuration(Number.isFinite(video.duration) ? video.duration : 0);
        setIsLoading(false);
        carregarProgresso();
        reproduzir();
      });
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', handleGenericError);
      erroNativoLigado = true;
      video.load();
    }

    const handleWaiting = () => seguro(() => setIsLoading(true));
    const handlePlaying = () => seguro(() => {
      if (!abertura.avisado) {
        abertura.avisado = true;
        telemetria.tocou('vod', abertura.titulo, abertura.url, 1, performance.now() - abertura.desde);
      }
      setIsLoading(false);
      setIsPlaying(true);
    });
    const handleCanPlay = () => seguro(() => setIsLoading(false));

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    window.addEventListener('beforeunload', salvarProgresso);

    return () => {
      // Invalida antes de desmontar: eventos disparados por pause/load/destroy
      // durante a limpeza já não conseguem mexer no episódio novo.
      if (atual()) loadGenerationRef.current += 1;
      abortador.abort();
      telemetria.parou();
      salvarProgresso();
      if (localStorage.getItem('current-movie-id') === movie.id) {
        localStorage.removeItem('current-movie-id');
      }

      if (hlsDaVez) hlsDaVez.destroy();
      if (hlsRef.current === hlsDaVez) hlsRef.current = null;
      if (onLoadedMetadata) video.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (erroNativoLigado) video.removeEventListener('error', handleGenericError);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      window.removeEventListener('beforeunload', salvarProgresso);
    };
  }, [movie, soHttp, urlAtiva, fonteIdx, fontes.length, seriesInfo?.seriesName]);


  const episodeIndex = useMemo(() => {
    if (!seriesInfo || !movie) return -1;
    return seriesInfo.episodes.findIndex((ep) => ep.id === movie.id);
  }, [seriesInfo, movie]);

  const previousEpisode = useMemo(() => {
    if (!seriesInfo || episodeIndex <= 0) return null;
    return seriesInfo.episodes[episodeIndex - 1] ?? null;
  }, [seriesInfo, episodeIndex]);

  const nextEpisode = useMemo(() => {
    if (!seriesInfo || episodeIndex < 0 || episodeIndex >= seriesInfo.episodes.length - 1) return null;
    return seriesInfo.episodes[episodeIndex + 1] ?? null;
  }, [seriesInfo, episodeIndex]);

  const episodiosPorTemporada = useMemo(() => {
    const mapa = new Map<number, Movie[]>();
    for (const episodio of seriesInfo?.episodes ?? []) {
      const numero = episodio.seasonNumber ?? 0;
      if (!mapa.has(numero)) mapa.set(numero, []);
      mapa.get(numero)!.push(episodio);
    }
    return [...mapa.entries()].sort(([a], [b]) => a - b);
  }, [seriesInfo]);

  useEffect(() => {
    if (!seriesInfo) {
      setShowEpisodeMenu(false);
      setEpisodeMenuSeason(null);
      return;
    }
    setEpisodeMenuSeason(movie?.seasonNumber ?? seriesInfo.currentSeason);
  }, [seriesInfo, movie?.seasonNumber]);

  // Atualizar tempo/buffer
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    /*
     * A duração só existe depois que o vídeo carrega os metadados.
     *
     * Era aqui a barra parada: com HLS, a duração era lida no MANIFEST_PARSED
     * do hls.js, e nesse instante `video.duration` ainda é NaN — o manifesto
     * foi lido, mas o vídeo ainda não. A largura da barra é
     * `currentTime / duration`, e com duração zero ela fica em zero para
     * sempre, por mais que o tempo ande.
     *
     * Perguntar ao próprio elemento de vídeo, quando ele avisa que sabe,
     * funciona para HLS e para MP4 sem distinção.
     */
    const handleDuration = () => {
      const d = video.duration;
      setDuration(Number.isFinite(d) && d > 0 ? d : 0);
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
    video.addEventListener('loadedmetadata', handleDuration);
    video.addEventListener('durationchange', handleDuration);
    video.addEventListener('progress', handleProgress);
    handleDuration();
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleDuration);
      video.removeEventListener('durationchange', handleDuration);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [movie, nextEpisode]);

  // Função para abrir em nova aba
  const openInNewTab = useCallback(() => {
    if (!movie) return;
    console.log('[openInNewTab] Abrindo:', urlAtiva);
    window.open(urlAtiva, '_blank');
  }, [movie, urlAtiva]);

  // Mostra botão de próximo episódio quando faltam 30 segundos
  useEffect(() => {
    if (!nextEpisode || !duration) return;
    
    // Sobe quando os créditos começam (TheIntroDB); sem marca, 30 s antes do fim.
    const creditos = inicioDosCreditos(trechos, duration) ?? (duration - 30);
    if (currentTime >= creditos && currentTime < duration) {
      setShowNextEpisodeButton(true);
    } else if (currentTime < creditos - 5) {
      setShowNextEpisodeButton(false);
    }
  }, [currentTime, duration, nextEpisode, trechos]);

  const trocarEpisodio = useCallback((episode: Movie | null) => {
    if (!episode || !onEpisodeChange) return;
    setShowEpisodeMenu(false);
    setShowNextEpisodeButton(false);
    onEpisodeChange(episode);
  }, [onEpisodeChange]);

  const handleNextEpisode = useCallback(() => trocarEpisodio(nextEpisode), [nextEpisode, trocarEpisodio]);
  const handlePreviousEpisode = useCallback(() => trocarEpisodio(previousEpisode), [previousEpisode, trocarEpisodio]);

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

  // Abertura, recapitulação e créditos marcados no TheIntroDB, pelo id do
  // TMDB. Sem marca para o título, o botão não aparece.
  useEffect(() => {
    let vivo = true;
    buscarPulos(movie?.tmdbId, movie?.seasonNumber ?? 0, movie?.episodeNumber ?? 0)
      .then((t) => { if (vivo) setTrechos(t); });
    return () => { vivo = false; };
  }, [movie?.tmdbId, movie?.seasonNumber, movie?.episodeNumber]);
  const trechoAtual = trechoEm(trechos, currentTime, duration);
  const showSkipIntro = !!trechoAtual && trechoAtual !== trechoPulado;

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
        const label = height >= 2160 ? '4K'
          : height >= 1440 ? '2K'
          : height >= 1080 ? '1080p'
          : height >= 720 ? '720p'
          : height >= 480 ? '480p'
          : height >= 360 ? '360p'
          : `${height}p`;
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
      urlAtiva,
      movie.name,
      videoRef.current || undefined,
      undefined // movie image
    );

    setCastMessage(result.message);
    setTimeout(() => setCastMessage(null), 4000);
    
    if (result.success || method === 'copyLink' || method === 'share') {
      setShowCastModal(false);
    }
  }, [movie, urlAtiva]);

  const handleCastExternalPlayer = useCallback((playerUrl: string) => {
    castService.openInExternalPlayer(playerUrl);
    setCastMessage('Abrindo player externo...');
    setTimeout(() => setCastMessage(null), 3000);
    setShowExternalCastPlayers(false);
    setShowCastModal(false);
  }, []);

  // Pula até o fim do trecho marcado (abertura, recapitulação ou prévia).
  const skipIntro = useCallback(() => {
    const video = videoRef.current;
    if (!video || !trechoAtual) return;
    video.currentTime = Math.min(video.duration, trechoAtual.fim ?? video.duration);
    setTrechoPulado(trechoAtual);
  }, [trechoAtual]);

  useMediaSession({
    titulo: movie?.name,
    subtitulo: seriesInfo?.seriesName ?? 'Saimo TV',
    capa: movie?.origem?.capa || undefined,
    aoTocar: () => { void videoRef.current?.play(); },
    aoPausar: () => videoRef.current?.pause(),
    aoVoltar: () => seek(-10),
    aoAvancar: () => seek(10),
    aoProximo: nextEpisode ? handleNextEpisode : undefined,
    aoAnterior: previousEpisode ? handlePreviousEpisode : undefined,
  });

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
        case 'n':
          if (nextEpisode) {
            e.preventDefault();
            handleNextEpisode();
          }
          break;
        case 'b':
          if (previousEpisode) {
            e.preventDefault();
            handlePreviousEpisode();
          }
          break;
        case 'e':
          if (seriesInfo) {
            e.preventDefault();
            setShowEpisodeMenu((aberto) => !aberto);
          }
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
          if (showEpisodeMenu) {
            setShowEpisodeMenu(false);
          } else if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onBack();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onBack, skipTime, togglePiP, toggleCast, skipIntro, togglePlay, seek, toggleFullscreen, nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode, seriesInfo, showEpisodeMenu]);

  /*
   * Arrastar e clicar na barra.
   *
   * Clicar só pausava: o container do player inteiro tem um `onClick` que
   * alterna play/pause, e o clique da barra subia até ele. O `stopPropagation`
   * abaixo é o que separa "mexer no controle" de "tocar no vídeo".
   *
   * E arrastar não existia — havia só um `onClick`. Com ponteiro capturado, o
   * dedo ou o mouse pode sair da barra durante o arraste sem soltar o controle,
   * que é como toda barra se comporta e o que a pessoa tenta fazer primeiro.
   */
  const [arrastando, setArrastando] = useState(false);

  const posicaoDoEvento = useCallback((clientX: number) => {
    const progress = progressRef.current;
    if (!progress) return null;
    const rect = progress.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const irPara = useCallback((clientX: number) => {
    const video = videoRef.current;
    const fracao = posicaoDoEvento(clientX);
    if (!video || fracao == null) return;
    const total = video.duration;
    if (!Number.isFinite(total) || total <= 0) return;
    video.currentTime = fracao * total;
    setCurrentTime(video.currentTime);
  }, [posicaoDoEvento]);

  const aoPegarBarra = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastando(true);
    irPara(e.clientX);
  }, [irPara]);

  const aoArrastarBarra = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando) return;
    e.stopPropagation();
    irPara(e.clientX);
  }, [arrastando, irPara]);

  const aoSoltarBarra = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando) return;
    e.stopPropagation();
    irPara(e.clientX);
    setArrastando(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, [arrastando, irPara]);

  const handleRetry = useCallback(() => {
    if (videoRef.current && movie) {
      setError(null);
      setIsProxyBlocked(false);
      setIsLoading(true);
      // This will trigger the main useEffect to re-run and attempt to load the source again.
      // A more direct way would be to call a "load" function, but this is simpler with the current structure.
      const video = videoRef.current;
      if (hlsRef.current) {
        hlsRef.current.loadSource(getProxiedUrl(urlAtiva));
      } else {
        video.load();
      }
    }
  }, [movie, urlAtiva]);

  // Abrir em player externo
  const openInExternalPlayer = useCallback((player: string) => {
    if (!movie) return;
    
    let url = '';
    switch (player) {
      case 'vlc':
        url = `vlc://${urlAtiva}`;
        break;
      case 'mx':
        url = `intent:${urlAtiva}#Intent;package=com.mxtech.videoplayer.ad;end`;
        break;
      case 'iina':
        url = `iina://open?url=${encodeURIComponent(urlAtiva)}`;
        break;
      case 'potplayer':
        url = `potplayer://${urlAtiva}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(urlAtiva).then(() => {
          // Feedback visual poderia ser adicionado aqui
        });
        return;
      case 'newtab':
        window.open(urlAtiva, '_blank');
        return;
    }
    
    if (url) {
      window.location.href = url;
    }
  }, [movie, urlAtiva]);

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
          data-monitor="1"
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
          {trechoAtual ? rotuloTrecho[trechoAtual.tipo] : 'Pular abertura'}
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
        <div className={`player-overlay error${isProxyBlocked ? ' aviso' : ''}`}
             onClick={(e) => e.stopPropagation()}>
          {isProxyBlocked ? (
            <>
              <svg className="aviso-icone" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <h3>Este vídeo toca numa página separada</h3>
              <p className="aviso-texto">
                {soHttp
                  ? 'O endereço dele é http, e o navegador não deixa um vídeo assim tocar dentro de uma página segura. Fora daqui ele abre normalmente.'
                  : 'O servidor deste vídeo não aceita o caminho que o site usa. Fora daqui ele abre normalmente.'}
              </p>
              <button
                className="aviso-botao"
                onClick={openInNewTab}
                data-focusable="true"
                data-nav-group="error-actions"
                autoFocus
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Abrir numa página separada
              </button>
              <div className="aviso-app">
                <div>
                  <strong>No aplicativo, isso nem aparece.</strong>
                  <span>
                    No Saimo TV para Windows, Mac, Android e TV Box o vídeo abre direto, em
                    qualquer fonte, sem essa volta — e os filmes em 4K tocam na maior resolução.
                  </span>
                </div>
                <a href={rota('/app')} className="aviso-app-botao" data-focusable="true">
                  Baixar o aplicativo
                </a>
              </div>

              {fontes.length > 1 && (
                <div className="aviso-fontes">
                  <p>Ou troque a fonte deste título:</p>
                  <div className="aviso-fontes-lista">
                    {fontes.map((fonte, indice) => (
                      <button
                        key={fonte.url}
                        className={indice === fonteIdx ? 'atual' : undefined}
                        onClick={() => setFonteIdx(indice)}
                        data-focusable="true"
                        data-nav-group="aviso-fontes"
                        title={fonte.url}
                      >
                        <strong>{fonte.versao === 'leg' ? 'Legendado' : 'Dublado'}</strong>
                        <span>{servidorDe(fonte.url)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="error-actions">
                <button
                  onClick={() => openInExternalPlayer('copy')}
                  data-focusable="true"
                  data-nav-group="error-actions"
                >
                  📋 Copiar endereço
                </button>
              </div>
              <div className="external-players" style={{ marginTop: 0 }}>
                <p>Ou abrir em player externo:</p>
                <div className="player-buttons">
                  <button
                    onClick={() => openInExternalPlayer('vlc')}
                    title="VLC Media Player"
                    data-focusable="true"
                    data-nav-group="external-players"
                  >
                    VLC
                  </button>
                  <button
                    onClick={() => openInExternalPlayer('iina')}
                    title="IINA (macOS)"
                    data-focusable="true"
                    data-nav-group="external-players"
                  >
                    IINA
                  </button>
                  <button
                    onClick={() => openInExternalPlayer('potplayer')}
                    title="PotPlayer"
                    data-focusable="true"
                    data-nav-group="external-players"
                  >
                    PotPlayer
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

      {showEpisodeMenu && seriesInfo && (
        <div className="episode-browser-backdrop" onClick={() => setShowEpisodeMenu(false)}>
          <aside className="episode-browser" onClick={(e) => e.stopPropagation()} aria-label="Escolher episódio">
            <header className="episode-browser-header">
              <div>
                <span>Episódios</span>
                <h3>{seriesInfo.seriesName}</h3>
              </div>
              <button onClick={() => setShowEpisodeMenu(false)} aria-label="Fechar episódios">×</button>
            </header>
            <nav className="episode-browser-seasons" aria-label="Temporadas">
              {episodiosPorTemporada.map(([numero, eps]) => (
                <button
                  key={numero}
                  className={episodeMenuSeason === numero ? 'active' : undefined}
                  onClick={() => setEpisodeMenuSeason(numero)}
                >
                  Temporada {numero} <small>{eps.length}</small>
                </button>
              ))}
            </nav>
            <div className="episode-browser-list">
              {(episodiosPorTemporada.find(([numero]) => numero === episodeMenuSeason)?.[1] ?? []).map((episodio) => {
                const ativo = episodio.id === movie.id;
                return (
                  <button
                    key={episodio.id}
                    className={ativo ? 'active' : undefined}
                    onClick={() => trocarEpisodio(episodio)}
                    disabled={ativo}
                  >
                    <span className="episode-browser-play">{ativo ? '●' : '▶'}</span>
                    <span className="episode-browser-copy">
                      <strong>Episódio {episodio.episodeNumber ?? '?'}</strong>
                      <small>{episodio.sources?.length ?? 1} fonte{(episodio.sources?.length ?? 1) === 1 ? '' : 's'}</small>
                    </span>
                    {ativo && <em>Reproduzindo</em>}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {/* Next Episode Overlay - Aparece nos últimos 30 segundos ou quando o vídeo termina */}
      {showNextEpisodeButton && nextEpisode && (
        <div className="next-episode-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="next-episode-card">
            <div className="next-episode-info">
              <span className="next-label">Próximo episódio</span>
              <h4>{nextEpisode.name}</h4>
              <span className="next-episode-number">
                T{nextEpisode.seasonNumber ?? '?'} · E{nextEpisode.episodeNumber ?? '?'}
              </span>
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
      {/* Com erro na tela os controles ficam à vista: é por eles que se volta. */}
      <div className={`player-controls ${showControls || error ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
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
            <h2>{seriesInfo?.seriesName ?? movie.name}</h2>
            <span className="movie-category">
              {seriesInfo
                ? `Temporada ${movie.seasonNumber ?? seriesInfo.currentSeason} · Episódio ${movie.episodeNumber ?? seriesInfo.currentEpisode}`
                : movie.category}
            </span>
          </div>
          <div className="top-actions">
            {seriesInfo && (
              <button
                className={`control-btn episodes-menu-btn${showEpisodeMenu ? ' active' : ''}`}
                onClick={() => setShowEpisodeMenu((aberto) => !aberto)}
                title="Episódios (E)"
                data-focusable="true"
                data-nav-group="player-top"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M8 9h8M8 13h8M8 17h5" />
                </svg>
              </button>
            )}
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
        <div className="controls-bottom" onClick={(e) => e.stopPropagation()}>
          {/* Progress bar */}
          <div
            className="progress-container"
            ref={progressRef}
            role="slider"
            aria-label="Progresso"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            onPointerDown={aoPegarBarra}
            onPointerMove={aoArrastarBarra}
            onPointerUp={aoSoltarBarra}
            onPointerCancel={aoSoltarBarra}
            onClick={(e) => e.stopPropagation()}
          >
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

              {/* Previous Episode Button */}
              {previousEpisode && (
                <button
                  className="control-btn prev-ep-btn"
                  onClick={handlePreviousEpisode}
                  title="Episódio anterior (B)"
                  data-focusable="true"
                  data-nav-group="player-controls"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 6v12l-8.5-6L18 6zM6 6h2v12H6V6z"/>
                  </svg>
                </button>
              )}

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
                      <label>Qualidade</label>
                      <select
                        value={selectedQuality}
                        onChange={(e) => {
                          const level = Number(e.target.value);
                          setSelectedQuality(level);
                          if (hlsRef.current) hlsRef.current.currentLevel = level;
                        }}
                        data-focusable="true"
                        data-nav-group="settings-menu"
                      >
                        <option value={-1}>Automática</option>
                        {qualityLevels.map((level) => (
                          <option key={level.id} value={level.id}>{level.label}</option>
                        ))}
                      </select>
                    </div>
                    {audioTracks.length > 0 && (
                      <div className="settings-section">
                        <label>Idioma do áudio</label>
                        <select
                          value={selectedAudio}
                          onChange={(e) => {
                            const track = Number(e.target.value);
                            setSelectedAudio(track);
                            if (hlsRef.current) hlsRef.current.audioTrack = track;
                          }}
                          data-focusable="true"
                          data-nav-group="settings-menu"
                        >
                          {audioTracks.map((track) => (
                            <option key={track.id} value={track.id}>{track.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="settings-section">
                      <label>Legendas</label>
                      <select
                        value={selectedSubtitle}
                        onChange={(e) => {
                          const track = Number(e.target.value);
                          setSelectedSubtitle(track);
                          if (hlsRef.current) {
                            hlsRef.current.subtitleDisplay = track >= 0;
                            hlsRef.current.subtitleTrack = track;
                          }
                        }}
                        data-focusable="true"
                        data-nav-group="settings-menu"
                      >
                        <option value={-1}>Desligadas</option>
                        {subtitleTracks.map((track) => (
                          <option key={track.id} value={track.id}>{track.label}</option>
                        ))}
                      </select>
                    </div>
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
                  {movie && castService.getExternalPlayerLinks(urlAtiva).map((player) => (
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
