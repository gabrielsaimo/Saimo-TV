import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  // Aumentar timeout para vídeos grandes
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Decodificar a URL
    const decodedUrl = decodeURIComponent(url);
    
    // Verificar se é uma URL HTTP válida
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    // Headers para fazer o streaming do vídeo
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // Suportar Range requests para seek no vídeo
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await fetch(decodedUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok && response.status !== 206) {
      return res.status(response.status).json({ 
        error: `Failed to fetch video: ${response.statusText}` 
      });
    }

    // Copiar headers relevantes da resposta
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');

    // Configurar headers da resposta
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }
    if (acceptRanges) {
      res.setHeader('Accept-Ranges', acceptRanges);
    }

    // Definir status code (200 ou 206 para partial content)
    res.status(response.status);

    // Converter response para ArrayBuffer e enviar
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return res.send(buffer);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy video',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
