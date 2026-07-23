'use client';

import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { parseCurrencyToCents } from '@/lib/format';
import { createPurchase, updatePurchase } from './actions';

export interface OptionRow {
  id: string;
  name: string;
}

export interface CardOption {
  id: string;
  last_four_digits: string;
}

export interface CollaboratorOption {
  id: string;
  full_name: string;
  department_id: string | null;
}

export interface OrderCodeItem {
  code: string;
  amountCents: number | null;
}

export interface DocumentItem {
  documentNumber: string;
  amountCents: number | null;
}

export interface PurchaseDefaults {
  id: string;
  card_id: string;
  purchase_date: string;
  amount_cents: number;
  merchant_name: string;
  department_id: string | null;
  requester_name: string | null;
  description: string | null;
  requisition_number: string | null;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  orderCodes: OrderCodeItem[];
  invoiceDocuments: DocumentItem[];
}

/** Texto de valor (ex.: "12,34") a partir de centavos, no mesmo formato usado pelos
 * campos de valor do formulário — vazio quando não há valor. */
function centsToAmountText(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

interface CompraFormProps {
  mode: 'create' | 'edit';
  purchase?: PurchaseDefaults;
  departments: OptionRow[];
  collaborators: CollaboratorOption[];
  cards: CardOption[];
  triggerLabel?: string;
  triggerVariant?: ButtonProps['variant'];
}

/** Formulário de compra (criação e edição) exibido dentro de um Dialog. */
export function CompraForm({
  mode,
  purchase,
  departments,
  collaborators,
  cards,
  triggerLabel,
  triggerVariant,
}: CompraFormProps) {
  const [open, setOpen] = useState(false);
  const [requesterName, setRequesterName] = useState(purchase?.requester_name ?? '');
  const [departmentId, setDepartmentId] = useState(purchase?.department_id ?? '');
  const [amountText, setAmountText] = useState(centsToAmountText(purchase?.amount_cents ?? null));
  const [orderCodeRows, setOrderCodeRows] = useState(
    purchase && purchase.orderCodes.length > 0
      ? purchase.orderCodes.map((item) => ({ code: item.code, amount: centsToAmountText(item.amountCents) }))
      : [{ code: '', amount: '' }],
  );
  const [documentRows, setDocumentRows] = useState(
    purchase && purchase.invoiceDocuments.length > 0
      ? purchase.invoiceDocuments.map((document) => ({
          number: document.documentNumber,
          amount: centsToAmountText(document.amountCents),
        }))
      : [{ number: '', amount: '' }],
  );
  const action = mode === 'edit' ? updatePurchase : createPurchase;
  const title = mode === 'edit' ? 'Editar compra' : 'Nova compra';
  const datalistId = `collaborators-${mode}-${purchase?.id ?? 'new'}`;

  // Ao digitar/selecionar um nome já cadastrado em Colaboradores, preenche o Centro de
  // Custo dele automaticamente — o usuário ainda pode trocar manualmente depois.
  function handleRequesterNameChange(value: string) {
    setRequesterName(value);
    const match = collaborators.find((collaborator) => collaborator.full_name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setDepartmentId(match.department_id ?? '');
    }
  }

  // O valor da compra é a soma dos documentos anexados, quando algum deles tiver valor
  // informado — senão fica livre pra digitar (ex.: antes de receber a NF).
  const amountLocked = documentRows.some((row) => parseCurrencyToCents(row.amount) > 0);

  function updateDocumentRows(next: { number: string; amount: string }[]) {
    setDocumentRows(next);
    const sumCents = next.reduce((sum, row) => sum + Math.max(parseCurrencyToCents(row.amount), 0), 0);
    if (sumCents > 0) {
      setAmountText(centsToAmountText(sumCents));
    }
  }

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

          <div>
            <Label htmlFor={`requesterName-${mode}`}>Solicitante</Label>
            <Input
              id={`requesterName-${mode}`}
              name="requesterName"
              type="text"
              list={datalistId}
              placeholder="Nome de quem fez a compra"
              value={requesterName}
              onChange={(event) => handleRequesterNameChange(event.target.value)}
              required
            />
            <datalist id={datalistId}>
              {collaborators.map((collaborator) => (
                <option key={collaborator.id} value={collaborator.full_name} />
              ))}
            </datalist>
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
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                readOnly={amountLocked}
                required
              />
              {amountLocked && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculado automaticamente como a soma dos documentos abaixo.
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor={`merchantName-${mode}`}>Site</Label>
            <Input
              id={`merchantName-${mode}`}
              name="merchantName"
              type="text"
              placeholder="Ex.: Mercado Livre (deixe em branco se não foi por um site)"
              defaultValue={purchase?.merchant_name ?? ''}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Plataforma usada na compra, se houver — como aparece na fatura do cartão.
            </p>
          </div>

          <div>
            <Label htmlFor={`supplierName-${mode}`}>Fornecedor</Label>
            <Input
              id={`supplierName-${mode}`}
              name="supplierName"
              type="text"
              placeholder="Ex.: nome da loja/vendedor — nunca é o nome do site"
              defaultValue={purchase?.supplier_name ?? ''}
              required
            />
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
            <Label htmlFor={`departmentId-${mode}`}>Centro de custo</Label>
            <Select
              id={`departmentId-${mode}`}
              name="departmentId"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">Sem centro de custo</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor={`purchaseOrderCode-${mode}-0`}>Código de Lançamento</Label>
            <div className="flex flex-col gap-2">
              {orderCodeRows.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id={`purchaseOrderCode-${mode}-${index}`}
                      name="purchaseOrderCode"
                      type="text"
                      placeholder="Ex.: diário de fatura ou ordem de compra"
                      value={row.code}
                      onChange={(event) =>
                        setOrderCodeRows(
                          orderCodeRows.map((item, i) => (i === index ? { ...item, code: event.target.value } : item)),
                        )
                      }
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <Input
                      name="purchaseOrderCodeAmount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={row.amount}
                      onChange={(event) =>
                        setOrderCodeRows(
                          orderCodeRows.map((item, i) => (i === index ? { ...item, amount: event.target.value } : item)),
                        )
                      }
                    />
                  </div>
                  {orderCodeRows.length > 1 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label="Remover"
                      onClick={() => setOrderCodeRows(orderCodeRows.filter((_, i) => i !== index))}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Valor total da NF (com IPI) — separado do Valor da compra, que segue o que
              aparece na fatura do cartão.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => setOrderCodeRows([...orderCodeRows, { code: '', amount: '' }])}
            >
              + Adicionar lançamento
            </Button>
          </div>

          <div>
            <Label htmlFor={`invoiceDocumentNumber-${mode}-0`}>Nº da NF / fatura / boleto</Label>
            <div className="flex flex-col gap-2">
              {documentRows.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id={`invoiceDocumentNumber-${mode}-${index}`}
                      name="invoiceDocumentNumber"
                      type="text"
                      value={row.number}
                      onChange={(event) =>
                        updateDocumentRows(
                          documentRows.map((item, i) => (i === index ? { ...item, number: event.target.value } : item)),
                        )
                      }
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <Input
                      name="invoiceDocumentAmount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={row.amount}
                      onChange={(event) =>
                        updateDocumentRows(
                          documentRows.map((item, i) => (i === index ? { ...item, amount: event.target.value } : item)),
                        )
                      }
                    />
                  </div>
                  {documentRows.length > 1 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label="Remover"
                      onClick={() => updateDocumentRows(documentRows.filter((_, i) => i !== index))}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => setDocumentRows([...documentRows, { number: '', amount: '' }])}
            >
              + Adicionar documento
            </Button>
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
