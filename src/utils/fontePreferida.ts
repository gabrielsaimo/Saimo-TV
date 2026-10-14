/**
 * Fonte preferida numa série: ao trocar de episódio (automático, botão
 * Próximo ou escolhendo outro da mesma série), mantém a fonte que a pessoa
 * estava usando. Cada episódio tem a própria lista, às vezes em outra ordem.
 */

function hostDe(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase() : '';
}

/**
 * Posição, em `lista`, da fonte a usar no episódio novo.
 * 1) a primeira do mesmo host da fonte que estava tocando;
 * 2) a mesma posição, se existir;
 * 3) a ordem de hoje (posição 0).
 */
export function escolherFonte(
  lista: readonly string[],
  anterior: { url: string; indice: number } | null | undefined,
): number {
  if (!anterior || lista.length === 0) return 0;
  const host = hostDe(anterior.url);
  if (host) {
    const i = lista.findIndex((u) => hostDe(u) === host);
    if (i >= 0) return i;
  }
  return anterior.indice >= 0 && anterior.indice < lista.length ? anterior.indice : 0;
}

// Só nesta sessão, em memória, e de uma série por vez.
let memoria: { serieId: string; url: string; indice: number } | null = null;

/** Guarda a fonte que está de fato tocando na série. */
export function lembrarFonte(serieId: string | undefined, url: string | undefined, indice: number): void {
  if (!serieId || !url) return;
  memoria = { serieId, url, indice };
}

/** Posição preferida para a lista do episódio da série; 0 se nada foi guardado. */
export function fontePreferida(serieId: string | undefined, lista: readonly string[]): number {
  if (!serieId || !memoria || memoria.serieId !== serieId) return 0;
  return escolherFonte(lista, memoria);
}
