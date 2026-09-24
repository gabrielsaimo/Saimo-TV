/**
 * Filmes e séries, baixados por pedaço do mesmo repositório que o app lê.
 *
 * Porte de `Vod.kt`. A lista de origem tem trinta megabytes e trezentas mil
 * linhas, o que nenhum navegador de TV abre; ela já vem pré-digerida em um
 * catálogo fatiado por letra, com as séries ainda repartidas dentro da letra, de
 * modo que nenhum download passa de uns cem quilobytes. Como a tela também
 * navega por letra, o download acompanha o dedo em vez de contrariá-lo.
 *
 * As capas não existem na origem e vêm do TMDB, buscadas e pontuadas com o
 * mesmo algoritmo do `api-saimo-tv` — o gerador que alimenta o catálogo do
 * Supabase. Pegar só o primeiro resultado (como este site fazia antes, via
 * Cinemeta) errava a capa com frequência; pontuar por título e ano é o que
 * torna a busca confiável o bastante para usar sem checagem manual.
 */

import { melhorMatch, posterUrl, type TmdbTipo } from './tmdbService';
import { peneirar as semDesligados } from './fontesDesativadas';

const BASE = 'https://raw.githubusercontent.com/gabrielsaimo/SaimoPlayer/main/vod/';

export const LETRAS = [
  '#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

/** Versão (dublado/legendado) -> fontes em ordem de preferência. */
export interface Filme {
  titulo: string;
  fontes: Record<string, string[]>;
}

export interface Serie {
  titulo: string;
  ano: string;
  pedaco: number;
  episodios: number;
  nomeCompleto: string;
}

export interface Episodio {
  temporada: number;
  numero: number;
  versao: string;
  urls: string[];
}

export type ColecaoVod = 'animes' | 'doramas';

/**
 * Série de uma coleção editorial publicada pelo gerador RedeFlix.
 *
 * Ao contrário do catálogo geral, estas listas são pequenas e já carregam os
 * episódios no mesmo arquivo. O `tmdbId` vem da lista oficial de IDs e evita
 * misturar títulos homônimos quando a capa/metadados forem enriquecidos.
 */
export interface SerieColecao {
  titulo: string;
  ano: string;
  tmdbId: string;
  episodios: Episodio[];
  nomeCompleto: string;
}

export interface Gaveta {
  letra: string;
  filmes: number;
  series: number;
  reservados: number;
}

export interface Achado {
  titulo: string;
  serie: boolean;
  letra: string;
  ano: string;
  nomeCompleto: string;
}

/** Os começos de endereço, numerados. Preenchidos ao ler o índice. */
let bases: string[] = [];
const arquivos = new Map<string, Promise<string | null>>();
let indiceBusca: string | null = null;
const colecoes = new Map<ColecaoVod, Promise<SerieColecao[]>>();

function gaveta(letra: string): string {
  return letra === '#' ? '%23' : letra;
}

/**
 * Conteúdo do arquivo, memorizado.
 *
 * O catálogo muda de vez em quando e nunca no meio de uma navegação, então o que
 * já foi lido serve para o resto da visita: poupa a rede e faz voltar à mesma
 * letra abrir na hora.
 */
function arquivo(nome: string): Promise<string | null> {
  const existente = arquivos.get(nome);
  if (existente) return existente;

  const promessa = fetch(BASE + nome)
    .then((r) => (r.ok ? r.text() : null))
    .catch(() => null)
    .then((texto) => {
      // Um download falho não pode virar "não existe" para sempre: sem
      // esquecê-lo, uma oscilação de rede deixaria a letra vazia até recarregar.
      if (texto === null) arquivos.delete(nome);
      return texto;
    });

  arquivos.set(nome, promessa);
  return promessa;
}

/**
 * O item guarda "base:resto"; o endereço inteiro sairia dezenas de vezes maior,
 * e o começo é sempre o mesmo punhado de servidores. Sem a base o que sobra é
 * "0:19927", que só falharia na hora de tocar — melhor devolver vazio.
 */
function montar(valor: string): string {
  if (valor.startsWith('http')) return valor;
  const corte = valor.indexOf(':');
  if (corte <= 0) return '';
  const indice = Number(valor.slice(0, corte));
  if (!Number.isInteger(indice)) return '';
  const resto = valor.slice(corte + 1);
  const base = bases[indice];
  if (!base) return '';
  return resto.includes('.') ? base + resto : `${base}${resto}.mp4`;
}

/** Letra -> quantos filmes, séries e reservados começam com ela. */
export async function indice(): Promise<Gaveta[]> {
  const texto = await arquivo('indice.txt');
  if (!texto) return [];
  const out: Gaveta[] = [];
  const encontradas: string[] = [];

  for (const linha of texto.split('\n')) {
    if (linha.startsWith('base:')) {
      const partes = linha.slice('base:'.length).trim().split(/\s+/);
      if (partes.length >= 2) encontradas[Number(partes[0])] = partes.slice(1).join(' ');
    } else if (linha.trim()) {
      const campos = linha.split('\t');
      if (campos.length >= 3) {
        out.push({
          letra: campos[0],
          filmes: Number(campos[1]) || 0,
          series: Number(campos[2]) || 0,
          reservados: Number(campos[3]) || 0,
        });
      }
    }
  }
  if (encontradas.length) bases = encontradas;
  return out;
}

/** Garante que as bases de endereço já foram lidas antes de montar uma URL. */
async function comBases<T>(trabalho: () => Promise<T>): Promise<T> {
  if (!bases.length) await indice();
  return trabalho();
}

export async function filmes(letra: string, reservados = false): Promise<Filme[]> {
  return comBases(async () => {
    const prefixo = reservados ? 'reservado' : 'filmes';
    const texto = await arquivo(`${prefixo}-${gaveta(letra)}.txt`);
    if (!texto) return [];

    const out: Filme[] = [];
    for (const linha of texto.split('\n')) {
      const campos = linha.split('\t');
      if (campos.length < 2 || !campos[0].trim()) continue;
      const fontes: Record<string, string[]> = {};
      for (const parte of campos.slice(1)) {
        const marca = parte.indexOf('=');
        if (marca <= 0) continue;
        const urls = semDesligados(parte
          .slice(marca + 1)
          .split(',')
          .filter(Boolean)
          .map(montar)
          .filter(Boolean));
        if (urls.length) fontes[parte.slice(0, marca)] = urls;
      }
      if (Object.keys(fontes).length) out.push({ titulo: campos[0], fontes });
    }
    return out;
  });
}

export async function series(letra: string): Promise<Serie[]> {
  const texto = await arquivo(`series-${gaveta(letra)}.txt`);
  if (!texto) return [];
  const out: Serie[] = [];
  for (const linha of texto.split('\n')) {
    const campos = linha.split('\t');
    if (campos.length < 4 || !campos[0].trim()) continue;
    const titulo = campos[0];
    const ano = campos[1];
    out.push({
      titulo,
      ano,
      pedaco: Number(campos[2]) || 0,
      episodios: Number(campos[3]) || 0,
      nomeCompleto: ano.trim() ? `${titulo} (${ano})` : titulo,
    });
  }
  return out;
}

/** Episódios de uma série. Baixa só o pedaço em que ela está. */
export async function episodios(letra: string, serie: Serie): Promise<Episodio[]> {
  return comBases(async () => {
    const texto = await arquivo(`series-${gaveta(letra)}-${serie.pedaco}.txt`);
    if (!texto) return [];

    const out: Episodio[] = [];
    let dentro = false;
    for (const linha of texto.split('\n')) {
      if (linha.startsWith('@')) {
        // O arquivo é ordenado: passar do bloco procurado quer dizer que acabou.
        if (dentro) break;
        const identidade = linha.slice(1).split('\t');
        dentro = identidade[0] === serie.titulo && (identidade[1] ?? '') === serie.ano;
        continue;
      }
      if (!dentro) continue;
      const campos = linha.split('\t');
      if (campos.length < 4) continue;
      const urls = semDesligados(campos[3].split(',').filter(Boolean).map(montar).filter(Boolean));
      if (!urls.length) continue;
      out.push({
        temporada: Number(campos[0]) || 0,
        numero: Number(campos[1]) || 0,
        versao: campos[2],
        urls,
      });
    }
    return out;
  });
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Procura em todo o acervo.
 *
 * O índice traz só nome, tipo e letra — menos de um megabyte para trinta mil
 * títulos — então dá para procurar no acervo inteiro sem baixar o acervo.
 */
export async function buscar(termo: string): Promise<Achado[]> {
  const alvo = normalizar(termo);
  if (alvo.length < 2) return [];
  const texto = indiceBusca ?? (await arquivo('busca.txt'));
  if (!texto) return [];
  indiceBusca = texto;

  const out: Achado[] = [];
  for (const linha of texto.split('\n')) {
    const campos = linha.split('\t');
    if (campos.length < 3) continue;
    const ano = campos[3] ?? '';
    if (!normalizar(`${campos[0]} ${ano}`).includes(alvo)) continue;
    out.push({
      titulo: campos[0],
      serie: campos[1] === 's',
      letra: campos[2],
      ano,
      nomeCompleto: ano.trim() ? `${campos[0]} (${ano})` : campos[0],
    });
    if (out.length >= 200) break;
  }
  return out;
}

/**
 * Todo o acervo de um tipo, de uma vez.
 *
 * Antes a tela pedia uma letra de cada vez, porque o acervo é publicado por
 * letra e a letra A sozinha já traz três mil e quinhentos filmes. Mas o índice
 * de busca tem os trinta mil nomes em menos de um megabyte, e é o mesmo
 * arquivo que a busca já baixa: dá para mostrar tudo e deixar a pessoa rolar,
 * sem escolher letra nenhuma. O endereço de cada título continua vindo da
 * letra dele, na hora em que for aberto.
 */
export async function todos(serie: boolean): Promise<Achado[]> {
  const texto = indiceBusca ?? (await arquivo('busca.txt'));
  if (!texto) return [];
  indiceBusca = texto;

  const out: Achado[] = [];
  for (const linha of texto.split('\n')) {
    const campos = linha.split('\t');
    if (campos.length < 3) continue;
    if ((campos[1] === 's') !== serie) continue;
    const ano = campos[3] ?? '';
    out.push({
      titulo: campos[0],
      serie,
      letra: campos[2],
      ano,
      nomeCompleto: ano.trim() ? `${campos[0]} (${ano})` : campos[0],
    });
  }
  return out;
}

/** Um filme específico, pelo nome, dentro da letra dele. */
export async function filme(achado: Achado): Promise<Filme | null> {
  const lista = await filmes(achado.letra);
  const direto = lista.find((f) => f.titulo === achado.titulo);
  if (direto) return direto;
  const reservado = await filmes(achado.letra, true);
  return reservado.find((f) => f.titulo === achado.titulo) ?? null;
}

/** Uma série específica, pelo nome, dentro da letra dela. */
export async function serie(achado: Achado): Promise<Serie | null> {
  const lista = await series(achado.letra);
  return lista.find(
    (s) => s.titulo === achado.titulo && (!achado.ano.trim() || s.ano === achado.ano),
  ) ?? null;
}

/** Lê `vod/redeflix/links-animes.txt` ou `links-doramas.txt`. */
export async function colecao(tipo: ColecaoVod): Promise<SerieColecao[]> {
  if (!bases.length) await indice();
  const existente = colecoes.get(tipo);
  if (existente) return existente;

  // Estas duas listas são atualizadas semanalmente. O raw do GitHub aceita
  // cache agressivo e chegava a mostrar por horas a classificação anterior
  // (anime dentro de Doramas) mesmo depois do arquivo já ter sido corrigido.
  const promessa = fetch(
    `${BASE}redeflix/links-${tipo}.txt?v=${Math.floor(Date.now() / 60_000)}`,
    { cache: 'no-store' },
  )
    .then((r) => {
      if (!r.ok) throw new Error(`Coleção ${tipo} indisponível (${r.status})`);
      return r.text();
    })
    .then((texto) => {
      const out: SerieColecao[] = [];
      let atual: SerieColecao | null = null;

      for (const linhaBruta of texto.split('\n')) {
        const linha = linhaBruta.trim();
        if (!linha) continue;
        if (linha.startsWith('@')) {
          const [titulo = '', ano = '', tmdbId = ''] = linha.slice(1).split('\t');
          if (!titulo.trim()) { atual = null; continue; }
          atual = {
            titulo: titulo.trim(),
            ano: ano.trim(),
            tmdbId: tmdbId.trim(),
            episodios: [],
            nomeCompleto: ano.trim() ? `${titulo.trim()} (${ano.trim()})` : titulo.trim(),
          };
          out.push(atual);
          continue;
        }
        if (!atual) continue;
        const [temporada, numero, versao, urlsTexto] = linhaBruta.split('\t');
        const urls = semDesligados((urlsTexto ?? '').split(',')
          .map((url) => montar(url.trim()))
          .filter(Boolean));
        if (!urls.length) continue;
        atual.episodios.push({
          temporada: Number(temporada) || 0,
          numero: Number(numero) || 0,
          versao: versao?.trim() || 'dub',
          urls,
        });
      }
      return out.filter((serie) => serie.episodios.length > 0);
    })
    .catch((erro) => {
      colecoes.delete(tipo);
      throw erro;
    });

  colecoes.set(tipo, promessa);
  return promessa;
}

// ============================================================
// CAPAS
// ============================================================

/// Título -> capa. Vazio quer dizer procurado e não achado, e é guardado
/// também: sem isso a mesma busca infrutífera se repetiria a cada rolagem.
const capasEmMemoria = new Map<string, Promise<string | null>>();

export function capa(titulo: string, serieBool: boolean): Promise<string | null> {
  const chave = `${serieBool ? 's' : 'f'}:${titulo}`;
  const existente = capasEmMemoria.get(chave);
  if (existente) return existente;

  const tipo: TmdbTipo = serieBool ? 'tv' : 'movie';
  const promessa = melhorMatch(titulo, tipo)
    .then((match) => posterUrl(match?.resultado.poster_path))
    .catch(() => null);

  capasEmMemoria.set(chave, promessa);
  return promessa;
}

/**
 * As fileiras da tela inicial, prontas para desenhar.
 *
 * O acervo tem trinta e quatro mil filmes e nenhuma data de entrada, então não
 * há como o site descobrir sozinho o que é novidade — e perguntar a capa de
 * cada título ao TMDB, a cada abertura, seria uma tela que demora para
 * aparecer. A conta é feita no repositório (`gerar_destaques.py`) e chega aqui
 * pronta: seis fileiras, cento e vinte títulos, sete quilobytes, com o caminho
 * do pôster junto.
 *
 * O formato de cada item é o mesmo de um resultado de busca — tipo, título,
 * letra, ano —, então abrir um destaque passa pelo caminho que já abre um
 * título procurado. É o mesmo arquivo que a TV Box, o Mac e o Windows leem.
 */
export interface ItemDestaque {
  /** 'f' filme, 's' série, 'a' anime, 'd' dorama. */
  tipo: string;
  titulo: string;
  letra: string;
  ano: string;
  /** Endereço inteiro da capa, ou vazio quando o gerador não achou uma. */
  capa: string;
}

export interface FilaDestaque {
  titulo: string;
  itens: ItemDestaque[];
}

let filasEmMemoria: FilaDestaque[] | null = null;

export async function destaques(): Promise<FilaDestaque[]> {
  if (filasEmMemoria) return filasEmMemoria;
  const texto = await arquivo('destaques.txt');
  if (!texto) return [];

  const filas: FilaDestaque[] = [];
  let titulo: string | null = null;
  let itens: ItemDestaque[] = [];
  let base = '';

  const fechar = () => {
    if (titulo && itens.length) filas.push({ titulo, itens });
    itens = [];
  };

  for (const linha of texto.split('\n')) {
    if (!linha.trim() || linha.startsWith('#')) continue;
    if (linha.startsWith('capa:')) { base = linha.slice('capa:'.length).trim(); continue; }
    if (linha.startsWith('fila\t')) { fechar(); titulo = linha.slice('fila\t'.length).trim(); continue; }
    const campos = linha.split('\t');
    if (campos.length < 3) continue;
    const poster = campos[4] ?? '';
    itens.push({
      tipo: campos[0]?.charAt(0) || 'f',
      titulo: campos[1],
      letra: campos[2],
      ano: campos[3] ?? '',
      capa: poster ? base + poster : '',
    });
  }
  fechar();
  filasEmMemoria = filas;
  return filas;
}

/**
 * O gênero de cada título: Ação, Terror, Animação, Comédia.
 *
 * O catálogo não tem gênero — as listas de origem trazem nome e endereço, nada
 * mais. Perguntar ao TMDB por trinta e quatro mil títulos, no navegador de cada
 * pessoa, é uma tela que nunca abre. A pergunta é feita uma vez no repositório
 * (`gerar_generos.py`) e chega aqui pronta, no mesmo arquivo que os aplicativos
 * leem.
 */
export interface Generos {
  /** "f|Nome" ou "s|Nome" -> os gêneros dele. */
  mapa: Map<string, string[]>;
  /** "f|Nome" ou "s|Nome" -> o endereço do pôster, quando o TMDB conhece. */
  capas: Map<string, string>;
  /**
   * "f|Nome" ou "s|Nome" -> o id do TMDB. Com ele, a ficha completa de um
   * título é um pedido só, sem busca por nome nem desempate.
   */
  ids: Map<string, number>;
  /**
   * O caminho inverso: id do TMDB -> título do acervo. É assim que a
   * filmografia de um ator vira uma lista clicável — só entra o que existe
   * aqui dentro. Série entra com o id negativo, para não colidir com o filme
   * de mesmo número.
   */
  porId: Map<number, string>;
  /** Todos os que aparecem no acervo, em ordem. */
  todos: string[];
}

let generosEmMemoria: Generos | null = null;

export async function generos(): Promise<Generos> {
  if (generosEmMemoria) return generosEmMemoria;
  const texto = await arquivo('fichas.txt');
  const mapa = new Map<string, string[]>();
  const capas = new Map<string, string>();
  const ids = new Map<string, number>();
  const porId = new Map<number, string>();
  const vistos = new Set<string>();
  let base = '';
  // tipo \t título \t id do TMDB \t pôster \t gêneros
  for (const linha of (texto ?? '').split('\n')) {
    if (!linha) continue;
    if (linha.startsWith('capa:')) { base = linha.slice('capa:'.length).trim(); continue; }
    if (linha.startsWith('#')) continue;
    const campos = linha.split('\t');
    if (campos.length < 5) continue;
    const chave = `${campos[0]}|${campos[1]}`;
    if (campos[3]) capas.set(chave, base + campos[3]);
    const id = Number(campos[2]);
    if (Number.isFinite(id) && id > 0) {
      ids.set(chave, id);
      const marca = campos[0] === 's' ? -id : id;
      // Um mesmo id pode aparecer duas vezes no acervo (o mesmo filme em duas
      // grafias); o primeiro basta.
      if (!porId.has(marca)) porId.set(marca, campos[1]);
    }
    const lista = campos[4].split(',').map((g) => g.trim()).filter(Boolean);
    if (!lista.length) continue;
    mapa.set(chave, lista);
    lista.forEach((g) => vistos.add(g));
  }
  generosEmMemoria = {
    mapa, capas, ids, porId,
    todos: [...vistos].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
  return generosEmMemoria;
}

/** O título sem o ano final, que é como a lista de gêneros o guarda. */
export function semAno(titulo: string): string {
  return titulo.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}

/**
 * A chave é o nome como o acervo o escreve — e o acervo escreve o ano dentro do
 * nome do filme, mas guarda o da série num campo à parte. Quem chama nem sempre
 * sabe de qual dos dois veio, então procura-se o nome como ele chegou e, não
 * achando, sem o ano.
 */
/**
 * O pôster de um título, pelo id que o gerador já resolveu.
 *
 * Antes a capa era procurada pelo nome no TMDB, no navegador de cada pessoa:
 * lento, e errado quando dois filmes se chamam igual. Quem não tem ficha fica
 * sem capa, e a tela põe uma marca no lugar.
 */
export function capaDaFicha(g: Generos, titulo: string, serie: boolean): string | null {
  const marca = serie ? 's' : 'f';
  return g.capas.get(`${marca}|${titulo}`) ?? g.capas.get(`${marca}|${semAno(titulo)}`) ?? null;
}

/** O id do TMDB de um título, quando o gerador o resolveu. */
export function idDaFicha(g: Generos, titulo: string, serie: boolean): number | null {
  const marca = serie ? 's' : 'f';
  return g.ids.get(`${marca}|${titulo}`) ?? g.ids.get(`${marca}|${semAno(titulo)}`) ?? null;
}

/** O título do acervo que corresponde a um id do TMDB, se houver. */
export function tituloDoId(g: Generos, id: number, serie: boolean): string | null {
  return g.porId.get(serie ? -id : id) ?? null;
}

export function temGenero(g: Generos, titulo: string, serie: boolean, genero: string): boolean {
  if (!genero) return true;
  const marca = serie ? 's' : 'f';
  const lista = g.mapa.get(`${marca}|${titulo}`) ?? g.mapa.get(`${marca}|${semAno(titulo)}`) ?? [];
  return lista.includes(genero);
}
