/**
 * Guia de programação, montado como no aplicativo.
 *
 * O trabalho pesado — baixar o meuguia, ler os dois feeds XMLTV, casar canais e
 * enriquecer os programas — vive em `workers/epgWorker.ts`. Aqui ficam só a
 * memória, o cache e a tradução para o formato que as telas leem.
 *
 * A chave é o nome do canal, não o identificador: o catálogo publicado só tem
 * nomes, e o identificador do site é derivado deles. Amarrar o guia ao
 * identificador era o que fazia a grade sumir sempre que o catálogo mudava um
 * canal de lugar.
 */

import type { Program, ChannelEPG, CurrentProgram } from '../types/epg';
import type { Channel } from '../types/channel';
import { normalise } from '../utils/nomes';
import type { Grade, WorkerProgramme } from '../workers/epgWorker';

const CACHE_KEY = 'saimo-epg-v3';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheGuardado {
  at: number;
  /** Assinatura da lista de canais: um canal novo torna o cache velho na hora. */
  sig: string;
  grade: Grade;
}

/** Nome normalizado -> programação já convertida. */
const porCanal = new Map<string, Program[]>();
/** Nome normalizado do canal, para quem chega com o identificador. */
let nomes: string[] = [];

type EPGListener = (channelId: string, programs: Program[]) => void;
const listeners = new Set<EPGListener>();

let worker: Worker | null = null;
let iniciado = false;
/** Assinatura da lista com que o guia foi montado, para saber quando refazê-lo. */
let sigExecutada: string | null = null;

// ============================================================
// CONVERSÃO
// ============================================================

/**
 * "0.2." no sistema xmltv_ns: temporada, episódio e parte, todos base zero. Cru
 * não diz nada; vira temporada 1, episódio 3.
 */
function parseEpisodio(bruto: string | undefined): Program['episodeInfo'] {
  const raw = bruto?.trim();
  if (!raw) return undefined;

  let season: number | undefined;
  let episode: number | undefined;
  if (!raw.includes('.')) {
    const m = raw.match(/^S?(\d+)(?:E(\d+))?$/i);
    if (!m) return undefined;
    season = Number(m[1]);
    episode = m[2] ? Number(m[2]) : undefined;
  } else {
    const campos = raw.split('.').map((c) => c.split('/')[0].trim());
    const t = Number(campos[0]);
    const e = Number(campos[1]);
    season = Number.isInteger(t) ? t + 1 : undefined;
    episode = Number.isInteger(e) ? e + 1 : undefined;
  }
  if (season === undefined && episode === undefined) return undefined;
  // Programas diários usam o campo como contador corrido: um telejornal em
  // "T80 E221" é ruído, não informação.
  if (season !== undefined && season > 40) return undefined;
  if (episode !== undefined && episode > 200) return undefined;
  return { season, episode };
}

function converter(canal: string, lista: WorkerProgramme[]): Program[] {
  return lista.map((p) => ({
    id: `${canal}-${p.start}`,
    title: p.title,
    description: p.description,
    category: p.category || undefined,
    startTime: new Date(p.start),
    endTime: new Date(p.stop),
    thumbnail: p.poster,
    episodeInfo: parseEpisodio(p.episode),
  }));
}

function aplicar(grade: Grade): void {
  for (const [canal, lista] of Object.entries(grade)) {
    const id = normalise(canal);
    const programas = converter(canal, lista);
    porCanal.set(id, programas);
    listeners.forEach((l) => {
      try { l(id, programas); } catch (e) { console.error('[EPG] listener falhou', e); }
    });
  }
}

// ============================================================
// CACHE
// ============================================================

function assinatura(): string {
  return nomes.map((n) => normalise(n)).sort().join('|');
}

function lerCache(): CacheGuardado | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as CacheGuardado;
    return cache?.grade ? cache : null;
  } catch {
    return null;
  }
}

function gravarCache(grade: Grade): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), sig: assinatura(), grade }));
  } catch {
    // Cota estourada: o guia continua na memória desta visita.
  }
}

