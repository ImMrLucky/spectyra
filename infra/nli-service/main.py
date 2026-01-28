"""
Spectyra NLI Service
====================

FastAPI service for Natural Language Inference (NLI) using MNLI models.
Provides contradiction/entailment/neutral classification for text pairs.

Usage:
    POST /nli
    Body: { "pairs": [{"premise": "...", "hypothesis": "..."}] }
    Response: { "results": [{"label": "contradiction", "confidence": 0.95}] }

Environment Variables:
    NLI_MODEL: Model to use (default: microsoft/deberta-v3-large-mnli)
    DEVICE: cpu or cuda (default: cpu)
    MAX_LENGTH: Max sequence length (default: 256)
    WORKERS: Number of uvicorn workers (default: 1)
"""

import os
import logging
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
NLI_MODEL = os.getenv("NLI_MODEL", "microsoft/deberta-v3-large-mnli")
DEVICE = os.getenv("DEVICE", "cpu")
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "256"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "16"))

# Label mapping for MNLI models
LABEL_MAP = {
    0: "entailment",
    1: "neutral", 
    2: "contradiction",
}

# Some models use different label ordering
DEBERTA_LABEL_MAP = {
    0: "contradiction",
    1: "neutral",
    2: "entailment",
}

# Global model and tokenizer
model = None
tokenizer = None
label_map = None


def load_model():
    """Load the NLI model and tokenizer."""
    global model, tokenizer, label_map
    
    logger.info(f"Loading NLI model: {NLI_MODEL}")
    logger.info(f"Device: {DEVICE}")
    
    tokenizer = AutoTokenizer.from_pretrained(NLI_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(NLI_MODEL)
    
    # Move to device
    if DEVICE == "cuda" and torch.cuda.is_available():
        model = model.cuda()
        logger.info("Model loaded on GPU")
    else:
        logger.info("Model loaded on CPU")
    
    model.eval()
    
    # Determine label map based on model
    if "deberta" in NLI_MODEL.lower():
        label_map = DEBERTA_LABEL_MAP
    else:
        label_map = LABEL_MAP
    
    logger.info(f"Model loaded successfully. Labels: {label_map}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    load_model()
    yield
    # Cleanup on shutdown
    logger.info("Shutting down NLI service")


app = FastAPI(
    title="Spectyra NLI Service",
    description="Natural Language Inference service for contradiction detection",
    version="1.0.0",
    lifespan=lifespan,
)


# Request/Response models
class NliPair(BaseModel):
    premise: str
    hypothesis: str


class NliRequest(BaseModel):
    pairs: List[NliPair]
    model: Optional[str] = None  # For future multi-model support


class NliResultItem(BaseModel):
    label: str
    confidence: float
    scores: Optional[dict] = None


class NliResponse(BaseModel):
    results: List[NliResultItem]


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return HealthResponse(
        status="healthy",
        model=NLI_MODEL,
        device=DEVICE,
    )


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Spectyra NLI Service",
        "model": NLI_MODEL,
        "device": DEVICE,
        "endpoints": {
            "nli": "POST /nli - Classify text pairs",
            "health": "GET /health - Health check",
        }
    }


@app.post("/nli", response_model=NliResponse)
async def classify_nli(request: NliRequest):
    """
    Classify premise-hypothesis pairs for NLI.
    
    Returns entailment, contradiction, or neutral for each pair.
    """
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if not request.pairs:
        return NliResponse(results=[])
    
    if len(request.pairs) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 pairs per request")
    
    results = []
    
    # Process in batches
    for i in range(0, len(request.pairs), BATCH_SIZE):
        batch = request.pairs[i:i + BATCH_SIZE]
        batch_results = classify_batch(batch)
        results.extend(batch_results)
    
    return NliResponse(results=results)


def classify_batch(pairs: List[NliPair]) -> List[NliResultItem]:
    """Classify a batch of pairs."""
    # Prepare inputs
    premises = [p.premise[:MAX_LENGTH] for p in pairs]
    hypotheses = [p.hypothesis[:MAX_LENGTH] for p in pairs]
    
    # Tokenize
    inputs = tokenizer(
        premises,
        hypotheses,
        padding=True,
        truncation=True,
        max_length=MAX_LENGTH,
        return_tensors="pt",
    )
    
    # Move to device
    if DEVICE == "cuda" and torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}
    
    # Run inference
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1)
    
    # Convert to results
    results = []
    for idx in range(len(pairs)):
        prob_dict = {
            label_map[i]: float(probs[idx][i])
            for i in range(len(label_map))
        }
        
        # Get best label
        best_idx = int(torch.argmax(probs[idx]))
        best_label = label_map[best_idx]
        best_confidence = float(probs[idx][best_idx])
        
        results.append(NliResultItem(
            label=best_label,
            confidence=best_confidence,
            scores=prob_dict,
        ))
    
    return results


if __name__ == "__main__":
    import uvicorn
    
    workers = int(os.getenv("WORKERS", "1"))
    port = int(os.getenv("PORT", "8000"))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        workers=workers,
    )
