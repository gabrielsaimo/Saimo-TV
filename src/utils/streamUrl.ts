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
import { httpsFirst } from './sourceOrder';

export function isDash(url: string): boolean {
  return url.toLowerCase().includes('.mpd');
}

export function isHls(url: string): boolean {
  const path = url.toLowerCase().split('?')[0];
  return path.includes('.m3u8') || path.endsWith('.txt');
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
  // Masters `.txt` costumam vir como text/plain e sem CORS (como os de
  // embedplayer2). Começar pelo proxy evita uma tentativa direta que o browser
  // obrigatoriamente bloquearia e garante que os filhos também sejam reescritos.
  return source.url.startsWith('http://') || source.url.split('?')[0].toLowerCase().endsWith('.txt');
}

/**
 * Onde o proxy atende.
 *
 * No site é a própria origem da página, que serve `/api/proxy` como função da
 * Cloudflare. No aplicativo de janela não há origem de site: quem atende é um
 * servidor local, e o endereço dele é injetado antes do primeiro script rodar.
 * O contrato dos dois é o mesmo de propósito — a correção feita para um vale
 * para o outro sem virar duas implementações.
 */
export function proxyBase(): string {
  const injetado = (globalThis as { __SAIMO_PROXY__?: string }).__SAIMO_PROXY__;
  if (injetado) return injetado;
  // Parte dos CDNs recusa os IPs da Cloudflare, que é onde o site mora: para
  // eles o proxy da própria origem responde 403 e o canal não abre de jeito
  // nenhum. Apontar esta variável para um proxy hospedado fora da Cloudflare
  // resolve sem mexer no resto — o contrato de `/api/proxy` é o mesmo.
  const externo = import.meta.env.VITE_PROXY_BASE;
  if (externo) return externo.replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Endereço do proxy desta origem para uma fonte, com os cabeçalhos dela. */
export function proxyUrl(source: ChannelSource): string {
  const base = proxyBase();
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

/*
 * Servidores que o navegador não deixa abrir direto.
 *
 * Nem todo CDN manda o cabeçalho de CORS, e sem ele o navegador recusa o
 * pedido direto — o proxy resolve, mas só depois de a tentativa direta gastar
 * o tempo do relógio de segurança. Guardar quem já falhou faz a segunda visita
 * ir direto ao proxy, e a lista mora no próprio navegador porque a resposta
 * depende da origem de quem assiste, não do catálogo.
 */
const CHAVE_SEM_CORS = 'saimo-sem-cors';

function hostsSemCors(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_SEM_CORS);
    return bruto ? (JSON.parse(bruto) as string[]) : ['jmp2.uk'];
  } catch { return ['jmp2.uk']; }
}

/** Anota que este endereço não abre direto, só pelo proxy. */
export function marcarSemCors(url: string): void {
  try {
    const host = new URL(url).host;
    const lista = hostsSemCors();
    if (lista.includes(host)) return;
    localStorage.setItem(CHAVE_SEM_CORS, JSON.stringify([...lista, host].slice(-100)));
  } catch { /* endereço estranho ou armazenamento bloqueado */ }
}

function precisaComecarPeloProxy(source: ChannelSource): boolean {
  try { return hostsSemCors().includes(new URL(source.url).host); }
  catch { return false; }
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
  for (const source of httpsFirst(sources)) {
    if (!needsProxy(source) && !precisaComecarPeloProxy(source)) {
      out.push({ source, url: source.url, viaProxy: false });
    }
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
