/**
 * Montagem do guia de programação, fora da linha principal.
 *
 * Porte de `Epg.kt` e `MeuGuia.kt`. A ordem é a mesma do aplicativo e é
 * deliberada: o meuguia vem primeiro porque são trinta e poucas páginas
 * pequenas, chegam em segundos e a grade já aparece — e porque os feeds XMLTV
 * publicam horário errado em vários canais, o que é justamente o dado em que o
 * meuguia é confiável. Os feeds entram depois: cobrem os canais que o meuguia
 * não tem e, casando por título, acrescentam pôster, sinopse, elenco, episódio e
 * ano sem tocar nos horários.
 *
 * Roda num Worker porque os dois feeds somam dezoito megabytes de XML; lidos na
 * linha principal, a página congelava enquanto o guia era montado.
 */

import { decodeEntities, normalise } from '../utils/nomes';

const FEEDS = [
  'https://iptv-epg.org/files/epg-br.xml',
  'https://www.open-epg.com/files/brazil3.xml',
];

/*
 * Janela guardada: três horas para trás e trinta para frente. O guia mostra de
 * uma hora atrás até um dia adiante, e o cache vale seis horas — a folga cobre
 * isso. Guardar três dias, como antes, dava cinco megabytes de JSON lidos de
 * uma vez, na linha principal, em toda visita.
 */
const PAST_WINDOW_MS = 3 * 60 * 60 * 1000;
const FUTURE_WINDOW_MS = 30 * 60 * 60 * 1000;

/** Nomes que os feeds escrevem diferente do catálogo. */
const ALIASES: Record<string, string> = {
  'adult swim': 'trutv',
  history: 'history channel',
  'sony channel': 'sony',
  'sportv 2': 'sportv2',
  'sportv 3': 'sportv3',
  gnt: 'gnt hd',
  band: 'band sp',
  warner: 'warner channel',
  sbt: 'sbt sp',
};

/**
 * Nome normalizado do canal -> código do meuguia.
 *
 * A tabela do aplicativo, acrescida dos códigos que só a versão web conhecia e
 * que o meuguia realmente atende. Os que ela inventava — HBO Pop, Cartoonito,
 * Premiere 2 a 4 e mais sete — devolvem página vazia e ficaram de fora: pedi-los
 * era um download por canal para não trazer nada, e quem cobre esses é o XMLTV.
 */
const CODES: Record<string, string> = {
  'a e': 'MDO',
  'animal planet': 'APL',
  band: 'BAN',
  'band news': 'NEW',
  'band sports': 'BSP',
  'cartoon network': 'CAR',
  cinemax: 'MNX',
  combate: '135',
  'discovery kids': 'DIK',
  'discovery world': 'DIW',
  'discovery channel': 'DIS',
  'discovery home health': 'HEA',
  'discovery science': 'DSC',
  'discovery turbo': 'DTU',
  espn: 'ESP',
  'espn 2': 'ES2',
  'espn 3': 'ES3',
  'espn 4': 'ES4',
  'espn 5': 'ES5',
  gnt: 'GNT',
  'globo rj': 'GRD',
  'globo sp': 'GRD',
  globo: 'GRD',
  globonews: 'GLN',
  gloob: 'GOB',
  gloobinho: 'GBI',
  hbo: 'HBO',
  hbo2: 'HB2',
  'hbo family': 'HFA',
  'hbo plus': 'HPL',
  history: 'HIS',
  megapix: 'MPX',
  multishow: 'MSH',
  record: 'REC',
  'record news': 'RCN',
  redetv: 'RTV',
  sbt: 'SBT',
  space: 'SPA',
  sportv: 'SPO',
  'sportv 2': 'SP2',
  'sportv 3': 'SP3',
  tnt: 'TNT',
  'tnt series': 'TBS',
  tcm: 'TCM',
  tlc: 'TRV',
  'telecine action': 'TC2',
  'telecine cult': 'TC5',
  'telecine fun': 'TC6',
  'telecine pipoca': 'TC4',
  'telecine premium': 'TC1',
  'telecine touch': 'TC3',
  'universal tv': 'USA',
  'studio universal': 'HAL',
  warner: 'WBT',
  axn: 'AXN',
  'canal brasil': 'CBR',
  'canal off': 'OFF',
  e: 'EET',
  'sony channel': 'SET',
  'premiere clubes': '121',
  viva: 'VIV',
  'arte 1': 'BQ5',
  amc: 'MGM',
  'tv brasil': 'TED',
  'tv aparecida': 'TAP',
  'tv cultura': 'CUL',
  'tv gazeta': 'GAZ',
};

