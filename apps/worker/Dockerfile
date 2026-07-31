# syntax=docker/dockerfile:1
# HARC Worker — wielostopniowy build (§4)
FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=1 \
    PNPM_HOME=/pnpm
RUN apk add --no-cache tini && corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --filter @harc/worker...
COPY tsconfig.base.json ./
COPY packages/db packages/db
COPY apps/worker apps/worker
RUN pnpm --filter @harc/db exec prisma generate \
  && pnpm --filter @harc/db build \
  && pnpm --filter @harc/worker build

FROM node:22-alpine AS runner
RUN apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD pgrep -f "node apps/worker/dist/main.js" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/worker/dist/main.js"]
