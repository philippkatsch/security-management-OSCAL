# Multi-stage Docker build for Reposol (React Frontend + FastAPI Backend)

# Stage 1: Build React Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY reposol/frontend/package*.json ./
RUN npm install
COPY reposol/frontend ./
RUN npm run build

# Stage 2: Production Python Backend Container
FROM python:3.11-slim
WORKDIR /app

# Create non-root system group and user 'reposol'
RUN groupadd -r reposol && useradd -r -g reposol -d /app reposol

# Install Python dependencies
COPY reposol/backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy Backend Source Code
COPY reposol/backend ./backend

# Copy Built Frontend Assets from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy Master Seed Templates (both for direct container use and for persistent volume seeding)
COPY reposol/data/templates ./data/templates
COPY reposol/data/templates ./templates_seed

# Create data directory and set permissions for non-root user
RUN mkdir -p /app/data && chown -R reposol:reposol /app

# Set Environment Variables
ENV REPOSOL_DATA_DIR=/app/data
ENV REPOSOL_TEMPLATES_SEED_DIR=/app/templates_seed
ENV PORT=8000
ENV PYTHONPATH=/app/backend:/app

EXPOSE 8000

USER reposol

# Run Uvicorn Server serving both API and static frontend
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
