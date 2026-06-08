import type { ReactNode } from 'react'

export type ModuleFormState = Record<string, unknown>

export type SelectOption = {
    label: string
    value: string
}

export type InputOptions = {
    placeholder?: string
    className?: string
    align?: 'left' | 'center' | 'right'
    normalizeOnBlur?: (value: string) => string
    step?: string
    min?: number
    max?: number
    rows?: number
}

export type RenderTools = {
    text: (path: string, options?: InputOptions) => ReactNode
    number: (path: string, options?: InputOptions) => ReactNode
    readonly: (path: string, options?: InputOptions) => ReactNode
    select: (path: string, options: InputOptions & { values: SelectOption[] }) => ReactNode
    textarea: (path: string, options?: InputOptions) => ReactNode
    value: (path: string) => unknown
    stringValue: (path: string) => string
    numberValue: (path: string) => number | null
}

export type ModuleConfig = {
    slug: string
    apiSlug: string
    title: string
    historyTitle: string
    formatCode: string
    heading: string
    standard: string
    materialCode: 'AG' | 'SU'
    downloadLabel: string
    draftKey: string
    defaultState: () => ModuleFormState
    derive: (state: ModuleFormState) => ModuleFormState
    renderBody: (tools: RenderTools) => ReactNode
}
