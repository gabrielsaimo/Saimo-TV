/** Uma origem do mesmo título: o endereço e em que idioma ele está. */
export interface MovieSource {
  url: string;
  /** "dub", "leg" — como vem do catálogo. */
  versao?: string;
}

export interface Movie {
  id: string;
  name: string;
  url: string;
  /**
   * Todas as origens do título, na ordem publicada (a melhor primeiro).
   * Quando vem vazia, `url` é a única. Serve para a pessoa trocar de fonte
   * sem voltar para a lista — inclusive quando nenhuma abre aqui dentro.
   */
  sources?: MovieSource[];
  /** Fonte escolhida explicitamente no modal; não reordena a fila HTTPS. */
  initialSourceUrl?: string;
  logo?: string;
  category: string;
  year?: string;
  type: 'movie' | 'series';
  rating?: number; // Nota do TMDB/IMDB (0-10)

  /** Metadados opcionais usados na navegação contínua de séries. */
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  /** Id do TMDB: é por ele que o TheIntroDB diz onde pular a abertura. */
  tmdbId?: number;
  /** Onde o título mora no acervo — é o que o "Continue assistindo" reabre. */
  origem?: import('../services/vodService').ItemDestaque;
}

/**
 * Contexto de navegação de uma série durante a reprodução.
 *
 * `episodes` contém a série inteira, em ordem, não só a temporada atual. Isso
 * permite trocar de episódio dentro do player, avançar de uma temporada para
 * a próxima e voltar ao episódio anterior sem reabrir o catálogo.
 */
export interface SeriesEpisodeInfo {
  currentEpisode: number;
  currentSeason: number;
  totalEpisodes: number;
  episodes: Movie[];
  seriesName: string;
}

export interface MovieCategory {
  name: string;
  movies: Movie[];
}
