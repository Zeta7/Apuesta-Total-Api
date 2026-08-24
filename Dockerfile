FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN pnpm install --frozen-lockfile=false && pnpm prisma:generate

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM node:22-alpine AS production
RUN corepack enable && addgroup -S nodejs && adduser -S nestjs -G nodejs
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/data ./data
COPY package.json ./
USER nestjs
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
