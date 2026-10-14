/**
 * Filmes, séries, animes e doramas marcados como favoritos.
 *
 * Porte de `VodFavoritos.kt`: guarda o tipo e a letra junto com o nome, que é
 * como o acervo é fatiado, e a ordem importa — o último marcado vem primeiro.
 * `origem` está no mesmo formato dos destaques, então abrir um favorito passa
 * pelo caminho que já abre qualquer destaque.
 */
import type { ItemDestaque } from './vodService';

const CHAVE = 'saimo-vod-favoritos';
const EVENTO = 'saimo-vod-favoritos-mudou';

function ler(): ItemDestaque[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

const mesmo = (a: ItemDestaque, b: ItemDestaque) =>
  a.titulo === b.titulo && a.tipo === b.tipo && (a.ano || '') === (b.ano || '');

export function lista(): ItemDestaque[] {
  return ler();
}

export function contem(item: ItemDestaque): boolean {
  return ler().some((x) => mesmo(x, item));
}

/** Marca ou desmarca. Devolve o estado novo. */
export function alternar(item: ItemDestaque): boolean {
  const atual = ler();
  const resto = atual.filter((x) => !mesmo(x, item));
  const marcou = resto.length === atual.length;
  localStorage.setItem(CHAVE, JSON.stringify(marcou ? [item, ...resto] : resto));
  window.dispatchEvent(new Event(EVENTO));
  return marcou;
}

/** Avisa quando a lista muda (nesta aba ou em outra). Devolve quem cancela. */
export function aoMudar(fn: () => void): () => void {
  const porStorage = (e: StorageEvent) => { if (e.key === CHAVE) fn(); };
  window.addEventListener(EVENTO, fn);
  window.addEventListener('storage', porStorage);
  return () => {
    window.removeEventListener(EVENTO, fn);
    window.removeEventListener('storage', porStorage);
  };
}
