/**
 * 🚀 ENRICH NEW ITEMS v2 - Matching RIGOROSO
 * 
 * MELHORIAS:
 * - Match EXATO obrigatório (não aceita similares)
 * - Validação de ano quando disponível
 * - 500 requisições paralelas para velocidade máxima
 * - Normalização rigorosa de nomes
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO
// ============================================
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const ENRICHED_DIR = path.join(__dirname, '../public/data/enriched');

// 🚀 500 requisições paralelas para velocidade máxima
const PARALLEL_REQUESTS = 500;
const DELAY_BETWEEN_BATCHES = 300;

// Arquivos a ignorar
const IGNORE_FILES = ['categories.json', 'test-report-acao.json'];

// Score mínimo para aceitar um match
const MIN_SCORE_TO_ACCEPT = 100;

// ============================================
// HELPERS
// ============================================

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let stats = {
    found: 0,
    notFound: 0,
    rejected: 0, // Matches rejeitados por score baixo
    errors: 0
};

function img(imgPath, type = 'poster', size = 'large') {
    if (!imgPath) return null;
    const sizes = {
        poster: { s: 'w185', m: 'w342', l: 'w500', o: 'original' },
        backdrop: { s: 'w300', m: 'w780', l: 'w1280', o: 'original' },
        profile: { s: 'w45', m: 'w185', l: 'h632', o: 'original' },
        logo: { s: 'w92', m: 'w185', l: 'w500', o: 'original' }
    };
    const s = size === 'small' ? 's' : size === 'medium' ? 'm' : size === 'original' ? 'o' : 'l';
    return `${TMDB_IMAGE_BASE}/${sizes[type]?.[s] || 'w500'}${imgPath}`;
}

// ============================================
// EXTRAÇÃO E NORMALIZAÇÃO DE NOMES
// ============================================

/**
 * Extrai o ano do nome do filme/série
 * Ex: "Avatar (2009)" -> 2009
 */
