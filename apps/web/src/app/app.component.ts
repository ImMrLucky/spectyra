import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth/auth.service';
import { SupabaseService } from './services/supabase.service';
import { OrgSwitcherComponent } from './components/org-switcher.component';
import { environment } from '../environments/environment';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSidenavModule, MatSidenavContainer, MatSidenav } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { OwnerService } from './core/services/owner.service';
import { SuperuserService } from './core/api/superuser.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  section?: string;
  adminOnly?: boolean;
  superuserOnly?: boolean;
  requiresAuth?: boolean;
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
    MatToolbarModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatSidenavContainer) sidenavContainer?: MatSidenavContainer;
  @ViewChild('sidenav') sidenav?: MatSidenav;

  readonly isDesktop = environment.isDesktop;

  isAuthenticated = false;
  userEmail: string | null = null;
  showAdminLink = false;
  showSuperuserLink = false;
  sidebarOpen = true;
  sidebarCollapsed = false;
  private wasAutoCollapsed = false; // Track if collapse was due to screen size
  private authSub?: Subscription;
  private supabaseSub?: Subscription;

  navItems: NavItem[] = [
    { label: 'Overview', route: '/overview', icon: 'space_dashboard', section: 'Product', requiresAuth: true },
    { label: 'Studio', route: '/studio', icon: 'science', requiresAuth: true },
    { label: 'Observe', route: '/observe', icon: 'monitoring', requiresAuth: true },
    { label: 'Integrations', route: '/integrations', icon: 'hub', requiresAuth: true },
    { label: 'Desktop App', route: '/download', icon: 'computer', requiresAuth: true },

    { label: 'Runs', route: '/runs', icon: 'receipt_long', section: 'Analytics', requiresAuth: true },
    { label: 'Usage', route: '/usage', icon: 'bar_chart', requiresAuth: true },
    { label: 'Savings', route: '/analytics', icon: 'trending_down', requiresAuth: true },
    { label: 'Plan & Billing', route: '/billing', icon: 'credit_card', requiresAuth: true },

    { label: 'Projects', route: '/projects', icon: 'folder_open', section: 'Manage', requiresAuth: true },
    { label: 'Policies', route: '/policies', icon: 'policy', requiresAuth: true },
    { label: 'Audit Logs', route: '/audit', icon: 'assignment', requiresAuth: true },
    { label: 'Settings', route: '/settings', icon: 'tune', requiresAuth: true },

    { label: 'Admin', route: '/admin', icon: 'admin_panel_settings', section: 'Admin', adminOnly: true, requiresAuth: true },
    { label: 'Superuser', route: '/superuser', icon: 'security', superuserOnly: true, requiresAuth: true },
  ];

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ownerService: OwnerService,
    private superuserService: SuperuserService,
  ) {}

  ngOnInit() {
    if (this.isDesktop) {
      this.isAuthenticated = true;
      this.ownerService.getIsOwner().subscribe((is) => {
        this.showAdminLink = is;
        this.cdr.markForCheck();
      });
      this.authSub = this.supabase.getSession().subscribe((session) => {
        if (session) {
          this.supabase.getUser().subscribe((user) => {
            this.userEmail = user?.email ?? null;
            this.updateAdminVisibility(user?.email ?? undefined);
          });
        } else {
          this.userEmail = null;
          this.updateAdminVisibility(null);
        }
      });
      return;
    }
    // Check screen size and auto-collapse on mobile
    this.checkScreenSize();
    window.addEventListener('resize', this.checkScreenSize);

    this.ownerService.getIsOwner().subscribe((is) => {
      this.showAdminLink = is;
      this.cdr.markForCheck();
    });

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
          this.updateAdminVisibility(user?.email);
        });
      } else if (hasApiKey && authState.user) {
        // Extract org name from email (format: orgName@spectyra.local)
        const email = authState.user.email || null;
        this.userEmail = email ? email.split('@')[0] : null;
        this.updateAdminVisibility(null);
      } else {
        this.userEmail = null;
        this.updateAdminVisibility(null);
      }
    });
  }

  private updateAdminVisibility(email: string | null | undefined) {
    if (!email) {
      this.showSuperuserLink = false;
      this.ownerService.refresh();
      return;
    }
    this.ownerService.refresh();
    this.superuserService.refresh().subscribe((r) => {
      this.showSuperuserLink = !!r.is_superuser;
      this.cdr.markForCheck();
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
      // Force change detection first
      this.cdr.detectChanges();
      
      // Then update content margins
      requestAnimationFrame(() => {
        if (this.sidenavContainer) {
          // This method recalculates the content margins based on drawer width
          this.sidenavContainer.updateContentMargins();
        }
        
        // Additional fallback: manually update margin using DOM query
        // This ensures the margin updates even if updateContentMargins() doesn't work
        setTimeout(() => {
          const contentElement = document.querySelector('.mat-drawer-content') as HTMLElement;
          if (contentElement && this.sidenav?.opened) {
            const drawerWidth = this.sidebarCollapsed ? 64 : 256;
            contentElement.style.marginLeft = `${drawerWidth}px`;
          }
        }, 10);
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
