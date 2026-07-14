import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { from, Observable } from 'rxjs';
import {
  DialogRelatorioTurnoComponent,
  DialogRelatorioTurnoResult,
} from '../../components/dialog-relatorio-turno/dialog-relatorio-turno.component';
import { Inscricao } from '../../models/inscricao.model';
import { AuthService } from '../../services/auth.service';
import { InscricaoService } from '../../services/inscricao.service';

// Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LOCAIS_LABELS, LocalKey } from '../../shared/locais';
import { gerarPDFCozinha, gerarPDFTransporte } from '../../shared/pdf-reports';

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatDialogModule,
    MatRippleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatSelectModule,
  ],
  templateUrl: './checkin.html',
  styleUrls: ['./checkin.scss'],
})
export class CheckinComponent implements OnInit {
  // Dados
  inscricoes: Inscricao[] = [];
  inscricoesFiltradas: Inscricao[] = [];
  pesquisa: string = '';
  totalPresentes = 0;
  listaTurnos: string[] = [];
  turnoSelecionado: string = '';
  filtroLocal: LocalKey = 'quinta';
  locaisDisponiveis: LocalKey[] = [];
  readonly LOCAIS_LABELS = LOCAIS_LABELS;
  private turnosPorLocal: Partial<Record<LocalKey, string[]>> = {};

  // Variáveis Temporárias (Dialog)
  tempInscricao: Inscricao | null = null;
  tempDinheiro: number | null = null;
  tempNotas: string = '';

  // --- CONTROLO DE ACESSO ---
  loading = true;
  modoLink = false; // true = Coordenador, false = Admin
  token: string | null = null;
  pinValidado = false;
  pinInput = '';
  erroPin = '';

  private pinSessao = '';

  @ViewChild('dialogEntrada') dialogEntrada!: TemplateRef<any>;

  // Relatórios
  acaoDialog: 'cozinha' | 'transporte' = 'cozinha';

  private inscricaoService = inject(InscricaoService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  async ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (this.token) {
      this.modoLink = true;
      const pinSalvo = sessionStorage.getItem('access_pin_' + this.token);
      if (pinSalvo) {
        this.pinInput = pinSalvo;
        this.validarPin();
      } else {
        this.loading = false;
      }
    } else {
      if (this.authService.getToken()) {
        this.modoLink = false;
        this.pinValidado = true;
        await this.carregarDadosAdmin();
      } else {
        this.router.navigate(['/login']);
      }
    }
  }

  validarPin() {
    if (this.pinInput.length < 4) return;
    this.erroPin = '';
    this.loading = true;

    this.inscricaoService.getInscricoesComTokenEPin(this.token!, this.pinInput).subscribe({
      next: (dados) => {
        this.pinValidado = true;
        this.pinSessao = this.pinInput;
        sessionStorage.setItem('access_pin_' + this.token, this.pinSessao);
        this.processarDadosRecebidos(dados);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.pinValidado = false;
        this.erroPin = 'PIN incorreto.';
        sessionStorage.removeItem('access_pin_' + this.token);
      },
    });
  }

  async carregarDadosAdmin() {
    this.loading = true;
    try {
      const config = await this.inscricaoService.getConfiguracoesTurnos();
      const locais: LocalKey[] = ['quinta', 'costaCaparica', 'quiaios'];

      this.turnosPorLocal = {};
      this.locaisDisponiveis = [];

      for (const local of locais) {
        const turnos = (config[local] || [])
          .filter((t: any) => t.ativo === true)
          .map((t: any) => t.nome as string);
        if (turnos.length > 0) {
          this.turnosPorLocal[local] = turnos;
          this.locaisDisponiveis.push(local);
        }
      }

      if (this.locaisDisponiveis.length > 0) {
        this.filtroLocal = this.locaisDisponiveis[0];
        this.listaTurnos = this.turnosPorLocal[this.filtroLocal] || [];
      }

      this.inscricaoService.getInscricoes().subscribe({
        next: (dados) => {
          this.processarDadosRecebidos(dados);
          this.loading = false;
        },
        error: () => {
          this.mostrarToast('Erro ao carregar dados.');
          this.loading = false;
        },
      });
    } catch (e) {
      console.error('Erro config', e);
      this.loading = false;
    }
  }

