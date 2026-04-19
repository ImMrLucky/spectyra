import { Routes } from '@angular/router';
import { SettingsPage } from './features/settings/settings.page';
import { RegisterPage } from './features/auth/register.page';
import { LoginPage } from './features/auth/login.page';
import { OpenClawIntegrationPage } from './features/openclaw/openclaw-integration.page';
import { ProjectsPage } from './features/projects/projects.page';
import { AdminPage } from './features/admin/admin.page';
import { OptimizerLabPage } from './features/optimizer-lab/optimizer-lab.page';
import { HomePage } from './features/home/home.page';
import { OpenClawLandingPage } from './features/marketing/openclaw-landing.page';
import { AppIntegrationPage } from './features/marketing/app-integration.page';
import { ContactPage } from './features/contact/contact.page';
import { OverviewPage } from './features/overview/overview.page';
import { SavingsAnalyticsPage } from './features/analytics/savings-analytics.page';
import { SecuritySettingsPage } from './features/settings/security.page';
import { ProviderKeysPage } from './features/settings/provider-keys.page';
import { BillingPage } from './features/billing/billing.page';
import { OpenClawOnboardingPage } from './features/openclaw/openclaw-onboarding.page';
import { SuperuserPage } from './features/superuser/superuser.page';
import { authGuard } from './core/guards/auth.guard';
import { superuserGuard } from './core/guards/superuser.guard';

export const webRoutes: Routes = [
  { path: '', component: HomePage },
  { path: 'openclaw', component: OpenClawLandingPage },
  { path: 'in-app', component: AppIntegrationPage },
  { path: 'developers', redirectTo: '/in-app', pathMatch: 'full' },
  { path: 'contact', component: ContactPage },
  { path: 'register', component: RegisterPage },
  { path: 'login', component: LoginPage },

  { path: 'studio', redirectTo: '/overview', pathMatch: 'full' },
  { path: 'observe', component: OptimizerLabPage, canActivate: [authGuard] },
  { path: 'integrations/openclaw/setup', component: OpenClawOnboardingPage, canActivate: [authGuard] },
  { path: 'integrations/openclaw', component: OpenClawIntegrationPage, canActivate: [authGuard] },
  { path: 'integrations/:slug', redirectTo: '/integrations/openclaw', pathMatch: 'full' },
  { path: 'integrations', redirectTo: '/integrations/openclaw', pathMatch: 'full' },
  { path: 'download', redirectTo: '/openclaw', pathMatch: 'full' },

  { path: 'overview', component: OverviewPage, canActivate: [authGuard] },
  { path: 'runs', redirectTo: '/overview', pathMatch: 'prefix' },
  { path: 'usage', redirectTo: '/analytics', pathMatch: 'full' },
  { path: 'analytics', component: SavingsAnalyticsPage, canActivate: [authGuard] },

  { path: 'billing', component: BillingPage, canActivate: [authGuard] },
  { path: 'policies', redirectTo: '/overview', pathMatch: 'full' },
  { path: 'projects', component: ProjectsPage, canActivate: [authGuard] },
  { path: 'audit', redirectTo: '/overview', pathMatch: 'full' },
  { path: 'settings', component: SettingsPage, canActivate: [authGuard] },
  { path: 'settings/security', component: SecuritySettingsPage, canActivate: [authGuard] },
  { path: 'settings/provider-keys', component: ProviderKeysPage, canActivate: [authGuard] },

  { path: 'admin', component: AdminPage, canActivate: [authGuard] },
  { path: 'superuser', component: SuperuserPage, canActivate: [authGuard, superuserGuard] },

  { path: 'optimizer-lab', redirectTo: '/observe', pathMatch: 'full' },
  { path: 'admin/optimizer-lab', redirectTo: '/observe', pathMatch: 'full' },
  { path: 'admin/studio', redirectTo: '/overview', pathMatch: 'full' },
  { path: 'savings', redirectTo: '/analytics', pathMatch: 'full' },
];
