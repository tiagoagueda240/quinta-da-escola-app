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

  // Caminho relativo (funciona porque estás no subdomínio turnos.dominio.com)
  private apiUrl = 'https://turnos.quintadaescola.com/api/inscricoes.php';

  // Helper para Autenticação (JWT)
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
   * Obtém todas as inscrições e converte as datas (String MySQL -> Date JS)
   */
  getInscricoes(): Observable<Inscricao[]> {
    return this.http.get<Inscricao[]>(`${this.apiUrl}?acao=listar`, this.getHeaders()).pipe(
      map((lista) => {
        return lista.map(item => {
          // Converter strings de data do MySQL para Objetos Date reais
          if (item.dataCriacao) item.dataCriacao = new Date(item.dataCriacao);

          if (item.participante && item.participante.dataNascimento) {
            item.participante.dataNascimento = new Date(item.participante.dataNascimento);
          }

          // Converter booleans que podem vir como 0/1 do PHP
          item.autorizaFotoVideo = !!item.autorizaFotoVideo;

          return item;
        });
      })
    );
  }

  /**
   * Adiciona nova inscrição (Site Público - sem necessidade de Token geralmente, 
   * mas se for backoffice usa getHeaders)
   */
  async addInscricao(inscricao: Inscricao) {
    // action=nova está definido no teu PHP
    const res = await lastValueFrom(
      this.http.post(`${this.apiUrl}?acao=nova`, inscricao)
    );

    // Envio de email continua a ser feito via script externo ou pode ser movido para a API
    this.enviarEmailSeguro(inscricao);
    return res;
  }

  enviarEmailSeguro(dados: Inscricao) {
    // Podes manter este script separado ou integrar na API PHP (recomendado integrar futuramente)
    const url = 'https://turnos.quintadaescola.com/send-email.php';
    const payload = {
      nome: dados.ee.nome,
      email: dados.ee.email,
      turno: dados.turnoEscolhido,
      valor: dados.valorTotal
    };
    this.http.post(url, payload).subscribe({
      error: (err) => console.error('Erro email:', err)
    });
  }

  /**
   * Batch Update para Logística (Grupos e Camaratas)
   */
  async updateBatch(updates: { id: string | number, data: any }[]) {
    return await lastValueFrom(
      this.http.post(`${this.apiUrl}?acao=batch_update`, updates, this.getHeaders())
    );
  }

  updateInscricao(id: string, dados: Partial<Inscricao>) {
    // Para updates individuais, usamos a mesma lógica de batch ou criamos um endpoint PUT
    // Aqui reutilizo o batch para simplificar, pois já tens o código PHP pronto para isso
    return this.updateBatch([{ id, data: dados }]);
  }

  deleteInscricao(id: string) {
    // Se quiseres implementar delete, precisas de adicionar a ação no PHP
    // return this.http.delete(`${this.apiUrl}?id=${id}`, this.getHeaders());
    console.warn('Delete ainda não implementado no PHP');
  }

  /**
   * Obtém a lista de turnos da tabela 'configuracoes'
   */
  async getConfiguracoesTurnos(): Promise<ConfigTurnos> {
    return await lastValueFrom(
      this.http.get<ConfigTurnos>(`${this.apiUrl}?acao=config_turnos`, this.getHeaders())
    );
  }

  // 2. Ler APENAS Turnos Ativos (Para Dropdowns de seleção)
  // Este método filtra automaticamente para não mostrar turnos antigos
  async getTurnosAtivos(local: 'quinta' | 'costaCaparica' | 'quiaios'): Promise<string[]> {
    const config = await this.getConfiguracoesTurnos();
    const lista = config[local] || [];
    return lista.filter(t => t.ativo).map(t => t.nome);
  }

  // 3. Gravar Alterações
  async saveConfiguracoesTurnos(config: ConfigTurnos) {
    return await lastValueFrom(
      this.http.post(`${this.apiUrl}?acao=salvar_config_turnos`, config, this.getHeaders())
    );
  }
}