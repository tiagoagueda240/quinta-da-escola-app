import { Component, OnInit, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InscricaoService } from '../../services/inscricao.service';
import { Inscricao } from '../../models/inscricao.model';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule, MatDialogModule, MatRippleModule
  ],
  templateUrl: './checkin.html',
  styleUrls: ['./checkin.scss']
})
export class CheckinComponent implements OnInit {
  inscricoes: Inscricao[] = [];
  inscricoesFiltradas: Inscricao[] = [];
  pesquisa: string = '';
  totalPresentes = 0;

  listaTurnos = [
    '1º Turno – 28 Junho a 4 Julho', '2º Turno – 5 a 11 Julho', '3º Turno – 12 a 18 Julho',
    '4º Turno – 19 a 25 Julho', '5º Turno – 26 Julho a 1 Agosto', '6º Turno – 2 a 8 Agosto',
    '7º Turno – 9 a 15 Agosto', '8º Turno – 16 a 22 Agosto', '9º Turno – 23 a 29 Agosto',
    '10º Turno – 30 Agosto a 5 Setembro'
  ];
  turnoSelecionado: string = '';

  tempInscricao: Inscricao | null = null;
  tempDinheiro: number | null = null;
  tempNotas: string = '';

  @ViewChild('dialogEntrada') dialogEntrada!: TemplateRef<any>;

  private inscricaoService = inject(InscricaoService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  ngOnInit() {
    this.turnoSelecionado = this.listaTurnos[1];

    this.inscricaoService.getInscricoes().subscribe(dados => {
      this.inscricoes = dados;
      this.filtrar();
    });


  }

  mudarTurno(turno: string) {
    this.turnoSelecionado = turno;
    this.filtrar();
  }

  filtrar() {
    const texto = this.pesquisa.toLowerCase().trim();

    this.inscricoesFiltradas = this.inscricoes.filter(i => {
      const matchTurno = i.turnoEscolhido === this.turnoSelecionado;
      const matchNome = i.participante.nomeCompleto.toLowerCase().includes(texto);
      return matchTurno && matchNome;
    });

    this.atualizarContador();
  }

  abrirCheckin(inscricao: Inscricao) {
    this.tempInscricao = inscricao;
    this.tempDinheiro = null;
    this.tempNotas = '';
    this.dialog.open(this.dialogEntrada, { width: '90%', maxWidth: '350px', panelClass: 'custom-dialog' });
  }

  confirmarEntrada() {
    if (!this.tempInscricao?.id) return;
    const dados = {
      checkin: {
        status: 'dentro',
        dataEntrada: new Date(),
        dinheiroBolso: this.tempDinheiro || 0,
        notasCheckin: this.tempNotas
      }
    };
    this.inscricaoService.updateInscricao(this.tempInscricao.id, dados as any).then(() => {
      this.dialog.closeAll();
    });
  }

  registarSaida(inscricao: Inscricao) {
    if (!inscricao.id || !confirm(`Saída de ${inscricao.participante.nomeCompleto}?`)) return;
    this.inscricaoService.updateInscricao(inscricao.id, { 'checkin.status': 'fora' } as any)
  }

  atualizarContador() {
    this.totalPresentes = this.inscricoesFiltradas.filter(i => i.checkin?.status === 'dentro').length;
  }

  mostrarToast(msg: string) {
    this.snackBar.open(msg, '', { duration: 2500, verticalPosition: 'top', panelClass: 'success-toast' });
  }

  getNomeCurtoTurno(t: string): string {
    return t.split(' – ')[0];
  }
}