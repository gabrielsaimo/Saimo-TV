/**
 * 🔞 Script de Processamento - Conteúdo Adulto
 * 
 * Processa os 3 arquivos de conteúdo adulto e gera versões enriched
 * Usa as imagens dos JSONs originais já que não há dados TMDB
 * 
 * Arquivos processados:
 * - adultos.json
 * - adultos-bella-da-semana.json
 * - adultos-legendado.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../public/data');
const OUTPUT_DIR = path.join(__dirname, '../public/data/enriched');

// Arquivos de adultos para processar
const ADULT_FILES = [
  'adultos',
  'adultos-bella-da-semana',
  'adultos-legendado'
];

/**
 * Limpa o título removendo prefixos e sufixos
 */
function cleanTitle(name) {
  return name
    .replace(/^\[XXX\]\s*/gi, '')
    .replace(/\s*\[Adulto\]$/gi, '')
    .replace(/\s*\[Adult\]$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai o nome do estúdio/produtora do título
 */
function extractStudio(name) {
  const cleanName = cleanTitle(name);
  
  // Padrões comuns de estúdios
  const studioPatterns = [
    /^(Brazzers\w*)\s/i,
    /^(Hotandmean)\s/i,
    /^(Realitykings\w*)\s/i,
    /^(Naughty\s*America)\s/i,
    /^(Bangbros\w*)\s/i,
    /^(Bella da Semana)\s/i,
    /^(Vixen)\s/i,
    /^(Blacked\w*)\s/i,
    /^(Tushy\w*)\s/i,
    /^(Twistys\w*)\s/i,
    /^(Mofos\w*)\s/i,
    /^(Digital\s*Playground)\s/i,
    /^(Pure\s*Taboo)\s/i,
    /^(Adult\s*Time)\s/i,
    /^(Team\s*Skeet\w*)\s/i,
    /^(Evil\s*Angel)\s/i,
    /^(Jules\s*Jordan)\s/i,
    /^(Wicked)\s/i,
    /^(Private)\s/i,
    /^(Dorcel)\s/i,
    /^(Vivid)\s/i,
    /^(21\s*Sextury)\s/i,
    /^(Girlsway)\s/i,
    /^(Sweet\s*Sinner)\s/i,
  ];
  
  for (const pattern of studioPatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Tenta pegar a primeira palavra/palavras antes do nome de pessoas
  const words = cleanName.split(' ');
  if (words.length >= 2) {
    // Se a segunda palavra começa com maiúscula e parece nome de pessoa
    if (words[1] && /^[A-Z][a-z]+$/.test(words[1])) {
      return words[0];
    }
  }
  
  return null;
}

/**
 * Extrai nomes de performers do título
 */
function extractPerformers(name) {
  const cleanName = cleanTitle(name);
  
  // Remove o nome do estúdio
  const studio = extractStudio(name);
  let titleWithoutStudio = cleanName;
  if (studio) {
    // Escapa caracteres especiais do regex
    const escapedStudio = studio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    titleWithoutStudio = cleanName.replace(new RegExp(`^${escapedStudio}\\s*`, 'i'), '');
  }
  
  // Padrões para extrair nomes
  // Nome Sobrenome ou Nome Nome
  const namePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  const matches = titleWithoutStudio.match(namePattern) || [];
  
  // Filtra palavras comuns que não são nomes
  const commonWords = new Set([
    'Video', 'Part', 'Episode', 'Scene', 'With', 'And', 'The',
    'Play', 'Fuck', 'Sex', 'Hot', 'Best', 'New', 'Full',
    'Anal', 'Oral', 'Deep', 'Hard', 'Big', 'Small', 'Young',
    'Old', 'Teen', 'Milf', 'Step', 'Mom', 'Dad', 'Sister',
    'Brother', 'Especial', 'Retrospectiva'
  ]);
  
  const performers = matches
    .filter(name => name.length > 2 && !commonWords.has(name))
    .slice(0, 3); // Máximo 3 performers
  
  return performers;
}

let stats = {
  filesProcessed: 0,
  itemsProcessed: 0,
  itemsWithImages: 0
};

async function processAdultCategory(categoryName) {
  const originalPath = path.join(DATA_DIR, `${categoryName}.json`);
  const enrichedPath = path.join(OUTPUT_DIR, `${categoryName}.json`);
  
  if (!fs.existsSync(originalPath)) {
    console.log(`  ❌ Arquivo não encontrado: ${categoryName}.json`);
    return;
  }
  
  let originalData;
  try {
    const rawData = fs.readFileSync(originalPath, 'utf8');
    originalData = JSON.parse(rawData);
  } catch (err) {
    console.log(`  ❌ Erro ao ler ${categoryName}.json: ${err.message}`);
    return;
  }
  
  if (!Array.isArray(originalData) || originalData.length === 0) {
    console.log(`  ⏭️ ${categoryName} está vazio`);
    return;
  }
  
  console.log(`  📂 Processando ${categoryName}: ${originalData.length} itens`);
  
  const enrichedData = [];
  let withImages = 0;
  
  for (const item of originalData) {
    const cleanName = cleanTitle(item.name);
    const studio = extractStudio(item.name);
    const performers = extractPerformers(item.name);
    
    // Estrutura enriched para adultos
    const enrichedItem = {
      id: item.id,
      name: cleanName,
      originalName: item.name,
      url: item.url,
      logo: item.logo || null,
      category: item.category,
      type: item.type || 'movie',
      isAdult: true,
      // TMDB simulado para manter compatibilidade com o catálogo
      tmdb: {
        title: cleanName,
        poster: item.logo || null,
        backdrop: null,
        rating: null,
        year: null,
        certification: '18',
        genres: ['Adulto'],
        overview: null,
        runtime: null,
        // Informações específicas de adultos
        studio: studio,
        performers: performers.map(name => ({
          name: name,
          character: 'Performer',
          photo: null
        }))
      }
    };
    
    if (item.logo) {
      withImages++;
    }
    
    enrichedData.push(enrichedItem);
  }
  
  // Garante que o diretório existe
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Salva arquivo enriched
  fs.writeFileSync(enrichedPath, JSON.stringify(enrichedData, null, 2), 'utf8');
  
  stats.filesProcessed++;
  stats.itemsProcessed += originalData.length;
  stats.itemsWithImages += withImages;
  
  console.log(`  ✅ ${categoryName}: ${originalData.length} itens, ${withImages} com imagens`);
}

async function main() {
  console.log('🔞 Processando conteúdo adulto para catálogo\n');
  
  // Verifica se diretório de saída existe
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('📁 Criado diretório enriched\n');
  }
  
  console.log(`📁 Processando ${ADULT_FILES.length} arquivos:\n`);
  
  for (const file of ADULT_FILES) {
    await processAdultCategory(file);
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('📊 RESULTADO');
  console.log('═══════════════════════════════════════');
  console.log(`📁 Arquivos processados: ${stats.filesProcessed}`);
  console.log(`🎬 Itens processados: ${stats.itemsProcessed}`);
  console.log(`🖼️ Itens com imagens: ${stats.itemsWithImages}`);
  console.log('═══════════════════════════════════════\n');
  
  console.log('💡 Os arquivos foram salvos em public/data/enriched/');
  console.log('   Use isAdult: true para filtrar conteúdo adulto no catálogo');
}

main().catch(console.error);
