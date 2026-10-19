import type { MovieSource } from '../types/movie';
import { httpsFirst } from './sourceOrder';
import { proxyBase } from './streamUrl';

function isAllowedTargetHost(hostname: string): boolean {
  return (
    hostname === 'dark-glade-b156.aa4f20382505.workers.dev' ||
    hostname === 'www-fontedecanais-live.77zzhf54vdll71.com' ||
    hostname.endsWith('.77zzhf54vdll71.com')
  );
}

/** Resolve ao abrir o título: URLs assinadas não ficam gravadas no catálogo. */
export async function resolveVodSources(sources: MovieSource[], signal: AbortSignal): Promise<MovieSource[]> {
  const candidates = sources.filter(source => {
    try {
      const url = new URL(source.url);
      if (url.protocol === 'http:' && url.hostname === 'dbonline.tech-cdn.top') return true;
      if (['http:', 'https:'].includes(url.protocol) && url.hostname === 'hubby-dmca.com') return true;
      return false;
    } catch { return false; }
  }).slice(0, 3);
  const resolvedPairs = await Promise.all(candidates.map(async source => {
    try {
      const response = await fetch(`${proxyBase()}/api/resolve-vod?url=${encodeURIComponent(source.url)}`, { signal });
      if (!response.ok) return null;
      const data = await response.json();
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || !isAllowedTargetHost(url.hostname)) return null;
      return { original: source.url, resolved: { ...source, url: url.href, originalUrl: source.url } as MovieSource };
    } catch { return null; }
  }));
  const resolvedHubbyOriginals = new Set<string>();
  const resolved: MovieSource[] = [];
  for (const pair of resolvedPairs) {
    if (!pair) continue;
    resolved.push(pair.resolved);
    try {
      if (new URL(pair.original).hostname === 'hubby-dmca.com') {
        resolvedHubbyOriginals.add(pair.original);
      }
    } catch { /* ignore */ }
  }
  const remaining = sources.filter(s => !resolvedHubbyOriginals.has(s.url));
  const seen = new Set<string>();
  return httpsFirst([...resolved, ...remaining]).filter(source => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}
