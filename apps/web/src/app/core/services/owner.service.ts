/**
 * Owner Service
 * 
 * Checks if the current user is an owner by probing an owner-only endpoint.
 * Owner access is enforced server-side (configured via OWNER_EMAIL).
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class OwnerService {
  private isOwner$ = new BehaviorSubject<boolean>(false);
  private checking = false;

  constructor(
    private supabase: SupabaseService,
    private http: HttpClient
  ) {
    this.checkOwnerStatus();
  }

  /**
   * Check if current user is owner
   * Attempts to access admin endpoint - if 403, not owner; if 200, is owner
   */
  private checkOwnerStatus() {
    if (this.checking) return;
    
    this.checking = true;
    
    // Check if user is authenticated
    this.supabase.getSession().subscribe(async (session) => {
      if (!session) {
        this.isOwner$.next(false);
        this.checking = false;
        return;
      }

      // Try to access admin endpoint (will return 403 if not owner)
      try {
        await firstValueFrom(this.http.get(`${environment.apiUrl}/admin/orgs`, {
          observe: 'response',
        }));
        
        // If we get here without error, user is owner
        this.isOwner$.next(true);
      } catch (error: any) {
        // 403 means not owner, other errors also mean not owner
        this.isOwner$.next(false);
      } finally {
        this.checking = false;
      }
    });
  }

  /**
   * Get observable for owner status
   */
  getIsOwner(): Observable<boolean> {
    return this.isOwner$.asObservable();
  }

  /**
   * Check if user is owner (synchronous, uses cached value)
   */
  isOwner(): boolean {
    return this.isOwner$.value;
  }

  /**
   * Refresh owner status
   */
  refresh() {
    this.checkOwnerStatus();
  }
}
