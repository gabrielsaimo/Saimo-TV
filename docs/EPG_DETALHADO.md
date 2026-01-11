# 📺 Sistema EPG (Electronic Program Guide) - Documentação Técnica

## Visão Geral

O sistema EPG fornece informações de programação dos canais de TV. Os dados são obtidos via **web scraping** do site **meuguia.tv**.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Fluxo do EPG                              │
└─────────────────────────────────────────────────────────────┘

     ┌─────────────┐
     │ meuguia.tv  │ ← Fonte dos dados
     └──────┬──────┘
            │
            ▼ (via CORS Proxy)
     ┌─────────────┐
     │ AllOrigins  │ ← Proxy para evitar CORS
     └──────┬──────┘
            │
            ▼
     ┌─────────────────────────────┐
     │     EPG Service             │
     │  - fetch HTML               │
     │  - parse programação        │
     │  - cache em memória         │
     │  - notifica listeners       │
     └──────┬──────────────────────┘
            │
            ▼
     ┌─────────────────────────────┐
     │     Componentes React       │
     │  - ProgramInfo              │
     │  - ProgramGuide             │
     └─────────────────────────────┘
```

---

## Estruturas de Dados

### Program (Programa)

```typescript
// src/types/epg.ts

export interface Program {
  id: string;              // ID único (channelId-timestamp)
  title: string;           // Nome do programa
  description?: string;    // Descrição/sinopse
  startTime: Date;         // Horário de início
  endTime: Date;           // Horário de término
  category?: string;       // Gênero (ex: "Jornalístico", "Filme")
  rating?: string;         // Classificação indicativa
  thumbnail?: string;      // Imagem do programa
  isLive?: boolean;        // Se é transmissão ao vivo
  episodeInfo?: {          // Informações de episódio (se série)
    season?: number;
    episode?: number;
    episodeTitle?: string;
  };
}
```

### ChannelEPG (EPG de um Canal)

```typescript
export interface ChannelEPG {
  channelId: string;       // ID do canal
  programs: Program[];     // Lista de programas
}
```

### CurrentProgram (Programa Atual)

```typescript
export interface CurrentProgram {
  current: Program | null;  // Programa em exibição
  next: Program | null;     // Próximo programa
  progress: number;         // Progresso (0-100%)
}
```

---

## Mapeamento de Canais

O sistema mapeia IDs dos canais do app para códigos do meuguia.tv:

```typescript
// src/services/epgService.ts

const channelToMeuGuiaCode: Record<string, string> = {
  // === GLOBO ===
  'globo-sp': 'GRD',
  'globo-rj': 'GRD',
  'globo-news': 'GLN',
  
  // === HBO ===
  'hbo': 'HBO',
  'hbo2': 'HB2',
  'hbo-family': 'HFA',
  'hbo-plus': 'HPL',
  'hbo-mundi': 'HMU',
  'hbo-pop': 'HPO',
  'hbo-xtreme': 'HXT',
  
  // === TELECINE ===
  'telecine-action': 'TC2',
  'telecine-premium': 'TC1',
  'telecine-pipoca': 'TC4',
  'telecine-cult': 'TC5',
  'telecine-fun': 'TC6',
  'telecine-touch': 'TC3',
  
  // === SPORTV ===
  'sportv': 'SPO',
  'sportv2': 'SP2',
  'sportv3': 'SP3',
  
  // === ESPN ===
  'espn': 'ESP',
  'espn2': 'ES2',
  'espn3': 'ES3',
  'espn4': 'ES4',
  'espn5': 'ES5',
  
  // === TV ABERTA ===
  'sbt': 'SBT',
  'band': 'BAN',
  'record': 'REC',
  'rede-tv': 'RTV',
  'tv-brasil': 'TED',
  'cultura': 'CUL',
  
  // === NOTÍCIAS ===
  'cnn-brasil': 'CNB',
  'band-news': 'NEW',
  'record-news': 'RCN',
  
  // === INFANTIL ===
  'cartoon-network': 'CAR',
  'cartoonito': 'CTO',
  'discovery-kids': 'DIK',
  'gloob': 'GOB',
  'gloobinho': 'GBI',
  
  // === SÉRIES ===
  'warner': 'WBT',
  'tnt': 'TNT',
  'tnt-series': 'TNS',
  'axn': 'AXN',
  'sony': 'SET',
  'universal-tv': 'USA',
  
  // === DOCUMENTÁRIOS ===
  'discovery': 'DIS',
  'discovery-turbo': 'DTU',
  'discovery-world': 'DIW',
  'animal-planet': 'APL',
  'history': 'HIS',
  'history2': 'H2H',
  
  // === ENTRETENIMENTO ===
  'multishow': 'MSW',
  'bis': 'MSH',
  'gnt': 'GNT',
  
  // === ESPORTES ===
  'premiere': '121',
  'combate': '135',
  'band-sports': 'BSP',
};
```

---

## Sistema de Cache

### Estrutura

```typescript
// Cache em memória
const epgCache: Map<string, Program[]> = new Map();
const lastFetch: Map<string, number> = new Map();
const CACHE_DURATION = 1800000; // 30 minutos

