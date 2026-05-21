import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { ConfigTurnos, Inscricao, TurnoConfig } from '../../models/inscricao.model';
import { Monitor } from '../../models/monitor.model';
import { InscricaoService } from '../../services/inscricao.service';
import { MonitorService } from '../../services/monitor.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';

// Material Imports
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  MatListModule,
  MatListOption,
  MatSelectionList,
  MatSelectionListChange,
} from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-monitores',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatChipsModule,
    DragDropModule,
    MatListModule,
    MatPaginatorModule,
  ],
  templateUrl: './monitores.html',
  styleUrls: ['./monitores.scss'],
})
export class MonitoresComponent implements OnInit {
  monitores: Monitor[] = [];
  inscricoes: Inscricao[] = [];

  monitoresAtribuidos: Monitor[] = [];
  monitoresDisponiveis: Monitor[] = [];

  pesquisa: string = '';
  turnoSelecionado: string = '';
  filtroFormacao: string = '';
  filtroFaltaAlcunha: boolean = false;
  filtroFaltaContacto: boolean = false;

  listaFormacoes: string[] = [];
  listaTurnos: string[] = [];
  todosTurnosConfig: ConfigTurnos | null = null;

  stats = { monitores: 0, totalCriancas: 0, racio: 0 };
  monitorForm!: FormGroup;
  isEditing = false;
  selectedMonitorId: string | null = null;
  selectedMonitor: Monitor | null = null;
  isDraggingFile = false;

  @ViewChild('dialogMonitor') dialogMonitor!: TemplateRef<any>;
  @ViewChild('dialogTurnosMonitor') dialogTurnosMonitor!: TemplateRef<any>;
  @ViewChild('dialogImportar') dialogImportar!: TemplateRef<any>;
  @ViewChild('turnosList') turnosList!: MatSelectionList;

