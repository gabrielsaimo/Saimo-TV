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
import type { Grade, PlutoDoCanal, WorkerProgramme } from '../workers/epgWorker';
import { proxyBase } from '../utils/streamUrl';
import { lerGuia, TABELAS_VAZIAS, type TabelasGuia } from '../utils/guiaTabelas';
import { linkCanais } from './listas';

const CACHE_KEY = 'saimo-epg-v6';
const CACHE_TABELAS = 'saimo-guia-tabelas';
/** Chaves de versões antigas, invalidadas a cada mudança de arquitetura do guia. */
const CACHES_VELHOS = ['saimo-epg-v5', 'saimo-epg-v4', 'saimo-epg-v3'];
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Programa que acabou há mais que isto não interessa a tela nenhuma. */
const PASSADO_UTIL_MS = 3 * 60 * 60 * 1000;

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
/** Nome do canal -> id da Pluto, para os canais que têm a Pluto numa fonte. */
let pluto: Record<string, PlutoDoCanal> = {};

const PLUTO_ID = /(?:plu-|images\.pluto\.tv\/channels\/)([0-9a-f]{24})/;

/**
 * id da Pluto do canal, pelo link de alguma fonte ou pelo logo. `principal` diz
 * se a Pluto é a primeira fonte (ou só está no logo); onde ela é reserva (TV
 * Cultura, CNBC…) a grade dela é genérica e só entra na falta de outra.
 */
function plutoDoCanal(canal: Channel): PlutoDoCanal | undefined {
  const links = canal.sources?.length ? canal.sources.map((s) => s.url) : [canal.url];
  const doLink = links.map((l) => PLUTO_ID.exec(l ?? '')?.[1]).find(Boolean);
  const id = doLink ?? PLUTO_ID.exec(canal.logo ?? '')?.[1];
  if (!id) return undefined;
  return { id, principal: !doLink || PLUTO_ID.test(links[0] ?? '') };
}

/**
 * Recebe as chaves (`epgKey`) dos canais que mudaram, uma vez por lote. Um
 * aviso por canal, como antes, chamava cada cartão da lista uma vez para cada
 * canal do guia — dezenas de milhares de chamadas a cada etapa da montagem.
 * O conjunto vem vazio quando só o estado (carregando/pronto) mudou.
 */
type EPGListener = (canais: ReadonlySet<string>) => void;
const listeners = new Set<EPGListener>();

let worker: Worker | null = null;
let iniciado = false;
/** O guia terminou de montar (ou o cache ainda vale): falta de grade é falta de verdade. */
let pronto = false;
/** Tudo o que já chegou, no formato do worker, para o cache. */
let gradeAtual: Grade = {};
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
  const corte = Date.now() - PASSADO_UTIL_MS;
  return lista.filter((p) => p.stop > corte).map((p) => ({
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

/**
 * "No Data" é o que alguns feeds põem nas horas sem grade. Não é programa:
 * mostrado, virava "No Data" embaixo do nome do canal.
 */
function semInformacao(titulo: string): boolean {
  const t = titulo.trim().toLowerCase();
  return !t || t === 'no data' || t === 'sem informação';
}

function avisar(canais: ReadonlySet<string>): void {
  listeners.forEach((l) => {
    try { l(canais); } catch (e) { console.error('[EPG] listener falhou', e); }
  });
}

function aplicar(grade: Grade): void {
  const mudaram = new Set<string>();
  for (const [canal, lista] of Object.entries(grade)) {
    const id = normalise(canal);
    porCanal.set(id, converter(canal, lista).filter((p) => !semInformacao(p.title)));
    mudaram.add(id);
  }
  if (mudaram.size) avisar(mudaram);
}

function marcarPronto(): void {
  if (pronto) return;
  pronto = true;
  avisar(new Set());
}

// ============================================================
// CACHE
// ============================================================

function assinatura(): string {
  return linkCanais() + '#' + nomes.map((n) => normalise(n)).sort().join('|');
}

function lerCache(): CacheGuardado | null {
  try {
    for (const velho of CACHES_VELHOS) localStorage.removeItem(velho);
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as CacheGuardado;
    return cache?.grade ? cache : null;
  } catch {
    return null;
  }
}

function gravarCache(grade: Grade): void {
  const gravar = () => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), sig: assinatura(), grade }));
    } catch {
      // Cota estourada: o guia continua na memória desta visita.
    }
  };
  // Serializar a grade é trabalho de linha principal: fica para quando ela
  // estiver livre, e não no meio de uma rolagem.
  if (typeof requestIdleCallback === 'function') requestIdleCallback(gravar, { timeout: 5000 });
  else setTimeout(gravar, 0);
}

