/**
 * A grade de canais, baixada do mesmo repositório que o aplicativo Android lê.
 *
 * Porte de `Remote.kt`: o `catalogo.txt` manda — é ele que carrega a chave do
 * ClearKey, o Referer e o User-Agent, que um M3U não teria onde guardar — e o
 * `canais.txt` entra atrás como reserva, casando por nome. Assim um link
 * corrigido no repositório vale para o site e para o aparelho ao mesmo tempo,
 * sem publicar nada aqui.
 *
 * O que veio da última visita fica no localStorage e é o que abre a tela
 * enquanto a lista nova não chega, para que uma rede ruim não custe os canais.
 */

import type { Channel, ChannelSource } from '../types/channel';
import { channels as localChannels, adultChannels, categoryOrder } from '../data/channels';
import { restrictedChannels } from '../data/restrictedChannels';
import { normalise } from '../utils/nomes';

export { normalise };

const BASE = 'https://raw.githubusercontent.com/gabrielsaimo/SaimoPlayer/main/';
const CATALOG_URL = `${BASE}catalogo.txt`;
const EXTRAS_URL = `${BASE}canais.txt`;

const CACHE_KEY = 'saimo-catalogo-v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface ParsedChannel {
  name: string;
  logo?: string;
  group?: string;
  sources: ChannelSource[];
}

/** Uma linha `chave: valor` por campo; `canal:` abre um canal, `fonte:` acrescenta. */
export function parseCatalog(text: string): ParsedChannel[] {
  if (text.trimStart().startsWith('#EXTM3U')) return parseM3u(text);

  const out: ParsedChannel[] = [];
  let current: ParsedChannel | null = null;

  const flush = () => {
    if (current && current.sources.length > 0) out.push(current);
    current = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const field = line.substring(0, colon).toLowerCase();
    const value = line.substring(colon + 1).trim();
    if (!value) continue;

    switch (field) {
      case 'canal':
        flush();
        current = { name: value, sources: [] };
        break;
      case 'logo':
        if (current) current.logo = value;
        break;
      case 'fonte':
        if (current) current.sources.push({ url: value });
        break;
      case 'referer':
        if (current?.sources.length) current.sources[current.sources.length - 1].referer = value;
        break;
      case 'agente':
        if (current?.sources.length) current.sources[current.sources.length - 1].userAgent = value;
        break;
      case 'chave': {
        // KID:CHAVE. Sem os dois a licença não é montável, e uma fonte que
        // tocaria muda é pior que uma fonte a menos.
        if (!current?.sources.length) break;
        const parts = value.split(':');
        if (parts.length === 2 && parts.every((p) => p.trim())) {
          const source = current.sources[current.sources.length - 1];
          source.keyId = parts[0].trim();
          source.key = parts[1].trim();
        } else {
          current.sources.pop();
        }
        break;
      }
    }
  }
  flush();
  return out;
}

/** M3U dos extras: sem chave nem cabeçalho, mas com `group-title` para a categoria. */
export function parseM3u(text: string): ParsedChannel[] {
  const out = new Map<string, ParsedChannel>();
  let name: string | null = null;
  let logo: string | undefined;
  let group: string | undefined;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line === '#EXTM3U') continue;

    if (line.startsWith('#EXTINF:')) {
      const tvgId = line.match(/tvg-id="([^"]+)"/)?.[1]?.trim();
      logo = line.match(/tvg-logo="([^"]+)"/)?.[1];
      group = line.match(/group-title="([^"]+)"/)?.[1];

      let inQuotes = false;
      let commaIdx = -1;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        if (line[i] === ',' && !inQuotes) { commaIdx = i; break; }
      }
      const rawName = commaIdx !== -1
        ? line.substring(commaIdx + 1).trim()
        : line.substring(line.lastIndexOf(',') + 1).trim();
      // O sufixo entre parênteses identifica a origem ("(ST)", "(S79)"), não o
      // canal: mantê-lo faria o mesmo canal aparecer uma vez por servidor.
      name = tvgId || rawName.replace(/\s*\([^)]+\)$/, '').trim();
    } else if (!line.startsWith('#') && name) {
      const existing = out.get(name);
      if (existing) {
        existing.sources.push({ url: line });
        existing.logo = existing.logo || logo;
        existing.group = existing.group || group;
      } else {
        out.set(name, { name, logo, group, sources: [{ url: line }] });
      }
    }
  }
  return [...out.values()];
}

