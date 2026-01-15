#!/usr/bin/env node
/**
 * Script para adicionar informações de tipo (hasMovies, hasSeries) 
 * ao índice de categorias no movies.ts
 * 
 * Isso permite filtrar categorias por tipo sem precisar carregar os dados
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const MOVIES_TS = path.join(__dirname, '..', 'src', 'data', 'movies.ts');

console.log('🔍 Analisando tipos de conteúdo em cada categoria...\n');

// Lê todos os arquivos JSON e analisa tipos
const categoryTypeInfo = new Map();
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'categories.json');

let totalCategories = 0;
let categoriesWithBoth = 0;
let categoriesOnlyMovies = 0;
let categoriesOnlySeries = 0;

for (const file of files) {
  const filePath = path.join(DATA_DIR, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const items = JSON.parse(content);
    
    if (!Array.isArray(items) || items.length === 0) continue;
    
    // Pega o nome da categoria do primeiro item
    const categoryName = items[0].category;
    
    // Analisa tipos
    const hasMovies = items.some(item => item.type === 'movie');
    const hasSeries = items.some(item => item.type === 'series');
    
    categoryTypeInfo.set(categoryName, { hasMovies, hasSeries, file });
    totalCategories++;
    
    if (hasMovies && hasSeries) categoriesWithBoth++;
    else if (hasMovies) categoriesOnlyMovies++;
    else if (hasSeries) categoriesOnlySeries++;
    
    const icon = hasMovies && hasSeries ? '🎬📺' : hasMovies ? '🎬' : '📺';
    console.log(`  ${icon} ${categoryName}`);
    
  } catch (e) {
    console.log(`  ⚠️  Erro ao processar ${file}: ${e.message}`);
  }
}

console.log('\n📊 ESTATÍSTICAS:');
console.log(`   Total de categorias: ${totalCategories}`);
console.log(`   Só filmes: ${categoriesOnlyMovies}`);
console.log(`   Só séries: ${categoriesOnlySeries}`);
console.log(`   Ambos: ${categoriesWithBoth}`);

// Lê o arquivo movies.ts
console.log('\n📝 Atualizando movies.ts...');
let moviesContent = fs.readFileSync(MOVIES_TS, 'utf-8');

// Atualiza a interface CategoryIndex
const oldInterface = `export interface CategoryIndex {
  name: string;
  file: string;
  count: number;
  isAdult: boolean;
}`;

const newInterface = `export interface CategoryIndex {
  name: string;
  file: string;
  count: number;
  isAdult: boolean;
  hasMovies: boolean;
  hasSeries: boolean;
}`;

if (moviesContent.includes(oldInterface)) {
  moviesContent = moviesContent.replace(oldInterface, newInterface);
  console.log('   ✅ Interface CategoryIndex atualizada');
} else if (!moviesContent.includes('hasMovies: boolean;')) {
  // Tentar outra forma de atualizar
  moviesContent = moviesContent.replace(
    /export interface CategoryIndex \{[\s\S]*?isAdult: boolean;\s*\}/,
    newInterface
  );
  console.log('   ✅ Interface CategoryIndex atualizada (regex)');
} else {
  console.log('   ℹ️  Interface já contém hasMovies/hasSeries');
}

// Atualiza cada entrada no categoryIndex
let updatedCount = 0;
for (const [categoryName, info] of categoryTypeInfo) {
  // Padrão para encontrar a entrada da categoria
  // Formato: {"name": "🎬 Categoria", "file": "arquivo.json", "count": 123, "isAdult": false}
  const escapedName = categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Procura por entradas que ainda não têm hasMovies
  const patterns = [
    // Formato com "isAdult": false} no final (sem hasMovies ainda)
    new RegExp(
      `(\\{[\\s\\n]*"name":\\s*"${escapedName}"[\\s\\S]*?"isAdult":\\s*(true|false))\\s*\\}`,
      'g'
    )
  ];
  
  for (const pattern of patterns) {
    const matches = moviesContent.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Só atualiza se ainda não tem hasMovies
        if (!match.includes('hasMovies')) {
          const replacement = match.slice(0, -1) + `,\n    "hasMovies": ${info.hasMovies},\n    "hasSeries": ${info.hasSeries}\n  }`;
          moviesContent = moviesContent.replace(match, replacement);
          updatedCount++;
        }
      }
    }
  }
}

console.log(`   ✅ ${updatedCount} categorias atualizadas com informações de tipo`);

// Salva o arquivo
fs.writeFileSync(MOVIES_TS, moviesContent, 'utf-8');
console.log('\n✨ Arquivo movies.ts atualizado com sucesso!');