  processarDadosRecebidos(dados: Inscricao[]) {
    this.inscricoes = dados.map((i) => {
      if (!i.checkin)
        i.checkin = {
          status: 'fora',
          dinheiroBolso: 0,
          notasCheckin: '',
          dataEntrada: new Date(0),
        };
      return i;
    });

    if (this.modoLink) {
      const turnosUnicos = [...new Set(dados.map((i) => i.turnoEscolhido))];
      this.listaTurnos = turnosUnicos.sort();

      if (dados.length > 0) {
        const localRaw = (dados[0].local || '').toLowerCase();
        if (localRaw.includes('caparica')) this.filtroLocal = 'costaCaparica';
        else if (localRaw.includes('quiaios')) this.filtroLocal = 'quiaios';
        else this.filtroLocal = 'quinta';
      }
    }

    if (this.listaTurnos.length > 0) {
      if (!this.turnoSelecionado || !this.listaTurnos.includes(this.turnoSelecionado)) {
        this.turnoSelecionado = this.listaTurnos[0];
      }
      this.filtrar();
    } else {
      this.inscricoesFiltradas = this.inscricoes;
      this.atualizarContador();
    }
  }

  mudarLocal(local: LocalKey) {
    this.filtroLocal = local;
    this.listaTurnos = this.turnosPorLocal[local] || [];
    this.turnoSelecionado = this.listaTurnos[0] || '';
    this.filtrar();
  }

  mudarTurno(turno: string) {
    this.turnoSelecionado = turno;
    this.filtrar();
  }

  filtrar() {
    const texto = this.pesquisa.toLowerCase().trim();

    // 1. Filtra por turno e por nome
    let filtradas = this.inscricoes.filter((i) => {
      const matchTurno = this.turnoSelecionado ? i.turnoEscolhido === this.turnoSelecionado : true;
      const matchNome = i.participante.nomeCompleto.toLowerCase().includes(texto);
      return matchTurno && matchNome;
    });

    // 2. Ordena: "A aguardar" (fora) no topo, "Dentro" em baixo
    this.inscricoesFiltradas = filtradas.sort((a, b) => {
      const statusA = a.checkin?.status === 'dentro' ? 1 : 0;
      const statusB = b.checkin?.status === 'dentro' ? 1 : 0;
      return statusA - statusB; // 0 vem antes de 1 (fora primeiro, dentro depois)
    });

    this.atualizarContador();
  }

  atualizarContador() {
    this.totalPresentes = this.inscricoesFiltradas.filter(
      (i) => i.checkin?.status === 'dentro',
    ).length;
  }

  abrirCheckin(inscricao: Inscricao) {
    this.tempInscricao = inscricao;
    this.tempDinheiro = null;
    this.tempNotas = '';
    this.dialog.open(this.dialogEntrada, { width: '90%', maxWidth: '350px' });
  }

  confirmarEntrada() {
    const inscricaoAlvo = this.tempInscricao;
    if (!inscricaoAlvo || !inscricaoAlvo.id) return;
    const idSeguro = inscricaoAlvo.id;

    const novoCheckin = {
      status: 'dentro',
      dataEntrada: new Date(),
      dinheiroBolso: this.tempDinheiro || 0,
      notasCheckin: this.tempNotas,
    };

    const payload: any = {
      id: idSeguro,
      checkin: novoCheckin,
    };

    if (this.tempNotas.trim()) {
      const novasObs =
        (inscricaoAlvo.observacoes ? inscricaoAlvo.observacoes + '\n' : '') + this.tempNotas.trim();
      payload.observacoes = novasObs;
      inscricaoAlvo.observacoes = novasObs;
    }

    let observable$: Observable<any>;

    if (this.modoLink) {
      observable$ = this.inscricaoService.updateCheckinComToken(
        payload,
        this.token!,
        this.pinSessao,
      );
    } else {
      observable$ = from(this.inscricaoService.updateInscricaoBatch([payload]));
    }

    observable$.subscribe({
      next: () => {
        if (!inscricaoAlvo.checkin) {
          inscricaoAlvo.checkin = {
            status: 'dentro',
            dataEntrada: new Date(),
            dinheiroBolso: 0,
            notasCheckin: '',
          };
        }
        Object.assign(inscricaoAlvo.checkin, novoCheckin);

        this.atualizarContador();
        this.dialog.closeAll();
        this.mostrarToast(`Bem-vindo(a) ${inscricaoAlvo.participante.nomeCompleto.split(' ')[0]}!`);
      },
      error: (err: any) => {
        console.error(err);
        this.mostrarToast('Erro ao registar entrada.');
      },
    });
  }

