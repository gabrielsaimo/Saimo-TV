import type { Movie } from '../types/movie';
import { moviesData, movieCategories } from '../data/movies';

// Re-exporta os dados pré-processados para carregamento instantâneo
export const fetchMovies = (): Promise<Movie[]> => {
  return Promise.resolve(moviesData);
};

export const getMoviesByCategory = (): Promise<Map<string, Movie[]>> => {
  const categories = new Map<string, Movie[]>();
  
  moviesData.forEach(movie => {
    const cat = movie.category;
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push(movie);
  });
  
  return Promise.resolve(categories);
};

export const searchMovies = (query: string): Promise<Movie[]> => {
  const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const results = moviesData.filter(movie => {
    const name = movie.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return name.includes(normalizedQuery);
  });
  return Promise.resolve(results);
};

export const getCategories = (): string[] => movieCategories;

export const clearMoviesCache = (): void => {
  // Não precisa mais de cache, dados são locais
};
