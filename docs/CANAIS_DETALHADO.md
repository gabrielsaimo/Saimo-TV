# 📡 Sistema de Canais - Documentação Técnica

## Visão Geral

O sistema de canais gerencia a lista de canais de TV disponíveis, suas categorias, logos e URLs de streaming.

---

## Estrutura de Dados

### Interface Channel

```typescript
// src/types/channel.ts

export interface Channel {
  id: string;           // Identificador único (slug)
  name: string;         // Nome de exibição
  url: string;          // URL do stream HLS
  logo?: string;        // URL do logo
  category?: string;    // Categoria do canal
  channelNumber?: number; // Número do canal na lista
}
```

### Exemplo de Canal

```typescript
{
  id: 'globo-sp',
  name: 'Globo SP',
  url: 'https://canais.fazoeli.co.za/fontes/smart/globosp.m3u8',
  logo: 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil/globo-br.png',
  category: 'TV Aberta',
  channelNumber: 1
}
```

---

## Arquivo de Canais

### Localização

```
src/data/channels.ts
```

### Estrutura do Arquivo

```typescript
import type { Channel } from '../types/channel';

// URLs base para logos
const LOGO_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil';
const LOGO_INTL = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/international';
const LOGO_US = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states';

// Função fallback para logos
const getFallbackLogo = (name: string) => {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=8b5cf6&color=fff&size=128&bold=true&format=png`;
};

// Lista bruta de canais
const rawChannels = [
  // ... definição dos canais
];

// Ordem das categorias
export const categoryOrder = [
  'TV Aberta',
  'Filmes',
  'Series',
  'Esportes',
  'Noticias',
  'Infantil',
  'Documentarios',
  'Entretenimento',
  'Adulto',
];

// Canais processados (ordenados e com número)
export const channels: Channel[] = /* processamento */;

// Canais adultos (separados)
export const adultChannels: Channel[] = /* filtro adulto */;

// Função para obter todos os canais
export const getAllChannels = (includeAdult: boolean): Channel[] => {
  if (includeAdult) {
    return allChannels;
  }
  return channels;
};
```

---

## Categorias de Canais

### Lista Completa

| Categoria | Descrição | Exemplos |
|-----------|-----------|----------|
| TV Aberta | Canais broadcast gratuitos | Globo, SBT, Record, Band |
| Filmes | Canais de cinema | HBO, Telecine, Cinemax |
| Series | Canais de séries | Warner, TNT, AXN, Sony |
| Esportes | Canais esportivos | SporTV, ESPN, Premiere |
| Noticias | Canais de notícias | Globo News, CNN Brasil |
| Infantil | Canais infantis | Cartoon, Gloob, Disney |
| Documentarios | Canais documentários | Discovery, History, NatGeo |
| Entretenimento | Variedades | Multishow, GNT, Comedy |
| Adulto | Conteúdo adulto (secreto) | Playboy TV, Sexy Hot |

### Ordenação

```typescript
// Os canais são ordenados:
// 1. Por categoria (seguindo categoryOrder)
// 2. Alfabeticamente dentro de cada categoria

