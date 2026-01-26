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

    // Coleta logs para debug se solicitado
    const isDebug = url.searchParams.get('debug') === 'true';
    const debugLogs: any[] = [];

    const logDebug = (msg: string, data?: any) => {
      console.log(msg, data || '');
      if (isDebug) debugLogs.push({ msg, data, time: new Date().toISOString() });
    };

    logDebug('Iniciando fetch para:', currentUrl);

    for (let i = 0; i < maxRedirects; i++) {
      logDebug(`Tentativa ${i + 1} de ${maxRedirects}:`, currentUrl);

      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: clientHeaders,
          redirect: 'manual',
        });

        logDebug('Resposta do servidor:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        // Se for um redirect (status 3xx), atualiza a URL e continua
        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          const locationHeader = response.headers.get('location')!;
          logDebug('Redirect detectado para:', locationHeader);

          try {
            await response.body?.cancel();
          } catch { }

          if (locationHeader.startsWith('http://') || locationHeader.startsWith('https://')) {
            currentUrl = locationHeader;
          } else if (locationHeader.startsWith('/')) {
            const baseUrl = new URL(currentUrl);
            currentUrl = baseUrl.origin + locationHeader;
          } else {
            const baseUrl = new URL(currentUrl);
            const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
            currentUrl = baseUrl.origin + basePath + locationHeader;
          }

          logDebug('URL após resolver redirect:', currentUrl);

          // Captura cookies do redirecionamento para manter a sessão
          const setCookie = response.headers.get('set-cookie');
          if (setCookie) {
            logDebug('Cookie recebido no redirect:', setCookie);
            const existingCookie = clientHeaders['Cookie'] || '';
            // Basic cookie merging (append)
            clientHeaders['Cookie'] = existingCookie ? `${existingCookie}; ${setCookie}` : setCookie;
          }

          // IMPORTANTE: Manter headers originais no redirect
          clientHeaders['Referer'] = originalReferer;
          clientHeaders['Origin'] = originalOrigin;
          continue;
        }

        finalResponse = response;
        break;
      } catch (fetchError) {
        logDebug('Erro no fetch:', fetchError instanceof Error ? fetchError.message : fetchError);

        if (i === 0) {
          logDebug('Tentando estratégia alternativa (removendo headers Sec-*)...');
          delete clientHeaders['Sec-Fetch-Mode'];
          delete clientHeaders['Sec-Fetch-Dest'];
          delete clientHeaders['Sec-Fetch-Site'];
          continue;
        }
        throw fetchError;
      }
    }

    if (!finalResponse) {
      if (isDebug) return new Response(JSON.stringify({ error: 'No response', logs: debugLogs }, null, 2), { headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'Too many redirects or fetch failures' }), { status: 500 });
    }

    // Tenta uma última estratégia se for 403 ou 404
    if (finalResponse.status === 403 || finalResponse.status === 404) {
      logDebug(`${finalResponse.status} detectado, tentando estratégias alternativas...`);

      // Estratégia 1: Retry com Referer original + headers mínimos
      const retryHeaders1: Record<string, string> = {
        'User-Agent': clientHeaders['User-Agent'],
        'Referer': originalReferer,
        'Accept': '*/*',
      };
      // Forward cookies for retry too!
      if (clientHeaders['Cookie']) retryHeaders1['Cookie'] = clientHeaders['Cookie'];
      if (rangeHeader) retryHeaders1['Range'] = rangeHeader;

      try {
        logDebug('Tentativa Extra 1: headers mínimos com Referer original');
        const retry1 = await fetch(currentUrl, { method: 'GET', headers: retryHeaders1 });
        logDebug('Resposta Extra 1:', { status: retry1.status });

        if (retry1.ok || retry1.status === 206) {
          logDebug('Estratégia 1 funcionou!');
          finalResponse = retry1;
        } else {
          await retry1.body?.cancel();
        }
      } catch (e) {
        logDebug('Estratégia 1 falhou:', e);
      }

      // Estratégia 2: Mobile UA, sem Referer
      if (!finalResponse.ok && finalResponse.status !== 206) {
        const retryHeaders2: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
        };
        if (rangeHeader) retryHeaders2['Range'] = rangeHeader;

        try {
          logDebug('Tentativa Extra 2: apenas User-Agent mobile');
          const retry2 = await fetch(currentUrl, { method: 'GET', headers: retryHeaders2 });
          logDebug('Resposta Extra 2:', { status: retry2.status });

          if (retry2.ok || retry2.status === 206) {
            logDebug('Estratégia 2 funcionou!');
            finalResponse = retry2;
          } else {
            await retry2.body?.cancel();
          }
        } catch (e) {
          logDebug('Estratégia 2 falhou:', e);
        }
      }

      // Estratégia 3: User-Agent de Player de Vídeo (VLC/FFmpeg)
      if (!finalResponse.ok && finalResponse.status !== 206) {
        const retryHeaders3: Record<string, string> = {
          'User-Agent': 'Lavf/58.29.100', // Common FFmpeg/Player UA
          'Accept': '*/*',
        };
        // Tenta sem Referer primeiro, pois players geralmente não enviam
        if (rangeHeader) retryHeaders3['Range'] = rangeHeader;

        try {
          console.log('Tentativa Extra 3: User-Agent de Player (Lavf)');
          const retry3 = await fetch(currentUrl, { method: 'GET', headers: retryHeaders3 });
          logDebug('Resposta Extra 3:', { status: retry3.status });

          if (retry3.ok || retry3.status === 206) {
            console.log('Estratégia 3 funcionou!');
            finalResponse = retry3;
          } else {
            await retry3.body?.cancel();
          }
        } catch (e) {
          logDebug('Estratégia 3 falhou:', e);
        }
      }
    }

    if (isDebug) {
      return new Response(JSON.stringify({
        msg: 'Debug Complete',
        finalStatus: finalResponse.status,
        logs: debugLogs
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
