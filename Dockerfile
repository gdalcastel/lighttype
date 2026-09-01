# LightType — web (Next.js) + API (FastAPI) from one file.
# docker compose selects the stage with `target:`.

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS api

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libgomp1 \
    libspatialindex-dev \
    libgeos-dev \
  && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY api/app /app/app
COPY api/engine /app/engine
COPY api/fonts /app/fonts

EXPOSE 8765

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=8 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/health', timeout=4)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765"]

# ---------------------------------------------------------------------------
# Web — dependencies
# ---------------------------------------------------------------------------
FROM node:22-alpine AS web-deps

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Web — build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS web-build

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=web-deps /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs ./
COPY src ./src
COPY public ./public

ARG API_URL=http://api:8765
ENV API_URL=${API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------------------------------------------------------------------------
# Web — runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS web

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=43127
ENV HOSTNAME=0.0.0.0
ENV API_URL=http://api:8765

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=web-build /app/public ./public
COPY --from=web-build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=web-build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 43127

CMD ["node", "server.js"]
