/**
 * Serviço de dados enriquecidos do TMDB
 * 
 * Este serviço substitui o imageService para usar dados pré-carregados
 * dos arquivos JSON enriched, evitando chamadas à API do TMDB em tempo real.
 */

import type { 
  EnrichedMovie, 
  EnrichedSeries, 
  EnrichedCastMember,
  CategoryInfo,
  FilterOptions,
  ActorFilmography
} from '../types/enrichedMovie';

// Cache de dados carregados
const dataCache = new Map<string, EnrichedMovie[]>();
const categoryCache = new Map<string, CategoryInfo>();
const actorIndex = new Map<number, { name: string; photo: string | null; items: Set<string> }>();
const genreSet = new Set<string>();
const yearSet = new Set<string>();
const certificationSet = new Set<string>();
const keywordIndex = new Map<string, Set<string>>();

// Flag de inicialização
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Lista de categorias disponíveis (sem adulto por padrão)
const ENRICHED_CATEGORIES: CategoryInfo[] = [
  { name: '🎬 Lançamentos', file: 'lancamentos.json', count: 0, isAdult: false },
  { name: '📺 Netflix', file: 'netflix.json', count: 0, isAdult: false },
  { name: '📺 Prime Video', file: 'prime-video.json', count: 0, isAdult: false },
  { name: '📺 Disney+', file: 'disney.json', count: 0, isAdult: false },
  { name: '📺 Max', file: 'max.json', count: 0, isAdult: false },
  { name: '📺 Globoplay', file: 'globoplay.json', count: 0, isAdult: false },
  { name: '📺 Apple TV+', file: 'apple-tv.json', count: 0, isAdult: false },
  { name: '📺 Paramount+', file: 'paramount.json', count: 0, isAdult: false },
  { name: '📺 Star+', file: 'star.json', count: 0, isAdult: false },
  { name: '📺 Crunchyroll', file: 'crunchyroll.json', count: 0, isAdult: false },
  { name: '📺 Funimation', file: 'funimation.json', count: 0, isAdult: false },
  { name: '📺 Discovery+', file: 'discovery.json', count: 0, isAdult: false },
  { name: '🎬 4K UHD', file: '4k-uhd.json', count: 0, isAdult: false },
  { name: '🎬 Ação', file: 'acao.json', count: 0, isAdult: false },
  { name: '🎬 Comédia', file: 'comedia.json', count: 0, isAdult: false },
  { name: '🎬 Drama', file: 'drama.json', count: 0, isAdult: false },
  { name: '🎬 Terror', file: 'terror.json', count: 0, isAdult: false },
  { name: '🎬 Ficção Científica', file: 'ficcao-cientifica.json', count: 0, isAdult: false },
  { name: '🎬 Animação', file: 'animacao.json', count: 0, isAdult: false },
  { name: '🎬 Fantasia', file: 'fantasia.json', count: 0, isAdult: false },
  { name: '🎬 Aventura', file: 'aventura.json', count: 0, isAdult: false },
  { name: '🎬 Romance', file: 'romance.json', count: 0, isAdult: false },
  { name: '🎬 Suspense', file: 'suspense.json', count: 0, isAdult: false },
  { name: '🎬 Crime', file: 'crime.json', count: 0, isAdult: false },
  { name: '🎬 Documentário', file: 'documentario.json', count: 0, isAdult: false },
  { name: '📺 Doramas', file: 'doramas.json', count: 0, isAdult: false },
  { name: '📺 Novelas', file: 'novelas.json', count: 0, isAdult: false },
  { name: '🎬 Legendados', file: 'legendados.json', count: 0, isAdult: false },
  { name: '📺 Legendadas', file: 'legendadas.json', count: 0, isAdult: false },
  { name: '🎬 Nacionais', file: 'nacionais.json', count: 0, isAdult: false },
  { name: '🇧🇷 Brasil Paralelo', file: 'brasil-paralelo.json', count: 0, isAdult: false },
];

// Categorias de conteúdo adulto (só exibir quando desbloqueado)
const ADULT_CATEGORIES: CategoryInfo[] = [
  { name: '🔞 Adultos', file: 'adultos.json', count: 0, isAdult: true },
  { name: '🔞 Adultos - Bella da Semana', file: 'adultos-bella-da-semana.json', count: 0, isAdult: true },
  { name: '🔞 Adultos - Legendado', file: 'adultos-legendado.json', count: 0, isAdult: true },
];

