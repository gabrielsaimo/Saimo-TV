// Serviço simples para buscar imagens de filmes/séries do TMDB
// API Key pública do TMDB (gratuita para uso não comercial)

const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb'; // Key pública
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';

// Cache local para evitar requisições repetidas
const imageCache = new Map<string, string | null>();

// Categorias que indicam anime
const ANIME_CATEGORIES = ['crunchyroll', 'funimation', 'anime', 'animes', 'animação'];

/**
 * Extrai o ano do nome do filme/série
 */
function extractYear(name: string): number | null {
  const yearMatch = name.match(/\((\d{4})\)/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  return null;
}

/**
 * Detecta se é anime baseado na categoria
 */
function isAnimeCategory(category?: string): boolean {
  if (!category) return false;
  const normalizedCategory = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ANIME_CATEGORIES.some(anime => normalizedCategory.includes(anime));
}

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
 * Normaliza string para comparação (remove acentos, lowercase)
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Interface para resultado da API TMDB
interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  origin_country?: string[];
}

// IDs de gêneros do TMDB para anime
const ANIMATION_GENRE_ID = 16;

/**
 * Calcula score de correspondência para um resultado
 * Considera: título, ano, tipo (anime/live-action), categoria
 */
function calculateMatchScore(
  result: TMDBResult, 
  searchTitle: string, 
  targetYear: number | null, 
  expectAnime: boolean,
  category?: string
): number {
  let score = 0;
  
  const title = result.title || result.name || '';
  const originalTitle = result.original_title || result.original_name || '';
  const normalizedSearch = normalizeForComparison(searchTitle);
  const normalizedTitle = normalizeForComparison(title);
  const normalizedOriginal = normalizeForComparison(originalTitle);
  
  // Score por correspondência de título
  if (normalizedTitle === normalizedSearch || normalizedOriginal === normalizedSearch) {
    score += 50; // Match exato
  } else if (normalizedTitle.includes(normalizedSearch) || normalizedOriginal.includes(normalizedSearch)) {
    score += 30; // Match parcial
  } else if (normalizedSearch.includes(normalizedTitle) || normalizedSearch.includes(normalizedOriginal)) {
    score += 20; // Título contido na busca
  }
  
  // Score por ano
  const resultYear = result.release_date || result.first_air_date;
  if (resultYear && targetYear) {
    const year = parseInt(resultYear.substring(0, 4), 10);
    if (year === targetYear) {
      score += 40; // Ano exato - muito importante!
    } else if (Math.abs(year - targetYear) <= 1) {
      score += 20; // Ano próximo (±1)
    } else if (Math.abs(year - targetYear) <= 3) {
      score += 5; // Ano relativamente próximo
    } else {
      score -= Math.min(30, Math.abs(year - targetYear) * 3); // Penaliza anos muito diferentes
    }
  }
  
  // Score por tipo (anime vs live-action)
  const isAnimation = result.genre_ids?.includes(ANIMATION_GENRE_ID) || false;
  const isJapanese = result.origin_country?.includes('JP') || false;
  const isLikelyAnime = isAnimation && isJapanese;
  
  if (expectAnime) {
    if (isLikelyAnime) {
      score += 35; // É anime e esperávamos anime
    } else if (isAnimation) {
      score += 15; // É animação mas não necessariamente anime japonês
    } else {
      score -= 25; // Esperávamos anime mas não é
    }
  } else {
    // Se não esperamos anime (Netflix, Prime, etc.)
    if (isLikelyAnime) {
      score -= 20; // É anime mas não esperávamos
    } else if (!isAnimation) {
      score += 15; // Live-action como esperado
    }
  }
  
  // Bonus para Netflix quando categoria é Netflix
  if (category) {
    const normalizedCategory = category.toLowerCase();
    if (normalizedCategory.includes('netflix')) {
      // Se a série é do Netflix (origem EUA geralmente)
      if (result.origin_country?.includes('US')) {
        score += 10;
      }
    }
  }
  
  // Preferir resultados com mais votos (mais confiáveis)
  if (result.vote_count && result.vote_count > 100) {
    score += 5;
  }
  
  return score;
}

/**
 * Encontra o melhor resultado baseado em múltiplos critérios
 * Usa: título, ano, tipo (anime/live-action), categoria
 */
