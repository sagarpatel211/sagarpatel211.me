FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@latest \
    && pnpm install --frozen-lockfile --prod

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm@latest \
    && pnpm install --frozen-lockfile \
    && pnpm build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["pnpm", "start"]
