import { describe, expect, it } from 'vitest';
import {
  clusterTextItemsIntoLines,
  extractRowsFromLines,
  type PositionedTextItem,
} from '@/lib/parsers/pdf-transactions';

/** Monta os itens de texto posicionados de uma linha de transação fictícia, no layout de
 * fatura suportado: data (x=18.42), descrição (x=65.93), local (x=219.7), valor em R$
 * (x entre 460 e 500), cotação (x~519+, ignorada pelo parser). */
function transactionLine(overrides: {
  date: string;
  description: string;
  local?: string;
  amount: string;
  amountX?: number;
}): PositionedTextItem[] {
  const y = 100;
  const items: PositionedTextItem[] = [
    { str: overrides.date, x: 18.42, y },
    { str: overrides.description, x: 65.93, y },
  ];
  if (overrides.local) items.push({ str: overrides.local, x: 219.7, y });
  items.push({ str: overrides.amount, x: overrides.amountX ?? 485.12, y });
  return items;
}

describe('clusterTextItemsIntoLines', () => {
  it('agrupa itens com Y aproximado na mesma linha, em ordem de Y desc e X asc', () => {
    const items: PositionedTextItem[] = [
      { str: 'B', x: 50, y: 100 },
      { str: 'A', x: 10, y: 100.5 },
      { str: 'C', x: 10, y: 50 },
    ];
    const lines = clusterTextItemsIntoLines(items);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.map((i) => i.str)).toEqual(['A', 'B']);
    expect(lines[1]?.map((i) => i.str)).toEqual(['C']);
  });

  it('separa em linhas diferentes quando o Y difere além da tolerância', () => {
    const items: PositionedTextItem[] = [
      { str: 'linha1', x: 10, y: 100 },
      { str: 'linha2', x: 10, y: 90 },
    ];
    const lines = clusterTextItemsIntoLines(items);
    expect(lines).toHaveLength(2);
  });
});

describe('extractRowsFromLines', () => {
  it('extrai data ISO, valor e descrição de uma transação nacional', () => {
    const lines = [
      transactionLine({ date: '26-05-2026', description: 'LOJA EXEMPLO*PAPELARIA', local: 'Cidade Teste\\', amount: '187,96' }),
    ];
    const rows = extractRowsFromLines(lines);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.columns).toEqual({
      data: '2026-05-26',
      valor: '187,96',
      descricao: 'LOJA EXEMPLO*PAPELARIA',
    });
  });

  it('ignora linhas sem data na coluna correta (cabeçalhos, resumos)', () => {
    const lines = [[{ str: 'Total de compras em R$', x: 18.42, y: 100 }, { str: '1.234,56', x: 485, y: 100 }]];
    expect(extractRowsFromLines(lines)).toHaveLength(0);
  });

  it('ignora linha de continuação sem data nem valor (texto de merchant que quebrou de linha)', () => {
    const lines = [[{ str: 'LOJA EXEM', x: 219.7, y: 100 }]];
    expect(extractRowsFromLines(lines)).toHaveLength(0);
  });

  it('ignora linha com data mas sem valor reconhecível na coluna R$', () => {
    const lines = [[{ str: '02-06-2026', x: 18.42, y: 100 }, { str: 'MATERIAL DE ESCRITORIO', x: 65.93, y: 100 }]];
    expect(extractRowsFromLines(lines)).toHaveLength(0);
  });

  it('ignora valores negativos (pagamentos, estornos, créditos)', () => {
    const lines = [
      transactionLine({ date: '10-06-2026', description: 'PAGAMENTO DE FATURA-INTE', amount: '-500,00' }),
    ];
    expect(extractRowsFromLines(lines)).toHaveLength(0);
  });

  it('ignora tarifas/encargos que não são compras de estabelecimento', () => {
    const lines = [
      transactionLine({ date: '19-06-2026', description: 'IOF DESPESA NO EXTERIOR', amount: '15,00' }),
      transactionLine({ date: '29-06-2026', description: 'ANUIDADE DIFERENCIADA', amount: '12,00' }),
    ];
    expect(extractRowsFromLines(lines)).toHaveLength(0);
  });

  it('extrai o valor em R$ mesmo quando há colunas US$/cotação na mesma linha (transação internacional)', () => {
    const lines: PositionedTextItem[][] = [
      [
        { str: '19-06-2026', x: 18.42, y: 100 },
        { str: 'SERVICO ONLINE TESTE', x: 65.93, y: 100 },
        { str: 'CIDADE EXTERIOR\\', x: 219.7, y: 100 },
        { str: '10,00', x: 427.02, y: 100 }, // US$
        { str: '54,70', x: 479.29, y: 100 }, // R$ — este é o valor correto a extrair
        { str: '5,47', x: 539.11, y: 100 }, // cotação do dólar
      ],
    ];
    const rows = extractRowsFromLines(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.columns.valor).toBe('54,70');
    expect(rows[0]?.columns.descricao).toBe('SERVICO ONLINE TESTE');
  });

  it('numera rowIndex sequencialmente a partir do startIndex informado', () => {
    const lines = [
      transactionLine({ date: '01-06-2026', description: 'LOJA A', amount: '10,00' }),
      transactionLine({ date: '02-06-2026', description: 'LOJA B', amount: '20,00' }),
    ];
    const rows = extractRowsFromLines(lines, 5);
    expect(rows.map((r) => r.rowIndex)).toEqual([5, 6]);
  });
});