const sortedByCategory = [...rawChannels].sort((a, b) => {
  const catIndexA = categoryOrder.indexOf(a.category);
  const catIndexB = categoryOrder.indexOf(b.category);
  
  // Primeiro por categoria
  if (catIndexA !== catIndexB) return catIndexA - catIndexB;
  
  // Depois alfabeticamente
  return a.name.localeCompare(b.name, 'pt-BR');
});
```

---

## Sistema de URLs de Stream

### Formato Padrão

```
https://canais.fazoeli.co.za/fontes/smart/{canal}.m3u8
```

### Exemplos por Categoria

#### TV Aberta
```typescript
{ id: 'globo-sp', url: 'https://canais.fazoeli.co.za/fontes/smart/globosp.m3u8' },
{ id: 'sbt', url: 'https://canais.fazoeli.co.za/fontes/smart/sbt.m3u8' },
{ id: 'record', url: 'https://canais.fazoeli.co.za/fontes/smart/record.m3u8' },
{ id: 'band', url: 'https://canais.fazoeli.co.za/fontes/smart/band.m3u8' },
```

#### Filmes (HBO)
```typescript
{ id: 'hbo', url: 'https://canais.fazoeli.co.za/fontes/smart/hbo.m3u8' },
{ id: 'hbo2', url: 'https://canais.fazoeli.co.za/fontes/smart/hbo2.m3u8' },
{ id: 'hbo-family', url: 'https://canais.fazoeli.co.za/fontes/smart/hbofamily.m3u8' },
{ id: 'hbo-plus', url: 'https://canais.fazoeli.co.za/fontes/smart/hboplus.m3u8' },
```

#### Filmes (Telecine)
```typescript
{ id: 'telecine-action', url: 'https://canais.fazoeli.co.za/fontes/smart/telecineaction.m3u8' },
{ id: 'telecine-premium', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinepremium.m3u8' },
{ id: 'telecine-pipoca', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinepipoca.m3u8' },
```

#### Esportes
```typescript
{ id: 'sportv', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv.m3u8' },
{ id: 'sportv2', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv2.m3u8' },
{ id: 'espn', url: 'https://canais.fazoeli.co.za/fontes/smart/espn.m3u8' },
{ id: 'premiere', url: 'https://canais.fazoeli.co.za/fontes/smart/premiere.m3u8' },
```

---

## Sistema de Logos

### Fontes Principais

1. **tv-logo/tv-logos (GitHub)**
   - Repositório open-source com logos de TVs mundiais
   - Formato: PNG transparente
   - Qualidade: Alta

```typescript
// Brasil
const LOGO_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil';

// Internacional  
const LOGO_INTL = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/international';

// Estados Unidos
const LOGO_US = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states';
```

### Padrão de Nomenclatura

```
{nome-do-canal}-{país}.png

Exemplos:
- globo-br.png
- hbo-br.png
- espn-int.png
- discovery-channel-int.png
```

### Sistema de Fallback

Quando o logo principal não carrega:

```typescript
// Gera avatar com iniciais
const getFallbackLogo = (name: string) => {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
    
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=8b5cf6&color=fff&size=128&bold=true&format=png`;
};

// Resultado: Avatar roxo com iniciais brancas
// "Globo SP" → "GS"
// "HBO" → "HB"
```

### Fallback no Componente

```tsx
// src/components/ChannelCard.tsx

const [imgError, setImgError] = useState(false);

const initials = name
  .split(' ')
  .map((word) => word[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

return (
  <div className="channel-logo">
    {logo && !imgError ? (
      <img 
        src={logo} 
        alt={name} 
        onError={() => setImgError(true)}  // Ativa fallback
      />
    ) : (
      <span className="channel-initials">{initials}</span>
    )}
  </div>
);
```

---

## Lista Completa de Canais

### TV Aberta

| ID | Nome | Categoria |
|----|------|-----------|
| globo-sp | Globo SP | TV Aberta |
| globo-rj | Globo RJ | TV Aberta |
| globo-mg | Globo MG | TV Aberta |
| globo-rs | Globo RS | TV Aberta |
| sbt | SBT | TV Aberta |
| band | Band | TV Aberta |
| record | Record TV | TV Aberta |
| rede-tv | RedeTV! | TV Aberta |
| tv-brasil | TV Brasil | TV Aberta |
| aparecida | TV Aparecida | TV Aberta |
| tv-gazeta | TV Gazeta | TV Aberta |

### Filmes

| ID | Nome | Categoria |
|----|------|-----------|
| telecine-action | Telecine Action | Filmes |
| telecine-premium | Telecine Premium | Filmes |
| telecine-pipoca | Telecine Pipoca | Filmes |
| telecine-fun | Telecine Fun | Filmes |
| telecine-touch | Telecine Touch | Filmes |
| telecine-cult | Telecine Cult | Filmes |
| hbo | HBO | Filmes |
| hbo2 | HBO 2 | Filmes |
| hbo-family | HBO Family | Filmes |
| hbo-mundi | HBO Mundi | Filmes |
| hbo-pop | HBO Pop | Filmes |
| hbo-xtreme | HBO Xtreme | Filmes |
| hbo-plus | HBO Plus | Filmes |
| tcm | TCM | Filmes |
| space | Space | Filmes |
| cinemax | Cinemax | Filmes |
| megapix | Megapix | Filmes |
| studio-universal | Studio Universal | Filmes |

### Séries

| ID | Nome | Categoria |
|----|------|-----------|
| warner | Warner Channel | Series |
| tnt | TNT | Series |
| tnt-series | TNT Series | Series |
| axn | AXN | Series |
| sony | Sony Channel | Series |
| universal-tv | Universal TV | Series |
| ae | A&E | Series |
| amc | AMC | Series |

### Esportes

| ID | Nome | Categoria |
|----|------|-----------|
| sportv | SporTV | Esportes |
| sportv2 | SporTV 2 | Esportes |
| sportv3 | SporTV 3 | Esportes |
| sportv4 | SporTV 4 | Esportes |
| espn | ESPN | Esportes |
| espn2 | ESPN 2 | Esportes |
| espn3 | ESPN 3 | Esportes |
| espn4 | ESPN 4 | Esportes |
| espn5 | ESPN 5 | Esportes |
| premiere | Premiere | Esportes |
| premiere2 | Premiere 2 | Esportes |
| premiere3 | Premiere 3 | Esportes |
| premiere4 | Premiere 4 | Esportes |
| combate | Combate | Esportes |
| band-sports | Band Sports | Esportes |

### Notícias

| ID | Nome | Categoria |
|----|------|-----------|
| globo-news | Globo News | Noticias |
| cnn-brasil | CNN Brasil | Noticias |
| band-news | Band News | Noticias |
| record-news | Record News | Noticias |

### Infantil

| ID | Nome | Categoria |
|----|------|-----------|
| gloob | Gloob | Infantil |
| gloobinho | Gloobinho | Infantil |
| cartoon-network | Cartoon Network | Infantil |
| cartoonito | Cartoonito | Infantil |
| discovery-kids | Discovery Kids | Infantil |
| nickelodeon | Nickelodeon | Infantil |
| adult-swim | Adult Swim | Infantil |
| 24h-simpsons | 24h Simpsons | Infantil |
| 24h-dragonball | 24h Dragon Ball | Infantil |
| 24h-odeia-chris | 24h Todo Mundo Odeia o Chris | Infantil |

### Documentários

| ID | Nome | Categoria |
|----|------|-----------|
| discovery | Discovery Channel | Documentarios |
| discovery-turbo | Discovery Turbo | Documentarios |
| discovery-world | Discovery World | Documentarios |
| discovery-science | Discovery Science | Documentarios |
| discovery-hh | Discovery H&H | Documentarios |
| discovery-id | Investigation Discovery | Documentarios |
| animal-planet | Animal Planet | Documentarios |
| history | History | Documentarios |
| history2 | History 2 | Documentarios |
| food-network | Food Network | Documentarios |
| tlc | TLC | Documentarios |
| hgtv | HGTV | Documentarios |

### Entretenimento

| ID | Nome | Categoria |
|----|------|-----------|
| multishow | Multishow | Entretenimento |
| bis | BIS | Entretenimento |
| viva | Viva | Entretenimento |
| off | OFF | Entretenimento |
| gnt | GNT | Entretenimento |
| arte1 | Arte 1 | Entretenimento |
| cultura | TV Cultura | Entretenimento |

---

## Sistema de Favoritos

### Armazenamento

```typescript
// Usa localStorage via hook customizado
const [favorites, setFavorites] = useLocalStorage<string[]>('tv-favorites', []);

// Formato: Array de IDs
// ['globo-sp', 'hbo', 'sportv']
```

### Funções

```typescript
// Adicionar/remover favorito
const handleToggleFavorite = useCallback((channelId: string) => {
  setFavorites((prev) => {
    if (prev.includes(channelId)) {
      return prev.filter((id) => id !== channelId);  // Remove
    } else {
      return [...prev, channelId];  // Adiciona
    }
  });
}, []);

// Verificar se é favorito
const isFavorite = favorites.includes(channel.id);
```

### Filtro de Favoritos

```typescript
const filteredChannels = useMemo(() => {
  let result = channels;

  if (filter === 'favorites') {
    result = result.filter((ch) => favorites.includes(ch.id));
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter(
      (ch) =>
        ch.name.toLowerCase().includes(query) ||
        ch.category?.toLowerCase().includes(query)
    );
  }

  return result;
}, [channels, favorites, filter, searchQuery]);
```

---

## Modo Adulto (Secreto)

### Desbloqueio

```typescript
const SECRET_CLICK_COUNT = 15;  // Cliques necessários
const [secretClickCount, setSecretClickCount] = useState(0);

const handleLogoClick = () => {
  if (isAdultModeUnlocked) return;

  // Reset após 3 segundos sem clique
  if (secretClickTimeoutRef.current) {
    clearTimeout(secretClickTimeoutRef.current);
  }
  secretClickTimeoutRef.current = setTimeout(() => {
    setSecretClickCount(0);
  }, 3000);

  const newCount = secretClickCount + 1;
  setSecretClickCount(newCount);

  if (newCount >= SECRET_CLICK_COUNT) {
    onUnlockAdultMode();
    setSecretClickCount(0);
  }
};
```

### Persistência

```typescript
const [adultModeUnlocked, setAdultModeUnlocked] = useLocalStorage<boolean>('tv-adult-mode', false);
```

### Exibição Condicional

```typescript
// Obtém canais baseado no modo
const channels = getAllChannels(adultModeUnlocked);

// No logo, mostra indicador
{isAdultModeUnlocked && (
  <span className="adult-badge" onClick={onLockAdultMode}>
    🔓
  </span>
)}
```

---

## Como Adicionar Novos Canais

### Passo 1: Definir o Canal

```typescript
// Em src/data/channels.ts, adicione ao array rawChannels:

{ 
  id: 'novo-canal',                    // Único, lowercase, sem espaços
  name: 'Novo Canal HD',               // Nome de exibição
  url: 'https://url-do-stream.m3u8',   // URL HLS
  category: 'Entretenimento',          // Categoria existente
  logo: `${LOGO_BASE}/novo-canal-br.png`  // URL do logo
},
```

### Passo 2: Verificar o Logo

Se não existir logo no repositório tv-logos:

```typescript
{ 
  id: 'novo-canal',
  name: 'Novo Canal HD',
  url: 'https://url-do-stream.m3u8',
  category: 'Entretenimento',
  logo: getFallbackLogo('Novo Canal HD')  // Usa avatar com iniciais
},
```

### Passo 3: Adicionar ao EPG (Opcional)

Se o canal tiver EPG no meuguia.tv:

```typescript
// Em src/services/epgService.ts, adicione ao mapeamento:

const channelToMeuGuiaCode: Record<string, string> = {
  // ...
  'novo-canal': 'NVC',  // Código do meuguia.tv
};
```

### Passo 4: Nova Categoria (Se necessário)

```typescript
// Adicionar à ordem de categorias
export const categoryOrder = [
  // ... categorias existentes
  'Nova Categoria',
];

// Os canais dessa categoria serão automaticamente agrupados
```

---

## Estrutura para Backend/API

Para uma implementação mais robusta, considere criar uma API:

### Schema do Banco de Dados

```sql
CREATE TABLE channels (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  logo_url TEXT,
  category VARCHAR(100),
  channel_number INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_order INT NOT NULL
);
```

### API REST

```
GET /api/channels
GET /api/channels/:id
GET /api/channels/category/:category
POST /api/channels (admin)
PUT /api/channels/:id (admin)
DELETE /api/channels/:id (admin)
```

### Exemplo de Resposta

```json
{
  "channels": [
    {
      "id": "globo-sp",
      "name": "Globo SP",
      "url": "https://...",
      "logo": "https://...",
      "category": "TV Aberta",
      "channelNumber": 1,
      "epgCode": "GRD"
    }
  ],
  "categories": [
    { "name": "TV Aberta", "order": 1 },
    { "name": "Filmes", "order": 2 }
  ],
  "total": 95
}
```
