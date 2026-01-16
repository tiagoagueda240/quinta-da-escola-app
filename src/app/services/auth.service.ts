import { Injectable, inject } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  // --- A CORREÇÃO MÁGICA ---
  // Em vez de usar BehaviorSubject manual, usamos o estado real do Firebase.
  // Se existir um 'user', retorna true. Se for null, retorna false.
  public isLoggedIn$: Observable<boolean> = authState(this.auth).pipe(
    map(user => !!user)
  );

  // Login real com Firebase
  async login(email: string, pass: string) {
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
      this.router.navigate(['/admin']);
    } catch (error) {
      console.error('Erro no login:', error);
      alert('Email ou password errados');
    }
  }

  // Logout real
  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}