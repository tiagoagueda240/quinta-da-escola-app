import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InscricaoService } from '../../services/inscricao.service';
import { Inscricao } from '../../models/inscricao.model';
import { lastValueFrom } from 'rxjs'; // Adicionado para lidar com chamadas async/await

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
    dateInput: 'dd/MM/yyyy',
  },
  display: {
    dateInput: 'dd/MM/yyyy',
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
    { provide: MAT_LUXON_DATE_ADAPTER_OPTIONS, useValue: { useUtc: true } }
  ]
})
export class InscricaoComponent implements OnInit {
  inscricaoForm!: FormGroup;

  // Variáveis Dinâmicas
  // MUDANÇA: turnos agora é um array de objetos com as propriedades nome e precoBase
  turnos: { nome: string, precoBase: number, vagasRestantes?: number }[] = [];
  localAtual: 'Quinta' | 'Costa da Caparica' | 'Quiaios' = 'Quinta'; // Podes mudar isto dinamicamente se tiveres um seletor

  // Preços
  valorBase = 0; // Começa a 0 e será atualizado ao escolher o turno
  valor_total = 0;

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

    // 1. Escuta mudanças no Transporte
    this.inscricaoForm.get('transporte')?.valueChanges.subscribe(() => {
      this.calcularTotal();
    });

    // 2. Escuta mudanças no Turno para atualizar o Valor Base
    this.inscricaoForm.get('turnoEscolhido')?.valueChanges.subscribe(turnoNome => {
      const turnoSelecionado = this.turnos.find(t => t.nome === turnoNome);
      if (turnoSelecionado) {
        this.valorBase = turnoSelecionado.precoBase;
      } else {
        this.valorBase = 0;
      }
      this.calcularTotal();
    });
  }

  async carregarDadosIniciais() {
    try {
      // Mapeia o nome do local para a key usada na API/Config ('quinta', 'costaCaparica', 'quiaios')
      const localApi = this.localAtual.toLowerCase() === 'quinta' ? 'quinta' :
        this.localAtual === 'Costa da Caparica' ? 'costaCaparica' : 'quiaios';

      // Chama o novo endpoint que traz preço e ignora turnos esgotados
      this.turnos = await lastValueFrom(this.inscricaoService.getTurnosPublicos(localApi));

      // Lógica de Seleção Automática se só existir 1 turno
      if (this.turnos.length === 1) {
        this.inscricaoForm.get('turnoEscolhido')?.patchValue(this.turnos[0].nome);
      }
    } catch (error) {
      console.error('Erro ao carregar turnos:', error);
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
        sistemaSaude: [''],
        tamanhoTshirt: ['S'] // Adicionado, pois a BD pede
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
        nif: [''], // Adicionado, útil para a BD
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
    this.valor_total = this.valorBase + Number(valorTransporte);
  }

  async onSubmit() {
    if (this.inscricaoForm.valid) {
      this.isSubmitting = true;
      const dadosForm = this.inscricaoForm.getRawValue();

      // CONVERSÃO CRÍTICA: Se dataNascimento for Luxon, converte para string YYYY-MM-DD
      if (dadosForm.participante.dataNascimento) {
        let data = dadosForm.participante.dataNascimento;
        if (typeof data.toJSDate === 'function') {
          data = data.toJSDate();
        }
        if (data instanceof Date) {
          dadosForm.participante.dataNascimento = data.toISOString().split('T')[0];
        }
      }

      // Preparar os dados para o envio
      const novaInscricao: any = {
        turnoEscolhido: dadosForm.turnoEscolhido,
        local: this.localAtual,
        valor_total: this.valor_total,
        autorizaFotoVideo: dadosForm.autorizaFotoVideo,
        transporte: this.opcoesTransporte.find(t => t.valor === dadosForm.transporte)?.label || 'Não definido',

        // Tipo de Cliente
        tipoCliente: dadosForm.tipoCliente,
        nomeInstituicao: dadosForm.nomeInstituicao,

        participante: {
          ...dadosForm.participante,
          genero: dadosForm.participante.genero || 'M',
          tamanhoTshirt: dadosForm.participante.tamanhoTshirt || 'S'
        },
        ee: {
          ...dadosForm.ee,
          nif: dadosForm.ee.nif || '',
          contactoEmergencia: dadosForm.ee.contactoEmergencia || ''
        },
        saude: {
          alergiaDetalhes: (dadosForm.saude.detalheAlergiaAlimentar || '') +
            (dadosForm.saude.detalheOutrasAlergias ? ' | ' + dadosForm.saude.detalheOutrasAlergias : ''),
          medicacaoHabitual: dadosForm.saude.detalheMedicacao || ''
        }
      };

      try {
        await this.inscricaoService.addInscricao(novaInscricao);
        this.mostrarSucesso = true;
      } catch (erro) {
        console.error("Erro ao submeter inscrição:", erro);
        alert('Ocorreu um erro ao processar a inscrição. Por favor, tente novamente.');
      } finally {
        this.isSubmitting = false;
      }
    } else {
      this.inscricaoForm.markAllAsTouched();
    }
  }

  novaInscricao() {
    window.location.reload();
  }
}