import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conciliação de Cartão Corporativo',
  description: 'Registro de compras, aprovação, importação de fatura e conciliação do cartão corporativo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
