import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, MatInputModule, MatButtonModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);

  async enviar() {
    this.loading = true;
    try {
      await this.auth.requestPasswordReset(this.email);
      this.snack.open('Se o email existir, verifique a sua caixa de entrada!', 'OK', {
        duration: 5000,
      });
    } catch (e) {
      this.snack.open('Erro ao enviar email.', 'Fechar');
    } finally {
      this.loading = false;
    }
  }
}
