import { Component, OnInit, inject, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InscricaoService } from '../../services/inscricao.service';
import { AuthService } from '../../services/auth.service';
import { Inscricao } from '../../models/inscricao.model';
import { FormsModule } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';

// Material Imports
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

// PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    MatDialogModule
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss']
})
export class AdminComponent implements OnInit, AfterViewInit {
  dataSource = new MatTableDataSource<Inscricao>([]);
  colunasMostradas: string[] = ['select', 'estado', 'participante', 'turno', 'contacto', 'acoes'];
  selection = new SelectionModel<Inscricao>(true, []);

  // KPIs
  totalInscritos = 0;
  receitaPrevista = 0;
  pendentes = 0;
  ocupacaoPorTurno: { nome: string, count: number, percent: number }[] = [];

  // Filtros
  filtroTexto = '';
  filtroTurno = '';
  filtroEstado = '';

  listaTurnos = [
    '1º Turno – 28 Junho a 4 Julho', '2º Turno – 5 a 11 Julho', '3º Turno – 12 a 18 Julho',
    '4º Turno – 19 a 25 Julho', '5º Turno – 26 Julho a 1 Agosto', '6º Turno – 2 a 8 Agosto',
    '7º Turno – 9 a 15 Agosto', '8º Turno – 16 a 22 Agosto', '9º Turno – 23 a 29 Agosto',
    '10º Turno – 30 Agosto a 5 Setembro'
  ];

  // Sidebar e Edição
  selectedInscricao: Inscricao | null = null;
  sidebarOpen = false;
  isEditing = false;
  
  // POPUP e PDF
  acaoDialog: 'cozinha' | 'transporte' = 'cozinha'; // <--- Controla a ação
  turnoParaDialog: string = '';
  @ViewChild('dialogTurno') dialogTurno!: TemplateRef<any>;

  private inscricaoService = inject(InscricaoService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit() {
    this.configurarFiltroAvancado();
    this.carregarDados();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  carregarDados() {
    this.inscricaoService.getInscricoes().subscribe(dados => {
      this.dataSource.data = dados;
      this.atualizarKPIs(dados);
      this.calcularOcupacao(dados);
    });
  }

  // --- Lógica Básica ---
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.filteredData.length;
    return numSelected === numRows;
  }
  masterToggle() {
    this.isAllSelected() ? this.selection.clear() : this.dataSource.filteredData.forEach(row => this.selection.select(row));
  }
  atualizarKPIs(dados: Inscricao[]) {
    this.totalInscritos = dados.length;
    this.receitaPrevista = dados.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
    this.pendentes = dados.filter(i => i.estadoPagamento === 'pendente').length;
  }
  calcularOcupacao(dados: Inscricao[]) {
    const counts: any = {};
    dados.forEach(d => { const t = d.turnoEscolhido; counts[t] = (counts[t] || 0) + 1; });
    this.ocupacaoPorTurno = this.listaTurnos.map(turnoNome => {
      const count = counts[turnoNome] || 0;
      return { nome: turnoNome.split(' – ')[0], count: count, percent: (count / 20) * 100 };
    });
  }

  // --- Ações ---
  marcarSelecionadosComo(novoEstado: 'pago' | 'pendente') {
    const selecionados = this.selection.selected;
    if (confirm(`Marcar ${selecionados.length} como ${novoEstado}?`)) {
      selecionados.forEach(i => { if (i.id) this.inscricaoService.updateInscricao(i.id, { estadoPagamento: novoEstado }); });
      this.selection.clear(); this.mostrarNotificacao('Atualizado!');
    }
  }

  apagarSelecionados() {
    const selecionados = this.selection.selected;
    if (confirm(`Apagar ${selecionados.length} registos?`)) {
      selecionados.forEach(i => { if (i.id) this.inscricaoService.deleteInscricao(i.id); });
      this.selection.clear(); this.mostrarNotificacao('Apagado.', 'error');
    }
  }

  togglePagamento(inscricao: Inscricao) {
    if (!inscricao.id) return;
    const novo = inscricao.estadoPagamento === 'pago' ? 'pendente' : 'pago';
    this.inscricaoService.updateInscricao(inscricao.id, { estadoPagamento: novo });
    if (this.selectedInscricao?.id === inscricao.id) this.selectedInscricao.estadoPagamento = novo;
    this.mostrarNotificacao(`Estado alterado para ${novo.toUpperCase()}`);
  }

  // --- Sidebar ---
  abrirDetalhes(row: Inscricao) {
    this.selectedInscricao = JSON.parse(JSON.stringify(row));
    if (this.selectedInscricao?.participante.dataNascimento) {
      this.selectedInscricao.participante.dataNascimento = new Date(this.selectedInscricao.participante.dataNascimento);
    }
    this.sidebarOpen = true; this.isEditing = false;
    document.body.style.overflow = 'hidden';
  }

  fecharDetalhes() {
    if (this.isEditing && !confirm('Sair sem guardar?')) return;
    this.sidebarOpen = false; this.isEditing = false;
    setTimeout(() => this.selectedInscricao = null, 300);
    document.body.style.overflow = 'auto';
  }

  ativarEdicao() { this.isEditing = true; }

  async guardarEdicao() {
    if (!this.selectedInscricao?.id) return;
    try {
      await this.inscricaoService.updateInscricao(this.selectedInscricao.id, this.selectedInscricao);
      this.mostrarNotificacao('Guardado!'); this.isEditing = false;
    } catch (e) { this.mostrarNotificacao('Erro ao guardar.', 'error'); }
  }

  apagarInscricao(id?: string) {
    if (!id) return;
    if (confirm('Eliminar permanentemente?')) {
      this.inscricaoService.deleteInscricao(id);
      this.fecharDetalhes(); this.mostrarNotificacao('Apagado.', 'error');
    }
  }

  reenviarEmail(inscricao: Inscricao) {
    if(!confirm(`Enviar email de confirmação para ${inscricao.ee.email}?`)) return;
    this.mostrarNotificacao('A processar pedido...', 'success');
    this.inscricaoService.enviarEmailSeguro(inscricao);
    this.mostrarNotificacao('Email enviado para o servidor de correio!');
  }

  // --- Filtros ---
  configurarFiltroAvancado() {
    this.dataSource.filterPredicate = (data: Inscricao, filter: string) => {
      const searchTerms = JSON.parse(filter);
      const matchTexto = this.filtroTexto 
        ? (data.participante.nomeCompleto.toLowerCase().includes(searchTerms.texto) || 
           data.ee.email.toLowerCase().includes(searchTerms.texto)) : true;
      const matchTurno = this.filtroTurno ? data.turnoEscolhido === searchTerms.turno : true;
      const matchEstado = this.filtroEstado ? data.estadoPagamento === searchTerms.estado : true;
      return matchTexto && matchTurno && matchEstado;
    };
  }

  atualizarFiltros() {
    const filtros = { texto: this.filtroTexto.trim().toLowerCase(), turno: this.filtroTurno, estado: this.filtroEstado };
    this.dataSource.filter = JSON.stringify(filtros);
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  limparFiltros() { this.filtroTexto = ''; this.filtroTurno = ''; this.filtroEstado = ''; this.atualizarFiltros(); }

  mostrarNotificacao(msg: string, tipo: 'success'|'error' = 'success') {
    this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: tipo === 'error' ? ['snackbar-error'] : ['snackbar-success'] });
  }

