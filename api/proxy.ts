/**
 * Mesma função de proxy, no formato que a Vercel espera.
 *
 * A produção roda no Cloudflare Pages (functions/api/proxy.ts). Este arquivo só
 * reexporta aquele handler para que os dois ambientes nunca divirjam: uma
 * correção de CDN feita em um valia para o outro, e antes disso as duas cópias
 * já haviam saído de sincronia.
 */
import { onRequest } from '../functions/api/proxy';

export const config = {
  runtime: 'edge',
};

export default function handler(request: Request): Promise<Response> {
  return onRequest({ request });
}
