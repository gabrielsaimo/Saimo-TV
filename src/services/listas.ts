/**
 * Os dois endereços de onde o site lê tudo o que não é dele: a lista de canais
 * e a de filmes e séries. Já vêm preenchidos (as duas constantes abaixo, o único
 * lugar do site com endereço de lista), e a pessoa pode trocá-los, desligá-los
 * ou restaurá-los em Ajustes > Listas.
 *
 *   linkCanais  catalogo.txt, canais.txt, restritos.txt, radios.txt, guia.txt
 *   linkFilmes  a pasta vod/: indice.txt, filmes-A.txt, imdb/…, novidades.json
 *
 * No armazenamento do navegador: valor ausente = padrão; texto vazio guardado
 * = lista desligada de propósito (estado vazio, nenhum pedido de rede).
 */
import { useSyncExternalStore } from 'react';
import { normalizarEndereco, resolverEndereco } from '../utils/enderecoLista';

export { normalizarEndereco };

/** Endereços padrão: as únicas listas conhecidas do site. */
export const PADRAO: Record<'canais' | 'filmes', string> = {
  canais: 'https://canais-saimo.pages.dev/',
  filmes: 'https://filmes-saimo.pages.dev/',
};

const CHAVE_CANAIS = 'saimo-link-canais';
const CHAVE_FILMES = 'saimo-link-filmes';
const CHAVE_MIGRADO = 'saimo-sem-listas-v1';
const EVENTO = 'saimo-listas-mudaram';

export type Lista = 'canais' | 'filmes';

/** Arquivo que prova que o endereço é de uma lista de verdade. */
const ARQUIVO_DE_TESTE: Record<Lista, string> = { canais: 'catalogo.txt', filmes: 'indice.txt' };

function ler(chave: string, padrao: string): string {
  try { return resolverEndereco(localStorage.getItem(chave), padrao); } catch { return padrao; }
}

// Sem localStorage (aba privada estrita) o endereço vale só até recarregar.
const memoria: Record<Lista, string> = { ...PADRAO };
let lidoDoDisco = false;

function carregar(): void {
  if (lidoDoDisco) return;
  lidoDoDisco = true;
  memoria.canais = ler(CHAVE_CANAIS, PADRAO.canais);
  memoria.filmes = ler(CHAVE_FILMES, PADRAO.filmes);
}

/** Endereço-base da lista de canais, com barra no fim; `''` se não houver. */
export function linkCanais(): string { carregar(); return memoria.canais; }
/** Endereço-base da lista de filmes e séries, com barra no fim; `''` se não houver. */
export function linkFilmes(): string { carregar(); return memoria.filmes; }

export function definirLink(lista: Lista, endereco: string): void {
  carregar();
  const chave = lista === 'canais' ? CHAVE_CANAIS : CHAVE_FILMES;
  memoria[lista] = endereco;
  // Vazio é guardado como vazio: a lista fica desligada, não volta ao padrão.
  try { localStorage.setItem(chave, endereco); } catch { /* segue só na memória desta visita */ }
  window.dispatchEvent(new Event(EVENTO));
}

/** Volta uma lista ao endereço padrão. */
export function restaurarPadrao(lista: Lista): void {
  carregar();
  memoria[lista] = PADRAO[lista];
  try { localStorage.removeItem(lista === 'canais' ? CHAVE_CANAIS : CHAVE_FILMES); } catch { /* só memória */ }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(aviso: () => void): () => void {
  window.addEventListener(EVENTO, aviso);
  return () => window.removeEventListener(EVENTO, aviso);
}

/** Os dois endereços como texto único, para o React comparar por valor. */
const instantaneo = () => `${linkCanais()}\n${linkFilmes()}`;

/** Re-renderiza a tela quando um dos endereços muda. */
export function useListas(): { canais: string; filmes: string } {
  const valor = useSyncExternalStore(assinar, instantaneo, () => `${PADRAO.canais}\n${PADRAO.filmes}`);
  const [canais, filmes] = valor.split('\n');
  return { canais, filmes };
}

/** `GET <base><arquivo>` deve dar 200. Qualquer falha (rede, CORS, 404) é "não abriu". */
export async function testarEndereco(lista: Lista, base: string): Promise<boolean> {
  const controle = new AbortController();
  const limite = window.setTimeout(() => controle.abort(), 12_000);
  try {
    const r = await fetch(`${base}${ARQUIVO_DE_TESTE[lista]}`, { cache: 'no-store', signal: controle.signal });
    return r.status === 200;
  } catch {
    return false;
  } finally {
    window.clearTimeout(limite);
  }
}

// ============================================================
// CACHES DE LISTAS
// ============================================================

/** Chaves do localStorage que guardam conteúdo de lista, por qual endereço. */
const CACHES_DE_CANAIS = [
  'saimo-catalogo-v2', 'saimo-guia-tabelas', 'saimo-restritos-v1',
  'saimo-epg-v3', 'saimo-epg-v4', 'saimo-epg-v5', 'saimo-epg-v6',
];
const CACHES_DE_RADIOS = ['saimo-radios-lista'];

function apagarChaves(chaves: string[]): void {
  for (const c of chaves) { try { localStorage.removeItem(c); } catch { /* nada a apagar */ } }
}

/** Apaga o que foi guardado de uma lista, ao trocar ou tirar o endereço. */
export function apagarDadosDa(lista: Lista): void {
  if (lista === 'canais') apagarChaves([...CACHES_DE_CANAIS, ...CACHES_DE_RADIOS]);
}

/**
 * Primeira execução desta versão: esquece o que as versões anteriores
 * guardaram (catálogo, rádios, guia, fichas) em localStorage e Cache Storage.
 * Favoritos, progresso e ajustes ficam. Roda uma vez, marcada em disco.
 */
export function migrarUmaVez(): void {
  try {
    if (localStorage.getItem(CHAVE_MIGRADO)) return;
  } catch { return; }
  apagarChaves([...CACHES_DE_CANAIS, ...CACHES_DE_RADIOS]);
  try {
    // O site não usa IndexedDB para listas; só a casca do app fica no Cache Storage.
    if ('caches' in window) {
      void caches.keys().then((nomes) => Promise.all(
        nomes.filter((n) => !n.startsWith('saimo-casca')).map((n) => caches.delete(n)),
      ));
    }
  } catch { /* sem Cache Storage */ }
  try { localStorage.setItem(CHAVE_MIGRADO, '1'); } catch { /* tenta de novo na próxima */ }
}
