/**
 * Script SIMPLES para corrigir imagens de capas
 * Esta versão NÃO precisa de API key!
 * 
 * Usa o serviço de imagens do TMDB diretamente através de IDs conhecidos
 * e fallbacks inteligentes.
 * 
 * Para rodar: node scripts/fix-images-simple.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Pasta com os JSONs
const DATA_DIR = path.join(__dirname, '../public/data');

// Base URL para imagens placeholder de alta qualidade
const PLACEHOLDER_BASE = 'https://via.placeholder.com/500x750/1a1a2e/eaeaea?text=';

// Cache de imagens já encontradas
const imageCache = new Map();

// Delay entre requisições
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extrai o nome limpo do filme/série
 */
function extractCleanName(name) {
  if (!name) return '';
  
  let cleanName = name
    // Remove ano entre parênteses
    .replace(/\s*\(\d{4}\)\s*/g, '')
    // Remove S01E01, T01E01, etc
    .replace(/\s*[ST]\d+\s*E\d+.*/i, '')
    .replace(/\s*Temporada\s*\d+.*/i, '')
    .replace(/\s*Season\s*\d+.*/i, '')
    .replace(/\s*Ep\.?\s*\d+.*/i, '')
    .replace(/\s*Episódio\s*\d+.*/i, '')
    // Remove qualificadores
    .replace(/\s*-\s*Dublado.*/i, '')
    .replace(/\s*-\s*Legendado.*/i, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*DUB\s*$/i, '')
    .replace(/\s*LEG\s*$/i, '')
    .trim();
  
  return cleanName;
}

/**
 * Extrai o ano do nome
 */
function extractYear(name) {
  const match = name.match(/\((\d{4})\)/);
  return match ? match[1] : null;
}

/**
 * Verifica se a URL da imagem parece válida
 */
function isValidImageUrl(url) {
  if (!url) return false;
  
  // URLs do TMDB são válidas
  if (url.includes('image.tmdb.org')) return true;
  
  // URLs conhecidas como quebradas
  const brokenPatterns = [
    '32q0d.xyz',
    'placeholder',
    'noimage',
    'default',
    'govfederal',
    '.xyz/images/',
    'undefined',
    'null'
  ];
  
  return !brokenPatterns.some(pattern => url.toLowerCase().includes(pattern));
}

/**
 * Gera URL de busca de imagem via Google Images (fallback)
 */
function generateSearchUrl(name, type) {
  const searchTerm = encodeURIComponent(`${name} ${type === 'series' ? 'tv series' : 'movie'} poster`);
  return `https://www.themoviedb.org/search?query=${searchTerm}`;
}

/**
 * Banco de dados de imagens conhecidas (filmes/séries populares)
 */
