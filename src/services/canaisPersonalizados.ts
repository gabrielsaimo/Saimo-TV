/**
 * Canais personalizados importados pelo usuário (M3U ou TXT).
 *
 * Salva no localStorage e se mistura à lista principal sem precisar de servidor.
 * Permite também exportar a lista ou os favoritos em formato .m3u padrão.
 */
import type { Channel, ChannelSource } from '../types/channel';
import { parseCatalog } from './catalogService';

const CHAVE = 'saimo-canais-personalizados';
const EVENTO = 'saimo-canais-personalizados-mudou';

function ler(): Channel[] {
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Channel[]) : [];
  } catch {
    return [];
  }
}

export function locais(): Channel[] {
  return ler();
}

export function salvar(canais: Channel[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(canais));
    window.dispatchEvent(new Event(EVENTO));
  } catch (err) {
    console.error('Falha ao salvar canais personalizados:', err);
  }
}

export function limpar(): void {
  localStorage.removeItem(CHAVE);
  window.dispatchEvent(new Event(EVENTO));
}

/** Importa texto M3U ou catalogo.txt e devolve a quantidade de canais adicionados. */
export function importar(texto: string): number {
  const parsed = parseCatalog(texto);
  if (!parsed.length) return 0;

  const novos: Channel[] = parsed.map((c, i) => {
    const sources: ChannelSource[] = c.sources.map((s) => ({
      url: s.url,
      name: s.name,
      quality: s.quality,
      referer: s.referer,
      userAgent: s.userAgent,
      keyId: s.keyId,
      key: s.key,
    }));
    return {
      id: `custom-${Date.now()}-${i}-${c.name.replace(/\s+/g, '-').toLowerCase()}`,
      name: c.name,
      url: sources[0]?.url || '',
      logo: c.logo || '',
      category: c.group || 'Personalizados',
      sources,
    };
  });

  const existentes = ler();
  const combinados = [...existentes, ...novos];
  salvar(combinados);
  return novos.length;
}

/** Exporta canais em formato M3U padrão para download. */
export function exportarM3U(canais: Channel[], nomeArquivo = 'saimo-tv-canais.m3u'): void {
  let m3u = '#EXTM3U\n';
  for (const c of canais) {
    const cat = c.category || 'Geral';
    const logo = c.logo ? ` tvg-logo="${c.logo}"` : '';
    m3u += `#EXTINF:-1 tvg-id="${c.id}" tvg-name="${c.name}"${logo} group-title="${cat}",${c.name}\n${c.url}\n`;
  }
  const blob = new Blob([m3u], { type: 'audio/x-mpegurl;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Notifica quando os canais personalizados mudam. */
export function aoMudar(fn: () => void): () => void {
  const porStorage = (e: StorageEvent) => {
    if (e.key === CHAVE) fn();
  };
  window.addEventListener(EVENTO, fn);
  window.addEventListener('storage', porStorage);
  return () => {
    window.removeEventListener(EVENTO, fn);
    window.removeEventListener('storage', porStorage);
  };
}
