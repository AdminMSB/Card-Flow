type ClassValue = string | number | null | false | undefined | ClassValue[];

function flatten(value: ClassValue, out: string[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out);
    return;
  }
  out.push(String(value));
}

/** Combina classes condicionalmente, ex.: cn('btn', isActive && 'btn-active'). */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  flatten(values, out);
  return out.join(' ');
}
