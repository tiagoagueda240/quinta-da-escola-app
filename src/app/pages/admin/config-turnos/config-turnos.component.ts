import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

// Material Imports
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Monitor } from '../../../models/monitor.model';
import { InscricaoService } from '../../../services/inscricao.service';
import { MonitorService } from '../../../services/monitor.service';
import { LOCAIS_LABELS, LocalKey } from '../../../shared/locais';

@Component({
  selector: 'app-config-turnos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTooltipModule,
    MatAutocompleteModule,
    MatSnackBarModule,
  ],

  template: `
    <h2 mat-dialog-title>⚙️ Configuração de Turnos</h2>

    <mat-dialog-content>
      <mat-tab-group animationDuration="0ms">
        <mat-tab *ngFor="let local of locais" [label]="getLabel(local)">
          <div class="turnos-list">
            <div class="turno-row header">
              <span class="col-nome">Nome do Turno</span>
              <span class="col-coords">Coordenadores</span>
              <span class="col-num">Preço (€)</span>
              <span class="col-num">Vagas</span>
              <span class="col-toggle">Esgotado</span>
              <span class="col-toggle">Ativo</span>
              <span class="col-actions"></span>
            </div>

            <div
              class="turno-row"
              *ngFor="let t of config[local]; let i = index; trackBy: trackByIndex"
            >
              <div class="col-nome">
                <mat-form-field
                  appearance="outline"
                  class="compact-input"
                  subscriptSizing="dynamic"
                >
                  <input matInput [(ngModel)]="t.nome" placeholder="Ex: Turno Páscoa" />
                </mat-form-field>
              </div>

              <div class="col-coords">
                <div class="coords-container">
                  <div
                    class="coord-item"
                    *ngFor="let coord of t.coordenadores; let j = index; trackBy: trackByIndex"
                  >
                    <input
                      class="bare-input"
                      type="text"
                      placeholder="Nome..."
                      [(ngModel)]="t.coordenadores[j]"
                      [matAutocomplete]="auto"
                      #trigger="matAutocompleteTrigger"
                      (focus)="trigger.openPanel()"
                      (click)="trigger.openPanel()"
                    />

                    <mat-autocomplete #auto="matAutocomplete">
                      <mat-option
                        *ngFor="let monitor of filtrarMonitores(t.coordenadores[j])"
                        [value]="monitor"
                      >
                        {{ monitor }}
                      </mat-option>
                    </mat-autocomplete>
                    <mat-icon class="delete-coord" (click)="removeCoordenador(t, j)"
                      >close</mat-icon
                    >
                  </div>
                  <button class="btn-add-coord" (click)="addCoordenador(t)">+ Adicionar</button>
                </div>
              </div>

              <div class="col-num">
                <mat-form-field
                  appearance="outline"
                  class="compact-input"
                  subscriptSizing="dynamic"
                >
                  <input matInput type="number" [(ngModel)]="t.precoBase" placeholder="300" />
                </mat-form-field>
              </div>

              <div class="col-num">
                <mat-form-field
                  appearance="outline"
                  class="compact-input"
                  subscriptSizing="dynamic"
                >
                  <input matInput type="number" [(ngModel)]="t.limite" placeholder="80" />
                </mat-form-field>
              </div>

              <div class="col-toggle" matTooltip="Marcar manualmente como esgotado">
                <mat-slide-toggle [(ngModel)]="t.esgotado" color="warn"></mat-slide-toggle>
              </div>

              <div class="col-toggle">
                <mat-slide-toggle [(ngModel)]="t.ativo" color="primary"></mat-slide-toggle>
              </div>

              <div class="col-actions">
                <button mat-icon-button color="warn" (click)="removerTurno(local, i)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

            <button
              mat-stroked-button
              color="primary"
              class="btn-add"
              (click)="adicionarTurno(local)"
            >
              <mat-icon>add</mat-icon> Adicionar Novo Turno
            </button>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="estaAGravar">Cancelar</button>
      <button mat-flat-button color="primary" (click)="guardar()" [disabled]="estaAGravar">
        {{ estaAGravar ? 'A Gravar...' : 'Guardar Alterações' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 900px;
        max-height: 80vh;
      }
      .turnos-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 15px 0;
      }

      /* Sistema de Colunas Fixo */
      .turno-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
      }
      .header {
        font-weight: bold;
        font-size: 11px;
        color: #666;
        text-transform: uppercase;
        border-bottom: 2px solid #eee;
        padding-bottom: 12px;
      }

      .col-nome {
        flex: 3;
      }
      .col-coords {
        flex: 4;
      }
      .col-num {
        width: 85px;
      } /* Largura fixa para inputs numéricos */

      .col-toggle {
        width: 60px;
        display: flex;
        justify-content: center;
      }
      .col-actions {
        width: 45px;
      }

      .compact-input {
        width: 100%;
        font-size: 13px;
      }
      .compact-input ::ng-deep .mat-mdc-text-field-wrapper {
        padding: 0 8px;
      }

      .coords-container {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 4px;
        background: #fafafa;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .coord-item {
        display: flex;
        align-items: center;
        background: white;
        border: 1px solid #eee;
        border-radius: 3px;
        padding: 2px 6px;
      }
      .bare-input {
        border: none;
        outline: none;
        width: 100%;
        font-size: 12px;
      }
      .delete-coord {
        font-size: 14px;
        width: 14px;
        height: 14px;
        cursor: pointer;
        color: #f44336;
      }
      .btn-add-coord {
        background: none;
        border: 1px dashed #ccc;
        font-size: 10px;
        color: #1976d2;
        cursor: pointer;
        padding: 2px;
      }

      .btn-add {
        margin-top: 20px;
        width: 100%;
        border-style: dashed;
      }
    `,
  ],
})
export class ConfigTurnosComponent implements OnInit {
  locais = ['quinta', 'costaCaparica', 'quiaios'];
  config: any = { quinta: [], costaCaparica: [], quiaios: [] };
  listaMonitores: string[] = [];
  monitoresCache: Monitor[] = [];
  estaAGravar = false;

