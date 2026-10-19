// Entrada do pacote de TV. TVs antigas ou fracas (webOS 3/4, Tizen 3/4: Chromium 38 a 87) não têm
// boa parte do que o app usa: tudo isso entra por polyfill antes de qualquer outra coisa. O código
// sai em ES5 (scripts/tv_es5.mjs).
import 'core-js/stable';
import 'whatwg-fetch';
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch';
import 'intersection-observer';
import './plataforma/polyfills-tv';
import './main';
