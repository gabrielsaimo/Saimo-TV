/**
 * Proxy de streaming — Cloudflare Pages Function.
 *
 * Faz pelo navegador o que o app Android faz pelo OkHttp: manda o `Referer` e o
 * `User-Agent` que certos CDNs exigem, resolve os redirecionamentos, e corrige o
 * diretório dos segmentos das playlists servidas por proxy de terceiros. Sem
 * isso o navegador não abre nem os canais com DRM (Referer proibido pelo fetch)
 * nem os Telecine (segmento no diretório do `url=`, não no da playlist).
 *
 * Parâmetros:
 *   url      — endereço de origem (obrigatório, URL-encoded)
 *   referer  — cabeçalho Referer a enviar (opcional)
 *   ua       — cabeçalho User-Agent a enviar (opcional)
 */

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
};

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
    if (from.has(h)) to.set(h, from.get(h)!);
  }
}

function isM3u8(url: string, contentType: string): boolean {
  return (
    url.includes('.m3u8') ||
    url.toLowerCase().split('?')[0].endsWith('.txt') ||
    contentType.includes('application/vnd.apple.mpegurl') ||
    contentType.includes('application/x-mpegurl') ||
    contentType.includes('audio/mpegurl')
  );
}

function isMpd(url: string, contentType: string): boolean {
  return url.includes('.mpd') || contentType.includes('application/dash+xml');
}

function resolveUrl(uri: string, base: string): string {
  try {
    return new URL(uri, base).href;
  } catch {
    return uri;
  }
}

/**
 * Corrige segmentos relativos de proxies cuja playlist aponta para outra pasta.
 *
 * A playlist chega em `/tos-.../proxy.m3u8`, mas o parâmetro
 * `url=https://origem/docs/telecinepipoca/__index.m3u8` diz que os segmentos
 * vivem em `/docs/telecinepipoca/`. Pedir o segmento ao lado da playlist devolve
 * 521; pedir na pasta do `url=` devolve o vídeo. Mesma correção que o app
 * Android faz em Playback.corrigirCaminhoDaPlaylist.
 */
export function fixNestedPath(manifestUrl: string, requestUrl: string): string {
  let manifest: URL;
  let request: URL;
  try {
    manifest = new URL(manifestUrl);
    request = new URL(requestUrl);
  } catch {
    return requestUrl;
  }

  // A própria playlist conserva a query assinada; só filhos relativos mudam.
  if (request.pathname === manifest.pathname) return requestUrl;
  if (manifest.protocol !== request.protocol || manifest.host !== request.host) {
    return requestUrl;
  }

  // `url=` carrega uma URL inteira com query própria, então o valor bruto é
  // fatiado na mão: URLSearchParams cortaria no primeiro `&` do endereço aninhado.
  const rawQuery = manifest.search.startsWith('?') ? manifest.search.slice(1) : manifest.search;
  const nestedValue = rawQuery
    .split('&')
    .find((part) => part.startsWith('url='))
    ?.slice('url='.length);
  if (!nestedValue) return requestUrl;

  let nestedPath: string;
  try {
    nestedPath = new URL(decodeURIComponent(nestedValue)).pathname;
  } catch {
    return requestUrl;
  }

  const manifestDir = manifest.pathname.slice(0, manifest.pathname.lastIndexOf('/') + 1);
  const nestedDir = nestedPath.slice(0, nestedPath.lastIndexOf('/') + 1);
  if (!manifestDir || !nestedDir) return requestUrl;
  if (!request.pathname.startsWith(manifestDir)) return requestUrl;

  const corrected = nestedDir + request.pathname.slice(manifestDir.length);
  return `${request.protocol}//${request.host}${corrected}${request.search}${request.hash}`;
}

/** Monta o endereço deste proxy para uma URL de origem, mantendo os cabeçalhos. */
function proxied(
  absolute: string,
  proxyOrigin: string,
  referer: string | null,
  ua: string | null,
): string {
  let out = `${proxyOrigin}/api/proxy?url=${encodeURIComponent(absolute)}`;
  if (referer) out += `&referer=${encodeURIComponent(referer)}`;
  if (ua) out += `&ua=${encodeURIComponent(ua)}`;
  return out;
}

