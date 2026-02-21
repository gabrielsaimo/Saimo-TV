/**
 * 🚀 ULTRA TURBO v2 - Enriquecimento MASSIVO
 * 
 * Atualizado para focar apenas em itens SEM TMDB, nos arquivos *-p*.json
 * E processar categorias especificadas pelo usuário.
 * 
 * USO:
 *   node scripts/enrich-movies-turbo.cjs
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO
// ============================================
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// 🚀 VELOCIDADE
const PARALLEL_REQUESTS = 100;     // 100 por vez (séries usam mais requests)
const DELAY_BETWEEN_BATCHES = 500;
const SAVE_EVERY = 500;

// Categorias específicas a buscar
const TARGET_CATEGORIES = [
  'lancamentos',
  'comedia',
  'acao',
  'uhd-4k',
  'ficcao-cientifica',
  'reelshort',
  'brasileiro',
  'animes',
  'desenhos',
  'documentario',
  'marvel-dc',
  'hulu',
  'universal-plus',
  'reality',
  'infantil',
  'sem-categoria'
];

const DATA_DIR = path.join(__dirname, '../public/data/enriched');
const OUTPUT_DIR = path.join(__dirname, '../public/data/enriched');

// ============================================
// CACHE E STATS
// ============================================
const searchCache = new Map();

let stats = {
  total: 0,
  processed: 0,
  found: 0,
  notFound: 0,
  cached: 0,
  series: 0,
  movies: 0,
  errors: 0,
  startTime: Date.now()
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseEpisodeInfo(name) {
  // Padrões: S01E01, S1E1, T01E01, Temporada 1 Ep 1, etc.
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

function cleanTitle(name) {
  const epInfo = parseEpisodeInfo(name);
  const baseName = epInfo ? epInfo.baseName : name;

  return baseName
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/^📺\s*/g, '')
    .replace(/^🎬\s*/g, '')
    .replace(/\s*\(\d{4}\)\s*/g, '')
    .replace(/\s*\[CAM\]/gi, '')
    .replace(/\s*\[CINEMA\]/gi, '')
    .replace(/\s*\[HD\]/gi, '')
    .replace(/\s*\[4K\]/gi, '')
    .replace(/\s*-\s*Dublado.*/i, '')
    .replace(/\s*-\s*Legendado.*/i, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*DUB\s*$/i, '')
    .replace(/\s*LEG\s*$/i, '')
    .replace(/[_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYear(name) {
  const match = name.match(/\((\d{4})\)/);
  return match ? parseInt(match[1], 10) : null;
}

function normalizeForComparison(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function calculateMatchScore(result, searchTitle, targetYear) {
  let score = 0;
  const title = result.title || result.name || '';
  const originalTitle = result.original_title || result.original_name || '';
  const normalizedSearch = normalizeForComparison(searchTitle);
  const normalizedTitle = normalizeForComparison(title);
  const normalizedOriginal = normalizeForComparison(originalTitle);

  if (normalizedTitle === normalizedSearch || normalizedOriginal === normalizedSearch) score += 50;
  else if (normalizedTitle.includes(normalizedSearch) || normalizedOriginal.includes(normalizedSearch)) score += 30;

  const resultYear = result.release_date || result.first_air_date;
  if (resultYear && targetYear) {
    const year = parseInt(resultYear.substring(0, 4), 10);
    if (year === targetYear) score += 40;
    else if (Math.abs(year - targetYear) <= 1) score += 20;
  }

  if (result.vote_count > 100) score += 5;
  if (result.vote_count > 1000) score += 5;

  return score;
}

function findBestMatch(results, searchTitle, targetYear) {
  if (!results || results.length === 0) return null;
  const scored = results.map(r => ({ result: r, score: calculateMatchScore(r, searchTitle, targetYear) }));
  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score > 0) return scored[0].result;
  return results.find(r => r.poster_path) || results[0];
}

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

function convertCert(cert, isTV = false) {
  if (!cert) return null;
  if (isTV) return { 'TV-Y': 'L', 'TV-Y7': 'L', 'TV-G': 'L', 'TV-PG': '10', 'TV-14': '14', 'TV-MA': '18' }[cert] || cert;
  return { 'G': 'L', 'PG': '10', 'PG-13': '12', 'R': '16', 'NC-17': '18' }[cert] || cert;
}

// ============================================
// BUSCA TMDB
// ============================================

async function searchTMDB(title, type = 'movie') {
  const cleanedTitle = cleanTitle(title);
  const targetYear = extractYear(title);
  const cacheKey = `${type}:${cleanedTitle.toLowerCase()}`;

  if (searchCache.has(cacheKey)) {
    stats.cached++;
    return searchCache.get(cacheKey);
  }

  if (!cleanedTitle || cleanedTitle.length < 2) return null;

  const endpoint = type === 'series' ? 'search/tv' : 'search/movie';

  try {
    const response = await fetch(
      `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(cleanedTitle)}`
    );

    if (!response.ok) {
      if (response.status === 429) {
        await sleep(2000);
        return searchTMDB(title, type);
      }
      return null;
    }

    let data = await response.json();

    if (!data.results || data.results.length === 0) {
      const responseEn = await fetch(
        `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(cleanedTitle)}`
      );
      if (responseEn.ok) data = await responseEn.json();
    }

    const result = data.results?.length > 0 ? findBestMatch(data.results, cleanedTitle, targetYear) : null;
    searchCache.set(cacheKey, result);
    return result;
  } catch {
    stats.errors++;
    return null;
  }
}

async function fetchDetails(tmdbId, type = 'movie') {
  const endpoint = type === 'series' ? 'tv' : 'movie';
  const append = [
    'credits', 'images', 'keywords', 'recommendations', 'watch/providers', 'external_ids',
    type === 'series' ? 'content_ratings' : 'release_dates'
  ].join(',');

  try {
    const response = await fetch(
      `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=${append}`
    );

    if (!response.ok) {
      if (response.status === 429) {
        await sleep(2000);
        return fetchDetails(tmdbId, type);
      }
      return null;
    }

    return await response.json();
  } catch {
    stats.errors++;
    return null;
  }
}

// ============================================
// PROCESSAMENTO DE DADOS
// ============================================

function processMovieData(tmdb, item) {
  let cert = null;
  if (tmdb.release_dates?.results) {
    const br = tmdb.release_dates.results.find(r => r.iso_3166_1 === 'BR');
    const us = tmdb.release_dates.results.find(r => r.iso_3166_1 === 'US');
    cert = br?.release_dates?.find(rd => rd.certification)?.certification ||
      convertCert(us?.release_dates?.find(rd => rd.certification)?.certification, false);
  }

  const directors = tmdb.credits?.crew?.filter(c => c.job === 'Director').map(c => c.name).slice(0, 3) || [];
  const writers = tmdb.credits?.crew?.filter(c => ['Writer', 'Screenplay'].includes(c.job)).map(c => c.name).slice(0, 3) || [];

  return {
    ...item,
    tmdb: {
      id: tmdb.id,
      imdbId: tmdb.external_ids?.imdb_id || null,
      title: tmdb.title,
      originalTitle: tmdb.original_title,
      tagline: tmdb.tagline || null,
      overview: tmdb.overview || '',
      status: tmdb.status,
      language: tmdb.original_language,
      releaseDate: tmdb.release_date || null,
      year: (tmdb.release_date || '').substring(0, 4) || null,
      runtime: tmdb.runtime || null,
      rating: Math.round((tmdb.vote_average || 0) * 10) / 10,
      voteCount: tmdb.vote_count || 0,
      popularity: Math.round(tmdb.popularity || 0),
      certification: cert,
      genres: tmdb.genres?.map(g => g.name) || [],
      poster: img(tmdb.poster_path, 'poster', 'large'),
      posterHD: img(tmdb.poster_path, 'poster', 'original'),
      backdrop: img(tmdb.backdrop_path, 'backdrop', 'large'),
      backdropHD: img(tmdb.backdrop_path, 'backdrop', 'original'),
      logo: tmdb.images?.logos?.[0]?.file_path ? img(tmdb.images.logos[0].file_path, 'logo', 'large') : null,
      cast: tmdb.credits?.cast?.slice(0, 15).map(p => ({
        id: p.id,
        name: p.name,
        character: p.character,
        photo: img(p.profile_path, 'profile', 'medium')
      })) || [],
      directors,
      writers,
      keywords: (tmdb.keywords?.keywords || []).slice(0, 10).map(k => k.name),
      companies: tmdb.production_companies?.slice(0, 5).map(c => c.name) || [],
      countries: tmdb.production_countries?.map(c => c.iso_3166_1) || [],
      budget: tmdb.budget || null,
      revenue: tmdb.revenue || null,
      collection: tmdb.belongs_to_collection ? {
        id: tmdb.belongs_to_collection.id,
        name: tmdb.belongs_to_collection.name,
        poster: img(tmdb.belongs_to_collection.poster_path, 'poster', 'small')
      } : null,
      recommendations: tmdb.recommendations?.results?.slice(0, 6).map(r => ({
        id: r.id,
        title: r.title || r.name,
        poster: img(r.poster_path, 'poster', 'small'),
        rating: Math.round((r.vote_average || 0) * 10) / 10
      })) || [],
      streaming: tmdb['watch/providers']?.results?.BR?.flatrate?.slice(0, 5).map(p => p.provider_name) || [],
      imdb: tmdb.external_ids?.imdb_id,
      facebook: tmdb.external_ids?.facebook_id,
      instagram: tmdb.external_ids?.instagram_id,
      twitter: tmdb.external_ids?.twitter_id
    }
  };
}

function processSeriesData(tmdb, item) {
  let cert = null;
  if (tmdb.content_ratings?.results) {
    const br = tmdb.content_ratings.results.find(r => r.iso_3166_1 === 'BR');
    const us = tmdb.content_ratings.results.find(r => r.iso_3166_1 === 'US');
    cert = br?.rating || convertCert(us?.rating, true);
  }

  const creators = tmdb.created_by?.map(c => c.name) || [];
  const writers = tmdb.credits?.crew?.filter(c => ['Writer', 'Screenplay'].includes(c.job)).map(c => c.name).slice(0, 3) || [];

  return {
    ...item,
    tmdb: {
      id: tmdb.id,
      imdbId: tmdb.external_ids?.imdb_id || null,
      title: tmdb.name,
      originalTitle: tmdb.original_name,
      tagline: tmdb.tagline || null,
      overview: tmdb.overview || '',
      status: tmdb.status,
      language: tmdb.original_language,
      firstAirDate: tmdb.first_air_date || null,
      lastAirDate: tmdb.last_air_date || null,
      year: (tmdb.first_air_date || '').substring(0, 4) || null,
      episodeRuntime: tmdb.episode_run_time?.[0] || null,
      rating: Math.round((tmdb.vote_average || 0) * 10) / 10,
      voteCount: tmdb.vote_count || 0,
      popularity: Math.round(tmdb.popularity || 0),
      certification: cert,
      genres: tmdb.genres?.map(g => g.name) || [],
      poster: img(tmdb.poster_path, 'poster', 'large'),
      posterHD: img(tmdb.poster_path, 'poster', 'original'),
      backdrop: img(tmdb.backdrop_path, 'backdrop', 'large'),
      backdropHD: img(tmdb.backdrop_path, 'backdrop', 'original'),
      logo: tmdb.images?.logos?.[0]?.file_path ? img(tmdb.images.logos[0].file_path, 'logo', 'large') : null,
      cast: tmdb.credits?.cast?.slice(0, 15).map(p => ({
        id: p.id,
        name: p.name,
        character: p.character,
        photo: img(p.profile_path, 'profile', 'medium')
      })) || [],
      creators,
      writers,
      keywords: (tmdb.keywords?.results || []).slice(0, 10).map(k => k.name),
      companies: tmdb.production_companies?.slice(0, 5).map(c => c.name) || [],
      countries: tmdb.production_countries?.map(c => c.iso_3166_1) || [],
      seasons: tmdb.number_of_seasons,
      episodes: tmdb.number_of_episodes,
      inProduction: tmdb.in_production,
      networks: tmdb.networks?.map(n => n.name) || [],
      recommendations: tmdb.recommendations?.results?.slice(0, 6).map(r => ({
        id: r.id,
        title: r.title || r.name,
        poster: img(r.poster_path, 'poster', 'small'),
        rating: Math.round((r.vote_average || 0) * 10) / 10
      })) || [],
      streaming: tmdb['watch/providers']?.results?.BR?.flatrate?.slice(0, 5).map(p => p.provider_name) || [],
      imdb: tmdb.external_ids?.imdb_id,
      facebook: tmdb.external_ids?.facebook_id,
      instagram: tmdb.external_ids?.instagram_id,
      twitter: tmdb.external_ids?.twitter_id
    }
  };
}

// ============================================
// PROCESSAMENTO PRINCIPAL
// ============================================

async function processMovie(item) {
  const searchResult = await searchTMDB(item.name, 'movie');
  if (!searchResult) {
    stats.notFound++;
    return;
  }

  const details = await fetchDetails(searchResult.id, 'movie');
  if (!details) {
    stats.notFound++;
    return;
  }

  stats.found++;
  stats.movies++;

  const enrichedData = processMovieData(details, item);
  item.tmdb = enrichedData.tmdb;
}

async function processSeries(item) {
  const searchResult = await searchTMDB(item.name, 'series');
  if (!searchResult) {
    stats.notFound++;
    return;
  }

  const details = await fetchDetails(searchResult.id, 'series');
  if (!details) {
    stats.notFound++;
    return;
  }

  stats.found++;
  stats.series++;

  const enrichedData = processSeriesData(details, item);
  item.tmdb = enrichedData.tmdb;
}

async function processBatch(batch, type) {
  if (type === 'movies') {
    await Promise.all(batch.map(item => processMovie(item)));
  } else {
    await Promise.all(batch.map(item => processSeries(item)));
  }
}

// ============================================
// PROCESSAMENTO DE CATEGORIA
// ============================================

async function processCategory(categoryFile) {
  const filePath = path.join(DATA_DIR, categoryFile);
  if (!fs.existsSync(filePath)) return;

  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const itemsToProcess = items.filter(item => !item.tmdb);
  if (itemsToProcess.length === 0) return;

  const movies = itemsToProcess.filter(i => i.type !== 'series');
  const seriesList = itemsToProcess.filter(i => i.type === 'series');

  console.log(`\n📁 ${categoryFile} (${movies.length} filmes + ${seriesList.length} séries para enriquecer)`);

  // Processa filmes
  if (movies.length > 0) {
    for (let i = 0; i < movies.length; i += PARALLEL_REQUESTS) {
      const batch = movies.slice(i, Math.min(i + PARALLEL_REQUESTS, movies.length));
      await processBatch(batch, 'movies');

      stats.processed += batch.length;
      printProgress();

      if (stats.processed % SAVE_EVERY === 0) {
        fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
      }

      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  // Processa séries
  if (seriesList.length > 0) {
    for (let i = 0; i < seriesList.length; i += PARALLEL_REQUESTS) {
      const batch = seriesList.slice(i, Math.min(i + PARALLEL_REQUESTS, seriesList.length));
      await processBatch(batch, 'series');

      stats.processed += batch.length;
      printProgress();

      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
  console.log(`\n  💾 Salvo: ${categoryFile} (${items.length} itens no total)`);
}

function printProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.processed / elapsed;
  const eta = stats.total > 0 ? (stats.total - stats.processed) / rate / 60 : 0;

  process.stdout.write(`\r  ⚡ ${stats.processed.toLocaleString()}/${stats.total.toLocaleString()} | ${rate.toFixed(0)}/s | ETA: ${eta.toFixed(0)}min | 🎬${stats.movies} 📺${stats.series} ❌${stats.notFound}`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 ULTRA TURBO v2 - Somente Enriquecimento (Listagem Curada)\n');
  console.log(`⚡ ${PARALLEL_REQUESTS} requisições paralelas`);
  console.log(`⏱️ ${DELAY_BETWEEN_BATCHES}ms entre batches\n`);

  // Escaneia a pasta apenas em busca dos arquivos -p que correspondam às categorias-alvo
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f.includes('-p') && f !== '_manifest.json')
    .filter(f => TARGET_CATEGORIES.some(cat => f.startsWith(cat + '-p')));

  let totalMoviesToProcess = 0;
  let totalSeriesToProcess = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const missing = items.filter(i => !i.tmdb);
      totalMoviesToProcess += missing.filter(i => i.type !== 'series').length;
      totalSeriesToProcess += missing.filter(i => i.type === 'series').length;
    }
  }

  stats.total = totalMoviesToProcess + totalSeriesToProcess;

  console.log(`📊 Itens sem TMDB para processar: ${totalMoviesToProcess.toLocaleString()} filmes + ${totalSeriesToProcess.toLocaleString()} séries = ${stats.total.toLocaleString()} itens`);
  console.log(`🎯 Categorias Específicas Direcionadas: ${TARGET_CATEGORIES.join(', ')}\n`);

  stats.startTime = Date.now();

  if (stats.total > 0) {
    for (const file of files) {
      await processCategory(file);
    }
  } else {
    console.log("Nenhum item novo para enriquecer nestas categorias!");
  }

  const totalTime = (Date.now() - stats.startTime) / 1000;

  console.log('\n\n═══════════════════════════════════════');
  console.log('📊 RESULTADO FINAL');
  console.log('═══════════════════════════════════════');
  console.log(`🎬 Filmes: ${stats.movies.toLocaleString()}`);
  console.log(`📺 Séries: ${stats.series.toLocaleString()}`);
  console.log(`✅ Encontrados: ${stats.found.toLocaleString()}`);
  console.log(`❌ Não encontrados: ${stats.notFound.toLocaleString()}`);
  console.log(`💾 Cache hits: ${stats.cached.toLocaleString()}`);
  console.log(`⚠️ Erros: ${stats.errors}`);
  console.log(`⏱️ Tempo: ${(totalTime / 60).toFixed(1)} minutos`);
  console.log(`⚡ Velocidade: ${(stats.processed / totalTime).toFixed(0)} itens/s`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(console.error);
