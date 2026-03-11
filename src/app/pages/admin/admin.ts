import { Component, OnInit, inject, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { InscricaoService } from '../../services/inscricao.service';
import { AuthService } from '../../services/auth.service';
import { Inscricao } from '../../models/inscricao.model';
import { FormsModule } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { ConfigTurnosComponent } from '../../components/config-turnos.component';
import { DialogGerarAcessoComponent } from '../../components/gerar-acesso.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatSortModule, MatMenuModule, MatTooltipModule,
    MatSelectModule, MatPaginatorModule, MatCheckboxModule, MatSnackBarModule,
    MatProgressBarModule, MatDialogModule
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss']
})
export class AdminComponent implements OnInit, AfterViewInit {
  dataSource = new MatTableDataSource<Inscricao>([]);
  colunasMostradas: string[] = ['select', 'estado', 'participante', 'turno', 'contacto', 'acoes'];
  selection = new SelectionModel<Inscricao>(true, []);

  todosOsTurnosConfig: any = null;
  listaTurnos: string[] = [];

  // KPIs
  totalInscritos = 0;
  pendentes = 0;
  totalRapazes = 0;
  totalRaparigas = 0;
  ocupacaoPorTurno: { nome: string, count: number, percent: number }[] = [];

  // Filtros
  filtroLocal: 'quinta' | 'costaCaparica' | 'quiaios' = 'quinta';
  filtroTexto = '';
  filtroTurno = '';
  filtroEstado = '';

  // Sidebar e Modals
  selectedInscricao: Inscricao | null = null;
  sidebarOpen = false;
  isEditing = false;
  acaoDialog: 'cozinha' | 'transporte' = 'cozinha';
  turnoParaDialog: string = '';
  linkGerado: string = '';

