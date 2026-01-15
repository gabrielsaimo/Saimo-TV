/**
 * Script RÁPIDO para corrigir imagens de séries
 * Processa em PARALELO (10 séries por vez)
 * Usa TVMaze API (gratuita)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '../public/data');
const PARALLEL_LIMIT = 10; // Requisições paralelas

// Cache global de imagens
const seriesCache = new Map();

// HTTP GET com timeout curto
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', () => resolve({ status: 0, data: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: '' }); });
  });
}

// Extrai nome da série
function extractSeriesName(title) {
  if (!title) return null;
  return title
    .replace(/\s*\(\d{4}\)\s*/g, ' ')
    .replace(/\s*S\d+\s*E\d+.*$/i, '')
    .replace(/\s*T\d+\s*E\d+.*$/i, '')
    .replace(/\s*Temporada\s*\d+.*$/i, '')
    .replace(/\s*Season\s*\d+.*$/i, '')
    .replace(/\s*EP?\.\s*\d+.*$/i, '')
    .replace(/\s*[-–]\s*(Dublado|Legendado|Dual|Nacional).*$/i, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

// Busca imagem no TVMaze
async function searchTVMaze(name) {
  if (!name || name.length < 2) return null;
  
  const cacheKey = name.toLowerCase();
  if (seriesCache.has(cacheKey)) return seriesCache.get(cacheKey);
  
  try {
    const res = await httpGet(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(name)}`);
    if (res.status === 200) {
      const data = JSON.parse(res.data);
      if (data.image) {
        const img = data.image.original || data.image.medium;
        seriesCache.set(cacheKey, img);
        return img;
      }
    }
  } catch {}
  
  seriesCache.set(cacheKey, null);
  return null;
}

// Processa lote de séries em paralelo
async function processBatch(seriesList) {
  return Promise.all(seriesList.map(async ({ name, episodes }) => {
    const image = await searchTVMaze(name);
    return { name, episodes, image };
  }));
}

// Processa arquivo
async function processFile(filePath) {
  const fileName = path.basename(filePath);
  if (fileName === 'categories.json') return { updated: 0, series: 0 };
  
  console.log(`\n📄 ${fileName}`);
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data)) return { updated: 0, series: 0 };
    
    // Agrupa por série
    const seriesMap = new Map();
    for (const item of data) {
      if (item.type !== 'series') continue;
      const name = extractSeriesName(item.name || item.title);
      if (!name) continue;
      if (!seriesMap.has(name)) seriesMap.set(name, []);
      seriesMap.get(name).push(item);
    }
    
    const seriesList = Array.from(seriesMap.entries()).map(([name, episodes]) => ({ name, episodes }));
    console.log(`   📊 ${seriesList.length} séries`);
    
    let updated = 0;
    let found = 0;
    
    // Processa em batches paralelos
    for (let i = 0; i < seriesList.length; i += PARALLEL_LIMIT) {
      const batch = seriesList.slice(i, i + PARALLEL_LIMIT);
      const results = await processBatch(batch);
      
      for (const { name, episodes, image } of results) {
        if (image) {
          found++;
          for (const ep of episodes) {
            if ('logo' in ep) ep.logo = image;
            else if ('cover' in ep) ep.cover = image;
            else ep.logo = image;
            updated++;
          }
        }
      }
      
      // Mostra progresso
      process.stdout.write(`\r   ⏳ ${Math.min(i + PARALLEL_LIMIT, seriesList.length)}/${seriesList.length} séries...`);
    }
    
    console.log(`\n   ✅ ${found} séries encontradas, ${updated} episódios atualizados`);
    
    // Salva
    if (updated > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    return { updated, series: found };
    
  } catch (e) {
    console.error(`   ❌ Erro: ${e.message}`);
    return { updated: 0, series: 0 };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 CORRETOR RÁPIDO DE IMAGENS (PARALELO)                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  
  let files;
  if (args.length > 0) {
    files = args.map(f => path.join(DATA_DIR, f.endsWith('.json') ? f : `${f}.json`))
                .filter(f => fs.existsSync(f));
  } else {
    // Todos os arquivos de streaming
    files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json') && f !== 'categories.json')
      .map(f => path.join(DATA_DIR, f));
  }
  
  console.log(`\n📁 ${files.length} arquivos para processar\n`);
  
  const start = Date.now();
  let totalUpdated = 0;
  let totalSeries = 0;
  
  for (const file of files) {
    const result = await processFile(file);
    totalUpdated += result.updated;
    totalSeries += result.series;
  }
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  console.log('\n' + '═'.repeat(60));
  console.log(`\n🎉 CONCLUÍDO em ${elapsed}s!`);
  console.log(`   📊 ${totalSeries} séries | ${totalUpdated} episódios atualizados`);
}

main().catch(console.error);
