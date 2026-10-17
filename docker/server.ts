/**
 * Servidor do contêiner: entrega o `dist/` e as mesmas Pages Functions de
 * `/api/*` que rodam na Cloudflare, sem depender do wrangler.
 *
 * O site publicado é servido pelo Cloudflare Pages; aqui um único processo Bun
 * serve os arquivos estáticos e chama os handlers de `functions/api/` para as
 * rotas de API. Assim o contêiner reproduz o comportamento de produção —
 * inclusive as regras de `_redirects`.
 */
import { readFileSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequest as proxy } from '../functions/api/proxy.ts';
import { onRequestGet as resolverVod } from '../functions/api/resolve-vod.ts';
import { onRequest as eventos } from '../functions/api/events.ts';

// `events.ts` é tipado como PagesFunction, cuja assinatura é mais larga que a
// que os handlers realmente usam. A chamada é feita por aqui mesmo.
const chamar = (handler: unknown, request: Request) =>
  (handler as (ctx: { request: Request }) => Response | Promise<Response>)({ request });

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DIST = process.env.DIST_DIR ?? join(RAIZ, 'dist');
const PORTA = Number(process.env.PORT ?? 3000);

interface Regra {
  casar: (caminho: string) => string | null;
  status: number;
}

/** Lê as regras de `_redirects` (mesmo formato que o Cloudflare Pages usa). */
function lerRedirects(): Regra[] {
  let texto: string;
  try {
    texto = readFileSync(join(DIST, '_redirects'), 'utf8');
  } catch {
    return [];
  }
  const regras: Regra[] = [];
  for (const linha of texto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const [de, para, statusTexto] = limpa.split(/\s+/);
    if (!de || !para) continue;
    const status = statusTexto ? Number(statusTexto) : 302;
    if (de.endsWith('/*')) {
      const prefixo = de.slice(0, -1);
      regras.push({
        status,
        casar: (caminho) =>
          caminho.startsWith(prefixo) ? para.replace('*', caminho.slice(prefixo.length)) : null,
      });
    } else {
      regras.push({ status, casar: (caminho) => (caminho === de ? para : null) });
    }
  }
  return regras;
}

const REGRAS = lerRedirects();

/** Resolve um caminho da URL para um arquivo dentro de `dist/`, sem sair dele. */
function arquivoEstatico(caminho: string): string | null {
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(caminho);
  } catch {
    return null;
  }
  if (decodificado.includes('\0')) return null;
  const relativo = normalize(decodificado).replace(/^[\\/]+/, '');
  const alvo = relativo === '' || relativo.endsWith(sep) ? join(relativo, 'index.html') : relativo;
  const completo = join(DIST, alvo);
  if (completo !== DIST && !completo.startsWith(DIST + sep)) return null;
  return completo;
}

/** Entrega um arquivo de `dist/`, ou `null` quando não existe. */
function entregarEstatico(caminho: string): Response | null {
  const arquivo = arquivoEstatico(caminho);
  if (!arquivo) return null;
  try {
    if (!statSync(arquivo).isFile()) return null;
  } catch {
    return null;
  }
  return new Response(Bun.file(arquivo));
}

export function manipulador(request: Request): Response | Promise<Response> {
  const caminho = new URL(request.url).pathname;

  // As APIs vêm antes de tudo: nunca caem na regra `/*` do `_redirects`.
  if (caminho === '/api/proxy') return chamar(proxy, request);
  if (caminho === '/api/resolve-vod') return chamar(resolverVod, request);
  if (caminho === '/api/events') return chamar(eventos, request);

  const direto = entregarEstatico(caminho);
  if (direto) return direto;

  for (const regra of REGRAS) {
    const destino = regra.casar(caminho);
    if (destino === null) continue;
    if (regra.status >= 300 && regra.status < 400) {
      return new Response(null, { status: regra.status, headers: { Location: destino } });
    }
    const reescrito = entregarEstatico(destino);
    if (reescrito) return reescrito;
  }

  // Casca do app: qualquer rota desconhecida devolve o `index.html` (SPA).
  const casca = entregarEstatico('/index.html');
  if (casca) return casca;
  return new Response('index.html não encontrado: rode `bun run build` antes de subir.', {
    status: 500,
  });
}

const servidor = Bun.serve({
  port: PORTA,
  hostname: '0.0.0.0',
  fetch: manipulador,
});

console.log(`Saimo TV no ar em http://0.0.0.0:${servidor.port}`);
