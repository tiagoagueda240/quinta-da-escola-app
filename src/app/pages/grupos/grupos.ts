import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Inscricao } from '../../models/inscricao.model';
import { Monitor } from '../../models/monitor.model';
import { InscricaoService } from '../../services/inscricao.service';
import { LogisticaService } from '../../services/logistica.service';
import { MonitorService } from '../../services/monitor.service';

// Material & CDK
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

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
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule,
    MatChipsModule,
    DragDropModule,
    MatAutocompleteModule,
    MatMenuModule,
  ],
  templateUrl: './grupos.html',
  styleUrls: ['./grupos.scss'],
})
export class GruposComponent implements OnInit {
  private inscricaoService = inject(InscricaoService);
  private monitorService = inject(MonitorService);
  private logisticaService = inject(LogisticaService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading: boolean = false;

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

  qtdQuartosM = 2;
  qtdQuartosF = 3;
  qtdGruposAtiv = 5;

  colunasCamaratas: ColunaGrupo[] = [];
  colunasAtividades: ColunaGrupo[] = [];
  poolVisual: Inscricao[] = [];

  configQuinta = {
    ladoEsquerdo: 'M' as 'M' | 'F',
    ladoDireito: 'F' as 'M' | 'F',
  };

  layoutAtualBD: any[] = [];
  quartosDisponiveisSelect: any[] = [];

  // Variáveis para Controlo de Link
  modoLink = false;
  token: string | null = null;
  pinSessao = '';

  async ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (this.token) {
      this.modoLink = true;
      this.pinSessao = sessionStorage.getItem('access_pin_' + this.token) || '';

      if (!this.pinSessao) {
        this.router.navigate(['/checkin'], { queryParams: { token: this.token } });
        return;
      }
      this.carregarDadosLink();
    } else {
      this.carregarDadosIniciais();
    }

    this.monitoresFiltrados = this.controlMonitor.valueChanges.pipe(
      startWith(''),
      map((value) => {
        const name = typeof value === 'string' ? value : '';
        return this._filterMonitores(name);
      }),
    );
  }

  carregarDadosLink() {
    this.inscricaoService.getInscricoesComTokenEPin(this.token!, this.pinSessao).subscribe({
      next: async (dados) => {
        this.todosRegistos = dados;
        if (dados.length > 0) {
          this.turnoSelecionado = dados[0].turnoEscolhido;

          const localRaw = (dados[0].local || 'quinta').toLowerCase();
          if (localRaw.includes('caparica')) this.filtroLocal = 'costaCaparica';
          else if (localRaw.includes('quiaios')) this.filtroLocal = 'quiaios';
          else this.filtroLocal = 'quinta';

          this.listaTurnos = [this.turnoSelecionado];

          // AGORA USA O ENDPOINT COM TOKEN
          this.monitorService.getMonitoresComToken(this.token!, this.pinSessao).subscribe((monitores) => {
            this.monitoresGlobais = monitores;
            this.vincularMonitoresAoTurno();
          });

          await this.mudarTurno();
        }
      },
      error: () => {
        this.snackBar.open('Sessão expirada ou PIN inválido', 'OK');
        this.router.navigate(['/checkin'], { queryParams: { token: this.token } });
      }
    });
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
    this.inscricaoService.getInscricoes().subscribe((dados) => {
      this.todosRegistos = dados;
      if (this.turnoSelecionado) this.atualizarVista();
    });

    this.monitorService.getMonitores().subscribe((monitores) => {
      this.monitoresGlobais = monitores;
      this.vincularMonitoresAoTurno();
    });
  }

  atualizarListaTurnos() {
    if (this.modoLink) return;

    const turnosDoLocal = this.todosOsTurnosConfig[this.filtroLocal] || [];
    this.listaTurnos = turnosDoLocal.map((t: any) => t.nome);

    this.turnoSelecionado = '';
    this.colunasCamaratas = [];
    this.colunasAtividades = [];
    this.poolVisual = [];
  }

  private _filterMonitores(value: string): Monitor[] {
    const filterValue = value.toLowerCase();
    return this.monitoresGlobais.filter(
      (m) =>
        (m.nomeMonitor || '').toLowerCase().includes(filterValue) &&
        !this.equipaMonitores.includes(m.nomeMonitor),
    );
  }

