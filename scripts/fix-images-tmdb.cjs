/**
 * 🎬 Script para Corrigir Imagens de Capas de Filmes e Séries
 * 
 * Este script usa a API do TMDB (The Movie Database) para buscar
 * as imagens corretas de capas de filmes e séries.
 * 
 * =========================================
 * COMO USAR:
 * =========================================
 * 
 * 1. Pegue uma API key gratuita em: https://www.themoviedb.org/settings/api
 *    - Crie uma conta
 *    - Vá em Settings > API
 *    - Solicite uma API key (tipo: Developer)
 * 
 * 2. Execute o script:
 *    TMDB_API_KEY=sua_api_key node scripts/fix-images-tmdb.cjs
 * 
 * =========================================
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO
// ============================================
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const DATA_DIR = path.join(__dirname, '../public/data');

// Cache para evitar requisições duplicadas
const imageCache = new Map();

// Estatísticas
const stats = {
  total: 0,
  updated: 0,
  failed: 0,
  skipped: 0,
  cached: 0
};

// Delay entre requisições (TMDB permite ~40 req/10s)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extrai o nome limpo do filme/série
 */
function extractCleanName(name) {
  if (!name) return '';
  
  return name
    // Remove ano entre parênteses: "Filme (2024)" -> "Filme"
    .replace(/\s*\(\d{4}\)\s*/g, '')
    // Remove S01E01, T01E01, etc
    .replace(/\s*[ST]\d+\s*E\d+.*/i, '')
    .replace(/\s*-?\s*Temporada\s*\d+.*/i, '')
    .replace(/\s*-?\s*Season\s*\d+.*/i, '')
    .replace(/\s*Ep\.?\s*\d+.*/i, '')
    .replace(/\s*Episódio\s*\d+.*/i, '')
    .replace(/\s*Episode\s*\d+.*/i, '')
    // Remove qualificadores
    .replace(/\s*-\s*Dublado.*/i, '')
    .replace(/\s*-\s*Legendado.*/i, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*DUB\s*$/i, '')
    .replace(/\s*LEG\s*$/i, '')
    .replace(/\s*HD\s*$/i, '')
    .replace(/\s*4K\s*$/i, '')
    // Limpa espaços extras
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai o ano do nome
 */
function extractYear(name) {
  const match = name.match(/\((\d{4})\)/);
  return match ? match[1] : null;
}

/**
 * Verifica se é um episódio de série
 */
function isEpisode(name) {
  return /[ST]\d+\s*E\d+/i.test(name) ||
         /Temporada\s*\d+.*Ep/i.test(name) ||
         /Season\s*\d+.*Episode/i.test(name) ||
         /Episódio\s*\d+/i.test(name);
}

/**
 * Verifica se a URL da imagem é válida
 */
function isValidImageUrl(url) {
  if (!url) return false;
  if (url.includes('image.tmdb.org')) return true;
  
  const brokenPatterns = [
    '32q0d',
    '.xyz/images',
    'placeholder',
    'noimage',
    'default.jpg',
    'undefined',
    'null'
  ];
  
  return !brokenPatterns.some(p => url.toLowerCase().includes(p));
}

/**
 * Busca filme no TMDB
 */
async function searchMovie(title, year = null) {
  try {
    let url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(title)}`;
    if (year) url += `&year=${year}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ⚠️ Erro API (${response.status}): ${title}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const movie = data.results[0];
      if (movie.poster_path) {
        return `${TMDB_IMAGE_BASE}${movie.poster_path}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`  ❌ Erro ao buscar filme "${title}":`, error.message);
    return null;
  }
}

/**
 * Busca série no TMDB
 */
async function searchSeries(title) {
  try {
    const url = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(title)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ⚠️ Erro API (${response.status}): ${title}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const series = data.results[0];
      if (series.poster_path) {
        return `${TMDB_IMAGE_BASE}${series.poster_path}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`  ❌ Erro ao buscar série "${title}":`, error.message);
    return null;
  }
}

/**
 * Busca imagem (filme ou série)
 */
async function searchImage(name, type) {
  const cleanName = extractCleanName(name);
  if (!cleanName) return null;
  
  // Verifica cache
  const cacheKey = `${type}:${cleanName.toLowerCase()}`;
  if (imageCache.has(cacheKey)) {
    stats.cached++;
    return imageCache.get(cacheKey);
  }
  
  let imageUrl = null;
  
  if (type === 'movie') {
    const year = extractYear(name);
    imageUrl = await searchMovie(cleanName, year);
    
    // Se não encontrou, tenta sem ano
    if (!imageUrl && year) {
      await delay(100);
      imageUrl = await searchMovie(cleanName);
    }
  } else {
    // Para séries, tenta primeiro como TV, depois como filme
    imageUrl = await searchSeries(cleanName);
    
    if (!imageUrl) {
      await delay(100);
      imageUrl = await searchMovie(cleanName);
    }
  }
  
  // Salva no cache (mesmo null para evitar buscas repetidas)
  imageCache.set(cacheKey, imageUrl);
  
  return imageUrl;
}

