const fs = require('fs');
const path = require('path');
const readline = require('readline');

const M3U8_FILE = path.join(__dirname, '../public/data/CanaisBR03.m3u');
const ENRICHED_DIR = path.join(__dirname, '../public/data/enriched');

function normalizeName(name) {
  if (!name) return '';
  let normalized = name.toLowerCase();
  normalized = normalized.normalize('NFD').replace(/[̀-ͯ]/g, '');
  normalized = normalized.replace(/[[^]]*\]/g, ''); // Remove content in brackets
  normalized = normalized.replace(/\([^)]*\)/g, ''); // Remove content in parentheses
  normalized = normalized.replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric
  return normalized;
}

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

async function parseM3U() {
  console.log('Lendo arquivo M3U...');
  const fileStream = fs.createReadStream(M3U8_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const entries = new Map();
  let currentName = null;

  for await (const line of rl) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('#EXTINF:')) {
      const nameMatch = trimmedLine.match(/tvg-name="([^"]+)"/);
      currentName = nameMatch ? nameMatch[1].trim() : null;
      if (!currentName) {
        const commaNameMatch = trimmedLine.match(/,(.+)$/);
        currentName = commaNameMatch ? commaNameMatch[1].trim() : null;
      }
    } else if (trimmedLine.startsWith('http') && currentName) {
      const normalizedName = normalizeName(currentName);
      if (!entries.has(normalizedName)) {
        entries.set(normalizedName, { url: trimmedLine, originalName: currentName });
      }
      currentName = null;
    }
  }

  return entries;
}

function updateEnrichedFiles(m3uEntries) {
  console.log('Atualizando arquivos enriched...');
  const files = fs.readdirSync(ENRICHED_DIR).filter(f => f.endsWith('.json'));

  let totalProcessed = 0;
  let totalUpdated = 0;

  for (const file of files) {
    const filePath = path.join(ENRICHED_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const enrichedData = JSON.parse(fileContent);
      
      if (!Array.isArray(enrichedData)) {
        console.warn(`O arquivo ${file} nao contem um array JSON. Pulando.`);
        continue;
      }

      let fileUpdated = false;

      for (const item of enrichedData) {
        totalProcessed++;
        if (totalProcessed % 500 === 0) {
          console.log(`... processados ${totalProcessed} itens`);
        }

        if (item.type === 'series' && item.episodes && Array.isArray(item.episodes)) {
          // It's a series
          for (const season of item.episodes) {
            for (const episode of season) {
                const episodeInfo = parseEpisodeInfo(episode.name);
                if (episodeInfo) {
                    for (const [m3uKey, m3uValue] of m3uEntries.entries()) {
                        const m3uEpisodeInfo = parseEpisodeInfo(m3uValue.originalName);
                        if (m3uEpisodeInfo) {
                            const normalizedM3uBase = normalizeName(m3uEpisodeInfo.baseName);
                            const normalizedJsonBase = normalizeName(episodeInfo.baseName);

                            if (
                                (normalizedM3uBase.includes(normalizedJsonBase) || normalizedJsonBase.includes(normalizedM3uBase)) &&
                                m3uEpisodeInfo.season === episodeInfo.season &&
                                m3uEpisodeInfo.episode === episodeInfo.episode
                            ) {
                                if (episode.url !== m3uValue.url) {
                                    console.log(`- Atualizando URL para "${episode.name}" em ${file}`);
                                    episode.url = m3uValue.url;
                                    totalUpdated++;
                                    fileUpdated = true;
                                }
                                break;
                            }
                        }
                    }
                }
            }
          }
        } else {
          // It's a movie
          const normalizedMovieName = normalizeName(item.name);
          if (m3uEntries.has(normalizedMovieName)) {
            const newUrl = m3uEntries.get(normalizedMovieName).url;
            if (item.url !== newUrl) {
              console.log(`- Atualizando URL para "${item.name}" em ${file}`);
              item.url = newUrl;
              totalUpdated++;
              fileUpdated = true;
            }
          }
        }
      }

      if (fileUpdated) {
        fs.writeFileSync(filePath, JSON.stringify(enrichedData, null, 2), 'utf8');
        console.log(`Arquivo ${file} salvo.`);
      }
    } catch (error) {
      console.error(`Erro ao processar o arquivo ${file}: ${error.message}`);
    }
  }
  console.log(`
Total de itens processados: ${totalProcessed}`);
  console.log(`Total de itens atualizados: ${totalUpdated}`);
}

async function main() {
  console.log('Iniciando atualizacao de links enriched (v18)...');
  
  if (!fs.existsSync(M3U8_FILE)) {
    console.error('Arquivo nao encontrado:', M3U8_FILE);
    process.exit(1);
  }

  const m3uEntries = await parseM3U();
  console.log(`${m3uEntries.size} entradas unicas encontradas no M3U.`);

  updateEnrichedFiles(m3uEntries);

  console.log('\nProcesso de atualizacao concluido!');
}

main();