# syntax=docker/dockerfile:1.7

# Build + deploy stage: install all workspace deps, compile TS, then use
# `pnpm deploy` to assemble a flat, prod-only node_modules at /deploy.
# This is how pnpm officially packages a single workspace app for Docker —
# plain symlink copies break because pnpm's node_modules is a link farm
# pointing back into the repo-root .pnpm store.
FROM node:22-alpine AS build
WORKDIR /repo
RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @xxf/shared build
RUN pnpm --filter @xxf/server build
RUN pnpm --filter @xxf/server deploy --prod /deploy

# Runtime image: minimal, non-root, just the deployed artifact.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat \
  && addgroup -S app && adduser -S -G app app
COPY --from=build --chown=app:app /deploy ./
USER app
EXPOSE 8787
CMD ["node", "dist/index.js"]
