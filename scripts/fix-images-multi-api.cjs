/**
 * Script para corrigir imagens de séries/filmes nos JSONs
 * Usa múltiplas APIs: OMDB, TVMaze, iTunes
 * Atualiza diretamente as URLs nos arquivos
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = path.join(__dirname, '../public/data');

// Função para fazer fetch
function fetch(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Limpa o título para busca
function cleanTitle(title) {
  if (!title) return '';
  
  return title
    // Remove prefixos comuns
    .replace(/^(S\d+\s*[:-]?\s*|T\d+\s*[:-]?\s*)/i, '')
    .replace(/^(temporada\s*\d+\s*[:-]?\s*)/i, '')
    .replace(/^(season\s*\d+\s*[:-]?\s*)/i, '')
    // Remove sufixos de qualidade
    .replace(/\s*[-–]\s*(dublado|legendado|dual|nacional)$/i, '')
    .replace(/\s*\[(dublado|legendado|dual|4k|hd|uhd)\]$/i, '')
    .replace(/\s*\((dublado|legendado|dual|4k|hd|uhd)\)$/i, '')
    // Remove emojis e símbolos
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[🔥🎬📺🎥⭐]/g, '')
    // Remove marcadores de episódio
    .replace(/\s*E\d+(\s*[-–]\s*E\d+)?$/i, '')
    .replace(/\s*EP?\.\s*\d+$/i, '')
    // Limpa espaços extras
    .replace(/\s+/g, ' ')
    .trim();
}

// Verifica se a URL de imagem é válida/boa
function isValidImageUrl(url) {
  if (!url) return false;
  
  const badPatterns = [
    'ui-avatars.com',
    '32q0d.xyz',
    'placeholder',
    'default',
    'noimage',
    'no-image',
    'missing',
  ];
  
  const goodPatterns = [
    'image.tmdb.org',
    'media-amazon.com',
    'tvmaze.com',
    'mzstatic.com',
    'fanart.tv',
    'thetvdb.com',
  ];
  
  const urlLower = url.toLowerCase();
  
  if (badPatterns.some(p => urlLower.includes(p))) return false;
  if (goodPatterns.some(p => urlLower.includes(p))) return true;
  
  // Verifica se é HTTPS e termina com extensão de imagem
  if (url.startsWith('https://') && /\.(jpg|jpeg|png|webp)/i.test(url)) {
    return true;
  }
  
  return false;
}

// APIs de busca de imagem
async function searchOMDB(title) {
  try {
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=trilogy`;
    const res = await fetch(url);
    const data = JSON.parse(res.data);
    if (data.Poster && data.Poster !== 'N/A') {
      return data.Poster;
    }
  } catch (e) {}
  return null;
}

async function searchTVMaze(title) {
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`;
    const res = await fetch(url);
    if (res.status === 200) {
      const data = JSON.parse(res.data);
      if (data.image) {
        return data.image.original || data.image.medium;
      }
    }
  } catch (e) {}
  return null;
}

async function searchITunes(title) {
  try {
    // Tenta como série de TV primeiro
    let url = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=tvShow&limit=1`;
    let res = await fetch(url);
    let data = JSON.parse(res.data);
    
    if (data.results && data.results[0] && data.results[0].artworkUrl100) {
      return data.results[0].artworkUrl100.replace('100x100', '600x600');
    }
    
    // Tenta como filme
    url = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=movie&limit=1`;
    res = await fetch(url);
    data = JSON.parse(res.data);
    
    if (data.results && data.results[0] && data.results[0].artworkUrl100) {
      return data.results[0].artworkUrl100.replace('100x100', '600x600');
    }
  } catch (e) {}
  return null;
}

async function searchTMDB(title) {
  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=6a9cd46770a9adee6ee6bb7e69154aaa&language=pt-BR&query=${encodeURIComponent(title)}`;
    const res = await fetch(url);
    const data = JSON.parse(res.data);
    
    if (data.results && data.results[0] && data.results[0].poster_path) {
      return `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`;
    }
  } catch (e) {}
  return null;
}

// Busca imagem usando múltiplas APIs
async function findImage(title) {
  const cleanedTitle = cleanTitle(title);
  if (!cleanedTitle || cleanedTitle.length < 3) return null;
  
  // Tenta TMDB primeiro
  let image = await searchTMDB(cleanedTitle);
  if (image) return { image, source: 'TMDB' };
  
  // Tenta TVMaze
  image = await searchTVMaze(cleanedTitle);
  if (image) return { image, source: 'TVMaze' };
  
  // Tenta OMDB
  image = await searchOMDB(cleanedTitle);
  if (image) return { image, source: 'OMDB' };
  
  // Tenta iTunes
  image = await searchITunes(cleanedTitle);
  if (image) return { image, source: 'iTunes' };
  
  return null;
}

// Processa um arquivo JSON
async function processFile(filePath) {
  const fileName = path.basename(filePath);
  
  // Ignora categories.json
  if (fileName === 'categories.json') return { updated: 0, total: 0 };
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (!Array.isArray(data)) return { updated: 0, total: 0 };
    
    let updated = 0;
    const total = data.length;
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      
      // Verifica se a imagem de capa precisa ser corrigida
      const coverKey = item.cover || item.logo || item.image;
      const currentUrl = item.cover || item.logo || item.image;
      
      if (isValidImageUrl(currentUrl)) continue;
      
      // Pega o título
      const title = item.name || item.title || '';
      if (!title) continue;
      
      // Busca nova imagem
      const result = await findImage(title);
      
      if (result) {
        // Atualiza a URL da capa
        if (item.cover !== undefined) item.cover = result.image;
        else if (item.logo !== undefined) item.logo = result.image;
        else if (item.image !== undefined) item.image = result.image;
        else item.cover = result.image;
        
        updated++;
        console.log(`  ✅ ${title.substring(0, 40).padEnd(40)} → ${result.source}`);
      }
      
      // Delay para não sobrecarregar as APIs
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 500));
    }
    
    // Salva o arquivo se houve atualizações
    if (updated > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    return { updated, total };
    
  } catch (e) {
    console.error(`  ❌ Erro: ${e.message}`);
    return { updated: 0, total: 0 };
  }
}

// Função principal
async function main() {
  console.log('🖼️  CORREÇÃO DE IMAGENS DOS CATÁLOGOS\n');
  console.log('='.repeat(80));
  
  // Pega argumentos - pode especificar arquivos específicos
  const args = process.argv.slice(2);
  let files;
  
  if (args.length > 0) {
    // Processa arquivos específicos
    files = args.map(f => {
      if (f.endsWith('.json')) return path.join(DATA_DIR, f);
      return path.join(DATA_DIR, `${f}.json`);
    }).filter(f => fs.existsSync(f));
  } else {
    // Processa todos os arquivos
    files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json') && f !== 'categories.json')
      .map(f => path.join(DATA_DIR, f));
  }
  
  console.log(`\n📁 Arquivos a processar: ${files.length}\n`);
  
  let totalUpdated = 0;
  let totalProcessed = 0;
  
  for (const file of files) {
    const fileName = path.basename(file);
    console.log(`\n📄 ${fileName}`);
    console.log('-'.repeat(60));
    
    const result = await processFile(file);
    totalUpdated += result.updated;
    totalProcessed += result.total;
    
    if (result.updated > 0) {
      console.log(`   Atualizados: ${result.updated}/${result.total}`);
    } else {
      console.log('   Nenhuma atualização necessária');
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ CONCLUÍDO!`);
  console.log(`   Total processado: ${totalProcessed}`);
  console.log(`   Total atualizado: ${totalUpdated}`);
}

main().catch(console.error);
