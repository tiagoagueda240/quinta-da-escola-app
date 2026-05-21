import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { checkinGuard } from './guards/checkin.guard';
import { loginGuard } from './guards/login.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'inscricao',
    pathMatch: 'full',
  },
  {
    path: 'inscricao',
    loadComponent: () => import('./pages/inscricao/inscricao').then((m) => m.InscricaoComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginComponent),
    canActivate: [loginGuard],
  },

  // --- ÁREA PROTEGIDA (Requer Login) ---
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminComponent),
    canActivate: [authGuard],
  },
  {
    path: 'checkin',
    loadComponent: () => import('./pages/checkin/checkin').then((m) => m.CheckinComponent),
    canActivate: [checkinGuard],
  },
  {
    path: 'grupos',
    loadComponent: () => import('./pages/grupos/grupos').then((m) => m.GruposComponent),
    canActivate: [authGuard],
  },
  {
    path: 'monitores',
    loadComponent: () => import('./pages/monitores/monitores').then((m) => m.MonitoresComponent),
    canActivate: [authGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'politica-privacidade',
    loadComponent: () =>
      import('./pages/politica-privacidade/politica-privacidade').then(
        (m) => m.PoliticaPrivacidadeComponent,
      ),
  },
  { path: '**', redirectTo: 'inscricao' },
];
