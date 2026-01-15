/**
 * Script de teste para buscar imagens das plataformas originais
 * Testando diferentes APIs e métodos
 */

const https = require('https');
const http = require('http');

// Função para fazer fetch
function fetch(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// APIs alternativas para tentar
const APIS = {
  // OMDB API (gratuita, mas limitada)
  omdb: async (title) => {
    try {
      const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=trilogy`;
      const res = await fetch(url);
      const data = JSON.parse(res.data);
      if (data.Poster && data.Poster !== 'N/A') {
        return { success: true, image: data.Poster, source: 'OMDB' };
      }
      return { success: false, error: 'Sem poster' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // iTunes Search API (Apple)
  itunes: async (title) => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=tvShow&limit=1`;
      const res = await fetch(url);
      const data = JSON.parse(res.data);
      if (data.results && data.results[0] && data.results[0].artworkUrl100) {
        // Melhora a qualidade da imagem
        const image = data.results[0].artworkUrl100.replace('100x100', '600x600');
        return { success: true, image, source: 'iTunes/Apple' };
      }
      return { success: false, error: 'Sem resultado' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // TVMaze API (gratuita)
  tvmaze: async (title) => {
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`;
      const res = await fetch(url);
      if (res.status === 200) {
        const data = JSON.parse(res.data);
        if (data.image && data.image.original) {
          return { success: true, image: data.image.original, source: 'TVMaze' };
        }
      }
      return { success: false, error: 'Sem resultado' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Fanart.tv (precisa de API key, mas tem uma pública)
  fanart: async (title) => {
    try {
      // Primeiro busca o ID no TMDB
      const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=6a9cd46770a9adee6ee6bb7e69154aaa&query=${encodeURIComponent(title)}`;
      const searchRes = await fetch(searchUrl);
      const searchData = JSON.parse(searchRes.data);
      
      if (searchData.results && searchData.results[0]) {
        const tmdbId = searchData.results[0].id;
        // Agora busca no fanart.tv
        const fanartUrl = `http://webservice.fanart.tv/v3/tv/${tmdbId}?api_key=4b1e82597513e3fd6524bf3a79c9e98e`;
        const fanartRes = await fetch(fanartUrl);
        const fanartData = JSON.parse(fanartRes.data);
        
        if (fanartData.tvposter && fanartData.tvposter[0]) {
          return { success: true, image: fanartData.tvposter[0].url, source: 'Fanart.tv' };
        }
      }
      return { success: false, error: 'Sem resultado' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // TMDB (a mais confiável)
  tmdb: async (title) => {
    try {
      const url = `https://api.themoviedb.org/3/search/multi?api_key=6a9cd46770a9adee6ee6bb7e69154aaa&language=pt-BR&query=${encodeURIComponent(title)}`;
      const res = await fetch(url);
      const data = JSON.parse(res.data);
      
      if (data.results && data.results[0] && data.results[0].poster_path) {
        const image = `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`;
        return { success: true, image, source: 'TMDB' };
      }
      return { success: false, error: 'Sem resultado' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

// Séries de teste de diferentes categorias
const TEST_SERIES = [
  { name: 'Ted Lasso', category: 'Apple TV+' },
  { name: 'Severance', category: 'Apple TV+' },
  { name: 'The Morning Show', category: 'Apple TV+' },
  { name: 'Stranger Things', category: 'Netflix' },
  { name: 'The Witcher', category: 'Netflix' },
  { name: 'The Mandalorian', category: 'Disney+' },
  { name: 'House of the Dragon', category: 'Max' },
  { name: 'The Last of Us', category: 'Max' },
  { name: 'Reacher', category: 'Prime Video' },
  { name: 'The Boys', category: 'Prime Video' },
];

async function runTests() {
  console.log('🔍 TESTANDO APIs DE IMAGENS\n');
  console.log('='.repeat(80));
  
  for (const series of TEST_SERIES) {
    console.log(`\n📺 ${series.name} (${series.category})`);
    console.log('-'.repeat(60));
    
    for (const [apiName, apiFn] of Object.entries(APIS)) {
      const result = await apiFn(series.name);
      
      if (result.success) {
        console.log(`  ✅ ${apiName.toUpperCase().padEnd(8)} → ${result.image.substring(0, 60)}...`);
      } else {
        console.log(`  ❌ ${apiName.toUpperCase().padEnd(8)} → ${result.error}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESUMO:');
  console.log('   - TMDB: Mais completo e confiável');
  console.log('   - TVMaze: Bom para séries de TV');
  console.log('   - iTunes: Bom para conteúdo Apple TV+');
  console.log('   - OMDB: Limitado mas funciona');
  console.log('   - Fanart.tv: Imagens de alta qualidade');
}

runTests().catch(console.error);
