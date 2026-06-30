import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import { Inscricao } from '../../models/inscricao.model';
import { AuthService } from '../../services/auth.service';
import { InscricaoService } from '../../services/inscricao.service';
import { OPCOES_TRANSPORTE } from '../../shared/transport-options';

import * as XLSX from 'xlsx';

import { gerarPDFCozinha, gerarPDFTransporte } from '../../shared/pdf-reports';

import {
  DialogRelatorioTurnoComponent,
  DialogRelatorioTurnoResult,
} from '../../components/dialog-relatorio-turno/dialog-relatorio-turno.component';
import { ConfigTurnosComponent } from './config-turnos/config-turnos.component';
import { DialogImportacaoComponent } from './dialog-importacao/dialog-importacao.component';
import { DialogModoExcelComponent } from './dialog-modo-excel/dialog-modo-excel.component';
import { DialogGerarAcessoComponent } from './gerar-acesso/gerar-acesso.component';
import { InscricaoSidebarComponent } from './inscricao-sidebar/inscricao-sidebar.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSortModule,
    MatMenuModule,
    MatTooltipModule,
    MatSelectModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    InscricaoSidebarComponent,
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss'],
})
export class AdminComponent implements OnInit, AfterViewInit {
  dataSource = new MatTableDataSource<Inscricao>([]);
  colunasMostradas: string[] = [
    'select',
    'estado',
    'participante',
    'turno',
    'empresa',
    'transporte',
    'contacto',
    'acoes',
  ];
  selection = new SelectionModel<Inscricao>(true, []);

  todosOsTurnosConfig: any = null;
  listaTurnos: string[] = [];

  readonly opcoesTransporte = OPCOES_TRANSPORTE;

  // KPIs
  totalInscritos = 0;
  pendentes = 0;
  totalRapazes = 0;
  totalRaparigas = 0;
  ocupacaoPorTurno: { nome: string; count: number; total: number; percent: number }[] = [];

  // Filtros Dashboard
  filtroLocal: 'quinta' | 'costaCaparica' | 'quiaios' = 'quinta';
  filtroTexto = '';
  filtroTurno = '';
  filtroEstado = '';

  // Sidebar
  selectedInscricao: Inscricao | null = null;
  sidebarOpen = false;
  isEditing = false;
  isCreating = false;

  // Relatórios PDF
  acaoDialog: 'cozinha' | 'transporte' = 'cozinha';

