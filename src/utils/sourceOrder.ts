/** HTTPS primeiro, preservando a preferência publicada dentro de cada grupo.
 * Não altera URLs, metadados nem o catálogo original.
 */
export function httpsFirst<T extends { url: string }>(sources: readonly T[]): T[] {
  const secure: T[] = [];
  const other: T[] = [];
  for (const source of sources) {
    (/^https:\/\//i.test(source.url.trim()) ? secure : other).push(source);
  }
  return [...secure, ...other];
}

/** Uma escolha explícita do usuário não muda a ordem exibida das fontes. */
export function initialSourceIndex(sources: readonly { url: string }[], selected?: string): number {
  return Math.max(0, sources.findIndex(source => source.url === selected));
}
