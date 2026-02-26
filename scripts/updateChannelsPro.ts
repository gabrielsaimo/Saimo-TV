import * as fs from 'fs';
import * as path from 'path';

/**
 * updateChannelsPro.ts
 *
 * Lê o mesmo arquivo M3U usado para filmes/séries e extrai os CANAIS DE TV
 * (itens cujas URLs NÃO terminam em .mp4/.mkv/.avi/.m4v).
 * Para quando encontra o primeiro item com URL .mp4 — todo o resto é filme/série.
 *
 * Uso:
 *   npx ts-node scripts/updateChannelsPro.ts
 *   # ou
 *   bun run scripts/updateChannelsPro.ts
 */

const M3U_URLS = [
    'https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/CanaisBR04.m3u',
    // Adicione mais URLs aqui:
    // 'https://exemplo.com/outro.m3u',
];
const OUTPUT_FILE = path.join(process.cwd(), 'public/data/lista_pro.json');

interface ProChannel {
    id: string;
    name: string;
    url: string;
    logo: string;
    category: string;
    channelNumber: number;
}

function isMediaFile(url: string): boolean {
    const lower = url.toLowerCase().split('?')[0]; // ignora query strings
    return (
        lower.endsWith('.mp4') ||
        lower.endsWith('.mkv') ||
        lower.endsWith('.avi') ||
        lower.endsWith('.m4v')
    );
}

function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60);
}

async function fetchM3U(url: string): Promise<string> {
    console.log(`📡 Baixando M3U: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar M3U`);
    return res.text();
}

function parseChannels(m3uContent: string, seenNames: Set<string>, startNumber: number): ProChannel[] {
    const lines = m3uContent.split('\n').map(l => l.trim());
    const channels: ProChannel[] = [];
    let channelNumber = startNumber;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Encontra diretiva #EXTINF
        if (!line.startsWith('#EXTINF:')) continue;

        // A URL vem na próxima linha não vazia
        let urlLine = '';
        for (let j = i + 1; j < lines.length; j++) {
            if (lines[j] && !lines[j].startsWith('#')) {
                urlLine = lines[j];
                i = j; // avança o iterador
                break;
            }
        }

        if (!urlLine) continue;

        // Se a URL for um arquivo de mídia (.mp4, .mkv, etc.) → pular (é filme/série)
        if (isMediaFile(urlLine)) {
            continue;
        }

        // Extrai metadados do #EXTINF
        const nameMatch = line.match(/,(.+)$/);
        const name = nameMatch ? nameMatch[1].trim() : `Canal ${channelNumber}`;

        // Deduplica pelo nome (case-insensitive)
        const normalizedName = name.toLowerCase().trim();
        if (seenNames.has(normalizedName)) continue;
        seenNames.add(normalizedName);

        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const logo = logoMatch ? logoMatch[1] : '';

        const groupMatch = line.match(/group-title="([^"]+)"/);
        const category = groupMatch ? groupMatch[1] : 'Outros';

        const id = `pro-${slugify(name)}-${channelNumber}`;

        channels.push({
            id,
            name,
            url: urlLine,
            logo,
            category,
            channelNumber,
        });

        channelNumber++;
    }

    return channels;
}

async function main() {
    console.log('📺 Atualizando lista PRO de canais...\n');

    const allChannels: ProChannel[] = [];
    const seenNames = new Set<string>();

    for (let i = 0; i < M3U_URLS.length; i++) {
        const url = M3U_URLS[i];
        try {
            const m3u = await fetchM3U(url);
            const channels = parseChannels(m3u, seenNames, allChannels.length + 1);
            console.log(`   ↳ ${channels.length} canais únicos obtidos desta fonte (${seenNames.size} total acumulado).\n`);
            allChannels.push(...channels);
        } catch (err) {
            console.warn(`⚠️ Falha ao processar URL [${i + 1}]: ${err}`);
        }
    }

    const channels = allChannels;

    if (channels.length === 0) {
        console.error('❌ Nenhum canal encontrado! Verifique o formato do M3U.');
        process.exit(1);
    }

    // Garante que o diretório existe
    const outDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(channels, null, 2), 'utf-8');

    // Estatísticas por categoria
    const byCategory: Record<string, number> = {};
    for (const ch of channels) {
        byCategory[ch.category] = (byCategory[ch.category] || 0) + 1;
    }

    console.log(`\n✅ ${channels.length} canais extraídos!\n`);
    console.log('📊 Por categoria:');
    Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));

    console.log(`\n💾 Salvo em: ${OUTPUT_FILE}`);
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
