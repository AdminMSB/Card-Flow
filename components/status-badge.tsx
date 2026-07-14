import { Badge, type BadgeTone } from '@/components/ui/badge';
import {
  INVOICE_STATUS_LABELS,
  MATCH_STATUS_LABELS,
  PURCHASE_STATUS_LABELS,
  type InvoiceStatus,
  type MatchStatus,
  type PurchaseStatus,
} from '@/types/domain';

const purchaseTones: Record<PurchaseStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'destructive',
  reconciled: 'success',
};

const invoiceTones: Record<InvoiceStatus, BadgeTone> = {
  mapping: 'warning',
  reconciling: 'info',
  closed: 'success',
};

const matchTones: Record<MatchStatus, BadgeTone> = {
  unmatched: 'destructive',
  auto_matched: 'warning',
  manually_matched: 'success',
  disputed: 'destructive',
};

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge tone={purchaseTones[status]}>{PURCHASE_STATUS_LABELS[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={invoiceTones[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  return <Badge tone={matchTones[status]}>{MATCH_STATUS_LABELS[status]}</Badge>;
}
