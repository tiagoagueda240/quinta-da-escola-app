export interface LogisticaItem {
  id?: number; // ID da Base de Dados
  turno: string;
  local: string;
  tipo: 'camarata' | 'atividade';
  titulo: string;
  monitor_nome: string;
  capacidade: number;
  genero: 'M' | 'F' | 'Misto';
}