# syntax=docker/dockerfile:1
# HARC API — wielostopniowy build (§4)
FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=1 \
    PNPM_HOME=/pnpm
# Pinowana wersja pnpm pobierana RAZ w warstwie bazowej (nie przy pnpm install)
RUN apk add --no-cache tini && corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
# Cache store pnpm współdzielony między buildami (BuildKit)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --filter @harc/api... --filter @harc/db...
COPY tsconfig.base.json ./
COPY packages/domain packages/domain
COPY packages/contracts packages/contracts
COPY packages/db packages/db
COPY apps/api apps/api
RUN pnpm --filter @harc/db exec prisma generate \
  && pnpm --filter @harc/domain build \
  && pnpm --filter @harc/contracts build \
  && pnpm --filter @harc/db build \
  && pnpm --filter @harc/api build

FROM node:22-alpine AS runner
# font-dejavu daje TTF z pełnym zestawem polskich znaków. Wbudowane fonty
# pdfkit (Helvetica) używają WinAnsi, w którym brakuje ł, ą, ę, ś, ż, ź, ć, ń —
# bez osadzonego fontu generowane PDF-y miałyby dziury w tekście.
RUN apk add --no-cache tini font-dejavu
ENV NODE_ENV=production \
    PDF_FONT_PATH=/usr/share/fonts/dejavu/DejaVuSans.ttf \
    PDF_FONT_BOLD_PATH=/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf
WORKDIR /app
COPY --from=build /app /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
