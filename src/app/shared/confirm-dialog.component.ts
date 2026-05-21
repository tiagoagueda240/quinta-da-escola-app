import { Component, inject, Injectable } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';

export interface ConfirmDialogData {
  mensagem: string;
  titulo?: string;
  confirmar?: string;
  cor?: 'primary' | 'warn' | 'accent';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo ?? 'Confirmar' }}</h2>
    <mat-dialog-content>
      <p style="margin: 0; padding: 8px 0;">{{ data.mensagem }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button [color]="data.cor ?? 'primary'" [mat-dialog-close]="true">
        {{ data.confirmar ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(MatDialog);

  confirmar(mensagem: string, options: Omit<ConfirmDialogData, 'mensagem'> = {}): Promise<boolean> {
    return lastValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, { width: '360px', data: { mensagem, ...options } })
        .afterClosed(),
    ).then((result) => !!result);
  }
}
