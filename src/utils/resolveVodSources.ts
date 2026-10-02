import type { MovieSource } from '../types/movie';
import { httpsFirst } from './sourceOrder';

/** Resolve ao abrir o título: URLs assinadas não ficam gravadas no catálogo. */
export async function resolveVodSources(sources: MovieSource[], signal: AbortSignal): Promise<MovieSource[]> {
  const candidates = sources.filter(source => {
    try {
      const url = new URL(source.url);
      return url.protocol === 'http:' && url.hostname === 'dbonline.tech-cdn.top';
    } catch { return false; }
  }).slice(0, 3);
  const resolved = await Promise.all(candidates.map(async source => {
    try {
      const response = await fetch(`/api/resolve-vod?url=${encodeURIComponent(source.url)}`, { signal });
      if (!response.ok) return [];
      const data = await response.json();
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'dark-glade-b156.aa4f20382505.workers.dev') return [];
      return [{ ...source, url: url.href }];
    } catch { return []; }
  }));
  const seen = new Set<string>();
  return httpsFirst([...resolved.flat(), ...sources]).filter(source => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}
