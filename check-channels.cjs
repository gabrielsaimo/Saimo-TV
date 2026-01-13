const http = require('http');

// Lista de canais para verificar
const channelList = `#EXTINF:-1 group-title="CANAIS: GLOBO CAPITAIS ✨" tvg-logo="http://1.bp.blogspot.com/-5NFWoGxXMVo/Xk70W5FuqxI/AAAAAAAACFI/R0Md5ax85cUGHe4H8bhHZorfcukZH3TOACLcBGAsYHQ/s1600/globo.png",GLOBO BELEM ¹
http://govfederal.org:80/t1214c/87gzhd/21654.ts
#EXTINF:-1 group-title="CANAIS: ESPORTES ⚽" tvg-logo="http://1.bp.blogspot.com/-w_-8bx1hzcI/XmUJ5N5F7VI/AAAAAAAACVA/xJhpJpOiCMEJfcx7tucUtNqdLs53IFp-QCK4BGAYYCw/s400/BAND%2BSPORT.png",BAND SPORTS HD ³
http://govfederal.org:80/t1214c/87gzhd/26724.ts
#EXTINF:-1 group-title="CANAIS: PRIME VIDEO ⚽" tvg-logo="http://topxz.live/logos/PPV/PrimeVideo.png",PRIME VIDEO 02
http://govfederal.org:80/t1214c/87gzhd/121180.ts
#EXTINF:-1 group-title="CANAIS: TELECINE ✨" tvg-logo="http://1.bp.blogspot.com/-pIwQ4jpCaSA/Xk70h2WvMuI/AAAAAAAACG8/H7IRhohaMuIRdiA7vvJOAP8WhylZVCw8ACLcBGAsYHQ/s1600/tcaction.png",TELECINE ACTION
http://govfederal.org:80/t1214c/87gzhd/24533.ts
#EXTINF:-1 group-title="CANAIS: VARIEDADES ✨" tvg-logo="http://4.bp.blogspot.com/-ymMQqU8o9w4/XmQF4ZEEykI/AAAAAAAACRE/twbhOl3niJIoKhnYFk_-al4ULYFLKqiAgCK4BGAYYCw/s400/OFF.png",OFF FHD
http://govfederal.org:80/t1214c/87gzhd/8997.ts
#EXTINF:-1 group-title="CANAIS: HBO ✨" tvg-logo="http://1.bp.blogspot.com/-KUhkg79gvtE/Xk70Ycy0l6I/AAAAAAAACFU/FSdt9HsRs98gkzltg-oGA049omcb1KWlQCLcBGAsYHQ/s1600/hbo.png",HBO HD
http://govfederal.org:80/t1214c/87gzhd/8903.ts
#EXTINF:-1 group-title="CANAIS: SPORTV ⚽" tvg-logo="http://1.bp.blogspot.com/-3oX39I3AE5Q/Xk70hb83MHI/AAAAAAAACG0/xPBRbtnyn_oqMBPSH10X7XlVE_EEFGMbwCLcBGAsYHQ/s1600/sportv.png",SPORTV HD
http://govfederal.org:80/t1214c/87gzhd/9111.ts
#EXTINF:-1 group-title="CANAIS: ESPN ⚽" tvg-logo="http://1.bp.blogspot.com/-6WHUXIszhSo/Xk70ThUHf7I/AAAAAAAACEg/SiQTddgay9gyeGmfwBsvm57Fd4glh4wfgCLcBGAsYHQ/s1600/espn.png",ESPN HD
http://govfederal.org:80/t1214c/87gzhd/598916.ts
#EXTINF:-1 group-title="CANAIS: SBT ✨" tvg-logo="http://1.bp.blogspot.com/-w44XqjPTvWs/Xk70frnPuKI/AAAAAAAACGo/WLsOdZ3ANYApiYNooamMIhJAWiZwP2yLgCLcBGAsYHQ/s1600/sbt.png",SBT HD
http://govfederal.org:80/t1214c/87gzhd/9084.ts
#EXTINF:-1 group-title="CANAIS: RECORD ✨" tvg-logo="http://1.bp.blogspot.com/-XLsOZ60zFmY/Xk70eb1f_EI/AAAAAAAACGY/AxeGba7vVX0CNxveZAuNj3QzXwaN_t8FQCLcBGAsYHQ/s1600/record.png",RECORD HD
http://govfederal.org:80/t1214c/87gzhd/38066.ts
#EXTINF:-1 group-title="CANAIS: BAND ✨" tvg-logo="http://1.bp.blogspot.com/-7wD5BCJxD9Y/Xk70MQFgPEI/AAAAAAAACDQ/BpR4PcQ1ou48cOLmC77yc1mz9xkZ0zssgCLcBGAsYHQ/s1600/band_2.png",BAND SP HD
http://govfederal.org:80/t1214c/87gzhd/8660.ts
#EXTINF:-1 group-title="CANAIS: DISCOVERY ✨" tvg-logo="http://1.bp.blogspot.com/-gO9KQOa5_VM/Xk70PmiUxFI/AAAAAAAACD0/bActYU1lpyUhbKJQrR-parzrrGHAVIEkgCLcBGAsYHQ/s1600/discoverychannel.png",DISCOVERY CHANNEL HD
http://govfederal.org:80/t1214c/87gzhd/8736.ts
#EXTINF:-1 group-title="CANAIS: INFANTIS ✨" tvg-logo="http://1.bp.blogspot.com/-aondLW2i3Nw/Xk70ObLd84I/AAAAAAAACDk/UaL7ElNQW-AaFhG-9gEv2FSWp28Cci5hACLcBGAsYHQ/s1600/cartoonnetwork.png",CARTOON NETWORK HD
http://govfederal.org:80/t1214c/87gzhd/8699.ts
#EXTINF:-1 group-title="CANAIS: PREMIERE ⚽" tvg-logo="http://1.bp.blogspot.com/-9NsHz_itoFc/Xk70dxuLv7I/AAAAAAAACGQ/wCExIoJZ8xgbleziCR-Guhr-AkuLgFhVQCLcBGAsYHQ/s1600/premiere_2.png",PREMIERE CLUBES HD
http://govfederal.org:80/t1214c/87gzhd/94194.ts
#EXTINF:-1 group-title="CANAIS: FILMES E SÉRIES ✨" tvg-logo="http://2.bp.blogspot.com/-nBtQ5UkiBI4/XmQcIAhLVYI/AAAAAAAACSk/posGzR9eqD4zllrPY3vGIk6wsFYBJtlRQCK4BGAYYCw/s400/AXN.png",AXN HD
http://govfederal.org:80/t1214c/87gzhd/23692.ts
#EXTINF:-1 group-title="CANAIS: NOTÍCIAS ✨" tvg-logo="http://1.bp.blogspot.com/-JElazdWUyUo/Xk70WwgDZCI/AAAAAAAACFE/Fj8OKkbTSp03ONDEPgW9PzMlDWSmMx52QCLcBGAsYHQ/s1600/globonews.png",GLOBO NEWS HD
http://govfederal.org:80/t1214c/87gzhd/8854.ts
#EXTINF:-1 group-title="CANAIS: VARIEDADES ✨" tvg-logo="http://3.bp.blogspot.com/-iCbjYIDrwhE/XmP_eN3d_iI/AAAAAAAACQI/gVXF4j0G4Dwz8ZDiKaI8Qgth5DSUrcscgCK4BGAYYCw/s400/GNT.png",GNT HD
http://govfederal.org:80/t1214c/87gzhd/8890.ts
#EXTINF:-1 group-title="CANAIS: MÚSICA ✨" tvg-logo="http://2.bp.blogspot.com/-YLvYyrLM0Tc/XmQENo4hcuI/AAAAAAAACQs/jKWMWXYMuvIhu7iXvLJCm-9BEONKMcqxwCK4BGAYYCw/s400/MULTICHO.png",MULTISHOW HD
http://govfederal.org:80/t1214c/87gzhd/8974.ts
#EXTINF:-1 group-title="CANAIS: REDETV ✨" tvg-logo="http://1.bp.blogspot.com/-HUc16HfletI/Xk70fFB40uI/AAAAAAAACGg/dBpqILiwhXEA3Fc8oQo36AIbTkKmkJZewCLcBGAsYHQ/s1600/redetv.png",REDETV HD
http://govfederal.org:80/t1214c/87gzhd/9073.ts
#EXTINF:-1 group-title="CANAIS: DOCUMENTÁRIOS ✨" tvg-logo="http://topxz.live/logos/Documentarios/HISTORY.png",HISTORY HD
http://govfederal.org:80/t1214c/87gzhd/304496.ts`;

