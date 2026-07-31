# HARC API — wielostopniowy build (§4)
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache tini
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile=false
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
RUN apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