  // Variáveis para Importação de Excel
  @ViewChild('fileInput') fileInput!: any;
  @ViewChild('dialogImportacao') dialogImportacao!: TemplateRef<any>;
  estaAImportar = false;
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
    preco: ['preco', 'precototal', 'valor', 'valortotal']
  };

  @ViewChild('dialogTurno') dialogTurno!: TemplateRef<any>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private inscricaoService = inject(InscricaoService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private http = inject(HttpClient);

  async ngOnInit() {
    await this.recarregarDadosCompletos();
    this.configurarFiltroAvancado();
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

      this.inscricaoService.getInscricoes().subscribe(dados => {
        this.dataSource.data = dados;
        this.atualizarFiltros();
      });

    } catch (error) {
      this.mostrarNotificacao('Erro ao carregar dados.', 'error');
    }
  }

  atualizarListaDeTurnosPorLocal() {
    if (this.todosOsTurnosConfig) {
      const listaBruta = this.todosOsTurnosConfig[this.filtroLocal] || [];
      this.listaTurnos = listaBruta
        .filter((t: any) => t.ativo === true)
        .map((t: any) => t.nome);

      this.filtroTurno = '';
      this.atualizarFiltros();
    }
  }

  // --- FILTROS E PESQUISA ---

  configurarFiltroAvancado() {
    this.dataSource.filterPredicate = (data: Inscricao, filter: string) => {
      const searchTerms = JSON.parse(filter);

      const mapaLocais: any = {
        'quinta': 'Quinta',
        'costaCaparica': 'Costa da Caparica',
        'quiaios': 'Quiaios'
      };

      const localData = (data.local || '').toLowerCase();
      const localFiltro = (mapaLocais[this.filtroLocal] || '').toLowerCase();
      const matchLocal = localData === localFiltro;

      const texto = searchTerms.texto;
      const matchTexto = !texto ||
        (data.participante?.nomeCompleto || '').toLowerCase().includes(texto) ||
        (data.ee?.nome || '').toLowerCase().includes(texto);

      const matchTurno = !searchTerms.turno || data.turnoEscolhido === searchTerms.turno;
      const matchEstado = !searchTerms.estado || data.estado_pagamento === searchTerms.estado;

      return matchLocal && matchTexto && matchTurno && matchEstado;
    };
  }

  atualizarFiltros() {
    const filtros = {
      texto: this.filtroTexto.trim().toLowerCase(),
      turno: this.filtroTurno,
      estado: this.filtroEstado
    };
    this.dataSource.filter = JSON.stringify(filtros);

    const dadosFiltrados = this.dataSource.filteredData;
    this.atualizarKPIs(dadosFiltrados);
    this.calcularOcupacao(dadosFiltrados);

    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  atualizarKPIs(dados: Inscricao[]) {
    this.totalInscritos = dados.length;
    this.pendentes = dados.filter(i => i.estado_pagamento === 'pendente').length;
    this.totalRapazes = dados.filter(i => i.participante?.genero === 'M').length;
    this.totalRaparigas = dados.filter(i => i.participante?.genero === 'F').length;
  }

  calcularOcupacao(dados: Inscricao[]) {
    const counts: any = {};
    dados.forEach(d => {
      counts[d.turnoEscolhido] = (counts[d.turnoEscolhido] || 0) + 1;
    });

    const configLocal = this.todosOsTurnosConfig ? (this.todosOsTurnosConfig[this.filtroLocal] || []) : [];

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
          percent: (count / limiteReal) * 100
        };
      });
  }

  // --- INTERAÇÕES UI ---

  isAllSelected() {
    return this.selection.selected.length === this.dataSource.filteredData.length;
  }

  masterToggle() {
    this.isAllSelected() ?
      this.selection.clear() :
      this.dataSource.filteredData.forEach(row => this.selection.select(row));
  }

  togglePagamento(inscricao: Inscricao) {
    if (!inscricao.id) return;
    const novo = inscricao.estado_pagamento === 'pago' ? 'pendente' : 'pago';

    this.inscricaoService.updateInscricao(inscricao.id, { estado_pagamento: novo }).then(() => {
      inscricao.estado_pagamento = novo;

      if (this.selectedInscricao && this.selectedInscricao.id === inscricao.id) {
        this.selectedInscricao.estado_pagamento = novo;
      }

      this.mostrarNotificacao(`Estado alterado para ${novo.toUpperCase()}`);
    });
  }

  marcarSelecionadosComo(novoEstado: 'pago' | 'pendente') {
    const selecionados = this.selection.selected;
    if (confirm(`Alterar ${selecionados.length} inscrições para ${novoEstado}?`)) {
      const updates = selecionados.map(i => ({ id: i.id!, estado_pagamento: novoEstado }));

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
      const promessas = selecionados.map(i => i.id ? this.inscricaoService.deleteInscricao(i.id) : Promise.resolve());

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
      this.selectedInscricao.participante.dataNascimento = new Date(this.selectedInscricao.participante.dataNascimento);
    }
    this.sidebarOpen = true;
    this.isEditing = false;
  }

  fecharDetalhes() {
    this.sidebarOpen = false;
    setTimeout(() => this.selectedInscricao = null, 300);
  }

  async guardarEdicao() {
    if (!this.selectedInscricao?.id) return;

    const dados: any = { ...this.selectedInscricao };

    if (dados.participante.dataNascimento instanceof Date) {
      dados.participante.dataNascimento = dados.participante.dataNascimento.toISOString().split('T')[0];
    }

    await this.inscricaoService.updateInscricao(this.selectedInscricao.id, dados);

    this.isEditing = false;
    this.mostrarNotificacao('Dados atualizados!');
    this.recarregarDadosCompletos();
  }

  // --- IMPORTAÇÃO INTELIGENTE EXCEL ---

  importarExcel(event: any) {
    const target: DataTransfer = <DataTransfer>(event.target);
    if (target.files.length !== 1) return;

    this.estaAImportar = false;
    this.dadosImportacao = { validos: [], duplicados: 0, total: 0 };
    this.dialog.open(this.dialogImportacao, { width: '500px', disableClose: true });

    const reader: FileReader = new FileReader();
    reader.onload = (e: any) => {
      const bstr: string = e.target.result;
      const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

      let inscricoesProcessadas: any[] = [];
      let duplicadosContador = 0;

      // 1. Iterar por todas as abas (Sheets)
      wb.SheetNames.forEach(sheetName => {
        const ws: XLSX.WorkSheet = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rawData.length < 2) return; // Aba vazia

        // 2. Mapeamento Inteligente de Cabeçalhos
        const cabecalhosRaw = rawData[0];
        const mapaIndex = this.mapearCabecalhos(cabecalhosRaw);

        // 3. Advinhar o Turno com base no nome da Aba
        const turnoAdivinhado = this.adivinharTurnoDaAba(sheetName);

        // 4. Processar linhas
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0 || !row[mapaIndex.nome]) continue; // Ignora linhas vazias

          const nomeInscrito = String(row[mapaIndex.nome]).trim();
          if (nomeInscrito.length < 2) continue;

          // 5. Verificar Duplicados (Na BD e no Array atual de processamento)
          const isDuplicado = this.verificarDuplicadoGlobal(nomeInscrito, turnoAdivinhado, inscricoesProcessadas);

          if (isDuplicado) {
            duplicadosContador++;
            continue;
          }

          // 6. Construir objeto resiliente (sem fallbacks fantasmas)
          const nova = this.construirObjetoInscricao(row, mapaIndex, turnoAdivinhado);
          inscricoesProcessadas.push(nova);
        }
      });

      this.dadosImportacao = {
        validos: inscricoesProcessadas,
        duplicados: duplicadosContador,
        total: inscricoesProcessadas.length + duplicadosContador
      };

      // Reset ao input type=file
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
        if (sinonimos.some(s => cabNormalizado.includes(s))) {
          if (mapa[chave] === undefined) mapa[chave] = index; // Pega o primeiro match
        }
      }
    });
    // Se não encontrou o nome, assume que é a 2ª coluna (índice 1) baseando nos excels de exemplo
    if (mapa.nome === undefined) mapa.nome = 1;
    return mapa;
  }

  private adivinharTurnoDaAba(sheetName: string): string {
    const nomeNorm = this.normalizarTexto(sheetName);

    // Tenta encontrar match perfeito ou substring com as listas de turnos atuais
    for (let t of this.listaTurnos) {
      if (this.normalizarTexto(t).includes(nomeNorm) || nomeNorm.includes(this.normalizarTexto(t))) {
        return t;
      }
    }

    // Tenta detetar números (ex: "1º turno" -> "1º Turno")
    const matchNumero = sheetName.match(/(\d+)º/);
    if (matchNumero) {
      const t = this.listaTurnos.find(turno => turno.includes(`${matchNumero[1]}º`));
      if (t) return t;
    }

    // Tenta encontrar palavras chaves como Pascoa ou Natal
    if (nomeNorm.includes('pascoa')) return this.listaTurnos.find(t => this.normalizarTexto(t).includes('pascoa')) || this.listaTurnos[0];
    if (nomeNorm.includes('natal')) return this.listaTurnos.find(t => this.normalizarTexto(t).includes('natal')) || this.listaTurnos[0];

    // Fallback absoluto
    return this.listaTurnos.length > 0 ? this.listaTurnos[0] : 'Turno Importado';
  }

  private verificarDuplicadoGlobal(nome: string, turno: string, filaProcessamento: any[]): boolean {
    const nomeNorm = this.normalizarTexto(nome);

    // Verifica na BD
    const existeBD = this.dataSource.data.some(i =>
      this.normalizarTexto(i.participante.nomeCompleto) === nomeNorm && i.turnoEscolhido === turno
    );
    if (existeBD) return true;

    // Verifica na fila atual (mesmo excel com abas repetidas)
    const existeFila = filaProcessamento.some(i =>
      this.normalizarTexto(i.participante.nomeCompleto) === nomeNorm && i.turnoEscolhido === turno
    );
    return existeFila;
  }

  private construirObjetoInscricao(row: any[], mapa: any, turno: string): any {
    // Parser inteligente de data (Excel serial para YYYY-MM-DD)
    let dataNasc = '';
    if (mapa.nascimento !== undefined && row[mapa.nascimento]) {
      const val = row[mapa.nascimento];
      if (typeof val === 'number') {
        const dataExcel = new Date((val - (25567 + 2)) * 86400 * 1000);
        dataNasc = dataExcel.toISOString().split('T')[0];
      } else {
        // Tenta fazer o parse de uma string DD/MM/YYYY ou YYYY-MM-DD
        dataNasc = val;
      }
    }

    return {
      turnoEscolhido: turno,
      local: this.filtroLocal,
      valor_total: (mapa.preco !== undefined && row[mapa.preco]) ? Number(row[mapa.preco]) : 300,
      transporte: (mapa.transporte !== undefined && row[mapa.transporte]) ? String(row[mapa.transporte]) : '',
      autorizaFotoVideo: false, // Default false se o excel não disser
      estado_pagamento: 'pendente',

      participante: {
        nomeCompleto: String(row[mapa.nome]).trim(),
        genero: (mapa.genero !== undefined && row[mapa.genero]) ? String(row[mapa.genero]).toUpperCase().charAt(0) : '',
        dataNascimento: dataNasc,
        nif: '', // Deixa vazio em vez de colocar lixo
        morada: '',
        cc: '',
        sistemaSaude: '',
        tamanhoTshirt: ''
      },
      ee: {
        nome: (mapa.ee !== undefined && row[mapa.ee]) ? String(row[mapa.ee]).trim() : 'EE de ' + String(row[mapa.nome]).trim(),
        email: (mapa.email !== undefined && row[mapa.email]) ? String(row[mapa.email]).trim() : '',
        telefone: (mapa.telefone !== undefined && row[mapa.telefone]) ? String(row[mapa.telefone]).replace(/\D/g, '') : '',
        nif: (mapa.nif !== undefined && row[mapa.nif]) ? String(row[mapa.nif]) : '',
        contactoEmergencia: ''
      },
      saude: {
        temAlergiaAlimentar: false,
        temOutrasAlergias: false,
        tomaMedicacao: false,
        alergiaDetalhes: (mapa.alergias !== undefined && row[mapa.alergias]) ? String(row[mapa.alergias]) : '',
        medicacaoHabitual: ''
      }
    };
  }

  private normalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  }

  async confirmarImportacao() {
    this.estaAImportar = true;

    try {
      // Processamento sequencial/batch para não sobrecarregar o PHP
      for (const inscricao of this.dadosImportacao.validos) {
        await this.inscricaoService.addInscricao(inscricao);
      }

      this.mostrarNotificacao(`${this.dadosImportacao.validos.length} Inscrições importadas com sucesso!`);
      this.recarregarDadosCompletos();
    } catch (error) {
      console.error(error);
      this.mostrarNotificacao('Ocorreu um erro na importação de algumas linhas.', 'error');
    } finally {
      this.estaAImportar = false;
      this.dialog.closeAll();
    }
  }

  cancelarImportacao() {
    this.dadosImportacao = { validos: [], duplicados: 0, total: 0 };
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
    const lista = this.dataSource.data.filter(i => i.turnoEscolhido === turno && (i.saude.temAlergiaAlimentar || i.saude.temOutrasAlergias));

    doc.text(`Restrições Alimentares - ${turno}`, 14, 20);
    autoTable(doc, {
      head: [['Participante', 'Alergia/Restrição']],
      body: lista.map(i => [i.participante.nomeCompleto, i.saude.detalheAlergiaAlimentar || i.saude.detalheOutrasAlergias || 'Não especificado']),
      startY: 30
    });
    doc.save(`Cozinha_${this.filtroLocal}.pdf`);
  }

  gerarPDFTransporte(turno: string) {
    const doc = new jsPDF();
    const lista = this.dataSource.data.filter(i => i.turnoEscolhido === turno && i.transporte !== 'Não (Entregue pelos pais)');

    doc.text(`Lista de Transportes - ${turno}`, 14, 20);
    autoTable(doc, {
      head: [['Participante', 'Tipo Transporte', 'Contacto']],
      body: lista.map(i => [i.participante.nomeCompleto, i.transporte, i.ee.telefone]),
      startY: 30
    });
    doc.save(`Transportes_${this.filtroLocal}.pdf`);
  }

  abrirWhatsApp(tel: string) {
    if (!tel) return;
    const n = tel.replace(/\s/g, '');
    window.open(`https://wa.me/351${n}`, '_blank');
  }

  mostrarNotificacao(m: string, t: 'success' | 'error' = 'success') {
    this.snackBar.open(m, 'OK', { duration: 3000, panelClass: t === 'success' ? 'snackbar-success' : 'snackbar-error' });
  }

  limparFiltros() {
    this.filtroTexto = '';
    this.filtroTurno = '';
    this.filtroEstado = '';
    this.atualizarFiltros();
  }

  ativarEdicao() { this.isEditing = true; }

  reenviarEmail(inscricao: Inscricao) {
    if (!confirm(`Enviar email de confirmação para ${inscricao.ee.email}?`)) return;
    this.mostrarNotificacao('A processar pedido...', 'success');
    this.inscricaoService.enviarEmailSeguro(inscricao);
    this.mostrarNotificacao('Email enviado para o servidor de correio!');
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
      const turnoObj = this.todosOsTurnosConfig[this.filtroLocal].find((t: any) => t.nome === this.filtroTurno);

      if (turnoObj && turnoObj.coordenadores && Array.isArray(turnoObj.coordenadores)) {
        nomeFinal = turnoObj.coordenadores
          .filter((c: string) => c && c.trim() !== '')
          .join(' & ');
      }
    }

    this.dialog.open(DialogGerarAcessoComponent, {
      width: '500px',
      data: {
        local: this.filtroLocal,
        turno: this.filtroTurno,
        nomePredefinido: nomeFinal
      }
    });
  }

  sair() { this.authService.logout(); }
}