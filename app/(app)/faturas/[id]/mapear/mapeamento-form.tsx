'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { PartialColumnMapping } from '@/lib/parsers';
import { confirmMapping } from './actions';

interface MapeamentoFormProps {
  invoiceId: string;
  headers: string[];
  detected: PartialColumnMapping;
}

export function MapeamentoForm({ invoiceId, headers, detected }: MapeamentoFormProps) {
  const [dateColumn, setDateColumn] = useState(detected.date ?? '');
  const [amountColumn, setAmountColumn] = useState(detected.amount ?? '');
  const [descriptionColumn, setDescriptionColumn] = useState(detected.description ?? '');

  const chosen = [dateColumn, amountColumn, descriptionColumn].filter(Boolean);
  const hasDuplicate = chosen.length > 1 && new Set(chosen).size !== chosen.length;

  return (
    <form action={confirmMapping} className="flex flex-col gap-4">
      <input type="hidden" name="invoice_id" value={invoiceId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="date_column">Coluna de data</Label>
          <Select
            id="date_column"
            name="date_column"
            required
            value={dateColumn}
            onChange={(event) => setDateColumn(event.target.value)}
          >
            <option value="" disabled>
              Selecione
            </option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="amount_column">Coluna de valor</Label>
          <Select
            id="amount_column"
            name="amount_column"
            required
            value={amountColumn}
            onChange={(event) => setAmountColumn(event.target.value)}
          >
            <option value="" disabled>
              Selecione
            </option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="description_column">Coluna de descrição / estabelecimento</Label>
          <Select
            id="description_column"
            name="description_column"
            required
            value={descriptionColumn}
            onChange={(event) => setDescriptionColumn(event.target.value)}
          >
            <option value="" disabled>
              Selecione
            </option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {hasDuplicate && (
        <p className="text-sm text-warning">
          Você selecionou a mesma coluna para mais de um campo — confirme se é intencional antes de continuar.
        </p>
      )}

      <div>
        <Button type="submit">Confirmar mapeamento</Button>
      </div>
    </form>
  );
}
