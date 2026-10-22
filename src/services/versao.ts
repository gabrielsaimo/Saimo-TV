/**
 * A versão publicada e os links de download dos apps.
 *
 * Os links não são escritos à mão: saem da última release do repositório
 * `SaimoTV/saimo-downloads`, pela lista de anexos que o GitHub devolve. Assim a
 * página /app e os atalhos (/tvbox, /celular, /mac…) acertam sozinhos quando o
 * release sobe outra versão ou muda de repositório — basta publicar os arquivos
 * com os nomes de sempre.
 *
 * O `versao.json` publicado continua sendo lido, porque é dele que vem o número
 * da versão e porque ele pode trazer alguma plataforma que o release não tem.
 * Quando os dois falam da mesma plataforma, vale o release: é o que existe de
 * verdade para baixar.
 */

export type Plataforma = 'tvbox' | 'celular' | 'mac' | 'windows' | 'tizen' | 'webos';

export interface ArquivoApp {
  nome: string;
  url: string;
  bytes: number;
}

export interface Versao {
  versao: string;
  arquivos: Partial<Record<Plataforma, ArquivoApp>>;
}

/** O repositório dos downloads — o único nome escrito no site. */
export const REPO_DOWNLOADS = 'SaimoTV/saimo-downloads';

/** versao.json publicado, com a versão e as notas do release. */
export const URL_VERSAO =
  'https://canais-saimo.pages.dev/versao.json';

/** Última release do repositório, com o nome e o endereço de cada anexo. */
export const URL_RELEASE = `https://api.github.com/repos/${REPO_DOWNLOADS}/releases/latest`;

const PLATAFORMAS: Plataforma[] = ['tvbox', 'celular', 'mac', 'windows', 'tizen', 'webos'];

/** Nome do anexo de cada plataforma dentro do release. */
const PLATAFORMA_DO_ARQUIVO: Record<string, Plataforma> = {
  'SaimoTV.apk': 'tvbox',
  'SaimoCell.apk': 'celular',
  'SaimoTV.dmg': 'mac',
  'SaimoTV-Windows.zip': 'windows',
  'SaimoTV-Samsung.wgt': 'tizen',
  'SaimoTV-LG.ipk': 'webos',
};

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

/** Lê os anexos da release e os traduz para as plataformas do site. */
export function lerRelease(dados: unknown): Versao | null {
  const d = dados as {
    tag_name?: unknown;
    assets?: { name?: unknown; browser_download_url?: unknown; size?: unknown }[];
  } | null;
  if (!d || !Array.isArray(d.assets)) return null;
  const arquivos: Versao['arquivos'] = {};
  for (const a of d.assets) {
    const plataforma = typeof a?.name === 'string' ? PLATAFORMA_DO_ARQUIVO[a.name] : undefined;
    if (!plataforma || !linkPermitido(a.browser_download_url)) continue;
    arquivos[plataforma] = { nome: a.name as string, url: a.browser_download_url, bytes: Number(a.size) || 0 };
  }
  return Object.keys(arquivos).length
    ? { versao: typeof d.tag_name === 'string' ? d.tag_name.replace(/^v/i, '') : '', arquivos }
    : null;
}

/**
 * Busca um JSON direto e, se o CORS atrapalhar, pelo proxy do próprio site.
 *
 * O github.com redireciona o download para outro host sem liberar CORS ao
 * navegador; a API do GitHub libera, mas tem limite de pedidos por IP, então o
 * proxy serve de segunda tentativa.
 */
function buscarJson(url: string): Promise<unknown> {
  const buscar = (alvo: string) =>
    fetch(alvo, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
  return buscar(url).catch(() => buscar(`/api/proxy?url=${encodeURIComponent(url)}`));
}

let pendente: Promise<Versao | null> | null = null;

/** Uma busca por sessão; falhou, a próxima chamada tenta de novo. */
export function buscarVersao(): Promise<Versao | null> {
  if (!pendente) {
    pendente = Promise.all([
      buscarJson(URL_RELEASE).then(lerRelease).catch(() => null),
      buscarJson(URL_VERSAO).then(lerVersao).catch(() => null),
    ])
      .then(([release, publicado]) => {
        // O release manda: é o que está publicado para baixar agora.
        const arquivos = { ...publicado?.arquivos, ...release?.arquivos };
        const versao = release?.versao || publicado?.versao || '';
        if (!versao && !Object.keys(arquivos).length) return null;
        return { versao, arquivos };
      })
      .then(v => { if (!v) pendente = null; return v; });
  }
  return pendente;
}
