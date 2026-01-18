/**
 * Serviço para buscar tendências do TMDB
 * 
 * Busca os filmes/séries em tendência de hoje e da semana no TMDB
 * e filtra para mostrar apenas os que existem no catálogo local.
 */

import type { EnrichedMovie } from '../types/enrichedMovie';
import { findByTmdbId, initializeEnrichedData } from './enrichedDataService';

// API Key pública do TMDB
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Cache para tendências
let trendingTodayCache: EnrichedMovie[] | null = null;
let trendingWeekCache: EnrichedMovie[] | null = null;
let lastFetchToday: number = 0;
let lastFetchWeek: number = 0;

// Tempo de cache: 30 minutos
const CACHE_DURATION = 30 * 60 * 1000;

// Interface para resultado da API TMDB
interface TMDBTrendingResult {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

interface TMDBTrendingResponse {
  page: number;
  results: TMDBTrendingResult[];
  total_pages: number;
  total_results: number;
}

/**
 * Busca tendências do TMDB
 * @param timeWindow 'day' para hoje, 'week' para semana
 */
async function fetchTMDBTrending(timeWindow: 'day' | 'week'): Promise<TMDBTrendingResult[]> {
  try {
    const response = await fetch(
      `${TMDB_BASE}/trending/all/${timeWindow}?api_key=${TMDB_API_KEY}&language=pt-BR&page=1`
    );
    
    if (!response.ok) {
      console.error(`Erro ao buscar tendências TMDB: ${response.status}`);
      return [];
    }
    
    const data: TMDBTrendingResponse = await response.json();
    
    // Busca mais páginas para ter mais chances de match no catálogo
    const promises = [];
    for (let page = 2; page <= Math.min(5, data.total_pages); page++) {
      promises.push(
        fetch(`${TMDB_BASE}/trending/all/${timeWindow}?api_key=${TMDB_API_KEY}&language=pt-BR&page=${page}`)
          .then(r => r.ok ? r.json() : { results: [] })
          .catch(() => ({ results: [] }))
      );
    }
    
    const additionalPages = await Promise.all(promises);
    const allResults = [
      ...data.results,
      ...additionalPages.flatMap(p => p.results || [])
    ];
    
    return allResults;
  } catch (error) {
    console.error('Erro ao buscar tendências TMDB:', error);
    return [];
  }
}

/**
 * Filtra tendências do TMDB para mostrar apenas itens do catálogo
 */
function filterTrendingByLocalCatalog(trendingItems: TMDBTrendingResult[]): EnrichedMovie[] {
  const matchedItems: EnrichedMovie[] = [];
  const seenIds = new Set<string>();
  
  for (const item of trendingItems) {
    // Busca no catálogo local pelo TMDB ID
    const localItem = findByTmdbId(item.id);
    
    if (localItem && !seenIds.has(localItem.id)) {
      seenIds.add(localItem.id);
      matchedItems.push(localItem);
    }
  }
  
  return matchedItems;
}

/**
 * Obtém tendências de HOJE que existem no catálogo
 */
export async function getTrendingToday(): Promise<EnrichedMovie[]> {
  const now = Date.now();
  
  // Retorna do cache se ainda válido
  if (trendingTodayCache && (now - lastFetchToday) < CACHE_DURATION) {
    return trendingTodayCache;
  }
  
  // Garante que os dados enriquecidos estão carregados
  await initializeEnrichedData();
  
  console.log('🔥 Buscando tendências de hoje no TMDB...');
  
  const trendingItems = await fetchTMDBTrending('day');
  const localMatches = filterTrendingByLocalCatalog(trendingItems);
  
  console.log(`✅ Encontrados ${localMatches.length} itens de tendências de hoje no catálogo`);
  
  trendingTodayCache = localMatches;
  lastFetchToday = now;
  
  return localMatches;
}

/**
 * Obtém tendências da SEMANA que existem no catálogo
 */
export async function getTrendingWeek(): Promise<EnrichedMovie[]> {
  const now = Date.now();
  
  // Retorna do cache se ainda válido
  if (trendingWeekCache && (now - lastFetchWeek) < CACHE_DURATION) {
    return trendingWeekCache;
  }
  
  // Garante que os dados enriquecidos estão carregados
  await initializeEnrichedData();
  
  console.log('📅 Buscando tendências da semana no TMDB...');
  
  const trendingItems = await fetchTMDBTrending('week');
  const localMatches = filterTrendingByLocalCatalog(trendingItems);
  
  console.log(`✅ Encontrados ${localMatches.length} itens de tendências da semana no catálogo`);
  
  trendingWeekCache = localMatches;
  lastFetchWeek = now;
  
  return localMatches;
}

/**
 * Limpa o cache de tendências (útil para forçar refresh)
 */
export function clearTrendingCache(): void {
  trendingTodayCache = null;
  trendingWeekCache = null;
  lastFetchToday = 0;
  lastFetchWeek = 0;
}

/**
 * Obtém ambas as tendências de uma vez (mais eficiente)
 */
export async function getAllTrending(): Promise<{
  today: EnrichedMovie[];
  week: EnrichedMovie[];
}> {
  const [today, week] = await Promise.all([
    getTrendingToday(),
    getTrendingWeek()
  ]);
  
  return { today, week };
}
