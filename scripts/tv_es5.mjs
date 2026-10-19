// Passa o saimo.js das TVs para ES5 (Chromium 38+: webOS 3, Tizen 2.4/3, TVs de 2016-2019).
// O build do Vite sai em Chrome 68; TV mais fraca/antiga nem conseguia ler o arquivo e ficava
// para sempre em "Abrindo o Saimo TV…". Confere no fim que o resultado é ES5 puro.
import { transformAsync } from '@babel/core';
import { parse } from 'acorn';
import { readFileSync, writeFileSync } from 'node:fs';

const arquivo = process.argv[2] ?? 'dist-tv/saimo.js';
const codigo = readFileSync(arquivo, 'utf8');
const saida = await transformAsync(codigo, {
  babelrc: false,
  configFile: false,
  compact: true,
  comments: false,
  sourceType: 'script',
  presets: [['@babel/preset-env', { targets: { chrome: '38' }, modules: false }]],
  // `import()` de biblioteca (carregamento sob demanda que a TV não usa) não existe em ES5:
  // vira uma promessa recusada, e quem chamou trata como falha de carregamento.
  plugins: [() => ({
    visitor: {
      CallExpression(path) {
        if (path.node.callee.type === 'Import') {
          path.node.callee = { type: 'Identifier', name: '__saimoImport' };
        }
      },
      // Babel 8 representa `import(x)` como ImportExpression.
      ImportExpression(path) {
        path.replaceWith({ type: 'CallExpression', callee: { type: 'Identifier', name: '__saimoImport' }, arguments: [path.node.source] });
      },
    },
  })],
  assumptions: { setPublicClassFields: true, noDocumentAll: true },
});
const final = 'var __saimoImport=function(){return Promise.reject(new Error("import indisponível na TV"))};' + saida.code;
parse(final, { ecmaVersion: 5, sourceType: 'script' });
writeFileSync(arquivo, final);
console.log(`ES5: ${arquivo} ${(codigo.length / 1048576).toFixed(1)} MB -> ${(saida.code.length / 1048576).toFixed(1)} MB`);
