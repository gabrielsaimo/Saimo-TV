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
 * Inicia o vigia de baixa latência para reprodução nativa ou para monitoramento.
 */
export function iniciarVigiaAoVivo(
  video: HTMLVideoElement,
  modo: ModoZeroDelay,
  onPulo?: (novoTempo: number) => void,
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
    const limiteBorda = modo === 'agressivo' ? 2.5 : modo === 'equilibrado' ? 6.0 : 15.0;
    return {
      atrasoSegundos: Math.round(atraso * 10) / 10,
      naBorda: atraso <= limiteBorda,
      bordaDisponivel: true,
    };
  };

  const pularParaBorda = () => {
    const borda = obterBordaAoVivo(video);
    if (borda === null) return;
    // Margem mínima para evitar starvation imediato ao buscar a ponta
    const margem = modo === 'agressivo' ? 0.4 : modo === 'equilibrado' ? 2.0 : 4.0;
    const alvo = Math.max(0, borda - margem);
    if (Math.abs(video.currentTime - alvo) > 0.8) {
      try {
        video.currentTime = alvo;
        ultimoPulo = performance.now();
        onPulo?.(alvo);
      } catch {
        // Ignora caso o navegador não permita seek em live stream nativa
      }
    }
  };

  // Se o Zero Delay estiver desligado, o vigia apenas calcula a latência sem forçar pulos
  if (modo === 'off') {
    return {
      destroy: () => {
        cancelado = true;
      },
      pularParaBorda,
      obterLatencia,
    };
  }

  // Intervalo de verificação: 1.5s no modo agressivo, 4s no equilibrado
  const intervaloMs = modo === 'agressivo' ? 1500 : 4000;
  const intervaloId = window.setInterval(() => {
    if (cancelado || video.paused || video.ended) return;

    const borda = obterBordaAoVivo(video);
    if (borda === null) return;

    const t = video.currentTime;
    const atraso = borda - t;
    const agora = performance.now();

    if (modo === 'agressivo') {
      // No agressivo: tolerância máxima de 3.5 segundos. Ultrapassou, já sincroniza na ponta
      if (atraso > 3.5 && agora - ultimoPulo > 2000) {
        pularParaBorda();
      }
    } else {
      // No equilibrado: tolerância de 12 segundos, com intervalo de pelo menos 15s entre pulos
      if (atraso > 12.0 && agora - ultimoPulo > 15000) {
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
