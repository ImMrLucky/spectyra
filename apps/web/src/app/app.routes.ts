import { Routes } from '@angular/router';
import { ScenariosPage } from './features/scenarios/scenarios.page';
import { RunPage } from './features/run/run.page';
import { RunsPage } from './features/runs/runs.page';
import { SettingsPage } from './features/settings/settings.page';
import { SavingsPage } from './features/savings/savings.page';
import { ProofPage } from './features/proof/proof.page';

export const appRoutes: Routes = [
  { path: '', redirectTo: '/scenarios', pathMatch: 'full' },
  { path: 'scenarios', component: ScenariosPage },
  { path: 'scenarios/:id/run', component: RunPage },
  { path: 'runs', component: RunsPage },
  { path: 'savings', component: SavingsPage },
  { path: 'proof', component: ProofPage },
  { path: 'settings', component: SettingsPage },
];