const KNOWN_IMAGES = {
  // Séries populares brasileiras
  'the voice kids': 'https://image.tmdb.org/t/p/w500/qGLAiOUVLbRgRHiAb2wdkGYl8kR.jpg',
  'big brother brasil': 'https://image.tmdb.org/t/p/w500/5Bs8grTjLUGZDwAnnmkXLJJfWUe.jpg',
  'a fazenda': 'https://image.tmdb.org/t/p/w500/4VKtBuVbgPwJmTxgHGLTMAXgVkg.jpg',
  'masterchef brasil': 'https://image.tmdb.org/t/p/w500/1N7Z7cVCVdWmZ0OiSFLJQ0JRWZP.jpg',
  'casamento às cegas brasil': 'https://image.tmdb.org/t/p/w500/lzWHmSjpCkPdxYO7sGhfJKN5zC7.jpg',
  
  // Séries internacionais populares
  'game of thrones': 'https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
  'breaking bad': 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
  'stranger things': 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
  'the walking dead': 'https://image.tmdb.org/t/p/w500/xf9wuDcqlUPWABZNeDKPbZUjWx0.jpg',
  'friends': 'https://image.tmdb.org/t/p/w500/f496cm9enuEsZkSPzCwnTESEK5s.jpg',
  'the office': 'https://image.tmdb.org/t/p/w500/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg',
  'grey\'s anatomy': 'https://image.tmdb.org/t/p/w500/jcEl8SISNfGdlQFwLzeEtsjDvpw.jpg',
  'narcos': 'https://image.tmdb.org/t/p/w500/rTmal9fDbwh5F0waol2hq35U4ah.jpg',
  'la casa de papel': 'https://image.tmdb.org/t/p/w500/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg',
  'money heist': 'https://image.tmdb.org/t/p/w500/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg',
  'squid game': 'https://image.tmdb.org/t/p/w500/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg',
  'round 6': 'https://image.tmdb.org/t/p/w500/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg',
  'euphoria': 'https://image.tmdb.org/t/p/w500/jtnfNzqZwN4E32FGGxx1YZaBWWf.jpg',
  'wednesday': 'https://image.tmdb.org/t/p/w500/9PFonBhy4cQy7Jz20NpMygczOkv.jpg',
  'the witcher': 'https://image.tmdb.org/t/p/w500/7vjaCdMw15FEbXyLQTVa04URsPm.jpg',
  'you': 'https://image.tmdb.org/t/p/w500/7bEYwjRQfmOAgJxILIdiH9HaGZ9.jpg',
  'peaky blinders': 'https://image.tmdb.org/t/p/w500/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg',
  'the mandalorian': 'https://image.tmdb.org/t/p/w500/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg',
  'loki': 'https://image.tmdb.org/t/p/w500/voHUmluYmKyleFkTu3lOXQG702u.jpg',
  'wandavision': 'https://image.tmdb.org/t/p/w500/glKDfE6btIRcVB5zrjspRIs4r52.jpg',
  'the last of us': 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg',
  'house of the dragon': 'https://image.tmdb.org/t/p/w500/z2yahl2uefxDCl0nogcRBstwruJ.jpg',
  'dark': 'https://image.tmdb.org/t/p/w500/5LoHuHWA4H8jElFlZDvsmU2n63b.jpg',
  'lucifer': 'https://image.tmdb.org/t/p/w500/ekZobS8isE6mA53RAiGDG93hBxL.jpg',
  'the boys': 'https://image.tmdb.org/t/p/w500/stTEycfG9928HYGEISBFaG1ngjM.jpg',
  'vikings': 'https://image.tmdb.org/t/p/w500/bQLrHIRNEkE3PdIWQrZHynQZazu.jpg',
  'ozark': 'https://image.tmdb.org/t/p/w500/pCGyPVrI9Fxip1wqzKstIFSYxcy.jpg',
  'the crown': 'https://image.tmdb.org/t/p/w500/1M876KPjulVwppEpldhdc8V4o68.jpg',
  'bridgerton': 'https://image.tmdb.org/t/p/w500/luoKpgVwi1E5nQsi7W0UuKHu2Rq.jpg',
  'arcane': 'https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
  
  // Animes populares
  'demon slayer': 'https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg',
  'kimetsu no yaiba': 'https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg',
  'attack on titan': 'https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg',
  'shingeki no kyojin': 'https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg',
  'one piece': 'https://image.tmdb.org/t/p/w500/cMD9Ygz11zjJzAovURpO75Qg7rT.jpg',
  'naruto': 'https://image.tmdb.org/t/p/w500/xppeysfvDKVx775MFuH8Z9BlpMk.jpg',
  'naruto shippuden': 'https://image.tmdb.org/t/p/w500/zAYRe2bJxpWTVrwSDYlSuPGIhvZ.jpg',
  'dragon ball z': 'https://image.tmdb.org/t/p/w500/6VKOfL6ihwTiB5Vibq6QTfzhxA6.jpg',
  'dragon ball super': 'https://image.tmdb.org/t/p/w500/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg',
  'jujutsu kaisen': 'https://image.tmdb.org/t/p/w500/hFWP5HkbVEe40hrXgtCeQxoccHE.jpg',
  'my hero academia': 'https://image.tmdb.org/t/p/w500/ivOLM47yJt90P19RH1NvJrAJz9F.jpg',
  'boku no hero academia': 'https://image.tmdb.org/t/p/w500/ivOLM47yJt90P19RH1NvJrAJz9F.jpg',
  'death note': 'https://image.tmdb.org/t/p/w500/g8hPRjRTLpFMQOsU3pHaivc4LUH.jpg',
  'spy x family': 'https://image.tmdb.org/t/p/w500/3r4LYFuXgttG8gRPvoxRogNT6j8.jpg',
  'chainsaw man': 'https://image.tmdb.org/t/p/w500/yVtx7Xn9UxNJqvG2BkvhCcmed9S.jpg',
  'tokyo revengers': 'https://image.tmdb.org/t/p/w500/5Dp3gXCEuiRqTHBfiHbJrxJR8ci.jpg',
  'fullmetal alchemist': 'https://image.tmdb.org/t/p/w500/1E1tUISBwd5lgcssLeJJZvPikEz.jpg',
  'bleach': 'https://image.tmdb.org/t/p/w500/2EewmxXe72ogD0EaWM8gqa0ccIw.jpg',
  'hunter x hunter': 'https://image.tmdb.org/t/p/w500/b0CmzBknFqEqJzIGVNrZ2tnMIL2.jpg',
  'one punch man': 'https://image.tmdb.org/t/p/w500/iE3s0lG5QVdEHOEZnoAxjMDtoFB.jpg',
  'black clover': 'https://image.tmdb.org/t/p/w500/fAPucUYkMrpkCPDgDHs3L9IWjPk.jpg',
  
  // Novelas brasileiras
  'pantanal': 'https://image.tmdb.org/t/p/w500/2JMWPHJjKHOiPZTj0SXWI90n0fv.jpg',
  'terra e paixão': 'https://image.tmdb.org/t/p/w500/yN5TZ2LGZSR7jfXZ8xnYJiVe9rG.jpg',
  'renascer': 'https://image.tmdb.org/t/p/w500/lKV93CVKGZV7yVjHCY89d3Z1yHm.jpg',
  'avenida brasil': 'https://image.tmdb.org/t/p/w500/8tIqIuIRDZKCKJB8QLzJo6LCwx2.jpg',
  'a dona do pedaço': 'https://image.tmdb.org/t/p/w500/hvZNZlZ7FtqEiDW7DvnANvn9w8R.jpg',
  
  // Doramas populares
  'true beauty': 'https://image.tmdb.org/t/p/w500/iFmH3NGYKjxiCBz9DM9D9iBMIWX.jpg',
  'goblin': 'https://image.tmdb.org/t/p/w500/mGhtFCt2Qg2aRYejTzQ7eFT4sFi.jpg',
  'crash landing on you': 'https://image.tmdb.org/t/p/w500/jFMiGnb8xNbcMQJo2HSFTmpHToL.jpg',
  'descendants of the sun': 'https://image.tmdb.org/t/p/w500/cmXfKIyQb3NpjnMgq5xY5N9jCdR.jpg',
  'extraordinary attorney woo': 'https://image.tmdb.org/t/p/w500/v2i2s8z4ywBKpMrRSTxHSr7JNtQ.jpg',
  'all of us are dead': 'https://image.tmdb.org/t/p/w500/xvwqNoAj0xqXFVXLDORNDIaHnU0.jpg',
  'business proposal': 'https://image.tmdb.org/t/p/w500/wJGRFdFgjL7xVpNHiQeQr6noRvX.jpg',
  'vincenzo': 'https://image.tmdb.org/t/p/w500/dvXJgEDQXhL9Ouot2WkBHpQiHGd.jpg',
  'itaewon class': 'https://image.tmdb.org/t/p/w500/zXpZSMxjAGtIcD6BRLvzhPQ7lBj.jpg',
  'the glory': 'https://image.tmdb.org/t/p/w500/pE4vWLPo0TBAsAo7z10q6SJVfCN.jpg',
};

