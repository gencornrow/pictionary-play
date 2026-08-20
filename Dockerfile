# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM oven/bun:1 AS build
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Vite inlines VITE_* variables into the browser bundle at BUILD time,
# so they must be present here (runtime env is too late for the client).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

# Copy source and build
COPY . .
RUN bun run build

# ---- Production stage ----
FROM node:22-slim AS runtime
WORKDIR /app

# Copy the Nitro node-server output
COPY --from=build /app/.output ./.output

ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