  vincularMonitoresAoTurno() {
    if (!this.turnoSelecionado) {
      this.equipaMonitores = [];
      return;
    }
    this.equipaMonitores = this.monitoresGlobais
      .filter((m) => m.turnosAtribuidos?.includes(this.turnoSelecionado))
      .map((m) => m.nomeMonitor)
      .sort();
  }

  async mudarTurno() {
    this.loading = true; // <-- Liga o loader
    this.vincularMonitoresAoTurno();

    try {
      if (this.modoLink) {
        this.layoutAtualBD = await this.logisticaService.getLayoutTemplateComToken(this.filtroLocal, this.token!, this.pinSessao);
      } else {
        this.layoutAtualBD = await this.logisticaService.getLayoutTemplate(this.filtroLocal);
      }
    } catch (e) {
      console.warn('Layout não encontrado, a usar vazio');
      this.layoutAtualBD = [];
    }

    try {
      let logistica: any[];
      if (this.modoLink) {
        logistica = await this.logisticaService.getLogisticaComToken(this.turnoSelecionado, this.filtroLocal, this.token!, this.pinSessao);
      } else {
        logistica = await this.logisticaService.getLogistica(this.turnoSelecionado, this.filtroLocal);
      }

      this.colunasCamaratas = [];
      this.colunasAtividades = [];

      logistica.forEach((item) => {
        const col: ColunaGrupo = {
          id: 'db-' + item.id,
          dbId: item.id,
          titulo: item.titulo,
          monitor: item.monitor_nome || '',
          tipo: item.tipo,
          genero: item.genero,
          capacidade: item.capacidade,
          lista: [],
          lado: this.getLadoPeloNome(item.titulo),
        };
        if (item.tipo === 'camarata') this.colunasCamaratas.push(col);
        else this.colunasAtividades.push(col);
      });
    } catch (e) {
      console.error('Erro ao carregar logística', e);
      this.snackBar.open('Erro ao carregar estrutura do turno', 'Fechar');
    }

    this.atualizarVista();
    this.loading = false; // <-- Desliga o loader
  }

  getLadoPeloNome(nome: string): 'Esq' | 'Dir' | undefined {
    if (!this.layoutAtualBD) return undefined;
    const match = this.layoutAtualBD.find((q) => q.titulo === nome);
    return match ? match.lado : undefined;
  }

  trocarAba(index: number) {
    this.modoVisualizacao = index === 0 ? 'camarata' : 'atividade';
    this.atualizarVista();
  }

  atualizarVista() {
    if (!this.turnoSelecionado) return;

    const mapaLocais: any = {
      quinta: 'Quinta',
      costaCaparica: 'Costa da Caparica',
      quiaios: 'Quiaios',
    };
    const localDbFiltro = (mapaLocais[this.filtroLocal] || 'Quinta').toLowerCase();

    const criancasTurno = this.todosRegistos.filter((i) => {
      const localRegisto = (i.local || '').toLowerCase();
      const matchLocal =
        localRegisto === localDbFiltro || localRegisto === this.filtroLocal.toLowerCase();

      return matchLocal && i.turnoEscolhido === this.turnoSelecionado;
    });

    [...this.colunasCamaratas, ...this.colunasAtividades].forEach((c) => (c.lista = []));
    const atribuidosIds = new Set<string>();

    criancasTurno.forEach((crianca) => {
      let atribuida = false;

      if (crianca.camarata_id) {
        const col = this.colunasCamaratas.find((c) => c.dbId == crianca.camarata_id);
        if (col) {
          col.lista.push(crianca);
          atribuida = true;
        }
      }

      if (this.modoVisualizacao === 'atividade' && crianca.grupo_id) {
        const col = this.colunasAtividades.find((c) => c.dbId == crianca.grupo_id);
        if (col) {
          col.lista.push(crianca);
        }
      }

      const temQuarto =
        crianca.camarata_id && this.colunasCamaratas.some((c) => c.dbId == crianca.camarata_id);
      const temGrupo =
        crianca.grupo_id && this.colunasAtividades.some((c) => c.dbId == crianca.grupo_id);

      if (this.modoVisualizacao === 'camarata' && temQuarto) atribuidosIds.add(crianca.id!);
      if (this.modoVisualizacao === 'atividade' && temGrupo) atribuidosIds.add(crianca.id!);
    });

    this.poolVisual = criancasTurno.filter((k) => k.id && !atribuidosIds.has(k.id));
  }

