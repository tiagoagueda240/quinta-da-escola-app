import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip'; // Importante
import { InscricaoService } from '../services/inscricao.service';
import { MonitorService } from '../services/monitor.service';


interface Destinatario {
    nome: string;
    telefone: string;
    encontrado: boolean; // Se veio da BD ou não
}

@Component({
    selector: 'app-gerar-acesso',
    standalone: true,
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule,
        MatIconModule, MatInputModule, MatListModule, MatChipsModule, MatTooltipModule
    ],
    template: `
    <h2 mat-dialog-title>🔐 Gerar Acesso: {{ data.turno }}</h2>
    
    <mat-dialog-content>
      
      <div *ngIf="!linkGerado">
        
        <div class="info-box" *ngIf="temCoordenadoresDefinidos">
          <mat-icon>verified_user</mat-icon>
          <div>
            <p style="margin:0; font-weight:bold">Acesso para: {{ nomeSelecionado }}</p>
            <small>Definido nas configurações do turno.</small>
          </div>
        </div>

        <div *ngIf="!temCoordenadoresDefinidos">
            <mat-form-field appearance="outline" style="width: 100%; margin-top: 15px;">
              <mat-label>Nome do(s) Coordenador(es)</mat-label>
              <input matInput [(ngModel)]="nomeSelecionado" placeholder="Ex: João Silva & Ana Santos">
            </mat-form-field>
        </div>

        <div class="pin-preview">
          <span>PIN Automático:</span>
          <strong class="pin-digits">{{ pinAutomatico }}</strong>
          <button mat-icon-button (click)="gerarNovoPin()" matTooltip="Gerar novo PIN">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <div *ngIf="linkGerado" class="success-area">
        <div class="success-icon"><mat-icon>check_circle</mat-icon></div>
        <h3>Acesso Criado!</h3>
        
        <div class="link-box" (click)="copiarLink()">
          <small>Toque para copiar o link:</small>
          <div class="fake-input">{{ linkGerado | slice:0:40 }}...</div>
          <mat-icon class="copy-icon">content_copy</mat-icon>
        </div>

        <div class="pin-box">
          PIN: <strong>{{ pinAutomatico }}</strong>
        </div>

        <div class="whatsapp-area">
          <p>Enviar credenciais:</p>
          
          <div class="destinatario-row" *ngFor="let dest of destinatarios">
            
            <div class="dest-info">
              <span class="dest-name">{{ dest.nome }}</span>
              <input class="mini-phone-input" 
                     [(ngModel)]="dest.telefone" 
                     placeholder="Sem nº"
                     [class.missing]="!dest.telefone">
            </div>

            <button mat-stroked-button color="primary" 
                    (click)="enviarWhatsApp(dest)" 
                    [disabled]="!dest.telefone || dest.telefone.length < 9">
               <mat-icon>send</mat-icon> WhatsApp
            </button>
          </div>

        </div>
      </div>

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fechar</button>
      <button mat-flat-button color="primary" *ngIf="!linkGerado" (click)="gerar()" [disabled]="!nomeSelecionado">
        Confirmar e Gerar
      </button>
    </mat-dialog-actions>
  `,
    styles: [`
    .info-box { 
        background: #e3f2fd; color: #0d47a1; padding: 10px; border-radius: 4px; 
        display: flex; gap: 10px; align-items: center; font-size: 0.9rem; margin-bottom: 10px;
    }
    
    .pin-preview { 
      margin-top: 15px; background: #f5f5f5; padding: 10px 15px; border-radius: 8px; 
      display: flex; align-items: center; justify-content: space-between; border: 1px dashed #ccc;
    }
    .pin-digits { font-size: 1.5rem; letter-spacing: 5px; color: #333; }

    .success-area { text-align: center; animation: fadeIn 0.4s ease; padding-top: 10px; }
    .success-icon mat-icon { font-size: 50px; height: 50px; width: 50px; color: #2e7d32; margin-bottom: 10px; }
    
    .link-box { 
      background: #fff; border: 1px solid #2196f3; color: #2196f3; padding: 10px; 
      border-radius: 6px; cursor: pointer; text-align: left; position: relative;
      margin-bottom: 15px;
    }
    .link-box .fake-input { font-family: monospace; font-weight: bold; overflow: hidden; }
    .copy-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); opacity: 0.6; }

    .pin-box { 
      font-size: 1.2rem; background: #fff3e0; display: inline-block; 
      padding: 8px 25px; border-radius: 20px; border: 1px solid #ffe0b2; color: #e65100;
    }
    
    .whatsapp-area { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; text-align: left; }
    
    /* Estilos da Lista de Destinatários */
    .destinatario-row {
        display: flex; justify-content: space-between; align-items: center;
        background: #f9f9f9; border: 1px solid #eee; padding: 8px 10px;
        border-radius: 6px; margin-bottom: 8px;
    }
    .dest-info { display: flex; flex-direction: column; gap: 2px; }
    .dest-name { font-weight: 600; font-size: 0.95rem; }
    
    .mini-phone-input {
        border: none; background: transparent; border-bottom: 1px solid #ccc;
        width: 100px; font-size: 0.85rem; color: #666;
    }
    .mini-phone-input:focus { outline: none; border-color: #1976d2; color: #000; }
    .mini-phone-input.missing { border-bottom: 1px solid #f44336; background: #ffebee; }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class DialogGerarAcessoComponent implements OnInit {
    nomeSelecionado = '';
    pinAutomatico = '';
    linkGerado = '';

    // Lista inteligente de quem vai receber
    destinatarios: Destinatario[] = [];
    temCoordenadoresDefinidos = false;

    private inscricaoService = inject(InscricaoService);
    private monitorService = inject(MonitorService); // Injetar MonitorService
    private snack = inject(MatSnackBar);

    constructor(@Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit() {
        this.gerarNovoPin();

        if (this.data.nomePredefinido && this.data.nomePredefinido.trim() !== '') {
            this.nomeSelecionado = this.data.nomePredefinido;
            this.temCoordenadoresDefinidos = true;
        } else {
            this.nomeSelecionado = '';
            this.temCoordenadoresDefinidos = false;
        }
    }

    gerarNovoPin() {
        this.pinAutomatico = Math.floor(1000 + Math.random() * 9000).toString();
    }

    async gerar() {
        // 1. Gerar o Link
        const payload = {
            nome: this.nomeSelecionado,
            local: this.data.local,
            turnos: [this.data.turno],
            validade_dias: 60,
            pin: this.pinAutomatico
        };

        try {
            const res = await this.inscricaoService.gerarLinkCoordenador(payload);
            this.linkGerado = res.link;
            this.snack.open('Acesso gerado!', 'OK', { duration: 2000 });

            // 2. Procurar os telemóveis na BD agora que temos sucesso
            await this.prepararDestinatarios();

        } catch (e) {
            console.error(e);
            this.snack.open('Erro ao gerar acesso.', 'Fechar');
        }
    }

    async prepararDestinatarios() {
        // Separa os nomes por "&" (ex: "Pintas & ÁGUEDA" -> ["Pintas", "ÁGUEDA"])
        const nomesRaw = this.nomeSelecionado.split('&').map(n => n.trim()).filter(n => n);

        if (nomesRaw.length === 0) return;

        try {
            // Vai à BD buscar os dados reais
            const dadosBD = await this.monitorService.getTelefonesPorNomes(nomesRaw);

            this.destinatarios = nomesRaw.map(nomeProcurado => {
                // Tenta encontrar correspondência (Case insensitive vindo da BD ou nomeMonitor)
                // A API devolve { nome, nomeMonitor, telefone }
                const encontrado = dadosBD.find((m: any) =>
                    m.nome.toLowerCase() === nomeProcurado.toLowerCase() ||
                    (m.nomeMonitor && m.nomeMonitor.toLowerCase() === nomeProcurado.toLowerCase())
                );

                return {
                    nome: nomeProcurado,
                    // Se encontrou usa o tel da BD, senão fica vazio para o user preencher
                    telefone: encontrado ? encontrado.telefone : '',
                    encontrado: !!encontrado
                };
            });

        } catch (e) {
            console.error("Erro ao buscar telemóveis", e);
            // Fallback: cria a lista mas sem números
            this.destinatarios = nomesRaw.map(n => ({ nome: n, telefone: '', encontrado: false }));
        }
    }

    copiarLink() {
        navigator.clipboard.writeText(this.linkGerado);
        this.snack.open('Link copiado!', '', { duration: 1500 });
    }

    enviarWhatsApp(dest: Destinatario) {
        if (!dest.telefone) return;

        const saudacao = `Olá ${dest.nome}! 👋`;
        const msg = `${saudacao}%0A%0AAqui tens o acesso para o Check-in do *${this.data.turno}*:%0A%0A🔗 Link: ${this.linkGerado}%0A🔐 PIN: *${this.pinAutomatico}*%0A%0ABom trabalho!`;

        const num = dest.telefone.replace(/\s/g, '').replace('+351', '');
        window.open(`https://wa.me/351${num}?text=${msg}`, '_blank');
    }
}