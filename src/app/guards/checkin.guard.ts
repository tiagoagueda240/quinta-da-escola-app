import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const checkinGuard = (route: ActivatedRouteSnapshot) => {
  if (route.queryParamMap.get('token')) return true; // coordenador com link
  if (inject(AuthService).getToken()) return true; // admin autenticado
  return inject(Router).createUrlTree(['/login']);
};
