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

  // KPIs
  totalInscritos = 0;
  pendentes = 0;
  
  // --- KPI: DISTRIBUIÇÃO GÉNERO ---
  totalRapazes = 0;
  totalRaparigas = 0;
  
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
  acaoDialog: 'cozinha' | 'transporte' = 'cozinha';
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
      // Atualiza KPIs com base nos dados totais ou filtrados (aqui usamos totais iniciais)
      this.atualizarKPIs(dados); 
      this.calcularOcupacao(dados);
    });
  }

  // --- Lógica de Seleção ---
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.filteredData.length;
    return numSelected === numRows;
  }
  masterToggle() {
    this.isAllSelected() ? this.selection.clear() : this.dataSource.filteredData.forEach(row => this.selection.select(row));
  }

  // --- KPIs ---
  atualizarKPIs(dados: Inscricao[]) {
    this.totalInscritos = dados.length;
    this.pendentes = dados.filter(i => i.estadoPagamento === 'pendente').length;
    
    // Contagem por Género (Útil para logística de quartos)
    this.totalRapazes = dados.filter(i => (i.participante as any).genero === 'M').length;
    this.totalRaparigas = dados.filter(i => (i.participante as any).genero === 'F').length;
  }

  calcularOcupacao(dados: Inscricao[]) {
    const counts: any = {};
    dados.forEach(d => { const t = d.turnoEscolhido; counts[t] = (counts[t] || 0) + 1; });
    this.ocupacaoPorTurno = this.listaTurnos.map(turnoNome => {
      const count = counts[turnoNome] || 0;
      return { nome: turnoNome.split(' – ')[0], count: count, percent: (count / 20) * 100 };
    });
  }

  // --- Ações de Massa ---
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

  // --- Sidebar Detalhes ---
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
    
    // Atualiza KPIs para refletir o que está a ser visto (ex: só o turno X)
    this.atualizarKPIs(this.dataSource.filteredData);
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

  // --- GERADOR DE DADOS ---
  async gerarDadosTeste() {
    if (!confirm('Tem a certeza? Isto vai adicionar entre 50 a 70 novas inscrições de teste à base de dados.')) return;
    this.mostrarNotificacao('A gerar dados... Por favor aguarde.', 'success');
    
    const nomesRapazes = ['Santiago', 'Francisco', 'João', 'Afonso', 'Rodrigo', 'Martim', 'Tomás', 'Duarte', 'Miguel', 'Gabriel', 'Lourenço', 'Gonçalo', 'Pedro', 'Tiago', 'Diogo', 'Rafael', 'Gustavo', 'Lucas', 'Simão', 'Salvador'];
    const nomesRaparigas = ['Maria', 'Leonor', 'Matilde', 'Beatriz', 'Carolina', 'Sofia', 'Alice', 'Mariana', 'Ana', 'Benedita', 'Francisca', 'Margarida', 'Inês', 'Clara', 'Lara', 'Laura', 'Madalena', 'Joana', 'Diana', 'Luísa'];
    const apelidos = ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Jesus', 'Sousa', 'Fernandes', 'Gonçalves', 'Gomes', 'Lopes', 'Marques', 'Alves', 'Almeida', 'Ribeiro', 'Pinto', 'Carvalho', 'Teixeira', 'Moreira', 'Correia', 'Mendes', 'Nunes'];
    const transportesOpcoes = [{ label: 'Não (Entregue pelos pais)', valor: 0 }, { label: 'Lisboa - Quinta da Escola (+20€)', valor: 20 }, { label: 'Quinta da Escola - Lisboa (+20€)', valor: 20 }, { label: 'Lisboa - Quinta - Lisboa (+40€)', valor: 40 }];
    
    const quantidade = Math.floor(Math.random() * (70 - 50 + 1)) + 50;
    
    for (let i = 0; i < quantidade; i++) {
      const genero: 'M' | 'F' = Math.random() > 0.5 ? 'M' : 'F';
      const primeiroNome = genero === 'M' ? nomesRapazes[Math.floor(Math.random() * nomesRapazes.length)] : nomesRaparigas[Math.floor(Math.random() * nomesRaparigas.length)];
      const nomeCompleto = `${primeiroNome} ${apelidos[Math.floor(Math.random() * apelidos.length)]} ${apelidos[Math.floor(Math.random() * apelidos.length)]}`;
      const idade = Math.floor(Math.random() * (17 - 8 + 1)) + 8;
      const dataNascimento = new Date(2026 - idade, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
      const turno = this.listaTurnos[Math.floor(Math.random() * this.listaTurnos.length)];
      
      const novaInscricao: any = {
        dataCriacao: new Date(), tipoCliente: 'individual', nomeInstituicao: '', turnoEscolhido: turno, 
        valorBase: 395, valorTotal: 395, estadoPagamento: Math.random() > 0.4 ? 'pago' : 'pendente',
        transporte: transportesOpcoes[0].label, autorizaFotoVideo: true, politicaPrivacidade: true,
        participante: { nomeCompleto: nomeCompleto, dataNascimento: dataNascimento, genero: genero, nif: '999999999', cc: '11111111', morada: 'Rua Teste', sistemaSaude: 'SNS' },
        saude: { temAlergiaAlimentar: false, detalheAlergiaAlimentar: '', temOutrasAlergias: false, detalheOutrasAlergias: '', tomaMedicacao: 'nao', detalheMedicacao: '' },
        ee: { nome: `EE de ${primeiroNome}`, email: `pai.${primeiroNome.toLowerCase()}@teste.com`, telefone: '910000000', contactoEmergencia: '960000000' },
        camarata: '', monitorCamarata: '', grupo: '', monitorGrupo: ''
      };
      try { await this.inscricaoService.addInscricao(novaInscricao); } catch (error) { console.error('Erro:', error); }
    }
    this.mostrarNotificacao(`Concluído! ${quantidade} gerados.`, 'success'); this.carregarDados();
  }

  // --- DIALOGS & PDFS ---
  verificarTurnoParaCozinha() {
    if (this.filtroTurno) this.gerarPDFCozinha(this.filtroTurno);
    else { this.acaoDialog = 'cozinha'; this.turnoParaDialog = ''; this.dialog.open(this.dialogTurno, { width: '400px' }); }
  }

  verificarTurnoParaTransporte() {
    if (this.filtroTurno) this.gerarPDFTransporte(this.filtroTurno);
    else { this.acaoDialog = 'transporte'; this.turnoParaDialog = ''; this.dialog.open(this.dialogTurno, { width: '400px' }); }
  }

  confirmarGeracaoPDF() {
    if (!this.turnoParaDialog) return;
    this.acaoDialog === 'cozinha' ? this.gerarPDFCozinha(this.turnoParaDialog) : this.gerarPDFTransporte(this.turnoParaDialog);
    this.dialog.closeAll();
  }

  // PDF COZINHA
  gerarPDFCozinha(turnoSelecionado: string) {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(220, 53, 69); doc.text('ALERTA COZINHA', 14, 20);
    doc.setTextColor(0, 0, 0); doc.setFontSize(12); doc.text(`Turno: ${turnoSelecionado}`, 14, 28);
    
    const listaPerigosa = this.dataSource.data.filter(i => i.turnoEscolhido === turnoSelecionado && (i.saude.temAlergiaAlimentar || i.saude.temOutrasAlergias));
    if (listaPerigosa.length === 0) { this.mostrarNotificacao(`Sem restrições.`, 'error'); return; }
    
    const linhas = listaPerigosa.map(item => [item.participante.nomeCompleto, item.saude.detalheAlergiaAlimentar || '-']);
    autoTable(doc, { head: [['Nome', 'Alergias']], body: linhas, startY: 40, theme: 'grid', headStyles: { fillColor: [220, 53, 69] } });
    doc.save(`Cozinha_${turnoSelecionado.split(' – ')[0]}.pdf`); this.mostrarNotificacao('Lista cozinha gerada!');
  }

  // PDF TRANSPORTE
  gerarPDFTransporte(turnoSelecionado: string) {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(25, 118, 210); doc.text('LISTA TRANSPORTES', 14, 20);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Turno: ${turnoSelecionado}`, 14, 28);
    
    const todos = this.dataSource.data.filter(i => i.turnoEscolhido === turnoSelecionado && i.transporte && !i.transporte.startsWith('Não'));
    if (todos.length === 0) { this.mostrarNotificacao('Ninguém pediu transporte.', 'error'); return; }
    
    // Ida
    const ida = todos.filter(i => i.transporte.includes('Lisboa - Quinta')).sort((a,b)=>a.participante.nomeCompleto.localeCompare(b.participante.nomeCompleto));
    let y = 35;
    if(ida.length > 0) {
        doc.setFontSize(13); doc.setTextColor(0); doc.text('Lisboa -> Quinta', 14, y); y+=5;
        autoTable(doc, { 
            head: [['Criança', 'Contato', 'Check']], body: ida.map(i=>[i.participante.nomeCompleto, i.ee.telefone, '']), startY: y, theme: 'striped', 
            headStyles: {fillColor:[46,125,50]}, didDrawCell: (d) => { if(d.section==='body'&&d.column.index===2){ doc.rect(d.cell.x+d.cell.width/2-2, d.cell.y+d.cell.height/2-2, 4, 4); } } 
        });
        y = (doc as any).lastAutoTable.finalY + 15;
    }
    // Volta
    const volta = todos.filter(i => i.transporte.includes('Quinta da Escola - Lisboa')).sort((a,b)=>a.participante.nomeCompleto.localeCompare(b.participante.nomeCompleto));
    if(volta.length > 0) {
        if(y>250) { doc.addPage(); y=20; }
        doc.setFontSize(13); doc.setTextColor(0); doc.text('Quinta -> Lisboa', 14, y); y+=5;
        autoTable(doc, { 
            head: [['Criança', 'Contato', 'Check']], body: volta.map(i=>[i.participante.nomeCompleto, i.ee.telefone, '']), startY: y, theme: 'striped', 
            headStyles: {fillColor:[198,40,40]}, didDrawCell: (d) => { if(d.section==='body'&&d.column.index===2){ doc.rect(d.cell.x+d.cell.width/2-2, d.cell.y+d.cell.height/2-2, 4, 4); } }
        });
    }
    doc.save(`Transp_${turnoSelecionado.split(' – ')[0]}.pdf`); this.mostrarNotificacao('PDF Transportes gerado!');
  }
}