'use client';

import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createPurchase, updatePurchase } from './actions';

export interface OptionRow {
  id: string;
  name: string;
}

export interface CardOption {
  id: string;
  last_four_digits: string;
}

export interface PurchaseDefaults {
  id: string;
  card_id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string;
  category_id: string | null;
  cost_center_id: string | null;
  description: string | null;
  requisition_number: string | null;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  invoice_document_number: string | null;
  purchase_order_code: string | null;
}

interface CompraFormProps {
  mode: 'create' | 'edit';
  purchase?: PurchaseDefaults;
  categories: OptionRow[];
  costCenters: OptionRow[];
  cards: CardOption[];
  triggerLabel?: string;
  triggerVariant?: ButtonProps['variant'];
}

/** Formulário de compra (criação e edição) exibido dentro de um Dialog. */
export function CompraForm({
  mode,
  purchase,
  categories,
  costCenters,
  cards,
  triggerLabel,
  triggerVariant,
}: CompraFormProps) {
  const [open, setOpen] = useState(false);
  const action = mode === 'edit' ? updatePurchase : createPurchase;
  const title = mode === 'edit' ? 'Editar compra' : 'Nova compra';
  const defaultAmount = purchase ? (purchase.amount_cents / 100).toFixed(2).replace('.', ',') : '';

  return (
    <>
      <Button type="button" variant={triggerVariant ?? 'primary'} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === 'edit' ? 'Editar' : 'Nova compra')}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {/* Fecha o modal imediatamente ao enviar; a Server Action revalida/redireciona a página por trás dele. */}
        <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          {mode === 'edit' && purchase ? <input type="hidden" name="id" value={purchase.id} /> : null}

          <div>
            <Label htmlFor={`cardId-${mode}`}>Cartão</Label>
            <Select
              id={`cardId-${mode}`}
              name="cardId"
              defaultValue={purchase?.card_id ?? cards[0]?.id ?? ''}
              required
            >
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  Final {card.last_four_digits}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`purchaseDate-${mode}`}>Data</Label>
              <Input
                id={`purchaseDate-${mode}`}
                name="purchaseDate"
                type="date"
                defaultValue={purchase?.purchase_date.slice(0, 10) ?? ''}
                required
              />
            </div>
            <div>
              <Label htmlFor={`amount-${mode}`}>Valor</Label>
              <Input
                id={`amount-${mode}`}
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={defaultAmount}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`merchantName-${mode}`}>Estabelecimento / Site</Label>
            <Input
              id={`merchantName-${mode}`}
              name="merchantName"
              type="text"
              placeholder="Ex.: Mercado Livre"
              defaultValue={purchase?.merchant_name ?? ''}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Como aparece na fatura do cartão (loja/marketplace) — usado para conciliar com a fatura.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`requisitionNumber-${mode}`}>Nº da requisição</Label>
              <Input
                id={`requisitionNumber-${mode}`}
                name="requisitionNumber"
                type="text"
                defaultValue={purchase?.requisition_number ?? ''}
              />
            </div>
            <div>
              <Label htmlFor={`purchaseOrderCode-${mode}`}>Código de OC</Label>
              <Input
                id={`purchaseOrderCode-${mode}`}
                name="purchaseOrderCode"
                type="text"
                placeholder="Ex.: OC012743"
                defaultValue={purchase?.purchase_order_code ?? ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`supplierName-${mode}`}>Fornecedor</Label>
              <Input
                id={`supplierName-${mode}`}
                name="supplierName"
                type="text"
                defaultValue={purchase?.supplier_name ?? ''}
              />
            </div>
            <div>
              <Label htmlFor={`supplierCnpj-${mode}`}>CNPJ do fornecedor</Label>
              <Input
                id={`supplierCnpj-${mode}`}
                name="supplierCnpj"
                type="text"
                placeholder="00.000.000/0000-00"
                defaultValue={purchase?.supplier_cnpj ?? ''}
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`invoiceDocumentNumber-${mode}`}>Nº da NF / fatura / boleto</Label>
            <Input
              id={`invoiceDocumentNumber-${mode}`}
              name="invoiceDocumentNumber"
              type="text"
              defaultValue={purchase?.invoice_document_number ?? ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`categoryId-${mode}`}>Categoria</Label>
              <Select id={`categoryId-${mode}`} name="categoryId" defaultValue={purchase?.category_id ?? ''}>
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`costCenterId-${mode}`}>Centro de custo</Label>
              <Select id={`costCenterId-${mode}`} name="costCenterId" defaultValue={purchase?.cost_center_id ?? ''}>
                <option value="">Sem centro de custo</option>
                {costCenters.map((costCenter) => (
                  <option key={costCenter.id} value={costCenter.id}>
                    {costCenter.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor={`description-${mode}`}>Descrição</Label>
            <Textarea id={`description-${mode}`} name="description" defaultValue={purchase?.description ?? ''} rows={3} />
          </div>

          <div>
            <Label htmlFor={`receipt-${mode}`}>Comprovante</Label>
            <Input id={`receipt-${mode}`} name="receipt" type="file" accept="image/*,application/pdf" />
            <p className="mt-1 text-xs text-muted-foreground">
              Imagem ou PDF, até 10MB.
              {mode === 'edit' ? ' Envie um novo arquivo para substituir o comprovante atual.' : ''}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{mode === 'edit' ? 'Salvar alterações' : 'Registrar compra'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
