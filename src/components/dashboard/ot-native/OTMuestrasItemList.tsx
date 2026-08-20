"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Copy, Sparkles, Layers } from "lucide-react"
import { searchEnsayos, getEnsayoByCodigo, type EnsayoItem } from "@/data/ensayos-data"
import type { OTItem } from "./OTForm"

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface EnsayoRow {
  codigo: string
  descripcion: string
  norma: string
  cantidad: number | string
}

export interface OTMuestraCard {
  /** Código LEM de la muestra (p.e. 3386-SU-26) */
  codigo_muestra: string
  ensayos: EnsayoRow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convierte la lista plana de OTItem en tarjetas agrupadas por código de muestra */
export function itemsToCards(items: OTItem[]): OTMuestraCard[] {
  if (!items || items.length === 0) return [newEmptyCard()]
  const grouped: Record<string, { firstItem: OTItem; items: OTItem[] }> = {}
  for (const it of items) {
    const key = it.codigo_muestra?.trim() || `MUESTRA-${it.item}`
    if (!grouped[key]) {
      grouped[key] = { firstItem: it, items: [] }
    }
    grouped[key].items.push(it)
  }
  return Object.entries(grouped).map(([codigo, { firstItem, items: its }]) => {
    return {
      codigo_muestra: codigo.startsWith("MUESTRA-") ? (firstItem.codigo_muestra || "") : codigo,
      ensayos: its.map((it) => ({
        codigo: it.codigo_ensayo?.trim() || "",
        descripcion: it.descripcion?.trim() || "",
        norma: it.norma?.trim() || "",
        cantidad: 1,
      })),
    }
  })
}

/** Convierte las tarjetas de vuelta a la lista plana de OTItem */
export function cardsToItems(cards: OTMuestraCard[]): OTItem[] {
  const items: OTItem[] = []
  let counter = 1
  for (const card of cards) {
    for (const ensayo of card.ensayos) {
      items.push({
        item: counter++,
        codigo_muestra: card.codigo_muestra.trim(),
        codigo_ensayo: ensayo.codigo.trim() || null,
        descripcion: ensayo.descripcion.trim(),
        norma: ensayo.norma.trim() || null,
        cantidad: 1,
        identificacion: null,
        procedencia: null,
        cantera: null,
        cantidad_kg: null,
        elemento: null,
        fecha_rotura: null,
        densidad: null,
        edad: null,
        fc_kg_cm2: null,
      })
    }
  }
  return items
}

function newEmptyCard(): OTMuestraCard {
  return {
    codigo_muestra: "",
    ensayos: [{ codigo: "", descripcion: "", norma: "", cantidad: 1 }],
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface OTMuestrasItemListProps {
  cards: OTMuestraCard[]
  onChange: (cards: OTMuestraCard[]) => void
  markDirty: () => void
}

export function OTMuestrasItemList({ cards, onChange, markDirty }: OTMuestrasItemListProps) {
  const updateCard = (idx: number, patch: Partial<OTMuestraCard>) => {
    const next = [...cards]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
    markDirty()
  }

  const cloneCard = (idx: number) => {
    const next = [...cards]
    next.splice(idx + 1, 0, JSON.parse(JSON.stringify(cards[idx])))
    onChange(next)
    markDirty()
  }

  const removeCard = (idx: number) => {
    if (cards.length <= 1) { onChange([newEmptyCard()]); markDirty(); return }
    onChange(cards.filter((_, i) => i !== idx))
    markDirty()
  }

  const addCard = () => { onChange([...cards, newEmptyCard()]); markDirty() }

  return (
    <div className="space-y-5 overflow-visible">
      {cards.map((card, cIdx) => (
        <MuestraCard
          key={cIdx}
          card={card}
          index={cIdx}
          onUpdateCard={(patch) => updateCard(cIdx, patch)}
          onUpdateEnsayos={(ensayos) => updateCard(cIdx, { ensayos })}
          onClone={() => cloneCard(cIdx)}
          onRemove={() => removeCard(cIdx)}
          markDirty={markDirty}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addCard}
        className="w-full py-5 border-2 border-dashed border-sky-400/50 hover:border-sky-500 hover:bg-sky-50/50 text-sky-700 font-black text-xs uppercase tracking-widest gap-2 rounded-2xl shadow-sm transition-all cursor-pointer"
      >
        <Plus className="h-5 w-5 stroke-[2.5]" />
        Agregar Otra Muestra (Muestra N° {cards.length + 1})
      </Button>
    </div>
  )
}

// ─── Tarjeta de muestra ───────────────────────────────────────────────────────

interface MuestraCardProps {
  card: OTMuestraCard
  index: number
  onUpdateCard: (patch: Partial<OTMuestraCard>) => void
  onUpdateEnsayos: (ensayos: EnsayoRow[]) => void
  onClone: () => void
  onRemove: () => void
  markDirty: () => void
}

function MuestraCard({ card, index, onUpdateCard, onUpdateEnsayos, onClone, onRemove, markDirty }: MuestraCardProps) {
  const addEnsayo = () => { onUpdateEnsayos([...card.ensayos, { codigo: "", descripcion: "", norma: "", cantidad: 1 }]); markDirty() }
  const removeEnsayo = (aIdx: number) => {
    if (card.ensayos.length <= 1) { onUpdateEnsayos([{ codigo: "", descripcion: "", norma: "", cantidad: 1 }]); return }
    onUpdateEnsayos(card.ensayos.filter((_, i) => i !== aIdx)); markDirty()
  }
  const changeEnsayo = (aIdx: number, field: keyof EnsayoRow, val: string | number) => {
    const next = [...card.ensayos]; next[aIdx] = { ...next[aIdx], [field]: val }; onUpdateEnsayos(next); markDirty()
  }
  const selectSuggestion = (aIdx: number, item: EnsayoItem) => {
    const next = [...card.ensayos]
    next[aIdx] = { codigo: item.codigo, descripcion: item.descripcion, norma: item.norma || "-", cantidad: 1 }
    onUpdateEnsayos(next); markDirty()
  }

  return (
    <div className="rounded-2xl border-2 border-border/80 bg-card overflow-visible shadow-sm hover:shadow-md transition-all relative" style={{ zIndex: Math.max(1, 40 - index) }}>
      {/* HEADER */}
      <div className="bg-muted/40 px-5 py-3.5 border-b rounded-t-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge className="px-3 py-1 text-xs font-black tracking-wider uppercase bg-sky-600 text-white shadow-sm">
            <Layers className="h-3.5 w-3.5 mr-1.5" />MUESTRA N° {index + 1}
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Código LEM:</span>
            <Input
              placeholder="-"
              value={card.codigo_muestra}
              onChange={(e) => onUpdateCard({ codigo_muestra: e.target.value })}
              className="h-8 w-44 font-mono font-bold text-xs uppercase bg-background"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onClone} className="h-8 px-2.5 text-xs font-bold gap-1.5 hover:text-sky-600 hover:border-sky-400/40 cursor-pointer" title="Clonar">
            <Copy className="h-3.5 w-3.5" /><span>Clonar</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer" title="Eliminar">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* BODY (Solo Ensayos requeridos con cantidad fija 1) */}
      <div className="p-5 overflow-visible">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 overflow-visible relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-600 animate-pulse" />
              <h5 className="text-[11px] font-black uppercase tracking-wider text-foreground/90">
                Ensayos Requeridos para Muestra #{index + 1}
              </h5>
              <span className="text-[10px] font-medium text-muted-foreground hidden sm:inline">(Autocompletado al escribir código o descripción)</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addEnsayo}
              className="h-7 text-[10px] font-black uppercase tracking-wider gap-1 border-sky-400/40 text-sky-700 hover:bg-sky-50 cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> Agregar Ensayo
            </Button>
          </div>
          <div className="border rounded-lg overflow-visible bg-background relative">
            <table className="w-full text-left border-collapse overflow-visible">
              <thead>
                <tr className="bg-muted/50 border-b text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 w-36">Cód. Ensayo</th>
                  <th className="px-3 py-2">Ensayos requeridos (Descripción)</th>
                  <th className="px-3 py-2 w-48">Norma</th>
                  <th className="px-2 py-2 w-12 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 overflow-visible">
                {card.ensayos.map((ensayo, aIdx) => (
                  <AssayRow
                    key={aIdx}
                    assay={ensayo}
                    totalAssays={card.ensayos.length}
                    rowIndex={aIdx}
                    onChange={(field, val) => changeEnsayo(aIdx, field, val)}
                    onSelectSuggestion={(item) => selectSuggestion(aIdx, item)}
                    onRemove={() => removeEnsayo(aIdx)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Menú flotante de sugerencias de ensayos ─────────────────────────────────

interface SuggestionMenuProps {
  items: EnsayoItem[]
  onSelect: (item: EnsayoItem) => void
}

function SuggestionMenu({ items, onSelect }: SuggestionMenuProps) {
  return (
    <div className="absolute left-0 top-full mt-1 w-full bg-popover text-popover-foreground border-2 border-sky-500/40 rounded-xl shadow-2xl z-[9999] max-h-56 overflow-y-auto py-1 divide-y divide-border/40">
      {items.map((item) => (
        <button
          key={item.codigo}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(item)
          }}
          className="w-full text-left px-3 py-2 hover:bg-sky-50 hover:text-sky-900 transition-colors flex items-center justify-between gap-2"
        >
          <div className="flex-1 min-w-0">
            <span className="font-mono font-bold text-xs text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded mr-2">
              {item.codigo}
            </span>
            <span className="text-xs font-semibold text-foreground">{item.descripcion}</span>
          </div>
          {item.norma && (
            <span className="text-[10px] font-mono text-muted-foreground shrink-0 max-w-[140px] truncate">
              {item.norma}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Fila individual de ensayo con Autocompletado inteligente ─────────────────

interface AssayRowProps {
  assay: EnsayoRow
  totalAssays: number
  rowIndex: number
  onChange: (field: keyof EnsayoRow, val: string | number) => void
  onSelectSuggestion: (item: EnsayoItem) => void
  onRemove: () => void
}

function AssayRow({ assay, totalAssays, rowIndex, onChange, onSelectSuggestion, onRemove }: AssayRowProps) {
  const [suggestions, setSuggestions] = useState<EnsayoItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusedField, setFocusedField] = useState<"codigo" | "descripcion" | null>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleCodigoChange = (val: string) => {
    onChange("codigo", val)
    if (val.trim().length >= 1) {
      const results = searchEnsayos(val)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleCodigoBlur = () => {
    const exact = getEnsayoByCodigo(assay.codigo)
    if (exact && !assay.descripcion) {
      onSelectSuggestion(exact)
    }
    setTimeout(() => {
      if (focusedField === "codigo") setShowSuggestions(false)
    }, 200)
  }

  const handleDescChange = (val: string) => {
    onChange("descripcion", val)
    if (val.trim().length >= 2) {
      const results = searchEnsayos(val)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleDescBlur = () => {
    setTimeout(() => {
      if (focusedField === "descripcion") setShowSuggestions(false)
    }, 200)
  }

  return (
    <tr ref={rowRef} className="hover:bg-muted/30 transition-colors group relative" style={{ zIndex: Math.max(1, 30 - rowIndex) }}>
      {/* Código de Ensayo con autocomplete */}
      <td className="px-3 py-2 align-middle relative overflow-visible">
        <Input
          placeholder="Ej: SU24"
          value={assay.codigo}
          onChange={(e) => handleCodigoChange(e.target.value)}
          onFocus={() => {
            setFocusedField("codigo")
            if (assay.codigo.trim().length >= 1) {
              const res = searchEnsayos(assay.codigo)
              setSuggestions(res)
              setShowSuggestions(res.length > 0)
            }
          }}
          onBlur={handleCodigoBlur}
          className="h-8 font-mono font-bold text-xs uppercase bg-background"
          autoComplete="off"
        />
        {showSuggestions && focusedField === "codigo" && suggestions.length > 0 && (
          <SuggestionMenu
            items={suggestions}
            onSelect={(item) => {
              onSelectSuggestion(item)
              setShowSuggestions(false)
            }}
          />
        )}
      </td>

      {/* Descripción del Ensayo con autocomplete */}
      <td className="px-3 py-2 align-middle relative overflow-visible">
        <Input
          placeholder="Descripción del ensayo..."
          value={assay.descripcion}
          onChange={(e) => handleDescChange(e.target.value)}
          onFocus={() => {
            setFocusedField("descripcion")
            if (assay.descripcion.trim().length >= 2) {
              const res = searchEnsayos(assay.descripcion)
              setSuggestions(res)
              setShowSuggestions(res.length > 0)
            }
          }}
          onBlur={handleDescBlur}
          className="h-8 font-semibold text-xs bg-background"
          autoComplete="off"
        />
        {showSuggestions && focusedField === "descripcion" && suggestions.length > 0 && (
          <SuggestionMenu
            items={suggestions}
            onSelect={(item) => {
              onSelectSuggestion(item)
              setShowSuggestions(false)
            }}
          />
        )}
      </td>

      {/* Norma */}
      <td className="px-3 py-2 align-middle">
        <Input
          placeholder="-"
          value={assay.norma}
          onChange={(e) => onChange("norma", e.target.value)}
          className="h-8 font-mono text-xs bg-background"
          autoComplete="off"
        />
      </td>

      {/* Botón eliminar */}
      <td className="px-2 py-2 text-center align-middle">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={totalAssays <= 1}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 cursor-pointer"
          title="Eliminar ensayo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  )
}
