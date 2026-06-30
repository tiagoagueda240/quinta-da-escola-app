import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

export interface DialogRelatorioTurnoData {
  listaTurnos: string[];
  turnoInicial?: string;
}

export interface DialogRelatorioTurnoResult {
  turno: string;
}

@Component({
  selector: 'app-dialog-relatorio-turno',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Gerar Relatório</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width: 100%">
        <mat-label>Selecione o Turno</mat-label>
        <mat-select [(ngModel)]="turnoSelecionado">
          <mat-option *ngFor="let t of data.listaTurnos" [value]="t">{{ t }}</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="!turnoSelecionado" (click)="confirmar()">
        Gerar PDF
      </button>
    </mat-dialog-actions>
  `,
})
export class DialogRelatorioTurnoComponent {
  data = inject<DialogRelatorioTurnoData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<DialogRelatorioTurnoComponent>);

  turnoSelecionado: string = this.data.turnoInicial || '';

  confirmar() {
    this.dialogRef.close({ turno: this.turnoSelecionado } as DialogRelatorioTurnoResult);
  }
}
