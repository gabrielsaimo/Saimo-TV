/**
 * Supabase RPC Service
 *
 * Todos os dados de filmes/séries vêm diretamente da API Supabase via RPC.
 * Referência: API.md
 */

import type { EnrichedMovie, EnrichedSeries } from '../types/enrichedMovie';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdW1heXBxaHh6anNzYXJteXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MDU1ODUsImV4cCI6MjA4Nzk4MTU4NX0.Ff3DMipcepJuFXuhaXLsievmPG-Czu6FutHZJVxJTO8';
const BASE_URL = 'https://sfumaypqhxzjssarmyrn.supabase.co/rest/v1/rpc';

async function rpc<T>(fn: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/${fn}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${fn} falhou: ${res.status}`);
  return res.json();
}

// ============================================================
// TIPOS DA API
// ============================================================

interface ApiTmdbSlim {
  id: number;
  title: string;
  year: string;
  rating: number;
  certification: string | null;
  poster: string | null;
  posterHD: string | null;
  backdrop: string | null;
  backdropHD: string | null;
}

interface ApiTmdbFull extends ApiTmdbSlim {
  originalTitle?: string;
  overview?: string;
  releaseDate?: string;
  voteCount?: number;
  genres?: string[];
  directors?: string[];
  cast?: Array<{ id: number; name: string; character: string; photo: string | null }>;
}

interface ApiItemSlim {
  id: string;
  name: string;
  type: 'movie' | 'series';
  category: string;
  categoryLabel?: string;
  isAdult: boolean;
  logo: string | null;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  tmdb: ApiTmdbSlim;
}

interface ApiItemFull extends ApiItemSlim {
  url: string;
  active: boolean;
  tmdb: ApiTmdbFull;
  episodes?: Record<string, Array<{ id: string; episode: number; name: string; url: string; logo: string | null }>>;
}

interface ApiHomeCategory {
  id: string;
  label: string;
  type: 'movie' | 'series';
  items: ApiItemSlim[];
}

interface ApiCatalogResult {
  items: ApiItemSlim[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiCategory {
  id: string;
  label: string;
  count: number;
}

export interface ApiCategories {
  movies: ApiCategory[];
  series: ApiCategory[];
}

export interface HomeCategory {
  id: string;
  label: string;
  type: 'movie' | 'series';
  items: EnrichedMovie[];
}

export interface CatalogResult {
  items: EnrichedMovie[];
  total: number;
  page: number;
  totalPages: number;
}

export type CatalogOrderBy = 'name' | 'rating' | 'new';

export interface CatalogParams {
  type?: 'movie' | 'series' | null;
  category?: string | null;
  page?: number;
  search?: string | null;
  actor?: string | null;
  orderBy?: CatalogOrderBy;
  isAdult?: boolean;
}

// ============================================================
// MAPEAMENTO API → EnrichedMovie
// ============================================================

function mapSlimItem(item: ApiItemSlim): EnrichedMovie {
  const t = item.tmdb ?? ({} as ApiTmdbSlim);

  const base: EnrichedMovie = {
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    isAdult: item.isAdult ?? false,
    tmdb: {
      id: t.id ?? 0,
      title: t.title ?? item.name,
      originalTitle: t.title ?? item.name,
      tagline: null,
      overview: '',
      year: t.year ?? '',
      rating: t.rating ?? 0,
      voteCount: 0,
      popularity: t.rating ?? 0,
      certification: t.certification ?? null,
      genres: [],
      poster: t.poster ?? item.logo ?? null,
      posterHD: t.posterHD ?? item.logo ?? null,
      backdrop: t.backdrop ?? null,
      backdropHD: t.backdropHD ?? null,
      logo: item.logo ?? null,
      cast: [],
      keywords: [],
      companies: [],
      countries: [],
      recommendations: [],
      language: '',
    },
  };

  if (item.type === 'series') {
    const series = base as EnrichedSeries;
    series.totalSeasons = item.totalSeasons ?? undefined;
    series.totalEpisodes = item.totalEpisodes ?? undefined;
    series.episodes = {};
    return series;
  }

  return base;
}

function mapFullItem(item: ApiItemFull): EnrichedMovie {
  const slim = mapSlimItem(item);

  slim.url = item.url;

  if (slim.tmdb) {
    slim.tmdb.originalTitle = item.tmdb.originalTitle ?? item.tmdb.title;
    slim.tmdb.overview = item.tmdb.overview ?? '';
    slim.tmdb.voteCount = item.tmdb.voteCount ?? 0;
    slim.tmdb.genres = item.tmdb.genres ?? [];
    slim.tmdb.cast = (item.tmdb.cast ?? []).map(c => ({
      id: c.id,
      name: c.name,
      character: c.character,
      photo: c.photo,
    }));
    // directors armazenados como keywords para não alterar tipo
    if (item.tmdb.directors?.length) {
      (slim.tmdb as typeof slim.tmdb & { directors?: string[] }).directors = item.tmdb.directors;
    }
  }

  if (item.type === 'series' && item.episodes) {
    const series = slim as EnrichedSeries;
    series.episodes = {};
    for (const [season, eps] of Object.entries(item.episodes)) {
      series.episodes[season] = eps.map(ep => ({
        id: ep.id,
        episode: ep.episode,
        name: ep.name,
        url: ep.url,
      }));
    }
  }

  return slim;
}

// ============================================================
// ENDPOINTS PÚBLICOS
// ============================================================

/** Tela inicial: categorias com N itens cada */
export async function getHome(
  type?: 'movie' | 'series' | null,
  limit = 20,
  orderBy: CatalogOrderBy = 'rating',
): Promise<HomeCategory[]> {
  const body: Record<string, unknown> = {
    p_limit: limit,
    p_order_by: orderBy,
    p_type: type ?? null,
  };

  const data = await rpc<unknown>('get_home', body);

  console.log('[supabase] get_home resposta:', Array.isArray(data) ? `${(data as unknown[]).length} categorias` : data);

  // Valida que a resposta é um array
  if (!Array.isArray(data)) {
    console.error('[supabase] get_home: resposta inesperada', data);
    return [];
  }

  return (data as ApiHomeCategory[])
    .filter(cat => Array.isArray(cat?.items) && cat.items.length > 0)
    .map(cat => ({
      id: cat.id,
      label: cat.label,
      type: cat.type,
      items: cat.items
        .map(item => {
          try { return mapSlimItem(item); }
          catch { return null; }
        })
        .filter((x): x is EnrichedMovie => x !== null),
    }))
    .filter(cat => cat.items.length > 0);
}

/** Catálogo paginado com filtros */
export async function getCatalog(params: CatalogParams): Promise<CatalogResult> {
  const body: Record<string, unknown> = {
    p_page: params.page ?? 1,
    p_order_by: params.orderBy ?? 'rating',
    p_is_adult: params.isAdult ?? false,
  };
  if (params.type) body.p_type = params.type;
  if (params.category) body.p_category = params.category;
  if (params.search) body.p_search = params.search;
  if (params.actor) body.p_actor = params.actor;

  const data = await rpc<ApiCatalogResult>('get_catalog', body);
  return {
    items: data.items.map(mapSlimItem),
    total: data.total,
    page: data.page,
    totalPages: data.totalPages,
  };
}

/** Detalhes completos de um título (sinopse, elenco, episódios, URL) */
export async function getItem(id: string): Promise<EnrichedMovie> {
  const data = await rpc<ApiItemFull>('get_item', { p_id: id });
  return mapFullItem(data);
}

/** Filmografia de um ator */
export async function getFilmography(
  actorId?: number,
  actorName?: string,
  page = 1,
): Promise<CatalogResult> {
  const body: Record<string, unknown> = { p_page: page };
  if (actorId != null) body.p_actor_id = actorId;
  else if (actorName) body.p_actor = actorName;

  const data = await rpc<ApiCatalogResult>('get_filmography', body);
  return {
    items: data.items.map(mapSlimItem),
    total: data.total,
    page: data.page,
    totalPages: data.totalPages,
  };
}

/** Categorias disponíveis */
export async function getCategories(): Promise<ApiCategories> {
  return rpc<ApiCategories>('get_categories');
}

// Cache simples para categorias (evita re-fetch desnecessário)
let categoriesCache: ApiCategories | null = null;
export async function getCategoriesCached(): Promise<ApiCategories> {
  if (!categoriesCache) {
    categoriesCache = await getCategories();
  }
  return categoriesCache;
}
