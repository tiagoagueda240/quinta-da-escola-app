export interface Inscricao {
  id?: string; // O PHP pode mandar como string ou number
  dataCriacao: Date;

  tipoCliente: 'individual' | 'instituicao';
  nomeInstituicao?: string;
  turnoEscolhido: string;
  local: 'Quinta' | 'Costa da Caparica' | 'Quiaios';

  // Objeto JSON vindo do MySQL
  participante: {
    nomeCompleto: string;
    genero: 'M' | 'F';
    dataNascimento: Date;
    naturalidade: string;
    morada: string;
    codigoPostal: string;
    localidade: string;
    cc: string;
    sistemaSaude: string;
    nif: string;
  };

  ee: {
    nome: string;
    email: string;
    telefone: string;
    contactoEmergencia?: string;
  };

  saude: {
    temAlergiaAlimentar: boolean;
    detalheAlergiaAlimentar?: string;
    temOutrasAlergias: boolean;
    detalheOutrasAlergias?: string;
    tomaMedicacao: boolean;
    detalheMedicacao?: string;
  };

  checkin?: {
    status: 'dentro' | 'fora';
    dataEntrada: Date;
    dinheiroBolso?: number;
    notasCheckin?: string;
  };

  autorizaFotoVideo: boolean;
  transporte: string;
  valorTotal: number;
  estadoPagamento: 'pendente' | 'pago';

  // Campos de Logística
  camarata?: string;
  monitorCamarata?: string;
  grupo?: string;
  monitorGrupo?: string;
}

// Adiciona estas interfaces no fim do ficheiro ou num ficheiro de models
export interface TurnoConfig {
  id: number;
  nome: string;
  ativo: boolean;
  limite?: number;
}

export interface ConfigTurnos {
  quinta: TurnoConfig[];
  costaCaparica: TurnoConfig[];
  quiaios: TurnoConfig[];
}