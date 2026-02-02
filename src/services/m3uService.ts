// URL do arquivo M3U
const M3U_URL = 'https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/refs/heads/master/CanaisBR%20-%20Completo.m3u8';

// Cache em memória
let m3uCache: Map<string, string> | null = null;
let fetchPromise: Promise<Map<string, string>> | null = null;

/**
 * Normaliza o nome para facilitar o matching
 * Remove acentos, caracteres especiais, converte para minúsculas
 */
export function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s]/g, '') // Mantém apenas letras, números e espaços
        .replace(/\s+/g, ' ') // Remove espaços extras
        .trim();
}

/**
 * Busca e parseia o arquivo M3U
 */
export async function fetchM3UData(): Promise<Map<string, string>> {
    if (m3uCache) return m3uCache;
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
        try {
            console.log('🔄 Buscando lista M3U atualizada...');
            const response = await fetch(M3U_URL);
            if (!response.ok) throw new Error(`Falha ao baixar M3U: ${response.statusText}`);

            const text = await response.text();
            const map = new Map<string, string>();
            const lines = text.split('\n');

            let currentName = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (line.startsWith('#EXTINF:')) {
                    // Tenta extrair tvg-name primeiro, depois o nome após a vírgula
                    const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);

                    if (tvgNameMatch) {
                        currentName = tvgNameMatch[1];
                    } else {
                        // Fallback: pega tudo depois da última vírgula
                        const parts = line.split(',');
                        currentName = parts[parts.length - 1].trim();
                    }
                } else if (line && !line.startsWith('#')) {
                    // É a URL
                    if (currentName) {
                        // Armazena a versão normalizada como chave
                        const normalized = normalizeName(currentName);
                        if (normalized) {
                            map.set(normalized, line);
                        }
                        currentName = '';
                    }
                }
            }

            console.log(`✅ Lista M3U processada: ${map.size} itens encontrados`);
            m3uCache = map;
            return map;
        } catch (error) {
            console.error('❌ Erro ao processar M3U:', error);
            return new Map<string, string>(); // Retorna mapa vazio em caso de erro para não quebrar o app
        }
    })();

    return fetchPromise;
}

/**
 * Tenta encontrar uma URL para um nome de filme/série
 */
export function findUrlForName(name: string, m3uMap: Map<string, string>): string | undefined {
    const normalized = normalizeName(name);
    return m3uMap.get(normalized);
}