/**
 * Nome normalizado do canal -> slug do guiadetv.com.
 * Fonte primária rápida para todos os canais cobertos pelo guiadetv.com,
 * com horários precisos no fuso do Brasil, sem rate limit 429 e com sinopse em 99,8% dos programas.
 */
const GUIADETV_CODES: Record<string, string> = {
  'a e': 'ae',
  ae: 'ae',
  agro: 'agro',
  'agro mais': 'agro',
  'canal agro': 'agro',
  amc: 'amc',
  'animal planet': 'animal-planet',
  'arte 1': 'arte-1',
  arte1: 'arte-1',
  axn: 'axn',
  band: 'band',
  'band sp': 'band',
  'band campinas': 'band',
  'band curitiba': 'band',
  'band mg': 'band',
  'band para': 'band',
  'band recife tv tribuna': 'band',
  'band rn': 'band',
  'band rs': 'band',
  'band sergipe': 'band',
  'band rj': 'band-rj',
  'band news': 'bandnews',
  bandnews: 'bandnews',
  'band sports': 'bandsports',
  bandsports: 'bandsports',
  'bbc world': 'bbc-world',
  'bbc world news': 'bbc-world',
  bis: 'bis',
  bloomberg: 'bloomberg',
  'box kids': 'box-kids',
  'box kids tv': 'box-kids',
  'canal educacao': 'canal-educacao',
  'canal rural': 'canal-rural',
  'canal uol': 'canal-uol',
  'cancao nova': 'cancao-nova',
  'cartoon network': 'cartoon-network',
  cartoonito: 'cartoonito',
  cinemax: 'cinemax',
  'cnn brasil': 'cnn-brasil',
  combate: 'combate',
  curta: 'curta',
  'discovery channel': 'discovery-channel',
  'discovery home health': 'discovery-home-health',
  'discovery h h': 'discovery-home-health',
  'discovery kids': 'discovery-kids',
  'discovery science': 'discovery-science',
  'discovery theater': 'discovery-theater',
  'discovery turbo': 'discovery-turbo',
  'discovery world': 'discovery-world',
  'discovery id': 'investigacao-discovery',
  'investigacao discovery': 'investigacao-discovery',
  'investigation discovery': 'investigacao-discovery',
  e: 'e',
  espn: 'espn',
  'espn 2': 'espn-2',
  'espn 3': 'espn-3',
  'espn 4': 'espn-4',
  'espn 5': 'espn-5',
  'espn 6': 'espn-6',
  'film arts': 'film-arts',
  'food network': 'food-network',
  'fox news': 'fox-news',
  futura: 'futura',
  'canal futura': 'futura',
  'ge tv': 'ge-tv',
  getv: 'ge-tv',
  'globo news': 'globo-news',
  globonews: 'globo-news',
  'globo rj': 'globo-rio-de-janeiro',
  'globo rio de janeiro': 'globo-rio-de-janeiro',
  globo: 'globo-sp',
  'globo sp': 'globo-sp',
  'globo am': 'globo-sp',
  'globo ce': 'globo-sp',
  'globo df': 'globo-sp',
  'globo es': 'globo-sp',
  'globo go': 'globo-sp',
  'globo mg': 'globo-sp',
  'globo pb': 'globo-sp',
  'globo pe': 'globo-sp',
  'globo rs': 'globo-sp',
  gloob: 'gloob',
  gloobinho: 'gloobinho',
  gnt: 'gnt',
  hbo: 'hbo',
  'hbo 2': 'hbo-2',
  hbo2: 'hbo-2',
  'hbo family': 'hbo-family',
  'hbo mundi': 'hbo-mundi',
  'hbo plus': 'hbo-plus',
  'hbo pop': 'hbo-pop',
  'hbo signature': 'hbo-signature',
  'hbo xtreme': 'hbo-xtreme',
  hgtv: 'hgtv',
  history: 'history',
  'history channel': 'history',
  'history 2': 'history-2',
  h2: 'history-2',
  'jovem pan news': 'jovem-pan-news',
  lifetime: 'lifetime',
  'lifetime movies': 'lifetime',
  megapix: 'megapix',
  multishow: 'multishow',
  'music box brazil': 'music-box-brazil',
  'n sports': 'nsports',
  nsports: 'nsports',
  'n sports jogo 1': 'nsports',
  off: 'off',
  'canal off': 'off',
  premiere: 'premiere-fc',
  'premiere clubes': 'premiere-fc',
  'premiere fc': 'premiere-fc',
  'premiere 2': 'premiere-2',
  'premiere 3': 'premiere-3',
  'premiere 4': 'premiere-4',
  'premiere 5': 'premiere-5',
  'premiere 6': 'premiere-6',
  'premiere 7': 'premiere-7',
  'prime box brazil': 'prime-box-brazil',
  'record news': 'record-news',
  record: 'record-tv',
  'record tv': 'record-tv',
  'record sp': 'record-tv',
  'record go': 'record-tv',
  'record mg': 'record-tv',
  'record rj': 'record-tv',
  'record internacional': 'record-tv',
  recordtv: 'record-tv',
  'rede brasil': 'rede-brasil',
  'rede familia': 'rede-familia',
  'rede gospel': 'rede-gospel',
  redetv: 'rede-tv',
  'rede tv': 'rede-tv',
  'rede vida': 'rede-vida',
  sbt: 'sbt',
  'sbt sp': 'sbt',
  'sbt alterosa': 'sbt',
  'sbt ba': 'sbt',
  'sbt go': 'sbt',
  'sbt interior': 'sbt',
  'sbt londrina': 'sbt',
  'sbt maringa': 'sbt',
  'sbt mg': 'sbt',
  'sbt pi': 'sbt',
  'sbt pr': 'sbt',
  'sbt news': 'sbt-news',
  'sbt rj': 'sbt-rio-de-janeiro',
  'sbt rio de janeiro': 'sbt-rio-de-janeiro',
  sony: 'sony',
  'sony channel': 'sony',
  'sony movies': 'sony-movies',
  space: 'space',
  sportv: 'sportv',
  'sportv 2': 'sportv-2',
  sportv2: 'sportv-2',
  'sportv 3': 'sportv-3',
  sportv3: 'sportv-3',
  sportynet: 'sportynet',
  'sportynet 01': 'sportynet',
  'sportynet 4': 'sportynet',
  'sportynet 1': 'sportynet',
  'sportynet 2': 'sportynet',
  'sportynet 3': 'sportynet',
  'studio universal': 'studio-universal',
  syfy: 'syfy',
  'usa network': 'syfy',
  tcm: 'tcm',
  'telecine action': 'telecine-action',
  'telecine cult': 'telecine-cult',
  'telecine fun': 'telecine-fun',
  'telecine pipoca': 'telecine-pipoca',
  'telecine premium': 'telecine-premium',
  'telecine touch': 'telecine-touch',
  'terra viva': 'terra-viva',
  tlc: 'tlc',
  tnt: 'tnt',
  'tnt novelas': 'tnt-novelas',
  'tnt series': 'tnt-series',
  tooncast: 'tooncast',
  'travel box brazil': 'travel-box-brasil',
  'travel box brasil': 'travel-box-brasil',
  trutv: 'trutv',
  'adult swim': 'trutv',
  'tv aparecida': 'tv-aparecida',
  'tv brasil': 'tv-brasil',
  'tv camara': 'tv-camara',
  'tv cultura': 'tv-cultura',
  cultura: 'tv-cultura',
  'tv gazeta': 'tv-gazeta',
  gazeta: 'tv-gazeta',
  'tv ra tim bum': 'tv-ra-tim-bum',
  'ra tim bum': 'tv-ra-tim-bum',
  'tv senado': 'tv-senado',
  'universal tv': 'universal-tv',
  'universal channel': 'universal-tv',
  viva: 'viva',
  'canal viva': 'viva',
  'globoplay novelas': 'viva',
  warner: 'warner',
  'warner channel': 'warner',
  woohoo: 'woohoo',
  'x sports': 'xsports',
  xsports: 'xsports',
};

