/**
 * Atalhos curtos de download (/tvbox, /celular, /mac, /windows, /samsung, /lg)
 * para digitar na TV. O destino sai da última release de `SaimoTV/saimo-downloads`:
 * o site não precisa ser publicado de novo quando o release sobe outra versão.
 * Sem o anexo, o atalho devolve a página /app.
 */
const REPO = 'SaimoTV/saimo-downloads';
const RELEASE = `https://api.github.com/repos/${REPO}/releases/latest`;
const VERSAO = 'https://canais-saimo.pages.dev/versao.json';

/** Nome do anexo de cada plataforma dentro do release. */
const ARQUIVO: Record<string, string> = {
  tvbox: 'SaimoTV.apk',
  celular: 'SaimoCell.apk',
  mac: 'SaimoTV.dmg',
  windows: 'SaimoTV-Windows.zip',
  tizen: 'SaimoTV-Samsung.wgt',
  webos: 'SaimoTV-LG.ipk',
};

function linkDoGitHub(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'github.com'
      && /^\/[^/]+\/[^/]+\/releases\/download\/.+/.test(u.pathname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Endereço do anexo na última release (a lista de anexos é a fonte da verdade). */
async function doRelease(plataforma: string): Promise<string | null> {
  try {
    const r = await fetch(RELEASE, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'saimo-tv-site' },
      cf: { cacheTtl: 300 },
    } as RequestInit);
    if (!r.ok) return null;
    const dados = await r.json() as { assets?: { name?: string; browser_download_url?: string }[] };
    const nome = ARQUIVO[plataforma];
    const anexo = dados.assets?.find(a => a.name === nome);
    return linkDoGitHub(anexo?.browser_download_url);
  } catch {
    return null;
  }
}

/** Reserva: o que o versao.json publicado já aponta. */
async function doVersaoJson(plataforma: string): Promise<string | null> {
  try {
    const r = await fetch(VERSAO, { cf: { cacheTtl: 60 } } as RequestInit);
    if (!r.ok) return null;
    const dados = await r.json() as { arquivos?: Record<string, { url?: string }> };
    return linkDoGitHub(dados.arquivos?.[plataforma]?.url);
  } catch {
    return null;
  }
}

export function atalho(plataforma: string) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    const volta = Response.redirect(new URL('/app', request.url).toString(), 302);
    const url = (await doRelease(plataforma)) ?? (await doVersaoJson(plataforma));
    return url ? Response.redirect(url, 302) : volta;
  };
}
