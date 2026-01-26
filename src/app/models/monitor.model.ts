export interface Monitor {
  id?: string;
  nome: string;          // Nome completo (ex: para contratos/seguros)
  nomeMonitor: string;   // Alcunha / Nome de Monitor (exibido na app)
  telefone: string;
  email: string;
  dataNascimento: Date;
  diasTrabalhados: number;
  status: 'estagiario' | 'monitor' | 'coordenador';
  turnosAtribuidos: string[];
  obs?: string;
  tamanhoTshirt?: string;
}