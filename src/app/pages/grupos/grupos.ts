import { Component, OnInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { InscricaoService } from '../../services/inscricao.service';
import { MonitorService } from '../../services/monitor.service';
import { LogisticaService } from '../../services/logistica.service';
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
import { MatMenuModule } from '@angular/material/menu';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ColunaGrupo {
  id: string;
  dbId?: number;
  titulo: string;
  monitor: string;
  tipo: 'camarata' | 'atividade';
  genero?: 'M' | 'F' | 'Misto';
  lista: Inscricao[];
  capacidade: number;
  lado?: 'Esq' | 'Dir';
}

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatButtonModule, MatIconModule,
    MatInputModule, MatSelectModule, MatTabsModule, MatSnackBarModule,
    MatTooltipModule, MatDialogModule, MatChipsModule, DragDropModule,
    MatAutocompleteModule, MatMenuModule
  ],
  templateUrl: './grupos.html',
  styleUrls: ['./grupos.scss']
})
export class GruposComponent implements OnInit {
  private inscricaoService = inject(InscricaoService);
  private monitorService = inject(MonitorService);
  private logisticaService = inject(LogisticaService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  @ViewChild('dialogGerirEquipa') dialogGerirEquipa!: TemplateRef<any>;
  @ViewChild('dialogSelecaoQuartos') dialogSelecaoQuartos!: TemplateRef<any>;

  todosRegistos: Inscricao[] = [];
  monitoresGlobais: Monitor[] = [];
  equipaMonitores: string[] = [];

  exibirBusca = false;
  controlMonitor = new FormControl('');
  monitoresFiltrados!: Observable<Monitor[]>;

  turnoSelecionado: string = '';
  termoPesquisa: string = '';
  modoVisualizacao: 'camarata' | 'atividade' = 'camarata';

  filtroLocal: 'quinta' | 'costaCaparica' | 'quiaios' = 'quinta';
  todosOsTurnosConfig: any = null;
  listaTurnos: string[] = [];

  qtdQuartosM = 2; qtdQuartosF = 3; qtdGruposAtiv = 5;

  colunasCamaratas: ColunaGrupo[] = [];
  colunasAtividades: ColunaGrupo[] = [];
  poolVisual: Inscricao[] = [];

  // Configuração inicial (pode ser trocada)
  configQuinta = {
    ladoEsquerdo: 'M' as 'M' | 'F',
    ladoDireito: 'F' as 'M' | 'F'
  };

  // Variável que armazena o Layout JSON vindo da BD
  layoutAtualBD: any[] = [];
  quartosDisponiveisSelect: any[] = [];

  ngOnInit() {
    this.carregarDadosIniciais();
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
      const config = await this.inscricaoService.getConfiguracoesTurnos();
      if (config) {
        this.todosOsTurnosConfig = config;
        this.atualizarListaTurnos();
      }
      this.carregarDados();
    } catch (error) {
      this.snackBar.open('Erro ao carregar configurações', 'Erro');
    }
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

  atualizarListaTurnos() {
    const turnosDoLocal = this.todosOsTurnosConfig[this.filtroLocal] || [];
    this.listaTurnos = turnosDoLocal
      .filter((t: any) => t.ativo === true)
      .map((t: any) => t.nome);

    this.turnoSelecionado = '';
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

  vincularMonitoresAoTurno() {
    if (!this.turnoSelecionado) {
      this.equipaMonitores = [];
      return;
    }
    this.equipaMonitores = this.monitoresGlobais
      .filter(m => m.turnosAtribuidos?.includes(this.turnoSelecionado))
      .map(m => m.nome)
      .sort();
  }

  // === 1. Carregar Template Dinâmico ===
  async mudarTurno() {
    this.vincularMonitoresAoTurno();

    // 1. Carrega o Layout Visual (Template) da BD para este Local
    try {
      this.layoutAtualBD = await this.logisticaService.getLayoutTemplate(this.filtroLocal);
    } catch (e) {
      console.warn('Layout não encontrado, a usar vazio');
      this.layoutAtualBD = [];
    }

    // 2. Carrega os Quartos já guardados (Dados)
    try {
      const logistica = await this.logisticaService.getLogistica(this.turnoSelecionado, this.filtroLocal);

      this.colunasCamaratas = [];
      this.colunasAtividades = [];

      logistica.forEach(item => {
        const col: ColunaGrupo = {
          id: 'db-' + item.id,
          dbId: item.id,
          titulo: item.titulo,
          monitor: item.monitor_nome || '',
          tipo: item.tipo,
          genero: item.genero,
          capacidade: item.capacidade,
          lista: [],
          lado: this.getLadoPeloNome(item.titulo) // Procura no layout carregado
        };
        if (item.tipo === 'camarata') this.colunasCamaratas.push(col);
        else this.colunasAtividades.push(col);
      });

    } catch (e) {
      console.error('Erro ao carregar logística', e);
      this.snackBar.open('Erro ao carregar estrutura do turno', 'Fechar');
    }
    this.atualizarVista();
  }

  getLadoPeloNome(nome: string): 'Esq' | 'Dir' | undefined {
    if (!this.layoutAtualBD) return undefined;
    const match = this.layoutAtualBD.find(q => q.titulo === nome);
    return match ? match.lado : undefined;
  }

  trocarAba(index: number) {
    this.modoVisualizacao = index === 0 ? 'camarata' : 'atividade';
    this.atualizarVista();
  }

  atualizarVista() {
    if (!this.turnoSelecionado) return;

    const mapaLocais: any = { 'quinta': 'Quinta', 'costaCaparica': 'Costa da Caparica', 'quiaios': 'Quiaios' };
    const localDb = mapaLocais[this.filtroLocal] || 'Quinta';

    const criancasTurno = this.todosRegistos.filter(i =>
      i.local === localDb && i.turnoEscolhido === this.turnoSelecionado
    );

    [...this.colunasCamaratas, ...this.colunasAtividades].forEach(c => c.lista = []);
    const atribuidosIds = new Set<string>();

    criancasTurno.forEach(crianca => {
      let atribuida = false;

      if (crianca.camarata_id) {
        const col = this.colunasCamaratas.find(c => c.dbId == crianca.camarata_id);
        if (col) {
          col.lista.push(crianca);
          atribuida = true;
        }
      }

      if (this.modoVisualizacao === 'atividade' && crianca.grupo_id) {
        const col = this.colunasAtividades.find(c => c.dbId == crianca.grupo_id);
        if (col) {
          col.lista.push(crianca);
        }
      }

      const temQuarto = crianca.camarata_id && this.colunasCamaratas.some(c => c.dbId == crianca.camarata_id);
      const temGrupo = crianca.grupo_id && this.colunasAtividades.some(c => c.dbId == crianca.grupo_id);

      if (this.modoVisualizacao === 'camarata' && temQuarto) atribuidosIds.add(crianca.id!);
      if (this.modoVisualizacao === 'atividade' && temGrupo) atribuidosIds.add(crianca.id!);
    });

    this.poolVisual = criancasTurno.filter(k => k.id && !atribuidosIds.has(k.id));
  }

  // === 2. Inicialização Dinâmica ===
  inicializarQuartos() {
    if (this.colunasCamaratas.length > 0 && !confirm('Reiniciar estrutura? Dados não guardados serão perdidos.')) return;

    this.colunasCamaratas.forEach(col => this.poolVisual.push(...col.lista));
    this.colunasCamaratas = [];

    // Se existe um layout na BD, usa-o
    if (this.layoutAtualBD && this.layoutAtualBD.length > 0) {

      // Prepara seleção
      this.quartosDisponiveisSelect = this.layoutAtualBD
        .filter(item => item.tipo === 'room') // Ignora estáticos
        .map(q => ({ ...q, selecionado: false }));

      this.dialog.open(this.dialogSelecaoQuartos, {
        width: '95vw',
        maxWidth: '98vw',
        panelClass: 'full-width-dialog'
      });

    } else {
      // Fallback manual se não houver template na BD
      for (let i = 1; i <= this.qtdQuartosM; i++) this.adicionarColuna('camarata', 'M', `Quarto M ${i}`);
      for (let i = 1; i <= this.qtdQuartosF; i++) this.adicionarColuna('camarata', 'F', `Quarto F ${i}`);
      this.atualizarVista();
    }
  }

  confirmarSelecaoQuartos() {
    const selecionados = this.quartosDisponiveisSelect.filter(q => q.selecionado);

    if (selecionados.length === 0) {
      this.snackBar.open('Selecione pelo menos um quarto.', 'Erro');
      return;
    }

    selecionados.forEach(q => {
      let generoDestino: 'M' | 'F' | 'Misto' = 'Misto';
      if (q.lado === 'Esq') {
        generoDestino = this.configQuinta.ladoEsquerdo;
      } else if (q.lado === 'Dir') {
        generoDestino = this.configQuinta.ladoDireito;
      }

      console.log(`Criando: ${q.titulo} -> Lado ${q.lado} -> Género ${generoDestino}`);

      this.colunasCamaratas.push({
        id: `temp-${q.titulo}`,
        titulo: q.titulo,
        monitor: '',
        tipo: 'camarata',
        capacidade: q.capacidade,
        lado: q.lado as 'Esq' | 'Dir',
        genero: generoDestino,
        lista: []
      });
    });

    this.dialog.closeAll();
    this.atualizarVista();
    this.snackBar.open(`${selecionados.length} quartos adicionados!`, 'OK', { duration: 2000 });
  }

  // === 3. Helper para o HTML calcular a posição na Grelha ===
  getGridStyle(item: any): any {
    return {
      'grid-column': `${item.gCol} / span ${item.gSpan}`,
      'grid-row': `${item.gRow}`
    };
  }

  get capacidadeSelecionadaTotal() {
    return this.quartosDisponiveisSelect
      .filter(q => q.selecionado)
      .reduce((acc, q) => acc + q.capacidade, 0);
  }

  trocarConfiguracaoLados() {
    if (this.configQuinta.ladoEsquerdo === 'M') {
      this.configQuinta.ladoEsquerdo = 'F';
      this.configQuinta.ladoDireito = 'M';
    } else {
      this.configQuinta.ladoEsquerdo = 'M';
      this.configQuinta.ladoDireito = 'F';
    }
  }

  getGeneroPorLado(lado: 'Esq' | 'Dir'): 'M' | 'F' {
    return lado === 'Esq' ? this.configQuinta.ladoEsquerdo : this.configQuinta.ladoDireito;
  }

  getLabelLado(lado: 'Esq' | 'Dir'): string {
    const genero = this.getGeneroPorLado(lado);
    return genero === 'M' ? 'Rapazes' : 'Raparigas';
  }

  trocarLados() {
    // Agora funciona para qualquer layout que tenha "Esq/Dir"
    if (this.filtroLocal !== 'quinta' && !this.layoutAtualBD.length) return;

    this.trocarConfiguracaoLados();

    let conflitos = 0;
    this.colunasCamaratas.forEach(col => {
      if (col.lado === 'Esq') col.genero = this.configQuinta.ladoEsquerdo;
      if (col.lado === 'Dir') col.genero = this.configQuinta.ladoDireito;

      if (col.lista.some(c => this.getGenero(c) !== col.genero)) conflitos++;
    });

    if (conflitos > 0) this.snackBar.open(`Atenção: ${conflitos} quartos com género trocado!`, 'OK', { duration: 5000 });
    else this.snackBar.open(`Lados trocados!`, 'OK', { duration: 2000 });
  }


  gerarGruposAtividade() {
    if (this.colunasAtividades.length > 0 && !confirm('Reiniciar grupos?')) return;
    this.colunasAtividades.forEach(col => this.poolVisual.push(...col.lista));
    this.colunasAtividades = [];

    for (let i = 1; i <= this.qtdGruposAtiv; i++) {
      this.adicionarColuna('atividade', 'Misto', `Grupo ${i}`, 12);
    }

    const sorted = [...this.poolVisual].sort((a, b) => this.getIdade(a) - this.getIdade(b));
    this.poolVisual = [];
    sorted.forEach((c, idx) => {
      const alvo = this.colunasAtividades[idx % this.colunasAtividades.length];
      alvo.lista.push(c);
    });
  }

  adicionarColunaIndividual(tipo: 'camarata' | 'atividade', genero: 'M' | 'F' | 'Misto' = 'Misto') {
    const lista = tipo === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
    const num = lista.length + 1;
    const titulo = tipo === 'camarata' ? `Novo Quarto ${genero === 'M' ? 'M' : 'F'} ${num}` : `Novo Grupo ${num}`;
    const cap = tipo === 'camarata' ? 10 : 12;
    this.adicionarColuna(tipo, genero, titulo, cap);
    setTimeout(() => { const c = document.querySelector('.columns-area'); if (c) c.scrollLeft = c.scrollWidth; }, 100);
  }

  private adicionarColuna(tipo: 'camarata' | 'atividade', genero: 'M' | 'F' | 'Misto', titulo: string, cap: number = 10) {
    const novaColuna: ColunaGrupo = {
      id: `temp-${tipo}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      titulo: titulo,
      monitor: '',
      tipo: tipo,
      genero: genero,
      capacidade: cap,
      lista: []
    };
    if (tipo === 'camarata') this.colunasCamaratas.push(novaColuna);
    else this.colunasAtividades.push(novaColuna);
  }

  removerColuna(col: ColunaGrupo) {
    if (col.lista.length > 0) {
      if (!confirm(`Este grupo tem ${col.lista.length} crianças. Elas voltarão para a lista de espera. Continuar?`)) return;
      this.poolVisual.push(...col.lista);
    }
    if (col.tipo === 'camarata') this.colunasCamaratas = this.colunasCamaratas.filter(c => c.id !== col.id);
    else this.colunasAtividades = this.colunasAtividades.filter(c => c.id !== col.id);
  }

  async guardarAlteracoes() {
    this.snackBar.open('A guardar...', '');

    const itensLogistica = [...this.colunasCamaratas, ...this.colunasAtividades].map(c => ({
      id: c.id,
      dbId: c.dbId,
      tipo: c.tipo,
      titulo: c.titulo,
      monitor: c.monitor,
      capacidade: c.capacidade,
      genero: c.genero
    }));

    const payloadEstrutura = {
      turno: this.turnoSelecionado,
      local: this.filtroLocal,
      items: itensLogistica
    };

    try {
      const res = await this.logisticaService.saveLogistica(payloadEstrutura);
      const idsMap = res.ids;

      [...this.colunasCamaratas, ...this.colunasAtividades].forEach(col => {
        if (idsMap[col.id]) col.dbId = idsMap[col.id];
      });

      const updatesCriancas: any[] = [];

      this.colunasCamaratas.forEach(col => {
        if (col.dbId) {
          col.lista.forEach(crianca => {
            if (crianca.camarata_id != col.dbId) {
              updatesCriancas.push({ id: crianca.id!, data: { camarata_id: col.dbId } });
              crianca.camarata_id = col.dbId;
            }
          });
        }
      });

      this.colunasAtividades.forEach(col => {
        if (col.dbId) {
          col.lista.forEach(crianca => {
            if (crianca.grupo_id != col.dbId) {
              updatesCriancas.push({ id: crianca.id!, data: { grupo_id: col.dbId } });
              crianca.grupo_id = col.dbId;
            }
          });
        }
      });

      this.poolVisual.forEach(crianca => {
        if (this.modoVisualizacao === 'camarata' && crianca.camarata_id) {
          updatesCriancas.push({ id: crianca.id!, data: { camarata_id: null } });
          crianca.camarata_id = undefined;
        }
        if (this.modoVisualizacao === 'atividade' && crianca.grupo_id) {
          updatesCriancas.push({ id: crianca.id!, data: { grupo_id: null } });
          crianca.grupo_id = undefined;
        }
      });

      if (updatesCriancas.length > 0) {
        await this.inscricaoService.updateBatch(updatesCriancas);
        this.snackBar.open(`Guardado!`, 'OK', { duration: 3000 });
      } else {
        this.snackBar.open('Estrutura guardada.', 'OK', { duration: 3000 });
      }

    } catch (e) {
      console.error(e);
      this.snackBar.open('Erro ao gravar.', 'Fechar');
    }
  }

  drop(event: CdkDragDrop<Inscricao[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const item = event.previousContainer.data[event.previousIndex];
      const destCol = [...this.colunasCamaratas, ...this.colunasAtividades].find(c => c.lista === event.container.data);

      if (destCol) {
        if (destCol.lista.length >= destCol.capacidade) {
          this.snackBar.open('Capacidade máxima atingida!', 'X', { duration: 2000 });
          return;
        }
        if (destCol.genero !== 'Misto' && destCol.genero !== this.getGenero(item)) {
          this.snackBar.open(`Este quarto é apenas para ${destCol.genero === 'M' ? 'Rapazes' : 'Raparigas'}`, 'X', { duration: 2000 });
          return;
        }
      }
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
  }

  distribuirNasCamaratas() {
    if (this.colunasCamaratas.length === 0) return;
    const rapazes = this.poolVisual.filter(i => this.getGenero(i) === 'M');
    const raparigas = this.poolVisual.filter(i => this.getGenero(i) === 'F');
    this.poolVisual = [];
    this._distribuir(rapazes, this.colunasCamaratas.filter(c => c.genero === 'M'));
    this._distribuir(raparigas, this.colunasCamaratas.filter(c => c.genero === 'F'));
  }

  private _distribuir(lista: Inscricao[], alvos: ColunaGrupo[]) {
    if (alvos.length === 0) { this.poolVisual.push(...lista); return; }
    lista.forEach((c, idx) => {
      const alvo = alvos[idx % alvos.length];
      if (alvo.lista.length < alvo.capacidade) alvo.lista.push(c);
      else this.poolVisual.push(c);
    });
  }

  adicionarMonitorAEquipa(monitor: Monitor) {
    if (!this.equipaMonitores.includes(monitor.nome)) {
      this.equipaMonitores.push(monitor.nome);
      this.equipaMonitores.sort();
      this.snackBar.open(`${monitor.nome} adicionado!`, 'OK', { duration: 2000 });
    }
    this.controlMonitor.setValue('');
    this.exibirBusca = false;
  }

  removerMonitorDaEquipa(nome: string) {
    const estaOcupado = [...this.colunasCamaratas, ...this.colunasAtividades].some(c => c.monitor === nome);
    if (estaOcupado) {
      this.snackBar.open('Remova o monitor dos quartos primeiro!', 'Aviso');
      return;
    }
    this.equipaMonitores = this.equipaMonitores.filter(m => m !== nome);
  }

  abrirDialogEquipa() { this.exibirBusca = false; this.dialog.open(this.dialogGerirEquipa, { width: '450px' }); }
  ajustarCapacidade(col: ColunaGrupo, delta: number) { if (col.capacidade + delta > 0) col.capacidade += delta; }
  isMonitorDisponivel(n: string, c: ColunaGrupo): boolean {
    const lista = this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
    return !lista.some(x => x.id !== c.id && x.monitor === n);
  }

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
    doc.setFontSize(16); doc.text(`Monitor: ${nome}`, 14, 20);
    const dados = this.colunasAtivas.find(c => c.monitor === nome)?.lista || [];
    autoTable(doc, {
      head: [['Nome', 'Idade', 'Alergias', 'Medicação']],
      body: dados.map(d => [d.participante.nomeCompleto, this.getIdade(d) + ' anos', d.saude.detalheAlergiaAlimentar || '-', d.saude.detalheMedicacao || '-']),
      startY: 30
    });
    doc.save(`Ficha_${nome}.pdf`);
  }

  isRoomSelected(nomeTitulo: string): boolean {
    const room = this.quartosDisponiveisSelect.find(q => q.titulo === nomeTitulo);
    return room ? room.selecionado : false;
  }

  toggleRoom(nomeTitulo: string) {
    const room = this.quartosDisponiveisSelect.find(q => q.titulo === nomeTitulo);
    if (room) {
      room.selecionado = !room.selecionado;
    }
  }
}