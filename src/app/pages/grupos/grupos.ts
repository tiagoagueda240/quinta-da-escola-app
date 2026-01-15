import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InscricaoService } from '../../services/inscricao.service';
import { Inscricao } from '../../models/inscricao.model';

// Material & CDK
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

interface ColunaGrupo {
  id: string;
  titulo: string;
  monitor: string;
  tipo: 'camarata' | 'atividade';
  genero?: 'M' | 'F' | 'Misto';
  lista: Inscricao[];
  capacidade: number;
}

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule, 
    MatInputModule, MatSelectModule, MatTabsModule, MatSnackBarModule, 
    MatTooltipModule, DragDropModule
  ],
  templateUrl: './grupos.html',
  styleUrls: ['./grupos.scss']
})
export class GruposComponent implements OnInit {
  private inscricaoService = inject(InscricaoService);
  private snackBar = inject(MatSnackBar);

  // DADOS GERAIS
  todosRegistos: Inscricao[] = [];
  turnoSelecionado: string = '';
  
  listaTurnos = [
    '1º Turno – 28 Junho a 4 Julho', '2º Turno – 5 a 11 Julho', '3º Turno – 12 a 18 Julho',
    '4º Turno – 19 a 25 Julho', '5º Turno – 26 Julho a 1 Agosto', '6º Turno – 2 a 8 Agosto',
    '7º Turno – 9 a 15 Agosto', '8º Turno – 16 a 22 Agosto', '9º Turno – 23 a 29 Agosto',
    '10º Turno – 30 Agosto a 5 Setembro'
  ];

  // CONFIGURAÇÕES LOGÍSTICA
  qtdQuartosM = 2; // Número de quartos para Rapazes
  qtdQuartosF = 3; // Número de quartos para Raparigas
  
  qtdGruposAtiv = 5;
  capacidadePadrao = 12; 

  // ESTADO DA VISTA
  modoVisualizacao: 'camarata' | 'atividade' = 'camarata';
  
  colunasCamaratas: ColunaGrupo[] = [];
  colunasAtividades: ColunaGrupo[] = [];
  poolVisual: Inscricao[] = []; // Crianças por atribuir

  ngOnInit() { this.carregarDados(); }

  carregarDados() {
    this.inscricaoService.getInscricoes().subscribe(dados => {
      this.todosRegistos = dados;
      if (this.turnoSelecionado) this.atualizarVista();
    });
  }

  mudarTurno() {
    this.colunasCamaratas = [];
    this.colunasAtividades = [];
    this.atualizarVista();
  }

  trocarAba(index: number) {
    this.modoVisualizacao = index === 0 ? 'camarata' : 'atividade';
    this.atualizarVista();
  }

  // --- CALCULA QUEM ESTÁ "POR ATRIBUIR" ---
  atualizarVista() {
    if (!this.turnoSelecionado) return;
    
    const criancasTurno = this.todosRegistos.filter(i => i.turnoEscolhido === this.turnoSelecionado);
    const atribuidos = new Set<string>();
    
    const colunasAtivas = this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
    colunasAtivas.forEach(c => c.lista.forEach(k => { if(k.id) atribuidos.add(k.id); }));

    this.poolVisual = criancasTurno.filter(k => k.id && !atribuidos.has(k.id));
  }

  // =========================================================
  // LOGÍSTICA CAMARATAS (QUARTOS)
  // =========================================================

  inicializarQuartos() {
    if(this.colunasCamaratas.length > 0 && !confirm('Reiniciar quartos? Isto limpa a organização atual.')) return;
    
    this.colunasCamaratas.forEach(col => this.poolVisual.push(...col.lista));
    this.colunasCamaratas = [];

    // 1. Criar Quartos de Rapazes
    for(let i=1; i<=this.qtdQuartosM; i++) {
      this.colunasCamaratas.push({
        id: `cam-m-${i}`, titulo: `Quarto Rapazes ${i}`, monitor: '', tipo: 'camarata',
        genero: 'M', capacidade: this.capacidadePadrao, lista: []
      });
    }

    // 2. Criar Quartos de Raparigas
    for(let i=1; i<=this.qtdQuartosF; i++) {
      this.colunasCamaratas.push({
        id: `cam-f-${i}`, titulo: `Quarto Raparigas ${i}`, monitor: '', tipo: 'camarata',
        genero: 'F', capacidade: this.capacidadePadrao, lista: []
      });
    }

    this.atualizarVista();
  }