// Requisições pendentes (evita duplicação)
const pendingFetches: Map<string, Promise<Program[]>> = new Map();
```

### Verificação de Cache

```typescript
async function fetchChannelEPGAsync(channelId: string): Promise<Program[]> {
  // Verifica cache válido
  const lastTime = lastFetch.get(channelId) || 0;
  const now = Date.now();
  
  if (epgCache.has(channelId) && now - lastTime < CACHE_DURATION) {
    console.log(`[EPG] ${channelId}: usando cache`);
    return epgCache.get(channelId) || [];
  }

  // Evita requisições duplicadas
  if (pendingFetches.has(channelId)) {
    console.log(`[EPG] ${channelId}: aguardando requisição pendente`);
    return pendingFetches.get(channelId)!;
  }

  // Faz nova requisição...
}
```

---

## Processo de Busca

### URL do meuguia.tv

```typescript
const url = `https://meuguia.tv/programacao/canal/${meuguiaCode}`;
// Exemplo: https://meuguia.tv/programacao/canal/HBO
```

### CORS Proxy

Para evitar bloqueio de CORS, usa-se um proxy:

```typescript
const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
```

### Fetch Completo

```typescript
async function fetchChannelEPGAsync(channelId: string): Promise<Program[]> {
  const meuguiaCode = channelToMeuGuiaCode[channelId];
  if (!meuguiaCode) {
    console.log(`[EPG] ${channelId}: sem código meuguia.tv`);
    return [];
  }

  // ... verificações de cache ...

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
```

---

## Parser de HTML

### Estrutura do HTML do meuguia.tv

```html
<!-- Cabeçalho de data -->
<li class="subheader">10/01 - Segunda-feira</li>

<!-- Programa -->
<div class='lileft time'>20:00</div>
<!-- ... outros elementos ... -->
<h2>Jornal Nacional</h2>
<h3>Jornalístico</h3>
```

### Função de Parse

```typescript
function parseHTMLPrograms(html: string, channelId: string): Program[] {
  const programs: Program[] = [];
  
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Remove templates ERB não processados
    const cleanHtml = html.replace(/<li class="subheader[^"]*"><%=[^>]+%><\/li>/gi, '');
    
    // Regex para capturar cada programa
    const programRegex = /<div class=['"]lileft time['"]>\s*(\d{1,2}:\d{2})\s*<\/div>[\s\S]*?<h2>([^<]+)<\/h2>[\s\S]*?<h3>([^<]*)<\/h3>/gi;
    
    // Extrai datas dos cabeçalhos
    const dateHeaders: { index: number; date: Date }[] = [];
    const headerRegex = /<li class="subheader[^"]*">[^<]*?(\d{1,2})\/(\d{1,2})[^<]*<\/li>/gi;
    
    let headerMatch;
    while ((headerMatch = headerRegex.exec(cleanHtml)) !== null) {
      const day = parseInt(headerMatch[1]);
      const month = parseInt(headerMatch[2]) - 1;  // JS meses são 0-indexed
      let date = new Date(currentYear, month, day, 0, 0, 0, 0);
      
      // Se mês muito anterior, provavelmente próximo ano
      if (month < today.getMonth() - 6) {
        date = new Date(currentYear + 1, month, day, 0, 0, 0, 0);
      }
      
      dateHeaders.push({ index: headerMatch.index, date });
    }
    
    // Fallback: se não encontrou cabeçalhos, usa hoje
    if (dateHeaders.length === 0) {
      dateHeaders.push({ 
        index: 0, 
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate()) 
      });
    }
    
    // Processa cada programa
    let programMatch;
    let lastHour = -1;
    let currentDateIndex = 0;
    
    while ((programMatch = programRegex.exec(cleanHtml)) !== null) {
      const timeStr = programMatch[1];  // "20:00"
      const title = programMatch[2].trim();
      const category = programMatch[3].trim();
      
      // Encontra a data apropriada
      while (currentDateIndex < dateHeaders.length - 1 && 
             programMatch.index > dateHeaders[currentDateIndex + 1].index) {
        currentDateIndex++;
        lastHour = -1;  // Reset ao mudar de bloco
      }
      
      let programDate = new Date(dateHeaders[currentDateIndex].date);
      
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      
      // Detecta virada de meia-noite (ex: 23h → 01h)
      if (lastHour !== -1 && hours < lastHour - 6) {
        programDate = new Date(programDate.getTime() + 24 * 60 * 60 * 1000);
      }
      lastHour = hours;
      
      const startTime = new Date(programDate);
      startTime.setHours(hours, minutes, 0, 0);
      
      // Duração padrão de 1 hora (será ajustada depois)
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
    
    // Ajusta horários de término baseado no próximo programa
    for (let i = 0; i < programs.length - 1; i++) {
      programs[i].endTime = programs[i + 1].startTime;
    }
    
  } catch (e) {
    console.error('[EPG] Erro parsing:', e);
  }
  
  return programs;
}
```

### Decodificação de Entidades HTML

```typescript
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&eacute;': 'é',
    '&aacute;': 'á',
    '&iacute;': 'í',
    '&oacute;': 'ó',
    '&uacute;': 'ú',
    '&atilde;': 'ã',
    '&otilde;': 'õ',
    '&ccedil;': 'ç',
    '&ndash;': '–',
    '&mdash;': '—',
  };
  return text.replace(/&[^;]+;/g, m => entities[m] || m);
}
```

---

## Carregamento em Background

### Inicialização

```typescript
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
```

### Carregamento em Lotes

```typescript
async function loadAllEPGInBackground(): Promise<void> {
  const allChannelIds = Object.keys(channelToMeuGuiaCode);
  console.log(`[EPG] Iniciando carregamento de ${allChannelIds.length} canais...`);
  
  const batchSize = 3;  // 3 canais por vez
  const delayBetweenBatches = 1000;  // 1 segundo entre lotes
  
  for (let i = 0; i < allChannelIds.length; i += batchSize) {
    const batch = allChannelIds.slice(i, i + batchSize);
    
    // Carrega o lote em paralelo
    await Promise.all(
      batch.map(channelId => fetchChannelEPGAsync(channelId))
    );
    
    console.log(`[EPG] Carregados ${Math.min(i + batchSize, allChannelIds.length)}/${allChannelIds.length}`);
    
    // Delay para não sobrecarregar
    if (i + batchSize < allChannelIds.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  console.log('[EPG] Carregamento completo!');
}
```

---

## Sistema de Listeners

### Registro de Listeners

```typescript
type EPGListener = (channelId: string, programs: Program[]) => void;
const listeners: Set<EPGListener> = new Set();

export function onEPGUpdate(listener: EPGListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);  // Função de cleanup
}
```

### Notificação

```typescript
function notifyListeners(channelId: string, programs: Program[]): void {
  listeners.forEach(listener => {
    try {
      listener(channelId, programs);
    } catch (e) {
      console.error('Erro em listener EPG:', e);
    }
  });
}
```

### Uso em Componentes

```typescript
// src/components/ProgramInfo.tsx

useEffect(() => {
  fetchRealEPG();
  
  const unsubscribe = onEPGUpdate((channelId: string) => {
    if (channel && channelId === channel.id) {
      console.log(`[ProgramInfo] EPG atualizado para ${channelId}`);
      updateProgramData();
      setIsLoading(false);
    }
  });
  
  return () => unsubscribe();  // Cleanup
}, [channel]);
```

---

## Funções Públicas da API

### Obter EPG de um Canal

```typescript
export function getChannelEPG(channelId: string): ChannelEPG {
  // Inicia busca em background se necessário
  fetchChannelEPGAsync(channelId);
  
  return {
    channelId,
    programs: epgCache.get(channelId) || [],
  };
}
```

### Obter Programa Atual (Síncrono)

```typescript
export function getCurrentProgram(channelId: string): CurrentProgram | null {
  // Retorna null se não tem cache
  if (!epgCache.has(channelId)) {
    fetchChannelEPGAsync(channelId);
    return null;
  }
  
  const programs = epgCache.get(channelId) || [];
  if (programs.length === 0) return null;
  
  const now = new Date();
  
  // Encontra programa atual
  const current = programs.find(p => p.startTime <= now && p.endTime > now);
  if (!current) return null;
  
  // Encontra próximo programa
  const next = programs.find(p => p.startTime > now);
  
  // Calcula progresso
  const total = current.endTime.getTime() - current.startTime.getTime();
  const elapsed = now.getTime() - current.startTime.getTime();
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
  
  return { current, next: next || null, progress };
}
```

### Obter Programa Atual (Assíncrono)

```typescript
export async function getCurrentProgramAsync(channelId: string): Promise<CurrentProgram | null> {
  await fetchChannelEPGAsync(channelId);  // Aguarda busca
  return getCurrentProgram(channelId);
}
```

### Outras Funções

```typescript
// Busca EPG de múltiplos canais
export function getBulkEPG(channelIds: string[]): Map<string, ChannelEPG> {
  const result = new Map<string, ChannelEPG>();
  channelIds.forEach(id => result.set(id, getChannelEPG(id)));
  return result;
}

// Limpa todo o cache
export function clearEPGCache(): void {
  epgCache.clear();
  lastFetch.clear();
}

// Verifica se canal tem EPG
export function hasEPG(channelId: string): boolean {
  return (epgCache.get(channelId)?.length || 0) > 0;
}

// Estatísticas do EPG
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

// Lista canais com suporte a EPG
export function listEPGChannels(): string[] {
  return Object.keys(channelToMeuGuiaCode);
}

// Força atualização de um canal
export async function refreshChannelEPG(channelId: string): Promise<void> {
  lastFetch.delete(channelId);
  epgCache.delete(channelId);
  await fetchChannelEPGAsync(channelId);
}
```

---

## Componente ProgramInfo

### Estrutura

```typescript
interface ProgramInfoProps {
  channel: Channel;
  isVisible: boolean;
  onOpenGuide: () => void;
}

export const ProgramInfo = memo(function ProgramInfo({ 
  channel, 
  isVisible,
  onOpenGuide 
}: ProgramInfoProps) {
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [upcomingPrograms, setUpcomingPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ...
});
```

### Atualização Periódica

```typescript
useEffect(() => {
  if (!channel) return;
  
  // Busca inicial
  getCurrentProgramAsync(channel.id).then(setCurrentProgram);
  
  // Atualiza a cada 30 segundos
  const interval = setInterval(() => {
    const program = getCurrentProgram(channel.id);
    setCurrentProgram(program);
  }, 30000);
  
  return () => clearInterval(interval);
}, [channel]);
```

---

## Componente ProgramGuide

### Timeline de 24 Horas

```typescript
// Gera slots de horário (0h às 23h)
const timeSlots: Date[] = [];
for (let i = 0; i < 24; i++) {
  const time = new Date(selectedDate);
  time.setHours(i, 0, 0, 0);
  timeSlots.push(time);
}
```

### Cálculo de Posição do Programa

```typescript
const getProgramStyle = (program: Program) => {
  // Posição baseada na hora (200px por hora)
  const startHour = program.startTime.getHours();
  const startMinutes = program.startTime.getMinutes();
  const left = (startHour + startMinutes / 60) * 200;

  // Largura baseada na duração
  const durationMs = program.endTime.getTime() - program.startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const width = Math.max(80, durationHours * 200);  // Mínimo 80px

  return { left: `${left}px`, width: `${width}px` };
};
```

### Marcador "AGORA"

```typescript
const getNowPosition = () => {
  const now = currentTime;
  // Posição: 0h = 0px, 24h = 4800px
  return (now.getHours() + now.getMinutes() / 60) * 200;
};
```

### Scroll para Horário Atual

```typescript
useEffect(() => {
  if (isOpen && programsGridRef.current) {
    setTimeout(() => {
      const now = new Date();
      // Scroll para 1 hora antes do horário atual
      const scrollPosition = Math.max(0, (now.getHours() + now.getMinutes() / 60) * 200 - 200);
      programsGridRef.current.scrollLeft = scrollPosition;
    }, 150);
  }
}, [isOpen]);
```

---

## Implementação para Apps Nativos

### Backend Recomendado

Para apps nativos, crie uma API backend:

```typescript
// Node.js + Express

app.get('/api/epg/:channelId', async (req, res) => {
  const { channelId } = req.params;
  
  // Verifica cache Redis
  const cached = await redis.get(`epg:${channelId}`);
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  // Busca do meuguia.tv
  const programs = await fetchFromMeuGuia(channelId);
  
  // Salva no cache (30 minutos)
  await redis.setex(`epg:${channelId}`, 1800, JSON.stringify(programs));
  
  res.json(programs);
});

// Cron job para atualizar periodicamente
cron.schedule('*/30 * * * *', async () => {
  for (const channelId of allChannelIds) {
    await fetchAndCacheEPG(channelId);
    await sleep(1000);  // Rate limiting
  }
});
```

### Banco de Dados

```sql
CREATE TABLE programs (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_channel_time (channel_id, start_time)
);
```

### API REST

```
GET /api/epg/:channelId
GET /api/epg/:channelId/current
GET /api/epg/:channelId/next
GET /api/epg?date=2024-01-10
POST /api/epg/refresh/:channelId
```

---

## Considerações

### Rate Limiting

O meuguia.tv pode bloquear requisições excessivas:
- Use delay entre requisições
- Implemente cache agressivo
- Considere criar backend próprio

### Mudanças no HTML

O site pode mudar estrutura HTML:
- Monitore erros de parsing
- Tenha fallbacks
- Atualize regex quando necessário

### Alternativas ao meuguia.tv

1. **XMLTV** - Formato padrão de EPG
2. **TVmaze API** - Dados de séries
3. **IMDB** - Informações de filmes
4. **APIs de operadoras** - Se disponível
