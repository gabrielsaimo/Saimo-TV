import { useState } from 'react';
import { getProxiedUrl } from '../utils/proxyUrl';

const ProxyTester = () => {
  const [testUrl, setTestUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testProxy = async () => {
    if (!testUrl.trim()) return;

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const proxiedUrl = getProxiedUrl(testUrl);
      console.log('URL original:', testUrl);
      console.log('URL com proxy:', proxiedUrl);

      const response = await fetch(proxiedUrl, {
        method: 'HEAD', // Usa HEAD para não baixar todo o conteúdo
        headers: {
          'Range': 'bytes=0-100', // Pequeno range para testar
        },
      });

      const resultData = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
        redirected: response.redirected,
        proxiedUrl,
      };

      setResult(resultData);
      console.log('Resultado do teste:', resultData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      console.error('Erro no teste:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px 0' }}>
      <h3>Teste de Proxy</h3>
      <div style={{ marginBottom: '15px' }}>
        <label>
          URL do vídeo para testar:
          <input 
            type="text" 
            value={testUrl} 
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="ex: http://camelo.vip:80/movie/user/pass/12345.mp4"
            style={{ width: '100%', marginTop: '5px', padding: '8px' }}
          />
        </label>
      </div>
      
      <button 
        onClick={testProxy} 
        disabled={isLoading || !testUrl.trim()}
        style={{ padding: '10px 20px', marginRight: '10px' }}
      >
        {isLoading ? 'Testando...' : 'Testar Proxy'}
      </button>

      {error && (
        <div style={{ color: 'red', marginTop: '15px' }}>
          <strong>Erro:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '15px' }}>
          <h4>Resultado:</h4>
          <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
          
          <div style={{ marginTop: '10px' }}>
            <strong>Status:</strong> {result.status} {result.statusText}<br/>
            <strong>Content-Type:</strong> {result.headers['content-type']}<br/>
            <strong>Content-Length:</strong> {result.headers['content-length']}<br/>
            <strong>Suporta Range:</strong> {result.headers['accept-ranges'] || 'não'}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProxyTester;