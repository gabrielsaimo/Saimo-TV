/**
 * Os jogos de hoje e dos próximos dias que passam em algum canal da lista,
 * com a mesma lógica da tela de Eventos do TV Box e do app de celular.
 *
 * Três fontes: a agenda da embedtv diz em que canal cada jogo passa; a do
 * monitor traz os jogos dos canais de streaming (CazéTV, Disney+, Prime,
 * Paramount+, GOAT, ge tv, N Sports, SportyNet) que a embedtv não tem, no
 * mesmo formato e com placar; os placares da ESPN dizem se já começou, o
 * placar e o tempo de jogo, e trazem escudos melhores. Só entra jogo que tem canal (sem canal não há o que
 * assistir), e jogo encerrado sai.
 */
import type { Channel } from '../types/channel';

export interface Jogo {
    casa: string;
    fora: string;
    casaLogo: string;
    foraLogo: string;
    liga: string;
    ligaLogo: string;
    inicio: number;
    fim: number;
    canal: Channel;
    /** "pre", "in" ou "post", quando a ESPN conhece o jogo. */
    estado: string;
    placar: string;
    tempo: string;
}

export const aoVivo = (j: Jogo, agora: number) =>
    j.estado === 'in' || (j.estado !== 'post' && agora >= j.inicio && agora <= j.fim);
export const acabou = (j: Jogo, agora: number) => j.estado === 'post' || agora > j.fim;

// A agenda passa pela função do site (functions/api/events.ts): a embedtv
// não manda o cabeçalho de CORS. A ESPN manda, então vai direto.
const EMBED = '/api/events';
const STREAMING = 'https://saimo-monitor.gabrielsaimo68.workers.dev/v1/eventos';
const ESPN = [
    'soccer/bra.1', 'soccer/bra.2', 'soccer/bra.copa_do_brazil', 'soccer/conmebol.libertadores',
    'soccer/conmebol.sudamericana', 'soccer/uefa.champions', 'soccer/uefa.europa', 'soccer/eng.1',
    'soccer/esp.1', 'soccer/ita.1', 'soccer/ger.1', 'soccer/fra.1', 'soccer/por.1', 'soccer/ned.1',
    'soccer/arg.1', 'soccer/ksa.1', 'soccer/fifa.world', 'soccer/fifa.worldq.conmebol',
    'basketball/nba', 'football/nfl', 'baseball/mlb', 'hockey/nhl', 'mma/ufc',
];
const SIGLAS = new Set(['fc', 'ec', 'sc', 'ac', 'afc', 'cf', 'cd', 'club', 'clube', 'esporte', 'sport',
    'futebol', 'de', 'do', 'da', 'sp', 'rj', 'mg', 'rs', 'pr', 'ba', 'pe', 'ce', 'go', 'sad']);
const HORA = 3_600_000;

/** A agenda do monitor, reaproveitada por um minuto: abrir, fechar e voltar à
 *  tela não vira um pedido a cada vez (o monitor cobra por pedido). */
let doMonitorGuardado: { em: number; dados: unknown } | null = null;
async function doMonitor(): Promise<unknown> {
    if (doMonitorGuardado && Date.now() - doMonitorGuardado.em < 60_000) return doMonitorGuardado.dados;
    const dados = await json(STREAMING);
    if (dados != null) doMonitorGuardado = { em: Date.now(), dados };
    return dados;
}

interface Placar {
    casa: string; fora: string; casaLogo: string; foraLogo: string; ligaLogo: string;
    inicio: number; estado: string; golsCasa: string; golsFora: string; tempo: string;
}

/** O que a agenda da embedtv traz de cada jogo (só o que é lido aqui). */
interface EventoAgenda {
    players?: string[];
    time_start?: string;
    time_end?: string;
    teams?: { home?: { name?: string; image?: string }; away?: { name?: string; image?: string } };
    league?: { name?: string; image?: string };
    /** Só na agenda do monitor (canais de streaming). */
    estado?: string;
    placar?: string;
    tempo?: string;
}

