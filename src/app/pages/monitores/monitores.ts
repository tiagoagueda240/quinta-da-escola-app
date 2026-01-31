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
import * as XLSX from 'xlsx-js-style';

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
    // 1. Preparar o termo de pesquisa (minúsculas e sem espaços extra)
    const termo = this.pesquisa ? this.pesquisa.toLowerCase().trim() : '';

    const filtrados = this.monitores.filter(m => {
      // --- LÓGICA DE PESQUISA (NOVO) ---
      const matchPesquisa = !termo ||
        m.nome.toLowerCase().includes(termo) ||
        (m.nomeMonitor && m.nomeMonitor.toLowerCase().includes(termo)) ||
        m.email.toLowerCase().includes(termo);

      // --- FILTROS EXISTENTES ---
      const matchFormacao = this.filtroFormacao ? m.formacoes?.includes(this.filtroFormacao) : true;
      const matchFaltaAlcunha = this.filtroFaltaAlcunha ? (!m.nomeMonitor || m.nomeMonitor.trim() === '') : true;
      const matchFaltaContacto = this.filtroFaltaContacto ? (!m.telefone || m.telefone.trim() === '') : true;

      // Só passa se cumprir TODOS os critérios
      return matchPesquisa && matchFormacao && matchFaltaAlcunha && matchFaltaContacto;
    });

    // --- DIVISÃO POR TURNOS ---
    if (this.turnoSelecionado) {
      this.monitoresAtribuidos = this.monitores.filter(m => m.turnosAtribuidos?.includes(this.turnoSelecionado));

      // Apenas aplicamos a pesquisa à lista de "Disponíveis" (lado direito)
      // para não esconder quem já está na equipa confirmada (lado esquerdo)
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

      // 1. ATENÇÃO: Adicionei 'cellStyles: true' para tentar ler as cores
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellStyles: true });

      let mapMonitores = new Map<string, Monitor>();
      let novos = 0;
      let atualizados = 0;
      let ignoradosPorCor = 0; // Contador para feedback

      this.monitores.forEach(m => {
        const key = this.gerarChaveUnica(m.email, m.nome);
        if (key) mapMonitores.set(key, { ...m });
      });

      for (const sheetName of workbook.SheetNames) {
        if (sheetName.trim() === 'Fev 2026') break;
        if (this.isAbaIrrelevante(sheetName)) continue;

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        if (!jsonData || jsonData.length === 0) continue;

        const { headerRowIndex, mapColunas } = this.detectarCabecalhos(jsonData);
        if (mapColunas.get('nome') === undefined) continue;

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {

          // --- NOVO BLOCO DE VERIFICAÇÃO DE COR ---
          // Obtemos o endereço da célula na Coluna A (índice 0) da linha atual (i)
          const cellAddress = XLSX.utils.encode_cell({ r: i, c: 0 });
          const cell = worksheet[cellAddress];

          // Se a célula existir e for vermelha, ignoramos a linha inteira
          if (this.isCellRed(cell)) {
            ignoradosPorCor++;
            continue;
          }
          // ----------------------------------------

          const row = jsonData[i];
          const nome = this.getVal(row, mapColunas, 'nome')?.toString().trim() || '';
          const email = this.getVal(row, mapColunas, 'email')?.toString().trim().toLowerCase() || '';

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
              formacoes: [sheetName]
            });
            novos++;
          }
        }
      }

      try {
        await this.monitorService.saveBulkMonitores(Array.from(mapMonitores.values()));
        await this.carregarDadosIniciais();
        this.dialog.closeAll();

        // Feedback atualizado
        this.snackBar.open(
          `Concluído: ${novos} novos, ${atualizados} atualizados. (${ignoradosPorCor} ignorados por estarem a vermelho)`,
          'OK',
          { duration: 5000 }
        );
      } catch (error) {
        console.error('Erro ao gravar:', error);
        this.snackBar.open('Erro ao sincronizar.', 'Fechar');
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


  /**
 * Verifica se a célula tem fundo vermelho (Estilos Excel)
 */
  private isCellRed(cell: any): boolean {
    if (!cell || !cell.s || !cell.s.fgColor) return false;

    // O Excel guarda as cores hexadecimais (muitas vezes em ARGB: Alpha, Red, Green, Blue)
    // Ex: FFFF0000 é vermelho puro.
    const color = cell.s.fgColor.rgb;

    if (!color) return false;

    // Lista de códigos Hex comuns para vermelho no Excel
    const vermelhos = [
      'FFFF0000', // Vermelho Standard
      'FF0000',   // Vermelho Curto
      'FFC00000', // Vermelho Escuro
      'FFCC0000',
      'FFFFC7CE', // Fundo Rosa/Vermelho claro (comum em validação de dados/erros)
      'FFFF9999'  // Vermelho claro
    ];

    return vermelhos.includes(color.toUpperCase());
  }
}