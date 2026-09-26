# ARIA Recovery Copilot — single-service deployable image (Render-ready).
# Stage 1 builds the Copilot SPA; stage 2 runs the FastAPI backend and serves
# that build from /chat. One service, one URL, same-origin /api calls.

# ---------- stage 1: Copilot frontend ----------
# This image is the STANDALONE copilot service: SPA self-hosted at "/" with
# same-origin /api (the main repo's Dockerfile builds the EMBEDDED variant
# with COPILOT_BASE=/copilot/ instead; src/api.ts follows COPILOT_BASE).
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV COPILOT_BASE=/
RUN npm run build

# ---------- stage 2: Copilot backend + built SPA ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY seed ./seed
COPY scripts ./scripts
COPY --from=frontend /app/frontend/dist ./static

# Render sets PORT (default 10000); local default stays 8000.
# If this container dies, the main ARIA platform is untouched (spec §4.1).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
