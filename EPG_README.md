# 📺 Configurando EPG Real para seu IPTV

Este projeto suporta EPG (Guia de Programação Eletrônico) real de várias fontes.

## Opção 1: EPG via IPTV-ORG (Recomendado)

O projeto [iptv-org/epg](https://github.com/iptv-org/epg) fornece EPG gratuito para milhares de canais.

### Fontes disponíveis para Brasil:

| Fonte | Canais | URL do EPG |
|-------|--------|------------|
| meuguia.tv | 102 | `https://iptv-org.github.io/epg/guides/pt/meuguia.tv.epg.xml.gz` |
| claro.com.br | 273 | `https://iptv-org.github.io/epg/guides/pt/claro.com.br.epg.xml.gz` |
| mi.tv | 2084 | `https://iptv-org.github.io/epg/guides/pt/mi.tv.epg.xml.gz` |

### Como usar:

1. Baixe o arquivo EPG:
```bash
curl -o epg.xml.gz "https://iptv-org.github.io/epg/guides/pt/meuguia.tv.epg.xml.gz"
gunzip epg.xml.gz
```

2. Coloque o arquivo `epg.xml` na pasta `public/` do projeto

3. O sistema automaticamente tentará carregar o EPG local

## Opção 2: Gerar EPG Próprio

Clone o repositório iptv-org/epg e gere seu próprio EPG:

```bash
git clone https://github.com/iptv-org/epg.git
cd epg
npm install
npm run grab -- --site=meuguia.tv
```

Isso gerará um arquivo `guide.xml` com a programação atualizada.

## Opção 3: APIs Pagas

Para EPG profissional, considere:

- **Gracenote/TiVo** - API comercial completa
- **TVmedia** - Guias de programação licenciados
- **Rovi** - Metadados de TV

## Mapeamento de Canais

O arquivo `src/services/epgService.ts` contém o mapeamento entre os IDs dos canais e os IDs XMLTV:

```typescript
const channelToXmltvId = {
  'globo-sp': 'TVGloboSaoPaulo.br',
  'hbo': 'HBO.br',
  'sportv': 'SporTV.br',
  // ...
};
```

Se adicionar novos canais, certifique-se de mapear corretamente o ID XMLTV.

## Formato XMLTV

O EPG usa o formato padrão XMLTV:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="HBO.br">
    <display-name>HBO</display-name>
  </channel>
  <programme start="20260111200000 -0300" stop="20260111220000 -0300" channel="HBO.br">
    <title>House of the Dragon</title>
    <desc>Episódio 5 da temporada 2</desc>
    <category>Drama</category>
  </programme>
</tv>
```

## Atualizando EPG Automaticamente

Para manter o EPG atualizado, configure um cron job:

```bash
# Atualizar EPG diariamente às 3h da manhã
0 3 * * * curl -o /path/to/project/public/epg.xml.gz "https://iptv-org.github.io/epg/guides/pt/meuguia.tv.epg.xml.gz" && gunzip -f /path/to/project/public/epg.xml.gz
```

## Limitações

- APIs públicas podem ter restrições de CORS
- Alguns canais podem não ter EPG disponível
- A programação pode ter atraso de algumas horas

## Suporte

Para problemas com EPG, abra uma issue no repositório.