/**
 * Junta as duas listas: o catálogo manda, os extras entram atrás.
 *
 * Casando por nome, cada canal fica com as fontes do catálogo primeiro e as
 * publicadas logo depois, como reserva; o que só existe nos extras entra no fim,
 * como canal novo. Trocar uma lista pela outra apagaria chave e cabeçalhos.
 */
export function mergeCatalogs(base: ParsedChannel[], published: ParsedChannel[]): ParsedChannel[] {
  if (base.length === 0) return published;
  const extra = new Map(published.map((c) => [normalise(c.name), c]));
  const usados = new Set<string>();

  const merged = base.map((channel) => {
    const chave = normalise(channel.name);
    const vindas = extra.get(chave);
    if (!vindas) return channel;
    usados.add(chave);
    const conhecidas = new Set(channel.sources.map((s) => s.url));
    const novas = vindas.sources.filter((s) => !conhecidas.has(s.url));
    return {
      ...channel,
      group: channel.group || vindas.group,
      logo: channel.logo || vindas.logo,
      sources: novas.length ? [...channel.sources, ...novas] : channel.sources,
    };
  });

  return [...merged, ...published.filter((c) => !usados.has(normalise(c.name)))];
}

/** Categoria conhecida deste canal na lista local, casando pelo nome normalizado. */
const categoriaLocal = (() => {
  const mapa = new Map<string, string>();
  for (const c of [...localChannels, ...adultChannels, ...restrictedChannels]) {
    if (c.category) mapa.set(normalise(c.name), c.category);
  }
  return mapa;
})();

/**
 * Reduz qualquer rótulo de origem a uma das categorias que a barra lateral
 * ordena.
 *
 * As três procedências rotulam diferente a mesma prateleira — "FILMES E SÉRIES"
 * no `group-title`, "Canais | HBO" na lista antiga, nada no `catalogo.txt` — e
 * deixá-las passar cruas espalharia HBO, Telecine e Megapix por três seções que
 * o leitor lê como a mesma.
 */
function canonizar(rotulo: string): string | null {
  const n = normalise(rotulo).replace(/^canais /, '');
  if (!n) return null;
  if (/(esporte|espn|premiere|sportv|combate|ppv|dazn|nba|futsal|campeonato|jogos)/.test(n)) return 'Esportes';
  if (/(filme|serie|hbo|telecine|max|paramount|disney|prime video|apple tv|cinema)/.test(n)) return 'Filmes';
  if (/(infanti|kids|desenho)/.test(n)) return 'Infantil';
  if (/(document)/.test(n)) return 'Documentarios';
  if (/(notic|news)/.test(n)) return 'Noticias';
  if (/(novela)/.test(n)) return 'Series';
  if (/(aberto|globos|tv aberta)/.test(n)) return 'TV Aberta';
  if (/(adulto)/.test(n)) return 'Adulto';
  if (/(internacion|legendado)/.test(n)) return 'Internacionais';
  if (/(variedade|estilo de vida|entretenimento|religios|24 horas|4k)/.test(n)) return 'Entretenimento';
  return null;
}