  distribuirNasCamaratas() {
    if(this.colunasCamaratas.length === 0) return this.snackBar.open('Cria os quartos primeiro (Passo 1)!', 'OK');

    // 1. Separar e Ordenar (Mais novos -> Mais velhos)
    const rapazes = this.poolVisual.filter(i => this.getGenero(i) === 'M')
                                   .sort((a,b) => this.getIdade(a) - this.getIdade(b));
    
    const raparigas = this.poolVisual.filter(i => this.getGenero(i) === 'F')
                                     .sort((a,b) => this.getIdade(a) - this.getIdade(b));

    const quartosM = this.colunasCamaratas.filter(c => c.genero === 'M');
    const quartosF = this.colunasCamaratas.filter(c => c.genero === 'F');

    this.poolVisual = []; 

    // 2. Distribuir com Equilíbrio
    if (rapazes.length > 0 && quartosM.length > 0) this.distribuirGrupoEquilibrado(rapazes, quartosM);
    else if (rapazes.length > 0) this.poolVisual.push(...rapazes);

    if (raparigas.length > 0 && quartosF.length > 0) this.distribuirGrupoEquilibrado(raparigas, quartosF);
    else if (raparigas.length > 0) this.poolVisual.push(...raparigas);

    this.atualizarVista();
    
    if(this.poolVisual.length > 0) this.snackBar.open(`Atenção: Sobraram ${this.poolVisual.length} crianças sem cama!`, 'OK', {duration: 4000});
    

    return 0
  }

  private distribuirGrupoEquilibrado(criancas: Inscricao[], quartos: ColunaGrupo[]) {
    const totalCriancas = criancas.length;
    const totalQuartos = quartos.length;
    const base = Math.floor(totalCriancas / totalQuartos);
    const sobra = totalCriancas % totalQuartos;
    
    let indexAtual = 0;

    for (let i = 0; i < totalQuartos; i++) {
      const levaExtra = i >= (totalQuartos - sobra);
      let qtdParaEste = base + (levaExtra ? 1 : 0);
      
      const espacoLivre = quartos[i].capacidade - quartos[i].lista.length;
      qtdParaEste = Math.min(qtdParaEste, espacoLivre);

      if (qtdParaEste > 0) {
        const grupo = criancas.slice(indexAtual, indexAtual + qtdParaEste);
        quartos[i].lista.push(...grupo);
        indexAtual += qtdParaEste;
      }
    }
    if (indexAtual < totalCriancas) this.poolVisual.push(...criancas.slice(indexAtual));
    
  }

  // =========================================================
  // LOGÍSTICA GRUPOS ATIVIDADE (LÓGICA AVANÇADA)
  // =========================================================

  gerarGruposAtividade() {
    if (this.colunasAtividades.length > 0 && !confirm('Reiniciar grupos?')) return;

    // 1. Reset
    this.colunasAtividades.forEach(col => this.poolVisual.push(...col.lista));
    this.poolVisual = [...new Set(this.poolVisual)];
    this.colunasAtividades = [];

    // 2. Criar Grupos Vazios
    for (let i = 1; i <= this.qtdGruposAtiv; i++) {
      this.colunasAtividades.push({
        id: `grp-${i}`, titulo: `Grupo ${i}`, monitor: '', tipo: 'atividade',
        genero: 'Misto', capacidade: 25, lista: []
      });
    }

    // 3. Separar por Género e Ordenar por Idade
    const rapazes = this.poolVisual.filter(i => this.getGenero(i) === 'M').sort((a,b) => this.getIdade(a) - this.getIdade(b));
    const raparigas = this.poolVisual.filter(i => this.getGenero(i) === 'F').sort((a,b) => this.getIdade(a) - this.getIdade(b));
    this.poolVisual = [];

    // 4. Distribuir Rapazes (Algoritmo Inteligente)
    this.distribuirInteligente(rapazes);
    
    // 5. Distribuir Raparigas (Algoritmo Inteligente)
    this.distribuirInteligente(raparigas);

    this.atualizarVista();
  }

  /**
   * Distribui uma lista de crianças pelos grupos disponíveis, garantindo:
   * 1. Equilíbrio Numérico (escolhe sempre o grupo mais vazio)
   * 2. Separação de Irmãos (evita grupos onde já esteja um irmão)
   */
  private distribuirInteligente(listaCriancas: Inscricao[]) {
    listaCriancas.forEach(crianca => {
      // Ordenar grupos do MAIS VAZIO para o MAIS CHEIO
      // Isto garante que todos os grupos crescem ao mesmo ritmo
      let gruposCandidatos = [...this.colunasAtividades].sort((a, b) => a.lista.length - b.lista.length);

      // Tentar encontrar um grupo onde NÃO haja irmãos
      let grupoAlvo = gruposCandidatos.find(grupo => !this.temIrmaoNoGrupo(crianca, grupo));

      // Se todos os grupos tiverem irmãos (caso raro de gémeos/trigémeos em todos), 
      // ou se não houver restrição, escolhemos simplesmente o mais vazio (o primeiro da lista ordenada)
      if (!grupoAlvo) {
        grupoAlvo = gruposCandidatos[0];
      }

      grupoAlvo.lista.push(crianca);
    });
  }

