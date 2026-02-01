# 📺 TV Saimo - Plataforma de Streaming Web

Bem-vindo ao **TV Saimo**, uma aplicação web de alta performance para streaming de canais de TV ao vivo (IPTV), filmes e séries. Este projeto foi desenvolvido utilizando as tecnologias mais modernas do ecossistema React para garantir uma experiência de usuário fluida, rápida e responsiva.

---

## 🚀 Tecnologias Utilizadas

O projeto é construído sobre uma base sólida e moderna:

- **[React 19](https://react.dev/)**: A biblioteca JavaScript mais popular para construção de interfaces de usuário.
- **[TypeScript](https://www.typescriptlang.org/)**: JavaScript com superpoderes, garantindo maior segurança e manutenibilidade do código.
- **[Vite](https://vitejs.dev/)**: Build tool de próxima geração, ultra-rápido para desenvolvimento e build.
- **[Hls.js](https://github.com/video-dev/hls.js/)** & **[mpegts.js](https://github.com/xqq/mpegts.js)**: Motores de reprodução de vídeo robustos para suportar diversos formatos de streaming.
- **TailwindCSS** (via index.css/styles): Estilização moderna e responsiva.

---

## ✨ Funcionalidades

- **TV Ao Vivo**: Suporte a listas IPTV com reprodução instantânea.
- **Catálogo VOD**: Filmes e Séries organizados automaticamente por categorias.
- **Player Moderno**: Controles avançados, suporte a áudio.
- **Performance**: Carregamento otimizado e navegação suave.
- **Design Premium**: Interface elegante e intuitiva, inspirada nas grandes plataformas de streaming.

---

## 🛠️ Instalação e Configuração

Siga os passos abaixo para rodar o projeto localmente:

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- Gerenciador de pacotes npm, yarn ou pnpm.

### Passo a Passo

1. **Clone o repositório** (se ainda não o fez):
   ```bash
   git clone <url-do-repositorio>
   cd free-tv
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```
   
4. **Acesse**: Abra seu navegador em `http://localhost:5173` (ou a porta indicada no terminal).

---

## 🔄 Como Atualizar Filmes e Séries

Este é o coração do gerenciamento de conteúdo do TV Saimo. O sistema utiliza um script automatizado inteligente para atualizar o catálogo de filmes e séries a partir de uma lista M3U.

O script responsável é o `scripts/updateContent.ts`. Ele baixa a lista, processa os dados, busca informações no TMDB (capas, sinopses) e organiza tudo em arquivos JSON otimizados.

### ⚠️ Importante: Atualizando a Lista M3U

Para atualizar as URLs dos filmes e séries (por exemplo, quando os links expiram ou você tem uma nova lista), siga este procedimento:

1. **Abra o arquivo do script**:
   Localize e abra o arquivo:
   `scripts/updateContent.ts`

2. **Atualize a URL da Lista**:
   Nas primeiras linhas do arquivo, você encontrará a constante `M3U_URL`. Substitua o link existente pelo link da sua nova lista M3U8 atualizada.

   ```typescript
   // scripts/updateContent.ts
   
   // 👇 COLOQUE SEU NOVO LINK AQUI
   const M3U_URL = 'https://exemplo.com/sua-lista-nova-atualizada.m3u8';
   ```

3. **Execute o Script de Atualização**:
   Abra o terminal na raiz do projeto e rode o seguinte comando:

   ```bash
   npx tsx scripts/updateContent.ts
   ```

### O que o script fará:
1.  **Baixar** a nova lista M3U.
2.  **Mapear** os filmes e séries para as categorias corretas (Ação, Comédia, Lançamentos, etc.).
3.  **Enriquecer** os dados buscando informações no TMDB se necessário.
4.  **Atualizar** as URLs dos conteúdos já existentes e **Adicionar** novos conteúdos encontrados.
5.  **Gerar** os arquivos JSON na pasta `public/data/enriched`.

Após a execução, basta recarregar a página da aplicação e o novo conteúdo estará disponível!

---

## 📦 Build para Produção

Para gerar a versão otimizada para publicação (deploy):

```bash
npm run build
```

Os arquivos estáticos serão gerados na pasta `dist`, prontos para serem hospedados na Vercel, Netlify ou qualquer servidor web.

---

Desenvolvido para oferecer a melhor experiência de streaming gratuito. 🎬🍿
