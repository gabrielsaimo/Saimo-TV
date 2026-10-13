/**
 * Tela cheia que funciona no celular, para os dois players.
 *
 * - iPhone: o Safari não põe um <div> em tela cheia (`requestFullscreen` não
 *   existe lá), só o próprio <video>, pelo player nativo dele
 *   (`webkitEnterFullscreen`), que já gira para paisagem sozinho.
 * - Android: a tela cheia do Chrome não gira o vídeo; com a rotação
 *   automática do aparelho desligada ele ficava em pé. Em tela cheia o
 *   Chrome deixa travar a orientação, então trava em paisagem e solta ao sair.
 * - Safari antigo do iPad e do Mac: só a versão com prefixo `webkit`.
 */

type ElementoWebkit = HTMLElement & { webkitRequestFullscreen?: () => void };
type VideoWebkit = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
type DocumentoWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type OrientacaoTravavel = ScreenOrientation & {
  lock?: (orientacao: 'landscape') => Promise<void>;
};

const doc = () => document as DocumentoWebkit;

/** O elemento em tela cheia agora, com ou sem prefixo. */
export function elementoEmTelaCheia(): Element | null {
  return document.fullscreenElement ?? doc().webkitFullscreenElement ?? null;
}

/** Eventos de entrar e sair da tela cheia, com ou sem prefixo. */
export const EVENTOS_TELA_CHEIA = ['fullscreenchange', 'webkitfullscreenchange'] as const;

function travarPaisagem(): void {
  // Só no celular: num computador ou tablet grande não há o que girar, e
  // o Chrome do computador recusa a trava de qualquer jeito.
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  const orientacao = screen.orientation as OrientacaoTravavel | undefined;
  orientacao?.lock?.('landscape').catch(() => {
    // Aparelho ou navegador que não deixa travar: o vídeo continua em tela
    // cheia, e girar o aparelho com a mão funciona.
  });
}

export function soltarOrientacao(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // Sem trava ativa ou navegador sem suporte: nada a soltar.
  }
}

export async function entrarEmTelaCheia(
  container: HTMLElement,
  video: HTMLVideoElement | null,
): Promise<void> {
  const el = container as ElementoWebkit;
  if (el.requestFullscreen) {
    await el.requestFullscreen({ navigationUI: 'hide' });
    travarPaisagem();
    return;
  }
  if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
    travarPaisagem();
    return;
  }
  // iPhone: o player nativo do vídeo.
  (video as VideoWebkit | null)?.webkitEnterFullscreen?.();
}

export async function sairDaTelaCheia(): Promise<void> {
  soltarOrientacao();
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (doc().webkitFullscreenElement) doc().webkitExitFullscreen?.();
}

export async function alternarTelaCheia(
  container: HTMLElement,
  video: HTMLVideoElement | null,
): Promise<void> {
  if (elementoEmTelaCheia()) await sairDaTelaCheia();
  else await entrarEmTelaCheia(container, video);
}