  @ViewChild('fileInput') fileInput!: any;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private inscricaoService = inject(InscricaoService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  async ngOnInit() {
    this.configurarFiltroAvancado();
    await this.recarregarDadosCompletos();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  // --- CARREGAMENTO DE DADOS ---
  async recarregarDadosCompletos() {
    try {
      const config = await this.inscricaoService.getConfiguracoesTurnos();
      if (config) {
        this.todosOsTurnosConfig = config;
        this.atualizarListaDeTurnosPorLocal();
      }

      const dados = await lastValueFrom(this.inscricaoService.getInscricoes());
      this.dataSource.data = dados;
      this.atualizarFiltros();
    } catch (error) {
      this.mostrarNotificacao('Erro ao carregar dados.', 'error');
    }
  }

  atualizarListaDeTurnosPorLocal() {
    if (this.todosOsTurnosConfig) {
      const listaBruta = this.todosOsTurnosConfig[this.filtroLocal] || [];
      this.listaTurnos = listaBruta.map((t: any) => t.nome);
      this.filtroTurno = '';
      this.atualizarFiltros();
    }
  }

  // --- FILTROS E PESQUISA ---
  configurarFiltroAvancado() {
    this.dataSource.filterPredicate = (data: Inscricao, filter: string) => {
      const searchTerms = JSON.parse(filter);

      const mapaLocais: any = {
        quinta: 'Quinta',
        costaCaparica: 'Costa da Caparica',
        quiaios: 'Quiaios',
      };

      const localData = (data.local || '').toLowerCase();
      const localFiltro = (mapaLocais[this.filtroLocal] || '').toLowerCase();
      const matchLocal = localData === localFiltro;

      const texto = searchTerms.texto;
      const matchTexto =
        !texto ||
        (data.participante?.nomeCompleto || '').toLowerCase().includes(texto) ||
        (data.ee?.nome || '').toLowerCase().includes(texto) ||
        (data.nomeInstituicao || '').toLowerCase().includes(texto);

      const matchTurno = !searchTerms.turno || data.turnoEscolhido === searchTerms.turno;
      const matchEstado = !searchTerms.estado || data.estado_pagamento === searchTerms.estado;

      return matchLocal && matchTexto && matchTurno && matchEstado;
    };
  }

  atualizarFiltros() {
    const filtros = {
      texto: this.filtroTexto.trim().toLowerCase(),
      turno: this.filtroTurno,
      estado: this.filtroEstado,
    };
    this.dataSource.filter = JSON.stringify(filtros);

    const dadosFiltrados = this.dataSource.filteredData;
    this.atualizarKPIs(dadosFiltrados);

    // Ocupação sempre com todos os dados do local (sem filtro de turno/estado/texto)
    this.calcularOcupacao(this.getDadosDoLocal());

    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  private getDadosDoLocal(): Inscricao[] {
    const mapaLocais: any = {
      quinta: 'Quinta',
      costaCaparica: 'Costa da Caparica',
      quiaios: 'Quiaios',
    };
    const localFiltro = (mapaLocais[this.filtroLocal] || '').toLowerCase();
    return this.dataSource.data.filter((i) => (i.local || '').toLowerCase() === localFiltro);
  }

  atualizarKPIs(dados: Inscricao[]) {
    this.totalInscritos = dados.length;
    this.pendentes = dados.filter((i) => i.estado_pagamento === 'pendente').length;
    this.totalRapazes = dados.filter((i) => i.participante?.genero === 'M').length;
    this.totalRaparigas = dados.filter((i) => i.participante?.genero === 'F').length;
  }

  calcularOcupacao(dados: Inscricao[]) {
    const counts: any = {};
    dados.forEach((d) => {
      counts[d.turnoEscolhido] = (counts[d.turnoEscolhido] || 0) + 1;
    });

    const configLocal = this.todosOsTurnosConfig
      ? this.todosOsTurnosConfig[this.filtroLocal] || []
      : [];

    this.ocupacaoPorTurno = configLocal
      .filter((t: any) => t.ativo === true || (counts[t.nome] && counts[t.nome] > 0))
      .map((t: any) => {
        const count = counts[t.nome] || 0;
        const limiteReal = t.limite || 80;
        const nomeCurto = t.nome.includes('–') ? t.nome.split(' – ')[0] : t.nome.split('-')[0];

        return {
          nome: nomeCurto,
          count: count,
          total: limiteReal,
          percent: (count / limiteReal) * 100,
        };
      });
  }

  // --- INTERAÇÕES UI DASHBOARD ---
  isAllSelected() {
    return this.selection.selected.length === this.dataSource.filteredData.length;
  }

  masterToggle() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.filteredData.forEach((row) => this.selection.select(row));
  }

  togglePagamento(inscricao: Inscricao) {
    if (!inscricao.id) return;
    const novo = inscricao.estado_pagamento === 'pago' ? 'pendente' : 'pago';
    const update: any = { estado_pagamento: novo };
    if (novo === 'pago') {
      update.dataPagamento = new Date();
    }

    this.inscricaoService.updateInscricao(inscricao.id, update).then(() => {
      inscricao.estado_pagamento = novo;
      if (novo === 'pago') {
        inscricao.dataPagamento = update.dataPagamento;
      }
      if (this.selectedInscricao && this.selectedInscricao.id === inscricao.id) {
        this.selectedInscricao.estado_pagamento = novo;
      }
      this.mostrarNotificacao(`Estado alterado para ${novo.toUpperCase()}`);
    });
  }

  marcarSelecionadosComo(novoEstado: 'pago' | 'pendente') {
    const selecionados = this.selection.selected;
    if (confirm(`Alterar ${selecionados.length} inscrições para ${novoEstado}?`)) {
      const updates = selecionados.map((i) => {
        const update: any = { id: i.id!, estado_pagamento: novoEstado };
        if (novoEstado === 'pago') {
          update.dataPagamento = new Date();
        }
        return update;
      });
      this.inscricaoService.updateInscricaoBatch(updates).then(() => {
        this.recarregarDadosCompletos();
        this.selection.clear();
        this.mostrarNotificacao('Atualizado com sucesso!');
      });
    }
  }

  apagarSelecionados() {
    const selecionados = this.selection.selected;
    if (confirm(`Apagar ${selecionados.length} registos permanentemente?`)) {
      const promessas = selecionados.map((i) =>
        i.id ? this.inscricaoService.deleteInscricao(i.id) : Promise.resolve(),
      );
      Promise.all(promessas).then(() => {
        this.recarregarDadosCompletos();
        this.selection.clear();
        this.mostrarNotificacao('Apagado.', 'error');
      });
    }
  }

  abrirDetalhes(row: Inscricao) {
    this.selectedInscricao = JSON.parse(JSON.stringify(row));
    if (this.selectedInscricao?.participante.dataNascimento) {
      this.selectedInscricao.participante.dataNascimento = new Date(
        this.selectedInscricao.participante.dataNascimento,
      );
    }
    this.sidebarOpen = true;
    this.isEditing = false;
    this.isCreating = false;
  }

  fecharDetalhes() {
    this.sidebarOpen = false;
    this.isCreating = false;
    setTimeout(() => (this.selectedInscricao = null), 300);
  }

  async guardarEdicao() {
    if (!this.selectedInscricao) return;

    const dados: any = { ...this.selectedInscricao };
    if (dados.participante.dataNascimento instanceof Date) {
      dados.participante.dataNascimento = dados.participante.dataNascimento
        .toISOString()
        .split('T')[0];
    }

    try {
      if (this.isCreating) {
        await this.inscricaoService.createInscricao(dados, false);
        this.mostrarNotificacao('Nova inscrição adicionada com sucesso!');
      } else {
        if (!this.selectedInscricao.id) return;
        await this.inscricaoService.updateInscricao(this.selectedInscricao.id, dados);
        this.mostrarNotificacao('Dados atualizados!');
      }
      this.isEditing = false;
      this.isCreating = false;
      this.fecharDetalhes();
      this.recarregarDadosCompletos();
    } catch (error) {
      this.mostrarNotificacao('Ocorreu um erro ao guardar.', 'error');
    }
  }

  // --- ADICIONAR MANUAL E EXPORTAR EXCEL ---
  private getPrecoTurno(turnoNome: string): number {
    if (!this.todosOsTurnosConfig || !turnoNome) return 300;
    const lista: any[] = this.todosOsTurnosConfig[this.filtroLocal] || [];
    const t = lista.find((x: any) => x.nome === turnoNome);
    return t?.precoBase ?? 300;
  }

  adicionarNovaInscricao() {
    this.isCreating = true;
    this.isEditing = true;

    this.selectedInscricao = {
      turnoEscolhido: this.filtroTurno || (this.listaTurnos.length > 0 ? this.listaTurnos[0] : ''),
      local: this.filtroLocal,
      valor_total: this.getPrecoTurno(
        this.filtroTurno || (this.listaTurnos.length > 0 ? this.listaTurnos[0] : ''),
      ),
      transporte: 'Não (Entregue pelos pais)',
      autorizaFotoVideo: false,
      estado_pagamento: 'pendente',
      tipoCliente: 'individual',
      nomeInstituicao: '',
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
      ee: {
        nome: '',
        email: '',
        telefone: '',
        nif: '',
        contactoEmergencia: '',
      },
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
    this.sidebarOpen = true;
  }

  exportarParaExcel() {
    if (this.dataSource.filteredData.length === 0) {
      this.mostrarNotificacao('Não há dados para exportar.', 'error');
      return;
    }

    const dadosExcel = this.dataSource.filteredData.map((i) => ({
      'Estado Pagamento': i.estado_pagamento.toUpperCase(),
      'Nome Participante': i.participante.nomeCompleto,
      'Data Nascimento':
        i.participante.dataNascimento instanceof Date
          ? i.participante.dataNascimento.toLocaleDateString('pt-PT')
          : i.participante.dataNascimento,
      CC: i.participante.cc,
      NIF: i.participante.nif,
      'Código Postal': i.participante.codigoPostal || '-',
      Turno: i.turnoEscolhido,
      'Empresa/Instituição': i.nomeInstituicao || '-',
      Transporte: i.transporte || 'Sem transporte',
      'Nome EE': i.ee.nome,
      'Telefone EE': i.ee.telefone,
      'Email EE': i.ee.email,
      Alergias: i.saude.detalheAlergiaAlimentar || '-',
      Medicação: i.saude.detalheMedicacao || '-',
      Observações: i.observacoes || '-',
      'Valor Total': i.valor_total,
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dadosExcel);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inscricoes');
    XLSX.writeFile(wb, `Exportacao_Inscricoes_${this.filtroLocal}.xlsx`);
  }

  // ==========================================================
  //     MODO EXCEL (sub-componente DialogModoExcelComponent)
  // ==========================================================
  abrirModoExcel() {
    const dialogRef = this.dialog.open(DialogModoExcelComponent, {
      maxWidth: '100vw',
      maxHeight: '100vh',
      height: '100%',
      width: '100%',
      panelClass: 'full-screen-excel-dialog',
      disableClose: true,
      data: {
        data: this.dataSource.data,
        listaTurnos: this.listaTurnos,
        filtroLocal: this.filtroLocal,
        todosOsTurnosConfig: this.todosOsTurnosConfig,
      },
    });
    dialogRef.afterClosed().subscribe(() => {
      this.recarregarDadosCompletos();
    });
  }

  // --- IMPORTAÇÃO EXCEL (sub-componente DialogImportacaoComponent) ---
  importarExcel(event: any) {
    const target: DataTransfer = <DataTransfer>event.target;
    if (target.files.length !== 1) return;

    const reader: FileReader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const dialogWidth = this.filtroLocal === 'quinta' ? '1400px' : '950px';
      const dialogRef = this.dialog.open(DialogImportacaoComponent, {
        width: dialogWidth,
        disableClose: true,
        data: {
          workbook,
          filtroLocal: this.filtroLocal,
          todosOsTurnosConfig: this.todosOsTurnosConfig,
          inscricoesExistentes: this.dataSource.data,
        },
      });
      dialogRef.afterClosed().subscribe((success: boolean) => {
        if (success) this.recarregarDadosCompletos();
      });

      if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
    };
    reader.readAsArrayBuffer(target.files[0]);
  }

  // --- PDF RELATÓRIOS ---
  verificarTurnoParaCozinha() {
    this.acaoDialog = 'cozinha';
    this.abrirDialogRelatorio();
  }

  verificarTurnoParaTransporte() {
    this.acaoDialog = 'transporte';
    this.abrirDialogRelatorio();
  }

  private abrirDialogRelatorio() {
    const dialogRef = this.dialog.open(DialogRelatorioTurnoComponent, {
      width: '400px',
      data: { listaTurnos: this.listaTurnos, turnoInicial: this.filtroTurno },
    });
    dialogRef.afterClosed().subscribe((result: DialogRelatorioTurnoResult | undefined) => {
      if (result?.turno) {
        if (this.acaoDialog === 'cozinha') this.gerarPDFCozinha(result.turno);
        else this.gerarPDFTransporte(result.turno);
      }
    });
  }

  gerarPDFCozinha(turno: string) {
    gerarPDFCozinha(this.dataSource.data, turno, this.filtroLocal);
  }

  gerarPDFTransporte(turno: string) {
    gerarPDFTransporte(this.dataSource.data, turno, this.filtroLocal);
  }

  abrirWhatsApp(tel: string) {
    if (!tel) return;
    const n = tel.replace(/\s/g, '');
    window.open(`https://wa.me/351${n}`, '_blank');
  }

  mostrarNotificacao(m: string, t: 'success' | 'error' = 'success') {
    this.snackBar.open(m, 'OK', {
      duration: 3000,
      panelClass: t === 'success' ? 'snackbar-success' : 'snackbar-error',
    });
  }

  limparFiltros() {
    this.filtroTexto = '';
    this.filtroTurno = '';
    this.filtroEstado = '';
    this.atualizarFiltros();
  }

  ativarEdicao() {
    this.isEditing = true;
  }

  async reenviarEmail(inscricao: Inscricao) {
    if (!confirm(`Enviar email de confirmação para ${inscricao.ee.email}?`)) return;
    this.mostrarNotificacao('A processar pedido...', 'success');
    try {
      await this.inscricaoService.reenviarEmail(inscricao);
      this.mostrarNotificacao('Email enviado com sucesso!');
    } catch (erro) {
      console.error(erro);
      this.mostrarNotificacao('Erro ao enviar email.', 'error');
    }
  }

  apagarInscricao(id?: string) {
    if (!id) return;
    if (confirm('Eliminar permanentemente?')) {
      this.inscricaoService.deleteInscricao(id).then(() => {
        this.recarregarDadosCompletos();
        this.fecharDetalhes();
        this.mostrarNotificacao('Apagado.', 'error');
      });
    }
  }

  abrirConfigTurnos() {
    const dialogRef = this.dialog.open(ConfigTurnosComponent, { width: '900px' });
    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) await this.recarregarDadosCompletos();
    });
  }

  gerar() {
    if (!this.filtroTurno) {
      this.mostrarNotificacao('Por favor, selecione um turno primeiro.', 'error');
      return;
    }
    let nomeFinal = '';
    if (this.todosOsTurnosConfig?.[this.filtroLocal]) {
      const turnoObj = this.todosOsTurnosConfig[this.filtroLocal].find(
        (t: any) => t.nome === this.filtroTurno,
      );
      if (turnoObj?.coordenadores?.length) {
        nomeFinal = turnoObj.coordenadores.filter((c: string) => c?.trim()).join(' & ');
      }
    }
    this.dialog.open(DialogGerarAcessoComponent, {
      width: '500px',
      data: { local: this.filtroLocal, turno: this.filtroTurno, nomePredefinido: nomeFinal },
    });
  }

  sair() {
    this.authService.logout();
  }
}
