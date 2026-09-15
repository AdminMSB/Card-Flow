import { describe, expect, it } from 'vitest';
import { extractDocumentFields } from '@/lib/parsers/document-fields';

describe('extractDocumentFields', () => {
  it('extrai fornecedor, CNPJ, valor, número e data de um DANFE fictício', () => {
    const lines = [
      'DANFE - Documento Auxiliar da Nota Fiscal Eletrônica',
      'EMITENTE',
      'FICTICIA COMERCIO DE MATERIAIS LTDA',
      'CNPJ: 12.345.678/0001-90',
      'ENDEREÇO: RUA EXEMPLO, 123',
      'Nº DA NF-E 001234',
      'SÉRIE 1',
      'DATA DA EMISSÃO 15/09/2026',
      'VALOR TOTAL DA NOTA',
      '1.234,56',
    ];

    const result = extractDocumentFields(lines);

    expect(result).toEqual({
      supplierName: 'FICTICIA COMERCIO DE MATERIAIS LTDA',
      supplierCnpj: '12.345.678/0001-90',
      amountCents: 123456,
      documentNumber: '001234',
      issueDate: '2026-09-15',
      unmatchedFields: [],
    });
  });

  it('extrai um boleto fictício, com valor sem separador de milhar', () => {
    const lines = [
      'BOLETO DE COBRANÇA BANCÁRIA',
      'BENEFICIÁRIO',
      'EMPRESA TESTE SERVIÇOS EIRELI',
      'CNPJ: 98.765.432/0001-11',
      'VENCIMENTO 20/09/2026',
      'VALOR DO DOCUMENTO',
      '65,00',
    ];

    const result = extractDocumentFields(lines);

    expect(result.supplierName).toBe('EMPRESA TESTE SERVIÇOS EIRELI');
    expect(result.supplierCnpj).toBe('98.765.432/0001-11');
    expect(result.amountCents).toBe(6500);
    expect(result.issueDate).toBe('2026-09-20');
  });

  it('lista os campos não identificados quando o texto não tem os padrões esperados', () => {
    const lines = ['DOCUMENTO SEM CAMPOS RECONHECÍVEIS', 'ALGUM TEXTO QUALQUER'];

    const result = extractDocumentFields(lines);

    expect(result).toEqual({
      supplierName: null,
      supplierCnpj: null,
      amountCents: null,
      documentNumber: null,
      issueDate: null,
      unmatchedFields: ['Fornecedor', 'CNPJ do fornecedor', 'Valor', 'Nº da NF/fatura/boleto', 'Data de emissão'],
    });
  });

  it('não confunde um rótulo de cabeçalho (ex.: "ENDEREÇO") com o nome do fornecedor', () => {
    const lines = ['ENDEREÇO: AV. TESTE, 456', 'RAZÃO SOCIAL EXEMPLO LTDA', 'CNPJ: 11.222.333/0001-44'];

    const result = extractDocumentFields(lines);

    expect(result.supplierName).toBe('RAZÃO SOCIAL EXEMPLO LTDA');
  });
});
