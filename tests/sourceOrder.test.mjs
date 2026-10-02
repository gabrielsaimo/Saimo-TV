import assert from 'node:assert/strict';
import test from 'node:test';
import { httpsFirst, initialSourceIndex } from '../src/utils/sourceOrder.ts';

test('HTTPS precede HTTP sem perder preferência, metadados ou fontes', () => {
  const sources = Object.freeze([
    Object.freeze({ url: 'http://example.test/a', versao: 'dub' }),
    Object.freeze({ url: 'https://example.test/b', versao: 'leg', resolution: 'HD' }),
    Object.freeze({ url: 'http://example.test/c', referer: 'https://example.test' }),
    Object.freeze({ url: 'https://example.test/d', versao: 'dub' }),
  ]);
  const result = httpsFirst(sources);
  assert.deepEqual(result, [sources[1], sources[3], sources[0], sources[2]]);
  assert.equal(result[0], sources[1]);
  assert.deepEqual(httpsFirst(result), result);
  assert.equal(sources[0].url, 'http://example.test/a');
});

test('catálogos vazios, somente HTTP e somente HTTPS continuam válidos', () => {
  for (const sources of [[], [{ url: 'http://example.test/a' }],
    [{ url: 'https://example.test/b' }, { url: 'https://example.test/a' }]]) {
    assert.deepEqual(httpsFirst(sources), sources);
  }
});

test('reconhece protocolo sem confundir HTTPS na query com o da fonte', () => {
  const sources = [{ url: 'http://example.test/?url=https://example.test' },
    { url: 'HTTPS://example.test/a' }];
  assert.deepEqual(httpsFirst(sources), [sources[1], sources[0]]);
});

test('padrão abre HTTPS; escolha manual HTTP não reordena a lista', () => {
  const sources = httpsFirst([{ url: 'http://example.test/a' }, { url: 'https://example.test/b' }]);
  assert.equal(initialSourceIndex(sources), 0);
  assert.equal(initialSourceIndex(sources, 'http://example.test/a'), 1);
  assert.equal(initialSourceIndex(sources, 'https://ausente.test'), 0);
  assert.equal(sources[0].url, 'https://example.test/b');
});
