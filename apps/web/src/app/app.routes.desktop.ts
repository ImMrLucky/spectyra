import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { superuserGuard } from './core/guards/superuser.guard';

/* ── OpenClaw Desktop Edition ── */
import { OpenClawDesktopRedirect } from './features/desktop/openclaw-edition/openclaw-redirect.component';
import { OpenClawHomePage } from './features/desktop/openclaw-edition/openclaw-home.page';
import { OpenClawWizardPage } from './features/desktop/openclaw-edition/openclaw-wizard.page';
import { OpenClawSkillsPage } from './features/desktop/openclaw-hub/skills/openclaw-skills.page';
import { OpenClawAssistantsPage } from './features/desktop/openclaw-hub/assistants/openclaw-assistants.page';
import { OpenClawTasksPage } from './features/desktop/openclaw-hub/tasks/openclaw-tasks.page';
import { LivePage } from './features/desktop/live/live.page';
import { OpenClawSettingsPage } from './features/desktop/openclaw-edition/openclaw-settings.page';

/* ── Shared / auth ── */
import { LoginPage } from './features/auth/login.page';
import { RegisterPage } from './features/auth/register.page';
import { IntegrationsPage } from './features/integrations/integrations.page';
import { SuperuserPage } from './features/superuser/superuser.page';

/**
 * OpenClaw Desktop Edition — simplified routes.
 * Five main sections: Home, Skills, Assistants, Live, Settings.
 * Setup wizard is always accessible but not in the nav bar.
 */
export const desktopRoutes: Routes = [
  { path: '', pathMatch: 'full', component: OpenClawDesktopRedirect },

  { path: 'desktop/home', component: OpenClawHomePage },
  { path: 'desktop/setup', component: OpenClawWizardPage },
  { path: 'desktop/skills', component: OpenClawSkillsPage },
  { path: 'desktop/assistants', component: OpenClawAssistantsPage },
  { path: 'desktop/tasks', component: OpenClawTasksPage },
  { path: 'desktop/live', component: LivePage },
  { path: 'desktop/settings', component: OpenClawSettingsPage },

  /* Legacy redirects so bookmarks still work */
  { path: 'desktop/openclaw', redirectTo: 'desktop/home', pathMatch: 'full' },
  { path: 'desktop/openclaw/overview', redirectTo: 'desktop/home', pathMatch: 'full' },
  { path: 'desktop/openclaw/setup', redirectTo: 'desktop/setup', pathMatch: 'full' },
  { path: 'desktop/openclaw/setup/guide', redirectTo: 'desktop/setup', pathMatch: 'full' },
  { path: 'desktop/openclaw/skills', redirectTo: 'desktop/skills', pathMatch: 'full' },
  { path: 'desktop/openclaw/assistants', redirectTo: 'desktop/assistants', pathMatch: 'full' },
  { path: 'desktop/openclaw/tasks', redirectTo: 'desktop/tasks', pathMatch: 'full' },
  { path: 'desktop/openclaw/diagnostics', redirectTo: 'desktop/settings', pathMatch: 'full' },
  { path: 'desktop/dashboard', redirectTo: 'desktop/home', pathMatch: 'full' },
  { path: 'desktop/sessions', redirectTo: 'desktop/live', pathMatch: 'full' },
  { path: 'desktop/history', redirectTo: 'desktop/live', pathMatch: 'full' },
  { path: 'desktop/compare', redirectTo: 'desktop/live', pathMatch: 'full' },
  { path: 'desktop/runs', redirectTo: 'desktop/live', pathMatch: 'full' },
  { path: 'desktop/agent-companion', redirectTo: 'desktop/setup', pathMatch: 'full' },
  { path: 'desktop/onboarding', redirectTo: 'desktop/setup', pathMatch: 'full' },
  { path: 'desktop/security', redirectTo: 'desktop/settings', pathMatch: 'full' },
  { path: 'desktop/openclaw-legacy', redirectTo: 'desktop/setup', pathMatch: 'full' },
  { path: 'desktop/live-savings', redirectTo: 'desktop/live', pathMatch: 'full' },
  { path: 'desktop/live-legacy', redirectTo: 'desktop/live', pathMatch: 'full' },

  { path: 'login', component: LoginPage },
  { path: 'register', component: RegisterPage },
  { path: 'integrations/:slug', component: IntegrationsPage, canActivate: [authGuard] },
  { path: 'integrations', component: IntegrationsPage, canActivate: [authGuard] },
  { path: 'superuser', component: SuperuserPage, canActivate: [authGuard, superuserGuard] },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
