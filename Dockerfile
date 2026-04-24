# ── Stage 1: Build React frontend ──
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + static files ──
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built React into backend/static
COPY --from=frontend-build /app/frontend/dist ./static

# Set env for Cloud Run
ENV GOOGLE_CLOUD_PROJECT=forpromptwars
ENV GOOGLE_CLOUD_REGION=us-central1
ENV GEMINI_MODEL=gemini-2.5-flash
ENV ALLOWED_ORIGINS=*
ENV PORT=8080

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
