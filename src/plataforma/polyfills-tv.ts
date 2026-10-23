// Polyfills de DOM para TV antiga (ver src/entrada-tv.ts).
import ResizeObserverPolyfill from 'resize-observer-polyfill';
import smoothscroll from 'smoothscroll-polyfill';

type JanelaComObservador = Window & { ResizeObserver?: unknown };
if (!(window as JanelaComObservador).ResizeObserver) (window as JanelaComObservador).ResizeObserver = ResizeObserverPolyfill;
// scrollTo/scrollBy/scrollIntoView com opções ({ left, behavior }) só existem do Chrome 61 em diante.
smoothscroll.polyfill();
// Element.closest/matches (Chrome 41).
if (!Element.prototype.matches) {
  const p = Element.prototype as Element & { webkitMatchesSelector?: (s: string) => boolean };
  (Element.prototype as { matches: unknown }).matches = p.webkitMatchesSelector;
}
const subirAte = (el: Element | null, seletor: string): Element | null => {
  for (; el; el = el.parentElement) if (el.matches(seletor)) return el;
  return null;
};
if (!Element.prototype.closest) {
  Element.prototype.closest = function closest(this: Element, seletor: string) {
    return subirAte(this, seletor);
  } as typeof Element.prototype.closest;
}


// aspect-ratio (Chrome 88): sem ele as capas ficavam com altura zero nas TVs de até 2021.
// Fallback só onde falta: a altura de cada capa sai da largura, recalculada quando a tela muda.
const PROPORCOES: Array<[string, number]> = [
  ['.cartao-capa-img', 3 / 2], ['.vod-card-poster-thumb', 3 / 2], ['.vod-card-ver-todos-thumb', 3 / 2],
  ['.nov-capa', 3 / 2], ['.vod-ep-thumb', 9 / 16], ['.eg-detalhes-imagem', 9 / 16],
];
const temAspectRatio = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('aspect-ratio', '1 / 1');
if (!temAspectRatio) {
  let agendado = 0;
  const ajustar = () => {
    agendado = 0;
    for (const [seletor, proporcao] of PROPORCOES) {
      const elementos = document.querySelectorAll<HTMLElement>(seletor);
      for (let i = 0; i < elementos.length; i++) {
        const el = elementos[i];
        const largura = el.offsetWidth;
        if (largura > 0) el.style.height = `${Math.round(largura * proporcao)}px`;
      }
    }
  };
  const pedir = () => { if (!agendado) agendado = window.setTimeout(ajustar, 120); };
  const iniciar = () => {
    new MutationObserver(pedir).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', pedir);
    pedir();
  };
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
}
