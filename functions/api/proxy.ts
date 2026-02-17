function copyStreamingHeaders(from: Headers, to: Headers): void {
  const headersToCopy = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
  ];
  for (const h of headersToCopy) {
    if (from.has(h)) {
      to.set(h, from.get(h)!);
    }
  }
}

export const onRequest = async ({ request }: { request: Request }): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
      },
    });
  }

  const url = new URL(request.url);
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

    const clientHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Referer': `${new URL(decodedUrl).protocol}//${new URL(decodedUrl).hostname}/`,
      'Origin': `${new URL(decodedUrl).protocol}//${new URL(decodedUrl).hostname}`,
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      clientHeaders['Range'] = rangeHeader;
    }

    const originalReferer = clientHeaders['Referer'];
    const originalOrigin = clientHeaders['Origin'];

    let currentUrl = decodedUrl;
    let finalResponse: Response | null = null;
    const maxRedirects = 5;

    for (let i = 0; i < maxRedirects; i++) {
      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: clientHeaders,
          redirect: 'manual',
        });

        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          const locationHeader = response.headers.get('location')!;
          try { await response.body?.cancel(); } catch { }

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

          const setCookie = response.headers.get('set-cookie');
          if (setCookie) {
            const existingCookie = clientHeaders['Cookie'] || '';
            clientHeaders['Cookie'] = existingCookie ? `${existingCookie}; ${setCookie}` : setCookie;
          }

          clientHeaders['Referer'] = originalReferer;
          clientHeaders['Origin'] = originalOrigin;
          continue;
        }

        finalResponse = response;
        break;
      } catch (fetchError) {
        if (i === 0) continue;
        throw fetchError;
      }
    }

    if (!finalResponse) {
      return new Response(JSON.stringify({ error: 'Too many redirects or fetch failures' }), { status: 500 });
    }

    // Estratégias de fallback para 403/404
    if (finalResponse.status === 403 || finalResponse.status === 404) {
      const retryHeaders1: Record<string, string> = {
        'User-Agent': clientHeaders['User-Agent'],
        'Referer': originalReferer,
        'Accept': '*/*',
      };
      if (clientHeaders['Cookie']) retryHeaders1['Cookie'] = clientHeaders['Cookie'];
      if (rangeHeader) retryHeaders1['Range'] = rangeHeader;

      try {
        const retry1 = await fetch(currentUrl, { method: 'GET', headers: retryHeaders1 });
        if (retry1.ok || retry1.status === 206) {
          finalResponse = retry1;
        } else {
          await retry1.body?.cancel();

          const retryHeaders2: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
          };
          if (rangeHeader) retryHeaders2['Range'] = rangeHeader;
          const retry2 = await fetch(currentUrl, { method: 'GET', headers: retryHeaders2 });
          if (retry2.ok || retry2.status === 206) {
            finalResponse = retry2;
          } else {
            await retry2.body?.cancel();

            const retryHeaders3: Record<string, string> = { 'User-Agent': 'Lavf/58.29.100', 'Accept': '*/*' };
            if (rangeHeader) retryHeaders3['Range'] = rangeHeader;
            const retry3 = await fetch(currentUrl, { method: 'GET', headers: retryHeaders3 });
            if (retry3.ok || retry3.status === 206) {
              finalResponse = retry3;
            } else {
              await retry3.body?.cancel();
            }
          }
        }
      } catch { }
    }

    if (!finalResponse.ok && finalResponse.status !== 206) {
      return new Response(JSON.stringify({
        error: `Failed to fetch video: ${finalResponse.statusText}`,
        status: finalResponse.status,
      }), {
        status: finalResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified');
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    copyStreamingHeaders(finalResponse.headers, responseHeaders);

    return new Response(finalResponse.body, {
      status: finalResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to proxy video',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
