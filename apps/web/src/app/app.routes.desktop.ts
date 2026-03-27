import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { DesktopDashboardPage } from './features/desktop/dashboard.page';
import { DesktopOnboardingPage } from './features/desktop/onboarding.page';
import { DesktopOpenClawPage } from './features/desktop/openclaw.page';
import { DesktopRunsPage } from './features/desktop/runs.page';
import { LiveSavingsPage } from './features/desktop/live-savings.page';
import { IntegrationsPage } from './features/integrations/integrations.page';
import { LoginPage } from './features/auth/login.page';

/** Electron renderer — local-first shell (hash routing in main.ts). */
export const desktopRoutes: Routes = [
  { path: '', redirectTo: 'desktop/dashboard', pathMatch: 'full' },
  { path: 'desktop/dashboard', component: DesktopDashboardPage },
  { path: 'desktop/onboarding', component: DesktopOnboardingPage },
  { path: 'desktop/openclaw', component: DesktopOpenClawPage },
  { path: 'desktop/runs', component: DesktopRunsPage },
  { path: 'desktop/live-savings', component: LiveSavingsPage },
  { path: 'login', component: LoginPage },
  { path: 'integrations', component: IntegrationsPage, canActivate: [authGuard] },
];
