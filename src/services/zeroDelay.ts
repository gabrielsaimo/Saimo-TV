/**
 * Serviço de Zero Delay (Baixa Latência para Transmissões Ao Vivo).
 *
 * Oferece 3 níveis:
 * - 'off': Padrão do sistema. Buffering padrão e sem perseguição agressiva.
 * - 'equilibrado': Menor atraso inteligente (~2 segmentos), perseguição suave (1.10x)
 *   e auto-recuo defensivo em caso de instabilidade da rede/CDN.
 * - 'agressivo': O mais ao vivo possível ignorando qualquer margem. Cola no último
 *   segmento disponível (1 segmento ou 0.5s), perseguição rápida (1.25x) e sem auto-recuo.
 */

import type { HlsConfig } from 'hls.js';
import type mpegts from 'mpegts.js';

export type ModoZeroDelay = 'off' | 'equilibrado' | 'agressivo';

export const CHAVE_ZERO_DELAY = 'saimo-zero-delay';
export const EVENTO_ZERO_DELAY = 'saimo-zero-delay-mudou';

class ZeroDelayService {
  public getModo(): ModoZeroDelay {
    if (typeof window === 'undefined' || !window.localStorage) return 'off';
    const salvo = localStorage.getItem(CHAVE_ZERO_DELAY);
    if (salvo === 'equilibrado' || salvo === 'agressivo') return salvo;
    return 'off';
  }

  public setModo(modo: ModoZeroDelay): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(CHAVE_ZERO_DELAY, modo);
    window.dispatchEvent(new CustomEvent(EVENTO_ZERO_DELAY, { detail: { modo } }));
  }

  public isAtivo(): boolean {
    return this.getModo() !== 'off';
  }

  /**
   * Configurações específicas para hls.js
   */
  public obterConfigHls(modo: ModoZeroDelay): Partial<HlsConfig> {
    if (modo === 'off') {
      return {
        lowLatencyMode: true,
        backBufferLength: 90,
      };
    }

    if (modo === 'agressivo') {
      return {
        lowLatencyMode: true,
        // Inicia o mais colado possível no último segmento publicado
        liveSyncDurationCount: 1,
        // Tolerância mínima: se atrasar mais que 2.2 segmentos, salta para a borda
        liveMaxLatencyDurationCount: 2.2,
        // Persegue acelerando até 1.25x
        maxLiveSyncPlaybackRate: 1.25,
        // Sem auto-recuo: insiste na ponta máxima mesmo se a rede oscilar
        liveSyncOnStallIncrease: 0,
        // Buffer mínimo para não acumular frames desnecessários
        maxBufferLength: 6,
        maxMaxBufferLength: 10,
        backBufferLength: 10,
        startFragPrefetch: true,
      };
    }

    // Modo equilibrado (padrão ativo)
    return {
      lowLatencyMode: true,
      // Inicia a ~2 segmentos da borda (margem de segurança ideal)
      liveSyncDurationCount: 2,
      // Se atrasar mais de 4.5 segmentos, salta para o ao vivo
      liveMaxLatencyDurationCount: 4.5,
      // Persegue acelerando suavemente a 1.10x (preserva tom do áudio)
      maxLiveSyncPlaybackRate: 1.1,
      // Se houver travamento no CDN, recua a meta em 1s automaticamente
      liveSyncOnStallIncrease: 1.0,
      maxBufferLength: 15,
      backBufferLength: 30,
      startFragPrefetch: true,
    };
  }

  /**
   * Configurações específicas para mpegts.js
   */
  public obterConfigMpegts(modo: ModoZeroDelay): mpegts.Config {
    if (modo === 'off') {
      return {
        enableWorker: true,
        lazyLoadMaxDuration: 3 * 60,
        seekType: 'range',
      };
    }

    if (modo === 'agressivo') {
      return {
        enableWorker: true,
        seekType: 'range',
        // Sem buffer intermediário do mpegts
        enableStashBuffer: false,
        liveSync: true,
        liveSyncTargetLatency: 0.5,
        liveSyncMaxLatency: 1.2,
        liveSyncPlaybackRate: 1.25,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 2.0,
        liveBufferLatencyMinRemain: 0.4,
        liveBufferLatencyChasingOnPaused: true,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 10,
        autoCleanupMinBackwardDuration: 5,
      };
    }

    // Equilibrado
    return {
      enableWorker: true,
      seekType: 'range',
      enableStashBuffer: false,
      liveSync: true,
      liveSyncTargetLatency: 1.5,
      liveSyncMaxLatency: 3.0,
      liveSyncPlaybackRate: 1.1,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 6.0,
      liveBufferLatencyMinRemain: 1.5,
      liveBufferLatencyChasingOnPaused: true,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 30,
      autoCleanupMinBackwardDuration: 15,
    };
  }

  /**
   * Configurações para Shaka Player (DASH)
   */
  public obterConfigShaka(modo: ModoZeroDelay): Record<string, unknown> {
    if (modo === 'off') {
      return {};
    }

    if (modo === 'agressivo') {
      return {
        streaming: {
          lowLatencyMode: true,
          bufferingGoal: 2,
          rebufferingGoal: 0.5,
          liveSync: {
            enabled: true,
            targetLatency: 1.5,
            targetLatencyTolerance: 0.3,
            maxPlaybackRate: 1.25,
            minPlaybackRate: 1.0,
            panicMode: true,
            panicThreshold: 4,
            dynamicTargetLatency: {
              enabled: false,
            },
          },
        },
      };
    }

    // Equilibrado
    return {
      streaming: {
        lowLatencyMode: true,
        bufferingGoal: 5,
        rebufferingGoal: 1.5,
        liveSync: {
          enabled: true,
          targetLatency: 4.0,
          targetLatencyTolerance: 0.5,
          maxPlaybackRate: 1.1,
          minPlaybackRate: 1.0,
          panicMode: true,
          panicThreshold: 20,
          dynamicTargetLatency: {
            enabled: true,
            minLatency: 3.0,
            maxLatency: 12.0,
            rebufferIncrement: 0.5,
            stabilityThreshold: 45,
          },
        },
      },
    };
  }
}

export const zeroDelayService = new ZeroDelayService();
