# ARIA platform — ONE deployable image: the main Node/Express app AND the
# ARIA Recovery Copilot (FastAPI) running alongside it as a child process.
# One Render web service, one port, one `npm start`.

# ---------- stage 1: build the Copilot SPA (embedded under /copilot/) ----------
FROM node:20-alpine AS copilot-frontend
WORKDIR /build
COPY aria-recovery-copilot/frontend/package.json aria-recovery-copilot/frontend/package-lock.json ./
RUN npm ci
COPY aria-recovery-copilot/frontend/ ./
# Embedded mode: served by the main app at /copilot (src/api.ts follows this base)
ENV COPILOT_BASE=/copilot/
RUN npm run build

# ---------- stage 2: Node main app + Python Copilot runtime ----------
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Python runtime for the Copilot child process
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Main app
COPY package.json package-lock.json ./
RUN npm ci
COPY server ./server
COPY public ./public
RUN mkdir -p server/uploads/reports

# Copilot backend (FastAPI) + its prebuilt SPA
COPY aria-recovery-copilot/backend/requirements.txt /copilot/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /copilot/requirements.txt
COPY aria-recovery-copilot/backend/app /copilot/app
COPY aria-recovery-copilot/backend/seed /copilot/seed
COPY aria-recovery-copilot/backend/scripts /copilot/scripts
COPY --from=copilot-frontend /build/dist /copilot/static

# Copilot child-process wiring
ENV COPILOT_PYTHON=python3 \
    COPILOT_BACKEND_DIR=/copilot \
    STATIC_DIR=/copilot/static \
    COPILOT_PORT=8000

EXPOSE 10000
CMD ["node", "server/src/index.js"]
