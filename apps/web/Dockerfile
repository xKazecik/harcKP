# HARC Web — wielostopniowy build (§4)
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache tini
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile=false
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/ui packages/ui
COPY apps/web apps/web
RUN pnpm --filter @harc/contracts build && pnpm --filter @harc/web build

FROM node:22-alpine AS runner
RUN apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
