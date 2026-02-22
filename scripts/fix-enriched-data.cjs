/**
 * fix-enriched-data.cjs
 *
 * Dois objetivos:
 * 1. PURGE: Remove itens/episódios com URLs que NÃO terminam em .mp4/.mkv/.avi/.m4v
 * 2. RE-ENRICH: Busca dados TMDB para itens com tmdb=null (SOMENTE títulos sem dados)
 *    - Remove sufixos como (Leg), (Dub), (Dual), [L], etc. antes de buscar
 *    - Usa o ANO quando disponível para distinguir títulos idênticos de anos diferentes
 *    - Estratégia de busca multi-etapa para maximizar a taxa de acerto
 *    - Ignora completamente categorias adultas/xxx
 *    - Processa em paralelo por vez (BATCH_SIZE itens)
 *
 * USO:
 *   node scripts/fix-enriched-data.cjs --purge-only
 *   node scripts/fix-enriched-data.cjs --enrich-only
 *   node scripts/fix-enriched-data.cjs
 *   node scripts/fix-enriched-data.cjs --category=legendados
 *   node scripts/fix-enriched-data.cjs --limit=500
 *   node scripts/fix-enriched-data.cjs --dry-run   (mostra o que faria, sem salvar)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENRICHED_DIR = path.join(__dirname, '../public/data/enriched');
const MANIFEST_FILE = path.join(ENRICHED_DIR, '_manifest.json');
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const ITEMS_PER_PART = 50;
const BATCH_SIZE = 50;             // parallel requests per batch (reduced for stability)
const DELAY_BETWEEN_BATCHES = 2000; // ms between batches

// ============================================================
// FILTRO DE CATEGORIAS ADULTAS (amplo - garante não processar)
// ============================================================
function isAdultCategory(baseName) {
    const lower = baseName.toLowerCase();
    return lower.includes('adulto') ||
        lower.includes('adultos') ||
        lower.includes('xxx') ||
        lower.includes('hot-adulto') ||
        lower.includes('bella-da-semana') ||
        lower.includes('erotic') ||
        lower.includes('porn');
}

// ============================================================
// HELPERS
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readManifest() {
    return fs.existsSync(MANIFEST_FILE) ? JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8')) : {};
}

function writeManifest(manifest) {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

function readCategoryParts(baseName, manifest) {
    const entry = manifest[baseName];
    if (!entry) return [];
    const allItems = [];
    for (let i = 1; i <= entry.totalParts; i++) {
        const partPath = path.join(ENRICHED_DIR, `${baseName}-p${i}.json`);
        if (fs.existsSync(partPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(partPath, 'utf-8'));
                if (Array.isArray(data)) allItems.push(...data);
            } catch (e) {
                console.error(`Erro ao ler ${baseName}-p${i}.json:`, e.message);
            }
        }
    }
    return allItems;
}

function writeCategoryParts(baseName, items, manifest) {
    const oldEntry = manifest[baseName];
    if (oldEntry) {
        for (let i = 1; i <= oldEntry.totalParts; i++) {
            const oldPath = path.join(ENRICHED_DIR, `${baseName}-p${i}.json`);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
    }
    const totalParts = Math.max(1, Math.ceil(items.length / ITEMS_PER_PART));
    for (let i = 0; i < totalParts; i++) {
        const chunk = items.slice(i * ITEMS_PER_PART, Math.min((i + 1) * ITEMS_PER_PART, items.length));
        fs.writeFileSync(path.join(ENRICHED_DIR, `${baseName}-p${i + 1}.json`), JSON.stringify(chunk));
    }
    manifest[baseName] = { totalParts, totalItems: items.length };
}

function isValidMediaUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.avi') || lower.endsWith('.m4v');
}

// ============================================================
// STEP 1: PURGE non-media URLs
// ============================================================

function purgeNonMp4(items) {
    let removedMovies = 0;
    let removedEpisodes = 0;
    const filtered = [];

    for (const item of items) {
        if (item.type === 'movie') {
            if (!isValidMediaUrl(item.url)) {
                removedMovies++;
                continue;
            }
        } else if (item.type === 'series') {
            const cleanEpisodes = {};
            for (const [seasonKey, eps] of Object.entries(item.episodes || {})) {
                const validEps = (eps || []).filter(ep => {
                    if (!isValidMediaUrl(ep.url)) { removedEpisodes++; return false; }
                    return true;
                });
                if (validEps.length > 0) cleanEpisodes[seasonKey] = validEps;
            }
            item.episodes = cleanEpisodes;
            if (Object.keys(cleanEpisodes).length === 0) { removedMovies++; continue; }
            const allEps = Object.values(cleanEpisodes).flat();
            item.totalEpisodes = allEps.length;
            item.totalSeasons = Object.keys(cleanEpisodes).length;
        }
        filtered.push(item);
    }

    return { filtered, removedMovies, removedEpisodes };
}

// ============================================================
// STEP 2: TMDB Re-enrichment (melhorado)
// ============================================================

function buildImageUrl(imgPath, size = 'w500') {
    if (!imgPath) return null;
    return `${TMDB_IMAGE_BASE}/${size}${imgPath}`;
}

/**
 * Extrai título e ano do nome bruto do item.
 * Remove sufixos de idioma/qualidade, retorna { title, year }.
 */
