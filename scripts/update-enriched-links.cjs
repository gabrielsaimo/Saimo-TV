const fs = require('fs');
const path = require('path');

const M3U8_FILE = path.join(__dirname, '../public/data/CanaisBR03.m3u');
const ENRICHED_DIR = path.join(__dirname, '../public/data/enriched');

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseM3U() {
  console.log('📖 Lendo arquivo M3U...');
  const content = fs.readFileSync(M3U8_FILE, 'utf-8');
  const lines = content.split('\n');
  
  const entries = new Map();
  let currentName = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      currentName = nameMatch ? nameMatch[1].trim() : null;
    } else if (line.startsWith('http') && currentName) {
      const normalizedName = normalizeName(currentName);
      if (!entries.has(normalizedName)) {
        entries.set(normalizedName, line.trim());
      }
      currentName = null;
    }
  }
  
  return entries;
}

function updateEnrichedFiles(m3uEntries) {
  console.log('🔄 Atualizando arquivos enriched...');
  const files = fs.readdirSync(ENRICHED_DIR).filter(f => f.endsWith('.json'));

  let totalMovies = 0;
  let updatedMovies = 0;

  for (const file of files) {
    const filePath = path.join(ENRICHED_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const enrichedData = JSON.parse(fileContent);
      
      if (!Array.isArray(enrichedData)) {
        console.warn(`  ⚠️ O arquivo ${file} não contém um array JSON. Pulando.`);
        continue;
      }

      let fileUpdated = false;

      for (const movie of enrichedData) {
        totalMovies++;
        const normalizedMovieName = normalizeName(movie.name);
        
        if (m3uEntries.has(normalizedMovieName)) {
          const newUrl = m3uEntries.get(normalizedMovieName);
          if (movie.url !== newUrl) {
            console.log(`  - Atualizando URL para "${movie.name}" em ${file}`);
            movie.url = newUrl;
            updatedMovies++;
            fileUpdated = true;
          }
        }
      }

      if (fileUpdated) {
        fs.writeFileSync(filePath, JSON.stringify(enrichedData, null, 2), 'utf8');
        console.log(`  ✅ Arquivo ${file} salvo.`);
      }
    } catch (error) {
      console.error(`  ❌ Erro ao processar o arquivo ${file}: ${error.message}`);
    }
  }
  console.log(`\n📊 Total de filmes processados: ${totalMovies}`);
  console.log(`🔄 Total de filmes atualizados: ${updatedMovies}`);
}

function main() {
  console.log('🎬 Iniciando atualização de links enriched...\n');
  
  if (!fs.existsSync(M3U8_FILE)) {
    console.error('❌ Arquivo não encontrado:', M3U8_FILE);
    process.exit(1);
  }

  const m3uEntries = parseM3U();
  console.log(`✅ ${m3uEntries.size} entradas únicas encontradas no M3U.\n`);

  updateEnrichedFiles(m3uEntries);

  console.log('\n✅ Processo de atualização concluído!');
}

main();