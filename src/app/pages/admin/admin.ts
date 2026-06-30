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
import { Inscricao } from '../../models/inscricao.model';
import { AuthService } from '../../services/auth.service';
import { InscricaoService } from '../../services/inscricao.service';
import { OPCOES_TRANSPORTE } from '../../shared/transport-options';

import * as ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { ConfigTurnosComponent } from '../../components/config-turnos.component';
import { DialogGerarAcessoComponent } from '../../components/gerar-acesso.component';

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
  fileToProcess: XLSX.WorkBook | null = null;

  localDestinoImportacao: 'quinta' | 'costaCaparica' | 'quiaios' = 'quinta';
  turnoDestinoImportacao = '';
  listaTurnosImportacao: string[] = [];
  isLocalEspecialImportacao = false;

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
  //     MODO EXCEL INTERATIVO E FATURAÇÃO
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

  fecharModoExcel() {
    if (this.linhasModificadas.size > 0) {
      if (!confirm('Tens alterações por guardar! Queres mesmo sair e perder os dados?')) {
        return;
      }
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

    ws.mergeCells('A1:J1');
    const tituloCell = ws.getCell('A1');
    tituloCell.value = titulo;
    tituloCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
    tituloCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:J2');
    const subCell = ws.getCell('A2');
    subCell.value = `Exportado em ${new Date().toLocaleDateString('pt-PT')}  |  ${dados.length} participante${dados.length !== 1 ? 's' : ''}`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF4CAF50' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 18;

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
    const headerRow = ws.addRow(cabecalhos);
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

      const bgPar = 'FFF1F8E9';
      const bgImpar = 'FFFFFFFF';
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

      if (i.estado_pagamento === 'pago') {
        ws.getCell(`G${row.number}`).font = { bold: true, color: { argb: 'FF2E7D32' }, size: 10 };
      }
    });

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

  apagarLinhaExcel(row: Inscricao) {
    if (!row.id) {
      this.dataSource.data = this.dataSource.data.filter((r) => r !== row);
      this.linhasModificadas.delete(row);
      return;
    }
    if (confirm('Apagar esta linha permanentemente?')) {
      this.inscricaoService.deleteInscricao(row.id).then(() => {
        this.dataSource.data = this.dataSource.data.filter((r) => r.id !== row.id);
        this.linhasModificadas.delete(row);
        this.atualizarKPIs(this.dataSource.filteredData);
        this.snackBar.open('Linha eliminada', 'OK', {
          duration: 1500,
          panelClass: 'snackbar-error',
        });
      });
    }
  }

  trackByFn(index: number, item: any) {
    return item.id || index;
  }

  // --- IMPORTAÇÃO INTELIGENTE EXCEL ---

  importarExcel(event: any) {
    const target: DataTransfer = <DataTransfer>event.target;
    if (target.files.length !== 1) return;

    const reader: FileReader = new FileReader();
    reader.onload = (e: any) => {
      // Usar ArrayBuffer para prevenir a corrupção de caracteres em UTF-8 (ex: POÃ‡O)
      const data = new Uint8Array(e.target.result);
      this.fileToProcess = XLSX.read(data, { type: 'array' });

      this.estaAImportar = false;
      this.empresaImportacao = '';
      this.localDestinoImportacao = this.filtroLocal; // Iniciar com local atual
      this.atualizarTurnosImportacao(); // Faz reset e processa automaticamente para a Quinta

      const dialogWidth = this.localDestinoImportacao === 'quinta' ? '1400px' : '950px';
      this.dialog.open(this.dialogImportacao, { width: dialogWidth, disableClose: true });

      if (this.fileInput && this.fileInput.nativeElement) {
        this.fileInput.nativeElement.value = '';
      }
    };
    reader.readAsArrayBuffer(target.files[0]); // Isto resolve os caracteres manchados
  }

  atualizarTurnosImportacao() {
    if (this.todosOsTurnosConfig) {
      const lista = this.todosOsTurnosConfig[this.localDestinoImportacao] || [];
      this.listaTurnosImportacao = lista.map((t: any) => t.nome);
    }
    this.isLocalEspecialImportacao =
      this.localDestinoImportacao === 'costaCaparica' || this.localDestinoImportacao === 'quiaios';
    this.turnoDestinoImportacao = '';
    this.dadosImportacao = { validos: [], duplicados: 0, total: 0 };

    // Para a Quinta, o turno é lido do ficheiro — processa imediatamente sem seleção manual
    if (this.localDestinoImportacao === 'quinta' && this.fileToProcess) {
      this.processarImportacaoQuinta(this.fileToProcess);
    }
  }

  processarFicheiroSelecionado() {
    if (!this.fileToProcess) return;

    if (this.localDestinoImportacao === 'quinta') {
      this.processarImportacaoQuinta(this.fileToProcess);
      return;
    }

    if (!this.turnoDestinoImportacao) return;

    if (this.isLocalEspecialImportacao) {
      this.processarImportacaoEspecial(this.fileToProcess);
    } else {
      this.processarImportacaoNormal(this.fileToProcess);
    }
  }

  private processarImportacaoEspecial(wb: XLSX.WorkBook) {
    let inscricoesProcessadas: any[] = [];
    let duplicadosContador = 0;

    wb.SheetNames.forEach((sheetName) => {
      const ws: XLSX.WorkSheet = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (rawData.length < 2) return;

      let headerRowIndex = -1;
      let colMap = { benef: -1, nome: -1, nasc: -1, sexo: -1 };

      for (let r = 0; r < Math.min(rawData.length, 30); r++) {
        const row = rawData[r];
        if (!row || !Array.isArray(row)) continue;
        let found = 0;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c]).toLowerCase().trim();
          if (
            val === 'nº. benef.' ||
            val === 'nº benef.' ||
            val === 'nº benef' ||
            val.includes('benef')
          ) {
            colMap.benef = c;
            found++;
          }
          if (val === 'nome da criança' || val.includes('nome da criança') || val === 'nome') {
            colMap.nome = c;
            found++;
          }
          if (val === 'data nasc.' || val === 'data nasc' || val.includes('data nasc')) {
            colMap.nasc = c;
            found++;
          }
          if (val === 'sexo' || val === 'género' || val === 'genero') {
            colMap.sexo = c;
            found++;
          }
        }
        if (found >= 3) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1) return;

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const benef = colMap.benef !== -1 ? String(row[colMap.benef]).trim() : '';
        const nome = colMap.nome !== -1 ? String(row[colMap.nome]).trim() : '';
        let nasc = colMap.nasc !== -1 ? row[colMap.nasc] : '';
        const sexoRaw = colMap.sexo !== -1 ? String(row[colMap.sexo]).trim().toUpperCase() : '';

        let sexo = '';
        if (sexoRaw.startsWith('F')) sexo = 'F';
        if (sexoRaw.startsWith('M')) sexo = 'M';

        if (!benef || !nome || !nasc || !sexo || nome.length < 2) continue;

        if (typeof nasc === 'number') {
          const dataExcel = new Date(Math.round((nasc - 25569) * 86400 * 1000));
          nasc = dataExcel.toISOString().split('T')[0];
        } else {
          nasc = String(nasc).trim();
          if (nasc.length < 4) continue;
        }

        const isDuplicado = this.verificarDuplicadoGlobal(
          nome,
          this.turnoDestinoImportacao,
          this.localDestinoImportacao,
          inscricoesProcessadas,
        );
        if (isDuplicado) {
          duplicadosContador++;
          continue;
        }

        inscricoesProcessadas.push({
          turnoEscolhido: this.turnoDestinoImportacao,
          local: this.localDestinoImportacao,
          valor_total: this.getPrecoTurnoImportacao(
            this.turnoDestinoImportacao,
            this.localDestinoImportacao,
          ),
          transporte: 'Não (Entregue pelos pais)',
          autorizaFotoVideo: false,
          estado_pagamento: 'pendente',
          tipoCliente: 'individual',
          nomeInstituicao: '',
          numeroBeneficiario: benef,
          participante: {
            nomeCompleto: nome,
            genero: sexo,
            dataNascimento: nasc,
            nif: '',
            codigoPostal: '',
            cc: '',
            sistemaSaude: '',
          },
          ee: {
            nome: 'EE de ' + nome,
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
        });
      }
    });

    this.dadosImportacao = {
      validos: inscricoesProcessadas,
      duplicados: duplicadosContador,
      total: inscricoesProcessadas.length + duplicadosContador,
    };
  }

  private processarImportacaoNormal(wb: XLSX.WorkBook) {
    let inscricoesProcessadas: any[] = [];
    let duplicadosContador = 0;

    wb.SheetNames.forEach((sheetName) => {
      const ws: XLSX.WorkSheet = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (rawData.length < 2) return;

      const cabecalhosRaw = rawData[0];
      const mapaIndex = this.mapearCabecalhos(cabecalhosRaw);

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0 || !row[mapaIndex.nome]) continue;

        const nomeInscrito = String(row[mapaIndex.nome]).trim();
        if (nomeInscrito.length < 2) continue;

        const isDuplicado = this.verificarDuplicadoGlobal(
          nomeInscrito,
          this.turnoDestinoImportacao,
          this.localDestinoImportacao,
          inscricoesProcessadas,
        );
        if (isDuplicado) {
          duplicadosContador++;
          continue;
        }

        const nova = this.construirObjetoInscricao(row, mapaIndex, this.turnoDestinoImportacao);
        inscricoesProcessadas.push(nova);
      }
    });

    this.dadosImportacao = {
      validos: inscricoesProcessadas,
      duplicados: duplicadosContador,
      total: inscricoesProcessadas.length + duplicadosContador,
    };
  }

  // --- IMPORTAÇÃO ESPECÍFICA QUINTA DA ESCOLA ---
  // O Excel da Quinta contém a coluna "Data do Turno" com o nome do turno do site.
  // Colunas esperadas: Nome Completo, Género, Data Nasc (dd/mm/aaaa), Transporte (Sim ou Não),
  //                    E-mail, Alergias/Medicação, Observações, Telefone contacto, Data do Turno
  private processarImportacaoQuinta(wb: XLSX.WorkBook) {
    const inscricoesProcessadas: any[] = [];
    let duplicadosContador = 0;

    wb.SheetNames.forEach((sheetName) => {
      const ws: XLSX.WorkSheet = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (rawData.length < 2) return;

      let headerRowIndex = -1;
      const colMap: Record<string, number> = {
        nome: -1,
        genero: -1,
        nasc: -1,
        transporte: -1,
        email: -1,
        alergias: -1,
        observacoes: -1,
        telefone: -1,
        turno: -1,
      };

      // Detetar linha de cabeçalho (pesquisa até à linha 10)
      for (let r = 0; r < Math.min(rawData.length, 10); r++) {
        const row = rawData[r];
        if (!row || !Array.isArray(row)) continue;
        let found = 0;
        for (let c = 0; c < row.length; c++) {
          const v = this.normalizarTexto(String(row[c]));
          if ((v === 'nomecompleto' || v === 'nome') && colMap['nome'] === -1) {
            colMap['nome'] = c;
            found++;
          }
          if ((v.includes('genero') || v === 'sexo') && colMap['genero'] === -1) {
            colMap['genero'] = c;
            found++;
          }
          if (
            (v.includes('datanasc') || (v.includes('nasc') && !v.includes('turno'))) &&
            colMap['nasc'] === -1
          ) {
            colMap['nasc'] = c;
            found++;
          }
          if (v.includes('transporte') && colMap['transporte'] === -1) {
            colMap['transporte'] = c;
            found++;
          }
          if ((v.includes('email') || v.includes('mail')) && colMap['email'] === -1) {
            colMap['email'] = c;
            found++;
          }
          if (
            (v.includes('alergia') ||
              v === 'alergiasmedicacao' ||
              (v.includes('medicac') && !v.includes('turno'))) &&
            colMap['alergias'] === -1
          ) {
            colMap['alergias'] = c;
            found++;
          }
          if (v.includes('observac') && colMap['observacoes'] === -1) {
            colMap['observacoes'] = c;
            found++;
          }
          if ((v.includes('telefone') || v.includes('telemovel')) && colMap['telefone'] === -1) {
            colMap['telefone'] = c;
            found++;
          }
          if (
            (v.includes('datadoturno') || (v.includes('turno') && v.includes('data'))) &&
            colMap['turno'] === -1
          ) {
            colMap['turno'] = c;
            found++;
          }
        }
        if (found >= 3 && colMap['nome'] !== -1) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1 || colMap['nome'] === -1) return;

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !Array.isArray(row)) continue;

        const nome = String(row[colMap['nome']] ?? '').trim();
        if (!nome || nome.length < 2) continue;

        // Parsear data de nascimento (suporta dd/mm/aaaa, dd-mm-aaaa e número Excel)
        let nasc = '';
        if (colMap['nasc'] !== -1) {
          const val = row[colMap['nasc']];
          if (typeof val === 'number') {
            nasc = new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0];
          } else {
            const strVal = String(val).trim();
            const parts = strVal.split(/[\/\-]/);
            if (parts.length === 3 && parts[2].length === 4) {
              nasc = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
              nasc = strVal;
            }
          }
        }

        // Parsear género
        const generoRaw =
          colMap['genero'] !== -1 ? String(row[colMap['genero']]).trim().toUpperCase() : '';
        const genero: 'M' | 'F' = generoRaw.startsWith('F') ? 'F' : 'M';

        // Fazer match do turno do Excel com os turnos configurados
        const turnoExcel = colMap['turno'] !== -1 ? String(row[colMap['turno']]).trim() : '';
        const turnoFinal = this.matchTurnoQuinta(turnoExcel);
        if (!turnoFinal) continue;

        // Parsear transporte: "Sim" → primeira opção com custo; "Não" → sem transporte
        const transporteRaw =
          colMap['transporte'] !== -1
            ? String(row[colMap['transporte']]).trim().toLowerCase()
            : 'não';
        const transporte =
          transporteRaw === 'sim'
            ? 'Lisboa - Quinta da Escola (+20€)'
            : 'Não (Entregue pelos pais)';

        const email = colMap['email'] !== -1 ? String(row[colMap['email']]).trim() : '';
        const alergias = colMap['alergias'] !== -1 ? String(row[colMap['alergias']]).trim() : '';
        const observacoes =
          colMap['observacoes'] !== -1 ? String(row[colMap['observacoes']]).trim() : '';
        const telefone =
          colMap['telefone'] !== -1
            ? String(row[colMap['telefone']]).trim().replace(/\s+/g, '')
            : '';

        if (this.verificarDuplicadoGlobal(nome, turnoFinal, 'quinta', inscricoesProcessadas)) {
          duplicadosContador++;
          continue;
        }

        inscricoesProcessadas.push({
          turnoEscolhido: turnoFinal,
          local: 'quinta',
          valor_total: this.getPrecoTurnoImportacao(turnoFinal, 'quinta'),
          transporte,
          autorizaFotoVideo: false,
          estado_pagamento: 'pendente',
          tipoCliente: 'individual',
          nomeInstituicao: '',
          numeroBeneficiario: '',
          observacoes,
          participante: {
            nomeCompleto: nome,
            genero,
            dataNascimento: nasc,
            nif: '',
            codigoPostal: '',
            cc: '',
            sistemaSaude: '',
          },
          ee: {
            nome: '',
            email,
            telefone,
            nif: '',
            contactoEmergencia: '',
          },
          saude: {
            temAlergiaAlimentar: !!alergias,
            detalheAlergiaAlimentar: alergias,
            tomaMedicacao: false,
            detalheMedicacao: '',
          },
        });
      }
    });

    this.dadosImportacao = {
      validos: inscricoesProcessadas,
      duplicados: duplicadosContador,
      total: inscricoesProcessadas.length + duplicadosContador,
    };
  }

  // Faz match fuzzy entre o valor da coluna "Data do Turno" do Excel e os turnos configurados
  private matchTurnoQuinta(turnoExcel: string): string {
    if (!turnoExcel) return '';
    const normExcel = this.normalizarTexto(turnoExcel);

    // 1. Match exacto (após normalização)
    for (const t of this.listaTurnosImportacao) {
      if (this.normalizarTexto(t) === normExcel) return t;
    }
    // 2. Match por contenção parcial
    for (const t of this.listaTurnosImportacao) {
      const normT = this.normalizarTexto(t);
      if (normT.includes(normExcel) || normExcel.includes(normT)) return t;
    }
    // 3. Match pelo número ordinal do turno (ex: "2º" → "2")
    const numMatch = normExcel.match(/\d+/);
    if (numMatch) {
      for (const t of this.listaTurnosImportacao) {
        const normT = this.normalizarTexto(t);
        if (new RegExp(`\\b${numMatch[0]}\\b`).test(normT)) return t;
      }
    }
    // Sem match: devolve o valor bruto (visível na preview; admin pode corrigir)
    return turnoExcel;
  }

  removerImportacao(idx: number) {
    this.dadosImportacao.validos.splice(idx, 1);
    this.dadosImportacao.total--;
  }

  aplicarTurnoATodos() {
    if (this.turnoDestinoImportacao && this.dadosImportacao.validos.length > 0) {
      this.dadosImportacao.validos.forEach((i) => (i.turnoEscolhido = this.turnoDestinoImportacao));
    }
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
    return this.listaTurnos.length > 0 ? this.listaTurnos[0] : 'Turno Importado';
  }

  private verificarDuplicadoGlobal(
    nome: string,
    turno: string,
    local: string,
    filaProcessamento: any[],
  ): boolean {
    const nomeNorm = this.normalizarTexto(nome);
    // O local é guardado na BD no formato formal; a chave interna é 'quinta'/'costaCaparica'/'quiaios'
    const mapaLocaisFormal: Record<string, string> = {
      quinta: 'Quinta',
      costaCaparica: 'Costa da Caparica',
      quiaios: 'Quiaios',
    };
    const localFormal = mapaLocaisFormal[local] ?? local;

    // Duplicado na BD: mesmo nome, mesmo turno E mesmo local
    const existeBD = this.dataSource.data.some(
      (i) =>
        this.normalizarTexto(i.participante.nomeCompleto) === nomeNorm &&
        i.turnoEscolhido === turno &&
        i.local === localFormal,
    );
    if (existeBD) return true;

    // Duplicado dentro do próprio ficheiro Excel (fila de processamento): mesmo nome, turno e local
    const existeFila = filaProcessamento.some(
      (i) =>
        this.normalizarTexto(i.participante.nomeCompleto) === nomeNorm &&
        i.turnoEscolhido === turno &&
        i.local === local,
    );
    return existeFila;
  }

  private getPrecoTurnoImportacao(turnoNome: string, local: string): number {
    if (!this.todosOsTurnosConfig || !turnoNome || !local) return 300;
    const lista: any[] = this.todosOsTurnosConfig[local] || [];
    const t = lista.find((x: any) => x.nome === turnoNome);
    return t?.precoBase ?? 300;
  }

  private construirObjetoInscricao(row: any[], mapa: any, turno: string): any {
    let dataNasc = '';
    if (mapa.nascimento !== undefined && row[mapa.nascimento]) {
      const val = row[mapa.nascimento];
      if (typeof val === 'number') {
        const dataExcel = new Date(Math.round((val - 25569) * 86400 * 1000));
        dataNasc = dataExcel.toISOString().split('T')[0];
      } else {
        dataNasc = val;
      }
    }

    return {
      turnoEscolhido: turno,
      local: this.localDestinoImportacao,
      valor_total:
        mapa.preco !== undefined && row[mapa.preco]
          ? Number(row[mapa.preco])
          : this.getPrecoTurnoImportacao(turno, this.localDestinoImportacao),
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
    const isQuinta = this.localDestinoImportacao === 'quinta';

    if (!isQuinta && !this.turnoDestinoImportacao) {
      this.mostrarNotificacao('É obrigatório selecionar o Turno de Destino.', 'error');
      return;
    }

    this.estaAImportar = true;

    try {
      for (const inscricao of this.dadosImportacao.validos) {
        if (
          !isQuinta &&
          !this.isLocalEspecialImportacao &&
          this.empresaImportacao &&
          this.empresaImportacao.trim() !== ''
        ) {
          inscricao.tipoCliente = 'instituicao';
          inscricao.nomeInstituicao = this.empresaImportacao.trim();
        }

        try {
          await this.inscricaoService.createInscricao(inscricao, false);
        } catch (innerError: any) {
          console.error('Erro numa linha específica:', innerError);
          // O fluxo vai continuar para as outras crianças mesmo que uma falhe
        }
      }

      this.mostrarNotificacao(
        `${this.dadosImportacao.validos.length} Inscrições processadas. A recarregar...`,
      );
      this.recarregarDadosCompletos();
    } catch (error) {
      console.error(error);
      this.mostrarNotificacao('Ocorreu um erro geral.', 'error');
    } finally {
      this.estaAImportar = false;
      this.empresaImportacao = '';
      this.dialog.closeAll();
    }
  }

  cancelarImportacao() {
    this.dadosImportacao = { validos: [], duplicados: 0, total: 0 };
    this.empresaImportacao = '';
    this.fileToProcess = null;
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