/**
 * As tabelas por canal do guia: `guia.txt` do endereço de canais. A última
 * versão baixada fica em disco; sem o arquivo (ou sem endereço) o guia só tem o
 * que casa por nome nos feeds, e nenhum pedido é feito.
 */
async function carregarTabelas(): Promise<TabelasGuia> {
  const base = linkCanais();
  if (!base) return TABELAS_VAZIAS;
  let guardado = '';
  try {
    const bruto = localStorage.getItem(CACHE_TABELAS);
    const salvo = bruto ? JSON.parse(bruto) as { base: string; texto: string } : null;
    if (salvo?.base === base) guardado = salvo.texto;
  } catch { /* sem cache */ }
  let texto = guardado;
  try {
    const r = await fetch(`${base}guia.txt`, { cache: 'no-store' });
    if (r.ok) {
      texto = await r.text();
      try { localStorage.setItem(CACHE_TABELAS, JSON.stringify({ base, texto })); } catch { /* sem cache */ }
    } else if (r.status === 404) {
      texto = '';
    }
  } catch { /* rede: fica o que estava guardado */ }
  return lerGuia(texto);
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
  pluto = {};
  for (const canal of channels) {
    const achado = plutoDoCanal(canal);
    if (achado) pluto[canal.name] = achado;
  }
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
  pronto = false;
  void fetchRealEPG();
}

export function onEPGUpdate(listener: EPGListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** O guia já terminou de montar: canal sem grade agora é canal sem grade. */
export function isEPGReady(): boolean {
  return pronto;
}

/** Chave de busca a partir do identificador do site ou do nome do canal. */
export function epgKey(idOuNome: string): string {
  return chave(idOuNome);
}

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
  if (cache) {
    gradeAtual = { ...cache.grade };
    aplicar(cache.grade);
  }

  const velho = !cache || Date.now() - cache.at > CACHE_TTL_MS || cache.sig !== assinatura();
  if (!velho) {
    marcarPronto();
    return true;
  }

  void iniciarWorker();
  return true;
}

async function iniciarWorker(): Promise<void> {
  const sigPedida = assinatura();
  const tabelas = await carregarTabelas();
  // Os canais ou o endereço mudaram enquanto o arquivo baixava: quem registrou
  // a lista nova já reiniciou o guia por conta própria.
  if (sigPedida !== assinatura()) return;
  try {
    worker = new Worker(new URL('../workers/epgWorker.ts', import.meta.url), { type: 'module' });
  } catch (e) {
    console.error('[EPG] não foi possível iniciar o worker', e);
    marcarPronto();
    return;
  }

  worker.onmessage = (evento: MessageEvent<{ type: string; grade?: Grade; message?: string }>) => {
    const { type, grade } = evento.data;
    if (type === 'error') {
      console.error('[EPG] worker falhou:', evento.data.message);
      worker?.terminate();
      worker = null;
      marcarPronto();
      return;
    }
    if (grade) {
      // O worker manda só os canais que mudaram; o cache guarda a soma.
      Object.assign(gradeAtual, grade);
      aplicar(grade);
    }
    if (type === 'done') {
      if (Object.keys(gradeAtual).length) gravarCache(gradeAtual);
      worker?.terminate();
      worker = null;
      marcarPronto();
    }
  };

  worker.postMessage({ names: nomes, pluto, origin: proxyBase(), tabelas });
}

/** Lista vazia única: uma nova a cada consulta redesenharia à toa as linhas sem grade. */
const SEM_PROGRAMAS: Program[] = [];

export function getChannelEPG(channelId: string): ChannelEPG {
  return { channelId, programs: porCanal.get(chave(channelId)) ?? SEM_PROGRAMAS };
}

/**
 * Índice do primeiro programa que ainda não acabou em `instante`. A lista está
 * em ordem e sem sobreposição (o worker garante), então a busca é binária: a
 * grade e os cartões perguntam isso centenas de vezes por minuto.
 */
export function firstEndingAfter(programs: Program[], instante: number): number {
  let lo = 0;
  let hi = programs.length;
  while (lo < hi) {
    const meio = (lo + hi) >>> 1;
    if (programs[meio].endTime.getTime() <= instante) lo = meio + 1;
    else hi = meio;
  }
  return lo;
}

export function getCurrentProgram(channelId: string): CurrentProgram | null {
  const programs = porCanal.get(chave(channelId));
  if (!programs?.length) return null;

  const now = new Date();
  const i = firstEndingAfter(programs, now.getTime());
  const current = programs[i] && programs[i].startTime <= now ? programs[i] : null;
  if (!current) return null;

  const next = programs[i + 1] ?? null;
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
  gradeAtual = {};
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
