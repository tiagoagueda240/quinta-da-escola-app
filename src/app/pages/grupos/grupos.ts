import { Component, OnInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { InscricaoService } from '../../services/inscricao.service';
import { MonitorService } from '../../services/monitor.service';
import { Inscricao } from '../../models/inscricao.model';
import { Monitor } from '../../models/monitor.model';

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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

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
    CommonModule, FormsModule, ReactiveFormsModule, MatButtonModule, MatIconModule,
    MatInputModule, MatSelectModule, MatTabsModule, MatSnackBarModule,
    MatTooltipModule, MatDialogModule, MatChipsModule, DragDropModule,
    MatAutocompleteModule
  ],
  templateUrl: './grupos.html',
  styleUrls: ['./grupos.scss']
})
export class GruposComponent implements OnInit {
  private inscricaoService = inject(InscricaoService);
  private monitorService = inject(MonitorService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  @ViewChild('dialogMonitores') dialogMonitores!: TemplateRef<any>;
  @ViewChild('dialogGerirEquipa') dialogGerirEquipa!: TemplateRef<any>;

  // Dados base
  todosRegistos: Inscricao[] = [];
  monitoresGlobais: Monitor[] = [];
  equipaMonitores: string[] = [];

  // Controlo do Autocomplete
  exibirBusca = false;
  controlMonitor = new FormControl('');
  monitoresFiltrados!: Observable<Monitor[]>;

  turnoSelecionado: string = '';
  termoPesquisa: string = '';
  modoVisualizacao: 'camarata' | 'atividade' = 'camarata';

  filtroLocal: 'quinta' | 'costaCaparica' | 'quiaios' = 'quinta';
  todosOsTurnosConfig: any = null;
  listaTurnos: string[] = []; // Agora será preenchida dinamicamente

  // Configurações de Logística
  qtdQuartosM = 2; qtdQuartosF = 3; qtdGruposAtiv = 5;
  colunasCamaratas: ColunaGrupo[] = [];
  colunasAtividades: ColunaGrupo[] = [];
  poolVisual: Inscricao[] = [];

  ngOnInit() {
    this.carregarDadosIniciais();
    this.carregarDados();

    // Filtro dinâmico para a pesquisa de monitores
    this.monitoresFiltrados = this.controlMonitor.valueChanges.pipe(
      startWith(''),
      map(value => {
        const name = typeof value === 'string' ? value : '';
        return this._filterMonitores(name);
      })
    );
  }

  async carregarDadosIniciais() {
    try {
      // 1. Carrega os turnos do Firebase
      const config = await this.inscricaoService.getConfiguracoesTurnos();
      if (config) {
        this.todosOsTurnosConfig = config;
        this.atualizarListaTurnos(); // Carrega turnos do local padrão (Quinta)
      }

      // 2. Subscreve às inscrições
      this.inscricaoService.getInscricoes().subscribe(dados => {
        this.todosRegistos = dados;
        this.atualizarVista();
      });

      // 3. Monitores
      this.monitorService.getMonitores().subscribe(m => this.monitoresGlobais = m);
    } catch (error) {
      this.snackBar.open('Erro ao carregar configurações', 'Erro');
    }
  }

  atualizarListaTurnos() {
    // Mapeia o valor do filtro para a chave do Firebase
    this.listaTurnos = this.todosOsTurnosConfig[this.filtroLocal] || [];
    this.turnoSelecionado = ''; // Reseta o turno ao mudar o local
    this.colunasCamaratas = [];
    this.colunasAtividades = [];
    this.poolVisual = [];
  }



  private _filterMonitores(value: string): Monitor[] {
    const filterValue = value.toLowerCase();
    return this.monitoresGlobais.filter(m =>
      m.nome.toLowerCase().includes(filterValue) &&
      !this.equipaMonitores.includes(m.nome)
    );
  }

  carregarDados() {
    this.inscricaoService.getInscricoes().subscribe(dados => {
      this.todosRegistos = dados;
      if (this.turnoSelecionado) this.atualizarVista();
    });

    this.monitorService.getMonitores().subscribe(monitores => {
      this.monitoresGlobais = monitores;
      this.vincularMonitoresAoTurno();
    });
  }

  vincularMonitoresAoTurno() {
    if (!this.turnoSelecionado) {
      this.equipaMonitores = [];
      return;
    }
    // Carrega automaticamente quem tem este turno na agenda oficial
    this.equipaMonitores = this.monitoresGlobais
      .filter(m => m.turnosAtribuidos?.includes(this.turnoSelecionado))
      .map(m => m.nome)
      .sort();
  }

  adicionarMonitorAEquipa(monitor: Monitor) {
    if (!this.equipaMonitores.includes(monitor.nome)) {
      this.equipaMonitores.push(monitor.nome);
      this.equipaMonitores.sort();
      this.snackBar.open(`${monitor.nome} adicionado ao turno!`, 'OK', { duration: 2000 });
    }
    this.controlMonitor.setValue('');
    this.exibirBusca = false;
  }

  removerMonitorDaEquipa(nome: string) {
    const estaOcupado = [...this.colunasCamaratas, ...this.colunasAtividades]
      .some(c => c.monitor === nome);

    if (estaOcupado) {
      this.snackBar.open('Remova o monitor do grupo/quarto primeiro!', 'Aviso');
      return;
    }
    this.equipaMonitores = this.equipaMonitores.filter(m => m !== nome);
  }

  mudarTurno() {
    this.colunasCamaratas = [];
    this.colunasAtividades = [];
    this.vincularMonitoresAoTurno();
    this.atualizarVista();
  }

  trocarAba(index: number) {
    this.modoVisualizacao = index === 0 ? 'camarata' : 'atividade';
    this.atualizarVista();
  }

  atualizarVista() {
    if (!this.turnoSelecionado) return;

    // Tradução para bater com o campo 'local' no modelo de dados
    const mapaLocais: any = {
      'quinta': 'Quinta',
      'costaCaparica': 'Costa da Caparica',
      'quiaios': 'Quiaios'
    };

    // Filtra crianças que pertencem ao LOCAL e ao TURNO selecionados
    const criancasFiltradas = this.todosRegistos.filter(i =>
      i.local === mapaLocais[this.filtroLocal] &&
      i.turnoEscolhido === this.turnoSelecionado
    );

    const atribuidosIds = new Set<string>();
    this.colunasAtivas.forEach(c => c.lista.forEach(k => { if (k.id) atribuidosIds.add(k.id); }));

    this.poolVisual = criancasFiltradas.filter(k => k.id && !atribuidosIds.has(k.id));
  }

  isMonitorDisponivel(nomeMonitor: string, colunaAtual: ColunaGrupo): boolean {
    const listaAtiva = this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
    return !listaAtiva.some(c => c.id !== colunaAtual.id && c.monitor === nomeMonitor);
  }

  abrirDialogEquipa() {
    this.exibirBusca = false;
    this.dialog.open(this.dialogGerirEquipa, { width: '450px' });
  }

  // --- LOGISTICA ---
  inicializarQuartos() {
    if (this.colunasCamaratas.length > 0 && !confirm('Reiniciar estrutura?')) return;
    this.colunasCamaratas.forEach(col => this.poolVisual.push(...col.lista));
    this.colunasCamaratas = [];
    for (let i = 1; i <= this.qtdQuartosM; i++) this.colunasCamaratas.push({ id: `cm-${i}`, titulo: `Quarto M ${i}`, monitor: '', tipo: 'camarata', genero: 'M', capacidade: 10, lista: [] });
    for (let i = 1; i <= this.qtdQuartosF; i++) this.colunasCamaratas.push({ id: `cf-${i}`, titulo: `Quarto F ${i}`, monitor: '', tipo: 'camarata', genero: 'F', capacidade: 10, lista: [] });
    this.atualizarVista();
  }

  distribuirNasCamaratas() {
    if (this.colunasCamaratas.length === 0) return;
    const rapazes = this.poolVisual.filter(i => this.getGenero(i) === 'M');
    const raparigas = this.poolVisual.filter(i => this.getGenero(i) === 'F');
    this.poolVisual = [];
    this._distribuir(rapazes, this.colunasCamaratas.filter(c => c.genero === 'M'));
    this._distribuir(raparigas, this.colunasCamaratas.filter(c => c.genero === 'F'));
    this.atualizarVista();
  }

  private _distribuir(lista: Inscricao[], alvos: ColunaGrupo[]) {
    if (alvos.length === 0) { this.poolVisual.push(...lista); return; }
    lista.forEach((c, idx) => {
      const alvo = alvos[idx % alvos.length];
      if (alvo.lista.length < alvo.capacidade) alvo.lista.push(c);
      else this.poolVisual.push(c);
    });
  }

  gerarGruposAtividade() {
    this.colunasAtividades.forEach(col => this.poolVisual.push(...col.lista));
    this.colunasAtividades = [];
    for (let i = 1; i <= this.qtdGruposAtiv; i++)
      this.colunasAtividades.push({ id: `ga-${i}`, titulo: `Grupo ${i}`, monitor: '', tipo: 'atividade', genero: 'Misto', capacidade: 12, lista: [] });

    const sorted = [...this.poolVisual].sort((a, b) => this.getIdade(a) - this.getIdade(b));
    this.poolVisual = [];
    sorted.forEach((c, idx) => {
      const alvo = this.colunasAtividades[idx % this.colunasAtividades.length];
      alvo.lista.push(c);
    });
    this.atualizarVista();
  }

  drop(event: CdkDragDrop<Inscricao[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const item = event.previousContainer.data[event.previousIndex];
      const destCol = this.colunasAtivas.find(c => c.lista === event.container.data);

      if (destCol) {
        if (destCol.lista.length >= destCol.capacidade) return;
        if (destCol.genero !== 'Misto' && destCol.genero !== this.getGenero(item)) return;
      }
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      this.atualizarVista();
    }
  }

  async guardarAlteracoes() {
    this.snackBar.open('Sincronizando...', '');
    const updates: any[] = [];
    this.colunasCamaratas.forEach(c => c.lista.forEach(p => updates.push({ id: p.id, data: { camarata: c.titulo, monitorCamarata: c.monitor } })));
    this.colunasAtividades.forEach(c => c.lista.forEach(p => updates.push({ id: p.id, data: { grupo: c.titulo, monitorGrupo: c.monitor } })));
    if (updates.length > 0) await this.inscricaoService.updateBatch(updates);
    this.snackBar.open('Alterações guardadas!', 'OK', { duration: 2000 });
  }

  // Helpers de Visualização
  getGenero(i: Inscricao): 'M' | 'F' { return (i.participante as any).genero || 'M'; }
  getIdade(i: Inscricao): number {
    if (!i.participante.dataNascimento) return 0;
    const born = new Date(i.participante.dataNascimento);
    return Math.floor((Date.now() - born.getTime()) / 31557600000);
  }
  get colunasAtivas(): ColunaGrupo[] { return this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades; }

  imprimirFichaMonitor(nome: string) {
    if (!nome) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Monitor: ${nome}`, 14, 20);
    const dados = this.colunasAtivas.find(c => c.monitor === nome)?.lista || [];
    autoTable(doc, {
      head: [['Nome', 'Idade', 'Restrições']],
      body: dados.map(d => [d.participante.nomeCompleto, this.getIdade(d) + ' anos', (d.saude.temAlergiaAlimentar ? 'Alergia Alimentar' : 'N/A')]),
      startY: 30
    });
    doc.save(`Ficha_${nome}.pdf`);
  }
}