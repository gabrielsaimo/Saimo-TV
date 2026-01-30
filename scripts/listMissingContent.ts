import * as fs from 'fs';
import * as path from 'path';
import { normalizeName } from '../src/services/m3uService';

const M3U_URL = 'https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/CanaisBR04.m3u';
const ENRICHED_DIR = path.join(process.cwd(), 'public/data/enriched');

interface M3UItem {
    name: string;
    group: string;
    url: string;
}

async function fetchM3UContent(): Promise<M3UItem[]> {
    console.log('🔄 Baixando M3U...');
    try {
        const response = await fetch(M3U_URL);
        if (!response.ok) throw new Error(`Falha no download: ${response.statusText}`);
        const text = await response.text();
        const lines = text.split('\n');

        const items: M3UItem[] = [];
        let currentName = '';
        let currentGroup = '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#EXTINF:')) {
                const groupMatch = trimmed.match(/group-title="([^"]+)"/);
                const nameMatch = trimmed.match(/,(.+)$/);

                currentGroup = groupMatch ? groupMatch[1] : 'Sem Categoria';
                currentName = nameMatch ? nameMatch[1].trim() : '';
            } else if (trimmed && !trimmed.startsWith('#') && currentName) {
                items.push({
                    name: currentName,
                    group: currentGroup,
                    url: trimmed
                });
                currentName = ''; // Reset
            }
        }
        return items;
    } catch (error) {
        console.error('❌ Erro ao baixar M3U:', error);
        return [];
    }
}

async function main() {
    console.log('🎬 Iniciando verificação de conteúdo faltante...');

    // 1. Carregar M3U
    const m3uItems = await fetchM3UContent();
    console.log(`✅ ${m3uItems.length} itens encontrados no M3U.`);

    // 2. Carregar conteúdo local
    if (!fs.existsSync(ENRICHED_DIR)) {
        console.error(`❌ Diretório não encontrado: ${ENRICHED_DIR}`);
        return;
    }

    const localFiles = fs.readdirSync(ENRICHED_DIR).filter(f => f.endsWith('.json'));
    const localNames = new Set<string>();

    // Ignorar estes arquivos que não são de conteúdo principal ou podem gerar falso negativo se nome for diferente
    const IGNORE_FILES = ['saude.json', 'religiosos.json', 'canais-abertos.json']; // Exemplo, ajustar conforme necessário

    console.log('📊 Lendo arquivos locais...');
    for (const file of localFiles) {
        if (IGNORE_FILES.includes(file)) continue;

        try {
            const filePath = path.join(ENRICHED_DIR, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (Array.isArray(content)) {
                content.forEach(item => {
                    if (item.name) localNames.add(normalizeName(item.name));
                });
            }
        } catch (e) {
            console.error(`Erro ao ler ${file}:`, e);
        }
    }
    console.log(`📚 ${localNames.size} itens únicos encontrados localmente.`);

    // 3. Comparar
    console.log('🔍 Comparando...');

    // Agrupar faltantes por categoria (group-title)
    const missingByGroup: Record<string, string[]> = {};
    let totalMissing = 0;

    // Set para evitar duplicatas na listagem de saída (mesmo nome as vezes aparece em grupos diferentes ou repetido)
    const processedMissing = new Set<string>();

    for (const item of m3uItems) {
        const normName = normalizeName(item.name);

        // Ignorar se já tem localmente
        if (localNames.has(normName)) continue;

        // Ignorar se já listamos como faltante (evitar flood de episódios da mesma série)
        // Se for série (S01 E01), vamos tentar normalizar para o nome da série
        const epMatch = item.name.match(/(.+) S(\d+) ?E(\d+)/i) || item.name.match(/(.+) S(\d+)E(\d+)/i);
        let keyToCheck = normName;

        if (epMatch) {
            // Se for episódio, verifica se a SÉRIE já existe. Se a série existe, não listamos episódio como "filme/série faltante"
            // (Assumindo que o usuário quer saber de OBRAS faltantes, não episódios individuais)
            const seriesName = normalizeName(epMatch[1]);
            if (localNames.has(seriesName)) continue;

            keyToCheck = seriesName; // Listar a série como faltante
        }

        if (processedMissing.has(keyToCheck)) continue;

        if (!missingByGroup[item.group]) missingByGroup[item.group] = [];

        // Adiciona nome original
        const nameDisplay = epMatch ? `${epMatch[1].trim()} (Série)` : item.name;

        missingByGroup[item.group].push(nameDisplay);
        processedMissing.add(keyToCheck);
        totalMissing++;
    }

    // 4. Relatório
    console.log('\n=============================================');
    console.log(`🚨 RESULTADO: ${totalMissing} Filmes/Séries FALTANTES`);
    console.log('=============================================\n');

    let report = `RELATÓRIO DE CONTEÚDO FALTANTE (${new Date().toLocaleString()})\n`;
    report += `Total encontrado no M3U: ${m3uItems.length}\n`;
    report += `Total local (Enriched): ${localNames.size}\n`;
    report += `Total Faltante: ${totalMissing}\n\n`;

    // Ordenar grupos
    const sortedGroups = Object.keys(missingByGroup).sort();

    for (const group of sortedGroups) {
        console.log(`📂 GRUPO: ${group} (${missingByGroup[group].length} itens)`);
        report += `\n[${group}]\n`;

        missingByGroup[group].sort().forEach(name => {
            // console.log(`   - ${name}`); // Opcional: imprimir tudo no console pode ser muito grande
            report += ` - ${name}\n`;
        });

        // Mostrar preview no console
        const preview = missingByGroup[group].slice(0, 5);
        preview.forEach(p => console.log(`   - ${p}`));
        if (missingByGroup[group].length > 5) console.log(`   ... e mais ${missingByGroup[group].length - 5}`);
    }

    const reportFile = path.join(process.cwd(), 'missing_content_report.txt');
    fs.writeFileSync(reportFile, report);
    console.log(`\n📄 Relatório completo salvo em: ${reportFile}`);
}

main();
