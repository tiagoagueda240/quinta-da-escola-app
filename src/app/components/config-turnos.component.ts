import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Material Imports
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TurnoConfig } from '../models/inscricao.model';
import { InscricaoService } from '../services/inscricao.service';

@Component({
    selector: 'app-config-turnos',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule,
        MatIconModule, MatInputModule, MatSlideToggleModule, MatTabsModule,
        MatTooltipModule
    ],
    template: `
    <h2 mat-dialog-title>⚙️ Configuração de Turnos</h2>
    
    <mat-dialog-content>
      <mat-tab-group animationDuration="0ms" dynamicHeight>
        
        <mat-tab label="Quinta da Escola">
          <ng-container *ngTemplateOutlet="listaEditor; context: { $implicit: 'quinta' }"></ng-container>
        </mat-tab>

        <mat-tab label="Costa da Caparica">
          <ng-container *ngTemplateOutlet="listaEditor; context: { $implicit: 'costaCaparica' }"></ng-container>
        </mat-tab>

        <mat-tab label="Quiaios">
          <ng-container *ngTemplateOutlet="listaEditor; context: { $implicit: 'quiaios' }"></ng-container>
        </mat-tab>

      </mat-tab-group>

      <ng-template #listaEditor let-local>
        <div class="turnos-list">
          
          <div class="turno-row header">
            <span style="flex: 1; padding-left: 10px;">Nome do Turno</span>
            <span style="width: 70px; text-align: center;">Vagas</span>
            <span style="width: 50px; text-align: center;">Ativo</span>
            <span style="width: 40px;"></span>
          </div>

          <div class="turno-row" *ngFor="let t of config[local]; let i = index">
            
            <mat-form-field appearance="outline" class="compact-input name-input" subscriptSizing="dynamic">
              <input matInput [(ngModel)]="t.nome" placeholder="Ex: 1º Turno - Páscoa">
            </mat-form-field>
            
            <mat-form-field appearance="outline" class="compact-input limit-input" subscriptSizing="dynamic">
              <input matInput type="number" [(ngModel)]="t.limite" placeholder="80" min="0">
            </mat-form-field>
            
            <div class="toggle-wrapper">
              <mat-slide-toggle [(ngModel)]="t.ativo" color="primary" 
                [matTooltip]="t.ativo ? 'Turno visível nas inscrições' : 'Turno oculto (arquivado)'">
              </mat-slide-toggle>
            </div>
            
            <button mat-icon-button color="warn" (click)="removerTurno(local, i)" matTooltip="Apagar Turno">
              <mat-icon>delete</mat-icon>
            </button>
          </div>

          <div class="empty-state" *ngIf="config[local]?.length === 0">
            <mat-icon>calendar_today</mat-icon>
            <p>Nenhum turno configurado para este local.</p>
          </div>

          <button mat-stroked-button color="primary" class="btn-add" (click)="adicionarTurno(local)">
            <mat-icon>add</mat-icon> Adicionar Novo Turno
          </button>
        </div>
      </ng-template>

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" (click)="guardar()">Guardar Alterações</button>
    </mat-dialog-actions>
  `,
    styles: [`
    h2 { margin-bottom: 0; }
    
    /* --- CORREÇÃO DO SCROLLBAR --- */
    mat-dialog-content { 
      /* Define uma altura máxima de 65% da altura do ecrã */
      max-height: 65vh; 
      /* Força o scroll a acontecer apenas aqui dentro se passar a altura */
      overflow-y: auto;
      padding-top: 10px;
    }
    /* ----------------------------- */
    
    .turnos-list { 
      display: flex; 
      flex-direction: column; 
      gap: 12px; /* Aumentei um pouco o espaço entre linhas */
      padding-top: 15px; 
      padding-bottom: 10px;
    }
    
    .turno-row { display: flex; align-items: center; gap: 8px; }
    .turno-row.header { 
      font-weight: 600; color: #666; font-size: 0.75rem; 
      text-transform: uppercase; margin-bottom: 5px; 
    }

    /* Estilos dos Campos */
    .compact-input { font-size: 0.9rem; }
    .name-input { flex: 1; } 
    .limit-input { width: 80px; text-align: center; } 
    
    /* Centralizar texto do input de limite */
    .limit-input ::ng-deep input { text-align: center; }

    .toggle-wrapper { width: 50px; display: flex; justify-content: center; }

    .btn-add { margin-top: 15px; width: 100%; border-style: dashed; padding: 15px 0; color: #1976d2; }
    
    .empty-state { 
      text-align: center; color: #999; padding: 30px; 
      background: #f5f5f5; border-radius: 8px; margin-top: 10px;
    }
    .empty-state mat-icon { font-size: 40px; height: 40px; width: 40px; margin-bottom: 10px; opacity: 0.5; }
  `]
})
export class ConfigTurnosComponent implements OnInit {
    config: any = { quinta: [], costaCaparica: [], quiaios: [] };

    private inscricaoService = inject(InscricaoService);
    private dialogRef = inject(MatDialogRef<ConfigTurnosComponent>);
    private snack = inject(MatSnackBar);

    async ngOnInit() {
        try {
            const dados = await this.inscricaoService.getConfiguracoesTurnos();
            this.config = {
                quinta: this.normalizarDados(dados.quinta),
                costaCaparica: this.normalizarDados(dados.costaCaparica),
                quiaios: this.normalizarDados(dados.quiaios)
            };
        } catch (e) {
            console.error(e);
            this.snack.open('Erro ao carregar configurações', 'Fechar');
        }
    }

    normalizarDados(lista: any[]): TurnoConfig[] {
        if (!lista) return [];
        return lista.map(item => ({
            ...item,
            limite: item.limite || 80 // Valor default 80
        }));
    }

    adicionarTurno(local: string) {
        this.config[local].push({
            id: Date.now(),
            nome: '',
            ativo: true,
            limite: 80
        });
    }

    removerTurno(local: string, index: number) {
        if (confirm('Tem a certeza que quer remover este turno?')) {
            this.config[local].splice(index, 1);
        }
    }

    async guardar() {
        // Validação
        const temVazios = Object.values(this.config).some((lista: any) =>
            lista.some((t: any) => !t.nome || t.nome.trim() === '')
        );

        if (temVazios) {
            this.snack.open('Existem turnos sem nome. Preencha ou remova-os.', 'OK', { duration: 4000 });
            return;
        }

        try {
            await this.inscricaoService.saveConfiguracoesTurnos(this.config);
            this.dialogRef.close(true);
        } catch (e) {
            this.snack.open('Erro ao gravar.', 'Fechar');
        }
    }
}