export interface WorkerProgramme {
  title: string;
  category: string;
  start: number;
  stop: number;
  poster?: string;
  episode?: string;
  description?: string;
}

/** Nome do canal -> programação. */
export type Grade = Record<string, WorkerProgramme[]>;

export interface PlutoDoCanal {
  id: string;
  /** A Pluto é a fonte principal do canal, e não uma reserva. */
  principal: boolean;
}

interface Pedido {
  names: string[];
  origin: string;
  /** Nome do canal -> id da Pluto. */
  pluto?: Record<string, PlutoDoCanal>;
}

/**
 * Guia da própria Pluto TV, montado pelo i.mjh.nz. Casa pelo id da Pluto, que já
 * está no link do canal: pelo nome, "Pluto TV Novelas" pegaria a programação de
 * outro canal. O raw.githubusercontent libera CORS, então vai direto, sem o
 * proxy (o redirecionamento do i.mjh.nz passa por uma página que não libera).
 */
const PLUTO_URL = 'https://raw.githubusercontent.com/matthuisman/i.mjh.nz/master/PlutoTV/br.xml';

// ============================================================
// FUSO
// ============================================================

/**
 * O meuguia publica horário de Brasília sem dizer isso em lugar nenhum.
 *
 * Montar a data com o fuso do visitante põe a grade horas fora do lugar para
 * quem abre o site de Lisboa. O deslocamento é obtido do próprio navegador para
 * não depender de tabela nossa.
 */
