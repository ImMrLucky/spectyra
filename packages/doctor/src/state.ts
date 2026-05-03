import type { DoctorScanResult, UserPlacementAnswer } from "./scanner/types.js";

let lastResult: DoctorScanResult | null = null;
let userPlacement: UserPlacementAnswer = "not_sure";

export function getLastResult(): DoctorScanResult | null {
  return lastResult;
}

export function setLastResult(r: DoctorScanResult | null): void {
  lastResult = r;
}

export function getUserPlacement(): UserPlacementAnswer {
  return userPlacement;
}

export function setUserPlacement(p: UserPlacementAnswer): void {
  userPlacement = p;
}
