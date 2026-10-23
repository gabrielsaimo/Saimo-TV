/**
 * Tela On Demand - Paridade 100% com o aplicativo do macOS (SaimoPlayer)
 *
 * Arquitetura em Fileiras (TelaEmFileiras):
 * - Hero Destaque no topo (DestaqueTopo) com imagem larga ao fundo (FundoDoDestaque)
 *   que se atualiza com debounce suave ao passar o mouse sobre qualquer cartão.
 * - Fileira de Categorias com cartões colagem 330px (Filmes, Séries, Animes, Doramas, 18+).
 * - Fileira Continue assistindo com barra de progresso e retorno imediato.
 * - Fileiras de Destaques e Novidades (Em alta, Lançamentos, Séries novas, etc.).
 * - Fileiras de Filmes por Gênero (Ação, Comédia, Terror, Ficção científica, etc.)
 *   terminando em cartão "Ver todos" que abre a grade daquele gênero.
 * - Fileira Explorar de A a Z.
 * - Modo Explorar (Grade A a Z) com filtro de letras, gêneros e busca.
 * - Modal de Ficha de Filme (FichaTela) e Série (SerieTela) idênticos ao macOS,
 *   com fotos do elenco (AtorTela), seletores de temporadas em pílulas e
 *   trilha horizontal de cartões 16:9 de episódios com imagem de cena.
 * - Suporte total a mouse: rolagem horizontal suave, setas flutuantes de vidro,
 *   menu de contexto de botão direito para favoritar.
 */

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import type { Movie, MovieSource, SeriesEpisodeInfo } from '../types/movie';
import {
  LETRAS,
  buscar,
  todos as listarTudo,
  capaDaFicha,
  semAno,
  idDaFicha,
  tituloDoId,
  colecao,
  destaques,
  episodios,
  generos as lerGeneros,
  temGenero,
  filme as buscarFilme,
  indice,
  serie as buscarSerie,
  type Achado,
  type Episodio,
  type FilaDestaque,
  type Generos,
  type ItemDestaque,
  type Filme,
  type Gaveta,
  type Serie,
  type SerieColecao,
} from '../services/vodService';
import {
  ficha as buscarFicha,
  melhorMatch,
  creditosDe,
  perfil as buscarPerfil,
  episodiosDaTemporada,
  type Ficha,
  type Pessoa,
  type Perfil,
  type EpisodioTmdb,
} from '../services/tmdbService';
import { useVoltarFecha } from '../hooks/useVoltarFecha';
import { useFichaDe } from '../hooks/useFichaDe';
import { httpsFirst } from '../utils/sourceOrder';
import { lista as listaAndamento } from '../services/continuar';
import {
  alternar as alternarFavorito,
  aoMudar as aoMudarFavoritos,
  contem as ehFavorito,
} from '../services/vodFavoritos';
import './VodCatalog.css';

export type Secao = 'filmes' | 'series' | 'animes' | 'doramas' | 'extra';

interface VodCatalogProps {
  onSelectMovie: (movie: Movie, seriesInfo?: SeriesEpisodeInfo | null) => void;
  onBack: () => void;
  playerOpen?: boolean;
  activeMovie?: Movie | null;
  isAdultUnlocked: boolean;
}

interface Item {
  chave: string;
  titulo: string;
  rotulo: string;
  serie: boolean;
  letra: string;
  ano?: string;
  filme?: Filme;
  dados?: Serie;
  colecao?: SerieColecao;
}

interface EpisodioAgrupado {
  temporada: number;
  numero: number;
  fontes: MovieSource[];
  versoes: string[];
}

interface Trabalho {
  item: Item;
  capa: string | null;
  papel: string;
}

const PAGINA = 120;

const GENEROS_ON_DEMAND = [
  'Ação',
  'Comédia',
  'Terror',
  'Ficção científica',
  'Romance',
  'Suspense',
  'Animação',
  'Aventura',
  'Drama',
  'Crime',
  'Fantasia',
];

const ORDEM_GENEROS = [
  'Ação',
  'Comédia',
  'Drama',
  'Terror',
  'Suspense',
  'Ficção científica',
  'Animação',
  'Romance',
  'Aventura',
  'Crime',
  'Família',
  'Fantasia',
  'Mistério',
  'Documentário',
  'Guerra',
  'Faroeste',
  'História',
  'Sci-Fi & Fantasy',
  'Action & Adventure',
];

const SOBRE_SECAO: Record<Secao, string> = {
  filmes: 'Lançamentos, clássicos e tudo entre eles, dublados e legendados.',
  series: 'Temporadas completas, com o próximo episódio emendando sozinho.',
  animes: 'Os animes do momento e os que marcaram época.',
  doramas: 'Romance, drama e suspense da Coreia, do Japão e da China.',
  extra: 'Catálogo adulto reservado e protegido por senha.',
};

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Mn}+/gu, '').toLowerCase();
}

function nomeDaFonte(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Servidor alternativo';
  }
}

function agruparEpisodios(lista: Episodio[]): EpisodioAgrupado[] {
  const mapa = new Map<string, EpisodioAgrupado>();
  for (const episodio of lista) {
    const chave = `${episodio.temporada}:${episodio.numero}`;
    let atual = mapa.get(chave);
    if (!atual) {
      atual = { temporada: episodio.temporada, numero: episodio.numero, fontes: [], versoes: [] };
      mapa.set(chave, atual);
    }
    if (episodio.versao && !atual.versoes.includes(episodio.versao)) atual.versoes.push(episodio.versao);
    for (const url of episodio.urls) {
      if (!atual.fontes.some((fonte) => fonte.url === url)) {
        atual.fontes.push({ url, versao: episodio.versao });
      }
    }
  }
  return [...mapa.values()]
    .map((episodio) => ({ ...episodio, fontes: httpsFirst(episodio.fontes) }))
    .sort((a, b) => a.temporada - b.temporada || a.numero - b.numero);
}

