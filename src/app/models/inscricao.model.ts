export interface Inscricao {
  id?: string;
  dataCriacao?: Date;

  tipoCliente?: 'individual' | 'instituicao';
  nomeInstituicao?: string;
  turnoEscolhido: string;
  local: string;

  // IDs Relacionais (Novos) - Essenciais para a correção dos erros TS2551/TS2339
  camarata_id?: number;
  grupo_id?: number;

  // Campos legacy ou visuais (mantidos para compatibilidade)
  camarata?: string;
  grupo?: string;
  monitorCamarata?: string;
  monitorGrupo?: string;

  participante: {
    nomeCompleto: string;
    genero: 'M' | 'F';
    dataNascimento: Date | string; // Aceita string vinda da API
    naturalidade?: string;
    morada?: string;
    codigoPostal?: string;
    localidade?: string;
    cc?: string;
    sistemaSaude?: string;
    nif?: string;
    tamanhoTshirt?: string;
  };

  ee: {
    nome: string;
    email: string;
    telefone: string;
    contactoEmergencia?: string;
    nif?: string;
  };

  saude: {
    temAlergiaAlimentar: boolean;
    detalheAlergiaAlimentar?: string; // Mapeado do PHP 'intolerancias'
    alergiaDetalhes?: string;         // Alias visual

    temOutrasAlergias?: boolean;
    detalheOutrasAlergias?: string;

    tomaMedicacao: boolean;
    detalheMedicacao?: string;        // Mapeado do PHP 'medicacao'
    medicacaoHabitual?: string;       // Alias visual necessário para o template
  };

  checkin?: {
    status: 'dentro' | 'fora';
    dataEntrada?: Date;
    dinheiroBolso?: number;
    notasCheckin?: string;
  };

  autorizaFotoVideo: boolean;
  transporte: string;
  valor_total: number;
  estado_pagamento: 'pendente' | 'pago';
  dataPagamento?: Date | string;
  nomePagamento?: string;
  numeroFatura?: string;
}

// Adiciona estas interfaces no fim do ficheiro ou num ficheiro de models
export interface TurnoConfig {
  id: number;
  nome: string;
  ativo: boolean;
  limite?: number;
  coordenadores: string[];
}

export interface ConfigTurnos {
  quinta: TurnoConfig[];
  costaCaparica: TurnoConfig[];
  quiaios: TurnoConfig[];
}