const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Configurações
const TIMEOUT = 10000; // 10 segundos de timeout
const CONCURRENT_REQUESTS = 20; // Número de requisições simultâneas
const FILE_PATH = path.join(__dirname, '../public/data/enriched/acao.json');

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Função para testar uma URL
function testUrl(url, name) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const req = protocol.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'HEAD',
          timeout: TIMEOUT,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        },
        (res) => {
          const responseTime = Date.now() - startTime;
          const statusCode = res.statusCode;
          
          // Considera sucesso: 200, 206 (partial content), 302/301 (redirect)
          const isWorking = statusCode >= 200 && statusCode < 400;
          
          resolve({
            name,
            url,
            working: isWorking,
            statusCode,
            responseTime,
            error: null,
          });
        }
      );
      
      req.on('error', (error) => {
        resolve({
          name,
          url,
          working: false,
          statusCode: null,
          responseTime: Date.now() - startTime,
          error: error.message,
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          name,
          url,
          working: false,
          statusCode: null,
          responseTime: TIMEOUT,
          error: 'Timeout',
        });
      });
      
      req.end();
    } catch (error) {
      resolve({
        name,
        url,
        working: false,
        statusCode: null,
        responseTime: 0,
        error: error.message,
      });
    }
  });
}

// Processa em lotes para não sobrecarregar
async function processInBatches(items, batchSize) {
  const results = [];
  const total = items.length;
  let processed = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => testUrl(item.url, item.name))
    );
    results.push(...batchResults);
    
    processed += batch.length;
    const percentage = ((processed / total) * 100).toFixed(1);
    const working = results.filter(r => r.working).length;
    const notWorking = results.filter(r => !r.working).length;
    
    process.stdout.write(
      `\r${colors.cyan}Progresso: ${processed}/${total} (${percentage}%)${colors.reset} | ` +
      `${colors.green}✓ ${working}${colors.reset} | ` +
      `${colors.red}✗ ${notWorking}${colors.reset}`
    );
  }
  
  console.log('\n');
  return results;
}

// Função principal
async function main() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}   TESTADOR DE CANAIS/FILMES${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  // Carrega o arquivo JSON
  console.log(`${colors.yellow}Carregando arquivo...${colors.reset}`);
  
  let data;
  try {
    const fileContent = fs.readFileSync(FILE_PATH, 'utf8');
    data = JSON.parse(fileContent);
  } catch (error) {
    console.error(`${colors.red}Erro ao carregar arquivo: ${error.message}${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.green}Arquivo carregado! Total de itens: ${data.length}${colors.reset}\n`);
  
  // Extrai URLs para teste
  const itemsToTest = data.map((item) => ({
    name: item.name,
    url: item.url,
  }));
  
  console.log(`${colors.yellow}Iniciando testes com ${CONCURRENT_REQUESTS} requisições simultâneas...${colors.reset}\n`);
  
  const startTime = Date.now();
  const results = await processInBatches(itemsToTest, CONCURRENT_REQUESTS);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Estatísticas
  const working = results.filter((r) => r.working);
  const notWorking = results.filter((r) => !r.working);
  
  // Agrupa erros por tipo
  const errorTypes = {};
  notWorking.forEach((r) => {
    const errorKey = r.error || `Status ${r.statusCode}`;
    if (!errorTypes[errorKey]) {
      errorTypes[errorKey] = 0;
    }
    errorTypes[errorKey]++;
  });
  
  // Relatório
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}   RELATÓRIO FINAL${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  console.log(`${colors.cyan}Total de itens testados: ${results.length}${colors.reset}`);
  console.log(`${colors.green}✓ Funcionando: ${working.length} (${((working.length / results.length) * 100).toFixed(1)}%)${colors.reset}`);
  console.log(`${colors.red}✗ Não funcionando: ${notWorking.length} (${((notWorking.length / results.length) * 100).toFixed(1)}%)${colors.reset}`);
  console.log(`${colors.yellow}Tempo total: ${totalTime} segundos${colors.reset}\n`);
  
  // Detalhes dos erros
  if (Object.keys(errorTypes).length > 0) {
    console.log(`${colors.yellow}Tipos de erros encontrados:${colors.reset}`);
    Object.entries(errorTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([error, count]) => {
        console.log(`  - ${error}: ${count}`);
      });
    console.log('');
  }
  
  // Tempo médio de resposta dos que funcionam
  if (working.length > 0) {
    const avgResponseTime = (
      working.reduce((sum, r) => sum + r.responseTime, 0) / working.length
    ).toFixed(0);
    console.log(`${colors.cyan}Tempo médio de resposta (funcionando): ${avgResponseTime}ms${colors.reset}\n`);
  }
  
  // Salva relatório em arquivo
  const report = {
    timestamp: new Date().toISOString(),
    totalItems: results.length,
    working: working.length,
    notWorking: notWorking.length,
    workingPercentage: ((working.length / results.length) * 100).toFixed(1),
    totalTimeSeconds: parseFloat(totalTime),
    errorTypes,
    workingItems: working.map(r => ({ name: r.name, url: r.url, responseTime: r.responseTime })),
    notWorkingItems: notWorking.map(r => ({ name: r.name, url: r.url, error: r.error || `Status ${r.statusCode}` })),
  };
  
  const reportPath = path.join(__dirname, '../public/data/enriched/test-report-acao.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`${colors.green}Relatório salvo em: ${reportPath}${colors.reset}`);
  
  // Lista os 10 primeiros que não funcionam (para debug)
  if (notWorking.length > 0) {
    console.log(`\n${colors.yellow}Primeiros 10 itens que não funcionam:${colors.reset}`);
    notWorking.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name}`);
      console.log(`     URL: ${r.url}`);
      console.log(`     Erro: ${r.error || `Status ${r.statusCode}`}`);
    });
  }
}

main().catch(console.error);