  inicializarQuartos() {
    if (
      this.colunasCamaratas.length > 0 &&
      !confirm('Reiniciar estrutura? Dados não guardados serão perdidos.')
    )
      return;

    this.colunasCamaratas.forEach((col) => this.poolVisual.push(...col.lista));
    this.colunasCamaratas = [];

    if (this.layoutAtualBD && this.layoutAtualBD.length > 0) {
      this.quartosDisponiveisSelect = this.layoutAtualBD
        .filter((item) => item.tipo === 'room')
        .map((q) => ({ ...q, selecionado: false, generoAtual: null }));

      this.dialog.open(this.dialogSelecaoQuartos, {
        width: '95vw',
        maxWidth: '98vw',
        panelClass: 'full-width-dialog',
      });
    } else {
      for (let i = 1; i <= this.qtdQuartosM; i++)
        this.adicionarColuna('camarata', 'M', `Quarto M ${i}`);
      for (let i = 1; i <= this.qtdQuartosF; i++)
        this.adicionarColuna('camarata', 'F', `Quarto F ${i}`);
      this.atualizarVista();
    }
  }

  confirmarSelecaoQuartos() {
    const selecionados = this.quartosDisponiveisSelect.filter((q) => q.selecionado);

    if (selecionados.length === 0) {
      this.snackBar.open('Selecione pelo menos um quarto.', 'Erro');
      return;
    }

    selecionados.forEach((q) => {
      let generoDestino = q.generoAtual || this.getGeneroPorLado(q.lado);

      this.colunasCamaratas.push({
        id: `temp-${q.titulo}`,
        titulo: q.titulo,
        monitor: '',
        tipo: 'camarata',
        capacidade: q.capacidade,
        lado: q.lado as 'Esq' | 'Dir',
        genero: generoDestino,
        lista: [],
      });
    });

    this.dialog.closeAll();
    this.atualizarVista();
    this.snackBar.open(`${selecionados.length} quartos adicionados!`, 'OK', { duration: 2000 });
  }

  getGridStyle(item: any): any {
    return {
      'grid-column': `${item.gCol} / span ${item.gSpan}`,
      'grid-row': `${item.gRow}`,
    };
  }

  get capacidadeSelecionadaTotal() {
    return this.quartosDisponiveisSelect
      .filter((q) => q.selecionado)
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

    this.quartosDisponiveisSelect.forEach(q => {
      if (q.generoAtual) {
        q.generoAtual = q.generoAtual === 'M' ? 'F' : 'M';
      }
    });
  }

  getGeneroPorLado(lado: 'Esq' | 'Dir'): 'M' | 'F' {
    return lado === 'Esq' ? this.configQuinta.ladoEsquerdo : this.configQuinta.ladoDireito;
  }

  getLabelLado(lado: 'Esq' | 'Dir'): string {
    const genero = this.getGeneroPorLado(lado);
    return genero === 'M' ? 'Rapazes' : 'Raparigas';
  }

  trocarLados() {
    if (this.filtroLocal !== 'quinta' && !this.layoutAtualBD.length) return;

    this.trocarConfiguracaoLados();

    let conflitos = 0;
    this.colunasCamaratas.forEach((col) => {
      if (col.lado === 'Esq') col.genero = this.configQuinta.ladoEsquerdo;
      if (col.lado === 'Dir') col.genero = this.configQuinta.ladoDireito;

      if (col.lista.some((c) => this.getGenero(c) !== col.genero)) conflitos++;
    });

    if (conflitos > 0)
      this.snackBar.open(`Atenção: ${conflitos} quartos com género trocado!`, 'OK', {
        duration: 5000,
      });
    else this.snackBar.open(`Lados trocados!`, 'OK', { duration: 2000 });
  }

  gerarGruposAtividade() {
    if (this.colunasAtividades.length > 0 && !confirm('Reiniciar grupos?')) return;
    this.colunasAtividades.forEach((col) => this.poolVisual.push(...col.lista));
    this.colunasAtividades = [];

    for (let i = 1; i <= this.qtdGruposAtiv; i++) {
      this.adicionarColuna('atividade', 'Misto', `Grupo ${i}`, 12);
    }

    this.distribuirNasAtividades();
  }

