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
  // Adicionar logs para debug
  console.log('Proxy iniciado:', { 
    method: req.method,
    url: req.url,
    origin: req.headers.get('origin')
  });

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

  console.log('URL do vídeo:', videoUrl);

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const decodedUrl = decodeURIComponent(videoUrl);
    
    console.log('URL decodificada:', decodedUrl);
    
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return new Response(JSON.stringify({ error: 'Invalid URL protocol' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Headers otimizados para evitar bloqueios de servidores
    const clientHeaders: Record<string, string> = {
      // User-Agent realista que se parece com navegador real
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      // Referer - MUITO IMPORTANTE para evitar bloqueios 403
      'Referer': decodedUrl.includes('camelo.vip') ? 'http://camelo.vip/' : 
                 decodedUrl.includes('govfederal.org') ? 'http://govfederal.org/' :
                 decodedUrl,
      // Origin importante para CORS
      'Origin': decodedUrl.includes('camelo.vip') ? 'http://camelo.vip' : 
                decodedUrl.includes('govfederal.org') ? 'http://govfederal.org' :
                new URL(decodedUrl).origin,
      // Headers padrão de navegador
      'Accept': 'video/mp4,video/webm,video/*,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors', // IMPORTANTE: usa no-cors para evitar verificações
      'Sec-Fetch-Site': 'cross-site',
    };

    // Suporte para Range requests (essencial para seeking)
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      clientHeaders['Range'] = rangeHeader;
    }
    
    console.log('Headers sendo enviados:', clientHeaders);

    let currentUrl = decodedUrl;
    let finalResponse: Response | null = null;
    const maxRedirects = 5;

    console.log('Iniciando fetch para:', currentUrl);

    for (let i = 0; i < maxRedirects; i++) {
      console.log(`Tentativa ${i + 1} de ${maxRedirects}:`, currentUrl);
      
      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: clientHeaders,
          redirect: 'manual',
        });

        console.log('Resposta do servidor:', {
          status: response.status,
          statusText: response.statusText,
        });

        // Se for um redirect (status 3xx), atualiza a URL e continua
        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          const locationHeader = response.headers.get('location')!;
          console.log('Redirect detectado para:', locationHeader);
          currentUrl = new URL(locationHeader, currentUrl).href;
          
          // Atualiza headers de origem para a nova URL
          const newOrigin = new URL(currentUrl).origin;
          clientHeaders['Origin'] = newOrigin;
          clientHeaders['Referer'] = newOrigin + '/';
          continue;
        }

        finalResponse = response;
        break;
      } catch (fetchError) {
        console.log('Erro no fetch:', fetchError);
        
        // Se falhou, tenta uma estratégia alternativa sem alguns headers
        if (i === 0) {
          console.log('Tentando estratégia alternativa...');
          delete clientHeaders['Sec-Fetch-Mode'];
          delete clientHeaders['Sec-Fetch-Dest'];
          delete clientHeaders['Sec-Fetch-Site'];
          continue;
        }
        
        throw fetchError;
      }
    }

    if (!finalResponse) {
      console.log('Erro: muitos redirects ou falhas');
      return new Response(JSON.stringify({ error: 'Too many redirects or fetch failures' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!finalResponse.ok && finalResponse.status !== 206) {
      console.log('Erro na resposta final:', {
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        url: currentUrl
      });
      
      // Tenta uma última estratégia se for 403
      if (finalResponse.status === 403) {
        console.log('403 Forbidden detectado, tentando estratégia alternativa...');
        
        // Remove mais headers restritivos
        const simplifiedHeaders = {
          'User-Agent': clientHeaders['User-Agent'],
          'Accept': clientHeaders['Accept'],
        };
        
        if (rangeHeader) {
          simplifiedHeaders['Range'] = rangeHeader;
        }

        try {
          const retryResponse = await fetch(currentUrl, {
            method: 'GET',
            headers: simplifiedHeaders,
          });
          
          if (retryResponse.ok || retryResponse.status === 206) {
            console.log('Estratégia alternativa funcionou!');
            finalResponse = retryResponse;
          }
        } catch (retryError) {
          console.log('Estratégia alternativa também falhou:', retryError);
        }
      }
      
      // Se ainda não funcionou, retorna erro
      if (!finalResponse.ok && finalResponse.status !== 206) {
        return new Response(JSON.stringify({ 
          error: `Failed to fetch video: ${finalResponse.statusText}`,
          status: finalResponse.status,
          url: currentUrl
        }), {
          status: finalResponse.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('Sucesso! Montando resposta proxy...');

    // Monta os headers da resposta
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified, Cache-Control');
    
    copyStreamingHeaders(finalResponse.headers, responseHeaders);

    console.log('Headers da resposta:', Object.fromEntries(responseHeaders.entries()));

    return new Response(finalResponse.body, {
      status: finalResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Erro no proxy:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to proxy video',
      details: error instanceof Error ? error.message : 'Unknown error',
      originalUrl: videoUrl
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
