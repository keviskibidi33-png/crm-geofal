import { useEffect, useCallback, useState } from "react"
import { UseFormReturn, FieldValues, DefaultValues } from "react-hook-form"

const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== ""

const hasCompressionItemData = (item: any): boolean => {
  if (!item || typeof item !== "object") return false

  const codigoLem = String(item.codigo_lem || "").trim().toUpperCase()
  const codigoEsPlaceholder =
    codigoLem === "" ||
    codigoLem === "-" ||
    /^X{2,}(?:-CO(?:-\d{2})?)?$/.test(codigoLem)
  const tieneCodigoUtil = !codigoEsPlaceholder

  const stringFields = [
    "fecha_ensayo_programado",
    "fecha_ensayo",
    "hora_ensayo",
    "tipo_fractura",
    "defectos",
    "defectos_custom",
    "realizado",
    "revisado",
    "fecha_revisado",
    "aprobado",
    "fecha_aprobado",
  ]

  if (
    tieneCodigoUtil ||
    stringFields.some((field) => hasNonEmptyString(item[field]))
  )
    return true

  const numericFields = ["carga_maxima", "diametro", "area"]
  return numericFields.some(
    (field) =>
      item[field] !== undefined &&
      item[field] !== null &&
      String(item[field]).trim() !== ""
  )
}

const sanitizeCompressionItems = (items: any[]): any[] => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  const meaningful = safeItems.filter(hasCompressionItemData)

  if (meaningful.length === 0) {
    return [{ item: 1, codigo_lem: "" }]
  }

  return meaningful.map((item, index) => {
    const parsedItem = Number(item?.item ?? item?.item_numero)
    const normalizedItem =
      Number.isFinite(parsedItem) && parsedItem > 0 ? parsedItem : index + 1
    return {
      ...item,
      item: normalizedItem,
    }
  })
}

export function useFormPersistCompression<T extends FieldValues>(
  formKey: string,
  formMethods: UseFormReturn<T>,
  enabled: boolean = true
) {
  const { watch, reset } = formMethods
  const values = watch()
  const [hasSavedData, setHasSavedData] = useState(false)

  // Initial load
  useEffect(() => {
    if (!enabled) return

    const savedData = localStorage.getItem(formKey)
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        if (Array.isArray(parsed?.items)) {
          parsed.items = sanitizeCompressionItems(parsed.items)
        }
        setHasSavedData(true)
        reset(parsed as DefaultValues<T>)
      } catch (e) {
        console.error("Error loading saved form data:", e)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, enabled])

  // Save on change (debounced)
  useEffect(() => {
    if (!enabled) return

    const timeoutId = setTimeout(() => {
      const toSave: any = { ...values }
      if (Array.isArray(toSave.items)) {
        toSave.items = sanitizeCompressionItems(toSave.items)
      }
      localStorage.setItem(formKey, JSON.stringify(toSave))
      setHasSavedData(true)
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [values, formKey, enabled])

  const clearSavedData = useCallback(() => {
    localStorage.removeItem(formKey)
    setHasSavedData(false)
  }, [formKey])

  return {
    clearSavedData,
    hasSavedData,
  }
}
