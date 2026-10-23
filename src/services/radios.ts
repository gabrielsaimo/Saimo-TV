/**
 * A lista de rádios: `vod/radios.txt` do SaimoPlayer, uma por linha,
 * `nome|endereço|logo` (o logo é opcional). Porte de `Radios.kt`.
 *
 * A última lista baixada fica em disco para a tela abrir na hora, e a do
 * repositório é buscada por trás.
 */
import { linkCanais } from './listas';

export interface Radio {
  nome: string;
  url: string;
  logo?: string;
}

const GUARDADA = 'saimo-radios-lista';
const RECENTES = 'saimo-radios-recentes';

/** Nome sem acento e em minúsculas, para a busca. */
export const chave = (nome: string) =>
  nome.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

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

/**
 * O que já está no aparelho: a última lista baixada do endereço atual (a
 * primeira linha guardada diz de qual endereço veio). Rápido, sem rede.
 */
export function locais(): Radio[] {
  const base = linkCanais();
  if (!base) return [];
  try {
    const guardado = localStorage.getItem(GUARDADA);
    if (!guardado) return [];
    const corte = guardado.indexOf('\n');
    return guardado.slice(0, corte) === base ? ler(guardado.slice(corte + 1)) : [];
  } catch {
    return [];
  }
}

/** A lista do repositório, guardada para a próxima vez. Nula se a rede falhou. */
export async function baixar(): Promise<Radio[] | null> {
  const base = linkCanais();
  if (!base) return null;
  try {
    const r = await fetch(`${base}radios.txt`);
    if (!r.ok) return null;
    const texto = await r.text();
    const lista = ler(texto);
    if (lista.length < 10 || linkCanais() !== base) return null;
    try { localStorage.setItem(GUARDADA, `${base}\n${texto}`); } catch { /* disco cheio: segue sem guardar */ }
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
