import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth/auth.service';
import { SupabaseService } from './services/supabase.service';
import { OrgSwitcherComponent } from './components/org-switcher.component';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSidenavModule, MatSidenavContainer, MatSidenav } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterModule,
    CommonModule,
    OrgSwitcherComponent,
    MatSnackBarModule,
    MatDialogModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatToolbarModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatSidenavContainer) sidenavContainer?: MatSidenavContainer;
  @ViewChild('sidenav') sidenav?: MatSidenav;
  
  isAuthenticated = false;
  userEmail: string | null = null;
  sidebarOpen = true;
  sidebarCollapsed = false;
  private wasAutoCollapsed = false; // Track if collapse was due to screen size
  private authSub?: Subscription;
  private supabaseSub?: Subscription;

  navItems: NavItem[] = [
    { label: 'Overview', route: '/overview', icon: 'dashboard' },
    { label: 'Runs', route: '/runs', icon: 'play_circle' },
    { label: 'Policies', route: '/policies', icon: 'security' },
    { label: 'Integrations', route: '/integrations', icon: 'extension' },
    { label: 'Projects', route: '/projects', icon: 'folder' },
    { label: 'Usage & Billing', route: '/usage', icon: 'account_balance' },
    { label: 'Audit Logs', route: '/audit', icon: 'history' },
    { label: 'Settings', route: '/settings', icon: 'settings' },
    { label: 'Admin', route: '/admin', icon: 'admin_panel_settings', adminOnly: true },
  ];

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Check screen size and auto-collapse on mobile
    this.checkScreenSize();
    window.addEventListener('resize', this.checkScreenSize);

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

  ngAfterViewInit() {
    // Initial check after view is initialized
    this.checkScreenSize();
  }

  private checkScreenSize = () => {
    const isSmallScreen = window.innerWidth <= 768;
    const previousCollapsed = this.sidebarCollapsed;
    
    if (isSmallScreen) {
      // Auto-collapse on small screens
      if (!this.sidebarCollapsed) {
        this.wasAutoCollapsed = true;
      }
      this.sidebarCollapsed = true;
      this.sidebarOpen = true; // Keep sidebar open but collapsed
    } else {
      // On larger screens, auto-expand if it was auto-collapsed
      if (this.wasAutoCollapsed) {
        this.sidebarCollapsed = false;
        this.wasAutoCollapsed = false;
      }
    }
    
    // Only update layout if state actually changed
    if (previousCollapsed !== this.sidebarCollapsed) {
      this.updateSidenavLayout();
    }
  }

  private updateSidenavLayout() {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      // First, ensure the drawer width is set
      if (this.sidenav) {
        const targetWidth = this.sidebarCollapsed ? 64 : 240;
        const drawerElement = this.sidenav._elementRef.nativeElement;
        if (drawerElement) {
          drawerElement.style.width = `${targetWidth}px`;
        }
      }
      
      // Force change detection
      this.cdr.detectChanges();
      
      // Then update content margins - use multiple attempts to ensure it works
      requestAnimationFrame(() => {
        if (this.sidenavContainer) {
          // This method recalculates the content margins based on drawer width
          this.sidenavContainer.updateContentMargins();
          
          // Also manually ensure margin is correct as fallback
          const contentElement = this.sidenavContainer._content?.nativeElement;
          if (contentElement && this.sidenav?.opened) {
            const drawerWidth = this.sidebarCollapsed ? 64 : 240;
            contentElement.style.marginLeft = `${drawerWidth}px`;
          }
        }
      });
    });
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.supabaseSub?.unsubscribe();
    window.removeEventListener('resize', this.checkScreenSize);
  }

  toggleSidebar() {
    const previousCollapsed = this.sidebarCollapsed;
    this.sidebarCollapsed = !this.sidebarCollapsed;
    // Clear auto-collapse flag when user manually toggles
    this.wasAutoCollapsed = false;
    // Keep sidebar open, just toggle collapsed state
    if (!this.sidebarOpen) {
      this.sidebarOpen = true;
    }
    
    // Force change detection first
    this.cdr.detectChanges();
    
    // Force layout update with proper timing
    if (previousCollapsed !== this.sidebarCollapsed) {
      this.updateSidenavLayout();
    }
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
