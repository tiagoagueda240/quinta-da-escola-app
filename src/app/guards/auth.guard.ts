import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service'; // Ajusta o caminho se necessário

export const authGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Verifica se temos token (usando o método que criámos no AuthService)
    if (authService.getToken()) {
        return true; // Deixa passar
    }

    // Se não tiver token, redireciona para o login
    return router.createUrlTree(['/login']);
};