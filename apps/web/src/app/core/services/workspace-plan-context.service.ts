import { Injectable } from '@angular/core';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { workspaceHeaderPlanLabel } from '../plan-labels';

export interface WorkspacePlanSnapshot {
  entitlement: Record<string, unknown> | null;
  billingStatus: Record<string, unknown> | null;
  headerPlanLabel: string | null;
  loading: boolean;
}

function billingExemptFromStatus(b: Record<string, unknown> | null): boolean {
  if (!b) return false;
  return !!(b['org_platform_exempt'] || b['platform_billing_exempt']);
}

function paidActive(b: Record<string, unknown> | null): boolean {
  return b?.['subscription_active'] === true;
}

@Injectable({ providedIn: 'root' })
export class WorkspacePlanContextService {
  private readonly snapshot$ = new BehaviorSubject<WorkspacePlanSnapshot>({
    entitlement: null,
    billingStatus: null,
    headerPlanLabel: null,
    loading: false,
  });

  /** Header + usage page subscribe to this */
  readonly state$ = this.snapshot$.asObservable();

  constructor(private api: ApiClientService) {}

  getSnapshot(): WorkspacePlanSnapshot {
    return this.snapshot$.value;
  }

  clear(): void {
    this.snapshot$.next({
      entitlement: null,
      billingStatus: null,
      headerPlanLabel: null,
      loading: false,
    });
  }

  /**
   * Replace entitlement and/or billing (e.g. after Plan & Billing page loads)
   * so the shell badge stays in sync without an extra round trip.
   */
  patchFromDashboard(entitlement?: Record<string, unknown> | null, billingStatus?: Record<string, unknown> | null): void {
    const cur = this.snapshot$.value;
    const nextEnt = entitlement !== undefined ? entitlement : cur.entitlement;
    const nextBill = billingStatus !== undefined ? billingStatus : cur.billingStatus;
    this.emitMerged(nextEnt, nextBill, false);
  }

  /** Load entitlement + billing for the current workspace (JWT). */
  refresh(): void {
    this.snapshot$.next({ ...this.snapshot$.value, loading: true });
    forkJoin({
      entitlement: this.api.getEntitlement().pipe(catchError(() => of(null))),
      billing: this.api.getBillingStatus().pipe(catchError(() => of(null))),
    }).subscribe(({ entitlement, billing }) => {
      this.emitMerged(
        entitlement as Record<string, unknown> | null,
        billing as Record<string, unknown> | null,
        false,
      );
    });
  }

  private emitMerged(
    entitlement: Record<string, unknown> | null,
    billingStatus: Record<string, unknown> | null,
    loading: boolean,
  ): void {
    if (!entitlement && !billingStatus) {
      this.snapshot$.next({
        entitlement: null,
        billingStatus: null,
        headerPlanLabel: null,
        loading,
      });
      return;
    }

    const plan = entitlement?.['plan'] != null ? String(entitlement['plan']) : 'free';
    const exempt = billingExemptFromStatus(billingStatus);
    const paid = paidActive(billingStatus);
    const headerPlanLabel = workspaceHeaderPlanLabel({
      plan,
      paidSubscriptionActive: paid,
      billingExemptWorkspace: exempt,
    });
    this.snapshot$.next({
      entitlement,
      billingStatus,
      headerPlanLabel,
      loading,
    });
  }
}
