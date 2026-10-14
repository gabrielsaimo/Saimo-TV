import assert from 'node:assert/strict';
import test from 'node:test';
import { escolherFonte, lembrarFonte, fontePreferida } from '../src/utils/fontePreferida.ts';

const a = { url: 'https://cdn3.exemplo.com/a/1.mp4', indice: 2 };

test('mesmo host vence, mesmo em outra ordem', () => {
  assert.equal(escolherFonte(['http://x.com/1', 'http://y.com/1', 'https://cdn3.exemplo.com/b/2.mp4'], a), 2);
  assert.equal(escolherFonte(['https://cdn3.exemplo.com/b/2.mp4', 'http://x.com/1'], a), 0);
});
test('sem host igual usa a mesma posição', () => {
  assert.equal(escolherFonte(['http://x.com/1', 'http://y.com/1', 'http://z.com/1'], a), 2);
});
test('sem posição cai na ordem de hoje', () => {
  assert.equal(escolherFonte(['http://x.com/1', 'http://y.com/1'], a), 0);
  assert.equal(escolherFonte(['http://x.com/1'], null), 0);
});
test('memória é por série', () => {
  lembrarFonte('s1', a.url, 2);
  assert.equal(fontePreferida('s1', ['http://x.com/1', 'https://cdn3.exemplo.com/b']), 1);
  assert.equal(fontePreferida('s2', ['http://x.com/1', 'https://cdn3.exemplo.com/b']), 0);
  assert.equal(fontePreferida(undefined, ['https://cdn3.exemplo.com/b']), 0);
});