/** O placar da ESPN (só o que é lido aqui). */
interface Competidor {
    homeAway?: string;
    score?: string;
    team?: { name?: string; logo?: string };
}
interface PlacarEspn {
    leagues?: { logos?: { href?: string }[] }[];
    events?: {
        date?: string;
        status?: { type?: { state?: string; shortDetail?: string } };
        competitions?: { competitors?: Competidor[] }[];
    }[];
}

async function json(url: string): Promise<unknown> {
    try {
        // Prazo de 8 s: a embedtv às vezes não responde, e a tela não espera por ela.
        const controle = new AbortController();
        const relogio = setTimeout(() => controle.abort(), 8000);
        try {
            const r = await fetch(url, { signal: controle.signal });
            return r.ok ? await r.json() : null;
        } finally {
            clearTimeout(relogio);
        }
    } catch {
        return null;
    }
}

/**
 * Escudos e logos da agenda vêm do CDN do 365scores pedidos em 24 ou 34 px
 * (`w_24,h_24`, 48 px com `dpr_2`) e em qualidade econômica: borrados no
 * cartão. O CDN monta a imagem pelo endereço, então pedir 256 px e qualidade
 * máxima traz o original (350 a 415 px); `c_limit` nunca amplia além dele.
 */
export function emAltaResolucao(url: string): string {
    const marca = 'imagecache.365scores.com/image/upload/';
    const pos = url.indexOf(marca);
    if (pos < 0) return url;
    const inicio = pos + marca.length;
    const barra = url.indexOf('/', inicio);
    const fim = barra < 0 ? url.length : barra;
    const ajustes = url.slice(inicio, fim).split(',').map(p =>
        p.startsWith('w_') ? 'w_256'
            : p.startsWith('h_') ? 'h_256'
                : p === 'q_auto:eco' ? 'q_auto:best' : p).join(',');
    return url.slice(0, inicio) + ajustes + url.slice(fim);
}

/** O canal pelo fim do endereço do player ("…/premiere-fc" é o Premiere FC). */
function canalDo(url: string, canais: Channel[]): Channel | undefined {
    const slug = (url.split('/').pop() ?? '').toLowerCase().replace(/[- ]/g, '');
    if (!slug) return undefined;
    const chave = (c: Channel) => c.name.toLowerCase().replace(/ /g, '');
    return canais.find(c => chave(c) === slug) ?? canais.find(c => chave(c).includes(slug));
}

function lerAgenda(arr: unknown, canais: Channel[]): Jogo[] {
    if (!Array.isArray(arr)) return [];
    const vistos = new Set<string>();
    const jogos: Jogo[] = [];
    for (const o of arr as EventoAgenda[]) {
        try {
            const player = o?.players?.[0];
            if (!player) continue;
            const canal = canalDo(player, canais);
            if (!canal) continue;
            const inicio = new Date(o.time_start ?? '').getTime();
            if (isNaN(inicio)) continue;
            const fimLido = o.time_end ? new Date(o.time_end).getTime() : NaN;
            const j: Jogo = {
                casa: o.teams?.home?.name ?? '', fora: o.teams?.away?.name ?? '',
                casaLogo: emAltaResolucao(o.teams?.home?.image ?? ''),
                foraLogo: emAltaResolucao(o.teams?.away?.image ?? ''),
                liga: o.league?.name ?? '', ligaLogo: emAltaResolucao(o.league?.image ?? ''),
                inicio, fim: isNaN(fimLido) ? inicio + 2 * HORA : fimLido,
                canal,
                // Só a agenda do monitor manda o placar; a ESPN, quando acha o jogo, vale mais.
                estado: o.estado ?? '', placar: o.placar ?? '', tempo: o.tempo ?? '',
            };
            const chave = `${j.casa} x ${j.fora}|${j.inicio}`;
            if (vistos.has(chave)) continue;
            vistos.add(chave);
            jogos.push(j);
        } catch {
            // jogo com dados faltando fica de fora
        }
    }
    return jogos;
}

