import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Monitor } from '../models/monitor.model';

@Injectable({
  providedIn: 'root'
})
export class MonitorService {
  private http = inject(HttpClient);
  private apiUrl = 'https://turnos.quintadaescola.com/api/monitores.php';

  private getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    };
  }

  /**
   * Busca monitores com pesquisa opcional.
   * O PHP já faz o filtro "LIKE %...%"
   */
  async getMonitoresOtimizados(termoPesquisa: string = '', limite: number = 50): Promise<Monitor[]> {
    // O parametro 'limit' pode ser passado para o PHP se quiseres
    const url = `${this.apiUrl}?q=${termoPesquisa}&limit=${limite}`;

    return await lastValueFrom(
      this.http.get<Monitor[]>(url, this.getHeaders())
    );
  }

  /**
   * Gravação em Batch (Importação Excel)
   * O PHP deteta automaticamente que é um array e faz insert múltiplo.
   */
  async saveBulkMonitores(lista: Monitor[]) {
    return await lastValueFrom(
      this.http.post(this.apiUrl, lista, this.getHeaders())
    );
  }

  async addMonitor(monitor: Monitor) {
    return await lastValueFrom(
      this.http.post(this.apiUrl, monitor, this.getHeaders())
    );
  }

  async updateMonitor(id: string, data: Partial<Monitor>) {
    return await lastValueFrom(
      this.http.put(`${this.apiUrl}?id=${id}`, data, this.getHeaders())
    );
  }

  async deleteMonitor(id: string) {
    return await lastValueFrom(
      this.http.delete(`${this.apiUrl}?id=${id}`, this.getHeaders())
    );
  }

  /**
   * Retorna Observable para uso reativo (ex: pipes async no template)
   */
  getMonitores(): Observable<Monitor[]> {
    return this.http.get<Monitor[]>(this.apiUrl, this.getHeaders()).pipe(
      map(monitores => {
        // Conversão de datas se necessário
        return monitores.map(m => {
          if (m.dataNascimento) m.dataNascimento = new Date(m.dataNascimento);
          return m;
        });
      })
    );
  }

  // Mantemos o método para compatibilidade, mas agora usa a API simples
  async getMonitoresPaginados(termo: string = '', limite: number = 10, offset: number = 0) {
    const url = `${this.apiUrl}?q=${termo}&limit=${limite}&offset=${offset}`;
    const dados = await lastValueFrom(this.http.get<Monitor[]>(url, this.getHeaders()));

    return {
      dados: dados,
      // API SQL não devolve cursor de documento, devolvemos apenas os dados
      // Se precisares de paginação real, o PHP teria de devolver o "total"
      ultimoDoc: null
    };
  }
}