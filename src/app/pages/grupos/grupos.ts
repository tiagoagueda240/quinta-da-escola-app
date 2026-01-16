import { Component, OnInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InscricaoService } from '../../services/inscricao.service';
import { Inscricao } from '../../models/inscricao.model';

// Material & CDK
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

// PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ColunaGrupo {
  id: string;
  titulo: string;
  monitor: string;
  tipo: 'camarata' | 'atividade';
  genero?: 'M' | 'F' | 'Misto';
  lista: Inscricao[];
  capacidade: number;
}

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule, 
    MatInputModule, MatSelectModule, MatTabsModule, MatSnackBarModule, 
    MatTooltipModule, MatDialogModule, MatChipsModule, DragDropModule
  ],
  templateUrl: './grupos.html',
  styleUrls: ['./grupos.scss']
})
export class GruposComponent implements OnInit {
  private inscricaoService = inject(InscricaoService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  @ViewChild('dialogMonitores') dialogMonitores!: TemplateRef<any>;
  @ViewChild('dialogGerirEquipa') dialogGerirEquipa!: TemplateRef<any>;

  todosRegistos: Inscricao[] = [];
  turnoSelecionado: string = '';
  termoPesquisa: string = '';
  
  listaTurnos = [
    '1º Turno – 28 Junho a 4 Julho', '2º Turno – 5 a 11 Julho', '3º Turno – 12 a 18 Julho',
    '4º Turno – 19 a 25 Julho', '5º Turno – 26 Julho a 1 Agosto', '6º Turno – 2 a 8 Agosto',
    '7º Turno – 9 a 15 Agosto', '8º Turno – 16 a 22 Agosto', '9º Turno – 23 a 29 Agosto',
    '10º Turno – 30 Agosto a 5 Setembro'
  ];

  qtdQuartosM = 2;
  qtdQuartosF = 3;
  qtdGruposAtiv = 5;
  capacidadePadrao = 12;

  modoVisualizacao: 'camarata' | 'atividade' = 'camarata';
  colunasCamaratas: ColunaGrupo[] = [];
  colunasAtividades: ColunaGrupo[] = [];
  poolVisual: Inscricao[] = []; 
  
  // EQUIPA
  equipaMonitores: string[] = [];
  novoMonitorNome: string = '';

  ngOnInit() { this.carregarDados(); }

  carregarDados() {
    this.inscricaoService.getInscricoes().subscribe(dados => {
      this.todosRegistos = dados;
      if (this.turnoSelecionado) this.atualizarVista();
    });
  }

  mudarTurno() {
    this.colunasCamaratas = [];
    this.colunasAtividades = [];
    
    // Carregar equipa existente na BD para este turno
    if (this.turnoSelecionado) {
      const doTurno = this.todosRegistos.filter(i => i.turnoEscolhido === this.turnoSelecionado);
      const monitoresEncontrados = new Set<string>();
      doTurno.forEach(i => {
        if(i.monitorCamarata) monitoresEncontrados.add(i.monitorCamarata);
        if(i.monitorGrupo) monitoresEncontrados.add(i.monitorGrupo);
      });
      this.equipaMonitores = Array.from(monitoresEncontrados).sort();
    } else {
      this.equipaMonitores = [];
    }

    this.atualizarVista();
  }

  trocarAba(index: number) {
    this.modoVisualizacao = index === 0 ? 'camarata' : 'atividade';
    this.atualizarVista();
  }

  atualizarVista() {
    if (!this.turnoSelecionado) return;
    const criancasTurno = this.todosRegistos.filter(i => i.turnoEscolhido === this.turnoSelecionado);
    const atribuidos = new Set<string>();
    const colunasAtivas = this.colunasAtivas;
    colunasAtivas.forEach(c => c.lista.forEach(k => { if(k.id) atribuidos.add(k.id); }));
    this.poolVisual = criancasTurno.filter(k => k.id && !atribuidos.has(k.id));
  }

  // --- VALIDAÇÃO DE DISPONIBILIDADE ---
  isMonitorDisponivel(nomeMonitor: string, colunaAtual: ColunaGrupo): boolean {
    const listaAtiva = this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
    
    // Procura se o monitor já está noutra coluna (excluindo a atual)
    const estaOcupado = listaAtiva.some(outraCol => 
      outraCol.id !== colunaAtual.id && 
      outraCol.monitor === nomeMonitor
    );

    return !estaOcupado;
  }

  // --- GESTÃO DE EQUIPA ---
  abrirDialogEquipa() { this.dialog.open(this.dialogGerirEquipa, { width: '400px' }); }
  
  adicionarMonitor() {
    if (!this.novoMonitorNome.trim()) return;
    if (this.equipaMonitores.includes(this.novoMonitorNome.trim())) { 
      this.snackBar.open('Esse monitor já existe!', 'Erro'); 
      return; 
    }
    this.equipaMonitores.push(this.novoMonitorNome.trim());
    this.equipaMonitores.sort();
    this.novoMonitorNome = '';
  }

  removerMonitor(nome: string) {
    if(!confirm(`Remover ${nome} da equipa?`)) return;
    this.equipaMonitores = this.equipaMonitores.filter(m => m !== nome);
  }

  // --- LOGISTICA CAMARATAS ---
  inicializarQuartos() {
    if(this.colunasCamaratas.length > 0 && !confirm('Reiniciar quartos?')) return;
    this.colunasCamaratas.forEach(col => this.poolVisual.push(...col.lista));
    this.colunasCamaratas = [];
    for(let i=1; i<=this.qtdQuartosM; i++) this.colunasCamaratas.push({id: `cam-m-${i}`, titulo: `Quarto Rapazes ${i}`, monitor: '', tipo: 'camarata', genero: 'M', capacidade: this.capacidadePadrao, lista: []});
    for(let i=1; i<=this.qtdQuartosF; i++) this.colunasCamaratas.push({id: `cam-f-${i}`, titulo: `Quarto Raparigas ${i}`, monitor: '', tipo: 'camarata', genero: 'F', capacidade: this.capacidadePadrao, lista: []});
    this.atualizarVista();
  }

  distribuirNasCamaratas() {
    if(this.colunasCamaratas.length === 0) return this.snackBar.open('Cria os quartos primeiro!', 'OK');
    const rapazes = this.poolVisual.filter(i => this.getGenero(i) === 'M').sort((a,b) => this.getIdade(a) - this.getIdade(b));
    const raparigas = this.poolVisual.filter(i => this.getGenero(i) === 'F').sort((a,b) => this.getIdade(a) - this.getIdade(b));
    const quartosM = this.colunasCamaratas.filter(c => c.genero === 'M');
    const quartosF = this.colunasCamaratas.filter(c => c.genero === 'F');
    this.poolVisual = []; 
    if (rapazes.length > 0) this.distribuirGrupoEquilibrado(rapazes, quartosM);
    else if (rapazes.length > 0) this.poolVisual.push(...rapazes);
    if (raparigas.length > 0) this.distribuirGrupoEquilibrado(raparigas, quartosF);
    else if (raparigas.length > 0) this.poolVisual.push(...raparigas);
    this.atualizarVista();
    if(this.poolVisual.length > 0) this.snackBar.open(`Sobraram ${this.poolVisual.length} crianças!`, 'OK', {duration: 4000});
    else this.snackBar.open('Distribuição concluída!', 'OK');
    return
  }

  private distribuirGrupoEquilibrado(criancas: Inscricao[], quartos: ColunaGrupo[]) {
    if(quartos.length === 0) { this.poolVisual.push(...criancas); return; }
    const base = Math.floor(criancas.length / quartos.length);
    const sobra = criancas.length % quartos.length;
    let index = 0;
    for (let i = 0; i < quartos.length; i++) {
      let qtd = base + (i >= (quartos.length - sobra) ? 1 : 0);
      const livre = quartos[i].capacidade - quartos[i].lista.length;
      qtd = Math.min(qtd, livre);
      if (qtd > 0) {
        quartos[i].lista.push(...criancas.slice(index, index + qtd));
        index += qtd;
      }
    }
    if (index < criancas.length) this.poolVisual.push(...criancas.slice(index));
  }

  // --- LOGISTICA GRUPOS ---
  gerarGruposAtividade() {
    if (this.colunasAtividades.length > 0 && !confirm('Reiniciar grupos?')) return;
    this.colunasAtividades.forEach(col => this.poolVisual.push(...col.lista));
    this.poolVisual = [...new Set(this.poolVisual)];
    this.colunasAtividades = [];
    for (let i = 1; i <= this.qtdGruposAtiv; i++) {
      this.colunasAtividades.push({id: `grp-${i}`, titulo: `Grupo ${i}`, monitor: '', tipo: 'atividade', genero: 'Misto', capacidade: 10, lista: []});
    }
    const rapazes = this.poolVisual.filter(i => this.getGenero(i) === 'M').sort((a,b) => this.getIdade(a) - this.getIdade(b));
    const raparigas = this.poolVisual.filter(i => this.getGenero(i) === 'F').sort((a,b) => this.getIdade(a) - this.getIdade(b));
    this.poolVisual = [];
    this.distribuirInteligente(rapazes);
    this.distribuirInteligente(raparigas);
    this.atualizarVista();
    this.snackBar.open('Grupos gerados!', 'OK');
  }

  private distribuirInteligente(lista: Inscricao[]) {
    lista.forEach(crianca => {
      let candidatos = [...this.colunasAtividades].sort((a, b) => a.lista.length - b.lista.length);
      let alvo = candidatos.find(g => !this.temIrmaoNoGrupo(crianca, g));
      if (!alvo) alvo = candidatos[0];
      alvo.lista.push(crianca);
    });
  }

  private temIrmaoNoGrupo(c: Inscricao, g: ColunaGrupo): boolean {
    return g.lista.some(m => m.ee.email === c.ee.email || m.ee.telefone === c.ee.telefone);
  }

  // --- DRAG & DROP ---
  drop(event: CdkDragDrop<Inscricao[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const destList = event.container.data;
      const crianca = event.previousContainer.data[event.previousIndex];
      const destCol = [...this.colunasCamaratas, ...this.colunasAtividades].find(c => c.lista === destList);
      if (destCol) {
        if (destList.length >= destCol.capacidade) { this.snackBar.open('Cheio!', 'Erro'); return; }
        if (destCol.tipo === 'camarata' && destCol.genero && destCol.genero !== this.getGenero(crianca)) {
          this.snackBar.open(`Género incorreto!`, 'Erro'); return;
        }
      }
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      if (destCol && destCol.tipo === 'camarata' && destCol.lista.length === 1 && !destCol.genero) {
         destCol.genero = this.getGenero(destCol.lista[0]);
         destCol.titulo += ` (${destCol.genero})`;
      }
      this.atualizarVista();
    }
  }

  // --- IMPRESSÃO & PDF ---
  abrirDialogImpressao() { this.dialog.open(this.dialogMonitores, { width: '600px' }); }
  
  getListaMonitoresAtivos(): string[] {
    const ativos = new Set(this.equipaMonitores);
    [...this.colunasCamaratas, ...this.colunasAtividades].forEach(c => { if(c.monitor) ativos.add(c.monitor); });
    return Array.from(ativos).sort();
  }

  imprimirFichaMonitor(nomeMonitor: string) {
    const doc = new jsPDF();
    doc.setFillColor(41, 128, 185); doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(18);
    doc.text(`FICHA DE SERVIÇO: ${nomeMonitor.toUpperCase()}`, 14, 18);
    doc.setFontSize(10); doc.text(`Turno: ${this.turnoSelecionado.split(' – ')[0]}`, 14, 25);
    let currentY = 45;

    const camarata = this.colunasCamaratas.find(c => c.monitor === nomeMonitor);
    if (camarata) {
      currentY = this.gerarTabelaDinamica(doc, `🛌 Camarata: ${camarata.titulo}`, camarata.lista, currentY, [44, 62, 80]);
      currentY += 15;
    }
    const grupo = this.colunasAtividades.find(c => c.monitor === nomeMonitor);
    if (grupo) {
      if (currentY > 200) { doc.addPage(); currentY = 20; }
      this.gerarTabelaDinamica(doc, `🏃 Equipa: ${grupo.titulo}`, grupo.lista, currentY, [230, 126, 34]);
    }
    doc.save(`Ficha_${nomeMonitor.replace(/\s/g, '_')}.pdf`);
    this.snackBar.open(`PDF gerado!`, 'OK');
  }

  private gerarTabelaDinamica(doc: jsPDF, titulo: string, lista: Inscricao[], startY: number, corHeader: [number, number, number]): number {
    const temAlgumaAlergia = lista.some(i => this.getDetalheSaude(i, 'alergia') !== '');
    const temAlgumaMedicacao = lista.some(i => this.getDetalheSaude(i, 'med') !== '');
    const headers = ['#', 'Nome', 'Idade'];
    if (temAlgumaAlergia) headers.push('Alergias / Restrições');
    if (temAlgumaMedicacao) headers.push('Medicação');
    
    const body = lista.map((aluno, i) => {
      const row = [i + 1, aluno.participante.nomeCompleto, this.getIdade(aluno) + ' anos'];
      if (temAlgumaAlergia) row.push(this.getDetalheSaude(aluno, 'alergia'));
      if (temAlgumaMedicacao) row.push(this.getDetalheSaude(aluno, 'med'));
      return row;
    });

    doc.setTextColor(0, 0, 0); doc.setFontSize(14);
    doc.text(`${titulo} (${lista.length} pax)`, 14, startY);
    
    autoTable(doc, {
      head: [headers], body: body, startY: startY + 5, theme: 'striped',
      headStyles: { fillColor: corHeader }, styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 20 } }
    });
    return (doc as any).lastAutoTable.finalY;
  }

  // --- SAVE & HELPERS ---
  async guardarAlteracoes() {
    if(!this.turnoSelecionado) return;
    this.snackBar.open('A guardar...', 'Aguarde');
    for(const col of this.colunasCamaratas) { for(const p of col.lista) { if(p.id) await this.inscricaoService.updateInscricao(p.id, { camarata: col.titulo, monitorCamarata: col.monitor }); } }
    if (this.modoVisualizacao === 'camarata') for(const p of this.poolVisual) { if(p.id) await this.inscricaoService.updateInscricao(p.id, { camarata: '', monitorCamarata: '' }); }
    for(const col of this.colunasAtividades) { for(const p of col.lista) { if(p.id) await this.inscricaoService.updateInscricao(p.id, { grupo: col.titulo, monitorGrupo: col.monitor }); } }
    if (this.modoVisualizacao === 'atividade') for(const p of this.poolVisual) { if(p.id) await this.inscricaoService.updateInscricao(p.id, { grupo: '', monitorGrupo: '' }); }
    this.snackBar.open('Guardado!', 'OK');
  }

  getDetalheSaude(i: Inscricao, tipo: 'alergia' | 'med'): string {
    if (tipo === 'alergia') {
      const tem = i.saude.temAlergiaAlimentar || i.saude.temOutrasAlergias;
      if (!tem) return '';
      const d: string[] = [];
      if (i.saude.temAlergiaAlimentar && i.saude.detalheAlergiaAlimentar) d.push(i.saude.detalheAlergiaAlimentar);
      if (i.saude.temOutrasAlergias && i.saude.detalheOutrasAlergias) d.push(i.saude.detalheOutrasAlergias);
      return d.length > 0 ? d.join(', ') : 'SIM';
    } else {
      const valor = i.saude.tomaMedicacao as any;
      const toma = valor === true || valor === 'sim';
      if (!toma) return '';
      return i.saude.detalheMedicacao || 'SIM';
    }
  }

  temAlergia(i: Inscricao): boolean { return i.saude.temAlergiaAlimentar || i.saude.temOutrasAlergias; }
  temMedicacao(i: Inscricao): boolean { const v = i.saude.tomaMedicacao as any; return v === true || v === 'sim'; }
  eResultadoPesquisa(i: Inscricao): boolean { if (!this.termoPesquisa) return false; return i.participante.nomeCompleto.toLowerCase().includes(this.termoPesquisa.toLowerCase()); }
  getGenero(i: Inscricao): 'M' | 'F' { if ((i as any).participante?.genero) return (i as any).participante.genero; if ((i as any).genero) return (i as any).genero; const nome = i.participante.nomeCompleto.trim().toLowerCase().split(' ')[0]; if (['maria','ana','sofia','beatriz'].includes(nome) || nome.endsWith('a')) return 'F'; return 'M'; }
  getIdade(i: Inscricao): number { if (!i.participante.dataNascimento) return 0; const n = new Date(i.participante.dataNascimento); return Math.floor((Date.now() - n.getTime()) / 31557600000); }
  get colunasAtivas(): ColunaGrupo[] { return this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades; }
}