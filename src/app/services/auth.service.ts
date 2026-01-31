import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, lastValueFrom } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // URL da tua API (caminho relativo para funcionar no subdomínio)
  private apiUrl = 'https://turnos.quintadaescola.com/api/auth.php';
  private recoverUrl = 'https://turnos.quintadaescola.com/api/recover.php';
  private tokenKey = 'auth_token';

  // Para controlar o estado reativamente (útil para menus/sidebars)
  private loggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isLoggedIn$ = this.loggedInSubject.asObservable();

  constructor() { }

  /**
   * Envia Email/Pass para o PHP e recebe o Token
   */
  async login(email: string, pass: string): Promise<any> {
    // 1. Faz o pedido POST à API
    const chamada = this.http.post<any>(this.apiUrl, { email: email, password: pass })
      .pipe(
        tap(res => {
          // 2. Se a API responder com sucesso e token
          if (res && res.token) {
            localStorage.setItem(this.tokenKey, res.token);

            // Opcional: Guardar dados do user (nome, role) se quiseres mostrar na app
            if (res.user) {
              localStorage.setItem('user_data', JSON.stringify(res.user));
            }

            this.loggedInSubject.next(true);
          }
        })
      );

    // Converte Observable em Promise para manter o teu estilo async/await
    const resultado = await lastValueFrom(chamada);

    // 3. Redireciona
    this.router.navigate(['/monitores']); // Ou '/admin' ou onde quiseres ir
    return resultado;
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('user_data');
    this.loggedInSubject.next(false);
    this.router.navigate(['/login']);
  }

  // Helper para verificar se temos token (sem validar validade)
  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  // Helper público para obter o token (usado pelos outros serviços)
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  async requestPasswordReset(email: string) {
    return await lastValueFrom(
      this.http.post<any>(this.recoverUrl, { email })
    );
  }

  // 2. Definir a nova senha usando o token
  async resetPassword(token: string, password: string) {
    return await lastValueFrom(
      this.http.put<any>(this.recoverUrl, { token, password })
    );
  }
}