  adicionarColunaIndividual(tipo: 'camarata' | 'atividade', genero: 'M' | 'F' | 'Misto' = 'Misto') {
    const lista = tipo === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
    const num = lista.length + 1;
    const titulo =
      tipo === 'camarata'
        ? `Novo Quarto ${genero === 'M' ? 'M' : 'F'} ${num}`
        : `Novo Grupo ${num}`;
    const cap = tipo === 'camarata' ? 10 : 12;
    this.adicionarColuna(tipo, genero, titulo, cap);
    setTimeout(() => {
      const c = document.querySelector('.columns-area');
      if (c) c.scrollLeft = c.scrollWidth;
    }, 100);
  }

  private adicionarColuna(
    tipo: 'camarata' | 'atividade',
    genero: 'M' | 'F' | 'Misto',
    titulo: string,
    cap: number = 10,
  ) {
    const novaColuna: ColunaGrupo = {
      id: `temp-${tipo}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      titulo: titulo,
      monitor: '',
      tipo: tipo,
      genero: genero,
      capacidade: cap,
      lista: [],
    };
    if (tipo === 'camarata') this.colunasCamaratas.push(novaColuna);
    else this.colunasAtividades.push(novaColuna);
  }

  removerColuna(col: ColunaGrupo) {
    if (col.lista.length > 0) {
      if (
        !confirm(
          `Este grupo tem ${col.lista.length} crianças. Elas voltarão para a lista de espera. Continuar?`,
        )
      )
        return;
      this.poolVisual.push(...col.lista);
    }
    if (col.tipo === 'camarata')
      this.colunasCamaratas = this.colunasCamaratas.filter((c) => c.id !== col.id);
    else this.colunasAtividades = this.colunasAtividades.filter((c) => c.id !== col.id);
  }

  async guardarAlteracoes() {
    this.loading = true;
    this.snackBar.open('A guardar...', '');

    const itensLogistica = [...this.colunasCamaratas, ...this.colunasAtividades].map((c) => ({
      id: c.id,
      dbId: c.dbId,
      tipo: c.tipo,
      titulo: c.titulo,
      monitor: c.monitor,
      capacidade: c.capacidade,
      genero: c.genero,
    }));

    const payloadEstrutura = {
      turno: this.turnoSelecionado,
      local: this.filtroLocal,
      items: itensLogistica,
    };

    try {
      let res;
      // DECIDE QUAL ENDPOINT USAR BASEADO NO ACESSO
      if (this.modoLink) {
        res = await this.logisticaService.saveLogisticaComToken(payloadEstrutura, this.token!, this.pinSessao);
      } else {
        res = await this.logisticaService.saveLogistica(payloadEstrutura);
      }

      const idsMap = res.ids;

      [...this.colunasCamaratas, ...this.colunasAtividades].forEach((col) => {
        if (idsMap[col.id]) col.dbId = idsMap[col.id];
      });

      const updatesCriancas: any[] = [];

      this.colunasCamaratas.forEach((col) => {
        if (col.dbId) {
          col.lista.forEach((crianca) => {
            if (crianca.camarata_id != col.dbId) {
              updatesCriancas.push({ id: crianca.id!, data: { camarata_id: col.dbId } });
              crianca.camarata_id = col.dbId;
            }
          });
        }
      });

      this.colunasAtividades.forEach((col) => {
        if (col.dbId) {
          col.lista.forEach((crianca) => {
            if (crianca.grupo_id != col.dbId) {
              updatesCriancas.push({ id: crianca.id!, data: { grupo_id: col.dbId } });
              crianca.grupo_id = col.dbId;
            }
          });
        }
      });

      this.poolVisual.forEach((crianca) => {
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
        // As Inscrições também têm de suportar Token
        if (this.modoLink) {
          // Utiliza a função updateInscricaoBatch, mas com Token, tens de garantir que existe essa opção, 
          // ou iterar chamando a updateCheckinComToken. Se tens updateBatch para token:
          await this.inscricaoService.updateBatchComToken(updatesCriancas, this.token!, this.pinSessao);
        } else {
          await this.inscricaoService.updateBatch(updatesCriancas);
        }
        this.snackBar.open(`Guardado!`, 'OK', { duration: 3000 });
      } else {
        this.snackBar.open('Estrutura guardada.', 'OK', { duration: 3000 });
      }
    } catch (e) {
      console.error(e);
      this.snackBar.open('Erro ao gravar.', 'Fechar');
    }
    this.loading = false;
  }

  drop(event: CdkDragDrop<Inscricao[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const item = event.previousContainer.data[event.previousIndex];
      const destCol = [...this.colunasCamaratas, ...this.colunasAtividades].find(
        (c) => c.lista === event.container.data,
      );

      if (destCol) {
        if (destCol.lista.length >= destCol.capacidade) {
          this.snackBar.open('Capacidade máxima atingida!', 'X', { duration: 2000 });
          return;
        }
        if (destCol.genero !== 'Misto' && destCol.genero !== this.getGenero(item)) {
          this.snackBar.open(
            `Este quarto é apenas para ${destCol.genero === 'M' ? 'Rapazes' : 'Raparigas'}`,
            'X',
            { duration: 2000 },
          );
          return;
        }
      }
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
  }

  getFamilyId(i: Inscricao): string {
    const encarregado = (i as any).encarregadoEducacao || (i as any).encarregado;
    if (encarregado && encarregado.email) return encarregado.email.toLowerCase().trim();
    if (encarregado && encarregado.nif) return encarregado.nif;
    if (encarregado && encarregado.telefone) return encarregado.telefone;

    if (i.participante && i.participante.nomeCompleto) {
      const nomes = i.participante.nomeCompleto.trim().split(' ');
      if (nomes.length > 1) {
        return nomes.slice(-2).join(' ').toLowerCase();
      }
      return nomes[0].toLowerCase();
    }
    return Math.random().toString();
  }

  temIrmaoNaLista(crianca: Inscricao, lista: Inscricao[]): boolean {
    const meuFamilyId = this.getFamilyId(crianca);
    return lista.some((outra) => this.getFamilyId(outra) === meuFamilyId);
  }

  distribuirNasCamaratas() {
    if (this.colunasCamaratas.length === 0) return;

    const rapazes = this.poolVisual
      .filter((i) => this.getGenero(i) === 'M')
      .sort((a, b) => this.getIdade(a) - this.getIdade(b));

    const raparigas = this.poolVisual
      .filter((i) => this.getGenero(i) === 'F')
      .sort((a, b) => this.getIdade(a) - this.getIdade(b));

    this.poolVisual = [];

    this._distribuirAgrupadoEEquilibrado(
      rapazes,
      this.colunasCamaratas.filter((c) => c.genero === 'M'),
    );
    this._distribuirAgrupadoEEquilibrado(
      raparigas,
      this.colunasCamaratas.filter((c) => c.genero === 'F'),
    );
  }

  distribuirNasAtividades() {
    if (this.colunasAtividades.length === 0) return;

    const rapazes = this.poolVisual
      .filter((i) => this.getGenero(i) === 'M')
      .sort((a, b) => this.getIdade(a) - this.getIdade(b));

    const raparigas = this.poolVisual
      .filter((i) => this.getGenero(i) === 'F')
      .sort((a, b) => this.getIdade(a) - this.getIdade(b));

    this.poolVisual = [];

    this._distribuirAVez(rapazes, this.colunasAtividades);
    this._distribuirAVez(raparigas, this.colunasAtividades);

    this.colunasAtividades.forEach((grupo) => {
      grupo.lista.sort((a, b) => this.getIdade(a) - this.getIdade(b));
    });
  }

  private _distribuirAgrupadoEEquilibrado(lista: Inscricao[], alvos: ColunaGrupo[]) {
    if (alvos.length === 0) {
      this.poolVisual.push(...lista);
      return;
    }

    let remainingKids = [...lista];

    for (let i = 0; i < alvos.length; i++) {
      const quarto = alvos[i];
      const remainingRooms = alvos.length - i;

      let espacoFuturo = 0;
      for (let j = i + 1; j < alvos.length; j++) {
        espacoFuturo += alvos[j].capacidade - alvos[j].lista.length;
      }

      const minNecessario = Math.max(0, remainingKids.length - espacoFuturo);
      let targetCount = Math.floor(remainingKids.length / remainingRooms);
      targetCount = Math.max(targetCount, minNecessario);

      const espacoLivre = quarto.capacidade - quarto.lista.length;
      let amountToTake = Math.min(targetCount, espacoLivre);

      if (amountToTake > 0) {
        const toAdd: Inscricao[] = [];
        const indicesToRemove: number[] = [];

        for (let k = 0; k < remainingKids.length && toAdd.length < amountToTake; k++) {
          const candidato = remainingKids[k];

          if (
            !this.temIrmaoNaLista(candidato, quarto.lista) &&
            !this.temIrmaoNaLista(candidato, toAdd)
          ) {
            toAdd.push(candidato);
            indicesToRemove.push(k);
          }
        }

        if (toAdd.length < amountToTake) {
          for (let k = 0; k < remainingKids.length && toAdd.length < amountToTake; k++) {
            if (!indicesToRemove.includes(k)) {
              toAdd.push(remainingKids[k]);
              indicesToRemove.push(k);
            }
          }
        }

        quarto.lista.push(...toAdd);
        remainingKids = remainingKids.filter((_, idx) => !indicesToRemove.includes(idx));
      }
    }

    if (remainingKids.length > 0) {
      this.poolVisual.push(...remainingKids);
    }
  }

  private _distribuirAVez(lista: Inscricao[], alvos: ColunaGrupo[]) {
    lista.forEach((c) => {
      let gruposComVaga = alvos.filter((a) => a.lista.length < a.capacidade);

      if (gruposComVaga.length === 0) {
        this.poolVisual.push(c);
        return;
      }

      gruposComVaga.sort((a, b) => a.lista.length - b.lista.length);
      let placed = false;

      for (let alvo of gruposComVaga) {
        if (!this.temIrmaoNaLista(c, alvo.lista)) {
          alvo.lista.push(c);
          placed = true;
          break;
        }
      }

      if (!placed) {
        gruposComVaga[0].lista.push(c);
      }
    });
  }

  adicionarMonitorAEquipa(monitor: Monitor) {
    if (!this.equipaMonitores.includes(monitor.nomeMonitor)) {
      this.equipaMonitores.push(monitor.nomeMonitor);
      this.equipaMonitores.sort();
      this.snackBar.open(`${monitor.nomeMonitor} adicionado!`, 'OK', { duration: 2000 });
    }
    this.controlMonitor.setValue('');
    this.exibirBusca = false;
  }

  removerMonitorDaEquipa(nome: string) {
    const estaOcupado = [...this.colunasCamaratas, ...this.colunasAtividades].some(
      (c) => c.monitor === nome,
    );
    if (estaOcupado) {
      this.snackBar.open('Remova o monitor dos quartos primeiro!', 'Aviso');
      return;
    }
    this.equipaMonitores = this.equipaMonitores.filter((m) => m !== nome);
  }

  abrirDialogEquipa() {
    this.exibirBusca = false;
    this.dialog.open(this.dialogGerirEquipa, { width: '450px' });
  }

  ajustarCapacidade(col: ColunaGrupo, delta: number) {
    if (col.capacidade + delta > 0) col.capacidade += delta;
  }

  isMonitorDisponivel(n: string, c: ColunaGrupo): boolean {
    const lista =
      this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
    return !lista.some((x) => x.id !== c.id && x.monitor === n);
  }

  getGenero(i: Inscricao): 'M' | 'F' {
    return (i.participante as any).genero || 'M';
  }

  getIdade(i: Inscricao): number {
    if (!i.participante || !i.participante.dataNascimento) return 0;

    const born = new Date(i.participante.dataNascimento);
    // Verifica se a data é inválida
    if (isNaN(born.getTime())) {
      return 0;
    }

    const diffMs = Date.now() - born.getTime();
    const idade = Math.floor(diffMs / 31557600000);

    return idade >= 0 ? idade : 0;
  }

  get colunasAtivas(): ColunaGrupo[] {
    return this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
  }

  imprimirFichaMonitor(nome: string) {
    if (!nome) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Monitor: ${nome}`, 14, 20);
    const dados = this.colunasAtivas.find((c) => c.monitor === nome)?.lista || [];
    autoTable(doc, {
      head: [['Nome', 'Idade', 'Alergias', 'Medicação']],
      body: dados.map((d) => [
        d.participante.nomeCompleto,
        this.getIdade(d) + ' anos',
        d.saude.detalheAlergiaAlimentar || '-',
        d.saude.detalheMedicacao || '-',
      ]),
      startY: 30,
    });
    doc.save(`Ficha_${nome}.pdf`);
  }