export function VodCatalog({
  onSelectMovie,
  onBack,
  playerOpen = false,
  activeMovie = null,
  isAdultUnlocked,
}: VodCatalogProps) {
  const local = useLocation();
  const navegar = useNavigate();

  // Seção ativa: null é a página raiz On Demand, ou categoria específica
  const [secao, setSecao] = useState<Secao | null>(null);
  // Modo de exibição: 'fileiras' (carrosséis como no Mac) ou 'explorar' (grade A-Z)
  const [modo, setModo] = useState<'fileiras' | 'explorar'>('fileiras');
  const [generoFiltro, setGeneroFiltro] = useState<string>('');
  const [letraFiltro, setLetraFiltro] = useState<string>('A');
  const [termoBusca, setTermoBusca] = useState<string>('');

  // Favoritos
  const [, setMarcaFav] = useState(0);
  useEffect(() => aoMudarFavoritos(() => setMarcaFav((n) => n + 1)), []);

  // Catálogos e metadados
  const [filasDestaque, setFilasDestaque] = useState<FilaDestaque[]>([]);
  const [generos, setGeneros] = useState<Generos | null>(null);
  const [gavetas, setGavetas] = useState<Gaveta[]>([]);
  const [todosFilmes, setTodosFilmes] = useState<Achado[]>([]);
  const [todasSeries, setTodasSeries] = useState<Achado[]>([]);
  const [animesColecao, setAnimesColecao] = useState<SerieColecao[]>([]);
  const [doramasColecao, setDoramasColecao] = useState<SerieColecao[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);

  // Item atualmente sob o cursor do mouse para o Hero Destaque
  const [itemSobMouse, setItemSobMouse] = useState<ItemDestaque | null>(null);
  const fichaSobMouse = useFichaDe(itemSobMouse);
  const timerLimparMouse = useRef<number | null>(null);

  const passarItem = useCallback((item: ItemDestaque | null) => {
    if (timerLimparMouse.current) {
      window.clearTimeout(timerLimparMouse.current);
      timerLimparMouse.current = null;
    }
    if (item) {
      setItemSobMouse(item);
    } else {
      timerLimparMouse.current = window.setTimeout(() => {
        setItemSobMouse(null);
      }, 350);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerLimparMouse.current) window.clearTimeout(timerLimparMouse.current);
    };
  }, []);

  // Título e Modais
  const [aberto, setAberto] = useState<Item | null>(null);
  const [episodiosAbertos, setEpisodiosAbertos] = useState<Episodio[] | null>(null);
  const [fontesAbertas, setFontesAbertas] = useState<MovieSource[] | null>(null);
  const [modalCarregando, setModalCarregando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [temporada, setTemporada] = useState(0);
  const [ultimoEpisodioId, setUltimoEpisodioId] = useState<string | null>(null);
  const [detalhesTemporada, setDetalhesTemporada] = useState<Record<number, EpisodioTmdb>>({});
  const [versaoFiltro, setVersaoFiltro] = useState<string>('todas');
  const trilhaEpisodiosRef = useRef<HTMLDivElement | null>(null);
  const janelaRef = useRef<HTMLElement | null>(null);
  const subBarraPillsRef = useRef<HTMLDivElement | null>(null);
  const aberturaRef = useRef(0);

  // Rolagem suave da pílula ativa na barra de categorias do catálogo
  useEffect(() => {
    const el = subBarraPillsRef.current?.querySelector<HTMLButtonElement>('.vod-sub-pill.ativa');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [secao]);

  // Sincronizar se o modo adulto for bloqueado durante a navegação
  if (!isAdultUnlocked && secao === 'extra') {
    setSecao(null);
  }

  // Ficha do título aberto
  const [fichaAchada, setFichaAchada] = useState<{ chave: string; ficha: Ficha | null } | null>(null);
  // Ator aberto (filmografia)
  const [ator, setAtor] = useState<Pessoa | null>(null);
  const [filmografiaAchada, setFilmografiaAchada] = useState<{ ator: number; lista: Trabalho[] } | null>(null);
  const [perfilAchado, setPerfilAchado] = useState<{ ator: number; perfil: Perfil | null } | null>(null);

  // Rolar modal para o topo sempre que abrir novo título
  useEffect(() => {
    if (aberto) {
      janelaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [aberto]);

  // Paginação da Grade A-Z sem efeito cascata
  const filtroAtual = `${secao || 'ondemand'}:${generoFiltro}:${letraFiltro}:${termoBusca.trim()}:${modo}`;
  const [pagina, setPagina] = useState({ filtro: '', quantos: PAGINA });
  const visiveis = pagina.filtro === filtroAtual ? pagina.quantos : PAGINA;
  const sentinelaRef = useRef<HTMLDivElement | null>(null);

  // Abertura de Item
  const abrirItem = useCallback(async (item: Item) => {
    setErroModal(null);
    setAberto(item);
    setEpisodiosAbertos(null);
    setFontesAbertas(null);
    setModalCarregando(true);
    const tentativa = ++aberturaRef.current;

    try {
      if (!item.serie) {
        const dados =
          item.filme ??
          (await buscarFilme({
            titulo: item.titulo,
            serie: false,
            letra: item.letra,
            ano: '',
            nomeCompleto: item.titulo,
          }));
        const fontes: MovieSource[] = Object.entries(dados?.fontes ?? {}).flatMap(([versao, urls]) =>
          urls.map((url) => ({ url, versao })),
        );
        if (tentativa !== aberturaRef.current) return;
        setFontesAbertas(httpsFirst(fontes));
        if (!fontes.length) setErroModal(`Sem fonte disponível para "${item.titulo}".`);
        return;
      }

      if (item.colecao) {
        setEpisodiosAbertos(item.colecao.episodios);
        setTemporada(item.colecao.episodios[0]?.temporada ?? 1);
        return;
      }

      const ano = item.dados?.ano ?? item.ano ?? '';
      const dados =
        item.dados ??
        (await buscarSerie({
          titulo: item.titulo,
          serie: true,
          letra: item.letra,
          ano,
          nomeCompleto: item.rotulo,
        }));
      if (tentativa !== aberturaRef.current) return;
      if (!dados) {
        setErroModal(`Não foi possível abrir "${item.rotulo}".`);
        return;
      }
      setAberto({ ...item, dados });
      const lista = await episodios(item.letra, dados);
      if (tentativa !== aberturaRef.current) return;
      setEpisodiosAbertos(lista);
      setTemporada(lista[0]?.temporada ?? 1);
      if (!lista.length) setErroModal('Nenhum episódio encontrado.');
    } catch {
      if (tentativa === aberturaRef.current) setErroModal(`Não foi possível abrir "${item.rotulo}".`);
    } finally {
      if (tentativa === aberturaRef.current) setModalCarregando(false);
    }
  }, []);

  const abrirItemDestaque = useCallback(
    async (destaqueItem: ItemDestaque) => {
      const serie = destaqueItem.tipo !== 'f';
      const base: Item = {
        chave: `${destaqueItem.tipo}:${destaqueItem.titulo}`,
        titulo: destaqueItem.titulo,
        rotulo: destaqueItem.titulo,
        serie,
        letra: destaqueItem.letra,
        ano: destaqueItem.ano,
      };

      if (destaqueItem.tipo !== 'a' && destaqueItem.tipo !== 'd') {
        await abrirItem(base);
        return;
      }

      const tipoColecao = destaqueItem.tipo === 'a' ? 'animes' : 'doramas';
      setAberto(base);
      setModalCarregando(true);
      setErroModal(null);
      try {
        const lista = await colecao(tipoColecao);
        const achada = lista.find((s) => normalizar(s.titulo) === normalizar(destaqueItem.titulo));
        if (!achada) {
          setErroModal(`Não foi possível abrir "${destaqueItem.titulo}".`);
          return;
        }
        await abrirItem({
          ...base,
          chave: `${tipoColecao}:${achada.tmdbId}:${achada.titulo}`,
          rotulo: achada.titulo,
          colecao: achada,
        });
      } catch {
        setErroModal(`Não foi possível abrir "${destaqueItem.titulo}".`);
      } finally {
        setModalCarregando(false);
      }
    },
    [abrirItem],
  );

  // Carga inicial dos arquivos do repositório (otimizada para Smart TVs fracas)
  useEffect(() => {
    let vivo = true;

    // 1. Destaques principais (arquivo pequeno): mostra a tela quase instantaneamente!
    destaques()
      .then((filas) => {
        if (!vivo) return;
        setFilasDestaque(filas);
        setCarregandoDados(false);
      })
      .catch(() => {
        if (vivo) setCarregandoDados(false);
      });

    // 2. Metadados de coleções, gêneros e gavetas carregam em segundo plano
    Promise.all([
      lerGeneros().catch(() => null),
      indice().catch(() => []),
      colecao('animes').catch(() => []),
      colecao('doramas').catch(() => []),
    ]).then(([gen, gav, animes, doramas]) => {
      if (!vivo) return;
      if (gen) setGeneros(gen);
      setGavetas(gav);
      setAnimesColecao(animes);
      setDoramasColecao(doramas);
    });

    // 3. Carga do índice completo de busca (30k títulos) postergada para não concorrer com as capas
    const timerBusca = setTimeout(() => {
      if (!vivo) return;
      listarTudo(false).then((lista) => { if (vivo) setTodosFilmes(lista); });
      listarTudo(true).then((lista) => { if (vivo) setTodasSeries(lista); });
    }, 350);

    return () => {
      vivo = false;
      clearTimeout(timerBusca);
    };
  }, []);

  // Totais para exibição nos cartões de categoria e Hero
  const contagens = useMemo(() => {
    const totalFilmes = gavetas.reduce((acc, g) => acc + (g.filmes || 0), 0) || todosFilmes.length || 24500;
    const totalSeries = gavetas.reduce((acc, g) => acc + (g.series || 0), 0) || todasSeries.length || 7200;
    const totalAnimes = animesColecao.length || 1050;
    const totalDoramas = doramasColecao.length || 580;
    const totalExtras = gavetas.reduce((acc, g) => acc + (g.reservados || 0), 0);
    const totalGeral = totalFilmes + totalSeries + totalAnimes + totalDoramas;
    return {
      totalGeral,
      filmes: totalFilmes,
      series: totalSeries,
      animes: totalAnimes,
      doramas: totalDoramas,
      extra: totalExtras,
    };
  }, [gavetas, todosFilmes.length, todasSeries.length, animesColecao.length, doramasColecao.length]);

  // Imagens para mosaico de capas das seções
  const colagens = useMemo(() => {
    const todosDestaques = filasDestaque.flatMap((f) => f.itens);
    const pegarCapas = (tipoChar: string) => {
      const comCapa = todosDestaques.filter((i) => i.tipo === tipoChar && i.capa);
      const unicos = [...new Set(comCapa.map((i) => i.capa))];
      if (unicos.length >= 4) return unicos.slice(0, 4);
      // Fallback seguro caso as fileiras de destaque não contenham o tipo
      if (tipoChar === 's' && unicos.length === 0) {
        return [
          'https://image.tmdb.org/t/p/w342/dx28DE7EgLy0FatOvnaUg0k9j92.jpg',
          'https://image.tmdb.org/t/p/w342/rOYLWCdAifpUtPlTf1WHxyaxeMt.jpg',
          'https://image.tmdb.org/t/p/w342/3f7lVELRz23j4GOEh3419UyR3XA.jpg',
          'https://image.tmdb.org/t/p/w342/rdNvIaPXpkUZl5tQLsTP15osfu2.jpg',
        ];
      }
      return unicos.slice(0, 4);
    };
    return {
      filmes: pegarCapas('f'),
      series: pegarCapas('s'),
      animes: pegarCapas('a'),
      doramas: pegarCapas('d'),
      extra: [],
    };
  }, [filasDestaque]);

  // Fileiras de Gênero dinâmicas (100% igual ao macOS TelasDoAcervo.swift:301-325)
  const fileirasDeGenero = useMemo(() => {
    if (!generos) return [];

    const ehSerie = secao === 'series';
    const listaBase = ehSerie ? todasSeries : todosFilmes;

    const generosAlvo = (secao === null)
      ? GENEROS_ON_DEMAND
      : ORDEM_GENEROS.filter((g) => generos.todos.includes(g));

    const out: { titulo: string; genero: string; itens: ItemDestaque[] }[] = [];

    if (secao === 'animes') {
      for (const g of generosAlvo) {
        const doGenero = animesColecao
          .filter((s) => temGenero(generos, s.titulo, true, g))
          .map((s) => ({
            tipo: 'a',
            titulo: s.titulo,
            letra: '#',
            ano: s.ano,
            capa: capaDaFicha(generos, s.titulo, true) || '',
          }))
          .filter((s) => !!s.capa)
          .slice(0, 25);
        if (doGenero.length >= 4) {
          out.push({
            titulo: g,
            genero: g,
            itens: doGenero,
          });
        }
      }
      return out;
    }

    if (secao === 'doramas') {
      for (const g of generosAlvo) {
        const doGenero = doramasColecao
          .filter((s) => temGenero(generos, s.titulo, true, g))
          .map((s) => ({
            tipo: 'd',
            titulo: s.titulo,
            letra: '#',
            ano: s.ano,
            capa: capaDaFicha(generos, s.titulo, true) || '',
          }))
          .filter((s) => !!s.capa)
          .slice(0, 25);
        if (doGenero.length >= 4) {
          out.push({
            titulo: g,
            genero: g,
            itens: doGenero,
          });
        }
      }
      return out;
    }

    if (!listaBase.length) return [];

    const tipoLetra = ehSerie ? 's' : 'f';
    const prefixoTitulo = secao === null ? 'Filmes de ' : '';

    // Otimização extrema para TV: UMA ÚNICA PASSADA com early break assim que preencher as cotas
    const generosValidos = generosAlvo.filter((g) => generos.todos.includes(g));
    const baldes: Record<string, ItemDestaque[]> = {};
    for (const g of generosValidos) baldes[g] = [];

    const COTA = 25;
    let pendentes = generosValidos.length;

    for (let i = 0; i < listaBase.length; i++) {
      const item = listaBase[i];
      let capaCache: string | null | undefined = undefined;

      for (const g of generosValidos) {
        if (baldes[g].length >= COTA) continue;
        if (temGenero(generos, item.titulo, ehSerie, g)) {
          if (capaCache === undefined) {
            capaCache = capaDaFicha(generos, item.titulo, ehSerie) || '';
          }
          if (capaCache) {
            baldes[g].push({
              tipo: tipoLetra,
              titulo: item.titulo,
              letra: item.letra,
              ano: item.ano,
              capa: capaCache,
            });
            if (baldes[g].length === COTA) {
              pendentes--;
            }
          }
        }
      }
      if (pendentes <= 0) break;
    }

    for (const g of generosValidos) {
      if (baldes[g].length >= 4) {
        out.push({
          titulo: prefixoTitulo ? `${prefixoTitulo}${g.toLowerCase()}` : g,
          genero: g,
          itens: baldes[g],
        });
      }
    }

    return out;
  }, [generos, secao, todasSeries, todosFilmes, animesColecao, doramasColecao]);

  // Itens em andamento ("Continue assistindo")
  const itensAndamento = useMemo(() => {
    const lista = listaAndamento();
    if (!lista.length) return [];
    return lista
      .filter((a) => {
        if (!secao) return true;
        if (secao === 'filmes') return a.origem.tipo === 'f';
        if (secao === 'series') return a.origem.tipo === 's';
        if (secao === 'animes') return a.origem.tipo === 'a';
        if (secao === 'doramas') return a.origem.tipo === 'd';
        return true;
      })
      .map((a) => ({
        ...a.origem,
        capa: a.origem.capa || (generos ? capaDaFicha(generos, a.origem.titulo, a.origem.tipo !== 'f') ?? '' : ''),
        progresso: a.fracao,
        subtitulo: a.rotulo,
      }));
  }, [secao, generos]);

  // Hero Destaque: título, selos e sinopse
  const heroiAtual = useMemo(() => {
    if (itemSobMouse) {
      const tituloLimpo = semAno(itemSobMouse.titulo);
      const selos: string[] = [];
      if (fichaSobMouse?.nota && fichaSobMouse.nota > 0) selos.push(`★ ${fichaSobMouse.nota.toFixed(1)}`);
      if (itemSobMouse.ano) selos.push(itemSobMouse.ano);
      if (fichaSobMouse?.duracao) {
        const d = fichaSobMouse.duracao;
        selos.push(itemSobMouse.tipo !== 'f' ? `${d} min/ep` : d >= 60 ? `${Math.floor(d / 60)}h ${d % 60}m` : `${d} min`);
      }
      if (fichaSobMouse?.temporadas) selos.push(`${fichaSobMouse.temporadas} temporada${fichaSobMouse.temporadas > 1 ? 's' : ''}`);
      if (fichaSobMouse?.generos?.length) selos.push(...fichaSobMouse.generos.slice(0, 3));

      return {
        titulo: tituloLimpo,
        selos: selos.length ? selos : [itemSobMouse.tipo === 's' ? 'Série' : itemSobMouse.tipo === 'a' ? 'Anime' : itemSobMouse.tipo === 'd' ? 'Dorama' : 'Filme'],
        sinopse: fichaSobMouse?.sinopse || '',
      };
    }

    // Estado Padrão Idle
    if (!secao) {
      return {
        titulo: 'On Demand',
        selos: [`${contagens.totalGeral.toLocaleString('pt-BR')} títulos`],
        sinopse: 'Filmes, séries, animes e doramas. Lançamentos, clássicos e produções completas.',
      };
    }

    const nome = secao === 'filmes' ? 'Filmes' : secao === 'series' ? 'Séries' : secao === 'animes' ? 'Animes' : secao === 'doramas' ? 'Doramas' : '18+ Adulto';
    const total = contagens[secao] || 0;
    return {
      titulo: nome,
      selos: [`${total.toLocaleString('pt-BR')} títulos`],
      sinopse: SOBRE_SECAO[secao] || '',
    };
  }, [itemSobMouse, fichaSobMouse, secao, contagens]);

  // Fundo de cinema dinâmico: nunca usa capa vertical de poster como fundo!
  // Carrega apenas fundos 16:9 legítimos do TMDB, pré-carregados para evitar flash.
  const backdropPadrao = useMemo(() => {
    if (!secao) return colagens.filmes[0] || null;
    return colagens[secao]?.[0] || colagens.filmes[0] || null;
  }, [secao, colagens]);

  const [backdropSobMouse, setBackdropSobMouse] = useState<string | null>(null);

  // Pré-carrega o fundo 16:9 do TMDB quando a ficha chegar
  useEffect(() => {
    if (!itemSobMouse || !fichaSobMouse?.fundo) return;
    let ativo = true;
    const url = fichaSobMouse.fundo;
    const img = new Image();
    img.src = url;
    img.onload = () => {
      if (ativo) setBackdropSobMouse(url);
    };
    return () => { ativo = false; };
  }, [itemSobMouse, fichaSobMouse]);

  // Se o usuário está sobre um item e já carregou o backdrop 16:9 do TMDB, exibe-o sem blur;
  // senão, exibe o backdrop padrão suave/ambient da seção.
  const backdropAtivo = itemSobMouse && backdropSobMouse ? backdropSobMouse : backdropPadrao;
  const backdropIsIdle = !itemSobMouse || !backdropSobMouse;

  // Abertura de títulos vindos do histórico de navegação
  useEffect(() => {
    const st = local.state as { abrir?: ItemDestaque; aba?: Secao; secao?: Secao } | null;
    if (!st || (!st.abrir && !st.aba && !st.secao)) return;
    const id = window.setTimeout(() => {
      if (st.secao) setSecao(st.secao);
      else if (st.aba) setSecao(st.aba);
      if (st.abrir) void abrirItemDestaque(st.abrir);
      navegar(local.pathname, { replace: true, state: null });
    }, 0);
    return () => window.clearTimeout(id);
  }, [local.state, local.pathname, navegar, abrirItemDestaque]);

  // Observer do sentinela da grade
  useEffect(() => {
    const alvo = sentinelaRef.current;
    if (!alvo || modo !== 'explorar') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPagina((atual) => ({
            filtro: filtroAtual,
            quantos: (atual.filtro === filtroAtual ? atual.quantos : PAGINA) + PAGINA,
          }));
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(alvo);
    return () => observer.disconnect();
  }, [filtroAtual, modo]);


  // Ficha do título aberto
  const [tmdbFallbackId, setTmdbFallbackId] = useState<number | null>(null);
  const idFicha = aberto && generos ? idDaFicha(generos, aberto.titulo, aberto.serie) : null;
  const idEfetivo = idFicha ?? tmdbFallbackId;
  const chaveFicha = aberto && idEfetivo ? `${aberto.serie ? 's' : 'f'}:${idEfetivo}` : null;
  const ficha = chaveFicha && fichaAchada?.chave === chaveFicha ? fichaAchada.ficha : null;

  useEffect(() => {
    setTmdbFallbackId(null);
  }, [aberto?.chave]);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    if (idFicha) {
      const k = `${aberto.serie ? 's' : 'f'}:${idFicha}`;
      buscarFicha(idFicha, aberto.serie)
        .then((achada) => { if (vivo) setFichaAchada({ chave: k, ficha: achada }); })
        .catch(() => { if (vivo) setFichaAchada({ chave: k, ficha: null }); });
    } else {
      // Fallback: se não estiver no fichas.txt, busca dinamicamente pelo título no TMDB
      melhorMatch(aberto.titulo, aberto.serie ? 'tv' : 'movie')
        .then(async (match) => {
          if (!vivo || !match?.resultado?.id) return;
          const novoId = match.resultado.id;
          setTmdbFallbackId(novoId);
          const f = await buscarFicha(novoId, aberto.serie);
          if (vivo) setFichaAchada({ chave: `${aberto.serie ? 's' : 'f'}:${novoId}`, ficha: f });
        })
        .catch(() => {});
    }
    return () => { vivo = false; };
  }, [aberto, idFicha]);

  // Filmografia do Ator
  useEffect(() => {
    if (!ator || !generos) return;
    let vivo = true;
    const idAtor = ator.id;
    buscarPerfil(idAtor).then((achado) => { if (vivo) setPerfilAchado({ ator: idAtor, perfil: achado }); });

    (async () => {
      const creditos = await creditosDe(idAtor);
      const [comFilmes, comSeries] = await Promise.all([listarTudo(false), listarTudo(true)]);
      if (!vivo) return;

      const porNome = new Map<string, Achado>();
      for (const achado of [...comFilmes, ...comSeries]) {
        porNome.set(`${achado.serie ? 's' : 'f'}|${achado.titulo}`, achado);
      }

      const vistos = new Set<string>();
      const saida: Trabalho[] = [];
      for (const credito of creditos) {
        const titulo = tituloDoId(generos, credito.id, credito.serie);
        if (!titulo) continue;
        const marca = credito.serie ? 's' : 'f';
        const achado = porNome.get(`${marca}|${titulo}`) ?? porNome.get(`${marca}|${semAno(titulo)}`);
        if (!achado) continue;
        const chave = `${marca}:${achado.letra}:${achado.titulo}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        saida.push({
          item: {
            chave,
            titulo: achado.titulo,
            rotulo: achado.nomeCompleto || achado.titulo,
            serie: achado.serie,
            letra: achado.letra,
            ano: achado.ano,
          },
          capa: credito.capa ?? capaDaFicha(generos, achado.titulo, achado.serie),
          papel: credito.papel,
        });
      }
      setFilmografiaAchada({ ator: idAtor, lista: saida });
    })();

    return () => { vivo = false; };
  }, [ator, generos]);

  const fecharModal = useCallback(() => {
    aberturaRef.current += 1;
    setAberto(null);
    setEpisodiosAbertos(null);
    setFontesAbertas(null);
    setErroModal(null);
    setModalCarregando(false);
    setAtor(null);
  }, []);

  const fecharAtor = useCallback(() => setAtor(null), []);
  useVoltarFecha(!!aberto, fecharModal);
  useVoltarFecha(!!ator, fecharAtor);

  // Reproduzir filme
  const tocarFilme = useCallback(
    (titulo: string, fontes: MovieSource[], escolhida?: string) => {
      const ordenadas = httpsFirst(fontes);
      const primeira = escolhida ?? ordenadas[0]?.url;
      if (!primeira) return;
      const origem = aberto ? {
        tipo: aberto.chave.startsWith('animes') ? 'a' : aberto.chave.startsWith('doramas') ? 'd' : aberto.serie ? 's' : 'f',
        titulo: aberto.titulo,
        letra: aberto.letra,
        ano: aberto.ano ?? '',
        capa: (generos && capaDaFicha(generos, aberto.titulo, aberto.serie)) || '',
      } : undefined;

      onSelectMovie(
        {
          tmdbId: (generos && idDaFicha(generos, titulo, false)) || tmdbFallbackId || undefined,
          origem,
          id: `movie-${titulo}-${primeira}`.slice(0, 200),
          name: titulo,
          url: primeira,
          sources: ordenadas,
          initialSourceUrl: escolhida,
          category: 'Filmes',
          type: 'movie',
        },
        null,
      );
    },
    [onSelectMovie, generos, aberto],
  );

  // Reproduzir episódio de série
  const episodiosAgrupados = useMemo(() => agruparEpisodios(episodiosAbertos ?? []), [episodiosAbertos]);
  const temporadas = useMemo(
    () => [...new Set(episodiosAgrupados.map((e) => e.temporada))].sort((a, b) => a - b),
    [episodiosAgrupados],
  );

  const filmesDaSerie = useMemo<Movie[]>(() => {
    if (!aberto?.serie) return [];
    return episodiosAgrupados.map((e) => ({
      id: `series-${aberto.chave}-s${e.temporada}e${e.numero}`,
      name: `${aberto.rotulo} · T${e.temporada}:E${e.numero}`,
      url: e.fontes[0]?.url ?? '',
      sources: e.fontes,
      category: 'Séries',
      type: 'series' as const,
      seriesName: aberto.rotulo,
      seasonNumber: e.temporada,
      episodeNumber: e.numero,
      tmdbId: (generos && idDaFicha(generos, aberto.titulo, true)) || tmdbFallbackId || undefined,
      origem: {
        tipo: aberto.chave.startsWith('animes') ? 'a' : aberto.chave.startsWith('doramas') ? 'd' : 's',
        titulo: aberto.titulo,
        letra: aberto.letra,
        ano: aberto.ano ?? '',
        capa: (generos && capaDaFicha(generos, aberto.titulo, true)) || '',
      },
    })).filter((m) => !!m.url);
  }, [aberto, episodiosAgrupados, generos]);

  const tocarEpisodio = useCallback(
    (episodio: EpisodioAgrupado) => {
      if (!aberto) return;
      const movie = filmesDaSerie.find(
        (m) => m.seasonNumber === episodio.temporada && m.episodeNumber === episodio.numero,
      );
      if (!movie) return;
      setTemporada(episodio.temporada);
      setUltimoEpisodioId(movie.id);
      const info: SeriesEpisodeInfo = {
        currentEpisode: episodio.numero,
        currentSeason: episodio.temporada,
        totalEpisodes: filmesDaSerie.length,
        episodes: filmesDaSerie,
        seriesName: aberto.rotulo,
      };
      onSelectMovie(movie, info);
    },
    [aberto, filmesDaSerie, onSelectMovie],
  );

  // Onde continuar na série
  const partidaSerie = useMemo(() => {
    if (!aberto?.serie || !episodiosAgrupados.length) return null;
    const andamento = listaAndamento();
    const itemAndamento = andamento.find((a) => a.origem.titulo === aberto.titulo);
    if (itemAndamento) {
      const match = /T(\d+)[:\s]E(\d+)/i.exec(itemAndamento.rotulo);
      if (match) {
        const t = Number(match[1]);
        const n = Number(match[2]);
        const achou = episodiosAgrupados.find((e) => e.temporada === t && e.numero === n);
        if (achou) return { temporada: t, numero: n, comecado: true };
      }
    }
    const primeiro = episodiosAgrupados[0];
    return primeiro ? { temporada: primeiro.temporada, numero: primeiro.numero, comecado: false } : null;
  }, [aberto, episodiosAgrupados]);

  const temporadaAtiva = temporada > 0 && temporadas.includes(temporada)
    ? temporada
    : (partidaSerie?.temporada ?? temporadas[0] ?? 1);

  // Detalhes dos episódios da temporada (TMDB)
  const idTmdbAberto = aberto && generos ? (idDaFicha(generos, aberto.titulo, aberto.serie) ?? tmdbFallbackId) : (tmdbFallbackId ?? null);
  useEffect(() => {
    if (!aberto?.serie || !idTmdbAberto || temporadaAtiva <= 0) return;
    let cancelado = false;
    episodiosDaTemporada(idTmdbAberto, temporadaAtiva)
      .then((lista) => {
        if (cancelado) return;
        const mapa: Record<number, EpisodioTmdb> = {};
        for (const ep of lista) mapa[ep.numero] = ep;
        setDetalhesTemporada(mapa);
      })
      .catch(() => { if (!cancelado) setDetalhesTemporada({}); });
    return () => { cancelado = true; };
  }, [aberto, idTmdbAberto, temporadaAtiva]);

  // Rolar início da trilha de episódios ao mudar de temporada
  useEffect(() => {
    trilhaEpisodiosRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [temporadaAtiva]);

  // Lista da temporada ativa
  const episodiosDaTempAtiva = useMemo(() => {
    const daTemp = episodiosAgrupados.filter((e) => e.temporada === temporadaAtiva);
    if (versaoFiltro === 'todas') return daTemp;
    return daTemp.filter((e) => e.versoes.includes(versaoFiltro));
  }, [episodiosAgrupados, temporadaAtiva, versaoFiltro]);

  const versoesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    for (const ep of episodiosAgrupados) {
      for (const v of ep.versoes) s.add(v);
    }
    return [...s].sort((a, b) => (a === 'leg' ? 1 : 0) - (b === 'leg' ? 1 : 0));
  }, [episodiosAgrupados]);

  // Itens da grade de busca / explorar
  const [buscaAchados, setBuscaAchados] = useState<Achado[]>([]);
  const buscaAtiva = termoBusca.trim().length >= 2;
  useEffect(() => {
    const termo = termoBusca.trim();
    if (termo.length < 2) return;
    let vivo = true;
    const espera = setTimeout(() => {
      buscar(termo).then((res) => { if (vivo && res) setBuscaAchados(res); });
    }, 200);
    return () => { vivo = false; clearTimeout(espera); };
  }, [termoBusca]);

  // Itens para a Grade Explorar
  const itensGrade = useMemo<Item[]>(() => {
    if (buscaAtiva) {
      return buscaAchados
        .filter((a) => {
          if (!secao) return true;
          if (secao === 'filmes') return !a.serie;
          if (secao === 'series') return a.serie;
          return true;
        })
        .map((a) => ({
          chave: `${a.serie ? 's' : 'f'}:${a.titulo}:${a.ano}`,
          titulo: a.titulo,
          rotulo: a.nomeCompleto || a.titulo,
          serie: a.serie,
          letra: a.letra,
          ano: a.ano,
        }));
    }

    if (secao === 'animes') {
      return animesColecao
        .filter((s) => !generoFiltro || temGenero(generos!, s.titulo, true, generoFiltro))
        .map((s) => ({
          chave: `animes:${s.tmdbId}:${s.titulo}`,
          titulo: s.titulo,
          rotulo: s.nomeCompleto,
          serie: true,
          letra: '#',
          ano: s.ano,
          colecao: s,
        }));
    }

    if (secao === 'doramas') {
      return doramasColecao
        .filter((s) => !generoFiltro || temGenero(generos!, s.titulo, true, generoFiltro))
        .map((s) => ({
          chave: `doramas:${s.tmdbId}:${s.titulo}`,
          titulo: s.titulo,
          rotulo: s.nomeCompleto,
          serie: true,
          letra: '#',
          ano: s.ano,
          colecao: s,
        }));
    }

    const base = secao === 'series' ? todasSeries : todosFilmes;
    let filtrados = base;
    if (letraFiltro) {
      filtrados = filtrados.filter((a) => a.letra === letraFiltro);
    }
    if (generoFiltro && generos) {
      filtrados = filtrados.filter((a) => temGenero(generos, a.titulo, secao === 'series', generoFiltro));
    }
    return filtrados.map((a) => ({
      chave: `${a.serie ? 's' : 'f'}:${a.titulo}:${a.ano}`,
      titulo: a.titulo,
      rotulo: a.nomeCompleto || a.titulo,
      serie: a.serie,
      letra: a.letra,
      ano: a.ano,
    }));
  }, [buscaAtiva, buscaAchados, secao, animesColecao, doramasColecao, todasSeries, todosFilmes, letraFiltro, generoFiltro, generos]);

  return (
    <div className="vod-catalog">
      {/* ── Fundo Do Destaque (Cinema Backdrop) ── */}
      <div className="vod-fundo-destaque" aria-hidden="true">
        {backdropAtivo && (
          <img
            key={backdropAtivo}
            src={backdropAtivo}
            alt=""
            referrerPolicy="no-referrer"
            className={backdropIsIdle ? 'idle' : ''}
          />
        )}
        <div className="vod-fundo-destaque-veu-horiz" />
        <div className="vod-fundo-destaque-veu-vert" />
      </div>

      {/* ── Hero Destaque Topo (DestaqueTopo) ── */}
      <header className="vod-destaque-topo">
        <h1 className="vod-destaque-titulo" title={heroiAtual.titulo}>
          {heroiAtual.titulo}
        </h1>
        <div className="vod-destaque-meta">
          {heroiAtual.selos.map((s, idx) => (
            <span key={idx} className={s.startsWith('★') ? 'com-nota' : ''}>
              {s}
            </span>
          ))}
        </div>
        <p className="vod-destaque-sinopse">
          {heroiAtual.sinopse || '\u00A0'}
        </p>
      </header>

      {/* ── Barra de Navegação / Sub-Categorias ── */}
      <nav className="vod-sub-barra" aria-label="Subcategorias do On Demand">
        <div className="vod-sub-barra-pills" ref={subBarraPillsRef}>
          {(secao !== null || modo === 'explorar') ? (
            <button
              className="vod-sub-pill vod-sub-pill-voltar"
              onClick={() => {
                if (modo === 'explorar' && secao === null) setModo('fileiras');
                else if (secao !== null) { setSecao(null); setModo('fileiras'); }
                else onBack();
              }}
              title="Voltar"
            >
              ‹ Voltar
            </button>
          ) : (
            <button
              className="vod-sub-pill vod-sub-pill-voltar"
              onClick={onBack}
              title="Voltar ao início"
            >
              ‹ Início
            </button>
          )}
          <button
            className={`vod-sub-pill${secao === null ? ' ativa' : ''}`}
            onClick={() => { setSecao(null); setModo('fileiras'); }}
          >
            On Demand
          </button>
          <button
            className={`vod-sub-pill${secao === 'filmes' ? ' ativa' : ''}`}
            onClick={() => { setSecao('filmes'); setModo('fileiras'); }}
          >
            Filmes
          </button>
          <button
            className={`vod-sub-pill${secao === 'series' ? ' ativa' : ''}`}
            onClick={() => { setSecao('series'); setModo('fileiras'); }}
          >
            Séries
          </button>
          <button
            className={`vod-sub-pill${secao === 'animes' ? ' ativa' : ''}`}
            onClick={() => { setSecao('animes'); setModo('fileiras'); }}
          >
            Animes
          </button>
          <button
            className={`vod-sub-pill${secao === 'doramas' ? ' ativa' : ''}`}
            onClick={() => { setSecao('doramas'); setModo('fileiras'); }}
          >
            Doramas
          </button>
          {isAdultUnlocked && (
            <button
              className={`vod-sub-pill${secao === 'extra' ? ' ativa' : ''}`}
              onClick={() => { setSecao('extra'); setModo('explorar'); }}
            >
              18+
            </button>
          )}
        </div>

        <div className="vod-sub-barra-acoes">
          <label className="vod-sub-busca" title="Buscar no catálogo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Buscar título…"
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value);
                if (e.target.value.trim().length >= 2) setModo('explorar');
              }}
            />
          </label>

          <button
            className={`vod-sub-btn-modo${modo === 'explorar' ? ' ativo' : ''}`}
            onClick={() => setModo((m) => (m === 'fileiras' ? 'explorar' : 'fileiras'))}
            title={modo === 'fileiras' ? 'Explorar grade A a Z' : 'Ver em fileiras'}
          >
            {modo === 'fileiras' ? 'A a Z 🔤' : 'Fileiras ▤'}
          </button>
        </div>
      </nav>

      {/* ── Exibição: FILEIRAS (Modo Principal) ── */}
      {modo === 'fileiras' && (
        <div className="vod-conteudo-fileiras">
          {/* Fileira 1: Categorias (Quando na raiz On Demand) */}
          {secao === null && (
            <section className="vod-fileira">
              <header className="vod-fileira-header">
                <h2>Categorias</h2>
              </header>
              <div className="vod-fileira-trilho-wrapper">
                <div className="vod-secoes-grid">
                  {/* Filmes Card */}
                  <button
                    className="vod-card-secao secao-filmes"
                    onClick={() => { setSecao('filmes'); setModo('fileiras'); }}
                    onMouseEnter={() => passarItem({ tipo: 'f', titulo: 'Filmes', letra: '#', ano: '', capa: colagens.filmes[0] || '' })}
                    onMouseLeave={() => passarItem(null)}
                  >
                    <div className="vod-card-secao-colagem">
                      {colagens.filmes.map((c, i) => (
                        <img key={i} src={c} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ))}
                    </div>
                    <div className="vod-card-secao-veu" />
                    <div className="vod-card-secao-info">
                      <div className="vod-card-secao-icone" style={{ background: '#4fe3d0' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 2v3h3V5H6zm5 0v3h3V5h-3zm5 0v3h3V5h-3zM4 10v4h16v-4H4zm2 6v3h3v-3H6zm5 0v3h3v-3h-3zm5 0v3h3v-3h-3z" />
                        </svg>
                      </div>
                      <div>
                        <h3>Filmes</h3>
                        <p>{contagens.filmes.toLocaleString('pt-BR')} títulos</p>
                      </div>
                    </div>
                  </button>

                  {/* Séries Card */}
                  <button
                    className="vod-card-secao secao-series"
                    onClick={() => { setSecao('series'); setModo('fileiras'); }}
                    onMouseEnter={() => passarItem({ tipo: 's', titulo: 'Séries', letra: '#', ano: '', capa: colagens.series[0] || '' })}
                    onMouseLeave={() => passarItem(null)}
                  >
                    <div className="vod-card-secao-colagem">
                      {colagens.series.map((c, i) => (
                        <img key={i} src={c} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ))}
                    </div>
                    <div className="vod-card-secao-veu" />
                    <div className="vod-card-secao-info">
                      <div className="vod-card-secao-icone" style={{ background: '#7aa2ff' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <rect x="2" y="7" width="20" height="15" rx="2" />
                          <polyline points="17 2 12 7 7 2" fill="none" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </div>
                      <div>
                        <h3>Séries</h3>
                        <p>{contagens.series.toLocaleString('pt-BR')} títulos</p>
                      </div>
                    </div>
                  </button>

                  {/* Animes Card */}
                  <button
                    className="vod-card-secao secao-animes"
                    onClick={() => { setSecao('animes'); setModo('fileiras'); }}
                    onMouseEnter={() => passarItem({ tipo: 'a', titulo: 'Animes', letra: '#', ano: '', capa: colagens.animes[0] || '' })}
                    onMouseLeave={() => passarItem(null)}
                  >
                    <div className="vod-card-secao-colagem">
                      {colagens.animes.map((c, i) => (
                        <img key={i} src={c} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ))}
                    </div>
                    <div className="vod-card-secao-veu" />
                    <div className="vod-card-secao-info">
                      <div className="vod-card-secao-icone" style={{ background: '#ffb454' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l2.4 7.2h7.6l-6.2 4.5 2.4 7.3-6.2-4.5-6.2 4.5 2.4-7.3-6.2-4.5h7.6z" />
                        </svg>
                      </div>
                      <div>
                        <h3>Animes</h3>
                        <p>{contagens.animes.toLocaleString('pt-BR')} títulos</p>
                      </div>
                    </div>
                  </button>

                  {/* Doramas Card */}
                  <button
                    className="vod-card-secao secao-doramas"
                    onClick={() => { setSecao('doramas'); setModo('fileiras'); }}
                    onMouseEnter={() => passarItem({ tipo: 'd', titulo: 'Doramas', letra: '#', ano: '', capa: colagens.doramas[0] || '' })}
                    onMouseLeave={() => passarItem(null)}
                  >
                    <div className="vod-card-secao-colagem">
                      {colagens.doramas.map((c, i) => (
                        <img key={i} src={c} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ))}
                    </div>
                    <div className="vod-card-secao-veu" />
                    <div className="vod-card-secao-info">
                      <div className="vod-card-secao-icone" style={{ background: '#ff7eb6' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                      <div>
                        <h3>Doramas</h3>
                        <p>{contagens.doramas.toLocaleString('pt-BR')} títulos</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Continue assistindo */}
          {itensAndamento.length > 0 && (
            <CarrosselFileira
              titulo="Continue assistindo"
              itens={itensAndamento}
              aoAbrir={abrirItemDestaque}
              aoPassar={passarItem}
            />
          )}

          {/* Destaques do catálogo (Filtrados por seção ou todos) */}
          {filasDestaque.map((fila, idx) => {
            const itensDaFila = secao
              ? fila.itens.filter((i) => (secao === 'filmes' ? i.tipo === 'f' : secao === 'series' ? i.tipo === 's' : secao === 'animes' ? i.tipo === 'a' : i.tipo === 'd'))
              : fila.itens;
            if (itensDaFila.length < 3) return null;
            const elemento = (
              <CarrosselFileira
                key={fila.titulo}
                titulo={fila.titulo}
                itens={itensDaFila}
                aoAbrir={abrirItemDestaque}
                aoPassar={passarItem}
              />
            );
            return idx < 2 ? elemento : <LazyFileira key={fila.titulo}>{elemento}</LazyFileira>;
          })}

          {/* Fileiras de Gênero dinâmicas com Lazy Loading (Filmes, Séries, Animes ou Doramas) */}
          {fileirasDeGenero.map((fg) => (
            <LazyFileira key={fg.genero}>
              <CarrosselFileira
                titulo={fg.titulo}
                itens={fg.itens}
                aoAbrir={abrirItemDestaque}
                aoPassar={passarItem}
                verTodos={() => {
                  if (secao === 'series') setSecao('series');
                  else if (secao === 'animes') setSecao('animes');
                  else if (secao === 'doramas') setSecao('doramas');
                  else setSecao('filmes');
                  setGeneroFiltro(fg.genero);
                  setModo('explorar');
                }}
                rotuloVerTodos={`Todos de ${fg.genero}`}
              />
            </LazyFileira>
          ))}

          {/* Seção Explorar de A a Z */}
          <section className="vod-fileira">
            <header className="vod-fileira-header">
              <h2>
                {secao === 'filmes'
                  ? 'Explorar Filmes de A a Z'
                  : secao === 'series'
                  ? 'Explorar Séries de A a Z'
                  : secao === 'animes'
                  ? 'Explorar Animes de A a Z'
                  : secao === 'doramas'
                  ? 'Explorar Doramas de A a Z'
                  : 'Explorar de A a Z'}
              </h2>
            </header>
            <div className="vod-secoes-grid">
              {(secao === null || secao === 'filmes') && (
                <button
                  className="vod-card-secao secao-az"
                  onClick={() => { setSecao('filmes'); setModo('explorar'); }}
                >
                  <div className="vod-card-secao-info">
                    <div className="vod-card-secao-icone" style={{ background: '#4fe3d0' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>A-Z</span>
                    </div>
                    <div>
                      <h3>Filmes de A a Z</h3>
                      <p>{contagens.filmes.toLocaleString('pt-BR')} títulos no índice</p>
                    </div>
                  </div>
                </button>
              )}

              {(secao === null || secao === 'series') && (
                <button
                  className="vod-card-secao secao-az"
                  onClick={() => { setSecao('series'); setModo('explorar'); }}
                >
                  <div className="vod-card-secao-info">
                    <div className="vod-card-secao-icone" style={{ background: '#7aa2ff' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>A-Z</span>
                    </div>
                    <div>
                      <h3>Séries de A a Z</h3>
                      <p>{contagens.series.toLocaleString('pt-BR')} temporadas completas</p>
                    </div>
                  </div>
                </button>
              )}

              {(secao === null || secao === 'animes') && (
                <button
                  className="vod-card-secao secao-az"
                  onClick={() => { setSecao('animes'); setModo('explorar'); }}
                >
                  <div className="vod-card-secao-info">
                    <div className="vod-card-secao-icone" style={{ background: '#ffb454' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>A-Z</span>
                    </div>
                    <div>
                      <h3>Animes de A a Z</h3>
                      <p>{contagens.animes.toLocaleString('pt-BR')} séries catalogadas</p>
                    </div>
                  </div>
                </button>
              )}

              {(secao === null || secao === 'doramas') && (
                <button
                  className="vod-card-secao secao-az"
                  onClick={() => { setSecao('doramas'); setModo('explorar'); }}
                >
                  <div className="vod-card-secao-info">
                    <div className="vod-card-secao-icone" style={{ background: '#ff7eb6' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>A-Z</span>
                    </div>
                    <div>
                      <h3>Doramas de A a Z</h3>
                      <p>{contagens.doramas.toLocaleString('pt-BR')} produções asiáticas</p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── Exibição: EXPLORAR / GRADE A-Z (Modo Grade) ── */}
      {modo === 'explorar' && (
        <div className="vod-conteudo-grade">
          {/* Barra de Letras A-Z */}
          {secao !== 'animes' && secao !== 'doramas' && (
            <div className="vod-letras-barra" role="tablist" aria-label="Letras do alfabeto">
              {LETRAS.map((l) => (
                <button
                  key={l}
                  className={`vod-letra-pill${letraFiltro === l ? ' ativa' : ''}`}
                  onClick={() => setLetraFiltro(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Barra de Gêneros */}
          {generos && generos.todos.length > 0 && (
            <div className="vod-generos-barra">
              <button
                className={`vod-genero-pill${generoFiltro === '' ? ' ativa' : ''}`}
                onClick={() => setGeneroFiltro('')}
              >
                Todos
              </button>
              {generos.todos.map((g) => (
                <button
                  key={g}
                  className={`vod-genero-pill${generoFiltro === g ? ' ativa' : ''}`}
                  onClick={() => setGeneroFiltro(generoFiltro === g ? '' : g)}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {/* Grade de Cartões */}
          <div className="vod-grade-cards">
            {itensGrade.slice(0, visiveis).map((item) => {
              const capaSrc = generos ? capaDaFicha(generos, item.titulo, item.serie) : null;
              const fav = ehFavorito({ tipo: item.serie ? 's' : 'f', titulo: item.titulo, letra: item.letra, ano: item.ano || '', capa: capaSrc || '' });
              return (
                <button
                  key={item.chave}
                  className="vod-card-poster"
                  onClick={() => abrirItem(item)}
                  onMouseEnter={() => passarItem({
                    tipo: item.serie ? 's' : 'f',
                    titulo: item.titulo,
                    letra: item.letra,
                    ano: item.ano || '',
                    capa: capaSrc || '',
                  })}
                  onMouseLeave={() => passarItem(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    alternarFavorito({
                      tipo: item.serie ? 's' : 'f',
                      titulo: item.titulo,
                      letra: item.letra,
                      ano: item.ano || '',
                      capa: capaSrc || '',
                    });
                  }}
                  title={item.rotulo}
                >
                  <div className="vod-card-poster-thumb">
                    {capaSrc ? (
                      <img src={capaSrc} alt={item.rotulo} loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="vod-poster-letra">{item.titulo.charAt(0)}</span>
                    )}
                    {fav && <span className="vod-badge-favorito">★</span>}
                  </div>
                  <strong className="vod-card-poster-nome">{item.rotulo}</strong>
                  {item.ano && <small className="vod-card-poster-ano">{item.ano}</small>}
                </button>
              );
            })}
          </div>

          <div ref={sentinelaRef} className="vod-sentinela" aria-hidden="true" />

          {itensGrade.length === 0 && !carregandoDados && (
            <p className="vod-aviso">Nenhum título encontrado com os filtros atuais.</p>
          )}
        </div>
      )}

      {/* ── MODAL FICHA DE FILME OU SÉRIE (FichaTela & SerieTela 100% macOS) ── */}
      {aberto && createPortal(
        <div
          className={`vod-modal-backdrop${playerOpen ? ' vod-modal-suspenso' : ''}`}
          onMouseDown={playerOpen ? undefined : fecharModal}
        >
          <section
            ref={janelaRef}
            className="vod-modal-janela"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {ator ? (
              /* Ator / Filmografia (AtorTela) */
              <div className="vod-ator-tela">
                <div className="vod-ator-barra">
                  <button className="vod-btn-voltar" onClick={() => setAtor(null)}>
                    ‹ Voltar à ficha
                  </button>
                  <button className="vod-btn-fechar" onClick={fecharModal} aria-label="Fechar">×</button>
                </div>
                <header className="vod-ator-topo">
                  <div className="vod-ator-foto">
                    {perfilAchado?.perfil?.foto || ator.foto ? (
                      <img src={perfilAchado?.perfil?.foto || ator.foto || ''} alt="" />
                    ) : (
                      <span aria-hidden="true">{ator.nome.charAt(0)}</span>
                    )}
                  </div>
                  <div className="vod-ator-dados">
                    <h2>{perfilAchado?.perfil?.nome || ator.nome}</h2>
                    {perfilAchado?.perfil?.dados && <p className="vod-ator-info-extra">{perfilAchado.perfil.dados}</p>}
                    {perfilAchado?.perfil?.biografia && <p className="vod-ator-biografia">{perfilAchado.perfil.biografia}</p>}
                  </div>
                </header>

                <h3 className="vod-ator-contagem">
                  {filmografiaAchada === null
                    ? 'Procurando obras no acervo…'
                    : filmografiaAchada.lista.length === 1
                    ? '1 título neste acervo'
                    : `${filmografiaAchada.lista.length} títulos neste acervo`}
                </h3>

                {filmografiaAchada?.lista && (
                  <div className="vod-ator-grade">
                    {filmografiaAchada.lista.map(({ item, capa, papel }) => (
                      <button
                        key={item.chave}
                        className="vod-card-poster"
                        onClick={() => { setAtor(null); abrirItem(item); }}
                      >
                        <div className="vod-card-poster-thumb">
                          {capa ? (
                            <img src={capa} alt="" loading="lazy" />
                          ) : (
                            <span className="vod-poster-letra">{item.titulo.charAt(0)}</span>
                          )}
                        </div>
                        <strong className="vod-card-poster-nome">{item.rotulo}</strong>
                        <small className="vod-card-poster-ano">{papel}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Ficha do Filme ou Série */
              <>
                <div className="vod-ficha-hero">
                  {ficha?.fundo && (
                    <img className="vod-ficha-hero-fundo" src={ficha.fundo} alt="" referrerPolicy="no-referrer" />
                  )}
                  <div className="vod-ficha-hero-veu" />
                  <button className="vod-btn-fechar" onClick={fecharModal} aria-label="Fechar">×</button>

                  <div className="vod-ficha-hero-corpo">
                    {/* Capa Vertical */}
                    <div className="vod-ficha-hero-capa">
                      {ficha?.capa || (generos ? capaDaFicha(generos, aberto.titulo, aberto.serie) : null) ? (
                        <img
                          src={ficha?.capa || capaDaFicha(generos!, aberto.titulo, aberto.serie) || ''}
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="vod-poster-letra-grande">{aberto.titulo.charAt(0)}</span>
                      )}
                    </div>

                    {/* Metadados e Ações */}
                    <div className="vod-ficha-hero-detalhes">
                      <span className="vod-ficha-tag-tipo">
                        {aberto.serie ? (aberto.chave.startsWith('animes') ? 'ANIME' : aberto.chave.startsWith('doramas') ? 'DORAMA' : 'SÉRIE') : 'FILME'}
                      </span>
                      <h2 className="vod-ficha-titulo">{semAno(aberto.titulo)}</h2>
                      {ficha?.frase && <p className="vod-ficha-frase">{ficha.frase}</p>}

                      <div className="vod-ficha-selos">
                        {ficha?.nota && ficha.nota > 0 ? (
                          <span className="vod-selo-nota">★ {ficha.nota.toFixed(1)}</span>
                        ) : null}
                        {ficha?.ano && <span className="vod-selo">{ficha.ano}</span>}
                        {ficha?.duracao ? (
                          <span className="vod-selo">
                            {aberto.serie ? `${ficha.duracao} min/ep` : ficha.duracao >= 60 ? `${Math.floor(ficha.duracao / 60)}h ${ficha.duracao % 60}m` : `${ficha.duracao} min`}
                          </span>
                        ) : null}
                        {aberto.serie && (ficha?.temporadas || temporadas.length) ? (
                          <span className="vod-selo">
                            {(ficha?.temporadas || temporadas.length)} temporada{(ficha?.temporadas || temporadas.length) > 1 ? 's' : ''}
                          </span>
                        ) : null}
                        {ficha?.classificacao && (
                          <span className="vod-selo vod-selo-classificacao">{ficha.classificacao}</span>
                        )}
                      </div>

                      {ficha?.generos && ficha.generos.length > 0 && (
                        <p className="vod-ficha-generos-linha">{ficha.generos.join('  ·  ')}</p>
                      )}

                      {/* Botões de Ação */}
                      <div className="vod-ficha-botoes">
                        {aberto.serie ? (
                          <button
                            className="vod-btn-assistir"
                            disabled={!temporadas.length}
                            onClick={() => {
                              if (partidaSerie) {
                                const epPartida = episodiosAgrupados.find(
                                  (e) => e.temporada === partidaSerie.temporada && e.numero === partidaSerie.numero,
                                );
                                if (epPartida) { tocarEpisodio(epPartida); return; }
                              }
                              if (episodiosAgrupados[0]) tocarEpisodio(episodiosAgrupados[0]);
                            }}
                          >
                            ▶ {partidaSerie ? (partidaSerie.comecado ? `Continuar T${partidaSerie.temporada} E${partidaSerie.numero}` : `Assistir T${partidaSerie.temporada} E${partidaSerie.numero}`) : 'Assistir'}
                          </button>
                        ) : (
                          <button
                            className="vod-btn-assistir"
                            disabled={!fontesAbertas?.length}
                            onClick={() => {
                              if (fontesAbertas?.length) tocarFilme(aberto.titulo, fontesAbertas);
                            }}
                          >
                            ▶ Assistir
                          </button>
                        )}

                        {(() => {
                          const origemItem: ItemDestaque = {
                            tipo: aberto.chave.startsWith('animes') ? 'a' : aberto.chave.startsWith('doramas') ? 'd' : aberto.serie ? 's' : 'f',
                            titulo: aberto.titulo,
                            letra: aberto.letra,
                            ano: aberto.ano || '',
                            capa: (generos && capaDaFicha(generos, aberto.titulo, aberto.serie)) || ficha?.capa || '',
                          };
                          const fav = ehFavorito(origemItem);
                          return (
                            <button
                              className={`vod-btn-fav${fav ? ' ativo' : ''}`}
                              onClick={() => alternarFavorito(origemItem)}
                            >
                              {fav ? '★ Nos favoritos' : '♡ Favoritar'}
                            </button>
                          );
                        })()}
                      </div>

                      {ficha?.sinopse && (
                        <p className="vod-ficha-sinopse">{ficha.sinopse}</p>
                      )}

                      {ficha && (
                        <dl className="vod-ficha-creditos">
                          {ficha.assinatura && (
                            <>
                              <dt>{aberto.serie ? 'Criação' : 'Direção'}</dt>
                              <dd>{ficha.assinatura}</dd>
                            </>
                          )}
                          {ficha.roteiro && (
                            <>
                              <dt>Roteiro</dt>
                              <dd>{ficha.roteiro}</dd>
                            </>
                          )}
                          {ficha.produtora && (
                            <>
                              <dt>Produção</dt>
                              <dd>{ficha.produtora}</dd>
                            </>
                          )}
                        </dl>
                      )}
                    </div>
                  </div>
                </div>

                {/* Conteúdo Inferior: Episódios de Série, Fontes e Elenco */}
                <div className="vod-ficha-corpo">
                  {/* Bloco de Episódios (Para Séries) */}
                  {aberto.serie && temporadas.length > 0 && (
                    <div className="vod-episodios-bloco">
                      <div className="vod-episodios-cabecalho">
                        <div>
                          <h3>Episódios</h3>
                          <small>{filmesDaSerie.length} episódio{filmesDaSerie.length > 1 ? 's' : ''}</small>
                        </div>
                        <div className="vod-episodios-acoes-topo">
                          {versoesDisponiveis.length > 1 && (
                            <div className="vod-pilulas-grupo" role="tablist">
                              <button
                                type="button"
                                className={`vod-pilula vod-pilula-versao${versaoFiltro === 'todas' ? ' ativa' : ''}`}
                                onClick={() => setVersaoFiltro('todas')}
                              >
                                Todas
                              </button>
                              {versoesDisponiveis.map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  className={`vod-pilula vod-pilula-versao${versaoFiltro === v ? ' ativa' : ''}`}
                                  onClick={() => setVersaoFiltro(v)}
                                >
                                  {v === 'leg' ? 'Legendado' : 'Dublado'}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="vod-episodios-setas">
                            <button
                              type="button"
                              className="vod-seta-btn"
                              onClick={() => trilhaEpisodiosRef.current?.scrollBy({ left: -580, behavior: 'smooth' })}
                              aria-label="Episódios anteriores"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              className="vod-seta-btn"
                              onClick={() => trilhaEpisodiosRef.current?.scrollBy({ left: 580, behavior: 'smooth' })}
                              aria-label="Próximos episódios"
                            >
                              ›
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Pílulas de Temporadas */}
                      {temporadas.length > 1 && (
                        <div className="vod-pilulas-grupo" role="tablist">
                          {temporadas.map((t) => {
                            const ativa = t === temporadaAtiva;
                            const totalNaTemp = episodiosAgrupados.filter((e) => e.temporada === t).length;
                            return (
                              <button
                                key={t}
                                type="button"
                                role="tab"
                                aria-selected={ativa}
                                className={`vod-pilula${ativa ? ' ativa' : ''}`}
                                onClick={() => setTemporada(t)}
                              >
                                Temporada {t} ({totalNaTemp})
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Trilha horizontal de cartões 16:9 de episódios */}
                      <div
                        className="vod-episodios-trilha"
                        ref={trilhaEpisodiosRef}
                        onWheel={(e) => {
                          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                            e.currentTarget.scrollLeft += e.deltaY;
                          }
                        }}
                      >
                        {episodiosDaTempAtiva.map((e) => {
                          const id = `series-${aberto.chave}-s${e.temporada}e${e.numero}`;
                          const infoEp = detalhesTemporada[e.numero];
                          const nome = infoEp?.nome && infoEp.nome.trim() ? infoEp.nome : `Episódio ${e.numero}`;
                          const duracao = infoEp?.duracao ? `${infoEp.duracao} min` : null;
                          const versoesRotulo = e.versoes.map((v) => (v === 'leg' ? 'Legendado' : 'Dublado')).join(' / ');
                          const ehDestaque = (partidaSerie?.temporada === e.temporada && partidaSerie?.numero === e.numero) || ultimoEpisodioId === id;
                          const ehNoPlayer = activeMovie?.id === id;

                          let progressoFracao = 0;
                          try {
                            const salvo = localStorage.getItem(`movie-progress-${id}`);
                            if (salvo) {
                              const parsed = JSON.parse(salvo);
                              if (parsed.duration > 0 && parsed.currentTime > 0) {
                                progressoFracao = Math.min(1, parsed.currentTime / parsed.duration);
                              }
                            }
                          } catch { /* ignorar */ }
                          const assistido = progressoFracao >= 0.95;

                          return (
                            <button
                              key={`${e.temporada}-${e.numero}`}
                              type="button"
                              className={`vod-ep-card${ehNoPlayer ? ' no-player' : ''}${ehDestaque ? ' destaque' : ''}`}
                              onClick={() => tocarEpisodio(e)}
                            >
                              <div className="vod-ep-thumb">
                                {infoEp?.imagem ? (
                                  <img src={infoEp.imagem} alt="" loading="lazy" />
                                ) : (
                                  <span className="vod-ep-numero-grande">{e.numero}</span>
                                )}
                                {ehDestaque && (
                                  <span className="vod-ep-badge continuar">
                                    {ehNoPlayer ? '● No ar' : partidaSerie?.comecado ? '▶ Continuar' : '▶ Comece aqui'}
                                  </span>
                                )}
                                {assistido && <span className="vod-ep-badge assistido">✓ Assistido</span>}
                                {progressoFracao > 0 && !assistido && (
                                  <div className="vod-ep-progresso-trilho">
                                    <div
                                      className="vod-ep-progresso-barra"
                                      style={{ width: `${Math.round(progressoFracao * 100)}%` }}
                                    />
                                  </div>
                                )}
                                <div className="vod-ep-play-overlay" aria-hidden="true">
                                  <div className="vod-ep-play-circulo">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                              <div className="vod-ep-info">
                                <h4 className="vod-ep-titulo">{e.numero}. {nome}</h4>
                                <span className="vod-ep-meta">{[duracao, versoesRotulo].filter(Boolean).join(' · ')}</span>
                                {infoEp?.sinopse && <p className="vod-ep-sinopse">{infoEp.sinopse}</p>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fontes alternativas para filmes */}
                  {!aberto.serie && fontesAbertas && fontesAbertas.length > 1 && (
                    <div className="vod-fontes-seletor">
                      <p>Fontes e versões disponíveis:</p>
                      <div className="vod-fontes-lista">
                        {fontesAbertas.map((fonte, idx) => (
                          <button
                            key={`${fonte.url}-${idx}`}
                            className="vod-fonte-item"
                            onClick={() => tocarFilme(aberto.titulo, fontesAbertas, fonte.url)}
                          >
                            <span>
                              <strong>{fonte.versao === 'leg' ? 'Legendado' : 'Dublado'}</strong>
                              <small>{nomeDaFonte(fonte.url)}</small>
                            </span>
                            <em>Fonte {idx + 1}</em>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Elenco com Fotos Redondas */}
                  {ficha?.elenco && ficha.elenco.length > 0 && (
                    <div className="vod-ficha-elenco">
                      <h3>Elenco</h3>
                      <ul>
                        {ficha.elenco.map((pessoa) => (
                          <li key={pessoa.id}>
                            <button onClick={() => setAtor(pessoa)} title={`Ver o que ${pessoa.nome} tem no acervo`}>
                              {pessoa.foto ? (
                                <img src={pessoa.foto} alt="" loading="lazy" />
                              ) : (
                                <span className="vod-ficha-sem-foto">{pessoa.nome.charAt(0)}</span>
                              )}
                              <strong>{pessoa.nome}</strong>
                              <small>{pessoa.papel}</small>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {modalCarregando && <p className="vod-aviso">Carregando opções…</p>}
                  {erroModal && <p className="vod-erro">{erroModal}</p>}
                </div>
              </>
            )}
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente de Fileira com Carregamento Sob Demanda (Lazy Row) para TVs
// ─────────────────────────────────────────────────────────────────────────────

interface LazyFileiraProps {
  children: React.ReactNode;
  altura?: number;
}

const LazyFileira = memo(function LazyFileira({ children, altura = 300 }: LazyFileiraProps) {
  const [visivel, setVisivel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisivel(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={visivel ? undefined : { minHeight: `${altura}px` }}>
      {visivel ? children : null}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente de Fileira Horizontal com Suporte a Mouse Wheel e Setas de Vidro
// ─────────────────────────────────────────────────────────────────────────────

interface CarrosselFileiraProps {
  titulo: string;
  itens: (ItemDestaque & { progresso?: number; subtitulo?: string })[];
  aoAbrir: (item: ItemDestaque) => void;
  aoPassar: (item: ItemDestaque | null) => void;
  verTodos?: () => void;
  rotuloVerTodos?: string;
}

function CarrosselFileira({
  titulo,
  itens,
  aoAbrir,
  aoPassar,
  verTodos,
  rotuloVerTodos = 'Ver todos',
}: CarrosselFileiraProps) {
  const trilhoRef = useRef<HTMLDivElement | null>(null);
  const [borda, setBorda] = useState({ esq: false, dir: true });

  const medir = useCallback(() => {
    const el = trilhoRef.current;
    if (!el) return;
    const esq = el.scrollLeft > 6;
    const dir = el.scrollLeft + el.clientWidth < el.scrollWidth - 6;
    setBorda((prev) => (prev.esq !== esq || prev.dir !== dir ? { esq, dir } : prev));
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [medir, itens]);

  const rolar = (sentido: number) => {
    trilhoRef.current?.scrollBy({ left: sentido * 540, behavior: 'smooth' });
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && trilhoRef.current) {
      trilhoRef.current.scrollLeft += e.deltaY * 1.3;
    }
  };

  return (
    <section className="vod-fileira">
      <header className="vod-fileira-header">
        <h2>{titulo}</h2>
        {verTodos && (
          <button className="vod-fileira-ver" onClick={verTodos}>
            {rotuloVerTodos} ›
          </button>
        )}
      </header>

      <div className="vod-fileira-trilho-wrapper">
        {borda.esq && (
          <button className="vod-fileira-seta esq" onClick={() => rolar(-1)} aria-label="Anterior">
            ‹
          </button>
        )}

        <div
          className="vod-fileira-trilho"
          ref={trilhoRef}
          onScroll={medir}
          onWheel={onWheel}
          onMouseLeave={() => aoPassar(null)}
        >
          {itens.map((item) => {
            const fav = ehFavorito(item);
            return (
              <button
                key={`${item.tipo}:${item.titulo}:${item.ano}`}
                className="vod-card-poster"
                onClick={() => aoAbrir(item)}
                onMouseEnter={() => aoPassar(item)}
                onMouseLeave={() => aoPassar(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  alternarFavorito(item);
                }}
                title={item.titulo}
              >
                <div className="vod-card-poster-thumb">
                  {item.capa ? (
                    <img src={item.capa} alt={item.titulo} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="vod-poster-letra">{item.titulo.charAt(0)}</span>
                  )}
                  {fav && <span className="vod-badge-favorito">★</span>}
                  {item.progresso != null && item.progresso > 0 && (
                    <div className="vod-card-progresso">
                      <div style={{ width: `${Math.round(item.progresso * 100)}%` }} />
                    </div>
                  )}
                </div>
                <strong className="vod-card-poster-nome">{item.titulo}</strong>
                <small className="vod-card-poster-ano">{item.subtitulo || item.ano}</small>
              </button>
            );
          })}

          {verTodos && (
            <button className="vod-card-ver-todos" onClick={verTodos}>
              <div className="vod-card-ver-todos-thumb">
                <span className="vod-card-ver-todos-icone">›</span>
              </div>
              <strong>Ver todos</strong>
              <small>De A a Z</small>
            </button>
          )}
        </div>

        {borda.dir && (
          <button className="vod-fileira-seta dir" onClick={() => rolar(1)} aria-label="Próximo">
            ›
          </button>
        )}
      </div>
    </section>
  );
}
