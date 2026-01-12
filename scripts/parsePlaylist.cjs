// Script para processar os arquivos M3U8 e gerar dados TypeScript
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'movies.ts');

// Prefixos de categorias que queremos incluir (filmes/séries)
const MOVIE_PREFIXES = [
  'OND /',
  'COLETÂNEA:',
  'Series |',
  'Novelas',
];

// Categorias a excluir
const EXCLUDED_PREFIXES = [
  'CANAIS:',
  'RÁDIOS',
  'JOGOS DE HOJE',
  'Programas de TV',
];

function normalizeCategory(category) {
  const cat = category.trim();
  
  if (cat.includes('LANÇAMENTOS 2026')) return '🎬 Lançamentos 2026';
  if (cat.includes('LANÇAMENTOS 2025')) return '🎬 Lançamentos 2025';
  if (cat.includes('LANÇAMENTOS 2024')) return '🎬 Lançamentos 2024';
  if (cat.includes('LANÇAMENTOS')) return '🎬 Lançamentos';
  
  if (cat.startsWith('OND /')) {
    const genre = cat.replace('OND /', '').replace('-', '').trim();
    if (genre.includes('AÇÃO')) return '💥 Ação';
    if (genre.includes('ANIMAÇÃO')) return '🎨 Animação';
    if (genre.includes('AVENTURA')) return '🗺️ Aventura';
    if (genre.includes('COMÉDIA')) return '😂 Comédia';
    if (genre.includes('CRIME')) return '🔫 Crime';
    if (genre.includes('DOCUMENTÁRIO')) return '📚 Documentário';
    if (genre.includes('DRAMA')) return '🎭 Drama';
    if (genre.includes('FAMÍLIA')) return '👨‍👩‍👧‍👦 Família';
    if (genre.includes('FANTASIA') || genre.includes('FICÇÃO')) return '🚀 Ficção & Fantasia';
    if (genre.includes('FAROESTE')) return '🤠 Faroeste';
    if (genre.includes('GUERRA')) return '⚔️ Guerra';
    if (genre.includes('LEGENDADOS')) return '📝 Legendados';
    if (genre.includes('NACIONAIS')) return '🇧🇷 Nacionais';
    if (genre.includes('RELIGIOSOS')) return '✝️ Religiosos';
    if (genre.includes('ROMANCE')) return '💕 Romance';
    if (genre.includes('SUSPENSE')) return '🔍 Suspense';
    if (genre.includes('TERROR')) return '👻 Terror';
    return `🎬 ${genre}`;
  }
  
  if (cat.startsWith('COLETÂNEA:')) {
    const name = cat.replace('COLETÂNEA:', '').trim();
    return `🎬 Coleção ${name}`;
  }
  
  if (cat.startsWith('Series |')) {
    const platform = cat.replace('Series |', '').trim();
    if (platform === 'Amazon Prime Video') return '📺 Prime Video';
    if (platform === 'Netflix') return '📺 Netflix';
    if (platform === 'Disney Plus') return '📺 Disney+';
    if (platform === 'Max') return '📺 Max';
    if (platform === 'Globoplay') return '📺 Globoplay';
    if (platform === 'Paramount') return '📺 Paramount+';
    if (platform === 'Apple TV Plus') return '📺 Apple TV+';
    if (platform === 'Star Plus') return '📺 Star+';
    if (platform === 'Crunchyroll' || platform === 'Funimation Now') return '📺 Anime';
    if (platform === 'Dorama') return '📺 Doramas';
    if (platform === 'Legendadas') return '📺 Séries Legendadas';
    if (platform === 'Turcas') return '📺 Séries Turcas';
    return `📺 ${platform}`;
  }
  
  if (cat === 'Novelas') return '📺 Novelas';
  
  return cat;
}

function getContentType(category, url) {
  const cat = category.toLowerCase();
  if (cat.startsWith('series |')) return 'series';
  if (cat === 'novelas') return 'series';
  if (url.includes('/series/')) return 'series';
  return 'movie';
}

function shouldIncludeCategory(category) {
  if (EXCLUDED_PREFIXES.some(prefix => category.toUpperCase().startsWith(prefix.toUpperCase()))) {
    return false;
  }
  return MOVIE_PREFIXES.some(prefix => category.startsWith(prefix));
}

