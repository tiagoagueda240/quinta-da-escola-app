import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Inscricao } from '../models/inscricao.model';

// Função auxiliar para remover o preço do texto do transporte
function limparPrecoTransporte(transporte: string): string {
  if (!transporte) return '';
  return transporte.replace(/\s?\(\+\d+€\)/g, '').trim();
}

// Função auxiliar para calcular a idade em 2026
function calcularIdade(dataNascimento: Date | string): number {
  const hoje = new Date('2026-07-14'); // Baseado no ano atual de 2026
  const nascimento = new Date(dataNascimento);

  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();

  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

// Função auxiliar para ordenar da mais nova para a mais velha (data mais recente -> data mais antiga)
function ordenarPorIdadeCrescente(a: Inscricao, b: Inscricao): number {
  const dataA = new Date(a.participante.dataNascimento).getTime();
  const dataB = new Date(b.participante.dataNascimento).getTime();
  // Data maior significa que nasceu mais tarde (é mais novo)
  return dataB - dataA;
}

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

  // 1. Filtrar as inscrições apenas do turno selecionado
  const inscricoesTurno = inscricoes.filter((i) => i.turnoEscolhido === turno);

  // 2. Filtrar e ordenar a Tabela 1: Lisboa -> Quinta
  const ida = inscricoesTurno
    .filter((i) => {
      const t = i.transporte || '';
      return t.includes('Lisboa - Quinta da Escola') || t.includes('Lisboa - Quinta - Lisboa');
    })
    .sort(ordenarPorIdadeCrescente);

  // 3. Filtrar e ordenar a Tabela 2: Quinta -> Lisboa
  const volta = inscricoesTurno
    .filter((i) => {
      const t = i.transporte || '';
      return t.includes('Quinta da Escola - Lisboa') || t.includes('Lisboa - Quinta - Lisboa');
    })
    .sort(ordenarPorIdadeCrescente);

  // Estilos comuns para as duas tabelas
  const autoTableConfig = {
    theme: 'striped' as const,
    styles: {
      fontSize: 8.5,
      cellPadding: 1.5,
    },
    headStyles: {
      halign: 'center' as const,
      valign: 'middle' as const,
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' as const },
      2: { cellWidth: 45 },
      3: { cellWidth: 28, halign: 'center' as const },
      4: { cellWidth: 12, halign: 'center' as const },
    },
  };

  // --- PÁGINA 1: Lisboa -> Quinta ---
  doc.setFontSize(16);
  doc.text(`Lista de Transportes - ${turno}`, 14, 18);

  doc.setFontSize(12);
  doc.text('1. Ida: Lisboa -> Quinta', 14, 28);

  autoTable(doc, {
    ...autoTableConfig,
    head: [['#', 'Participante', 'Tipo Transporte', 'Contacto EE', 'Visto']],
    body: ida.map((i, index) => {
      const idade = calcularIdade(i.participante.dataNascimento);
      return [
        (index + 1).toString(),
        `${i.participante.nomeCompleto} (${idade} anos)`,
        limparPrecoTransporte(i.transporte),
        i.ee.telefone,
        '',
      ];
    }),
    startY: 32,
    headStyles: { ...autoTableConfig.headStyles, fillColor: [31, 136, 61] },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const size = 3.5;
        const x = data.cell.x + (data.cell.width / 2) - (size / 2);
        const y = data.cell.y + (data.cell.height / 2) - (size / 2);
        doc.setDrawColor(120, 120, 120);
        doc.rect(x, y, size, size);
      }
    }
  });

  // --- NOVA PÁGINA: Quinta -> Lisboa ---
  doc.addPage();

  doc.setFontSize(16);
  doc.text(`Lista de Transportes - ${turno}`, 14, 18);

  doc.setFontSize(12);
  doc.text('2. Volta: Quinta -> Lisboa', 14, 28);

  autoTable(doc, {
    ...autoTableConfig,
    head: [['#', 'Participante', 'Tipo Transporte', 'Contacto EE', 'Visto']],
    body: volta.map((i, index) => {
      const idade = calcularIdade(i.participante.dataNascimento);
      return [
        (index + 1).toString(),
        `${i.participante.nomeCompleto} (${idade} anos)`,
        limparPrecoTransporte(i.transporte),
        i.ee.telefone,
        '',
      ];
    }),
    startY: 32,
    headStyles: { ...autoTableConfig.headStyles, fillColor: [41, 128, 185] },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const size = 3.5;
        const x = data.cell.x + (data.cell.width / 2) - (size / 2);
        const y = data.cell.y + (data.cell.height / 2) - (size / 2);
        doc.setDrawColor(120, 120, 120);
        doc.rect(x, y, size, size);
      }
    }
  });

  doc.save(`Transportes_${filenameBase}.pdf`);
}