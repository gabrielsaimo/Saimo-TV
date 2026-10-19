import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizarEndereco as n } from '../src/utils/enderecoLista.ts';

test('vazio é "sem endereço"', () => {
  assert.equal(n(''), '');
  assert.equal(n('   '), '');
  assert.equal(n(null), '');
  assert.equal(n(undefined), '');
});

test('sem esquema ganha https e barra final', () => {
  assert.equal(n('saimo-canais.pages.dev'), 'https://saimo-canais.pages.dev/');
  assert.equal(n('  saimo-canais.pages.dev/  '), 'https://saimo-canais.pages.dev/');
});

test('tira query, fragmento e o nome do arquivo colado', () => {
  assert.equal(n('https://x.dev/listas/catalogo.txt'), 'https://x.dev/listas/');
  assert.equal(n('https://x.dev/listas/catalogo.txt?v=1#a'), 'https://x.dev/listas/');
  assert.equal(n('https://x.dev/a/b?x=1'), 'https://x.dev/a/b/');
  assert.equal(n('https://x.dev/x.json'), 'https://x.dev/');
  assert.equal(n('x.dev/listas/vod/'), 'https://x.dev/listas/vod/');
});

test('http e porta são mantidos', () => {
  assert.equal(n('http://localhost:8101'), 'http://localhost:8101/');
  assert.equal(n('http://10.0.2.2:8102/'), 'http://10.0.2.2:8102/');
});

test('inválidos', () => {
  assert.equal(n('ftp://x.dev/'), null);
  assert.equal(n('https://x .dev/'), null);
  assert.equal(n('https://'), null);
  assert.equal(n('file:///etc/passwd'), null);
  assert.equal(n('javascript:alert(1)'), null);
});
