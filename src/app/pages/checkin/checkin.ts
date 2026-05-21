import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { from, Observable } from 'rxjs'; // <--- IMPORTANTE
import { Inscricao } from '../../models/inscricao.model';
import { AuthService } from '../../services/auth.service';
import { InscricaoService } from '../../services/inscricao.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';

// Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

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

  private inscricaoService = inject(InscricaoService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private confirmService = inject(ConfirmService);

  async ngOnInit() {
    try {
      this.token = this.route.snapshot.queryParamMap.get('token');

      if (this.token) {
        this.modoLink = true;
        this.loading = false;
        const pinSalvo = sessionStorage.getItem('access_pin_' + this.token);
        if (pinSalvo) {
          this.pinInput = pinSalvo;
          this.validarPin();
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
    } catch (error) {
      this.mostrarToast('Erro ao inicializar.');
      this.loading = false;
    }
  }

  validarPin() {
    if (this.pinInput.length < 4) return;
    this.erroPin = '';
    this.loading = true;

    this.inscricaoService.getInscricoesComTokenEPin(this.token!, this.pinInput).subscribe({
      next: (dados) => {
        this.loading = false;
        this.pinValidado = true;
        this.pinSessao = this.pinInput;
        sessionStorage.setItem('access_pin_' + this.token, this.pinSessao);
        this.processarDadosRecebidos(dados);
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
      const todosTurnos = [
        ...(config.quinta || []),
        ...(config.costaCaparica || []),
        ...(config.quiaios || []),
      ];

      this.listaTurnos = todosTurnos.filter((t: any) => t.ativo === true).map((t: any) => t.nome);

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
      // CORREÇÃO: Adicionada dataEntrada fictícia para satisfazer o tipo Date
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
    }

    if (this.listaTurnos.length > 0) {
      if (!this.turnoSelecionado || !this.listaTurnos.includes(this.turnoSelecionado)) {
        this.turnoSelecionado = this.listaTurnos[0];
      }
      this.filtrar();
    } else {
      this.inscricoesFiltradas = this.inscricoes;
    }
  }

  mudarTurno(turno: string) {
    this.turnoSelecionado = turno;
    this.filtrar();
  }

  filtrar() {
    const texto = this.pesquisa.toLowerCase().trim();

    this.inscricoesFiltradas = this.inscricoes.filter((i) => {
      const matchTurno = this.turnoSelecionado ? i.turnoEscolhido === this.turnoSelecionado : true;
      const matchNome = i.participante.nomeCompleto.toLowerCase().includes(texto);
      return matchTurno && matchNome;
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
    // CORREÇÃO: Validação de ID segura
    if (!inscricaoAlvo || !inscricaoAlvo.id) return;
    const idSeguro = inscricaoAlvo.id;

    const novoCheckin = {
      status: 'dentro',
      dataEntrada: new Date(),
      dinheiroBolso: this.tempDinheiro || 0,
      notasCheckin: this.tempNotas,
    };

    const payload = {
      id: idSeguro,
      checkin: novoCheckin,
    };

    let observable$: Observable<any>;

    if (this.modoLink) {
      observable$ = this.inscricaoService.updateCheckinComToken(
        payload,
        this.token!,
        this.pinSessao,
      );
    } else {
      // CORREÇÃO: Converter Promise para Observable para usar .subscribe()
      observable$ = from(this.inscricaoService.updateInscricaoBatch([payload]));
    }

    observable$.subscribe({
      next: () => {
        // CORREÇÃO: Verificar se checkin existe antes de atribuir
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
      // CORREÇÃO: Tipagem do erro
      error: (err: any) => {
        console.error(err);
        this.mostrarToast('Erro ao registar entrada.');
      },
    });
  }

  async registarSaida(inscricao: Inscricao) {
    if (!inscricao.id) return;
    const idSeguro = inscricao.id;

    const ok = await this.confirmService.confirmar(
      `Confirmar saída de ${inscricao.participante.nomeCompleto}?`,
    );
    if (!ok) return;

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
}
