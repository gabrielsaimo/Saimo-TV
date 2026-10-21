/**
 * Servidores desligados à mão, no painel do monitor.
 *
 * Quando um provedor cai, cai inteiro: não é a fonte 3 de um canal que morreu,
 * é o servidor que parou de responder para todo mundo. Editar o catálogo
 * publicado a cada queda é lento e some com o link, que depois precisa voltar.
 * Desligar o servidor no painel some com ele de todo canal e de todo filme, em
 * todos os aplicativos, e religar devolve tudo.
 *
 * A lista é baixada sem chave nenhuma: são nomes de servidor, que o catálogo
 * publicado já mostra, e exigir segredo significaria embutir um segredo numa
 * página que qualquer um abre.
 *
 * Sem rede a lista fica vazia e nada é escondido — o erro certo a cometer: um
 * canal a mais na tela é melhor que a lista inteira sumindo porque o monitor
 * não respondeu.
 */

const ENDERECO = 'https://saimo-tv.pages.dev/fontes-desativadas.json';
/** Uma hora, guardada entre aberturas: o monitor cobra por pedido, e com
 *  milhares de abas pedindo a cada dois minutos a conta passava da franquia.
 *  Desligar um servidor no painel vale em até uma hora. */
export const VALIDADE_MS = 3_600_000;
const CHAVE = 'saimo-fontes-desativadas';

let hosts = new Set<string>();
let lidoEm = 0;
try {
  const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null') as { hosts?: string[]; em?: number } | null;
  if (salvo && Array.isArray(salvo.hosts) && Number(salvo.em) > 0) {
    hosts = new Set(salvo.hosts);
    lidoEm = Number(salvo.em);
  }
} catch { /* sem localStorage: pede na rede */ }

/** Os servidores desligados agora, sem ir à rede. */
export function atuais(): ReadonlySet<string> {
  return hosts;
}

/**
 * Busca a lista quando ela envelheceu.
 *
 * Devolve `true` quando mudou, que é quando quem chamou precisa remontar a
 * lista de canais.
 */
let emAndamento: Promise<boolean> | null = null;

export function atualizar(): Promise<boolean> {
  if (Date.now() - lidoEm < VALIDADE_MS) return Promise.resolve(false);
  // Duas telas pedindo juntas na abertura viram um pedido só.
  emAndamento ??= buscar().finally(() => { emAndamento = null; });
  return emAndamento;
}

async function buscar(): Promise<boolean> {
  try {
    // A resposta vem com `max-age` de dois minutos, e o navegador o respeita:
    // somado ao relógio daqui, a lista podia demorar o dobro para mudar. Quem
    // manda no ritmo é este relógio, um só.
    const resposta = await fetch(ENDERECO, { cache: 'no-store' });
    if (!resposta.ok) return false;
    const corpo = (await resposta.json()) as { desativados?: unknown };
    if (!Array.isArray(corpo.desativados)) return false;

    lidoEm = Date.now();
    const novos = new Set(
      corpo.desativados
        .filter((h): h is string => typeof h === 'string')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    );
    try { localStorage.setItem(CHAVE, JSON.stringify({ hosts: [...novos], em: lidoEm })); } catch { /* segue */ }
    if (novos.size === hosts.size && [...novos].every((h) => hosts.has(h))) return false;
    hosts = novos;
    console.info(
      novos.size
        ? `servidores desligados: ${[...novos].sort().join(', ')}`
        : 'nenhum servidor desligado',
    );
    return true;
  } catch {
    return false;
  }
}

/** O servidor de um endereço, em minúsculas. */
function servidor(url: string): string | null {
  try {
    return new URL(url, window.location.href).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function desligado(url: string): boolean {
  if (!hosts.size) return false;
  const host = servidor(url);
  return host !== null && hosts.has(host);
}

/** Os endereços de um filme ou episódio sem os que estão desligados. */
export function peneirar(urls: string[]): string[] {
  return hosts.size ? urls.filter((u) => !desligado(u)) : urls;
}

/**
 * O catálogo sem o que está desligado.
 *
 * Canal que fica sem nenhuma fonte sai da lista: ele não abriria mesmo, e
 * deixá-lo ali só rende clique frustrado. Volta sozinho quando o servidor for
 * religado.
 */
export function peneirarCanais<T extends { sources: { url: string }[] }>(canais: T[]): T[] {
  if (!hosts.size) return canais;
  const out: T[] = [];
  for (const canal of canais) {
    const vivas = canal.sources.filter((s) => !desligado(s.url));
    if (!vivas.length) continue;
    out.push(vivas.length === canal.sources.length ? canal : { ...canal, sources: vivas });
  }
  return out;
}
