'use client';

import { CompraForm, type CardOption, type OptionRow, type PurchaseDefaults } from './compra-form';
import { deletePurchase } from './actions';
import { Button } from '@/components/ui/button';

interface PurchaseRowActionsProps {
  purchase: PurchaseDefaults;
  costCenters: OptionRow[];
  cards: CardOption[];
  canEdit: boolean;
  canDelete: boolean;
}

/** Ações "Editar" / "Excluir" exibidas para uma compra ainda pendente. Editar é permitido
 * a quem registrou a compra ou a gestor/financeiro/admin; excluir só a quem registrou. */
export function PurchaseRowActions({ purchase, costCenters, cards, canEdit, canDelete }: PurchaseRowActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {canEdit && (
        <CompraForm
          mode="edit"
          purchase={purchase}
          costCenters={costCenters}
          cards={cards}
          triggerLabel="Editar"
          triggerVariant="secondary"
        />
      )}
      {canDelete && (
        <form
          action={deletePurchase}
          onSubmit={(event) => {
            if (!window.confirm('Excluir esta compra? Esta ação não pode ser desfeita.')) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={purchase.id} />
          <Button type="submit" variant="destructive" size="sm">
            Excluir
          </Button>
        </form>
      )}
    </div>
  );
}
