/**
 * O player das rádios, único para o site todo: o áudio continua ao trocar de
 * tela e a barra do topo mostra o que está tocando. Abrir o Ao vivo para a
 * rádio (e o ao vivo volta), como no app do Mac.
 */
import Hls from 'hls.js';
import { needsProxy, proxyUrl } from '../utils/streamUrl';
import { ouviu, type Radio } from './radios';

export type EstadoRadio = 'parado' | 'carregando' | 'tocando' | 'erro';

export interface SituacaoRadio {
  radio: Radio | null;
  estado: EstadoRadio;
}

let audio: HTMLAudioElement | null = null;
let hls: Hls | null = null;
let situacao: SituacaoRadio = { radio: null, estado: 'parado' };
const ouvintes = new Set<() => void>();

function mudar(proxima: SituacaoRadio) {
  situacao = proxima;
  ouvintes.forEach((fn) => fn());
}

function elemento(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.addEventListener('playing', () => mudar({ ...situacao, estado: 'tocando' }));
  audio.addEventListener('error', () => { if (situacao.radio) mudar({ ...situacao, estado: 'erro' }); });
  return audio;
}

export const atual = (): SituacaoRadio => situacao;

/** Avisa quando muda o que toca. Devolve quem cancela. */
export function assinar(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => { ouvintes.delete(fn); };
}

export function parar(): void {
  hls?.destroy();
  hls = null;
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  if (situacao.radio || situacao.estado !== 'parado') mudar({ radio: null, estado: 'parado' });
}

export function tocar(radio: Radio): void {
  const a = elemento();
  hls?.destroy();
  hls = null;
  mudar({ radio, estado: 'carregando' });
  const url = needsProxy({ url: radio.url }) ? proxyUrl({ url: radio.url }) : radio.url;
  if (/\.m3u8(\?|$)/i.test(radio.url) && !a.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
    const h = new Hls();
    hls = h;
    h.loadSource(url);
    h.attachMedia(a);
    h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) mudar({ radio, estado: 'erro' }); });
  } else {
    a.src = url;
  }
  a.play().then(() => ouviu(radio.nome)).catch(() => mudar({ radio, estado: 'erro' }));
}
