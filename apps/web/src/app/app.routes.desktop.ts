import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { DesktopDashboardPage } from './features/desktop/dashboard.page';
import { DesktopOnboardingPage } from './features/desktop/onboarding.page';
import { OpenClawOnboardingPage } from './features/openclaw/openclaw-onboarding.page';
import { DesktopRunsPage } from './features/desktop/runs.page';
import { LiveSavingsPage } from './features/desktop/live-savings.page';
import { LivePage } from './features/desktop/live/live.page';
import { DesktopSessionsPage } from './features/desktop/sessions/sessions.page';
import { DesktopHistoryPage } from './features/desktop/history/history.page';
import { DesktopComparePage } from './features/desktop/compare/compare.page';
import { AgentCompanionLandingPage } from './features/desktop/agent-companion/agent-companion-landing.page';
import { DesktopHomeRedirectComponent } from './features/desktop/desktop-home-redirect.component';
import { DesktopSecurityPage } from './features/desktop/security/desktop-security.page';
import { DesktopSettingsPage } from './features/desktop/settings/desktop-settings.page';
import { IntegrationsPage } from './features/integrations/integrations.page';
import { LoginPage } from './features/auth/login.page';
import { RegisterPage } from './features/auth/register.page';
import { SuperuserPage } from './features/superuser/superuser.page';
import { superuserGuard } from './core/guards/superuser.guard';

/** Electron renderer — local-first shell (hash routing in main.ts). */
export const desktopRoutes: Routes = [
  { path: '', pathMatch: 'full', component: DesktopHomeRedirectComponent },
  { path: 'desktop/dashboard', component: DesktopDashboardPage },
  { path: 'desktop/live', component: LivePage },
  { path: 'desktop/live-savings', redirectTo: 'desktop/live', pathMatch: 'full' },
  { path: 'desktop/sessions', component: DesktopSessionsPage },
  { path: 'desktop/history', component: DesktopHistoryPage },
  { path: 'desktop/compare', component: DesktopComparePage },
  { path: 'desktop/agent-companion', component: AgentCompanionLandingPage },
  { path: 'desktop/security', component: DesktopSecurityPage },
  { path: 'desktop/settings', component: DesktopSettingsPage },
  { path: 'desktop/onboarding', component: DesktopOnboardingPage },
  { path: 'desktop/openclaw', component: OpenClawOnboardingPage },
  { path: 'desktop/runs', component: DesktopRunsPage },
  /** Legacy detailed view — keep route for bookmarks; forwards to hero Live. */
  { path: 'desktop/live-legacy', component: LiveSavingsPage },
  { path: 'login', component: LoginPage },
  { path: 'register', component: RegisterPage },
  { path: 'integrations/:slug', component: IntegrationsPage, canActivate: [authGuard] },
  { path: 'integrations', component: IntegrationsPage, canActivate: [authGuard] },
  { path: 'superuser', component: SuperuserPage, canActivate: [authGuard, superuserGuard] },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
