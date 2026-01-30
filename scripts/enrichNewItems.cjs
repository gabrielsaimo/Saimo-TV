/**
 * 🚀 ENRICH NEW ITEMS - Foca apenas nos itens sem dados do TMDB
 * 
 * Percorre todos os JSONs em public/data/enriched e preenche 'tmdb' onde for null.
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO
// ============================================
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb'; // Usando a chave encontrada nos scripts existentes
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const ENRICHED_DIR = path.join(__dirname, '../public/data/enriched');

// Quantidade de requisições simultâneas
const PARALLEL_REQUESTS = 50;
const SAVE_EVERY = 100;

// Arquivos a ignorar (opcional)
const IGNORE_FILES = ['categories.json'];

// ============================================
// HELPERS
// ============================================

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function img(path, type = 'poster', size = 'large') {
    if (!path) return null;
    const sizes = {
        poster: { s: 'w185', m: 'w342', l: 'w500', o: 'original' },
        backdrop: { s: 'w300', m: 'w780', l: 'w1280', o: 'original' },
        profile: { s: 'w45', m: 'w185', l: 'h632', o: 'original' },
        logo: { s: 'w92', m: 'w185', l: 'w500', o: 'original' }
    };
    const s = size === 'small' ? 's' : size === 'medium' ? 'm' : size === 'original' ? 'o' : 'l';
    return `${TMDB_IMAGE_BASE}/${sizes[type]?.[s] || 'w500'}${path}`;
}

// Limpeza de nome para busca mais assertiva
function cleanTitle(name) {
    // Remove sufixos comuns de release group, qualidade, etc.
    return name
        .replace(/\s*S\d+E\d+.*/i, '') // Remove S01E01...
        .replace(/\s*Temporada \d+.*/i, '')
        .replace(/\s*\(Série\)/i, '')
        .replace(/\s*\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\s*4K.*/i, '')
        .replace(/\s*FHD.*/i, '')
        .replace(/\s*HD.*/i, '')
        .replace(/\s*Dublado.*/i, '')
        .replace(/\s*Legendado.*/i, '')
        .replace(/[._]/g, ' ')
        .trim();
}

// ============================================
// TMDB API
// ============================================

async function searchTMDB(query, type) {
    const clean = cleanTitle(query);
    if (!clean) return null;

    const endpoint = type === 'series' ? 'search/tv' : 'search/movie';
    const url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(clean)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 429) {
                await sleep(2000);
                return searchTMDB(query, type);
            }
            return null;
        }
        const data = await res.json();

        // Fallback pra inglês se não achar em PT
        if (!data.results?.length) {
            const urlEn = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(clean)}`;
            const resEn = await fetch(urlEn);
            if (resEn.ok) {
                const dataEn = await resEn.json();
                return dataEn.results?.[0] || null;
            }
        }

        return data.results?.[0] || null;
    } catch (e) {
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
    if (!tmdb) return { ...item, tmdb: null }; // Mantém null se não achou

    // Lógica de Certificação
    let cert = null;
    if (type === 'movie' && tmdb.release_dates?.results) {
        const br = tmdb.release_dates.results.find(r => r.iso_3166_1 === 'BR');
        cert = br?.release_dates?.find(rd => rd.certification)?.certification || null;
    } else if (type === 'series' && tmdb.content_ratings?.results) {
        const br = tmdb.content_ratings.results.find(r => r.iso_3166_1 === 'BR');
        cert = br?.rating || null;
    }

    // Preenche objeto tmdb
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
        cast: tmdb.credits?.cast?.slice(0, 15).map(p => ({
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

    // Se for série, adiciona info de temporadas/episodios do TMDB
    if (type === 'series') {
        newTmdb.seasons = tmdb.number_of_seasons;
        newTmdb.episodes = tmdb.number_of_episodes;

        // Atualiza totalEpisodes do item raiz se o TMDB tiver info mais precisa? 
        // Não, melhor manter o que temos localmente ou o que é real do arquivo.
        // item.totalSeasons = tmdb.number_of_seasons; // Opcional
    }

    return { ...item, tmdb: newTmdb };
}

// ============================================
// MAIN LOOP
// ============================================

async function processItem(item) {
    if (item.tmdb) return item; // Já tem dados

    const type = item.type === 'series' ? 'series' : 'movie';
    const search = await searchTMDB(item.name, type);

    if (search) {
        const details = await fetchDetails(search.id, type);
        if (details) {
            return formatItem(item, details, type);
        }
    }

    return { ...item, tmdb: null }; // Marca como null explicitamente se não achou
}

async function main() {
    console.log(`🚀 Iniciando enriquecimento de itens NOVOS (tmdb: null)...`);

    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error('Diretório não encontrado');
        return;
    }

    const files = fs.readdirSync(ENRICHED_DIR).filter(f => f.endsWith('.json') && !IGNORE_FILES.includes(f));

    let totalUpdated = 0;

    for (const file of files) {
        const filePath = path.join(ENRICHED_DIR, file);
        let content;

        try {
            content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`Erro ao ler ${file}, pulando.`);
            continue;
        }

        if (!Array.isArray(content)) continue;

        // Filtra itens que precisam de update (apenas os NOVOS com id 'imp-')
        const missingIndices = content.map((item, index) => {
            if (!item.tmdb && item.id && String(item.id).startsWith('imp-')) return index;
            return -1;
        }).filter(i => i !== -1);

        if (missingIndices.length === 0) continue;

        console.log(`\n📂 ${file}: ${missingIndices.length} itens sem TMDB. Processando...`);

        // Processa em batches
        for (let i = 0; i < missingIndices.length; i += PARALLEL_REQUESTS) {
            const batchIndices = missingIndices.slice(i, i + PARALLEL_REQUESTS);

            const promises = batchIndices.map(async (idx) => {
                const updated = await processItem(content[idx]);
                content[idx] = updated; // Atualiza in-place
                if (updated.tmdb) process.stdout.write('.');
                else process.stdout.write('x');
            });

            await Promise.all(promises);
            await sleep(500); // Rate limit friendly
        }

        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        console.log(`\n💾 ${file} salvo.`);
        totalUpdated += missingIndices.length;
    }

    console.log(`\n🎉 Concluído! Total processado: ${totalUpdated}`);
}

main();
