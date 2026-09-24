/**
 * Busca de capa no TMDB, com o mesmo algoritmo de casamento do
 * `api-saimo-tv` — o gerador que enriquece o catálogo do Supabase.
 *
 * O Cinemeta que este site usava antes ficava com o primeiro resultado da
 * busca, sem comparar nome nenhum: "A 13ª Emenda" batia com qualquer coisa
 * que a busca por esse texto trouxesse primeiro, e o preço era uma capa
 * errada com frequência. Aqui cada resultado ganha uma pontuação — título
 * exato, título contido, ano de lançamento, popularidade — e só o suficiente
 * para valer a pena costuma vencer.
 */

const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_MIN_SCORE = 10;

export type TmdbTipo = 'movie' | 'tv';

interface TmdbResultado {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_count?: number;
  popularity?: number;
}

const LEADING_ARTICLES = /^(o|a|os|as|um|uma|the|an?)\s+/i;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tira marcador de idioma, qualidade, ano entre colchetes e resto de episódio. */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([]\s*(leg|dub|dublado|legendado|dual|national|pt-br|pt-pt|eng|legendada)\s*[)\]]/gi, '')
    .replace(/\b(4K|UHD|HD|FHD|SD|BluRay|BDRip|WEB-DL|WEBRip|HDTV|DVDRip|CAM|HDR|SDR)\b/gi, '')
    .replace(/\s*[([]\d{4}[)\]]\s*/g, '')
    .replace(/\s+S\d{1,2}\s*(?:E|Ep)?\s*\d{1,3}.*/i, '')
    .replace(/\s+T\d{1,2}\s*(?:E|Ep)?\s*\d{1,3}.*/i, '')
    .replace(/\s+Temporada\s+\d+.*/i, '')
    .replace(/\s+\d{1,2}x\d{1,3}.*/i, '')
    .replace(/[\s.\-_]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * As variações que valem tentar, na ordem: título limpo, sem marcador de
 * idioma residual, sem artigo inicial, sem subtítulo depois de ":" ou "-",
 * sem acento, sem algarismo romano no fim.
 */
function buildSearchVariants(name: string): string[] {
  const cleaned = cleanTitle(name);
  const variants = [cleaned];
  const add = (s: string | null) => { if (s && s.length > 1) variants.push(s); };

  const withoutLang = cleaned.replace(/\s*[([](leg|dub|dublado|legendado|dual|national)[)\]]/gi, '').trim();
  add(withoutLang !== cleaned ? withoutLang : null);

  const withoutArticle = cleaned.replace(LEADING_ARTICLES, '').trim();
  add(withoutArticle !== cleaned ? withoutArticle : null);

  const withoutSubtitle = cleaned.split(/\s*[:-]\s+/)[0].trim();
  add(withoutSubtitle !== cleaned && withoutSubtitle.length > 2 ? withoutSubtitle : null);

  const ascii = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  add(ascii !== cleaned ? ascii : null);

  const withoutRoman = cleaned.replace(/\s+(?:II|III|IV|V|VI|VII|VIII|IX|X)$/i, '').trim();
  add(withoutRoman !== cleaned ? withoutRoman : null);

  return [...new Set(variants)];
}

/** Ano dentro do próprio título ("Duna (2021)"), quando houver. */
function extrairAno(titulo: string): number | null {
  const m = titulo.match(/\b(20\d{2}|19\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function pontuar(
  nomeLocal: string,
  resultado: TmdbResultado,
  tipo: TmdbTipo,
  ano: number | null,
  unico = false,
): number {
  const localNorm = normalizeName(cleanTitle(nomeLocal));
  const titulo = tipo === 'tv' ? resultado.name : resultado.title;
  const original = tipo === 'tv' ? resultado.original_name : resultado.original_title;
  const tituloNorm = normalizeName(titulo || '');
  const originalNorm = normalizeName(original || '');

  let pontos = 0;

  if (localNorm === tituloNorm || localNorm === originalNorm) pontos += 100;
  else if (tituloNorm.startsWith(localNorm) || localNorm.startsWith(tituloNorm)) pontos += 70;
  else if (originalNorm.startsWith(localNorm) || localNorm.startsWith(originalNorm)) pontos += 65;
  else if (tituloNorm.includes(localNorm) || localNorm.includes(tituloNorm)) pontos += 50;
  else if (originalNorm.includes(localNorm) || localNorm.includes(originalNorm)) pontos += 45;
  // A busca do TMDB já casa por título traduzido — "A Amiga Genial" só acha
  // "My Brilliant Friend" porque o TMDB sabe do apelido em italiano por trás
  // dele, e nem `name` nem `original_name` trazem esse elo para eu comparar
  // aqui. Quando a busca devolveu só isso, a relevância deles já fez o
  // trabalho difícil; vale confiar o suficiente para passar do piso.
  else if (unico) pontos += 12;

  const votos = resultado.vote_count || 0;
  if (votos > 1000) pontos += 15;
  else if (votos > 100) pontos += 8;

  if (ano) {
    const dataLancamento = tipo === 'tv' ? resultado.first_air_date : resultado.release_date;
    const anoTmdb = dataLancamento ? Number(dataLancamento.slice(0, 4)) : null;
    if (anoTmdb) {
      const diff = Math.abs(ano - anoTmdb);
      if (diff === 0) pontos += 25;
      else if (diff === 1) pontos += 10;
      else if (diff > 2) pontos -= 25;
    }
  }

  return pontos;
}

async function buscarUmaVez(query: string, tipo: TmdbTipo, lang: string): Promise<TmdbResultado[]> {
  const endpoint = tipo === 'tv' ? 'search/tv' : 'search/movie';
  const url = `${TMDB_BASE}/${endpoint}?query=${encodeURIComponent(query)}&api_key=${TMDB_API_KEY}&language=${lang}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return [];
    const json = await r.json();
    return json?.results ?? [];
  } catch {
    return [];
  }
}

/** pt-BR primeiro; sem resultado, tenta en-US — como o gerador do Supabase faz. */
async function buscarTMDB(query: string, tipo: TmdbTipo): Promise<TmdbResultado[]> {
  const pt = await buscarUmaVez(query, tipo, 'pt-BR');
  if (pt.length) return pt;
  return buscarUmaVez(query, tipo, 'en-US');
}

export interface MelhorMatch {
  resultado: TmdbResultado;
  tipo: TmdbTipo;
  pontuacao: number;
}

/**
 * Tenta o tipo pedido em todas as variantes do nome; se a pontuação continuar
 * baixa, tenta o tipo oposto — um "anime" catalogado como filme às vezes é
 * uma série no TMDB, e vice-versa.
 */
export async function melhorMatch(nome: string, tipoPrincipal: TmdbTipo): Promise<MelhorMatch | null> {
  const ano = extrairAno(nome);
  const variantes = buildSearchVariants(nome);
  const tipoAlternativo: TmdbTipo = tipoPrincipal === 'movie' ? 'tv' : 'movie';

  let melhor: TmdbResultado | null = null;
  let melhorPontos = 0;
  let tipoEncontrado = tipoPrincipal;

  for (const variante of variantes) {
    const resultados = await buscarTMDB(variante, tipoPrincipal);
    const unico = resultados.length === 1;
    for (const r of resultados.slice(0, 5)) {
      const pontos = pontuar(nome, r, tipoPrincipal, ano, unico);
      if (pontos > melhorPontos) { melhorPontos = pontos; melhor = r; }
    }
    if (melhorPontos >= 90) break;
  }

  if (melhorPontos < TMDB_MIN_SCORE) {
    for (const variante of variantes) {
      const resultados = await buscarTMDB(variante, tipoAlternativo);
      const unico = resultados.length === 1;
      for (const r of resultados.slice(0, 5)) {
        const pontos = pontuar(nome, r, tipoAlternativo, ano, unico);
        if (pontos > melhorPontos) { melhorPontos = pontos; melhor = r; tipoEncontrado = tipoAlternativo; }
      }
      if (melhorPontos >= 90) break;
    }
  }

  if (!melhor || melhorPontos < TMDB_MIN_SCORE) return null;
  return { resultado: melhor, tipo: tipoEncontrado, pontuacao: melhorPontos };
}

/** URL do pôster num tamanho bom para grade de cartões. */
export function posterUrl(path: string | null | undefined, largura: 'w185' | 'w342' | 'w500' = 'w342'): string | null {
  return path ? `https://image.tmdb.org/t/p/${largura}${path}` : null;
}

// ── Ficha completa ─────────────────────────────────────────────────────────
//
// A busca do TMDB devolve pouco: título, capa e pouco mais. Sinopse inteira,
// duração, classificação indicativa, elenco, direção e produtora só existem no
// endereço do próprio título — e é um pedido por título aberto, não por título
// listado. Com o id vindo do arquivo de fichas não há busca nem desempate:
// pergunta-se direto pelo número certo.
//
// Os mesmos campos, com os mesmos nomes, são o que o celular, o Mac, a TV Box e
// o Windows mostram.

export interface Pessoa {
  id: number;
  nome: string;
  papel: string;
  foto: string | null;
}

export interface Ficha {
  titulo: string;
  sinopse: string;
  frase: string;
  /** Minutos: do filme, ou de um episódio da série. */
  duracao: number | null;
  classificacao: string | null;
  nota: number;
  ano: string;
  generos: string[];
  /** Quem dirigiu o filme, ou quem criou a série. */
  assinatura: string;
  roteiro: string;
  produtora: string;
  elenco: Pessoa[];
  capa: string | null;
  fundo: string | null;
}

export function fichaVazia(ficha: Ficha): boolean {
  return !ficha.sinopse && !ficha.elenco.length && !ficha.generos.length && ficha.duracao == null;
}

/** A classificação indicativa brasileira, quando o TMDB a conhece. */
function certificacaoBR(json: any, serie: boolean): string | null {
  if (serie) {
    const br = json?.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'BR');
    return br?.rating || null;
  }
  const br = json?.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'BR');
  const comNota = br?.release_dates?.find((d: any) => d.certification);
  return comNota?.certification || null;
}

const fichasEmMemoria = new Map<string, Promise<Ficha | null>>();

export function ficha(id: number, serie: boolean): Promise<Ficha | null> {
  const chave = `${serie ? 'tv' : 'movie'}:${id}`;
  const existente = fichasEmMemoria.get(chave);
  if (existente) return existente;

  const promessa = (async (): Promise<Ficha | null> => {
    const tipo = serie ? 'tv' : 'movie';
    const extras = serie ? 'credits,content_ratings' : 'credits,release_dates';
    try {
      const resposta = await fetch(
        `${TMDB_BASE}/${tipo}/${id}?api_key=${TMDB_API_KEY}&language=pt-BR` +
        `&append_to_response=${extras}`,
      );
      if (!resposta.ok) return null;
      const json = await resposta.json();

      const equipe: any[] = json?.credits?.crew ?? [];
      const direcao = equipe.filter((p) => p.job === 'Director').map((p) => p.name);
      const roteiro = equipe
        .filter((p) => p.job === 'Screenplay' || p.job === 'Writer' || p.job === 'Story')
        .map((p) => p.name);
      // Série não tem diretor único: quem a assina é quem a criou.
      const criadores: string[] = (json?.created_by ?? []).map((p: any) => p.name);
      const assinatura = (direcao.length ? direcao : criadores).slice(0, 2).join(', ');
      const data = (serie ? json?.first_air_date : json?.release_date) ?? '';

      return {
        titulo: (serie ? json?.name : json?.title) ?? '',
        sinopse: json?.overview ?? '',
        frase: json?.tagline ?? '',
        duracao: (serie ? json?.episode_run_time?.[0] : json?.runtime) || null,
        classificacao: certificacaoBR(json, serie),
        nota: json?.vote_average ?? 0,
        ano: String(data).slice(0, 4),
        generos: (json?.genres ?? []).map((g: any) => g.name).filter(Boolean),
        assinatura,
        roteiro: [...new Set(roteiro)].slice(0, 2).join(', '),
        produtora: json?.production_companies?.[0]?.name ?? '',
        elenco: (json?.credits?.cast ?? []).slice(0, 20).map((p: any) => ({
          id: p.id,
          nome: p.name,
          papel: p.character ?? '',
          foto: posterUrl(p.profile_path, 'w185'),
        })),
        capa: posterUrl(json?.poster_path, 'w342'),
        fundo: json?.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${json.backdrop_path}`
          : null,
      };
    } catch {
      return null;
    }
  })();

  fichasEmMemoria.set(chave, promessa);
  return promessa;
}

/**
 * Os trabalhos de um ator, como o TMDB os devolve: id e se é série, em ordem
 * de popularidade. O cruzamento com o acervo é feito por quem chama, que é
 * quem tem o índice — a lista inteira do TMDB não serve de dentro do site.
 */
export async function creditosDe(ator: number): Promise<{ id: number; serie: boolean }[]> {
  try {
    const resposta = await fetch(
      `${TMDB_BASE}/person/${ator}/combined_credits?api_key=${TMDB_API_KEY}&language=pt-BR`,
    );
    if (!resposta.ok) return [];
    const json = await resposta.json();
    const trabalhos: any[] = [...(json?.cast ?? []), ...(json?.crew ?? [])];
    trabalhos.sort((a, b) => (b?.popularity ?? 0) - (a?.popularity ?? 0));
    const vistos = new Set<string>();
    const saida: { id: number; serie: boolean }[] = [];
    for (const trabalho of trabalhos) {
      const id = Number(trabalho?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const serie = trabalho?.media_type === 'tv';
      const marca = `${serie ? 's' : 'f'}:${id}`;
      if (vistos.has(marca)) continue;
      vistos.add(marca);
      saida.push({ id, serie });
    }
    return saida;
  } catch {
    return [];
  }
}
