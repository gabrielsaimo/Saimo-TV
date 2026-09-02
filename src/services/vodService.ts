/**
 * Filmes e séries, baixados por pedaço do mesmo repositório que o app lê.
 *
 * Porte de `Vod.kt`. A lista de origem tem trinta megabytes e trezentas mil
 * linhas, o que nenhum navegador de TV abre; ela já vem pré-digerida em um
 * catálogo fatiado por letra, com as séries ainda repartidas dentro da letra, de
 * modo que nenhum download passa de uns cem quilobytes. Como a tela também
 * navega por letra, o download acompanha o dedo em vez de contrariá-lo.
 *
 * As capas não existem na origem e vêm do Cinemeta, que é público, libera CORS e
 * não pede chave — a mesma fonte que o aplicativo usa.
 */

const BASE = 'https://raw.githubusercontent.com/gabrielsaimo/SaimoPlayer/main/vod/';
const CINEMETA = 'https://v3-cinemeta.strem.io/catalog';

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
        const urls = parte
          .slice(marca + 1)
          .split(',')
          .filter(Boolean)
          .map(montar)
          .filter(Boolean);
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
      const urls = campos[3].split(',').filter(Boolean).map(montar).filter(Boolean);
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

// ============================================================
// CAPAS
// ============================================================

const RUIDO = /\b(4k|uhd|fhd|hd|sd|h265|hevc|hdr|dv|dual|remux|legendado|dublado|leg|dub)\b/gi;
const COLCHETES = /\[[^\]]*]/g;
const PARENTESES_SEM_ANO = /\((?!(?:19|20)\d{2}\))[^)]*\)/g;

/** Mantém o ano: é ele que separa a capa de uma refilmagem da outra. */
export function limparTitulo(titulo: string): string {
  return titulo
    .replace(COLCHETES, ' ')
    .replace(PARENTESES_SEM_ANO, ' ')
    .replace(RUIDO, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/// Título -> capa. Vazio quer dizer procurado e não achado, e é guardado
/// também: sem isso a mesma busca infrutífera se repetiria a cada rolagem.
const capasEmMemoria = new Map<string, Promise<string | null>>();

export function capa(titulo: string, serieBool: boolean): Promise<string | null> {
  const chave = `${serieBool ? 's' : 'f'}:${titulo}`;
  const existente = capasEmMemoria.get(chave);
  if (existente) return existente;

  const busca = limparTitulo(titulo);
  if (busca.length < 2) return Promise.resolve(null);

  const tipo = serieBool ? 'series' : 'movie';
  const promessa = fetch(`${CINEMETA}/${tipo}/top/search=${encodeURIComponent(busca)}.json`)
    .then((r) => (r.ok ? r.json() : null))
    // Fica o primeiro resultado, sem conferir o nome: o índice conhece os
    // títulos em português — "A 13ª Emenda" é "13th" — e nenhuma comparação de
    // palavras aceitaria isso. O preço é uma capa errada de vez em quando.
    .then((json) => (json?.metas?.[0]?.poster as string | undefined) || null)
    .catch(() => null);

  capasEmMemoria.set(chave, promessa);
  return promessa;
}
