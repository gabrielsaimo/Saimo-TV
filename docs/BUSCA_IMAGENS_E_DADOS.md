# 📸 Sistema de Busca de Imagens, Pontuação e Classificação

Este documento explica como o sistema busca imagens, pontuação (rating) e classificação indicativa de forma **assertiva** usando ano e categoria.

---

## 📁 Arquivo Principal

**Localização:** `src/services/imageService.ts`

---

## 🎯 Conceito Principal: Sistema de Score

O sistema usa um algoritmo de **pontuação (score)** para encontrar o resultado mais preciso quando há múltiplos resultados com o mesmo nome (ex: "One Piece" anime vs live-action).

### Critérios de Pontuação

| Critério | Pontos | Descrição |
|----------|--------|-----------|
| Título exato | +50 | Nome corresponde exatamente |
| Título parcial | +30 | Nome contém a busca |
| Ano exato | +40 | Ano do título = ano do resultado |
| Ano próximo (±1) | +20 | Diferença de 1 ano |
| Ano próximo (±3) | +5 | Diferença de até 3 anos |
| Ano diferente | -3×diff | Penaliza anos muito diferentes |
| É anime esperado | +35 | Categoria anime + resultado anime |
| É animação | +15 | Resultado é animação |
| Anime não esperado | -20 | Resultado anime mas categoria não é |
| Live-action esperado | +15 | Categoria streaming + resultado live |
| Netflix + origem US | +10 | Bônus para conteúdo Netflix americano |
| Muitos votos | +5 | Resultado com +100 votos (confiável) |

---

## 🔧 Funções Disponíveis

### 1. `searchImage(title, type?, category?)`

Busca a **imagem/poster** do filme ou série.

```typescript
import { searchImage } from '../services/imageService';

// Busca simples
const poster = await searchImage('Breaking Bad', 'series');

// Busca assertiva com categoria
const posterAnime = await searchImage('One Piece (1999)', 'series', 'Crunchyroll');
const posterLive = await searchImage('One Piece', 'series', 'Netflix');
```

**Retorno:** URL da imagem ou `null`

---

### 2. `searchRating(title, type?, category?)`

Busca a **nota/pontuação** (0-10) do TMDB.

```typescript
import { searchRating } from '../services/imageService';

// Busca assertiva
const rating = await searchRating('One Piece (1999)', 'series', 'Crunchyroll');
// Retorna: 8.7 (nota do anime)

const ratingLive = await searchRating('One Piece', 'series', 'Netflix');
// Retorna: 8.4 (nota da série live-action)
```

**Retorno:** Número (0-10) ou `null`

---

### 3. `searchCertification(title, type?, category?)`

Busca a **classificação indicativa** (L, 10, 12, 14, 16, 18).

```typescript
import { searchCertification } from '../services/imageService';

const cert = await searchCertification('Stranger Things', 'series', 'Netflix');
// Retorna: "14" ou "16"
```

**Retorno:** String com classificação ou `null`

---

### 4. `searchMovieDetails(title, type?, category?)`

Busca **todos os detalhes** de um filme/série.

```typescript
import { searchMovieDetails, type MovieDetails } from '../services/imageService';

const details = await searchMovieDetails('Interestelar', 'movie', 'Prime Video');
```

**Retorno:** Objeto `MovieDetails`:

```typescript
interface MovieDetails {
  id: number;              // ID do TMDB
  title: string;           // Título em português
  originalTitle: string;   // Título original
  overview: string;        // Sinopse
  releaseDate: string;     // Data de lançamento
  year: string;            // Ano
  runtime: number;         // Duração em minutos
  genres: string[];        // Gêneros
  rating: number;          // Nota (0-10)
  voteCount: number;       // Quantidade de votos
  certification: string;   // Classificação indicativa
  posterPath: string;      // URL do poster
  backdropPath: string;    // URL do backdrop
  director: string;        // Diretor
  cast: string[];          // Elenco principal (5)
  tagline: string;         // Frase de efeito
}
```

---

## 🏷️ Categorias de Anime (Auto-detectadas)

O sistema detecta automaticamente se a categoria indica anime:

```typescript
const ANIME_CATEGORIES = [
  'crunchyroll',
  'funimation', 
  'anime',
  'animes',
  'animação'
];
```

Se a categoria contiver alguma dessas palavras, o sistema prioriza resultados de anime japonês.

---

## 📅 Extração de Ano

O sistema extrai automaticamente o ano do título:

```typescript
// Exemplos de títulos com ano
"One Piece (1999) S15E100"     → ano: 1999
"Avatar (2009)"                → ano: 2009
"Dune (2021)"                  → ano: 2021
"Breaking Bad"                 → ano: null (sem ano)
```

**Regex usado:** `/\((\d{4})\)/`

---

## 💾 Sistema de Cache

Todas as funções usam cache para evitar requisições repetidas:

```typescript
// Caches disponíveis
imageCache         // Cache de imagens
ratingCache        // Cache de ratings
certificationCache // Cache de classificações
detailsCache       // Cache de detalhes completos
```

