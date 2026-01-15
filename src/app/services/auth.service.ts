import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Injeta o Auth corretamente
  private auth: Auth = inject(Auth);
  private router = inject(Router);
  
  // O truque: user$ deve ser um Observable derivado do auth injetado
  readonly user$: Observable<User | null> = user(this.auth);

  constructor() {}

  // Login
  login(email: string, pass: string) {
    return signInWithEmailAndPassword(this.auth, email, pass)
      .then(() => {
        this.router.navigate(['/admin']);
      })
      .catch(erro => {
        throw erro;
      });
  }

  // Logout
  logout() {
    return signOut(this.auth).then(() => {
      this.router.navigate(['/login']);
    });
  }
}