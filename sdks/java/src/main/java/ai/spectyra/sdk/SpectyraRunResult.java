package ai.spectyra.sdk;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Normalized result across embedded + runtime modes (parity with Python `SpectyraRunResult`). */
public final class SpectyraRunResult {
  private final JsonElement output;
  private final String provider;
  private final String model;
  private final double savingsAmount;
  private final double savingsPercent;
  private final double costBefore;
  private final double costAfter;
  private final boolean optimizationActive;
  private final java.util.List<String> warnings;
  private final JsonObject quotaStatus;
  private final JsonObject rawEnvelope;

  public SpectyraRunResult(
      JsonElement output,
      String provider,
      String model,
      double savingsAmount,
      double savingsPercent,
      double costBefore,
      double costAfter,
      boolean optimizationActive,
      java.util.List<String> warnings,
      JsonObject quotaStatus,
      JsonObject rawEnvelope) {
    this.output = output;
    this.provider = provider;
    this.model = model;
    this.savingsAmount = savingsAmount;
    this.savingsPercent = savingsPercent;
    this.costBefore = costBefore;
    this.costAfter = costAfter;
    this.optimizationActive = optimizationActive;
    this.warnings = warnings;
    this.quotaStatus = quotaStatus;
    this.rawEnvelope = rawEnvelope;
  }

  public JsonElement getOutput() {
    return output;
  }

  public String getProvider() {
    return provider;
  }

  public String getModel() {
    return model;
  }

  public double getSavingsAmount() {
    return savingsAmount;
  }

  public double getSavingsPercent() {
    return savingsPercent;
  }

  public double getCostBefore() {
    return costBefore;
  }

  public double getCostAfter() {
    return costAfter;
  }

  public boolean isOptimizationActive() {
    return optimizationActive;
  }

  public java.util.List<String> getWarnings() {
    return warnings;
  }

  public JsonObject getQuotaStatus() {
    return quotaStatus;
  }

  public JsonObject getRawEnvelope() {
    return rawEnvelope;
  }
}
