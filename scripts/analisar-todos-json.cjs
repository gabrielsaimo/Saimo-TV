const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENRICHED_DIR = './public/data/enriched';

// Ler lista de arquivos
const jsonFiles = fs.readdirSync(ENRICHED_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║          ANALISE COMPLETA DE TODOS OS JSON FILES              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log(`Total de arquivos JSON encontrados: ${jsonFiles.length}\n`);
console.log('Carregando M3U...');

// Ler o M3U file uma vez
const m3uLines = fs.readFileSync('./public/data/CanaisBR06.m3u', 'utf8')
  .split('\n');

console.log(`✓ M3U carregado (${m3uLines.length} linhas)\n`);

console.log('═'.repeat(66));
console.log('PROCESSANDO ARQUIVOS');
console.log('═'.repeat(66) + '\n');

let totalGeral = 0;
let encontradosGeral = 0;
let naoEncontradosGeral = 0;
const resultados = [];

jsonFiles.forEach((arquivo, indiceArquivo) => {
  const nomeArquivo = arquivo.replace('.json', '');
  const caminhoCompleto = path.join(ENRICHED_DIR, arquivo);
  
  try {
    const dados = JSON.parse(fs.readFileSync(caminhoCompleto, 'utf8'));
    
    if (!Array.isArray(dados)) {
      console.log(`[${indiceArquivo + 1}/${jsonFiles.length}] ⊘ ${nomeArquivo.padEnd(40)} - NAO eh array\n`);
      return;
    }

    let encontrados = 0;
    let naoEncontrados = 0;
    const filmesSemMatch = [];

    dados.forEach(item => {
      if (!item.name) return;
      
      const normalized = item.name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(\d{4}\)/g, '')
        .replace(/[^a-z0-9]+/g, '');

      const encontrou = m3uLines.some(line => {
        if (!line.includes('tvg-name=')) return false;
        const nameMatch = line.match(/tvg-name="([^"]+)"/);
        if (!nameMatch) return false;
        
        const m3uName = nameMatch[1];
        const m3uNormalized = m3uName.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/\(\d{4}\)/g, '')
          .replace(/[^a-z0-9]+/g, '');
        
        return m3uNormalized === normalized;
      });

      if (encontrou) {
        encontrados++;
      } else {
        naoEncontrados++;
        filmesSemMatch.push(item.name);
      }
    });

    totalGeral += dados.length;
    encontradosGeral += encontrados;
    naoEncontradosGeral += naoEncontrados;

    const percentual = dados.length > 0 ? Math.round((encontrados / dados.length) * 100) : 0;
    const status = percentual === 100 ? '✓' : percentual >= 80 ? '~' : '✗';
    
    console.log(`[${indiceArquivo + 1}/${jsonFiles.length}] ${status} ${nomeArquivo.padEnd(40)} ${encontrados}/${dados.length} (${percentual.toString().padStart(3)}%)`);

    if (filmesSemMatch.length > 0 && filmesSemMatch.length <= 5) {
      filmesSemMatch.forEach(filme => {
        console.log(`         └─ ${filme}`);
      });
    }
    if (filmesSemMatch.length > 5) {
      console.log(`         └─ ... e mais ${filmesSemMatch.length - 5}`);
    }

    console.log('');

    resultados.push({
      arquivo: nomeArquivo,
      total: dados.length,
      encontrados,
      naoEncontrados,
      percentual,
      filmesSemMatch
    });

  } catch (err) {
    console.log(`[${indiceArquivo + 1}/${jsonFiles.length}] ✗ ${nomeArquivo.padEnd(40)} - ERRO: ${err.message}\n`);
  }
});

console.log('═'.repeat(66));
console.log('RESUMO FINAL');
console.log('═'.repeat(66) + '\n');

console.log(`Total geral de items: ${totalGeral}`);
console.log(`Encontrados no M3U:   ${encontradosGeral} (${Math.round((encontradosGeral/totalGeral)*100)}%)`);
console.log(`NAO encontrados:      ${naoEncontradosGeral} (${Math.round((naoEncontradosGeral/totalGeral)*100)}%)\n`);

console.log('RANKING (Menor taxa de sucesso):');
console.log('');
resultados
  .sort((a, b) => a.percentual - b.percentual)
  .slice(0, 10)
  .forEach((r, i) => {
    const barraLength = 30;
    const preenchido = Math.round((r.percentual / 100) * barraLength);
    const barra = '█'.repeat(preenchido) + '░'.repeat(barraLength - preenchido);
    console.log(`${(i+1).toString().padStart(2)}. ${r.arquivo.padEnd(30)} [${barra}] ${r.percentual}% (${r.encontrados}/${r.total})`);
  });

console.log('\n');
