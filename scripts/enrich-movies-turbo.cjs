/**
 * 🚀 ULTRA TURBO v2 - Enriquecimento MASSIVO com Agrupamento de Séries
 * 
 * Agrupa todos os episódios de séries em uma única entrada!
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

// Categorias para PULAR
const SKIP_CATEGORIES = [
  'adultos',
  'adultos-bella-da-semana',
  'adultos-legendado'
];

const DATA_DIR = path.join(__dirname, '../public/data');
const OUTPUT_DIR = path.join(__dirname, '../public/data/enriched');

// ============================================
// CACHE E STATS
// ============================================
const searchCache = new Map();
const processedTitles = new Set();

let stats = {
  total: 0,
  processed: 0,
  found: 0,
  notFound: 0,
  cached: 0,
  duplicates: 0,
  series: 0,
  movies: 0,
  errors: 0,
  startTime: Date.now()
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extrai informações de episódio do nome
 * Retorna: { baseName, season, episode } ou null se não for série
 */
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

/**
 * Limpa o nome para busca no TMDB
 */
function cleanTitle(name) {
  // Primeiro extrai info de episódio se houver
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
// AGRUPAMENTO DE SÉRIES
// ============================================

/**
 * Agrupa itens por série (filmes ficam individuais)
 */
function groupItems(items) {
  const seriesMap = new Map(); // baseName -> { episodes: [], firstItem: item }
  const movies = [];
  
  for (const item of items) {
    const epInfo = parseEpisodeInfo(item.name);
    
    if (epInfo && item.type === 'series') {
      const key = cleanTitle(epInfo.baseName).toLowerCase();
      
      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          baseName: epInfo.baseName,
          firstItem: item,
          episodes: []
        });
      }
      
      seriesMap.get(key).episodes.push({
        season: epInfo.season,
        episode: epInfo.episode,
        name: item.name,
        url: item.url,
        id: item.id
      });
    } else {
      // Filme ou série sem padrão de episódio
      movies.push(item);
    }
  }
  
  return { seriesMap, movies };
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
    id: item.id,
    name: item.name,
    url: item.url,
    category: item.category,
    type: 'movie',
    isAdult: item.isAdult || false,
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

