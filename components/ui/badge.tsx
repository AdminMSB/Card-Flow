import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'destructive' | 'info';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  info: 'bg-primary/15 text-primary',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
