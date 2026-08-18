import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número de OT para mostrar visualmente el prefijo "OT-".
 * NO modifica el valor almacenado ni el que se envía al backend/Excel.
 *
 * Reglas:
 *  - Si el valor ya contiene "OT" (case-insensitive) → se muestra tal cual.
 *  - Si no tiene "OT" → se antepone "OT-" para visualización.
 *  - Vacío o "-" → se devuelve "-".
 */
export function formatOtDisplay(value: string | null | undefined): string {
  if (!value || value.trim() === '' || value.trim() === '-') return '-'
  const trimmed = value.trim()
  if (/^OT[-\s]/i.test(trimmed)) return trimmed
  return `OT-${trimmed}`
}

export function formatLocalDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  
  // Extraer la parte YYYY-MM-DD
  const datePart = dateStr.split("T")[0];
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  
  // Fallback si viene en un formato no convencional
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-PE");
}
