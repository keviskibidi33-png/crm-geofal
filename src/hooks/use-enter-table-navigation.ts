import { useCallback, type KeyboardEvent } from "react";

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useEnterTableNavigation() {
  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter") return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    event.preventDefault();

    const table = target.closest("table");
    if (!table) return;

    const focusableFields = Array.from(
      table.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") && element.offsetParent !== null
    );

    const currentIndex = focusableFields.indexOf(target);
    if (currentIndex < 0 || currentIndex >= focusableFields.length - 1) return;

    const nextField = focusableFields[currentIndex + 1];
    nextField.focus();

    if (nextField instanceof HTMLInputElement) {
      nextField.select();
    }
  }, []);
}
