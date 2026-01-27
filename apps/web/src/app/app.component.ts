import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth/auth.service';
import { SupabaseService } from './services/supabase.service';
import { OrgSwitcherComponent } from './components/org-switcher.component';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, CommonModule, OrgSwitcherComponent, MatSnackBarModule, MatDialogModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  isAuthenticated = false;
  userEmail: string | null = null;
  private authSub?: Subscription;
  private supabaseSub?: Subscription;

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService,
    private router: Router
  ) {}

  ngOnInit() {
    // Check both Supabase session and API key auth
    this.authSub = combineLatest([
      this.supabase.getSession(),
      this.authService.authState
    ]).pipe(
      map(([session, authState]) => {
        // Authenticated if either Supabase session exists OR API key exists
        const hasSupabase = !!session;
        const hasApiKey = !!authState.apiKey;
        return { hasSupabase, hasApiKey, authState };
      })
    ).subscribe(({ hasSupabase, hasApiKey, authState }) => {
      this.isAuthenticated = hasSupabase || hasApiKey;
      
      if (hasSupabase) {
        // Get email from Supabase user
        this.supabase.getUser().subscribe(user => {
          this.userEmail = user?.email || null;
        });
      } else if (hasApiKey && authState.user) {
        // Extract org name from email (format: orgName@spectyra.local)
        const email = authState.user.email || null;
        this.userEmail = email ? email.split('@')[0] : null;
      } else {
        this.userEmail = null;
      }
    });
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.supabaseSub?.unsubscribe();
  }

  async logout() {
    // Logout from both Supabase and clear API key
    await this.supabase.signOut();
    this.authService.logout();
    
    // Clear all Supabase-related localStorage items
    // Supabase stores tokens with keys like: sb-<project-ref>-auth-token
    const supabaseKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') || key.includes('supabase')
    );
    supabaseKeys.forEach(key => localStorage.removeItem(key));
    
    // Redirect to login page
    this.router.navigate(['/login']);
  }
}