/**
 * Igual a `proxied`, mas preserva `$Number$`/`$Time$` do DASH.
 *
 * O template é substituído pelo player depois de a URL estar montada, então os
 * cifrões precisam sobreviver ao encode — `%24Number%24` não é reconhecido.
 */
function proxiedTemplate(
  absolute: string,
  proxyOrigin: string,
  referer: string | null,
  ua: string | null,
): string {
  return proxied(absolute, proxyOrigin, referer, ua).replace(/%24/g, '$');
}

/** Reescreve o manifesto HLS para que todo filho passe por este proxy. */
export function rewriteM3u8(
  content: string,
  manifestUrl: string,
  proxyOrigin: string,
  referer: string | null,
  ua: string | null,
): string {
  const wrap = (uri: string): string => {
    const abs = fixNestedPath(manifestUrl, resolveUrl(uri, manifestUrl));
    return proxied(abs, proxyOrigin, referer, ua);
  };

  return content
    .split('\n')
    .map((line) => {
      // URI="..." de #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA
      const withUri = line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${wrap(uri)}"`);
      if (withUri.startsWith('#')) return withUri;
      const trimmed = withUri.trim();
      if (!trimmed) return withUri;
      return wrap(trimmed);
    })
    .join('\n');
}

/**
 * Reescreve o manifesto DASH para que segmentos e inicializações passem por aqui.
 *
 * O `BaseURL` é resolvido e removido: com os endereços já absolutos ele só
 * confundiria o player, que voltaria a montar caminhos relativos ao proxy.
 */
const unescapeXml = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

export function rewriteMpd(
  content: string,
  manifestUrl: string,
  proxyOrigin: string,
  referer: string | null,
  ua: string | null,
): string {
  const baseMatch = content.match(/<BaseURL[^>]*>([\s\S]*?)<\/BaseURL>/);
  const base = baseMatch ? resolveUrl(unescapeXml(baseMatch[1].trim()), manifestUrl) : manifestUrl;

  let out = content.replace(/<BaseURL[^>]*>[\s\S]*?<\/BaseURL>\s*/g, '');

  out = out.replace(
    /\b(initialization|media|sourceURL)="([^"]+)"/g,
    (match, attr: string, raw: string) => {
      const value = unescapeXml(raw);
      if (!value.trim()) return match;
      // `$Number$` não sobrevive ao new URL() nem ao encode: sai daqui como
      // marcador e volta literal, porque quem o substitui é o player.
      const placeholders: string[] = [];
      const masked = value.replace(/\$[^$]*\$/g, (token) => {
        placeholders.push(token);
        return `__DASHTOK${placeholders.length - 1}__`;
      });
      let abs = resolveUrl(masked, base);
      abs = abs.replace(/__DASHTOK(\d+)__/g, (_m, i: string) => placeholders[Number(i)]);
      const url = proxiedTemplate(abs, proxyOrigin, referer, ua);
      // Dentro de um atributo XML o separador de query precisa ser entidade.
      return `${attr}="${url.replace(/&/g, '&amp;')}"`;
    },
  );

  return out;
}

