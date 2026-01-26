import { Component, OnInit, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MonitorService } from '../../services/monitor.service';
import { Monitor } from '../../models/monitor.model';
import { InscricaoService } from '../../services/inscricao.service';
import { Inscricao } from '../../models/inscricao.model';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatListModule } from '@angular/material/list';

import * as XLSX from 'xlsx';

@Component({
  selector: 'app-monitores',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule, MatSelectModule,
    MatCardModule, MatProgressBarModule, MatDialogModule,
    MatSnackBarModule, MatTooltipModule, MatMenuModule, MatChipsModule, DragDropModule,
    MatListModule
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
  listaTurnos = [
    '1º Turno – 28 Junho a 4 Julho', '2º Turno – 5 a 11 Julho', '3º Turno – 12 a 18 Julho',
    '4º Turno – 19 a 25 Julho', '5º Turno – 26 Julho a 1 Agosto', '6º Turno – 2 a 8 Agosto',
    '7º Turno – 9 a 15 Agosto', '8º Turno – 16 a 22 Agosto', '9º Turno – 23 a 29 Agosto',
    '10º Turno – 30 Agosto a 5 Setembro'
  ];

  stats = { monitores: 0, rapazes: 0, raparigas: 0, totalCriancas: 0, racio: 0 };
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

  ngOnInit() {
    this.monitorService.getMonitores().subscribe(data => {
      this.monitores = data;
      this.atualizarListas();
    });

    this.inscricaoService.getInscricoes().subscribe(data => {
      this.inscricoes = data;
      this.atualizarStats();
    });

    this.monitorForm = this.fb.group({
      nome: ['', Validators.required],
      nomeMonitor: ['', Validators.required],
      telefone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      diasTrabalhados: [0, Validators.min(0)]
    });
  }

  // --- LÓGICA DE IMPORTAÇÃO EXCEL ---

  abrirImportar() { this.dialog.open(this.dialogImportar, { width: '450px' }); }
  onFileOver(e: any) { e.preventDefault(); this.isDraggingFile = true; }
  onFileLeave(e: any) { e.preventDefault(); this.isDraggingFile = false; }
  onFileDrop(e: any) { e.preventDefault(); this.isDraggingFile = false; this.processarFicheiro(e.dataTransfer.files[0]); }

  processarFicheiro(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[];

      let categoriaAtual: 'monitor' | 'estagiario' | 'coordenador' = 'monitor';

      // 1. Mapeamento inicial
      const importadosBrutos: Monitor[] = rows.slice(1)
        .filter(row => row[2]) // Garante que tem Nome Completo
        .map(row => {
          if (row[0]) {
            const cat = row[0].toLowerCase();
            if (cat.includes('coord')) categoriaAtual = 'coordenador';
            else if (cat.includes('estag')) categoriaAtual = 'estagiario';
            else categoriaAtual = 'monitor';
          }

          const nomeCompleto = row[2];
          const alcunha = row[3];

          return {
            nome: nomeCompleto,
            nomeMonitor: alcunha || nomeCompleto.split(' ')[0],
            dataNascimento: this.parseExcelDate(row[4]),
            telefone: row[8] || '',
            email: row[9] || '',
            status: categoriaAtual,
            diasTrabalhados: categoriaAtual === 'estagiario' ? 0 : 8,
            turnosAtribuidos: [],
            tamanhoTshirt: 'M'
          };
        });

      // 2. REMOVER DUPLICADOS INTERNOS DO EXCEL
      // Filtramos a lista para manter apenas a primeira ocorrência de cada Email ou Nome
      const importadosUnicos = importadosBrutos.filter((m, index, self) =>
        index === self.findIndex((t) => (
          (t.email && t.email === m.email) || (t.nome === m.nome)
        ))
      );

      this.sincronizarMonitores(importadosUnicos);
    };
    reader.readAsArrayBuffer(file);
  }

  private parseExcelDate(val: any): Date {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  sincronizarMonitores(lista: Monitor[]) {
    let novos = 0;
    let atualizados = 0;

    lista.forEach(mImportado => {
      // Verificar se já existe na base de dados
      const existe = this.monitores.find(m =>
        (m.email && m.email === mImportado.email) || m.nome === mImportado.nome
      );

      if (!existe) {
        this.monitorService.addMonitor(mImportado);
        novos++;
      } else {
        this.monitorService.updateMonitor(existe.id!, mImportado);
        atualizados++;
      }
    });

    this.snackBar.open(`${novos} novos e ${atualizados} atualizados. Duplicados ignorados.`, 'OK', { duration: 3000 });
    this.dialog.closeAll();
  }

  // --- GESTÃO DE LISTAS E UI ---

  atualizarListas() {
    const termo = this.pesquisa.toLowerCase();
    const baseFiltrada = this.monitores.filter(m =>
      m.nomeMonitor.toLowerCase().includes(termo) ||
      m.nome.toLowerCase().includes(termo)
    );

    if (this.turnoSelecionado) {
      this.monitoresAtribuidos = baseFiltrada.filter(m => m.turnosAtribuidos?.includes(this.turnoSelecionado));
      this.monitoresDisponiveis = baseFiltrada.filter(m => !m.turnosAtribuidos?.includes(this.turnoSelecionado));
    } else {
      this.monitoresAtribuidos = [];
      this.monitoresDisponiveis = baseFiltrada;
    }
    this.atualizarStats();
  }

  drop(event: CdkDragDrop<Monitor[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const monitor = event.previousContainer.data[event.previousIndex];
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      if (event.container.id === 'lista-atribuidos') this.adicionarAoTurno(monitor);
      else this.removerDoTurno(monitor);
    }
  }

  adicionarAoTurno(m: Monitor) {
    if (!this.turnoSelecionado || !m.id) return;
    const turnos = m.turnosAtribuidos || [];
    if (!turnos.includes(this.turnoSelecionado)) {
      this.monitorService.updateMonitor(m.id, { turnosAtribuidos: [...turnos, this.turnoSelecionado] });
    }
  }

  removerDoTurno(m: Monitor) {
    if (!this.turnoSelecionado || !m.id) return;
    const novos = (m.turnosAtribuidos || []).filter(t => t !== this.turnoSelecionado);
    this.monitorService.updateMonitor(m.id, { turnosAtribuidos: novos });
  }

  atualizarStats() {
    if (!this.turnoSelecionado) return;
    const doTurno = this.inscricoes.filter(i => i.turnoEscolhido === this.turnoSelecionado);
    this.stats.totalCriancas = doTurno.length;
    this.stats.monitores = this.monitoresAtribuidos.length;
    this.stats.racio = this.stats.monitores > 0 ? Math.round(this.stats.totalCriancas / this.stats.monitores) : 0;
  }

  toggleTurno(m: Monitor) {
    const turnos = m.turnosAtribuidos || [];
    turnos.includes(this.turnoSelecionado) ? this.removerDoTurno(m) : this.adicionarAoTurno(m);
  }

  abrirNovo() {
    this.isEditing = false;
    this.monitorForm.reset({ diasTrabalhados: 0 });
    this.dialog.open(this.dialogMonitor, { width: '400px' });
  }

  abrirEditar(m: Monitor) {
    this.isEditing = true;
    this.selectedMonitorId = m.id || null;
    this.monitorForm.patchValue(m);
    this.dialog.open(this.dialogMonitor, { width: '400px' });
  }

  guardarMonitor() {
    if (this.monitorForm.invalid) return;
    const dados = this.monitorForm.value;
    if (this.isEditing && this.selectedMonitorId) this.monitorService.updateMonitor(this.selectedMonitorId, dados);
    else this.monitorService.addMonitor({ ...dados, turnosAtribuidos: [] });
    this.dialog.closeAll();
  }

  apagarMonitor(id?: string) { if (id && confirm('Eliminar monitor?')) this.monitorService.deleteMonitor(id); }
  getNomeCurtoTurno(nome: string) { return nome.split(' – ')[0]; }
  abrirGestaoTurnos(m: Monitor) { this.selectedMonitor = m; this.dialog.open(this.dialogTurnosMonitor, { width: '400px' }); }
  isMonitorNoTurno(t: string) { return this.selectedMonitor?.turnosAtribuidos?.includes(t); }

  atualizarSelecaoTurnos(event: any, selecionados: any[]) {
    if (!this.selectedMonitor?.id) return;
    const novos = selecionados.map(o => o.value);
    this.monitorService.updateMonitor(this.selectedMonitor.id, { turnosAtribuidos: novos });
    this.selectedMonitor!.turnosAtribuidos = novos;
  }
}