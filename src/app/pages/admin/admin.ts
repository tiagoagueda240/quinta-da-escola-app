import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
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
import { ConfigTurnos, Inscricao } from '../../models/inscricao.model';
import { AuthService } from '../../services/auth.service';
import { InscricaoService } from '../../services/inscricao.service';
import { OPCOES_TRANSPORTE } from '../../shared/transport-options';

import * as ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { ConfigTurnosComponent } from '../../components/config-turnos.component';
import { DialogGerarAcessoComponent } from '../../components/gerar-acesso.component';
import { ConfirmService } from '../../shared/confirm-dialog.component';

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

  todosOsTurnosConfig: ConfigTurnos | null = null;
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

  // Filtros Modo Excel
  filtroExcelTurno = '';
  filtroExcelEmpresa = '';
  filtroExcelNome = '';

  // Sidebar e Modals
  selectedInscricao: Inscricao | null = null;
  sidebarOpen = false;
  isEditing = false;
  isCreating = false;
  acaoDialog: 'cozinha' | 'transporte' = 'cozinha';
  turnoParaDialog: string = '';
  linkGerado: string = '';

  // Controlo de Alterações Modo Excel
  linhasModificadas: Set<Inscricao> = new Set();
  modoFaturacao = false;

  // Variáveis para Importação de Excel
  @ViewChild('fileInput') fileInput!: any;
  @ViewChild('dialogImportacao') dialogImportacao!: TemplateRef<any>;
  @ViewChild('dialogModoExcel') dialogModoExcel!: TemplateRef<any>;
  @ViewChild('dialogExportFaturacao') dialogExportFaturacao!: TemplateRef<any>;

  tipoExportFaturacao: 'total' | 'turno' | 'empresa' = 'total';
  turnoExportFaturacao = '';
  empresaExportFaturacao = '';

  estaAImportar = false;
  empresaImportacao: string = '';
  dadosImportacao = { validos: [] as any[], duplicados: 0, total: 0 };

  private dicionarioCampos: { [key: string]: string[] } = {
    nome: ['nome', 'participante', 'crianca', 'aluno', 'nomecompleto'],
    nascimento: ['datanascimento', 'nascimento', 'idade', 'data'],
    genero: ['genero', 'sexo'],
    transporte: ['transporte', 'transfer', 'autocarro'],
    email: ['email', 'e-mail', 'correio', 'contactoemail'],
    telefone: ['telefone', 'telemovel', 'contato', 'celular', 'contacto'],
    alergias: ['alergias', 'medicacao', 'observacoes', 'saude', 'alergiasmedicacao'],
    nif: ['nif', 'contribuinte', 'nifee', 'contribuinteee'],
    preco: ['preco', 'precototal', 'valor', 'valortotal'],
  };

  @ViewChild('dialogTurno') dialogTurno!: TemplateRef<any>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private inscricaoService = inject(InscricaoService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private confirmService = inject(ConfirmService);

  async ngOnInit() {
    try {
      this.configurarFiltroAvancado();
      await this.recarregarDadosCompletos();
    } catch (error) {
      this.mostrarNotificacao('Erro ao inicializar a aplicação.', 'error');
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  // --- CARREGAMENTO DE DADOS ---

  async recarregarDadosCompletos() {
    try {
      // Primeiro carregamos as configs (limites, preços, nomes)
      const config = await this.inscricaoService.getConfiguracoesTurnos();
      if (config) {
        this.todosOsTurnosConfig = config;
        // Atualizamos a lista de nomes de turnos para os filtros
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
    this.calcularOcupacao(dadosFiltrados);

    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
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

  async marcarSelecionadosComo(novoEstado: 'pago' | 'pendente') {
    const selecionados = this.selection.selected;
    const ok = await this.confirmService.confirmar(
      `Alterar ${selecionados.length} inscrições para ${novoEstado}?`,
    );
    if (ok) {
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

  async apagarSelecionados() {
    const selecionados = this.selection.selected;
    const ok = await this.confirmService.confirmar(
      `Apagar ${selecionados.length} registos permanentemente?`,
      { cor: 'warn', confirmar: 'Apagar' },
    );
    if (ok) {
      const ids = new Set(selecionados.map((i) => String(i.id)));
      // Remoção imediata da tabela
      this.dataSource.data = this.dataSource.data.filter((i) => !ids.has(String(i.id)));
      this.selection.clear();
      try {
        await Promise.all(
          selecionados.map((i) =>
            i.id ? this.inscricaoService.deleteInscricao(i.id) : Promise.resolve(),
          ),
        );
        this.mostrarNotificacao('Apagado.', 'error');
      } catch {
        this.mostrarNotificacao('Erro ao apagar alguns registos.', 'error');
      }
      await this.recarregarDadosCompletos();
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
        await this.inscricaoService.createInscricao(dados);
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

  /** Devolve o precoBase do turno a partir da config carregada, ou 300 como fallback */
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
      participante: {
        nomeCompleto: '',
        genero: 'M',
        dataNascimento: '',
        cc: '',
        nif: '',
        codigoPostal: '',
        sistemaSaude: '',
      },
      ee: { nome: '', email: '', telefone: '' },
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
  //     MODO EXCEL INTERATIVO (OTIMIZADO LOTE)
  // ==========================================================

  abrirModoExcel() {
    this.linhasModificadas.clear();
    this.dialog.open(this.dialogModoExcel, {
      maxWidth: '100vw',
      maxHeight: '100vh',
      height: '100%',
      width: '100%',
      panelClass: 'full-screen-excel-dialog',
      disableClose: true,
    });
  }

  async fecharModoExcel() {
    if (this.linhasModificadas.size > 0) {
      const ok = await this.confirmService.confirmar(
        'Tens alterações por guardar! Queres mesmo sair e perder os dados?',
      );
      if (!ok) return;
    }
    this.linhasModificadas.clear();
    this.dialog.closeAll();
    this.recarregarDadosCompletos();
  }

  abrirModoFaturacao() {
    this.modoFaturacao = true;
  }

  fecharModoFaturacao() {
    this.modoFaturacao = false;
  }

  abrirDialogExportFaturacao() {
    this.tipoExportFaturacao = 'total';
    this.turnoExportFaturacao = this.listaTurnos[0] || '';
    this.empresaExportFaturacao = this.empresasUnicas[0] || '';
    this.dialog.open(this.dialogExportFaturacao, { width: '460px' });
  }

  async exportarFaturacao() {
    const todosOsDados = this.dadosExcelFiltrados;

    let dados = todosOsDados;
    let sufixo = '';

    if (this.tipoExportFaturacao === 'turno') {
      dados = todosOsDados.filter((i) => i.turnoEscolhido === this.turnoExportFaturacao);
      sufixo = `_${this.turnoExportFaturacao}`;
    } else if (this.tipoExportFaturacao === 'empresa') {
      dados = todosOsDados.filter((i) => i.nomeInstituicao === this.empresaExportFaturacao);
      sufixo = `_${this.empresaExportFaturacao}`;
    }

    if (dados.length === 0) {
      this.mostrarNotificacao('Não há dados para exportar.', 'error');
      return;
    }

    const formatarData = (val: any) => {
      if (!val) return '';
      if (val instanceof Date) return val.toLocaleDateString('pt-PT');
      if (typeof val === 'string' && val.trim()) return val.split('T')[0];
      return '';
    };

    const titulo =
      this.tipoExportFaturacao === 'turno'
        ? `Faturação – ${this.turnoExportFaturacao}`
        : this.tipoExportFaturacao === 'empresa'
          ? `Faturação – ${this.empresaExportFaturacao}`
          : 'Faturação Total';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Quinta da Escola';
    wb.created = new Date();

    const ws = wb.addWorksheet('Faturação', { views: [{ state: 'frozen', ySplit: 3 }] });

    // ── Linha de título ────────────────────────────────────────────
    ws.mergeCells('A1:J1');
    const tituloCell = ws.getCell('A1');
    tituloCell.value = titulo;
    tituloCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
    tituloCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 30;

    // ── Linha de subtítulo ─────────────────────────────────────────
    ws.mergeCells('A2:J2');
    const subCell = ws.getCell('A2');
    subCell.value = `Exportado em ${new Date().toLocaleDateString('pt-PT')}  |  ${dados.length} participante${dados.length !== 1 ? 's' : ''}`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF4CAF50' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 18;

    // ── Colunas ────────────────────────────────────────────────────
    ws.columns = [
      { key: 'nome', width: 32 },
      { key: 'cp', width: 14 },
      { key: 'nif', width: 13 },
      { key: 'email', width: 32 },
      { key: 'turno', width: 22 },
      { key: 'empresa', width: 26 },
      { key: 'valor', width: 12 },
      { key: 'dataPag', width: 18 },
      { key: 'nomePag', width: 26 },
      { key: 'fatura', width: 16 },
    ];

    // ── Cabeçalho ──────────────────────────────────────────────────
    const cabecalhos = [
      'Nome Participante',
      'Código Postal',
      'NIF',
      'Email',
      'Turno',
      'Empresa / Instituição',
      'Valor (€)',
      'Data de Pagamento',
      'Nome de Pagamento',
      'Nº Fatura',
    ];
    const headerRow = ws.addRow(cabecalhos); // row 3
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1B5E20' } },
        bottom: { style: 'medium', color: { argb: 'FF1B5E20' } },
        left: { style: 'thin', color: { argb: 'FF1B5E20' } },
        right: { style: 'thin', color: { argb: 'FF1B5E20' } },
      };
    });

    // ── Dados ──────────────────────────────────────────────────────
    const borderLight = {
      top: { style: 'hair' as const, color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'hair' as const, color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    };

    dados.forEach((i, idx) => {
      const row = ws.addRow({
        nome: i.participante.nomeCompleto,
        cp: i.participante.codigoPostal || '',
        nif: i.participante.nif || '',
        email: i.ee.email,
        turno: i.turnoEscolhido,
        empresa: i.nomeInstituicao || '',
        valor: i.valor_total,
        dataPag: formatarData(i.dataPagamento),
        nomePag: i.nomePagamento || '',
        fatura: i.numeroFatura || '',
      });
      row.height = 18;

      const bgPar = 'FFF1F8E9'; // verde muito claro
      const bgImpar = 'FFFFFFFF'; // branco
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: idx % 2 === 0 ? bgPar : bgImpar },
        };
        cell.border = borderLight;
        cell.alignment = { vertical: 'middle', horizontal: col === 7 ? 'right' : 'left' };
        cell.font = { size: 10 };
      });

      // Colorir verde se pago
      if (i.estado_pagamento === 'pago') {
        ws.getCell(`G${row.number}`).font = { bold: true, color: { argb: 'FF2E7D32' }, size: 10 };
      }
    });

    // ── Linha de total ─────────────────────────────────────────────
    const totalValor = dados.reduce((s, i) => s + (i.valor_total || 0), 0);
    const totalRow = ws.addRow({
      nome: 'TOTAL',
      valor: totalValor,
    });
    totalRow.height = 22;
    totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF388E3C' } },
        bottom: { style: 'medium', color: { argb: 'FF388E3C' } },
        left: { style: 'thin', color: { argb: 'FF388E3C' } },
        right: { style: 'thin', color: { argb: 'FF388E3C' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: col === 7 ? 'right' : 'left' };
    });

    // ── Download ───────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Faturacao${sufixo}_${this.filtroLocal}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    this.dialog.closeAll();
  }

  get empresasUnicas(): string[] {
    const empresas = this.dataSource.data
      .map((i) => i.nomeInstituicao)
      .filter((e) => e && e.trim() !== '');
    return [...new Set(empresas)] as string[];
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

  get dadosExcelFiltrados(): Inscricao[] {
    let dados = this.dataSource.data;
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

  marcarComoModificada(row: Inscricao) {
    this.linhasModificadas.add(row);
  }

  adicionarLinhaExcel() {
    const nova: Inscricao = {
      turnoEscolhido:
        this.filtroExcelTurno || (this.listaTurnos.length > 0 ? this.listaTurnos[0] : ''),
      local: this.filtroLocal,
      valor_total: this.getPrecoTurno(
        this.filtroExcelTurno || (this.listaTurnos.length > 0 ? this.listaTurnos[0] : ''),
      ),
      transporte: 'Não (Entregue pelos pais)',
      autorizaFotoVideo: false,
      estado_pagamento: 'pendente',
      tipoCliente:
        this.filtroExcelEmpresa && this.filtroExcelEmpresa !== 'SEM_EMPRESA'
          ? 'instituicao'
          : 'individual',
      nomeInstituicao: this.filtroExcelEmpresa !== 'SEM_EMPRESA' ? this.filtroExcelEmpresa : '',
      participante: {
        nomeCompleto: '',
        genero: 'M',
        dataNascimento: '',
        cc: '',
        nif: '',
        codigoPostal: '',
        sistemaSaude: '',
      },
      ee: { nome: '', email: '', telefone: '' },
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

    this.dataSource.data = [nova, ...this.dataSource.data];
    this.marcarComoModificada(nova);
  }

  async guardarTodasAlteracoesExcel() {
    if (this.linhasModificadas.size === 0) return;

    const linhas = Array.from(this.linhasModificadas);
    const novasLinhas = linhas.filter((l) => !l.id && l.participante.nomeCompleto.trim() !== '');
    const linhasExistentes = linhas.filter((l) => !!l.id);

    try {
      this.mostrarNotificacao('A guardar dados no servidor...', 'success');

      // 1. Gravar Novas Linhas
      for (const nova of novasLinhas) {
        if (nova.participante.dataNascimento instanceof Date) {
          nova.participante.dataNascimento = new Date(
            nova.participante.dataNascimento.getTime() -
              nova.participante.dataNascimento.getTimezoneOffset() * 60000,
          )
            .toISOString()
            .split('T')[0];
        }
        const res: any = await this.inscricaoService.createInscricao(nova);
        nova.id = res.id;
      }

      // 2. Atualizar Linhas Existentes
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
      this.atualizarKPIs(this.dataSource.filteredData);
      this.snackBar.open('✅ Todas as alterações foram guardadas!', 'OK', {
        duration: 3000,
        panelClass: 'snackbar-success',
      });
    } catch (e) {
      console.error(e);
      this.mostrarNotificacao('❌ Ocorreu um erro ao gravar algumas linhas.', 'error');
    }
  }

  async apagarLinhaExcel(row: Inscricao) {
    if (!row.id) {
      this.dataSource.data = this.dataSource.data.filter((r) => r !== row);
      this.linhasModificadas.delete(row);
      return;
    }
    const ok = await this.confirmService.confirmar('Apagar esta linha permanentemente?', {
      cor: 'warn',
      confirmar: 'Apagar',
    });
    if (ok) {
      await this.inscricaoService.deleteInscricao(row.id);
      this.dataSource.data = this.dataSource.data.filter((r) => r.id !== row.id);
      this.linhasModificadas.delete(row);
      this.atualizarKPIs(this.dataSource.filteredData);
      this.snackBar.open('Linha eliminada', 'OK', { duration: 1500, panelClass: 'snackbar-error' });
    }
  }

  trackByFn(index: number, item: any) {
    return item.id || index;
  }

  // --- IMPORTAÇÃO INTELIGENTE EXCEL ---

  importarExcel(event: any) {
    const target: DataTransfer = <DataTransfer>event.target;
    if (target.files.length !== 1) return;

    this.estaAImportar = false;
    this.empresaImportacao = '';
    this.dadosImportacao = { validos: [], duplicados: 0, total: 0 };
    this.dialog.open(this.dialogImportacao, { width: '500px', disableClose: true });

    const reader: FileReader = new FileReader();
    reader.onload = (e: any) => {
      const bstr: string = e.target.result;
      const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

      let inscricoesProcessadas: any[] = [];
      let duplicadosContador = 0;

      wb.SheetNames.forEach((sheetName) => {
        const ws: XLSX.WorkSheet = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rawData.length < 2) return;

        const cabecalhosRaw = rawData[0];
        const mapaIndex = this.mapearCabecalhos(cabecalhosRaw);
        const turnoAdivinhado = this.adivinharTurnoDaAba(sheetName);

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0 || !row[mapaIndex.nome]) continue;

          const nomeInscrito = String(row[mapaIndex.nome]).trim();
          if (nomeInscrito.length < 2) continue;

          const isDuplicado = this.verificarDuplicadoGlobal(
            nomeInscrito,
            turnoAdivinhado,
            inscricoesProcessadas,
          );

          if (isDuplicado) {
            duplicadosContador++;
            continue;
          }

          const nova = this.construirObjetoInscricao(row, mapaIndex, turnoAdivinhado);
          inscricoesProcessadas.push(nova);
        }
      });

      this.dadosImportacao = {
        validos: inscricoesProcessadas,
        duplicados: duplicadosContador,
        total: inscricoesProcessadas.length + duplicadosContador,
      };

      if (this.fileInput && this.fileInput.nativeElement) {
        this.fileInput.nativeElement.value = '';
      }
    };
    reader.readAsBinaryString(target.files[0]);
  }

  private mapearCabecalhos(cabecalhos: string[]): any {
    const mapa: any = {};
    cabecalhos.forEach((cab, index) => {
      if (!cab) return;
      const cabNormalizado = this.normalizarTexto(cab);

      for (const [chave, sinonimos] of Object.entries(this.dicionarioCampos)) {
        if (sinonimos.some((s) => cabNormalizado.includes(s))) {
          if (mapa[chave] === undefined) mapa[chave] = index;
        }
      }
    });
    if (mapa.nome === undefined) mapa.nome = 1;
    return mapa;
  }

  private adivinharTurnoDaAba(sheetName: string): string {
    const nomeNorm = this.normalizarTexto(sheetName);

    for (let t of this.listaTurnos) {
      if (
        this.normalizarTexto(t).includes(nomeNorm) ||
        nomeNorm.includes(this.normalizarTexto(t))
      ) {
        return t;
      }
    }

    const matchNumero = sheetName.match(/(\d+)º/);
    if (matchNumero) {
      const t = this.listaTurnos.find((turno) => turno.includes(`${matchNumero[1]}º`));
      if (t) return t;
    }

    if (nomeNorm.includes('pascoa'))
      return (
        this.listaTurnos.find((t) => this.normalizarTexto(t).includes('pascoa')) ||
        this.listaTurnos[0]
      );
    if (nomeNorm.includes('natal'))
      return (
        this.listaTurnos.find((t) => this.normalizarTexto(t).includes('natal')) ||
        this.listaTurnos[0]
      );

    return this.listaTurnos.length > 0 ? this.listaTurnos[0] : 'Turno Importado';
  }

  private verificarDuplicadoGlobal(nome: string, turno: string, filaProcessamento: any[]): boolean {
    const nomeNorm = this.normalizarTexto(nome);

    const existeBD = this.dataSource.data.some(
      (i) =>
        this.normalizarTexto(i.participante.nomeCompleto) === nomeNorm &&
        i.turnoEscolhido === turno,
    );
    if (existeBD) return true;

    const existeFila = filaProcessamento.some(
      (i) =>
        this.normalizarTexto(i.participante.nomeCompleto) === nomeNorm &&
        i.turnoEscolhido === turno,
    );
    return existeFila;
  }

  private construirObjetoInscricao(row: any[], mapa: any, turno: string): any {
    let dataNasc = '';
    if (mapa.nascimento !== undefined && row[mapa.nascimento]) {
      const val = row[mapa.nascimento];
      if (typeof val === 'number') {
        const dataExcel = new Date((val - (25567 + 2)) * 86400 * 1000);
        dataNasc = dataExcel.toISOString().split('T')[0];
      } else {
        dataNasc = val;
      }
    }

    return {
      turnoEscolhido: turno,
      local: this.filtroLocal,
      valor_total:
        mapa.preco !== undefined && row[mapa.preco]
          ? Number(row[mapa.preco])
          : this.getPrecoTurno(turno),
      transporte:
        mapa.transporte !== undefined && row[mapa.transporte]
          ? String(row[mapa.transporte])
          : 'Não (Entregue pelos pais)',
      autorizaFotoVideo: false,
      estado_pagamento: 'pendente',

      participante: {
        nomeCompleto: String(row[mapa.nome]).trim(),
        genero:
          mapa.genero !== undefined && row[mapa.genero]
            ? String(row[mapa.genero]).toUpperCase().charAt(0)
            : '',
        dataNascimento: dataNasc,
        nif: '',
        codigoPostal: '',
        cc: '',
        sistemaSaude: '',
        tamanhoTshirt: '',
      },
      ee: {
        nome:
          mapa.ee !== undefined && row[mapa.ee]
            ? String(row[mapa.ee]).trim()
            : 'EE de ' + String(row[mapa.nome]).trim(),
        email: mapa.email !== undefined && row[mapa.email] ? String(row[mapa.email]).trim() : '',
        telefone:
          mapa.telefone !== undefined && row[mapa.telefone]
            ? String(row[mapa.telefone]).replace(/\D/g, '')
            : '',
        nif: mapa.nif !== undefined && row[mapa.nif] ? String(row[mapa.nif]) : '',
        contactoEmergencia: '',
      },
      saude: {
        temAlergiaAlimentar: false,
        temOutrasAlergias: false,
        tomaMedicacao: false,
        alergiaDetalhes:
          mapa.alergias !== undefined && row[mapa.alergias] ? String(row[mapa.alergias]) : '',
        medicacaoHabitual: '',
      },
    };
  }

  private normalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  async confirmarImportacao() {
    this.estaAImportar = true;

    try {
      for (const inscricao of this.dadosImportacao.validos) {
        if (this.empresaImportacao && this.empresaImportacao.trim() !== '') {
          inscricao.tipoCliente = 'instituicao';
          inscricao.nomeInstituicao = this.empresaImportacao.trim();
        }
        await this.inscricaoService.createInscricao(inscricao);
      }

      this.mostrarNotificacao(
        `${this.dadosImportacao.validos.length} Inscrições importadas com sucesso!`,
      );
      this.recarregarDadosCompletos();
    } catch (error) {
      console.error(error);
      this.mostrarNotificacao('Ocorreu um erro na importação de algumas linhas.', 'error');
    } finally {
      this.estaAImportar = false;
      this.empresaImportacao = '';
      this.dialog.closeAll();
    }
  }

  cancelarImportacao() {
    this.dadosImportacao = { validos: [], duplicados: 0, total: 0 };
    this.empresaImportacao = '';
    if (this.fileInput && this.fileInput.nativeElement) this.fileInput.nativeElement.value = '';
  }

  // --- PDF & HELPERS ---

  verificarTurnoParaCozinha() {
    this.acaoDialog = 'cozinha';
    this.turnoParaDialog = this.filtroTurno;
    this.dialog.open(this.dialogTurno, { width: '400px' });
  }

  verificarTurnoParaTransporte() {
    this.acaoDialog = 'transporte';
    this.turnoParaDialog = this.filtroTurno;
    this.dialog.open(this.dialogTurno, { width: '400px' });
  }

  confirmarGeracaoPDF() {
    if (this.acaoDialog === 'cozinha') this.gerarPDFCozinha(this.turnoParaDialog);
    else this.gerarPDFTransporte(this.turnoParaDialog);
    this.dialog.closeAll();
  }

  gerarPDFCozinha(turno: string) {
    const doc = new jsPDF();
    const lista = this.dataSource.data.filter(
      (i) =>
        i.turnoEscolhido === turno && (i.saude.temAlergiaAlimentar || i.saude.temOutrasAlergias),
    );

    doc.text(`Restrições Alimentares - ${turno}`, 14, 20);
    autoTable(doc, {
      head: [['Participante', 'Alergia/Restrição']],
      body: lista.map((i) => [
        i.participante.nomeCompleto,
        i.saude.detalheAlergiaAlimentar || i.saude.detalheOutrasAlergias || 'Não especificado',
      ]),
      startY: 30,
    });
    doc.save(`Cozinha_${this.filtroLocal}.pdf`);
  }

  gerarPDFTransporte(turno: string) {
    const doc = new jsPDF();
    const lista = this.dataSource.data.filter(
      (i) => i.turnoEscolhido === turno && i.transporte !== 'Não (Entregue pelos pais)',
    );

    doc.text(`Lista de Transportes - ${turno}`, 14, 20);
    autoTable(doc, {
      head: [['Participante', 'Tipo Transporte', 'Contacto']],
      body: lista.map((i) => [i.participante.nomeCompleto, i.transporte, i.ee.telefone]),
      startY: 30,
    });
    doc.save(`Transportes_${this.filtroLocal}.pdf`);
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
    const ok = await this.confirmService.confirmar(
      `Enviar email de confirmação para ${inscricao.ee.email}?`,
    );
    if (!ok) return;
    this.mostrarNotificacao('A processar pedido...', 'success');
    this.inscricaoService.enviarEmailSeguro(inscricao);
    this.mostrarNotificacao('Email enviado para o servidor de correio!');
  }

  async apagarInscricao(id?: string) {
    if (!id) return;
    const ok = await this.confirmService.confirmar('Eliminar permanentemente?', {
      cor: 'warn',
      confirmar: 'Eliminar',
    });
    if (ok) {
      // Remoção imediata da tabela para feedback instantâneo
      this.dataSource.data = this.dataSource.data.filter((i) => String(i.id) !== String(id));
      this.fecharDetalhes();
      try {
        await this.inscricaoService.deleteInscricao(id);
        this.mostrarNotificacao('Apagado com sucesso.', 'error');
      } catch {
        this.mostrarNotificacao('Erro ao apagar. A recarregar dados...', 'error');
      }
      // Reload em background para garantir sincronismo com o servidor
      await this.recarregarDadosCompletos();
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
    if (this.todosOsTurnosConfig && this.todosOsTurnosConfig[this.filtroLocal]) {
      const turnoObj = this.todosOsTurnosConfig[this.filtroLocal].find(
        (t: any) => t.nome === this.filtroTurno,
      );

      if (turnoObj && turnoObj.coordenadores && Array.isArray(turnoObj.coordenadores)) {
        nomeFinal = turnoObj.coordenadores.filter((c: string) => c && c.trim() !== '').join(' & ');
      }
    }

    this.dialog.open(DialogGerarAcessoComponent, {
      width: '500px',
      data: {
        local: this.filtroLocal,
        turno: this.filtroTurno,
        nomePredefinido: nomeFinal,
      },
    });
  }

  sair() {
    this.authService.logout();
  }
}
