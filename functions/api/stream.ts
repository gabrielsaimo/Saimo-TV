/**
 * Endpoint central de streaming para filmes e séries do Saimo TV.
 *
 * Resolve o stream sob demanda nos provedores (FenixFlix / Magnetflix)
 * e redireciona (HTTP 302) para a URL direta do vídeo com token fresco.
 *
 * Funciona de forma transparente em TODOS os aplicativos e no site:
 *   /api/stream?tipo=movie&id=533535
 *   /api/stream?tipo=series&id=194764&s=1&e=1&versao=dub
 */

const FENIX_BASE = 'https://fenixflix.fenixhub.online';
const MAGNET_BASE = 'https://magnetflix.flixbr.online';
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface StreamItem {
  name?: string;
  title?: string;
  url?: string;
  behaviorHints?: { bingeGroup?: string };
}

function classificar(s: StreamItem): 'dub' | 'leg' {
  const texto = `${s.name || ''} ${s.title || ''} ${s.behaviorHints?.bingeGroup || ''}`.toLowerCase();
  if (texto.includes('dub') || texto.includes('dual') || texto.includes('nacional') || texto.includes('🇧🇷') || texto.includes('pt-br')) {
    return 'dub';
  }
  if (texto.includes('leg') || texto.includes('sub') || texto.includes('legendado')) {
    return 'leg';
  }
  return 'dub';
}

interface AddonResult {
  streams: StreamItem[];
  status: number;
  err?: string;
}

