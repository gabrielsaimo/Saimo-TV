/**
 * Teste REAL das URLs de imagem - verifica se funcionam de verdade
 */

const https = require('https');
const http = require('http');

// Função para verificar se URL de imagem funciona
function checkImageUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    }, (res) => {
      const contentType = res.headers['content-type'] || '';
      const isImage = contentType.startsWith('image/');
      const isOk = res.statusCode >= 200 && res.statusCode < 400;
      
      resolve({
        url: url.substring(0, 80),
        status: res.statusCode,
        contentType,
        isImage,
        works: isOk && isImage
      });
      
      res.destroy(); // Não precisa baixar o conteúdo todo
    });
    req.on('error', (e) => resolve({ url, status: 'ERROR', error: e.message, works: false }));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ url, status: 'TIMEOUT', works: false });
    });
  });
}

// URLs que o teste anterior retornou
const URLS_TO_TEST = [
  // OMDB
  'https://m.media-amazon.com/images/M/MV5BZmI3YWVhM2UtNDZjMC00ZjQ4LWJiYWQtMjQ1NDE0NjU4NjMxXkEyXkFqcGc@._V1_SX300.jpg',
  
  // TVMaze
  'https://static.tvmaze.com/uploads/images/original_untouched/320/800422.jpg',
  
  // iTunes
  'https://is1-ssl.mzstatic.com/image/thumb/Video6/v4/63/91/b8/6391b814-6ea2-8fa7-5cc0-7a2f0e37a8ef/Tier_SHOW-rm-APPLE_VIDEO_RM-80d57455-7bc7-4c6c-8dc9-1b2e24b7e7b6-600x600.jpg',
  
  // TMDB
  'https://image.tmdb.org/t/p/w500/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
  
  // Teste direto TMDB - Stranger Things
  'https://image.tmdb.org/t/p/w500/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg',
];

async function testUrls() {
  console.log('🔍 VERIFICANDO SE AS URLS DE IMAGEM FUNCIONAM DE VERDADE\n');
  console.log('='.repeat(100));
  
  for (const url of URLS_TO_TEST) {
    const result = await checkImageUrl(url);
    
    if (result.works) {
      console.log(`\n✅ FUNCIONA`);
    } else {
      console.log(`\n❌ NÃO FUNCIONA`);
    }
    console.log(`   URL: ${result.url}...`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Content-Type: ${result.contentType || 'N/A'}`);
  }
  
  console.log('\n' + '='.repeat(100));
  
  // Agora vamos testar buscas diretas nas APIs
  console.log('\n\n🔎 TESTANDO BUSCA DIRETA NA API TMDB\n');
  
  const series = ['Stranger Things', 'The Boys', 'Ted Lasso', 'Severance'];
  
  for (const title of series) {
    console.log(`\n📺 Buscando: ${title}`);
    
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=6a9cd46770a9adee6ee6bb7e69154aaa&language=pt-BR&query=${encodeURIComponent(title)}`;
      
      const searchResult = await new Promise((resolve, reject) => {
        https.get(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
      });
      
      console.log(`   Status HTTP: ${searchResult.status}`);
      
      const json = JSON.parse(searchResult.data);
      
      if (json.results && json.results.length > 0) {
        const first = json.results[0];
        console.log(`   Nome: ${first.name || first.title}`);
        console.log(`   Poster: ${first.poster_path || 'NENHUM'}`);
        
        if (first.poster_path) {
          const imgUrl = `https://image.tmdb.org/t/p/w500${first.poster_path}`;
          const imgCheck = await checkImageUrl(imgUrl);
          console.log(`   Imagem funciona: ${imgCheck.works ? '✅ SIM' : '❌ NÃO'}`);
          console.log(`   URL completa: ${imgUrl}`);
        }
      } else {
        console.log(`   ❌ Nenhum resultado encontrado`);
        console.log(`   Resposta: ${searchResult.data.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`   ❌ Erro: ${e.message}`);
    }
  }
}

testUrls().catch(console.error);
