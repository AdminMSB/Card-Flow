export type Role = 'colaborador' | 'gestor' | 'financeiro' | 'admin';

export type PurchaseStatus = 'pending' | 'approved' | 'rejected' | 'reconciled';

export type InvoiceStatus = 'mapping' | 'reconciling' | 'closed';

export type MatchStatus = 'unmatched' | 'auto_matched' | 'manually_matched' | 'disputed';

export interface CurrentProfile {
  id: string;
  fullName: string;
  role: Role;
  departmentId: string | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  colaborador: 'Colaborador',
  gestor: 'Gestor',
  financeiro: 'Financeiro',
  admin: 'Administrador',
};

// Do ponto de vista de quem registra a compra, só existem 2 estados práticos: aguardando
// (pendente) ou liberada (aprovada/conciliada). "Rejeitada" continua distinta por ser um
// desfecho negativo que precisa ficar claro.
export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: 'Pendente',
  approved: 'Liberado',
  rejected: 'Rejeitada',
  reconciled: 'Liberado',
};

/** Compra aprovada ou conciliada — já liberada, sem pendência. */
export function isPurchaseLiberado(status: PurchaseStatus): boolean {
  return status === 'approved' || status === 'reconciled';
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  mapping: 'Aguardando mapeamento',
  reconciling: 'Em conciliação',
  closed: 'Fechada',
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  unmatched: 'Sem correspondência',
  auto_matched: 'Sugestão automática',
  manually_matched: 'Conciliado manualmente',
  disputed: 'Em disputa',
};
