# 📋 Implementação de Tendências TMDB

## 🎯 Objetivo

Implementar seções de **"Tendências de Hoje"** e **"Tendências da Semana"** na tela `/movies`, inspirado no site [themoviedb.org](https://www.themoviedb.org/?language=pt-BR), exibindo apenas conteúdos que existem no catálogo local.

---

## 📁 Arquivos Criados

### `src/services/trendingService.ts`

Novo serviço responsável por buscar e gerenciar as tendências do TMDB.

#### Funções Exportadas

| Função | Descrição |
|--------|-----------|
| `getTrendingToday()` | Retorna tendências de hoje que existem no catálogo |
| `getTrendingWeek()` | Retorna tendências da semana que existem no catálogo |
| `getAllTrending()` | Busca ambas as listas de forma eficiente em paralelo |
| `clearTrendingCache()` | Limpa o cache para forçar refresh |

#### Funções Internas

| Função | Descrição |
|--------|-----------|
| `fetchTMDBTrending(timeWindow)` | Busca tendências da API TMDB (hoje ou semana) com múltiplas páginas |
| `filterTrendingByLocalCatalog(items)` | Filtra os itens retornados pelo TMDB para mostrar apenas os que existem no catálogo local |

#### Configurações

```typescript
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
```

---

## 📁 Arquivos Modificados

### `src/components/MovieCatalogV2.tsx`

#### 1. Novo Import

```typescript
import { getTrendingToday, getTrendingWeek } from '../services/trendingService';
```

#### 2. Novos Estados

```typescript
// Tendências TMDB
const [trendingToday, setTrendingToday] = useState<EnrichedMovie[]>([]);
const [trendingWeek, setTrendingWeek] = useState<EnrichedMovie[]>([]);
const [trendingLoading, setTrendingLoading] = useState(true);
```

#### 3. Carregamento na Inicialização

```typescript
// Carrega tendências do TMDB
setTrendingLoading(true);
Promise.all([getTrendingToday(), getTrendingWeek()])
  .then(([today, week]) => {
    setTrendingToday(today);
    setTrendingWeek(week);
  })
  .catch(err => {
    console.error('Erro ao carregar tendências:', err);
  })
  .finally(() => {
    setTrendingLoading(false);
  });
```

#### 4. Renderização dos Carrosséis

```tsx
{/* Tendências de Hoje */}
{(trendingLoading || trendingToday.length > 0) && (
  <CategoryCarousel
    title="🔥 Tendências de Hoje"
    items={trendingToday.slice(0, 20)}
    onSelect={handleSelectItem}
    loading={trendingLoading}
  />
)}

{/* Tendências da Semana */}
{(trendingLoading || trendingWeek.length > 0) && (
  <CategoryCarousel
    title="📅 Tendências da Semana"
    items={trendingWeek.slice(0, 20)}
    onSelect={handleSelectItem}
    loading={trendingLoading}
  />
)}
```

---

## 🔄 Fluxo de Funcionamento

```
1. Usuário acessa /movies
         ↓
2. MovieCatalogV2 inicializa
         ↓
3. Dados enriched são carregados (initializeEnrichedData)
         ↓
4. Em paralelo: getTrendingToday() e getTrendingWeek()
         ↓
5. API TMDB retorna tendências (5 páginas, ~100 itens)
         ↓
6. filterTrendingByLocalCatalog() filtra usando findByTmdbId()
         ↓
7. Apenas itens DO CATÁLOGO LOCAL são retornados
         ↓
8. Carrosséis são renderizados com até 20 itens cada
```

---

## 🎨 Resultado Visual

Na tela `/movies`, a ordem de exibição agora é:

1. **Hero Banner** (destaque rotativo)
2. **🔥 Tendências de Hoje** ← NOVO
3. **📅 Tendências da Semana** ← NOVO
4. **📺 Categorias de Streaming** (Netflix, Prime, etc.)
5. **🎬 Lançamentos**
6. **🎬 Categorias de Gênero**

```
┌─────────────────────────────────────────┐
│           🎬 HERO BANNER                │
├─────────────────────────────────────────┤
│  🔥 Tendências de Hoje                  │
│  [Card] [Card] [Card] [Card] [Card] →   │
├─────────────────────────────────────────┤
│  📅 Tendências da Semana                │
│  [Card] [Card] [Card] [Card] [Card] →   │
├─────────────────────────────────────────┤
│  📺 Netflix                             │
│  📺 Prime Video                         │
│  ... demais categorias                  │
└─────────────────────────────────────────┘
```

---

## ⚡ Características Técnicas

| Recurso | Implementação |
|---------|--------------|
| **Performance** | Cache de 30 minutos, busca em paralelo |
| **UX** | Skeleton loading durante carregamento |
| **Filtro** | Só mostra itens que existem no catálogo |
| **Responsividade** | Usa `CategoryCarousel` existente com scroll horizontal |
| **Tratamento de erro** | Falhas não quebram a aplicação |
| **Ocultação inteligente** | Seção não aparece se não houver matches |

---

## 🔧 API TMDB Utilizada

### Endpoints

```
GET https://api.themoviedb.org/3/trending/all/day
GET https://api.themoviedb.org/3/trending/all/week
```

### Parâmetros

| Parâmetro | Valor |
|-----------|-------|
| `api_key` | Chave pública TMDB |
| `language` | `pt-BR` |
| `page` | 1 a 5 |

### Resposta Esperada

```typescript
interface TMDBTrendingResponse {
  page: number;
  results: TMDBTrendingResult[];
  total_pages: number;
  total_results: number;
}

interface TMDBTrendingResult {
  id: number;
  title?: string;        // para filmes
  name?: string;         // para séries
  media_type: 'movie' | 'tv';
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}
```

---

## 🧪 Como Testar

1. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Acesse a rota `/movies`

3. Verifique se os carrosséis de tendências aparecem logo abaixo do Hero Banner

4. Os itens exibidos devem ser apenas aqueles que existem no seu catálogo local

5. No console do navegador, você verá logs como:
   ```
   🔥 Buscando tendências de hoje no TMDB...
   ✅ Encontrados X itens de tendências de hoje no catálogo
   📅 Buscando tendências da semana no TMDB...
   ✅ Encontrados Y itens de tendências da semana no catálogo
   ```

---

## 📝 Notas Importantes

- **Somente itens do catálogo**: A implementação filtra rigorosamente para mostrar apenas conteúdos que você possui no catálogo local
- **Cache automático**: As tendências são cacheadas por 30 minutos para evitar requisições excessivas à API
- **Fallback gracioso**: Se a API falhar ou não houver matches, a seção simplesmente não é exibida
- **Limite de itens**: Cada carrossel mostra no máximo 20 itens para manter a performance

---

## 📅 Data da Implementação

**18 de Janeiro de 2026**
