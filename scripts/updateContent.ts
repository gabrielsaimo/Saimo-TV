import * as fs from 'fs';
import * as path from 'path';
import { findMatch, getCleanName } from '../src/utils/m3uMatcher';
import { normalizeName } from '../src/services/m3uService';

const M3U_URL = 'https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/CanaisBR06.m3u';
const ENRICHED_DIR = path.join(process.cwd(), 'public/data/enriched');

// Mapeamento de grupos M3U para arquivos JSON existentes (simplificado)
const CATEGORY_FILE_MAP: Record<string, string> = {
    'acao': 'acao.json',
    'comedia': 'comedia.json',
    'drama': 'drama.json',
    'terror': 'terror.json',
    'ficcao': 'ficcao-cientifica.json',
    'animacao': 'animacao.json',
    'infantil': 'animacao.json',
    'romance': 'romance.json',
    'suspense': 'suspense.json',
    'lancamentos': 'lancamentos.json',
    'netflix': 'netflix.json',
    'amazon': 'prime-video.json',
    'disney': 'disney.json',
    'hbo': 'max.json',
    'globo': 'globoplay.json',
    'apple': 'apple-tv.json',
    'paramount': 'paramount.json',
    'star': 'star.json',
    'discovery': 'discovery.json',
    'legendado': 'legendados.json', // Para capturar 'Series | Legendados'
    'adultos': 'hot-adultos.json',
    'adultos | bella da semana': 'hot-adultos-bella-da-semana.json',
    'adultos | legendado': 'hot-adultos-legendado.json',
    // Adicione mais conforme necessário
};

interface M3UItem {
    name: string;
    group: string;
    logo?: string;
    url: string;
}

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
            const nameMatch = trimmed.match(/,(.+)$/); // Nome após a vírgula

            // Tenta pegar o nome do tvg-name, senão do final da linha
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

    // Tenta match direto
    for (const key in CATEGORY_FILE_MAP) {
        if (lower.includes(key)) return CATEGORY_FILE_MAP[key];
    }

    // Heurísticas extras
    if (lower.includes('filmes')) {
        // Se for genérico, deixa null ou joga num geral? Por enquanto null pra não poluir errado
        return null;
    }
    return null;
}