function findBestMatchWithContext(
  results: TMDBResult[], 
  searchTitle: string, 
  targetYear: number | null,
  category?: string
): TMDBResult | null {
  if (!results || results.length === 0) return null;
  
  const expectAnime = isAnimeCategory(category);
  
  // Calcula score para cada resultado
  const scoredResults = results.map(result => ({
    result,
    score: calculateMatchScore(result, searchTitle, targetYear, expectAnime, category)
  }));
  
  // Ordena por score decrescente
  scoredResults.sort((a, b) => b.score - a.score);
  
  // Retorna o melhor match (se tiver score positivo)
  if (scoredResults[0].score > 0) {
    return scoredResults[0].result;
  }
  
  // Se nenhum tem score positivo, retorna o primeiro com poster
  return results.find(r => r.poster_path) || results[0];
}

/**
 * Busca imagem usando a API multi-search (filme + série)
 * NOVA VERSÃO: Usa ano e categoria para ser mais assertivo
 */
export async function searchImage(
  title: string, 
  type?: 'movie' | 'series',
  category?: string
): Promise<string | null> {
  const cleanedTitle = cleanTitle(title);
  const targetYear = extractYear(title);
  
  if (!cleanedTitle || cleanedTitle.length < 2) return null;
  
  const cacheKey = `${type || 'multi'}:${cleanedTitle.toLowerCase()}:${targetYear || ''}:${category || ''}`;
  
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
      // Encontra o melhor match usando ano + categoria + título
      const bestMatch = findBestMatchWithContext(data.results, cleanedTitle, targetYear, category);
      if (bestMatch?.poster_path) {
        const imageUrl = `${TMDB_IMAGE}${bestMatch.poster_path}`;
        imageCache.set(cacheKey, imageUrl);
        return imageUrl;
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
          const bestMatch = findBestMatchWithContext(dataEn.results, cleanedTitle, targetYear, category);
          if (bestMatch?.poster_path) {
            const imageUrl = `${TMDB_IMAGE}${bestMatch.poster_path}`;
            imageCache.set(cacheKey, imageUrl);
            return imageUrl;
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

// Cache de ratings
const ratingCache = new Map<string, number | null>();

// Cache de detalhes do filme
const detailsCache = new Map<string, MovieDetails | null>();

// Interface para detalhes completos do filme
export interface MovieDetails {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  releaseDate: string;
  year: string;
  runtime: number; // em minutos
  genres: string[];
  rating: number;
  voteCount: number;
  certification: string; // Classificação indicativa (L, 10, 12, 14, 16, 18)
  posterPath: string | null;
  backdropPath: string | null;
  director: string;
  cast: string[];
  tagline: string;
}

/**
 * Busca rating (nota) de um filme/série no TMDB
 * ATUALIZADO: Usa ano e categoria para ser mais assertivo
 * Retorna a nota de 0-10 ou null se não encontrar
 */
export async function searchRating(
  title: string, 
  type?: 'movie' | 'series',
  category?: string
): Promise<number | null> {
  const cleanedTitle = cleanTitle(title);
  const targetYear = extractYear(title);
  
  if (!cleanedTitle || cleanedTitle.length < 2) return null;
  
  const cacheKey = `rating:${type || 'multi'}:${cleanedTitle.toLowerCase()}:${targetYear || ''}:${category || ''}`;
  
  if (ratingCache.has(cacheKey)) {
    return ratingCache.get(cacheKey) ?? null;
  }
  
  try {
    // Usa TMDB que suporta títulos em português
    const endpoint = type === 'movie' 
      ? 'search/movie' 
      : type === 'series' 
        ? 'search/tv' 
        : 'search/multi';
    
    // Primeira tentativa: busca em português
    let response = await fetch(
      `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(cleanedTitle)}`
    );
    
    if (!response.ok) {
      ratingCache.set(cacheKey, null);
      return null;
    }
    
    let data = await response.json();
    
    // Se não encontrou em português, tenta em inglês
    if (!data.results || data.results.length === 0) {
      response = await fetch(
        `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(cleanedTitle)}`
      );
      if (response.ok) {
        data = await response.json();
      }
    }
    
    if (data.results && data.results.length > 0) {
      // Encontra o melhor match usando ano + categoria + título
      const bestMatch = findBestMatchWithContext(data.results, cleanedTitle, targetYear, category);
      if (bestMatch) {
        const rating = bestMatch.vote_average;
        if (rating && rating > 0) {
          const roundedRating = Math.round(rating * 10) / 10;
          ratingCache.set(cacheKey, roundedRating);
          return roundedRating;
        }
      }
    }
    
    ratingCache.set(cacheKey, null);
    return null;
  } catch {
    ratingCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Extrai a classificação indicativa brasileira de um filme
 */
function extractBrazilianCertification(releaseDates: { results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> }): string {
  // Tenta Brasil primeiro
  const brRelease = releaseDates.results.find(r => r.iso_3166_1 === 'BR');
  if (brRelease) {
    for (const rd of brRelease.release_dates) {
      if (rd.certification) return rd.certification;
    }
  }
  
  // Fallback para US
  const usRelease = releaseDates.results.find(r => r.iso_3166_1 === 'US');
  if (usRelease) {
    for (const rd of usRelease.release_dates) {
      if (rd.certification) {
        // Converte classificação americana para brasileira
        const usRating = rd.certification;
        if (usRating === 'G') return 'L';
        if (usRating === 'PG') return '10';
        if (usRating === 'PG-13') return '12';
        if (usRating === 'R') return '16';
        if (usRating === 'NC-17') return '18';
        return usRating;
      }
    }
  }
  
  return '';
}

/**
 * Busca detalhes completos de um filme/série no TMDB
 * ATUALIZADO: Usa ano e categoria para ser mais assertivo
 */
export async function searchMovieDetails(
  title: string, 
  type?: 'movie' | 'series',
  category?: string
): Promise<MovieDetails | null> {
  const cleanedTitle = cleanTitle(title);
  const targetYear = extractYear(title);
  
  if (!cleanedTitle || cleanedTitle.length < 2) return null;
  
  const cacheKey = `details:${type || 'multi'}:${cleanedTitle.toLowerCase()}:${targetYear || ''}:${category || ''}`;
  
  if (detailsCache.has(cacheKey)) {
    return detailsCache.get(cacheKey) ?? null;
  }
  
  try {
    // Primeiro, busca o ID do filme/série
    const searchEndpoint = type === 'movie' 
      ? 'search/movie' 
      : type === 'series' 
        ? 'search/tv' 
        : 'search/multi';
    
    let response = await fetch(
      `${TMDB_BASE}/${searchEndpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(cleanedTitle)}`
    );
    
    if (!response.ok) {
      detailsCache.set(cacheKey, null);
      return null;
    }
    
    let searchData = await response.json();
    
    // Se não encontrou em português, tenta em inglês
    if (!searchData.results || searchData.results.length === 0) {
      response = await fetch(
        `${TMDB_BASE}/${searchEndpoint}?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(cleanedTitle)}`
      );
      if (response.ok) {
        searchData = await response.json();
      }
    }
    
    if (!searchData.results || searchData.results.length === 0) {
      detailsCache.set(cacheKey, null);
      return null;
    }
    
    // Encontra o melhor match usando ano + categoria + título
    const bestMatch = findBestMatchWithContext(searchData.results, cleanedTitle, targetYear, category);
    if (!bestMatch) {
      detailsCache.set(cacheKey, null);
      return null;
    }
    
    const tmdbId = bestMatch.id;
    const mediaType = bestMatch.media_type || (type === 'series' ? 'tv' : 'movie');
    const isTV = mediaType === 'tv';
    
    // Busca detalhes completos
    const detailsEndpoint = isTV ? 'tv' : 'movie';
    const appendToResponse = isTV 
      ? 'content_ratings,credits' 
      : 'release_dates,credits';
    
    response = await fetch(
      `${TMDB_BASE}/${detailsEndpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=${appendToResponse}`
    );
    
    if (!response.ok) {
      detailsCache.set(cacheKey, null);
      return null;
    }
    
    const details = await response.json();
    
    // Extrai classificação indicativa
    let certification = '';
    if (isTV && details.content_ratings?.results) {
      const brRating = details.content_ratings.results.find((r: { iso_3166_1: string }) => r.iso_3166_1 === 'BR');
      certification = brRating?.rating || '';
      if (!certification) {
        const usRating = details.content_ratings.results.find((r: { iso_3166_1: string }) => r.iso_3166_1 === 'US');
        certification = usRating?.rating || '';
      }
    } else if (details.release_dates) {
      certification = extractBrazilianCertification(details.release_dates);
    }
    
    // Extrai diretor
    let director = '';
    if (details.credits?.crew) {
      const directorInfo = details.credits.crew.find((c: { job: string }) => c.job === 'Director');
      director = directorInfo?.name || '';
    }
    if (isTV && details.created_by?.length > 0) {
      director = details.created_by.map((c: { name: string }) => c.name).join(', ');
    }
    
    // Extrai elenco principal (top 5)
    const cast = details.credits?.cast
      ?.slice(0, 5)
      .map((c: { name: string }) => c.name) || [];
    
    const movieDetails: MovieDetails = {
      id: tmdbId,
      title: details.title || details.name || cleanedTitle,
      originalTitle: details.original_title || details.original_name || '',
      overview: details.overview || 'Sinopse não disponível.',
      releaseDate: details.release_date || details.first_air_date || '',
      year: (details.release_date || details.first_air_date || '').substring(0, 4),
      runtime: details.runtime || details.episode_run_time?.[0] || 0,
      genres: details.genres?.map((g: { name: string }) => g.name) || [],
      rating: details.vote_average || 0,
      voteCount: details.vote_count || 0,
      certification,
      posterPath: details.poster_path ? `${TMDB_IMAGE}${details.poster_path}` : null,
      backdropPath: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : null,
      director,
      cast,
      tagline: details.tagline || ''
    };
    
    detailsCache.set(cacheKey, movieDetails);
    return movieDetails;
  } catch {
    detailsCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Busca apenas a classificação indicativa de um filme/série
 * ATUALIZADO: Usa ano e categoria para ser mais assertivo
 * Versão otimizada com cache próprio para carregar mais rápido nos cards
 */
const certificationCache = new Map<string, string | null>();

export async function searchCertification(
  title: string, 
  type?: 'movie' | 'series',
  category?: string
): Promise<string | null> {
  const cleanedTitle = cleanTitle(title);
  const targetYear = extractYear(title);
  
  if (!cleanedTitle || cleanedTitle.length < 2) return null;
  
  const cacheKey = `cert:${type || 'multi'}:${cleanedTitle.toLowerCase()}:${targetYear || ''}:${category || ''}`;
  
  // Verifica cache primeiro
  if (certificationCache.has(cacheKey)) {
    return certificationCache.get(cacheKey) ?? null;
  }
  
  // Se já temos os detalhes em cache, usa eles
  const detailsCacheKey = `details:${type || 'multi'}:${cleanedTitle.toLowerCase()}:${targetYear || ''}:${category || ''}`;
  if (detailsCache.has(detailsCacheKey)) {
    const details = detailsCache.get(detailsCacheKey);
    const cert = details?.certification || null;
    certificationCache.set(cacheKey, cert);
    return cert;
  }
  
  try {
    // Busca direta mais rápida - primeiro busca o ID
    const searchEndpoint = type === 'movie' 
      ? 'search/movie' 
      : type === 'series' 
        ? 'search/tv' 
        : 'search/multi';
    
    let response = await fetch(
      `${TMDB_BASE}/${searchEndpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(cleanedTitle)}`
    );
    
    if (!response.ok) {
      certificationCache.set(cacheKey, null);
      return null;
    }
    
    let searchData = await response.json();
    
    // Fallback para inglês
    if (!searchData.results || searchData.results.length === 0) {
      response = await fetch(
        `${TMDB_BASE}/${searchEndpoint}?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(cleanedTitle)}`
      );
      if (response.ok) {
        searchData = await response.json();
      }
    }
    
    if (!searchData.results || searchData.results.length === 0) {
      certificationCache.set(cacheKey, null);
      return null;
    }
    
    // Encontra o melhor match usando ano + categoria + título
    const bestMatch = findBestMatchWithContext(searchData.results, cleanedTitle, targetYear, category);
    if (!bestMatch) {
      certificationCache.set(cacheKey, null);
      return null;
    }
    
    const tmdbId = bestMatch.id;
    const mediaType = bestMatch.media_type || (type === 'series' ? 'tv' : 'movie');
    const isTV = mediaType === 'tv';
    
    // Busca apenas classificação (sem credits para ser mais rápido)
    const detailsEndpoint = isTV ? 'tv' : 'movie';
    const appendToResponse = isTV ? 'content_ratings' : 'release_dates';
    
    response = await fetch(
      `${TMDB_BASE}/${detailsEndpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=${appendToResponse}`
    );
    
    if (!response.ok) {
      certificationCache.set(cacheKey, null);
      return null;
    }
    
    const details = await response.json();
    
    // Extrai classificação indicativa
    let certification = '';
    if (isTV && details.content_ratings?.results) {
      const brRating = details.content_ratings.results.find((r: { iso_3166_1: string }) => r.iso_3166_1 === 'BR');
      certification = brRating?.rating || '';
      if (!certification) {
        const usRating = details.content_ratings.results.find((r: { iso_3166_1: string }) => r.iso_3166_1 === 'US');
        if (usRating?.rating) {
          // Converte TV rating americana para brasileira
          const tvRating = usRating.rating;
          if (tvRating === 'TV-Y' || tvRating === 'TV-Y7' || tvRating === 'TV-G') certification = 'L';
          else if (tvRating === 'TV-PG') certification = '10';
          else if (tvRating === 'TV-14') certification = '14';
          else if (tvRating === 'TV-MA') certification = '18';
          else certification = tvRating;
        }
      }
    } else if (details.release_dates) {
      certification = extractBrazilianCertification(details.release_dates);
    }
    
    certificationCache.set(cacheKey, certification || null);
    return certification || null;
  } catch {
    certificationCache.set(cacheKey, null);
    return null;
  }
}
