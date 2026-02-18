import * as fs from 'fs';
import * as path from 'path';
import { findMatch, getCleanName } from '../src/utils/m3uMatcher';
import { normalizeName } from '../src/services/m3uService';

const M3U_URL = 'https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/CanaisBR04.m3u';
const ENRICHED_DIR = path.join(process.cwd(), 'public/data/enriched');
const MANIFEST_FILE = path.join(ENRICHED_DIR, '_manifest.json');
const ITEMS_PER_PART = 50;

// Mapeamento de grupos M3U para arquivos JSON existentes (completo)
const CATEGORY_FILE_MAP: Record<string, string> = {
    // Gêneros principais
    'acao': 'acao',
    'comedia': 'comedia',
    'drama': 'drama',
    'terror': 'terror',
    'ficcao': 'ficcao-cientifica',
    'animacao': 'animacao',
    'infantil': 'animacao',
    'desenho': 'desenhos',
    'anime': 'animes',
    'romance': 'romance',
    'suspense': 'suspense',
    'aventura': 'aventura',
    'fantasia': 'fantasia',
    'faroeste': 'faroeste',
    'western': 'western',
    'guerra': 'guerra',
    'documentario': 'documentario',
    'documentarios': 'documentario',
    'docu': 'docu',
    'biografia': 'biografia',
    'historia': 'historia',
    'crime': 'crime',
    'policial': 'crime',
    'misterio': 'misterio',
    'familia': 'familia',
    'musica': 'musicais',
    'show': 'shows',
    'dorama': 'doramas',
    'novela': 'novelas',
    'nacional': 'nacionais',
    'religioso': 'religiosos',
    'gospel': 'religiosos',
    'lancamentos': 'lancamentos',

    // Streaming Services - Principais
    'netflix': 'netflix',
    'amazon': 'prime-video',
    'prime': 'prime-video',
    'disney': 'disney',
    'hbo': 'max',
    'max': 'max',
    'globo': 'globoplay',
    'globoplay': 'globoplay',
    'apple': 'apple-tv',
    'paramount': 'paramount',
    'star': 'star',
    'discovery': 'discovery',

    // Streaming Services - Adicionais
    'amc': 'amc-plus',
    'crunchyroll': 'crunchyroll',
    'funimation': 'funimation-now',
    'claro': 'claro-video',
    'directv': 'directv',
    'lionsgate': 'lionsgate',
    'pluto': 'plutotv',
    'plutotv': 'plutotv',
    'univer': 'univer',
    'sbt': 'sbt',
    'brasil paralelo': 'brasil-paralelo',

    // Conteúdo Especial
    '4k': 'uhd-4k',
    'uhd': 'uhd-4k',
    'cinema': 'cinema',
    'oscar': 'oscar-2025',
    'stand-up': 'stand-up-comedy',
    'standup': 'stand-up-comedy',
    'esporte': 'esportes',
    'esportes': 'esportes',
    'sports': 'esportes',
    'programa': 'programas-de-tv',
    'tv show': 'programas-de-tv',
    'turca': 'novelas-turcas',
    'turkish': 'novelas-turcas',
    'curso': 'cursos',
    'cursos': 'cursos',
    'dublagem': 'dublagem-nao-oficial',
    'legendada': 'legendadas',
    'legendadas': 'legendadas',
    'legendado': 'legendados',
    'outros': 'outros',
    'outras': 'outras-produtoras',
    'especial': 'especial-infantil',

    // Adultos
    'adultos': 'hot-adultos',
    'adultos | bella da semana': 'hot-adultos-bella-da-semana',
    'adultos | legendado': 'hot-adultos-legendado',
    'xxx': 'hot-adultos',
};

interface M3UItem {
    name: string;
    group: string;
    logo?: string;
    url: string;
}

interface ManifestEntry {
    totalParts: number;
    totalItems: number;
}

