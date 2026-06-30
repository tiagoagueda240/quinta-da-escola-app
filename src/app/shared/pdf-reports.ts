import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Inscricao } from '../models/inscricao.model';

export function gerarPDFCozinha(
  inscricoes: Inscricao[],
  turno: string,
  filenameBase: string,
): void {
  const doc = new jsPDF();
  const lista = inscricoes.filter(
    (i) => i.turnoEscolhido === turno && (i.saude.temAlergiaAlimentar || i.saude.temOutrasAlergias),
  );
  doc.text(`Restrições Alimentares - ${turno}`, 14, 20);
  autoTable(doc, {
    head: [['Participante', 'Alergia/Restrição']],
    body: lista.map((i) => [
      i.participante.nomeCompleto,
      i.saude.detalheAlergiaAlimentar || i.saude.detalheOutrasAlergias || 'Não especificado',
    ]),
    startY: 30,
  });
  doc.save(`Cozinha_${filenameBase}.pdf`);
}

export function gerarPDFTransporte(
  inscricoes: Inscricao[],
  turno: string,
  filenameBase: string,
): void {
  const doc = new jsPDF();
  const lista = inscricoes.filter(
    (i) => i.turnoEscolhido === turno && i.transporte !== 'Não (Entregue pelos pais)',
  );
  doc.text(`Lista de Transportes - ${turno}`, 14, 20);
  autoTable(doc, {
    head: [['Participante', 'Tipo Transporte', 'Contacto']],
    body: lista.map((i) => [i.participante.nomeCompleto, i.transporte, i.ee.telefone]),
    startY: 30,
  });
  doc.save(`Transportes_${filenameBase}.pdf`);
}
