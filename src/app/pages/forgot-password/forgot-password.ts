import { Component, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule, MatInputModule, MatButtonModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  email = '';
  loading = false;
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);

  async enviar() {
    this.loading = true;
    try {
      await this.auth.requestPasswordReset(this.email);
      this.snack.open('Se o email existir, verifique a sua caixa de entrada!', 'OK', { duration: 5000 });
    } catch (e) {
      this.snack.open('Erro ao enviar email.', 'Fechar');
    } finally {
      this.loading = false;
    }
  }
}