// Criar o formatador custa mais que usá-lo, e ele roda uma vez por programa.
let formatoSp: Intl.DateTimeFormat | null = null;

function saoPauloOffset(instante: number): number {
  const formato = formatoSp ??= new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const partes: Record<string, string> = {};
  for (const p of formato.formatToParts(new Date(instante))) partes[p.type] = p.value;
  const comoUtc = Date.UTC(
    Number(partes.year), Number(partes.month) - 1, Number(partes.day),
    Number(partes.hour) % 24, Number(partes.minute), Number(partes.second),
  );
  return comoUtc - instante;
}

function deSaoPaulo(ano: number, mes: number, dia: number, hora: number, minuto: number): number {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  return palpite - saoPauloOffset(palpite);
}

// ============================================================
// MEUGUIA
// ============================================================

function entre(texto: string, abre: string, fecha: string, depois?: string): string | null {
  let de = 0;
  if (depois) {
    const marca = texto.indexOf(depois);
    if (marca < 0) return null;
    de = marca + depois.length;
  }
  const inicio = texto.indexOf(abre, de);
  if (inicio < 0) return null;
  const fim = texto.indexOf(fecha, inicio + abre.length);
  if (fim < 0) return null;
  return texto.substring(inicio + abre.length, fim);
}

/**
 * Lista corrida de `<li>`: cabeçalhos de dia seguidos dos programas daquele dia,
 * cada um com hora de início, título e gênero. O fim não é publicado, então um
 * programa vai até o começo do seguinte.
 *
 * A leitura é item a item, e não por varredura do documento inteiro, porque os
 * blocos de anúncio entre entradas engoliriam as que vêm depois.
 */
export function parseMeuGuia(html: string): WorkerProgramme[] {
  const agora = new Date();
  const hojeSp = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora).split('-').map(Number);
  const anoAtual = hojeSp[0];
  const mesAtual = hojeSp[1];

  let ano = anoAtual;
  let mes = mesAtual;
  let dia = hojeSp[2];

  const inicios: number[] = [];
  const titulos: string[] = [];
  const generos: string[] = [];

  for (const item of html.split('<li')) {
    if (item.includes('subheader')) {
      const texto = entre(item, '>', '<', 'subheader');
      if (!texto) continue;
      const partes = texto.includes(',') ? texto.split(',').slice(1).join(',').trim() : '';
      const campos = partes.split('/');
      if (campos.length === 2) {
        const d = Number(campos[0].trim());
        const m = Number(campos[1].trim());
        if (Number.isInteger(d) && Number.isInteger(m)) {
          dia = d;
          mes = m;
          // A listagem não traz o ano e pode atravessar janeiro.
          ano = m < mesAtual ? anoAtual + 1 : anoAtual;
        }
      }
      continue;
    }

    const relogio = entre(item, "lileft time'>", '<') ?? entre(item, 'lileft time">', '<');
    if (!relogio) continue;
    const hm = relogio.trim().split(':');
    if (hm.length !== 2) continue;
    const hora = Number(hm[0]);
    const minuto = Number(hm[1]);
    if (!Number.isInteger(hora) || !Number.isInteger(minuto)) continue;

    const titulo = entre(item, '<h2>', '</h2>');
    if (!titulo) continue;
    const limpo = decodeEntities(titulo).trim();
    if (!limpo) continue;

    inicios.push(deSaoPaulo(ano, mes, dia, hora, minuto));
    titulos.push(limpo);
    generos.push(decodeEntities(entre(item, '<h3>', '</h3>') ?? '').trim());
  }

  // A ordem cronológica da página é um efeito do layout, não uma garantia.
  const ordem = inicios.map((_, i) => i).sort((a, b) => inicios[a] - inicios[b]);
  return ordem.map((indice, posicao) => ({
    title: titulos[indice],
    category: generos[indice],
    start: inicios[indice],
    stop: posicao + 1 < ordem.length ? inicios[ordem[posicao + 1]] : inicios[indice] + 3_600_000,
  }));
}

// ============================================================
// GUIADETV
// ============================================================

/**
 * `data-dt="AAAA-MM-DD HH:MM:SS-03:00"` seguido, em algum ponto adiante, de
 * um link `/programa/...` cujo texto é o título. O fim também não é
 * publicado; mesma regra do meuguia — vai até o próximo começar.
 */
/**
 * `https://www.guiadetv.com/canal/<slug>`
 * Cada programa é um `<li class="flex gap-4 ...">` contendo:
 * - `<time datetime="AAAA-MM-DDTHH:MM:SS-03:00">HH:MM</time>`
 * - `<span class="text-xs ...">1h30</span>` (duração)
 * - `<a href="/programa/..." ...>Título</a>`
 * - `<p class="mt-1 ...">Sinopse...</p>`
 */
