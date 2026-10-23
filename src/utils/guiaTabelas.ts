/**
 * As tabelas do guia de programação, lidas do `guia.txt` do endereço de canais.
 * Nenhuma tabela por canal mora no código: este arquivo é quem diz que canal é
 * qual página do meuguia ou do guiadetv, que apelido o feed XMLTV usa e quais
 * feeds consultar.
 *
 * Linhas com TAB (`#` comenta):
 *   meuguia   <nome do canal no catálogo>  <código no meuguia.tv>
 *   guiadetv  <nome normalizado>           <endereço (ou só o final dele) no guiadetv.com>
 *   alias     <nome normalizado>           <nome do canal no feed>
 *   feed      -                            <endereço de um feed XMLTV> (vale a ordem)
 *   pluto     -                            <endereço do guia da Pluto TV>
 *
 * Fica em arquivo próprio, sem dependência de React, porque o Worker do guia
 * recebe as tabelas já lidas.
 */
import { normalise } from './nomes.ts';

export interface TabelasGuia {
  /** Nome normalizado do canal -> código do meuguia. */
  meuguia: Record<string, string>;
  /** Nome normalizado do canal -> endereço da página no guiadetv. */
  guiadetv: Record<string, string>;
  /** Nome normalizado do canal -> nome normalizado no feed. */
  alias: Record<string, string>;
  feeds: string[];
  pluto: string;
}

export const TABELAS_VAZIAS: TabelasGuia = { meuguia: {}, guiadetv: {}, alias: {}, feeds: [], pluto: '' };

const httpOuHttps = (url: string) => /^https?:\/\//i.test(url);

export function lerGuia(texto: string): TabelasGuia {
  const t: TabelasGuia = { meuguia: {}, guiadetv: {}, alias: {}, feeds: [], pluto: '' };
  for (const bruta of texto.split('\n')) {
    const linha = bruta.replace(/\r$/, '');
    if (!linha.trim() || linha.trimStart().startsWith('#')) continue;
    const [tipo, chave = '', valor = ''] = linha.split('\t').map((c) => c.trim());
    if (!valor) continue;
    switch (tipo) {
      case 'meuguia': t.meuguia[normalise(chave)] = valor; break;
      case 'guiadetv': t.guiadetv[normalise(chave)] = valor; break;
      case 'alias': t.alias[normalise(chave)] = normalise(valor); break;
      case 'feed': if (httpOuHttps(valor)) t.feeds.push(valor); break;
      case 'pluto': if (httpOuHttps(valor) && !t.pluto) t.pluto = valor; break;
    }
  }
  return t;
}
