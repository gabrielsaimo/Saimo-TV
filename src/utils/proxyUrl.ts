/**
 * Compatibilidade: a decisão de proxy mora em `streamUrl`.
 *
 * Este módulo existia antes com uma regra própria — proxy só em produção, só
 * para HTTP — que deixava o desenvolvimento tocando por um caminho diferente do
 * que o visitante vê. Agora ele só reexporta a regra única, para que o que
 * funciona aqui funcione lá.
 */

import { needsProxy as sourceNeedsProxy, playableUrl } from './streamUrl';

export function getProxiedUrl(url: string): string {
  return playableUrl({ url });
}

export function needsProxy(url: string): boolean {
  return sourceNeedsProxy({ url });
}

export function isProd(): boolean {
  return import.meta.env.PROD;
}
