/**
 * 🔧 Script de Correção - Preencher episódios faltantes, imagens e remover vazios
 * 
 * Funcionalidades:
 * - Remove arquivos JSON vazios ou corrompidos
 * - Preenche episódios faltantes nas séries
 * - Busca imagens dos JSONs originais para itens sem TMDB
 * - Atualiza logos e posters faltantes
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../public/data');
const OUTPUT_DIR = path.join(__dirname, '../public/data/enriched');

/**
 * Extrai informações de episódio do nome
 */
function parseEpisodeInfo(name) {
  const patterns = [
    /^(.+?)\s*[ST](\d+)\s*E(\d+)/i,
    /^(.+?)\s*Temporada\s*(\d+)\s*(?:Ep\.?|Episódio)\s*(\d+)/i,
    /^(.+?)\s*Season\s*(\d+)\s*(?:Ep\.?|Episode)\s*(\d+)/i,
    /^(.+?)\s*(\d+)x(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return {
        baseName: match[1].trim(),
        season: parseInt(match[2], 10),
        episode: parseInt(match[3], 10)
      };
    }
  }
  
  return null;
}

function cleanTitle(name) {
  const epInfo = parseEpisodeInfo(name);
  const baseName = epInfo ? epInfo.baseName : name;
  
  return baseName
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/^📺\s*/g, '')
    .replace(/^🎬\s*/g, '')
    .replace(/\s*\(\d{4}\)\s*/g, '')
    .replace(/\s*\[CAM\]/gi, '')
    .replace(/\s*\[CINEMA\]/gi, '')
    .replace(/\s*\[HD\]/gi, '')
    .replace(/\s*\[4K\]/gi, '')
    .replace(/\s*-\s*Dublado.*/i, '')
    .replace(/\s*-\s*Legendado.*/i, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*DUB\s*$/i, '')
    .replace(/\s*LEG\s*$/i, '')
    .replace(/[_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Verifica se uma URL de imagem é válida
 */
function isValidImageUrl(url) {
  if (!url) return false;
  if (typeof url !== 'string') return false;
  if (url.trim() === '') return false;
  
  // Verifica se é uma URL válida
  return url.startsWith('http://') || 
         url.startsWith('https://') || 
         url.startsWith('//');
}

let stats = {
  filesProcessed: 0,
  filesDeleted: 0,
  seriesFixed: 0,
  episodesAdded: 0,
  imagesAdded: 0,
  itemsWithoutImages: 0
};

async function fixCategory(categoryFile) {
  const enrichedPath = path.join(OUTPUT_DIR, `${categoryFile}.json`);
  const originalPath = path.join(DATA_DIR, `${categoryFile}.json`);
  
  if (!fs.existsSync(enrichedPath)) return;
  
  let enrichedData;
  try {
    enrichedData = JSON.parse(fs.readFileSync(enrichedPath, 'utf8'));
  } catch {
    console.log(`  ❌ Erro ao ler: ${categoryFile}.json - removendo`);
    fs.unlinkSync(enrichedPath);
    stats.filesDeleted++;
    return;
  }
  
  // Remove arquivos vazios
  if (!enrichedData || enrichedData.length === 0) {
    console.log(`  🗑️ Removendo arquivo vazio: ${categoryFile}.json`);
    fs.unlinkSync(enrichedPath);
    stats.filesDeleted++;
    return;
  }
  
  // Carrega dados originais para pegar episódios e imagens
  let originalData = [];
  if (fs.existsSync(originalPath)) {
    try {
      originalData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
    } catch {
      console.log(`  ⚠️ Erro ao ler original de ${categoryFile}`);
    }
  }
  
  // Cria mapa de itens originais por ID e por nome limpo
  const originalById = new Map();
  const originalByName = new Map();
  const originalEpisodes = new Map();
  
  for (const item of originalData) {
    // Indexa por ID
    if (item.id) {
      originalById.set(item.id, item);
    }
    
    // Indexa por nome limpo
    const cleanName = cleanTitle(item.name);
    if (!originalByName.has(cleanName)) {
      originalByName.set(cleanName, item);
    }
    
    // Se é série, agrupa episódios
    if (item.type === 'series') {
      const epInfo = parseEpisodeInfo(item.name);
      if (epInfo) {
        const key = cleanTitle(epInfo.baseName);
        
        if (!originalEpisodes.has(key)) {
          originalEpisodes.set(key, []);
        }
        
        originalEpisodes.get(key).push({
          season: epInfo.season,
          episode: epInfo.episode,
          name: item.name,
          url: item.url,
          id: item.id,
          logo: item.logo
        });
      }
    }
  }
  
  let modified = false;
  let imagesAddedInFile = 0;
  let seriesFixedInFile = 0;
  
  // Processa cada item enriched
  for (const item of enrichedData) {
    // ========================================
    // 1. BUSCA IMAGENS FALTANTES
    // ========================================
    
    const hasTmdbPoster = item.tmdb?.poster && isValidImageUrl(item.tmdb.poster);
    const hasLogo = item.logo && isValidImageUrl(item.logo);
    
    // Se não tem poster TMDB nem logo, busca no original
    if (!hasTmdbPoster && !hasLogo) {
      let originalItem = null;
      
      // Tenta encontrar por ID
      if (item.id) {
        originalItem = originalById.get(item.id);
      }
      
      // Se não encontrou, tenta por nome
      if (!originalItem) {
        const cleanName = cleanTitle(item.name);
        originalItem = originalByName.get(cleanName);
      }
      
      // Se encontrou e tem logo válido, usa
      if (originalItem && isValidImageUrl(originalItem.logo)) {
        item.logo = originalItem.logo;
        
        // Se não tem tmdb, cria um objeto básico
        if (!item.tmdb) {
          item.tmdb = {
            title: item.name,
            poster: originalItem.logo
          };
        } else if (!item.tmdb.poster) {
          item.tmdb.poster = originalItem.logo;
        }
        
        imagesAddedInFile++;
        stats.imagesAdded++;
        modified = true;
      } else {
        stats.itemsWithoutImages++;
      }
    }
    
    // ========================================
    // 2. CORRIGE SÉRIES COM EPISÓDIOS VAZIOS
    // ========================================
    
    if (item.type === 'series') {
      const key = cleanTitle(item.name);
      const episodes = originalEpisodes.get(key);
      
      // Verifica se episodes está vazio ou incompleto
      const currentEpisodeCount = Object.values(item.episodes || {}).reduce(
        (sum, eps) => sum + (eps?.length || 0), 0
      );
      
      if (episodes && episodes.length > 0 && currentEpisodeCount === 0) {
        // Organiza episódios por temporada
        const seasonMap = {};
        let firstLogo = null;
        
        for (const ep of episodes) {
          const seasonKey = ep.season.toString();
          if (!seasonMap[seasonKey]) {
            seasonMap[seasonKey] = [];
          }
          seasonMap[seasonKey].push({
            episode: ep.episode,
            name: ep.name,
            url: ep.url,
            id: ep.id
          });
          
          if (!firstLogo && isValidImageUrl(ep.logo)) {
            firstLogo = ep.logo;
          }
        }
        
        // Ordena episódios dentro de cada temporada
        for (const season of Object.keys(seasonMap)) {
          seasonMap[season].sort((a, b) => a.episode - b.episode);
        }
        
        item.episodes = seasonMap;
        item.totalEpisodes = episodes.length;
        item.totalSeasons = Object.keys(seasonMap).length;
        
        // Se não tem imagem e encontrou logo nos episódios, usa
        if (!item.logo && firstLogo) {
          item.logo = firstLogo;
          if (!item.tmdb) {
            item.tmdb = { title: item.name, poster: firstLogo };
          } else if (!item.tmdb.poster) {
            item.tmdb.poster = firstLogo;
          }
          imagesAddedInFile++;
          stats.imagesAdded++;
        }
        
        seriesFixedInFile++;
        stats.seriesFixed++;
        stats.episodesAdded += episodes.length;
        modified = true;
      }
    }
  }
  
  // Salva se houve modificações
  if (modified) {
    fs.writeFileSync(enrichedPath, JSON.stringify(enrichedData, null, 2), 'utf8');
    
    const changes = [];
    if (seriesFixedInFile > 0) changes.push(`${seriesFixedInFile} séries`);
    if (imagesAddedInFile > 0) changes.push(`${imagesAddedInFile} imagens`);
    
    console.log(`  ✅ ${categoryFile} - ${changes.join(', ')}`);
  } else {
    console.log(`  ⏭️ ${categoryFile} (OK)`);
  }
  
  stats.filesProcessed++;
}

async function main() {
  console.log('🔧 Corrigindo episódios faltantes, imagens e removendo vazios\n');
  
  // Verifica se diretório existe
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log('❌ Diretório enriched não encontrado!');
    return;
  }
  
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
  
  console.log(`📁 ${files.length} arquivos para verificar\n`);
  
  for (const file of files) {
    await fixCategory(file);
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('📊 RESULTADO');
  console.log('═══════════════════════════════════════');
  console.log(`📁 Arquivos processados: ${stats.filesProcessed}`);
  console.log(`🗑️ Arquivos vazios removidos: ${stats.filesDeleted}`);
  console.log(`📺 Séries corrigidas: ${stats.seriesFixed}`);
  console.log(`📼 Episódios adicionados: ${stats.episodesAdded}`);
  console.log(`🖼️ Imagens adicionadas: ${stats.imagesAdded}`);
  console.log(`⚠️ Itens ainda sem imagem: ${stats.itemsWithoutImages}`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(console.error);
