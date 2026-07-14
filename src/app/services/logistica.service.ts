import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { LogisticaItem } from '../models/logistica.model';

@Injectable({
  providedIn: 'root',
})
export class LogisticaService {
  private http = inject(HttpClient);

  private apiUrl = 'https://turnos.quintadaescola.com/api/logistica.php';

  async getLogistica(turno: string, local: string): Promise<LogisticaItem[]> {
    return await lastValueFrom(
      this.http.get<LogisticaItem[]>(
        `${this.apiUrl}?turno=${encodeURIComponent(turno)}&local=${encodeURIComponent(local)}`,
      ),
    );
  }

  async getLayoutTemplate(local: string): Promise<any[]> {
    return await lastValueFrom(
      this.http.get<any[]>(`${this.apiUrl}?acao=template&local=${encodeURIComponent(local)}`),
    );
  }

  async saveLogistica(payload: any): Promise<{ msg: string; ids: { [key: string]: number } }> {
    return await lastValueFrom(this.http.post<{ msg: string; ids: any }>(this.apiUrl, payload));
  }


  getLayoutTemplateComToken(local: string, token: string, pin: string): Promise<any> {
    const headers = new HttpHeaders().set('X-Access-Pin', pin);
    return firstValueFrom(this.http.get<any>(`${this.apiUrl}/logistica.php?acao=template&local=${local}&token=${token}`, { headers }));
  }

  getLogisticaComToken(turno: string, local: string, token: string, pin: string): Promise<any[]> {
    const headers = new HttpHeaders().set('X-Access-Pin', pin);
    return firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/logistica.php?turno=${turno}&local=${local}&token=${token}`, { headers }));
  }

  saveLogisticaComToken(data: any, token: string, pin: string): Promise<any> {
    const headers = new HttpHeaders().set('X-Access-Pin', pin);
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/logistica.php?token=${token}`, data, { headers }));
  }


  async getPontuacoes(turno: string, local: string): Promise<{ jogos: string[], pontuacoes: any[], subtitulo?: string }> {
    return await lastValueFrom(
      this.http.get<{ jogos: string[], pontuacoes: any[], subtitulo?: string }>(
        `${this.apiUrl}?acao=obter_pontuacoes&turno=${encodeURIComponent(turno)}&local=${encodeURIComponent(local)}`,
      ),
    );
  }

  async savePontuacoes(payload: { turno: string, local: string, jogos: string[], pontuacoes: any[] }): Promise<any> {
    return await lastValueFrom(
      this.http.post<any>(`${this.apiUrl}?acao=salvar_pontuacoes`, payload)
    );
  }
}
