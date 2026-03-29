import { Injectable, NgZone } from '@angular/core';
import { CompanionAnalyticsService } from '../analytics/companion-analytics.service';

export type LiveEventCallback = (payload: {
  eventType?: string;
  raw: MessageEvent;
}) => void;

/**
 * SSE to Local Companion `/v1/analytics/live-events` — single connection helper.
 */
@Injectable({ providedIn: 'root' })
export class CompanionEventStreamService {
  private es?: EventSource;

  constructor(
    private companion: CompanionAnalyticsService,
    private zone: NgZone,
  ) {}

  async connect(onEvent: LiveEventCallback, onOpen?: () => void, onError?: () => void): Promise<void> {
    this.disconnect();
    const url = await this.companion.liveEventsUrl();
    this.es = new EventSource(url);
    this.es.onopen = () => this.zone.run(() => onOpen?.());
    this.es.onerror = () => this.zone.run(() => onError?.());
    this.es.onmessage = (ev) => {
      this.zone.run(() => {
        let eventType: string | undefined;
        try {
          const data = JSON.parse(ev.data) as { event?: { type?: string } };
          eventType = data?.event?.type;
        } catch {
          /* ignore */
        }
        onEvent({ eventType, raw: ev });
      });
    };
  }

  disconnect(): void {
    this.es?.close();
    this.es = undefined;
  }
}
