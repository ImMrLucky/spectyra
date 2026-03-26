import { Routes } from '@angular/router';
import { environment } from '../environments/environment';
import { webRoutes } from './app.routes.web';
import { desktopRoutes } from './app.routes.desktop';

export const appRoutes: Routes = environment.isDesktop ? desktopRoutes : webRoutes;
