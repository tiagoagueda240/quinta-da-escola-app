import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
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
}
