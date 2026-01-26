export const config = {
  runtime: 'edge',
};

// Função para copiar os headers de streaming da resposta final para o cliente
// NOTA: Não copiamos cache-control para manter nosso no-store
function copyStreamingHeaders(from: Headers, to: Headers): void {
  const headersToCopy = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
    // REMOVIDO: 'cache-control' - queremos manter nosso no-store
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
    // NOTA: Servidores IPTV frequentemente bloqueiam IPs de datacenter
    // Usamos headers minimalistas para parecer um cliente legítimo
    const clientHeaders: Record<string, string> = {
      // User-Agent realista
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      // Referer - Normalizado sem portas padrão (80/443) para maximizar compatibilidade
      'Referer': `${new URL(decodedUrl).protocol}//${new URL(decodedUrl).hostname}/`,
      // Origin - Normalizado sem portas padrão
      'Origin': `${new URL(decodedUrl).protocol}//${new URL(decodedUrl).hostname}`,
      // Headers básicos de navegador (sem Sec-Fetch-* que identificam proxies)
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    // Suporte para Range requests (essencial para seeking)
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      clientHeaders['Range'] = rangeHeader;
    }

    console.log('Headers sendo enviados:', clientHeaders);

    // IMPORTANTE: Guardar o Referer/Origin originais - alguns servidores exigem
    // que esses headers se mantenham mesmo após redirects para IPs diferentes
    const originalReferer = clientHeaders['Referer'];
    const originalOrigin = clientHeaders['Origin'];

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

          // IMPORTANTE: Cancelar o body stream para liberar recursos no Edge Runtime
          // Sem isso, a conexão pode ficar aberta e interferir com os próximos fetches
          try {
            await response.body?.cancel();
          } catch {
            // Ignora erros ao cancelar o body
          }

          // Resolver a URL de redirect preservando a codificação original
          // O problema: new URL().href pode decodificar %20 para espaços, 
          // e alguns servidores requerem a forma codificada
          if (locationHeader.startsWith('http://') || locationHeader.startsWith('https://')) {
            // URL absoluta - usar diretamente (preserva a codificação original)
            currentUrl = locationHeader;
          } else if (locationHeader.startsWith('/')) {
            // URL relativa à raiz - combinar com origin da URL atual
            const baseUrl = new URL(currentUrl);
            currentUrl = baseUrl.origin + locationHeader;
          } else {
            // URL relativa ao path atual
            const baseUrl = new URL(currentUrl);
            const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
            currentUrl = baseUrl.origin + basePath + locationHeader;
          }

          console.log('URL após resolver redirect:', currentUrl);

          // IMPORTANTE: NÃO atualizar Referer/Origin após redirect!
          // Servidores como camelo.vip redirecionam para IPs mas esperam
          // que o Referer continue sendo o domínio original
          // Mantemos os headers originais:
          clientHeaders['Referer'] = originalReferer;
          clientHeaders['Origin'] = originalOrigin;
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

      // Tenta uma última estratégia se for 403 ou 404 (alguns servidores retornam 404 para bloquear)
      if (finalResponse.status === 403 || finalResponse.status === 404) {
        console.log(`${finalResponse.status} detectado, tentando estratégias alternativas...`);

        // Estratégia 1: Retry com Referer original + headers mínimos
        const retryHeaders1: Record<string, string> = {
          'User-Agent': clientHeaders['User-Agent'],
          'Referer': originalReferer,
          'Accept': '*/*',
        };
        if (rangeHeader) retryHeaders1['Range'] = rangeHeader;

        try {
          console.log('Tentativa 1: headers mínimos com Referer original');
          const retry1 = await fetch(currentUrl, { method: 'GET', headers: retryHeaders1 });
          if (retry1.ok || retry1.status === 206) {
            console.log('Estratégia 1 funcionou!');
            finalResponse = retry1;
          } else {
            await retry1.body?.cancel();
          }
        } catch (e) {
          console.log('Estratégia 1 falhou:', e);
        }

        // Estratégia 2: Apenas User-Agent (alguns servidores não aceitam Referer de outro domínio)
        if (!finalResponse.ok && finalResponse.status !== 206) {
          const retryHeaders2: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
          };
          if (rangeHeader) retryHeaders2['Range'] = rangeHeader;

          try {
            console.log('Tentativa 2: apenas User-Agent mobile');
            const retry2 = await fetch(currentUrl, { method: 'GET', headers: retryHeaders2 });
            if (retry2.ok || retry2.status === 206) {
              console.log('Estratégia 2 funcionou!');
              finalResponse = retry2;
            } else {
              await retry2.body?.cancel();
            }
          } catch (e) {
            console.log('Estratégia 2 falhou:', e);
          }
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

    // IMPORTANTE: Desabilitar cache da Vercel para evitar respostas corrompidas
    // A Vercel estava cacheando respostas vazias e servindo-as como válidas
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    responseHeaders.set('CDN-Cache-Control', 'no-store');
    responseHeaders.set('Vercel-CDN-Cache-Control', 'no-store');

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
