import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { lastValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Monitor } from '../models/monitor.model';

@Injectable({
  providedIn: 'root',
})
export class MonitorService {
  private http = inject(HttpClient);
  private apiUrl = 'https://turnos.quintadaescola.com/api/monitores.php';

  /**
   * Busca monitores com pesquisa opcional.
   * O PHP já faz o filtro "LIKE %...%"
   */
  async getMonitoresOtimizados(
    termoPesquisa: string = '',
    limite: number = 50,
  ): Promise<Monitor[]> {
    const url = `${this.apiUrl}?q=${termoPesquisa}&limit=${limite}`;
    return await lastValueFrom(this.http.get<Monitor[]>(url));
  }

  async saveBulkMonitores(lista: Monitor[]) {
    return await lastValueFrom(this.http.post(this.apiUrl, lista));
  }

  async addMonitor(monitor: Monitor) {
    return await lastValueFrom(this.http.post(this.apiUrl, monitor));
  }

  async updateMonitor(id: string, data: Partial<Monitor>) {
    return await lastValueFrom(this.http.put(`${this.apiUrl}?id=${id}`, data));
  }

  async deleteMonitor(id: string) {
    return await lastValueFrom(this.http.delete(`${this.apiUrl}?id=${id}`));
  }

  getMonitores(): Observable<Monitor[]> {
    return this.http.get<Monitor[]>(this.apiUrl).pipe(
      map((monitores) => {
        return monitores.map((m) => {
          if (m.dataNascimento) m.dataNascimento = new Date(m.dataNascimento);
          return m;
        });
      }),
    );
  }

  async getTelefonesPorNomes(nomes: string[]): Promise<any[]> {
    const param = nomes.map((n) => n.trim()).join(',');
    return await lastValueFrom(
      this.http.get<any[]>(`${this.apiUrl}?nomes=${encodeURIComponent(param)}`),
    );
  }

  getMonitoresComToken(token: string, pin: string): Observable<Monitor[]> {
    const headers = new HttpHeaders().set('X-Access-Pin', pin);
    return this.http.get<Monitor[]>(`${this.apiUrl}/monitores.php?token=${token}`, { headers });
  }
}
