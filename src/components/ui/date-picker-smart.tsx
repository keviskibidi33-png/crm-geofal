"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PERU_TZ = "America/Lima"

function getTodayPeru(): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const y = parts.find((p) => p.type === "year")?.value ?? ""
  const m = parts.find((p) => p.type === "month")?.value ?? ""
  const d = parts.find((p) => p.type === "day")?.value ?? ""
  return new Date(Number(y), Number(m) - 1, Number(d))
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day)
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  )
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function normalizeDateInput(rawValue?: string): { display: string; iso: string } | null {
  const trimmed = String(rawValue || "").trim()
  if (!trimmed) return null

  const currentYear = new Date().getFullYear()
  let year: number | null = null
  let month: number | null = null
  let day: number | null = null

  if (trimmed.includes("/")) {
    const parts = trimmed.split("/").map((p) => p.trim()).filter(Boolean)
    if (parts.length === 2) {
      day = Number(parts[0])
      month = Number(parts[1])
      year = currentYear
    } else if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = Number(parts[0])
        month = Number(parts[1])
        day = Number(parts[2])
      } else {
        day = Number(parts[0])
        month = Number(parts[1])
        year = Number(parts[2].length === 2 ? `20${parts[2]}` : parts[2])
      }
    } else {
      return null
    }
  } else {
    const digits = trimmed.replace(/\D/g, "")
    if (digits.length === 2) {
      day = Number(digits.slice(0, 1))
      month = Number(digits.slice(1, 2))
      year = currentYear
    } else if (digits.length === 3) {
      day = Number(digits.slice(0, 1))
      month = Number(digits.slice(1, 3))
      year = currentYear
    } else if (digits.length === 4) {
      month = Number(digits.slice(0, 2))
      day = Number(digits.slice(2, 4))
      year = currentYear
    } else if (digits.length === 6) {
      day = Number(digits.slice(0, 2))
      month = Number(digits.slice(2, 4))
      year = Number(`20${digits.slice(4, 6)}`)
    } else if (digits.length === 8) {
      year = Number(digits.slice(0, 4))
      month = Number(digits.slice(4, 6))
      day = Number(digits.slice(6, 8))
    } else {
      return null
    }
  }

  if (year === null || month === null || day === null) return null
  if (!isValidCalendarDate(year, month, day)) return null

  return {
    display: `${year}/${pad2(month)}/${pad2(day)}`,
    iso: `${year}-${pad2(month)}-${pad2(day)}`,
  }
}

interface DatePickerSmartProps {
  value?: string | null // ISO yyyy-mm-dd
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePickerSmart({
  value,
  onChange,
  placeholder = "yyyy/mm/dd",
  className,
  disabled = false,
}: DatePickerSmartProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const today = React.useMemo(() => getTodayPeru(), [])
  const todayDisplay = `${today.getFullYear()}/${pad2(today.getMonth() + 1)}/${pad2(today.getDate())}`
  const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`

  // Sync internal input when external value changes
  React.useEffect(() => {
    if (value) {
      const parsed = normalizeDateInput(value)
      if (parsed) {
        setInputValue(parsed.display)
      } else if (value.includes("-")) {
        const [y, m, d] = value.split("-")
        setInputValue(`${y}/${m}/${d}`)
      }
    } else {
      setInputValue("")
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    val = val.replace(/[^\d/]/g, "")
    if (val.length > 10) val = val.slice(0, 10)
    setInputValue(val)
  }

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      onChange(null)
      setInputValue("")
      return
    }
    const normalized = normalizeDateInput(inputValue)
    if (normalized) {
      setInputValue(normalized.display)
      onChange(normalized.iso)
    } else {
      // Keep invalid value but don't update form
      // Optionally clear: setInputValue(""); onChange(null);
    }
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const d = date.getDate()
    const display = `${y}/${pad2(m)}/${pad2(d)}`
    const iso = `${y}-${pad2(m)}-${pad2(d)}`
    setInputValue(display)
    onChange(iso)
    setOpen(false)
  }

  const handleTodayClick = () => {
    setInputValue(todayDisplay)
    onChange(todayIso)
    setOpen(false)
  }

  const parsedDate = React.useMemo(() => {
    if (!value) return undefined
    try {
      return parse(value, "yyyy-MM-dd", new Date())
    } catch {
      return undefined
    }
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative flex items-center", className)}>
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={10}
            className="pr-8"
          />
          <CalendarIcon className="absolute right-2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs font-semibold"
            onClick={handleTodayClick}
          >
            Hoy: {todayDisplay}
          </Button>
          <Calendar
            mode="single"
            selected={parsedDate}
            onSelect={handleCalendarSelect}
            defaultMonth={parsedDate || today}
            initialFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
