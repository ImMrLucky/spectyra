/**
 * Agent flow inefficiency detectors.
 *
 * Identifies recursive planning loops, repeated reasoning, excessive
 * tool-result re-embeddings, and step-to-step context growth.
 */

import type {
  CanonicalRequest,
  FeatureDetector,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

function msgText(msg: { text?: string }): string {
  return msg.text ?? "";
}

export const recursivePlanningDetector: FeatureDetector = {
  id: "agent_flow/recursive_planning",
  category: "agent_flow",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const assistantMsgs = input.messages.filter(m => m.role === "assistant").map(m => msgText(m));
    if (assistantMsgs.length < 3) return [];

    const planPhrases = ["let me plan", "here's my plan", "step 1", "i will", "my approach"];
    let planCount = 0;
    for (const t of assistantMsgs) {
      const lower = t.toLowerCase();
      if (planPhrases.some(p => lower.includes(p))) planCount++;
    }

    if (planCount < 2) return [];
    return [{
      featureId: "agent_flow/recursive_planning",
      confidence: Math.min(1, planCount / assistantMsgs.length),
      severity: planCount > 3 ? "high" : "medium",
      metrics: { planningSteps: planCount, totalAssistantSteps: assistantMsgs.length },
    }];
  },
};

export const repeatedReasoningDetector: FeatureDetector = {
  id: "agent_flow/repeated_reasoning",
  category: "agent_flow",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const assistantTexts = input.messages
      .filter(m => m.role === "assistant")
      .map(m => msgText(m))
      .filter(t => t.length > 50);

    if (assistantTexts.length < 2) return [];

    let similarPairs = 0;
    for (let i = 0; i < assistantTexts.length; i++) {
      for (let j = i + 1; j < assistantTexts.length; j++) {
        const shorter = Math.min(assistantTexts[i].length, assistantTexts[j].length);
        const prefix = assistantTexts[i].slice(0, 200);
        if (assistantTexts[j].startsWith(prefix.slice(0, Math.min(100, shorter)))) {
          similarPairs++;
        }
      }
    }
    if (similarPairs === 0) return [];
    return [{
      featureId: "agent_flow/repeated_reasoning",
      confidence: Math.min(1, similarPairs * 0.3),
      severity: similarPairs > 2 ? "high" : "medium",
      metrics: { similarReasoningPairs: similarPairs },
    }];
  },
};

export const toolResultReinclusion: FeatureDetector = {
  id: "agent_flow/tool_result_reinclusion",
  category: "agent_flow",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const toolMsgs = input.messages.filter(m => m.role === "tool");
    if (toolMsgs.length < 3) return [];
    const toolOutputChars = toolMsgs.reduce((a, m) => a + (m.text?.length ?? 0), 0);
    const totalChars = input.messages.reduce((a, m) => a + (m.text?.length ?? 0), 0);
    const ratio = totalChars > 0 ? toolOutputChars / totalChars : 0;
    if (ratio < 0.5) return [];
    return [{
      featureId: "agent_flow/tool_result_reinclusion",
      confidence: Math.min(1, ratio),
      severity: ratio > 0.7 ? "high" : "medium",
      metrics: { toolOutputRatio: Math.round(ratio * 100) / 100, toolMessageCount: toolMsgs.length },
    }];
  },
};

export const contextGrowthDetector: FeatureDetector = {
  id: "agent_flow/context_growth",
  category: "agent_flow",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (!input.execution.isAgenticFlow && !input.execution.isMultiStepFlow) return [];
    if (input.messages.length < 6) return [];
    const halfPoint = Math.floor(input.messages.length / 2);
    const firstHalf = input.messages.slice(0, halfPoint).reduce((a, m) => a + (m.text?.length ?? 0), 0);
    const secondHalf = input.messages.slice(halfPoint).reduce((a, m) => a + (m.text?.length ?? 0), 0);
    if (firstHalf === 0 || secondHalf < firstHalf * 1.5) return [];
    const growthRatio = secondHalf / firstHalf;
    return [{
      featureId: "agent_flow/context_growth",
      confidence: Math.min(1, (growthRatio - 1) / 3),
      severity: growthRatio > 3 ? "high" : "medium",
      metrics: { growthRatio: Math.round(growthRatio * 100) / 100 },
    }];
  },
};

export const agentFlowDetectors: FeatureDetector[] = [
  recursivePlanningDetector,
  repeatedReasoningDetector,
  toolResultReinclusion,
  contextGrowthDetector,
];
