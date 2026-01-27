import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth/auth.service';
import { SupabaseService } from './services/supabase.service';
import { OrgSwitcherComponent } from './components/org-switcher.component';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, CommonModule, OrgSwitcherComponent],
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1>Spectyra</h1>
        <nav>
          <a routerLink="/scenarios">Proof Scenarios</a>
          <a routerLink="/integrations">Integrations</a>
          <a routerLink="/projects">Projects</a>
          <a routerLink="/runs">Gateway Runs</a>
          <a routerLink="/savings">Org Savings</a>
          <a routerLink="/billing">Billing</a>
          <a routerLink="/settings">Settings</a>
          <a routerLink="/admin" class="admin-link">Admin</a>
          
          <!-- Org/Project Switcher (if authenticated) -->
          <app-org-switcher *ngIf="isAuthenticated"></app-org-switcher>
          
          <span *ngIf="!isAuthenticated" class="auth-links">
            <a routerLink="/login">Login</a>
            <a routerLink="/register">Sign Up</a>
          </span>
          <span *ngIf="isAuthenticated" class="auth-links">
            <span class="user-email">{{ userEmail }}</span>
            <button (click)="logout()" class="btn-logout">Logout</button>
          </span>
        </nav>
      </header>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-header {
      background: #007bff;
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .app-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .app-header nav {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .app-header nav a {
      color: white;
      text-decoration: none;
      font-weight: 500;
    }
    .app-header nav a:hover {
      text-decoration: underline;
    }
    .admin-link {
      color: #ffc107 !important;
      font-weight: 600;
    }
    .auth-links {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .user-email {
      font-size: 14px;
      opacity: 0.9;
    }
    .btn-logout {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-logout:hover {
      background: rgba(255,255,255,0.3);
    }
    .app-main {
      flex: 1;
      padding: 20px;
    }
  `],
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
