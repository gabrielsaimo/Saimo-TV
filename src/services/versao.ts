/**
 * A versão publicada e os links de download dos apps, lidos do `versao.json`
 * da última release. Esse é o único endereço fixo; os links de download vêm de
 * dentro dele, e o site só os aceita se forem do próprio GitHub (https,
 * github.com, /<dono>/<repo>/releases/download/…).
 */

export type Plataforma = 'tvbox' | 'celular' | 'mac' | 'windows';

export interface ArquivoApp {
  nome: string;
  url: string;
  bytes: number;
}

export interface Versao {
  versao: string;
  arquivos: Partial<Record<Plataforma, ArquivoApp>>;
}

/** Endereço único e fixo do arquivo de versão. */
export const URL_VERSAO =
  'https://canais-saimo.pages.dev/versao.json';

const PLATAFORMAS: Plataforma[] = ['tvbox', 'celular', 'mac', 'windows'];

/** Só vale link https de release do GitHub; qualquer outro é ignorado. */
export function linkPermitido(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'github.com'
      && /^\/[^/]+\/[^/]+\/releases\/download\/.+/.test(u.pathname);
  } catch {
    return false;
  }
}

export function lerVersao(dados: unknown): Versao | null {
  const d = dados as { versao?: unknown; arquivos?: Record<string, { nome?: unknown; url?: unknown; bytes?: unknown }> } | null;
  if (!d || typeof d.versao !== 'string' || !d.arquivos) return null;
  const arquivos: Versao['arquivos'] = {};
  for (const p of PLATAFORMAS) {
    const a = d.arquivos[p];
    if (a && linkPermitido(a.url)) {
      arquivos[p] = { nome: typeof a.nome === 'string' ? a.nome : '', url: a.url, bytes: Number(a.bytes) || 0 };
    }
  }
  return { versao: d.versao.replace(/^v/i, ''), arquivos };
}

let pendente: Promise<Versao | null> | null = null;

/** Uma busca por sessão; falhou, a próxima chamada tenta de novo. */
export function buscarVersao(): Promise<Versao | null> {
  if (!pendente) {
    // O github.com redireciona o download para outro host sem liberar CORS ao
    // navegador; se a busca direta falhar, o proxy do próprio site busca.
    const buscar = (url: string) => fetch(url, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
    pendente = buscar(URL_VERSAO)
      .catch(() => buscar(`/api/proxy?url=${encodeURIComponent(URL_VERSAO)}`))
      .then(lerVersao)
      .catch(() => null)
      .then(v => { if (!v) pendente = null; return v; });
  }
  return pendente;
}
