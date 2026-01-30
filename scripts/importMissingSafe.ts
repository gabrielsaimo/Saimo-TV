import * as fs from 'fs';
import * as path from 'path';
import { normalizeName } from '../src/services/m3uService';
import { getCleanName } from '../src/utils/m3uMatcher';

const M3U_URL = 'https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/CanaisBR04.m3u';
const ENRICHED_DIR = path.join(process.cwd(), 'public/data/enriched');

// Mapeamento simplificado para gerar nomes de arquivos "imported_"
// Se for null, vai para imported_outros.json
const CATEGORY_FILE_MAP: Record<string, string> = {
    'acao': 'acao.json',
    'comedia': 'comedia.json',
    'drama': 'drama.json',
    'terror': 'terror.json',
    'ficcao': 'ficcao.json',
    'animacao': 'animacao.json',
    'infantil': 'infantil.json',
    'romance': 'romance.json',
    'suspense': 'suspense.json',
    'lancamentos': 'lancamentos.json',
    'netflix': 'netflix.json',
    'amazon': 'amazon.json',
    'disney': 'disney.json',
    'hbo': 'hbo.json',
    'globo': 'globo.json',
    'apple': 'apple.json',
    'paramount': 'paramount.json',
    'star': 'star.json',
    'discovery': 'discovery.json',
    'legendado': 'legendados.json',
    'adultos': 'adultos.json',
    'cursos': 'cursos.json' // Adicionado explicitamente
};

interface M3UItem {
    name: string;
    group: string;
    logo?: string;
    url: string;
}

async function fetchM3UContent(): Promise<M3UItem[]> {
    console.log('🔄 Baixando M3U...');
    const response = await fetch(M3U_URL);
    if (!response.ok) throw new Error('Falha no download do M3U');
    const text = await response.text();
    const lines = text.split('\n');

    const items: M3UItem[] = [];
    let currentInfo: Partial<M3UItem> = {};

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#EXTINF:')) {
            const tvgNameMatch = trimmed.match(/tvg-name="([^"]+)"/);
            const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
            const groupMatch = trimmed.match(/group-title="([^"]+)"/);
            const nameMatch = trimmed.match(/,(.+)$/);

            const name = tvgNameMatch ? tvgNameMatch[1] : (nameMatch ? nameMatch[1] : '');

            // FILTRAGEM DE CANAIS (CRÍTICO)
            const group = groupMatch ? groupMatch[1] : 'Sem Categoria';
            const groupLower = group.toLowerCase();
            const nameLower = name.toLowerCase();

            // Ignorar canais de TV
            if (groupLower.startsWith('canais') ||
                groupLower.includes('| canais') ||
                groupLower.includes('24h') ||
                nameLower.includes('[24h]') ||
                nameLower.startsWith('[24h]')) {
                continue;
            }

            currentInfo = {
                name: name.trim(),
                logo: logoMatch ? logoMatch[1] : undefined,
                group: group
            };
        } else if (trimmed && !trimmed.startsWith('#')) {
            if (currentInfo.name) {
                items.push({
                    name: currentInfo.name,
                    logo: currentInfo.logo,
                    group: currentInfo.group || 'Outros',
                    url: trimmed
                });
                currentInfo = {};
            }
        }
    }
    return items;
}

function mapGroupToImportFile(group: string): string {
    const lower = group.toLowerCase();

    // Prioridade para Cursos
    if (lower.includes('curso') || lower.includes('learning')) {
        return 'imported_cursos.json';
    }

    // Tenta match com mapa
    for (const key in CATEGORY_FILE_MAP) {
        if (lower.includes(key)) return `imported_${CATEGORY_FILE_MAP[key]}`;
    }

    return 'imported_outros_filmes_series.json';
}

