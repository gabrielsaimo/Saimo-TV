/**
 * Normalização de nome de canal, igual à do aplicativo.
 *
 * As três procedências escrevem o mesmo canal de jeitos diferentes — "SporTV 2",
 * "SPORTV2 HD", "BR - SporTV 2" — e casá-los é o que decide se o guia encontra a
 * programação. Vive num arquivo próprio porque o serviço do guia roda dentro de
 * um Worker, e importá-la do catálogo arrastaria as dezesseis mil linhas da
 * lista compilada para dentro dele.
 */

const NOISE = new Set(['hd', 'sd', 'fhd', 'uhd', '4k', 'br']);

export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function normalise(text: string): string {
  const tokens = decodeEntities(text)
    // Os feeds prefixam o país: "BR - SporTV 2".
    .replace(/^[A-Z]{2}\s*[-|]\s*/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (tokens.length > 1 && NOISE.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ');
}
