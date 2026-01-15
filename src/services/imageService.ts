// Serviço simples para buscar imagens de filmes/séries do TMDB
// API Key pública do TMDB (gratuita para uso não comercial)

const TMDB_API_KEY = '6a9cd46770a9adee6ee6bb7e69154aaa'; // Key pública comum
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';

// Cache local para evitar requisições repetidas
const imageCache = new Map<string, string | null>();

/**
 * Limpa o nome do filme/série para busca
 */
function cleanTitle(name: string): string {
  let cleaned = name
    // Remove prefixos de categoria
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/^📺\s*/g, '')
    .replace(/^🎬\s*/g, '')
    // Remove ano entre parênteses
    .replace(/\s*\(\d{4}\)\s*/g, '')
    // Remove S01E01, T01E01, etc
    .replace(/\s*[ST]\d+\s*E\d+.*/i, '')
    .replace(/\s*Temporada\s*\d+.*/i, '')
    .replace(/\s*Season\s*\d+.*/i, '')
    .replace(/\s*Ep\.?\s*\d+.*/i, '')
    .replace(/\s*Episódio\s*\d+.*/i, '')
    // Remove qualificadores
    .replace(/\s*-\s*Dublado.*/i, '')
    .replace(/\s*-\s*Legendado.*/i, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*DUB\s*$/i, '')
    .replace(/\s*LEG\s*$/i, '')
    .replace(/\s*HD\s*$/i, '')
    .replace(/\s*4K\s*$/i, '')
    .replace(/\s*UHD\s*$/i, '')
    // Remove caracteres especiais
    .replace(/[_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned;
}

/**
 * Busca imagem usando a API multi-search (filme + série)
 */
export async function searchImage(title: string, type?: 'movie' | 'series'): Promise<string | null> {
  const cleanedTitle = cleanTitle(title);
  
  if (!cleanedTitle || cleanedTitle.length < 2) return null;
  
  const cacheKey = `${type || 'multi'}:${cleanedTitle.toLowerCase()}`;
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey) || null;
  }
  
  try {
    // Usa multi-search para buscar filme e série ao mesmo tempo
    const endpoint = type === 'movie' 
      ? 'search/movie' 
      : type === 'series' 
        ? 'search/tv' 
        : 'search/multi';
    
    const response = await fetch(
      `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(cleanedTitle)}`
    );
    
    if (!response.ok) {
      imageCache.set(cacheKey, null);
      return null;
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Pega o primeiro resultado com poster
      for (const result of data.results) {
        const posterPath = result.poster_path;
        if (posterPath) {
          const imageUrl = `${TMDB_IMAGE}${posterPath}`;
          imageCache.set(cacheKey, imageUrl);
          return imageUrl;
        }
      }
    }
    
    // Se não encontrou, tenta buscar em inglês
    if (cleanedTitle.length > 3) {
      const responseEn = await fetch(
        `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(cleanedTitle)}`
      );
      
      if (responseEn.ok) {
        const dataEn = await responseEn.json();
        if (dataEn.results && dataEn.results.length > 0) {
          for (const result of dataEn.results) {
            const posterPath = result.poster_path;
            if (posterPath) {
              const imageUrl = `${TMDB_IMAGE}${posterPath}`;
              imageCache.set(cacheKey, imageUrl);
              return imageUrl;
            }
          }
        }
      }
    }
    
    imageCache.set(cacheKey, null);
    return null;
  } catch {
    imageCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Busca imagem de um filme no TMDB
 */
export async function searchMovieImage(title: string): Promise<string | null> {
  return searchImage(title, 'movie');
}

/**
 * Busca imagem de uma série no TMDB
 */
export async function searchSeriesImage(title: string): Promise<string | null> {
  return searchImage(title, 'series');
}
