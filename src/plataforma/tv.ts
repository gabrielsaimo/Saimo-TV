/**
 * Saimo TV dentro de uma TV Samsung (Tizen) ou LG (webOS).
 *
 * As duas rodam o app como página web num Chromium da própria TV. Aqui ficam só as
 * diferenças que importam: saber em que TV estamos, traduzir as teclas do controle
 * (que não são as do teclado) e sair do app. O resto do app é o mesmo do site.
 */

export type MarcaTv = 'tizen' | 'webos' | null;

type JanelaTv = Window & {
  tizen?: {
    tvinputdevice?: { registerKey?: (nome: string) => void };
    application?: { getCurrentApplication?: () => { exit: () => void } };
  };
  webOS?: unknown;
  PalmSystem?: unknown;
  __SAIMO_TV__?: string;
};

function janela(): JanelaTv | null {
  return typeof window === 'undefined' ? null : (window as JanelaTv);
}

/** Qual TV é esta. O carregador do pacote grava `__SAIMO_TV__`; o resto é detecção. */
export function marcaTv(): MarcaTv {
  const w = janela();
  if (!w) return null;
  if (w.__SAIMO_TV__ === 'tizen' || w.__SAIMO_TV__ === 'webos') return w.__SAIMO_TV__;
  const ua = navigator.userAgent;
  if (/Tizen/i.test(ua) || w.tizen) return 'tizen';
  if (/Web0S|webOS|NetCast/i.test(ua) || w.webOS || w.PalmSystem) return 'webos';
  return null;
}

export function ehTv(): boolean {
  return marcaTv() !== null;
}

/** Teclas do controle remoto → ação. Os números são das duas marcas (Samsung e LG). */
const VOLTAR = new Set([10009, 461, 27]);
const PLAY = 415;
const PAUSA = 19;
const PLAY_PAUSA = 10252;
const PARAR = 413;

const TECLAS_SAMSUNG = [
  'MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
  'ChannelUp', 'ChannelDown', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];

function videoAtual(): HTMLVideoElement | null {
  return document.querySelector('video');
}

function tecla(alvo: EventTarget | null, key: string, keyCode: number): boolean {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(evento, 'keyCode', { get: () => keyCode });
  // dispatchEvent devolve false quando alguém chamou preventDefault: o app tratou a tecla.
  return !(alvo ?? document).dispatchEvent(evento);
}

/** Setas e OK do controle, por código: `key` pode vir vazio ou "Unidentified" em TV antiga. */
const POR_CODIGO: Record<number, string> = { 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 13: 'Enter' };

function aoApertar(e: KeyboardEvent): void {
  const codigo = e.keyCode;
  // Já é a tecla traduzida por nós: deixa seguir.
  if (!e.isTrusted) return;
  const certa = POR_CODIGO[codigo];
  if (certa && e.key !== certa) {
    e.preventDefault();
    e.stopPropagation();
    tecla(e.target, certa, codigo);
    return;
  }
  if (VOLTAR.has(codigo) && e.key !== 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    // O D-pad do app entende Escape como "voltar". Se ele não tem mais para onde voltar,
    // estamos na tela inicial: a tecla Voltar da TV então fecha o app.
    const tratado = tecla(e.target, 'Escape', 27);
    if (!tratado) pedirParaSair();
    return;
  }
  if (codigo === PLAY || codigo === PAUSA || codigo === PLAY_PAUSA || codigo === PARAR) {
    const v = videoAtual();
    if (!v) return;
    e.preventDefault();
    if (codigo === PLAY) void v.play().catch(() => {});
    else if (codigo === PAUSA || codigo === PARAR) v.pause();
    else if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }
}

/** Sai do app (tela inicial da TV). */
export function sairDoApp(): void {
  const w = janela() as (JanelaTv & { webOS?: { platformBack?: () => void }; PalmSystem?: { platformBack?: () => void } }) | null;
  if (!w) return;
  try {
    if (w.tizen?.application?.getCurrentApplication) {
      w.tizen.application.getCurrentApplication().exit();
      return;
    }
  } catch { /* cai no próximo */ }
  // webOS: o jeito certo de voltar ao menu da TV. O window.close() fazia a LG fechar e
  // reabrir o app.
  try {
    if (w.webOS?.platformBack) { w.webOS.platformBack(); return; }
    if (w.PalmSystem?.platformBack) { w.PalmSystem.platformBack(); return; }
  } catch { /* cai no fechamento comum */ }
  try { w.close(); } catch { /* sem o que fazer */ }
}

let ultimoVoltar = 0;

/** Voltar na tela inicial: o primeiro avisa, o segundo (em até 2,5 s) sai. Nada de sair sem querer. */
function pedirParaSair(): void {
  const agora = Date.now();
  if (agora - ultimoVoltar < 2500) { sairDoApp(); return; }
  ultimoVoltar = agora;
  const aviso = document.createElement('div');
  aviso.textContent = 'Aperte Voltar de novo para sair do Saimo TV';
  aviso.style.cssText = 'position:fixed;left:50%;bottom:8%;transform:translateX(-50%);z-index:2147483647;' +
    'background:#18181bee;color:#fff;font:600 28px system-ui,sans-serif;padding:18px 32px;border-radius:16px;' +
    'border:1px solid #ffffff33';
  document.body.appendChild(aviso);
  window.setTimeout(() => aviso.remove(), 2500);
}

let ligado = false;

/** Liga o suporte de TV. Chamar uma vez, antes de montar o app. */
export function iniciarTv(): void {
  const w = janela();
  if (ligado || !w) return;
  const marca = marcaTv();
  if (!marca) return;
  ligado = true;
  document.documentElement.classList.add('modo-tv', `tv-${marca}`);
  // Samsung só entrega ao app as teclas que ele pede.
  if (marca === 'tizen') {
    for (const nome of TECLAS_SAMSUNG) {
      try { w.tizen?.tvinputdevice?.registerKey?.(nome); } catch { /* tecla que esta TV não tem */ }
    }
  }
  w.addEventListener('keydown', aoApertar, true);
}

/**
 * A TV toca HLS pelo próprio decodificador, sem passar por CORS nem por MSE: é o
 * caminho mais confiável para http e para os servidores que exigem cabeçalhos.
 */
export function hlsNativo(): boolean {
  if (!ehTv() || typeof document === 'undefined') return false;
  try {
    return !!document.createElement('video').canPlayType('application/vnd.apple.mpegurl');
  } catch { return false; }
}
