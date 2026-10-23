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
import { httpsFirst } from '../utils/sourceOrder';
import { categoryOrder } from '../data/categorias';
import { normalise } from '../utils/nomes';
import { linkCanais } from './listas';
import { peneirarCanais } from './fontesDesativadas';

export { normalise };

const CACHE_KEY = 'saimo-catalogo-v2';
const CACHE_RESTRITOS = 'saimo-restritos-v1';
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
      // A seção declarada no catálogo publicado; entra como rótulo de grupo,
      // que é por onde a categoria já era decidida quando vem de um M3U.
      case 'categoria':
        if (current) current.group = value;
        break;
      case 'fonte':
        if (current) current.sources.push({ url: value });
        break;
      case 'referer':
        if (current?.sources.length) current.sources[current.sources.length - 1].referer = value;
        break;
      case 'nome':
        if (current?.sources.length) current.sources[current.sources.length - 1].name = value;
        break;
      case 'qualidade':
        if (current?.sources.length) current.sources[current.sources.length - 1].quality = value;
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

/**
 * Reduz o rótulo `categoria:` (ou `group-title`) a uma das seções que a barra
 * lateral ordena.
 *
 * Catálogo e extras rotulam a mesma prateleira de jeitos diferentes —
 * "FILMES E SÉRIES", "Filmes" — e deixá-los passar crus espalharia o mesmo
 * assunto por seções que o leitor lê como a mesma. Só palavras de assunto
 * entram aqui, nunca nome de canal. Rótulo desconhecido vira seção própria.
 */
function canonizar(rotulo: string): string | null {
  const n = normalise(rotulo).replace(/^canais /, '');
  if (!n) return null;
  if (/(esporte|ppv|futsal|campeonato|jogos)/.test(n)) return 'Esportes';
  if (/(filme|serie|cinema)/.test(n)) return 'Filmes';
  if (/(infanti|kids|desenho)/.test(n)) return 'Infantil';
  if (/(document)/.test(n)) return 'Documentarios';
  if (/(notic|news)/.test(n)) return 'Noticias';
  if (/(novela)/.test(n)) return 'Series';
  if (/(aberto)/.test(n)) return 'TV Aberta';
  if (/(adulto)/.test(n)) return 'Adulto';
  if (/(internacion|legendado)/.test(n)) return 'Internacionais';
  if (/^pluto tv$/.test(n)) return 'Pluto TV';
  if (/^24 horas$/.test(n)) return '24 Horas';
  if (/(variedade|estilo de vida|entretenimento|religios|4k)/.test(n)) return 'Entretenimento';
  return null;
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
      // A seção vem do campo `categoria:` do catálogo; sem ele, "Outros".
      const category = c.group ? (canonizar(c.group) ?? c.group.trim()) : 'Outros';
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
    const sources = httpsFirst(c.sources);
    return {
      id,
      name: c.name,
      url: sources[0].url,
      logo: c.logo,
      category: c.category,
      channelNumber: index + 1,
      sources,
    };
  });
}

interface CachedCatalog {
  at: number;
  /** De que endereço veio: trocar o link invalida o que estava guardado. */
  base: string;
  catalogo: string;
  canais: string;
}

function readCache(): CachedCatalog | null {
  const base = linkCanais();
  if (!base) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (parsed.base !== base) return null;
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
  const targetUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(targetUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.text();
}

function montar(catalogo: string, canais: string): Channel[] {
  // O que está desligado no painel sai antes de virar canal: `toChannels` usa
  // a primeira fonte como endereço do canal, e ela não pode ser uma morta.
  return toChannels(
    peneirarCanais(mergeCatalogs(parseCatalog(catalogo), parseCatalog(canais))),
  );
}

/** A lista que já está em disco, sem tocar na rede. Nula sem endereço ou sem cache. */
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
 * quem chamou fica com o que já tinha em vez de esvaziar a tela. Sem endereço
 * não pede nada.
 */
export async function fetchChannels(): Promise<Channel[] | null> {
  const base = linkCanais();
  if (!base) return null;
  const cache = readCache();
  const [catalogo, canais] = await Promise.all([
    baixar(`${base}catalogo.txt`).catch(() => ''),
    baixar(`${base}canais.txt`).catch(() => ''),
  ]);
  // O endereço mudou enquanto baixava: o que veio é da lista antiga.
  if (linkCanais() !== base) return null;

  const usarCatalogo = catalogo || cache?.catalogo || '';
  const usarCanais = canais || cache?.canais || '';
  if (!usarCatalogo && !usarCanais) return null;

  const channels = montar(usarCatalogo, usarCanais);
  if (!channels.length) return null;

  if (catalogo || canais) {
    writeCache({ at: Date.now(), base, catalogo: usarCatalogo, canais: usarCanais });
  }
  return channels;
}

// ============================================================
// RESTRITOS (só depois do código do controle parental)
// ============================================================

/** O que o último `restritos.txt` baixado guardou, sem rede. */
export function cachedRestritos(): Channel[] {
  const base = linkCanais();
  if (!base) return [];
  try {
    const raw = localStorage.getItem(CACHE_RESTRITOS);
    if (!raw) return [];
    const guardado = JSON.parse(raw) as { base: string; texto: string };
    return guardado.base === base ? toChannels(parseCatalog(guardado.texto)) : [];
  } catch {
    return [];
  }
}

/**
 * Baixa o `restritos.txt` do endereço de canais. Só quem já destravou o modo
 * adulto chama; para os outros o arquivo nem é pedido.
 */
export async function fetchRestritos(): Promise<Channel[] | null> {
  const base = linkCanais();
  if (!base) return null;
  try {
    const texto = await baixar(`${base}restritos.txt`);
    if (linkCanais() !== base) return null;
    const canais = toChannels(parseCatalog(texto)).map((c) => ({ ...c, id: `restrito-${c.id}` }));
    try { localStorage.setItem(CACHE_RESTRITOS, JSON.stringify({ base, texto })); } catch { /* sem cache */ }
    return canais;
  } catch {
    return null;
  }
}