  isRoomSelected(nomeTitulo: string): boolean {
    const room = this.quartosDisponiveisSelect.find((q) => q.titulo === nomeTitulo);
    return room ? room.selecionado : false;
  }

  toggleRoom(nomeTitulo: string) {
    const room = this.quartosDisponiveisSelect.find((q) => q.titulo === nomeTitulo);
    if (room) {
      if (!room.selecionado) {
        room.selecionado = true;
        room.generoAtual = this.getGeneroPorLado(room.lado);
      } else {
        const generoOriginalAla = this.getGeneroPorLado(room.lado);
        if (room.generoAtual === generoOriginalAla) {
          room.generoAtual = room.generoAtual === 'M' ? 'F' : 'M';
        } else {
          room.selecionado = false;
          room.generoAtual = null;
        }
      }
    }
  }

  getRoomDisplayGender(item: any): 'M' | 'F' {
    const room = this.quartosDisponiveisSelect.find((q) => q.titulo === item.titulo);
    if (room && room.selecionado && room.generoAtual) {
      return room.generoAtual;
    }
    return this.getGeneroPorLado(item.lado);
  }

  // --- NAVEGAÇÃO DE VOLTA PARA O CHECKIN ---
  irParaCheckin() {
    this.router.navigate(['/checkin'], { queryParams: this.modoLink ? { token: this.token } : {} });
  }

