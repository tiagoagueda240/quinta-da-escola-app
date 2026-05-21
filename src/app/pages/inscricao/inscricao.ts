import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { InscricaoService } from '../../services/inscricao.service';
import { OPCOES_TRANSPORTE } from '../../shared/transport-options';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  MAT_LUXON_DATE_ADAPTER_OPTIONS,
  MatLuxonDateModule,
} from '@angular/material-luxon-adapter';

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
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatLuxonDateModule,
  ],
  templateUrl: './inscricao.html',
  styleUrls: ['./inscricao.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-PT' },
    { provide: MAT_DATE_FORMATS, useValue: FORMATOS_PT_LUXON },
    { provide: MAT_LUXON_DATE_ADAPTER_OPTIONS, useValue: { useUtc: true } },
  ],
})
export class InscricaoComponent implements OnInit {
  inscricaoForm!: FormGroup;

  // Variáveis Dinâmicas
  // MUDANÇA: turnos agora é um array de objetos com as propriedades nome e precoBase
  turnos: { nome: string; precoBase: number; vagasRestantes?: number; esgotado?: boolean }[] = [];
  localAtual: 'Quinta' | 'Costa da Caparica' | 'Quiaios' = 'Quinta'; // Podes mudar isto dinamicamente se tiveres um seletor

  // Preços
  valorBase = 0; // Começa a 0 e será atualizado ao escolher o turno
  valor_total = 0;

  isSubmitting = false;
  mostrarSucesso = false;

  private fb = inject(FormBuilder);
  private inscricaoService = inject(InscricaoService);
  private destroyRef = inject(DestroyRef);

  readonly opcoesTransporte = OPCOES_TRANSPORTE;

  ngOnInit(): void {
    this.criarFormulario();
    this.carregarDadosIniciais();

    this.inscricaoForm
      .get('transporte')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.calcularTotal();
      });

    this.inscricaoForm
      .get('turnoEscolhido')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((turnoNome) => {
        const turnoSelecionado = this.turnos.find((t) => t.nome === turnoNome);
        this.valorBase = turnoSelecionado ? turnoSelecionado.precoBase : 0;
        this.calcularTotal();
        if (turnoSelecionado?.esgotado) {
          this.inscricaoForm.get('turnoEscolhido')?.setValue(null, { emitEvent: false });
        }
      });
  }

  async carregarDadosIniciais() {
    try {
      // Mapeia o nome do local para a key usada na API/Config ('quinta', 'costaCaparica', 'quiaios')
      const localApi =
        this.localAtual.toLowerCase() === 'quinta'
          ? 'quinta'
          : this.localAtual === 'Costa da Caparica'
            ? 'costaCaparica'
            : 'quiaios';

      // Chama o novo endpoint que traz preço e vagas restantes
      this.turnos = await lastValueFrom(this.inscricaoService.getTurnosPublicos(localApi));

      const turnosDisponiveis = this.turnos.filter((t) => !t.esgotado);
      if (turnosDisponiveis.length === 1) {
        this.inscricaoForm.get('turnoEscolhido')?.patchValue(turnosDisponiveis[0].nome);
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
        codigoPostal: [''],
        cc: ['', Validators.required],
        sistemaSaude: [''],
        tamanhoTshirt: ['S'], // Adicionado, pois a BD pede
      }),
      saude: this.fb.group({
        temAlergiaAlimentar: [false],
        detalheAlergiaAlimentar: [''],
        temOutrasAlergias: [false],
        detalheOutrasAlergias: [''],
        tomaMedicacao: ['nao'],
        detalheMedicacao: [''],
      }),
      ee: this.fb.group({
        nome: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        telefone: ['', [Validators.required, Validators.pattern(/^[0-9]{9}$/)]],
        nif: [''], // Adicionado, útil para a BD
        contactoEmergencia: [''],
      }),
      consenteDadosSaude: [false, Validators.requiredTrue],
      autorizaFotoVideo: [false, Validators.requiredTrue],
      transporte: [0, Validators.required],
      observacoes: [''],
      politicaPrivacidade: [false, Validators.requiredTrue],
    });
  }

  permitirApenasNumeros(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
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
        transporte:
          this.opcoesTransporte.find((t) => t.valor === dadosForm.transporte)?.label ||
          'Não definido',

        // Tipo de Cliente
        tipoCliente: dadosForm.tipoCliente,
        nomeInstituicao: dadosForm.nomeInstituicao,

        participante: {
          ...dadosForm.participante,
          genero: dadosForm.participante.genero || 'M',
          tamanhoTshirt: dadosForm.participante.tamanhoTshirt || 'S',
        },
        ee: {
          ...dadosForm.ee,
          nif: dadosForm.ee.nif || '',
          contactoEmergencia: dadosForm.ee.contactoEmergencia || '',
        },
        saude: {
          alergiaDetalhes:
            (dadosForm.saude.detalheAlergiaAlimentar || '') +
            (dadosForm.saude.detalheOutrasAlergias
              ? ' | ' + dadosForm.saude.detalheOutrasAlergias
              : ''),
          medicacaoHabitual: dadosForm.saude.detalheMedicacao || '',
        },
        observacoes: dadosForm.observacoes || '',
      };

      try {
        await this.inscricaoService.createInscricao(novaInscricao);
        this.mostrarSucesso = true;
      } catch (erro) {
        console.error('Erro ao submeter inscrição:', erro);
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
