import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LogisticaService } from '../../services/logistica.service';
import * as XLSX from 'xlsx'; // Certifique-se de ter 'xlsx' instalado no seu projeto: npm install xlsx
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NovoJogoDialogComponent } from './novo-jogo-dialog.component';

interface GrupoPontos {
  id: string;
  dbId?: number;
  titulo: string;
  tipo: 'camarata' | 'atividade';
  genero?: string;
  bonus: number;
  penalizacoes: number;
  total: number;
  pontos: { [jogoName: string]: number };
}

@Component({
  selector: 'app-pontuacoes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatSnackBarModule, MatDialogModule],
  templateUrl: './pontuacoes.html',
  styleUrls: ['./pontuacoes.scss']
})
export class PontuacoesComponent implements OnInit {
  private dialog = inject(MatDialog);
  private logisticaService = inject(LogisticaService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  loading = false;
  filtroLocal = 'quinta';
  turnoSelecionado = '';
  subtituloCustomizado = '';

  listaJogos: string[] = [];
  listaColunasGrupos: GrupoPontos[] = [];

  configEstilo = {
    tema: 'ouro',
    estiloMoldura: 'dupla',
    tamanhoFonte: 15,
    espacamento: 'compact',
    linhasAlternadas: true,
    // Novas flags de controlo visual
    mostrarBonus: true,
    mostrarPenalizacoes: true
  };

  async ngOnInit() {
    this.filtroLocal = sessionStorage.getItem('filtroLocal') || 'quinta';
    this.turnoSelecionado = sessionStorage.getItem('turnoSelecionado') || '1º Turno';

    const mapaLocais: any = { quinta: 'Quinta da Escola', costaCaparica: 'Costa da Caparica', quiaios: 'Quiaios' };
    this.subtituloCustomizado = `${mapaLocais[this.filtroLocal] || this.filtroLocal} — ${this.turnoSelecionado}`;

    this.carregarGruposEPontuacoes();
  }

  async carregarGruposEPontuacoes() {
    this.loading = true;
    try {
      const gruposDb = await this.logisticaService.getLogistica(this.turnoSelecionado, this.filtroLocal) || [];
      const dadosPontuacoes: any = await this.logisticaService.getPontuacoes(this.turnoSelecionado, this.filtroLocal);

      if (dadosPontuacoes && dadosPontuacoes.jogos && dadosPontuacoes.jogos.length > 0) {
        this.listaJogos = dadosPontuacoes.jogos;
      } else {
        this.listaJogos = [];
      }

      if (dadosPontuacoes && dadosPontuacoes.subtitulo) {
        this.subtituloCustomizado = dadosPontuacoes.subtitulo;
      }

      if (dadosPontuacoes && dadosPontuacoes.configEstilo) {
        this.configEstilo = { ...this.configEstilo, ...dadosPontuacoes.configEstilo };
      }

      const apenasAtividades = gruposDb.filter((g: any) => g.tipo === 'atividade');

      this.listaColunasGrupos = apenasAtividades.map((g: any, index: number) => {
        const points: { [key: string]: number } = {};

        this.listaJogos.forEach(j => {
          const matchHistorico = dadosPontuacoes?.pontuacoes?.find((p: any) =>
            p.titulo === g.titulo || p.id === g.id || p.dbId === g.id
          );
          points[j] = matchHistorico?.pontos?.[j] || 0;
        });

        const historicoGrupo = dadosPontuacoes?.pontuacoes?.find((p: any) =>
          p.titulo === g.titulo || p.id === g.id || p.dbId === g.id
        );

        return {
          id: g.id || 'temp-' + index,
          dbId: g.id || g.dbId,
          titulo: g.titulo || `Grupo ${index + 1}`,
          tipo: 'atividade',
          genero: g.genero,
          bonus: historicoGrupo?.bonus || 0,
          penalizacoes: historicoGrupo?.penalizacoes || 0,
          total: 0,
          pontos: points
        };
      });

      this.calcularTotais();
    } catch (e) {
      this.snackBar.open('Erro ao sincronizar dados das pontuacoes.', 'Fechar');
    } finally {
      this.loading = false;
    }
  }

  adicionarJogo() {
    const dialogRef = this.dialog.open(NovoJogoDialogComponent, {
      width: '420px',
      disableClose: false,
      panelClass: 'custom-premium-dialog' // Opcional, para estilizações globais extra
    });

    dialogRef.afterClosed().subscribe((nomeJogo: string | undefined) => {
      if (nomeJogo) {
        const formatado = nomeJogo.trim();

        if (this.listaJogos.includes(formatado)) {
          this.snackBar.open('Esta atividade já existe na tabela.', 'OK', { duration: 3000 });
          return;
        }

        // Adiciona o jogo à lista de colunas
        this.listaJogos.push(formatado);

        // Inicializa a pontuação deste novo jogo para todos os grupos a 0
        this.listaColunasGrupos.forEach(grupo => {
          grupo.pontos[formatado] = 0;
        });

        // Atualiza a tabela e guarda na base de dados
        this.calcularTotaisESalvar();

        this.snackBar.open(`Atividade "${formatado}" adicionada com sucesso!`, 'OK', { duration: 2000 });
      }
    });
  }

  removerJogo(index: number) {
    if (confirm(`Remover a coluna do jogo "${this.listaJogos[index]}"?`)) {
      const removido = this.listaJogos[index];
      this.listaColunasGrupos.forEach(g => delete g.pontos[removido]);
      this.listaJogos.splice(index, 1);
      this.calcularTotaisESalvar();
    }
  }

  calcularTotais() {
    this.listaColunasGrupos.forEach(grupo => {
      let s = 0;
      this.listaJogos.forEach(j => s += (grupo.pontos[j] || 0));
      grupo.total = s + (grupo.bonus || 0) - (grupo.penalizacoes || 0);
    });
    this.listaColunasGrupos.sort((a, b) => b.total - a.total);
  }

  async calcularTotaisESalvar() {
    this.calcularTotais();
    const payload = {
      turno: this.turnoSelecionado,
      local: this.filtroLocal,
      subtitulo: this.subtituloCustomizado,
      configEstilo: this.configEstilo,
      jogos: this.listaJogos,
      pontuacoes: this.listaColunasGrupos.map(g => ({
        id: g.id,
        dbId: g.dbId,
        titulo: g.titulo,
        bonus: g.bonus,
        penalizacoes: g.penalizacoes,
        pontos: g.pontos
      }))
    };
    try {
      await this.logisticaService.savePontuacoes(payload);
    } catch (e) {
      this.snackBar.open('Erro ao guardar alterações em tempo real.', 'OK');
    }
  }

  // --- CORREÇÃO DA IMPRESSÃO / EXPORTAÇÃO PARA PDF ---
  exportarPdfBonito() {
    window.print(); // O SCSS tratará de o deixar ultra elegante, limpo e sem o bug do 'A'
  }

  // --- EXPORTAR PARA EXCEL (RÁPIDO E DIRETO) ---
  exportarParaExcel() {
    const dadosExcel: any[] = [];

    this.listaColunasGrupos.forEach(grupo => {
      const linha: any = { 'Grupo': grupo.titulo };
      this.listaJogos.forEach(jogo => {
        linha[jogo] = grupo.pontos[jogo] || 0;
      });
      linha['Bónus'] = grupo.bonus || 0;
      linha['Penalizações'] = grupo.penalizacoes || 0;
      linha['Total'] = grupo.total || 0;
      dadosExcel.push(linha);
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pontuações');
    XLSX.writeFile(workbook, `Pontuacoes_Turno_${this.turnoSelecionado.replace(' ', '_')}.xlsx`);
  }

  // --- EXPORTAR PARA WORD (ECOLÓGICO E ORGANIZADO) ---
  exportarParaWord() {
    let primaryColor = '#d97706'; // Ouro / Bronze
    if (this.configEstilo.tema === 'esmeralda') {
      primaryColor = '#059669';
    } else if (this.configEstilo.tema === 'oceano') {
      primaryColor = '#2563eb';
    }

    // HTML ultra-otimizado com CSS rígido para impedir quebras de página
    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Poster de Pontuações</title>
      <style>
        /* MARGENS ESTREITAS (1cm) E TAMANHO LANDSCAPE PARA GARANTIR COMPACTAÇÃO */
        @page WordSection {
          size: 297mm 210mm; /* A4 Landscape */
          margin: 1.0cm 1.2cm 1.0cm 1.2cm; /* Margens mínimas */
          mso-page-orientation: landscape;
          mso-header-margin: 0px;
          mso-footer-margin: 0px;
        }
        div.WordSection {
          page: WordSection;
          width: 100%;
        }

        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          color: #0f172a; 
          background-color: #ffffff;
          margin: 0;
          padding: 0;
        }

        /* CARD DO POSTER (Desenhado para não estourar a altura útil da folha A4) */
        .poster-card {
          border: 3px double ${primaryColor};
          padding: 15px 20px; /* Padding reduzido */
          border-radius: 6px;
          background-color: #ffffff;
          height: 100%;
          box-sizing: border-box;
        }

        .poster-header {
          text-align: center;
          margin-bottom: 12px; /* Espaço reduzido */
        }

        .poster-title {
          font-family: 'Georgia', serif;
          font-size: 20pt; /* Ligeiramente menor para manter proporção de 1 página */
          font-weight: bold;
          letter-spacing: 3px;
          color: ${primaryColor};
          margin: 0;
        }

        .poster-subtitle {
          font-size: 8.5pt;
          color: #475569;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 3px;
        }

        /* TABELA SUPER COMPACTA */
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px;
          page-break-inside: avoid; /* IMPEDE QUE A TABELA SE DIVIDA EM DUAS PÁGINAS */
        }

        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }

        th { 
          background-color: #f8fafc; 
          color: ${primaryColor}; 
          font-weight: bold; 
          padding: 4px 6px; /* Padding vertical mínimo */
          border-bottom: 2px solid ${primaryColor}; 
          font-size: 8.5pt; 
          text-transform: uppercase;
        }

        td { 
          padding: 4px 6px; /* Altura de linha super compacta */
          border-bottom: 1px solid #e2e8f0; 
          text-align: center; 
          font-size: 9pt; /* Fonte compacta ideal para leitura em tabelas */
        }

        .col-grupo { 
          text-align: left; 
          font-weight: bold; 
          color: #0f172a;
          width: 25%;
        }

        .rank-1 { color: #d97706; }
        .rank-2 { color: #475569; }
        .rank-3 { color: #ea580c; }

        .total-cell { 
          font-weight: bold; 
          color: #000000;
          background-color: #f8fafc;
        }
      </style>
    </head>
    <body>
      <div class="WordSection">
        <div class="poster-card">
          
          <div class="poster-header">
            <div class="poster-title">PONTUAÇÕES</div>
            <div class="poster-subtitle">${this.subtituloCustomizado}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Grupo</th>
                ${this.listaJogos.map(j => `<th>${j}</th>`).join('')}
                <th>Bónus</th>
                <th>Penalizações</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${this.listaColunasGrupos.map((g, idx) => {
      let rankClass = '';
      if (idx === 0) rankClass = 'class="col-grupo rank-1"';
      else if (idx === 1) rankClass = 'class="col-grupo rank-2"';
      else if (idx === 2) rankClass = 'class="col-grupo rank-3"';
      else rankClass = 'class="col-grupo"';

      return `
                  <tr>
                    <td ${rankClass}>${idx < 3 ? (idx + 1) + 'º ' : ''}${g.titulo}</td>
                    ${this.listaJogos.map(j => `<td>${g.pontos[j] || 0}</td>`).join('')}
                    <td style="color: #059669; font-weight: bold;">${g.bonus || 0}</td>
                    <td style="color: #dc2626; font-weight: bold;">${g.penalizacoes || 0}</td>
                    <td class="total-cell">${g.total || 0}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>

        </div>
      </div>
    </body>
    </html>
  `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Poster_Pontuacoes_Turno_${this.turnoSelecionado.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  voltarAoCheckin() {
    this.router.navigate(['/checkin']);
  }
}