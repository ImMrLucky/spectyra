import type { SpectyraEvent, SpectyraEventIntegrationType, AdapterContext } from "./types.js";

export type { AdapterContext };

export interface SpectyraEventAdapter<TInput = unknown> {
  id: string;
  integrationType: SpectyraEventIntegrationType;
  canHandle(input: unknown): boolean;
  ingest(input: TInput, context?: AdapterContext): SpectyraEvent[];
}
