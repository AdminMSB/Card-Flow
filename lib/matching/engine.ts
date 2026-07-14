import { textSimilarity } from './similarity';

export interface MatchableInvoiceItem {
  id: string;
  itemDate: string; // ISO yyyy-mm-dd
  amountCents: number;
  merchantRaw: string;
}

export interface MatchableCandidatePurchase {
  id: string;
  cardId: string;
  purchaseDate: string; // ISO yyyy-mm-dd
  amountCents: number;
  merchantName: string;
}

export interface ScoredMatch {
  invoiceItemId: string;
  purchaseId: string;
  score: number;
}

/** Score >= este limiar é sugerido como match automático (ainda pendente de confirmação humana). */
export const AUTO_MATCH_THRESHOLD = 0.72;

/** Score abaixo deste piso nem entra como sugestão de conciliação manual. */
export const MIN_SUGGESTION_THRESHOLD = 0.35;

const DATE_WINDOW_DAYS = 3;
const AMOUNT_TOLERANCE_CENTS = 100; // até R$ 1,00 de diferença (juros/arredondamento de câmbio, taxas)

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(`${isoA.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${isoB.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

function amountScore(itemCents: number, purchaseCents: number): number {
  const diff = Math.abs(itemCents - purchaseCents);
  if (diff === 0) return 1;
  if (diff <= AMOUNT_TOLERANCE_CENTS) return 0.7;
  return 0;
}

function dateScore(itemDate: string, purchaseDate: string): number {
  const diff = daysBetween(itemDate, purchaseDate);
  if (diff === 0) return 1;
  if (diff > DATE_WINDOW_DAYS) return 0;
  return 1 - diff / (DATE_WINDOW_DAYS + 1);
}

/**
 * Score combinado (0 a 1) de o quanto um item de fatura corresponde a uma compra
 * registrada: valor (peso 0.5), data (peso 0.3), similaridade do nome (peso 0.2).
 * Valor exato é obrigatório (ou dentro da tolerância) — sem isso o score é 0,
 * pois nome/data parecidos não bastam para sugerir um match financeiro.
 */
export function scorePurchaseMatch(
  item: MatchableInvoiceItem,
  purchase: MatchableCandidatePurchase,
): number {
  const amt = amountScore(item.amountCents, purchase.amountCents);
  if (amt === 0) return 0;

  const date = dateScore(item.itemDate, purchase.purchaseDate);
  const text = textSimilarity(item.merchantRaw, purchase.merchantName);

  return amt * 0.5 + date * 0.3 + text * 0.2;
}

/**
 * Gera sugestões de conciliação para uma fatura: para cada item, tenta achar a
 * melhor compra correspondente entre os candidatos do mesmo cartão. Usa alocação
 * greedy por score decrescente para evitar que duas linhas da fatura "roubem" a
 * mesma compra. Só considera pares com score >= MIN_SUGGESTION_THRESHOLD.
 *
 * O caller decide o que fazer com o score: >= AUTO_MATCH_THRESHOLD vira sugestão
 * de match automático (a confirmar na tela de conciliação); abaixo disso fica
 * disponível como sugestão fraca para o usuário considerar num match manual.
 */
export function suggestMatches(
  items: MatchableInvoiceItem[],
  candidates: MatchableCandidatePurchase[],
): ScoredMatch[] {
  const allPairs: ScoredMatch[] = [];

  for (const item of items) {
    for (const purchase of candidates) {
      const score = scorePurchaseMatch(item, purchase);
      if (score >= MIN_SUGGESTION_THRESHOLD) {
        allPairs.push({ invoiceItemId: item.id, purchaseId: purchase.id, score });
      }
    }
  }

  allPairs.sort((a, b) => b.score - a.score);

  const usedItems = new Set<string>();
  const usedPurchases = new Set<string>();
  const result: ScoredMatch[] = [];

  for (const pair of allPairs) {
    if (usedItems.has(pair.invoiceItemId) || usedPurchases.has(pair.purchaseId)) continue;
    usedItems.add(pair.invoiceItemId);
    usedPurchases.add(pair.purchaseId);
    result.push(pair);
  }

  return result;
}
