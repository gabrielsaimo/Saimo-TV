export interface Movie {
  id: string;
  name: string;
  url: string;
  logo?: string;
  category: string;
  year?: string;
  type: 'movie' | 'series';
}

export interface MovieCategory {
  name: string;
  movies: Movie[];
}
