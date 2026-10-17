# syntax=docker/dockerfile:1
#
# O site publicado roda no Cloudflare Pages; este contêiner serve o mesmo
# `dist/` mais as Pages Functions de `/api/*` num processo Bun (docker/server.ts).
# Build em estágios: as dependências ficam no build, a imagem final só leva o
# `dist/`, as functions e o servidor.

# --- Dependências -----------------------------------------------------------
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- Build ------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY . .
# `VITE_PROXY_BASE` é lido em tempo de build (import.meta.env), não de execução.
ARG VITE_PROXY_BASE
ENV VITE_PROXY_BASE=${VITE_PROXY_BASE}
RUN bun run build

# --- Execução ---------------------------------------------------------------
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /app/dist ./dist
COPY --from=build /app/functions ./functions
COPY --from=build /app/docker ./docker
EXPOSE 3000
USER bun
CMD ["bun", "docker/server.ts"]
