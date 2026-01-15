#!/usr/bin/env node
/**
 * Script para corrigir o MovieCatalog.tsx - remove categoryTypeInfo
 * e usa propriedades diretas do categoryIndex
 */

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'src', 'components', 'MovieCatalog.tsx');

console.log('📝 Lendo MovieCatalog.tsx...');
let content = fs.readFileSync(FILE_PATH, 'utf-8');

// 1. Remove a declaração do state categoryTypeInfo
console.log('🔧 Removendo declaração do state categoryTypeInfo...');
content = content.replace(
  /\s*const \[categoryTypeInfo, setCategoryTypeInfo\] = useState<Map<string, \{ hasMovies: boolean; hasSeries: boolean \}>>\(new Map\(\)\);/g,
  ''
);

// 2. Atualiza getCategoryType para usar categoryIndex diretamente
console.log('🔧 Atualizando função getCategoryType...');
content = content.replace(
  /\/\/ Obter tipo predominante de uma categoria para colorir\s*\n\s*const getCategoryType = useCallback\(\(catName: string\): 'movies' \| 'series' \| 'mixed' \| 'unknown' => \{\s*\n\s*const typeInfo = categoryTypeInfo\.get\(catName\);\s*\n\s*if \(!typeInfo\) return 'unknown';\s*\n\s*if \(typeInfo\.hasMovies && typeInfo\.hasSeries\) return 'mixed';\s*\n\s*if \(typeInfo\.hasMovies\) return 'movies';\s*\n\s*if \(typeInfo\.hasSeries\) return 'series';\s*\n\s*return 'unknown';\s*\n\s*\}, \[categoryTypeInfo\]\);/g,
  `// Obter tipo predominante de uma categoria para colorir
  // Agora usa diretamente as propriedades do categoryIndex
  const getCategoryType = useCallback((catName: string): 'movies' | 'series' | 'mixed' | 'unknown' => {
    const catInfo = availableCategoryIndex.find(c => c.name === catName);
    if (!catInfo) return 'unknown';
    if (catInfo.hasMovies && catInfo.hasSeries) return 'mixed';
    if (catInfo.hasMovies) return 'movies';
    if (catInfo.hasSeries) return 'series';
    return 'unknown';
  }, [availableCategoryIndex]);`
);

// 3. Remove o useEffect de pré-carregamento de tipos
console.log('🔧 Removendo useEffect de pré-carregamento...');
content = content.replace(
  /\/\/ Pré-carrega informações de tipo para categorias visíveis\s*\n\s*useEffect\(\(\) => \{\s*\n\s*const loadCategoryTypes = async \(\) => \{\s*\n\s*const categoriesToCheck = availableCategoryIndex\.slice\(0, Math\.min\(visibleCategories \+ 5, availableCategoryIndex\.length\)\);\s*\n\s*for \(const cat of categoriesToCheck\) \{\s*\n\s*if \(!categoryTypeInfo\.has\(cat\.name\)\) \{\s*\n\s*const movies = await loadCategory\(cat\.name\);\s*\n\s*const hasMovies = movies\.some\(m => m\.type === 'movie'\);\s*\n\s*const hasSeries = movies\.some\(m => m\.type === 'series'\);\s*\n\s*setCategoryTypeInfo\(prev => \{\s*\n\s*const newMap = new Map\(prev\);\s*\n\s*newMap\.set\(cat\.name, \{ hasMovies, hasSeries \}\);\s*\n\s*return newMap;\s*\n\s*\}\);\s*\n\s*\}\s*\n\s*\}\s*\n\s*\};\s*\n\s*loadCategoryTypes\(\);\s*\n\s*\}, \[availableCategoryIndex, visibleCategories, categoryTypeInfo\]\);/g,
  ''
);

// 4. Atualiza filteredCategoryIndex para usar hasMovies/hasSeries direto
console.log('🔧 Atualizando filteredCategoryIndex...');
content = content.replace(
  /\/\/ Categorias filtradas por tipo de conteúdo selecionado\s*\n\s*const filteredCategoryIndex = useMemo\(\(\) => \{\s*\n\s*if \(contentFilter === 'all'\) return availableCategoryIndex;\s*\n\s*\n\s*return availableCategoryIndex\.filter\(cat => \{\s*\n\s*const typeInfo = categoryTypeInfo\.get\(cat\.name\);\s*\n\s*if \(!typeInfo\) return true; \/\/ Mostra se ainda não carregou info\s*\n\s*\n\s*if \(contentFilter === 'movies'\) return typeInfo\.hasMovies;\s*\n\s*if \(contentFilter === 'series'\) return typeInfo\.hasSeries;\s*\n\s*return true;\s*\n\s*\}\);\s*\n\s*\}, \[availableCategoryIndex, contentFilter, categoryTypeInfo\]\);/g,
  `// Categorias filtradas por tipo de conteúdo selecionado
  // Agora usa as propriedades hasMovies/hasSeries diretamente do categoryIndex
  const filteredCategoryIndex = useMemo(() => {
    if (contentFilter === 'all') return availableCategoryIndex;
    
    return availableCategoryIndex.filter(cat => {
      // Usa as propriedades diretamente do índice (pré-calculadas)
      if (contentFilter === 'movies') return cat.hasMovies;
      if (contentFilter === 'series') return cat.hasSeries;
      return true;
    });
  }, [availableCategoryIndex, contentFilter]);`
);

// 5. Remove setCategoryTypeInfo do useEffect de carregamento de categoria
console.log('🔧 Limpando useEffect de carregamento...');
content = content.replace(
  /\/\/ Analisa tipos de conteúdo na categoria\s*\n\s*const hasMovies = movies\.some\(m => m\.type === 'movie'\);\s*\n\s*const hasSeries = movies\.some\(m => m\.type === 'series'\);\s*\n\s*setCategoryTypeInfo\(prev => \{\s*\n\s*const newMap = new Map\(prev\);\s*\n\s*newMap\.set\(selectedCategory, \{ hasMovies, hasSeries \}\);\s*\n\s*return newMap;\s*\n\s*\}\);/g,
  ''
);

// Salva o arquivo
fs.writeFileSync(FILE_PATH, content, 'utf-8');

// Verifica resultado
const remaining = (content.match(/categoryTypeInfo/g) || []).length;
if (remaining === 0) {
  console.log('\n✅ Todas as referências a categoryTypeInfo foram removidas!');
} else {
  console.log(`\n⚠️  Ainda restam ${remaining} referências a categoryTypeInfo`);
}

console.log('✨ Arquivo atualizado!');