// Categorias de streaming para destaque
export const STREAMING_CATEGORIES = [
  '📺 Netflix',
  '📺 Prime Video', 
  '📺 Disney+',
  '📺 Max',
  '📺 Globoplay',
  '📺 Apple TV+',
  '📺 Paramount+',
  '📺 Star+',
  '📺 Crunchyroll',
  '📺 Discovery+',
];

// Categorias de gênero
export const GENRE_CATEGORIES = [
  '🎬 Ação',
  '🎬 Comédia',
  '🎬 Drama',
  '🎬 Terror',
  '🎬 Ficção Científica',
  '🎬 Animação',
  '🎬 Fantasia',
  '🎬 Aventura',
  '🎬 Romance',
  '🎬 Suspense',
  '🎬 Crime',
  '🎬 Documentário',
];

// Exporta categorias adultas para uso externo
export { ADULT_CATEGORIES };

/**
 * Retorna todas as categorias disponíveis
 * @param includeAdult Se deve incluir categorias adultas
 */
export function getAllCategories(includeAdult: boolean = false): CategoryInfo[] {
  if (includeAdult) {
    return [...ENRICHED_CATEGORIES, ...ADULT_CATEGORIES];
  }
  return [...ENRICHED_CATEGORIES];
}

/**
 * Carrega uma categoria de dados enriched
 */
