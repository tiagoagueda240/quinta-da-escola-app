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
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { InscricaoService } from '../services/inscricao.service';
import { TurnoConfig } from '../models/inscricao.model';
import { MonitorService } from '../services/monitor.service';
import { Monitor } from '../models/monitor.model';

@Component({
    selector: 'app-config-turnos',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule,
        MatIconModule, MatInputModule, MatSlideToggleModule, MatTabsModule,
        MatTooltipModule, MatAutocompleteModule
    ],
    template: `
    <h2 mat-dialog-title>⚙️ Configuração de Turnos</h2>
    
    <mat-dialog-content>
      <mat-tab-group animationDuration="0ms">
        <mat-tab *ngFor="let local of locais" [label]="getLabel(local)">
          <div class="turnos-list">
            
            <div class="turno-row header">
              <span style="flex: 2; padding-left: 10px;">Nome do Turno</span>
              <span style="flex: 2; padding-left: 5px;">Coordenadores</span>
              <span style="width: 80px; text-align: center;">Vagas</span> <span style="width: 50px; text-align: center;">Ativo</span>
              <span style="width: 40px;"></span>
            </div>

            <div class="turno-row" *ngFor="let t of config[local]; let i = index">
              
              <mat-form-field appearance="outline" class="compact-input name-input" subscriptSizing="dynamic">
                <input matInput [(ngModel)]="t.nome" placeholder="Nome do Turno">
              </mat-form-field>
              
              <div class="coords-container">
                <div class="coord-item" *ngFor="let coord of t.coordenadores; let j = index; trackBy: trackByIndex">
                  <mat-icon class="tiny-icon">person</mat-icon>
                  
                  <input class="bare-input" 
                         type="text"
                         placeholder="Escreva o nome..."
                         [(ngModel)]="t.coordenadores[j]"
                         [matAutocomplete]="auto"
                         #trigger="matAutocompleteTrigger" 
                         (focus)="trigger.openPanel()" 
                         (click)="trigger.openPanel()">
                  
                  <mat-autocomplete #auto="matAutocomplete">
                    <mat-option *ngFor="let monitor of filtrarMonitores(t.coordenadores[j])" [value]="monitor">
                      {{ monitor }}
                    </mat-option>
                  </mat-autocomplete>

                  <mat-icon class="delete-coord" (click)="removeCoordenador(t, j)">close</mat-icon>
                </div>
                
                <button class="btn-add-coord" (click)="addCoordenador(t)">
                  + Adicionar Coordenador
                </button>
              </div>

              <mat-form-field appearance="outline" class="compact-input limit-input" subscriptSizing="dynamic">
                <input matInput type="number" [(ngModel)]="t.limite" placeholder="80" min="0">
              </mat-form-field>
              
              <div class="toggle-wrapper">
                <mat-slide-toggle [(ngModel)]="t.ativo" color="primary"></mat-slide-toggle>
              </div>
              
              <button mat-icon-button color="warn" (click)="removerTurno(local, i)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>

            <button mat-stroked-button color="primary" class="btn-add" (click)="adicionarTurno(local)">
              <mat-icon>add</mat-icon> Adicionar Novo Turno
            </button>

            <div class="empty-state" *ngIf="config[local]?.length === 0">
               Sem turnos neste local.
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" (click)="guardar()">Guardar Alterações</button>
    </mat-dialog-actions>
  `,
    styles: [`
    h2 { margin-bottom: 0; }
    mat-dialog-content { max-height: 70vh; min-height: 400px; padding-top: 10px; }
    
    .turnos-list { display: flex; flex-direction: column; gap: 15px; padding-top: 15px; padding-bottom: 20px; }
    
    .turno-row { 
      display: flex; align-items: flex-start; gap: 10px; 
      background: #fff; border-bottom: 1px solid #eee; padding-bottom: 10px;
    }
    .turno-row.header { 
      font-weight: 600; color: #666; font-size: 0.75rem; 
      text-transform: uppercase; margin-bottom: 0; border: none; align-items: center;
    }

    .compact-input { font-size: 0.9rem; }
    .name-input { flex: 2; } 
    
    /* CORREÇÃO CSS: Aumentei para 80px e removi setas do input number */
    .limit-input { width: 80px; text-align: center; } 
    .limit-input ::ng-deep input { text-align: center; padding: 0 !important; }
    
    /* Remove as setas de incremento (spinners) no Chrome/Safari/Edge/Firefox */
    .limit-input ::ng-deep input::-webkit-outer-spin-button,
    .limit-input ::ng-deep input::-webkit-inner-spin-button {
      -webkit-appearance: none; margin: 0;
    }
    .limit-input ::ng-deep input[type=number] { -moz-appearance: textfield; }

    .coords-container {
      flex: 2; display: flex; flex-direction: column; gap: 4px;
      border: 1px solid #e0e0e0; border-radius: 4px; padding: 4px;
      background: #fafafa;
    }
    .coord-item {
      display: flex; align-items: center; gap: 5px; background: white;
      border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px;
    }
    
    .bare-input {
      border: none; outline: none; width: 100%; font-size: 0.9rem;
      background: transparent; padding: 5px 0;
    }
    
    .tiny-icon { font-size: 16px; height: 16px; width: 16px; color: #999; }
    .delete-coord { font-size: 16px; height: 16px; width: 16px; color: #ff5252; cursor: pointer; opacity: 0.6; }
    .delete-coord:hover { opacity: 1; }
    
    .btn-add-coord {
      background: none; border: 1px dashed #ccc; cursor: pointer;
      font-size: 0.75rem; color: #1976d2; padding: 4px; border-radius: 4px; width: 100%;
    }
    .btn-add-coord:hover { background: #e3f2fd; border-color: #2196f3; }

    .toggle-wrapper { width: 50px; display: flex; justify-content: center; padding-top: 10px; }
    .btn-add { margin-top: 10px; width: 100%; border-style: dashed; padding: 15px 0; }
    .empty-state { padding: 20px; text-align: center; color: #999; }
  `]
})
export class ConfigTurnosComponent implements OnInit {
    locais = ['quinta', 'costaCaparica', 'quiaios'];
    config: any = { quinta: [], costaCaparica: [], quiaios: [] };
    listaMonitores: string[] = [];
    monitoresCache: Monitor[] = [];

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
                quiaios: this.normalizarDados(dados.quiaios)
            };

            await this.carregarListaMonitores();

        } catch (e) {
            this.snack.open('Erro ao carregar dados', 'Fechar');
        }
    }

    async carregarListaMonitores() {
        try {
            // Trazemos todos os monitores
            const listaObjetos = await this.monitoresService.getMonitoresOtimizados('', 2000);

            // 1. Guardamos os objetos reais para usar no Guardar()
            this.monitoresCache = listaObjetos;

            // 2. Lógica antiga para o Autocomplete (apenas nomes)
            const todosNomes = listaObjetos.map(m => m.nomeMonitor || m.nome);
            this.listaMonitores = [...new Set(todosNomes)]
                .filter(n => n && n.trim() !== '')
                .sort();

        } catch (e) {
            console.error('Erro ao buscar monitores', e);
        }
    }

    // --- CORREÇÃO: Função de pesquisa insensível a acentos ---
    filtrarMonitores(termoAtual: string): string[] {
        if (!termoAtual || typeof termoAtual !== 'string' || termoAtual.trim() === '') {
            return this.listaMonitores;
        }

        // 1. Normaliza o termo de pesquisa (remove acentos e põe minúsculas)
        const filtro = this.normalizarTexto(termoAtual);

        return this.listaMonitores.filter(m => {
            // 2. Normaliza cada nome da lista antes de comparar
            return this.normalizarTexto(m).includes(filtro);
        });
    }

    // Função auxiliar para remover acentos (Águeda -> agueda)
    normalizarTexto(texto: string): string {
        return texto
            .normalize("NFD") // Separa acentos das letras (ex: 'Á' vira 'A' + '´')
            .replace(/[\u0300-\u036f]/g, "") // Remove os acentos
            .toLowerCase(); // Tudo em minúsculas
    }
    // ---------------------------------------------------------

    normalizarDados(lista: any[]): TurnoConfig[] {
        if (!lista) return [];
        return lista.map(item => ({
            ...item,
            limite: item.limite || 80,
            coordenadores: item.coordenadores ||
                ([item.coord1, item.coord2].filter(c => c && c.trim() !== ''))
        }));
    }

    getLabel(key: string) {
        const map: any = { quinta: 'Quinta da Escola', costaCaparica: 'Costa da Caparica', quiaios: 'Quiaios' };
        return map[key] || key;
    }

    adicionarTurno(local: string) {
        this.config[local].push({
            id: Date.now(),
            nome: '',
            ativo: true,
            limite: 80,
            coordenadores: []
        });
    }

    removerTurno(local: string, index: number) {
        if (confirm('Remover turno?')) this.config[local].splice(index, 1);
    }

    addCoordenador(turno: TurnoConfig) {
        if (!turno.coordenadores) turno.coordenadores = [];
        turno.coordenadores.push('');
    }

    removeCoordenador(turno: TurnoConfig, index: number) {
        turno.coordenadores.splice(index, 1);
    }

    trackByIndex(index: number, obj: any): any {
        return index;
    }

    async guardar() {
        this.snack.open('A gravar configurações...', '', { duration: 1000 });

        try {
            // 1. Gravar a Configuração Global (Turnos, Vagas, Nomes dos Coordenadores)
            await this.inscricaoService.saveConfiguracoesTurnos(this.config);

            // 2. SINCRONIZAÇÃO: Atribuir o turno aos monitores que são coordenadores
            const updatesPromessas: Promise<any>[] = [];

            // Percorre todos os locais (quinta, costa, etc.)
            for (const local of this.locais) {
                const turnosDoLocal = this.config[local] || [];

                for (const turno of turnosDoLocal) {
                    if (!turno.coordenadores || turno.coordenadores.length === 0) continue;

                    // Para cada coordenador deste turno...
                    for (const nomeCoord of turno.coordenadores) {
                        if (!nomeCoord) continue;

                        // Procura o monitor na nossa cache (por alcunha ou nome)
                        const monitor = this.encontrarMonitorPorNome(nomeCoord);

                        if (monitor && monitor.id) {
                            // Verifica se ele já tem este turno na lista dele
                            const jaTemTurno = monitor.turnosAtribuidos?.includes(turno.nome);

                            if (!jaTemTurno) {
                                // Se não tem, adicionamos!
                                const turnosAtualizados = [...(monitor.turnosAtribuidos || []), turno.nome];

                                // Atualiza na memória para não repetir
                                monitor.turnosAtribuidos = turnosAtualizados;

                                // Prepara o pedido à API
                                updatesPromessas.push(
                                    this.monitoresService.updateMonitor(monitor.id, {
                                        turnosAtribuidos: turnosAtualizados
                                    })
                                );
                            }
                        }
                    }
                }
            }

            // Executa todas as atualizações de monitores em paralelo
            if (updatesPromessas.length > 0) {
                await Promise.all(updatesPromessas);
                console.log(`${updatesPromessas.length} monitores atualizados com novos turnos.`);
            }

            this.dialogRef.close(true);
            this.snack.open('Configurações e Monitores atualizados!', 'OK', { duration: 3000 });

        } catch (e) {
            console.error(e);
            this.snack.open('Erro ao gravar.', 'Fechar');
        }
    }

    // Helper para achar o monitor no array
    private encontrarMonitorPorNome(nomeProcurado: string): Monitor | undefined {
        const termo = nomeProcurado.toLowerCase().trim();
        return this.monitoresCache.find(m =>
            (m.nomeMonitor && m.nomeMonitor.toLowerCase().trim() === termo) ||
            (m.nome && m.nome.toLowerCase().trim() === termo)
        );
    }
}