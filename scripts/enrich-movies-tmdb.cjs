/**
 * 🎬 Script para Enriquecer Filmes/Séries com Dados Completos do TMDB
 * 
 * Este script busca TODOS os dados disponíveis no TMDB:
 * - Informações básicas (título, sinopse, data, duração, etc.)
 * - Imagens (poster, backdrop, logos)
 * - Classificação indicativa
 * - Gêneros
 * - Elenco COMPLETO com fotos
 * - Equipe técnica (diretor, produtor, roteirista, etc.)
 * - Vídeos (trailers, teasers)
 * - Palavras-chave
 * - Produtoras
 * - Países de origem
 * - Idiomas
 * - Coleção (se fizer parte de uma franquia)
 * - Recomendações
 * - Avaliações
 * 
 * =========================================
 * COMO USAR:
 * =========================================
 * 
 * Teste com 1 filme:
 *   node scripts/enrich-movies-tmdb.cjs --test
 * 
 * Processar categoria específica:
 *   node scripts/enrich-movies-tmdb.cjs --category=cinema
 * 
 * Processar todas as categorias (2000 por vez):
 *   node scripts/enrich-movies-tmdb.cjs --all --batch=2000
 * 
 * =========================================
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO
// ============================================
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// Tamanhos de imagem disponíveis
const IMAGE_SIZES = {
  poster: {
    small: 'w185',
    medium: 'w342',
    large: 'w500',
    original: 'original'
  },
  backdrop: {
    small: 'w300',
    medium: 'w780',
    large: 'w1280',
    original: 'original'
  },
  profile: {
    small: 'w45',
    medium: 'w185',
    large: 'h632',
    original: 'original'
  },
  logo: {
    small: 'w92',
    medium: 'w185',
    large: 'w500',
    original: 'original'
  }
};

const DATA_DIR = path.join(__dirname, '../public/data');
const OUTPUT_DIR = path.join(__dirname, '../public/data/enriched');

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 250; // ms (TMDB permite ~40 req/s)
const BATCH_SIZE = 2000;

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Limpa o nome do filme/série para busca
 */