/**
 * Processa um item
 */
async function processItem(item, seriesCache) {
  stats.total++;
  
  // Se já tem imagem válida, pula
  if (isValidImageUrl(item.logo)) {
    stats.skipped++;
    return item;
  }
  
  const cleanName = extractCleanName(item.name);
  
  // Para episódios, usa o cache da série
  if (isEpisode(item.name) && seriesCache.has(cleanName)) {
    stats.cached++;
    return { ...item, logo: seriesCache.get(cleanName) };
  }
  
  // Busca nova imagem
  const newImage = await searchImage(item.name, item.type || 'movie');
  
  if (newImage) {
    stats.updated++;
    
    // Salva no cache de séries para próximos episódios
    if (item.type === 'series' || isEpisode(item.name)) {
      seriesCache.set(cleanName, newImage);
    }
    
    return { ...item, logo: newImage };
  }
  
  stats.failed++;
  return item;
}

/**
 * Processa um arquivo JSON
 */
async function processFile(filePath) {
  const fileName = path.basename(filePath);
  
  // Pula arquivos especiais
  if (fileName === 'categories.json') {
    console.log(`⏭️  Pulando: ${fileName}`);
    return 0;
  }
  
  // Pula arquivos de adultos (opcional)
  if (fileName.includes('adultos')) {
    console.log(`⏭️  Pulando: ${fileName}`);
    return 0;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (!content.trim() || content.trim() === '[]') {
      return 0;
    }
    
    const items = JSON.parse(content);
    
    if (!Array.isArray(items) || items.length === 0) {
      return 0;
    }
    
    // Conta quantas imagens estão quebradas
    const brokenCount = items.filter(i => !isValidImageUrl(i.logo)).length;
    
    if (brokenCount === 0) {
      console.log(`✅ ${fileName} - OK (${items.length} itens)`);
      return 0;
    }
    
    console.log(`\n📁 ${fileName} - ${brokenCount}/${items.length} imagens quebradas`);
    
    // Cache para séries neste arquivo
    const seriesCache = new Map();
    
    const updatedItems = [];
    let fileUpdated = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Rate limiting: 4 requisições por segundo
      if (i > 0 && i % 4 === 0) {
        await delay(250);
      }
      
      const result = await processItem(item, seriesCache);
      updatedItems.push(result);
      
      if (result.logo !== item.logo) {
        fileUpdated++;
        const shortName = result.name.length > 40 ? result.name.substring(0, 40) + '...' : result.name;
        console.log(`  ✅ ${shortName}`);
      }
      
      // Progresso
      if ((i + 1) % 50 === 0) {
        console.log(`  ... ${i + 1}/${items.length}`);
      }
    }
    
    // Salva o arquivo se houve mudanças
    if (fileUpdated > 0) {
      fs.writeFileSync(filePath, JSON.stringify(updatedItems));
      console.log(`  💾 Salvo: ${fileUpdated} imagens atualizadas`);
    }
    
    return fileUpdated;
    
  } catch (error) {
    console.error(`❌ Erro em ${fileName}:`, error.message);
    return 0;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🎬 Correção de Imagens com TMDB API\n');
  
  // Verifica API key
  if (!TMDB_API_KEY) {
    console.log('❌ ERRO: API key do TMDB não configurada!\n');
    console.log('Como obter:');
    console.log('1. Acesse https://www.themoviedb.org/settings/api');
    console.log('2. Crie uma conta gratuita');
    console.log('3. Solicite uma API key (Developer)\n');
    console.log('Como usar:');
    console.log('  TMDB_API_KEY=sua_key node scripts/fix-images-tmdb.cjs\n');
    process.exit(1);
  }
  
  // Testa a API key
  console.log('🔑 Testando API key...');
  try {
    const testUrl = `${TMDB_BASE_URL}/movie/550?api_key=${TMDB_API_KEY}`;
    const response = await fetch(testUrl);
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }
    console.log('✅ API key válida!\n');
  } catch (error) {
    console.log(`❌ API key inválida: ${error.message}\n`);
    process.exit(1);
  }
  
  // Lista arquivos JSON
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => path.join(DATA_DIR, f));
  
  console.log(`📂 ${files.length} arquivos encontrados\n`);
  
  const startTime = Date.now();
  
  for (const file of files) {
    await processFile(file);
    await delay(500); // Delay entre arquivos
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 RESUMO');
  console.log('═'.repeat(50));
  console.log(`   Total processado: ${stats.total}`);
  console.log(`   ✅ Atualizados:   ${stats.updated}`);
  console.log(`   ⏭️  Já OK:         ${stats.skipped}`);
  console.log(`   📦 Do cache:      ${stats.cached}`);
  console.log(`   ❌ Não encontr.:  ${stats.failed}`);
  console.log(`   ⏱️  Tempo:         ${duration} minutos`);
  console.log('═'.repeat(50));
}

// Executa
main().catch(console.error);