export async function loadEnrichedCategory(categoryName: string): Promise<EnrichedMovie[]> {
  // Verifica cache primeiro
  if (dataCache.has(categoryName)) {
    return dataCache.get(categoryName)!;
  }

  // Encontra o arquivo da categoria (busca em normais e adultos)
  let category = ENRICHED_CATEGORIES.find(c => c.name === categoryName);
  if (!category) {
    category = ADULT_CATEGORIES.find(c => c.name === categoryName);
  }
  
  if (!category) {
    console.warn(`Categoria não encontrada: ${categoryName}`);
    return [];
  }

  try {
    const response = await fetch(`/data/enriched/${category.file}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: EnrichedMovie[] = await response.json();
    
    // Atualiza count da categoria
    category.count = data.length;
    categoryCache.set(categoryName, category);
    
    // Cacheia os dados
    dataCache.set(categoryName, data);
    
    // Indexa atores, gêneros, anos, etc.
    indexData(data);
    
    return data;
  } catch (error) {
    console.error(`Erro ao carregar categoria ${categoryName}:`, error);
    return [];
  }
}

/**
 * Indexa dados para busca rápida
 */
function indexData(movies: EnrichedMovie[]): void {
  for (const movie of movies) {
    if (!movie.tmdb) continue;
    
    // Indexa gêneros
    movie.tmdb.genres?.forEach(g => genreSet.add(g));
    
    // Indexa anos
    if (movie.tmdb.year) {
      yearSet.add(movie.tmdb.year);
    }
    
    // Indexa classificações
    if (movie.tmdb.certification) {
      certificationSet.add(movie.tmdb.certification);
    }
    
    // Indexa keywords
    movie.tmdb.keywords?.forEach(kw => {
      const kwLower = kw.toLowerCase();
      if (!keywordIndex.has(kwLower)) {
        keywordIndex.set(kwLower, new Set());
      }
      keywordIndex.get(kwLower)!.add(movie.id);
    });
    
    // Indexa atores
    movie.tmdb.cast?.forEach(actor => {
      if (!actorIndex.has(actor.id)) {
        actorIndex.set(actor.id, {
          name: actor.name,
          photo: actor.photo,
          items: new Set()
        });
      }
      actorIndex.get(actor.id)!.items.add(movie.id);
    });
  }
}

/**
 * Inicializa o serviço carregando todas as categorias
 */
export async function initializeEnrichedData(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    console.log('🎬 Inicializando dados enriched...');
    const startTime = Date.now();
    
    // Carrega categorias principais em paralelo
    const priorityCategories = [
      '🎬 Lançamentos',
      '📺 Netflix',
      '📺 Prime Video',
      '📺 Disney+',
      '📺 Max',
    ];
    
    await Promise.all(priorityCategories.map(cat => loadEnrichedCategory(cat)));
    
    isInitialized = true;
    console.log(`✅ Dados enriched inicializados em ${Date.now() - startTime}ms`);
    
    // Carrega resto em background
    const otherCategories = ENRICHED_CATEGORIES
      .filter(c => !priorityCategories.includes(c.name))
      .map(c => c.name);
    
    // Carrega em lotes de 3 para não sobrecarregar
    for (let i = 0; i < otherCategories.length; i += 3) {
      const batch = otherCategories.slice(i, i + 3);
      await Promise.all(batch.map(cat => loadEnrichedCategory(cat)));
    }
    
    console.log(`✅ Todas as categorias carregadas!`);
  })();
  
  return initPromise;
}

/**
 * Obtém lista de categorias disponíveis
 */
export function getCategories(): CategoryInfo[] {
  return ENRICHED_CATEGORIES.map(c => ({
    ...c,
    count: categoryCache.get(c.name)?.count || c.count
  }));
}

/**
 * Obtém todos os gêneros únicos disponíveis
 */
export function getAvailableGenres(): string[] {
  return Array.from(genreSet).sort();
}

/**
 * Obtém todos os anos únicos disponíveis
 */
export function getAvailableYears(): string[] {
  return Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a));
}

/**
 * Obtém todas as classificações indicativas disponíveis
 */
export function getAvailableCertifications(): string[] {
  const order = ['L', '10', '12', '14', '16', '18'];
  return Array.from(certificationSet).sort((a, b) => {
    const aIdx = order.indexOf(a);
    const bIdx = order.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

/**
 * Busca filmes/séries por texto
 */
export function searchContent(
  query: string, 
  options?: Partial<FilterOptions>
): EnrichedMovie[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];
  
  const results: EnrichedMovie[] = [];
  const seenIds = new Set<string>();
  
  dataCache.forEach(movies => {
    for (const movie of movies) {
      if (seenIds.has(movie.id)) continue;
      
      // Busca no nome
      const matchesName = movie.name.toLowerCase().includes(normalizedQuery);
      
      // Busca no título TMDB
      const matchesTitle = movie.tmdb?.title?.toLowerCase().includes(normalizedQuery);
      
      // Busca no título original
      const matchesOriginal = movie.tmdb?.originalTitle?.toLowerCase().includes(normalizedQuery);
      
      // Busca em keywords
      const matchesKeyword = movie.tmdb?.keywords?.some(kw => 
        kw.toLowerCase().includes(normalizedQuery)
      );
      
      // Busca no elenco
      const matchesCast = movie.tmdb?.cast?.some(actor =>
        actor.name.toLowerCase().includes(normalizedQuery)
      );
      
      if (matchesName || matchesTitle || matchesOriginal || matchesKeyword || matchesCast) {
        // Aplica filtros adicionais
        if (options) {
          if (options.type && options.type !== 'all' && movie.type !== options.type) continue;
          if (options.genres?.length && !movie.tmdb?.genres?.some(g => options.genres!.includes(g))) continue;
          if (options.years?.length && !options.years.includes(movie.tmdb?.year || '')) continue;
          if (options.certifications?.length && !options.certifications.includes(movie.tmdb?.certification || '')) continue;
        }
        
        seenIds.add(movie.id);
        results.push(movie);
      }
    }
  });
  
  // Ordena por relevância (nome exato primeiro)
  return results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === normalizedQuery || a.tmdb?.title?.toLowerCase() === normalizedQuery;
    const bExact = b.name.toLowerCase() === normalizedQuery || b.tmdb?.title?.toLowerCase() === normalizedQuery;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    // Por rating
    const aRating = a.tmdb?.rating || 0;
    const bRating = b.tmdb?.rating || 0;
    return bRating - aRating;
  });
}

/**
 * Filtra conteúdo de uma categoria
 */
export function filterContent(
  categoryName: string,
  filters: Partial<FilterOptions>
): EnrichedMovie[] {
  const movies = dataCache.get(categoryName) || [];
  
  let filtered = movies.filter(movie => {
    // Filtro por tipo
    if (filters.type && filters.type !== 'all' && movie.type !== filters.type) {
      return false;
    }
    
    // Filtro por gênero
    if (filters.genres?.length) {
      if (!movie.tmdb?.genres?.some(g => filters.genres!.includes(g))) {
        return false;
      }
    }
    
    // Filtro por ano
    if (filters.years?.length) {
      if (!filters.years.includes(movie.tmdb?.year || '')) {
        return false;
      }
    }
    
    // Filtro por classificação
    if (filters.certifications?.length) {
      if (!filters.certifications.includes(movie.tmdb?.certification || '')) {
        return false;
      }
    }
    
    // Filtro por rating mínimo
    if (filters.ratings?.length) {
      const minRating = Math.min(...filters.ratings.map(r => parseFloat(r)));
      if ((movie.tmdb?.rating || 0) < minRating) {
        return false;
      }
    }
    
    return true;
  });
  
  // Ordenação
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;
      
      switch (filters.sortBy) {
        case 'name':
          aVal = a.tmdb?.title || a.name;
          bVal = b.tmdb?.title || b.name;
          break;
        case 'rating':
          aVal = a.tmdb?.rating || 0;
          bVal = b.tmdb?.rating || 0;
          break;
        case 'year':
          aVal = parseInt(a.tmdb?.year || '0');
          bVal = parseInt(b.tmdb?.year || '0');
          break;
        case 'popularity':
          aVal = a.tmdb?.popularity || 0;
          bVal = b.tmdb?.popularity || 0;
          break;
      }
      
      const order = filters.sortOrder === 'asc' ? 1 : -1;
      if (typeof aVal === 'string') {
        return order * aVal.localeCompare(bVal as string);
      }
      return order * ((bVal as number) - (aVal as number));
    });
  }
  
  return filtered;
}

/**
 * Filtra todo o conteúdo disponível (todas as categorias)
 */
export function filterAllContent(filters: Partial<FilterOptions>): EnrichedMovie[] {
  const seenIds = new Set<string>();
  const results: EnrichedMovie[] = [];
  
  dataCache.forEach(items => {
    for (const movie of items) {
      if (seenIds.has(movie.id)) continue;
      
      // Filtro por tipo
      if (filters.type && filters.type !== 'all' && movie.type !== filters.type) {
        continue;
      }
      
      // Filtro por gênero
      if (filters.genres?.length) {
        if (!movie.tmdb?.genres?.some(g => filters.genres!.includes(g))) {
          continue;
        }
      }
      
      // Filtro por ano
      if (filters.years?.length) {
        if (!filters.years.includes(movie.tmdb?.year || '')) {
          continue;
        }
      }
      
      // Filtro por classificação
      if (filters.certifications?.length) {
        if (!filters.certifications.includes(movie.tmdb?.certification || '')) {
          continue;
        }
      }
      
      // Filtro por rating mínimo
      if (filters.ratings?.length) {
        const minRating = Math.min(...filters.ratings.map(r => parseFloat(r)));
        if ((movie.tmdb?.rating || 0) < minRating) {
          continue;
        }
      }
      
      seenIds.add(movie.id);
      results.push(movie);
    }
  });
  
  // Ordenação
  if (filters.sortBy) {
    results.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;
      
      switch (filters.sortBy) {
        case 'name':
          aVal = a.tmdb?.title || a.name;
          bVal = b.tmdb?.title || b.name;
          break;
        case 'rating':
          aVal = a.tmdb?.rating || 0;
          bVal = b.tmdb?.rating || 0;
          break;
        case 'year':
          aVal = parseInt(a.tmdb?.year || '0');
          bVal = parseInt(b.tmdb?.year || '0');
          break;
        case 'popularity':
        default:
          aVal = a.tmdb?.popularity || 0;
          bVal = b.tmdb?.popularity || 0;
          break;
      }
      
      const order = filters.sortOrder === 'asc' ? 1 : -1;
      if (typeof aVal === 'string') {
        return order * aVal.localeCompare(bVal as string);
      }
      return order * ((bVal as number) - (aVal as number));
    });
  }
  
  return results;
}

/**
 * Obtém filmografia de um ator
 */
export function getActorFilmography(actorId: number): ActorFilmography | null {
  const actorData = actorIndex.get(actorId);
  if (!actorData) return null;
  
  const movies: EnrichedMovie[] = [];
  const series: EnrichedSeries[] = [];
  
  dataCache.forEach(items => {
    for (const item of items) {
      if (actorData.items.has(item.id)) {
        if (item.type === 'series' && 'episodes' in item) {
          series.push(item as EnrichedSeries);
        } else {
          movies.push(item);
        }
      }
    }
  });
  
  // Remove duplicatas
  const uniqueMovies = Array.from(new Map(movies.map(m => [m.id, m])).values());
  const uniqueSeries = Array.from(new Map(series.map(s => [s.id, s])).values());
  
  // Ordena por rating
  uniqueMovies.sort((a, b) => (b.tmdb?.rating || 0) - (a.tmdb?.rating || 0));
  uniqueSeries.sort((a, b) => (b.tmdb?.rating || 0) - (a.tmdb?.rating || 0));
  
  return {
    actor: {
      id: actorId,
      name: actorData.name,
      character: '',
      photo: actorData.photo
    },
    movies: uniqueMovies,
    series: uniqueSeries
  };
}

/**
 * Busca todos os atores disponíveis (para autocomplete)
 */
export function searchActors(query: string): EnrichedCastMember[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery || normalizedQuery.length < 2) return [];
  
  const results: EnrichedCastMember[] = [];
  
  actorIndex.forEach((data, id) => {
    if (data.name.toLowerCase().includes(normalizedQuery)) {
      results.push({
        id,
        name: data.name,
        character: '',
        photo: data.photo
      });
    }
  });
  
  // Ordena por número de trabalhos
  return results
    .sort((a, b) => {
      const aCount = actorIndex.get(a.id)?.items.size || 0;
      const bCount = actorIndex.get(b.id)?.items.size || 0;
      return bCount - aCount;
    })
    .slice(0, 20);
}

/**
 * Encontra um item por ID
 */
export function findById(id: string): EnrichedMovie | null {
  for (const movies of dataCache.values()) {
    const found = movies.find(m => m.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * Encontra item por TMDB ID
 */
export function findByTmdbId(tmdbId: number): EnrichedMovie | null {
  for (const movies of dataCache.values()) {
    const found = movies.find(m => m.tmdb?.id === tmdbId);
    if (found) return found;
  }
  return null;
}

/**
 * Obtém itens recomendados que existem no catálogo
 */
export function getAvailableRecommendations(movie: EnrichedMovie): EnrichedMovie[] {
  if (!movie.tmdb?.recommendations?.length) return [];
  
  const recommendations: EnrichedMovie[] = [];
  
  for (const rec of movie.tmdb.recommendations) {
    const found = findByTmdbId(rec.id);
    if (found) {
      recommendations.push(found);
    }
  }
  
  return recommendations.slice(0, 10);
}

/**
 * Obtém itens com gêneros similares
 */
export function getSimilarByGenre(movie: EnrichedMovie, limit = 10): EnrichedMovie[] {
  if (!movie.tmdb?.genres?.length) return [];
  
  const movieGenres = new Set(movie.tmdb.genres);
  const results: { movie: EnrichedMovie; score: number }[] = [];
  const seenIds = new Set<string>([movie.id]);
  
  dataCache.forEach(movies => {
    for (const m of movies) {
      if (seenIds.has(m.id)) continue;
      if (m.type !== movie.type) continue; // Mesmo tipo
      if (!m.tmdb?.genres?.length) continue;
      
      // Calcula score por gêneros em comum
      const commonGenres = m.tmdb.genres.filter(g => movieGenres.has(g));
      if (commonGenres.length === 0) continue;
      
      const score = commonGenres.length * 10 + (m.tmdb.rating || 0);
      
      seenIds.add(m.id);
      results.push({ movie: m, score });
    }
  });
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.movie);
}

/**
 * Obtém itens em destaque (mais bem avaliados)
 */
export function getFeaturedItems(type?: 'movie' | 'series', limit = 20): EnrichedMovie[] {
  const results: EnrichedMovie[] = [];
  const seenIds = new Set<string>();
  
  dataCache.forEach(movies => {
    for (const movie of movies) {
      if (seenIds.has(movie.id)) continue;
      if (type && movie.type !== type) continue;
      if (!movie.tmdb?.rating || movie.tmdb.rating < 7) continue;
      if (!movie.tmdb?.poster) continue;
      
      seenIds.add(movie.id);
      results.push(movie);
    }
  });
  
  return results
    .sort((a, b) => (b.tmdb?.rating || 0) - (a.tmdb?.rating || 0))
    .slice(0, limit);
}

/**
 * Obtém lançamentos recentes
 */
export function getRecentReleases(limit = 20): EnrichedMovie[] {
  const results: EnrichedMovie[] = [];
  const seenIds = new Set<string>();
  const currentYear = new Date().getFullYear();
  
  dataCache.forEach(movies => {
    for (const movie of movies) {
      if (seenIds.has(movie.id)) continue;
      
      const year = parseInt(movie.tmdb?.year || '0');
      if (year < currentYear - 2) continue; // Últimos 2 anos
      if (!movie.tmdb?.poster) continue;
      
      seenIds.add(movie.id);
      results.push(movie);
    }
  });
  
  return results
    .sort((a, b) => {
      const aYear = parseInt(a.tmdb?.year || '0');
      const bYear = parseInt(b.tmdb?.year || '0');
      if (aYear !== bYear) return bYear - aYear;
      return (b.tmdb?.rating || 0) - (a.tmdb?.rating || 0);
    })
    .slice(0, limit);
}

// Exporta cache para debug
export const _dataCache = dataCache;
export const _actorIndex = actorIndex;