function lerEspn(bruto: unknown): Placar[] {
    const dados = bruto as PlacarEspn | null;
    const ligaLogo = dados?.leagues?.[0]?.logos?.[0]?.href ?? '';
    const saida: Placar[] = [];
    for (const ev of dados?.events ?? []) {
        const comps: Competidor[] = ev?.competitions?.[0]?.competitors ?? [];
        const casa = comps.find(c => c.homeAway === 'home');
        const fora = comps.find(c => c.homeAway !== 'home');
        if (!casa || !fora) continue;
        const status = ev?.status?.type;
        const estado = status?.state ?? '';
        saida.push({
            casa: casa.team?.name ?? '', fora: fora.team?.name ?? '',
            casaLogo: casa.team?.logo ?? '', foraLogo: fora.team?.logo ?? '',
            ligaLogo, inicio: new Date(ev.date ?? '').getTime() || 0, estado,
            golsCasa: casa.score ?? '', golsFora: fora.score ?? '',
            tempo: estado === 'in' ? status?.shortDetail ?? '' : '',
        });
    }
    return saida;
}

/** Só palavras inteiras de sigla saem: "Palmeiras" e "SE Palmeiras" casam. */
function chaveTime(nome: string): string {
    return nome.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
        .split(/[^a-z0-9]+/).filter(p => p && !SIGLAS.has(p)).join('');
}

function mesmoTime(a: string, b: string): boolean {
    const x = chaveTime(a);
    const y = chaveTime(b);
    if (!x || !y) return false;
    return x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y));
}

/** null quando a agenda não veio. */
export async function buscarJogos(canais: Channel[]): Promise<Jogo[] | null> {
    const [agenda, streaming, ...placares] = await Promise.all([
        json(EMBED),
        doMonitor(),
        ...ESPN.map(l => json(`https://site.api.espn.com/apis/site/v2/sports/${l}/scoreboard`)),
    ]);
    // A função do site devolve {error} quando a embedtv falha; aí a tela segue só
    // com os jogos do monitor, e some apenas se as duas caírem.
    if (!Array.isArray(agenda) && !Array.isArray(streaming)) return null;
    const espn = placares.filter(Boolean).flatMap(lerEspn);
    const daEmbed = Array.isArray(agenda) ? lerAgenda(agenda, canais) : [];
    // Jogo do monitor que a embedtv já tem (mesmos times, começo a menos de
    // meia hora) não entra de novo.
    const extras = lerAgenda(streaming, canais).filter(x => !daEmbed.some(e =>
        Math.abs(e.inicio - x.inicio) < HORA / 2 &&
        ((mesmoTime(e.casa, x.casa) && mesmoTime(e.fora, x.fora)) ||
            (mesmoTime(e.casa, x.fora) && mesmoTime(e.fora, x.casa)))));
    return [...daEmbed, ...extras].map(jogo => {
        // O mesmo jogo na ESPN: mesmos times (em qualquer ordem) e começo
        // a menos de quatro horas um do outro.
        const par = espn.find(e =>
            Math.abs(e.inicio - jogo.inicio) < 4 * HORA &&
            ((mesmoTime(e.casa, jogo.casa) && mesmoTime(e.fora, jogo.fora)) ||
                (mesmoTime(e.casa, jogo.fora) && mesmoTime(e.fora, jogo.casa))));
        if (!par) return jogo;
        // A ESPN pode listar os times na ordem inversa da agenda: aí o escudo
        // e os gols dela vão para o outro lado, senão o time mostrado ganha o
        // escudo do adversário e o placar sai invertido.
        const invertido = !(mesmoTime(par.casa, jogo.casa) && mesmoTime(par.fora, jogo.fora));
        const [logoCasa, logoFora] = invertido ? [par.foraLogo, par.casaLogo] : [par.casaLogo, par.foraLogo];
        const [golsCasa, golsFora] = invertido ? [par.golsFora, par.golsCasa] : [par.golsCasa, par.golsFora];
        return {
            ...jogo,
            casaLogo: logoCasa || jogo.casaLogo,
            foraLogo: logoFora || jogo.foraLogo,
            ligaLogo: jogo.ligaLogo || par.ligaLogo,
            estado: par.estado,
            placar: par.estado === 'pre' ? '' : `${golsCasa} x ${golsFora}`,
            tempo: par.tempo,
        };
    });
}