  private monitorService = inject(MonitorService);
  private inscricaoService = inject(InscricaoService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private confirmService = inject(ConfirmService);

  private readonly COL_ALIASES: any = {
    nome: ['nome completo', 'nome'],
    email: ['mail', 'email', 'e-mail', 'correio eletrónico'],
    telefone: ['telemóvel', 'telemovel', 'telefone', 'contacto'],
    alcunha: ['nome de batismo', 'nome monitor', 'nome de monitor', 'alcunha'],
    nascimento: ['data nasc.', 'data nascimento', 'data de nascimento'],
    intolerancias: ['intolerâncias', 'intolerancias', 'rest. alim', 'restrições alimentares'],
  };

  async ngOnInit() {
    this.monitorForm = this.fb.group({
      nome: ['', Validators.required],
      nomeMonitor: [''],
      telefone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      diasTrabalhados: [0, Validators.min(0)],
      obs: [''],
    });

    try {
      await this.carregarTurnosDoSistema();
      await this.carregarConfiguracaoCompleta();
      await this.carregarDadosIniciais();

      this.inscricoes = await lastValueFrom(this.inscricaoService.getInscricoes());
      this.atualizarStats();
    } catch (error) {
      this.snackBar.open('Erro ao inicializar os monitores.', 'OK', { duration: 3000 });
    }
  }

  async carregarTurnosDoSistema() {
    try {
      const config = await this.inscricaoService.getConfiguracoesTurnos();
      const todosTurnos = [
        ...(config.quinta || []),
        ...(config.costaCaparica || []),
        ...(config.quiaios || []),
      ];
      this.listaTurnos = todosTurnos.filter((t: any) => t.ativo === true).map((t: any) => t.nome);
    } catch (e) {
      console.error('Erro ao carregar turnos', e);
      this.snackBar.open('Erro ao carregar lista de turnos.', 'OK');
    }
  }

  async carregarConfiguracaoCompleta() {
    this.todosTurnosConfig = await this.inscricaoService.getConfiguracoesTurnos();
  }

  // --- LÓGICA DE COORDENAÇÃO ---

  isCoordenador(m: Monitor): boolean {
    if (!this.turnoSelecionado) return false;
    const turnoObj = this.encontrarTurnoNaConfig(this.turnoSelecionado);
    if (!turnoObj || !turnoObj.coordenadores) return false;
    const nome = m.nomeMonitor || m.nome;
    return turnoObj.coordenadores.includes(nome);
  }

  async toggleCoordenador(m: Monitor) {
    if (!this.turnoSelecionado) return;

    const turnoObj = this.encontrarTurnoNaConfig(this.turnoSelecionado);
    if (!turnoObj) return;

    if (!turnoObj.coordenadores) turnoObj.coordenadores = [];

    const nome = m.nomeMonitor || m.nome;
    const index = turnoObj.coordenadores.indexOf(nome);

    if (index > -1) {
      // Remover
      const ok = await this.confirmService.confirmar(
        `Remover ${nome} de Coordenador deste turno?`,
        { cor: 'warn' },
      );
      if (ok) {
        turnoObj.coordenadores.splice(index, 1);
        this.snackBar.open(`${nome} removido de coordenador!`, 'OK', { duration: 2000 });
      } else {
        return;
      }
    } else {
      // Adicionar
      turnoObj.coordenadores.push(nome);
      this.snackBar.open(`${nome} definido como coordenador!`, 'OK', { duration: 2000 });
    }

    try {
      await this.inscricaoService.saveConfiguracoesTurnos(this.todosTurnosConfig!);
    } catch (e) {
      console.error(e);
      this.snackBar.open('Erro ao gravar coordenador.', 'Fechar');
    }
  }

  // Método auxiliar silencioso (para o botão X usar)
  async removerCoordenadorSilenciosamente(m: Monitor) {
    if (!this.turnoSelecionado) return;
    const turnoObj = this.encontrarTurnoNaConfig(this.turnoSelecionado);
    if (!turnoObj || !turnoObj.coordenadores) return;

    const nome = (m.nomeMonitor || m.nome).toLowerCase().trim();

    // Procura o índice ignorando maiúsculas/minúsculas
    const index = turnoObj.coordenadores.findIndex((c: any) => c.toLowerCase().trim() === nome);

    if (index > -1) {
      turnoObj.coordenadores.splice(index, 1);
      await this.inscricaoService.saveConfiguracoesTurnos(this.todosTurnosConfig!);
    }
  }

  private encontrarTurnoNaConfig(nomeTurno: string): TurnoConfig | undefined {
    const locais: (keyof ConfigTurnos)[] = ['quinta', 'costaCaparica', 'quiaios'];
    for (const local of locais) {
      const lista = this.todosTurnosConfig?.[local] || [];
      const encontrado = lista.find((t: any) => t.nome === nomeTurno);
      if (encontrado) return encontrado;
    }
    return undefined;
  }

  // --- LÓGICA GERAL ---

  async carregarDadosIniciais() {
    this.monitores = await this.monitorService.getMonitoresOtimizados();
    this.extrairFormacoesUnicas();
    this.atualizarListas();
  }

  async onSearchChange() {
    this.monitores = await this.monitorService.getMonitoresOtimizados(this.pesquisa);
    this.atualizarListas();
  }

  trackByMonitorId(index: number, item: Monitor) {
    return item.id || index;
  }

  obterPrimeiroUltimoNome(nome: string): string {
    if (!nome) return 'Sem Nome';
    const partes = nome.trim().split(' ');
    if (partes.length <= 1) return partes[0];
    return `${partes[0]} ${partes[partes.length - 1]}`;
  }

  extrairFormacoesUnicas() {
    const set = new Set<string>();
    this.monitores.forEach((m) => {
      if (m.formacoes) m.formacoes.forEach((f) => set.add(f));
    });
    this.listaFormacoes = Array.from(set).sort().reverse();
  }

  toggleFiltroAlcunha(event: any) {
    this.filtroFaltaAlcunha = event.selected;
    this.atualizarListas();
  }
  toggleFiltroContacto(event: any) {
    this.filtroFaltaContacto = event.selected;
    this.atualizarListas();
  }

  atualizarListas() {
    const termo = this.pesquisa ? this.pesquisa.toLowerCase().trim() : '';

    const filtrados = this.monitores.filter((m) => {
      const matchPesquisa =
        !termo ||
        m.nome.toLowerCase().includes(termo) ||
        (m.nomeMonitor && m.nomeMonitor.toLowerCase().includes(termo)) ||
        m.email.toLowerCase().includes(termo);

      const matchFormacao = this.filtroFormacao ? m.formacoes?.includes(this.filtroFormacao) : true;
      const matchFaltaAlcunha = this.filtroFaltaAlcunha
        ? !m.nomeMonitor || m.nomeMonitor.trim() === ''
        : true;
      const matchFaltaContacto = this.filtroFaltaContacto
        ? !m.telefone || m.telefone.trim() === ''
        : true;

      return matchPesquisa && matchFormacao && matchFaltaAlcunha && matchFaltaContacto;
    });

    if (this.turnoSelecionado) {
      this.monitoresAtribuidos = this.monitores.filter((m) =>
        m.turnosAtribuidos?.includes(this.turnoSelecionado),
      );
      this.monitoresDisponiveis = filtrados.filter(
        (m) => !m.turnosAtribuidos?.includes(this.turnoSelecionado),
      );
    } else {
      this.monitoresAtribuidos = [];
      this.monitoresDisponiveis = filtrados;
    }

    this.atualizarStats();
  }

  abrirImportar() {
    this.dialog.open(this.dialogImportar, { width: '450px' });
  }
  onFileOver(e: any) {
    e.preventDefault();
    this.isDraggingFile = true;
  }
  onFileLeave(e: any) {
    e.preventDefault();
    this.isDraggingFile = false;
  }
  onFileDrop(e: any) {
    e.preventDefault();
    this.isDraggingFile = false;
    this.processarFicheiro(e.dataTransfer.files[0]);
  }

  processarFicheiro(file: File) {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellStyles: true });

