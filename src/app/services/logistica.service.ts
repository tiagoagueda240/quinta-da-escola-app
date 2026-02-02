import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { LogisticaItem } from '../models/logistica.model';

@Injectable({
    providedIn: 'root'
})
export class LogisticaService {
    private http = inject(HttpClient);

    private apiUrl = 'https://turnos.quintadaescola.com/api/logistica.php';

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
     * Obtém a estrutura de quartos/grupos gravada na BD para um turno/local (DADOS)
     */
    async getLogistica(turno: string, local: string): Promise<LogisticaItem[]> {
        return await lastValueFrom(
            this.http.get<LogisticaItem[]>(
                `${this.apiUrl}?turno=${encodeURIComponent(turno)}&local=${encodeURIComponent(local)}`,
                this.getHeaders()
            )
        );
    }

    /**
     * NOVO: Obtém o Template (JSON) da planta para o local selecionado (LAYOUT)
     */
    async getLayoutTemplate(local: string): Promise<any[]> {
        return await lastValueFrom(
            this.http.get<any[]>(
                `${this.apiUrl}?acao=template&local=${encodeURIComponent(local)}`,
                this.getHeaders()
            )
        );
    }

    /**
     * Grava a estrutura e devolve os IDs reais da BD.
     */
    async saveLogistica(payload: any): Promise<{ msg: string, ids: { [key: string]: number } }> {
        return await lastValueFrom(
            this.http.post<{ msg: string, ids: any }>(
                this.apiUrl,
                payload,
                this.getHeaders()
            )
        );
    }
}