function cleanTitle(name) {
  return name
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/^📺\s*/g, '')
    .replace(/^🎬\s*/g, '')
    .replace(/\s*\(\d{4}\)\s*/g, '')
    .replace(/\s*\[CAM\]/gi, '')
    .replace(/\s*\[CINEMA\]/gi, '')
    .replace(/\s*\[HD\]/gi, '')
    .replace(/\s*\[4K\]/gi, '')
    .replace(/\s*[ST]\d+\s*E\d+.*/i, '')
    .replace(/\s*Temporada\s*\d+.*/i, '')
    .replace(/\s*Season\s*\d+.*/i, '')
    .replace(/\s*-\s*Dublado.*/i, '')
    .replace(/\s*-\s*Legendado.*/i, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*DUB\s*$/i, '')
    .replace(/\s*LEG\s*$/i, '')
    .replace(/[_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai o ano do nome
 */
function extractYear(name) {
  const match = name.match(/\((\d{4})\)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Normaliza string para comparação
 */
function normalizeForComparison(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Calcula score de correspondência
 */
function calculateMatchScore(result, searchTitle, targetYear) {
  let score = 0;
  
  const title = result.title || result.name || '';
  const originalTitle = result.original_title || result.original_name || '';
  const normalizedSearch = normalizeForComparison(searchTitle);
  const normalizedTitle = normalizeForComparison(title);
  const normalizedOriginal = normalizeForComparison(originalTitle);
  
  // Match de título
  if (normalizedTitle === normalizedSearch || normalizedOriginal === normalizedSearch) {
    score += 50;
  } else if (normalizedTitle.includes(normalizedSearch) || normalizedOriginal.includes(normalizedSearch)) {
    score += 30;
  }
  
  // Match de ano
  const resultYear = result.release_date || result.first_air_date;
  if (resultYear && targetYear) {
    const year = parseInt(resultYear.substring(0, 4), 10);
    if (year === targetYear) {
      score += 40;
    } else if (Math.abs(year - targetYear) <= 1) {
      score += 20;
    }
  }
  
  // Preferir resultados com mais votos
  if (result.vote_count > 100) score += 5;
  if (result.vote_count > 1000) score += 5;
  
  return score;
}

/**
 * Encontra o melhor match
 */
function findBestMatch(results, searchTitle, targetYear) {
  if (!results || results.length === 0) return null;
  
  const scored = results.map(r => ({
    result: r,
    score: calculateMatchScore(r, searchTitle, targetYear)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  if (scored[0].score > 0) {
    return scored[0].result;
  }
  
  return results.find(r => r.poster_path) || results[0];
}

/**
 * Constrói URL de imagem
 */
function buildImageUrl(path, type = 'poster', size = 'large') {
  if (!path) return null;
  const sizeKey = IMAGE_SIZES[type]?.[size] || IMAGE_SIZES.poster.large;
  return `${TMDB_IMAGE_BASE}/${sizeKey}${path}`;
}

/**
 * Converte classificação americana para brasileira
 */
function convertCertification(cert, isTV = false) {
  if (!cert) return null;
  
  if (isTV) {
    const tvMap = {
      'TV-Y': 'L', 'TV-Y7': 'L', 'TV-G': 'L',
      'TV-PG': '10', 'TV-14': '14', 'TV-MA': '18'
    };
    return tvMap[cert] || cert;
  }
  
  const movieMap = {
    'G': 'L', 'PG': '10', 'PG-13': '12', 'R': '16', 'NC-17': '18'
  };
  return movieMap[cert] || cert;
}

// ============================================
// FUNÇÕES DE BUSCA NO TMDB
// ============================================

/**
 * Busca inicial para encontrar o ID do TMDB
 */
async function searchTMDB(title, type = 'movie') {
  const cleanedTitle = cleanTitle(title);
  const targetYear = extractYear(title);
  
  if (!cleanedTitle || cleanedTitle.length < 2) return null;
  
  const endpoint = type === 'series' ? 'search/tv' : 'search/movie';
  
  try {
    // Tenta em português primeiro
    let response = await fetch(
      `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(cleanedTitle)}`
    );
    
    if (!response.ok) return null;
    
    let data = await response.json();
    
    // Se não encontrou, tenta em inglês
    if (!data.results || data.results.length === 0) {
      response = await fetch(
        `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(cleanedTitle)}`
      );
      if (response.ok) {
        data = await response.json();
      }
    }
    
    if (!data.results || data.results.length === 0) return null;
    
    const bestMatch = findBestMatch(data.results, cleanedTitle, targetYear);
    return bestMatch;
  } catch (error) {
    console.error(`Erro ao buscar "${title}":`, error.message);
    return null;
  }
}

/**
 * Busca TODOS os detalhes de um filme/série
 * Usa append_to_response para minimizar chamadas API
 */
async function fetchFullDetails(tmdbId, type = 'movie') {
  const endpoint = type === 'series' ? 'tv' : 'movie';
  
  // Lista de dados extras para buscar
  const appendList = [
    'credits',           // Elenco e equipe técnica
    'videos',            // Trailers, teasers
    'images',            // Todas as imagens (posters, backdrops, logos)
    'keywords',          // Palavras-chave
    'recommendations',   // Filmes/séries recomendados
    'similar',           // Filmes/séries similares
    'reviews',           // Avaliações de usuários
    'watch/providers',   // Onde assistir
    type === 'series' ? 'content_ratings' : 'release_dates', // Classificação
    'external_ids',      // IDs em outras plataformas (IMDB, etc.)
    'translations'       // Traduções disponíveis
  ].join(',');
  
  try {
    const response = await fetch(
      `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=${appendList}`
    );
    
    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error(`Erro ao buscar detalhes ID ${tmdbId}:`, error.message);
    return null;
  }
}

/**
 * Processa e formata todos os dados do TMDB
 */
function processFullData(tmdbData, originalItem, type = 'movie') {
  const isTV = type === 'series';
  
  // === INFORMAÇÕES BÁSICAS ===
  const basic = {
    tmdbId: tmdbData.id,
    imdbId: tmdbData.external_ids?.imdb_id || null,
    title: tmdbData.title || tmdbData.name,
    originalTitle: tmdbData.original_title || tmdbData.original_name,
    tagline: tmdbData.tagline || null,
    overview: tmdbData.overview || 'Sinopse não disponível.',
    status: tmdbData.status, // Released, In Production, etc.
    originalLanguage: tmdbData.original_language,
    spokenLanguages: tmdbData.spoken_languages?.map(l => ({
      code: l.iso_639_1,
      name: l.name,
      englishName: l.english_name
    })) || [],
    homepage: tmdbData.homepage || null
  };
  
  // === DATAS E DURAÇÃO ===
  const temporal = {
    releaseDate: tmdbData.release_date || tmdbData.first_air_date || null,
    year: (tmdbData.release_date || tmdbData.first_air_date || '').substring(0, 4) || null,
    runtime: tmdbData.runtime || null, // minutos (filmes)
    // Dados específicos de séries
    ...(isTV && {
      firstAirDate: tmdbData.first_air_date,
      lastAirDate: tmdbData.last_air_date,
      inProduction: tmdbData.in_production,
      numberOfSeasons: tmdbData.number_of_seasons,
      numberOfEpisodes: tmdbData.number_of_episodes,
      episodeRuntime: tmdbData.episode_run_time?.[0] || null,
      seasons: tmdbData.seasons?.map(s => ({
        id: s.id,
        name: s.name,
        seasonNumber: s.season_number,
        episodeCount: s.episode_count,
        airDate: s.air_date,
        overview: s.overview,
        poster: buildImageUrl(s.poster_path, 'poster', 'medium')
      })) || []
    })
  };
  
  // === AVALIAÇÕES ===
  const ratings = {
    voteAverage: Math.round((tmdbData.vote_average || 0) * 10) / 10,
    voteCount: tmdbData.vote_count || 0,
    popularity: tmdbData.popularity || 0
  };
  
  // === CLASSIFICAÇÃO INDICATIVA ===
  let certification = null;
  if (isTV && tmdbData.content_ratings?.results) {
    const brRating = tmdbData.content_ratings.results.find(r => r.iso_3166_1 === 'BR');
    const usRating = tmdbData.content_ratings.results.find(r => r.iso_3166_1 === 'US');
    certification = brRating?.rating || convertCertification(usRating?.rating, true);
  } else if (tmdbData.release_dates?.results) {
    const brRelease = tmdbData.release_dates.results.find(r => r.iso_3166_1 === 'BR');
    const usRelease = tmdbData.release_dates.results.find(r => r.iso_3166_1 === 'US');
    const brCert = brRelease?.release_dates?.find(rd => rd.certification)?.certification;
    const usCert = usRelease?.release_dates?.find(rd => rd.certification)?.certification;
    certification = brCert || convertCertification(usCert, false);
  }
  
  // === GÊNEROS ===
  const genres = tmdbData.genres?.map(g => ({
    id: g.id,
    name: g.name
  })) || [];
  
  // === IMAGENS ===
  const images = {
    poster: {
      small: buildImageUrl(tmdbData.poster_path, 'poster', 'small'),
      medium: buildImageUrl(tmdbData.poster_path, 'poster', 'medium'),
      large: buildImageUrl(tmdbData.poster_path, 'poster', 'large'),
      original: buildImageUrl(tmdbData.poster_path, 'poster', 'original')
    },
    backdrop: {
      small: buildImageUrl(tmdbData.backdrop_path, 'backdrop', 'small'),
      medium: buildImageUrl(tmdbData.backdrop_path, 'backdrop', 'medium'),
      large: buildImageUrl(tmdbData.backdrop_path, 'backdrop', 'large'),
      original: buildImageUrl(tmdbData.backdrop_path, 'backdrop', 'original')
    },
    // Todas as imagens alternativas
    posters: tmdbData.images?.posters?.slice(0, 10).map(p => ({
      path: buildImageUrl(p.file_path, 'poster', 'large'),
      aspectRatio: p.aspect_ratio,
      width: p.width,
      height: p.height,
      language: p.iso_639_1,
      voteAverage: p.vote_average
    })) || [],
    backdrops: tmdbData.images?.backdrops?.slice(0, 10).map(b => ({
      path: buildImageUrl(b.file_path, 'backdrop', 'large'),
      aspectRatio: b.aspect_ratio,
      width: b.width,
      height: b.height,
      language: b.iso_639_1,
      voteAverage: b.vote_average
    })) || [],
    logos: tmdbData.images?.logos?.slice(0, 5).map(l => ({
      path: buildImageUrl(l.file_path, 'logo', 'large'),
      aspectRatio: l.aspect_ratio,
      width: l.width,
      height: l.height,
      language: l.iso_639_1
    })) || []
  };
  
  // === ELENCO COMPLETO ===
  const cast = tmdbData.credits?.cast?.slice(0, 20).map(person => ({
    id: person.id,
    name: person.name,
    originalName: person.original_name,
    character: person.character,
    order: person.order,
    gender: person.gender, // 1 = feminino, 2 = masculino
    knownFor: person.known_for_department,
    popularity: person.popularity,
    profilePath: {
      small: buildImageUrl(person.profile_path, 'profile', 'small'),
      medium: buildImageUrl(person.profile_path, 'profile', 'medium'),
      large: buildImageUrl(person.profile_path, 'profile', 'large'),
      original: buildImageUrl(person.profile_path, 'profile', 'original')
    }
  })) || [];
  
  // === EQUIPE TÉCNICA ===
  const crewJobs = ['Director', 'Producer', 'Executive Producer', 'Writer', 'Screenplay', 'Story', 'Director of Photography', 'Original Music Composer', 'Editor'];
  const crew = tmdbData.credits?.crew
    ?.filter(person => crewJobs.includes(person.job))
    .slice(0, 15)
    .map(person => ({
      id: person.id,
      name: person.name,
      job: person.job,
      department: person.department,
      gender: person.gender,
      profilePath: {
        small: buildImageUrl(person.profile_path, 'profile', 'small'),
        medium: buildImageUrl(person.profile_path, 'profile', 'medium')
      }
    })) || [];
  
  // Extrai diretor(es) separadamente para fácil acesso
  const directors = crew.filter(p => p.job === 'Director').map(p => p.name);
  const writers = crew.filter(p => ['Writer', 'Screenplay', 'Story'].includes(p.job)).map(p => p.name);
  
  // === VÍDEOS (Trailers, Teasers) ===
  const videos = tmdbData.videos?.results
    ?.filter(v => ['Trailer', 'Teaser', 'Clip', 'Featurette'].includes(v.type))
    .slice(0, 5)
    .map(v => ({
      id: v.id,
      key: v.key,
      name: v.name,
      site: v.site, // YouTube, Vimeo
      type: v.type,
      official: v.official,
      language: v.iso_639_1,
      url: v.site === 'YouTube' ? `https://www.youtube.com/watch?v=${v.key}` : null
    })) || [];
  
  // === PALAVRAS-CHAVE ===
  const keywords = (tmdbData.keywords?.keywords || tmdbData.keywords?.results || [])
    .slice(0, 10)
    .map(k => ({
      id: k.id,
      name: k.name
    }));
  
  // === PRODUÇÃO ===
  const production = {
    companies: tmdbData.production_companies?.map(c => ({
      id: c.id,
      name: c.name,
      logo: buildImageUrl(c.logo_path, 'logo', 'medium'),
      country: c.origin_country
    })) || [],
    countries: tmdbData.production_countries?.map(c => ({
      code: c.iso_3166_1,
      name: c.name
    })) || [],
    budget: tmdbData.budget || null,
    revenue: tmdbData.revenue || null
  };
  
  // === COLEÇÃO/FRANQUIA ===
  const collection = tmdbData.belongs_to_collection ? {
    id: tmdbData.belongs_to_collection.id,
    name: tmdbData.belongs_to_collection.name,
    poster: buildImageUrl(tmdbData.belongs_to_collection.poster_path, 'poster', 'medium'),
    backdrop: buildImageUrl(tmdbData.belongs_to_collection.backdrop_path, 'backdrop', 'medium')
  } : null;
  
  // === RECOMENDAÇÕES ===
  const recommendations = tmdbData.recommendations?.results?.slice(0, 10).map(r => ({
    id: r.id,
    title: r.title || r.name,
    poster: buildImageUrl(r.poster_path, 'poster', 'small'),
    voteAverage: r.vote_average,
    releaseDate: r.release_date || r.first_air_date
  })) || [];
  
  // === SIMILARES ===
  const similar = tmdbData.similar?.results?.slice(0, 10).map(s => ({
    id: s.id,
    title: s.title || s.name,
    poster: buildImageUrl(s.poster_path, 'poster', 'small'),
    voteAverage: s.vote_average,
    releaseDate: s.release_date || s.first_air_date
  })) || [];
  
  // === ONDE ASSISTIR (Brasil) ===
  const watchProviders = tmdbData['watch/providers']?.results?.BR ? {
    link: tmdbData['watch/providers'].results.BR.link,
    flatrate: tmdbData['watch/providers'].results.BR.flatrate?.map(p => ({
      id: p.provider_id,
      name: p.provider_name,
      logo: buildImageUrl(p.logo_path, 'logo', 'medium')
    })) || [],
    rent: tmdbData['watch/providers'].results.BR.rent?.map(p => ({
      id: p.provider_id,
      name: p.provider_name,
      logo: buildImageUrl(p.logo_path, 'logo', 'medium')
    })) || [],
    buy: tmdbData['watch/providers'].results.BR.buy?.map(p => ({
      id: p.provider_id,
      name: p.provider_name,
      logo: buildImageUrl(p.logo_path, 'logo', 'medium')
    })) || []
  } : null;
  
  // === AVALIAÇÕES DE USUÁRIOS ===
  const reviews = tmdbData.reviews?.results?.slice(0, 3).map(r => ({
    id: r.id,
    author: r.author,
    authorDetails: {
      name: r.author_details?.name,
      username: r.author_details?.username,
      avatar: r.author_details?.avatar_path ? 
        (r.author_details.avatar_path.startsWith('/http') ? 
          r.author_details.avatar_path.substring(1) : 
          buildImageUrl(r.author_details.avatar_path, 'profile', 'small')) : null,
      rating: r.author_details?.rating
    },
    content: r.content?.substring(0, 500),
    createdAt: r.created_at,
    url: r.url
  })) || [];
  
  // === IDS EXTERNOS ===
  const externalIds = {
    imdb: tmdbData.external_ids?.imdb_id,
    facebook: tmdbData.external_ids?.facebook_id,
    instagram: tmdbData.external_ids?.instagram_id,
    twitter: tmdbData.external_ids?.twitter_id,
    wikidata: tmdbData.external_ids?.wikidata_id
  };
  
  // === CRIADORES (só para séries) ===
  const creators = isTV ? (tmdbData.created_by?.map(c => ({
    id: c.id,
    name: c.name,
    gender: c.gender,
    profilePath: buildImageUrl(c.profile_path, 'profile', 'medium')
  })) || []) : null;
  
  // === NETWORKS (só para séries) ===
  const networks = isTV ? (tmdbData.networks?.map(n => ({
    id: n.id,
    name: n.name,
    logo: buildImageUrl(n.logo_path, 'logo', 'medium'),
    country: n.origin_country
  })) || []) : null;
  
  // === MONTAGEM FINAL ===
  return {
    // Dados originais da playlist (nome e URL)
    id: originalItem.id,
    name: originalItem.name,
    url: originalItem.url,
    category: originalItem.category,
    type: originalItem.type,
    isAdult: originalItem.isAdult || false,
    
    // Dados enriquecidos do TMDB
    tmdb: {
      ...basic,
      ...temporal,
      ...ratings,
      certification,
      genres,
      images,
      cast,
      crew,
      directors,
      writers,
      ...(isTV && { creators }),
      ...(isTV && { networks }),
      videos,
      keywords,
      production,
      collection,
      recommendations,
      similar,
      watchProviders,
      reviews,
      externalIds,
      
      // Metadados
      _fetchedAt: new Date().toISOString(),
      _tmdbVersion: '3'
    }
  };
}

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

/**
 * Processa um único item
 */
async function processItem(item) {
  console.log(`  🔍 Buscando: ${item.name}`);
  
  const type = item.type === 'series' ? 'series' : 'movie';
  
  // Busca o ID no TMDB
  const searchResult = await searchTMDB(item.name, type);
  if (!searchResult) {
    console.log(`  ❌ Não encontrado no TMDB`);
    return null;
  }
  
  await sleep(DELAY_BETWEEN_REQUESTS);
  
  // Busca detalhes completos
  const fullDetails = await fetchFullDetails(searchResult.id, type);
  if (!fullDetails) {
    console.log(`  ❌ Erro ao buscar detalhes`);
    return null;
  }
  
  // Processa e formata os dados
  const enrichedData = processFullData(fullDetails, item, type);
  
  console.log(`  ✅ ${enrichedData.tmdb.title} (${enrichedData.tmdb.year}) - ${enrichedData.tmdb.voteAverage}/10`);
  
  return enrichedData;
}

/**
 * Teste com um único filme
 */
async function runTest() {
  console.log('\n🎬 MODO TESTE - Processando 1 filme\n');
  
  // Pega um filme do cinema.json para teste
  const cinemaPath = path.join(DATA_DIR, 'cinema.json');
  if (!fs.existsSync(cinemaPath)) {
    console.error('❌ Arquivo cinema.json não encontrado');
    return;
  }
  
  const movies = JSON.parse(fs.readFileSync(cinemaPath, 'utf8'));
  const testMovie = movies[0]; // Primeiro filme
  
  console.log(`📽️ Filme de teste: ${testMovie.name}\n`);
  
  const result = await processItem(testMovie);
  
  if (result) {
    // Cria diretório de saída
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Salva resultado de teste
    const outputPath = path.join(OUTPUT_DIR, 'test-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    
    console.log(`\n✅ Resultado salvo em: ${outputPath}`);
    console.log('\n📋 Estrutura do JSON:');
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Processa uma categoria completa
 */
async function processCategory(categoryFile, batchSize = BATCH_SIZE) {
  const filePath = path.join(DATA_DIR, `${categoryFile}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo ${categoryFile}.json não encontrado`);
    return;
  }
  
  console.log(`\n📁 Processando: ${categoryFile}.json\n`);
  
  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const total = items.length;
  const results = [];
  let processed = 0;
  let found = 0;
  let notFound = 0;
  
  console.log(`📊 Total de itens: ${total}`);
  console.log(`📦 Processando em lotes de: ${batchSize}\n`);
  
  // Processa em lotes
  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, Math.min(i + batchSize, total));
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(total / batchSize);
    
    console.log(`\n🔄 Lote ${batchNum}/${totalBatches} (${batch.length} itens)`);
    
    for (const item of batch) {
      const result = await processItem(item);
      
      if (result) {
        results.push(result);
        found++;
      } else {
        // Mantém item original se não encontrar
        results.push({ ...item, tmdb: null });
        notFound++;
      }
      
      processed++;
      
      // Progresso
      if (processed % 50 === 0) {
        console.log(`📈 Progresso: ${processed}/${total} (${Math.round(processed/total*100)}%)`);
      }
      
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
    
    // Salva resultado parcial após cada lote
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const outputPath = path.join(OUTPUT_DIR, `${categoryFile}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`💾 Progresso salvo: ${outputPath}`);
  }
  
  console.log(`\n✅ Processamento concluído!`);
  console.log(`📊 Encontrados: ${found}/${total}`);
  console.log(`❌ Não encontrados: ${notFound}/${total}`);
}

/**
 * Processa todas as categorias
 */
async function processAll(batchSize = BATCH_SIZE) {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'categories.json');
  
  console.log(`\n📁 Encontradas ${files.length} categorias\n`);
  
  for (const file of files) {
    const category = file.replace('.json', '');
    await processCategory(category, batchSize);
  }
}

// ============================================
// EXECUÇÃO
// ============================================

const args = process.argv.slice(2);

if (args.includes('--test')) {
  runTest();
} else if (args.some(a => a.startsWith('--category='))) {
  const categoryArg = args.find(a => a.startsWith('--category='));
  const category = categoryArg.split('=')[1];
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : BATCH_SIZE;
  processCategory(category, batchSize);
} else if (args.includes('--all')) {
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : BATCH_SIZE;
  processAll(batchSize);
} else {
  console.log(`
🎬 Script de Enriquecimento de Dados TMDB

Uso:
  node scripts/enrich-movies-tmdb.cjs --test              Testa com 1 filme
  node scripts/enrich-movies-tmdb.cjs --category=cinema   Processa categoria específica
  node scripts/enrich-movies-tmdb.cjs --all --batch=2000  Processa todas (2000 por vez)

Opções:
  --test                 Modo teste (1 filme)
  --category=NOME        Processa categoria específica
  --all                  Processa todas as categorias
  --batch=NUMERO         Tamanho do lote (padrão: 2000)
`);
}
