import type { Channel } from '../types/channel';

// Base URL para logos do repositório tv-logo/tv-logos (GitHub)
const LOGO_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil';
const LOGO_INTL = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/international';
const LOGO_US = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states';

// Fallback para logos não encontradas - gera avatar com iniciais
const getFallbackLogo = (name: string) => {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=8b5cf6&color=fff&size=128&bold=true&format=png`;
};

const rawChannels = [
  // === FILMES ===
  { id: 'telecine-action', name: 'Telecine Action', url: 'https://canais.fazoeli.co.za/fontes/smart/telecineaction.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-action-br.png` },
  { id: 'telecine-premium', name: 'Telecine Premium', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinepremium.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-premium-br.png` },
  { id: 'telecine-pipoca', name: 'Telecine Pipoca', url: 'https://canais.fazoeli.co.za/fontes/smart/telecinepipoca.m3u8', category: 'Filmes', logo: `${LOGO_BASE}/tele-cine-pipoca-br.png` },
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
  { id: 'curta', name: 'Curta!', url: 'https://canais.fazoeli.co.za/fontes/smart/curta.m3u8', category: 'Filmes', logo: getFallbackLogo('Curta') },

  // === SERIES ===
  { id: 'warner', name: 'Warner Channel', url: 'https://canais.fazoeli.co.za/fontes/smart/warnerchannel.m3u8', category: 'Series', logo: `${LOGO_BASE}/warner-channel-br.png` },
  { id: 'tnt', name: 'TNT', url: 'https://canais.fazoeli.co.za/fontes/smart/tnt.m3u8', category: 'Series', logo: `${LOGO_BASE}/tnt-br.png` },
  { id: 'tnt-series', name: 'TNT Series', url: 'https://canais.fazoeli.co.za/fontes/smart/tntnovelas.m3u8', category: 'Series', logo: `${LOGO_BASE}/tnt-series-br.png` },
  { id: 'axn', name: 'AXN', url: 'https://canais.fazoeli.co.za/fontes/smart/axn.m3u8', category: 'Series', logo: `${LOGO_BASE}/axn-br.png` },
  { id: 'sony', name: 'Sony Channel', url: 'https://1hge39g.p.wvcast.com:30002/proxy/A3us3cC0/sonychannel.m3u8', category: 'Series', logo: `${LOGO_BASE}/sony-channel-br.png` },
  { id: 'universal-tv', name: 'Universal TV', url: 'https://canais.fazoeli.co.za/fontes/smart/universaltv.m3u8', category: 'Series', logo: `${LOGO_BASE}/universal-tv-br.png` },
  { id: 'ae', name: 'A&E', url: 'https://canais.fazoeli.co.za/fontes/smart/ae.m3u8', category: 'Series', logo: `${LOGO_BASE}/a-and-e-br.png` },

  // === INFANTIL ===
  { id: 'gloob', name: 'Gloob', url: 'https://canais.fazoeli.co.za/fontes/smart/gloob.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/gloob-br.png` },
  { id: 'gloobinho', name: 'Gloobinho', url: 'https://canais.fazoeli.co.za/fontes/smart/gloobinho.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/gloobinho-br.png` },
  { id: 'cartoon-network', name: 'Cartoon Network', url: 'https://canais.fazoeli.co.za/fontes/smart/cartoonnetwork.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/cartoon-network-br.png` },
  { id: 'cartoonito', name: 'Cartoonito', url: 'https://canais.fazoeli.co.za/fontes/smart/cartoonito.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/cartoonito-br.png` },
  { id: 'discovery-kids', name: 'Discovery Kids', url: 'https://canais.fazoeli.co.za/fontes/smart/discoverykids.m3u8', category: 'Infantil', logo: `${LOGO_BASE}/discovery-kids-br.png` },
  { id: '24h-simpsons', name: '24h Simpsons', url: 'https://canais.fazoeli.co.za/fontes/smart/24h_simpsons.m3u8', category: 'Infantil', logo: getFallbackLogo('Simpsons') },
  { id: '24h-dragonball', name: '24h Dragon Ball', url: 'https://canais.fazoeli.co.za/fontes/smart/24h_dragonball.m3u8', category: 'Infantil', logo: getFallbackLogo('Dragon Ball') },
  { id: '24h-odeia-chris', name: '24h Todo Mundo Odeia o Chris', url: 'https://canais.fazoeli.co.za/fontes/smart/24h_odeiachris.m3u8', category: 'Infantil', logo: getFallbackLogo('Chris') },
  { id: 'adult-swim', name: 'Adult Swim', url: 'https://canais.fazoeli.co.za/fontes/smart/adultswim.m3u8', category: 'Infantil', logo: `${LOGO_US}/adult-swim-us.png` },

  // === DOCUMENTARIOS ===
  { id: 'discovery', name: 'Discovery Channel', url: 'https://canais.fazoeli.co.za/fontes/smart/discoverychannel.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/discovery-channel-int.png` },
  { id: 'discovery-turbo', name: 'Discovery Turbo', url: 'https://canais.fazoeli.co.za/fontes/smart/discoveryturbo.m3u8', category: 'Documentarios', logo: `${LOGO_BASE}/discovery-turbo-br.png` },
  { id: 'animal-planet', name: 'Animal Planet', url: 'https://canais.fazoeli.co.za/fontes/smart/animalplanet.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/animal-planet-int.png` },
  { id: 'history', name: 'History', url: 'https://canais.fazoeli.co.za/fontes/smart/history.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/history.png` },
  { id: 'history2', name: 'History 2', url: 'https://canais.fazoeli.co.za/fontes/smart/history2.m3u8', category: 'Documentarios', logo: `${LOGO_INTL}/history-2.png` },

  // === ENTRETENIMENTO ===
  { id: 'multishow', name: 'Multishow', url: 'https://canais.fazoeli.co.za/fontes/smart/multishow.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/multishow-br.png` },
  { id: 'bis', name: 'BIS', url: 'https://canais.fazoeli.co.za/fontes/smart/bis.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/bis-br.png` },
  { id: 'viva', name: 'Viva', url: 'https://canais.fazoeli.co.za/fontes/smart/viva.m3u8', category: 'Entretenimento', logo: getFallbackLogo('Viva') },
  { id: 'off', name: 'OFF', url: 'https://canais.fazoeli.co.za/fontes/smart/off.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/canal-off-br.png` },
  { id: 'gnt', name: 'GNT', url: 'https://canais.fazoeli.co.za/fontes/smart/gnt.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/gnt-br.png` },
  { id: 'arte1', name: 'Arte 1', url: 'https://canais.fazoeli.co.za/fontes/smart/arte1.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/arte1-br.png` },
  { id: 'cultura', name: 'TV Cultura', url: 'https://canais.fazoeli.co.za/fontes/smart/cultura.m3u8', category: 'Entretenimento', logo: `${LOGO_BASE}/tv-cultura-br.png` },

  // === NOTICIAS ===
  { id: 'globo-news', name: 'Globo News', url: 'https://canais.fazoeli.co.za/fontes/smart/globonews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/globo-news-br.png` },
  { id: 'cnn-brasil', name: 'CNN Brasil', url: 'https://canais.fazoeli.co.za/fontes/smart/cnnbrasil.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/cnn-brasil-br.png` },
  { id: 'band-news', name: 'Band News', url: 'https://canais.fazoeli.co.za/fontes/smart/bandnews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/band-news-br.png` },
  { id: 'record-news', name: 'Record News', url: 'https://canais.fazoeli.co.za/fontes/smart/recordnews.m3u8', category: 'Noticias', logo: `${LOGO_BASE}/record-news-br.png` },

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

  // === ESPORTES ===
  { id: 'sportv', name: 'SporTV', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv-br.png` },
  { id: 'sportv2', name: 'SporTV 2', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv2.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv2-br.png` },
  { id: 'sportv3', name: 'SporTV 3', url: 'https://canais.fazoeli.co.za/fontes/smart/sportv3.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/sportv3-br.png` },
  { id: 'espn', name: 'ESPN', url: 'https://canais.fazoeli.co.za/fontes/smart/espn.m3u8', category: 'Esportes', logo: `${LOGO_INTL}/espn-int.png` },
  { id: 'espn2', name: 'ESPN 2', url: 'https://canais.fazoeli.co.za/fontes/smart/espn2.m3u8', category: 'Esportes', logo: `${LOGO_INTL}/espn-2-int.png` },
  { id: 'espn3', name: 'ESPN 3', url: 'https://canais.fazoeli.co.za/fontes/smart/espn3.m3u8', category: 'Esportes', logo: `${LOGO_INTL}/espn-3-int.png` },
  { id: 'espn4', name: 'ESPN 4', url: 'https://canais.fazoeli.co.za/fontes/smart/espn4.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/espn-4-br.png` },
  { id: 'premiere', name: 'Premiere', url: 'https://canais.fazoeli.co.za/fontes/smart/premiere.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/premiere-br.png` },
  { id: 'combate', name: 'Combate', url: 'https://canais.fazoeli.co.za/fontes/smart/combate.m3u8', category: 'Esportes', logo: `${LOGO_INTL}/combate-int.png` },
  { id: 'band-sports', name: 'Band Sports', url: 'https://canais.fazoeli.co.za/fontes/smart/bandsports.m3u8', category: 'Esportes', logo: `${LOGO_BASE}/band-sports-br.png` },
];

// Ordena alfabeticamente e adiciona número do canal + logo fallback
export const channels: Channel[] = rawChannels
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  .map((channel, index) => ({
    ...channel,
    channelNumber: index + 1,
    logo: channel.logo || getFallbackLogo(channel.name),
  }));
