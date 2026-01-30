import { Component, OnInit, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MonitorService } from '../../services/monitor.service';
import { Monitor } from '../../models/monitor.model';
import { InscricaoService } from '../../services/inscricao.service';
import { Inscricao } from '../../models/inscricao.model';

// Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-monitores',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule, MatSelectModule,
    MatCardModule, MatDialogModule, MatSnackBarModule, MatTooltipModule,
    MatMenuModule, MatChipsModule, DragDropModule, MatListModule, MatPaginatorModule
  ],
  templateUrl: './monitores.html',
  styleUrls: ['./monitores.scss']
})
export class MonitoresComponent implements OnInit {
  monitores: Monitor[] = [];
  inscricoes: Inscricao[] = [];
  totalMonitores = 100; // O ideal seria ter um contador no Firebase, ou um valor estimado
  pageSize = 10;
  ultimoDocAcessado: any = null;
  historicoPaginas: any[] = []; // Para poder voltar atrás

  monitoresAtribuidos: Monitor[] = [];
  monitoresDisponiveis: Monitor[] = [];

  pesquisa: string = '';
  turnoSelecionado: string = '';
  filtroFormacao: string = '';
  filtroFaltaAlcunha: boolean = false;
  filtroFaltaContacto: boolean = false;

  listaFormacoes: string[] = [];
  listaTurnos = [
    '1º Turno – 28 Junho a 4 Julho', '2º Turno – 5 a 11 Julho', '3º Turno – 12 a 18 Julho',
    '4º Turno – 19 a 25 Julho', '5º Turno – 26 Julho a 1 Agosto', '6º Turno – 2 a 8 Agosto',
    '7º Turno – 9 a 15 Agosto', '8º Turno – 16 a 22 Agosto', '9º Turno – 23 a 29 Agosto',
    '10º Turno – 30 Agosto a 5 Setembro'
  ];

  stats = { monitores: 0, totalCriancas: 0, racio: 0 };
  monitorForm!: FormGroup;
  isEditing = false;
  selectedMonitorId: string | null = null;
  selectedMonitor: Monitor | null = null;
  isDraggingFile = false;

  @ViewChild('dialogMonitor') dialogMonitor!: TemplateRef<any>;
  @ViewChild('dialogTurnosMonitor') dialogTurnosMonitor!: TemplateRef<any>;
  @ViewChild('dialogImportar') dialogImportar!: TemplateRef<any>;

