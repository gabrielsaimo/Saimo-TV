/**
 * Fonte preferida numa série: ao trocar de episódio (automático, botão
 * Próximo ou escolhendo outro da mesma série), mantém a fonte que a pessoa
 * estava usando. Cada episódio tem a própria lista, às vezes em outra ordem.
 * A versão de áudio (dublado/legendado) nunca muda: só concorrem as fontes
 * da mesma versão que estava tocando.
 */

export interface Fonte {
  url: string;
  /** "dub" ou "leg" — como vem do catálogo; ausente conta como dublado. */
  versao?: string;
}

/** O que estava tocando: endereço, versão e posição dentro da lista da versão. */
export interface FonteAnterior {
  url: string;
  versao: string;
  indiceNaVersao: number;
}

const versaoDe = (f: Fonte) => (f.versao === 'leg' ? 'leg' : 'dub');

function hostDe(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase() : '';
}

/**
 * Posição, em `lista`, da fonte a usar no episódio novo.
 * Só entram as fontes da versão que estava tocando (se o episódio não tiver
 * essa versão, vale a lista inteira). Entre elas:
 * 1) a primeira do mesmo host da fonte que estava tocando;
 * 2) a mesma posição dentro da versão, se existir;
 * 3) a ordem de hoje (a primeira).
 */
export function escolherFonte(lista: readonly Fonte[], anterior: FonteAnterior | null | undefined): number {
  if (!anterior || lista.length === 0) return 0;
  let candidatas = lista.map((_, i) => i).filter((i) => versaoDe(lista[i]) === anterior.versao);
  if (candidatas.length === 0) candidatas = lista.map((_, i) => i);
  const host = hostDe(anterior.url);
  if (host) {
    const i = candidatas.find((c) => hostDe(lista[c].url) === host);
    if (i !== undefined) return i;
  }
  const pos = anterior.indiceNaVersao;
  return pos >= 0 && pos < candidatas.length ? candidatas[pos] : candidatas[0];
}

// Só nesta sessão, em memória, e de uma série por vez.
let memoria: { serieId: string; anterior: FonteAnterior } | null = null;

/** Guarda a fonte que está de fato tocando (posição `indice` de `lista`). */
export function lembrarFonte(serieId: string | undefined, lista: readonly Fonte[], indice: number): void {
  const f = lista[indice];
  if (!serieId || !f) return;
  const versao = versaoDe(f);
  const indiceNaVersao = lista.slice(0, indice).filter((x) => versaoDe(x) === versao).length;
  memoria = { serieId, anterior: { url: f.url, versao, indiceNaVersao } };
}

/** Posição preferida para a lista do episódio da série; 0 se nada foi guardado. */
export function fontePreferida(serieId: string | undefined, lista: readonly Fonte[]): number {
  if (!serieId || !memoria || memoria.serieId !== serieId) return 0;
  return escolherFonte(lista, memoria.anterior);
}
