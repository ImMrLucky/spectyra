"""Provider host hints (subset of TS detectProviderFromHost)."""

from __future__ import annotations


def detect_provider_from_host(host: str) -> str:
    h = (host or "").lower().split(":")[0]
    if "openai.com" in h:
        return "openai"
    if "anthropic.com" in h:
        return "anthropic"
    if "generativelanguage.googleapis.com" in h or "googleapis.com" in h and "gemini" in h:
        return "google-gemini"
    if "groq.com" in h:
        return "groq"
    if "openrouter.ai" in h:
        return "openrouter"
    if "api.together.xyz" in h:
        return "together"
    if "api.perplexity.ai" in h:
        return "perplexity"
    if "mistral.ai" in h:
        return "mistral"
    if "cohere.ai" in h or "cohere.com" in h:
        return "cohere"
    if "bedrock" in h and "amazonaws.com" in h:
        return "aws-bedrock"
    if "openai.azure.com" in h or "azure.com" in h and "openai" in h:
        return "azure-openai"
    return "unknown"
