import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SuperuserService } from '../api/superuser.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

export const superuserGuard: CanActivateFn = () => {
  if (environment.isDesktop) {
    return of(true);
  }
  const router = inject(Router);
  const superuser = inject(SuperuserService);
  return superuser.refresh().pipe(
    map((r) => {
      if (r.is_superuser) return true;
      router.navigate(['/overview']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/overview']);
      return of(false);
    }),
  );
};