type Manifest = Record<string, ManifestEntry>;

// =============== HELPERS PARA FORMATO DE PARTES ===============

/**
 * Lê o manifesto. Retorna {} se não existir.
 */
function readManifest(): Manifest {
    if (fs.existsSync(MANIFEST_FILE)) {
        return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    }
    return {};
}

/**
 * Salva o manifesto.
 */
function writeManifest(manifest: Manifest): void {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

/**
 * Lê todos os itens de uma categoria (todas as partes).
 */
function readCategoryParts(baseName: string, manifest: Manifest): any[] {
    const entry = manifest[baseName];
    if (!entry) return [];

    const allItems: any[] = [];
    for (let i = 1; i <= entry.totalParts; i++) {
        const partPath = path.join(ENRICHED_DIR, `${baseName}-p${i}.json`);
        if (fs.existsSync(partPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(partPath, 'utf-8'));
                if (Array.isArray(data)) {
                    allItems.push(...data);
                }
            } catch (e) {
                console.error(`Erro ao ler ${baseName}-p${i}.json:`, e);
            }
        }
    }
    return allItems;
}

/**
 * Escreve os itens de uma categoria em partes de ITEMS_PER_PART.
 * Atualiza o manifesto.
 */
function writeCategoryParts(baseName: string, items: any[], manifest: Manifest): void {
    // Remove partes antigas
    const oldEntry = manifest[baseName];
    if (oldEntry) {
        for (let i = 1; i <= oldEntry.totalParts; i++) {
            const oldPath = path.join(ENRICHED_DIR, `${baseName}-p${i}.json`);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
    }

    // Escreve novas partes
    const totalParts = Math.max(1, Math.ceil(items.length / ITEMS_PER_PART));
    for (let i = 0; i < totalParts; i++) {
        const start = i * ITEMS_PER_PART;
        const end = Math.min(start + ITEMS_PER_PART, items.length);
        const chunk = items.slice(start, end);
        const partPath = path.join(ENRICHED_DIR, `${baseName}-p${i + 1}.json`);
        fs.writeFileSync(partPath, JSON.stringify(chunk));
    }

    // Atualiza manifesto
    manifest[baseName] = {
        totalParts,
        totalItems: items.length
    };
}

// =============== M3U FUNCTIONS ===============

async function fetchM3UContent(): Promise<M3UItem[]> {
    console.log('🔄 Baixando M3U...');
    const response = await fetch(M3U_URL);
    if (!response.ok) throw new Error('Falha no download do M3U');
    const text = await response.text();
    const lines = text.split('\n');

    const items: M3UItem[] = [];
    let currentInfo: Partial<M3UItem> = {};

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#EXTINF:')) {
            const tvgNameMatch = trimmed.match(/tvg-name="([^"]+)"/);
            const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
            const groupMatch = trimmed.match(/group-title="([^"]+)"/);
            const nameMatch = trimmed.match(/,(.+)$/);

            const name = tvgNameMatch ? tvgNameMatch[1] : (nameMatch ? nameMatch[1] : '');

            currentInfo = {
                name: name.trim(),
                logo: logoMatch ? logoMatch[1] : undefined,
                group: groupMatch ? groupMatch[1] : 'Sem Categoria'
            };
        } else if (trimmed && !trimmed.startsWith('#')) {
            if (currentInfo.name) {
                items.push({
                    name: currentInfo.name,
                    logo: currentInfo.logo,
                    group: currentInfo.group || 'Outros',
                    url: trimmed
                });
                currentInfo = {};
            }
        }
    }
    return items;
}

function mapGroupToFile(group: string): string | null {
    const lower = group.toLowerCase();

    for (const key in CATEGORY_FILE_MAP) {
        if (lower.includes(key)) return CATEGORY_FILE_MAP[key];
    }

    if (lower.includes('filmes')) {
        return null;
    }
    return null;
}

// =============== MAIN ===============

