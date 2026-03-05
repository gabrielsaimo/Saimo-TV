/**
 * Serviço de Favoritos
 *
 * Gerencia os favoritos do usuário salvos no localStorage.
 * Armazena também os dados slim do item para exibição sem precisar de
 * um índice local (compatível com a nova abordagem via API Supabase).
 */

import type { EnrichedMovie } from '../types/enrichedMovie';

const FAVORITES_KEY = 'tv-saimo-favorites';
const FAVORITES_DATA_KEY = 'tv-saimo-favorites-data';

interface FavoriteItem {
  id: string;
  addedAt: number;
}

function getFavoriteIds(): FavoriteItem[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveFavorites(favorites: FavoriteItem[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Erro ao salvar favoritos:', error);
  }
}

function getDataStore(): Record<string, EnrichedMovie> {
  try {
    const stored = localStorage.getItem(FAVORITES_DATA_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function saveDataStore(store: Record<string, EnrichedMovie>): void {
  try {
    localStorage.setItem(FAVORITES_DATA_KEY, JSON.stringify(store));
  } catch {
    // Se exceder quota, ignora silenciosamente
  }
}

/** Armazena dados slim de um item (para exibição nos favoritos) */
export function storeItemData(item: EnrichedMovie): void {
  const store = getDataStore();
  // Guarda apenas dados slim (sem episódios completos para economizar espaço)
  store[item.id] = {
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    isAdult: item.isAdult,
    tmdb: item.tmdb
      ? {
          ...item.tmdb,
          cast: [],       // sem elenco
          keywords: [],   // sem keywords
          companies: [],
          countries: [],
          recommendations: [],
          overview: '',   // sem sinopse (economiza espaço)
        }
      : undefined,
  };
  saveDataStore(store);
}

export function isFavorite(itemId: string): boolean {
  return getFavoriteIds().some(f => f.id === itemId);
}

export function addToFavorites(itemId: string): void {
  const favorites = getFavoriteIds();
  if (favorites.some(f => f.id === itemId)) return;

  favorites.unshift({ id: itemId, addedAt: Date.now() });
  saveFavorites(favorites);

  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { action: 'add', itemId } }));
}

export function removeFromFavorites(itemId: string): void {
  const favorites = getFavoriteIds().filter(f => f.id !== itemId);
  saveFavorites(favorites);

  // Remove dados cached também
  const store = getDataStore();
  delete store[itemId];
  saveDataStore(store);

  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { action: 'remove', itemId } }));
}

/** Alterna favorito. Passe `item` para armazenar dados slim para exibição. */
export function toggleFavorite(itemId: string, item?: EnrichedMovie): boolean {
  if (isFavorite(itemId)) {
    removeFromFavorites(itemId);
    return false;
  } else {
    addToFavorites(itemId);
    if (item) storeItemData(item);
    return true;
  }
}

/** Retorna os itens favoritos com dados slim do localStorage */
export function getFavorites(): EnrichedMovie[] {
  const ids = getFavoriteIds();
  const store = getDataStore();
  return ids.map(f => store[f.id]).filter(Boolean);
}

export function getFavoritesCount(): number {
  return getFavoriteIds().length;
}

export function clearAllFavorites(): void {
  localStorage.removeItem(FAVORITES_KEY);
  localStorage.removeItem(FAVORITES_DATA_KEY);
  window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { action: 'clear' } }));
}
