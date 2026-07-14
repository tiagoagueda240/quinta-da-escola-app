import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InscricaoService } from '../../../services/inscricao.service';
import { MonitorService } from '../../../services/monitor.service';

interface Destinatario { nome: string; telefone: string; encontrado: boolean; }

@Component({
    selector: 'app-dialog-gestao-acessos',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
        MatInputModule, MatSelectModule, MatChipsModule, MatTooltipModule,
    ],
    template: `
    <div class="dialog-header">
      <h2 mat-dialog-title style="margin: 0; display: flex; align-items: center; gap: 8px;">
        <mat-icon color="primary">vpn_key</mat-icon> Gestão de Acessos
      </h2>
      <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content class="modern-scroll">
      <div class="toggle-container">
        <div class="view-toggle">
          <button [class.active]="view === 'lista'" (click)="mudarVista('lista')">
            <mat-icon>format_list_bulleted</mat-icon> Todos os Acessos
          </button>
          <button [class.active]="view === 'novo'" (click)="mudarVista('novo')">
            <mat-icon>add_circle_outline</mat-icon> Criar Link
          </button>
        </div>
      </div>

      <div *ngIf="view === 'lista'" class="fade-in">
        <div class="lista-acessos">
          <div class="empty-state" *ngIf="acessosBrutos.length === 0">
            <mat-icon>inbox</mat-icon>
            <p>Nenhum acesso ativo de momento.</p>
          </div>

          <div class="acesso-card" *ngFor="let ac of acessosBrutos" [class.card-expired]="isExpirado(ac.expira_em)">
            <div class="card-main">
              <div class="avatar">{{ ac.nome_coordenador.charAt(0) | uppercase }}</div>
              
              <div class="info" *ngIf="!ac.isEditing">
                <strong>{{ ac.nome_coordenador }}</strong>
                <span class="meta">
                  <mat-icon class="mini-icon">place</mat-icon> {{ formatarLocal(ac.local) }}
                  &bull; Expira a {{ ac.expira_em | date:'dd/MM/yyyy' }}
                </span>
                <div class="turnos-badges">
                  <span class="badge" *ngFor="let t of formatarTurnos(ac.turnos_permitidos)">{{ t }}</span>
                  <span class="badge expired" *ngIf="isExpirado(ac.expira_em)">EXPIRADO</span>
                </div>
              </div>

              <div class="info edit-mode" *ngIf="ac.isEditing" style="display: flex; gap:15px; align-items: center; max-width: 100%;">
                <div style="display: flex; flex-direction: column;">
                  <strong style="color: #666; font-size: 0.85rem;">Coordenadores:</strong>
                  <span>{{ ac.nome_coordenador }}</span>
                </div>
                <mat-form-field appearance="outline" style="flex: 1; margin-bottom: -15px;">
                  <mat-label>Definir Novo PIN</mat-label>
                  <input matInput [(ngModel)]="ac.editPin" placeholder="Mínimo 4 dígitos..." />
                </mat-form-field>
              </div>
            </div>

            <div class="actions">
              <ng-container *ngIf="!ac.isEditing">
                <button mat-icon-button color="primary" matTooltip="Copiar Link" (click)="copiarLink(ac.token)">
                  <mat-icon>content_copy</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Alterar PIN" (click)="iniciarEdicao(ac)">
                  <mat-icon>lock_reset</mat-icon>
                </button>
                <button mat-icon-button color="warn" matTooltip="Eliminar" (click)="apagarAcesso(ac)">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </ng-container>

              <ng-container *ngIf="ac.isEditing">
                <button mat-icon-button color="primary" matTooltip="Guardar Novo PIN" (click)="guardarEdicao(ac)" [disabled]="ac.editPin && ac.editPin.length < 4">
                  <mat-icon>check</mat-icon>
                </button>
                <button mat-icon-button color="warn" matTooltip="Cancelar" (click)="ac.isEditing = false">
                  <mat-icon>close</mat-icon>
                </button>
              </ng-container>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="view === 'novo'" class="fade-in form-area">
        <div *ngIf="!linkGerado">
          
          <div class="form-row flex-gap">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Local</mat-label>
              <mat-select [(ngModel)]="novoLocal" (selectionChange)="atualizarListaTurnos()">
                <mat-option value="quinta">Quinta da Escola</mat-option>
                <mat-option value="costaCaparica">Costa da Caparica</mat-option>
                <mat-option value="quiaios">Quiaios</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Turno</mat-label>
              <mat-select [(ngModel)]="novoTurno" [disabled]="!novoLocal" (selectionChange)="aoMudarTurno()">
                <mat-option *ngFor="let t of listaTurnosAtivos" [value]="t.nome">
                  {{ t.nome }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="alert-box error" *ngIf="jaTemAcessoNesteTurno()">
            <mat-icon>error_outline</mat-icon> Já existe um acesso ativo para este turno. Elimine-o primeiro.
          </div>

          <div *ngIf="novoTurno && !jaTemAcessoNesteTurno()" style="margin-bottom: 20px;">
            <div class="alert-box warning" *ngIf="!novoNome">
              <mat-icon>warning</mat-icon> 
              <div>
                <strong>Coordenadores não definidos!</strong><br/>
                Vá a "Configurar Turnos" no painel principal e adicione os coordenadores a este turno.
              </div>
            </div>

            <div class="info-box" *ngIf="novoNome">
              <mat-icon>verified_user</mat-icon>
              <div>
                <p style="margin:0; font-weight:bold">Coordenadores: {{ novoNome }}</p>
                <small>Importados automaticamente das configurações do turno.</small>
              </div>
            </div>
          </div>

          <div class="pin-preview">
            <span>PIN Automático:</span>
            <strong class="pin-digits">{{ pinAutomatico }}</strong>
            <button mat-icon-button (click)="gerarNovoPin()" matTooltip="Gerar novo PIN">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>
          
          <div style="text-align: right; margin-top: 20px;">
             <button mat-flat-button color="primary" (click)="gerar()" 
                     [disabled]="!novoNome || !novoLocal || !novoTurno || jaTemAcessoNesteTurno()">
               Confirmar e Gerar
             </button>
          </div>
        </div>

        <div *ngIf="linkGerado" class="success-area">
          <div class="success-icon"><mat-icon>check_circle</mat-icon></div>
          <h3>Acesso Criado!</h3>

          <div class="link-box" (click)="copiarLinkTexto(linkGerado)">
            <small>Toque para copiar o link:</small>
            <div class="fake-input">{{ linkGerado | slice: 0 : 40 }}...</div>
            <mat-icon class="copy-icon">content_copy</mat-icon>
          </div>

          <div class="pin-box">PIN: <strong>{{ pinAutomatico }}</strong></div>

          <div class="whatsapp-area">
            <p>Enviar credenciais:</p>
            <div class="destinatario-row" *ngFor="let dest of destinatarios">
              <div class="dest-info">
                <span class="dest-name">{{ dest.nome }}</span>
                <input class="mini-phone-input" [(ngModel)]="dest.telefone" placeholder="Sem nº" [class.missing]="!dest.telefone" />
              </div>
              <button mat-stroked-button color="primary" (click)="enviarWhatsApp(dest)" [disabled]="!dest.telefone || dest.telefone.length < 9">
                <mat-icon>send</mat-icon> WhatsApp
              </button>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
             <button mat-button (click)="resetFormulario()">Criar outro</button>
             <button mat-flat-button color="primary" (click)="mudarVista('lista')">Ver Ativos</button>
          </div>
        </div>
      </div>
    </mat-dialog-content>
  `,
    styles: [`
    .dialog-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .toggle-container { display: flex; justify-content: center; margin-bottom: 20px; }
    .view-toggle { display: inline-flex; background: #f0f2f5; border-radius: 25px; padding: 4px; }
    .view-toggle button { background: transparent; border: none; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-weight: 500; color: #555; display: flex; align-items: center; gap: 6px; transition: all 0.3s; }
    .view-toggle button.active { background: #fff; color: #1976d2; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .flex-gap { display: flex; gap: 15px; }
    .flex-1 { flex: 1; }

    /* ESTILOS DOS CARDS */
    .lista-acessos { display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto; padding-right: 5px; }
    .acesso-card { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; transition: 0.3s; }
    .card-expired { opacity: 0.65; border-color: #ffcdd2; background: #fffcfc; }
    .card-main { display: flex; align-items: center; gap: 12px; flex: 1; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #e3f2fd; color: #1976d2; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem; flex-shrink: 0; }
    .info { display: flex; flex-direction: column; flex: 1; }
    .meta { font-size: 0.8rem; color: #777; display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
    .mini-icon { font-size: 14px; width: 14px; height: 14px; }
    .turnos-badges { display: flex; gap: 5px; flex-wrap: wrap; align-items: center;}
    .badge { background: #f5f5f5; border: 1px solid #ddd; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; color: #555; }
    .badge.expired { background: #ffebee; color: #d32f2f; border-color: #ffcdd2; font-weight: 600; }
    
    .empty-state { text-align: center; padding: 30px; color: #999; }
    .alert-box { padding: 10px; border-radius: 6px; display: flex; align-items: center; gap: 10px; margin-bottom: 15px; font-size: 0.9rem; }
    .alert-box.error { background: #ffebee; color: #c62828; }
    .alert-box.warning { background: #fff3e0; color: #e65100; border: 1px solid #ffe0b2; }
    .info-box { background: #e3f2fd; color: #0d47a1; padding: 10px; border-radius: 6px; display: flex; gap: 10px; align-items: center; font-size: 0.9rem; }

    /* ESTILOS DE CRIAÇÃO */
    .pin-preview { margin-top: 15px; background: #f9fafb; padding: 15px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; border: 1px dashed #ccc; }
    .pin-digits { font-size: 1.6rem; letter-spacing: 5px; color: #333; }
    .success-area { text-align: center; }
    .success-icon mat-icon { font-size: 50px; height: 50px; width: 50px; color: #2e7d32; margin-bottom: 10px; }
    .link-box { background: #fff; border: 1px solid #2196f3; color: #2196f3; padding: 12px; border-radius: 6px; cursor: pointer; text-align: left; position: relative; margin-bottom: 15px; }
    .link-box .fake-input { font-family: monospace; font-weight: bold; }
    .copy-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
    .pin-box { font-size: 1.2rem; background: #fff3e0; display: inline-block; padding: 8px 25px; border-radius: 20px; border: 1px solid #ffe0b2; color: #e65100; margin-bottom: 20px;}
    .whatsapp-area { border-top: 1px solid #eee; padding-top: 15px; text-align: left; }
    .destinatario-row { display: flex; justify-content: space-between; align-items: center; background: #fafafa; border: 1px solid #eee; padding: 8px 10px; border-radius: 6px; margin-bottom: 8px; }
    .dest-info { display: flex; flex-direction: column; gap: 2px; }
    .dest-name { font-weight: 600; font-size: 0.95rem; }
    .mini-phone-input { border: none; background: transparent; border-bottom: 1px solid #ccc; width: 120px; font-size: 0.85rem; color: #333; outline: none; }
    .fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class DialogGestaoAcessosComponent implements OnInit {
    view: 'lista' | 'novo' = 'lista';
    acessosBrutos: any[] = [];
    novoLocal = '';
    novoTurno = '';
    novoNome = ''; // Alimentado APENAS pelas configurações
    listaTurnosAtivos: any[] = [];
    pinAutomatico = '';
    linkGerado = '';
    destinatarios: Destinatario[] = [];

    private inscricaoService = inject(InscricaoService);
    private monitorService = inject(MonitorService);
    private snack = inject(MatSnackBar);

    constructor(@Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit() {
        this.carregarAcessos();
        this.gerarNovoPin();
    }

    mudarVista(novaVista: 'lista' | 'novo') {
        this.view = novaVista;
        if (novaVista === 'lista') this.carregarAcessos();
    }

    // --- LÓGICA DE LISTA E VALIDAÇÃO ---
    carregarAcessos() {
        this.inscricaoService.listarAcessos('', '').subscribe({
            next: (dados) => {
                this.acessosBrutos = dados.map(a => ({
                    ...a,
                    isEditing: false,
                    editPin: ''
                }));
            },
            error: () => this.snack.open('Erro ao carregar acessos', 'OK', { duration: 3000 })
        });
    }

    isExpirado(dataStr: string): boolean {
        return new Date(dataStr) < new Date();
    }

    jaTemAcessoNesteTurno(): boolean {
        if (!this.novoLocal || !this.novoTurno) return false;
        return this.acessosBrutos.some(ac =>
            ac.local === this.novoLocal &&
            this.formatarTurnos(ac.turnos_permitidos).includes(this.novoTurno)
        );
    }

    formatarTurnos(turnosJson: string): string[] {
        try {
            const turnos = JSON.parse(turnosJson);
            return Array.isArray(turnos) ? turnos : [];
        } catch { return []; }
    }

    formatarLocal(l: string): string {
        const mapa: any = { quinta: 'Quinta', costaCaparica: 'Caparica', quiaios: 'Quiaios' };
        return mapa[l] || l;
    }

    copiarLink(token: string) {
        this.copiarLinkTexto(`https://turnos.quintadaescola.com/checkin?token=${token}`);
    }

    copiarLinkTexto(texto: string) {
        navigator.clipboard.writeText(texto);
        this.snack.open('Link copiado!', '', { duration: 2000 });
    }

    // --- LÓGICA DE EDIÇÃO ---
    iniciarEdicao(acesso: any) {
        acesso.isEditing = true;
        acesso.editPin = ''; // Limpa o campo do novo PIN
    }

    async guardarEdicao(acesso: any) {
        if (!acesso.editPin || acesso.editPin.length < 4) {
            this.snack.open('O PIN deve ter pelo menos 4 dígitos.', 'OK', { duration: 3000 });
            return;
        }

        try {
            await this.inscricaoService.editarAcesso({
                id: acesso.id,
                nome: acesso.nome_coordenador, // Envia o nome intocado
                expira_em: acesso.expira_em,
                turnos: JSON.parse(acesso.turnos_permitidos),
                pin: acesso.editPin // Envia o novo PIN
            });
            acesso.isEditing = false;
            this.snack.open('PIN alterado com sucesso!', 'OK', { duration: 2000 });
        } catch (e) {
            this.snack.open('Erro ao guardar alterações.', 'OK', { duration: 3000 });
        }
    }

    async apagarAcesso(acesso: any) {
        if (confirm(`Eliminar permanentemente o acesso de ${acesso.nome_coordenador}?`)) {
            try {
                await this.inscricaoService.apagarAcesso(acesso.id);
                this.snack.open('Acesso eliminado.', 'OK', { duration: 3000 });
                this.carregarAcessos();
            } catch (e) {
                this.snack.open('Erro ao eliminar.', 'OK', { duration: 3000 });
            }
        }
    }

    // --- LÓGICA DE CRIAÇÃO ---
    atualizarListaTurnos() {
        this.novoTurno = '';
        this.novoNome = '';
        if (!this.novoLocal || !this.data.configTurnos) {
            this.listaTurnosAtivos = [];
            return;
        }
        const turnosDoLocal = this.data.configTurnos[this.novoLocal] || [];
        this.listaTurnosAtivos = turnosDoLocal.filter((t: any) => t.ativo === true);
    }

    aoMudarTurno() {
        if (!this.novoTurno) {
            this.novoNome = '';
            return;
        }
        const turnoObj = this.listaTurnosAtivos.find(t => t.nome === this.novoTurno);

        // Verifica se existem coordenadores no array da config
        if (turnoObj?.coordenadores?.length) {
            const nomesValidos = turnoObj.coordenadores.filter((c: string) => c?.trim());
            this.novoNome = nomesValidos.length > 0 ? nomesValidos.join(' & ') : '';
        } else {
            this.novoNome = '';
        }
    }

    resetFormulario() {
        this.novoLocal = '';
        this.novoTurno = '';
        this.novoNome = '';
        this.linkGerado = '';
        this.listaTurnosAtivos = [];
        this.gerarNovoPin();
    }

    gerarNovoPin() {
        this.pinAutomatico = Math.floor(1000 + Math.random() * 9000).toString();
    }

    async gerar() {
        if (this.jaTemAcessoNesteTurno() || !this.novoNome) return;

        try {
            const res = await this.inscricaoService.gerarLinkCoordenador({
                nome: this.novoNome,
                local: this.novoLocal,
                turnos: [this.novoTurno],
                validade_dias: 60,
                pin: this.pinAutomatico,
            });
            this.linkGerado = res.link;
            this.snack.open('Acesso gerado com sucesso!', 'OK', { duration: 2000 });
            await this.prepararDestinatarios();
        } catch (e: any) {
            const msg = e?.error?.erro || 'Erro ao gerar acesso.';
            this.snack.open(msg, 'Fechar', { duration: 4000 });
        }
    }

    async prepararDestinatarios() {
        const nomesRaw = this.novoNome.split('&').map((n) => n.trim()).filter((n) => n);
        if (nomesRaw.length === 0) return;

        try {
            const dadosBD = await this.monitorService.getTelefonesPorNomes(nomesRaw);
            this.destinatarios = nomesRaw.map((nomeProcurado) => {
                const encontrado = dadosBD.find((m: any) =>
                    m.nome.toLowerCase() === nomeProcurado.toLowerCase() ||
                    (m.nomeMonitor && m.nomeMonitor.toLowerCase() === nomeProcurado.toLowerCase())
                );
                return {
                    nome: nomeProcurado,
                    telefone: encontrado ? encontrado.telefone : '',
                    encontrado: !!encontrado,
                };
            });
        } catch (e) {
            this.destinatarios = nomesRaw.map((n) => ({ nome: n, telefone: '', encontrado: false }));
        }
    }

    enviarWhatsApp(dest: Destinatario) {
        if (!dest.telefone) return;
        const msg = `Olá ${dest.nome}! 👋%0A%0AAqui tens o acesso para o Check-in do *${this.novoTurno}*:%0A%0A🔗 Link: ${this.linkGerado}%0A🔐 PIN: *${this.pinAutomatico}*%0A%0ABom trabalho!`;
        const num = dest.telefone.replace(/\s/g, '').replace('+351', '');
        window.open(`https://wa.me/351${num}?text=${msg}`, '_blank');
    }
}