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
      const matchEstado = !searchTerms.estado || data.estadoPagamento === searchTerms.estado;

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
    this.pendentes = dados.filter(i => i.estadoPagamento === 'pendente').length;
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
    const novo = inscricao.estadoPagamento === 'pago' ? 'pendente' : 'pago';

    this.inscricaoService.updateInscricao(inscricao.id, { estadoPagamento: novo }).then(() => {
      inscricao.estadoPagamento = novo;

      // CORREÇÃO 1: Verificar se selectedInscricao existe antes de aceder
      if (this.selectedInscricao && this.selectedInscricao.id === inscricao.id) {
        this.selectedInscricao.estadoPagamento = novo;
      }

      this.mostrarNotificacao(`Estado alterado para ${novo.toUpperCase()}`);
    });
  }

  marcarSelecionadosComo(novoEstado: 'pago' | 'pendente') {
    const selecionados = this.selection.selected;
    if (confirm(`Alterar ${selecionados.length} inscrições para ${novoEstado}?`)) {
      const updates = selecionados.map(i => ({ id: i.id!, estadoPagamento: novoEstado }));

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

    // CORREÇÃO 2: Usar 'any' para permitir a reatribuição de Date para string antes de enviar
    const dados: any = { ...this.selectedInscricao };

    if (dados.participante.dataNascimento instanceof Date) {
      dados.participante.dataNascimento = dados.participante.dataNascimento.toISOString().split('T')[0];
    }

    await this.inscricaoService.updateInscricao(this.selectedInscricao.id, dados);

    this.isEditing = false;
    this.mostrarNotificacao('Dados atualizados!');
    this.recarregarDadosCompletos();
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