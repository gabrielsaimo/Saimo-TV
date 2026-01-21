import type { Channel } from '../types/channel';

// Base URL para logos do repositório tv-logo/tv-logos (GitHub)
const LOGO_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil';
const LOGO_INTL = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/international';
const LOGO_US = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states';
const LOGO_LAM = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/world-latin-america';

// Fallback para logos não encontradas - retorna string vazia para usar placeholder visual
const getFallbackLogo = (_name: string) => {
  return ''; // Retorna vazio para usar o placeholder estilizado do componente
};

const rawChannels = [
  // === FILMES ===
  { id: 'hbo', name: 'HBO', url: 'https://canais.fazoeli.co.za/fontes/smart/hbo.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-br.png` },
  { id: 'hbo2', name: 'HBO 2', url: 'https://canais.fazoeli.co.za/fontes/smart/hbo2.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-2-br.png` },
  { id: 'hbo-family', name: 'HBO Family', url: 'https://canais.fazoeli.co.za/fontes/smart/hbofamily.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-family-br.png` },
  { id: 'hbo-mundi', name: 'HBO Mundi', url: 'https://canais.fazoeli.co.za/fontes/smart/hbomundi.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-mundi-br.png` },
  { id: 'hbo-pop', name: 'HBO Pop', url: 'https://canais.fazoeli.co.za/fontes/smart/hbopop.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-pop-br.png` },
  { id: 'hbo-xtreme', name: 'HBO Xtreme', url: 'https://canais.fazoeli.co.za/fontes/smart/hboxtreme.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-xtreme-br.png` },
  { id: 'hbo-plus', name: 'HBO Plus', url: 'https://canais.fazoeli.co.za/fontes/smart/hboplus.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/hbo-plus-br.png` },
  { id: 'tcm', name: 'TCM', url: 'https://canais.fazoeli.co.za/fontes/smart/tcm.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tcm-br.png` },
  { id: 'space', name: 'Space', url: 'https://canais.fazoeli.co.za/fontes/smart/space.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/space-br.png` },
  { id: 'cinemax', name: 'Cinemax', url: 'https://canais.fazoeli.co.za/fontes/smart/cinemax.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/cinemax-br.png` },
  { id: 'megapix', name: 'Megapix', url: 'https://canais.fazoeli.co.za/fontes/smart/megapix.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/megapix-br.png` },
  { id: 'studio-universal', name: 'Studio Universal', url: 'https://canais.fazoeli.co.za/fontes/smart/studiouniversal.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/studio-universal-br.png` },
  { id: 'curta', name: 'Curta!', url: 'https://canais.fazoeli.co.za/fontes/smart/curta.m3u8', category: 'Filmes', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Logo_of_Curta%21.svg/960px-Logo_of_Curta%21.svg.png' },
  { id: 'telecine-fun', name: 'Telecine Fun', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinefun.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-fun-br.png` },
  { id: 'telecine-touch', name: 'Telecine Touch', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinetouch.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-touch-br.png` },
  { id: 'telecine-cult', name: 'Telecine Cult', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinecult.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-cult-br.png` },
  { id: 'telecine-action', name: 'Telecine Action', url: 'https://canais.fazoeli.co.za/fontes/smart/telecineaction.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-action-br.png` },
  { id: 'telecine-premium', name: 'Telecine Premium', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinepremium.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-premium-br.png` },
  { id: 'telecine-pipoca', name: 'Telecine Pipoca', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinepipoca.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-pipoca-br.png` },
 
  // === SERIES ===
  { id: 'warner', name: 'Warner Channel', url: 'https://canais.fazoeli.co.za/fontes/smart/warnerchannel.m3u8', category: 'Series', logo: `${LOGO_BASE}/warner-channel-br.png` },
  { id: 'tnt', name: 'TNT', url: 'https://canais.fazoeli.co.za/fontes/smart/tnt.m3u8', category: 'Series', logo: `${LOGO_BASE}/tnt-br.png` },
  { id: 'tnt-novelas', name: 'TNT Novelas', url: 'https://canais.fazoeli.co.za/fontes/smart/tntnovelas.m3u8', category: 'Series', logo: `${LOGO_BASE}/tnt-novelas-br.png` },
  { id: 'axn', name: 'AXN', url: 'https://canais.fazoeli.co.za/fontes/smart/axn.m3u8', category: 'Series', logo: `${LOGO_BASE}/axn-br.png` },
  { id: 'sony', name: 'Sony Channel', url: 'https://canais.fazoeli.co.za/fontes/smart/sonychannel.m3u8', category: 'Series', logo: `${LOGO_BASE}/sony-channel-br.png` },
  { id: 'universal-tv', name: 'Universal TV', url: 'https://canais.fazoeli.co.za/fontes/smart/universaltv.m3u8', category: 'Series', logo: `${LOGO_BASE}/universal-tv-br.png` },
  { id: 'ae', name: 'A&E', url: 'https://canais.fazoeli.co.za/fontes/smart/ae.m3u8', category: 'Series', logo: `${LOGO_BASE}/a-and-e-br.png` },
  { id: 'tnt-series', name: 'TNT Series', url: 'https://canais.fazoeli.co.za/fontes/smart/tntseries.m3u8', category: 'Series', logo: `${LOGO_BASE}/tnt-series-br.png` },
  { id: 'amc', name: 'AMC', url: 'https://canais.fazoeli.co.za/fontes/smart/amc.m3u8', category: 'Series', logo: `${LOGO_US}/amc-us.png` },
 
  // === INFANTIL ===
  { id: 'gloob', name: 'Gloob', url: 'https://canais.fazoeli.co.za/fontes/smart/gloob.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/gloob-br.png` },
  { id: 'cartoon-network', name: 'Cartoon Network', url: 'https://canais.fazoeli.co.za/fontes/smart/cartoonnetwork.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/cartoon-network-br.png` },
  { id: 'cartoonito', name: 'Cartoonito', url: 'https://canais.fazoeli.co.za/fontes/smart/cartoonito.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/cartoonito-br.png` },
  { id: 'discovery-kids', name: 'Discovery Kids', url: 'https://canais.fazoeli.co.za/fontes/smart/discoverykids.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/discovery-kids-br.png` },
  { id: '24h-simpsons', name: '24h Simpsons', url: 'https://canais.fazoeli.co.za/fontes/smart/24h_simpsons.m3u8', category: 'Infantil', logo: getFallbackLogo('Simpsons') },
  { id: '24h-dragonball', name: '24h Dragon Ball', url: 'https://canais.fazoeli.co.za/fontes/smart/24h_dragonball.m3u8', category: 'Infantil', logo: getFallbackLogo('Dragon Ball') },
  { id: '24h-odeia-chris', name: '24h Todo Mundo Odeia o Chris', url: 'https://canais.fazoeli.co.za/fontes/smart/24h_odeiachris.m3u8', category: 'Infantil', logo: getFallbackLogo('Chris') },
  { id: 'adult-swim', name: 'Adult Swim', url: 'https://canais.fazoeli.co.za/fontes/smart/adultswim.m3u8', category: 'Infantil', logo: `${LOGO_US}/adult-swim-us.png` },
  { id: 'nickelodeon', name: 'Nickelodeon', url: 'https://canais.fazoeli.co.za/fontes/smart/nickelodeon.m3u8', category: 'Infantil', logo: `${LOGO_LAM}/nickelodeon-lam.png` },
  { id: 'gospel-cartoon', name: 'Gospel Cartoon', url: 'https://stmv1.srvif.com/gospelcartoon/gospelcartoon/playlist.m3u8', category: 'Infantil', logo: 'https://i.imgur.com/yxjPno5.png' },
  { id: 'geekdot', name: 'Geekdot', url: 'https://stream.ichibantv.com:3764/hybrid/play.m3u8', category: 'Infantil', logo: 'https://i.imgur.com/jML1u4O.png' },
 
  // === DOCUMENTARIOS ===
  { id: 'discovery', name: 'Discovery Channel', url: 'https://canais.fazoeli.co.za/fontes/smart/discoverychannel.m3u8', category: 'Documentarios', logo: `${LOGO_US}/discovery-channel-us.png` },
  { id: 'animal-planet', name: 'Animal Planet', url: 'https://canais.fazoeli.co.za/fontes/smart/animalplanet.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/animal-planet-int.png` },
  { id: 'history', name: 'History', url: 'https://canais.fazoeli.co.za/fontes/smart/history.m3u8', category: 'Documentarios', logo: `${LOGO_LAM}/history-channel-lam.png` },
  { id: 'history2', name: 'History 2', url: 'https://canais.fazoeli.co.za/fontes/smart/history2.m3u8', category: 'Documentarios', logo: `${LOGO_LAM}/history-channel-2-lam.png` },
  { id: 'food-network', name: 'Food Network', url: 'https://canais.fazoeli.co.za/fontes/smart/foodnetwork.m3u8', category: 'Documentarios', logo: `${LOGO_US}/food-network-us.png` },
  { id: 'tlc', name: 'TLC', url: 'https://canais.fazoeli.co.za/fontes/smart/tlc.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/tlc-int.png` },
  { id: 'hgtv', name: 'HGTV', url: 'https://canais.fazoeli.co.za/fontes/smart/hgtv.m3u8', category: 'Documentarios', logo: `${LOGO_US}/hgtv-us.png` },
  { id: 'discovery-hh', name: 'Discovery H&H', url: 'https://canais.fazoeli.co.za/fontes/smart/discoveryhh.m3u8', category: 'Documentarios', logo: `${LOGO_LAM}/discovery-home-and-health-lam.png` },
  { id: 'discovery-id', name: 'Investigation Discovery', url: 'https://canais.fazoeli.co.za/fontes/smart/discoveryid.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/investigation-discovery-int.png` },
  { id: 'discovery-science', name: 'Discovery Science', url: 'https://canais.fazoeli.co.za/fontes/smart/discoveryscience.m3u8', category: 'Documentarios', logo: `${LOGO_US}/discovery-science-us.png` },
  { id: 'discovery-world', name: 'Discovery World', url: 'https://canais.fazoeli.co.za/fontes/smart/discoveryworld.m3u8', category: 'Documentarios', logo: `${LOGO_US}/discovery-history-us.png` },
  { id: 'discovery-turbo', name: 'Discovery Turbo', url: 'https://canais.fazoeli.co.za/fontes/smart/discoveryturbo.m3u8', category: 'Documentarios', logo: `${LOGO_BASE}/discovery-turbo-br.png` },

  // === ENTRETENIMENTO ===
  { id: 'multishow', name: 'Multishow', url: 'https://canais.fazoeli.co.za/fontes/smart/multishow.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/multishow-br.png` },
  { id: 'bis', name: 'BIS', url: 'https://canais.fazoeli.co.za/fontes/smart/bis.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bis-br.png` },
  { id: 'viva', name: 'Viva', url: 'https://canais.fazoeli.co.za/fontes/smart/viva.m3u8', category: 'Entretenimento', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Canal_Viva_2018_wordmark.svg/960px-Canal_Viva_2018_wordmark.svg.png' },
  { id: 'off', name: 'OFF', url: 'https://canais.fazoeli.co.za/fontes/smart/off.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/canal-off-br.png` },
  { id: 'gnt', name: 'GNT', url: 'https://canais.fazoeli.co.za/fontes/smart/gnt.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/gnt-br.png` },
  { id: 'arte1', name: 'Arte 1', url: 'https://canais.fazoeli.co.za/fontes/smart/arte1.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/arte1-br.png` },
  { id: 'cultura', name: 'TV Cultura', url: 'https://canais.fazoeli.co.za/fontes/smart/cultura.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/tv-cultura-br.png` },
  { id: 'loading-tv', name: 'Loading', url: 'https://stmv1.srvif.com/loadingtv/loadingtv/playlist.m3u8', category: 'Entretenimento', logo: 'https://i.imgur.com/R0aflu1.png' },
  { id: 'revry-brasil', name: 'Revry Brasil', url: 'https://linear-181.frequency.stream/dist/24i/181/hls/master/playlist.m3u8', category: 'Entretenimento', logo: getFallbackLogo('Revry') },
  { id: 'mytime-movie', name: 'MyTime Movie', url: 'https://appletree-mytime-samsungbrazil.amagi.tv/playlist.m3u8', category: 'Entretenimento', logo: 'https://i.imgur.com/aiGQtzI.png' },
  { id: 'classique-tv', name: 'Classique TV', url: 'https://stmv1.srvif.com/classique/classique/playlist.m3u8', category: 'Entretenimento', logo: 'https://i.imgur.com/rHxcraT.png' },
  { id: 'gospel-movie-tv', name: 'Gospel Movie TV', url: 'https://stmv1.srvif.com/gospelf/gospelf/playlist.m3u8', category: 'Entretenimento', logo: 'https://i.imgur.com/cQN3nWt.png' },
  // === NOTICIAS ===
  { id: 'globo-news', name: 'Globo News', url: 'https://canais.fazoeli.co.za/fontes/smart/globonews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/globo-news-br.png` },
  { id: 'cnn-brasil', name: 'CNN Brasil', url: 'https://canais.fazoeli.co.za/fontes/smart/cnnbrasil.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/cnn-brasil-br.png` },
  { id: 'band-news', name: 'Band News', url: 'https://canais.fazoeli.co.za/fontes/smart/bandnews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/band-news-br.png` },
  { id: 'record-news', name: 'Record News', url: 'https://canais.fazoeli.co.za/fontes/smart/recordnews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/record-news-br.png` },
  { id: 'jovem-pan-news', name: 'Jovem Pan News', url: 'https://d6yfbj4xxtrod.cloudfront.net/out/v1/7836eb391ec24452b149f3dc6df15bbd/index.m3u8', category: 'Noticias', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Jovem_Pan_logo_2018.svg/512px-Jovem_Pan_logo_2018.svg.png' },
  { id: 'stz-tv', name: 'STZ TV', url: 'https://cdn.live.br1.jmvstream.com/webtv/AVJ-12952/playlist/playlist.m3u8', category: 'Noticias', logo: 'https://i.imgur.com/SeF2I7q.png' },

  // === TV ABERTA ===
  { id: 'globo-sp', name: 'Globo SP', url: 'https://canais.fazoeli.co.za/fontes/smart/globosp.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'globo-rj', name: 'Globo RJ', url: 'https://canais.fazoeli.co.za/fontes/smart/globorj.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'globo-mg', name: 'Globo MG', url: 'https://canais.fazoeli.co.za/fontes/smart/globomg.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'globo-rs', name: 'Globo RS', url: 'https://canais.fazoeli.co.za/fontes/smart/globors.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/globo-br.png` },
  { id: 'sbt', name: 'SBT', url: 'https://canais.fazoeli.co.za/fontes/smart/sbt.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/sbt-br.png` },
  { id: 'band', name: 'Band', url: 'https://canais.fazoeli.co.za/fontes/smart/band.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/band-br.png` },
  { id: 'record', name: 'Record TV', url: 'https://canais.fazoeli.co.za/fontes/smart/record.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/record-br.png` },
  { id: 'rede-tv', name: 'RedeTV!', url: 'https://canais.fazoeli.co.za/fontes/smart/redetv.m3u8', category: 'TV Aberta', logo: `${LOGO_BASE}/rede-tv-br.png` },
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
  { id: 'despertar-tv', name: 'Despertar TV', url: 'https://cdn.live.br1.jmvstream.com/webtv/pejexypz/playlist/playlist.m3u8', category: 'TV Aberta', logo: getFallbackLogo('Despertar') },
  
  // === ESPORTES ===
  { id: 'sportv', name: 'SporTV', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv-br.png` },
  { id: 'sportv2', name: 'SporTV 2', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv2.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv2-br.png` },
  { id: 'sportv3', name: 'SporTV 3', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv3.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv3-br.png` },
  { id: 'espn', name: 'ESPN', url: 'https://canais.fazoeli.co.za/fontes/smart/espn.m3u8', category: 'Esportes', logo: `${LOGO_INTL}/espn-int.png` },
  { id: 'espn2', name: 'ESPN 2', url: 'https://canais.fazoeli.co.za/fontes/smart/espn2.m3u8', category: 'Esportes', logo: `${LOGO_LAM}/espn-2-lam.png` },
  { id: 'espn3', name: 'ESPN 3', url: 'https://canais.fazoeli.co.za/fontes/smart/espn3.m3u8', category: 'Esportes', logo: `${LOGO_LAM}/espn-3-lam.png` },
  { id: 'espn4', name: 'ESPN 4', url: 'https://canais.fazoeli.co.za/fontes/smart/espn4.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/espn-4-br.png` },
  { id: 'espn5', name: 'ESPN 5', url: 'https://canais.fazoeli.co.za/fontes/smart/espn5.m3u8', category: 'Esportes', logo: `${LOGO_INTL}/espn-int.png` },
  { id: 'premiere', name: 'Premiere', url: 'https://canais.fazoeli.co.za/fontes/smart/premiere.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'premiere2', name: 'Premiere 2', url: 'https://canais.fazoeli.co.za/fontes/smart/premiere2.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'premiere3', name: 'Premiere 3', url: 'https://canais.fazoeli.co.za/fontes/smart/premiere3.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'premiere4', name: 'Premiere 4', url: 'https://canais.fazoeli.co.za/fontes/smart/premiere4.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'combate', name: 'Combate', url: 'https://canais.fazoeli.co.za/fontes/smart/combate.m3u8', category: 'Esportes', logo: `${LOGO_US}/ufc-us.png` },
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
  { id: 'lifetime-movies', name: 'Lifetime Movies', url: 'https://fl1.moveonjoy.com/LIFETIME_MOVIE_NETWORK/index.m3u8', category: 'Internacionais', logo: getFallbackLogo('Lifetime') },
  { id: 'epix', name: 'Epix', url: 'https://fl1.moveonjoy.com/EPIX/index.m3u8', category: 'Internacionais', logo: getFallbackLogo('Epix') },
  { id: '4k-travel', name: '4K Travel TV', url: 'https://streams2.sofast.tv/sofastplayout/33c31ac4-51fa-46ae-afd0-0d1fe5e60a80_0_HLS/master.m3u8', category: 'Internacionais', logo: getFallbackLogo('4K Travel') },
  { id: 'destination-tv', name: 'Destination TV', url: 'http://media4.tripsmarter.com:1935/LiveTV/DTVHD/playlist.m3u8', category: 'Internacionais', logo: getFallbackLogo('Destination') },
  { id: 'movie-channel', name: 'The Movie Channel', url: 'https://streams2.sofast.tv/sofastplayout/32eb332e-f644-46e5-ad91-e55ad80d14f7_0_HLS/master.m3u8', category: 'Internacionais', logo: getFallbackLogo('Movie') },
  { id: 'kuriakos-kids', name: 'Kuriakos Kids', url: 'https://w2.manasat.com/kkids/smil:kkids.smil/playlist.m3u8', category: 'Internacionais', logo: 'https://i.imgur.com/SRX6EPY.png' },
  { id: 'angel-tv', name: 'Angel TV', url: 'https://janya-digimix.akamaized.net/vglive-sk-382409/portuese/ngrp:angelportuguese_all/playlist.m3u8', category: 'Internacionais', logo: 'https://i.imgur.com/qKLEGU7.png' },

  // === ADULTO (SECRETO) ===
  { id: 'playboy', name: 'Playboy TV', url: 'https://canais.fazoeli.co.za/fontes/smart/playboy.m3u8', category: 'Adulto', logo: getFallbackLogo('Playboy') },
  { id: 'sexy-hot', name: 'Sexy Hot', url: 'https://canais.fazoeli.co.za/fontes/smart/sexyhot.m3u8', category: 'Adulto', logo: getFallbackLogo('Sexy Hot') },
  // AdultIPTV.net CDN
  { id: 'adult-anal-cdn', name: 'Anal', url: 'https://cdn.adultiptv.net/anal.m3u8', category: 'Adulto', logo: getFallbackLogo('Anal') },
  { id: 'adult-asian-cdn', name: 'Asian', url: 'https://cdn.adultiptv.net/asian.m3u8', category: 'Adulto', logo: getFallbackLogo('Asian') },
  { id: 'adult-bigass', name: 'Big Ass', url: 'https://cdn.adultiptv.net/bigass.m3u8', category: 'Adulto', logo: getFallbackLogo('BigAss') },
  { id: 'adult-bigdick', name: 'Big Dick', url: 'https://cdn.adultiptv.net/bigdick.m3u8', category: 'Adulto', logo: getFallbackLogo('BigDick') },
  { id: 'adult-bigtits', name: 'Big Tits', url: 'https://cdn.adultiptv.net/bigtits.m3u8', category: 'Adulto', logo: getFallbackLogo('BigTits') },
  { id: 'adult-blowjob', name: 'Blowjob', url: 'https://cdn.adultiptv.net/blowjob.m3u8', category: 'Adulto', logo: getFallbackLogo('Blowjob') },
  { id: 'adult-compilation', name: 'Compilation', url: 'https://cdn.adultiptv.net/compilation.m3u8', category: 'Adulto', logo: getFallbackLogo('Compilation') },
  { id: 'adult-cuckold', name: 'Cuckold', url: 'https://cdn.adultiptv.net/cuckold.m3u8', category: 'Adulto', logo: getFallbackLogo('Cuckold') },
  { id: 'adult-fetish', name: 'Fetish', url: 'https://cdn.adultiptv.net/fetish.m3u8', category: 'Adulto', logo: getFallbackLogo('Fetish') },
  { id: 'adult-gangbang', name: 'Gangbang', url: 'https://cdn.adultiptv.net/gangbang.m3u8', category: 'Adulto', logo: getFallbackLogo('Gangbang') },
  { id: 'adult-gay-cdn', name: 'Gay', url: 'https://cdn.adultiptv.net/gay.m3u8', category: 'Adulto', logo: getFallbackLogo('Gay') },
  { id: 'adult-hardcore', name: 'Hardcore', url: 'https://cdn.adultiptv.net/hardcore.m3u8', category: 'Adulto', logo: getFallbackLogo('Hardcore') },
  { id: 'adult-interracial', name: 'Interracial', url: 'https://cdn.adultiptv.net/interracial.m3u8', category: 'Adulto', logo: getFallbackLogo('Interracial') },
  { id: 'adult-livecams', name: 'Live Cams', url: 'https://cdn.adultiptv.net/livecams.m3u8', category: 'Adulto', logo: getFallbackLogo('LiveCams') },
  { id: 'adult-pornstar-cdn', name: 'Pornstar', url: 'https://cdn.adultiptv.net/pornstar.m3u8', category: 'Adulto', logo: getFallbackLogo('Pornstar') },
  { id: 'adult-pov', name: 'POV', url: 'https://cdn.adultiptv.net/pov.m3u8', category: 'Adulto', logo: getFallbackLogo('POV') },
  { id: 'adult-rough', name: 'Rough', url: 'https://cdn.adultiptv.net/rough.m3u8', category: 'Adulto', logo: getFallbackLogo('Rough') },
  { id: 'adult-russian', name: 'Russian', url: 'https://cdn.adultiptv.net/russian.m3u8', category: 'Adulto', logo: getFallbackLogo('Russian') },
  { id: 'adult-threesome', name: 'Threesome', url: 'https://cdn.adultiptv.net/threesome.m3u8', category: 'Adulto', logo: getFallbackLogo('Threesome') },
  { id: 'adult-woman', name: 'Woman', url: 'https://live.redtraffic.net/woman.m3u8', category: 'Adulto', logo: getFallbackLogo('Woman') },
  // MyCamTV
  { id: 'mycam-anal', name: 'MyCam Anal', url: 'https://live.mycamtv.com/anal.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  { id: 'mycam-asian', name: 'MyCam Asian', url: 'https://live.mycamtv.com/asian.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  { id: 'mycam-bigass', name: 'MyCam Big Ass', url: 'https://live.mycamtv.com/defstream.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  { id: 'mycam-bigtits', name: 'MyCam Big Tits', url: 'https://live.mycamtv.com/bigtits.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  { id: 'mycam-blonde', name: 'MyCam Blonde', url: 'https://live.mycamtv.com/blonde.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  { id: 'mycam-brunette', name: 'MyCam Brunette', url: 'https://live.mycamtv.com/brunette.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  { id: 'mycam-latina', name: 'MyCam Latina', url: 'https://live.mycamtv.com/latina.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  { id: 'mycam-squirt', name: 'MyCam Squirt', url: 'https://live.mycamtv.com/squirt.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  { id: 'mycam-white', name: 'MyCam White', url: 'https://live.mycamtv.com/white.m3u8', category: 'Adulto', logo: getFallbackLogo('MyCam') },
  // Canais Premium
  { id: 'jenny-live', name: 'Jenny Live', url: 'https://59ec5453559f0.streamlock.net/JennyLive/JennyLive/playlist.m3u8', category: 'Adulto', logo: getFallbackLogo('Jenny') },
  { id: 'miami-tv-mexico', name: 'Miami TV Mexico', url: 'https://59ec5453559f0.streamlock.net/mexicotv/smil:miamitvmexico/playlist.m3u8', category: 'Adulto', logo: getFallbackLogo('Miami') },
  { id: 'olala', name: 'O-la-la!', url: 'http://31.148.48.15/O-la-la/index.m3u8', category: 'Adulto', logo: 'https://i.imgur.com/6aOmZs4.png' },
  { id: 'playboy-latam', name: 'Playboy TV Latin America', url: 'http://190.11.225.124:5000/live/playboy_hd/playlist.m3u8', category: 'Adulto', logo: 'https://i.imgur.com/B3DMUM9.png' },
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
  'Internacionais',
  'Adulto',
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
    logo: channel.logo || getFallbackLogo(channel.name),
  }));

// Canais públicos (sem adulto)
export const channels: Channel[] = allChannels.filter(ch => ch.category !== 'Adulto');

// Canais adultos (secretos)
export const adultChannels: Channel[] = allChannels.filter(ch => ch.category === 'Adulto');

// Função para obter todos os canais incluindo adultos
export const getAllChannels = (includeAdult: boolean): Channel[] => {
  if (includeAdult) {
    return allChannels;
  }
  return channels;
};
