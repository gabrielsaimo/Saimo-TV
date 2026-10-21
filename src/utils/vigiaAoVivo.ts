/**
 * Vigia e sincronizador de borda para transmissões Ao Vivo.
 *
 * Utilizado especialmente para:
 * 1. Player nativo (Safari e TVs Tizen/webOS com decodificador de hardware via video.src).
 * 2. Recuperação instantânea de latência ao alternar abas (visibilitychange).
 * 3. Cálculo de atraso em tempo real para a pílula/badge nos controles do player.
 */

import type { ModoZeroDelay } from '../services/zeroDelay';

export interface LatenciaInfo {
  atrasoSegundos: number | null;
  naBorda: boolean;
  bordaDisponivel: boolean;
}

export interface VigiaAoVivoHandle {
  destroy: () => void;
  pularParaBorda: () => void;
  obterLatencia: () => LatenciaInfo;
}

/**
 * Calcula a borda mais recente informada pelo decodificador/manifesto.
 */
export function obterBordaAoVivo(video: HTMLMediaElement): number | null {
  try {
    const s = video.seekable;
    if (!s || s.length === 0) return null;
    const borda = s.end(s.length - 1);
    if (!Number.isFinite(borda) || borda <= 0) return null;
    return borda;
  } catch {
    return null;
  }
}

/**
 * Calcula os segundos de buffer carregados à frente do cursor de reprodução atual.
 */
export function obterBufferFrente(video: HTMLMediaElement): number {
  try {
    const s = video.buffered;
    if (!s || s.length === 0) return 0;
    const t = video.currentTime;
    for (let i = 0; i < s.length; i++) {
      if (s.start(i) <= t && t <= s.end(i)) {
        return Math.max(0, s.end(i) - t);
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Inicia o vigia de baixa latência para reprodução nativa ou para monitoramento.
 */
export function iniciarVigiaAoVivo(
  video: HTMLVideoElement,
  modo: ModoZeroDelay,
  onPulo?: (novoTempo: number) => void,
  isMSE = false,
): VigiaAoVivoHandle {
  let cancelado = false;
  let ultimoPulo = 0;

  const obterLatencia = (): LatenciaInfo => {
    const borda = obterBordaAoVivo(video);
    if (borda === null) {
      return { atrasoSegundos: null, naBorda: true, bordaDisponivel: false };
    }
    const t = video.currentTime;
    const atraso = Math.max(0, borda - t);
    // Considera na borda se estiver dentro de uma margem aceitável de acordo com o modo
    const limiteBorda = modo === 'agressivo' ? 4.0 : modo === 'equilibrado' ? 8.0 : 15.0;
    return {
      atrasoSegundos: Math.round(atraso * 10) / 10,
      naBorda: atraso <= limiteBorda,
      bordaDisponivel: true,
    };
  };

  const pularParaBorda = () => {
    const borda = obterBordaAoVivo(video);
    if (borda === null) return;
    // Margem calculada para não esgotar o buffer na chegada (evita congelamento imediato)
    const margem = modo === 'agressivo' ? 2.8 : modo === 'equilibrado' ? 4.5 : 8.0;
    const alvo = Math.max(0, borda - margem);
    if (Math.abs(video.currentTime - alvo) > 1.5) {
      try {
        video.currentTime = alvo;
        ultimoPulo = performance.now();
        onPulo?.(alvo);
      } catch {
        // Ignora caso o navegador não permita seek em live stream nativa
      }
    }
  };

  // Se o Zero Delay estiver desligado, o vigia apenas calcula a latência sem forçar pulos ou velocidade
  if (modo === 'off' || isMSE) {
    // Quando MSE (hls.js, mpegts.js) está no controle, quem gerencia a sincronização da borda
    // é o próprio player especializado (hls.js liveSync / mpegts liveBufferLatencyChasing).
    // O vigia externo não deve forçar currentTime periodicamente para não esgotar o SourceBuffer e travar!
    return {
      destroy: () => {
        cancelado = true;
      },
      pularParaBorda,
      obterLatencia,
    };
  }

  // Intervalo de verificação da guarda anti-congelamento (apenas para reprodução NATIVA)
  const intervaloMs = modo === 'agressivo' ? 2500 : 4000;
  const intervaloId = window.setInterval(() => {
    if (cancelado || video.paused || video.ended) return;

    // 1. Guarda de Buffer Frontal (Anti-Starvation):
    // Se o buffer à frente estiver baixo (< 1.5s), trava velocidade em 1.0x para nunca travar!
    const bufferFrente = obterBufferFrente(video);
    if (bufferFrente > 0 && bufferFrente < 1.5) {
      if (video.playbackRate > 1.0) {
        video.playbackRate = 1.0;
      }
      return; // Não faz pulo ou aceleração enquanto o buffer estiver frágil
    }

    const borda = obterBordaAoVivo(video);
    if (borda === null) return;

    const t = video.currentTime;
    const atraso = borda - t;
    const agora = performance.now();

    if (modo === 'agressivo') {
      // No agressivo nativo: tolerância de 8 segundos. Se passar e houver buffer suficiente, sincroniza
      if (atraso > 8.0 && agora - ultimoPulo > 8000 && bufferFrente >= 3.0) {
        pularParaBorda();
      }
    } else {
      // No equilibrado nativo: tolerância de 15 segundos, com intervalo de pelo menos 15s entre pulos
      if (atraso > 15.0 && agora - ultimoPulo > 15000 && bufferFrente >= 4.0) {
        pularParaBorda();
      }
    }
  }, intervaloMs);

  // Quando o usuário volta para a aba do navegador, recupera a latência acumulada
  const tratarVisibilidade = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !video.paused) {
      const borda = obterBordaAoVivo(video);
      if (borda !== null) {
        const atraso = borda - video.currentTime;
        const limite = modo === 'agressivo' ? 3.0 : 8.0;
        if (atraso > limite) {
          pularParaBorda();
        }
      }
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', tratarVisibilidade);
  }

  return {
    destroy: () => {
      cancelado = true;
      if (typeof window !== 'undefined') {
        window.clearInterval(intervaloId);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', tratarVisibilidade);
      }
    },
    pularParaBorda,
    obterLatencia,
  };
}