/** Palavras do próprio nome, quando não há grupo nem canal local que sirva. */
function categoriaPeloNome(name: string): string {
  const n = normalise(name);
  if (/(premiere|sportv|espn|combate|band sports|nsports|cazetv|tnt sports)/.test(n)) return 'Esportes';
  if (/(telecine|hbo|megapix|cinemax|paramount|space|tnt|amc|studio universal|sony movies)/.test(n)) return 'Filmes';
  if (/(cartoon|gloob|nick|discovery kids|boomerang|tooncast|infantil|kids)/.test(n)) return 'Infantil';
  if (/(discovery|history|animal planet|nat geo|investigacao|h2|a e)/.test(n)) return 'Documentarios';
  if (/(news|globonews|cnn|record news|jovem pan|bandnews)/.test(n)) return 'Noticias';
  if (/(globo|sbt|record|band|rede tv|tv brasil|cultura)/.test(n)) return 'TV Aberta';
  return 'Entretenimento';
}

function slugify(name: string): string {
  const base = normalise(name).replace(/\s+/g, '-');
  return base || 'canal';
}

/** Converte a lista lida em canais do site, com id estável, categoria e número. */
export function toChannels(parsed: ParsedChannel[]): Channel[] {
  const usados = new Map<string, number>();
  const comCategoria = parsed
    .filter((c) => c.sources.length > 0)
    .map((c) => {
      const local = categoriaLocal.get(normalise(c.name));
      const category =
        (c.group && canonizar(c.group)) ||
        (local && canonizar(local)) ||
        categoriaPeloNome(c.name);
      return { ...c, category };
    });

  comCategoria.sort((a, b) => {
    const ia = categoryOrder.indexOf(a.category);
    const ib = categoryOrder.indexOf(b.category);
    const pa = ia === -1 ? categoryOrder.length : ia;
    const pb = ib === -1 ? categoryOrder.length : ib;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  return comCategoria.map((c, index) => {
    // Dois canais podem normalizar para o mesmo slug ("SporTV HD" e "SporTV");
    // o sufixo garante que a chave de favoritos de um não apague a do outro.
    const raiz = slugify(c.name);
    const repetido = usados.get(raiz) ?? 0;
    usados.set(raiz, repetido + 1);
    const id = repetido === 0 ? raiz : `${raiz}-${repetido + 1}`;
    return {
      id,
      name: c.name,
      url: c.sources[0].url,
      logo: c.logo,
      category: c.category,
      channelNumber: index + 1,
      sources: c.sources,
    };
  });
}

interface CachedCatalog {
  at: number;
  catalogo: string;
  canais: string;
}

function readCache(): CachedCatalog | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (!parsed.catalogo && !parsed.canais) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cache: CachedCatalog): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cota estourada ou modo privado: seguir sem cache é aceitável.
  }
}

async function baixar(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.text();
}

function montar(catalogo: string, canais: string): Channel[] {
  return toChannels(mergeCatalogs(parseCatalog(catalogo), parseCatalog(canais)));
}

/** A lista que já está em disco, sem tocar na rede. Vazia na primeira visita. */
export function cachedChannels(): Channel[] | null {
  const cache = readCache();
  if (!cache) return null;
  const channels = montar(cache.catalogo, cache.canais);
  return channels.length ? channels : null;
}

/** Verdadeiro quando o que está em cache é velho o bastante para valer rebuscar. */
export function cacheIsStale(): boolean {
  const cache = readCache();
  return !cache || Date.now() - cache.at > CACHE_TTL_MS;
}

/**
 * Baixa a lista publicada. Devolve nulo quando não veio nada aproveitável, e aí
 * quem chamou fica com o que já tinha em vez de esvaziar a tela.
 */
export async function fetchChannels(): Promise<Channel[] | null> {
  const cache = readCache();
  const [catalogo, canais] = await Promise.all([
    baixar(CATALOG_URL).catch(() => ''),
    baixar(EXTRAS_URL).catch(() => ''),
  ]);

  const usarCatalogo = catalogo || cache?.catalogo || '';
  const usarCanais = canais || cache?.canais || '';
  if (!usarCatalogo && !usarCanais) return null;

  const channels = montar(usarCatalogo, usarCanais);
  if (!channels.length) return null;

  if (catalogo || canais) {
    writeCache({ at: Date.now(), catalogo: usarCatalogo, canais: usarCanais });
  }
  return channels;
}