  private inscricaoService = inject(InscricaoService);
  private monitoresService = inject(MonitorService);
  private dialogRef = inject(MatDialogRef<ConfigTurnosComponent>);
  private snack = inject(MatSnackBar);
  async ngOnInit() {
    try {
      const dados = await this.inscricaoService.getConfiguracoesTurnos();
      this.config = {
        quinta: this.normalizarDados(dados.quinta),
        costaCaparica: this.normalizarDados(dados.costaCaparica),
        quiaios: this.normalizarDados(dados.quiaios),
      };
      await this.carregarListaMonitores();
    } catch (e) {
      this.snack.open('Erro ao carregar dados', 'Fechar', { duration: 3000 });
    }
  }

  async carregarListaMonitores() {
    try {
      const lista = await this.monitoresService.getMonitoresOtimizados('', 2000);
      this.monitoresCache = lista;
      this.listaMonitores = [...new Set(lista.map((m) => m.nomeMonitor || m.nome))].sort();
    } catch (e) {}
  }

  filtrarMonitores(termo: string) {
    if (!termo) return this.listaMonitores.slice(0, 10);
    const f = termo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return this.listaMonitores.filter((m) =>
      m
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(f),
    );
  }

  normalizarDados(lista: any[]): any[] {
    if (!lista) return [];
    return lista.map((item) => ({
      ...item,
      precoBase: item.precoBase || 300,
      limite: item.limite || 80,
      ativo: item.ativo !== undefined ? item.ativo : true,
      coordenadores: item.coordenadores || [],
      esgotado: item.esgotado === true,
    }));
  }

  getLabel(key: string) {
    return LOCAIS_LABELS[key as LocalKey] || key;
  }

  adicionarTurno(local: string) {
    this.config[local].push({
      id: Date.now(),
      nome: '',
      ativo: true,
      esgotado: false,
      limite: 80,
      precoBase: 300,
      coordenadores: [],
    });
  }

  removerTurno(local: string, index: number) {
    if (confirm('Remover turno?')) this.config[local].splice(index, 1);
  }

  addCoordenador(turno: any) {
    if (!turno.coordenadores) turno.coordenadores = [];
    turno.coordenadores.push('');
  }

  removeCoordenador(turno: any, index: number) {
    turno.coordenadores.splice(index, 1);
  }

  trackByIndex(index: number) {
    return index;
  }

  async guardar() {
    this.estaAGravar = true;

    const payload: any = {};
    for (const local of this.locais) {
      payload[local] = this.config[local] || [];
    }

    try {
      await this.inscricaoService.saveConfiguracoesTurnos(payload);
      this.dialogRef.close(true);
      this.snack.open('Configurações guardadas!', 'OK', { duration: 2000 });
    } catch (e) {
      this.snack.open('Erro ao guardar', 'Fechar');
    } finally {
      this.estaAGravar = false;
    }
  }
}
