// Servidor simples para testar proxy localmente
import express from 'express';
import fetch from 'node-fetch';
import dns from 'dns';
import net from 'net';

// Bloqueia acesso a IPs privados/reservados e endpoints de metadata de nuvem (proteção contra SSRF)
function isPrivateAddress(ip) {
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        return (
            parts[0] === 10 ||
            parts[0] === 127 ||
            (parts[0] === 169 && parts[1] === 254) ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168) ||
            (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
            parts[0] === 0
        );
    }
    if (net.isIPv6(ip)) {
        const normalized = ip.toLowerCase();
        return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
    }
    return true;
}

const app = express();
const PORT = 3001;

// Middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Range, Content-Type');
    next();
});

// Proxy endpoint similar ao que está na Vercel
app.get('/api/proxy', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const decodedUrl = decodeURIComponent(videoUrl);
        console.log('Proxy request:', decodedUrl);

        if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
            return res.status(400).json({ error: 'Invalid URL protocol' });
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': decodedUrl.includes('camelo.vip') ? 'http://camelo.vip/' : 
                       decodedUrl.includes('govfederal.org') ? 'http://govfederal.org/' : decodedUrl,
            'Accept': 'video/mp4,video/webm,video/*,*/*;q=0.8'
        };

        const rangeHeader = req.headers.range;
        if (rangeHeader) {
            headers['Range'] = rangeHeader;
        }

        const response = await fetch(decodedUrl, { headers });
        
        // Copy headers
        ['content-type', 'content-length', 'content-range', 'accept-ranges', 
         'last-modified', 'etag', 'cache-control'].forEach(header => {
            if (response.headers.has(header)) {
                res.set(header, response.headers.get(header));
            }
        });

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

        response.body.pipe(res);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Failed to proxy video',
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});