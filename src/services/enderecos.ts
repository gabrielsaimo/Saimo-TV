/**
 * Os dois endereços fixos de onde o site lê tudo o que não é dele.
 *
 * Nada aqui fala de GitHub: quem mora onde é problema de quem publica
 * (`scripts/publicar_catalogos.sh` no SaimoPlayer). Trocar de conta ou de
 * servidor muda esses arquivos publicados, não o site.
 *
 *   CANAIS  catalogo.txt, canais.txt, restritos.txt, radios.txt, versao.json
 *   FILMES  espelho da pasta vod/ (indice.txt, filmes-A.txt, imdb/…, novidades.json)
 */
export const CANAIS = 'https://saimo-canais.pages.dev/';
export const FILMES = 'https://saimo-filmes.pages.dev/';
