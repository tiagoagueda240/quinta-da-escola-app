import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

// Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatInputModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      password: ['', Validators.required],
    });
  }

  async entrar() {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.erro = '';
    const { email, password } = this.loginForm.value;

    try {
      await this.authService.login(email, password);
    } catch (e: any) {
      if (e.error && e.error.erro) {
        this.erro = e.error.erro;
      } else {
        this.erro = 'Erro ao conectar ao servidor.';
      }
    } finally {
      this.isLoading = false;
    }
  }
}
