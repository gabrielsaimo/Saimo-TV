/**
 * Script para corrigir TODAS as imagens de séries
 * Busca a imagem da SÉRIE (não do episódio) e aplica para todos os episódios
 * Usa TVMaze API (gratuita, sem limite)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '../public/data');

// Cache de imagens por série
const seriesCache = new Map();

// Função para fazer request HTTP
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

// Extrai o nome da SÉRIE do título do episódio
function extractSeriesName(title) {
  if (!title) return null;
  
  let name = title
    // Remove ano entre parênteses
    .replace(/\s*\(\d{4}\)\s*/g, ' ')
    // Remove indicadores de temporada/episódio
    .replace(/\s*S\d+\s*E\d+.*$/i, '')
    .replace(/\s*T\d+\s*E\d+.*$/i, '')
    .replace(/\s*Temporada\s*\d+.*$/i, '')
    .replace(/\s*Season\s*\d+.*$/i, '')
    .replace(/\s*EP?\.\s*\d+.*$/i, '')
    .replace(/\s*Episódio\s*\d+.*$/i, '')
    .replace(/\s*Episode\s*\d+.*$/i, '')
    // Remove qualificadores
    .replace(/\s*[-–]\s*(Dublado|Legendado|Dual|Nacional|4K|HD|UHD|FHD).*$/i, '')
    .replace(/\s*\[(Dublado|Legendado|Dual|4K|HD)\]/gi, '')
    .replace(/\s*\((Dublado|Legendado|Dual|4K|HD|Completo)\)/gi, '')
    // Remove emojis
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[🔥🎬📺🎥⭐🆕✨💫🌟⚡️🎭🎪]/g, '')
    // Limpa
    .replace(/\s+/g, ' ')
    .trim();
  
  return name.length >= 2 ? name : null;
}

// Busca imagem da série no TVMaze
async function searchTVMaze(seriesName) {
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(seriesName)}`;
    const res = await httpGet(url);
    
    if (res.status === 200) {
      const data = JSON.parse(res.data);
      if (data.image) {
        return data.image.original || data.image.medium;
      }
    }
  } catch (e) {}
  
  // Tenta busca múltipla
  try {
    const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(seriesName)}`;
    const res = await httpGet(url);
    
    if (res.status === 200) {
      const results = JSON.parse(res.data);
      if (results.length > 0 && results[0].show && results[0].show.image) {
        return results[0].show.image.original || results[0].show.image.medium;
      }
    }
  } catch (e) {}
  
  return null;
}

// Busca imagem de uma série (com cache)
async function getSeriesImage(seriesName) {
  if (!seriesName) return null;
  
  const cacheKey = seriesName.toLowerCase();
  
  if (seriesCache.has(cacheKey)) {
    return seriesCache.get(cacheKey);
  }
  
  const image = await searchTVMaze(seriesName);
  seriesCache.set(cacheKey, image);
  
  return image;
}

// Processa um arquivo JSON
async function processFile(filePath, dryRun = false) {
  const fileName = path.basename(filePath);
  if (fileName === 'categories.json') return { updated: 0, total: 0, series: 0 };
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    if (!Array.isArray(data)) return { updated: 0, total: 0, series: 0 };
    
    // Agrupa por série
    const seriesGroups = new Map();
    
    for (const item of data) {
      if (item.type !== 'series') continue;
      
      const seriesName = extractSeriesName(item.name || item.title);
      if (!seriesName) continue;
      
      if (!seriesGroups.has(seriesName)) {
        seriesGroups.set(seriesName, []);
      }
      seriesGroups.get(seriesName).push(item);
    }
    
    console.log(`   📊 ${seriesGroups.size} séries encontradas`);
    
    let updated = 0;
    let seriesCount = 0;
    
    for (const [seriesName, episodes] of seriesGroups) {
      // Busca imagem da série
      const image = await getSeriesImage(seriesName);
      
      if (image) {
        seriesCount++;
        
        // Aplica para todos os episódios
        for (const ep of episodes) {
          if (ep.logo !== undefined) ep.logo = image;
          else if (ep.cover !== undefined) ep.cover = image;
          else if (ep.image !== undefined) ep.image = image;
          else ep.logo = image;
          
          updated++;
        }
        
        if (seriesCount <= 10) {
          console.log(`  ✅ ${seriesName.substring(0, 35).padEnd(35)} (${episodes.length} eps)`);
        }
      } else {
        if (seriesCount <= 10) {
          console.log(`  ❌ ${seriesName.substring(0, 35).padEnd(35)} - não encontrada`);
        }
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
    
    if (seriesCount > 10) {
      console.log(`  ... e mais ${seriesCount - 10} séries`);
    }
    
    // Salva
    if (updated > 0 && !dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    return { updated, total: data.length, series: seriesCount };
    
  } catch (e) {
    console.error(`  ❌ Erro: ${e.message}`);
    return { updated: 0, total: 0, series: 0 };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║     🎬 CORRETOR DE IMAGENS DE SÉRIES - TVMaze API                 ║');
  console.log('║     Busca a imagem da SÉRIE e aplica para todos os episódios      ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArgs = args.filter(a => !a.startsWith('--'));
  
  if (dryRun) console.log('🔍 MODO DRY-RUN: Não salvará alterações\n');
  
  let files;
  
  if (fileArgs.length > 0) {
    files = fileArgs.map(f => {
      if (f.endsWith('.json')) return path.join(DATA_DIR, f);
      return path.join(DATA_DIR, `${f}.json`);
    }).filter(f => fs.existsSync(f));
  } else {
    // Processa apenas arquivos de streaming por padrão
    const streamingFiles = [
      'apple-tv.json', 'netflix.json', 'disney.json', 'max.json', 
      'prime-video.json', 'paramount.json', 'globoplay.json', 'crunchyroll.json'
    ];
    files = streamingFiles.map(f => path.join(DATA_DIR, f)).filter(f => fs.existsSync(f));
  }
  
  console.log(`📁 Arquivos: ${files.length}\n`);
  console.log('─'.repeat(70));
  
  let totalUpdated = 0;
  let totalSeries = 0;
  
  for (const file of files) {
    const fileName = path.basename(file);
    console.log(`\n📄 ${fileName}`);
    
    const result = await processFile(file, dryRun);
    totalUpdated += result.updated;
    totalSeries += result.series;
    
    console.log(`   ✅ ${result.series} séries atualizadas (${result.updated} episódios)`);
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log(`\n🎉 CONCLUÍDO!`);
  console.log(`   📊 ${totalSeries} séries processadas`);
  console.log(`   📊 ${totalUpdated} episódios atualizados`);
  
  if (dryRun) {
    console.log('\n⚠️  Execute sem --dry-run para salvar as alterações');
  }
}

main().catch(console.error);