export function parseGuiaDeTv(html: string): WorkerProgramme[] {
  const itens = html.split('<li');
  const lista: Array<{ start: number; duration: number; title: string; description?: string }> = [];

  for (let i = 1; i < itens.length; i++) {
    const item = itens[i];
    const dt = entre(item, 'datetime="', '"', '<time');
    if (!dt) continue;

    const start = Date.parse(dt);
    if (isNaN(start)) continue;

    const tituloBruto = entre(item, '>', '</a>', '/programa/');
    if (!tituloBruto) continue;
    const title = decodeEntities(tituloBruto).trim().replace(/\s+/g, ' ');
    if (!title || title.length < 2) continue;

    const durTexto = entre(item, '>', '</span>', '</time>') ?? '';
    let duration = 3_600_000;
    if (durTexto.includes('h')) {
      const [h, m] = durTexto.trim().split('h');
      const horas = Number(h) || 0;
      const mins = Number(m) || 0;
      duration = (horas * 60 + mins) * 60_000;
    } else if (durTexto.includes('min')) {
      const mins = Number(durTexto.replace('min', '').trim()) || 0;
      if (mins > 0) duration = mins * 60_000;
    }

    const descBruto = entre(item, '>', '</p>', '<p');
    const description = descBruto ? decodeEntities(descBruto).trim().replace(/\s+/g, ' ') : undefined;

    lista.push({ start, duration, title, description });
  }

  lista.sort((a, b) => a.start - b.start);

  const unicos: typeof lista = [];
  for (const item of lista) {
    const ultimo = unicos[unicos.length - 1];
    if (ultimo && ultimo.start === item.start) continue;
    unicos.push(item);
  }

  return unicos.map((item, index) => {
    const proximo = unicos[index + 1];
    let stop = item.start + item.duration;
    if (proximo) {
      if (stop > proximo.start || Math.abs(stop - proximo.start) <= 60_000) {
        stop = proximo.start;
      }
    }
    return {
      title: item.title,
      category: '',
      start: item.start,
      stop: stop > item.start ? stop : item.start + 3_600_000,
      description: item.description,
    };
  });
}

// ============================================================
// XMLTV
// ============================================================

function atributo(texto: string, nome: string): string | null {
  let de = 0;
  for (;;) {
    const marca = texto.indexOf(`${nome}="`, de);
    if (marca < 0) return null;
    // Evita casar o sufixo de outro atributo: "channel" dentro de "xchannel".
    const antes = marca === 0 ? ' ' : texto[marca - 1];
    if (antes === ' ' || antes === '\t' || antes === '\n' || antes === '<') {
      const inicio = marca + nome.length + 2;
      const fim = texto.indexOf('"', inicio);
      return fim < 0 ? null : texto.substring(inicio, fim);
    }
    de = marca + nome.length + 2;
  }
}

function texto(elemento: string, tag: string): string | null {
  const bruto = entre(elemento, `<${tag}`, `</${tag}>`);
  if (bruto === null) return null;
  const corpo = bruto.substring(bruto.indexOf('>') + 1);
  return decodeEntities(corpo).trim();
}

/** `20260902020000 -0300` */
function parseXmltvDate(valor: string): number | null {
  const m = valor.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return null;
  const base = Date.UTC(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6] ?? '0'),
  );
  if (!m[7]) return base;
  const sinal = m[7][0] === '-' ? -1 : 1;
  const desloc = sinal * (Number(m[7].slice(1, 3)) * 60 + Number(m[7].slice(3, 5))) * 60_000;
  return base - desloc;
}

/**
 * Casamento exato e por apelido primeiro, marcando os ids como tomados; a regra
 * frouxa de prefixo só roda depois, e nunca sobre um id já reivindicado — sem
 * isso "HBO2" engoliria o id que pertence a "HBO 2".
 */
function resolverIds(nomeParaIds: Map<string, string[]>, desejados: string[]): Map<string, string> {
  const idParaCanal = new Map<string, string>();
  const tomados = new Set<string>();
  const pendentes: Array<[string, string]> = [];

  for (const nome of desejados) {
    const chave = normalise(nome);
    const ids = nomeParaIds.get(chave) ?? (ALIASES[chave] ? nomeParaIds.get(ALIASES[chave]) : undefined);
    if (ids) {
      for (const id of ids) { idParaCanal.set(id, nome); tomados.add(id); }
    } else {
      pendentes.push([nome, chave]);
    }
  }

  for (const [nome, chave] of pendentes) {
    const candidatos = [...nomeParaIds.entries()]
      .filter(([k]) => k.startsWith(chave) || chave.startsWith(k));
    if (candidatos.length !== 1) continue;
    for (const id of candidatos[0][1]) {
      if (!tomados.has(id)) idParaCanal.set(id, nome);
    }
  }
  return idParaCanal;
}

