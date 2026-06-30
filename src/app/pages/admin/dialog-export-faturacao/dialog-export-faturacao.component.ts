import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import * as ExcelJS from 'exceljs';
import { Inscricao } from '../../../models/inscricao.model';

export interface DialogExportFaturacaoData {
  listaTurnos: string[];
  empresasUnicas: string[];
  dados: Inscricao[];
  filtroLocal: string;
}

@Component({
  selector: 'app-dialog-export-faturacao',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './dialog-export-faturacao.component.html',
})
export class DialogExportFaturacaoComponent {
  data = inject<DialogExportFaturacaoData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<DialogExportFaturacaoComponent>);
  private snackBar = inject(MatSnackBar);

  tipoExportFaturacao: 'total' | 'turno' | 'empresa' = 'total';
  turnoExportFaturacao: string = this.data.listaTurnos[0] || '';
  empresaExportFaturacao: string = this.data.empresasUnicas[0] || '';

  async exportarFaturacao() {
    let dados = this.data.dados;
    let sufixo = '';

    if (this.tipoExportFaturacao === 'turno') {
      dados = dados.filter((i) => i.turnoEscolhido === this.turnoExportFaturacao);
      sufixo = `_${this.turnoExportFaturacao}`;
    } else if (this.tipoExportFaturacao === 'empresa') {
      dados = dados.filter((i) => i.nomeInstituicao === this.empresaExportFaturacao);
      sufixo = `_${this.empresaExportFaturacao}`;
    }

    if (dados.length === 0) {
      this.snackBar.open('Não há dados para exportar.', 'OK', { duration: 3000 });
      return;
    }

    const formatarData = (val: any) => {
      if (!val) return '';
      if (val instanceof Date) return val.toLocaleDateString('pt-PT');
      if (typeof val === 'string' && val.trim()) return val.split('T')[0];
      return '';
    };

    const titulo =
      this.tipoExportFaturacao === 'turno'
        ? `Faturação – ${this.turnoExportFaturacao}`
        : this.tipoExportFaturacao === 'empresa'
          ? `Faturação – ${this.empresaExportFaturacao}`
          : 'Faturação Total';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Quinta da Escola';
    wb.created = new Date();

    const ws = wb.addWorksheet('Faturação', { views: [{ state: 'frozen', ySplit: 3 }] });

    ws.mergeCells('A1:J1');
    const tituloCell = ws.getCell('A1');
    tituloCell.value = titulo;
    tituloCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
    tituloCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:J2');
    const subCell = ws.getCell('A2');
    subCell.value = `Exportado em ${new Date().toLocaleDateString('pt-PT')}  |  ${dados.length} participante${dados.length !== 1 ? 's' : ''}`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF4CAF50' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 18;

    ws.columns = [
      { key: 'nome', width: 32 },
      { key: 'cp', width: 14 },
      { key: 'nif', width: 13 },
      { key: 'email', width: 32 },
      { key: 'turno', width: 22 },
      { key: 'empresa', width: 26 },
      { key: 'valor', width: 12 },
      { key: 'dataPag', width: 18 },
      { key: 'nomePag', width: 26 },
      { key: 'fatura', width: 16 },
    ];

    const cabecalhos = [
      'Nome Participante',
      'Código Postal',
      'NIF',
      'Email',
      'Turno',
      'Empresa / Instituição',
      'Valor (€)',
      'Data de Pagamento',
      'Nome de Pagamento',
      'Nº Fatura',
    ];
    const headerRow = ws.addRow(cabecalhos);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1B5E20' } },
        bottom: { style: 'medium', color: { argb: 'FF1B5E20' } },
        left: { style: 'thin', color: { argb: 'FF1B5E20' } },
        right: { style: 'thin', color: { argb: 'FF1B5E20' } },
      };
    });

    const borderLight = {
      top: { style: 'hair' as const, color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'hair' as const, color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    };

    dados.forEach((i, idx) => {
      const row = ws.addRow({
        nome: i.participante.nomeCompleto,
        cp: i.participante.codigoPostal || '',
        nif: i.participante.nif || '',
        email: i.ee.email,
        turno: i.turnoEscolhido,
        empresa: i.nomeInstituicao || '',
        valor: i.valor_total,
        dataPag: formatarData(i.dataPagamento),
        nomePag: i.nomePagamento || '',
        fatura: i.numeroFatura || '',
      });
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: idx % 2 === 0 ? 'FFF1F8E9' : 'FFFFFFFF' },
        };
        cell.border = borderLight;
        cell.alignment = { vertical: 'middle', horizontal: col === 7 ? 'right' : 'left' };
        cell.font = { size: 10 };
      });
      if (i.estado_pagamento === 'pago') {
        ws.getCell(`G${row.number}`).font = { bold: true, color: { argb: 'FF2E7D32' }, size: 10 };
      }
    });

    const totalValor = dados.reduce((s, i) => s + (i.valor_total || 0), 0);
    const totalRow = ws.addRow({ nome: 'TOTAL', valor: totalValor });
    totalRow.height = 22;
    totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF388E3C' } },
        bottom: { style: 'medium', color: { argb: 'FF388E3C' } },
        left: { style: 'thin', color: { argb: 'FF388E3C' } },
        right: { style: 'thin', color: { argb: 'FF388E3C' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: col === 7 ? 'right' : 'left' };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Faturacao${sufixo}_${this.data.filtroLocal}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    this.dialogRef.close();
  }
}
