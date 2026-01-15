/**
 * Script para corrigir imagens de capas de filmes e séries
 * Usa a API do TMDB para buscar as imagens corretas
 * 
 * Para rodar: node scripts/fix-images.js
 * 
 * IMPORTANTE: Você precisa de uma API key do TMDB
 * Pegue gratuitamente em: https://www.themoviedb.org/settings/api
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO - Coloque sua API key do TMDB aqui
// ============================================
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'SUA_API_KEY_AQUI';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Pasta com os JSONs
const DATA_DIR = path.join(__dirname, '../public/data');

// Cache para evitar requisições duplicadas
const imageCache = new Map();

// Delay entre requisições para não exceder rate limit
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extrai o nome limpo do filme/série a partir do nome completo
 * Remove ano, temporada, episódio, etc.
 */
function extractCleanName(name) {
  if (!name) return '';
  
  // Remove ano entre parênteses: "Filme (2024)" -> "Filme"
  let cleanName = name.replace(/\s*\(\d{4}\)\s*/g, '');
  
  // Remove informações de temporada/episódio: "Série S01E05" -> "Série"
  cleanName = cleanName.replace(/\s*S\d+E\d+.*/i, '');
  cleanName = cleanName.replace(/\s*T\d+\s*E\d+.*/i, '');
  cleanName = cleanName.replace(/\s*Temporada\s*\d+.*/i, '');
  cleanName = cleanName.replace(/\s*Season\s*\d+.*/i, '');
  cleanName = cleanName.replace(/\s*Ep\.?\s*\d+.*/i, '');
  cleanName = cleanName.replace(/\s*Episódio\s*\d+.*/i, '');
  cleanName = cleanName.replace(/\s*Episode\s*\d+.*/i, '');
  
  // Remove qualificadores comuns
  cleanName = cleanName.replace(/\s*-\s*Dublado.*/i, '');
  cleanName = cleanName.replace(/\s*-\s*Legendado.*/i, '');
  cleanName = cleanName.replace(/\s*\[.*?\]/g, '');
  cleanName = cleanName.replace(/\s*DUB\s*$/i, '');
  cleanName = cleanName.replace(/\s*LEG\s*$/i, '');
  
  return cleanName.trim();
}

/**
 * Extrai o ano do nome, se existir
 */
function extractYear(name) {
  const match = name.match(/\((\d{4})\)/);
  return match ? match[1] : null;
}

/**
 * Verifica se é um episódio de série
 */
function isEpisode(name) {
  return /S\d+E\d+/i.test(name) || 
         /T\d+\s*E\d+/i.test(name) ||
         /Temporada\s*\d+.*Ep/i.test(name) ||
         /Season\s*\d+.*Episode/i.test(name);
}

/**
 * Verifica se a URL da imagem é válida (não quebrada)
 */
function isValidImageUrl(url) {
  if (!url) return false;
  
  // URLs do TMDB geralmente são válidas
  if (url.includes('image.tmdb.org')) return true;
  
  // URLs conhecidas como quebradas
  const brokenPatterns = [
    '32q0d.xyz',
    'placeholder',
    'noimage',
    'default',
    'generic'
  ];
  
  return !brokenPatterns.some(pattern => url.toLowerCase().includes(pattern));
}

/**
 * Busca imagem do filme no TMDB
 */
async function searchMovieImage(title, year = null) {
  const cacheKey = `movie:${title}:${year || ''}`;
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  try {
    let url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(title)}`;
    if (year) {
      url += `&year=${year}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Pega o primeiro resultado
      const movie = data.results[0];
      if (movie.poster_path) {
        const imageUrl = `${TMDB_IMAGE_BASE}${movie.poster_path}`;
        imageCache.set(cacheKey, imageUrl);
        return imageUrl;
      }
    }
    
    // Se não encontrou com o título original, tenta sem acentos
    if (title !== removeAccents(title)) {
      return searchMovieImage(removeAccents(title), year);
    }
    
    imageCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error(`Erro ao buscar filme "${title}":`, error.message);
    return null;
  }
}

/**
 * Busca imagem da série no TMDB
 */