// ============================================================
// API PÚBLICA
// ============================================================

/**
 * Diz ao guia quais canais existem. Os nomes vêm do catálogo publicado, que é a
 * mesma lista que o aplicativo usa para procurar a programação.
 */
export function registerChannels(channels: Channel[]): void {
  nomes = channels.map((c) => c.name);
  if (sigExecutada === null || sigExecutada === assinatura()) return;
  /*
   * A lista definitiva chegou depois de o guia já ter sido montado por outra.
   * Sem refazer, a programação fica presa aos nomes da lista antiga — era o que
   * fazia GloboNews, Record e Warner aparecerem sem guia enquanto "Globo News" e
   * "Record TV", que não existem na grade, tinham programação de sobra.
   */
  worker?.terminate();
  worker = null;
  iniciado = false;
  void fetchRealEPG();
}

export function onEPGUpdate(listener: EPGListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Chave de busca a partir do identificador do site ou do nome do canal. */
function chave(idOuNome: string): string {
  // O identificador é o nome normalizado com hífen no lugar do espaço, então
  // desfazer a troca devolve exatamente a chave da grade.
  return normalise(idOuNome.replace(/-/g, ' '));
}

export async function fetchRealEPG(): Promise<boolean> {
  if (iniciado) return true;
  // As telas pedem o guia ao montar, e a lista de canais chega da rede depois.
  // Sair sem marcar iniciado deixa a próxima chamada — a que vem com a lista
  // pronta — fazer o trabalho, em vez de o guia nunca carregar.
  if (!nomes.length) return false;
  iniciado = true;
  sigExecutada = assinatura();

  const cache = lerCache();
  if (cache) aplicar(cache.grade);

  const velho = !cache || Date.now() - cache.at > CACHE_TTL_MS || cache.sig !== assinatura();
  if (!velho) return true;

  try {
    worker = new Worker(new URL('../workers/epgWorker.ts', import.meta.url), { type: 'module' });
  } catch (e) {
    console.error('[EPG] não foi possível iniciar o worker', e);
    return Boolean(cache);
  }

  worker.onmessage = (evento: MessageEvent<{ type: string; grade?: Grade; message?: string }>) => {
    const { type, grade } = evento.data;
    if (type === 'error') {
      console.error('[EPG] worker falhou:', evento.data.message);
      return;
    }
    if (!grade) return;
    aplicar(grade);
    if (type === 'done') {
      if (Object.keys(grade).length) gravarCache(grade);
      worker?.terminate();
      worker = null;
    }
  };

  worker.postMessage({ names: nomes, origin: window.location.origin });
  return true;
}

export function getChannelEPG(channelId: string): ChannelEPG {
  return { channelId, programs: porCanal.get(chave(channelId)) ?? [] };
}

export function getCurrentProgram(channelId: string): CurrentProgram | null {
  const programs = porCanal.get(chave(channelId));
  if (!programs?.length) return null;

  const now = new Date();
  const current = programs.find((p) => p.startTime <= now && p.endTime > now);
  if (!current) return null;

  const next = programs.find((p) => p.startTime > now) ?? null;
  const total = current.endTime.getTime() - current.startTime.getTime();
  const elapsed = now.getTime() - current.startTime.getTime();
  const progress = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;

  return { current, next, progress };
}

export async function getCurrentProgramAsync(channelId: string): Promise<CurrentProgram | null> {
  await fetchRealEPG();
  return getCurrentProgram(channelId);
}

export function hasEPG(channelId: string): boolean {
  return (porCanal.get(chave(channelId))?.length ?? 0) > 0;
}

export function clearEPGCache(): void {
  porCanal.clear();
  localStorage.removeItem(CACHE_KEY);
}

export function getEPGStats() {
  let totalPrograms = 0;
  porCanal.forEach((lista) => { totalPrograms += lista.length; });
  return {
    channelsWithEPG: porCanal.size,
    totalChannels: nomes.length,
    totalPrograms,
    isLoading: worker !== null,
  };
}
