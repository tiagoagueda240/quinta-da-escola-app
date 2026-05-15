import { Routes } from '@angular/router';

// Componentes
import { AdminComponent } from './pages/admin/admin';
import { CheckinComponent } from './pages/checkin/checkin';
import { GruposComponent } from './pages/grupos/grupos';
import { InscricaoComponent } from './pages/inscricao/inscricao';
import { LoginComponent } from './pages/login/login';
import { MonitoresComponent } from './pages/monitores/monitores';

import { authGuard } from './guards/auth.guard';
import { checkinGuard } from './guards/checkin.guard';
import { loginGuard } from './guards/login.guard';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { ResetPassword } from './pages/reset-password/reset-password';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'inscricao',
    pathMatch: 'full',
  },
  {
    path: 'inscricao',
    component: InscricaoComponent,
    // Esta rota é pública, não precisa de guarda
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [loginGuard], // Se já tiver logado, não deixa entrar aqui e manda para monitores
  },

  // --- ÁREA PROTEGIDA (Requer Login) ---
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [authGuard],
  },
  {
    path: 'checkin',
    component: CheckinComponent,
    canActivate: [checkinGuard],
  },
  {
    path: 'grupos',
    component: GruposComponent,
    canActivate: [authGuard],
  },
  {
    path: 'monitores',
    component: MonitoresComponent,
    canActivate: [authGuard],
  },
  {
    path: 'forgot-password',
    component: ForgotPassword,
  },
  {
    path: 'reset-password',
    component: ResetPassword,
  },
];
