import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';

// Suppress Supabase LockManager warnings (they're harmless browser API warnings)
// These occur when multiple tabs try to access the same storage lock simultaneously
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  let lockManagerWarningCount = 0;
  
  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    // Suppress LockManager warnings (non-critical, can be ignored)
    if (message.includes('LockManager') || message.includes('lock:sb-')) {
      lockManagerWarningCount++;
      // Only log once per session to avoid spam
      if (lockManagerWarningCount === 1) {
        console.debug('[supabase] LockManager warning suppressed (non-critical, can be ignored)');
      }
      return;
    }
    originalWarn.apply(console, args);
  };
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideAnimations(),
  ],
}).catch(err => console.error(err));
