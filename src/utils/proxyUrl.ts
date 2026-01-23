/**
 * Converte URLs HTTP para usar o proxy da Vercel em produção
 * Isso resolve o problema de Mixed Content (HTTP em páginas HTTPS)
 */

const isProduction = import.meta.env.PROD;

/**
 * Retorna a URL do proxy para vídeos HTTP quando em produção
 * Em desenvolvimento, retorna a URL original para facilitar debugging
 */
export function getProxiedUrl(url: string): string {
  // Em desenvolvimento, retorna a URL original para facilitar debug
  if (!isProduction) {
    console.log('[DEV] Usando URL original (proxy desabilitado):', url);
    return url;
  }

  // Se já for HTTPS, não precisa de proxy
  if (url.startsWith('https://')) {
    return url;
  }

  // Se for HTTP, usa o proxy apenas em produção
  if (url.startsWith('http://')) {
    const encodedUrl = encodeURIComponent(url);
    // Usa window.location.origin para funcionar em qualquer ambiente (produção, preview, staging)
    const proxiedUrl = `${window.location.origin}/api/proxy?url=${encodedUrl}`;
    console.log('[PROD] Usando proxy:', { original: url, proxied: proxiedUrl });
    return proxiedUrl;
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

/**
 * Verifica se o ambiente é produção
 */
export function isProd(): boolean {
  return isProduction;
}
