import * as fs from 'fs';
import * as path from 'path';

// Define the Channel interface to match src/types/channel.ts
interface Channel {
    id: string;
    name: string;
    url: string;
    category: string;
    logo: string;
    channelNumber?: number;
}

const INPUT_FILE = path.join(process.cwd(), 'scripts/adult_list_raw.txt');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/restrictedChannels.ts');

async function main() {
    console.log('📖 Lendo arquivo raw...');
    const content = fs.readFileSync(INPUT_FILE, 'utf-8');
    const lines = content.split('\n');

    const channels: Channel[] = [];
    const categories = new Set<string>();

    let currentInfo: Partial<Channel> = {};

    console.log('🔄 Processando linhas...');

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('#EXTINF:')) {
            // Parse EXTINF line
            // Example: #EXTINF:-1 xui-id="202282" tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Name

            const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
            const groupMatch = trimmed.match(/group-title="([^"]+)"/);
            const nameMatch = trimmed.match(/,([^,]+)$/);

            // Extract generic name if comma match fails, use fallback
            let name = nameMatch ? nameMatch[1].trim() : 'Canal Desconhecido';

            // Also try tvg-name if needed
            if ((!name || name === 'Canal Desconhecido') && trimmed.includes('tvg-name="')) {
                const tvgName = trimmed.match(/tvg-name="([^"]+)"/);
                if (tvgName) name = tvgName[1];
            }

            currentInfo = {
                name: name,
                logo: logoMatch ? logoMatch[1] : '',
                category: groupMatch ? groupMatch[1] : 'Outros',
            };

        } else if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('EXT')) {
            // It's a URL line
            if (currentInfo.name) {
                const category = currentInfo.category || 'Outros';
                categories.add(category);

                // Generate a stable but unique ID
                // Using a sanitized version of name + slight random or index if needed.
                // For simplicity here valid chars only.
                const id = `restricted-${channels.length}-${currentInfo.name?.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

                channels.push({
                    id,
                    name: currentInfo.name!,
                    url: trimmed,
                    category: category,
                    logo: currentInfo.logo || '',
                });

                currentInfo = {}; // Reset
            }
        }
    }

    console.log(`✅ ${channels.length} canais processados.`);
    console.log(`📂 ${categories.size} categorias encontradas.`);

    // Generate TypeScript File Content
    const uniqueCategories = Array.from(categories).sort();

    const fileContent = `
import type { Channel } from '../types/channel';

export const restrictedCategories = ${JSON.stringify(uniqueCategories, null, 2)};

export const restrictedChannels: Channel[] = ${JSON.stringify(channels, null, 2)};
`;

    console.log('💾 Salvando arquivo TS...');
    fs.writeFileSync(OUTPUT_FILE, fileContent.trim());
    console.log(`✨ Arquivo gerado com sucesso em: ${OUTPUT_FILE}`);
}

main().catch(console.error);