**Chave do cache inclui:**
- Tipo (movie/series/multi)
- Título limpo
- Ano (se disponível)
- Categoria (se disponível)

---

## 🔄 Como Modificar o Algoritmo de Score

### Alterar pesos

Edite a função `calculateMatchScore` em `imageService.ts`:

```typescript
function calculateMatchScore(
  result: TMDBResult, 
  searchTitle: string, 
  targetYear: number | null, 
  expectAnime: boolean,
  category?: string
): number {
  let score = 0;
  
  // === MODIFIQUE OS PESOS AQUI ===
  
  // Score por título (ajuste os valores)
  if (/* título exato */) {
    score += 50;  // ← Mude este valor
  }
  
  // Score por ano (ajuste os valores)
  if (year === targetYear) {
    score += 40;  // ← Mude este valor
  }
  
  // Score por tipo anime/live-action
  if (expectAnime && isLikelyAnime) {
    score += 35;  // ← Mude este valor
  }
  
  return score;
}
```

### Adicionar novas categorias de anime

```typescript
// No topo do arquivo
const ANIME_CATEGORIES = [
  'crunchyroll',
  'funimation', 
  'anime',
  'animes',
  'animação',
  'sua_nova_categoria'  // ← Adicione aqui
];
```

### Adicionar bonus para outras plataformas

```typescript
// Dentro de calculateMatchScore
if (category) {
  const normalizedCategory = category.toLowerCase();
  
  // Bonus Netflix
  if (normalizedCategory.includes('netflix')) {
    if (result.origin_country?.includes('US')) {
      score += 10;
    }
  }
  
  // === ADICIONE NOVOS BONUS AQUI ===
  if (normalizedCategory.includes('disney')) {
    // Lógica para Disney+
    score += 5;
  }
}
```

---

## 📝 Exemplo Prático: One Piece

### Cenário
- **One Piece (1999)** - Anime com 1000+ episódios
- **One Piece (2023)** - Série live-action Netflix

### Busca na Crunchyroll
```typescript
searchImage('One Piece (1999) S15E100', 'series', 'Crunchyroll')
```

**Cálculo de Score:**

| Resultado | Título | Ano | Anime? | Score |
|-----------|--------|-----|--------|-------|
| Anime 1999 | +50 | +40 | +35 | **125** ✅ |
| Live 2023 | +50 | -72 | -20 | **-42** ❌ |

### Busca na Netflix
```typescript
searchImage('One Piece', 'series', 'Netflix')
```

| Resultado | Título | Ano | Live? | Netflix | Score |
|-----------|--------|-----|-------|---------|-------|
| Live 2023 | +50 | 0 | +15 | +10 | **75** ✅ |
| Anime 1999 | +50 | 0 | -20 | 0 | **30** ❌ |

---

## 🛠️ API do TMDB

O sistema usa a API gratuita do TMDB (The Movie Database).

**Base URL:** `https://api.themoviedb.org/3`

**Endpoints usados:**
- `search/movie` - Busca filmes
- `search/tv` - Busca séries
- `search/multi` - Busca ambos
- `movie/{id}` - Detalhes do filme
- `tv/{id}` - Detalhes da série

**Imagens:**
- Poster: `https://image.tmdb.org/t/p/w500{poster_path}`
- Backdrop: `https://image.tmdb.org/t/p/w1280{backdrop_path}`

---

## 🔍 Debug: Ver Score dos Resultados

Para debugar, adicione logs na função `findBestMatchWithContext`:

```typescript
function findBestMatchWithContext(
  results: TMDBResult[], 
  searchTitle: string, 
  targetYear: number | null,
  category?: string
): TMDBResult | null {
  // ... código existente ...
  
  // ADICIONE ISSO PARA DEBUG
  console.log('=== DEBUG SCORES ===');
  console.log('Busca:', searchTitle, 'Ano:', targetYear, 'Categoria:', category);
  scoredResults.forEach(({ result, score }) => {
    const title = result.title || result.name;
    const year = result.release_date || result.first_air_date;
    console.log(`${title} (${year}) = Score: ${score}`);
  });
  console.log('Escolhido:', scoredResults[0].result.title || scoredResults[0].result.name);
  
  // ... resto do código ...
}
```

---

## ✅ Checklist de Uso

1. ✅ Sempre passar o **título completo** incluindo ano se disponível
2. ✅ Sempre passar a **categoria** para busca assertiva
3. ✅ Usar o **tipo correto** ('movie' ou 'series')
4. ✅ Tratar retorno `null` (quando não encontra)
5. ✅ Aproveitar o **cache** (não precisa de rate limiting)

---

## 📚 Referências

- [TMDB API Documentation](https://developers.themoviedb.org/3)
- [TMDB Image Configuration](https://developers.themoviedb.org/3/configuration/get-api-configuration)
- Arquivo fonte: `src/services/imageService.ts`
