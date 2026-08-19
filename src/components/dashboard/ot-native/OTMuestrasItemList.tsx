"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  /** Identificación libre */
  identificacion: string
  procedencia: string
  cantera: string
  cantidad_kg: string
  ensayos: EnsayoRow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convierte la lista plana de OTItem en tarjetas agrupadas por código de muestra */
export function itemsToCards(items: OTItem[]): OTMuestraCard[] {
  if (!items || items.length === 0) return [newEmptyCard()]
  const grouped: Record<string, OTItem[]> = {}
  for (const it of items) {
    const key = it.codigo_muestra?.trim() || `MUESTRA-${it.item}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(it)
  }
  return Object.entries(grouped).map(([codigo, its]) => ({
    codigo_muestra: codigo,
    identificacion: "",
    procedencia: "",
    cantera: "",
    cantidad_kg: "",
    ensayos: its.map((it) => ({
      codigo: it.codigo_ensayo?.trim() || "",
      descripcion: it.descripcion?.trim() || "",
      norma: it.norma?.trim() || "",
      cantidad: it.cantidad ?? 1,
    })),
  }))
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
        cantidad: Number(ensayo.cantidad) || 1,
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
    identificacion: "",
    procedencia: "",
    cantera: "",
    cantidad_kg: "",
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
        className="w-full py-6 border-2 border-dashed border-sky-400/50 hover:border-sky-500 hover:bg-sky-50/50 text-sky-700 font-black text-xs uppercase tracking-widest gap-2 rounded-2xl shadow-sm transition-all"
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
    next[aIdx] = { codigo: item.codigo, descripcion: item.descripcion, norma: item.norma || "-", cantidad: next[aIdx].cantidad || 1 }
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
              placeholder="ej. 3386-SU-26"
              value={card.codigo_muestra}
              onChange={(e) => onUpdateCard({ codigo_muestra: e.target.value })}
              className="h-8 w-40 font-mono font-bold text-xs uppercase bg-background"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onClone} className="h-8 px-2.5 text-xs font-bold gap-1.5 hover:text-sky-600 hover:border-sky-400/40" title="Clonar">
            <Copy className="h-3.5 w-3.5" /><span>Clonar</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Eliminar">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* BODY */}
      <div className="p-5 space-y-5 overflow-visible">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { num: 1, label: "MUESTRA", field: "identificacion" as const, placeholder: "Identificación" },
            { num: 2, label: "PROCEDENCIA", field: "procedencia" as const, placeholder: "Procedencia" },
            { num: 3, label: "CANTERA", field: "cantera" as const, placeholder: "Cantera / Fuente" },
            { num: 4, label: "CANTIDAD (KG)", field: "cantidad_kg" as const, placeholder: "---" },
          ].map(({ num, label, field, placeholder }) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                <span className="text-sky-600 font-bold">{num}.</span> {label}:
              </Label>
              <Input
                placeholder={placeholder}
                value={(card as any)[field]}
                onChange={(e) => onUpdateCard({ [field]: e.target.value })}
                className="font-bold text-xs uppercase bg-background"
              />
            </div>
          ))}
        </div>

        {/* Ensayos */}
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
              className="h-7 text-[10px] font-black uppercase tracking-wider gap-1 border-sky-400/40 text-sky-700 hover:bg-sky-50">
              <Plus className="h-3.5 w-3.5" /> Agregar Ensayo
            </Button>
          </div>
          <div className="border rounded-lg overflow-visible bg-background relative">
            <table className="w-full text-left border-collapse overflow-visible">
              <thead>
                <tr className="bg-muted/50 border-b text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 w-36">Cód. Ensayo</th>
                  <th className="px-3 py-2">Ensayos requeridos (Descripción)</th>
                  <th className="px-3 py-2 w-44">Norma</th>
                  <th className="px-3 py-2 w-16 text-center">Cant.</th>
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

// ─── Fila de ensayo con autocomplete ─────────────────────────────────────────

interface AssayRowProps {
  assay: EnsayoRow
  totalAssays: number
  rowIndex: number
  onChange: (field: keyof EnsayoRow, val: string | number) => void
  onSelectSuggestion: (item: EnsayoItem) => void
  onRemove: () => void
}

function AssayRow({ assay, totalAssays, rowIndex, onChange, onSelectSuggestion, onRemove }: AssayRowProps) {
  const [codigoQuery, setCodigoQuery] = useState(assay.codigo || "")
  const [codigoSuggestions, setCodigoSuggestions] = useState<EnsayoItem[]>([])
  const [isCodigoOpen, setIsCodigoOpen] = useState(false)
  const codigoRef = useRef<HTMLDivElement>(null)
  const [descQuery, setDescQuery] = useState(assay.descripcion || "")
  const [descSuggestions, setDescSuggestions] = useState<EnsayoItem[]>([])
  const [isDescOpen, setIsDescOpen] = useState(false)
  const descRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setCodigoQuery(assay.codigo || "") }, [assay.codigo])
  useEffect(() => { setDescQuery(assay.descripcion || "") }, [assay.descripcion])
  useEffect(() => {
    const handleOut = (e: MouseEvent) => {
      if (codigoRef.current && !codigoRef.current.contains(e.target as Node)) setIsCodigoOpen(false)
      if (descRef.current && !descRef.current.contains(e.target as Node)) setIsDescOpen(false)
    }
    document.addEventListener("mousedown", handleOut)
    return () => document.removeEventListener("mousedown", handleOut)
  }, [])

  const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase(); setCodigoQuery(val); onChange("codigo", val)
    const exact = getEnsayoByCodigo(val)
    if (exact) { onSelectSuggestion(exact); setCodigoSuggestions([]); setIsCodigoOpen(false); return }
    if (val.trim().length >= 1) { const r = searchEnsayos(val); setCodigoSuggestions(r.slice(0, 10)); setIsCodigoOpen(r.length > 0) }
    else { setCodigoSuggestions([]); setIsCodigoOpen(false) }
  }
  const handleDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase(); setDescQuery(val); onChange("descripcion", val)
    if (val.trim().length >= 1) { const r = searchEnsayos(val); setDescSuggestions(r.slice(0, 10)); setIsDescOpen(r.length > 0) }
    else { setDescSuggestions([]); setIsDescOpen(false) }
  }
  const selectFromCodigo = (item: EnsayoItem) => { setCodigoQuery(item.codigo); setDescQuery(item.descripcion); onSelectSuggestion(item); setCodigoSuggestions([]); setIsCodigoOpen(false) }
  const selectFromDesc = (item: EnsayoItem) => { setCodigoQuery(item.codigo); setDescQuery(item.descripcion); onSelectSuggestion(item); setDescSuggestions([]); setIsDescOpen(false) }

  const rowZIndex = Math.max(1, (totalAssays - rowIndex) * 10)

  const SuggestionMenu = ({ items, onSelect }: { items: EnsayoItem[]; onSelect: (i: EnsayoItem) => void }) => (
    <div className="absolute left-0 top-full mt-1 w-80 max-h-60 overflow-y-auto bg-popover text-popover-foreground border-2 border-sky-300/50 rounded-xl shadow-2xl z-[9999] p-1.5 divide-y divide-border/40">
      {items.map((item) => (
        <button key={item.codigo} type="button" onClick={() => onSelect(item)}
          className="w-full text-left px-3 py-2 text-xs hover:bg-sky-50 hover:text-sky-700 rounded-lg transition-colors flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="font-mono font-black text-sky-600 text-[11px]">{item.codigo}</span>
            <span className="text-[10px] text-muted-foreground font-semibold">{item.categoria}</span>
          </div>
          <span className="font-medium text-[11px] line-clamp-1 text-foreground">{item.descripcion}</span>
          <span className="text-[9px] text-muted-foreground font-mono">Norma: {item.norma || "-"}</span>
        </button>
      ))}
    </div>
  )

  return (
    <tr className="hover:bg-muted/20 transition-colors relative" style={{ zIndex: isCodigoOpen || isDescOpen ? 999 : rowZIndex }}>
      <td className="px-3 py-2 align-top relative">
        <div ref={codigoRef} className="relative">
          <Input value={codigoQuery} onChange={handleCodigoChange}
            onFocus={() => { if (codigoQuery.trim().length >= 1) { const r = searchEnsayos(codigoQuery); setCodigoSuggestions(r.slice(0, 10)); setIsCodigoOpen(r.length > 0) } }}
            placeholder="ej. SU24" className="h-8 font-mono font-bold text-xs uppercase bg-background text-sky-700" autoComplete="off" data-lpignore="true" />
          {isCodigoOpen && codigoSuggestions.length > 0 && <SuggestionMenu items={codigoSuggestions} onSelect={selectFromCodigo} />}
        </div>
      </td>
      <td className="px-3 py-2 align-top relative">
        <div ref={descRef} className="relative">
          <Input value={descQuery} onChange={handleDescChange}
            onFocus={() => { if (descQuery.trim().length >= 1) { const r = searchEnsayos(descQuery); setDescSuggestions(r.slice(0, 10)); setIsDescOpen(r.length > 0) } }}
            placeholder="Descripción del ensayo" className="h-8 text-xs font-semibold uppercase bg-background" autoComplete="off" data-lpignore="true" />
          {isDescOpen && descSuggestions.length > 0 && <SuggestionMenu items={descSuggestions} onSelect={selectFromDesc} />}
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <Input value={assay.norma || ""} onChange={(e) => onChange("norma", e.target.value.toUpperCase())}
          placeholder="ej. NTP 400.016" className="h-8 font-mono text-xs uppercase bg-background" />
      </td>
      <td className="px-3 py-2 align-top">
        <Input type="number" value={assay.cantidad ?? 1} min={1} onChange={(e) => onChange("cantidad", e.target.value)}
          className="h-8 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      </td>
      <td className="px-2 py-2 text-center align-middle">
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Eliminar">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  )
}
