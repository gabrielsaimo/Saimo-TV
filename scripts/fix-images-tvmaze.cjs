/**
 * Script para corrigir imagens usando TVMaze (100% gratuito, sem API key)
 * Também tenta OMDB e outras APIs gratuitas
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = path.join(__dirname, '../public/data');

// Cache de imagens já encontradas
const imageCache = new Map();

// Função para fazer request HTTP
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        ...options.headers
      },
      timeout: 15000
    }, (res) => {
      // Seguir redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpRequest(res.headers.location, options).then(resolve).catch(reject);
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Verifica se URL de imagem realmente funciona
async function verifyImageUrl(url) {
  if (!url) return false;
  
  try {
    const res = await httpRequest(url);
    const contentType = res.headers['content-type'] || '';
    return res.status === 200 && contentType.startsWith('image/');
  } catch {
    return false;
  }
}

// Limpa título para busca
function cleanTitle(title) {
  if (!title) return '';
  
  let clean = title
    // Remove prefixos de temporada
    .replace(/^(S\d+\s*[:-]?\s*|T\d+\s*[:-]?\s*)/i, '')
    .replace(/^(temporada\s*\d+\s*[:-]?\s*)/i, '')
    .replace(/^(season\s*\d+\s*[:-]?\s*)/i, '')
    // Remove sufixos de qualidade/idioma
    .replace(/\s*[-–]\s*(dublado|legendado|dual|nacional|4k|hd|uhd|fhd).*$/i, '')
    .replace(/\s*\[(dublado|legendado|dual|4k|hd|uhd|fhd)\]/gi, '')
    .replace(/\s*\((dublado|legendado|dual|4k|hd|uhd|fhd|completo)\)/gi, '')
    // Remove ano entre parênteses no final
    .replace(/\s*\(\d{4}\)\s*$/, '')
    // Remove emojis
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[🔥🎬📺🎥⭐🆕✨💫🌟⚡️🎭🎪]/g, '')
    // Remove marcadores de episódio
    .replace(/\s*-?\s*E\d+(\s*[-–]\s*E\d+)?$/i, '')
    .replace(/\s*EP?\.\s*\d+.*$/i, '')
    .replace(/\s*Episódio\s*\d+.*$/i, '')
    // Remove "completo", "completa"
    .replace(/\s*(completo|completa)$/i, '')
    // Limpa espaços e caracteres especiais
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-:]+|[\s\-:]+$/g, '')
    .trim();
  
  return clean;
}

// Verifica se imagem atual é válida
function isGoodImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.length < 20) return false;
  
  const badPatterns = [
    'ui-avatars.com',
    '32q0d.xyz',
    'placeholder',
    'default',
    'noimage',
    'no-image',
    'missing',
    '/null',
    'undefined',
  ];
  
  const urlLower = url.toLowerCase();
  if (badPatterns.some(p => urlLower.includes(p))) return false;
  
  // Verifica se tem extensão de imagem ou é de CDN conhecida
  const goodCDNs = ['tmdb.org', 'tvmaze.com', 'amazon.com', 'mzstatic.com', 'thetvdb.com'];
  if (goodCDNs.some(cdn => urlLower.includes(cdn))) return true;
  
  if (/\.(jpg|jpeg|png|webp)/i.test(url)) return true;
  
  return false;
}

// === APIs DE BUSCA ===

// TVMaze - 100% gratuita, sem limite
async function searchTVMaze(title) {
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`;
    const res = await httpRequest(url);
    
    if (res.status === 200) {
      const data = JSON.parse(res.data);
      if (data.image) {
        const imageUrl = data.image.original || data.image.medium;
        if (imageUrl && await verifyImageUrl(imageUrl)) {
          return imageUrl;
        }
      }
    }
  } catch {}
  return null;
}

// TVMaze search (retorna múltiplos resultados)
async function searchTVMazeMulti(title) {
  try {
    const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`;
    const res = await httpRequest(url);
    
    if (res.status === 200) {
      const results = JSON.parse(res.data);
      for (const result of results.slice(0, 3)) {
        if (result.show && result.show.image) {
          const imageUrl = result.show.image.original || result.show.image.medium;
          if (imageUrl && await verifyImageUrl(imageUrl)) {
            return imageUrl;
          }
        }
      }
    }
  } catch {}
  return null;
}

// TheMovieDB sem API key (usando site público)
async function searchTMDBPublic(title) {
  // Não funciona sem API key válida
  return null;
}

// Função principal de busca
async function findImage(title, originalTitle = null) {
  const cleanedTitle = cleanTitle(title);
  if (!cleanedTitle || cleanedTitle.length < 2) return null;
  
  // Verifica cache
  const cacheKey = cleanedTitle.toLowerCase();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  // Tenta TVMaze (melhor opção gratuita)
  let image = await searchTVMaze(cleanedTitle);
  if (image) {
    imageCache.set(cacheKey, { image, source: 'TVMaze' });
    return { image, source: 'TVMaze' };
  }
  
  // Tenta busca múltipla no TVMaze
  image = await searchTVMazeMulti(cleanedTitle);
  if (image) {
    imageCache.set(cacheKey, { image, source: 'TVMaze-Multi' });
    return { image, source: 'TVMaze-Multi' };
  }
  
  // Se título original for diferente, tenta também
  if (originalTitle && originalTitle !== title) {
    const cleanedOriginal = cleanTitle(originalTitle);
    if (cleanedOriginal && cleanedOriginal !== cleanedTitle) {
      image = await searchTVMaze(cleanedOriginal);
      if (image) {
        imageCache.set(cacheKey, { image, source: 'TVMaze-Original' });
        return { image, source: 'TVMaze-Original' };
      }
    }
  }
  
  // Marca como não encontrado no cache
  imageCache.set(cacheKey, null);
  return null;
}

// Processa um item (série/filme)
async function processItem(item) {
  // Verifica imagem atual
  const currentCover = item.cover || item.logo || item.image;
  
  // Se já tem imagem boa, pula
  if (isGoodImageUrl(currentCover)) {
    return false;
  }
  
  // Pega título
  const title = item.name || item.title || '';
  if (!title || title.length < 2) return false;
  
  // Busca nova imagem
  const result = await findImage(title);
  
  if (result) {
    // Atualiza a capa
    if ('cover' in item) item.cover = result.image;
    else if ('logo' in item) item.logo = result.image;
    else if ('image' in item) item.image = result.image;
    else item.cover = result.image;
    
    return result;
  }
  
  return false;
}

// Processa um arquivo JSON
async function processFile(filePath, dryRun = false) {
  const fileName = path.basename(filePath);
  
  if (fileName === 'categories.json') return { updated: 0, total: 0 };
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (!Array.isArray(data)) return { updated: 0, total: 0 };
    
    let updated = 0;
    const total = data.length;
    const updates = [];
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const result = await processItem(item);
      
      if (result) {
        updated++;
        const title = (item.name || item.title || '').substring(0, 35);
        updates.push({ title, source: result.source, image: result.image });
        
        // Mostra progresso
        if (updates.length <= 10) {
          console.log(`  ✅ ${title.padEnd(35)} → ${result.source}`);
        }
      }
      
      // Rate limiting - pausa a cada 10 requests
      if (i > 0 && i % 10 === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    if (updates.length > 10) {
      console.log(`  ... e mais ${updates.length - 10} atualizações`);
    }
    
    // Salva arquivo se não for dry run
    if (updated > 0 && !dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    return { updated, total, updates };
    
  } catch (e) {
    console.error(`  ❌ Erro: ${e.message}`);
    return { updated: 0, total: 0 };
  }
}

// === MAIN ===
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        🖼️  CORRETOR DE IMAGENS - TVMaze API (Gratuita)            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const testOnly = args.includes('--test');
  
  if (dryRun) console.log('🔍 MODO DRY-RUN: Não salvará alterações\n');
  
  let files;
  
  // Filtra argumentos que não são flags
  const fileArgs = args.filter(a => !a.startsWith('--'));
  
  if (testOnly) {
    // Modo teste - só alguns arquivos
    files = ['apple-tv.json', 'netflix.json', 'disney.json', 'max.json', 'prime-video.json']
      .map(f => path.join(DATA_DIR, f))
      .filter(f => fs.existsSync(f));
  } else if (fileArgs.length > 0) {
    files = fileArgs.map(f => {
      if (f.endsWith('.json')) return path.join(DATA_DIR, f);
      return path.join(DATA_DIR, `${f}.json`);
    }).filter(f => fs.existsSync(f));
  } else {
    files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json') && f !== 'categories.json')
      .map(f => path.join(DATA_DIR, f));
  }
  
  console.log(`📁 Arquivos: ${files.length}\n`);
  console.log('─'.repeat(70));
  
  let totalUpdated = 0;
  let totalProcessed = 0;
  
  for (const file of files) {
    const fileName = path.basename(file);
    console.log(`\n📄 ${fileName}`);
    
    const result = await processFile(file, dryRun);
    totalUpdated += result.updated;
    totalProcessed += result.total;
    
    console.log(`   📊 ${result.updated}/${result.total} atualizados`);
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log(`\n✅ CONCLUÍDO!`);
  console.log(`   📊 Total: ${totalUpdated}/${totalProcessed} imagens atualizadas`);
  
  if (dryRun) {
    console.log('\n⚠️  Modo dry-run: Nenhum arquivo foi modificado');
    console.log('   Execute sem --dry-run para salvar as alterações');
  }
}

main().catch(console.error);
