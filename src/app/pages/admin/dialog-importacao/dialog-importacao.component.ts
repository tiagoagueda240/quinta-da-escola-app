import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as XLSX from 'xlsx';
import { Inscricao } from '../../../models/inscricao.model';
import { InscricaoService } from '../../../services/inscricao.service';
import { OPCOES_TRANSPORTE } from '../../../shared/transport-options';

export interface DialogImportacaoData {
  workbook: XLSX.WorkBook;
  filtroLocal: 'quinta' | 'costaCaparica' | 'quiaios';
  todosOsTurnosConfig: any;
  inscricoesExistentes: Inscricao[];
}

@Component({
  selector: 'app-dialog-importacao',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './dialog-importacao.component.html',
  styleUrls: ['./dialog-importacao.component.scss'],
})
export class DialogImportacaoComponent implements OnInit {
  data = inject<DialogImportacaoData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<DialogImportacaoComponent>);
  private inscricaoService = inject(InscricaoService);
  private snackBar = inject(MatSnackBar);

  readonly opcoesTransporte = OPCOES_TRANSPORTE;

  localDestinoImportacao: 'quinta' | 'costaCaparica' | 'quiaios' = 'quinta';
  turnoDestinoImportacao = '';
  listaTurnosImportacao: string[] = [];
  isLocalEspecialImportacao = false;
  empresaImportacao = '';
  dadosImportacao = { validos: [] as any[], duplicados: 0, total: 0 };
  estaAImportar = false;

  private dicionarioCampos: { [key: string]: string[] } = {
    nome: ['nome', 'participante', 'crianca', 'aluno', 'nomecompleto'],
    nascimento: ['datanascimento', 'nascimento', 'idade', 'data'],
    genero: ['genero', 'sexo'],
    transporte: ['transporte', 'transfer', 'autocarro'],
    email: ['email', 'e-mail', 'correio', 'contactoemail'],
    telefone: ['telefone', 'telemovel', 'contato', 'celular', 'contacto'],
    alergias: ['alergias', 'medicacao', 'observacoes', 'saude', 'alergiasmedicacao'],
    nif: ['nif', 'contribuinte', 'nifee', 'contribuinteee'],
    preco: ['preco', 'precototal', 'valor', 'valortotal'],
  };

  ngOnInit() {
    this.localDestinoImportacao = this.data.filtroLocal;
    this.atualizarTurnosImportacao();
  }

  get dialogWidth(): string {
    return this.localDestinoImportacao === 'quinta' ? '1400px' : '950px';
  }

  atualizarTurnosImportacao() {
    if (this.data.todosOsTurnosConfig) {
      const lista = this.data.todosOsTurnosConfig[this.localDestinoImportacao] || [];
      this.listaTurnosImportacao = lista.map((t: any) => t.nome);
    }
    this.isLocalEspecialImportacao =
      this.localDestinoImportacao === 'costaCaparica' || this.localDestinoImportacao === 'quiaios';
    this.turnoDestinoImportacao = '';
    this.dadosImportacao = { validos: [], duplicados: 0, total: 0 };

    if (this.localDestinoImportacao === 'quinta' && this.data.workbook) {
      this.processarImportacaoQuinta(this.data.workbook);
    }
  }

  processarFicheiroSelecionado() {
    if (!this.data.workbook) return;

    if (this.localDestinoImportacao === 'quinta') {
      this.processarImportacaoQuinta(this.data.workbook);
      return;
    }

    if (!this.turnoDestinoImportacao) return;

    if (this.isLocalEspecialImportacao) {
      this.processarImportacaoEspecial(this.data.workbook);
    } else {
      this.processarImportacaoNormal(this.data.workbook);
    }
  }

  private processarImportacaoEspecial(wb: XLSX.WorkBook) {
    let inscricoesProcessadas: any[] = [];
    let duplicadosContador = 0;

    wb.SheetNames.forEach((sheetName) => {
      const ws: XLSX.WorkSheet = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (rawData.length < 2) return;

      let headerRowIndex = -1;
      let colMap = { benef: -1, nome: -1, nasc: -1, sexo: -1 };

      for (let r = 0; r < Math.min(rawData.length, 30); r++) {
        const row = rawData[r];
        if (!row || !Array.isArray(row)) continue;
        let found = 0;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c]).toLowerCase().trim();
          if (
            val === 'nº. benef.' ||
            val === 'nº benef.' ||
            val === 'nº benef' ||
            val.includes('benef')
          ) {
            colMap.benef = c;
            found++;
          }
          if (val === 'nome da criança' || val.includes('nome da criança') || val === 'nome') {
            colMap.nome = c;
            found++;
          }
          if (val === 'data nasc.' || val === 'data nasc' || val.includes('data nasc')) {
            colMap.nasc = c;
            found++;
          }
          if (val === 'sexo' || val === 'género' || val === 'genero') {
            colMap.sexo = c;
            found++;
          }
        }
        if (found >= 3) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1) return;

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const benef = colMap.benef !== -1 ? String(row[colMap.benef]).trim() : '';
        const nome = colMap.nome !== -1 ? String(row[colMap.nome]).trim() : '';
        let nasc = colMap.nasc !== -1 ? row[colMap.nasc] : '';
        const sexoRaw = colMap.sexo !== -1 ? String(row[colMap.sexo]).trim().toUpperCase() : '';
        let sexo = '';
        if (sexoRaw.startsWith('F')) sexo = 'F';
        if (sexoRaw.startsWith('M')) sexo = 'M';

        if (!benef || !nome || !nasc || !sexo || nome.length < 2) continue;

        if (typeof nasc === 'number') {
          nasc = new Date(Math.round((nasc - 25569) * 86400 * 1000)).toISOString().split('T')[0];
        } else {
          nasc = String(nasc).trim();
          if (nasc.length < 4) continue;
        }

        if (
          this.verificarDuplicado(
            nome,
            this.turnoDestinoImportacao,
            this.localDestinoImportacao,
            inscricoesProcessadas,
          )
        ) {
          duplicadosContador++;
          continue;
        }

        inscricoesProcessadas.push({
          turnoEscolhido: this.turnoDestinoImportacao,
          local: this.localDestinoImportacao,
          valor_total: this.getPrecoTurno(this.turnoDestinoImportacao, this.localDestinoImportacao),
          transporte: 'Não (Entregue pelos pais)',
          autorizaFotoVideo: false,
          estado_pagamento: 'pendente',
          tipoCliente: 'individual',
          nomeInstituicao: '',
          numeroBeneficiario: benef,
          participante: {
            nomeCompleto: nome,
            genero: sexo,
            dataNascimento: nasc,
            nif: '',
            codigoPostal: '',
            cc: '',
            sistemaSaude: '',
          },
          ee: { nome: 'EE de ' + nome, email: '', telefone: '', nif: '', contactoEmergencia: '' },
          saude: {
            temAlergiaAlimentar: false,
            detalheAlergiaAlimentar: '',
            tomaMedicacao: false,
            detalheMedicacao: '',
          },
        });
      }
    });

    this.dadosImportacao = {
      validos: inscricoesProcessadas,
      duplicados: duplicadosContador,
      total: inscricoesProcessadas.length + duplicadosContador,
    };
  }

  private processarImportacaoNormal(wb: XLSX.WorkBook) {
    let inscricoesProcessadas: any[] = [];
    let duplicadosContador = 0;

    wb.SheetNames.forEach((sheetName) => {
      const ws: XLSX.WorkSheet = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (rawData.length < 2) return;

      const cabecalhosRaw = rawData[0];
      const mapaIndex = this.mapearCabecalhos(cabecalhosRaw);

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0 || !row[mapaIndex.nome]) continue;
        const nomeInscrito = String(row[mapaIndex.nome]).trim();
        if (nomeInscrito.length < 2) continue;
        if (
          this.verificarDuplicado(
            nomeInscrito,
            this.turnoDestinoImportacao,
            this.localDestinoImportacao,
            inscricoesProcessadas,
          )
        ) {
          duplicadosContador++;
          continue;
        }
        inscricoesProcessadas.push(
          this.construirObjetoInscricao(row, mapaIndex, this.turnoDestinoImportacao),
        );
      }
    });

    this.dadosImportacao = {
      validos: inscricoesProcessadas,
      duplicados: duplicadosContador,
      total: inscricoesProcessadas.length + duplicadosContador,
    };
  }

  private processarImportacaoQuinta(wb: XLSX.WorkBook) {
    const inscricoesProcessadas: any[] = [];
    let duplicadosContador = 0;

    wb.SheetNames.forEach((sheetName) => {
      const ws: XLSX.WorkSheet = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (rawData.length < 2) return;

      let headerRowIndex = -1;
      const colMap: Record<string, number> = {
        nome: -1,
        genero: -1,
        nasc: -1,
        transporte: -1,
        email: -1,
        alergias: -1,
        observacoes: -1,
        telefone: -1,
        turno: -1,
      };

      for (let r = 0; r < Math.min(rawData.length, 10); r++) {
        const row = rawData[r];
        if (!row || !Array.isArray(row)) continue;
        let found = 0;
        for (let c = 0; c < row.length; c++) {
          const v = this.normalizar(String(row[c]));
          if ((v === 'nomecompleto' || v === 'nome') && colMap['nome'] === -1) {
            colMap['nome'] = c;
            found++;
          }
          if ((v.includes('genero') || v === 'sexo') && colMap['genero'] === -1) {
            colMap['genero'] = c;
            found++;
          }
          if (
            (v.includes('datanasc') || (v.includes('nasc') && !v.includes('turno'))) &&
            colMap['nasc'] === -1
          ) {
            colMap['nasc'] = c;
            found++;
          }
          if (v.includes('transporte') && colMap['transporte'] === -1) {
            colMap['transporte'] = c;
            found++;
          }
          if ((v.includes('email') || v.includes('mail')) && colMap['email'] === -1) {
            colMap['email'] = c;
            found++;
          }
          if (
            (v.includes('alergia') ||
              v === 'alergiasmedicacao' ||
              (v.includes('medicac') && !v.includes('turno'))) &&
            colMap['alergias'] === -1
          ) {
            colMap['alergias'] = c;
            found++;
          }
          if (v.includes('observac') && colMap['observacoes'] === -1) {
            colMap['observacoes'] = c;
            found++;
          }
          if ((v.includes('telefone') || v.includes('telemovel')) && colMap['telefone'] === -1) {
            colMap['telefone'] = c;
            found++;
          }
          if (
            (v.includes('datadoturno') || (v.includes('turno') && v.includes('data'))) &&
            colMap['turno'] === -1
          ) {
            colMap['turno'] = c;
            found++;
          }
        }
        if (found >= 3 && colMap['nome'] !== -1) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1 || colMap['nome'] === -1) return;

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !Array.isArray(row)) continue;
        const nome = String(row[colMap['nome']] ?? '').trim();
        if (!nome || nome.length < 2) continue;

        let nasc = '';
        if (colMap['nasc'] !== -1) {
          const val = row[colMap['nasc']];
          if (typeof val === 'number') {
            nasc = new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0];
          } else {
            const strVal = String(val).trim();
            const parts = strVal.split(/[\/\-]/);
            if (parts.length === 3 && parts[2].length === 4) {
              nasc = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
              nasc = strVal;
            }
          }
        }

        const generoRaw =
          colMap['genero'] !== -1 ? String(row[colMap['genero']]).trim().toUpperCase() : '';
        const genero: 'M' | 'F' = generoRaw.startsWith('F') ? 'F' : 'M';

        const turnoExcel = colMap['turno'] !== -1 ? String(row[colMap['turno']]).trim() : '';
        const turnoFinal = this.matchTurnoQuinta(turnoExcel);
        if (!turnoFinal) continue;

        const transporteRaw =
          colMap['transporte'] !== -1
            ? String(row[colMap['transporte']]).trim().toLowerCase()
            : 'não';
        const transporte =
          transporteRaw === 'sim'
            ? 'Lisboa - Quinta da Escola (+20€)'
            : 'Não (Entregue pelos pais)';

        const email = colMap['email'] !== -1 ? String(row[colMap['email']]).trim() : '';
        const alergias = colMap['alergias'] !== -1 ? String(row[colMap['alergias']]).trim() : '';
        const observacoes =
          colMap['observacoes'] !== -1 ? String(row[colMap['observacoes']]).trim() : '';
        const telefone =
          colMap['telefone'] !== -1
            ? String(row[colMap['telefone']]).trim().replace(/\s+/g, '')
            : '';

        if (this.verificarDuplicado(nome, turnoFinal, 'quinta', inscricoesProcessadas)) {
          duplicadosContador++;
          continue;
        }

        inscricoesProcessadas.push({
          turnoEscolhido: turnoFinal,
          local: 'quinta',
          valor_total: this.getPrecoTurno(turnoFinal, 'quinta'),
          transporte,
          autorizaFotoVideo: false,
          estado_pagamento: 'pendente',
          tipoCliente: 'individual',
          nomeInstituicao: '',
          numeroBeneficiario: '',
          observacoes,
          participante: {
            nomeCompleto: nome,
            genero,
            dataNascimento: nasc,
            nif: '',
            codigoPostal: '',
            cc: '',
            sistemaSaude: '',
          },
          ee: { nome: '', email, telefone, nif: '', contactoEmergencia: '' },
          saude: {
            temAlergiaAlimentar: !!alergias,
            detalheAlergiaAlimentar: alergias,
            tomaMedicacao: false,
            detalheMedicacao: '',
          },
        });
      }
    });

    this.dadosImportacao = {
      validos: inscricoesProcessadas,
      duplicados: duplicadosContador,
      total: inscricoesProcessadas.length + duplicadosContador,
    };
  }

  private matchTurnoQuinta(turnoExcel: string): string {
    if (!turnoExcel) return '';
    const normExcel = this.normalizar(turnoExcel);
    for (const t of this.listaTurnosImportacao) {
      if (this.normalizar(t) === normExcel) return t;
    }
    for (const t of this.listaTurnosImportacao) {
      const normT = this.normalizar(t);
      if (normT.includes(normExcel) || normExcel.includes(normT)) return t;
    }
    const numMatch = normExcel.match(/\d+/);
    if (numMatch) {
      for (const t of this.listaTurnosImportacao) {
        if (new RegExp(`\\b${numMatch[0]}\\b`).test(this.normalizar(t))) return t;
      }
    }
    return turnoExcel;
  }

  removerImportacao(idx: number) {
    this.dadosImportacao.validos.splice(idx, 1);
    this.dadosImportacao.total--;
  }

  aplicarTurnoATodos() {
    if (this.turnoDestinoImportacao && this.dadosImportacao.validos.length > 0) {
      this.dadosImportacao.validos.forEach((i) => (i.turnoEscolhido = this.turnoDestinoImportacao));
    }
  }

  private mapearCabecalhos(cabecalhos: string[]): any {
    const mapa: any = {};
    cabecalhos.forEach((cab, index) => {
      if (!cab) return;
      const cabNorm = this.normalizar(cab);
      for (const [chave, sinonimos] of Object.entries(this.dicionarioCampos)) {
        if (sinonimos.some((s) => cabNorm.includes(s))) {
          if (mapa[chave] === undefined) mapa[chave] = index;
        }
      }
    });
    if (mapa.nome === undefined) mapa.nome = 1;
    return mapa;
  }

  private verificarDuplicado(nome: string, turno: string, local: string, fila: any[]): boolean {
    const nomeNorm = this.normalizar(nome);
    const mapaLocaisFormal: Record<string, string> = {
      quinta: 'Quinta',
      costaCaparica: 'Costa da Caparica',
      quiaios: 'Quiaios',
    };
    const localFormal = mapaLocaisFormal[local] ?? local;

    const existeBD = this.data.inscricoesExistentes.some(
      (i) =>
        this.normalizar(i.participante.nomeCompleto) === nomeNorm &&
        i.turnoEscolhido === turno &&
        i.local === localFormal,
    );
    if (existeBD) return true;

    return fila.some(
      (i) =>
        this.normalizar(i.participante.nomeCompleto) === nomeNorm &&
        i.turnoEscolhido === turno &&
        i.local === local,
    );
  }

  private getPrecoTurno(turnoNome: string, local: string): number {
    if (!this.data.todosOsTurnosConfig || !turnoNome || !local) return 300;
    const lista: any[] = this.data.todosOsTurnosConfig[local] || [];
    const t = lista.find((x: any) => x.nome === turnoNome);
    return t?.precoBase ?? 300;
  }

  private construirObjetoInscricao(row: any[], mapa: any, turno: string): any {
    let dataNasc = '';
    if (mapa.nascimento !== undefined && row[mapa.nascimento]) {
      const val = row[mapa.nascimento];
      if (typeof val === 'number') {
        dataNasc = new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0];
      } else {
        dataNasc = val;
      }
    }

    return {
      turnoEscolhido: turno,
      local: this.localDestinoImportacao,
      valor_total:
        mapa.preco !== undefined && row[mapa.preco]
          ? Number(row[mapa.preco])
          : this.getPrecoTurno(turno, this.localDestinoImportacao),
      transporte:
        mapa.transporte !== undefined && row[mapa.transporte]
          ? String(row[mapa.transporte])
          : 'Não (Entregue pelos pais)',
      autorizaFotoVideo: false,
      estado_pagamento: 'pendente',
      participante: {
        nomeCompleto: String(row[mapa.nome]).trim(),
        genero:
          mapa.genero !== undefined && row[mapa.genero]
            ? String(row[mapa.genero]).toUpperCase().charAt(0)
            : '',
        dataNascimento: dataNasc,
        nif: '',
        codigoPostal: '',
        cc: '',
        sistemaSaude: '',
        tamanhoTshirt: '',
      },
      ee: {
        nome:
          mapa.ee !== undefined && row[mapa.ee]
            ? String(row[mapa.ee]).trim()
            : 'EE de ' + String(row[mapa.nome]).trim(),
        email: mapa.email !== undefined && row[mapa.email] ? String(row[mapa.email]).trim() : '',
        telefone:
          mapa.telefone !== undefined && row[mapa.telefone]
            ? String(row[mapa.telefone]).replace(/\D/g, '')
            : '',
        nif: mapa.nif !== undefined && row[mapa.nif] ? String(row[mapa.nif]) : '',
        contactoEmergencia: '',
      },
      saude: {
        temAlergiaAlimentar: false,
        temOutrasAlergias: false,
        tomaMedicacao: false,
        alergiaDetalhes:
          mapa.alergias !== undefined && row[mapa.alergias] ? String(row[mapa.alergias]) : '',
        medicacaoHabitual: '',
      },
    };
  }

  private normalizar(texto: string): string {
    if (!texto) return '';
    return texto
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  async confirmarImportacao() {
    const isQuinta = this.localDestinoImportacao === 'quinta';
    if (!isQuinta && !this.turnoDestinoImportacao) {
      this.snackBar.open('É obrigatório selecionar o Turno de Destino.', 'OK', { duration: 3000 });
      return;
    }

    this.estaAImportar = true;
    try {
      for (const inscricao of this.dadosImportacao.validos) {
        if (!isQuinta && !this.isLocalEspecialImportacao && this.empresaImportacao?.trim()) {
          inscricao.tipoCliente = 'instituicao';
          inscricao.nomeInstituicao = this.empresaImportacao.trim();
        }
        try {
          await this.inscricaoService.createInscricao(inscricao, false, true);
        } catch (innerError) {
          console.error('Erro numa linha específica:', innerError);
        }
      }

      this.snackBar.open(`${this.dadosImportacao.validos.length} Inscrições processadas.`, 'OK', {
        duration: 4000,
        panelClass: 'snackbar-success',
      });
      this.dialogRef.close(true);
    } catch (error) {
      console.error(error);
      this.snackBar.open('Ocorreu um erro geral.', 'OK', {
        duration: 3000,
        panelClass: 'snackbar-error',
      });
    } finally {
      this.estaAImportar = false;
    }
  }

  cancelar() {
    this.dialogRef.close(false);
  }
}
