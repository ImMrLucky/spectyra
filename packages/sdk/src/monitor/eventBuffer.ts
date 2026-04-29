import type { SpectyraMonitorEvent } from "./monitorTypes.js";

export class MonitorEventBuffer {
  private readonly max: number;
  private events: SpectyraMonitorEvent[] = [];

  constructor(maxEvents = 2000) {
    this.max = Math.max(100, maxEvents);
  }

  push(ev: SpectyraMonitorEvent): void {
    this.events.push(ev);
    if (this.events.length > this.max) {
      this.events = this.events.slice(-this.max);
    }
  }

  snapshot(): SpectyraMonitorEvent[] {
    return [...this.events];
  }

  recent(limit: number): SpectyraMonitorEvent[] {
    const n = Math.max(0, Math.min(limit, this.events.length));
    return this.events.slice(-n);
  }

  clear(): void {
    this.events = [];
  }
}
