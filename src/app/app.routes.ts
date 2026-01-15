import { Routes } from '@angular/router';

import { canActivate, redirectUnauthorizedTo, redirectLoggedInTo } from '@angular/fire/auth-guard';
import { InscricaoComponent } from './pages/inscricao/inscricao';
import { AdminComponent } from './pages/admin/admin';
import { LoginComponent } from './pages/login/login';
import { CheckinComponent } from './pages/checkin/checkin';
import { GruposComponent } from './pages/grupos/grupos';

// Guardas de Segurança
const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['login']);
const redirectLoggedInToAdmin = () => redirectLoggedInTo(['admin']);

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: 'inscricao', 
    pathMatch: 'full' 
  },
  { 
    path: 'inscricao', 
    component: InscricaoComponent 
  },
  { 
    path: 'login', 
    component: LoginComponent,
    // Se já estiver logado, não deixa ir ao login, manda para admin
    ...canActivate(redirectLoggedInToAdmin) 
  },
  { 
    path: 'admin', 
    component: AdminComponent,
    // Só deixa entrar se estiver autorizado, senão manda para login
    ...canActivate(redirectUnauthorizedToLogin) 
  },

  { path: 'checkin', component: CheckinComponent, ...canActivate(redirectUnauthorizedToLogin)  }, 
  { path: 'grupos', component: GruposComponent, ...canActivate(redirectUnauthorizedToLogin) }, 
];