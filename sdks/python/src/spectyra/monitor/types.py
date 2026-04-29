"""Metadata-only monitor event shapes (parity with @spectyra/sdk monitorTypes)."""

from __future__ import annotations

from typing import Any, Literal, TypedDict


SpectyraMonitorProvider = Literal[
    "openai",
    "anthropic",
    "google-gemini",
    "groq",
    "azure-openai",
    "aws-bedrock",
    "mistral",
    "cohere",
    "openrouter",
    "together",
    "perplexity",
    "unknown",
]

SpectyraMonitorIntegrationMode = Literal[
    "explicit_sdk",
    "auto_fetch",
    "auto_http",
    "auto_provider_sdk",
    "framework_hook",
]


class SpectyraWasteSignal(TypedDict, total=False):
    type: str
    severity: Literal["info", "warning", "critical"]
    title: str
    description: str
    estimatedWasteUsd: float
    confidence: Literal["high", "medium", "low"]


class SpectyraMonitorEvent(TypedDict, total=False):
    eventId: str
    timestamp: str
    project: str
    environment: str
    service: str
    provider: SpectyraMonitorProvider
    model: str
    integrationMode: SpectyraMonitorIntegrationMode
    sdkLanguage: Literal["typescript", "python"]
    inputTokens: int
    outputTokens: int
    totalTokens: int
    actualCostUsd: float
    latencyMs: int
    success: bool
    statusCode: int
    method: str
    urlHost: str
    route: str
    pricingSource: str
    optimizerApplied: bool
    optimizerStatus: str
    wasteSignals: list[SpectyraWasteSignal]
    metadataOnly: Literal[True]


class SpectyraMonitorSummary(TypedDict):
    requestCount: int
    successCount: int
    errorCount: int
    actualSpendProviderUsd: float
    optimizedSpendSpectyraUsd: float
    savingsUsd: float
    missedSavingsUsd: float
    totalTokens: int
    inputTokens: int
    outputTokens: int
    averageCostPerRequestUsd: float
    averageLatencyMs: float
    p95LatencyMs: float
    lastRequestAt: str | None


JSONDict = dict[str, Any]
