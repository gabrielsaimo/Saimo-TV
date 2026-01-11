import type { Program, ChannelEPG, CurrentProgram } from '../types/epg';

// ============================================================================
// EPG Service - Scraping direto do meuguia.tv
// ============================================================================

// Cache de EPG
const epgCache: Map<string, Program[]> = new Map();
const lastFetch: Map<string, number> = new Map();
const CACHE_DURATION = 1800000; // 30 minutos
const pendingFetches: Map<string, Promise<Program[]>> = new Map();

// Listeners para atualização de EPG
type EPGListener = (channelId: string, programs: Program[]) => void;
const listeners: Set<EPGListener> = new Set();

// Mapeamento dos canais do app para os códigos do meuguia.tv
const channelToMeuGuiaCode: Record<string, string> = {
  // Telecine
  'telecine-action': 'TC2',
  'telecine-premium': 'TC1',
  'telecine-pipoca': 'TC4',
  'telecine-cult': 'TC5',
  'telecine-fun': 'TC6',
  'telecine-touch': 'TC3',
  
  // HBO
  'hbo': 'HBO',
  'hbo2': 'HB2',
  'hbo-family': 'HFA',
  'hbo-plus': 'HPL',
  'hbo-mundi': 'HMU',
  'hbo-pop': 'HPO',
  'hbo-xtreme': 'HXT',
  
  // Globo
  'globo-sp': 'GRD',
  'globo-rj': 'GRD',
  'globo-mg': 'GRD',
  'globo-rs': 'GRD',
  'globo-news': 'GLN',
  
  // SporTV
  'sportv': 'SPO',
  'sportv2': 'SP2',
  'sportv3': 'SP3',
  
  // ESPN
  'espn': 'ESP',
  'espn2': 'ES2',
  'espn3': 'ES3',
  'espn4': 'ES4',
  
  // TV Aberta
  'sbt': 'SBT',
  'band': 'BAN',
  'record': 'REC',
  'rede-tv': 'RTV',
  'tv-brasil': 'TED',
  'aparecida': 'TAP',
  'cultura': 'CUL',
  'tv-gazeta': 'GAZ',
  
  // Notícias
  'cnn-brasil': 'CNB',
  'band-news': 'NEW',
  'record-news': 'RCN',
  
  // Infantil
  'cartoon-network': 'CAR',
  'cartoonito': 'CTO',
  'discovery-kids': 'DIK',
  'gloob': 'GOB',
  'gloobinho': 'GBI',
  'adult-swim': 'ASW',
  
  // Documentários
  'discovery': 'DIS',
  'discovery-turbo': 'DTU',
  'discovery-world': 'DIW',
  'discovery-science': 'DSC',
  'discovery-hh': 'HEA',
  'animal-planet': 'APL',
  'history': 'HIS',
  'history2': 'H2H',
  'tlc': 'TRV',
  
  // Séries
  'warner': 'WBT',
  'tnt': 'TNT',
  'tnt-series': 'TNS',
  'axn': 'AXN',
  'sony': 'SET',
  'universal-tv': 'USA',
  'ae': 'MDO',
  
  // Filmes
  'amc': 'MGM',
  'tcm': 'TCM',
  'space': 'SPA',
  'cinemax': 'MNX',
  'megapix': 'MPX',
  'studio-universal': 'HAL',
  
  // Entretenimento
  'multishow': 'MSW',
  'bis': 'MSH',
  'viva': 'VIV',
  'off': 'OFF',
  'gnt': 'GNT',
  'arte1': 'BQ5',
  
  // Esportes
  'premiere': '121',
  'combate': '135',
  'band-sports': 'BSP',
};

/**
 * Registra listener para atualizações de EPG
 */
