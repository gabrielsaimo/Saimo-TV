/**
 * fix-enriched-data.cjs
 *
 * Dois objetivos:
 * 1. PURGE: Remove itens/episódios com URLs que NÃO terminam em .mp4
 * 2. RE-ENRICH: Busca dados TMDB para itens com tmdb=null
 *    - Remove sufixos como (Leg), (Dub), (Dual), [L], etc. antes de buscar
 *    - Usa o ANO quando disponível para distinguir títulos idênticos de anos diferentes
 *    - Processa 200 itens em paralelo por vez
 *
 * USO:
 *   node scripts/fix-enriched-data.cjs --purge-only
 *   node scripts/fix-enriched-data.cjs --enrich-only
 *   node scripts/fix-enriched-data.cjs
 *   node scripts/fix-enriched-data.cjs --category=legendados
 *   node scripts/fix-enriched-data.cjs --limit=500
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
const BATCH_SIZE = 200;      // parallel requests per batch
const DELAY_BETWEEN_BATCHES = 1500; // ms between batches

// Categories excluded from TMDB enrichment (adult content not catalogued on TMDB)
const SKIP_ENRICHMENT_CATEGORIES = new Set([
    'hot-adultos', 'hot-adultos-bella-da-semana', 'hot-adultos-legendado'
]);

// ============================================
// HELPERS
// ============================================

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

// ============================================
// STEP 1: PURGE non-.mp4 URLs
// ============================================

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

// ============================================
// STEP 2: TMDB Re-enrichment
// ============================================

function buildImageUrl(imgPath, size = 'w500') {
    if (!imgPath) return null;
    return `${TMDB_IMAGE_BASE}/${size}${imgPath}`;
}

/**
 * Extracts the search title and year from a raw item name.
 * Strips language tags: (Leg), (Dub), (Dual), [L], etc.
 * Keeps year for accuracy when distinguishing same-named films.
 */
