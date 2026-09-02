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

const PAST_WINDOW_MS = 6 * 60 * 60 * 1000;
const FUTURE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

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
 * Nome normalizado do canal -> slug do guiadetv.com, para o que o meuguia não
 * cobre. Levantado varrendo as sete categorias do site (`/categorias/*.html`)
 * e cruzando com os canais do catálogo sem programação nenhuma; o resto do
 * catálogo — CazéTV, Globoplay Novelas, IMPD, AMC Séries, Boomerang, ESPN
 * Extra — não tem página lá nem em lugar nenhum público encontrado.
 */
const GUIADETV_CODES: Record<string, string> = {
  'sony movies': 'sony-movies',
  'sbt news': 'sbt-news',
  'terra viva': 'terra-viva',
  'box kids tv': 'box-kids',
  'x sports': 'xsports',
  'n sports': 'nsports',
};

export interface WorkerProgramme {
  title: string;
  category: string;
  start: number;
  stop: number;
  poster?: string;
  episode?: string;
  year?: string;
  description?: string;
  cast?: string[];
}

/** Nome do canal -> programação. */
export type Grade = Record<string, WorkerProgramme[]>;

interface Pedido {
  names: string[];
  origin: string;
}

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
function saoPauloOffset(instante: number): number {
  const formato = new Intl.DateTimeFormat('en-US', {
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
export function parseGuiaDeTv(html: string): WorkerProgramme[] {
  const linha = /data-dt="(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})[^"]*"[\s\S]*?<a[^>]*href="[^"]*programa\/[^"]+"[^>]*>[\s\S]*?([A-Za-zÀ-ÿ0-9][^<]{2,150})/g;

  const inicios: number[] = [];
  const titulos: string[] = [];

  for (const m of html.matchAll(linha)) {
    const [dataParte, horaParte] = m[1].split(' ');
    const [ano, mes, dia] = dataParte.split('-').map(Number);
    const [hora, minuto] = horaParte.split(':').map(Number);
    const titulo = decodeEntities(m[2]).trim().replace(/\s+/g, ' ');
    if (!titulo || titulo.length < 2) continue;

    inicios.push(deSaoPaulo(ano, mes, dia, hora, minuto));
    titulos.push(titulo);
  }

  // O mesmo instante pode aparecer mais de uma vez na página (o link do
  // programa carrega alguns metadados extras que também casam com a regex).
  const vistos = new Set<string>();
  const unicos: Array<{ start: number; title: string }> = [];
  for (let i = 0; i < inicios.length; i++) {
    const chave = `${inicios[i]}-${titulos[i]}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    unicos.push({ start: inicios[i], title: titulos[i] });
  }
  unicos.sort((a, b) => a.start - b.start);

  return unicos.map((item, posicao) => ({
    title: item.title,
    category: '',
    start: item.start,
    stop: posicao + 1 < unicos.length ? unicos[posicao + 1].start : item.start + 3_600_000,
  }));
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
  const bloco = entre(elemento, '<credits', '</credits>');
  const cast = bloco
    ? [...bloco.matchAll(/<actor[^>]*>([\s\S]*?)<\/actor>/g)]
      .map((m) => decodeEntities(m[1]).trim())
      .filter(Boolean)
    : [];

  return [canal, {
    title,
    category: texto(elemento, 'category') ?? '',
    start,
    stop,
    poster,
    episode: texto(elemento, 'episode-num') ?? undefined,
    year: texto(elemento, 'date')?.slice(0, 4),
    description: texto(elemento, 'desc') || undefined,
    cast,
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
): Promise<Map<string, WorkerProgramme[]>> {
  const resposta = await fetch(`${origin}/api/proxy?url=${encodeURIComponent(url)}`);
  if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status} em ${url}`);

  const nomeParaIds = new Map<string, string[]>();
  let idParaCanal: Map<string, string> | null = null;
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
 * pôster, sinopse, elenco, episódio e ano sem tocar no horário.
 *
 * Preenche campo a campo: parar no primeiro programa que já tem pôster deixava
 * sem sinopse justamente os que o feed conseguiu ilustrar.
 */
function enriquecer(grade: Grade, porTitulo: Map<string, WorkerProgramme>): void {
  for (const canal of Object.keys(grade)) {
    grade[canal] = grade[canal].map((p) => {
      if (p.poster && p.description && p.cast?.length) return p;
      const fonte = porTitulo.get(normalise(p.title));
      if (!fonte) return p;
      return {
        ...p,
        poster: p.poster ?? fonte.poster,
        episode: p.episode ?? fonte.episode,
        year: p.year ?? fonte.year,
        description: p.description ?? fonte.description,
        cast: p.cast?.length ? p.cast : fonte.cast,
        category: p.category || fonte.category,
      };
    });
  }
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

async function montar({ names, origin }: Pedido): Promise<void> {
  const agora = Date.now();
  const de = agora - PAST_WINDOW_MS;
  const ate = agora + FUTURE_WINDOW_MS;
  const grade: Grade = {};

  const publicar = (parcial: boolean) => {
    self.postMessage({ type: parcial ? 'partial' : 'done', grade });
  };

  const comCodigo = names
    .map((name) => [name, CODES[normalise(name)]] as const)
    .filter((par): par is readonly [string, string] => Boolean(par[1]));

  /*
   * Uma segunda tentativa depois de uma pausa.
   *
   * Seis downloads simultâneos fazem o meuguia devolver 429 para alguns, e sem
   * repetir cada oscilação custava uma dúzia de canais sem programação — a
   * diferença aparecia entre uma visita e outra, no mesmo catálogo.
   */
  const baixarGuia = async ([name, code]: readonly [string, string], tentativa = 0):
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
    return baixarGuia([name, code], tentativa + 1);
  };

  const paginas = await comLimite(comCodigo, 6, baixarGuia);

  for (const [name, lista] of paginas) if (lista.length) grade[name] = lista;
  console.log(`[EPG] meuguia cobriu ${Object.keys(grade).length} de ${comCodigo.length} canais`);
  if (Object.keys(grade).length) publicar(true);

  /*
   * O resto: canais que o meuguia não lista, mas o guiadetv sim — Sony
   * Movies é o caso que veio faltando, e a mesma varredura achou mais cinco.
   * Só entra quem o meuguia já não cobriu.
   */
  const comGuiaDeTv = names
    .filter((name) => !grade[name])
    .map((name) => [name, GUIADETV_CODES[normalise(name)]] as const)
    .filter((par): par is readonly [string, string] => Boolean(par[1]));

  const baixarGuiaDeTv = async ([name, slug]: readonly [string, string]):
    Promise<readonly [string, WorkerProgramme[]]> => {
    try {
      const alvo = `https://www.guiadetv.com/canal/${slug}`;
      const r = await fetch(`${origin}/api/proxy?url=${encodeURIComponent(alvo)}`);
      if (!r.ok) return [name, []];
      const lista = parseGuiaDeTv(await r.text()).filter((p) => p.stop > de && p.start < ate);
      return [name, lista];
    } catch {
      return [name, []];
    }
  };

  if (comGuiaDeTv.length) {
    const extras = await comLimite(comGuiaDeTv, 6, baixarGuiaDeTv);
    for (const [name, lista] of extras) if (lista.length) grade[name] = lista;
    console.log(`[EPG] guiadetv cobriu ${extras.filter(([, l]) => l.length).length} de ${comGuiaDeTv.length} canais`);
    if (extras.some(([, l]) => l.length)) publicar(true);
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
    for (const [canal, programas] of lido) {
      if (!grade[canal]) grade[canal] = programas;
    }
    // O enriquecimento acontece a cada feed, não no fim de todos: é ele que traz
    // as imagens, e esperar os dois significava abrir o guia sem nenhuma.
    enriquecer(grade, porTitulo);
    publicar(true);
  }

  console.log(`[EPG] guia pronto: ${Object.keys(grade).length} canais`);
  publicar(false);
}

self.onmessage = (evento: MessageEvent<Pedido>) => {
  montar(evento.data).catch((erro) => {
    self.postMessage({ type: 'error', message: String(erro) });
  });
};
