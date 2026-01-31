import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const loginGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Se já tiver token, manda para a área de gestão (Monitores ou Admin)
    if (authService.getToken()) {
        return router.createUrlTree(['/monitores']);
    }

    return true; // Se não tiver logado, deixa ver a página de login
};