async function searchSeriesImage(title) {
  const cacheKey = `series:${title}`;
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  try {
    const url = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(title)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const series = data.results[0];
      if (series.poster_path) {
        const imageUrl = `${TMDB_IMAGE_BASE}${series.poster_path}`;
        imageCache.set(cacheKey, imageUrl);
        return imageUrl;
      }
    }
    
    // Se não encontrou, tenta sem acentos
    if (title !== removeAccents(title)) {
      return searchSeriesImage(removeAccents(title));
    }
    
    imageCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error(`Erro ao buscar série "${title}":`, error.message);
    return null;
  }
}

/**
 * Remove acentos de uma string
 */
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Processa um item (filme ou série)
 */
async function processItem(item) {
  // Se já tem uma imagem válida do TMDB, pula
  if (isValidImageUrl(item.logo)) {
    return { ...item, updated: false };
  }
  
  const cleanName = extractCleanName(item.name);
  if (!cleanName) {
    return { ...item, updated: false };
  }
  
  let newImage = null;
  
  // Verifica se é filme ou série
  if (item.type === 'movie') {
    const year = extractYear(item.name);
    newImage = await searchMovieImage(cleanName, year);
  } else if (item.type === 'series') {
    newImage = await searchSeriesImage(cleanName);
  } else {
    // Tenta ambos
    const year = extractYear(item.name);
    newImage = await searchMovieImage(cleanName, year);
    if (!newImage) {
      newImage = await searchSeriesImage(cleanName);
    }
  }
  
  if (newImage) {
    return { ...item, logo: newImage, updated: true };
  }
  
  return { ...item, updated: false };
}

/**
 * Processa um arquivo JSON
 */
async function processFile(filePath) {
  const fileName = path.basename(filePath);
  
  // Pula o arquivo de categorias
  if (fileName === 'categories.json') {
    console.log(`⏭️  Pulando: ${fileName}`);
    return { processed: 0, updated: 0 };
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Verifica se o arquivo está vazio
    if (!content.trim() || content.trim() === '[]') {
      console.log(`⏭️  Arquivo vazio: ${fileName}`);
      return { processed: 0, updated: 0 };
    }
    
    const items = JSON.parse(content);
    
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`⏭️  Sem itens: ${fileName}`);
      return { processed: 0, updated: 0 };
    }
    
    console.log(`\n📁 Processando: ${fileName} (${items.length} itens)`);
    
    let updated = 0;
    const updatedItems = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Adiciona pequeno delay a cada 5 requisições para não exceder rate limit
      if (i > 0 && i % 5 === 0) {
        await delay(250);
      }
      
      const result = await processItem(item);
      updatedItems.push(result);
      
      if (result.updated) {
        updated++;
        console.log(`  ✅ ${result.name}`);
      }
      
      // Mostra progresso a cada 20 itens
      if ((i + 1) % 20 === 0) {
        console.log(`  ... ${i + 1}/${items.length} processados`);
      }
    }
    
    // Salva o arquivo atualizado (remove o campo 'updated')
    const finalItems = updatedItems.map(({ updated, ...rest }) => rest);
    fs.writeFileSync(filePath, JSON.stringify(finalItems, null, 2));
    
    console.log(`  📊 ${updated}/${items.length} atualizados`);
    
    return { processed: items.length, updated };
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${fileName}:`, error.message);
    return { processed: 0, updated: 0 };
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🎬 Iniciando correção de imagens...\n');
  
  // Verifica se a API key foi configurada
  if (TMDB_API_KEY === 'SUA_API_KEY_AQUI') {
    console.log('⚠️  ATENÇÃO: Você precisa configurar sua API key do TMDB!');
    console.log('   1. Acesse https://www.themoviedb.org/settings/api');
    console.log('   2. Crie uma conta gratuita e pegue sua API key');
    console.log('   3. Rode o script assim:');
    console.log('      TMDB_API_KEY=sua_key node scripts/fix-images.js\n');
    process.exit(1);
  }
  
  // Lista todos os arquivos JSON
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(DATA_DIR, f));
  
  console.log(`📂 Encontrados ${files.length} arquivos JSON\n`);
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  
  for (const file of files) {
    const { processed, updated } = await processFile(file);
    totalProcessed += processed;
    totalUpdated += updated;
    
    // Delay entre arquivos
    await delay(500);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Finalizado!`);
  console.log(`   📊 Total processado: ${totalProcessed} itens`);
  console.log(`   ✅ Total atualizado: ${totalUpdated} imagens`);
  console.log('='.repeat(50));
}

// Executa
main().catch(console.error);
