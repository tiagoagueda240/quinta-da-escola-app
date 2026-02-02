import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigTurnos, Inscricao } from '../models/inscricao.model';

@Injectable({
  providedIn: 'root'
})
export class InscricaoService {
  private http = inject(HttpClient);

  // URL base da API
  private apiUrl = 'https://turnos.quintadaescola.com/api/inscricoes.php';

  // --- 1. HEADERS ADMIN (JWT) ---
  private getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    };
  }

  // ==========================================================
  //     ADAPTADOR (TRADUTOR DE DADOS)
  // ==========================================================

  /**
   * Converte os nomes das colunas da Nova BD para o formato que o Angular espera.
   */
  private adaptarInscricao(row: any): Inscricao {
    return {
      ...row,
      // Mapeia as novas colunas da BD para as propriedades antigas do Frontend
      camarata: row.camarata_atribuida || row.camarata,
      grupo: row.grupo_atribuido || row.grupo,
      // Garante que transporte não vem null
      transporte: row.transporte || ''
    } as Inscricao;
  }

  // ==========================================================
  //     MÉTODOS DE LEITURA (ADMIN & GERAL)
  // ==========================================================

  /**
   * Admin: Obtém todas as inscrições (autenticado por JWT)
   */
  getInscricoes(): Observable<Inscricao[]> {
    return this.http.get<any[]>(`${this.apiUrl}?acao=listar`, this.getHeaders()).pipe(
      map(rows => rows.map(r => this.adaptarInscricao(r)))
    );
  }

  /**
   * Admin: Obtém configurações de turnos
   */
  async getConfiguracoesTurnos(): Promise<ConfigTurnos> {
    return await lastValueFrom(
      this.http.get<ConfigTurnos>(`${this.apiUrl}?acao=config_turnos`, this.getHeaders())
    );
  }

  /**
   * Admin: Grava configurações de turnos
   */
  async saveConfiguracoesTurnos(config: ConfigTurnos) {
    return await lastValueFrom(
      this.http.post(`${this.apiUrl}?acao=salvar_config_turnos`, config, this.getHeaders())
    );
  }

  // ==========================================================
  //     MÉTODOS DE LEITURA (COORDENADOR / LINK)
  // ==========================================================

  /**
   * Coordenador: Tenta obter inscrições apenas com o Token da URL.
   */
  getInscricoesComToken(token: string): Observable<Inscricao[]> {
    return this.http.get<any[]>(`${this.apiUrl}?acao=listar&token=${token}`).pipe(
      map(rows => rows.map(r => this.adaptarInscricao(r)))
    );
  }

  /**
   * Coordenador: Obtém inscrições enviando Token + PIN (Header X-Access-Pin)
   */
  getInscricoesComTokenEPin(token: string, pin: string): Observable<Inscricao[]> {
    const headers = new HttpHeaders({
      'X-Access-Pin': pin
    });
    return this.http.get<any[]>(`${this.apiUrl}?acao=listar&token=${token}`, { headers }).pipe(
      map(rows => rows.map(r => this.adaptarInscricao(r)))
    );
  }

  // ==========================================================
  //     MÉTODOS DE ESCRITA / CRIAÇÃO
  // ==========================================================

  /**
   * Cria nova inscrição (Usado no site público e na clonagem pelo Admin)
   */
  async createInscricao(inscricao: Partial<Inscricao>) {
    const res = await lastValueFrom(
      this.http.post(`${this.apiUrl}?acao=nova`, inscricao)
    );
    this.enviarEmailSeguro(inscricao);
    return res;
  }

  // Alias
  addInscricao(inscricao: Inscricao) {
    return this.createInscricao(inscricao);
  }

  /**
   * Admin: Atualiza várias inscrições ou campos específicos (Batch)
   */
  async updateInscricaoBatch(updates: { id: string | number, checkin?: any, [key: string]: any }[]) {
    return await lastValueFrom(
      this.http.post(`${this.apiUrl}?acao=batch_update`, updates, this.getHeaders())
    );
  }

  // Alias para update individual
  async updateInscricao(id: string, dados: any) {
    return this.updateInscricaoBatch([{ id, ...dados }]);
  }

  /**
   * Coordenador: Faz Check-in/out enviando Token + PIN
   */
  updateCheckinComToken(payload: any, token: string, pin: string) {
    const headers = new HttpHeaders({
      'X-Access-Pin': pin,
      'Content-Type': 'application/json'
    });
    const body = [payload];
    return this.http.post(
      `${this.apiUrl}?acao=batch_update&token=${token}`,
      body,
      { headers }
    );
  }

  // ==========================================================
  //     GERAR ACESSOS E EMAILS
  // ==========================================================

  async gerarLinkCoordenador(payload: any) {
    const url = this.apiUrl.replace('inscricoes.php', 'gerar_acesso.php');
    return await lastValueFrom(
      this.http.post<any>(url, payload, this.getHeaders())
    );
  }

  enviarEmailSeguro(dados: any) {
    const url = 'https://turnos.quintadaescola.com/send-email.php';
    const payload = {
      nome: dados.ee?.nome || 'Enc. Educação',
      email: dados.ee?.email,
      turno: dados.turnoEscolhido,
      valor: dados.valorTotal
    };
    this.http.post(url, payload).subscribe({
      error: (err) => console.error('Erro envio email:', err)
    });
  }

  // ==========================================================
  //     LOGÍSTICA, APAGAR E AUXILIARES
  // ==========================================================

  async updateBatch(updates: { id: string | number, data: any }[]) {
    return await lastValueFrom(
      this.http.post(`${this.apiUrl}?acao=batch_update`, updates, this.getHeaders())
    );
  }

  async deleteInscricao(id: string) {
    return await lastValueFrom(
      this.http.post(`${this.apiUrl}?acao=apagar`, { id }, this.getHeaders())
    );
  }

  // --- RESTAURADO: Método auxiliar usado pelo Admin ---
  async getTurnosAtivos(local: 'quinta' | 'costaCaparica' | 'quiaios'): Promise<string[]> {
    const config = await this.getConfiguracoesTurnos();
    // Acede à propriedade do local (ex: config.quinta)
    const lista = config[local] || [];

    // Filtra e devolve apenas os nomes
    return lista
      .filter((t: any) => t.ativo === true)
      .map((t: any) => t.nome);
  }
}