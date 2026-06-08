import type { ModuleFormState } from './types'

export const DEFAULT_DENSE_INPUT_CLASS =
    'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

export const DEFAULT_READONLY_INPUT_CLASS =
    'h-8 w-full rounded-md border border-slate-200 bg-slate-100 px-2 text-sm text-slate-800'

export const DEFAULT_TEXTAREA_CLASS =
    'min-h-[88px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

export const DEFAULT_SELECT_CLASS =
    'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

export function round(value: number, decimals = 3): number {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
}

export function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

export function normalizeFlexibleDate(raw: string): string {
    const value = raw.trim()
    if (!value) return ''

    const digits = value.replace(/\D/g, '')
    const currentYear = String(new Date().getFullYear())
    const pad2 = (part: string) => part.padStart(2, '0').slice(-2)
    const normalizeYear = (part: string) => {
        const clean = part.replace(/\D/g, '')
        if (clean.length >= 4) return clean.slice(0, 4)
        if (clean.length === 2) return `20${clean}`
        if (clean.length === 1) return `200${clean}`
        return currentYear
    }
    const build = (year: string, month: string, day: string) =>
        `${normalizeYear(year)}/${pad2(month)}/${pad2(day)}`

    if (value.includes('/') || value.includes('-')) {
        const [a = '', b = '', c = ''] = value.split(/[/-]/).map((part) => part.trim())
        if (!a || !b) return value
        if (a.length === 4) return build(a, b, c || '01')
        if (c) return build(c, b, a)
        return value
    }

    if (digits.length === 8) {
        if (digits.startsWith('19') || digits.startsWith('20')) return build(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8))
        return build(digits.slice(4, 8), digits.slice(2, 4), digits.slice(0, 2))
    }
    if (digits.length === 6) return build(digits.slice(4, 6), digits.slice(2, 4), digits.slice(0, 2))
    if (digits.length === 5) return build(digits.slice(3, 5), digits.slice(1, 3), digits[0])
    if (digits.length === 4) return build(currentYear, digits.slice(0, 2), digits.slice(2, 4))
    if (digits.length === 3) return build(currentYear, digits[0], digits.slice(1, 3))
    if (digits.length === 2) return build(currentYear, digits[0], digits[1])

    return value
}

export function normalizeMuestraCode(raw: string): string {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = new Date().getFullYear().toString().slice(-2)
    const match = compact.match(/^(\d+)(?:-[A-Z0-9.]+)?(?:-(\d{2}))?$/)
    return match ? `${match[1]}-${match[2] || year}` : value
}

export function normalizeNumeroOtCode(raw: string): string {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = new Date().getFullYear().toString().slice(-2)
    const patterns = [/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/, /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/]

    for (const pattern of patterns) {
        const match = compact.match(pattern)
        if (match) return `${match[1]}-${match[2] || year}`
    }

    return value
}

export function buildFormatPreview(
    sampleCode: string | undefined,
    materialCode: 'AG' | 'SU',
    ensayo: string,
): string {
    const currentYear = new Date().getFullYear().toString().slice(-2)
    const normalized = (sampleCode || '').trim().toUpperCase()
    const fullMatch = normalized.match(/^(\d+)(?:-[A-Z0-9. ]+)?-(\d{2,4})$/)
    const partialMatch = normalized.match(/^(\d+)(?:-(\d{2,4}))?$/)
    const match = fullMatch || partialMatch
    const numero = match?.[1] || 'xxxx'
    const year = (match?.[2] || currentYear).slice(-2)
    return `Formato N-${numero}-${materialCode}-${year} ${ensayo}`
}

export function getByPath(source: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
        if (current === null || current === undefined) return undefined
        if (Array.isArray(current)) {
            const index = Number(segment)
            return Number.isInteger(index) ? current[index] : undefined
        }
        if (typeof current === 'object') {
            return (current as Record<string, unknown>)[segment]
        }
        return undefined
    }, source)
}

export function setByPath<T>(source: T, path: string, value: unknown): T {
    const segments = path.split('.')

    const update = (current: unknown, index: number): unknown => {
        const segment = segments[index]
        if (index === segments.length - 1) {
            if (Array.isArray(current)) {
                const next = [...current]
                next[Number(segment)] = value
                return next
            }
            return {
                ...(typeof current === 'object' && current !== null ? current as Record<string, unknown> : {}),
                [segment]: value,
            }
        }

        if (Array.isArray(current)) {
            const next = [...current]
            const arrayIndex = Number(segment)
            next[arrayIndex] = update(next[arrayIndex], index + 1)
            return next
        }

        const record = typeof current === 'object' && current !== null ? current as Record<string, unknown> : {}
        const nextSegment = segments[index + 1]
        const child =
            record[segment] ??
            (Number.isInteger(Number(nextSegment)) ? [] : {})

        return {
            ...record,
            [segment]: update(child, index + 1),
        }
    }

    return update(source, 0) as T
}

export function cloneWithDerive(
    state: ModuleFormState,
    path: string,
    value: unknown,
    derive: (next: ModuleFormState) => ModuleFormState,
): ModuleFormState {
    return derive(setByPath(state, path, value))
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}

export function emptyRow<T extends object>(factory: () => T, count: number): T[] {
    return Array.from({ length: count }, () => factory())
}
