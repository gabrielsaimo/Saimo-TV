import type { Movie } from '../types/movie';
import { moviesData, movieCategories, searchMovies as localSearchMovies } from '../data/movies';

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
  return Promise.resolve(localSearchMovies(query));
};

export const getCategories = (): string[] => movieCategories;

export const clearMoviesCache = (): void => {
  // Não precisa mais de cache, dados são locais
};
