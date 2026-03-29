/**
 * Persisted local learning profile (~/.spectyra/companion/learning-profile.json).
 */

import fs from "fs";
import path from "path";
import type { LearningProfile } from "@spectyra/canonical-model";
import { createEmptyProfile } from "@spectyra/learning";
import { COMPANION_DATA_DIR } from "./localStore.js";

const LEARNING_FILE = path.join(COMPANION_DATA_DIR, "learning-profile.json");
const DEFAULT_SCOPE = "spectyra_companion";

export function companionLearningProfilePath(): string {
  return LEARNING_FILE;
}

export function loadCompanionLearningProfile(): LearningProfile {
  try {
    const raw = fs.readFileSync(LEARNING_FILE, "utf-8");
    const profile = JSON.parse(raw) as LearningProfile;
    if (profile?.scopeId && typeof profile.transformPreferences === "object") {
      return profile;
    }
  } catch {
    /* missing or invalid */
  }
  return createEmptyProfile(DEFAULT_SCOPE);
}

export function saveCompanionLearningProfile(profile: LearningProfile): void {
  fs.mkdirSync(COMPANION_DATA_DIR, { recursive: true });
  fs.writeFileSync(LEARNING_FILE, JSON.stringify(profile, null, 2), "utf-8");
}
