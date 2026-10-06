import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { EventsModal } from "./EventsModal";
import { rota } from '../utils/rotas';
import { useMediaSession } from '../hooks/useMediaSession';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import type { Channel, ChannelSource } from '../types/channel';
import { ProgramInfo } from './ProgramInfo';
import castService, { type CastMethod, type CastState } from '../services/castService';
import { buildAttempts, isDash, isMpegTs, marcarSemCors, type Attempt } from '../utils/streamUrl';
import { makeNestedPathLoader } from '../utils/hlsLoader';
import { playDash, type DashHandle } from '../services/dashPlayer';
import * as telemetria from '../services/telemetria';
import './VideoPlayer.css';
import './AvisoApp.css';

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
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const dashRef = useRef<DashHandle | null>(null);
  /** Para o monitor: qual abertura é esta e se ela já avisou que tocou. */
  const aberturaRef = useRef('');
  const tentativaRef = useRef<{ titulo: string; url: string; fonte: number; desde: number; avisado: boolean } | null>(null);
  
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
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [castMessage, setCastMessage] = useState<string | null>(null);
  const [showExternalPlayers, setShowExternalPlayers] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [videoResolution, setVideoResolution] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  const maxRecoveryAttempts = 3;

  /*
   * As fontes do canal, HTTPS primeiro e depois na ordem publicada. Um canal antigo, guardado antes de
   * o site ler o catálogo com várias fontes, ainda chega só com `url` — daí a
   * lista de uma fonte só como piso.
   */
  const attempts = useMemo<Attempt[]>(() => {
    if (!channel) return [];
    const sources: ChannelSource[] = channel.sources?.length
      ? channel.sources
      : channel.url ? [{ url: channel.url }] : [];
    return buildAttempts(sources);
  }, [channel]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  /*
   * Uma linha por fonte publicada, não por tentativa: cada fonte rende até
   * duas entradas em `attempts` (direta e via proxy), e quem escolhe manualmente
   * quer ver "as fontes do canal", não os bastidores de como cada uma é tentada.
   */
  const fontes = useMemo(() => {
    const vistas = new Set<string>();
    const out: { source: Attempt['source']; indiceTentativa: number }[] = [];
    attempts.forEach((a, indiceTentativa) => {
      if (vistas.has(a.source.url)) return;
      vistas.add(a.source.url);
      out.push({ source: a.source, indiceTentativa });
    });
    return out;
  }, [attempts]);

  // A tentativa ativa pode estar no meio do fallback proxy de uma fonte; a
  // fonte "ativa" é a última cujo bloco já começou.
  const fontePos = fontes.reduce(
    (melhor, f, i) => (f.indiceTentativa <= sourceIndex ? i : melhor), 0,
  );

  /*
   * A primeira fonte http do canal. Numa página https o navegador bloqueia
   * vídeo http, e quando nem o proxy consegue buscá-la não há o que fazer aqui
   * dentro — mas aberta numa aba própria ela toca, porque ali não há página
   * https em volta para bloquear.
   */
  const fonteHttp = useMemo(() => {
    const atual = fontes[fontePos]?.source.url;
    if (atual?.startsWith('http://')) return atual;
    return fontes.find((f) => f.source.url.startsWith('http://'))?.source.url ?? null;
  }, [fontes, fontePos]);

  /*
   * Fonte http não abre no site, ponto.
   *
   * O navegador recusa vídeo http dentro de uma página https, e o proxy, que
   * existe justamente para contornar isso, leva 403 desses CDNs: eles recusam a
   * faixa de IPs da Cloudflare, onde o site mora. Medido em todas as fontes
   * http do catálogo — nenhuma passa. Então não vale gastar doze segundos de
   * relógio em cada uma antes de dizer o que já se sabe: o caminho é a aba
   * separada, e o aviso aparece de saída.
   */
  const tentavel = useCallback(
    (a: Attempt | undefined) => !!a && !a.source.url.startsWith('http://'),
    [],
  );
  const semCaminhoNoSite = attempts.length > 0 && !attempts.some(tentavel);

  const abrirEmAbaSeparada = useCallback(() => {
    if (!fonteHttp) return;
    window.open(fonteHttp, '_blank', 'noopener,noreferrer');
  }, [fonteHttp]);

  const escolherFonte = useCallback((pos: number) => {
    const alvo = fontes[pos];
    if (!alvo) return;
    setSourceIndex(alvo.indiceTentativa);
    setReloadTick((t) => t + 1);
    setShowSources(false);
  }, [fontes]);

  // Trocar de canal recomeça pela fonte preferida, não pela que sobrou da última.
  useEffect(() => {
    setSourceIndex(0);
    if (!channel) telemetria.parou();
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => telemetria.parou(), []);

  /*
   * Reprodução do canal, uma fonte por vez.
   *
   * O catálogo publica várias fontes por canal em ordem de preferência, e é essa
   * descida que faz um canal continuar no ar quando o primeiro servidor cai —
   * exatamente o que o aplicativo faz. Cada tipo de fonte pede um caminho: DASH
   * cifrado vai para o Shaka com a chave do catálogo, playlist HLS para o
   * hls.js, e fluxo MPEG-TS cru para o mpegts.js, que é o único que abre vídeo
   * sem playlist nenhuma.
   */
  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;

    /*
     * Encerra o que estava tocando antes de desistir do canal novo.
     *
     * Sem isto o canal anterior continua no mesmo elemento de vídeo, e os
     * eventos dele — que limpam o erro assim que há imagem — apagavam o aviso
     * um instante depois de ele aparecer.
     */
    const encerrar = () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (mpegtsRef.current) { mpegtsRef.current.destroy(); mpegtsRef.current = null; }
      if (dashRef.current) { dashRef.current.destroy(); dashRef.current = null; }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    if (semCaminhoNoSite) {
      encerrar();
      setError('Canal só disponível por http.');
      setIsLoading(false);
      return;
    }
    const attempt = attempts[sourceIndex];
    if (!attempt) {
      encerrar();
      setError('Nenhuma fonte disponível para este canal.');
      setIsLoading(false);
      return;
    }
    // Fonte http: anda até a próxima que dá para abrir; não havendo, o aviso.
    if (!tentavel(attempt)) {
      const seguinte = attempts.findIndex((a, i) => i > sourceIndex && tentavel(a));
      if (seguinte !== -1) { setSourceIndex(seguinte); return; }
      encerrar();
      setError('Esta fonte é http.');
      setIsLoading(false);
      return;
    }
    const { source, url, viaProxy } = attempt;

    // Monitor: trocar de canal ou escolher fonte à mão é uma abertura; descer
    // para a próxima tentativa depois de uma falha, não.
    const urlsDasFontes = [...new Set(attempts.map((a) => a.source.url))];
    const posicaoDaFonte = urlsDasFontes.indexOf(source.url) + 1;
    const chaveAbertura = `${channel.id}|${reloadTick}`;
    telemetria.comecou('live', channel.name, source.url, posicaoDaFonte, aberturaRef.current !== chaveAbertura);
    aberturaRef.current = chaveAbertura;
    tentativaRef.current = { titulo: channel.name, url: source.url, fonte: posicaoDaFonte, desde: performance.now(), avisado: false };

    let cancelado = false;

    /*
     * Prova de vida da fonte, do jeito que quem assiste vê: o relógio do vídeo
     * andando. Enquanto ele anda há imagem na tela, e não importa quantos erros
     * o player tenha cuspido no caminho — CDN devolvendo 5xx solto, segmento
     * perdido, wi-fi do box oscilando. Era isso que faltava: o player contava
     * erros e trocava de fonte com o canal vivo, e quem estava assistindo
     * levava um corte a cada tropeço da rede.
     */
    let tocou = false;
    let ultimoTempo = -1;
    let ultimoAvanco = performance.now();
    /** Como pedir a esta fonte que volte sozinha, sem trocar de origem. */
    let retomar: (() => void) | null = null;

    const marcarAvanco = () => {
      const t = video.currentTime;
      if (t > ultimoTempo + 0.2) {
        ultimoTempo = t;
        ultimoAvanco = performance.now();
        tocou = true;
        recoveryAttemptsRef.current = 0;
      }
    };
    video.addEventListener('timeupdate', marcarAvanco);

    /*
     * Relógio de segurança da tentativa.
     *
     * Falhar é fácil de tratar; ficar preso não. O hls.js engole um bloqueio de
     * CORS nas próprias retentativas e nunca chama o handler de erro, e foi
     * assim que os canais da Pluto ficaram carregando para sempre no site: o
     * navegador recusa o acesso direto, o player insiste sozinho e a fonte pelo
     * proxy, que funcionaria, nunca chega a ser tentada. Doze segundos sem
     * imagem contam como fonte morta, o mesmo prazo que o aplicativo do Mac usa.
     */
    let relogio: number | undefined;
    const pararRelogio = () => {
      if (relogio !== undefined) { window.clearTimeout(relogio); relogio = undefined; }
    };
    setIsLoading(true);
    setError(null);
    recoveryAttemptsRef.current = 0;

    const limpar = () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (mpegtsRef.current) { mpegtsRef.current.destroy(); mpegtsRef.current = null; }
      if (dashRef.current) { dashRef.current.destroy(); dashRef.current = null; }
    };
    limpar();

    /** Desce para a fonte seguinte; só vira erro quando acabaram todas. */
    const descer = (motivo: string) => {
      if (cancelado) return;
      pararRelogio();
      // A tentativa direta que cai para a mesma fonte pelo proxy é bastidor,
      // não falha do servidor — contá-la sujaria a taxa de falha dele.
      if (attempts[sourceIndex + 1]?.source.url !== source.url) {
        telemetria.falhou('live', channel.name, source.url, posicaoDaFonte, motivo);
      }
      // Falhou direto e existe a mesma fonte pelo proxy: da próxima vez começa
      // por ela, em vez de gastar o relógio de novo no mesmo tropeço.
      if (!viaProxy) marcarSemCors(source.url);
      // Pula o que não tem como abrir aqui: uma fonte http adiante não é uma
      // chance a mais, é mais doze segundos de espera pelo mesmo aviso.
      const seguinte = attempts.findIndex((a, i) => i > sourceIndex && tentavel(a));
      if (seguinte !== -1) {
        console.warn(`[VideoPlayer] tentativa ${sourceIndex + 1}/${attempts.length} falhou (${motivo}), indo para a próxima`);
        setSourceIndex(seguinte);
        return;
      }
      telemetria.caiu('live', channel.name, urlsDasFontes.length);
      setError('Erro ao carregar o canal. Tente novamente.');
      setIsLoading(false);
    };

    /*
     * Quanto tempo de tela congelada conta como fonte caída.
     *
     * Vinte e cinco segundos é muito de propósito. Quem está assistindo
     * prefere um engasgo longo, que quase sempre volta sozinho, a ser jogado
     * para outra origem — que recomeça do zero, com outro áudio e outro ponto
     * da programação, e às vezes nem é melhor que a de onde saiu.
     */
    const SEM_IMAGEM_MS = 25_000;

    /**
     * Um erro só derruba a fonte quando ela parou de entregar imagem.
     *
     * Enquanto o relógio do vídeo anda, o erro foi um tropeço: o player desta
     * fonte é chamado de volta e ninguém na sala percebe. Só o silêncio longo
     * é queda.
     */
    const falhar = (motivo: string) => {
      if (cancelado) return;
      if (tocou && performance.now() - ultimoAvanco < SEM_IMAGEM_MS) {
        console.warn(`[VideoPlayer] ${motivo} — o vídeo ainda anda, recuperando sem trocar de fonte`);
        retomar?.();
        return;
      }
      descer(motivo);
    };

    relogio = window.setTimeout(() => falhar('sem imagem em 12 s'), 12_000);

    // Depois que a fonte tocou, quem decide se ela caiu é a tela parada, não a
    // contagem de erros: um canal vivo com rede ruim dispara erro sem parar.
    const vigia = window.setInterval(() => {
      if (cancelado || !tocou) return;
      if (video.paused) { ultimoAvanco = performance.now(); return; }
      if (performance.now() - ultimoAvanco > SEM_IMAGEM_MS) {
        descer('imagem parada por 25 s');
      }
    }, 2_000);

    const tocar = () => {
      if (cancelado || !videoRef.current) return;
      pararRelogio();
      const vid = videoRef.current;
      vid.volume = volumeRef.current;
      vid.play().catch(() => {
        // Autoplay com som é bloqueado até a pessoa interagir com a página;
        // começar mudo e desmutar no primeiro clique é melhor que não começar.
        vid.muted = true;
        setIsMuted(true);
        setPendingUnmute(true);
        vid.play().catch(() => { /* aguarda interação */ });
      });
    };

    if (isDash(source.url)) {
      playDash(video, url, source, falhar)
        .then((handle) => {
          if (cancelado) { handle.destroy(); return; }
          dashRef.current = handle;
          setIsLoading(false);
          tocar();
        })
        .catch((e) => falhar(e instanceof Error ? e.message : 'dash'));
    } else if (isMpegTs(source.url) && mpegts.isSupported()) {
      const player = mpegts.createPlayer(
        { type: 'mpegts', isLive: true, url, cors: true },
        { enableWorker: true, lazyLoadMaxDuration: 3 * 60, seekType: 'range' },
      );
      player.attachMediaElement(video);
      player.load();
      retomar = () => { try { player.load(); } catch { /* o vigia decide depois */ } };
      player.on(mpegts.Events.ERROR, (type, details) => {
        if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
          recoveryAttemptsRef.current++;
          if (recoveryAttemptsRef.current > maxRecoveryAttempts) falhar(`rede: ${details}`);
          else player.load();
        } else {
          falhar(`mpegts: ${details}`);
        }
      });
      video.addEventListener('canplay', () => { setIsLoading(false); tocar(); }, { once: true });
      mpegtsRef.current = player;
      tocar();
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        // Pela origem, quem monta o endereço do segmento é o hls.js, e alguns
        // canais guardam os segmentos noutra pasta. Passando pelo proxy a
        // correção já veio feita no manifesto.
        ...(viaProxy ? {} : { loader: makeNestedPathLoader(url) }),
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      retomar = () => { try { hls.startLoad(); } catch { /* o vigia decide depois */ } };

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        recoveryAttemptsRef.current = 0;
        video.muted = false;
        tocar();
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        recoveryAttemptsRef.current++;
        if (recoveryAttemptsRef.current > maxRecoveryAttempts) {
          falhar(`hls: ${data.details}`);
          return;
        }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else falhar(`hls: ${data.details}`);
      });

      // Um fragmento que chegou apaga o erro anterior: a recuperação funcionou.
      hls.on(Hls.Events.FRAG_LOADED, () => { setError(null); recoveryAttemptsRef.current = 0; });
      hls.on(Hls.Events.LEVEL_LOADED, () => { setError(null); recoveryAttemptsRef.current = 0; });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.muted = false;
        tocar();
      }, { once: true });
      video.addEventListener('error', () => falhar('safari'), { once: true });
    } else {
      setError('Seu navegador não suporta reprodução de vídeo.');
      setIsLoading(false);
    }

    return () => {
      cancelado = true;
      pararRelogio();
      window.clearInterval(vigia);
      video.removeEventListener('timeupdate', marcarAvanco);
      limpar();
    };
  }, [channel, attempts, sourceIndex, reloadTick, semCaminhoNoSite, tentavel]);

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
    };
    const handlePause = () => {
      setIsPlaying(false);
      // Ao vivo não fica parado: qualquer pausa (fones, tela de bloqueio,
      // janela flutuante) volta a tocar.
      if (channel && video.readyState >= 2) {
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
      if (video.paused && channel) {
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
      const t = tentativaRef.current;
      if (t && !t.avisado) {
        t.avisado = true;
        telemetria.tocou('live', t.titulo, t.url, t.fonte, performance.now() - t.desde);
      }
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
  // TV ao vivo não pausa: o único comando é voltar a tocar, para quando o
  // navegador barrou o play automático.
  const retomar = useCallback(() => {
    void videoRef.current?.play().catch(() => {});
  }, []);

  useMediaSession({
    titulo: channel?.name,
    subtitulo: 'Ao vivo · Saimo TV',
    capa: channel?.logo,
    aoTocar: retomar,
    // Pausar pelos fones ou pela tela de bloqueio também não para o ao vivo.
    aoPausar: retomar,
  });

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
    if (!channel) return;
    setError(null);
    setIsLoading(true);
    // Recomeça pela fonte preferida: a que falhou pode ter voltado, e o tique
    // garante o recarregamento mesmo quando o índice já era zero.
    setSourceIndex(0);
    setReloadTick((t) => t + 1);
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
  }, [resetControlsTimeout, toggleFullscreen, toggleMute, toggleCast]);

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
            onOpenEvents={() => setShowEventsModal(true)}
          />

          <video
            ref={videoRef}
            data-monitor="1"
            className={`video-element ${isMirrored ? 'mirrored' : ''}`}
            playsInline
            onClick={handleVideoClick}
            onDoubleClick={handleVideoDoubleClick}
          />

          {/* Só aparece se o navegador barrou o play automático: ao vivo
              não tem pausa. */}
          {!isPlaying && !isLoading && !error && (
            <button
              className="center-play-btn"
              onClick={() => { resetControlsTimeout(); retomar(); }}
              data-focusable="true"
              data-focus-key="btn-play-center"
              aria-label="Assistir"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
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

          {error && fonteHttp && (
            <div className="error-overlay http-overlay" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8M12 17v4M9 9l6 4M15 9l-6 4" />
              </svg>
              <h2>Este canal toca numa página separada</h2>
              <p className="http-explica">
                O endereço dele é <strong>http</strong>, e o navegador não deixa um vídeo assim tocar
                dentro de uma página segura. <strong>Fora daqui ele abre normalmente.</strong>
              </p>
              <button
                onClick={abrirEmAbaSeparada}
                className="http-open-btn"
                data-focusable="true"
                data-focus-key="btn-abrir-http"
                autoFocus
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Abrir {channel.name} numa página separada
              </button>
              <p className="http-dica">
                Se o navegador baixar um arquivo em vez de tocar, abra esse arquivo no VLC.
              </p>
              <div className="aviso-app">
                <div>
                  <strong>No aplicativo, este canal abre normalmente.</strong>
                  <span>
                    O Saimo TV para Windows, Mac, Android e TV Box fala direto com o servidor do
                    canal, então não esbarra no bloqueio que existe aqui dentro do navegador.
                  </span>
                </div>
                <a href={rota('/app')} className="aviso-app-botao" data-focusable="true">
                  Baixar o aplicativo
                </a>
              </div>
              <button onClick={retryLoad} className="retry-btn retry-btn-secundario">
                Tentar de novo aqui
              </button>
            </div>
          )}

          {error && !fonteHttp && (
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
              {fontes.length > 1 && (
                <button
                  className={`control-btn ${showSources ? 'active' : ''}`}
                  onClick={() => { resetControlsTimeout(); setShowSources((v) => !v); }}
                  title={`Fontes do canal (${fontes.length} publicadas)`}
                  data-focusable="true"
                  data-focus-key="btn-sources"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
              )}

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

          {/* Fontes publicadas para este canal */}
          {showSources && (
            <div className="cast-modal-overlay" onClick={() => setShowSources(false)}>
              <div className="cast-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Fontes de "{channel.name}"</h3>
                <p>
                  {fontes.length} publicadas no catálogo, na ordem em que o player tenta.
                  Escolha uma para forçar o canal a tocar por ela.
                </p>

                <div className="cast-options">
                  {fontes.map((f, pos) => {
                    let host = f.source.url;
                    try { host = new URL(f.source.url).hostname; } catch { /* mantém a url crua */ }
                    const extras = [
                      f.source.keyId ? 'DRM' : null,
                      f.source.referer ? 'com Referer' : null,
                      f.source.url.startsWith('http://') ? 'HTTP' : null,
                    ].filter(Boolean).join(' · ');
                    return (
                      <button
                        key={f.source.url}
                        className={`cast-option ${pos === fontePos ? 'active' : ''}`}
                        onClick={() => escolherFonte(pos)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <path d="M8 21h8M12 17v4" />
                        </svg>
                        <span>Fonte {pos + 1} · {f.source.quality || 'Qualidade não informada'}{pos === fontePos ? ' (em uso)' : ''}</span>
                        <small>{host}{extras ? ` · ${extras}` : ''}</small>
                      </button>
                    );
                  })}
                </div>

                <button className="cast-modal-close" onClick={() => setShowSources(false)}>
                  Fechar
                </button>
              </div>
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

      {showEventsModal && (
        <EventsModal 
          onClose={() => setShowEventsModal(false)}
          onWatch={(slug) => {
            // Find channel and select it
            // Wait, we don't have a direct way to select channel from VideoPlayer except if we rely on App/TVPage.
            // But wait, the previous logic used navigate('/tv') + localStorage.
            // Since we're ALREADY in /tv, we can just update localStorage and trigger a reload,
            // or we need to pass a callback to VideoPlayer to change channel.
            // Actually, setting localStorage and reloading the page is a quick hack,
            // but TVPage listens to `canalEscolhido`.
            localStorage.setItem('tv-last-channel', slug);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
});
