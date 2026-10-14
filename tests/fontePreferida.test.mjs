import assert from 'node:assert/strict';
import test from 'node:test';
import { escolherFonte, lembrarFonte, fontePreferida } from '../src/utils/fontePreferida.ts';

const f = (url, versao) => ({ url, versao });
const a = { url: 'https://cdn3.exemplo.com/a/1.mp4', versao: 'dub', indiceNaVersao: 2 };

test('mesmo host vence, mesmo em outra ordem', () => {
  assert.equal(escolherFonte([f('http://x.com/1'), f('http://y.com/1'), f('https://cdn3.exemplo.com/b/2.mp4')], a), 2);
  assert.equal(escolherFonte([f('https://cdn3.exemplo.com/b/2.mp4'), f('http://x.com/1')], a), 0);
});
test('sem host igual usa a mesma posição na versão', () => {
  assert.equal(escolherFonte([f('http://x.com/1'), f('http://y.com/1'), f('http://z.com/1')], a), 2);
  // legendadas no meio não contam na posição
  assert.equal(escolherFonte([f('http://x.com/1'), f('http://l.com/1', 'leg'), f('http://y.com/1'), f('http://z.com/1')], a), 3);
});
test('sem posição cai na ordem de hoje', () => {
  assert.equal(escolherFonte([f('http://x.com/1'), f('http://y.com/1')], a), 0);
  assert.equal(escolherFonte([f('http://x.com/1')], null), 0);
});
test('host só existe legendado: não escolhe quando dublado toca', () => {
  const lista = [f('http://x.com/1', 'dub'), f('https://cdn3.exemplo.com/b', 'leg'), f('http://y.com/1', 'dub')];
  assert.equal(escolherFonte(lista, { ...a, indiceNaVersao: 1 }), 2);
  assert.equal(escolherFonte(lista, { ...a, versao: 'leg', indiceNaVersao: 0 }), 1);
});
test('memória é por série e guarda a versão', () => {
  const ep1 = [f('http://x.com/1', 'dub'), f('https://cdn3.exemplo.com/a', 'dub')];
  lembrarFonte('s1', ep1, 1);
  const ep2 = [f('https://cdn3.exemplo.com/b', 'leg'), f('http://x.com/2', 'dub'), f('https://cdn3.exemplo.com/c', 'dub')];
  assert.equal(fontePreferida('s1', ep2), 2);
  assert.equal(fontePreferida('s2', ep2), 0);
  assert.equal(fontePreferida(undefined, ep2), 0);
});