async function main() {
    console.log('🎬 Iniciando atualização de conteúdo...');

    // 1. Carregar M3U
    const m3uItems = await fetchM3UContent();
    console.log(`✅ ${m3uItems.length} itens encontrados no M3U.`);

    // Carregar manifesto
    const manifest = readManifest();
    console.log(`📋 Manifesto carregado com ${Object.keys(manifest).length} categorias.`);

    // Criar mapas para busca rápida
    const m3uMap = new Map<string, string>();
    const m3uObjMap = new Map<string, M3UItem>();

    m3uItems.forEach(item => {
        const norm = normalizeName(item.name);
        m3uMap.set(norm, item.url);
        m3uObjMap.set(norm, item);
    });

    // 2. Iterar arquivos Enriched (partes)
    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error(`❌ Diretório não encontrado: ${ENRICHED_DIR}`);
        return;
    }

    let totalUpdated = 0;
    const usedM3UUrls = new Set<string>();
    const existingNames = new Set<string>();
    const existingTMDBMap = new Map<string, any>();

    // Pega todas as categorias do manifesto
    const categories = Object.keys(manifest);

    console.log('📊 Construindo mapa de dados TMDB existentes (Passo 1)...');

    // PASSO 1: Scan para coletar dados TMDB de todos os arquivos (partes)
    const allCategoryData: Record<string, any[]> = {};

    for (const baseName of categories) {
        const content = readCategoryParts(baseName, manifest);
        allCategoryData[baseName] = content;

        content.forEach((movie: any) => {
            if (movie.tmdb && movie.tmdb.id) {
                const cleanName = getCleanName(movie.name);
                existingTMDBMap.set(cleanName, movie.tmdb);

                const normName = normalizeName(movie.name);
                if (normName !== cleanName) existingTMDBMap.set(normName, movie.tmdb);
            }
            existingNames.add(normalizeName(movie.name));
        });
    }
    console.log(`📚 Mapa TMDB construído com ${existingTMDBMap.size} entradas.`);

    // Pre-process M3U items into Series Map
    const newSeriesMap: Record<string, { name: string, group: string, episodes: any[], logo?: string }> = {};
    const newItemsByCategory: Record<string, any[]> = {};
    const missingTmdbList: string[] = [];

    console.log('📦 Indexando episódios do M3U...');
    m3uItems.forEach(item => {
        const epMatch = item.name.match(/(.+) S(\d+) ?E(\d+)/i) || item.name.match(/(.+) S(\d+)E(\d+)/i);
        if (epMatch) {
            const seriesName = epMatch[1].trim();
            const season = epMatch[2];
            const episode = epMatch[3];

            if (!newSeriesMap[seriesName]) {
                newSeriesMap[seriesName] = {
                    name: seriesName,
                    group: item.group,
                    logo: item.logo,
                    episodes: []
                };
            }
            newSeriesMap[seriesName].episodes.push({
                season: season,
                episode: parseInt(episode),
                name: item.name,
                url: item.url,
                logo: item.logo
            });
        }
    });

    // PASSO 2: Atualizar URLs e Enriquecer Itens
    console.log('🔄 Atualizando URLs, enriquecendo e completando episódios (Passo 2)...');

    for (const baseName of categories) {
        const content = allCategoryData[baseName];
        let updatedCount = 0;
        let appendedEpisodesCount = 0;

        if (Array.isArray(content)) {
            for (const movie of content) {
                // Reset active: será true só se encontrar URL no M3U atual
                movie.active = false;

                // Se item não tem TMDB, tenta copiar de outro existente
                if (!movie.tmdb || !movie.tmdb.id) {
                    const cleanName = getCleanName(movie.name);
                    const foundTmdb = existingTMDBMap.get(cleanName);
                    if (foundTmdb) {
                        movie.tmdb = foundTmdb;
                        updatedCount++;
                    }
                }

                // Tenta match URL
                const m3uUrl = findMatch(movie.name, movie.tmdb?.originalTitle, m3uMap);

                if (m3uUrl) {
                    movie.active = true;
                    usedM3UUrls.add(m3uUrl);
                    if (movie.url !== m3uUrl) {
                        movie.url = m3uUrl;
                        updatedCount++;
                    }
                }

                // Para séries, processar episódios
                if (movie.type === 'series' && movie.episodes) {
                    let seriesHasM3uUrl = false;

                    (Object.entries(movie.episodes) as [string, any[]][]).forEach(([seasonKey, episodes]) => {
                        episodes.forEach((ep: any) => {
                            const seasonNum = seasonKey.replace(/\D/g, '').padStart(2, '0');
                            const episodeNum = String(ep.episode).padStart(2, '0');
                            const searchName = `${movie.name} S${seasonNum} E${episodeNum}`;
                            const searchNameAlt = `${movie.name} S${seasonNum}E${episodeNum}`;

                            let epUrl = findMatch(searchName, undefined, m3uMap);
                            if (!epUrl) epUrl = findMatch(searchNameAlt, undefined, m3uMap);

                            if (epUrl) {
                                seriesHasM3uUrl = true;
                                usedM3UUrls.add(epUrl);
                                if (ep.url !== epUrl) {
                                    ep.url = epUrl;
                                    updatedCount++;
                                }
                            }
                        });
                    });

                    if (seriesHasM3uUrl) movie.active = true;

                    // Adicionar Episódios Faltantes do M3U
                    let m3uSeries = newSeriesMap[movie.name];

                    if (m3uSeries) {
                        movie.active = true;
                        m3uSeries.episodes.forEach((m3uEp: any) => {
                            const sKey = String(parseInt(m3uEp.season));
                            if (!movie.episodes[sKey]) movie.episodes[sKey] = [];

                            const exists = movie.episodes[sKey].some((e: any) => parseInt(e.episode) === m3uEp.episode);

                            if (!exists) {
                                movie.episodes[sKey].push({
                                    episode: m3uEp.episode,
                                    name: m3uEp.name,
                                    url: m3uEp.url,
                                    id: `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    logo: m3uEp.logo
                                });
                                appendedEpisodesCount++;
                                updatedCount++;
                            }
                        });
                    }

                    // Ordenar Episódios
                    Object.keys(movie.episodes).forEach((seasonKey: string) => {
                        const episodes = movie.episodes[seasonKey];
                        if (episodes && episodes.length > 1) {
                            const originalOrder = JSON.stringify(episodes.map((e: any) => e.episode));
                            episodes.sort((a: any, b: any) => parseInt(a.episode) - parseInt(b.episode));
                            const newOrder = JSON.stringify(episodes.map((e: any) => e.episode));
                            if (originalOrder !== newOrder) {
                                updatedCount++;
                            }
                        }
                    });
                }
            }
        }

        // Sempre salva: active foi atualizado em todos os itens
        writeCategoryParts(baseName, content, manifest);
        if (updatedCount > 0) {
            console.log(`📝 ${baseName}: ${updatedCount} atualizações (URLs/TMDB/Episódios).`);
            if (appendedEpisodesCount > 0) console.log(`   ↳ ${appendedEpisodesCount} episódios novos adicionados.`);
            totalUpdated += updatedCount;
        }
    }

    console.log(`✨ Total de itens existentes atualizados/enriquecidos: ${totalUpdated}`);

    // 3. Adicionar Novos Itens (Catalog Expansion)
    console.log('📦 Buscando novos conteúdos (Séries Novas/Filmes)...');
    let newItemsCount = 0;

    m3uItems.forEach(item => {
        if (usedM3UUrls.has(item.url)) return;
        if (existingNames.has(normalizeName(item.name))) return;

        // Series Logic
        const epMatch = item.name.match(/(.+) S(\d+) ?E(\d+)/i) || item.name.match(/(.+) S(\d+)E(\d+)/i);
        if (epMatch) {
            const seriesName = epMatch[1].trim();
            if (existingNames.has(normalizeName(seriesName))) return;
            return;
        }

        // Movie Logic
        const targetBaseName = mapGroupToFile(item.group);
        if (targetBaseName) {
            if (!newItemsByCategory[targetBaseName]) newItemsByCategory[targetBaseName] = [];
            const isAdultContent = targetBaseName.includes('adultos') || item.group.toLowerCase().includes('xxx');
            const tmdbData = existingTMDBMap.get(getCleanName(item.name));
            const newItem = {
                id: `m3u-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                name: item.name,
                url: item.url,
                active: true,
                category: isAdultContent ? '[HOT] Adultos ❌❤️' : item.group,
                type: 'movie',
                isAdult: isAdultContent,
                logo: item.logo,
                tmdb: tmdbData || null
            };
            if (!tmdbData) missingTmdbList.push(item.name);
            newItemsByCategory[targetBaseName].push(newItem);
            newItemsCount++;
            existingNames.add(normalizeName(item.name));
        }
    });

    // Process New Series
    for (const [seriesName, data] of Object.entries(newSeriesMap)) {
        if (existingNames.has(normalizeName(seriesName))) continue;

        const targetBaseName = mapGroupToFile(data.group);
        if (targetBaseName) {
            if (!newItemsByCategory[targetBaseName]) newItemsByCategory[targetBaseName] = [];
            const episodesBySeason: Record<string, any[]> = {};
            data.episodes.forEach(ep => {
                const seasonKey = String(parseInt(ep.season));
                if (!episodesBySeason[seasonKey]) episodesBySeason[seasonKey] = [];
                episodesBySeason[seasonKey].push({
                    episode: ep.episode,
                    name: ep.name,
                    url: ep.url,
                    id: `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    logo: ep.logo
                });
            });

            Object.keys(episodesBySeason).forEach(sKey => {
                episodesBySeason[sKey].sort((a, b) => parseInt(a.episode) - parseInt(b.episode));
            });
            const tmdbData = existingTMDBMap.get(getCleanName(seriesName));
            const newSeries = {
                id: `series-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                name: seriesName,
                active: true,
                category: data.group,
                type: 'series',
                isAdult: false,
                logo: data.logo,
                episodes: episodesBySeason,
                totalSeasons: Object.keys(episodesBySeason).length,
                totalEpisodes: data.episodes.length,
                tmdb: tmdbData || null
            };
            if (!tmdbData) missingTmdbList.push(seriesName);
            newItemsByCategory[targetBaseName].push(newSeries);
            newItemsCount++;
            existingNames.add(normalizeName(seriesName));
        }
    }

    // Salvar novos itens (append às partes existentes)
    for (const [baseName, items] of Object.entries(newItemsByCategory)) {
        const existingItems = allCategoryData[baseName] || [];
        const mergedItems = [...existingItems, ...items];
        writeCategoryParts(baseName, mergedItems, manifest);
        console.log(`➕ ${baseName}: ${items.length} novos itens adicionados.`);
    }

    // Salva manifesto final
    writeManifest(manifest);

    console.log(`🚀 Total de novos itens adicionados ao catálogo: ${newItemsCount}`);

    // Log items without TMDB
    if (missingTmdbList.length > 0) {
        console.log(`⚠️ ${missingTmdbList.length} itens novos sem dados do TMDB (Exemplos: ${missingTmdbList.slice(0, 3).join(', ')}...)`);
        const missingFile = path.join(process.cwd(), 'missing_tmdb_report.txt');
        fs.writeFileSync(missingFile, missingTmdbList.join('\n'));
        console.log(`📄 Relatório de itens sem TMDB salvo em: ${missingFile}`);
    }
}

main();
