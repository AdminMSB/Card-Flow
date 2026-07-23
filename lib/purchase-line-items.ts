import type { createServerSupabaseClient } from '@/lib/supabase/server';

/** Divide um valor legado (ex.: "13797800 / 013797815") nos códigos individuais — mesma
 * convenção "/" já usada nos dados históricos importados antes de existirem as tabelas
 * de lançamentos/documentos. */
function splitLegacyValue(value: string | null): string[] {
  if (!value) return [];
  return value
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export interface OrderCodeItem {
  code: string;
  amountCents: number | null;
}

export interface InvoiceDocumentItem {
  documentNumber: string;
  amountCents: number | null;
}

export interface PurchaseLineItems {
  orderCodesByPurchaseId: Map<string, OrderCodeItem[]>;
  invoiceDocumentsByPurchaseId: Map<string, InvoiceDocumentItem[]>;
}

/** Busca os lançamentos (OC/Diário de Fatura, com valor total da NF — com IPI — quando
 * informado) e documentos (NF/fatura/boleto, com o valor que efetivamente aparece na
 * fatura do cartão) das compras informadas. Compras antigas, que ainda não têm linhas nas
 * tabelas filhas, caem no fallback do valor único legado em `purchases` (dividido pela
 * mesma convenção "/", sem valor individual). */
export async function fetchPurchaseLineItems(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  purchases: { id: string; purchase_order_code: string | null; invoice_document_number: string | null }[],
): Promise<PurchaseLineItems> {
  const purchaseIds = purchases.map((purchase) => purchase.id);

  const [{ data: orderCodeRows }, { data: documentRows }] = purchaseIds.length
    ? await Promise.all([
        supabase
          .from('purchase_order_codes')
          .select('purchase_id, code, amount_cents')
          .in('purchase_id', purchaseIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('purchase_invoice_documents')
          .select('purchase_id, document_number, amount_cents')
          .in('purchase_id', purchaseIds)
          .order('created_at', { ascending: true }),
      ])
    : [
        { data: [] as { purchase_id: string; code: string; amount_cents: number | null }[] },
        { data: [] as { purchase_id: string; document_number: string; amount_cents: number | null }[] },
      ];

  const orderCodesByPurchaseId = new Map<string, OrderCodeItem[]>();
  for (const row of orderCodeRows ?? []) {
    const list = orderCodesByPurchaseId.get(row.purchase_id) ?? [];
    list.push({ code: row.code, amountCents: row.amount_cents });
    orderCodesByPurchaseId.set(row.purchase_id, list);
  }

  const invoiceDocumentsByPurchaseId = new Map<string, InvoiceDocumentItem[]>();
  for (const row of documentRows ?? []) {
    const list = invoiceDocumentsByPurchaseId.get(row.purchase_id) ?? [];
    list.push({ documentNumber: row.document_number, amountCents: row.amount_cents });
    invoiceDocumentsByPurchaseId.set(row.purchase_id, list);
  }

  for (const purchase of purchases) {
    if (!orderCodesByPurchaseId.has(purchase.id)) {
      const fallback = splitLegacyValue(purchase.purchase_order_code);
      if (fallback.length > 0) {
        orderCodesByPurchaseId.set(
          purchase.id,
          fallback.map((code) => ({ code, amountCents: null })),
        );
      }
    }
    if (!invoiceDocumentsByPurchaseId.has(purchase.id)) {
      const fallback = splitLegacyValue(purchase.invoice_document_number);
      if (fallback.length > 0) {
        invoiceDocumentsByPurchaseId.set(
          purchase.id,
          fallback.map((documentNumber) => ({ documentNumber, amountCents: null })),
        );
      }
    }
  }

  return { orderCodesByPurchaseId, invoiceDocumentsByPurchaseId };
}