  get maxGridCols(): number {
    if (!this.layoutAtualBD || this.layoutAtualBD.length === 0) return 16;
    // Procura o elemento que vai mais longe na grelha (gCol + gSpan)
    return Math.max(...this.layoutAtualBD.map(item => item.gCol + (item.gSpan || 1) - 1), 16);
  }

  irParaPontuacoes() {
    // Guarda os estados selecionados pelo coordenador para serem lidos no Leaderboard
    sessionStorage.setItem('filtroLocal', this.filtroLocal);
    sessionStorage.setItem('turnoSelecionado', this.turnoSelecionado);

    this.router.navigate(['/pontuacoes']);
  }

  // Dentro da classe GruposComponent em grupos.component.ts

  exportarPdfDistribuicao() {
    if (!this.turnoSelecionado) return;

    // 1. FILTRAR CRIANÇAS DO TURNO ATIVO
    const mapaLocais: any = {
      quinta: 'Quinta',
      costaCaparica: 'Costa da Caparica',
      quiaios: 'Quiaios',
    };
    const localDbFiltro = (mapaLocais[this.filtroLocal] || 'Quinta').toLowerCase();

    const criancasTurno = this.todosRegistos.filter((i) => {
      const localRegisto = (i.local || '').toLowerCase();
      const matchLocal =
        localRegisto === localDbFiltro || localRegisto === this.filtroLocal.toLowerCase();
      return matchLocal && i.turnoEscolhido === this.turnoSelecionado;
    });

    // 2. CRIAR E POPULAR ESTRUTURAS
    const camaratasPDF = this.colunasCamaratas.map(col => ({
      titulo: col.titulo,
      monitor: col.monitor,
      dbId: col.dbId,
      genero: col.genero, // Preserva o género para a estilização dinâmica
      lista: [] as Inscricao[]
    }));

    const atividadesPDF = this.colunasAtividades.map(col => ({
      titulo: col.titulo,
      monitor: col.monitor,
      dbId: col.dbId,
      genero: col.genero,
      lista: [] as Inscricao[]
    }));

    criancasTurno.forEach((crianca) => {
      if (crianca.camarata_id) {
        const col = camaratasPDF.find((c) => c.dbId == crianca.camarata_id);
        if (col) col.lista.push(crianca);
      }
      if (crianca.grupo_id) {
        const col = atividadesPDF.find((c) => c.dbId == crianca.grupo_id);
        if (col) col.lista.push(crianca);
      }
    });

    // 3. INICIALIZAR DOC LANDSCAPE
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // --- CABEÇALHO DO DOCUMENTO ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(21, 128, 61); // Verde Quinta da Escola
    doc.text('QUINTA DA ESCOLA', 14, 15);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const localTxt = mapaLocais[this.filtroLocal] || 'Quinta da Escola';
    doc.text(`Local: ${localTxt}  |  Turno: ${this.turnoSelecionado}`, pageWidth - 14, 14, { align: 'right' });

    // Linha verde divisória
    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.8);
    doc.line(14, 17, pageWidth - 14, 17);

