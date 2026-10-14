/**
 * A agenda de jogos para o site. A embedtv não manda o cabeçalho de CORS, então
 * a busca passa por aqui. Quando ela não responde (acontece), devolve a lista
 * do monitor, que tem os jogos dos canais de streaming e dos canais comuns:
 * a tela de Eventos não fica vazia por causa de uma fonte fora do ar.
 */
const EMBED = 'https://embedtv.cc/api/events';
const MONITOR = 'https://saimo-monitor.gabrielsaimo68.workers.dev/v1/eventos';
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function buscar(url: string, prazoMs: number): Promise<string | null> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), prazoMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: controle.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(relogio);
  }
}

export const onRequest: PagesFunction = async () => {
  const cabecalhos = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60',
  };
  // As duas juntas: o monitor responde em segundos, a embedtv tem prazo de 5 s.
  const [embed, monitor] = await Promise.all([buscar(EMBED, 5000), buscar(MONITOR, 8000)]);
  const corpo = embed ?? monitor;
  if (corpo) return new Response(corpo, { headers: cabecalhos });
  return new Response(JSON.stringify({ error: 'sem agenda' }), {
    status: 502,
    headers: { ...cabecalhos, 'Cache-Control': 'no-store' },
  });
};