// Parsear a lista M3U
function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      
      if (nameMatch && i + 1 < lines.length) {
        const url = lines[i + 1].trim();
        if (url && !url.startsWith('#')) {
          channels.push({
            name: nameMatch[1],
            group: groupMatch ? groupMatch[1] : 'Sem Categoria',
            logo: logoMatch ? logoMatch[1] : '',
            originalUrl: url,
            m3u8Url: url.replace(/\.ts$/, '.m3u8')
          });
        }
      }
    }
  }
  
  return channels;
}

// Verificar se uma URL está funcionando
function checkUrl(url, timeout = 10000) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'HEAD',
      timeout: timeout
    };
    
    const req = http.request(options, (res) => {
      resolve({
        working: res.statusCode >= 200 && res.statusCode < 400,
        statusCode: res.statusCode
      });
    });
    
    req.on('error', () => {
      resolve({ working: false, statusCode: 0 });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ working: false, statusCode: 0, timeout: true });
    });
    
    req.end();
  });
}

// Verificar todos os canais
async function checkAllChannels() {
  const channels = parseM3U(channelList);
  
  console.log(`\n🔍 Verificando ${channels.length} canais...\n`);
  console.log('='.repeat(80));
  
  const results = {
    working: [],
    notWorking: []
  };
  
  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    process.stdout.write(`[${i + 1}/${channels.length}] Testando: ${channel.name.substring(0, 40).padEnd(40)} `);
    
    // Testar URL com .m3u8
    const result = await checkUrl(channel.m3u8Url);
    
    if (result.working) {
      console.log('✅ FUNCIONANDO');
      results.working.push(channel);
    } else {
      console.log('❌ OFFLINE');
      results.notWorking.push(channel);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESULTADO FINAL:\n');
  console.log(`✅ Canais funcionando: ${results.working.length}`);
  console.log(`❌ Canais offline: ${results.notWorking.length}`);
  
  if (results.working.length > 0) {
    console.log('\n\n📺 CANAIS FUNCIONANDO (URLs convertidas para .m3u8):\n');
    console.log('-'.repeat(80));
    
    // Gerar lista M3U8 com canais funcionando
    let m3u8Output = '#EXTM3U\n';
    
    results.working.forEach(channel => {
      console.log(`\n📌 ${channel.name}`);
      console.log(`   Categoria: ${channel.group}`);
      console.log(`   URL (.m3u8): ${channel.m3u8Url}`);
      
      m3u8Output += `#EXTINF:-1 group-title="${channel.group}" tvg-logo="${channel.logo}",${channel.name}\n`;
      m3u8Output += `${channel.m3u8Url}\n`;
    });
    
    // Salvar lista de canais funcionando
    const fs = require('fs');
    fs.writeFileSync('canais-funcionando.m3u8', m3u8Output);
    console.log('\n\n💾 Lista salva em: canais-funcionando.m3u8');
  }
  
  if (results.notWorking.length > 0) {
    console.log('\n\n❌ CANAIS OFFLINE:\n');
    results.notWorking.forEach(channel => {
      console.log(`   - ${channel.name}`);
    });
  }
}

// Executar
checkAllChannels().catch(console.error);
