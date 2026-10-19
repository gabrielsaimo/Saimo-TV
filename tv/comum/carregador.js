/*
 * Carregador do Saimo TV nas TVs Samsung (Tizen) e LG (webOS).
 *
 * O pacote instalado na TV guarda uma cópia do app em app/ e este carregador. Ao abrir:
 *   1. pergunta ao site qual é a versão atual (manifesto.json);
 *   2. se há uma mais nova, baixa o código dela e roda aqui dentro (assim o app atualiza
 *      sem reinstalar, e continua com os privilégios do app instalado: vídeo http,
 *      sem CORS, teclas do controle);
 *   3. sem rede, ou se o código novo falhar ao carregar, roda a cópia do pacote.
 *
 * Escrito em ES5 de propósito: roda antes de qualquer polyfill, em Chromium antigo.
 * Os scripts são clássicos (nada de type="module"): o webOS bloqueia módulo em file://.
 */
(function () {
  var SITE = 'https://saimo-tv.pages.dev/tv/';
  var CASCA = 1; // sobe só quando o pacote instalado muda (permissões, ícones, este arquivo)
  var LIMITE_MS = 6000;
  var info = document.getElementById('carregando');
  var erros = [];
  var inicio = new Date().getTime();

  function aviso(texto) { if (info) info.textContent = texto; }

  // Erro de script (TV antiga que não entende o código, falta de memória…): guarda para mostrar
  // na tela e mandar ao monitor, em vez de deixar a TV parada em "Abrindo" para sempre.
  window.onerror = function (msg, arquivo, linha, coluna) {
    if (erros.length < 5) erros.push(String(msg) + ' (' + String(arquivo || '').split('/').pop() + ':' + linha + ':' + coluna + ')');
  };

  function abriu() {
    var r = document.getElementById('root');
    return !!(r && r.children && r.children.length);
  }

  function relatar() {
    try {
      var id = '';
      try { id = localStorage.getItem('saimo-telemetria-id') || ''; } catch (e) {}
      if (!id) {
        id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
      }
      var x = new XMLHttpRequest();
      x.open('POST', 'https://saimo-monitor.gabrielsaimo68.workers.dev/v1/event');
      x.setRequestHeader('Content-Type', 'text/plain');
      x.send(JSON.stringify({
        deviceId: id, platform: window.__SAIMO_TV__ || 'webos', version: 'casca-' + CASCA, type: 'crash',
        detail: 'não abriu em ' + Math.round((new Date().getTime() - inicio) / 1000) + ' s; ' +
          (erros.join(' | ') || 'sem erro de script') + '; ' + navigator.userAgent
      }));
    } catch (e) {}
  }

  // Abrindo devagar (TV simples) é diferente de não abrir: avisa que está trabalhando e, passado
  // um minuto sem tela, mostra o motivo.
  var vigia = setInterval(function () {
    if (abriu()) { clearInterval(vigia); return; }
    var s = Math.round((new Date().getTime() - inicio) / 1000);
    if (s >= 60) {
      clearInterval(vigia);
      aviso('O Saimo TV não conseguiu abrir nesta TV.' + (erros.length ? ' Detalhe: ' + erros[0] : ' Tente desligar e ligar a TV.'));
      relatar();
    } else if (s >= 10) {
      aviso('Ainda abrindo… TVs mais simples podem levar até um minuto (' + s + ' s)');
    }
  }, 1000);

  function carregarCss(url) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url;
    document.head.appendChild(l);
  }

  function carregarJs(url, ok, falha) {
    var s = document.createElement('script');
    s.src = url;
    s.onload = ok;
    s.onerror = falha;
    document.body.appendChild(s);
  }

  function local() {
    carregarCss('app/saimo.css');
    carregarJs('app/saimo.js', function () {}, function () { aviso('Não foi possível abrir o Saimo TV.'); });
  }

  function remoto(m) {
    var v = '?v=' + encodeURIComponent(m.versao);
    carregarCss(SITE + m.css + v);
    // Se o código novo não carregar (rede caiu no meio), cai na cópia do pacote.
    carregarJs(SITE + m.js + v, function () {}, function () {
      var velho = document.querySelectorAll('link[rel=stylesheet]');
      for (var i = 0; i < velho.length; i++) velho[i].parentNode.removeChild(velho[i]);
      local();
    });
  }

  var feito = false;
  function seguir(m) {
    if (feito) return;
    feito = true;
    if (m && m.minimoCasca && m.minimoCasca > CASCA) {
      aviso('Esta versão do aplicativo ficou antiga. Instale a nova em saimo-tv.pages.dev' + (window.__SAIMO_TV__ === 'webos' ? '/lg' : '/samsung'));
      return local();
    }
    if (m && m.js && m.css && m.versao) return remoto(m);
    local();
  }

  var x = new XMLHttpRequest();
  x.timeout = LIMITE_MS;
  x.onload = function () {
    try { seguir(x.status === 200 ? JSON.parse(x.responseText) : null); } catch (e) { seguir(null); }
  };
  x.onerror = x.ontimeout = function () { seguir(null); };
  try {
    x.open('GET', SITE + 'manifesto.json?t=' + new Date().getTime());
    x.send();
  } catch (e) { seguir(null); }
  setTimeout(function () { seguir(null); }, LIMITE_MS + 500);
})();