function extractYear(name) {
    const match = name.match(/\((\d{4})\)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Limpa e normaliza o título para busca
 */
function cleanTitle(name) {
    return name
        // Remove padrões de episódio
        .replace(/\s*S\d+\s*E\d+.*/i, '')
        .replace(/\s*Temporada\s*\d+.*/i, '')
        // Remove tags comuns
        .replace(/\s*\(Série\)/i, '')
        .replace(/\s*\[.*?\]/g, '')
        .replace(/\s*\(24h\)/i, '')
        // Remove ano (será usado separadamente)
        .replace(/\s*\(\d{4}\)\s*/g, '')
        // Remove qualidade
        .replace(/\s*4K.*/i, '')
        .replace(/\s*FHD.*/i, '')
        .replace(/\s*HD.*/i, '')
        .replace(/\s*UHD.*/i, '')
        .replace(/\s*H265.*/i, '')
        .replace(/\s*H\.265.*/i, '')
        // Remove idioma
        .replace(/\s*Dublado.*/i, '')
        .replace(/\s*Legendado.*/i, '')
        .replace(/\s*-\s*DUB$/i, '')
        .replace(/\s*-\s*LEG$/i, '')
        .replace(/\s*\[L\]$/i, '')
        .replace(/\s*\[D\]$/i, '')
        // Limpa caracteres especiais
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normaliza string para comparação (remove acentos, lowercase)
 */
function normalizeForComparison(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s]/g, '') // Só letras, números e espaços
        .replace(/\s+/g, ' ')
        .trim();
}

// ============================================
// SISTEMA DE PONTUAÇÃO RIGOROSO
// ============================================

/**
 * Calcula score de match entre resultado TMDB e título buscado
 * 
 * REGRAS:
 * - Match EXATO do título = 100 pontos (obrigatório)
 * - Ano correto = +50 pontos
 * - Ano próximo (±1) = +25 pontos
 * - Alta popularidade = +10 pontos
 */
function calculateMatchScore(result, searchTitle, targetYear) {
    let score = 0;

    const title = normalizeForComparison(result.title || result.name || '');
    const originalTitle = normalizeForComparison(result.original_title || result.original_name || '');
    const search = normalizeForComparison(searchTitle);

    // Match EXATO é obrigatório (100 pontos)
    if (title === search || originalTitle === search) {
        score += 100;
    } else {
        // Não é match exato - retorna 0 (será rejeitado)
        return 0;
    }

    // Bônus por ano
    const resultYear = result.release_date || result.first_air_date;
    if (resultYear && targetYear) {
        const year = parseInt(resultYear.substring(0, 4), 10);
        if (year === targetYear) {
            score += 50; // Ano exato
        } else if (Math.abs(year - targetYear) <= 1) {
            score += 25; // Ano próximo
        }
    }

    // Bônus por popularidade (indica resultado mais provável)
    if (result.vote_count > 500) score += 10;
    else if (result.vote_count > 100) score += 5;

    return score;
}

/**
 * Encontra o MELHOR match entre os resultados
 * Retorna null se nenhum atingir score mínimo
 */
function findBestMatch(results, searchTitle, targetYear) {
    if (!results || results.length === 0) return null;

    const scored = results.map(r => ({
        result: r,
        score: calculateMatchScore(r, searchTitle, targetYear)
    }));

    // Ordena por score decrescente
    scored.sort((a, b) => b.score - a.score);

    // Debug: mostra top 3
    // console.log(`\n  Search: "${searchTitle}" Year: ${targetYear}`);
    // scored.slice(0, 3).forEach(s => {
    //     console.log(`    Score ${s.score}: ${s.result.title || s.result.name}`);
    // });

    // Só aceita se score >= MIN_SCORE_TO_ACCEPT
    if (scored[0].score >= MIN_SCORE_TO_ACCEPT) {
        return scored[0].result;
    }

    // Match rejeitado por score baixo
    stats.rejected++;
    return null;
}

// ============================================
// TMDB API
// ============================================

async function searchTMDB(query, type) {
    const clean = cleanTitle(query);
    const year = extractYear(query);

    if (!clean || clean.length < 2) return null;

    const endpoint = type === 'series' ? 'search/tv' : 'search/movie';

    // Inclui ano na busca se disponível (melhora resultados)
    const yearParam = year ? `&year=${year}` : '';
    const url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(clean)}${yearParam}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 429) {
                await sleep(2000);
                return searchTMDB(query, type);
            }
            stats.errors++;
            return null;
        }

        let data = await res.json();

        // Fallback para inglês se não encontrar em PT
        if (!data.results?.length) {
            const urlEn = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(clean)}${yearParam}`;
            const resEn = await fetch(urlEn);
            if (resEn.ok) {
                data = await resEn.json();
            }
        }

        // USA O SISTEMA DE PONTUAÇÃO RIGOROSO
        return findBestMatch(data.results, clean, year);

    } catch (e) {
        stats.errors++;
        return null;
    }
}

async function fetchDetails(id, type) {
    const endpoint = type === 'series' ? 'tv' : 'movie';
    const append = type === 'series'
        ? 'credits,images,keywords,recommendations,external_ids,content_ratings'
        : 'credits,images,keywords,recommendations,external_ids,release_dates';

    const url = `${TMDB_BASE}/${endpoint}/${id}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=${append}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 429) {
                await sleep(2000);
                return fetchDetails(id, type);
            }
            return null;
        }
        return await res.json();
    } catch (e) {
        return null;
    }
}

// ============================================
// FORMATTER
// ============================================

function formatItem(item, tmdb, type) {
    if (!tmdb) return { ...item, tmdb: null };

    // Certificação
    let cert = null;
    if (type === 'movie' && tmdb.release_dates?.results) {
        const br = tmdb.release_dates.results.find(r => r.iso_3166_1 === 'BR');
        const us = tmdb.release_dates.results.find(r => r.iso_3166_1 === 'US');
        cert = br?.release_dates?.find(rd => rd.certification)?.certification
            || us?.release_dates?.find(rd => rd.certification)?.certification
            || null;
    } else if (type === 'series' && tmdb.content_ratings?.results) {
        const br = tmdb.content_ratings.results.find(r => r.iso_3166_1 === 'BR');
        const us = tmdb.content_ratings.results.find(r => r.iso_3166_1 === 'US');
        cert = br?.rating || us?.rating || null;
    }

    const newTmdb = {
        id: tmdb.id,
        imdbId: tmdb.external_ids?.imdb_id || null,
        title: type === 'series' ? tmdb.name : tmdb.title,
        originalTitle: type === 'series' ? tmdb.original_name : tmdb.original_title,
        tagline: tmdb.tagline || null,
        overview: tmdb.overview || '',
        status: tmdb.status,
        language: tmdb.original_language,
        releaseDate: tmdb.release_date || tmdb.first_air_date || null,
        year: (tmdb.release_date || tmdb.first_air_date || '').substring(0, 4) || null,
        rating: Math.round((tmdb.vote_average || 0) * 10) / 10,
        voteCount: tmdb.vote_count || 0,
        popularity: Math.round(tmdb.popularity || 0),
        certification: cert,
        genres: tmdb.genres?.map(g => g.name) || [],
        poster: img(tmdb.poster_path, 'poster', 'large'),
        posterHD: img(tmdb.poster_path, 'poster', 'original'),
        backdrop: img(tmdb.backdrop_path, 'backdrop', 'large'),
        backdropHD: img(tmdb.backdrop_path, 'backdrop', 'original'),
        cast: tmdb.credits?.cast?.slice(0, 50).map(p => ({
            id: p.id,
            name: p.name,
            character: p.character,
            photo: img(p.profile_path, 'profile', 'medium')
        })) || [],
        keywords: (tmdb.keywords?.keywords || tmdb.keywords?.results || []).slice(0, 10).map(k => k.name),
        recommendations: tmdb.recommendations?.results?.slice(0, 6).map(r => ({
            id: r.id,
            title: r.title || r.name,
            poster: img(r.poster_path, 'poster', 'small'),
            rating: Math.round((r.vote_average || 0) * 10) / 10
        })) || []
    };

    if (type === 'series') {
        newTmdb.seasons = tmdb.number_of_seasons;
        newTmdb.episodes = tmdb.number_of_episodes;
    }

    return { ...item, tmdb: newTmdb };
}