export function onEPGUpdate(listener: EPGListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notifica listeners
 */
function notifyListeners(channelId: string, programs: Program[]): void {
  listeners.forEach(listener => {
    try {
      listener(channelId, programs);
    } catch (e) {
      console.error('Erro em listener EPG:', e);
    }
  });
}

/**
 * Parse HTML do meuguia.tv para extrair programas
 */
function parseHTMLPrograms(html: string, channelId: string): Program[] {
  const programs: Program[] = [];
  
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Remove templates ERB que não foram processados
    const cleanHtml = html.replace(/<li class="subheader[^"]*"><%=[^>]+%><\/li>/gi, '');
    
    // Regex para capturar cada programa individualmente
    // Estrutura: <div class='lileft time'>HH:MM</div> ... <h2>Título</h2> ... <h3>Categoria</h3>
    const programRegex = /<div class=['"]lileft time['"]>\s*(\d{1,2}:\d{2})\s*<\/div>[\s\S]*?<h2>([^<]+)<\/h2>[\s\S]*?<h3>([^<]*)<\/h3>/gi;
    
    // Extrai datas dos cabeçalhos reais (com dia/mês)
    const dateHeaders: { index: number; date: Date }[] = [];
    const headerRegex = /<li class="subheader[^"]*">[^<]*?(\d{1,2})\/(\d{1,2})[^<]*<\/li>/gi;
    
    let headerMatch;
    while ((headerMatch = headerRegex.exec(cleanHtml)) !== null) {
      const day = parseInt(headerMatch[1]);
      const month = parseInt(headerMatch[2]) - 1;
      let date = new Date(currentYear, month, day, 0, 0, 0, 0);
      
      // Se mês muito anterior, provavelmente próximo ano
      if (month < today.getMonth() - 6) {
        date = new Date(currentYear + 1, month, day, 0, 0, 0, 0);
      }
      
      dateHeaders.push({ index: headerMatch.index, date });
    }
    
    console.log(`[EPG] ${channelId}: ${dateHeaders.length} blocos de data encontrados`);
    
    // Se não encontrou cabeçalhos de data, usa a data de hoje
    if (dateHeaders.length === 0) {
      dateHeaders.push({ index: 0, date: new Date(today.getFullYear(), today.getMonth(), today.getDate()) });
    }
    
    // Para cada programa, encontra a data correspondente
    let programMatch;
    let lastHour = -1;
    let currentDateIndex = 0;
    
    while ((programMatch = programRegex.exec(cleanHtml)) !== null) {
      const timeStr = programMatch[1];
      const title = programMatch[2].trim();
      const category = programMatch[3].trim();
      
      // Encontra a data apropriada baseado na posição no HTML
      while (currentDateIndex < dateHeaders.length - 1 && 
             programMatch.index > dateHeaders[currentDateIndex + 1].index) {
        currentDateIndex++;
        lastHour = -1; // Reset ao mudar de bloco de data
      }
      
      let programDate = new Date(dateHeaders[currentDateIndex].date);
      
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      
      // Se a hora diminuiu muito (ex: de 23h para 01h), passou meia-noite
      if (lastHour !== -1 && hours < lastHour - 6) {
        programDate = new Date(programDate.getTime() + 24 * 60 * 60 * 1000);
      }
      lastHour = hours;
      
      const startTime = new Date(programDate);
      startTime.setHours(hours, minutes, 0, 0);
      
      // Duração padrão de 1 hora
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      
      programs.push({
        id: `${channelId}-${startTime.getTime()}`,
        title: decodeHTMLEntities(title),
        description: '',
        category: decodeHTMLEntities(category),
        startTime,
        endTime,
      });
    }
    
    // Ordena por horário
    programs.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    // Ajusta horários de término
    for (let i = 0; i < programs.length - 1; i++) {
      programs[i].endTime = programs[i + 1].startTime;
    }
    
    console.log(`[EPG] ${channelId}: ${programs.length} programas parseados`);
    if (programs.length > 0) {
      console.log(`[EPG] Primeiro: ${programs[0].title} às ${programs[0].startTime.toLocaleString()}`);
    }
    
  } catch (e) {
    console.error('[EPG] Erro parsing:', e);
  }
  
  return programs;
}

function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
    '&eacute;': 'é', '&aacute;': 'á', '&iacute;': 'í',
    '&oacute;': 'ó', '&uacute;': 'ú', '&atilde;': 'ã',
    '&otilde;': 'õ', '&ccedil;': 'ç', '&ndash;': '–', '&mdash;': '—',
  };
  return text.replace(/&[^;]+;/g, m => entities[m] || m);
}

/**
 * Busca EPG de um canal (com cache e deduplicação)
 */
