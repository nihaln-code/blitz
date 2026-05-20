# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:18-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/dist

# ── Stage 2: Python backend ─────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements-hf.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy compiled React app into /app/static
COPY --from=frontend-builder /app/frontend/dist ./static

# HuggingFace Spaces must listen on port 7860
EXPOSE 7860

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
