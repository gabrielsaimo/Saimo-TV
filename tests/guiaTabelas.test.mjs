import assert from 'node:assert/strict';
import test from 'node:test';
import { lerGuia } from '../src/utils/guiaTabelas.ts';

test('lê as cinco seções e ignora comentários e linhas quebradas', () => {
  const t = lerGuia([
    '# comentário', '',
    'meuguia\tSporTV 2\tSP2',
    'guiadetv\tCNN Brasil HD\tcnn-brasil',
    'alias\tsportv 2\tSporTV2 HD',
    'feed\t-\thttps://feed.exemplo/a.xml',
    'feed\t-\tftp://invalido',
    'feed\t-\thttps://feed.exemplo/b.xml',
    'pluto\t-\thttps://pluto.exemplo/br.xml',
    'meuguia\tsem codigo',
    'desconhecido\ta\tb',
  ].join('\r\n'));
  assert.deepEqual(t.meuguia, { 'sportv 2': 'SP2' });
  assert.deepEqual(t.guiadetv, { 'cnn brasil': 'cnn-brasil' });
  assert.deepEqual(t.alias, { 'sportv 2': 'sportv2' });
  assert.deepEqual(t.feeds, ['https://feed.exemplo/a.xml', 'https://feed.exemplo/b.xml']);
  assert.equal(t.pluto, 'https://pluto.exemplo/br.xml');
});

test('texto vazio dá tabelas vazias', () => {
  assert.deepEqual(lerGuia(''), { meuguia: {}, guiadetv: {}, alias: {}, feeds: [], pluto: '' });
});
