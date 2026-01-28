# Spectyra Infrastructure

This directory contains infrastructure configurations for deploying Spectyra.

## Directory Structure

```
infra/
├── docker-compose.yml    # Local development stack
├── nli-service/          # NLI FastAPI service
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── k8s/                  # Kubernetes manifests
│   ├── embeddings-tei-deployment.yaml
│   ├── embeddings-tei-service.yaml
│   ├── nli-deployment.yaml
│   ├── nli-service.yaml
│   ├── api-deployment.yaml
│   ├── secrets-example.yaml
│   └── ingress-example.yaml
└── README.md
```

## Local Development (Docker Compose)

### Prerequisites

- Docker and Docker Compose installed
- At least 8GB RAM available for models

### Quick Start

```bash
# Start all services
cd infra
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |
| embeddings | 8081 | HuggingFace TEI (embeddings) |
| nli | 8082 | FastAPI NLI service |

### Running Spectyra API

After starting the compose stack, run the API locally:

```bash
# Set environment variables
export DATABASE_URL="postgres://spectyra:spectyra_dev_password@localhost:5432/spectyra"
export REDIS_URL="redis://localhost:6379"
export EMBEDDINGS_PROVIDER="local"
export EMBEDDINGS_HTTP_URL="http://localhost:8081"
export NLI_PROVIDER="local"
export NLI_HTTP_URL="http://localhost:8082"
export ALLOW_ENV_PROVIDER_KEYS="true"  # Only for local dev!

# Start API
pnpm dev:api
```

## Environment Variables

### Provider Key Enforcement (CRITICAL)

```bash
# PRODUCTION: Must be false
# Spectyra NEVER pays for customer LLM tokens
ALLOW_ENV_PROVIDER_KEYS=false

# DEVELOPMENT: Can be true for testing
ALLOW_ENV_PROVIDER_KEYS=true
```

### Embeddings Configuration

```bash
# Provider: "local" | "http" | "openai"
EMBEDDINGS_PROVIDER=local
EMBEDDINGS_HTTP_URL=http://localhost:8081
EMBEDDINGS_MODEL=BAAI/bge-large-en-v1.5
EMBEDDINGS_CACHE_ENABLED=true
EMBEDDINGS_CACHE_TTL_DAYS=30
```

### NLI Configuration

```bash
# Provider: "local" | "http" | "disabled"
NLI_PROVIDER=local
NLI_HTTP_URL=http://localhost:8082
NLI_MODEL=microsoft/deberta-v3-large-mnli
NLI_TIMEOUT_MS=10000
```

### Cache Configuration

```bash
# Redis URL for caching
REDIS_URL=redis://localhost:6379

# Fall back to Postgres if Redis unavailable
CACHE_USE_POSTGRES=true
```

## Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests.

### Quick Deploy

```bash
# Create namespace
kubectl create namespace spectyra

# Apply secrets (customize first!)
kubectl apply -f k8s/secrets-example.yaml

# Deploy services
kubectl apply -f k8s/

# Check status
kubectl get pods -n spectyra
```

### Resource Requirements

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|-------------|-----------|----------------|--------------|
| embeddings | 1 | 4 | 4Gi | 8Gi |
| nli | 1 | 2 | 4Gi | 8Gi |
| api | 250m | 1 | 512Mi | 2Gi |

### GPU Support

For GPU-enabled deployments:

1. Use TEI GPU image: `ghcr.io/huggingface/text-embeddings-inference:1.5`
2. Add GPU resources to deployment:
   ```yaml
   resources:
     limits:
       nvidia.com/gpu: 1
   ```
3. Ensure GPU node pool is available

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Spectyra API                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Optimizer Pipeline                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │  Unitize    │→ │  Embed      │→ │ Build Graph │   │  │
│  │  │  Messages   │  │  (TEI)      │  │ (NLI opt.)  │   │  │
│  │  └─────────────┘  └──────┬──────┘  └──────┬──────┘   │  │
│  │                          │                │          │  │
│  │  ┌─────────────┐  ┌──────▼──────┐  ┌──────▼──────┐   │  │
│  │  │  Spectral   │← │  Embedding  │  │  NLI        │   │  │
│  │  │  Analysis   │  │  Service    │  │  Service    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Customer LLM Provider Call                │  │
│  │       (Using BYOK header or vaulted customer key)      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   OpenAI      │    │   Anthropic   │    │   Gemini/Grok │
│ (Customer Key)│    │ (Customer Key)│    │ (Customer Key)│
└───────────────┘    └───────────────┘    └───────────────┘
```

## Cost Model

| Component | Cost |
|-----------|------|
| Embeddings (TEI) | **FREE** - Self-hosted |
| NLI Service | **FREE** - Self-hosted |
| Final LLM Calls | **Customer pays** - BYOK or vaulted |
| Spectyra API | Infrastructure cost only |

**Key Point**: Spectyra NEVER pays for customer LLM tokens. Customers provide their own API keys.

## Troubleshooting

### Embeddings service not starting

1. Check available memory: `docker stats`
2. Model download may take time on first start
3. Check logs: `docker compose logs embeddings`

### NLI service not responding

1. Model download takes ~5 minutes on first start
2. Check logs: `docker compose logs nli`
3. Verify health: `curl http://localhost:8082/health`

### High memory usage

- TEI default model requires ~4GB RAM
- NLI model requires ~4GB RAM
- Consider using smaller models for development:
  - Embeddings: `BAAI/bge-small-en-v1.5` (~1GB)
  - NLI: `microsoft/deberta-v3-base-mnli` (~1GB)
