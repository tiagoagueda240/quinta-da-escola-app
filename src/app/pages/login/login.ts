import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

// Material
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  erro = '';
  hidePassword = true;

  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  // private snackBar = inject(MatSnackBar); // Opcional, se quiseres usar Toast em vez de texto vermelho

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  async entrar() {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.erro = '';
    const { email, password } = this.loginForm.value;

    try {
      await this.authService.login(email, password);
      // O redirecionamento agora é feito no Service, ou podes fazer aqui
    } catch (e: any) {
      this.isLoading = false;

      // Tenta ler a mensagem de erro que vem do PHP
      if (e.error && e.error.erro) {
        this.erro = e.error.erro; // Ex: "Credenciais inválidas"
      } else {
        this.erro = 'Erro ao conectar ao servidor.';
      }
      console.error(e);
    }
  }
}