/** Remove acentos, caixa e pontuação para comparar nomes de estabelecimento. */
export function normalizeMerchantName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distância de Levenshtein clássica (edição de caracteres) entre duas strings. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const insertCost = currentRow[j]! + 1;
      const deleteCost = previousRow[j + 1]! + 1;
      const substituteCost = previousRow[j]! + (a[i] === b[j] ? 0 : 1);
      currentRow.push(Math.min(insertCost, deleteCost, substituteCost));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length]!;
}

/**
 * Similaridade textual entre 0 (nada em comum) e 1 (idêntico), baseada na
 * distância de Levenshtein normalizada pelo tamanho da maior string. Também
 * dá crédito extra se uma string contém a outra (comum quando a fatura traz
 * o nome do estabelecimento com sufixos/códigos extras).
 */
export function textSimilarity(a: string, b: string): number {
  const normA = normalizeMerchantName(a);
  const normB = normalizeMerchantName(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  if (normA.includes(normB) || normB.includes(normA)) {
    const shorter = Math.min(normA.length, normB.length);
    const longer = Math.max(normA.length, normB.length);
    return 0.85 + 0.15 * (shorter / longer);
  }

  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return Math.max(0, 1 - distance / maxLen);
}
