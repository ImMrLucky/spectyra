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

export const appRoutes: Routes = [
  { path: '', redirectTo: '/scenarios', pathMatch: 'full' },
  { path: 'register', component: RegisterPage },
  { path: 'login', component: LoginPage },
  { path: 'scenarios', component: ScenariosPage },
  { path: 'scenarios/:id/run', component: RunPage },
  { path: 'runs', component: RunsPage },
  { path: 'savings', component: SavingsPage },
  { path: 'proof', component: ProofPage },
  { path: 'settings', component: SettingsPage },
  { path: 'connections', component: ConnectionsPage },
  { path: 'integrations', component: IntegrationsPage },
  { path: 'projects', component: ProjectsPage },
  { path: 'billing', component: BillingPage },
];
