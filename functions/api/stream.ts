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

async function buscarAddon(url: string, timeoutMs: number = 5000): Promise<StreamItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': AGENTE, 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const data = await res.json() as { streams?: StreamItem[] };
    return data.streams || [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const tipo = (url.searchParams.get('tipo') || url.searchParams.get('type') || 'movie').toLowerCase();
  let id = (url.searchParams.get('id') || '').trim();
  const s = url.searchParams.get('s') || url.searchParams.get('t') || url.searchParams.get('temporada') || '1';
  const e = url.searchParams.get('e') || url.searchParams.get('ep') || url.searchParams.get('episodio') || '1';
  const versao = (url.searchParams.get('versao') || url.searchParams.get('v') || 'dub').toLowerCase();
  const querJson = url.searchParams.get('json') === '1';

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
  const [fenixStreams, magnetStreams] = await Promise.all([
    buscarAddon(fenixUrl, 5000),
    buscarAddon(magnetUrl, 5000),
  ]);

  let todos = [...fenixStreams, ...magnetStreams].filter(st => !!st.url);

  // Se não achou streams e o ID é numérico (TMDB), tenta resolver o IMDb ID via TMDB API
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
          const fallbackStreams = await buscarAddon(fallbackUrl, 5000);
          todos = fallbackStreams.filter(st => !!st.url);
        }
      }
    } catch {}
  }

  if (todos.length === 0) {
    return new Response(JSON.stringify({ error: 'Nenhum stream encontrado para este título' }), {
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
  const escolhido = (candidatos.length > 0 ? candidatos[0] : todos[0]).url!;

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