async function buscarAddon(url: string, timeoutMs: number = 5000): Promise<AddonResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': AGENTE, 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return { streams: [], status: res.status, err: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { streams?: StreamItem[] };
    return { streams: data.streams || [], status: res.status };
  } catch (e: any) {
    return { streams: [], status: 0, err: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function buscarNoCatalogo(id: string, isSerie: boolean, season: string, episode: string, versao: string): Promise<string | null> {
  const CATALOG_BASE = 'https://filmes-saimo.pages.dev';
  try {
    const fichasRes = await fetch(`${CATALOG_BASE}/fichas.txt`);
    if (!fichasRes.ok) return null;
    const fichasTxt = await fichasRes.text();
    const prefixoTipo = isSerie ? 's' : 'f';
    let tituloAchado = '';
    for (const linha of fichasTxt.split('\n')) {
      const p = linha.split('\t');
      if (p.length >= 3 && p[0] === prefixoTipo && p[2] === id) {
        tituloAchado = p[1];
        break;
      }
    }
    if (!tituloAchado) return null;

    const norm = tituloAchado.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
    const inicial = norm.charAt(0).toUpperCase();
    const l = (inicial >= 'A' && inicial <= 'Z') ? inicial : '#';

    if (!isSerie) {
      const fRes = await fetch(`${CATALOG_BASE}/filmes-${l}.txt`);
      if (!fRes.ok) return null;
      const fTxt = await fRes.text();
      for (const linha of fTxt.split('\n')) {
        const p = linha.split('\t');
        if (p.length >= 2 && (p[0] === tituloAchado || p[0].startsWith(tituloAchado.split(' (')[0]))) {
          for (let i = 1; i < p.length; i++) {
            if (p[i].startsWith(`${versao}=`) || p[i].startsWith('dub=') || p[i].startsWith('leg=')) {
              const urls = p[i].substring(4).split(',');
              for (const u of urls) {
                if (u && !u.includes('api/stream')) return u;
              }
            }
          }
        }
      }
    }
  } catch {}
  return null;
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const tipo = (url.searchParams.get('tipo') || url.searchParams.get('type') || 'movie').toLowerCase();
  let id = (url.searchParams.get('id') || '').trim();
  const s = url.searchParams.get('s') || url.searchParams.get('t') || url.searchParams.get('temporada') || '1';
  const e = url.searchParams.get('e') || url.searchParams.get('ep') || url.searchParams.get('episodio') || '1';
  const versao = (url.searchParams.get('versao') || url.searchParams.get('v') || 'dub').toLowerCase();
  const querJson = url.searchParams.get('json') === '1';
  const debug = url.searchParams.get('debug') === '1';

  if (!id) {
    return new Response(JSON.stringify({ error: 'Parâmetro "id" é obrigatório' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Suporte a IDs combinados tipo "194764:1:1" no parâmetro id
  let season = s;
  let episode = e;
  if (id.includes(':')) {
    const partes = id.split(':');
    id = partes[0];
    if (partes.length >= 3) {
      season = partes[1];
      episode = partes[2];
    }
  }

  const cleanId = id.replace(/^(tmdb:|imdb:)/i, '');
  const prefixId = cleanId.startsWith('tt') ? cleanId : `tmdb:${cleanId}`;
  const isSerie = tipo === 'series' || tipo === 'tv';

  const fenixUrl = isSerie
    ? `${FENIX_BASE}/stream/series/${prefixId}:${season}:${episode}.json`
    : `${FENIX_BASE}/stream/movie/${prefixId}.json`;

  const magnetUrl = isSerie
    ? `${MAGNET_BASE}/stream/series/${prefixId}:${season}:${episode}.json`
    : `${MAGNET_BASE}/stream/movie/${prefixId}.json`;

  // Busca em paralelo com limite de 6s
  const [fenixRes, magnetRes] = await Promise.all([
    buscarAddon(fenixUrl, 5000),
    buscarAddon(magnetUrl, 5000),
  ]);

  let todos = [...fenixRes.streams, ...magnetRes.streams].filter(st => !!st.url);

  // Se não achou streams e o ID é numérico (TMDB), tenta resolver o IMDb ID via TMDB API
  let fallbackRes: AddonResult | undefined;
  if (todos.length === 0 && /^\d+$/.test(cleanId)) {
    try {
      const extRes = await fetch(
        `https://api.themoviedb.org/3/${isSerie ? 'tv' : 'movie'}/${cleanId}/external_ids?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb`,
        { headers: { 'User-Agent': AGENTE, 'Accept': 'application/json' } }
      );
      if (extRes.ok) {
        const extData = (await extRes.json()) as { imdb_id?: string };
        if (extData?.imdb_id) {
          const imdbId = extData.imdb_id;
          const fallbackUrl = isSerie
            ? `${FENIX_BASE}/stream/series/${imdbId}:${season}:${episode}.json`
            : `${FENIX_BASE}/stream/movie/${imdbId}.json`;
          fallbackRes = await buscarAddon(fallbackUrl, 5000);
          todos = fallbackRes.streams.filter(st => !!st.url);
        }
      }
    } catch {}
  }

  if (todos.length === 0) {
    const doCatalogo = await buscarNoCatalogo(cleanId, isSerie, season, episode, versao);
    if (doCatalogo) {
      todos = [{ url: doCatalogo, title: 'Catálogo Saimo' }];
    }
  }

  if (todos.length === 0) {
    let rawText = '';
    let fallbackText = '';
    let imdbIdUsed = '';
    let fenixHeaders: Record<string, string> = {};
    let outboundEcho: any = null;
    let testVariants: Record<string, any> = {};

    try {
      const r = await fetch(fenixUrl, { headers: { 'User-Agent': AGENTE, 'Accept': 'application/json' } });
      rawText = await r.text();
      r.headers.forEach((v, k) => { fenixHeaders[k] = v; });
    } catch (e: any) {
      rawText = e?.message || String(e);
    }

    // Teste 1: com nocache param
    try {
      const rNoCache = await fetch(`${fenixUrl}?_t=${Date.now()}`, { headers: { 'Accept': '*/*' } });
      testVariants['nocache_param'] = (await rNoCache.text()).slice(0, 150);
    } catch (e: any) {
      testVariants['nocache_param'] = e?.message;
    }

    // Teste 2: com client IP em X-Forwarded-For
    const clientIp = request.headers.get('cf-connecting-ip') || '';
    if (clientIp) {
      try {
        const rXff = await fetch(fenixUrl, {
          headers: { 'X-Forwarded-For': clientIp, 'User-Agent': AGENTE, 'Accept': 'application/json' }
        });
        testVariants['xff_client'] = (await rXff.text()).slice(0, 150);
      } catch (e: any) {
        testVariants['xff_client'] = e?.message;
      }
    }

    // Teste 3: o que o outbound fetch manda para a internet
    try {
      const echoRes = await fetch('https://httpbin.org/headers');
      outboundEcho = await echoRes.json();
    } catch (e: any) {
      outboundEcho = e?.message;
    }

    if (/^\d+$/.test(cleanId)) {
      try {
        const ext = await (await fetch(`https://api.themoviedb.org/3/${isSerie ? 'tv' : 'movie'}/${cleanId}/external_ids?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb`)).json() as any;
        imdbIdUsed = ext?.imdb_id || '';
        if (imdbIdUsed) {
          const fb = await fetch(`${FENIX_BASE}/stream/${isSerie ? 'series' : 'movie'}/${imdbIdUsed}${isSerie ? `:${season}:${episode}` : ''}.json`, { headers: { 'User-Agent': AGENTE, 'Accept': 'application/json' } });
          fallbackText = await fb.text();
        }
      } catch (e: any) {
        fallbackText = e?.message || String(e);
      }
    }
    return new Response(JSON.stringify({
      error: 'Nenhum stream encontrado para este título',
      fenixUrl,
      rawText,
      fenixHeaders,
      testVariants,
      outboundEcho,
      imdbIdUsed,
      fallbackText,
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Filtra de acordo com a versão pedida (dublado/legendado)
  const candidatos = todos.filter(st => classificar(st) === versao);
  let escolhido = (candidatos.length > 0 ? candidatos[0] : todos[0]).url!;

  // Se a URL aponta para servidores de redirecionamento legados (dbonline/zjo/corruptx),
  // segue o redirecionamento para pegar a URL final (ex: Cloudflare Workers HTTPS)
  if (escolhido.includes('tech-cdn.top') || escolhido.includes('zjo.lat') || escolhido.includes('corruptx.org')) {
    try {
      const probe = await fetch(escolhido, {
        method: 'GET',
        headers: { 'User-Agent': AGENTE, 'Range': 'bytes=0-1' },
        redirect: 'follow',
      });
      if (probe.url && probe.url.startsWith('http')) {
        escolhido = probe.url;
      }
    } catch {}
  }

  // Garante HTTPS apenas quando suportado (não força https em portas :80 nem certificados quebrados)
  if (escolhido.startsWith('http://')) {
    try {
      const parsed = new URL(escolhido);
      if (parsed.port !== '80' && !parsed.hostname.includes('tech-cdn.top') && !parsed.hostname.includes('corruptx.org')) {
        escolhido = 'https://' + escolhido.slice(7);
      } else if (parsed.hostname.includes('workers.dev')) {
        escolhido = 'https://' + escolhido.slice(7);
      }
    } catch {
      escolhido = 'https://' + escolhido.slice(7);
    }
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Cache-Control', 'public, max-age=600'); // 10 min de cache

  if (querJson) {
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify({
      url: escolhido,
      tipo,
      id: cleanId,
      temporada: isSerie ? parseInt(season, 10) : undefined,
      episodio: isSerie ? parseInt(episode, 10) : undefined,
      versao,
    }), { status: 200, headers });
  }

  headers.set('Location', escolhido);
  return new Response(null, { status: 302, headers });
};

export const onRequestHead = onRequestGet;

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
};
