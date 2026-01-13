/**
 * Script para parsear o arquivo ListaBR02.m3u8 e gerar dados de filmes/séries
 * Usa apenas a partir da linha 2294 onde começam os filmes
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Movie {
  id: string;
  name: string;
  url: string;
  logo?: string;
  category: string;
  type: 'movie' | 'series';
  isAdult?: boolean;
}

// Categorias adultas
const ADULT_CATEGORIES = [
  '(XXXX) ADULTOS',
  '♦️[HOT] Adultos ❌❤️',
  '♦️[HOT] Adultos ❌❤️ [Bella da Semana]',
  '♦️[HOT] Adultos ❌❤️ [LEGENDADO]',
];

// Categorias que devem ser ignoradas (não são filmes/séries)
const IGNORED_CATEGORIES = [
  'Área do cliente',
  'A FAZENDA',
  'BBB 2026',
  'ESTRELA DA CASA',
  '⚽APPLETV+',
  '⚽DAZN',
  '⚽DISNEY +',
  '⚽ESPORTE',
  '⚽ESPORTES PPV',
  '⚽HBO MAX',
  '⚽PARAMOUNT +',
  '⚽PREMIERE',
  '⚽PRIME VIDEO',
  '⚽ COPINHA 2026',
  // Categorias GLOBO regionais e notícias
  '⏺️ GLOBO',
  '⏺️ GLOBO (CENTRO-OESTE)',
  '⏺️ GLOBO (NORDESTE)',
  '⏺️ GLOBO (NORTE)',
  '⏺️ GLOBO (SUDESTE)',
  '⏺️ GLOBO (SUL)',
  'GLOBO (CENTRO-OESTE)',
  'GLOBO (NORDESTE)',
  'GLOBO (NORTE)',
  'GLOBO (SUDESTE)',
  'GLOBO (SUL)',
  '⏺️ NOTICIA',
  'NOTICIA',
];

// Categorias que indicam séries
const SERIES_INDICATORS = [
  'series',
  'série',
  'novelas',
  'doramas',
  'programas',
  'stand up',
  '24h',
];

function generateId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function isSeriesCategory(category: string): boolean {
  const lowerCat = category.toLowerCase();
  return SERIES_INDICATORS.some(ind => lowerCat.includes(ind));
}

function isAdultCategory(category: string): boolean {
  return ADULT_CATEGORIES.some(adult => 
    category.toLowerCase().includes(adult.toLowerCase()) || 
    category.includes('ADULTOS') ||
    category.includes('[HOT]') ||
    category.includes('❌❤️')
  );
}

function shouldIgnoreCategory(category: string): boolean {
  return IGNORED_CATEGORIES.some(ignored => 
    category.toLowerCase() === ignored.toLowerCase()
  );
}

function cleanName(name: string): string {
  return name
    .replace(/^\d+\s*[-–]\s*/, '') // Remove número no início
    .replace(/\s*\[L\]\s*$/i, '')   // Remove [L] do final (legendado)
    .replace(/\s*\(DUB\)\s*/gi, '') // Remove (DUB)
    .replace(/\s*\(LEG\)\s*/gi, '') // Remove (LEG)
    .trim();
}

