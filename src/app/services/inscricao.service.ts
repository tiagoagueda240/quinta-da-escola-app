import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigTurnos, Inscricao } from '../models/inscricao.model';

@Injectable({
  providedIn: 'root',
})
export class InscricaoService {
  private http = inject(HttpClient);

  private apiUrl = 'https://turnos.quintadaescola.com/api/inscricoes.php';

  // ==========================================================
  //     ADAPTADOR (TRADUTOR DE DADOS)
  // ==========================================================

  private adaptarInscricao(row: any): Inscricao {
    return {
      ...row,
      camarata: row.camarata_atribuida || row.camarata,
      grupo: row.grupo_atribuido || row.grupo,
      transporte: row.transporte || '',
      dataPagamento: row.dataPagamento || '',
      nomePagamento: row.nomePagamento || '',
      numeroFatura: row.numeroFatura || '',
      numeroBeneficiario: row.numero_beneficiario || row.numeroBeneficiario || '', // Nova Coluna
    } as Inscricao;
  }

  // ==========================================================
  //     MÉTODOS DE LEITURA (ADMIN & GERAL)
  // ==========================================================

  getInscricoes(): Observable<Inscricao[]> {
    return this.http
      .get<any[]>(`${this.apiUrl}?acao=listar`)
      .pipe(map((rows) => rows.map((r) => this.adaptarInscricao(r))));
  }

  async getConfiguracoesTurnos(): Promise<ConfigTurnos> {
    return await lastValueFrom(this.http.get<ConfigTurnos>(`${this.apiUrl}?acao=config_turnos`));
  }

  async saveConfiguracoesTurnos(config: ConfigTurnos) {
    return await lastValueFrom(this.http.post(`${this.apiUrl}?acao=salvar_config_turnos`, config));
  }

  // ==========================================================
  //     MÉTODOS DE LEITURA (COORDENADOR / LINK)
  // ==========================================================

  getInscricoesComToken(token: string): Observable<Inscricao[]> {
    return this.http
      .get<any[]>(`${this.apiUrl}?acao=listar&token=${token}`)
      .pipe(map((rows) => rows.map((r) => this.adaptarInscricao(r))));
  }

  getInscricoesComTokenEPin(token: string, pin: string): Observable<Inscricao[]> {
    const headers = new HttpHeaders({
      'X-Access-Pin': pin,
    });
    return this.http
      .get<any[]>(`${this.apiUrl}?acao=listar&token=${token}`, { headers })
      .pipe(map((rows) => rows.map((r) => this.adaptarInscricao(r))));
  }

  // ==========================================================
  //     MÉTODOS DE ESCRITA / CRIAÇÃO
  // ==========================================================

  async createInscricao(inscricao: Partial<Inscricao>, enviarEmail = true, skipValidacao = false) {
    const payload = { ...inscricao, enviarEmail, skipValidacao };
    return await lastValueFrom(this.http.post(`${this.apiUrl}?acao=nova`, payload));
  }

  async updateInscricaoBatch(
    updates: { id: string | number; checkin?: any;[key: string]: any }[],
  ) {
    return await lastValueFrom(this.http.post(`${this.apiUrl}?acao=batch_update`, updates));
  }

  async updateInscricao(id: string, dados: any) {
    return this.updateInscricaoBatch([{ id, ...dados }]);
  }

  updateCheckinComToken(payload: any, token: string, pin: string) {
    const headers = new HttpHeaders({
      'X-Access-Pin': pin,
      'Content-Type': 'application/json',
    });
    const body = [payload];
    return this.http.post(`${this.apiUrl}?acao=batch_update&token=${token}`, body, { headers });
  }

  // ==========================================================
  //     GERAR ACESSOS E LOGÍSTICA
  // ==========================================================

  // 1. CRIAR
  async gerarLinkCoordenador(payload: any) {
    const url = this.apiUrl.replace('inscricoes.php', 'gerar_acesso.php');
    return await lastValueFrom(this.http.post<any>(url, payload));
  }

  async updateBatch(updates: { id: string | number; data: any }[]) {
    return await lastValueFrom(this.http.post(`${this.apiUrl}?acao=batch_update`, updates));
  }

  async deleteInscricao(id: string) {
    return await lastValueFrom(this.http.post(`${this.apiUrl}?acao=apagar`, { id }));
  }

  async getTurnosAtivos(local: 'quinta' | 'costaCaparica' | 'quiaios'): Promise<string[]> {
    const config = await this.getConfiguracoesTurnos();
    const lista = config[local] || [];
    return lista.filter((t: any) => t.ativo === true).map((t: any) => t.nome);
  }

  getTurnosPublicos(
    local: string,
  ): Observable<{ nome: string; precoBase: number; vagasRestantes: number; esgotado?: boolean }[]> {
    return this.http.get<any[]>(`${this.apiUrl}?acao=turnos_publicos&local=${local}`);
  }

  async reenviarEmail(inscricao: Partial<Inscricao>) {
    return await lastValueFrom(this.http.post(`${this.apiUrl}?acao=reenviar_email`, inscricao));
  }

  updateBatchComToken(updates: any[], token: string, pin: string): Promise<any> {
    const headers = new HttpHeaders().set('X-Access-Pin', pin);
    return firstValueFrom(
      this.http.post<any>(
        `${this.apiUrl}/inscricoes.php?acao=batch_update&token=${token}`,
        updates,
        { headers },
      ),
    );
  }



  // 2. LISTAR
  listarAcessos(local: string, turno: string): Observable<any[]> {
    let url = `https://turnos.quintadaescola.com/api/gerar_acesso.php?acao=listar`;
    if (local) url += `&local=${local}`;
    if (turno) url += `&turno=${turno}`;
    return this.http.get<any[]>(url);
  }

  // 3. APAGAR
  async apagarAcesso(id: number): Promise<any> {
    return await lastValueFrom(
      this.http.post(`https://turnos.quintadaescola.com/api/gerar_acesso.php?acao=apagar`, { id })
    );
  }

  // 4. EDITAR
  async editarAcesso(dados: any): Promise<any> {
    return await lastValueFrom(
      this.http.post(`https://turnos.quintadaescola.com/api/gerar_acesso.php?acao=editar`, dados)
    );
  }
}
