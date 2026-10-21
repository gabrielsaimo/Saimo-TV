/**
 * Contagem de quem está online, por dispositivo (substitui o monitor antigo, desligado).
 *
 * Os apps só chamam aqui se estiverem na amostra (FNV-1a do id; percentual em /telemetria.json),
 * com uma batida a cada 10 minutos. Quem conta é o Worker `saimo-online` (Durable Object só em
 * memória, sem banco), ligado a este projeto pela binding ONLINE. Sem a binding, responde do mesmo
 * jeito para os apps seguirem normais, e nada é contado.
 */
interface Env {
  ONLINE?: { fetch: (req: Request) => Promise<Response> };
}

const PLATAFORMAS = ['site', 'tvbox', 'cell', 'mac', 'windows', 'tizen', 'webos'];
const PCT: Record<string, number> = { mac: 100 };
const PCT_GERAL = 2;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };

function pctDe(p: string): number {
  return PCT[p] ?? PCT_GERAL;
}

function amostrado(id: string, p: string): boolean {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(id.toLowerCase())) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 10000 < pctDe(p) * 100;
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  const rota = url.pathname.replace(/^\/api\/online/, '') || '/';
  // Painel e números: só pelo Worker.
  if (rota === '/painel' || rota === '/v1/agora') {
    if (!env.ONLINE) return new Response('Contador ainda não ligado', { status: 503 });
    return env.ONLINE.fetch(new Request(`https://online${rota}${url.search}`, request));
  }
  if (request.method !== 'POST') return new Response('Não encontrado', { status: 404 });
  if (rota === '/v1/event') return new Response(null, { status: 204, headers: cors });
  if (rota !== '/v1/hello' && rota !== '/v1/beat') return new Response('Não encontrado', { status: 404 });

  let corpo: { deviceId?: string; platform?: string } = {};
  try { corpo = JSON.parse(await request.text()); } catch { /* corpo vazio */ }
  const id = String(corpo.deviceId || '').toLowerCase();
  const plataforma = String(corpo.platform || '');
  if (!id || !PLATAFORMAS.includes(plataforma)) return new Response(JSON.stringify({ error: 'dados' }), { status: 400, headers: cors });
  const dentro = amostrado(id, plataforma);
  if (dentro && env.ONLINE) {
    try {
      await env.ONLINE.fetch(new Request('https://online/v1/marcar', {
        method: 'POST', body: JSON.stringify({ id, plataforma }),
      }));
    } catch { /* a contagem nunca derruba o app */ }
  }
  if (rota === '/v1/beat') return new Response(null, { status: 204, headers: cors });
  return new Response(JSON.stringify({
    heartbeatSeconds: dentro ? 600 : 3600, amostra: dentro, amostraPct: pctDe(plataforma),
    serverTime: Math.floor(Date.now() / 1000),
  }), { headers: { 'content-type': 'application/json', ...cors } });
};