      let mapMonitores = new Map<string, Monitor>();
      let novos = 0;
      let atualizados = 0;
      let ignoradosPorCor = 0;

      this.monitores.forEach((m) => {
        const key = this.gerarChaveUnica(m.email, m.nome);
        if (key) mapMonitores.set(key, { ...m });
      });

      for (const sheetName of workbook.SheetNames) {
        if (this.isAbaIrrelevante(sheetName)) continue;

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        if (!jsonData || jsonData.length === 0) continue;

        const { headerRowIndex, mapColunas } = this.detectarCabecalhos(jsonData);
        if (mapColunas.get('nome') === undefined) continue;

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const cellAddress = XLSX.utils.encode_cell({ r: i, c: 0 });
          const cell = worksheet[cellAddress];

          if (this.isCellRed(cell)) {
            ignoradosPorCor++;
            continue;
          }

          const row = jsonData[i];
          const nome = this.getVal(row, mapColunas, 'nome')?.toString().trim() || '';
          const email =
            this.getVal(row, mapColunas, 'email')?.toString().trim().toLowerCase() || '';

          if (!nome && !email) continue;

          const key = this.gerarChaveUnica(email, nome);
          if (!key) continue;

          const registro = mapMonitores.get(key);
          const status = sheetName.toLowerCase().includes('estag') ? 'estagiario' : 'monitor';

          if (registro) {
            const historico = registro.formacoes || [];
            if (!historico.includes(sheetName)) {
              registro.formacoes = [...historico, sheetName];
            }
            const novoTel = this.getVal(row, mapColunas, 'telefone')?.toString();
            if (novoTel && !registro.telefone) registro.telefone = novoTel;

            mapMonitores.set(key, registro);
            atualizados++;
          } else {
            const alcunha = this.getVal(row, mapColunas, 'alcunha')?.toString().trim() || '';
            mapMonitores.set(key, {
              nome: nome || 'Sem Nome',
              email: email,
              telefone: this.getVal(row, mapColunas, 'telefone')?.toString() || '',
              nomeMonitor: alcunha,
              faltaAlcunha: alcunha.length < 2,
              dataNascimento: new Date(),
              intolerancias: this.getVal(row, mapColunas, 'intolerancias')?.toString() || '',
              diasTrabalhados: status === 'estagiario' ? 0 : 8,
              status: status as any,
              turnosAtribuidos: [],
              formacoes: [sheetName],
            });
            novos++;
          }
        }
      }

      try {
        await this.monitorService.saveBulkMonitores(Array.from(mapMonitores.values()));
        await this.carregarDadosIniciais();
        this.dialog.closeAll();
        this.snackBar.open(
          `Concluído: ${novos} novos, ${atualizados} atualizados. (${ignoradosPorCor} ignorados)`,
          'OK',
          { duration: 5000 },
        );
      } catch (error) {
        console.error('Erro ao gravar:', error);
        this.snackBar.open('Erro ao sincronizar.', 'Fechar');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private isAbaIrrelevante(name: string) {
    return [
      'horário',
      'ementa',
      'quartos',
      'esquema',
      'pagamentos',
      'resumo',
      'transporte',
      'lista',
    ].some((i) => name.toLowerCase().includes(i));
  }
  private gerarChaveUnica(email: string, nome: string) {
    if (email && email.includes('@')) return email.toLowerCase().trim();
    if (nome) return nome.toLowerCase().trim().replace(/\s+/g, ' ');
    return '';
  }
  private detectarCabecalhos(data: any[][]) {
    let headerRowIndex = -1,
      mapColunas = new Map<string, number>();
    for (let r = 0; r < Math.min(data.length, 20); r++) {
      const row = data[r];
      if (!Array.isArray(row)) continue;
      let matches = 0;
      row.forEach((c) => {
        if (typeof c === 'string') {
          Object.values(this.COL_ALIASES).forEach((al: any) => {
            if (al.includes(c.toLowerCase().trim())) matches++;
          });
        }
      });
      if (matches >= 2) {
        headerRowIndex = r;
        row.forEach((c: any, i) => {
          if (typeof c !== 'string') return;
          const val = c.toLowerCase().trim();
          for (const [k, al] of Object.entries(this.COL_ALIASES)) {
            if ((al as string[]).includes(val)) mapColunas.set(k, i);
          }
        });
        break;
      }
    }
    return { headerRowIndex, mapColunas };
  }
  private getVal(row: any[], map: Map<string, number>, key: string) {
    const idx = map.get(key);
    return idx !== undefined ? row[idx] : null;
  }

  drop(event: CdkDragDrop<Monitor[]>) {
    if (event.previousContainer === event.container)
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    else {
      const monitor = event.previousContainer.data[event.previousIndex];
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      event.container.id === 'lista-atribuidos'
        ? this.adicionarAoTurno(monitor)
        : this.removerDoTurno(monitor);
    }
  }

  async adicionarAoTurno(m: Monitor) {
    if (m.id && !m.turnosAtribuidos?.includes(this.turnoSelecionado)) {
      await this.monitorService.updateMonitor(m.id, {
        turnosAtribuidos: [...(m.turnosAtribuidos || []), this.turnoSelecionado],
      });
      m.turnosAtribuidos?.push(this.turnoSelecionado);
      this.atualizarStats();
    }
  }

  async removerDoTurno(m: Monitor) {
    if (m.id) {
      const novos = (m.turnosAtribuidos || []).filter((t) => t !== this.turnoSelecionado);

      await this.monitorService.updateMonitor(m.id, { turnosAtribuidos: novos });

      // Atualiza o objeto local
      m.turnosAtribuidos = novos;

      // ATENÇÃO: Isto é crucial para o monitor desaparecer visualmente da lista
      this.atualizarListas();
    }
  }

  // AÇÃO DO BOTÃO "X" (REMOVER)
  async toggleTurno(m: Monitor) {
    const estaNoTurno = m.turnosAtribuidos?.includes(this.turnoSelecionado);

    // CENÁRIO A: REMOVER DO TURNO
    if (estaNoTurno) {
      if (this.isCoordenador(m)) {
        const nome = m.nomeMonitor || m.nome;

        // Pede confirmação ÚNICA
        if (
          await this.confirmService.confirmar(
            `${nome} é Coordenador(a)! Ao remover deste turno, perderá também o estatuto de Coordenador. Deseja continuar?`,
            { cor: 'warn' },
          )
        ) {
          // 1. Remove coordenação (BD Configurações)
          await this.removerCoordenadorSilenciosamente(m);
          // 2. Remove do turno (BD Monitores) + Atualiza Ecrã
          await this.removerDoTurno(m);

          this.snackBar.open(`${nome} removido da equipa e da coordenação.`, 'OK', {
            duration: 3000,
          });
        }
        return;
      }
      // Se não for coordenador, remove direto
      this.removerDoTurno(m);
    }
    // CENÁRIO B: ADICIONAR AO TURNO
    else {
      this.adicionarAoTurno(m);
    }
  }

  atualizarStats() {
    if (!this.turnoSelecionado) return;
    const doTurno = this.inscricoes.filter((i) => i.turnoEscolhido === this.turnoSelecionado);
    this.stats.totalCriancas = doTurno.length;
    this.stats.monitores = this.monitoresAtribuidos.length;
    this.stats.racio =
      this.stats.monitores > 0 ? Math.round(this.stats.totalCriancas / this.stats.monitores) : 0;
  }

  abrirNovo() {
    this.isEditing = false;
    this.monitorForm.reset();
    this.dialog.open(this.dialogMonitor, { width: '400px' });
  }
  abrirEditar(m: Monitor) {
    this.isEditing = true;
    this.selectedMonitorId = m.id!;
    this.monitorForm.patchValue(m);
    this.dialog.open(this.dialogMonitor, { width: '400px' });
  }
  async guardarMonitor() {
    if (this.monitorForm.invalid) return;
    const d = this.monitorForm.value;
    if (this.isEditing) await this.monitorService.updateMonitor(this.selectedMonitorId!, d);
    else await this.monitorService.addMonitor({ ...d, turnosAtribuidos: [], formacoes: [] });
    await this.carregarDadosIniciais();
    this.dialog.closeAll();
  }
  async apagarMonitor(id?: string) {
    if (!id) return;
    const ok = await this.confirmService.confirmar('Apagar monitor?', {
      cor: 'warn',
      confirmar: 'Apagar',
    });
    if (ok) {
      await this.monitorService.deleteMonitor(id);
      await this.carregarDadosIniciais();
    }
  }

  abrirGestaoTurnos(m: Monitor) {
    this.selectedMonitor = m;
    this.dialog.open(this.dialogTurnosMonitor, { width: '400px' });
  }

  async atualizarSelecaoTurnos(event: MatSelectionListChange) {
    if (!this.selectedMonitor?.id) return;

    const option = event.options[0];
    const turnoNome = option.value;
    const isSelected = option.selected;

    // Deselect Scenario: Removing Turn
    if (!isSelected) {
      if (this.isCoordenadorDoTurno(this.selectedMonitor, turnoNome)) {
        const nome = this.selectedMonitor.nomeMonitor || this.selectedMonitor.nome;
        const okRemove = await this.confirmService.confirmar(
          `${nome} é Coordenador em "${turnoNome}". Ao sair deste turno, perderá a coordenação. Pretende continuar?`,
          { cor: 'warn' },
        );
        if (okRemove) {
          await this.removerCoordenadorDoTurno(this.selectedMonitor, turnoNome);
          this.snackBar.open('Coordenação removida.', 'OK', { duration: 2000 });
        } else {
          option.selected = true; // Revert checkbox
          return;
        }
      }
    }

    const novosTurnos = this.turnosList.selectedOptions.selected.map((o: MatListOption) => o.value);

    await this.monitorService.updateMonitor(this.selectedMonitor.id, {
      turnosAtribuidos: novosTurnos,
    });
    this.selectedMonitor.turnosAtribuidos = novosTurnos;

    if (this.turnoSelecionado) this.atualizarStats();
  }

  isMonitorNoTurno(t: string) {
    return this.selectedMonitor?.turnosAtribuidos?.includes(t);
  }

  private isCellRed(cell: any): boolean {
    if (!cell || !cell.s || !cell.s.fgColor) return false;
    const color = cell.s.fgColor.rgb;
    if (!color) return false;
    const vermelhos = ['FFFF0000', 'FF0000', 'FFC00000', 'FFCC0000', 'FFFFC7CE', 'FFFF9999'];
    return vermelhos.includes(color.toUpperCase());
  }

  private isCoordenadorDoTurno(monitor: Monitor, nomeTurno: string): boolean {
    const turnoObj = this.encontrarTurnoNaConfig(nomeTurno);
    if (!turnoObj || !turnoObj.coordenadores) return false;

    const lista = turnoObj.coordenadores.map((c: any) => c.toLowerCase().trim());
    const nome = (monitor.nomeMonitor || monitor.nome).toLowerCase().trim();
    const nomeCompleto = (monitor.nome || '').toLowerCase().trim();

    return lista.includes(nome) || lista.includes(nomeCompleto);
  }

  private async removerCoordenadorDoTurno(monitor: Monitor, nomeTurno: string) {
    const turnoObj = this.encontrarTurnoNaConfig(nomeTurno);
    if (!turnoObj || !turnoObj.coordenadores) return;

    const nome = monitor.nomeMonitor || monitor.nome;
    const nomeCompleto = monitor.nome || '';

    turnoObj.coordenadores = turnoObj.coordenadores.filter(
      (c: any) =>
        c.toLowerCase().trim() !== nome.toLowerCase().trim() &&
        c.toLowerCase().trim() !== nomeCompleto.toLowerCase().trim(),
    );

    await this.inscricaoService.saveConfiguracoesTurnos(this.todosTurnosConfig!);
  }
}