async function main() {
    console.log('🎬 Iniciando Importação Segura (Filtrando TV)...');

    // 1. Carregar M3U
    const m3uItems = await fetchM3UContent();
    console.log(`✅ ${m3uItems.length} itens relevates filtrados no M3U.`);

    // 2. Carregar nomes locais (para evitar duplicatas)
    if (!fs.existsSync(ENRICHED_DIR)) fs.mkdirSync(ENRICHED_DIR, { recursive: true });

    const localFiles = fs.readdirSync(ENRICHED_DIR).filter(f => f.endsWith('.json'));
    const existingNames = new Set<string>();

    console.log('📊 Indexando conteúdo local existente...');
    for (const file of localFiles) {
        try {
            const content = JSON.parse(fs.readFileSync(path.join(ENRICHED_DIR, file), 'utf-8'));
            if (Array.isArray(content)) {
                content.forEach(item => {
                    if (item.name) existingNames.add(normalizeName(item.name));
                });
            }
        } catch (e) { }
    }

    // 3. Processar itens
    const newItemsByFile: Record<string, any[]> = {};
    const processedMap = new Set<string>(); // Para evitar duplicatas internas do M3U

    // Mapa temporário para agrupar séries novas
    const newSeriesMap: Record<string, {
        name: string,
        group: string,
        logo?: string,
        episodes: any[],
        targetFile: string
    }> = {};

    let countMovies = 0;
    let countEpisodes = 0;

    for (const item of m3uItems) {
        const normName = normalizeName(item.name);

        // Se já existe localmente, pula
        if (existingNames.has(normName)) continue;

        // Verifica logica de série
        const epMatch = item.name.match(/(.+) S(\d+) ?E(\d+)/i) || item.name.match(/(.+) S(\d+)E(\d+)/i);

        if (epMatch) {
            // É EPISÓDIO
            const seriesName = epMatch[1].trim();
            const normSeries = normalizeName(seriesName);

            // Se a SÉRIE já existe localmente, nós NÃO adicionamos "restos" de episódios neste script
            // O updateContent.ts é melhor para isso. Aqui focamos em OBRAS NOVAS.
            if (existingNames.has(normSeries)) continue;

            // Agrupa para criar a série nova
            if (!newSeriesMap[normSeries]) {
                const targetFile = mapGroupToImportFile(item.group).replace('.json', '_series.json'); // Separa series
                newSeriesMap[normSeries] = {
                    name: seriesName,
                    group: item.group,
                    logo: item.logo,
                    episodes: [],
                    targetFile: targetFile
                };
            }

            newSeriesMap[normSeries].episodes.push({
                season: epMatch[2],
                episode: parseInt(epMatch[3]),
                name: item.name,
                url: item.url,
                logo: item.logo
            });
            countEpisodes++;

        } else {
            // É FILME (ou curso unitário)
            if (processedMap.has(normName)) continue;

            const targetFile = mapGroupToImportFile(item.group);
            if (!newItemsByFile[targetFile]) newItemsByFile[targetFile] = [];

            const isAdult = targetFile.includes('adultos') || item.group.toLowerCase().includes('xxx');

            newItemsByFile[targetFile].push({
                id: `imp-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
                name: item.name,
                url: item.url,
                category: item.group,
                type: 'movie',
                isAdult: isAdult,
                logo: item.logo,
                tmdb: null // Será preenchido depois
            });

            processedMap.add(normName);
            countMovies++;
        }
    }

    // 4. Processar Séries Agrupadas
    for (const key in newSeriesMap) {
        const s = newSeriesMap[key];
        const targetFile = s.targetFile;

        if (!newItemsByFile[targetFile]) newItemsByFile[targetFile] = [];

        // Estrutura episódios
        const episodesBySeason: Record<string, any[]> = {};
        s.episodes.forEach(ep => {
            const skey = String(parseInt(ep.season));
            if (!episodesBySeason[skey]) episodesBySeason[skey] = [];
            episodesBySeason[skey].push({
                episode: ep.episode,
                name: ep.name,
                url: ep.url,
                id: `ep-${Date.now()}-${Math.random()}`,
                logo: ep.logo
            });
        });

        // Ordenar
        Object.keys(episodesBySeason).forEach(k => {
            episodesBySeason[k].sort((a, b) => a.episode - b.episode);
        });

        newItemsByFile[targetFile].push({
            id: `imp-series-${Date.now()}-${Math.random()}`,
            name: s.name,
            category: s.group,
            type: 'series',
            isAdult: false,
            logo: s.logo,
            episodes: episodesBySeason,
            totalSeasons: Object.keys(episodesBySeason).length,
            totalEpisodes: s.episodes.length,
            tmdb: null
        });
    }

    // 5. Salvar Arquivos
    console.log(`\n💾 Salvando novos arquivos em ${ENRICHED_DIR}...`);
    let totalSaved = 0;

    for (const [filename, items] of Object.entries(newItemsByFile)) {
        if (items.length === 0) continue;

        // Se o arquivo "imported_" já existe (de uma rodada anterior minha), vamos dar append ou overwrite?
        // Como o usuário pediu "adicione", overwrite seria perigoso se ele rodar 2x.
        // Vamos ler se existe e dar append, apenas no arquivo imported.
        // Mas como esses arquivos são "meus" (imported_*), é seguro mexer neles (o outro script não toca neles).

        const filePath = path.join(ENRICHED_DIR, filename);
        let finalItems = items;

        if (fs.existsSync(filePath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                // Evita duplicatas simples
                const namesInFile = new Set(existing.map((i: any) => i.name));
                const uniqueNew = items.filter(i => !namesInFile.has(i.name));
                finalItems = [...existing, ...uniqueNew];
            } catch (e) { }
        }

        fs.writeFileSync(filePath, JSON.stringify(finalItems, null, 2));
        console.log(`   📄 ${filename}: ${items.length} novos itens (Total arquivo: ${finalItems.length})`);
        totalSaved += items.length;
    }

    console.log(`\n✨ Concluído! ${totalSaved} novos itens (Filmes/Séries/Cursos) salvos.`);
    console.log(`   (Canais de TV foram ignorados)`);
}

main();
