# 🎬 Scripts de Correção de Imagens

Este documento explica como usar os scripts para corrigir imagens de capas de filmes e séries.

## Visão Geral

Os arquivos JSON em `public/data/` contêm informações de filmes e séries, incluindo URLs de imagens de capa. Alguns desses links podem estar quebrados ou usando imagens genéricas.

Os scripts nesta pasta ajudam a corrigir essas imagens usando diferentes métodos.

## Scripts Disponíveis

### 1. `fix-images-auto.cjs` (Recomendado - Sem API Key)

**Uso:**
```bash
node scripts/fix-images-auto.cjs
```

**Descrição:**
- Usa um banco de dados local com 200+ títulos populares
- Não requer API key
- Muito rápido (executa localmente)
- Ideal para correções rápidas de séries/filmes populares

**Funciona bem para:**
- Séries de TV populares (Game of Thrones, Breaking Bad, Stranger Things, etc.)
- Animes populares (Naruto, One Piece, Dragon Ball, etc.)
- Doramas conhecidos
- Novelas brasileiras
- Programas de TV nacionais

---

### 2. `fix-images-tmdb.cjs` (Mais Completo - Requer API Key)

**Uso:**
```bash
TMDB_API_KEY=sua_api_key node scripts/fix-images-tmdb.cjs
```

**Descrição:**
- Usa a API do TMDB para buscar imagens de qualquer filme/série
- Muito mais abrangente que o script automático
- Requer uma API key gratuita do TMDB

**Como obter API Key:**
1. Acesse https://www.themoviedb.org/
2. Crie uma conta gratuita
3. Vá em Settings > API
4. Solicite uma API key (tipo Developer)
5. Copie a chave e use no comando acima

---

### 3. `fix-images.js` (Versão Básica)

**Uso:**
```bash
TMDB_API_KEY=sua_api_key node scripts/fix-images.js
```

**Descrição:**
- Versão mais simples do script com API
- Similar ao `fix-images-tmdb.cjs`

---

## Lógica de Correção

### Para Filmes
- Extrai o nome e ano do título
- Busca a imagem correspondente no TMDB
- Atualiza o campo `logo` no JSON

### Para Séries (Importante!)
- **Apenas a capa da série é atualizada**
- Episódios individuais mantêm a imagem da série
- O script usa cache para aplicar a mesma imagem em todos os episódios
- Exemplo: "Breaking Bad S01E01", "Breaking Bad S01E02", etc. todos recebem a mesma capa de Breaking Bad

---

## Resultados

Após executar o script, você verá um resumo como:

```
══════════════════════════════════════════════════
🎉 Finalizado!
   📊 Total: 541524 itens
   ✅ Atualizado: 2376 imagens
══════════════════════════════════════════════════
```

---

## Notas

1. **Conteúdo Adulto:** Os scripts ignoram ou não conseguem encontrar imagens para conteúdo adulto, pois esses não estão no TMDB.

2. **Backup:** Os scripts modificam os arquivos JSON diretamente. Considere fazer backup antes de executar.

3. **Rate Limiting:** O script com API inclui delays para respeitar os limites do TMDB (~40 requisições por segundo).

4. **Imagens Válidas:** URLs do TMDB (`image.tmdb.org`) são consideradas válidas e não são substituídas.

---

## Adicionando Novos Títulos ao Banco Local

Para adicionar mais títulos ao script automático (`fix-images-auto.cjs`), edite o objeto `KNOWN_IMAGES` no arquivo:

```javascript
const KNOWN_IMAGES = {
  // Adicione aqui
  'nome da serie': '/path_da_imagem_no_tmdb.jpg',
  // ...
};
```

O path da imagem pode ser encontrado no TMDB, geralmente no formato `/xxxxxxxxxxxx.jpg`.