  // Verifica se existe algum irmão da 'crianca' dentro do 'grupo'
  private temIrmaoNoGrupo(crianca: Inscricao, grupo: ColunaGrupo): boolean {
    return grupo.lista.some(membro => {
      // Verifica Email do EE ou Telefone (caso usem emails diferentes mas mesmo telemovel)
      const mesmoEmail = membro.ee.email.trim().toLowerCase() === crianca.ee.email.trim().toLowerCase();
      const mesmoTelefone = membro.ee.telefone.replace(/\s/g,'') === crianca.ee.telefone.replace(/\s/g,'');
      return mesmoEmail || mesmoTelefone;
    });
  }

  // =========================================================
  // DRAG & DROP & SAVE
  // =========================================================

  drop(event: CdkDragDrop<Inscricao[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const listaDestino = event.container.data;
      const crianca = event.previousContainer.data[event.previousIndex];
      const colDestino = [...this.colunasCamaratas, ...this.colunasAtividades].find(c => c.lista === listaDestino);
      
      if (colDestino) {
        // Regra Capacidade
        if (listaDestino.length >= colDestino.capacidade) {
          this.snackBar.open(`O ${colDestino.titulo} já está cheio!`, 'Erro');
          return;
        }
        // Regra Género (Camaratas)
        if (colDestino.tipo === 'camarata' && colDestino.genero) {
          const g = this.getGenero(crianca);
          if (colDestino.genero !== g) {
            this.snackBar.open(`⛔ Ação bloqueada: Género incorreto para este quarto!`, 'Erro', {duration: 3000});
            return;
          }
        }
      }

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      
      // Auto-Label Género
      if (colDestino && colDestino.tipo === 'camarata' && colDestino.lista.length === 1 && !colDestino.genero) {
         const k = colDestino.lista[0];
         colDestino.genero = this.getGenero(k);
         colDestino.titulo += ` (${colDestino.genero})`;
      }

      this.atualizarVista();
    }
  }

  async guardarAlteracoes() {
    if(!this.turnoSelecionado) return;
    this.snackBar.open('A guardar organização...', 'Aguarde');
    let count = 0;

    // 1. Guardar Camaratas
    for(const col of this.colunasCamaratas) {
      for(const p of col.lista) {
        if(p.id) { await this.inscricaoService.updateInscricao(p.id, { camarata: col.titulo, monitorCamarata: col.monitor }); count++; }
      }
    }
    // Limpar removidos (Camaratas)
    if (this.modoVisualizacao === 'camarata') {
        for(const p of this.poolVisual) { if(p.id) await this.inscricaoService.updateInscricao(p.id, { camarata: '', monitorCamarata: '' }); }
    }

    // 2. Guardar Grupos
    for(const col of this.colunasAtividades) {
      for(const p of col.lista) {
        if(p.id) { await this.inscricaoService.updateInscricao(p.id, { grupo: col.titulo, monitorGrupo: col.monitor }); count++; }
      }
    }
    // Limpar removidos (Grupos)
    if (this.modoVisualizacao === 'atividade') {
        for(const p of this.poolVisual) { if(p.id) await this.inscricaoService.updateInscricao(p.id, { grupo: '', monitorGrupo: '' }); }
    }

    this.snackBar.open(`Guardado! Processados ${count} registos.`, 'OK', {duration:3000});
  }

  // =========================================================
  // HELPERS
  // =========================================================

  getGenero(i: Inscricao): 'M' | 'F' {
    if ((i as any).participante?.genero) return (i as any).participante.genero;
    if ((i as any).genero) return (i as any).genero;
    const nome = i.participante.nomeCompleto.trim().toLowerCase().split(' ')[0];
    const nomesFemininos = ['beatriz', 'ines', 'inês', 'iris', 'rute', 'raquel', 'isabel', 'alice', 'luz', 'maria', 'ana', 'sofia', 'matilde', 'leonor'];
    if (nomesFemininos.includes(nome)) return 'F';
    if (nome.endsWith('a') && nome !== 'luca') return 'F';
    return 'M';
  }

  getIdade(i: Inscricao): number {
    if (!i.participante.dataNascimento) return 0;
    const n = new Date(i.participante.dataNascimento);
    return Math.floor((Date.now() - n.getTime()) / 31557600000);
  }

  get colunasAtivas(): ColunaGrupo[] {
    return this.modoVisualizacao === 'camarata' ? this.colunasCamaratas : this.colunasAtividades;
  }
}