function generateId(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseM3U8(content) {
  // Normaliza quebras de linha e junta linhas quebradas
  const normalizedContent = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n\s+/g, ' ') // Junta linhas que começam com espaço
    .replace(/\.jpg\s+/g, '.jpg\n') // Garante quebra após .jpg
    .replace(/\.png\s+/g, '.png\n')
    .replace(/,([^,\n]+)\s+(http)/g, ',$1\n$2'); // Quebra entre nome e URL
  
  const lines = normalizedContent.split('\n');
  const movies = [];
  const seenIds = new Set();
  
  let currentEntry = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const nameMatch = line.match(/,([^,]+)$/);
      
      if (nameMatch) {
        currentEntry = {
          name: nameMatch[1].trim(),
          logo: logoMatch ? logoMatch[1] : undefined,
          category: groupMatch ? groupMatch[1] : ''
        };
      }
    } else if (line.startsWith('http') && currentEntry) {
      const category = currentEntry.category || '';
      const isMovieCategory = shouldIncludeCategory(category);
      const isMovieUrl = line.includes('/movie/') || line.includes('/series/');
      
      if ((isMovieCategory || isMovieUrl) && currentEntry.name) {
        const id = generateId(currentEntry.name);
        
        if (!seenIds.has(id)) {
          seenIds.add(id);
          movies.push({
            id,
            name: currentEntry.name,
            url: line.trim(),
            logo: currentEntry.logo,
            category: normalizeCategory(category || 'Outros'),
            type: getContentType(category, line)
          });
        }
      }
      currentEntry = null;
    }
  }
  
  return movies;
}

// Main
console.log('🎬 Processando playlists M3U8...\n');

let allMovies = [];

// Processa todos os arquivos M3U8 na pasta assets
const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.m3u8'));

files.forEach(file => {
  const filePath = path.join(ASSETS_DIR, file);
  console.log(`📁 Processando: ${file}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const movies = parseM3U8(content);
  
  console.log(`   ✅ ${movies.length} filmes/séries encontrados\n`);
  
  // Adiciona filmes um por um para evitar estouro de stack
  for (const movie of movies) {
    allMovies.push(movie);
  }
});

// Remove duplicatas por ID
const uniqueMovies = [];
const seenIds = new Set();

for (const movie of allMovies) {
  if (!seenIds.has(movie.id)) {
    seenIds.add(movie.id);
    uniqueMovies.push(movie);
  }
}

// Gera o arquivo TypeScript
// Limita a 50 itens por categoria para manter o arquivo gerenciável
const limitedMovies = [];
const categoryCount = {};
const MAX_PER_CATEGORY = 100;

for (const movie of uniqueMovies) {
  if (!categoryCount[movie.category]) {
    categoryCount[movie.category] = 0;
  }
  if (categoryCount[movie.category] < MAX_PER_CATEGORY) {
    limitedMovies.push(movie);
    categoryCount[movie.category]++;
  }
}

const tsContent = `// Auto-generated file - Do not edit manually
// Generated at: ${new Date().toISOString()}
// Total: ${limitedMovies.length} items (limited to ${MAX_PER_CATEGORY} per category)

import type { Movie } from '../types/movie';

export const moviesData: Movie[] = ${JSON.stringify(limitedMovies, null, 2)};

// Categorias disponíveis
export const movieCategories: string[] = [...new Set(moviesData.map(m => m.category))].sort((a, b) => {
  if (a.includes('Lançamento')) return -1;
  if (b.includes('Lançamento')) return 1;
  return a.localeCompare(b, 'pt-BR');
});

// Funções de acesso rápido
export const getMoviesByCategory = (category: string): Movie[] => 
  moviesData.filter(m => m.category === category);

export const searchMovies = (query: string): Movie[] => {
  const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
  return moviesData.filter(m => {
    const normalizedName = m.name.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    return normalizedName.includes(normalizedQuery);
  });
};

export const getMovies = (): Movie[] => moviesData.filter(m => m.type === 'movie');
export const getSeries = (): Movie[] => moviesData.filter(m => m.type === 'series');
`;

fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf-8');

console.log('═'.repeat(50));
console.log(`✅ Arquivo gerado: src/data/movies.ts`);
console.log(`📊 Total de filmes/séries: ${limitedMovies.length} (de ${uniqueMovies.length})`);
console.log(`📁 Categorias: ${Object.keys(categoryCount).length}`);
console.log(`📌 Limite por categoria: ${MAX_PER_CATEGORY}`);
console.log('═'.repeat(50));