  abrirWhatsApp(telefone: string) {
    let num = telefone.replace(/[^0-9]/g, '');
    if (!num.startsWith('351') && num.length === 9) num = '351' + num;
    window.open(`https://wa.me/${num}`, '_blank');
  }

  sair() { this.authService.logout(); }

  async gerarDadosTeste() {
    // ... Código igual ao anterior ...
  }


  // --- LÓGICA DO DIALOG (Popup) ---

  // 1. Botão Cozinha
  verificarTurnoParaCozinha() {
    if (this.filtroTurno) {
      this.gerarPDFCozinha(this.filtroTurno);
    } else {
      this.acaoDialog = 'cozinha'; // Define ação para o popup
      this.turnoParaDialog = ''; 
      this.dialog.open(this.dialogTurno, { width: '400px' });
    }
  }

  // 2. Botão Transportes
  verificarTurnoParaTransporte() {
    if (this.filtroTurno) {
      this.gerarPDFTransporte(this.filtroTurno);
    } else {
      this.acaoDialog = 'transporte'; // Define ação para o popup
      this.turnoParaDialog = '';
      this.dialog.open(this.dialogTurno, { width: '400px' });
    }
  }

  // 3. Botão "Gerar" DENTRO do Popup
  confirmarGeracaoPDF() {
    if (!this.turnoParaDialog) return;
    
    if (this.acaoDialog === 'cozinha') {
      this.gerarPDFCozinha(this.turnoParaDialog);
    } else {
      this.gerarPDFTransporte(this.turnoParaDialog);
    }
    
    this.dialog.closeAll();
  }


  // --- GERAÇÃO DE PDFS ---

