import type { Channel } from '../types/channel';
import { restrictedChannels, restrictedCategories } from './restrictedChannels';

// Base URL para logos do repositório tv-logo/tv-logos (GitHub)
const LOGO_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil';
const LOGO_INTL = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/international';
const LOGO_US = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states';
const LOGO_LAM = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/world-latin-america';

// Canal sem logo publicado fica com logo vazio: o componente desenha o
// marcador no lugar.

const rawChannels = [
  // === FILMES ===
  { id: 'hbo', name: 'HBO', url: 'https://smart.fazoeli.co.za/token/d1720710b19dcbe54b8c7402ac9a0225/hbo.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-br.png` },
  { id: 'hbo2', name: 'HBO 2', url: 'https://smart.fazoeli.co.za/token/f5edc167e9fb409081047084fb250ba2/hbo2.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-2-br.png` },
  { id: 'hbo-family', name: 'HBO Family', url: 'https://smart.fazoeli.co.za/token/2577200fa2091abc92422afd7aa859a2/hbofamily.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-family-br.png` },
  { id: 'hbo-mundi', name: 'HBO Mundi', url: 'https://smart.fazoeli.co.za/token/b723bfa488dc48a6062469b1796a09c4/hbomundi.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-mundi-br.png` },
  { id: 'hbo-pop', name: 'HBO Pop', url: 'https://smart.fazoeli.co.za/token/4b49d50e9155d228a51c452acd8b532a/hbopop.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-pop-br.png` },
  { id: 'hbo-xtreme', name: 'HBO Xtreme', url: 'https://smart.fazoeli.co.za/token/2bc0577dc5759843c1345c59ec0db9f3/hboxtreme.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-xtreme-br.png` },
  { id: 'hbo-plus', name: 'HBO Plus', url: 'https://smart.fazoeli.co.za/token/73139f31a866f022d1554899140482b7/hboplus.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-plus-br.png` },
  { id: 'tcm', name: 'TCM', url: 'https://smart.fazoeli.co.za/token/e5b1b9dfeb3ae662963e2dc9a6691a9b/tcm.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tcm-br.png` },
  { id: 'space', name: 'Space', url: 'https://smart.fazoeli.co.za/token/01149661ae727de300cdcbaacd623fb9/space.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/space-br.png` },
  { id: 'cinemax', name: 'Cinemax', url: 'https://smart.fazoeli.co.za/token/d55edc150a5c59dd49ecf9266774d884/cinemax.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/cinemax-br.png` },
  { id: 'megapix', name: 'Megapix', url: 'https://smart.fazoeli.co.za/token/633577bb76bbdf943183b2b8f51ffb3b/megapix.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/megapix-br.png` },
  { id: 'studio-universal', name: 'Studio Universal', url: 'https://smart.fazoeli.co.za/token/a216d19ebc00ad7d15fdcb20c1b559e0/studiouniversal.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/studio-universal-br.png` },
  { id: 'curta', name: 'Curta!', url: 'https://smart.fazoeli.co.za/token/5d1a6271b44c845bf79bcd25b3820bc0/curta.m3u8', category: 'Filmes', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Logo_of_Curta%21.svg/960px-Logo_of_Curta%21.svg.png' },
  { id: 'telecine-fun', name: 'Telecine Fun', url: 'https://smart.fazoeli.co.za/token/9c0aeec271ac4da94b53b07fcf8cd854/telecinefun.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-fun-br.png` },
  { id: 'telecine-touch', name: 'Telecine Touch', url: 'https://smart.fazoeli.co.za/token/c3cce3dc2e2d5b56a53d5a9cebfa3029/telecinetouch.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-touch-br.png` },
  { id: 'telecine-cult', name: 'Telecine Cult', url: 'https://smart.fazoeli.co.za/token/b39986a6e7524274a6aebe4b4ae236c3/telecinecult.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-cult-br.png` },
  { id: 'telecine-action', name: 'Telecine Action', url: 'https://smart.fazoeli.co.za/token/e281d359900d376ce92229e966c97b21/telecineaction.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-action-br.png` },
  { id: 'telecine-premium', name: 'Telecine Premium', url: 'https://smart.fazoeli.co.za/token/636e30ef251726cefc0253e765435489/telecinepremium.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-premium-br.png` },
  { id: 'telecine-pipoca', name: 'Telecine Pipoca', url: 'https://smart.fazoeli.co.za/token/16fcf4f00c49a1836e6d4ac0e3cb49d0/telecinepipoca.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-pipoca-br.png` },

  // === SERIES ===
  { id: 'warner', name: 'Warner Channel', url: 'https://smart.fazoeli.co.za/token/024a4aa6d1513f2f2ba584c29e6c63f4/warnerchannel.m3u8', category: 'Series', logo: `${LOGO_BASE}/warner-channel-br.png` },
  { id: 'tnt', name: 'TNT', url: 'https://smart.fazoeli.co.za/token/d4fbaf8031b3b56360d6c47bcf1c3662/tnt.m3u8', category: 'Series', logo: `${LOGO_BASE}/tnt-br.png` },
  { id: 'tnt-novelas', name: 'TNT Novelas', url: 'https://smart.fazoeli.co.za/token/37c719b20be4c4f94ec599ab377d9346/tntnovelas.m3u8', category: 'Series', logo: `${LOGO_BASE}/tnt-novelas-br.png` },
  { id: 'axn', name: 'AXN', url: 'https://smart.fazoeli.co.za/token/bc5b4bdd68d1efa0d30b98e50a7197d7/axn.m3u8', category: 'Series', logo: `${LOGO_BASE}/axn-br.png` },
  { id: 'sony', name: 'Sony Channel', url: 'https://smart.fazoeli.co.za/token/c79b32c6b891842511da42a8531f9768/sonychannel.m3u8', category: 'Series', logo: `${LOGO_BASE}/sony-channel-br.png` },
  { id: 'universal-tv', name: 'Universal TV', url: 'https://canais.fazoeli.co.za/fontes/smart/universaltv.m3u8', category: 'Series', logo: `${LOGO_BASE}/universal-tv-br.png` },
  { id: 'ae', name: 'A&E', url: 'https://smart.fazoeli.co.za/token/349794c45363056b03860f511f5f515d/ae.m3u8', category: 'Series', logo: `${LOGO_BASE}/a-and-e-br.png` },
  { id: 'tnt-series', name: 'TNT Series', url: 'https://smart.fazoeli.co.za/token/70e9a84e47c36f47952940d5c40dcd6f/tntseries.m3u8', category: 'Series', logo: `${LOGO_BASE}/tnt-series-br.png` },
  { id: 'amc', name: 'AMC', url: 'https://canais.fazoeli.co.za/fontes/smart/amc.m3u8', category: 'Series', logo: `${LOGO_US}/amc-us.png` },
  { id: 'comedy-central', name: 'Comedy Central', url: 'https://smart.fazoeli.co.za/token/f3eb2fb92daeaacea51f23eb11a3c35a/comedycentral.m3u8', category: 'Series', logo: `${LOGO_BASE}/comedy-central-br.png` },
  { id: 'paramount-plus', name: 'Paramount+', url: 'https://smart.fazoeli.co.za/token/514b470c0b11657485e57339278b216b/paramountplus.m3u8', category: 'Series', logo: `${LOGO_INTL}/paramount-plus-int.png` },

  // === INFANTIL ===
  { id: 'gloob', name: 'Gloob', url: 'https://smart.fazoeli.co.za/token/2466adf8a439e3782fa1f9f605180000/gloob.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/gloob-br.png` },
  { id: 'cartoon-network', name: 'Cartoon Network', url: 'https://smart.fazoeli.co.za/token/8aaccedffe922eb7ed14f51c93acf3b2/cartoonnetwork.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/cartoon-network-br.png` },
  { id: 'cartoonito', name: 'Cartoonito', url: 'https://smart.fazoeli.co.za/token/2d2a5ca5dc4400729ca197d3a1e1a23c/cartoonito.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/cartoonito-br.png` },
  { id: 'discovery-kids', name: 'Discovery Kids', url: 'https://smart.fazoeli.co.za/token/297fec160b9202db4a98300387c6e8c8/discoverykids.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/discovery-kids-br.png` },
  { id: '24h-simpsons', name: '24h Simpsons', url: 'https://smart.fazoeli.co.za/token/ce4341b0e06ffd6c49ebd4578910c06f/24h_simpsons.m3u8', category: 'Infantil', logo: '' },
  { id: '24h-dragonball', name: '24h Dragon Ball', url: 'https://smart.fazoeli.co.za/token/11301f3d13ea27fc1334ff8e231adc3e/24h_dragonball.m3u8', category: 'Infantil', logo: '' },
  { id: '24h-odeia-chris', name: '24h Todo Mundo Odeia o Chris', url: 'https://smart.fazoeli.co.za/token/e42459e8e712655cb393a8f5f4fd48e2/24h_odeiachris.m3u8', category: 'Infantil', logo: '' },
  { id: 'adult-swim', name: 'Adult Swim', url: 'https://smart.fazoeli.co.za/token/06989f3ec1e1eb1496139d2683ba9f94/adultswim.m3u8', category: 'Infantil', logo: `${LOGO_US}/adult-swim-us.png` },
  { id: 'nickelodeon', name: 'Nickelodeon', url: 'https://smart.fazoeli.co.za/token/f499d079de2c26cae48e811e4645fe35/nickelodeon.m3u8', category: 'Infantil', logo: `${LOGO_LAM}/nickelodeon-lam.png` },
  { id: 'gospel-cartoon', name: 'Gospel Cartoon', url: 'https://stmv1.srvif.com/gospelcartoon/gospelcartoon/playlist.m3u8', category: 'Infantil', logo: 'https://i.imgur.com/yxjPno5.png' },
  { id: 'geekdot', name: 'Geekdot', url: 'https://stream.ichibantv.com:3764/hybrid/play.m3u8', category: 'Infantil', logo: 'https://i.imgur.com/jML1u4O.png' },

  // === DOCUMENTARIOS ===
  { id: 'discovery', name: 'Discovery Channel', url: 'https://smart.fazoeli.co.za/token/ed20f4dbf417ddcf03e58ba05a301b06/discoverychannel.m3u8', category: 'Documentarios', logo: `${LOGO_US}/discovery-channel-us.png` },
  { id: 'animal-planet', name: 'Animal Planet', url: 'https://smart.fazoeli.co.za/token/8ffadefeb1d45d09d772a09c3aa83b65/animalplanet.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/animal-planet-int.png` },
  { id: 'history', name: 'History', url: 'https://smart.fazoeli.co.za/token/edf9a12075ba8fc52807b7b87ec2fcb9/history.m3u8', category: 'Documentarios', logo: `${LOGO_LAM}/history-channel-lam.png` },
  { id: 'history2', name: 'History 2', url: 'https://smart.fazoeli.co.za/token/646b1fd2d6582d837f06144b811f1244/history2.m3u8', category: 'Documentarios', logo: `${LOGO_LAM}/history-channel-2-lam.png` },
  { id: 'food-network', name: 'Food Network', url: 'https://smart.fazoeli.co.za/token/78e1f48c3097dd90adddf410f72c04c4/foodnetwork.m3u8', category: 'Documentarios', logo: `${LOGO_US}/food-network-us.png` },
  { id: 'tlc', name: 'TLC', url: 'https://smart.fazoeli.co.za/token/96476e8a5346a7af796801b7660b9826/tlc.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/tlc-int.png` },
  { id: 'hgtv', name: 'HGTV', url: 'https://smart.fazoeli.co.za/token/86c69380460b066ffca6ddb6db3bf5d8/hgtv.m3u8', category: 'Documentarios', logo: `${LOGO_US}/hgtv-us.png` },
  { id: 'discovery-hh', name: 'Discovery H&H', url: 'https://smart.fazoeli.co.za/token/9f3799766be8d2a9f86f73043cf3a57f/discoveryhh.m3u8', category: 'Documentarios', logo: `${LOGO_LAM}/discovery-home-and-health-lam.png` },
  { id: 'discovery-id', name: 'Investigation Discovery', url: 'https://smart.fazoeli.co.za/token/509676db20999eb5a2863f482b35970e/discoveryid.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/investigation-discovery-int.png` },
  { id: 'discovery-science', name: 'Discovery Science', url: 'https://smart.fazoeli.co.za/token/0b025d59c972845379d8a05722ec9307/discoveryscience.m3u8', category: 'Documentarios', logo: `${LOGO_US}/discovery-science-us.png` },
  { id: 'discovery-world', name: 'Discovery World', url: 'https://smart.fazoeli.co.za/token/11f24fd14df268e2e58873335ad38038/discoveryworld.m3u8', category: 'Documentarios', logo: `${LOGO_US}/discovery-history-us.png` },
  { id: 'discovery-turbo', name: 'Discovery Turbo', url: 'https://smart.fazoeli.co.za/token/ed445e86d021b583d97d87c8d22ff3f4/discoveryturbo.m3u8', category: 'Documentarios', logo: `${LOGO_BASE}/discovery-turbo-br.png` },

  // === ENTRETENIMENTO ===
  { id: 'bbb1', name: 'BBB CAN 1', url: 'https://smart.fazoeli.co.za/token/7369dcbb66a424432270c6322e595ff3/bbb1.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb2', name: 'BBB CAN 2', url: 'https://smart.fazoeli.co.za/token/a6e8e96ec0e0d9a802469fba6db332b7/bbb2.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb3', name: 'BBB CAN 3', url: 'https://canais.fazoeli.co.za/fontes/smart/bbb3.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb4', name: 'BBB CAN 4', url: 'https://canais.fazoeli.co.za/fontes/smart/bbb4.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb5', name: 'BBB CAN 5', url: 'https://canais.fazoeli.co.za/fontes/smart/bbb5.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb6', name: 'BBB CAN 6', url: 'https://canais.fazoeli.co.za/fontes/smart/bbb6.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb7', name: 'BBB CAN 7', url: 'https://canais.fazoeli.co.za/fontes/smart/bbb7.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb8', name: 'BBB CAN 8', url: 'https://canais.fazoeli.co.za/fontes/smart/bbb8.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb9', name: 'BBB CAN 9', url: 'https://canais.fazoeli.co.za/fontes/smart/bbb9.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'bbb10', name: 'BBB CAN 10', url: 'https://canais.fazoeli.co.za/fontes/smart/bbb10.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bbb.png` },
  { id: 'multishow', name: 'Multishow', url: 'https://smart.fazoeli.co.za/token/c0d255eb30d0f8b6ae8732d0eb434536/multishow.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/multishow-br.png` },
  { id: 'bis', name: 'BIS', url: 'https://smart.fazoeli.co.za/token/bf098b3f8768f77f6eef0b802ebc0bea/bis.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bis-br.png` },
  { id: 'viva', name: 'Viva', url: 'https://smart.fazoeli.co.za/token/cf51cb1a7d5a2444dad387917238993e/viva.m3u8', category: 'Entretenimento', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Canal_Viva_2018_wordmark.svg/960px-Canal_Viva_2018_wordmark.svg.png' },
  { id: 'off', name: 'OFF', url: 'https://smart.fazoeli.co.za/token/df9c9674ed90ecd261e236e12b06a102/off.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/canal-off-br.png` },
  { id: 'gnt', name: 'GNT', url: 'https://smart.fazoeli.co.za/token/2d3b4352caccc23de19f3e7d6bd23cd7/gnt.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/gnt-br.png` },
  { id: 'arte1', name: 'Arte 1', url: 'https://smart.fazoeli.co.za/token/8f9dcb55d8a8a17a4649cbe5caff1227/arte1.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/arte1-br.png` },
  { id: 'cultura', name: 'TV Cultura', url: 'https://canais.fazoeli.co.za/fontes/smart/cultura.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/tv-cultura-br.png` },
  { id: 'loading-tv', name: 'Loading', url: 'https://stmv1.srvif.com/loadingtv/loadingtv/playlist.m3u8', category: 'Entretenimento', logo: 'https://i.imgur.com/R0aflu1.png' },
  { id: 'revry-brasil', name: 'Revry Brasil', url: 'https://linear-181.frequency.stream/dist/24i/181/hls/master/playlist.m3u8', category: 'Entretenimento', logo: '' },
  { id: 'mytime-movie', name: 'MyTime Movie', url: 'https://appletree-mytime-samsungbrazil.amagi.tv/playlist.m3u8', category: 'Entretenimento', logo: 'https://i.imgur.com/aiGQtzI.png' },
  { id: 'classique-tv', name: 'Classique TV', url: 'https://stmv1.srvif.com/classique/classique/playlist.m3u8', category: 'Entretenimento', logo: 'https://i.imgur.com/rHxcraT.png' },
  { id: 'gospel-movie-tv', name: 'Gospel Movie TV', url: 'https://stmv1.srvif.com/gospelf/gospelf/playlist.m3u8', category: 'Entretenimento', logo: 'https://i.imgur.com/cQN3nWt.png' },

  // === STREAMING ===
  { id: 'prime-video', name: 'Prime Video 1', url: 'https://smart.fazoeli.co.za/token/fcc86cce00b2b6382b6b868110440ae6/primevideo.m3u8', category: 'Filmes', logo: '' },
  { id: 'prime-video-2', name: 'Prime Video 2', url: 'https://smart.fazoeli.co.za/token/b8b75ed49f6a02861e26a7ed09844d25/primevideo2.m3u8', category: 'Filmes', logo: '' },
  { id: 'prime-video-3', name: 'Prime Video 3', url: 'https://smart.fazoeli.co.za/token/68e43a07eb3cd0030074afb958de18e9/primevideo3.m3u8', category: 'Filmes', logo: '' },
  { id: 'prime-video-4', name: 'Prime Video 4', url: 'https://smart.fazoeli.co.za/token/964a56d2a094ad90d80be28060a222b2/primevideo4.m3u8', category: 'Filmes', logo: '' },

  // === NOTICIAS ===
  { id: 'globo-news', name: 'Globo News', url: 'https://smart.fazoeli.co.za/token/9d8ba969ee0878a215870ef04b3a39fc/globonews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/globo-news-br.png` },
  { id: 'cnn-brasil', name: 'CNN Brasil', url: 'https://smart.fazoeli.co.za/token/2460a98b2e78e8aa5bff5a84000907bc/cnnbrasil.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/cnn-brasil-br.png` },
  { id: 'band-news', name: 'Band News', url: 'https://smart.fazoeli.co.za/token/9bd99bf9aed7cc67dbb9c1fa71383b0a/bandnews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/band-news-br.png` },
  { id: 'record-news', name: 'Record News', url: 'https://canais.fazoeli.co.za/fontes/smart/recordnews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/record-news-br.png` },
  { id: 'jovem-pan-news', name: 'Jovem Pan News', url: 'https://d6yfbj4xxtrod.cloudfront.net/out/v1/7836eb391ec24452b149f3dc6df15bbd/index.m3u8', category: 'Noticias', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Jovem_Pan_logo_2018.svg/512px-Jovem_Pan_logo_2018.svg.png' },
  { id: 'stz-tv', name: 'STZ TV', url: 'https://cdn.live.br1.jmvstream.com/webtv/AVJ-12952/playlist/playlist.m3u8', category: 'Noticias', logo: 'https://i.imgur.com/SeF2I7q.png' },

  // === TV ABERTA ===
  { id: 'globo-sp', name: 'Globo SP', url: 'https://smart.fazoeli.co.za/token/d4af728b49381862e5f7eb7054d44038/globosp.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'globo-rj', name: 'Globo RJ', url: 'https://canais.fazoeli.co.za/fontes/smart/globorj.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'globo-mg', name: 'Globo MG', url: 'https://canais.fazoeli.co.za/fontes/smart/globomg.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'globo-rs', name: 'Globo RS', url: 'https://canais.fazoeli.co.za/fontes/smart/globors.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'sbt', name: 'SBT', url: 'https://smart.fazoeli.co.za/token/8d73c32d1bbf34e788ce566faea6264e/sbt.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/sbt-br.png` },
  { id: 'band', name: 'Band', url: 'https://canais.fazoeli.co.za/fontes/smart/band.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/band-br.png` },
  { id: 'record', name: 'Record TV', url: 'https://smart.fazoeli.co.za/token/177fcaa232b8a30d817101815101e427/record.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/record-br.png` },
  { id: 'rede-tv', name: 'RedeTV!', url: 'https://smart.fazoeli.co.za/token/1634c18ddd9ba2763193e0273d4f4cf8/redetv.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/rede-tv-br.png` },
  { id: 'tv-brasil', name: 'TV Brasil', url: 'https://canais.fazoeli.co.za/fontes/smart/tvbrasil.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/tv-brasil-br.png` },
  { id: 'aparecida', name: 'TV Aparecida', url: 'https://canais.fazoeli.co.za/fontes/smart/aparecida.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/tv-aparecida-br.png` },
  { id: 'globo-es', name: 'Globo ES', url: 'https://canais.fazoeli.co.za/fontes/smart/globoes.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'tv-gazeta', name: 'TV Gazeta', url: 'https://canais.fazoeli.co.za/fontes/smart/tvgazeta.m3u8', category: 'TV Aberta', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/TV_Gazeta.svg/500px-TV_Gazeta.svg.png' },
  { id: 'globo-am', name: 'Globo AM', url: 'https://canais.fazoeli.co.za/fontes/smart/globoam.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'impd', name: 'IMPD', url: 'https://68882bdaf156a.streamlock.net/impd/ngrp:impd_all/chunklist_w1366598577_b3715072.m3u8', category: 'TV Aberta', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Logotipo_da_Rede_Mundial.jpg' },
  { id: 'amazon-sat', name: 'Amazon Sat', url: 'https://amazonsat.brasilstream.com.br/hls/amazonsat/index.m3u8', category: 'TV Aberta', logo: 'https://i.imgur.com/7rjCS5i.png' },
  { id: 'sbt-interior', name: 'SBT Interior', url: 'https://cdn.jmvstream.com/w/LVW-10801/LVW10801_Xvg4R0u57n/playlist.m3u8', category: 'TV Aberta', logo: 'https://i.imgur.com/IkZfa4j.png' },
  { id: 'sertao-tv', name: 'Sertão TV', url: 'http://wz4.dnip.com.br/sertaotv/sertaotv.sdp/playlist.m3u8', category: 'TV Aberta', logo: 'https://i.imgur.com/b5xOCsC.png' },
  { id: 'cwb-tv', name: 'CWB TV', url: 'https://59d39900ebfb8.streamlock.net/cwbtv/cwbtv/playlist.m3u8', category: 'TV Aberta', logo: 'https://i.imgur.com/S0ISpmU.png' },
  { id: 'record-internacional', name: 'Record Internacional', url: 'https://viamotionhsi.netplus.ch/live/eds/rederecordinternacional/browser-HLS8/rederecordinternacional.m3u8', category: 'TV Aberta', logo: 'https://i.imgur.com/sz9gTTr.png' },
  { id: 'novo-tempo', name: 'TV Novo Tempo', url: 'https://stream.live.novotempo.com/tv/smil:tvnovotempo.smil/playlist.m3u8', category: 'TV Aberta', logo: 'https://i.postimg.cc/mgpGyqRg/novotempo.png' },
  { id: 'rede-gospel', name: 'Rede Gospel', url: 'https://redegospel-aovivo.nuvemplay.live/hls/stream.m3u8', category: 'TV Aberta', logo: 'https://i.imgur.com/mttSwgO.png' },
  { id: 'despertar-tv', name: 'Despertar TV', url: 'https://cdn.live.br1.jmvstream.com/webtv/pejexypz/playlist/playlist.m3u8', category: 'TV Aberta', logo: '' },

  // === ESPORTES ===
  { id: 'sportv', name: 'SporTV', url: 'https://smart.fazoeli.co.za/token/5afdca6f7bb70ffb8eed4ba2898b5b48/sportv.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv-br.png` },
  { id: 'sportv2', name: 'SporTV 2', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv2.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv2-br.png` },
  { id: 'sportv3', name: 'SporTV 3', url: 'https://smart.fazoeli.co.za/token/1ca52703026d4275dc2bc4b065bc7c4d/sportv3.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv3-br.png` },
  { id: 'espn', name: 'ESPN', url: 'https://smart.fazoeli.co.za/token/0544a20f12017bdffdfba17ca1930a25/espn.m3u8', category: 'Esportes', logo: `${LOGO_INTL}/espn-int.png` },
  { id: 'espn2', name: 'ESPN 2', url: 'https://smart.fazoeli.co.za/token/ec1f8060befbe95c2a9ae673b155c6ed/espn2.m3u8', category: 'Esportes', logo: `${LOGO_LAM}/espn-2-lam.png` },
  { id: 'espn3', name: 'ESPN 3', url: 'https://smart.fazoeli.co.za/token/ece17a959f409480bd9ca9c9a8c25164/espn3.m3u8', category: 'Esportes', logo: `${LOGO_LAM}/espn-3-lam.png` },
  { id: 'espn4', name: 'ESPN 4', url: 'https://smart.fazoeli.co.za/token/2ca72e8ac73700d4781960754bae6e21/espn4.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/espn-4-br.png` },
  { id: 'espn5', name: 'ESPN 5', url: 'https://smart.fazoeli.co.za/token/aa53d2f092f6da4c6da6a672813ad7a4/espn5.m3u8', category: 'Esportes', logo: `${LOGO_INTL}/espn-int.png` },
  { id: 'premiere', name: 'Premiere', url: 'https://smart.fazoeli.co.za/token/9f66b06111ab1e0f7df6263f5e3bf64e/premiere.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'premiere2', name: 'Premiere 2', url: 'https://canais.fazoeli.co.za/fontes/smart/premiere2.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'premiere3', name: 'Premiere 3', url: 'https://smart.fazoeli.co.za/token/c57b88699a388e818456366229f2cd1a/premiere3.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'premiere4', name: 'Premiere 4', url: 'https://canais.fazoeli.co.za/fontes/smart/premiere4.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'premiere5', name: 'Premiere 5', url: 'https://smart.fazoeli.co.za/token/e64d6f5874480add0644f30f6dd06768/premiere5.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'premiere7', name: 'Premiere 7', url: 'https://smart.fazoeli.co.za/token/1b3f1f34c62a119e2ff883c56a8af623/premiere7.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'combate', name: 'Combate', url: 'https://smart.fazoeli.co.za/token/b38951dcfb5a39837d0afba4e53fa81d/combate.m3u8', category: 'Esportes', logo: `${LOGO_US}/ufc-us.png` },
  { id: 'ufc-fight-pass', name: 'UFC Fight Pass', url: 'https://smart.fazoeli.co.za/token/b2b44cb343675b7362c494c100ce01de/ufcfightpass.m3u8', category: 'Esportes', logo: `${LOGO_US}/ufc-us.png` },
  { id: 'band-sports', name: 'Band Sports', url: 'https://canais.fazoeli.co.za/fontes/smart/bandsports.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/band-sports-br.png` },
  { id: 'fifa-plus', name: 'FIFA+ Português', url: 'https://e3be9ac5.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctYnJfRklGQVBsdXNQb3J0dWd1ZXNlX0hMUw/playlist.m3u8', category: 'Esportes', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/700px-FIFA%2B_(2025).svg.png' },
  { id: 'canal-do-inter', name: 'Canal do Inter', url: 'https://video01.soultv.com.br/internacional/internacional/playlist.m3u8', category: 'Esportes', logo: 'https://i.imgur.com/TQFWEIS.png' },
  // === INTERNACIONAIS ===
  { id: 'al-jazeera', name: 'Al Jazeera English', url: 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8', category: 'Internacionais', logo: 'https://i.imgur.com/7bRVpnu.png' },
  { id: 'dw-english', name: 'DW English', url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/DW_-_English.svg/512px-DW_-_English.svg.png' },
  { id: 'rt-documentary', name: 'RT Documentary', url: 'https://rt-rtd.rttv.com/dvr/rtdoc/playlist.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/RT_logo.svg' },
  { id: 'euronews', name: 'Euronews English', url: 'https://a-cdn.klowdtv.com/live3/euronews_720p/playlist.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Euronews_2022.svg/512px-Euronews_2022.svg.png' },
  { id: 'cgtn', name: 'CGTN', url: 'https://mn-nl.mncdn.com/dogusdyg_drone/cgtn/playlist.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/CGTN.svg/512px-CGTN.svg.png' },
  { id: 'abc-news', name: 'ABC News', url: 'https://abc-news-dmd-streams-1.akamaized.net/out/v1/701126012d044971b3fa89406a440133/index.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/ABC_News_Live_logo_2021.svg/512px-ABC_News_Live_logo_2021.svg.png' },
  { id: 'cbs-news', name: 'CBS News New York', url: 'https://cbsn-ny.cbsnstream.cbsnews.com/out/v1/ec3897d58a9b45129a77d67aa247d136/master.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/CBS_News.svg/512px-CBS_News.svg.png' },
  { id: 'bloomberg', name: 'Bloomberg', url: 'https://www.bloomberg.com/media-manifest/streams/originals-global.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/New_Bloomberg_Logo.svg/512px-New_Bloomberg_Logo.svg.png' },
  { id: 'accuweather', name: 'AccuWeather', url: 'https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg00684-accuweather-accuweather-plex/playlist.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/AccuWeather_Logo.svg/512px-AccuWeather_Logo.svg.png' },
  { id: 'red-bull-tv', name: 'Red Bull TV', url: 'https://769a97d9.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWV1X1JlZEJ1bGxUVl9ITFM/playlist.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/RedBullTV_logo.svg/512px-RedBullTV_logo.svg.png' },
  { id: 'nat-geo-int', name: 'National Geographic', url: 'https://fl1.moveonjoy.com/National_Geographic/index.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Natgeo.svg/512px-Natgeo.svg.png' },
  { id: 'nat-geo-wild-int', name: 'Nat Geo Wild', url: 'https://fl1.moveonjoy.com/Nat_Geo_Wild/index.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Nat_Geo_Wild_logo.svg/512px-Nat_Geo_Wild_logo.svg.png' },
  { id: 'dazn-combat', name: 'DAZN Combat', url: 'https://dazn-combat-rakuten.amagi.tv/hls/amagi_hls_data_rakutenAA-dazn-combat-rakuten/CDN/master.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_logo.svg/512px-DAZN_logo.svg.png' },
  { id: 'fox-sports-int', name: 'Fox Sports', url: 'https://fl1.moveonjoy.com/FOX_Sports_1/index.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Fox_Sports_logo.svg/512px-Fox_Sports_logo.svg.png' },
  { id: 'amc-int', name: 'AMC', url: 'https://fl1.moveonjoy.com/AMC_NETWORK/index.m3u8', category: 'Internacionais', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/AMC_logo_2019.svg/512px-AMC_logo_2019.svg.png' },
  { id: 'lifetime-movies', name: 'Lifetime Movies', url: 'https://fl1.moveonjoy.com/LIFETIME_MOVIE_NETWORK/index.m3u8', category: 'Internacionais', logo: '' },
  { id: 'epix', name: 'Epix', url: 'https://fl1.moveonjoy.com/EPIX/index.m3u8', category: 'Internacionais', logo: '' },
  { id: '4k-travel', name: '4K Travel TV', url: 'https://streams2.sofast.tv/sofastplayout/33c31ac4-51fa-46ae-afd0-0d1fe5e60a80_0_HLS/master.m3u8', category: 'Internacionais', logo: '' },
  { id: 'destination-tv', name: 'Destination TV', url: 'http://media4.tripsmarter.com:1935/LiveTV/DTVHD/playlist.m3u8', category: 'Internacionais', logo: '' },
  { id: 'movie-channel', name: 'The Movie Channel', url: 'https://streams2.sofast.tv/sofastplayout/32eb332e-f644-46e5-ad91-e55ad80d14f7_0_HLS/master.m3u8', category: 'Internacionais', logo: '' },
  { id: 'kuriakos-kids', name: 'Kuriakos Kids', url: 'https://w2.manasat.com/kkids/smil:kkids.smil/playlist.m3u8', category: 'Internacionais', logo: 'https://i.imgur.com/SRX6EPY.png' },
  { id: 'angel-tv', name: 'Angel TV', url: 'https://janya-digimix.akamaized.net/vglive-sk-382409/portuese/ngrp:angelportuguese_all/playlist.m3u8', category: 'Internacionais', logo: 'https://i.imgur.com/qKLEGU7.png' },

  // === ADULTO (SECRETO) ===
  { id: 'playboy', name: 'Playboy TV', url: 'https://canais.fazoeli.co.za/fontes/smart/playboy.m3u8', category: 'Adulto', logo: '' },
  { id: 'sexy-hot', name: 'Sexy Hot', url: 'https://canais.fazoeli.co.za/fontes/smart/sexyhot.m3u8', category: 'Adulto', logo: '' },
  // AdultIPTV.net CDN
  { id: 'adult-anal-cdn', name: 'Anal', url: 'https://cdn.adultiptv.net/anal.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-asian-cdn', name: 'Asian', url: 'https://cdn.adultiptv.net/asian.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-bigass', name: 'Big Ass', url: 'https://cdn.adultiptv.net/bigass.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-bigdick', name: 'Big Dick', url: 'https://cdn.adultiptv.net/bigdick.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-bigtits', name: 'Big Tits', url: 'https://cdn.adultiptv.net/bigtits.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-blowjob', name: 'Blowjob', url: 'https://cdn.adultiptv.net/blowjob.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-compilation', name: 'Compilation', url: 'https://cdn.adultiptv.net/compilation.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-cuckold', name: 'Cuckold', url: 'https://cdn.adultiptv.net/cuckold.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-fetish', name: 'Fetish', url: 'https://cdn.adultiptv.net/fetish.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-gangbang', name: 'Gangbang', url: 'https://cdn.adultiptv.net/gangbang.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-gay-cdn', name: 'Gay', url: 'https://cdn.adultiptv.net/gay.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-hardcore', name: 'Hardcore', url: 'https://cdn.adultiptv.net/hardcore.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-interracial', name: 'Interracial', url: 'https://cdn.adultiptv.net/interracial.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-livecams', name: 'Live Cams', url: 'https://cdn.adultiptv.net/livecams.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-pornstar-cdn', name: 'Pornstar', url: 'https://cdn.adultiptv.net/pornstar.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-pov', name: 'POV', url: 'https://cdn.adultiptv.net/pov.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-rough', name: 'Rough', url: 'https://cdn.adultiptv.net/rough.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-russian', name: 'Russian', url: 'https://cdn.adultiptv.net/russian.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-threesome', name: 'Threesome', url: 'https://cdn.adultiptv.net/threesome.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-woman', name: 'Woman', url: 'https://live.redtraffic.net/woman.m3u8', category: 'Adulto', logo: '' },
  // MyCamTV
  { id: 'mycam-anal', name: 'MyCam Anal', url: 'https://live.mycamtv.com/anal.m3u8', category: 'Adulto', logo: '' },
  { id: 'mycam-asian', name: 'MyCam Asian', url: 'https://live.mycamtv.com/asian.m3u8', category: 'Adulto', logo: '' },
  { id: 'mycam-bigass', name: 'MyCam Big Ass', url: 'https://live.mycamtv.com/defstream.m3u8', category: 'Adulto', logo: '' },
  { id: 'mycam-bigtits', name: 'MyCam Big Tits', url: 'https://live.mycamtv.com/bigtits.m3u8', category: 'Adulto', logo: '' },
  { id: 'mycam-blonde', name: 'MyCam Blonde', url: 'https://live.mycamtv.com/blonde.m3u8', category: 'Adulto', logo: '' },
  { id: 'mycam-brunette', name: 'MyCam Brunette', url: 'https://live.mycamtv.com/brunette.m3u8', category: 'Adulto', logo: '' },
  { id: 'mycam-latina', name: 'MyCam Latina', url: 'https://live.mycamtv.com/latina.m3u8', category: 'Adulto', logo: '' },
  { id: 'mycam-squirt', name: 'MyCam Squirt', url: 'https://live.mycamtv.com/squirt.m3u8', category: 'Adulto', logo: '' },
  { id: 'mycam-white', name: 'MyCam White', url: 'https://live.mycamtv.com/white.m3u8', category: 'Adulto', logo: '' },
  // Canais Premium
  { id: 'jenny-live', name: 'Jenny Live', url: 'https://59ec5453559f0.streamlock.net/JennyLive/JennyLive/playlist.m3u8', category: 'Adulto', logo: '' },
  { id: 'miami-tv-mexico', name: 'Miami TV Mexico', url: 'https://59ec5453559f0.streamlock.net/mexicotv/smil:miamitvmexico/playlist.m3u8', category: 'Adulto', logo: '' },
  { id: 'olala', name: 'O-la-la!', url: 'http://31.148.48.15/O-la-la/index.m3u8', category: 'Adulto', logo: 'https://i.imgur.com/6aOmZs4.png' },
  { id: 'playboy-latam', name: 'Playboy TV Latin America', url: 'http://190.11.225.124:5000/live/playboy_hd/playlist.m3u8', category: 'Adulto', logo: 'https://i.imgur.com/B3DMUM9.png' },
  // megatv — mesma conta do AXN e do ESPN 2 do canais.txt; o provedor não dá nome aos canais
  { id: 'adult-mg-5010', name: 'Penthouse TV', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/5010/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-5012', name: 'Penthouse TV 2', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/5012/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6164', name: '21 Sexture', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6164/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6165', name: 'SexArt', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6165/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6166', name: 'Adult Time', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6166/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6167', name: 'My Cam TV 1', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6167/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6168', name: 'Analized', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6168/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6169', name: 'Angel Trans', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6169/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6171', name: 'Babes', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6171/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6173', name: 'Bang Bros', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6173/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6174', name: 'Bang', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6174/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6175', name: 'Bang Bros 2', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6175/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6176', name: 'My Cam TV 2', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6176/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6177', name: 'InteRacial', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6177/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6178', name: 'Blacked', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6178/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6180', name: 'My Cam TV 3', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6180/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6181', name: 'Brazzers', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6181/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6182', name: 'Brazzers 2', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6182/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6183', name: 'My Cam TV 4', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6183/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6184', name: 'Cento X Cento', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6184/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6185', name: 'Cherry Pimps', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6185/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6186', name: 'Club Sweethearts', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6186/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6187', name: 'My Cam TV 5', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6187/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6188', name: 'My Cam TV 6', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6188/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6189', name: 'Cum Louder', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6189/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6190', name: 'Cum 4K', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6190/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6191', name: 'Daughter Swap', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6191/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6192', name: 'Brazzers 3', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6192/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6193', name: 'DDF Network', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6193/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6194', name: 'DDF Network 2', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6194/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6195', name: 'XXX', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6195/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6196', name: 'DP', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6196/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6197', name: 'Dorcel Club', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6197/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6198', name: 'Deep Lush', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6198/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6199', name: 'Evil Angel', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6199/index.m3u8', category: 'Adulto', logo: '' },
  { id: 'adult-mg-6200', name: 'XXX 2', url: 'http://s1w8pqrh.megatv.fun/iptv/VZEVDE3KMBMVGUR9Y2EEL7EF/6200/index.m3u8', category: 'Adulto', logo: '' },
  // satlabscloud, mesmo provedor da grade publicada; o único adulto que ele tem
  { id: 'adult-satlab-sexprive', name: 'Sex Privé', url: 'https://cdn-mg1.satlabscloud.com.br/SEX_PRIVE/index.m3u8?token=ulDZjn1kAAan1kzoXmUL1B84gijOI6v7', category: 'Adulto', logo: '' },
];

// Ordem das categorias para exibição
export const categoryOrder = [
  'TV Aberta',
  'Filmes',
  'Series',
  'Esportes',
  'Noticias',
  'Infantil',
  'Documentarios',
  'Entretenimento',
  'Pluto TV',
  '24 Horas',
  'Internacionais',
  'Adulto',
  ...restrictedCategories,
];

// Ordena canais alfabeticamente dentro de cada categoria
const sortedByCategory = [...rawChannels].sort((a, b) => {
  // Primeiro ordena por categoria (usando categoryOrder)
  const catIndexA = categoryOrder.indexOf(a.category);
  const catIndexB = categoryOrder.indexOf(b.category);
  if (catIndexA !== catIndexB) return catIndexA - catIndexB;
  // Dentro da mesma categoria, ordena alfabeticamente pelo nome
  return a.name.localeCompare(b.name, 'pt-BR');
});

// Adiciona número do canal + logo fallback
const allChannels: Channel[] = sortedByCategory
  .map((channel, index) => ({
    ...channel,
    channelNumber: index + 1,
    logo: channel.logo || '',
  }));

// Canais públicos (sem adulto)
export const channels: Channel[] = allChannels.filter(ch => ch.category !== 'Adulto');

// Canais adultos (secretos)
export const adultChannels: Channel[] = allChannels.filter(ch => ch.category === 'Adulto');

// Função para obter todos os canais incluindo adultos
export const getAllChannels = (includeAdult: boolean): Channel[] => {
  if (includeAdult) {
    return [...allChannels, ...restrictedChannels];
  }
  return channels;
};
