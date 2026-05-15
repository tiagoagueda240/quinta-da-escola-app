export const OPCOES_TRANSPORTE = [
  { label: 'Não (Entregue pelos pais)', valor: 0 },
  { label: 'Lisboa - Quinta da Escola (+20€)', valor: 20 },
  { label: 'Quinta da Escola - Lisboa (+20€)', valor: 20 },
  { label: 'Lisboa - Quinta - Lisboa (+40€)', valor: 40 },
] as const;

export type OpcaoTransporte = (typeof OPCOES_TRANSPORTE)[number];
