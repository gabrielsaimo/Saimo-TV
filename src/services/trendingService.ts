/**
 * Serviço para buscar tendências
 *
 * Retorna os títulos mais bem avaliados do catálogo para o hero banner.
 * Usa a API Supabase (get_catalog com p_order_by: 'rating').
 */

import type { EnrichedMovie } from '../types/enrichedMovie';
import { getCatalog } from './supabaseService';

// Cache em memória
let trendingTodayCache: EnrichedMovie[] | null = null;
let lastFetch = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

/**
 * Retorna os títulos mais bem avaliados do catálogo (usado no hero banner).
 */
export async function getTrendingToday(): Promise<EnrichedMovie[]> {
  const now = Date.now();
  if (trendingTodayCache && now - lastFetch < CACHE_DURATION) {
    return trendingTodayCache;
  }

  try {
    const result = await getCatalog({ orderBy: 'rating', page: 1, isAdult: false });
    trendingTodayCache = result.items;
    lastFetch = now;
    return result.items;
  } catch (err) {
    console.error('getTrendingToday:', err);
    return trendingTodayCache ?? [];
  }
}

/** Alias — retorna os mesmos dados com cache compartilhado */
export async function getTrendingWeek(): Promise<EnrichedMovie[]> {
  return getTrendingToday();
}

export function clearTrendingCache(): void {
  trendingTodayCache = null;
  lastFetch = 0;
}
