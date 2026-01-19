const https = require('https');
const http = require('http');
const { URL } = require('url');

// Cores para o terminal
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Função para testar se uma URL de stream está funcionando
function testStreamUrl(url, timeout = 10000) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = protocol.get(url, { 
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        // Considera funcionando se retornar 200 ou 206 (partial content para streams)
        const isWorking = res.statusCode === 200 || res.statusCode === 206 || res.statusCode === 302 || res.statusCode === 301;
        
        // Consome os dados para evitar memory leak
        res.on('data', () => {});
        res.on('end', () => {});
        
        resolve({
          working: isWorking,
          statusCode: res.statusCode,
          contentType: res.headers['content-type']
        });
      });
      
      req.on('error', (err) => {
        resolve({ working: false, error: err.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ working: false, error: 'Timeout' });
      });
      
      // Fechar a conexão após verificar
      setTimeout(() => {
        req.destroy();
      }, timeout + 1000);
      
    } catch (err) {
      resolve({ working: false, error: err.message });
    }
  });
}

// Parse do arquivo M3U
function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  let currentChannel = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      // Extrair nome do canal
      const match = line.match(/,\s*(.+)$/);
      if (match) {
        currentChannel = {
          name: match[1].trim(),
          logo: line.match(/tvg-logo="([^"]+)"/)?.[1] || ''
        };
      }
    } else if (line.startsWith('http') && currentChannel) {
      currentChannel.url = line;
      channels.push(currentChannel);
      currentChannel = null;
    }
  }
  
  return channels;
}

async function main() {
  const fs = require('fs');
  
  console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}        VERIFICADOR DE CANAIS - Lista BR.m3u                   ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
  
  // Ler arquivo M3U
  const m3uContent = fs.readFileSync('/tmp/BR.m3u', 'utf8');
  const channels = parseM3U(m3uContent);
  
  // Remover duplicatas baseado na URL
  const uniqueChannels = [];
  const seenUrls = new Set();
  for (const ch of channels) {
    if (!seenUrls.has(ch.url)) {
      seenUrls.add(ch.url);
      uniqueChannels.push(ch);
    }
  }
  
  console.log(`${colors.yellow}Total de canais únicos encontrados: ${uniqueChannels.length}${colors.reset}\n`);
  console.log(`${colors.cyan}Testando canais (isso pode levar alguns minutos)...${colors.reset}\n`);
  
  const working = [];
  const notWorking = [];
  
  // Testar canais em lotes de 5 para não sobrecarregar
  const batchSize = 5;
  for (let i = 0; i < uniqueChannels.length; i += batchSize) {
    const batch = uniqueChannels.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map(async (channel) => {
        const result = await testStreamUrl(channel.url);
        return { channel, result };
      })
    );
    
    for (const { channel, result } of results) {
      const status = result.working ? 
        `${colors.green}✓ ONLINE${colors.reset}` : 
        `${colors.red}✗ OFFLINE${colors.reset}`;
      
      const detail = result.working ? 
        `(${result.statusCode})` : 
        `(${result.error || result.statusCode || 'erro'})`;
      
      console.log(`${status} ${channel.name} ${colors.yellow}${detail}${colors.reset}`);
      
      if (result.working) {
        working.push(channel);
      } else {
        notWorking.push({ channel, error: result.error || result.statusCode });
      }
    }
  }
  
  // Resumo
  console.log(`\n${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}                         RESUMO                                ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
  
  console.log(`${colors.green}${colors.bold}CANAIS FUNCIONANDO: ${working.length}/${uniqueChannels.length}${colors.reset}\n`);
  
  if (working.length > 0) {
    console.log(`${colors.green}Lista de canais funcionando:${colors.reset}`);
    working.forEach((ch, idx) => {
      console.log(`  ${idx + 1}. ${ch.name}`);
    });
  }
  
  console.log(`\n${colors.red}${colors.bold}CANAIS OFFLINE: ${notWorking.length}/${uniqueChannels.length}${colors.reset}\n`);
  
  // Salvar resultado em arquivo JSON
  const result = {
    testedAt: new Date().toISOString(),
    total: uniqueChannels.length,
    working: working.length,
    notWorking: notWorking.length,
    workingChannels: working.map(ch => ({
      name: ch.name,
      url: ch.url,
      logo: ch.logo
    })),
    offlineChannels: notWorking.map(({ channel, error }) => ({
      name: channel.name,
      url: channel.url,
      error
    }))
  };
  
  fs.writeFileSync('/tmp/br-channels-result.json', JSON.stringify(result, null, 2));
  console.log(`\n${colors.cyan}Resultado salvo em: /tmp/br-channels-result.json${colors.reset}`);
}

main().catch(console.error);
