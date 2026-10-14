import { useNavigate } from 'react-router-dom';
import type { Destaque } from '../components/Telas';
import { useFichaDe } from '../hooks/useFichaDe';
import type { ItemDestaque } from '../services/vodService';

export const ROTULO_TIPO: Record<string, string> = { f: 'Filme', s: 'Série', a: 'Anime', d: 'Dorama' };

export function useAbrirVod() {
  const navigate = useNavigate();
  return (item: ItemDestaque) => navigate('/movies', { state: { abrir: item } });
}

/** O destaque do alto para um título do catálogo: a ficha do TMDB quando chega. */
export function useHeroiVod(item: ItemDestaque | null): Destaque | null {
  const ficha = useFichaDe(item);
  if (!item) return null;
  const selos = [ROTULO_TIPO[item.tipo] ?? 'Título'];
  if (item.ano) selos.push(item.ano);
  if (ficha) {
    if (ficha.nota) selos.push(`★ ${ficha.nota.toFixed(1)}`);
    if (ficha.temporadas) selos.push(`${ficha.temporadas} temporada${ficha.temporadas > 1 ? 's' : ''}`);
    selos.push(...ficha.generos.slice(0, 3));
  }
  return { titulo: item.titulo, selos, sinopse: ficha?.sinopse, fundo: ficha?.fundo, capa: item.capa || ficha?.capa };
}