  private monitorService = inject(MonitorService);
  private inscricaoService = inject(InscricaoService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  private readonly COL_ALIASES: any = {
    nome: ['nome completo', 'nome'],
    email: ['mail', 'email', 'e-mail', 'correio eletrónico'],
    telefone: ['telemóvel', 'telemovel', 'telefone', 'contacto'],
    alcunha: ['nome de batismo', 'nome monitor', 'nome de monitor', 'alcunha'],
    nascimento: ['data nasc.', 'data nascimento', 'data de nascimento'],
    intolerancias: ['intolerâncias', 'intolerancias', 'rest. alim', 'restrições alimentares']
  };

  async ngOnInit() {
    await this.carregarDadosIniciais();

    this.monitorForm = this.fb.group({
      nome: ['', Validators.required],
      nomeMonitor: [''],
      telefone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      diasTrabalhados: [0, Validators.min(0)],
      obs: ['']
    });

    this.inscricaoService.getInscricoes().subscribe(data => {
      this.inscricoes = data;
      this.atualizarStats();
    });
  }

  /** Carrega a primeira página de monitores e extrai formações */
  async carregarDadosIniciais() {
    this.monitores = await this.monitorService.getMonitoresOtimizados();
    this.extrairFormacoesUnicas();
    this.atualizarListas();
  }

  /** Acionado pelo campo de pesquisa no HTML */
  async onSearchChange() {
    // Busca no servidor conforme o utilizador digita
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
    this.monitores.forEach(m => {
      if (m.formacoes) m.formacoes.forEach(f => set.add(f));
    });
    this.listaFormacoes = Array.from(set).sort().reverse();
  }

  toggleFiltroAlcunha(event: any) { this.filtroFaltaAlcunha = event.selected; this.atualizarListas(); }
  toggleFiltroContacto(event: any) { this.filtroFaltaContacto = event.selected; this.atualizarListas(); }

  atualizarListas() {
    const filtrados = this.monitores.filter(m => {
      const matchFormacao = this.filtroFormacao ? m.formacoes?.includes(this.filtroFormacao) : true;
      const matchFaltaAlcunha = this.filtroFaltaAlcunha ? (!m.nomeMonitor || m.nomeMonitor.trim() === '') : true;
      const matchFaltaContacto = this.filtroFaltaContacto ? (!m.telefone || m.telefone.trim() === '') : true;
      return matchFormacao && matchFaltaAlcunha && matchFaltaContacto;
    });

    if (this.turnoSelecionado) {
      this.monitoresAtribuidos = this.monitores.filter(m => m.turnosAtribuidos?.includes(this.turnoSelecionado));
      this.monitoresDisponiveis = filtrados.filter(m => !m.turnosAtribuidos?.includes(this.turnoSelecionado));
    } else {
      this.monitoresAtribuidos = [];
      this.monitoresDisponiveis = filtrados;
    }
    this.atualizarStats();
  }

  // --- IMPORTAÇÃO EXCEL (BATCH) ---
  abrirImportar() { this.dialog.open(this.dialogImportar, { width: '450px' }); }
  onFileOver(e: any) { e.preventDefault(); this.isDraggingFile = true; }
  onFileLeave(e: any) { e.preventDefault(); this.isDraggingFile = false; }
  onFileDrop(e: any) { e.preventDefault(); this.isDraggingFile = false; this.processarFicheiro(e.dataTransfer.files[0]); }

  processarFicheiro(file: File) {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      // Mapa local para evitar duplicados e gerir atualizações
      let mapMonitores = new Map<string, Monitor>();

      // Variáveis de contagem para o feedback final
      let novos = 0;
      let atualizados = 0;

      // 1. Carregar os monitores que já temos na lista local para o Mapa
      this.monitores.forEach(m => {
        const key = this.gerarChaveUnica(m.email, m.nome);
        if (key) mapMonitores.set(key, { ...m });
      });

      // 2. Percorrer as abas do Excel
      for (const sheetName of workbook.SheetNames) {
        if (sheetName.trim() === 'Fev 2026') break;
        if (this.isAbaIrrelevante(sheetName)) continue;

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        if (!jsonData || jsonData.length === 0) continue;

        const { headerRowIndex, mapColunas } = this.detectarCabecalhos(jsonData);
        if (mapColunas.get('nome') === undefined) continue;

        // 3. Percorrer as linhas de cada aba
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const nome = this.getVal(row, mapColunas, 'nome')?.toString().trim() || '';
          const email = this.getVal(row, mapColunas, 'email')?.toString().trim().toLowerCase() || '';

          if (!nome && !email) continue;

          const key = this.gerarChaveUnica(email, nome);
          if (!key) continue;

          const registro = mapMonitores.get(key);
          const status = sheetName.toLowerCase().includes('estag') ? 'estagiario' : 'monitor';

          if (registro) {
            // --- ATUALIZAR MONITOR EXISTENTE ---
            const historico = registro.formacoes || [];
            if (!historico.includes(sheetName)) {
              registro.formacoes = [...historico, sheetName];
            }

            // Atualiza telefone se o existente estiver vazio
            const novoTel = this.getVal(row, mapColunas, 'telefone')?.toString();
            if (novoTel && !registro.telefone) registro.telefone = novoTel;

            mapMonitores.set(key, registro);
            atualizados++;
          } else {
            // --- CRIAR NOVO MONITOR (Com todos os campos obrigatórios) ---
            const alcunha = this.getVal(row, mapColunas, 'alcunha')?.toString().trim() || '';

            mapMonitores.set(key, {
              nome: nome || 'Sem Nome',
              email: email,
              telefone: this.getVal(row, mapColunas, 'telefone')?.toString() || '',
              nomeMonitor: alcunha,
              faltaAlcunha: alcunha.length < 2,
              dataNascimento: new Date(), // Valor padrão para evitar erro de tipo
              intolerancias: this.getVal(row, mapColunas, 'intolerancias')?.toString() || '',
              diasTrabalhados: status === 'estagiario' ? 0 : 8,
              status: status as any,
              turnosAtribuidos: [],
              formacoes: [sheetName]
            });
            novos++;
          }
        }
      }

      // 4. Gravação em Massa (Batch) no Firestore
      try {
        await this.monitorService.saveBulkMonitores(Array.from(mapMonitores.values()));

        // 5. Recarregar a lista (Nível 3 - Manual fetch) para ver as alterações
        await this.carregarDadosIniciais();

        this.dialog.closeAll();
        this.snackBar.open(
          `Sincronização concluída: ${novos} novos e ${atualizados} atualizações aplicadas.`,
          'OK',
          { duration: 5000 }
        );
      } catch (error) {
        console.error('Erro ao gravar no Firebase:', error);
        this.snackBar.open('Erro ao sincronizar com a base de dados.', 'Fechar');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private isAbaIrrelevante(name: string) { return ['horário', 'ementa', 'quartos', 'esquema', 'pagamentos', 'resumo', 'transporte', 'lista'].some(i => name.toLowerCase().includes(i)); }
  private gerarChaveUnica(email: string, nome: string) { if (email && email.includes('@')) return email.toLowerCase().trim(); if (nome) return nome.toLowerCase().trim().replace(/\s+/g, ' '); return ''; }
  private detectarCabecalhos(data: any[][]) {
    let headerRowIndex = -1, mapColunas = new Map<string, number>();
    for (let r = 0; r < Math.min(data.length, 20); r++) {
      const row = data[r]; if (!Array.isArray(row)) continue;
      let matches = 0;
      row.forEach(c => { if (typeof c === 'string') { Object.values(this.COL_ALIASES).forEach((al: any) => { if (al.includes(c.toLowerCase().trim())) matches++; }); } });
      if (matches >= 2) {
        headerRowIndex = r;
        row.forEach((c: any, i) => { if (typeof c !== 'string') return; const val = c.toLowerCase().trim(); for (const [k, al] of Object.entries(this.COL_ALIASES)) { if ((al as string[]).includes(val)) mapColunas.set(k, i); } });
        break;
      }
    }
    return { headerRowIndex, mapColunas };
  }
  private getVal(row: any[], map: Map<string, number>, key: string) { const idx = map.get(key); return idx !== undefined ? row[idx] : null; }

  // --- CRUD e DRAG DROP ---
  drop(event: CdkDragDrop<Monitor[]>) {
    if (event.previousContainer === event.container) moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    else {
      const monitor = event.previousContainer.data[event.previousIndex];
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      event.container.id === 'lista-atribuidos' ? this.adicionarAoTurno(monitor) : this.removerDoTurno(monitor);
    }
  }

  async adicionarAoTurno(m: Monitor) { if (m.id && !m.turnosAtribuidos?.includes(this.turnoSelecionado)) { await this.monitorService.updateMonitor(m.id, { turnosAtribuidos: [...(m.turnosAtribuidos || []), this.turnoSelecionado] }); m.turnosAtribuidos?.push(this.turnoSelecionado); this.atualizarStats(); } }
  async removerDoTurno(m: Monitor) { if (m.id) { const novos = (m.turnosAtribuidos || []).filter(t => t !== this.turnoSelecionado); await this.monitorService.updateMonitor(m.id, { turnosAtribuidos: novos }); m.turnosAtribuidos = novos; this.atualizarStats(); } }
  toggleTurno(m: Monitor) { m.turnosAtribuidos?.includes(this.turnoSelecionado) ? this.removerDoTurno(m) : this.adicionarAoTurno(m); }

  atualizarStats() { if (!this.turnoSelecionado) return; const doTurno = this.inscricoes.filter(i => i.turnoEscolhido === this.turnoSelecionado); this.stats.totalCriancas = doTurno.length; this.stats.monitores = this.monitoresAtribuidos.length; this.stats.racio = this.stats.monitores > 0 ? Math.round(this.stats.totalCriancas / this.stats.monitores) : 0; }

  abrirNovo() { this.isEditing = false; this.monitorForm.reset(); this.dialog.open(this.dialogMonitor, { width: '400px' }); }
  abrirEditar(m: Monitor) { this.isEditing = true; this.selectedMonitorId = m.id!; this.monitorForm.patchValue(m); this.dialog.open(this.dialogMonitor, { width: '400px' }); }
  async guardarMonitor() { if (this.monitorForm.invalid) return; const d = this.monitorForm.value; if (this.isEditing) await this.monitorService.updateMonitor(this.selectedMonitorId!, d); else await this.monitorService.addMonitor({ ...d, turnosAtribuidos: [], formacoes: [] }); await this.carregarDadosIniciais(); this.dialog.closeAll(); }
  async apagarMonitor(id?: string) { if (id && confirm('Apagar?')) { await this.monitorService.deleteMonitor(id); await this.carregarDadosIniciais(); } }

  abrirGestaoTurnos(m: Monitor) { this.selectedMonitor = m; this.dialog.open(this.dialogTurnosMonitor, { width: '400px' }); }
  async atualizarSelecaoTurnos(e: any, sel: any[]) { if (this.selectedMonitor?.id) { const novos = sel.map(o => o.value); await this.monitorService.updateMonitor(this.selectedMonitor.id, { turnosAtribuidos: novos }); this.selectedMonitor.turnosAtribuidos = novos; } }
  isMonitorNoTurno(t: string) { return this.selectedMonitor?.turnosAtribuidos?.includes(t); }

  async carregarPagina(event?: PageEvent) {
    // Se mudou o tamanho da página
    if (event && event.pageSize !== this.pageSize) {
      this.pageSize = event.pageSize;
      this.ultimoDocAcessado = null;
    }

    const resultado = await this.monitorService.getMonitoresPaginados(
      this.pesquisa,
      this.pageSize,
      this.ultimoDocAcessado
    );

    this.monitores = resultado.dados;
    this.ultimoDocAcessado = resultado.ultimoDoc;
    this.atualizarListas();
  }
}