function parseProgramme(
  elemento: string,
  idParaCanal: Map<string, string>,
  de: number,
  ate: number,
): [string, WorkerProgramme] | null {
  const corte = elemento.indexOf('>');
  if (corte <= 0) return null;
  const cabeca = elemento.substring(0, corte);

  const idCanal = atributo(cabeca, 'channel');
  const canal = idCanal ? idParaCanal.get(idCanal) : undefined;
  if (!canal) return null;

  const inicioBruto = atributo(cabeca, 'start');
  const fimBruto = atributo(cabeca, 'stop');
  if (!inicioBruto || !fimBruto) return null;
  const start = parseXmltvDate(inicioBruto);
  const stop = parseXmltvDate(fimBruto);
  if (start === null || stop === null) return null;
  if (stop <= de || start >= ate) return null;

  const title = texto(elemento, 'title');
  if (!title) return null;

  const iconTag = entre(elemento, '<icon', '>');
  const poster = iconTag ? decodeEntities(atributo(iconTag, 'src') ?? '') || undefined : undefined;

  return [canal, {
    title,
    category: texto(elemento, 'category') ?? '',
    start,
    stop,
    poster,
    // A Pluto usa o campo para a data de estreia ("original-air-date"): não é
    // episódio nenhum.
    episode: (entre(elemento, '<episode-num', '</episode-num>') ?? '').includes('original-air-date')
      ? undefined
      : texto(elemento, 'episode-num') ?? undefined,
    description: texto(elemento, 'desc') || undefined,
  }];
}

/**
 * Lê um feed XMLTV conforme ele chega da rede.
 *
 * O XMLTV escreve todo `<channel>` antes do primeiro `<programme>`, então uma
 * passada só basta: o mapa de ids é resolvido no instante em que os programas
 * começam, e nada fora da janela chega a ser guardado. Ler por pedaço evita
 * segurar os quinze megabytes do maior feed como uma string única.
 */
