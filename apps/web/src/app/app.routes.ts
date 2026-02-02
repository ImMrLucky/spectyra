import { Routes } from '@angular/router';
import { RunsPage } from './features/runs/runs.page';
import { SettingsPage } from './features/settings/settings.page';
import { RegisterPage } from './features/auth/register.page';
import { LoginPage } from './features/auth/login.page';
import { IntegrationsPage } from './features/integrations/integrations.page';
import { ProjectsPage } from './features/projects/projects.page';
import { AdminPage } from './features/admin/admin.page';
import { OptimizerLabPage } from './features/optimizer-lab/optimizer-lab.page';
import { HomePage } from './features/home/home.page';
import { OverviewPage } from './features/overview/overview.page';
import { PoliciesPage } from './features/policies/policies.page';
import { UsagePage } from './features/usage/usage.page';
import { AuditPage } from './features/audit/audit.page';
import { SecuritySettingsPage } from './features/settings/security.page';
import { ProviderKeysPage } from './features/settings/provider-keys.page';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Routes = [
  // Public routes
  { path: '', component: HomePage },
  { path: 'register', component: RegisterPage },
  { path: 'login', component: LoginPage },
  
  // Protected routes - require authentication
  { path: 'overview', component: OverviewPage, canActivate: [authGuard] },
  { path: 'runs', component: RunsPage, canActivate: [authGuard] },
  { path: 'runs/:id', component: RunsPage, canActivate: [authGuard] }, // Run detail
  { path: 'policies', component: PoliciesPage, canActivate: [authGuard] },
  { path: 'integrations', component: IntegrationsPage, canActivate: [authGuard] },
  { path: 'projects', component: ProjectsPage, canActivate: [authGuard] },
  { path: 'usage', component: UsagePage, canActivate: [authGuard] },
  { path: 'audit', component: AuditPage, canActivate: [authGuard] },
  { path: 'settings', component: SettingsPage, canActivate: [authGuard] },
  { path: 'settings/security', component: SecuritySettingsPage, canActivate: [authGuard] },
  { path: 'settings/provider-keys', component: ProviderKeysPage, canActivate: [authGuard] },
  { path: 'admin', component: AdminPage, canActivate: [authGuard] },
  { path: 'admin/optimizer-lab', component: OptimizerLabPage, canActivate: [authGuard] },
  
  // Redirect old routes for backward compatibility
  { path: 'savings', redirectTo: '/usage', pathMatch: 'full' },
  { path: 'billing', redirectTo: '/usage', pathMatch: 'full' },
];
