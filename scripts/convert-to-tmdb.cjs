/**
 * Script para converter URLs de gstaticontent para TMDB original
 * e verificar/corrigir URLs quebradas
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = path.join(__dirname, '../public/data');

// Função para verificar se URL funciona
function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    }, (res) => {
      const contentType = res.headers['content-type'] || '';
      resolve({
        status: res.statusCode,
        isImage: contentType.startsWith('image/'),
        works: res.statusCode === 200 && contentType.startsWith('image/')
      });
      res.destroy();
    });
    req.on('error', () => resolve({ works: false }));
    req.on('timeout', () => { req.destroy(); resolve({ works: false }); });
  });
}

// Converte URL gstaticontent para TMDB
function convertToTmdb(url) {
  if (!url) return null;
  
  // Já é TMDB
  if (url.includes('image.tmdb.org')) return url;
  
  // Extrai o path TMDB de URLs gstaticontent
  // Ex: http://file.gstaticontent.com//t/p/w600_and_h900_bestv2/uK5drCpVQ5H0RojWAQdsT6BYUS2.jpg
  // Ex: http://gstaticontent.com/images/hash.jpg (não tem path TMDB)
  
  const patterns = [
    // file.gstaticontent.com com path TMDB
    /file\.gstaticontent\.com\/+t\/p\/[^\/]+\/([^\/]+\.(?:jpg|png|webp))/i,
    // Qualquer URL com /t/p/ (formato TMDB)
    /\/t\/p\/[^\/]+\/([^\/]+\.(?:jpg|png|webp))/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const imagePath = match[1];
      return `https://image.tmdb.org/t/p/w500/${imagePath}`;
    }
  }
  
  return null;
}

// Processa um arquivo e converte URLs
async function processFile(filePath, dryRun = false) {
  const fileName = path.basename(filePath);
  if (fileName === 'categories.json') return { converted: 0, fixed: 0, total: 0 };
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    if (!Array.isArray(data)) return { converted: 0, fixed: 0, total: 0 };
    
    let converted = 0;
    let fixed = 0;
    const total = data.length;
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const logoUrl = item.logo || item.cover || item.image;
      
      if (!logoUrl) continue;
      
      // Se já é TMDB, pula
      if (logoUrl.includes('image.tmdb.org')) continue;
      
      // Tenta converter para TMDB
      const tmdbUrl = convertToTmdb(logoUrl);
      
      if (tmdbUrl) {
        // Verifica se a URL TMDB funciona
        const check = await checkUrl(tmdbUrl);
        
        if (check.works) {
          // Atualiza a URL
          if ('logo' in item) item.logo = tmdbUrl;
          else if ('cover' in item) item.cover = tmdbUrl;
          else if ('image' in item) item.image = tmdbUrl;
          
          converted++;
          
          if (converted <= 5) {
            const title = (item.name || item.title || '').substring(0, 30);
            console.log(`  ✅ ${title.padEnd(30)} → TMDB`);
          }
        }
      }
    }
    
    if (converted > 5) {
      console.log(`  ... e mais ${converted - 5} conversões`);
    }
    
    // Salva se houve mudanças e não é dry run
    if (converted > 0 && !dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    return { converted, fixed, total };
    
  } catch (e) {
    console.error(`  ❌ Erro: ${e.message}`);
    return { converted: 0, fixed: 0, total: 0 };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        🔄 CONVERSOR DE URLs PARA TMDB ORIGINAL                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const testOnly = args.includes('--test');
  
  if (dryRun) console.log('🔍 MODO DRY-RUN: Não salvará alterações\n');
  
  let files;
  const fileArgs = args.filter(a => !a.startsWith('--'));
  
  if (testOnly || fileArgs.length === 0) {
    // Por padrão, testa com apple-tv.json
    files = ['apple-tv.json'].map(f => path.join(DATA_DIR, f)).filter(f => fs.existsSync(f));
  } else {
    files = fileArgs.map(f => {
      if (f.endsWith('.json')) return path.join(DATA_DIR, f);
      return path.join(DATA_DIR, `${f}.json`);
    }).filter(f => fs.existsSync(f));
  }
  
  console.log(`📁 Arquivos: ${files.length}\n`);
  
  let totalConverted = 0;
  let totalProcessed = 0;
  
  for (const file of files) {
    const fileName = path.basename(file);
    console.log(`\n📄 ${fileName}`);
    
    const result = await processFile(file, dryRun);
    totalConverted += result.converted;
    totalProcessed += result.total;
    
    console.log(`   📊 ${result.converted}/${result.total} convertidos`);
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log(`\n✅ CONCLUÍDO!`);
  console.log(`   📊 Total: ${totalConverted}/${totalProcessed} URLs convertidas para TMDB`);
  
  if (dryRun) {
    console.log('\n⚠️  Execute sem --dry-run para salvar as alterações');
  }
}

main().catch(console.error);