function extractTitleAndYear(name) {
    let title = name;

    // Remove language/quality suffixes (Leg), (Dub), (Dual), (Dua) typo — anywhere in string, multiple times
    title = title.replace(/\s*\((Leg|Dub|Dual|Dua|LEG|DUB|DUAL|leg|dub)\)/gi, '');
    // Remove bracketed tags: [L], [Leg], [Dub], [Dual], [HD], [4K], [CAM], [CINEMA], [UHD], [BluRay], etc.
    title = title.replace(/\s*\[(?:L|Leg|Dub|Dual|HD|4K|CAM|CINEMA|UHD|BluRay|BDRip|WEB|WEBRip)\]/gi, '');
    // Remove quality tags in parens: (4k), (4K), (UHD), (HD), (CAM), (CINEMA), (BDRip), (WEB)
    title = title.replace(/\s*\((?:4[kK]|UHD|HD|CAM|CINEMA|BluRay|BDRip|WEB|WEBRip|SDR|HDR)\)/gi, '');
    // Remove trailing: "- Dublado", "- Legendado", "- Dual Áudio"
    title = title.replace(/\s*-\s*(Dublado|Legendado|Dual Áudio)\s*$/i, '');
    // Remove DUB / LEG / DUAL at end of string
    title = title.replace(/\s+(DUB|LEG|DUAL)\s*$/i, '');
    // Remove series episode markers
    title = title.replace(/\s+S\d+\s*E\d+.*$/i, '');

    // Extract year BEFORE removing it from title (keep for search accuracy)
    // Match "(2022)" or "(2016 " (malformed, no closing paren) or "- 2022"
    const yearMatch = title.match(/\((\d{4})\)/) || title.match(/\((\d{4})\s/) || title.match(/[-–]\s*(\d{4})\s*(?:\(|$)/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

    // Clean remaining noise
    title = title
        .replace(/\s*\(\d{4}\)\s*/g, '')          // remove year in parens
        .replace(/\s*[-–]\s*\d{4}\s*$/g, '')      // remove trailing "- YYYY"
        .replace(/\s*\[.*?\]/g, '')               // remove any remaining brackets
        .replace(/\s*\([^)]*\)\s*$/g, '')         // remove any remaining parens at end
        .replace(/[_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return { title, year };
}

function normalizeForComparison(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findBestMatch(results, searchTitle, targetYear) {
    if (!results || results.length === 0) return null;
    const norm = normalizeForComparison(searchTitle);

    let best = null;
    let bestScore = -Infinity;

    for (const r of results) {
        const title = normalizeForComparison(r.title || r.name || '');
        const original = normalizeForComparison(r.original_title || r.original_name || '');
        let score = 0;

        // Title matching
        if (title === norm || original === norm) score += 80;
        else if (title.startsWith(norm) || original.startsWith(norm)) score += 50;
        else if (title.includes(norm) || original.includes(norm)) score += 25;

        // Year matching — CRITICAL for distinguishing same-named movies of different years
        const resultDateStr = r.release_date || r.first_air_date || '';
        const resultYear = resultDateStr ? parseInt(resultDateStr.substring(0, 4)) : null;

        if (targetYear && resultYear) {
            if (resultYear === targetYear) score += 100; // Strong bonus for exact year match
            else if (Math.abs(resultYear - targetYear) === 1) score += 20;
            else if (Math.abs(resultYear - targetYear) > 3) score -= 50; // Strong penalty for wrong year
        }

        if ((r.vote_count || 0) > 100) score += 3;
        if ((r.vote_count || 0) > 1000) score += 5;

        if (score > bestScore) { best = r; bestScore = score; }
    }

    // Only return if we have at least a partial title match
    return bestScore > 0 ? best : (results.find(r => r.poster_path) || results[0]);
}

async function searchTMDB(cleanedTitle, year, type) {
    if (!cleanedTitle || cleanedTitle.length < 2) return null;
    const endpoint = type === 'series' ? 'search/tv' : 'search/movie';

    for (const lang of ['pt-BR', 'en-US']) {
        try {
            const url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(cleanedTitle)}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const match = findBestMatch(data.results, cleanedTitle, year);
                if (match) return { match, foundType: type };
            }
        } catch (e) {
            // ignore fetch error
        }
    }

    // Try alternate type (movie ↔ series)
    const altEndpoint = type === 'series' ? 'search/movie' : 'search/tv';
    try {
        const url = `${TMDB_BASE}/${altEndpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(cleanedTitle)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const match = findBestMatch(data.results, cleanedTitle, year);
                if (match) return { match, foundType: type === 'series' ? 'movie' : 'series' };
            }
        }
    } catch (e) { /* ignore */ }

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
        const res = await fetch(url);
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
    const writers = (details.credits?.crew || []).filter(p => ['Writer', 'Screenplay', 'Story'].includes(p.job)).map(p => p.name);
    const keywords = (details.keywords?.keywords || details.keywords?.results || []).slice(0, 10).map(k => k.name);
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
            poster: details.belongs_to_collection.poster_path ? buildImageUrl(details.belongs_to_collection.poster_path, 'w185') : null
        } : null,
        recommendations,
        streaming,
        imdb: details.external_ids?.imdb_id || null
    };
}

/**
 * Enrich a single item, returns { success, title }
 */
async function enrichItem(item) {
    const { title, year } = extractTitleAndYear(item.name);
    if (!title || title.length < 2) return { success: false };

    const searchResult = await searchTMDB(title, year, item.type);
    if (!searchResult) return { success: false };

    const { match, foundType } = searchResult;
    const details = await fetchTMDBDetails(match.id, foundType);
    if (!details) return { success: false };

    item.tmdb = buildTmdbObject(details, foundType);
    return { success: true, title: item.tmdb.title };
}

// ============================================
// MAIN
// ============================================

async function main() {
    const args = process.argv.slice(2);
    const doPurge = !args.includes('--enrich-only');
    const doEnrich = !args.includes('--purge-only');
    const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1] || null;
    const limitArg = args.find(a => a.startsWith('--limit='));
    const enrichLimit = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

    const manifest = readManifest();
    const categories = categoryFilter ? [categoryFilter] : Object.keys(manifest);

    let totalPurgedMovies = 0;
    let totalPurgedEpisodes = 0;
    let totalEnriched = 0;
    let totalFailed = 0;
    let enrichCount = 0;

    for (const baseName of categories) {
        if (!manifest[baseName]) {
            console.log(`⚠️  Categoria "${baseName}" não encontrada no manifesto.`);
            continue;
        }

        const totalItems = manifest[baseName].totalItems;
        console.log(`\n📁 Categoria: ${baseName} (${totalItems} itens)`);
        let items = readCategoryParts(baseName, manifest);
        let changed = false;

        // STEP 1: PURGE
        if (doPurge) {
            const { filtered, removedMovies, removedEpisodes } = purgeNonMp4(items);
            if (removedMovies > 0 || removedEpisodes > 0) {
                console.log(`  🗑️  Removidos: ${removedMovies} itens sem .mp4, ${removedEpisodes} episódios sem .mp4`);
                totalPurgedMovies += removedMovies;
                totalPurgedEpisodes += removedEpisodes;
                items = filtered;
                changed = true;
            }
        }

        // STEP 2: RE-ENRICH (parallel, BATCH_SIZE at a time)
        if (doEnrich && enrichCount < enrichLimit) {
            if (SKIP_ENRICHMENT_CATEGORIES.has(baseName)) {
                console.log(`  ⏭️  Pulando enriquecimento TMDB (categoria adulta).`);
            } else {
                const missing = items.filter(i => !i.tmdb || !i.tmdb.id);
                if (missing.length > 0) {
                    const toProcess = missing.slice(0, enrichLimit - enrichCount);
                    console.log(`  🔍 ${toProcess.length} itens sem TMDB, processando em lotes de ${BATCH_SIZE}...`);

                    let batchEnriched = 0;
                    let batchFailed = 0;

                    for (let batchStart = 0; batchStart < toProcess.length; batchStart += BATCH_SIZE) {
                        const batch = toProcess.slice(batchStart, batchStart + BATCH_SIZE);
                        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
                        const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);
                        process.stdout.write(`    🔄 Lote ${batchNum}/${totalBatches} (${batch.length} itens em paralelo)... `);

                        const results = await Promise.allSettled(
                            batch.map(item => enrichItem(item))
                        );

                        let ok = 0, fail = 0;
                        for (const result of results) {
                            if (result.status === 'fulfilled' && result.value.success) {
                                ok++;
                                batchEnriched++;
                                changed = true;
                            } else {
                                fail++;
                                batchFailed++;
                            }
                        }
                        console.log(`✅ ${ok} encontrados, ❌ ${fail} não encontrados`);
                        enrichCount += batch.length;

                        // Small delay between batches so we don't hammer the API
                        if (batchStart + BATCH_SIZE < toProcess.length) {
                            await sleep(DELAY_BETWEEN_BATCHES);
                        }
                    }

                    totalEnriched += batchEnriched;
                    totalFailed += batchFailed;
                    console.log(`  📊 Categoria concluída: ${batchEnriched}/${toProcess.length} enriquecidos`);
                }
            }
        }

        if (changed) {
            writeCategoryParts(baseName, items, manifest);
            console.log(`  💾 Salvo: ${items.length} itens`);
        }
    }

    writeManifest(manifest);

    console.log('\n════════════════════════════════════');
    console.log('✅ CONCLUÍDO');
    if (doPurge) {
        console.log(`  🗑️  Removidos (sem .mp4): ${totalPurgedMovies} itens, ${totalPurgedEpisodes} eps`);
    }
    if (doEnrich) {
        console.log(`  ✨ Enriquecidos com TMDB: ${totalEnriched}`);
        console.log(`  ❌ Não encontrados: ${totalFailed}`);
    }
    console.log('════════════════════════════════════');
}

main().catch(console.error);
