# Spectyra NLI Service Dockerfile
# ================================
# FastAPI service for NLI (Natural Language Inference)
# Uses HuggingFace transformers with DeBERTa MNLI model

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .

# Create model cache directory
RUN mkdir -p /app/model_cache
ENV TRANSFORMERS_CACHE=/app/model_cache
ENV HF_HOME=/app/model_cache

# Default environment variables
ENV NLI_MODEL=microsoft/deberta-v3-large-mnli
ENV DEVICE=cpu
ENV MAX_LENGTH=256
ENV BATCH_SIZE=16
ENV WORKERS=1
ENV PORT=8000

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the service
CMD ["python", "main.py"]
