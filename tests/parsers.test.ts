import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseCSV, parseXLSX } from '@/lib/parsers/spreadsheet';
import { parseOFX } from '@/lib/parsers/ofx';
import { detectColumnMapping, normalizeRows } from '@/lib/parsers/normalize';
import { detectFileType } from '@/lib/parsers/types';

describe('detectFileType', () => {
  it('reconhece csv, xlsx, xls e ofx pela extensão', () => {
    expect(detectFileType('fatura.csv')).toBe('csv');
    expect(detectFileType('fatura.XLSX')).toBe('xlsx');
    expect(detectFileType('fatura.xls')).toBe('xlsx');
    expect(detectFileType('fatura.OFX')).toBe('ofx');
    expect(detectFileType('fatura.pdf')).toBe('pdf');
    expect(detectFileType('fatura.docx')).toBeNull();
  });
});

describe('parseCSV', () => {
  it('extrai cabeçalhos e linhas de um CSV simples', () => {
    const csv = 'Data,Descricao,Valor\n05/07/2026,Posto Shell,"150,00"\n06/07/2026,Restaurante Sabor,"89,90"\n';
    const parsed = parseCSV(csv);

    expect(parsed.headers).toEqual(['Data', 'Descricao', 'Valor']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.columns['Data']).toBe('05/07/2026');
    expect(parsed.rows[0]?.columns['Descricao']).toBe('Posto Shell');
  });

  it('ignora linhas totalmente vazias', () => {
    const csv = 'Data,Descricao,Valor\n05/07/2026,Posto Shell,"150,00"\n,,\n';
    const parsed = parseCSV(csv);
    expect(parsed.rows).toHaveLength(1);
  });

  it('gera nomes de coluna padrão quando o cabeçalho vem vazio', () => {
    const csv = 'Data,,Valor\n05/07/2026,Posto Shell,"150,00"\n';
    const parsed = parseCSV(csv);
    expect(parsed.headers[1]).toBe('coluna_2');
  });
});

describe('parseXLSX', () => {
  it('extrai cabeçalhos e linhas de uma planilha gerada com a biblioteca xlsx', () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Data', 'Estabelecimento', 'Valor'],
      ['05/07/2026', 'Posto Shell', '150,00'],
      ['06/07/2026', 'Restaurante Sabor', '89,90'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fatura');
    const nodeBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const buffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength,
    ) as ArrayBuffer;

    const parsed = parseXLSX(buffer);

    expect(parsed.headers).toEqual(['Data', 'Estabelecimento', 'Valor']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1]?.columns['Estabelecimento']).toBe('Restaurante Sabor');
  });
});

describe('parseOFX', () => {
  const sampleOfx = `
OFXHEADER:100
<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<BANKTRANSLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260705120000
<TRNAMT>-150.00
<NAME>POSTO SHELL
<MEMO>Combustivel
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260706120000
<TRNAMT>-89.90
<NAME>RESTAURANTE SABOR
</STMTTRN>
</BANKTRANSLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>
`;

  it('extrai transações de um arquivo OFX com tags sem fechamento', () => {
    const parsed = parseOFX(sampleOfx);

    expect(parsed.headers).toEqual(['data', 'valor', 'descricao']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.columns['data']).toBe('2026-07-05');
    expect(parsed.rows[0]?.columns['valor']).toBe('-150.00');
    expect(parsed.rows[0]?.columns['descricao']).toContain('POSTO SHELL');
    expect(parsed.rows[1]?.columns['descricao']).toBe('RESTAURANTE SABOR');
  });
});

describe('detectColumnMapping', () => {
  it('detecta colunas de data, valor e descrição por nome de cabeçalho', () => {
    const parsed = parseCSV('Data da compra,Estabelecimento,Valor (R$)\n05/07/2026,Posto Shell,"150,00"\n');
    const mapping = detectColumnMapping(parsed);

    expect(mapping.date).toBe('Data da compra');
    expect(mapping.amount).toBe('Valor (R$)');
    expect(mapping.description).toBe('Estabelecimento');
  });

  it('retorna undefined para colunas que não conseguiu identificar', () => {
    const parsed = parseCSV('Coluna A,Coluna B\nx,y\n');
    const mapping = detectColumnMapping(parsed);
    expect(mapping.date).toBeUndefined();
    expect(mapping.amount).toBeUndefined();
  });
});

describe('normalizeRows', () => {
  it('converte datas BR e valores em vírgula para o formato normalizado', () => {
    const parsed = parseCSV(
      'Data,Descricao,Valor\n05/07/2026,Posto Shell,"150,00"\n06/07/2026,Restaurante Sabor,"89,90"\n',
    );
    const lines = normalizeRows(parsed, { date: 'Data', amount: 'Valor', description: 'Descricao' });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      itemDate: '2026-07-05',
      amountCents: 15000,
      merchantRaw: 'Posto Shell',
      descriptionRaw: 'Posto Shell',
    });
    expect(lines[1]?.amountCents).toBe(8990);
  });

  it('descarta linhas sem data ou valor reconhecíveis', () => {
    const parsed = parseCSV('Data,Descricao,Valor\ndata-invalida,Posto Shell,"150,00"\n05/07/2026,Sem valor,\n');
    const lines = normalizeRows(parsed, { date: 'Data', amount: 'Valor', description: 'Descricao' });
    expect(lines).toHaveLength(0);
  });

  it('normaliza datas ISO (aaaa-mm-dd) sem alteração', () => {
    const parsed = parseCSV('Data,Descricao,Valor\n2026-07-05,Posto Shell,"150,00"\n');
    const lines = normalizeRows(parsed, { date: 'Data', amount: 'Valor', description: 'Descricao' });
    expect(lines[0]?.itemDate).toBe('2026-07-05');
  });
});
