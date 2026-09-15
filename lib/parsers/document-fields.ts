export interface ExtractedDocumentFields {
  supplierName: string | null;
  supplierCnpj: string | null;
  amountCents: number | null;
  documentNumber: string | null;
  issueDate: string | null;
  unmatchedFields: string[];
}

const CNPJ_PATTERN = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
const MONEY_PATTERN = /(\d{1,3}(?:\.\d{3})*,\d{2})/;
const DATE_PATTERN = /(\d{2})\/(\d{2})\/(\d{4})/;

// Palavras-chave observadas em DANFE (nota fiscal eletrônica) e boletos — layouts variam
// bastante entre emissores, então isso é "melhor esforço": procura o valor/número/data mais
// próximo (mesma linha ou logo abaixo) de uma dessas palavras, não usa posição fixa como no
// parser da fatura do cartão (aquele é só um layout, esse pode ser qualquer um).
const AMOUNT_KEYWORDS = [
  /VALOR\s+TOTAL\s+DA\s+NOTA/i,
  /VALOR\s+TOTAL\s+DA\s+NF-?E/i,
  /VALOR\s+TOTAL\s+DO\s+DOCUMENTO/i,
  /VALOR\s+COBRADO/i,
  /VALOR\s+DO\s+DOCUMENTO/i,
  /VALOR\s+TOTAL/i,
];

const DOCUMENT_NUMBER_KEYWORDS = [
  // NF-e (produto)
  /N[ºO°]\.?\s*DA\s+NF-?E/i,
  /NOTA\s+FISCAL\s+N[ºO°]/i,
  /N[ºO°]\s*\/?\s*S[ÉE]RIE/i,
  /N[ºO°]\.?\s*DOCUMENTO/i,
  // NFS-e (serviço — layout municipal, rótulos diferentes da NF-e)
  /N[ÚU]MERO\s+DA\s+NOTA/i,
  /N[ÚU]MERO\s+DA\s+NFS-?E/i,
  /N[ºO°]\.?\s*DA\s+NFS-?E/i,
  /RPS\s+N[ºO°]/i,
];

const DATE_KEYWORDS = [/DATA\s+DA?\s+EMISS[ÃA]O/i, /DATA\s+DE\s+EMISS[ÃA]O/i, /EMISS[ÃA]O/i, /VENCIMENTO/i];

// Rótulos de cabeçalho que não são o nome do fornecedor, mesmo aparecendo perto do CNPJ.
const SUPPLIER_NAME_EXCLUDE =
  /^(CNPJ|IE|INSCRI[ÇC][ÃA]O|ENDERE[ÇC]O|MUNIC[ÍI]PIO|UF|CEP|FONE|TELEFONE|DANFE|NOTA FISCAL|DOCUMENTO AUXILIAR|EMITENTE|DESTINAT[ÁA]RIO)/i;

function parseMoneyToCents(raw: string): number {
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  return Math.round(Number.parseFloat(normalized) * 100);
}

/** Procura, a partir de uma linha que bate com alguma palavra-chave, o primeiro trecho que
 * bate com `valuePattern` nela mesma ou nas `lookaheadLines` linhas seguintes. */
function findNear(lines: string[], keywordPatterns: RegExp[], valuePattern: RegExp, lookaheadLines = 1): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (!keywordPatterns.some((pattern) => pattern.test(lines[i]!))) continue;
    for (let j = i; j <= Math.min(i + lookaheadLines, lines.length - 1); j++) {
      const match = lines[j]!.match(valuePattern);
      if (match) return match[0];
    }
  }
  return null;
}

/** Extrai fornecedor/CNPJ/valor/número/data de uma NF, DANFE ou boleto a partir das linhas
 * de texto do PDF — "melhor esforço": layouts variam entre emissores, então cada campo não
 * identificado com confiança fica null e entra em `unmatchedFields`, pra UI avisar o usuário
 * a conferir/preencher manualmente em vez de arriscar um valor errado. */
export function extractDocumentFields(lines: string[]): ExtractedDocumentFields {
  const fullText = lines.join('\n');

  const cnpjMatch = fullText.match(CNPJ_PATTERN);
  const supplierCnpj = cnpjMatch ? cnpjMatch[0] : null;

  // O nome do fornecedor costuma aparecer logo acima do próprio CNPJ, no bloco de
  // cabeçalho do emitente — procura pra trás a partir da linha do CNPJ.
  let supplierName: string | null = null;
  if (cnpjMatch) {
    const cnpjLineIndex = lines.findIndex((line) => line.includes(cnpjMatch[0]));
    if (cnpjLineIndex >= 0) {
      for (let i = cnpjLineIndex; i >= Math.max(0, cnpjLineIndex - 3); i--) {
        const candidate = lines[i]!.replace(CNPJ_PATTERN, '').trim();
        if (candidate.length >= 5 && /[A-Za-zÀ-ÿ]/.test(candidate) && !SUPPLIER_NAME_EXCLUDE.test(candidate)) {
          supplierName = candidate;
          break;
        }
      }
    }
  }

  const amountRaw = findNear(lines, AMOUNT_KEYWORDS, MONEY_PATTERN, 1);
  const amountCents = amountRaw ? parseMoneyToCents(amountRaw) : null;

  const documentNumberRaw = findNear(lines, DOCUMENT_NUMBER_KEYWORDS, /\d[\d.\-/]{2,}/, 1);
  const documentNumber = documentNumberRaw ? documentNumberRaw.replace(/\D/g, '').slice(0, 12) || null : null;

  const dateRaw = findNear(lines, DATE_KEYWORDS, DATE_PATTERN, 1);
  let issueDate: string | null = null;
  if (dateRaw) {
    const match = dateRaw.match(DATE_PATTERN);
    if (match) {
      const [, day, month, year] = match as [string, string, string, string];
      issueDate = `${year}-${month}-${day}`;
    }
  }

  const unmatchedFields: string[] = [];
  if (!supplierName) unmatchedFields.push('Fornecedor');
  if (!supplierCnpj) unmatchedFields.push('CNPJ do fornecedor');
  if (amountCents == null) unmatchedFields.push('Valor');
  if (!documentNumber) unmatchedFields.push('Nº da NF/fatura/boleto');
  if (!issueDate) unmatchedFields.push('Data de emissão');

  return { supplierName, supplierCnpj, amountCents, documentNumber, issueDate, unmatchedFields };
}