// ============================================
// MAIN LOOP
// ============================================

async function processItem(item) {
    if (item.tmdb) return item;

    const type = item.type === 'series' ? 'series' : 'movie';
    const search = await searchTMDB(item.name, type);

    if (search) {
        const details = await fetchDetails(search.id, type);
        if (details) {
            stats.found++;
            return formatItem(item, details, type);
        }
    }

    stats.notFound++;
    return { ...item, tmdb: null };
}

async function main() {
    console.log('🚀 ENRICH NEW ITEMS v2 - Matching RIGOROSO');
    console.log(`⚡ ${PARALLEL_REQUESTS} requisições paralelas`);
    console.log(`🎯 Score mínimo para aceitar: ${MIN_SCORE_TO_ACCEPT} (match exato obrigatório)\n`);

    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error('❌ Diretório não encontrado:', ENRICHED_DIR);
        return;
    }

    const files = fs.readdirSync(ENRICHED_DIR)
        .filter(f => f.endsWith('.json') && !IGNORE_FILES.includes(f));

    let totalProcessed = 0;
    const startTime = Date.now();

    for (const file of files) {
        const filePath = path.join(ENRICHED_DIR, file);
        let content;

        try {
            content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`❌ Erro ao ler ${file}, pulando.`);
            continue;
        }

        if (!Array.isArray(content)) continue;

        // Filtra itens que precisam de update
        const missingIndices = content.map((item, index) => {
            if (!item.tmdb && item.id &&
                (String(item.id).startsWith('imp-') ||
                    String(item.id).startsWith('m3u-') ||
                    String(item.id).startsWith('series-'))) {
                return index;
            }
            return -1;
        }).filter(i => i !== -1);

        if (missingIndices.length === 0) continue;

        console.log(`\n📂 ${file}: ${missingIndices.length} itens sem TMDB`);

        // Processa em batches de 500
        for (let i = 0; i < missingIndices.length; i += PARALLEL_REQUESTS) {
            const batchIndices = missingIndices.slice(i, i + PARALLEL_REQUESTS);

            const promises = batchIndices.map(async (idx) => {
                const updated = await processItem(content[idx]);
                content[idx] = updated;
                if (updated.tmdb) process.stdout.write('✓');
                else process.stdout.write('✗');
            });

            await Promise.all(promises);
            await sleep(DELAY_BETWEEN_BATCHES);

            // Progresso
            const progress = Math.round(((i + batchIndices.length) / missingIndices.length) * 100);
            process.stdout.write(` ${progress}%`);
        }

        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        console.log(`\n💾 ${file} salvo.`);
        totalProcessed += missingIndices.length;
    }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    console.log('\n═══════════════════════════════════════');
    console.log('📊 RESULTADO FINAL');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Encontrados (match exato): ${stats.found}`);
    console.log(`❌ Não encontrados: ${stats.notFound}`);
    console.log(`⚠️ Rejeitados (match impreciso): ${stats.rejected}`);
    console.log(`🔴 Erros: ${stats.errors}`);
    console.log(`⏱️ Tempo: ${elapsed} min`);
    console.log(`📦 Total processado: ${totalProcessed}`);
    console.log('═══════════════════════════════════════\n');
}

main();
