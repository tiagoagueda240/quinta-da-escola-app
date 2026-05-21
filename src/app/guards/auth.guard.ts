import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Verifica se o JWT está expirado via o claim `exp`.
 * Não valida a assinatura — essa responsabilidade é do backend.
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true; // Token malformado → tratar como expirado
  }
}

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();

  if (token && !isTokenExpired(token)) {
    return true;
  }

  // Limpar token inválido/expirado e redirecionar para login
  if (token) authService.logout();
  return router.createUrlTree(['/login']);
};