function processSeriesData(tmdb, seriesData) {
  const { baseName, firstItem, episodes } = seriesData;
  
  let cert = null;
  if (tmdb.content_ratings?.results) {
    const br = tmdb.content_ratings.results.find(r => r.iso_3166_1 === 'BR');
    const us = tmdb.content_ratings.results.find(r => r.iso_3166_1 === 'US');
    cert = br?.rating || convertCert(us?.rating, true);
  }
  
  const creators = tmdb.created_by?.map(c => c.name) || [];
  const writers = tmdb.credits?.crew?.filter(c => ['Writer', 'Screenplay'].includes(c.job)).map(c => c.name).slice(0, 3) || [];
  
  // Organiza episódios por temporada
  const seasonMap = {};
  for (const ep of episodes) {
    const seasonKey = ep.season.toString();
    if (!seasonMap[seasonKey]) {
      seasonMap[seasonKey] = [];
    }
    seasonMap[seasonKey].push({
      episode: ep.episode,
      name: ep.name,
      url: ep.url,
      id: ep.id
    });
  }
  
  // Ordena episódios dentro de cada temporada
  for (const season of Object.keys(seasonMap)) {
    seasonMap[season].sort((a, b) => a.episode - b.episode);
  }
  
  // Cria ID único baseado no nome limpo
  const cleanId = cleanTitle(baseName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  return {
    id: cleanId,
    name: baseName,
    category: firstItem.category,
    type: 'series',
    isAdult: firstItem.isAdult || false,
    
    // TODOS OS EPISÓDIOS ORGANIZADOS POR TEMPORADA
    episodes: seasonMap,
    totalEpisodes: episodes.length,
    totalSeasons: Object.keys(seasonMap).length,
    
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
  const titleKey = cleanTitle(item.name).toLowerCase();
  if (processedTitles.has(titleKey)) {
    stats.duplicates++;
    return null;
  }
  processedTitles.add(titleKey);
  
  const searchResult = await searchTMDB(item.name, 'movie');
  if (!searchResult) {
    stats.notFound++;
    return { ...item, tmdb: null };
  }
  
  const details = await fetchDetails(searchResult.id, 'movie');
  if (!details) {
    stats.notFound++;
    return { ...item, tmdb: null };
  }
  
  stats.found++;
  stats.movies++;
  return processMovieData(details, item);
}

async function processSeries(seriesData) {
  const titleKey = cleanTitle(seriesData.baseName).toLowerCase();
  if (processedTitles.has(titleKey)) {
    stats.duplicates++;
    return null;
  }
  processedTitles.add(titleKey);
  
  const searchResult = await searchTMDB(seriesData.baseName, 'series');
  if (!searchResult) {
    stats.notFound++;
    return {
      id: titleKey.replace(/[^a-z0-9]+/g, '-'),
      name: seriesData.baseName,
      category: seriesData.firstItem.category,
      type: 'series',
      episodes: {},
      tmdb: null
    };
  }
  
  const details = await fetchDetails(searchResult.id, 'series');
  if (!details) {
    stats.notFound++;
    return {
      id: titleKey.replace(/[^a-z0-9]+/g, '-'),
      name: seriesData.baseName,
      category: seriesData.firstItem.category,
      type: 'series',
      episodes: {},
      tmdb: null
    };
  }
  
  stats.found++;
  stats.series++;
  return processSeriesData(details, seriesData);
}

async function processBatch(items, type) {
  if (type === 'movies') {
    const results = await Promise.all(items.map(item => processMovie(item).catch(() => ({ ...item, tmdb: null }))));
    return results.filter(r => r !== null);
  } else {
    const results = await Promise.all(items.map(data => processSeries(data).catch(() => null)));
    return results.filter(r => r !== null);
  }
}

// ============================================
// PROCESSAMENTO DE CATEGORIA
// ============================================

async function processCategory(categoryFile) {
  const filePath = path.join(DATA_DIR, `${categoryFile}.json`);
  const outputPath = path.join(OUTPUT_DIR, `${categoryFile}.json`);
  
  if (!fs.existsSync(filePath)) return;
  
  // Verifica se já foi processado
  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (existing.length > 0 && existing[0]?.tmdb !== undefined) {
        console.log(`  ⏭️ ${categoryFile} (já processado)`);
        return;
      }
    } catch {}
  }
  
  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Agrupa séries e separa filmes
  const { seriesMap, movies } = groupItems(items);
  const seriesList = Array.from(seriesMap.values());
  
  console.log(`\n📁 ${categoryFile} (${movies.length} filmes + ${seriesList.length} séries)`);
  
  const results = [];
  
  // Processa filmes
  if (movies.length > 0) {
    for (let i = 0; i < movies.length; i += PARALLEL_REQUESTS) {
      const batch = movies.slice(i, Math.min(i + PARALLEL_REQUESTS, movies.length));
      const batchResults = await processBatch(batch, 'movies');
      results.push(...batchResults);
      
      stats.processed += batch.length;
      printProgress();
      
      if (results.length % SAVE_EVERY === 0) {
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
      }
      
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }
  
  // Processa séries (agrupadas)
  if (seriesList.length > 0) {
    for (let i = 0; i < seriesList.length; i += PARALLEL_REQUESTS) {
      const batch = seriesList.slice(i, Math.min(i + PARALLEL_REQUESTS, seriesList.length));
      const batchResults = await processBatch(batch, 'series');
      results.push(...batchResults);
      
      stats.processed += batch.length;
      printProgress();
      
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n  💾 Salvo: ${categoryFile}.json (${results.length} itens)`);
}

function printProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.processed / elapsed;
  const eta = stats.total > 0 ? (stats.total - stats.processed) / rate / 60 : 0;
  
  process.stdout.write(`\r  ⚡ ${stats.processed.toLocaleString()}/${stats.total.toLocaleString()} | ${rate.toFixed(0)}/s | ETA: ${eta.toFixed(0)}min | 🎬${stats.movies} 📺${stats.series} ❌${stats.notFound} 🔄${stats.duplicates}`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 ULTRA TURBO v2 - Com Agrupamento de Séries\n');
  console.log(`⚡ ${PARALLEL_REQUESTS} requisições paralelas`);
  console.log(`⏱️ ${DELAY_BETWEEN_BATCHES}ms entre batches\n`);
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'categories.json')
    .map(f => f.replace('.json', ''))
    .filter(f => !SKIP_CATEGORIES.includes(f));
  
  // Conta total de itens únicos (séries contam como 1)
  let totalMovies = 0;
  let totalSeries = 0;
  
  for (const file of files) {
    const filePath = path.join(DATA_DIR, `${file}.json`);
    if (fs.existsSync(filePath)) {
      const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const { seriesMap, movies } = groupItems(items);
      totalMovies += movies.length;
      totalSeries += seriesMap.size;
    }
  }
  
  stats.total = totalMovies + totalSeries;
  
  console.log(`📊 Total: ${totalMovies.toLocaleString()} filmes + ${totalSeries.toLocaleString()} séries = ${stats.total.toLocaleString()} itens`);
  console.log(`⏭️ Pulando: ${SKIP_CATEGORIES.join(', ')}\n`);
  
  stats.startTime = Date.now();
  
  for (const file of files) {
    await processCategory(file);
  }
  
  const totalTime = (Date.now() - stats.startTime) / 1000;
  
  console.log('\n\n═══════════════════════════════════════');
  console.log('📊 RESULTADO FINAL');
  console.log('═══════════════════════════════════════');
  console.log(`🎬 Filmes: ${stats.movies.toLocaleString()}`);
  console.log(`📺 Séries: ${stats.series.toLocaleString()}`);
  console.log(`✅ Encontrados: ${stats.found.toLocaleString()}`);
  console.log(`❌ Não encontrados: ${stats.notFound.toLocaleString()}`);
  console.log(`🔄 Duplicados ignorados: ${stats.duplicates.toLocaleString()}`);
  console.log(`💾 Cache hits: ${stats.cached.toLocaleString()}`);
  console.log(`⚠️ Erros: ${stats.errors}`);
  console.log(`⏱️ Tempo: ${(totalTime / 60).toFixed(1)} minutos`);
  console.log(`⚡ Velocidade: ${(stats.processed / totalTime).toFixed(0)} itens/s`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(console.error);
