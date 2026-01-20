import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'edge',
};

// Função para copiar os headers de streaming da resposta final para o cliente
function copyStreamingHeaders(from: Headers, to: Headers): void {
  const headersToCopy = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
    'cache-control',
  ];
  for (const h of headersToCopy) {
    if (from.has(h)) {
      to.set(h, from.get(h)!);
    }
  }
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
      },
    });
  }

  const url = new URL(req.url);
  const videoUrl = url.searchParams.get('url');

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const decodedUrl = decodeURIComponent(videoUrl);
    
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return new Response(JSON.stringify({ error: 'Invalid URL protocol' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Encaminha os headers do cliente que podem ser relevantes para o servidor de vídeo
    const clientHeaders: Record<string, string> = {
      'User-Agent': req.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `https://google.com/`, // Simula um referer genérico
    };

    // Encaminha o IP do cliente original
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) {
      clientHeaders['X-Forwarded-For'] = forwardedFor;
    }
    
    // Suporte para Range requests (essencial para seeking)
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      clientHeaders['Range'] = rangeHeader;
    }
    
    let currentUrl = decodedUrl;
    let finalResponse: Response | null = null;
    const maxRedirects = 5; // Prevenção de loop infinito

    for (let i = 0; i < maxRedirects; i++) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: clientHeaders,
        redirect: 'manual', // Essencial para capturar o cabeçalho 'Location'
      });

      // Se for um redirect (status 3xx), atualiza a URL e continua o loop
      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
        const locationHeader = response.headers.get('location')!;
        // Constrói a nova URL absoluta, resolvendo contra a URL anterior
        currentUrl = new URL(locationHeader, currentUrl).href;
        continue;
      }

      // Se não for um redirect, esta é a nossa resposta final
      finalResponse = response;
      break;
    }

    // Se o loop terminou sem uma resposta final (ex: muitos redirects), retorna erro
    if (!finalResponse) {
      return new Response(JSON.stringify({ error: 'Too many redirects' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Se a resposta final não for OK (ex: 404, 403), retorna o erro
    if (!finalResponse.ok && finalResponse.status !== 206) { // 206 é OK para Range requests
      return new Response(JSON.stringify({ 
        error: `Failed to fetch video: ${finalResponse.statusText}`,
        status: finalResponse.status,
        url: currentUrl
      }), {
        status: finalResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Monta os headers da resposta para o navegador do cliente
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified, Cache-Control');
    
    // Copia os headers importantes da resposta final do servidor de vídeo
    copyStreamingHeaders(finalResponse.headers, responseHeaders);

    // Retorna o corpo do vídeo como um stream para o navegador
    return new Response(finalResponse.body, {
      status: finalResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to proxy video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