export const onRequest = async ({ request }: { request: Request }): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  const reqUrl = new URL(request.url);
  const videoUrl = reqUrl.searchParams.get('url');
  const referer = reqUrl.searchParams.get('referer');
  const ua = reqUrl.searchParams.get('ua');

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    // O valor já chega decodificado pelo URLSearchParams.
    const decodedUrl = videoUrl;

    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return new Response(JSON.stringify({ error: 'Invalid URL protocol' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const parsedOrigin = new URL(decodedUrl);
    const effectiveReferer = referer || `${parsedOrigin.protocol}//${parsedOrigin.hostname}/`;
    const refererOrigin = (() => {
      try {
        return new URL(effectiveReferer).origin;
      } catch {
        return `${parsedOrigin.protocol}//${parsedOrigin.hostname}`;
      }
    })();

    const clientHeaders: Record<string, string> = {
      'User-Agent': ua || DEFAULT_UA,
      Referer: effectiveReferer,
      Origin: refererOrigin,
      Accept: '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    const rangeHeader = request.headers.get('range');
    if (rangeHeader) clientHeaders['Range'] = rangeHeader;

    const originalReferer = clientHeaders['Referer'];
    const originalOrigin = clientHeaders['Origin'];

    let currentUrl = decodedUrl;
    if (decodedUrl.includes('dadinhodetapioca.fun/play/')) {
      try {
        const pageRes = await fetch(decodedUrl, {
          method: 'GET',
          headers: {
            Referer: 'https://rdcanais.org/',
            'User-Agent': clientHeaders['User-Agent'] || DEFAULT_UA,
          },
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const match = html.match(/STREAM_URLS\s*=\s*\[\s*"([^"]+)"/);
          if (match) {
            currentUrl = match[1].replace(/\\\//g, '/');
            clientHeaders['Referer'] = 'https://dadinhodetapioca.fun/';
            clientHeaders['Origin'] = 'https://dadinhodetapioca.fun';
          }
        }
      } catch {
        // se falhar a resolução dinâmica, tenta a URL original
      }
    }

    if (currentUrl.includes('tiktokcdn.live') || currentUrl.includes('tiktokcdn.com')) {
      clientHeaders['Referer'] = 'https://dadinhodetapioca.fun/';
      clientHeaders['Origin'] = 'https://dadinhodetapioca.fun';
    }

    let finalResponse: Response | null = null;
    const maxRedirects = 15;

    for (let i = 0; i < maxRedirects; i++) {
      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: clientHeaders,
          redirect: 'manual',
        });

        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          const locationHeader = response.headers.get('location')!;
          try { await response.body?.cancel(); } catch { /* corpo já descartado */ }

          currentUrl = resolveUrl(locationHeader, currentUrl);
          try {
            const nextParsed = new URL(currentUrl);
            if (
              nextParsed.hostname === 'www-fontedecanais-live.77zzhf54vdll71.com' ||
              nextParsed.hostname.endsWith('.77zzhf54vdll71.com')
            ) {
              nextParsed.port = '';
              nextParsed.protocol = 'https:';
              return new Response(null, {
                status: 302,
                headers: { Location: nextParsed.href, 'Cache-Control': 'no-store', ...CORS_HEADERS },
              });
            }
          } catch { /* segue fluxo normal */ }

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
      } catch {
        if (i < 2) continue; // Retenta erros transitórios
        throw new Error(`Failed to connect to ${currentUrl}`);
      }
    }

    if (!finalResponse) {
      return new Response(JSON.stringify({ error: 'Too many redirects or fetch failures' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    /*
     * Origem que não respondeu a tempo: repete antes de devolver erro.
     *
     * A borda da Cloudflare responde 5xx quando o CDN de origem engasga, e isso
     * acontece de vez em quando com os segmentos DASH da UOL. Uma segunda
     * tentativa costuma passar; sem ela o player descia para outra fonte por
     * causa de um soluço de dois segundos.
     */
    for (let i = 0; finalResponse.status >= 500 && i < 2; i++) {
      try { await finalResponse.body?.cancel(); } catch { /* corpo já descartado */ }
      await new Promise((pronto) => setTimeout(pronto, 300));
      try {
        finalResponse = await fetch(currentUrl, { method: 'GET', headers: clientHeaders });
      } catch {
        break;
      }
    }

    // Fallback para 403/404: tenta com outros cabeçalhos antes de desistir.
    if (finalResponse.status === 403 || finalResponse.status === 404) {
      const strategies: Array<Record<string, string>> = [
        {
          'User-Agent': clientHeaders['User-Agent'],
          Referer: originalReferer,
          Accept: '*/*',
          ...(clientHeaders['Cookie'] ? { Cookie: clientHeaders['Cookie'] } : {}),
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
        {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
        {
          'User-Agent': 'Lavf/58.29.100',
          Accept: '*/*',
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
        { ...(rangeHeader ? { Range: rangeHeader } : {}) },
      ];

      for (const headers of strategies) {
        try {
          const retry = await fetch(currentUrl, { method: 'GET', headers });
          if (retry.ok || retry.status === 206) {
            finalResponse = retry;
            break;
          }
          await retry.body?.cancel();
        } catch { /* estratégia seguinte */ }
      }
    }

    const contentType = finalResponse.headers.get('content-type') || '';
    let manifestHls = isM3u8(currentUrl, contentType);
    const manifestDash = isMpd(currentUrl, contentType);
    let hlsText: string | null = null;

    // Alguns masters apontam para sub-playlists em URLs opacas (`/m3/token`),
    // também servidas como text/plain. Só olhar extensão/MIME deixaria os
    // segmentos dessas listas fora do proxy e o CORS voltaria a bloqueá-los.
    if (!manifestHls && contentType.toLowerCase().includes('text/plain')) {
      const candidato = await finalResponse.clone().text();
      if (candidato.trimStart().startsWith('#EXTM3U')) {
        manifestHls = true;
        hlsText = candidato;
      }
    }

    /*
     * Vídeo comum já liberado para qualquer origem sai daqui por redirecionamento:
     * o navegador baixa direto do CDN, com o IP residencial dele, e o proxy não
     * carrega os gigabytes do filme. Só vale quando a origem manda o CORS e não
     * exige Referer — caso contrário o pedido direto do navegador falharia.
     */
    if (
      !manifestHls &&
      !manifestDash &&
      currentUrl.startsWith('https://') &&
      !referer &&
      finalResponse.headers.get('access-control-allow-origin')
    ) {
      try { await finalResponse.body?.cancel(); } catch { /* corpo já descartado */ }
      return new Response(null, {
        status: 302,
        headers: { Location: currentUrl, 'Cache-Control': 'no-store', ...CORS_HEADERS },
      });
    }

    if (!finalResponse.ok && finalResponse.status !== 206) {
      const isProxyBlocked = finalResponse.status === 403;
      return new Response(JSON.stringify({
        error: `Failed to fetch: ${finalResponse.statusText}`,
        status: finalResponse.status,
        ...(isProxyBlocked ? {
          reason: 'O servidor de vídeo está bloqueando acesso via proxy. Por favor abra em um player externo (VLC, etc).',
          hint: 'proxy_blocked',
        } : {}),
      }), {
        status: finalResponse.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const proxyOrigin = reqUrl.origin;
    // Mesmo sem um Referer declarado no catálogo, filhos de um master devem
    // carregar a origem do próprio master. Alguns CDNs de segmentos recusam
    // `Origin` calculado a partir do host do segmento e só aceitam a página que
    // publicou a playlist (embedplayer2, neste caso).
    const childReferer = referer ?? `${new URL(currentUrl).origin}/`;

    if (manifestHls) {
      const text = hlsText ?? await finalResponse.text();
      return new Response(rewriteM3u8(text, currentUrl, proxyOrigin, childReferer, ua), {
        status: finalResponse.status,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store',
          ...CORS_HEADERS,
        },
      });
    }

    if (manifestDash) {
      const text = await finalResponse.text();
      return new Response(rewriteMpd(text, currentUrl, proxyOrigin, referer, ua), {
        status: finalResponse.status,
        headers: {
          'Content-Type': 'application/dash+xml',
          'Cache-Control': 'no-store',
          ...CORS_HEADERS,
        },
      });
    }

    const responseHeaders = new Headers(CORS_HEADERS);
    responseHeaders.set(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified',
    );
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    responseHeaders.set('Accept-Ranges', 'bytes');
    copyStreamingHeaders(finalResponse.headers, responseHeaders);

    // Segmentos MPEG-TS mascarados como imagem PNG pelo TikTok CDN:
    // os primeiros 67 bytes contêm um cabeçalho PNG falso seguido por 0x47 (sync byte do TS).
    if (finalResponse.body && (currentUrl.includes('tiktokcdn.com') || currentUrl.includes('tiktokcdn.live'))) {
      const arrayBuf = await finalResponse.arrayBuffer();
      const u8 = new Uint8Array(arrayBuf);
      if (
        u8.length > 68 &&
        u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47 &&
        u8[67] === 0x47
      ) {
        responseHeaders.set('Content-Type', 'video/mp2t');
        responseHeaders.set('Content-Length', String(u8.byteLength - 67));
        return new Response(u8.subarray(67), {
          status: finalResponse.status,
          headers: responseHeaders,
        });
      }
      return new Response(arrayBuf, {
        status: finalResponse.status,
        headers: responseHeaders,
      });
    }

    if (currentUrl.includes('s1001604.lat') && currentUrl.split('?')[0].toLowerCase().endsWith('.png')) {
      responseHeaders.set('Content-Type', 'video/mp2t');
    }

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
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
};
