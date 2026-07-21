'use client';

import { CompraForm, type CardOption, type OptionRow, type PurchaseDefaults } from './compra-form';
import { deletePurchase } from './actions';
import { Button } from '@/components/ui/button';

interface PurchaseRowActionsProps {
  purchase: PurchaseDefaults;
  costCenters: OptionRow[];
  cards: CardOption[];
}

/** Ações "Editar" / "Excluir" exibidas na linha de uma compra própria ainda pendente. */
export function PurchaseRowActions({ purchase, costCenters, cards }: PurchaseRowActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <CompraForm
        mode="edit"
        purchase={purchase}
        costCenters={costCenters}
        cards={cards}
        triggerLabel="Editar"
        triggerVariant="secondary"
      />
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
    </div>
  );
}
