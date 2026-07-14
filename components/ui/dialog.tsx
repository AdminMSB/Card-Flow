'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/** Modal simples baseado no elemento nativo <dialog> — foco/ESC/backdrop já vêm de graça do browser. */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={cn(
        'w-full max-w-lg rounded-lg border border-border bg-card p-0 text-card-foreground backdrop:bg-black/50',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
