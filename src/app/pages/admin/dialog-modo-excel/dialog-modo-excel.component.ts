import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Inscricao } from '../../../models/inscricao.model';
import { InscricaoService } from '../../../services/inscricao.service';
import { OPCOES_TRANSPORTE } from '../../../shared/transport-options';
import { DialogExportFaturacaoComponent } from '../dialog-export-faturacao/dialog-export-faturacao.component';

export interface DialogModoExcelData {
  data: Inscricao[];
  listaTurnos: string[];
  filtroLocal: 'quinta' | 'costaCaparica' | 'quiaios';
  todosOsTurnosConfig: any;
}

@Component({
  selector: 'app-dialog-modo-excel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './dialog-modo-excel.component.html',
  styleUrls: ['./dialog-modo-excel.component.scss'],
})
export class DialogModoExcelComponent implements OnInit {
  data = inject<DialogModoExcelData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<DialogModoExcelComponent>);
  private inscricaoService = inject(InscricaoService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  readonly opcoesTransporte = OPCOES_TRANSPORTE;

  linhasModificadas = new Set<Inscricao>();
  modoFaturacao = false;

  filtroExcelTurno = '';
  filtroExcelEmpresa = '';
  filtroExcelNome = '';

  // Cópia local dos dados para edição
  inscricoes: Inscricao[] = [];

  ngOnInit() {
    // Deep clone para não mutar os dados originais enquanto o dialog está aberto
    this.inscricoes = this.data.data.map((i) => ({ ...i }));
  }

  get dadosExcelFiltrados(): Inscricao[] {
    let dados = this.inscricoes;
    if (this.filtroExcelTurno) {
      dados = dados.filter((d) => d.turnoEscolhido === this.filtroExcelTurno);
    }
    if (this.filtroExcelEmpresa) {
      if (this.filtroExcelEmpresa === 'SEM_EMPRESA') {
        dados = dados.filter((d) => !d.nomeInstituicao || d.nomeInstituicao.trim() === '');
      } else {
        dados = dados.filter((d) => d.nomeInstituicao === this.filtroExcelEmpresa);
      }
    }
    if (this.filtroExcelNome) {
      const termo = this.filtroExcelNome.toLowerCase();
      dados = dados.filter(
        (d) =>
          (d.participante?.nomeCompleto || '').toLowerCase().includes(termo) ||
          (d.ee?.nome || '').toLowerCase().includes(termo),
      );
    }
    return dados;
  }

  get empresasUnicas(): string[] {
    const empresas = this.inscricoes
      .map((i) => i.nomeInstituicao)
      .filter((e) => e && e.trim() !== '');
    return [...new Set(empresas)] as string[];
  }

  marcarComoModificada(row: Inscricao) {
    this.linhasModificadas.add(row);
  }

  adicionarLinhaExcel() {
    const turnoDefault =
      this.filtroExcelTurno || (this.data.listaTurnos.length > 0 ? this.data.listaTurnos[0] : '');
    const nova: Inscricao = {
      turnoEscolhido: turnoDefault,
      local: this.data.filtroLocal,
      valor_total: this.getPrecoTurno(turnoDefault),
      transporte: 'Não (Entregue pelos pais)',
      autorizaFotoVideo: false,
      estado_pagamento: 'pendente',
      tipoCliente:
        this.filtroExcelEmpresa && this.filtroExcelEmpresa !== 'SEM_EMPRESA'
          ? 'instituicao'
          : 'individual',
      nomeInstituicao: this.filtroExcelEmpresa !== 'SEM_EMPRESA' ? this.filtroExcelEmpresa : '',
      numeroBeneficiario: '',
      participante: {
        nomeCompleto: '',
        genero: 'M',
        dataNascimento: '',
        cc: '',
        nif: '',
        codigoPostal: '',
        sistemaSaude: '',
      },
      ee: { nome: '', email: '', telefone: '', nif: '', contactoEmergencia: '' },
      saude: {
        temAlergiaAlimentar: false,
        detalheAlergiaAlimentar: '',
        tomaMedicacao: false,
        detalheMedicacao: '',
      },
      dataPagamento: '',
      nomePagamento: '',
      numeroFatura: '',
    };
    this.inscricoes = [nova, ...this.inscricoes];
    this.marcarComoModificada(nova);
  }

  async guardarTodasAlteracoesExcel() {
    if (this.linhasModificadas.size === 0) return;

    const linhas = Array.from(this.linhasModificadas);
    const novasLinhas = linhas.filter((l) => !l.id && l.participante.nomeCompleto.trim() !== '');
    const linhasExistentes = linhas.filter((l) => !!l.id);

    try {
      this.snackBar.open('A guardar dados no servidor...', '', {
        duration: 2000,
        panelClass: 'snackbar-success',
      });

      for (const nova of novasLinhas) {
        if (nova.participante.dataNascimento instanceof Date) {
          nova.participante.dataNascimento = new Date(
            nova.participante.dataNascimento.getTime() -
              nova.participante.dataNascimento.getTimezoneOffset() * 60000,
          )
            .toISOString()
            .split('T')[0];
        }
        const res: any = await this.inscricaoService.createInscricao(nova, false);
        nova.id = res.id;
      }

      if (linhasExistentes.length > 0) {
        const payloadBatch = linhasExistentes.map((l) => {
          if (l.participante.dataNascimento instanceof Date) {
            l.participante.dataNascimento = new Date(
              l.participante.dataNascimento.getTime() -
                l.participante.dataNascimento.getTimezoneOffset() * 60000,
            )
              .toISOString()
              .split('T')[0];
          }
          return { id: l.id!, data: l };
        });
        await this.inscricaoService.updateInscricaoBatch(payloadBatch);
      }

      this.linhasModificadas.clear();
      this.snackBar.open('✅ Todas as alterações foram guardadas!', 'OK', {
        duration: 3000,
        panelClass: 'snackbar-success',
      });
    } catch (e) {
      console.error(e);
      this.snackBar.open('❌ Ocorreu um erro ao gravar algumas linhas.', 'OK', {
        duration: 3000,
        panelClass: 'snackbar-error',
      });
    }
  }

  apagarLinhaExcel(row: Inscricao) {
    if (!row.id) {
      this.inscricoes = this.inscricoes.filter((r) => r !== row);
      this.linhasModificadas.delete(row);
      return;
    }
    if (confirm('Apagar esta linha permanentemente?')) {
      this.inscricaoService.deleteInscricao(row.id).then(() => {
        this.inscricoes = this.inscricoes.filter((r) => r.id !== row.id);
        this.linhasModificadas.delete(row);
        this.snackBar.open('Linha eliminada', 'OK', {
          duration: 1500,
          panelClass: 'snackbar-error',
        });
      });
    }
  }

  copiarEmails() {
    const emails = this.dadosExcelFiltrados.map((d) => d.ee?.email?.trim()).filter((e) => !!e);
    const unicos = [...new Set(emails)];
    navigator.clipboard.writeText(unicos.join('; ')).then(() => {
      this.snackBar.open(
        `✅ ${unicos.length} email${unicos.length !== 1 ? 's' : ''} copiado${unicos.length !== 1 ? 's' : ''}!`,
        'OK',
        {
          duration: 3000,
          panelClass: 'snackbar-success',
        },
      );
    });
  }

  trackByFn(index: number, item: any) {
    return item.id || index;
  }

  abrirModoFaturacao() {
    this.modoFaturacao = true;
  }

  fecharModoFaturacao() {
    this.modoFaturacao = false;
  }

  abrirDialogExportFaturacao() {
    this.dialog.open(DialogExportFaturacaoComponent, {
      width: '460px',
      data: {
        listaTurnos: this.data.listaTurnos,
        empresasUnicas: this.empresasUnicas,
        dados: this.dadosExcelFiltrados,
        filtroLocal: this.data.filtroLocal,
      },
    });
  }

  fechar() {
    if (this.linhasModificadas.size > 0) {
      if (!confirm('Tens alterações por guardar! Queres mesmo sair e perder os dados?')) return;
    }
    this.linhasModificadas.clear();
    this.dialogRef.close(true);
  }

  private getPrecoTurno(turnoNome: string): number {
    if (!this.data.todosOsTurnosConfig || !turnoNome) return 300;
    const lista: any[] = this.data.todosOsTurnosConfig[this.data.filtroLocal] || [];
    const t = lista.find((x: any) => x.nome === turnoNome);
    return t?.precoBase ?? 300;
  }
}
