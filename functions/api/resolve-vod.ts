// Resolve apenas a origem conhecida; nunca funciona como proxy arbitrário.
const ORIGIN = 'dbonline.tech-cdn.top';
const TARGET = 'dark-glade-b156.aa4f20382505.workers.dev';

export function allowedVodUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return !u.username && !u.password && (!u.port || u.port === '80')
      && u.protocol === 'http:' && u.hostname === ORIGIN
      && /^\/(movie|series)\//.test(u.pathname);
  } catch { return false; }
}

export async function onRequestGet({ request }: { request: Request }): Promise<Response> {
  const reply = (url: string | null) => Response.json({ url }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
  const input = new URL(request.url).searchParams.get('url') ?? '';
  if (!allowedVodUrl(input)) return reply(null);
  const signal = AbortSignal.timeout(5000);
  try {
    // Não segue automaticamente redirecionamentos para destinos desconhecidos.
    const headers = { Range: 'bytes=0-31', 'User-Agent': 'Mozilla/5.0' };
    let current = input;
    let target: URL | null = null;
    for (let hop = 0; hop < 3; hop++) {
      const origin = await fetch(current, { headers, redirect: 'manual', signal });
      const location = origin.headers.get('Location');
      await origin.body?.cancel();
      if (origin.status < 300 || origin.status >= 400 || !location) return reply(null);
      const next = new URL(location, current);
      if (next.hostname === TARGET) { target = next; break; }
      // Intermediário observado nessa fonte. Não aceita outros hosts/portas.
      if (next.hostname !== 'zjo.lat' || next.username || next.password
        || (next.port && next.port !== '80') || !['http:', 'https:'].includes(next.protocol)
        || !/^\/(movie|series)\//.test(next.pathname)) return reply(null);
      current = next.href;
    }
    if (!target) return reply(null);
    if (target.hostname !== TARGET || target.username || target.password || target.port
      || !['http:', 'https:'].includes(target.protocol)
      || !target.pathname.startsWith('/t/')) return reply(null);
    target.protocol = 'https:';
    const media = await fetch(target.href, { headers, redirect: 'manual', signal });
    const reader = media.body?.getReader();
    if (!reader) return reply(null);
    const bytes: number[] = [];
    try {
      while (bytes.length < 12) {
        const part = await reader.read();
        if (part.done) break;
        bytes.push(...part.value.subarray(0, 12 - bytes.length));
      }
    } finally { await reader.cancel(); }
    const mp4 = String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
    return reply(media.ok && mp4 ? target.href : null);
  } catch { return reply(null); }
}