function extractTitleAndYear(name) {
    let title = name;

    // Remove prefixos de categorias que ficam no nome: "Series | TV ", "Series | "
    title = title.replace(/^Series\s*\|\s*TV\s*/i, '');
    title = title.replace(/^Series\s*\|\s*/i, '');
    title = title.replace(/^Filmes\s*\|\s*/i, '');

    // Remove language/quality suffixes: (Leg), (Dub), (Dual), etc.
    title = title.replace(/\s*\((Leg|Dub|Dual|Dua|LEG|DUB|DUAL|leg|dub)\)/gi, '');
    // Remove bracketed tags: [L], [Leg], [Dub], [Dual], [HD], [4K], etc.
    title = title.replace(/\s*\[(?:L|Leg|Dub|Dual|HD|4K|4k|CAM|CINEMA|UHD|BluRay|BDRip|WEB|WEBRip)\]/gi, '');
    // Remove quality tags in parens: (4k), (4K), (UHD), (HD), etc.
    title = title.replace(/\s*\((?:4[kK]|UHD|HD|CAM|CINEMA|BluRay|BDRip|WEB|WEBRip|SDR|HDR)\)/gi, '');
    // Remove bare quality tags at end of string (sem parênteses): "Inception 4K", "Matrix UHD"
    title = title.replace(/\s+(?:4[kK]|UHD|SDR|HDR|CAM|WEB|WEBRip|BluRay|BDRip|CINEMA)\s*$/gi, '');
    // Remove trailing: "- Dublado", "- Legendado", "- Dual Áudio"
    title = title.replace(/\s*-\s*(Dublado|Legendado|Dual Áudio)\s*$/i, '');
    // Remove DUB / LEG / DUAL at end of string
    title = title.replace(/\s+(DUB|LEG|DUAL)\s*$/i, '');
    // Remove series episode markers
    title = title.replace(/\s+S\d+\s*E\d+.*$/i, '');
    // Remove sufixo de parte numerada: "Parte 1", "Parte 2", "Part 1" no final
    title = title.replace(/\s+Parte\s+\d+\s*$/i, '');
    title = title.replace(/\s+Part\s+\d+\s*$/i, '');
    // Remove sufixo " aka Outro Nome" (alternativo)
    title = title.replace(/\s+aka\s+.+$/i, '');

    // Extrai o ANO da string (antes de remover os parênteses)
    const yearMatch = title.match(/\((\d{4})\)/) || title.match(/\((\d{4})\s/) || title.match(/[-–]\s*(\d{4})\s*(?:\(|$)/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

    // Remove o ano e outros ruídos restantes
    title = title
        .replace(/\s*\(\d{4}\)\s*/g, '')       // remove year in parens
        .replace(/\s*[-–]\s*\d{4}\s*$/g, '')   // remove trailing "- YYYY"
        .replace(/\s*\[.*?\]/g, '')             // remove any remaining brackets
        .replace(/\s*\([^)]*\)\s*$/g, '')       // remove any remaining parens at end
        .replace(/[_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return { title, year };
}

function normalizeForComparison(str) {
    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Remove artigos iniciais comuns (pt-BR, en, es) para tentar variações de busca.
 * Ex: "A Origem" → "Origem", "The Dark Knight" → "Dark Knight"
 */
function removeLeadingArticle(title) {
    return title.replace(/^(o\s+|a\s+|os\s+|as\s+|the\s+|el\s+|la\s+|los\s+|las\s+|um\s+|uma\s+)/i, '').trim();
}

/**
 * Gera variações do título para aumentar as chances de match na API.
 */
function getTitleVariants(title) {
    const variants = new Set();
    variants.add(title);

    // Sem artigo inicial
    const noArticle = removeLeadingArticle(title);
    if (noArticle !== title) variants.add(noArticle);

    // Sem ":" e tudo depois (sequelas com subtítulo)
    const noColon = title.replace(/\s*:.*$/, '').trim();
    if (noColon !== title && noColon.length > 2) variants.add(noColon);

    // Texto antes do " - "
    const noDash = title.replace(/\s+-\s+.*$/, '').trim();
    if (noDash !== title && noDash.length > 2) variants.add(noDash);

    // Troca "ç" → "c", "ã" → "a" etc para busca mais simples
    const ascii = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    if (ascii !== title) variants.add(ascii);

    return [...variants];
}

/**
 * Pontua o quão bom é um resultado TMDB para o título e ano buscados.
 */
function scoreMatch(result, searchTitle, targetYear) {
    const norm = normalizeForComparison(searchTitle);
    const titleNorm = normalizeForComparison(result.title || result.name || '');
    const origNorm = normalizeForComparison(result.original_title || result.original_name || '');

    let score = 0;

    // Correspondência de título (mais rigorosa)
    if (titleNorm === norm || origNorm === norm) {
        score += 100;
    } else if (titleNorm.startsWith(norm) || origNorm.startsWith(norm)) {
        score += 60;
    } else if (norm.startsWith(titleNorm) || norm.startsWith(origNorm)) {
        score += 40;
    } else if (titleNorm.includes(norm) || origNorm.includes(norm)) {
        score += 25;
    } else if (norm.includes(titleNorm) || norm.includes(origNorm)) {
        score += 15;
    }

    // Correspondência de ano — CRÍTICA para evitar o filme errado
    const resultDateStr = result.release_date || result.first_air_date || '';
    const resultYear = resultDateStr ? parseInt(resultDateStr.substring(0, 4)) : null;

    if (targetYear && resultYear) {
        if (resultYear === targetYear) {
            score += 120; // Bônus forte por ano exato
        } else if (Math.abs(resultYear - targetYear) === 1) {
            score += 15;  // Lançamentos que cruzaram o ano
        } else if (Math.abs(resultYear - targetYear) <= 2) {
            score += 5;
        } else {
            score -= 60;  // Penalidade forte para anos muito diferentes
        }
    }

    // Popularidade / voto como desempate
    const votes = result.vote_count || 0;
    if (votes > 5000) score += 10;
    else if (votes > 1000) score += 6;
    else if (votes > 100) score += 3;

    return score;
}

/**
 * Escolhe o melhor resultado de uma lista TMDB.
 * Retorna null se nenhum resultado tiver score > 0 (sem título matching).
 */
function findBestMatch(results, searchTitle, targetYear) {
    if (!results || results.length === 0) return null;

    let best = null;
    let bestScore = -Infinity;

    for (const r of results) {
        const s = scoreMatch(r, searchTitle, targetYear);
        if (s > bestScore) {
            best = r;
            bestScore = s;
        }
    }

    // Só retorna se tiver alguma correspondência de título
    return bestScore >= 15 ? best : null;
}

/**
 * Faz uma única requisição TMDB e retorna o melhor match (ou null).
 */
async function fetchTMDBSearch(endpoint, query, year, language) {
    try {
        let url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=${language}&query=${encodeURIComponent(query)}`;
        if (year) url += `&primary_release_year=${year}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        return data.results || [];
    } catch (e) {
        return null;
    }
}

/**
 * Estratégia de busca multi-etapa para maximizar a taxa de acerto.
 *
 * Ordem de tentativas:
 * 1. Título limpo + ano + pt-BR (endpoint correto)
 * 2. Título limpo + ano + en-US (endpoint correto)
 * 3. Título limpo SEM ano + pt-BR (para casos sem ano no nome)
 * 4. Título limpo SEM ano + en-US
 * 5. Sem artigo inicial + sem ano + pt-BR
 * 6. Sem artigo inicial + sem ano + en-US
 * 7. Todas as variant sem ano + en-US (endpoint alternativo movie↔tv)
 *
 * Para cada etapa, testa tipo original E tipo alternativo.
 */
async function searchTMDB(cleanedTitle, year, type) {
    if (!cleanedTitle || cleanedTitle.length < 2) return null;

    const endpoints = {
        primary: type === 'series' ? 'search/tv' : 'search/movie',
        fallback: type === 'series' ? 'search/movie' : 'search/tv',
        altType: type === 'series' ? 'movie' : 'series',
    };

    const titleVariants = getTitleVariants(cleanedTitle);
    const languages = ['pt-BR', 'en-US'];

    // ---- Etapa 1: Título original + ano (mais preciso)
    if (year) {
        for (const lang of languages) {
            const results = await fetchTMDBSearch(endpoints.primary, cleanedTitle, year, lang);
            if (results && results.length > 0) {
                const match = findBestMatch(results, cleanedTitle, year);
                if (match) return { match, foundType: type };
            }
        }
    }

    // ---- Etapa 2: Título original sem ano (pode achar mesmo assim)
    for (const lang of languages) {
        const results = await fetchTMDBSearch(endpoints.primary, cleanedTitle, null, lang);
        if (results && results.length > 0) {
            const match = findBestMatch(results, cleanedTitle, year);
            if (match) return { match, foundType: type };
        }
    }

    // ---- Etapa 3: Variações do título (sem artigo, sem subtítulo, ASCII)
    for (const variant of titleVariants) {
        if (variant === cleanedTitle) continue; // já tentamos
        for (const lang of languages) {
            const results = await fetchTMDBSearch(endpoints.primary, variant, year || null, lang);
            if (results && results.length > 0) {
                const match = findBestMatch(results, cleanedTitle, year);
                if (match) return { match, foundType: type };
            }
        }
    }

    // ---- Etapa 4: Tipo alternativo (movie ↔ tv) com título original
    for (const lang of languages) {
        const results = await fetchTMDBSearch(endpoints.fallback, cleanedTitle, year || null, lang);
        if (results && results.length > 0) {
            const match = findBestMatch(results, cleanedTitle, year);
            if (match) return { match, foundType: endpoints.altType };
        }
    }

    // ---- Etapa 5: Variações + tipo alternativo
    for (const variant of titleVariants) {
        if (variant === cleanedTitle) continue;
        const results = await fetchTMDBSearch(endpoints.fallback, variant, year || null, 'en-US');
        if (results && results.length > 0) {
            const match = findBestMatch(results, cleanedTitle, year);
            if (match) return { match, foundType: endpoints.altType };
        }
    }

    return null;
}

async function fetchTMDBDetails(tmdbId, type) {
    const endpoint = type === 'series' ? 'tv' : 'movie';
    const appendList = [
        'credits', 'keywords', 'recommendations',
        type === 'series' ? 'content_ratings' : 'release_dates',
        'external_ids', 'watch/providers', 'images'
    ].join(',');
    try {
        const url = `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=${appendList}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

function buildTmdbObject(details, type) {
    const isTV = type === 'series';

    let certification = null;
    if (isTV && details.content_ratings?.results) {
        const br = details.content_ratings.results.find(r => r.iso_3166_1 === 'BR');
        const us = details.content_ratings.results.find(r => r.iso_3166_1 === 'US');
        certification = br?.rating || us?.rating || null;
    } else if (details.release_dates?.results) {
        const br = details.release_dates.results.find(r => r.iso_3166_1 === 'BR');
        const us = details.release_dates.results.find(r => r.iso_3166_1 === 'US');
        certification = br?.release_dates?.find(rd => rd.certification)?.certification
            || us?.release_dates?.find(rd => rd.certification)?.certification || null;
    }

    const brProviders = details['watch/providers']?.results?.BR;
    const streaming = [...(brProviders?.flatrate || []), ...(brProviders?.free || [])]
        .map(p => p.provider_name).filter(Boolean);

    const logoPath = details.images?.logos?.[0]?.file_path || null;

    const cast = (details.credits?.cast || []).slice(0, 15).map(p => ({
        id: p.id, name: p.name, character: p.character,
        photo: p.profile_path ? buildImageUrl(p.profile_path, 'w185') : null
    }));
    const directors = (details.credits?.crew || []).filter(p => p.job === 'Director').map(p => p.name);
    const writers = (details.credits?.crew || [])
        .filter(p => ['Writer', 'Screenplay', 'Story'].includes(p.job))
        .map(p => p.name);
    const keywords = (details.keywords?.keywords || details.keywords?.results || [])
        .slice(0, 10).map(k => k.name);
    const companies = (details.production_companies || []).map(c => c.name);
    const countries = (details.production_countries || []).map(c => c.iso_3166_1);
    const recommendations = (details.recommendations?.results || []).slice(0, 10).map(r => ({
        id: r.id,
        title: r.title || r.name,
        poster: r.poster_path ? buildImageUrl(r.poster_path, 'w185') : null,
        rating: Math.round((r.vote_average || 0) * 10) / 10
    }));

    return {
        id: details.id,
        imdbId: details.external_ids?.imdb_id || null,
        title: details.title || details.name,
        originalTitle: details.original_title || details.original_name,
        tagline: details.tagline || null,
        overview: details.overview || 'Sinopse não disponível.',
        status: details.status,
        language: details.original_language,
        ...(isTV ? {
            firstAirDate: details.first_air_date,
            lastAirDate: details.last_air_date,
            episodeRuntime: details.episode_run_time?.[0] || null
        } : {
            releaseDate: details.release_date
        }),
        year: (details.release_date || details.first_air_date || '').substring(0, 4) || null,
        runtime: details.runtime || null,
        rating: Math.round((details.vote_average || 0) * 10) / 10,
        voteCount: details.vote_count || 0,
        popularity: Math.round(details.popularity || 0),
        certification,
        genres: (details.genres || []).map(g => g.name),
        poster: details.poster_path ? buildImageUrl(details.poster_path, 'w500') : null,
        posterHD: details.poster_path ? buildImageUrl(details.poster_path, 'original') : null,
        backdrop: details.backdrop_path ? buildImageUrl(details.backdrop_path, 'w1280') : null,
        backdropHD: details.backdrop_path ? buildImageUrl(details.backdrop_path, 'original') : null,
        logo: logoPath ? buildImageUrl(logoPath, 'w500') : null,
        cast,
        directors,
        writers,
        keywords,
        companies,
        countries,
        budget: details.budget || null,
        revenue: details.revenue || null,
        collection: details.belongs_to_collection ? {
            id: details.belongs_to_collection.id,
            name: details.belongs_to_collection.name,
            poster: details.belongs_to_collection.poster_path
                ? buildImageUrl(details.belongs_to_collection.poster_path, 'w185')
                : null
        } : null,
        recommendations,
        streaming,
        imdb: details.external_ids?.imdb_id || null
    };
}

/**
 * Enriquece um único item. Retorna { success, foundTitle }.
 */
async function enrichItem(item) {
    const { title, year } = extractTitleAndYear(item.name);
    if (!title || title.length < 2) return { success: false, reason: 'titulo_curto' };

    const searchResult = await searchTMDB(title, year, item.type);
    if (!searchResult) return { success: false, reason: 'nao_encontrado' };

    const { match, foundType } = searchResult;
    const details = await fetchTMDBDetails(match.id, foundType);
    if (!details) return { success: false, reason: 'detalhes_falhou' };

    item.tmdb = buildTmdbObject(details, foundType);
    return { success: true, foundTitle: item.tmdb.title };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    const args = process.argv.slice(2);
    const doPurge = !args.includes('--enrich-only');
    const doEnrich = !args.includes('--purge-only');
    const isDryRun = args.includes('--dry-run');
    const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1] || null;
    const limitArg = args.find(a => a.startsWith('--limit='));
    const enrichLimit = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

    if (isDryRun) console.log('🔍 MODO DRY-RUN: nenhum arquivo será modificado.\n');

    const manifest = readManifest();
    const categories = categoryFilter ? [categoryFilter] : Object.keys(manifest);

    // Filtrar categorias adultas
    const nonAdultCategories = categories.filter(c => !isAdultCategory(c));
    const skippedAdult = categories.length - nonAdultCategories.length;
    if (skippedAdult > 0) {
        console.log(`⏭️  ${skippedAdult} categorias adultas/xxx ignoradas.`);
    }

    let totalPurgedMovies = 0;
    let totalPurgedEpisodes = 0;
    let totalEnriched = 0;
    let totalFailed = 0;
    let enrichCount = 0;
    const failedItems = [];

    for (const baseName of nonAdultCategories) {
        if (!manifest[baseName]) {
            console.log(`⚠️  Categoria "${baseName}" não encontrada no manifesto.`);
            continue;
        }

        const totalItems = manifest[baseName].totalItems;
        console.log(`\n📁 Categoria: ${baseName} (${totalItems} itens)`);
        let items = readCategoryParts(baseName, manifest);
        let changed = false;

        // ---- STEP 1: PURGE
        if (doPurge) {
            const { filtered, removedMovies, removedEpisodes } = purgeNonMp4(items);
            if (removedMovies > 0 || removedEpisodes > 0) {
                console.log(`  🗑️  Removidos: ${removedMovies} itens sem URL válida, ${removedEpisodes} episódios`);
                totalPurgedMovies += removedMovies;
                totalPurgedEpisodes += removedEpisodes;
                items = filtered;
                changed = true;
            }
        }

        // ---- STEP 2: RE-ENRICH (só itens sem tmdb)
        if (doEnrich && enrichCount < enrichLimit) {
            const missing = items.filter(i => !i.tmdb || !i.tmdb.id);

            if (missing.length > 0) {
                const toProcess = missing.slice(0, enrichLimit - enrichCount);
                console.log(`  🔍 ${toProcess.length} itens sem TMDB → processando em lotes de ${BATCH_SIZE}...`);

                let batchEnriched = 0;
                let batchFailed = 0;

                for (let batchStart = 0; batchStart < toProcess.length; batchStart += BATCH_SIZE) {
                    const batch = toProcess.slice(batchStart, batchStart + BATCH_SIZE);
                    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
                    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);
                    process.stdout.write(`    🔄 Lote ${batchNum}/${totalBatches} (${batch.length} itens)... `);

                    const results = await Promise.allSettled(batch.map(item => enrichItem(item)));

                    let ok = 0, fail = 0;
                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];
                        if (result.status === 'fulfilled' && result.value.success) {
                            ok++;
                            batchEnriched++;
                            changed = true;
                        } else {
                            fail++;
                            batchFailed++;
                            const reason = result.status === 'fulfilled' ? result.value.reason : 'erro';
                            failedItems.push({ name: batch[i].name, category: baseName, reason });
                        }
                    }
                    console.log(`✅ ${ok} encontrados, ❌ ${fail} não encontrados`);
                    enrichCount += batch.length;

                    if (batchStart + BATCH_SIZE < toProcess.length) {
                        await sleep(DELAY_BETWEEN_BATCHES);
                    }
                }

                totalEnriched += batchEnriched;
                totalFailed += batchFailed;
                console.log(`  📊 ${batchEnriched}/${toProcess.length} enriquecidos nesta categoria`);
            } else {
                console.log(`  ✅ Todos os itens já têm dados TMDB.`);
            }
        }

        if (changed && !isDryRun) {
            writeCategoryParts(baseName, items, manifest);
            console.log(`  💾 Salvo: ${items.length} itens`);
        }
    }

    if (!isDryRun) writeManifest(manifest);

    // Salvar relatório de falhas
    if (failedItems.length > 0) {
        const reportPath = path.join(__dirname, '../missing_tmdb_report.txt');
        const lines = failedItems.map(f => `[${f.category}] ${f.name} (razão: ${f.reason})`);
        if (!isDryRun) {
            fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
            console.log(`\n📄 Relatório de falhas salvo em: missing_tmdb_report.txt`);
        } else {
            console.log('\n📄 Falhas que seriam salvas (dry-run):');
            lines.slice(0, 20).forEach(l => console.log('  ', l));
            if (lines.length > 20) console.log(`  ... e mais ${lines.length - 20} itens`);
        }
    }

    console.log('\n════════════════════════════════════');
    console.log('✅ CONCLUÍDO');
    if (doPurge) {
        console.log(`  🗑️  Removidos (URL inválida): ${totalPurgedMovies} itens, ${totalPurgedEpisodes} episódios`);
    }
    if (doEnrich) {
        console.log(`  ✨ Enriquecidos com TMDB: ${totalEnriched}`);
        console.log(`  ❌ Não encontrados: ${totalFailed}`);
        if (totalEnriched + totalFailed > 0) {
            const rate = Math.round(totalEnriched / (totalEnriched + totalFailed) * 100);
            console.log(`  📈 Taxa de acerto: ${rate}%`);
        }
    }
    console.log('════════════════════════════════════');
}

main().catch(console.error);