async function parseFeed(
  url: string,
  origin: string,
  desejados: string[],
  de: number,
  ate: number,
  porTitulo: Map<string, WorkerProgramme>,
  /** id do feed -> canal, pulando o casamento por nome (guia da Pluto). */
  ids?: Map<string, string>,
): Promise<Map<string, WorkerProgramme[]>> {
  const resposta = await fetch(ids ? url : `${origin}/api/proxy?url=${encodeURIComponent(url)}`);
  if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status} em ${url}`);

  const nomeParaIds = new Map<string, string[]>();
  let idParaCanal: Map<string, string> | null = ids ?? null;
  const saida = new Map<string, WorkerProgramme[]>();

  const ELEMENTO = /<(channel|programme)\b[\s\S]*?<\/\1>/g;

  const tratar = (elemento: string) => {
    if (elemento.startsWith('<channel')) {
      if (idParaCanal) return;
      const id = atributo(elemento.substring(0, elemento.indexOf('>')), 'id');
      if (!id) return;
      const display = texto(elemento, 'display-name');
      if (!display) return;
      const chave = normalise(display);
      const lista = nomeParaIds.get(chave);
      if (lista) lista.push(id); else nomeParaIds.set(chave, [id]);
      return;
    }
    // O primeiro programa fecha a lista de canais: daqui em diante o mapa de
    // ids está resolvido e não muda mais.
    const mapa = idParaCanal ?? (idParaCanal = resolverIds(nomeParaIds, desejados));
    if (mapa.size === 0) return;
    const achado = parseProgramme(elemento, mapa, de, ate);
    if (!achado) return;
    const chave = normalise(achado[1].title);
    if (chave && !porTitulo.get(chave)?.poster) porTitulo.set(chave, achado[1]);
    const lista = saida.get(achado[0]);
    if (lista) lista.push(achado[1]); else saida.set(achado[0], [achado[1]]);
  };

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    buffer += decodificador.decode(value, { stream: true });
    ELEMENTO.lastIndex = 0;
    let consumido = 0;
    let m: RegExpExecArray | null;
    while ((m = ELEMENTO.exec(buffer)) !== null) {
      tratar(m[0]);
      consumido = m.index + m[0].length;
    }
    if (consumido > 0) buffer = buffer.slice(consumido);
  }

  for (const [canal, lista] of saida) {
    saida.set(canal, lista.sort((a, b) => a.start - b.start));
  }
  return saida;
}

/**
 * O meuguia publica só título e gênero. Casando por título, os feeds trazem
 * pôster, sinopse e episódio sem tocar no horário.
 *
 * Preenche campo a campo: parar no primeiro programa que já tem pôster deixava
 * sem sinopse justamente os que o feed conseguiu ilustrar. Devolve os canais
 * que ganharam alguma coisa, para só eles irem à tela.
 */
function enriquecer(grade: Grade, porTitulo: Map<string, WorkerProgramme>): string[] {
  const mudaram: string[] = [];
  for (const canal of Object.keys(grade)) {
    let mudou = false;
    grade[canal] = grade[canal].map((p) => {
      if (p.poster && p.description && p.episode) return p;
      const fonte = porTitulo.get(normalise(p.title));
      if (!fonte) return p;
      const novo = {
        ...p,
        poster: p.poster ?? fonte.poster,
        episode: p.episode ?? fonte.episode,
        description: p.description ?? fonte.description,
        category: p.category || fonte.category,
      };
      if (novo.poster !== p.poster || novo.episode !== p.episode
        || novo.description !== p.description || novo.category !== p.category) mudou = true;
      return novo;
    });
    if (mudou) mudaram.push(canal);
  }
  return mudaram;
}

/**
 * Deixa a lista de um canal pronta para a grade: em ordem, sem programa de
 * duração zero, sem o mesmo horário repetido e sem um invadindo o seguinte.
 *
 * Os feeds XMLTV repetem entradas e publicam fins que passam do começo do
 * próximo; desenhados assim, os blocos se sobrepunham na grade e o "no ar
 * agora" escolhia o programa errado.
 */
function arrumar(lista: WorkerProgramme[]): WorkerProgramme[] {
  const ordenada = lista.filter((p) => p.stop > p.start).sort((a, b) => a.start - b.start);
  const saida: WorkerProgramme[] = [];
  for (const p of ordenada) {
    const anterior = saida[saida.length - 1];
    if (anterior && anterior.start === p.start) continue;
    if (anterior && anterior.stop > p.start) anterior.stop = p.start;
    saida.push(p);
  }
  return saida;
}

// ============================================================
// EXECUÇÃO
// ============================================================

/** Seis por vez: trinta e três downloads simultâneos roubam a banda do vídeo. */
async function comLimite<T, R>(itens: T[], limite: number, trabalho: (item: T) => Promise<R>): Promise<R[]> {
  const saida = new Array<R>(itens.length);
  let proximo = 0;
  const correr = async () => {
    for (;;) {
      const i = proximo++;
      if (i >= itens.length) return;
      saida[i] = await trabalho(itens[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, correr));
  return saida;
}

async function montar({ names: todos, origin, pluto = {} }: Pedido): Promise<void> {
  const agora = Date.now();
  const de = agora - PAST_WINDOW_MS;
  const ate = agora + FUTURE_WINDOW_MS;
  const grade: Grade = {};

  /*
   * Só os canais que mudaram vão para a tela. Mandar a grade inteira a cada
   * etapa obrigava a linha principal a copiar e converter tudo de novo cinco
   * vezes, e cada vez era um engasgo visível na página.
   */
  const publicar = (canais: Iterable<string>, fim = false) => {
    const parte: Grade = {};
    for (const canal of canais) {
      if (grade[canal]) parte[canal] = grade[canal] = arrumar(grade[canal]);
    }
    self.postMessage({ type: fim ? 'done' : 'partial', grade: parte });
  };

  // Canal da Pluto só usa o guia da Pluto; os outros guias nem tentam casá-lo.
  const names = todos.filter((name) => !pluto[name]?.principal);
  const plutoIds = new Map(Object.entries(pluto).map(([name, p]) => [p.id, name]));
  const daPluto = plutoIds.size
    ? parseFeed(PLUTO_URL, origin, [], de, ate, new Map(), plutoIds).catch((erro) => {
      console.warn('[EPG] guia da Pluto falhou:', erro);
      return new Map<string, WorkerProgramme[]>();
    })
    : Promise.resolve(new Map<string, WorkerProgramme[]>());
  void daPluto.then((lido) => {
    const cobertos: string[] = [];
    for (const [canal, programas] of lido) {
      if (pluto[canal]?.principal) { grade[canal] = programas; cobertos.push(canal); }
    }
    console.log(`[EPG] Pluto cobriu ${cobertos.length} canais`);
    if (cobertos.length) publicar(cobertos);
  });

  /*
   * 1. guiadetv.com vem primeiro: cobre ~121 canais com horários exatos no fuso
   * de Brasília, sem bloqueio 429 de requisições e trazendo a sinopse em português
   * de cada programa diretamente na página.
   *
   * Agrupamos por slug para que canais regionais (ex.: Globo AM, Globo SP) ou
   * variações do mesmo canal baixem a página uma única vez.
   */
  const slugParaCanais = new Map<string, string[]>();
  for (const name of names) {
    const limpo = name.replace(/\s*\((?:s\d+|ot|rk|b\d+|alt)\)\s*$/i, '');
    const slug = GUIADETV_CODES[normalise(limpo)] ?? GUIADETV_CODES[normalise(name)];
    if (!slug) continue;
    const lista = slugParaCanais.get(slug);
    if (lista) lista.push(name); else slugParaCanais.set(slug, [name]);
  }

  const baixarSlugGuiaDeTv = async (slug: string): Promise<readonly [string, WorkerProgramme[]]> => {
    try {
      const alvo = `https://www.guiadetv.com/canal/${slug}`;
      const r = await fetch(`${origin}/api/proxy?url=${encodeURIComponent(alvo)}`);
      if (!r.ok) return [slug, []];
      const lista = parseGuiaDeTv(await r.text()).filter((p) => p.stop > de && p.start < ate);
      return [slug, lista];
    } catch {
      return [slug, []];
    }
  };

  const slugsUnicos = Array.from(slugParaCanais.keys());
  if (slugsUnicos.length) {
    const respostas = await comLimite(slugsUnicos, 6, baixarSlugGuiaDeTv);
    const cobertos: string[] = [];
    for (const [slug, lista] of respostas) {
      if (!lista.length) continue;
      const canaisDoSlug = slugParaCanais.get(slug) ?? [];
      for (const name of canaisDoSlug) {
        grade[name] = lista;
        cobertos.push(name);
      }
    }
    console.log(`[EPG] guiadetv cobriu ${cobertos.length} canais (${slugsUnicos.length} páginas)`);
    if (cobertos.length) publicar(cobertos);
  }

  /*
   * 2. meuguia.tv entra como reserva para canais que o guiadetv não lista
   * (como Canal Brasil). Como são poucos, não toma 429.
   */
  const faltandoMeuGuia = names
    .filter((name) => !grade[name])
    .map((name) => [name, CODES[normalise(name)]] as const)
    .filter((par): par is readonly [string, string] => Boolean(par[1]));

  const baixarMeuGuia = async ([name, code]: readonly [string, string], tentativa = 0):
    Promise<readonly [string, WorkerProgramme[]]> => {
    try {
      const alvo = `https://meuguia.tv/programacao/canal/${code}`;
      const r = await fetch(`${origin}/api/proxy?url=${encodeURIComponent(alvo)}`);
      if (r.ok) {
        const lista = parseMeuGuia(await r.text()).filter((p) => p.stop > de && p.start < ate);
        if (lista.length || tentativa > 0) return [name, lista];
      }
    } catch {
      // Rede oscilando: cai na repetição abaixo.
    }
    if (tentativa > 0) return [name, []];
    await new Promise((pronto) => setTimeout(pronto, 1500));
    return baixarMeuGuia([name, code], tentativa + 1);
  };

  if (faltandoMeuGuia.length) {
    const paginas = await comLimite(faltandoMeuGuia, 4, baixarMeuGuia);
    const doMeuGuia = paginas.filter(([, l]) => l.length).map(([name]) => name);
    for (const [name, lista] of paginas) if (lista.length) grade[name] = lista;
    console.log(`[EPG] meuguia cobriu ${doMeuGuia.length} de ${faltandoMeuGuia.length} canais restantes`);
    if (doMeuGuia.length) publicar(doMeuGuia);
  }

  const porTitulo = new Map<string, WorkerProgramme>();
  for (const url of FEEDS) {
    let lido: Map<string, WorkerProgramme[]>;
    try {
      lido = await parseFeed(url, origin, names, de, ate, porTitulo);
      console.log(`[EPG] ${url}: ${lido.size} canais`);
    } catch (erro) {
      console.warn(`[EPG] ${url} falhou:`, erro);
      continue;
    }
    const novos = new Set<string>();
    for (const [canal, programas] of lido) {
      if (!grade[canal]) { grade[canal] = programas; novos.add(canal); }
    }
    // O enriquecimento acontece a cada feed, não no fim de todos: é ele que traz
    // as imagens, e esperar os dois significava abrir o guia sem nenhuma.
    for (const canal of enriquecer(grade, porTitulo)) novos.add(canal);
    if (novos.size) publicar(novos);
  }

  // Onde a Pluto é só reserva, a grade dela é genérica: entra na falta de outra.
  const reservas: string[] = [];
  for (const [canal, programas] of await daPluto) {
    if (!grade[canal]) { grade[canal] = programas; reservas.push(canal); }
  }

  console.log(`[EPG] guia pronto: ${Object.keys(grade).length} canais`);
  publicar(reservas, true);
}

self.onmessage = (evento: MessageEvent<Pedido>) => {
  montar(evento.data).catch((erro) => {
    self.postMessage({ type: 'error', message: String(erro) });
  });
};