  gerarPDFCozinha(turnoSelecionado: string) {
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleDateString('pt-PT');
    
    doc.setFontSize(16); doc.setTextColor(220, 53, 69); doc.text('ALERTA COZINHA', 14, 20);
    doc.setTextColor(0, 0, 0); doc.setFontSize(12); doc.text(`Turno: ${turnoSelecionado}`, 14, 28);
    
    const listaPerigosa = this.dataSource.data.filter(i => 
      i.turnoEscolhido === turnoSelecionado && 
      (i.saude.temAlergiaAlimentar || i.saude.temOutrasAlergias )
    );

    if (listaPerigosa.length === 0) { this.mostrarNotificacao(`Sem restrições neste turno.`, 'error'); return; }

    // --- CORREÇÃO: COLUNAS LIMPAS ---
    const linhas = listaPerigosa.map(item => [
      item.participante.nomeCompleto,
      item.saude.detalheAlergiaAlimentar || '-',
    ]);

    autoTable(doc, {
      head: [['Nome da Criança', 'Detalhe Alergias']],
      body: linhas, startY: 40, theme: 'grid',
      headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold' }
    });

    doc.save(`Cozinha_${turnoSelecionado.split(' – ')[0]}.pdf`);
    this.mostrarNotificacao('Lista enviada para a cozinha! 👨‍🍳');
  }

gerarPDFTransporte(turnoSelecionado: string) {
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleDateString('pt-PT');
    
    // Configuração Inicial
    doc.setFontSize(18);
    doc.setTextColor(25, 118, 210); // Azul
    doc.text('LISTA DE TRANSPORTES QE', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Turno: ${turnoSelecionado}`, 14, 28);

    // Filtrar Todos do Turno que têm transporte
    const todosTransporte = this.dataSource.data.filter(i => 
      i.turnoEscolhido === turnoSelecionado && 
      i.transporte && 
      !i.transporte.startsWith('Não')
    );

    if (todosTransporte.length === 0) {
      this.mostrarNotificacao('Ninguém pediu transporte neste turno.', 'error');
      return;
    }

    // --- TABELA 1: LISBOA -> QUINTA DA ESCOLA (Ida) ---
    const listaIda = todosTransporte.filter(i => 
      i.transporte.includes('Lisboa - Quinta') || i.transporte.includes('Lisboa - Quinta - Lisboa')
    ).sort((a,b) => a.participante.nomeCompleto.localeCompare(b.participante.nomeCompleto));

    let currentY = 35;

    if (listaIda.length > 0) {
      doc.setFontSize(13);
      doc.setTextColor(0);
      doc.text('Lisboa -> Quinta da Escola', 14, currentY);
      currentY += 5;

      const linhasIda = listaIda.map(item => [
        item.participante.nomeCompleto,
        item.ee.telefone,
        item.transporte.includes('(+40€)') ? 'Ida e Volta' : 'Só Ida',
        '' // <--- Deixamos vazio para desenhar o quadrado depois
      ]);

      autoTable(doc, {
        head: [['Criança', 'Telefone EE', 'Modalidade', 'Check']],
        body: linhasIda,
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [46, 125, 50] }, // Verde para a Ida
        styles: { fontSize: 11, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          3: { halign: 'center' }
        },
        // --- O SEGREDO ESTÁ AQUI: Desenhar o quadrado manualmente ---
        didDrawCell: (data) => {
          // Se for a secção do corpo e a coluna for a índice 3 (a 4ª coluna, do Check)
          if (data.section === 'body' && data.column.index === 3) {
            const dim = 4; // Tamanho do quadrado (4x4 mm)
            const x = data.cell.x + (data.cell.width - dim) / 2; // Centrar X
            const y = data.cell.y + (data.cell.height - dim) / 2; // Centrar Y
            
            doc.setDrawColor(100); // Cor da linha (cinzento escuro)
            doc.rect(x, y, dim, dim); // Desenha o retângulo
          }
        }
      });

      // Atualiza o Y para a próxima tabela
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- TABELA 2: QUINTA DA ESCOLA -> LISBOA (Volta) ---
    const listaVolta = todosTransporte.filter(i => 
      i.transporte.includes('Quinta da Escola - Lisboa') || i.transporte.includes('Lisboa - Quinta - Lisboa')
    ).sort((a,b) => a.participante.nomeCompleto.localeCompare(b.participante.nomeCompleto));

    if (listaVolta.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }

      doc.setFontSize(13);
      doc.setTextColor(0);
      doc.text('Quinta da Escola -> Lisboa', 14, currentY);
      currentY += 5;

      const linhasVolta = listaVolta.map(item => [
        item.participante.nomeCompleto,
        item.ee.telefone,
        item.transporte.includes('(+40€)') ? 'Ida e Volta' : 'Só Volta',
        '' // <--- Vazio
      ]);

      autoTable(doc, {
        head: [['Criança', 'Telefone EE', 'Modalidade', 'Check']],
        body: linhasVolta,
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [198, 40, 40] }, // Vermelho para a Volta
        styles: { fontSize: 11, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          3: { halign: 'center' }
        },
        // --- Desenhar o quadrado na tabela da volta também ---
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const dim = 4;
            const x = data.cell.x + (data.cell.width - dim) / 2;
            const y = data.cell.y + (data.cell.height - dim) / 2;
            doc.setDrawColor(100);
            doc.rect(x, y, dim, dim);
          }
        }
      });
    }

    doc.save(`Transportes_${turnoSelecionado.split(' – ')[0]}.pdf`);
    this.mostrarNotificacao('Listas de autocarro geradas! 🚌');
  }
}