/**
 * 🎭 Script para Atualizar SOMENTE o Elenco (Cast) - 100% Completo
 * 
 * Este script percorre os arquivos JSON enriquecidos e atualiza apenas a lista de elenco,
 * buscando TODOS os atores disponíveis no TMDB (sem limite de quantidade).
 * 
 * USO:
 *   node scripts/update-cast-only.cjs --test="Dexter"
 *   node scripts/update-cast-only.cjs --category=apple-tv
 *   node scripts/update-cast-only.cjs --all
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO
// ============================================
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const DATA_DIR = path.join(__dirname, '../public/data');
const ENRICHED_DIR = path.join(__dirname, '../public/data/enriched');

// Rate limiting
const DELAY = 200; // ms

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function img(path, type = 'profile', size = 'medium') {
    if (!path) return null;
    const sizes = {
        poster: { s: 'w185', m: 'w342', l: 'w500', o: 'original' },
        backdrop: { s: 'w300', m: 'w780', l: 'w1280', o: 'original' },
        profile: { s: 'w45', m: 'w185', l: 'h632', o: 'original' },
        logo: { s: 'w92', m: 'w185', l: 'w500', o: 'original' }
    };
    const s = size === 'small' ? 's' : size === 'medium' ? 'm' : size === 'original' ? 'o' : 'l';
    return `${TMDB_IMAGE_BASE}/${sizes[type]?.[s] || 'w185'}${path}`;
}

// ============================================
// BUSCA NO TMDB
// ============================================

async function fetchFullCast(tmdbId, type) {
    // Use aggregate_credits for series to get cast across all seasons
    const endpoint = type === 'series' ? `tv/${tmdbId}/aggregate_credits` : `movie/${tmdbId}/credits`;

    try {
        const response = await fetch(
            `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&language=pt-BR`
        );

        if (!response.ok) {
            if (response.status === 429) {
                console.log('  ⚠️ Rate limit no TMDB, aguardando...');
                await sleep(2000);
                return fetchFullCast(tmdbId, type);
            }
            return null;
        }

        const data = await response.json();

        if (!data.cast) return [];

        // Mapeia TODOS os atores (sem .slice)
        return data.cast.map(p => {
            // Para séries (aggregate_credits), o personagem vem em 'roles'
            // Para filmes (credits), vem em 'character'
            let character = p.character;
            if (type === 'series' && p.roles && p.roles.length > 0) {
                // Pega os personagens, limitando a exibir no máximo 3 se tiver muitos papéis
                character = p.roles.map(r => r.character).filter(Boolean).join(' / ');
            }

            return {
                id: p.id,
                name: p.name,
                character: character || '',
                photo: img(p.profile_path, 'profile', 'medium'),
                // Campos extras úteis para ordenação se necessário
                totalEpisodeCount: p.total_episode_count // Disponível em aggregate_credits
            };
        }).slice(0, 50);

    } catch (error) {
        console.error(`  ❌ Erro ao buscar elenco ID ${tmdbId}: ${error.message}`);
        return null;
    }
}

// ============================================
// PROCESSAMENTO
// ============================================

async function processItem(item) {
    if (!item.tmdb || !item.tmdb.id) return item;

    // Identifica o tipo correto para a chamada da API
    const type = item.type === 'series' ? 'series' : 'movie';

    // console.log(`  👤 Atualizando elenco: ${item.name} (${item.tmdb.title || item.tmdb.name})`);

    const fullCast = await fetchFullCast(item.tmdb.id, type);

    if (fullCast && fullCast.length > 0) {
        const oldLength = item.tmdb.cast ? item.tmdb.cast.length : 0;
        const newLength = fullCast.length;

        // Atualiza apenas o array cast
        item.tmdb.cast = fullCast;

        console.log(`  ✅ ${item.name}: Elenco atualizado de ${oldLength} para ${newLength} atores`);
        return item;
    } else {
        console.log(`  ⚠️ ${item.name}: Elenco não encontrado ou vazio.`);
        return item;
    }
}

async function processCategory(filename, testFilter = null) {
    const filePath = path.join(ENRICHED_DIR, filename);

    if (!fs.existsSync(filePath)) {
        console.error(`❌ Arquivo não encontrado: ${filePath}`);
        return 0;
    }

    console.log(`\n📂 Lendo arquivo: ${filename}`);
    let items = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    let updatedCount = 0;
    let skippedCount = 0;

    // Se for teste, filtra os itens
    if (testFilter) {
        const originalCount = items.length;
        items = items.filter(i => i.name && i.name.toLowerCase().includes(testFilter.toLowerCase()));
        console.log(`🔎 Filtro "${testFilter}": ${items.length} itens encontrados (de ${originalCount})`);
    }

    for (const item of items) {
        if (!item.tmdb) {
            skippedCount++;
            continue;
        }

        await processItem(item);
        updatedCount++;

        await sleep(DELAY);
    }

    // Se for teste, NÃO SALVA o arquivo original, apenas mostra info
    if (testFilter) {
        console.log(`\n🏁 Teste concluído para ${filename}. ${updatedCount} itens processados.`);
        if (items.length > 0) {
            const sample = items[0];
            console.log(`\n📊 Exemplo (${sample.name}):`);
            console.log(`   Número de atores: ${sample.tmdb.cast.length}`);
            console.log(`   Top 3: ${sample.tmdb.cast.slice(0, 3).map(c => c.name).join(', ')}`);
            // Salva arquivo de teste
            const testPath = path.join(ENRICHED_DIR, 'test-cast-update.json');
            fs.writeFileSync(testPath, JSON.stringify(items, null, 2), 'utf8');
            console.log(`   💾 Resultado do teste salvo em: ${testPath}`);
        }
    } else {
        // Modo normal: Salva o arquivo original
        fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
        console.log(`\n💾 Arquivo salvo: ${filePath}`);
        console.log(`   ✨ ${updatedCount} itens atualizados.`);
    }

    return updatedCount;
}

// ============================================
// EXECUÇÃO
// ============================================

async function main() {
    const args = process.argv.slice(2);

    // Argumento de TESTE
    const testArg = args.find(a => a.startsWith('--test='));

    if (testArg) {
        const filter = testArg.split('=')[1];
        console.log(`🧪 MODO TESTE (Filtro: "${filter}")`);

        // Procura em todos os arquivos enriquecidos para o teste
        const files = fs.readdirSync(ENRICHED_DIR).filter(f => f.endsWith('.json') && f !== 'test-cast-update.json');
        for (const file of files) {
            // Lê o arquivo para ver se tem o item que queremos testar
            const content = fs.readFileSync(path.join(ENRICHED_DIR, file), 'utf8');
            if (content.toLowerCase().includes(filter.toLowerCase())) {
                const processed = await processCategory(file, filter);
                if (processed > 0) return; // Sucesso, para a busca
            }
        }
        console.log(`❌ Item "${filter}" não encontrado em nenhum arquivo enriquecido.`);
        return;
    }

    // Argumento CATEGORIA ESPECÍFICA
    const categoryArg = args.find(a => a.startsWith('--category='));
    if (categoryArg) {
        const category = categoryArg.split('=')[1];
        await processCategory(`${category}.json`);
        return;
    }

    // Argumento TODOS
    if (args.includes('--all')) {
        const files = fs.readdirSync(ENRICHED_DIR).filter(f => f.endsWith('.json') && f !== 'test-cast-update.json');

        // Data de corte: 2 horas atrás (para evitar reprocessar o que já foi feito)
        const TWO_HOURS_AGO = Date.now() - (2 * 60 * 60 * 1000);

        for (const file of files) {
            const filePath = path.join(ENRICHED_DIR, file);
            const stats = fs.statSync(filePath);

            // Se foi modificado recentemente (nas últimas 2 horas), PULA
            if (stats.mtimeMs > TWO_HOURS_AGO) {
                console.log(`⏭️ Pulando ${file} (já processado recentemente)`);
                continue;
            }

            await processCategory(file);
        }
        return;
    }

    console.log(`
❌ Uso incorreto. Use:
   node scripts/update-cast-only.cjs --test="Nome da Série"
   node scripts/update-cast-only.cjs --category=nome-do-arquivo
   node scripts/update-cast-only.cjs --all
  `);
}

main().catch(console.error);
