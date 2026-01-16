// Tipos para os dados enriched do TMDB

export interface EnrichedCastMember {
  id: number;
  name: string;
  character: string;
  photo: string | null;
}

export interface EnrichedCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  photo: string | null;
}

export interface EnrichedRecommendation {
  id: number;
  title: string;
  poster: string | null;
  rating: number;
}

export interface EnrichedEpisode {
  episode: number;
  name: string;
  url: string;
  id: string;
}

export interface EnrichedTMDBData {
  id: number;
  imdbId?: string;
  title: string;
  originalTitle: string;
  tagline: string | null;
  overview: string;
  status?: string;
  language: string;
  // Para filmes
  releaseDate?: string;
  // Para séries
  firstAirDate?: string;
  lastAirDate?: string;
  episodeRuntime?: number;
  year: string;
  runtime?: number;
  rating: number;
  voteCount: number;
  popularity: number;
  certification: string | null;
  genres: string[];
  poster: string | null;
  posterHD: string | null;
  backdrop: string | null;
  backdropHD: string | null;
  logo: string | null;
  cast: EnrichedCastMember[];
  crew?: EnrichedCrewMember[];
  keywords: string[];
  companies: string[];
  countries: string[];
  budget?: number;
  revenue?: number;
  recommendations: EnrichedRecommendation[];
}

export interface EnrichedMovie {
  id: string;
  name: string;
  url?: string;
  category: string;
  type: 'movie' | 'series';
  isAdult?: boolean;
  tmdb?: EnrichedTMDBData;
}

export interface EnrichedSeries extends EnrichedMovie {
  type: 'series';
  episodes: Record<string, EnrichedEpisode[]>;
  totalEpisodes?: number;
  totalSeasons?: number;
}

// Type guard para séries
export function isEnrichedSeries(item: EnrichedMovie): item is EnrichedSeries {
  return item.type === 'series' && 'episodes' in item;
}

// Interface para categorias
export interface CategoryInfo {
  name: string;
  file: string;
  count: number;
  isAdult: boolean;
}

// Filtros disponíveis
export interface FilterOptions {
  genres: string[];
  years: string[];
  ratings: string[];
  certifications: string[];
  type: 'all' | 'movie' | 'series';
  sortBy: 'name' | 'rating' | 'year' | 'popularity';
  sortOrder: 'asc' | 'desc';
}

// Resultado de busca por ator
export interface ActorFilmography {
  actor: EnrichedCastMember;
  movies: EnrichedMovie[];
  series: EnrichedSeries[];
}
