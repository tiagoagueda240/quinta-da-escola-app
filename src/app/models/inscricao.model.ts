
export interface Inscricao {
  id?: string;
  dataCriacao: Date;

  tipoCliente: 'individual' | 'instituicao';
  nomeInstituicao?: string;
  turnoEscolhido: string;   // Ex: "2º Turno - 6 a 12 Julho"
  local: 'Quinta' | 'Costa da Caparica' | 'Quiaios';

  // 2. Dados do Participante
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

  saude: {
    temAlergiaAlimentar: boolean;
    detalheAlergiaAlimentar?: string;
    temOutrasAlergias: boolean;
    detalheOutrasAlergias?: string;
    tomaMedicacao: boolean;
    detalheMedicacao?: string;
  };

  ee: {
    nome: string;
    email: string;
    telefone: string;
    contactoEmergencia?: string;
  };

  autorizaFotoVideo: boolean;
  transporte: string;

  valorTotal: number;
  estadoPagamento: 'pendente' | 'pago';

  checkin?: {
    status: 'dentro' | 'fora';
    dataEntrada: Date;
    dinheiroBolso?: number;
    notasCheckin?: string;
  };

  camarata?: string;
  monitorCamarata?: string;

  grupo?: string;
  monitorGrupo?: string;
}