/**
 * DASH com ClearKey no navegador.
 *
 * Dezoito canais do catálogo — Globo, GNT, Multishow, SporTV 2 e 3, a Premiere
 * inteira — só existem em `.mpd` cifrado, e o hls.js não fala DASH nem EME. O
 * Shaka fala os dois, e a chave já vem no catálogo: não há servidor de licença
 * para consultar, é o mesmo par KID:chave que o app entrega ao ExoPlayer.
 *
 * A biblioteca é carregada sob demanda porque só um canal em seis precisa dela.
 */

import type { ChannelSource } from '../types/channel';

/* eslint-disable @typescript-eslint/no-explicit-any */
type ShakaPlayer = {
  attach: (video: HTMLMediaElement) => Promise<void>;
  configure: (config: unknown) => void;
  load: (url: string) => Promise<void>;
  destroy: () => Promise<void>;
  addEventListener: (type: string, listener: (event: any) => void) => void;
};

let shakaModule: any = null;

async function carregarShaka(): Promise<any> {
  if (shakaModule) return shakaModule;
  const mod = await import('shaka-player/dist/shaka-player.compiled.js');
  const shaka = (mod as any).default ?? mod;
  shaka.polyfill.installAll();
  shakaModule = shaka;
  return shaka;
}

/** Verdadeiro quando este navegador tem EME e Media Source para o DASH cifrado. */
export async function suportaDash(): Promise<boolean> {
  try {
    const shaka = await carregarShaka();
    return Boolean(shaka.Player.isBrowserSupported());
  } catch {
    return false;
  }
}

export interface DashHandle {
  destroy: () => void;
}

/**
 * Toca uma fonte DASH no elemento dado. `onFatal` avisa quando não há mais o
 * que tentar, para que quem chamou desça para a próxima fonte do canal.
 */
export async function playDash(
  video: HTMLVideoElement,
  url: string,
  source: ChannelSource,
  onFatal: (mensagem: string) => void,
): Promise<DashHandle> {
  const shaka = await carregarShaka();
  if (!shaka.Player.isBrowserSupported()) {
    throw new Error('Navegador sem suporte a DASH com DRM');
  }

  const player: ShakaPlayer = new shaka.Player();
  await player.attach(video);

  if (source.keyId && source.key) {
    // Chave local: o ClearKey do W3C dispensa servidor de licença, e é assim que
    // o catálogo a publica — em hexadecimal, KID e chave.
    player.configure({ drm: { clearKeys: { [source.keyId]: source.key } } });
  }

  player.addEventListener('error', (event: any) => {
    onFatal(`Erro DASH ${event?.detail?.code ?? ''}`.trim());
  });

  await player.load(url);

  return {
    destroy: () => {
      void player.destroy().catch(() => { /* já destruído */ });
    },
  };
}
