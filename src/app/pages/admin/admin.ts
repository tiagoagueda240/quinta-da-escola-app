import { Component, OnInit, inject, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  // Dados Dinâmicos do Firebase
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
  @ViewChild('dialogTurno') dialogTurno!: TemplateRef<any>;

  private inscricaoService = inject(InscricaoService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  async ngOnInit() {
    // Carrega configuração inicial e define os turnos
    await this.recarregarDadosCompletos();

    this.configurarFiltroAvancado();

    // Subscreve às inscrições (Dados das crianças)
    this.inscricaoService.getInscricoes().subscribe(dados => {
      this.dataSource.data = dados;
      // Sempre que chegam novos dados de inscrições, recalculamos tudo
      this.atualizarFiltros();
    });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  async carregarTurnosEDados() {
    try {
      const config = await this.inscricaoService.getConfiguracoesTurnos();
      if (config) {
        this.todosOsTurnosConfig = config;
        this.atualizarListaDeTurnosPorLocal();

        // Subscreve às inscrições
        this.inscricaoService.getInscricoes().subscribe(dados => {
          this.dataSource.data = dados;
          this.atualizarFiltros(); // Aplica o filtro de local inicial
        });
      }
    } catch (error) {
      this.mostrarNotificacao('Erro ao carregar configurações do Firebase', 'error');
    }
  }

  atualizarListaDeTurnosPorLocal() {
    if (this.todosOsTurnosConfig) {

      // AGORA: Vamos buscar a lista E convertemos logo para texto (.map)
      const listaBruta = this.todosOsTurnosConfig[this.filtroLocal] || [];

      // Extraímos apenas o 'nome' de cada objeto para ficar uma lista de strings
      this.listaTurnos = listaBruta.map((t: any) => t.nome);

      this.filtroTurno = '';
      this.atualizarFiltros();
    }
  }

  configurarFiltroAvancado() {
    this.dataSource.filterPredicate = (data: Inscricao, filter: string) => {
      const searchTerms = JSON.parse(filter);

      // Mapeamento para bater com o campo 'local' do model
      const mapaLocais: any = {
        'quinta': 'Quinta',
        'costaCaparica': 'Costa da Caparica',
        'quiaios': 'Quiaios'
      };

      const matchLocal = data.local === mapaLocais[this.filtroLocal];
      const matchTexto = searchTerms.texto ?
        data.participante.nomeCompleto.toLowerCase().includes(searchTerms.texto) ||
        data.ee.nome.toLowerCase().includes(searchTerms.texto) : true;
      const matchTurno = searchTerms.turno ? data.turnoEscolhido === searchTerms.turno : true;
      const matchEstado = searchTerms.estado ? data.estadoPagamento === searchTerms.estado : true;

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
    this.totalRapazes = dados.filter(i => i.participante.genero === 'M').length;
    this.totalRaparigas = dados.filter(i => i.participante.genero === 'F').length;
  }

  calcularOcupacao(dados: Inscricao[]) {
    // 1. Contar quantos inscritos existem por turno
    const counts: any = {};
    dados.forEach(d => {
      counts[d.turnoEscolhido] = (counts[d.turnoEscolhido] || 0) + 1;
    });

    // 2. Obter a configuração completa (Objetos com nome, limite, ativo)
    const configLocal = this.todosOsTurnosConfig[this.filtroLocal] || [];

    // 3. Mapear para o formato do Widget
    this.ocupacaoPorTurno = configLocal
      .filter((t: any) => {
        // LÓGICA DE EXIBIÇÃO:
        // Mostra o turno se estiver 'Ativo' OU se tiver alguém inscrito (mesmo que inativo)
        // Isto esconde turnos inativos que estão vazios (0 inscritos).
        return t.ativo === true || (counts[t.nome] && counts[t.nome] > 0);
      })
      .map((t: any) => {
        const count = counts[t.nome] || 0;
        const limiteReal = t.limite || 80; // Usa o limite configurado ou 80 por defeito

        // Limpeza visual do nome (remove datas longas se houver hífen)
        // Ex: "1º Turno - 28 Junho..." vira "1º Turno" para caber na caixa pequena
        const nomeCurto = t.nome.includes('–') ? t.nome.split(' – ')[0] : t.nome.split('-')[0];

        return {
          nome: nomeCurto,
          count: count,
          total: limiteReal,
          percent: (count / limiteReal) * 100
        };
      });
  }

  // --- Ações de Tabela ---

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
    this.inscricaoService.updateInscricao(inscricao.id, { estadoPagamento: novo });
    if (this.selectedInscricao?.id === inscricao.id) this.selectedInscricao.estadoPagamento = novo;
    this.mostrarNotificacao(`Estado alterado para ${novo.toUpperCase()}`);
  }


  marcarSelecionadosComo(novoEstado: 'pago' | 'pendente') {
    const selecionados = this.selection.selected;
    if (confirm(`Alterar ${selecionados.length} inscrições para ${novoEstado}?`)) {
      selecionados.forEach(i => {
        if (i.id) this.inscricaoService.updateInscricao(i.id, { estadoPagamento: novoEstado });
      });
      this.selection.clear();
    }
  }

  apagarSelecionados() {
    const selecionados = this.selection.selected;
    if (confirm(`Apagar ${selecionados.length} registos permanentemente?`)) {
      selecionados.forEach(i => { if (i.id) this.inscricaoService.deleteInscricao(i.id); });
      this.selection.clear();
    }
  }

  // --- Sidebar e Edição ---

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
    await this.inscricaoService.updateInscricao(this.selectedInscricao.id, this.selectedInscricao);
    this.isEditing = false;
    this.mostrarNotificacao('Dados atualizados!');
  }

  // --- PDF e Helpers ---

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
      this.inscricaoService.deleteInscricao(id);
      this.fecharDetalhes(); this.mostrarNotificacao('Apagado.', 'error');
    }
  }

  abrirConfigTurnos() {
    const dialogRef = this.dialog.open(ConfigTurnosComponent, { width: '600px' });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        // Se houve alterações (result === true), recarregamos TUDO
        await this.recarregarDadosCompletos();

        // Notificação visual para confirmar a atualização
      }
    });
  }

  async recarregarDadosCompletos() {
    try {
      // 1. Buscar a configuração mais recente à base de dados
      const config = await this.inscricaoService.getConfiguracoesTurnos();

      if (config) {
        this.todosOsTurnosConfig = config;

        // 2. Atualizar a lista do dropdown (Filtrar apenas os ativos)
        this.atualizarListaDeTurnosPorLocal();

        // 3. Forçar o recálculo dos gráficos de ocupação com os novos limites
        // (Nota: Chamamos atualizarFiltros porque ele invoca o calcularOcupacao internamente)
        this.atualizarFiltros();
      }
    } catch (error) {
      this.mostrarNotificacao('Erro ao atualizar dados.', 'error');
    }
  }

  async carregarTurnosDoServidor() {
    // AQUI ESTÁ O SEGREDO: Usamos o método getTurnosAtivos
    // Assim, no dropdown só aparecem os que marcaste como "Ativo: true"
    this.listaTurnos = await this.inscricaoService.getTurnosAtivos('quinta');
  }

  sair() { this.authService.logout(); }
}