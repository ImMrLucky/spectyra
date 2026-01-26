import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, CommonModule],
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
          <a routerLink="/settings">Org Settings</a>
          <a routerLink="/admin" class="admin-link">Admin</a>
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

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authSub = this.authService.authState.subscribe(state => {
      this.isAuthenticated = !!state.user && !!state.apiKey;
      // Extract org name from email (format: orgName@spectyra.local)
      const email = state.user?.email || null;
      this.userEmail = email ? email.split('@')[0] : null;
    });
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
  }

  logout() {
    this.authService.logout();
  }
}
