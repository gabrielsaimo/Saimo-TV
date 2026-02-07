/**
 * 🔧 FIX SERIES FORMAT - Corrige séries mal formatadas
 * 
 * PROBLEMA: Episódios estão salvos como itens individuais com type='movie'
 * SOLUÇÃO: Agrupa episódios em objetos de série com formato correto
 * 
 * FORMATO CORRETO:
 * {
 *   "id": "series-xxx",
 *   "name": "The Good Doctor",
 *   "type": "series",
 *   "episodes": {
 *     "1": [{ episode: 1, name: "...", url: "..." }, ...],
 *     "2": [{ episode: 1, ... }, ...]
 *   },
 *   "totalSeasons": 7,
 *   "totalEpisodes": 140
 * }
 */

const fs = require('fs');
const path = require('path');

const ENRICHED_DIR = path.join(__dirname, '../public/data/enriched');
const IGNORE_FILES = ['categories.json', 'test-report-acao.json'];

// Padrões para detectar episódios
const EPISODE_PATTERNS = [
    /^(.+?)\s+S(\d+)\s*[\.E]?\s*(\d+)/i,          // "Nome S01E01" ou "Nome S01.01" ou "Nome S01 E01"
    /^(.+?)\s+S(\d+)\s+.+?[SE](\d+)/i,             // "Nome S06 The.Good.Doctor.S06.E22"
    /^(.+?)\s+Temporada\s*(\d+)\s*(?:Ep\.?|Episódio)\s*(\d+)/i,
    /^(.+?)\s+Season\s*(\d+)\s*(?:Ep\.?|Episode)\s*(\d+)/i,
    /^(.+?)\s+(\d+)x(\d+)/i,
];

/**
 * Extrai informações de episódio do nome
 */
function parseEpisodeInfo(name) {
    for (const pattern of EPISODE_PATTERNS) {
        const match = name.match(pattern);
        if (match) {
            let baseName = match[1].trim();
            // Limpa o nome base
            baseName = baseName
                .replace(/\s*\[.*?\]\s*/g, '')
                .replace(/\s*\(.*?\)\s*/g, '')
                .replace(/\s*:\s*[^:]+$/, '') // Remove subtítulo após ":"
                .trim();

            return {
                baseName,
                season: parseInt(match[2], 10),
                episode: parseInt(match[3], 10)
            };
        }
    }
    return null;
}

/**
 * Gera ID limpo para série
 */
function generateSeriesId(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
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
        return { fixed: 0, removed: 0 };
    }

    if (!Array.isArray(content)) return { fixed: 0, removed: 0 };

    // Mapa para agrupar episódios por série
    const seriesMap = new Map();
    const itemsToKeep = [];
    const idsToRemove = new Set();

    // Primeira passagem: identificar episódios e agrupar
    for (const item of content) {
        // Se já é uma série formatada corretamente, mantém
        if (item.type === 'series' && item.episodes && typeof item.episodes === 'object') {
            itemsToKeep.push(item);
            continue;
        }

        // Tenta extrair info de episódio
        const epInfo = parseEpisodeInfo(item.name);

        if (epInfo) {
            // É um episódio - agrupa
            const seriesKey = generateSeriesId(epInfo.baseName);

            if (!seriesMap.has(seriesKey)) {
                seriesMap.set(seriesKey, {
                    baseName: epInfo.baseName,
                    category: item.category,
                    isAdult: item.isAdult || false,
                    logo: item.logo,
                    episodes: {},
                    tmdb: null // Reset - será preenchido depois
                });
            }

            const series = seriesMap.get(seriesKey);
            const seasonKey = String(epInfo.season);

            if (!series.episodes[seasonKey]) {
                series.episodes[seasonKey] = [];
            }

            // Verifica se episódio já existe
            const exists = series.episodes[seasonKey].some(e => e.episode === epInfo.episode);
            if (!exists) {
                series.episodes[seasonKey].push({
                    episode: epInfo.episode,
                    name: item.name,
                    url: item.url,
                    id: item.id,
                    logo: item.logo
                });
            }

            idsToRemove.add(item.id);
        } else {
            // Não é episódio - mantém como está
            itemsToKeep.push(item);
        }
    }

    // Cria objetos de série formatados
    const newSeries = [];
    for (const [seriesKey, data] of seriesMap) {
        // Ordena episódios dentro de cada temporada
        for (const seasonKey of Object.keys(data.episodes)) {
            data.episodes[seasonKey].sort((a, b) => a.episode - b.episode);
        }

        // Calcula totais
        const totalSeasons = Object.keys(data.episodes).length;
        const totalEpisodes = Object.values(data.episodes)
            .reduce((sum, eps) => sum + eps.length, 0);

        newSeries.push({
            id: `series-${seriesKey}-${Date.now()}`,
            name: data.baseName,
            category: data.category,
            type: 'series',
            isAdult: data.isAdult,
            logo: data.logo,
            episodes: data.episodes,
            totalSeasons,
            totalEpisodes,
            tmdb: null
        });
    }

    if (newSeries.length === 0) {
        return { fixed: 0, removed: 0 };
    }

    // Combina itens mantidos com novas séries
    const finalContent = [...itemsToKeep, ...newSeries];

    // Salva
    fs.writeFileSync(filePath, JSON.stringify(finalContent, null, 2));

    return {
        fixed: newSeries.length,
        removed: idsToRemove.size
    };
}

async function main() {
    console.log('🔧 FIX SERIES FORMAT - Corrigindo séries mal formatadas\n');

    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error('❌ Diretório não encontrado:', ENRICHED_DIR);
        return;
    }

    const files = fs.readdirSync(ENRICHED_DIR)
        .filter(f => f.endsWith('.json') && !IGNORE_FILES.includes(f));

    let totalFixed = 0;
    let totalRemoved = 0;

    for (const file of files) {
        const filePath = path.join(ENRICHED_DIR, file);
        const result = processFile(filePath);

        if (result.fixed > 0) {
            console.log(`📂 ${file}: ${result.fixed} séries criadas, ${result.removed} episódios individuais removidos`);
            totalFixed += result.fixed;
            totalRemoved += result.removed;
        }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📊 RESULTADO FINAL');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Séries criadas: ${totalFixed}`);
    console.log(`🗑️ Episódios individuais removidos: ${totalRemoved}`);
    console.log('═══════════════════════════════════════\n');
}

main();
