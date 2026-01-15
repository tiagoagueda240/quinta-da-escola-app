import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InscricaoService } from '../../services/inscricao.service';
import { Inscricao } from '../../models/inscricao.model';

// Importações do Angular Material
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

export const FORMATOS_PT = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: { month: '2-digit', year: 'numeric', day: '2-digit' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

@Component({
  selector: 'app-inscricao',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './inscricao.html', // Nota: Verifica se o nome do ficheiro é inscricao.component.html ou inscricao.html no teu projeto
  styleUrls: ['./inscricao.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-PT' },
    { provide: MAT_DATE_FORMATS, useValue: FORMATOS_PT }
  ]
})
export class InscricaoComponent implements OnInit {
  inscricaoForm!: FormGroup;
  
  valorBase = 395;
  valorTotal = 395;
  
  isSubmitting = false;
  detalhesPreco = '';
  
  // NOVA VARIÁVEL: Controla o ecrã de sucesso
  mostrarSucesso = false;

  private fb = inject(FormBuilder);
  private inscricaoService = inject(InscricaoService);

  turnos = [
    '1º Turno – 28 Junho a 4 Julho',
    '2º Turno – 5 a 11 Julho',
    '3º Turno – 12 a 18 Julho',
    '4º Turno – 19 a 25 Julho',
    '5º Turno – 26 Julho a 1 Agosto',
    '6º Turno – 2 a 8 Agosto',
    '7º Turno – 9 a 15 Agosto',
    '8º Turno – 16 a 22 Agosto',
    '9º Turno – 23 a 29 Agosto',
    '10º Turno – 30 Agosto a 5 Setembro'
  ];

  opcoesTransporte = [
    { label: 'Não (Entregue pelos pais)', valor: 0 },
    { label: 'Lisboa - Quinta da Escola (+20€)', valor: 20 },
    { label: 'Quinta da Escola - Lisboa (+20€)', valor: 20 },
    { label: 'Lisboa - Quinta - Lisboa (+40€)', valor: 40 }
  ];

  ngOnInit(): void {
    this.criarFormulario();
    
    this.inscricaoForm.get('transporte')?.valueChanges.subscribe(() => {
      this.calcularTotal();
    });
  }

  criarFormulario() {
    this.inscricaoForm = this.fb.group({
      tipoCliente: ['individual', Validators.required],
      nomeInstituicao: [''], 
      turnoEscolhido: ['', Validators.required],

      participante: this.fb.group({
        nomeCompleto: ['', Validators.required],
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
        telefone: ['', Validators.required],
        contactoEmergencia: ['']
      }),

      autorizaFotoVideo: [false, Validators.requiredTrue],
      transporte: [0, Validators.required],
      politicaPrivacidade: [false, Validators.requiredTrue]
    });
  }

  calcularTotal() {
    const valorTransporte = this.inscricaoForm.get('transporte')?.value || 0;
    this.valorTotal = this.valorBase + Number(valorTransporte);
    
    if (valorTransporte > 0) {
      this.detalhesPreco = `(Base: ${this.valorBase}€ + Transporte: ${valorTransporte}€)`;
    } else {
      this.detalhesPreco = '(Valor Base)';
    }
  }

  async onSubmit() {
    if (this.inscricaoForm.valid) {
      this.isSubmitting = true;
      // Não desabilitamos o form imediatamente para não ficar cinzento atrás do overlay
      
      const dadosForm = this.inscricaoForm.getRawValue();
      
      const novaInscricao: Inscricao = {
        ...dadosForm,
        dataCriacao: new Date(),
        valorTotal: this.valorTotal,
        estadoPagamento: 'pendente',
        transporte: this.opcoesTransporte.find(t => t.valor === dadosForm.transporte)?.label || 'Não definido'
      };

      try {
        await this.inscricaoService.addInscricao(novaInscricao);
        
        // --- AQUI ESTÁ A MUDANÇA ---
        // Em vez de alert e reset, mostramos o overlay
        this.mostrarSucesso = true;
        this.isSubmitting = false;
        
        // Scroll para o topo para garantir que o overlay é visto corretamente em mobile
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
      } catch (erro) {
        console.error('Erro ao submeter:', erro);
        alert('Ocorreu um erro técnico. Por favor, tente novamente ou contacte-nos.');
        this.isSubmitting = false;
      }
    } else {
      this.inscricaoForm.markAllAsTouched();
      alert('Por favor, preencha todos os campos obrigatórios assinalados a vermelho.');
    }
  }

  // Função chamada pelo botão "Inscrever Irmão"
  novaInscricao() {
    window.location.reload();
  }
}