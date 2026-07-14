import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-novo-jogo-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule
    ],
    template: `
    <div class="dialog-container">
      <header class="dialog-header">
        <div class="icon-title">
          <mat-icon class="header-icon">sports_esports</mat-icon>
          <h2>Nova Atividade</h2>
        </div>
        <button mat-icon-button (click)="fechar()" class="btn-close">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <div mat-dialog-content class="dialog-content">
        <p class="dialog-description">
          Insira o nome do novo jogo ou atividade para adicionar uma nova coluna ao seu painel de pontuações.
        </p>
        
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome da Atividade</mat-label>
          <input 
            matInput 
            [(ngModel)]="nomeJogo" 
            placeholder="Ex: Torneio de Padel, Caça ao Tesouro..." 
            (keyup.enter)="salvar()"
            class="input-clean"
            autocomplete="off"
            cdkFocusInitial
          />
          <mat-icon matSuffix class="input-suffix-icon">edit</mat-icon>
        </mat-form-field>
      </div>

      <footer mat-dialog-actions class="dialog-actions">
        <button mat-button (click)="fechar()" class="btn-cancel">Cancelar</button>
        <button 
          mat-flat-button 
          (click)="salvar()" 
          [disabled]="!nomeJogo.trim()" 
          class="btn-save"
        >
          Adicionar Coluna
        </button>
      </footer>
    </div>
  `,
    styles: [`
    .dialog-container {
      padding: 12px;
      font-family: 'Inter', sans-serif;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .icon-title {
        display: flex;
        align-items: center;
        gap: 10px;
        
        .header-icon {
          color: #d97706; /* Ouro */
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        h2 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
      }

      .btn-close {
        color: #94a3b8;
        &:hover { color: #475569; }
      }
    }

    .dialog-content {
      margin-bottom: 24px;
      padding: 0 !important;

      .dialog-description {
        margin: 0 0 16px 0;
        font-size: 0.85rem;
        color: #64748b;
        line-height: 1.5;
      }

      .full-width {
        width: 100%;
      }

      .input-suffix-icon {
        color: #94a3b8;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 0 !important;
      margin: 0;

      button {
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.875rem;
        height: 38px;
      }

      .btn-cancel {
        color: #64748b;
        &:hover { background: #f1f5f9; }
      }

      .btn-save {
        background-color: #0f172a;
        color: #ffffff;
        
        &:disabled {
          background-color: #e2e8f0;
          color: #94a3b8;
        }

        &:not(:disabled):hover {
          background-color: #1e293b;
        }
      }
    }
  `]
})
export class NovoJogoDialogComponent {
    private dialogRef = inject(MatDialogRef<NovoJogoDialogComponent>);
    nomeJogo: string = '';

    fechar() {
        this.dialogRef.close();
    }

    salvar() {
        if (this.nomeJogo.trim()) {
            this.dialogRef.close(this.nomeJogo.trim());
        }
    }
}