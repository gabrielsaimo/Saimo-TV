# SaimoTV Desktop 1.8.0

## Séries e episódios

- Troca de episódio agora segue a regra **“a última escolha vence”**. Eventos,
  erros e respostas assíncronas de uma reprodução anterior são invalidados ao
  escolher outro episódio ou outra fonte.
- Falha de uma fonte tenta automaticamente a próxima antes de mostrar erro.
- Episódios dublados/legendados do mesmo T/E são agrupados em um único item com
  todas as fontes disponíveis.
- O modal da série continua montado enquanto o player está aberto. Ao voltar,
  a pessoa retorna à mesma série, temporada e posição do modal.
- Temporadas começam recolhidas (accordion): os episódios só aparecem depois do
  clique e somente uma temporada fica aberta por vez.
- Ao voltar do player, a temporada do episódio atual fica aberta para manter o
  contexto sem obrigar a procurar novamente.

## Player

- Botões **episódio anterior** e **próximo episódio** dentro dos controles.
- Painel lateral **Episódios** dentro do player, com troca direta de temporada e
  capítulo sem voltar ao catálogo.
- Atalhos: `E` abre episódios, `N` vai ao próximo e `B` ao anterior.
- Cartão de próximo episódio perto do fim agora mostra T/E corretos, inclusive
  na passagem para uma nova temporada.
- Fontes HTTP no aplicativo desktop passam pelo proxy local do Tauri em vez de
  serem bloqueadas pela regra destinada ao navegador web.
- Callbacks antigos de HLS, `<video>` e `fetch` não conseguem mais sobrescrever
  o estado do episódio atual.

## Interface

- Catálogo, ficha e player receberam hierarquia visual mais limpa, navegação
  inspirada em aplicativos modernos de streaming e maior destaque do conteúdo
  atual, mantendo a identidade do SaimoTV.
- O cabeçalho global duplicado foi removido da reprodução VOD; o player usa sua
  própria barra superior e ocupa toda a janela.

## Build Windows

O workflow `.github/workflows/windows-desktop.yml` gera MSI e NSIS em
`Actions > Build Windows Desktop > Run workflow` e publica os dois instaladores
como artifact `SaimoTV-Windows-1.8.0`.
