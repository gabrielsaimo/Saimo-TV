/**
 * Serviço de Favoritos
 * 
 * Gerencia os favoritos do usuário salvos no localStorage.
 * Permite adicionar, remover e listar itens favoritados.
 */

import type { EnrichedMovie } from '../types/enrichedMovie';
import { findById } from './enrichedDataService';

// Chave do localStorage
const FAVORITES_KEY = 'tv-saimo-favorites';

// Interface para item favorito salvo
interface FavoriteItem {
  id: string;
  addedAt: number; // timestamp
}

/**
 * Obtém a lista de IDs favoritos do localStorage
 */
function getFavoriteIds(): FavoriteItem[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Erro ao ler favoritos do localStorage:', error);
    return [];
  }
}

/**
 * Salva a lista de favoritos no localStorage
 */
function saveFavorites(favorites: FavoriteItem[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Erro ao salvar favoritos no localStorage:', error);
  }
}

/**
 * Verifica se um item está nos favoritos
 */
export function isFavorite(itemId: string): boolean {
  const favorites = getFavoriteIds();
  return favorites.some(f => f.id === itemId);
}

/**
 * Adiciona um item aos favoritos
 */
export function addToFavorites(itemId: string): void {
  const favorites = getFavoriteIds();
  
  // Evita duplicatas
  if (favorites.some(f => f.id === itemId)) {
    return;
  }
  
  favorites.unshift({
    id: itemId,
    addedAt: Date.now()
  });
  
  saveFavorites(favorites);
  
  // Dispara evento para notificar mudanças
  window.dispatchEvent(new CustomEvent('favorites-changed', { 
    detail: { action: 'add', itemId } 
  }));
}

/**
 * Remove um item dos favoritos
 */
export function removeFromFavorites(itemId: string): void {
  const favorites = getFavoriteIds();
  const filtered = favorites.filter(f => f.id !== itemId);
  
  saveFavorites(filtered);
  
  // Dispara evento para notificar mudanças
  window.dispatchEvent(new CustomEvent('favorites-changed', { 
    detail: { action: 'remove', itemId } 
  }));
}

/**
 * Alterna o estado de favorito de um item
 */
export function toggleFavorite(itemId: string): boolean {
  if (isFavorite(itemId)) {
    removeFromFavorites(itemId);
    return false;
  } else {
    addToFavorites(itemId);
    return true;
  }
}

/**
 * Obtém todos os itens favoritos (com dados completos)
 */
export function getFavorites(): EnrichedMovie[] {
  const favoriteIds = getFavoriteIds();
  const items: EnrichedMovie[] = [];
  
  for (const fav of favoriteIds) {
    const item = findById(fav.id);
    if (item) {
      items.push(item);
    }
  }
  
  return items;
}

/**
 * Obtém a quantidade de favoritos
 */
export function getFavoritesCount(): number {
  return getFavoriteIds().length;
}

/**
 * Limpa todos os favoritos
 */
export function clearAllFavorites(): void {
  localStorage.removeItem(FAVORITES_KEY);
  
  window.dispatchEvent(new CustomEvent('favorites-changed', { 
    detail: { action: 'clear' } 
  }));
}

/**
 * Exporta favoritos como JSON (para backup)
 */
export function exportFavorites(): string {
  const favorites = getFavoriteIds();
  return JSON.stringify(favorites, null, 2);
}

/**
 * Importa favoritos de JSON (para restaurar backup)
 */
export function importFavorites(json: string): boolean {
  try {
    const favorites = JSON.parse(json);
    if (Array.isArray(favorites)) {
      saveFavorites(favorites);
      window.dispatchEvent(new CustomEvent('favorites-changed', { 
        detail: { action: 'import' } 
      }));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
