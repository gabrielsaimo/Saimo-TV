/**
 * Normalização do endereço de uma lista, igual à dos outros apps Saimo.
 *
 * A pessoa digita ou cola o que tem: "meu-site.exemplo.com/listas", a pasta, ou até
 * o arquivo ("…/catalogo.txt"). O que o site guarda é sempre a pasta, com
 * barra no fim, para que o resto do código só concatene o nome do arquivo.
 */

/** Resultado: o endereço-base, `''` para "sem endereço" ou `null` para inválido. */
export function normalizarEndereco(bruto: string | null | undefined): string | null {
  let texto = (bruto ?? '').trim();
  if (!texto) return '';
  if (/\s/.test(texto)) return null;
  if (!texto.includes('://')) texto = `https://${texto}`;

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;

  let caminho = url.pathname;
  const ultimo = caminho.split('/').filter(Boolean).pop() ?? '';
  // Colou o arquivo, não a pasta: "…/listas/catalogo.txt" vira "…/listas/".
  if (ultimo.includes('.')) caminho = caminho.slice(0, caminho.lastIndexOf('/') + 1);
  if (!caminho.endsWith('/')) caminho += '/';

  return `${url.protocol}//${url.host}${caminho}`;
}

/**
 * O que vale a partir do valor guardado: ausente (`null`) usa o padrão; vazio
 * guardado de propósito desliga a lista; endereço válido vale; lixo volta ao padrão.
 */
export function resolverEndereco(guardado: string | null, padrao: string): string {
  if (guardado === null) return padrao;
  if (guardado.trim() === '') return '';
  return normalizarEndereco(guardado) || padrao;
}
