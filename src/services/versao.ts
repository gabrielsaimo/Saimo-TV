/**
 * A versão publicada e os links de download dos apps, lidos do `versao.json`
 * do endereço de canais. O site não sabe em que GitHub os arquivos moram: só
 * aceita link de download do próprio GitHub (https, github.com,
 * /<dono>/<repo>/releases/download/…) vindo desse arquivo.
 */
import { CANAIS } from './enderecos';

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
    pendente = fetch(`${CANAIS}versao.json`, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(lerVersao)
      .catch(() => null)
      .then(v => { if (!v) pendente = null; return v; });
  }
  return pendente;
}
