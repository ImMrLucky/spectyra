import { Routes } from '@angular/router';
import { desktopProRoutes } from './app.routes.desktop-pro';

/** Used only when building --configuration desktop-pro so OpenClaw-only routes are not bundled. */
export const appRoutes: Routes = desktopProRoutes;
