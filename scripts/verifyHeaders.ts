
const urlsToTest = [
    'http://camelo.vip:80/movie/bru777322/Online99999/30638.mp4',
    'http://govfederal.org/live/stream.m3u8',
    'http://sub.domain.com:8080/path?query=1'
];

console.log('--- Teste de Geração de Headers ---');

urlsToTest.forEach(url => {
    try {
        const u = new URL(url);
        const referer = `${u.origin}/`;
        const origin = u.origin;

        console.log(`\nURL: ${url}`);
        console.log(`Origin Extraído: ${u.origin}`);
        console.log(`Referer Gerado:  ${referer}`);
        console.log(`Origin Gerado:   ${origin}`);

        if (referer !== u.origin + '/') console.error('❌ Referer incorreto');
        else console.log('✅ Referer OK');

        if (origin !== u.origin) console.error('❌ Origin incorreto');
        else console.log('✅ Origin OK');

    } catch (e) {
        console.error(`Erro ao processar ${url}:`, e);
    }
});
