export interface Monitor {
  id?: string;
  nome: string;           // Nome completo
  nomeMonitor: string;    // Alcunha (exibido na app)
  telefone: string;
  email: string;
  dataNascimento: Date;

  // Novos campos para a importação robusta
  intolerancias?: string; // Mapeado de "Intolerâncias" ou "Rest. Alim"
  formacoes: string[];    // Histórico das abas (ex: "Fev 2024", "Maio 2025")
  faltaAlcunha?: boolean; // Flag para UI indicar que a alcunha foi gerada automaticamente

  diasTrabalhados: number;
  status: 'estagiario' | 'monitor' | 'coordenador';
  turnosAtribuidos: string[];
  obs?: string;
  tamanhoTshirt?: string;
}