  registarSaida(inscricao: Inscricao) {
    if (!inscricao.id) return;
    const idSeguro = inscricao.id;

    if (!confirm(`Confirmar saída de ${inscricao.participante.nomeCompleto}?`)) return;

    const payload = {
      id: idSeguro,
      checkin: {
        ...(inscricao.checkin || {}),
        status: 'fora',
        dataSaida: new Date(),
      },
    };

    let observable$: Observable<any>;
    if (this.modoLink) {
      observable$ = this.inscricaoService.updateCheckinComToken(
        payload,
        this.token!,
        this.pinSessao,
      );
    } else {
      observable$ = from(this.inscricaoService.updateInscricaoBatch([payload]));
    }

    observable$.subscribe({
      next: () => {
        if (inscricao.checkin) inscricao.checkin.status = 'fora';
        this.atualizarContador();
        this.mostrarToast('Saída registada.');
      },
      error: () => this.mostrarToast('Erro ao registar saída.'),
    });
  }

  mostrarToast(msg: string) {
    this.snackBar.open(msg, '', { duration: 2500, verticalPosition: 'top' });
  }

  getNomeCurtoTurno(t: string): string {
    if (!t) return '';
    return t.split(' – ')[0].split('-')[0];
  }

  // --- NAVEGAÇÃO ---
  irParaGrupos() {
    this.router.navigate(['/grupos'], { queryParams: this.modoLink ? { token: this.token } : {} });
  }

  // --- RELATÓRIOS ---
  abrirRelatorio(acao: 'cozinha' | 'transporte') {
    this.acaoDialog = acao;
    const dialogRef = this.dialog.open(DialogRelatorioTurnoComponent, {
      width: '400px',
      data: { listaTurnos: this.listaTurnos, turnoInicial: this.turnoSelecionado },
    });
    dialogRef.afterClosed().subscribe((result: DialogRelatorioTurnoResult | undefined) => {
      if (result?.turno) {
        if (this.acaoDialog === 'cozinha') this.gerarPDFCozinha(result.turno);
        else this.gerarPDFTransporte(result.turno);
      }
    });
  }

  gerarPDFCozinha(turno: string) {
    gerarPDFCozinha(this.inscricoes, turno, turno);
  }

  gerarPDFTransporte(turno: string) {
    gerarPDFTransporte(this.inscricoes, turno, turno);
  }

  hasHealthInfo(i: Inscricao): boolean {
    return !!(i.saude?.temAlergiaAlimentar || i.saude?.tomaMedicacao || i.observacoes);
  }

  getHealthTooltip(i: Inscricao): string {
    const parts: string[] = [];
    if (i.saude?.temAlergiaAlimentar)
      parts.push('Intoler\u00e2ncias: ' + (i.saude.detalheAlergiaAlimentar || 'sim'));
    if (i.saude?.tomaMedicacao)
      parts.push('Medica\u00e7\u00e3o: ' + (i.saude.detalheMedicacao || 'sim'));
    if (i.observacoes) parts.push('Obs: ' + i.observacoes);
    return parts.join('\n');
  }

  irParaPontuacoes() {
    // Guarda os estados selecionados pelo coordenador para serem lidos no Leaderboard
    sessionStorage.setItem('filtroLocal', this.filtroLocal);
    sessionStorage.setItem('turnoSelecionado', this.turnoSelecionado);

    this.router.navigate(['/pontuacoes']);
  }


}