    let currentY = 24;

    // --- 4. FUNÇÃO AUXILIAR COM PINTURA DINÂMICA DE CABEÇALHOS ---
    const renderGrelhaTabelas = (
      dadosOriginais: any[],
      tituloSeccao: string,
      corHeaderPadrao: number[],
      tituloCor: number[],
      isCamarata: boolean = false
    ) => {
      if (dadosOriginais.length === 0) return;

      const maxColunasPorLinha = 6;

      for (let offset = 0; offset < dadosOriginais.length; offset += maxColunasPorLinha) {
        const blocoAtivo = dadosOriginais.slice(offset, offset + maxColunasPorLinha);

        const headers = blocoAtivo.map(col => `${col.titulo.toUpperCase()}\n ${col.monitor || 'Sem Monitor'}`);
        const rows: string[][] = [];
        const maxCriancasNoBloco = Math.max(...blocoAtivo.map(c => c.lista.length), 0);

        for (let i = 0; i < maxCriancasNoBloco; i++) {
          const row: string[] = [];
          blocoAtivo.forEach(col => {
            const item = col.lista[i];
            if (item) {
              const primeiroUltimo = item.participante.nomeCompleto.trim().split(/\s+/);
              const nomeCompacto = primeiroUltimo.length > 1
                ? `${primeiroUltimo[0]} ${primeiroUltimo[primeiroUltimo.length - 1]}`
                : primeiroUltimo[0];
              row.push(`• ${nomeCompacto} (${this.getIdade(item)}a)`);
            } else {
              row.push('');
            }
          });
          rows.push(row);
        }

        // Cálculo de quebra de página preventiva
        const alturaEstimadaTabela = 10 + (maxCriancasNoBloco * 5.5) + 10;
        const espacoNecessarioTotal = alturaEstimadaTabela + (offset === 0 ? 8 : 0);

        if (currentY + espacoNecessarioTotal > (pageHeight - 15)) {
          doc.addPage();
          currentY = 20;
        }

        if (offset === 0) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(tituloCor[0], tituloCor[1], tituloCor[2]);
          doc.text(tituloSeccao, 14, currentY);
          currentY += 5;
        }

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: currentY,
          margin: { left: 14, right: 14 },
          theme: 'grid',
          pageBreak: 'avoid',
          styles: { fontSize: 7.5, cellPadding: 1.8, font: 'Helvetica' },
          headStyles: {
            fillColor: corHeaderPadrao as any, // Cor de fallback
            textColor: [255, 255, 255],
            halign: 'center',
            fontSize: 8,
            fontStyle: 'bold'
          },
          columnStyles: {
            ...blocoAtivo.reduce((acc: any, _, idx) => {
              acc[idx] = { cellWidth: 'auto' };
              return acc;
            }, {})
          },
          // PINTURA COLUNA A COLUNA SEGUNDO O GÉNERO
          didParseCell: (data) => {
            if (data.section === 'head' && isCamarata) {
              const colInfo = blocoAtivo[data.column.index];
              if (colInfo) {
                if (colInfo.genero === 'F') {
                  data.cell.styles.fillColor = [219, 39, 119]; // Rosa (#db2777) - Raparigas
                } else if (colInfo.genero === 'M') {
                  data.cell.styles.fillColor = [30, 58, 138];  // Azul (#1e3a8a) - Rapazes
                } else if (colInfo.genero === 'Misto') {
                  data.cell.styles.fillColor = [217, 119, 6];   // Laranja (#d97706) - Mistos
                }
              }
            }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
      }
    };

    // 5. DESENHAR CAMARATAS (Com pintura dinâmica ativa)
    renderGrelhaTabelas(
      camaratasPDF,
      'DISTRIBUICAO DAS CAMARATAS',
      [30, 58, 138], // Fallback Azul
      [30, 58, 138],
      true // Ativa a verificação de género das camaratas
    );

    // Separador ou quebra de página
    if (currentY + 45 < (pageHeight - 15)) {
      doc.setDrawColor(203, 213, 225);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(14, currentY, pageWidth - 14, currentY);
      doc.setLineDashPattern([], 0);
      currentY += 8;
    } else {
      doc.addPage();
      currentY = 20;
    }

    // 6. DESENHAR ATIVIDADES (Castanho/Laranja Padrão)
    renderGrelhaTabelas(
      atividadesPDF,
      'GRUPOS DE ATIVIDADES',
      [180, 83, 9],
      [180, 83, 9],
      false // Sem género dinâmico para os grupos gerais
    );

    // Guardar o documento final
    doc.save(`Distribuicao_Logistica_${this.turnoSelecionado.replace(/\s+/g, '_')}.pdf`);
    this.snackBar.open('PDF gerado com sucesso!', 'OK', { duration: 3000 });
  }
}