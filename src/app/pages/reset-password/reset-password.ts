import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, MatInputModule, MatButtonModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  token = '';
  tokenValido = false;
  loading = false;

  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    this.tokenValido = /^[0-9a-f]{64}$/.test(this.token);
  }

  async alterar() {
    this.loading = true;
    try {
      await this.auth.resetPassword(this.token, this.password);
      this.snack.open('Senha alterada! Faça login.', 'OK', { duration: 5000 });
      this.router.navigate(['/login']);
    } catch (e) {
      this.snack.open('Link expirado ou inválido.', 'Fechar');
    } finally {
      this.loading = false;
    }
  }
}