async function parseM3U8(filePath: string, startLine: number): Promise<Movie[]> {
  console.log(`📂 Lendo arquivo: ${filePath}`);
  console.log(`📍 A partir da linha: ${startLine}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').slice(startLine - 1);
  
  console.log(`📊 Total de linhas a processar: ${lines.length}`);
  
  const movies: Movie[] = [];
  const seenUrls = new Set<string>();
  
  let currentInfo: Partial<Movie> | null = null;
  let processedLines = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#EXTINF:')) {
      // Parse info line
      // Formato: #EXTINF:-1 group-title="Categoria" tvg-logo="url",Nome
      
      const groupMatch = trimmed.match(/group-title="([^"]+)"/);
      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
      const nameMatch = trimmed.match(/,(.+)$/);
      
      if (nameMatch) {
        const category = groupMatch ? groupMatch[1] : 'Outros';
        
        // Ignorar categorias não relevantes
        if (shouldIgnoreCategory(category)) {
          currentInfo = null;
          continue;
        }
        
        const name = cleanName(nameMatch[1]);
        const isAdult = isAdultCategory(category);
        // Padrões mais abrangentes para detectar séries
        const isSeries = isSeriesCategory(category) || 
                        /S\d+\s*E\d+|T\d+\s*E\d+|\d+\s*x\s*\d+|Temporada\s*\d+|Temp\.?\s*\d+|Season\s*\d+/i.test(name);
        
        currentInfo = {
          name,
          category,
          logo: logoMatch ? logoMatch[1] : undefined,
          type: isSeries ? 'series' : 'movie',
          isAdult,
        };
      }
    } else if (trimmed.startsWith('http') && currentInfo) {
      // URL line
      if (!seenUrls.has(trimmed)) {
        seenUrls.add(trimmed);
        
        const id = generateId(currentInfo.name || 'unknown');
        let uniqueId = id;
        let counter = 1;
        
        // Garantir ID único
        while (movies.some(m => m.id === uniqueId)) {
          uniqueId = `${id}-${counter++}`;
        }
        
        movies.push({
          id: uniqueId,
          name: currentInfo.name!,
          url: trimmed,
          logo: currentInfo.logo,
          category: currentInfo.category!,
          type: currentInfo.type!,
          isAdult: currentInfo.isAdult,
        });
      }
      currentInfo = null;
    }
    
    processedLines++;
    if (processedLines % 50000 === 0) {
      console.log(`⏳ Processado ${processedLines} linhas, ${movies.length} filmes encontrados...`);
    }
  }
  
  return movies;
}

async function main() {
  const m3u8Path = path.join(__dirname, '../src/assets/ListaBR02.m3u8');
  const outputPath = path.join(__dirname, '../src/data/movies.ts');
  const chunksDir = path.join(__dirname, '../public/data');
  
  console.log('🎬 Parser de Filmes/Séries - ListaBR02.m3u8');
  console.log('='.repeat(50));
  
  const allMovies = await parseM3U8(m3u8Path, 2294);
  
  console.log(`\n✅ Total de items: ${allMovies.length}`);
  
  // Estatísticas por categoria
  const categories = new Map<string, number>();
  let adultCount = 0;
  let seriesCount = 0;
  let movieCount = 0;
  
  allMovies.forEach(m => {
    categories.set(m.category, (categories.get(m.category) || 0) + 1);
    if (m.isAdult) adultCount++;
    if (m.type === 'series') seriesCount++;
    else movieCount++;
  });
  
  console.log(`\n📊 Estatísticas:`);
  console.log(`   Filmes: ${movieCount}`);
  console.log(`   Séries: ${seriesCount}`);
  console.log(`   Adultos: ${adultCount}`);
  console.log(`   Categorias: ${categories.size}`);
  
  // Criar diretório para chunks se não existir
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }
  
  // Agrupar por categoria e criar chunks JSON
  const categoryData = new Map<string, Movie[]>();
  allMovies.forEach(m => {
    if (!categoryData.has(m.category)) {
      categoryData.set(m.category, []);
    }
    categoryData.get(m.category)!.push(m);
  });
  
  // Salvar cada categoria como chunk JSON separado
  const categoryIndex: { name: string; file: string; count: number; isAdult: boolean }[] = [];
  
  categoryData.forEach((movies, category) => {
    const fileName = category
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) + '.json';
    
    const isAdult = ADULT_CATEGORIES.some(adult => 
      category.toLowerCase().includes(adult.toLowerCase()) || 
      category.includes('ADULTOS') ||
      category.includes('[HOT]') ||
      category.includes('❌❤️')
    );
    
    fs.writeFileSync(
      path.join(chunksDir, fileName),
      JSON.stringify(movies)
    );
    
    categoryIndex.push({
      name: category,
      file: fileName,
      count: movies.length,
      isAdult
    });
  });
  
  // Ordenar categorias
  categoryIndex.sort((a, b) => {
    const priority = ['Lançamentos', 'Cinema', 'Netflix', 'Prime', 'Disney', 'Max', 'HBO'];
    const aHasPriority = priority.some(p => a.name.includes(p));
    const bHasPriority = priority.some(p => b.name.includes(p));
    
    if (aHasPriority && !bHasPriority) return -1;
    if (bHasPriority && !aHasPriority) return 1;
    if (a.isAdult && !b.isAdult) return 1;
    if (b.isAdult && !a.isAdult) return -1;
    
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  
  // Salvar índice de categorias
  fs.writeFileSync(
    path.join(chunksDir, 'categories.json'),
    JSON.stringify(categoryIndex)
  );
  
  console.log(`\n📦 Chunks criados: ${categoryIndex.length} arquivos em /public/data/`);
  
  // Criar dados iniciais leves (apenas primeiras categorias para carregamento rápido)
  const initialCategories = categoryIndex.filter(c => !c.isAdult).slice(0, 8);
  const initialMovies: Movie[] = [];
  
  initialCategories.forEach(cat => {
    const movies = categoryData.get(cat.name) || [];
    initialMovies.push(...movies.slice(0, 50)); // Apenas 50 por categoria inicial
  });
  
  // Gerar arquivo TypeScript LEVE para carregamento inicial
  const output = `// Auto-generated file - Do not edit manually
// Generated at: ${new Date().toISOString()}
// Source: ListaBR02.m3u8 (linha 2294+)
// Total: ${allMovies.length} items (lazy loaded)

import type { Movie } from '../types/movie';

// Interface estendida com suporte a adulto
export interface MovieWithAdult extends Movie {
  isAdult?: boolean;
}

// Interface para índice de categorias
export interface CategoryIndex {
  name: string;
  file: string;
  count: number;
  isAdult: boolean;
}

// Categorias adultas para filtragem
export const ADULT_CATEGORIES = ${JSON.stringify(ADULT_CATEGORIES)};

// Índice de categorias (carregado estaticamente para performance)
export const categoryIndex: CategoryIndex[] = ${JSON.stringify(categoryIndex, null, 2)};

// Dados iniciais para carregamento rápido
// @ts-ignore
export const initialMoviesData: MovieWithAdult[] = ${JSON.stringify(initialMovies)};

// Lista de categorias ordenadas
export const movieCategories: string[] = categoryIndex.map(c => c.name);

// Categorias não-adultas
export const safeCategories: string[] = categoryIndex.filter(c => !c.isAdult).map(c => c.name);

// Cache de dados carregados
const loadedCategories = new Map<string, MovieWithAdult[]>();

// Inicializa cache com dados iniciais
categoryIndex.filter(c => !c.isAdult).slice(0, 8).forEach(cat => {
  const movies = initialMoviesData.filter(m => m.category === cat.name);
  if (movies.length > 0) {
    loadedCategories.set(cat.name, movies);
  }
});

// Função para carregar categoria sob demanda
export async function loadCategory(categoryName: string): Promise<MovieWithAdult[]> {
  // Retorna do cache se já carregado
  if (loadedCategories.has(categoryName)) {
    return loadedCategories.get(categoryName)!;
  }
  
  // Encontra o arquivo da categoria
  const cat = categoryIndex.find(c => c.name === categoryName);
  if (!cat) return [];
  
  try {
    const response = await fetch(\`/data/\${cat.file}\`);
    const movies = await response.json();
    loadedCategories.set(categoryName, movies);
    return movies;
  } catch (error) {
    console.error(\`Erro ao carregar categoria \${categoryName}:\`, error);
    return [];
  }
}

// Função para carregar múltiplas categorias
export async function loadCategories(categoryNames: string[]): Promise<Map<string, MovieWithAdult[]>> {
  const results = new Map<string, MovieWithAdult[]>();
  
  await Promise.all(
    categoryNames.map(async (name) => {
      const movies = await loadCategory(name);
      results.set(name, movies);
    })
  );
  
  return results;
}

// Função para buscar em todas as categorias (carrega sob demanda)
export async function searchAllMovies(query: string, isAdultUnlocked: boolean): Promise<MovieWithAdult[]> {
  const results: MovieWithAdult[] = [];
  const categoriesToSearch = isAdultUnlocked ? categoryIndex : categoryIndex.filter(c => !c.isAdult);
  
  // Busca em paralelo em chunks de 5 categorias por vez
  const chunkSize = 5;
  for (let i = 0; i < categoriesToSearch.length; i += chunkSize) {
    const chunk = categoriesToSearch.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (cat) => {
        const movies = await loadCategory(cat.name);
        return movies.filter(m => 
          m.name.toLowerCase().includes(query.toLowerCase())
        );
      })
    );
    results.push(...chunkResults.flat());
    
    // Se já tem muitos resultados, para
    if (results.length >= 100) break;
  }
  
  return results;
}

// Getter para todos os dados carregados (para compatibilidade)
export function getLoadedMovies(): MovieWithAdult[] {
  const all: MovieWithAdult[] = [];
  loadedCategories.forEach(movies => all.push(...movies));
  return all;
}

// Para compatibilidade com código existente
export const moviesData = initialMoviesData;
`;

  fs.writeFileSync(outputPath, output);
  console.log(`\n💾 Arquivo principal salvo: ${outputPath}`);
  console.log(`   Tamanho inicial: ${initialMovies.length} items (vs ${allMovies.length} total)`);
  // Mostrar algumas categorias
  console.log('\n📁 Top 20 categorias:');
  const sortedCategories = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  sortedCategories.forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} items`);
  });
}

main().catch(console.error);
