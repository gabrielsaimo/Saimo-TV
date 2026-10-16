import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedVodUrl, onRequestGet } from '../functions/api/resolve-vod.ts';

test('recusa hosts arbitrários, credenciais e endpoints fora de VOD', () => {
  assert.equal(allowedVodUrl('http://dbonline.tech-cdn.top/series/a/b/1.mp4'), true);
  assert.equal(allowedVodUrl('https://hubby-dmca.com/movie/PlayTvOficial-vods/op3lQ6nP76/644196.mp4'), true);
  assert.equal(allowedVodUrl('http://hubby-dmca.com:80/series/PlayTvOficial-vods/op3lQ6nP76/101467.mp4'), true);
  for (const url of ['http://localhost/series/a', 'http://dbonline.tech-cdn.top.evil/series/a',
    'http://user@dbonline.tech-cdn.top/series/a', 'http://dbonline.tech-cdn.top/admin',
    'https://hubby-dmca.com/get.php']) {
    assert.equal(allowedVodUrl(url), false);
  }
});

test('valida HTTPS e assinatura MP4, sem seguir destinos arbitrários', async () => {
  const original = globalThis.fetch;
  const request = new Request('https://site.test/api/resolve-vod?url=' + encodeURIComponent('http://dbonline.tech-cdn.top/series/a/b/1.mp4'));
  try {
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      assert.equal(options.redirect, 'manual');
      if (calls.length === 1) return new Response(null, { status: 302, headers: {
        Location: 'http://dark-glade-b156.aa4f20382505.workers.dev/t/token/video',
      } });
      return new Response(new Uint8Array([0,0,0,24,102,116,121,112,0,0,0,0]), { status: 206 });
    };
    const result = await (await onRequestGet({ request })).json();
    assert.equal(result.url, 'https://dark-glade-b156.aa4f20382505.workers.dev/t/token/video');
    assert.equal(calls.length, 2);

    const hubbyReq = new Request('https://site.test/api/resolve-vod?url=' + encodeURIComponent('http://hubby-dmca.com:80/movie/PlayTvOficial-vods/op3lQ6nP76/399611.mp4'));
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), 'https://hubby-dmca.com/movie/PlayTvOficial-vods/op3lQ6nP76/399611.mp4');
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status: 302, headers: {
        Location: 'http://www-fontedecanais-live.77zzhf54vdll71.com:80/movies/33/399611.mp4?username=PlayTvOficial-vods&token=abc',
      } });
    };
    const hubbyRes = await (await onRequestGet({ request: hubbyReq })).json();
    assert.equal(hubbyRes.url, 'https://www-fontedecanais-live.77zzhf54vdll71.com/movies/33/399611.mp4?username=PlayTvOficial-vods&token=abc');

    globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } });
    assert.deepEqual(await (await onRequestGet({ request })).json(), { url: null });
    let n = 0;
    globalThis.fetch = async () => ++n === 1 ? new Response(null, { status: 302, headers: {
      Location: 'https://dark-glade-b156.aa4f20382505.workers.dev/t/token/video',
    } }) : new Response('<html>erro</html>');
    assert.deepEqual(await (await onRequestGet({ request })).json(), { url: null });
  } finally { globalThis.fetch = original; }
});
