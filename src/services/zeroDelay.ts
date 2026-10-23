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
        lowLatencyMode: false,
        backBufferLength: 90,
      };
    }

    if (modo === 'agressivo') {
      return {
        lowLatencyMode: false,
        // Inicia a ~2.0 fragmentos da borda ao vivo (garante buffer suficiente sem engasgos)
        liveSyncDurationCount: 2.0,
        // Tolerância de até 4.0 fragmentos antes de salto
        liveMaxLatencyDurationCount: 4.0,
        // Perseguição suave a 1.04x para não queimar o buffer frontal
        maxLiveSyncPlaybackRate: 1.04,
        // Auto-recuo protetor de 1.5s se a rede oscilar para evitar travamento em loop
        liveSyncOnStallIncrease: 1.5,
        maxBufferLength: 12,
        maxMaxBufferLength: 20,
        backBufferLength: 15,
        startFragPrefetch: true,
      };
    }

    // Modo equilibrado (padrão ativo)
    return {
      lowLatencyMode: false,
      // Inicia a ~2.8 segmentos da borda (ótima margem de estabilidade contra travamentos)
      liveSyncDurationCount: 2.8,
      // Se atrasar mais de 5 segmentos, salta para o ao vivo
      liveMaxLatencyDurationCount: 5.5,
      // Persegue acelerando suavemente a 1.03x (preserva estabilidade e tom de voz)
      maxLiveSyncPlaybackRate: 1.03,
      // Se houver travamento no CDN, recua a meta em 1.5s automaticamente
      liveSyncOnStallIncrease: 1.5,
      maxBufferLength: 20,
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
        enableStashBuffer: false,
        liveSync: true,
        liveSyncTargetLatency: 1.5,
        liveSyncMaxLatency: 3.5,
        liveSyncPlaybackRate: 1.05,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 5.0,
        liveBufferLatencyMinRemain: 1.2,
        liveBufferLatencyChasingOnPaused: true,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 15,
        autoCleanupMinBackwardDuration: 8,
      };
    }

    // Equilibrado
    return {
      enableWorker: true,
      seekType: 'range',
      enableStashBuffer: false,
      liveSync: true,
      liveSyncTargetLatency: 2.5,
      liveSyncMaxLatency: 5.0,
      liveSyncPlaybackRate: 1.03,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 8.0,
      liveBufferLatencyMinRemain: 1.8,
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