async function main() {
    console.log('🎬 Iniciando atualização de conteúdo...');

    // 1. Carregar M3U
    const m3uItems = await fetchM3UContent();
    console.log(`✅ ${m3uItems.length} itens encontrados no M3U.`);

    // Criar mapas para busca rápida
    const m3uMap = new Map<string, string>(); // NormName -> URL
    const m3uObjMap = new Map<string, M3UItem>(); // NormName -> FullItem

    m3uItems.forEach(item => {
        const norm = normalizeName(item.name);
        // Prioriza itens sem tag [L] / [LEG] se houver duplicata? 
        // Na verdade o m3uService já faz isso se usarmos a logica de 'findMatch' depois
        // Mas aqui vamos popular o mapa
        m3uMap.set(norm, item.url);
        m3uObjMap.set(norm, item);
    });

    // 2. Iterar arquivos Enriched JSON
    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error(`❌ Diretório não encontrado: ${ENRICHED_DIR}`);
        return;
    }
    // 2. Atualizar URLs Existentes & Construir Mapa de TMDB
    const files = fs.readdirSync(ENRICHED_DIR).filter(f => f.endsWith('.json'));
    let totalUpdated = 0;

    const usedM3UUrls = new Set<string>();
    const existingNames = new Set<string>();
    const existingTMDBMap = new Map<string, any>(); // Mapa NomeLimpo -> DadosTMDB

    console.log('📊 Construindo mapa de dados TMDB existentes (Passo 1)...');

    // PASSO 1: Scan para coletar dados TMDB de todos os arquivos
    for (const file of files) {
        const filePath = path.join(ENRICHED_DIR, file);
        try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (Array.isArray(content)) {
                content.forEach(movie => {
                    if (movie.tmdb && movie.tmdb.id) {
                        const cleanName = getCleanName(movie.name);
                        existingTMDBMap.set(cleanName, movie.tmdb);

                        const normName = normalizeName(movie.name);
                        if (normName !== cleanName) existingTMDBMap.set(normName, movie.tmdb);
                    }
                    existingNames.add(normalizeName(movie.name));
                });
            }
        } catch (e) {
            console.error(`Erro ao ler ${file} para mapa TMDB:`, e);
        }
    }
    console.log(`📚 Mapa TMDB construído com ${existingTMDBMap.size} entradas.`);

    // Pre-process M3U items into Series Map for Episode Appending (and Step 3)
    // We do this BEFORE Pass 2 so we can append episodes to existing series
    const newSeriesMap: Record<string, { name: string, group: string, episodes: any[], logo?: string }> = {};
    const newItemsByFile: Record<string, any[]> = {}; // Used in Step 3
    const missingTmdbList: string[] = [];  // Used in Step 3

    console.log('📦 Indexando episódios do M3U...');
    m3uItems.forEach(item => {
        // Series Logic
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

    // PASSO 2: Atualizar URLs e Enriquecer Itens sem TMDB (Passo 2)
    console.log('🔄 Atualizando URLs, enriquecendo e completando episódios (Passo 2)...');

    for (const file of files) {
        const filePath = path.join(ENRICHED_DIR, file);
        let content;
        try {
            content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) { continue; }

        let updatedCount = 0;
        let appendedEpisodesCount = 0;

        if (Array.isArray(content)) {
            for (const movie of content) {
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
                    usedM3UUrls.add(m3uUrl);
                    if (movie.url !== m3uUrl) {
                        movie.url = m3uUrl;
                        updatedCount++;
                    }
                }

                // Para séries, processar episódios E adicionar faltantes
                if (movie.type === 'series' && movie.episodes) {
                    // 1. Atualizar URLs Existentes
                    (Object.entries(movie.episodes) as [string, any[]][]).forEach(([seasonKey, episodes]) => {
                        episodes.forEach((ep: any) => {
                            const seasonNum = seasonKey.replace(/\D/g, '').padStart(2, '0');
                            const episodeNum = String(ep.episode).padStart(2, '0');
                            const searchName = `${movie.name} S${seasonNum} E${episodeNum}`;
                            const searchNameAlt = `${movie.name} S${seasonNum}E${episodeNum}`;

                            let epUrl = findMatch(searchName, undefined, m3uMap);
                            if (!epUrl) epUrl = findMatch(searchNameAlt, undefined, m3uMap);

                            if (epUrl) {
                                usedM3UUrls.add(epUrl);
                                if (ep.url !== epUrl) {
                                    ep.url = epUrl;
                                    updatedCount++;
                                }
                            }
                        });
                    });

                    // 2. Adicionar Episódios Faltantes do M3U
                    // Tenta achar a série no mapa pré-processado
                    // Prioriza nome exato (Ex: Stranger Things [L])
                    let m3uSeries = newSeriesMap[movie.name];
                    if (!m3uSeries) {
                        // Tenta normalized
                        // Iterar chaves do newSeriesMap pode ser lento, mas necessário se chave variar case/espaço
                        // Vamos tentar normalized direto
                        // (Nota: newSeriesMap chaves são raw extracted names)
                        // Poderiamos ter normalizado as chaves do map, mas ok.
                        // Vamos tentar apenas se clean/exact bater
                    }

                    // Estratégia melhor: Iterar apenas variantes prováveis
                    const variantsToTry = [movie.name, normalizeName(movie.name)];
                    if (movie.name.includes('[L]')) variantsToTry.push(getCleanName(movie.name) + ' [L]');

                    // Como newSeriesMap tem chaves RAW do M3U (ex: "Stranger Things"), e movie.name = "Stranger Things".
                    // Deve bater direto.
                    // Se movie.name="Stranger Things [LEG]" e M3U="Stranger Things [L]" -> mismatch.
                    // Precisamos da logica de variants aqui tambem?
                    // Pela complexidade, vamos confiar que Step 3 teria criado a nova serie se nao existisse.
                    // Aqui queremos apenas ENRIQUECER a ja existente.

                    if (m3uSeries) {
                        m3uSeries.episodes.forEach(m3uEp => {
                            const sKey = String(parseInt(m3uEp.season));
                            if (!movie.episodes[sKey]) movie.episodes[sKey] = [];

                            // Verifica se episódio já existe
                            const exists = movie.episodes[sKey].some((e: any) => parseInt(e.episode) === m3uEp.episode);

                            if (!exists) {
                                movie.episodes[sKey].push({
                                    episode: m3uEp.episode,
                                    name: m3uEp.name,
                                    url: m3uEp.url,
                                    id: `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    logo: m3uEp.logo
                                });
                                // console.log(`➕ Episódio adicionado em ${movie.name}: S${m3uEp.season}E${m3uEp.episode}`);
                                appendedEpisodesCount++;
                                updatedCount++;
                                // Marca como usado para não duplicar em Step 3?
                                // usedM3UUrls.add(m3uEp.url); // Sim, importante!
                                // But Step 3 uses "existingNames" check for Series name.
                                // If name da serie ja existe, Step 3 pula series inteira.
                                // Entao nao precisamos marcar URL individual aqui para Step 3.
                            }
                        });
                    }
                    // 3. Ordenar Episódios (Crescente)
                    Object.keys(movie.episodes).forEach(seasonKey => {
                        const episodes = movie.episodes[seasonKey];
                        if (episodes && episodes.length > 1) {
                            // Cria cópia para comparar
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

        if (updatedCount > 0) {
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
            console.log(`📝 ${file}: ${updatedCount} atualizações (URLs/TMDB/Episódios).`);
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
            // Step 2 already handled EXISTING series. 
            // Step 3 handles NEW series.
            // Check if series exists
            if (existingNames.has(normalizeName(seriesName))) return;

            // Collect for new series (logic already in pre-process map)
            // But checking 'existingNames' prevents creating duplicate series object.

            // Logic change: We iterate 'newSeriesMap' separately below. 
            // Here we just skip episodes. All series logic moved to loop below.
            return;
        }

        // Movie Logic
        const targetFile = mapGroupToFile(item.group);
        if (targetFile) {
            // ... existing movie add logic ...
            if (!newItemsByFile[targetFile]) newItemsByFile[targetFile] = [];
            const isAdultContent = targetFile.includes('adultos') || item.group.toLowerCase().includes('xxx');
            const tmdbData = existingTMDBMap.get(getCleanName(item.name));
            const newItem = {
                id: `m3u-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                name: item.name,
                url: item.url,
                category: isAdultContent ? '[HOT] Adultos ❌❤️' : item.group,
                type: 'movie',
                isAdult: isAdultContent,
                logo: item.logo,
                tmdb: tmdbData || null
            };
            if (!tmdbData) missingTmdbList.push(item.name);
            newItemsByFile[targetFile].push(newItem);
            newItemsCount++;
            existingNames.add(normalizeName(item.name));
        }
    });

    // Process New Series (from the Map we built earlier)
    for (const [seriesName, data] of Object.entries(newSeriesMap)) {
        // Here we ONLY process if series does NOT exist
        if (existingNames.has(normalizeName(seriesName))) continue;

        const targetFile = mapGroupToFile(data.group);
        if (targetFile) {
            // ... existing new series creation logic ...
            if (!newItemsByFile[targetFile]) newItemsByFile[targetFile] = [];
            // Agrupa episódios por temporada
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

            // Ordena episódios de cada temporada
            Object.keys(episodesBySeason).forEach(sKey => {
                episodesBySeason[sKey].sort((a, b) => parseInt(a.episode) - parseInt(b.episode));
            });
            const tmdbData = existingTMDBMap.get(getCleanName(seriesName));
            const newSeries = {
                id: `series-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                name: seriesName,
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
            newItemsByFile[targetFile].push(newSeries);
            newItemsCount++;
            existingNames.add(normalizeName(seriesName));
        }
    }

    // Salvar novos itens
    for (const [filename, items] of Object.entries(newItemsByFile)) {
        const filePath = path.join(ENRICHED_DIR, filename);
        if (fs.existsSync(filePath)) {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (Array.isArray(content)) {
                content.push(...items);
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
                console.log(`➕ ${filename}: ${items.length} novos itens adicionados.`);
            }
        }
    }

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