/**
 * Procura imagem no banco de dados conhecido
 */
function findKnownImage(name) {
  const lowerName = name.toLowerCase();
  
  for (const [key, url] of Object.entries(KNOWN_IMAGES)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return url;
    }
  }
  
  return null;
}

/**
 * Gera uma imagem placeholder com o nome
 */
function generatePlaceholder(name) {
  const encodedName = encodeURIComponent(name.substring(0, 20));
  return `${PLACEHOLDER_BASE}${encodedName}`;
}

/**
 * Processa um item
 */
function processItem(item, seriesImageCache) {
  // Se já tem imagem válida, pula
  if (isValidImageUrl(item.logo)) {
    return { ...item, updated: false };
  }
  
  const cleanName = extractCleanName(item.name);
  if (!cleanName) {
    return { ...item, updated: false };
  }
  
  // Primeiro, verifica o cache de séries (para episódios)
  if (seriesImageCache.has(cleanName)) {
    return { ...item, logo: seriesImageCache.get(cleanName), updated: true };
  }
  
  // Procura no banco de dados conhecido
  let newImage = findKnownImage(cleanName);
  
  if (newImage) {
    // Salva no cache para próximos episódios
    seriesImageCache.set(cleanName, newImage);
    return { ...item, logo: newImage, updated: true };
  }
  
  // Se não encontrou, mantém a imagem original ou coloca placeholder
  return { ...item, updated: false };
}

