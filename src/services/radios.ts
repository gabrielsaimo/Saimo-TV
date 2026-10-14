/**
 * A lista de rádios: `vod/radios.txt` do SaimoPlayer, uma por linha,
 * `nome|endereço|logo` (o logo é opcional). Porte de `Radios.kt`.
 *
 * A última lista baixada fica em disco para a tela abrir na hora, e a do
 * repositório é buscada por trás.
 */
export interface Radio {
  nome: string;
  url: string;
  logo?: string;
}

export interface Estilo {
  titulo: string;
  palavras: string[];
}

const URL_LISTA = 'https://raw.githubusercontent.com/gabrielsaimo/SaimoPlayer/main/vod/radios.txt';
const GUARDADA = 'saimo-radios-lista';
const RECENTES = 'saimo-radios-recentes';

/** A ordem conta: rádio que cabe em dois estilos fica no primeiro. */
export const ESTILOS: Estilo[] = [
  { titulo: 'Rock', palavras: ['rock', 'metal', 'kiss', 'punk'] },
  { titulo: 'Notícias', palavras: ['news', 'noticia', 'cbn', 'gaucha', 'itatiaia', 'tupi', 'esporte', 'jornal',
    'bandnews', 'radio globo', 'eldorado', 'bandeirantes'] },
  { titulo: 'Gospel', palavras: ['gospel', 'evangel', 'catolic', 'crista', 'louvor', 'aleluia', 'cancao nova',
    'novo tempo', 'aparecida', 'fe ', 'deus', 'jesus', 'igreja', 'biblia'] },
  { titulo: 'Pop', palavras: ['pop', 'hits', 'dance', 'mix', 'jovem pan', 'transamerica', 'energia', 'eletro',
    'club', 'pulse', 'top'] },
  { titulo: 'Brasileiras', palavras: ['sertanej', 'mpb', 'samba', 'pagode', 'forro', 'nativa', 'caipira', 'brega',
    'axe', 'piseiro', 'moda de viola'] },
  { titulo: 'Clássica e jazz', palavras: ['classic', 'jazz', 'cultura', 'educativa', 'universit', 'instrumental',
    'blues', 'lounge'] },
];

/** Nome sem acento e em minúsculas, para achar o estilo. */
export const chave = (nome: string) =>
  nome.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

export function estiloDe(radio: Radio): Estilo | null {
  const nome = chave(radio.nome) + ' ';
  return ESTILOS.find((e) => e.palavras.some((p) => nome.includes(p))) ?? null;
}

function ler(texto: string): Radio[] {
  const vistas = new Set<string>();
  const saida: Radio[] = [];
  for (const linha of texto.split('\n')) {
    const partes = linha.split('|');
    const nome = (partes[0] ?? '').trim();
    const url = (partes[1] ?? '').trim();
    if (!nome || !url.startsWith('http') || vistas.has(nome)) continue;
    vistas.add(nome);
    const logo = (partes[2] ?? '').trim();
    saida.push({ nome, url, logo: logo.startsWith('http') ? logo : undefined });
  }
  return saida;
}

/** O que já está no aparelho: a última lista baixada. Rápido, sem rede. */
export function locais(): Radio[] {
  try {
    const texto = localStorage.getItem(GUARDADA);
    return texto ? ler(texto) : [];
  } catch {
    return [];
  }
}

/** A lista do repositório, guardada para a próxima vez. Nula se a rede falhou. */
export async function baixar(): Promise<Radio[] | null> {
  try {
    const r = await fetch(URL_LISTA);
    if (!r.ok) return null;
    const texto = await r.text();
    const lista = ler(texto);
    if (lista.length < 10) return null;
    try { localStorage.setItem(GUARDADA, texto); } catch { /* disco cheio: segue sem guardar */ }
    return lista;
  } catch {
    return null;
  }
}

/** Nomes das rádios ouvidas, da mais recente para a mais antiga. */
export function recentes(): string[] {
  try {
    const lista = JSON.parse(localStorage.getItem(RECENTES) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function ouviu(nome: string): void {
  const nova = [nome, ...recentes().filter((n) => n !== nome)].slice(0, 12);
  localStorage.setItem(RECENTES, JSON.stringify(nova));
}
