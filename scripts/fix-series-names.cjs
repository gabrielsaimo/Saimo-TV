/**
 * 🔧 FIX SERIES NAMES - Corrige nomes de séries mal formatados
 * 
 * Passa por todos os arquivos e corrige nomes de séries que contêm
 * informações extras como "S01", ".mp4", etc.
 */

const fs = require('fs');
const path = require('path');

const ENRICHED_DIR = path.join(__dirname, '../public/data/enriched');
const IGNORE_FILES = ['categories.json', 'test-report-acao.json'];

/**
 * Limpa o nome da série removendo padrões indesejados
 */
function cleanSeriesName(name) {
    if (!name) return name;

    let cleaned = name
        // Remove tudo depois de S01, S02, etc.
        .replace(/\s+S\d+\s*.*/i, '')
        // Remove tudo depois de "Temporada"
        .replace(/\s+Temporada\s*\d+.*/i, '')
        // Remove tudo depois de "Season"
        .replace(/\s+Season\s*\d+.*/i, '')
        // Remove padrão tipo "Nome.da.Serie"
        .replace(/\.\w+\.\w+\.\w+.*/i, '')
        // Remove extensões de arquivo
        .replace(/\s*\.mp4/gi, '')
        .replace(/\s*\.mkv/gi, '')
        // Remove traços finais e espaços
        .replace(/\s*[-–—]\s*$/g, '')
        // Remove tags comuns
        .replace(/\s*\[.*?\]\s*/g, '')
        .replace(/\s*\(24h\)\s*/gi, '')
        // Remove qualidade
        .replace(/\s*4K$/i, '')
        .replace(/\s*FHD$/i, '')
        .replace(/\s*HD$/i, '')
        .replace(/\s*H\.?265$/i, '')
        // Limpa espaços extras
        .replace(/\s+/g, ' ')
        .trim();

    // Se depois de limpar ficou muito curto, tenta extrair de outra forma
    if (cleaned.length < 3) {
        // Tenta pegar a primeira parte antes de qualquer padrão estranho
        const match = name.match(/^(.{3,50}?)\s+S\d+/i);
        if (match) cleaned = match[1].trim();
    }

    return cleaned;
}

/**
 * Processa um arquivo JSON
 */
function processFile(filePath) {
    const fileName = path.basename(filePath);
    let content;

    try {
        content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        console.error(`❌ Erro ao ler ${fileName}`);
        return 0;
    }

    if (!Array.isArray(content)) return 0;

    let fixedCount = 0;

    for (const item of content) {
        // Só processa séries
        if (item.type !== 'series') continue;

        const originalName = item.name;
        const cleanedName = cleanSeriesName(originalName);

        // Se o nome mudou, atualiza
        if (cleanedName !== originalName && cleanedName.length >= 3) {
            item.name = cleanedName;
            fixedCount++;

            // Também atualiza o ID se for baseado no nome
            if (item.id && item.id.includes(originalName.substring(0, 10).toLowerCase())) {
                const newId = `series-${cleanedName.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .substring(0, 50)}-${Date.now()}`;
                item.id = newId;
            }
        }
    }

    if (fixedCount > 0) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    }

    return fixedCount;
}

async function main() {
    console.log('🔧 FIX SERIES NAMES - Corrigindo nomes de séries\n');

    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error('❌ Diretório não encontrado:', ENRICHED_DIR);
        return;
    }

    const files = fs.readdirSync(ENRICHED_DIR)
        .filter(f => f.endsWith('.json') && !IGNORE_FILES.includes(f));

    let totalFixed = 0;

    for (const file of files) {
        const filePath = path.join(ENRICHED_DIR, file);
        const fixed = processFile(filePath);

        if (fixed > 0) {
            console.log(`📂 ${file}: ${fixed} nomes corrigidos`);
            totalFixed += fixed;
        }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`✅ Total de nomes corrigidos: ${totalFixed}`);
    console.log('═══════════════════════════════════════\n');
}

main();
