/**
 * Endereços de reprodução que o navegador consegue abrir.
 *
 * O `fetch` do navegador não deixa mandar Referer nem User-Agent, recusa HTTP
 * numa página HTTPS e obedece ao CORS — três liberdades que o app Android tem e
 * o site não. O proxy da própria origem resolve as três, mas não sai de graça:
 * os IPs de datacenter da Cloudflare são recusados por parte dos CDNs desta
 * lista, que respondem 403 a quem não vem de uma conexão residencial. Por isso a
 * regra é tentar direto primeiro e só cair no proxy quando o direto não puder
 * funcionar — e nunca o contrário.
 */

import type { ChannelSource } from '../types/channel';

export function isDash(url: string): boolean {
  return url.toLowerCase().includes('.mpd');
}

export function isHls(url: string): boolean {
  return url.toLowerCase().includes('.m3u8');
}

/** Fluxo MPEG-TS cru, servido sem playlist. */
export function isMpegTs(url: string): boolean {
  return /\.ts(\?|$)/i.test(url);
}

/**
 * Só o conteúdo misto é impossível de tentar direto: uma página HTTPS não abre
 * um vídeo HTTP, e o navegador nem chega a fazer o pedido. Todo o resto merece
 * uma tentativa direta antes do proxy.
 */
export function needsProxy(source: ChannelSource | { url: string }): boolean {
  return source.url.startsWith('http://');
}

/** Endereço do proxy desta origem para uma fonte, com os cabeçalhos dela. */
export function proxyUrl(source: ChannelSource): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  let out = `${base}/api/proxy?url=${encodeURIComponent(source.url)}`;
  if (source.referer) out += `&referer=${encodeURIComponent(source.referer)}`;
  if (source.userAgent) out += `&ua=${encodeURIComponent(source.userAgent)}`;
  return out;
}

/** Endereço a entregar ao player: o proxy quando obrigatório, a origem quando não. */
export function playableUrl(source: ChannelSource): string {
  return needsProxy(source) ? proxyUrl(source) : source.url;
}

/** Uma tentativa de reprodução: a mesma fonte, por um caminho ou pelo outro. */
export interface Attempt {
  source: ChannelSource;
  url: string;
  viaProxy: boolean;
}

/**
 * As tentativas de um canal, em ordem.
 *
 * Cada fonte rende até duas: a direta, que é a que tem chance de passar pelos
 * CDNs que barram datacenter, e a do proxy, que é a que tem chance quando falta
 * CORS ou cabeçalho. Fonte HTTP só rende a segunda.
 */
export function buildAttempts(sources: ChannelSource[]): Attempt[] {
  const out: Attempt[] = [];
  for (const source of sources) {
    if (!needsProxy(source)) out.push({ source, url: source.url, viaProxy: false });
    out.push({ source, url: proxyUrl(source), viaProxy: true });
  }
  return out;
}

/**
 * Corrige segmentos relativos de proxies cuja playlist aponta para outra pasta.
 *
 * A playlist dos Telecine chega em `/tos-.../proxy.m3u8`, mas o parâmetro
 * `url=https://origem/docs/telecinepipoca/__index.m3u8` diz que os segmentos
 * vivem em `/docs/telecinepipoca/`. Pedir o segmento ao lado da playlist devolve
 * 521; pedir na pasta do `url=` devolve o vídeo. Mesma correção que o app faz em
 * `Playback.corrigirCaminhoDaPlaylist`, e que o proxy repete do lado do servidor
 * para quando a reprodução passa por ele.
 */
export function fixNestedPath(manifestUrl: string, requestUrl: string): string {
  let manifest: URL;
  let request: URL;
  try {
    manifest = new URL(manifestUrl);
    request = new URL(requestUrl);
  } catch {
    return requestUrl;
  }

  // A própria playlist conserva a query assinada; só filhos relativos mudam.
  if (request.pathname === manifest.pathname) return requestUrl;
  if (manifest.protocol !== request.protocol || manifest.host !== request.host) return requestUrl;

  // `url=` carrega um endereço inteiro com query própria, então o valor bruto é
  // fatiado na mão: URLSearchParams cortaria no primeiro `&` do endereço aninhado.
  const rawQuery = manifest.search.replace(/^\?/, '');
  const nestedValue = rawQuery
    .split('&')
    .find((part) => part.startsWith('url='))
    ?.slice('url='.length);
  if (!nestedValue) return requestUrl;

  let nestedPath: string;
  try {
    nestedPath = new URL(decodeURIComponent(nestedValue)).pathname;
  } catch {
    return requestUrl;
  }

  const manifestDir = manifest.pathname.slice(0, manifest.pathname.lastIndexOf('/') + 1);
  const nestedDir = nestedPath.slice(0, nestedPath.lastIndexOf('/') + 1);
  if (!manifestDir || !nestedDir) return requestUrl;
  if (!request.pathname.startsWith(manifestDir)) return requestUrl;

  const corrected = nestedDir + request.pathname.slice(manifestDir.length);
  return `${request.protocol}//${request.host}${corrected}${request.search}${request.hash}`;
}

/**
 * Converte hexadecimal em base64url, que é o formato que o EME do navegador
 * pede para o KID e a chave do ClearKey.
 */
export function hexToBase64Url(hex: string): string {
  const clean = hex.replace(/-/g, '').trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
