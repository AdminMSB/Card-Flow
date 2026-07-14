import { describe, expect, it } from 'vitest';
import {
  AUTO_MATCH_THRESHOLD,
  MIN_SUGGESTION_THRESHOLD,
  scorePurchaseMatch,
  suggestMatches,
  type MatchableCandidatePurchase,
  type MatchableInvoiceItem,
} from '@/lib/matching/engine';
import { textSimilarity } from '@/lib/matching/similarity';

function item(overrides: Partial<MatchableInvoiceItem> = {}): MatchableInvoiceItem {
  return {
    id: 'item-1',
    itemDate: '2026-07-05',
    amountCents: 10000,
    merchantRaw: 'POSTO SHELL SAO PAULO',
    ...overrides,
  };
}

function purchase(overrides: Partial<MatchableCandidatePurchase> = {}): MatchableCandidatePurchase {
  return {
    id: 'purchase-1',
    cardId: 'card-1',
    purchaseDate: '2026-07-05',
    amountCents: 10000,
    merchantName: 'Posto Shell',
    ...overrides,
  };
}

describe('scorePurchaseMatch', () => {
  it('retorna score máximo para valor, data e nome idênticos', () => {
    const score = scorePurchaseMatch(item(), purchase());
    expect(score).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it('retorna 0 quando o valor difere além da tolerância', () => {
    const score = scorePurchaseMatch(item({ amountCents: 10000 }), purchase({ amountCents: 15000 }));
    expect(score).toBe(0);
  });

  it('aceita pequena diferença de centavos (tolerância de arredondamento)', () => {
    const score = scorePurchaseMatch(item({ amountCents: 10000 }), purchase({ amountCents: 10050 }));
    expect(score).toBeGreaterThan(0);
  });

  it('penaliza data distante mas ainda dentro da janela', () => {
    const closeScore = scorePurchaseMatch(item({ itemDate: '2026-07-05' }), purchase({ purchaseDate: '2026-07-06' }));
    const farScore = scorePurchaseMatch(item({ itemDate: '2026-07-05' }), purchase({ purchaseDate: '2026-07-08' }));
    expect(closeScore).toBeGreaterThan(farScore);
  });

  it('zera a contribuição de data fora da janela de dias', () => {
    const merchantRaw = 'LOJA XPTO';
    const merchantName = 'Totalmente Diferente';
    const score = scorePurchaseMatch(
      item({ itemDate: '2026-07-01', merchantRaw }),
      purchase({ purchaseDate: '2026-07-20', merchantName }),
    );
    // valor idêntico contribui 0.5; data fora da janela contribui 0; nome contribui o que sobrar.
    const expected = 0.5 + textSimilarity(merchantRaw, merchantName) * 0.2;
    expect(score).toBeCloseTo(expected, 5);
  });

  it('nomes de estabelecimento diferentes reduzem o score mesmo com valor/data iguais', () => {
    const similar = scorePurchaseMatch(item({ merchantRaw: 'Posto Shell' }), purchase({ merchantName: 'Posto Shell' }));
    const different = scorePurchaseMatch(
      item({ merchantRaw: 'Restaurante Sabor Caseiro' }),
      purchase({ merchantName: 'Posto Shell' }),
    );
    expect(similar).toBeGreaterThan(different);
  });
});

describe('suggestMatches', () => {
  it('associa 1:1 sem reutilizar a mesma compra em dois itens', () => {
    const items: MatchableInvoiceItem[] = [
      item({ id: 'item-a', amountCents: 10000, merchantRaw: 'Posto Shell' }),
      item({ id: 'item-b', amountCents: 20000, merchantRaw: 'Restaurante Sabor' }),
    ];
    const candidates: MatchableCandidatePurchase[] = [
      purchase({ id: 'purchase-a', amountCents: 10000, merchantName: 'Posto Shell' }),
      purchase({ id: 'purchase-b', amountCents: 20000, merchantName: 'Restaurante Sabor Caseiro' }),
    ];

    const matches = suggestMatches(items, candidates);

    expect(matches).toHaveLength(2);
    const purchaseIds = matches.map((m) => m.purchaseId);
    expect(new Set(purchaseIds).size).toBe(purchaseIds.length);
  });

  it('prioriza o melhor score quando duas linhas competem pela mesma compra', () => {
    const items: MatchableInvoiceItem[] = [
      item({ id: 'item-exact', amountCents: 10000, itemDate: '2026-07-05', merchantRaw: 'Posto Shell' }),
      item({ id: 'item-approx', amountCents: 10000, itemDate: '2026-07-08', merchantRaw: 'Posto Diferente' }),
    ];
    const candidates: MatchableCandidatePurchase[] = [
      purchase({ id: 'only-purchase', amountCents: 10000, purchaseDate: '2026-07-05', merchantName: 'Posto Shell' }),
    ];

    const matches = suggestMatches(items, candidates);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.invoiceItemId).toBe('item-exact');
  });

  it('não sugere nada abaixo do piso mínimo', () => {
    const items: MatchableInvoiceItem[] = [item({ amountCents: 10000 })];
    const candidates: MatchableCandidatePurchase[] = [purchase({ amountCents: 99999999 })];

    const matches = suggestMatches(items, candidates);
    expect(matches).toHaveLength(0);
  });

  it('MIN_SUGGESTION_THRESHOLD é menor que AUTO_MATCH_THRESHOLD', () => {
    expect(MIN_SUGGESTION_THRESHOLD).toBeLessThan(AUTO_MATCH_THRESHOLD);
  });
});
