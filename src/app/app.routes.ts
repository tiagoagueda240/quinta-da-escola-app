import { Routes } from '@angular/router';

// Componentes
import { InscricaoComponent } from './pages/inscricao/inscricao';
import { AdminComponent } from './pages/admin/admin';
import { LoginComponent } from './pages/login/login';
import { CheckinComponent } from './pages/checkin/checkin';
import { GruposComponent } from './pages/grupos/grupos';
import { MonitoresComponent } from './pages/monitores/monitores';

// Nossos Guardas Personalizados (Removemos os do Firebase)
import { authGuard } from './guards/auth.guard';
import { loginGuard } from './guards/login.guard';
import { ResetPassword } from './pages/reset-password/reset-password';
import { ForgotPassword } from './pages/forgot-password/forgot-password';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'inscricao',
    pathMatch: 'full'
  },
  {
    path: 'inscricao',
    component: InscricaoComponent
    // Esta rota é pública, não precisa de guarda
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [loginGuard] // Se já tiver logado, não deixa entrar aqui e manda para monitores
  },

  // --- ÁREA PROTEGIDA (Requer Login) ---
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [authGuard]
  },
  {
    path: 'checkin',
    component: CheckinComponent,
  },
  {
    path: 'grupos',
    component: GruposComponent,
    canActivate: [authGuard]
  },
  {
    path: 'monitores',
    component: MonitoresComponent,
    canActivate: [authGuard]
  },
  {
    path: 'forgot-password',
    component: ForgotPassword,

  }, {
    path: 'reset-password',
    component: ResetPassword,
  },
];