/**
 * Processa um arquivo JSON
 */
function processFile(filePath) {
  const fileName = path.basename(filePath);
  
  // Pula arquivos especiais
  if (fileName === 'categories.json') {
    console.log(`⏭️  Pulando: ${fileName}`);
    return { processed: 0, updated: 0 };
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (!content.trim() || content.trim() === '[]') {
      console.log(`⏭️  Arquivo vazio: ${fileName}`);
      return { processed: 0, updated: 0 };
    }
    
    const items = JSON.parse(content);
    
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`⏭️  Sem itens: ${fileName}`);
      return { processed: 0, updated: 0 };
    }
    
    console.log(`📁 Processando: ${fileName} (${items.length} itens)`);
    
    // Cache para imagens de séries neste arquivo
    const seriesImageCache = new Map();
    
    let updated = 0;
    const updatedItems = items.map(item => {
      const result = processItem(item, seriesImageCache);
      if (result.updated) {
        updated++;
      }
      const { updated: _, ...cleanItem } = result;
      return cleanItem;
    });
    
    // Salva apenas se houve atualizações
    if (updated > 0) {
      fs.writeFileSync(filePath, JSON.stringify(updatedItems));
      console.log(`  ✅ ${updated}/${items.length} imagens atualizadas`);
    } else {
      console.log(`  ⚪ Nenhuma atualização necessária`);
    }
    
    return { processed: items.length, updated };
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${fileName}:`, error.message);
    return { processed: 0, updated: 0 };
  }
}

/**
 * Função principal
 */
function main() {
  console.log('🎬 Correção de Imagens (Modo Offline)\n');
  console.log('Este script usa um banco de dados de imagens conhecidas');
  console.log('para corrigir capas quebradas.\n');
  
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(DATA_DIR, f));
  
  console.log(`📂 Encontrados ${files.length} arquivos JSON\n`);
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  
  for (const file of files) {
    const { processed, updated } = processFile(file);
    totalProcessed += processed;
    totalUpdated += updated;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Finalizado!`);
  console.log(`   📊 Total processado: ${totalProcessed} itens`);
  console.log(`   ✅ Total atualizado: ${totalUpdated} imagens`);
  console.log('='.repeat(50));
}

main();
