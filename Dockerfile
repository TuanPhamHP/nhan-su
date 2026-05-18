# Stage 1 — install dependencies
FROM node:22.21-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Stage 2 — build
FROM node:22.21-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn build

# Stage 3 — production runner
FROM node:22.21-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Nuxt standalone output — không cần node_modules
COPY --from=builder /app/.output ./.output

EXPOSE 4000

CMD ["node", ".output/server/index.mjs"]
