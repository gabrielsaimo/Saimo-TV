import * as fs from 'fs';
import * as path from 'path';

const ENRICHED_DIR = path.join(process.cwd(), 'public/data/enriched');

// Map from the "imported base name" to the "actual system file name"
// Base name comes from: imported_{base}.json or imported_{base}_series.json
const FILENAME_FIX_MAP: Record<string, string> = {
    'amazon': 'prime-video.json',
    'apple': 'apple-tv.json',
    'globo': 'globoplay.json',
    'hbo': 'max.json',
    'adultos': 'hot-adultos.json',
    'ficcao': 'ficcao-cientifica.json',
    'infantil': 'animacao.json',
    'outros_filmes_series': 'outros.json', // Merge generic others into outros.json
    'outros': 'outros.json',
    'cursos': 'cursos.json'
};

async function main() {
    console.log('🔄 Iniciando fusão de arquivos importados...');

    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error('❌ Diretório enriched não encontrado.');
        return;
    }

    const files = fs.readdirSync(ENRICHED_DIR).filter(f => f.startsWith('imported_') && f.endsWith('.json'));

    if (files.length === 0) {
        console.log('✅ Nenhum arquivo importado para fundir.');
        return;
    }

    let totalMerged = 0;

    for (const file of files) {
        const filePath = path.join(ENRICHED_DIR, file);

        // Parse filename
        // imported_amazon_series.json -> amazon
        // imported_acao.json -> acao

        let base = file.replace('imported_', '').replace('.json', '');
        if (base.endsWith('_series')) {
            base = base.replace('_series', '');
        }

        // Determine target file
        let targetFilename = FILENAME_FIX_MAP[base] || `${base}.json`;

        // Se targetFilename não existe mas base.json existe, usa base.json?
        // Mas o mapa FILENAME_FIX_MAP é autoridade.
        // Se não estiver no mapa, assume que o nome já está certo (ex: acao.json).

        const targetPath = path.join(ENRICHED_DIR, targetFilename);

        console.log(`📂 Processando ${file} -> ${targetFilename}...`);

        try {
            const importedItems = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (!Array.isArray(importedItems) || importedItems.length === 0) {
                console.log(`   ⚠️ Arquivo vazio ou inválido, deletando.`);
                fs.unlinkSync(filePath);
                continue;
            }

            let targetItems: any[] = [];
            if (fs.existsSync(targetPath)) {
                targetItems = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
            } else {
                console.log(`   🆕 Criando novo arquivo: ${targetFilename}`);
            }

            // Merge avoiding exact duplicates (by name)
            // Note: The previous script generated IDs, so IDs will differ. rely on Names.
            const existingNames = new Set(targetItems.map((i: any) => i.name.toLowerCase().trim()));
            let addedCount = 0;

            for (const item of importedItems) {
                const norm = item.name.toLowerCase().trim();
                // Check if name exists
                if (!existingNames.has(norm)) {
                    targetItems.push(item);
                    existingNames.add(norm); // Add to set to prevent double adding from same batch if any
                    addedCount++;
                }
            }

            // Save target
            fs.writeFileSync(targetPath, JSON.stringify(targetItems, null, 2));
            console.log(`   ✅ Adicionados ${addedCount} itens em ${targetFilename}.`);

            // Delete imported file
            fs.unlinkSync(filePath);
            totalMerged += addedCount;

        } catch (e) {
            console.error(`   ❌ Erro ao processar ${file}:`, e);
        }
    }

    console.log(`\n🎉 Fusão concluída! Total de ${totalMerged} itens fundidos.`);
}

main();
