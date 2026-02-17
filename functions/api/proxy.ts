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

function isM3u8(url: string, contentType: string): boolean {
  return (
    url.includes('.m3u8') ||
    contentType.includes('application/vnd.apple.mpegurl') ||
    contentType.includes('application/x-mpegurl') ||
    contentType.includes('audio/mpegurl')
  );
}

function resolveUrl(uri: string, base: string): string {
  try {
    return new URL(uri, base).href;
  } catch {
    return uri;
  }
}

// Reescreve URLs HTTP dentro do manifesto M3U8 para passar pelo proxy
function rewriteM3u8(content: string, baseUrl: string, proxyOrigin: string): string {
  const lines = content.split('\n');
  return lines.map(line => {
    // Reescreve URI="..." dentro de tags como #EXT-X-KEY, #EXT-X-MAP
    const rewrittenLine = line.replace(/URI="([^"]+)"/g, (_match, uri) => {
      const abs = resolveUrl(uri, baseUrl);
      if (abs.startsWith('http://')) {
        return `URI="${proxyOrigin}/api/proxy?url=${encodeURIComponent(abs)}"`;
      }
      return `URI="${abs}"`;
    });

    // Linhas de comentário (#...) não são URLs de segmento
    if (rewrittenLine.startsWith('#')) return rewrittenLine;

    const trimmed = rewrittenLine.trim();
    if (!trimmed) return rewrittenLine;

    // Linha de URL de segmento ou sub-playlist
    const abs = resolveUrl(trimmed, baseUrl);
    if (abs.startsWith('http://')) {
      return `${proxyOrigin}/api/proxy?url=${encodeURIComponent(abs)}`;
    }
    return abs; // HTTPS já está ok
  }).join('\n');
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

  const reqUrl = new URL(request.url);
  const videoUrl = reqUrl.searchParams.get('url');

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
    const maxRedirects = 15; // aumentado de 5 para 15

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
      const strategies = [
        {
          'User-Agent': clientHeaders['User-Agent'],
          'Referer': originalReferer,
          'Accept': '*/*',
          ...(clientHeaders['Cookie'] ? { 'Cookie': clientHeaders['Cookie'] } : {}),
          ...(rangeHeader ? { 'Range': rangeHeader } : {}),
        },
        {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
          ...(rangeHeader ? { 'Range': rangeHeader } : {}),
        },
        {
          'User-Agent': 'Lavf/58.29.100',
          'Accept': '*/*',
          ...(rangeHeader ? { 'Range': rangeHeader } : {}),
        },
      ];

      for (const headers of strategies) {
        try {
          const retry = await fetch(currentUrl, { method: 'GET', headers });
          if (retry.ok || retry.status === 206) {
            finalResponse = retry;
            break;
          }
          await retry.body?.cancel();
        } catch { }
      }
    }

    if (!finalResponse.ok && finalResponse.status !== 206) {
      return new Response(JSON.stringify({
        error: `Failed to fetch: ${finalResponse.statusText}`,
        status: finalResponse.status,
      }), {
        status: finalResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = finalResponse.headers.get('content-type') || '';

    // Reescreve m3u8 para que segmentos HTTP também passem pelo proxy
    if (isM3u8(currentUrl, contentType)) {
      const text = await finalResponse.text();
      const proxyOrigin = reqUrl.origin;
      const rewritten = rewriteM3u8(text, currentUrl, proxyOrigin);

      return new Response(rewritten, {
        status: finalResponse.status,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Para demais conteúdos (MP4, TS, etc): streaming direto
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