async function fetchChannelEPGAsync(channelId: string): Promise<Program[]> {
  const meuguiaCode = channelToMeuGuiaCode[channelId];
  if (!meuguiaCode) {
    console.log(`[EPG] ${channelId}: sem código meuguia.tv`);
    return [];
  }

  // Verifica cache válido
  const lastTime = lastFetch.get(channelId) || 0;
  const now = Date.now();
  
  if (epgCache.has(channelId) && now - lastTime < CACHE_DURATION) {
    return epgCache.get(channelId) || [];
  }

  // Evita requisições duplicadas
  if (pendingFetches.has(channelId)) {
    return pendingFetches.get(channelId)!;
  }

  const fetchPromise = (async (): Promise<Program[]> => {
    try {
      const url = `https://meuguia.tv/programacao/canal/${meuguiaCode}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      
      console.log(`[EPG] Buscando ${channelId} de ${url}`);
      
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        console.log(`[EPG] ${channelId}: HTTP ${response.status}`);
        return [];
      }
      
      const html = await response.text();
      console.log(`[EPG] ${channelId}: HTML recebido (${html.length} bytes)`);
      
      const programs = parseHTMLPrograms(html, channelId);
      
      if (programs.length > 0) {
        epgCache.set(channelId, programs);
        lastFetch.set(channelId, Date.now());
        notifyListeners(channelId, programs);
        console.log(`[EPG] ${channelId}: ${programs.length} programas salvos`);
      }
      
      return programs;
    } catch (e) {
      console.error(`[EPG] ${channelId}: erro`, e);
      return [];
    } finally {
      pendingFetches.delete(channelId);
    }
  })();

  pendingFetches.set(channelId, fetchPromise);
  return fetchPromise;
}

/**
 * Inicializa EPG - carrega todos os canais em segundo plano
 */
let backgroundLoadStarted = false;

export async function fetchRealEPG(): Promise<boolean> {
  console.log('[EPG] Service inicializado - meuguia.tv scraping');
  
  // Inicia carregamento em segundo plano apenas uma vez
  if (!backgroundLoadStarted) {
    backgroundLoadStarted = true;
    loadAllEPGInBackground();
  }
  
  return true;
}

/**
 * Carrega EPG de todos os canais em segundo plano
 */
async function loadAllEPGInBackground(): Promise<void> {
  const allChannelIds = Object.keys(channelToMeuGuiaCode);
  console.log(`[EPG] Iniciando carregamento em segundo plano de ${allChannelIds.length} canais...`);
  
  // Carrega em lotes para não sobrecarregar
  const batchSize = 3;
  const delayBetweenBatches = 1000; // 1 segundo entre lotes
  
  for (let i = 0; i < allChannelIds.length; i += batchSize) {
    const batch = allChannelIds.slice(i, i + batchSize);
    
    // Carrega o lote em paralelo
    await Promise.all(
      batch.map(channelId => fetchChannelEPGAsync(channelId))
    );
    
    console.log(`[EPG] Carregados ${Math.min(i + batchSize, allChannelIds.length)}/${allChannelIds.length} canais`);
    
    // Delay entre lotes para não sobrecarregar
    if (i + batchSize < allChannelIds.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  console.log('[EPG] Carregamento em segundo plano concluído!');
}

/**
 * Obtém programação de um canal (inicia busca se necessário)
 */
export function getChannelEPG(channelId: string): ChannelEPG {
  // Inicia busca em background
  fetchChannelEPGAsync(channelId);
  
  return {
    channelId,
    programs: epgCache.get(channelId) || [],
  };
}

/**
 * Obtém programa atual (versão síncrona para uso em componentes)
 */
export function getCurrentProgram(channelId: string): CurrentProgram | null {
  // Inicia busca se não tem cache
  if (!epgCache.has(channelId)) {
    fetchChannelEPGAsync(channelId);
    return null;
  }
  
  const programs = epgCache.get(channelId) || [];
  if (programs.length === 0) return null;
  
  const now = new Date();
  
  const current = programs.find(p => p.startTime <= now && p.endTime > now);
  if (!current) return null;
  
  const next = programs.find(p => p.startTime > now);
  
  const total = current.endTime.getTime() - current.startTime.getTime();
  const elapsed = now.getTime() - current.startTime.getTime();
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
  
  return { current, next: next || null, progress };
}

/**
 * Obtém programa atual (versão assíncrona - aguarda busca)
 */
export async function getCurrentProgramAsync(channelId: string): Promise<CurrentProgram | null> {
  await fetchChannelEPGAsync(channelId);
  return getCurrentProgram(channelId);
}

/**
 * Busca EPG de múltiplos canais
 */
export function getBulkEPG(channelIds: string[]): Map<string, ChannelEPG> {
  const result = new Map<string, ChannelEPG>();
  channelIds.forEach(id => result.set(id, getChannelEPG(id)));
  return result;
}

export function clearEPGCache(): void {
  epgCache.clear();
  lastFetch.clear();
}

export function hasEPG(channelId: string): boolean {
  return (epgCache.get(channelId)?.length || 0) > 0;
}

export function getEPGStats() {
  let totalPrograms = 0;
  let latestUpdate = 0;
  
  epgCache.forEach(programs => totalPrograms += programs.length);
  lastFetch.forEach(time => { if (time > latestUpdate) latestUpdate = time; });
  
  return {
    channelsWithEPG: epgCache.size,
    totalPrograms,
    lastUpdate: latestUpdate > 0 ? new Date(latestUpdate) : null,
    isLoading: pendingFetches.size > 0,
  };
}

export function listEPGChannels(): string[] {
  return Object.keys(channelToMeuGuiaCode);
}

export async function refreshChannelEPG(channelId: string): Promise<void> {
  lastFetch.delete(channelId);
  epgCache.delete(channelId);
  await fetchChannelEPGAsync(channelId);
}
