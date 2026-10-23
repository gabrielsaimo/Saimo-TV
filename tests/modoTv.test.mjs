import assert from 'node:assert/strict';
import test from 'node:test';

// Simula o ambiente da TV antes de carregar os módulos.
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5) AppleWebKit/537.36 Chrome/69' }, configurable: true });
globalThis.window = globalThis;
// O app instalado: o carregador do pacote grava a marca.
globalThis.__SAIMO_TV__ = 'tizen';
globalThis.localStorage = { getItem: () => null, setItem() {} };

// Os módulos importam sem extensão (resolução do bundler): empacota antes de carregar.
import { buildSync } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const saida = join(mkdtempSync(join(tmpdir(), 'modotv-')), 'tv.mjs');
buildSync({
  stdin: { contents: "export * from './src/utils/streamUrl.ts'; export * from './src/plataforma/tv.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: saida, logLevel: 'error',
  define: { 'import.meta.env.VITE_PROXY_BASE': 'undefined' },
});
const { buildAttempts, needsProxy, proxyBase, playableUrl, marcaTv, ehTv } = await import(saida);

const http = { url: 'http://cdn.exemplo.com/canal/index.m3u8' };
const https = { url: 'https://cdn.exemplo.com/canal/index.m3u8' };
const txt = { url: 'https://cdn.exemplo.com/mestre.txt' };

test('detecta Samsung pelo user agent', () => {
  assert.equal(marcaTv(), 'tizen');
  assert.equal(ehTv(), true);
});

test('na TV nenhum endereço começa pelo proxy, nem http nem .txt', () => {
  assert.equal(needsProxy(http), false);
  assert.equal(needsProxy(txt), false);
  assert.equal(playableUrl(http), http.url);
});

test('na TV cada fonte é tentada direto primeiro e o proxy fica de reserva', () => {
  const t = buildAttempts([http, https, txt]);
  assert.equal(t.length, 6);
  for (let i = 0; i < t.length; i += 2) {
    assert.equal(t[i].viaProxy, false);
    assert.equal(t[i].url, t[i].source.url);
    assert.equal(t[i + 1].viaProxy, true);
  }
});

test('o proxy de reserva é o do site, não a origem local do pacote', () => {
  assert.equal(proxyBase(), 'https://saimo-tv.pages.dev');
  assert.ok(buildAttempts([http])[1].url.startsWith('https://saimo-tv.pages.dev/api/proxy?url='));
});

test('com HLS nativo na TV, o decodificador da TV vem logo depois do hls.js direto', () => {
  globalThis.document = { createElement: () => ({ canPlayType: () => 'maybe' }) };
  const t = buildAttempts([http]);
  assert.deepEqual(t.map((a) => [a.nativo === true, a.viaProxy]), [[false, false], [true, false], [false, true]]);
  assert.equal(t[0].url, http.url);
  delete globalThis.document;
});

test('TV sem HLS nativo não inventa a tentativa nativa', () => {
  assert.ok(buildAttempts([http]).every((a) => !a.nativo));
});

test('site aberto no navegador da TV (sem o pacote) segue as regras de página https', () => {
  delete globalThis.__SAIMO_TV__;
  globalThis.location = { origin: 'https://saimo-tv.pages.dev' };
  assert.equal(needsProxy(http), true);
  assert.ok(buildAttempts([http]).every((a) => a.viaProxy));
  globalThis.__SAIMO_TV__ = 'tizen';
});

test('proxy do site cortado pela cota do dia: usa o de reserva; de pé: usa o próprio', async () => {
  delete globalThis.__SAIMO_TV__;
  globalThis.location = { origin: 'https://saimo-tv.pages.dev' };
  const { sondarProxy: sondar, proxyBase: base } = await import(saida);
  globalThis.fetch = async () => ({ headers: { get: () => 'text/html; charset=utf-8' } });
  await sondar();
  assert.equal(base(), 'https://saimo-tv2.pages.dev');
  globalThis.fetch = async () => ({ headers: { get: () => 'application/json' } });
  await sondar();
  assert.equal(base(), 'https://saimo-tv.pages.dev');
  globalThis.__SAIMO_TV__ = 'tizen';
});
