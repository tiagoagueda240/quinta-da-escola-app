import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InscricaoService } from '../../services/inscricao.service';
import { Inscricao } from '../../models/inscricao.model';

// Angular Material Imports
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { MatLuxonDateModule, MAT_LUXON_DATE_ADAPTER_OPTIONS } from '@angular/material-luxon-adapter';

export const FORMATOS_PT_LUXON = {
  parse: {
    dateInput: 'dd/MM/yyyy', // Como o Luxon interpreta a escrita
  },
  display: {
    dateInput: 'dd/MM/yyyy', // O que aparece no ecrã (EXATAMENTE O QUE PRECISAS)
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'DD',
    monthYearA11yLabel: 'MMMM yyyy',
  },
};

@Component({
  selector: 'app-inscricao',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatCardModule, MatIconModule, MatLuxonDateModule
  ],
  templateUrl: './inscricao.html',
  styleUrls: ['./inscricao.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-PT' },
    { provide: MAT_DATE_FORMATS, useValue: FORMATOS_PT_LUXON },
    // Importante: garante que a data não muda de dia devido ao fuso horário (UTC)
    { provide: MAT_LUXON_DATE_ADAPTER_OPTIONS, useValue: { useUtc: true } }
  ]
})
export class InscricaoComponent implements OnInit {
  inscricaoForm!: FormGroup;

  // Variáveis Dinâmicas
  turnos: string[] = [];
  localAtual: 'Quinta' | 'Costa da Caparica' | 'Quiaios' = 'Quinta';

  //valorBase = 395;
  //valorTotal = 395;
  valorBase = 300;
  valorTotal = 300;
  isSubmitting = false;
  mostrarSucesso = false;

  private fb = inject(FormBuilder);
  private inscricaoService = inject(InscricaoService);

  opcoesTransporte = [
    { label: 'Não (Entregue pelos pais)', valor: 0 },
    { label: 'Lisboa - Quinta da Escola (+20€)', valor: 20 },
    { label: 'Quinta da Escola - Lisboa (+20€)', valor: 20 },
    { label: 'Lisboa - Quinta - Lisboa (+40€)', valor: 40 }
  ];

  ngOnInit(): void {
    this.criarFormulario();
    this.carregarDadosIniciais();

    this.inscricaoForm.get('transporte')?.valueChanges.subscribe(() => {
      this.calcularTotal();
    });
  }

  async carregarDadosIniciais() {
    try {
      const config = await this.inscricaoService.getConfiguracoesTurnos();

      if (config && config.quinta) {
        this.turnos = config.quinta;

        // Lógica de Seleção Automática
        if (this.turnos.length === 1) {
          // Se houver apenas 1 turno, seleciona-o automaticamente no formulário
          this.inscricaoForm.get('turnoEscolhido')?.patchValue(this.turnos[0]);
          this.inscricaoForm.get('turnoEscolhido')?.disable();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar turnos do Firebase:', error);
    }
  }

  criarFormulario() {
    this.inscricaoForm = this.fb.group({
      tipoCliente: ['individual', Validators.required],
      nomeInstituicao: [''],
      turnoEscolhido: ['', Validators.required],
      participante: this.fb.group({
        nomeCompleto: ['', Validators.required],
        genero: ['', Validators.required],
        dataNascimento: ['', Validators.required],
        nif: ['', [Validators.required, Validators.pattern(/^[0-9]{9}$/)]],
        morada: ['', Validators.required],
        cc: ['', Validators.required],
        sistemaSaude: ['']
      }),
      saude: this.fb.group({
        temAlergiaAlimentar: [false],
        detalheAlergiaAlimentar: [''],
        temOutrasAlergias: [false],
        detalheOutrasAlergias: [''],
        tomaMedicacao: ['nao'],
        detalheMedicacao: ['']
      }),
      ee: this.fb.group({
        nome: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        telefone: ['', [Validators.required, Validators.pattern(/^[0-9]{9}$/)]],
        contactoEmergencia: ['']
      }),
      autorizaFotoVideo: [false, Validators.requiredTrue],
      transporte: [0, Validators.required],
      politicaPrivacidade: [false, Validators.requiredTrue]
    });
  }

  permitirApenasNumeros(event: KeyboardEvent): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    return !(charCode > 31 && (charCode < 48 || charCode > 57));
  }

  calcularTotal() {
    const valorTransporte = this.inscricaoForm.get('transporte')?.value || 0;
    this.valorTotal = this.valorBase + Number(valorTransporte);
  }

  async onSubmit() {
    if (this.inscricaoForm.valid) {
      this.isSubmitting = true;
      const dadosForm = this.inscricaoForm.getRawValue();

      // CONVERSÃO CRÍTICA: Se dataNascimento for Luxon, converte para JS Date
      if (dadosForm.participante.dataNascimento && typeof dadosForm.participante.dataNascimento.toJSDate === 'function') {
        dadosForm.participante.dataNascimento = dadosForm.participante.dataNascimento.toJSDate();
      }

      const novaInscricao: Inscricao = {
        ...dadosForm,
        local: this.localAtual,
        dataCriacao: new Date(), // Date nativo
        valorTotal: this.valorTotal,
        estadoPagamento: 'pendente',
        transporte: this.opcoesTransporte.find(t => t.valor === dadosForm.transporte)?.label || 'Não definido'
      };

      try {
        await this.inscricaoService.addInscricao(novaInscricao);
        this.mostrarSucesso = true;
      } catch (erro) {
        console.error("Erro detalhado:", erro); // Muda o alert por isto para veres o erro real na consola
        alert('Erro ao guardar inscrição. Vê a consola do navegador.');
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  novaInscricao() {
    window.location.reload();
  }
}