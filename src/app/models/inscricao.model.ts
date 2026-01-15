
export interface Inscricao {
  id?: string; // Gerado automaticamente pelo Firebase
  dataCriacao: Date;
  
  // 1. Dados Iniciais
  tipoCliente: 'individual' | 'instituicao';
  nomeInstituicao?: string; // Só preenchido se tipoCliente for instituicao
  turnoEscolhido: string;   // Ex: "2º Turno - 6 a 12 Julho"

  // 2. Dados do Participante
  participante: {
    nomeCompleto: string;
    genero: 'M' | 'F';
    dataNascimento: Date;
    naturalidade: string;
    morada: string;
    codigoPostal: string;
    localidade: string;
    cc: string;             // Cartão de Cidadão
    sistemaSaude: string;
    nif: string;            // Nº Contribuinte
  };

  // 3. Saúde e Alergias
  saude: {
    temAlergiaAlimentar: boolean;
    detalheAlergiaAlimentar?: string; // Só se temAlergiaAlimentar for true
    temOutrasAlergias: boolean;
    detalheOutrasAlergias?: string;
    tomaMedicacao: boolean;
    detalheMedicacao?: string;        // Ex: "Sim", guarda qual e a frequência
  };

  // 4. Encarregado de Educação
  ee: {
    nome: string;
    email: string;
    telefone: string; // Ex: +351 ...
    contactoEmergencia?: string; // Outros telefones úteis
  };

  // 5. Autorizações e Logística
  autorizaFotoVideo: boolean; // Sim/Não
  transporte: string;         // Ex: "Não", "Lisboa -> Quinta", etc.
  
  // 6. Financeiro
  valorTotal: number;         // Ex: 370 (calculado dinamicamente)
  estadoPagamento: 'pendente' | 'pago'; // Para a tua gestão interna

  checkin?: {
    status: 'dentro' | 'fora';
    dataEntrada: Date; // Mudámos de horaUltimoRegisto para dataEntrada
    dinheiroBolso?: number; // Novo: Dinheiro entregue
    notasCheckin?: string;  // Novo: Notas (ex: "Avó vem buscar")
  };

  // --- CAMPOS DE LOGÍSTICA (NOVOS) ---
  camarata?: string;        // Ex: "Quarto 1 (M)"
  monitorCamarata?: string; // Ex: "Monitor João"
  
  grupo?: string;           // Ex: "Grupo Amarelo"
  monitorGrupo?: string;    // Ex: "Monitora Ana"
}