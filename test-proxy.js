// Teste rápido do proxy localmente
const testUrls = [
    'http://camelo.vip:80/movie/Jonas1854/Q57Bmz/303566.mp4',
    'http://govfederal.org:80/movie/t1214c/87gzhd/1131873.mp4'
];

async function testProxy() {
    for (const url of testUrls) {
        console.log(`\n=== Testando URL: ${url} ===`);
        
        try {
            // Simula o que getProxiedUrl faria em produção
            const encodedUrl = encodeURIComponent(url);
            const proxiedUrl = `http://localhost:5173/api/proxy?url=${encodedUrl}`;
            console.log('URL proxied:', proxiedUrl);
            
            const response = await fetch(proxiedUrl, {
                method: 'HEAD',
                headers: {
                    'Range': 'bytes=0-100'
                }
            });
            
            console.log('Status:', response.status, response.statusText);
            console.log('Headers:');
            response.headers.forEach((value, name) => {
                console.log(`  ${name}: ${value}`);
            });
            
        } catch (error) {
            console.error('Erro:', error.message);
        }
    }
}

testProxy();