/**
 * Atalhos curtos de download (/tvbox, /celular, /mac, /windows) para digitar
 * na TV. O destino sai do versao.json publicado, para o site não carregar o
 * nome do dono nem do repositório; só segue link de release do GitHub.
 */
const VERSAO = 'https://saimo-canais.pages.dev/versao.json';

export function atalho(plataforma: string) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    const volta = Response.redirect(new URL('/app', request.url).toString(), 302);
    try {
      const r = await fetch(VERSAO, { cf: { cacheTtl: 60 } } as RequestInit);
      if (!r.ok) return volta;
      const dados = await r.json() as { arquivos?: Record<string, { url?: string }> };
      const url = dados.arquivos?.[plataforma]?.url;
      if (!url) return volta;
      const u = new URL(url);
      if (u.protocol !== 'https:' || u.hostname !== 'github.com'
        || !/^\/[^/]+\/[^/]+\/releases\/download\/.+/.test(u.pathname)) return volta;
      return Response.redirect(u.toString(), 302);
    } catch {
      return volta;
    }
  };
}
