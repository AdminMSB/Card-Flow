/** Formata um valor em centavos (inteiro) como moeda BRL, ex.: 12345 -> "R$ 123,45". */
export function formatCurrencyCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Converte um valor em reais digitado pelo usuário (aceita "," ou ".") para centavos. */
export function parseCurrencyToCents(value: string): number {
  const normalized = value.trim().replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3},)/g, '');
  const withDot = normalized.replace(',', '.');
  const parsed = Number.parseFloat(withDot);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/** Formata uma data ISO (yyyy-mm-dd ou timestamptz) para dd/mm/aaaa. */
export function formatDate(iso: string): string {
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return date.toLocaleDateString('pt-BR');
}

/** Formata uma data ISO para dd/mm/aaaa HH:mm. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Nome do mês/ano a partir de uma data (primeiro dia do mês), ex.: "Julho de 2026". */
export function formatMonthYear(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
