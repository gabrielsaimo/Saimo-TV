/**
 * Converte URLs HTTP para usar o proxy da Vercel em produção
 * Isso resolve o problema de Mixed Content (HTTP em páginas HTTPS)
 */

const isProduction = import.meta.env.PROD;

/**
 * Retorna a URL do proxy para vídeos HTTP quando em produção
 * Em desenvolvimento, retorna a URL original
 */
export function getProxiedUrl(url: string): string {
  // Se não for produção, retorna a URL original
  if (!isProduction) {
    return url;
  }

  // Se já for HTTPS, não precisa de proxy
  if (url.startsWith('https://')) {
    return url;
  }

  // Se for HTTP, usa o proxy
  if (url.startsWith('http://')) {
    const encodedUrl = encodeURIComponent(url);
    return `/api/proxy?url=${encodedUrl}`;
  }

  // URLs relativas ou outros protocolos, retorna como está
  return url;
}

/**
 * Verifica se a URL precisa de proxy
 */
export function needsProxy(url: string): boolean {
  return isProduction && url.startsWith('http://');
}
