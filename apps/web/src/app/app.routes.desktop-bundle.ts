import { Routes } from '@angular/router';
import { desktopRoutes } from './app.routes.desktop';

/** Used only when building --configuration desktop so web-only routes are not bundled. */
export const appRoutes: Routes = desktopRoutes;
