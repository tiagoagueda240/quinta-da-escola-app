export interface Monitor {
  id?: string;
  nome: string;
  nomeMonitor: string;
  telefone: string;
  email: string;
  dataNascimento?: Date;

  intolerancias?: string;
  formacoes: string[];    // Array vindo do JSON
  faltaAlcunha?: boolean; // Calculado no front

  diasTrabalhados: number;
  status: 'estagiario' | 'monitor' | 'coordenador';
  turnosAtribuidos: string[]; // Array vindo do JSON
  obs?: string;
  tamanhoTshirt?: string;
}