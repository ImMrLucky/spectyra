import { Routes } from '@angular/router';
import { ScenariosPage } from './features/scenarios/scenarios.page';
import { RunPage } from './features/run/run.page';
import { RunsPage } from './features/runs/runs.page';
import { SettingsPage } from './features/settings/settings.page';
import { SavingsPage } from './features/savings/savings.page';
import { ProofPage } from './features/proof/proof.page';
import { RegisterPage } from './features/auth/register.page';
import { LoginPage } from './features/auth/login.page';
import { ConnectionsPage } from './features/connections/connections.page';
import { IntegrationsPage } from './features/integrations/integrations.page';
import { ProjectsPage } from './features/projects/projects.page';
import { BillingPage } from './features/billing/billing.page';
import { AdminPage } from './features/admin/admin.page';
import { HomePage } from './features/home/home.page';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Routes = [
  { path: '', component: HomePage },
  { path: 'register', component: RegisterPage },
  { path: 'login', component: LoginPage },
  // Protected routes - require authentication
  { path: 'scenarios', component: ScenariosPage, canActivate: [authGuard] },
  { path: 'scenarios/:id/run', component: RunPage, canActivate: [authGuard] },
  { path: 'runs', component: RunsPage, canActivate: [authGuard] },
  { path: 'savings', component: SavingsPage, canActivate: [authGuard] },
  { path: 'proof', component: ProofPage, canActivate: [authGuard] },
  { path: 'settings', component: SettingsPage, canActivate: [authGuard] },
  { path: 'connections', component: ConnectionsPage, canActivate: [authGuard] },
  { path: 'integrations', component: IntegrationsPage, canActivate: [authGuard] },
  { path: 'projects', component: ProjectsPage, canActivate: [authGuard] },
  { path: 'billing', component: BillingPage, canActivate: [authGuard] },
  { path: 'admin', component: AdminPage, canActivate: [authGuard] },
];
