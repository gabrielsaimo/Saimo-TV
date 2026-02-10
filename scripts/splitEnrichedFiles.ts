/**
 * Script para dividir arquivos JSON enriched em partes de 50 itens cada.
 * 
 * Gera: {baseName}-p1.json, {baseName}-p2.json, etc.
 * Cria: _manifest.json com metadados de cada categoria.
 * Remove: arquivos monolíticos originais após o split.
 * 
 * Uso: npx tsx scripts/splitEnrichedFiles.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ENRICHED_DIR = path.join(process.cwd(), 'public/data/enriched');
const ITEMS_PER_PART = 50;
const MANIFEST_FILE = path.join(ENRICHED_DIR, '_manifest.json');

interface ManifestEntry {
    totalParts: number;
    totalItems: number;
}

type Manifest = Record<string, ManifestEntry>;

async function main() {
    console.log('🔄 Iniciando split de arquivos enriched...');
    console.log(`📁 Diretório: ${ENRICHED_DIR}`);
    console.log(`📦 Itens por parte: ${ITEMS_PER_PART}`);

    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error(`❌ Diretório não encontrado: ${ENRICHED_DIR}`);
        process.exit(1);
    }

    // Pega apenas arquivos .json que NÃO são partes nem manifesto
    const files = fs.readdirSync(ENRICHED_DIR).filter(f => {
        if (!f.endsWith('.json')) return false;
        if (f === '_manifest.json') return false;
        if (f.match(/-p\d+\.json$/)) return false; // Já é uma parte
        if (f.startsWith('test-')) return false; // Ignora arquivos de teste
        return true;
    });

    console.log(`📋 ${files.length} arquivos para processar.\n`);

    const manifest: Manifest = {};
    let totalPartsCreated = 0;
    let totalItemsProcessed = 0;

    for (const file of files) {
        const filePath = path.join(ENRICHED_DIR, file);
        const baseName = file.replace('.json', '');

        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);

            if (!Array.isArray(data)) {
                console.warn(`⚠️ ${file} não é um array, pulando.`);
                continue;
            }

            const totalItems = data.length;
            const totalParts = Math.ceil(totalItems / ITEMS_PER_PART);

            console.log(`📄 ${file}: ${totalItems} itens → ${totalParts} partes`);

            // Cria as partes
            for (let i = 0; i < totalParts; i++) {
                const start = i * ITEMS_PER_PART;
                const end = Math.min(start + ITEMS_PER_PART, totalItems);
                const chunk = data.slice(start, end);
                const partFile = `${baseName}-p${i + 1}.json`;
                const partPath = path.join(ENRICHED_DIR, partFile);

                fs.writeFileSync(partPath, JSON.stringify(chunk));
                totalPartsCreated++;
            }

            // Registra no manifesto
            manifest[baseName] = {
                totalParts,
                totalItems
            };

            totalItemsProcessed += totalItems;

            // Remove o arquivo original monolítico
            fs.unlinkSync(filePath);
            console.log(`   ✅ Split completo. Arquivo original removido.`);

        } catch (e) {
            console.error(`❌ Erro ao processar ${file}:`, e);
        }
    }

    // Salva manifesto
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

    console.log(`\n🎉 Split finalizado!`);
    console.log(`   📦 ${totalPartsCreated} partes criadas`);
    console.log(`   🎬 ${totalItemsProcessed} itens processados`);
    console.log(`   📋 Manifesto salvo em: _manifest.json`);
    console.log(`   📁 ${Object.keys(manifest).length} categorias no manifesto`);
}

main();
