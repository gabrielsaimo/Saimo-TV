/** Endereço de uma página do app: limpo no site, com # no app de desktop. */
export function rota(caminho: string): string {
  return import.meta.env.BASE_URL === '/' ? caminho : `#${caminho}`;
}
