import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DataTablePaginationProps {
    currentPage: number
    totalPages: number
    pageSize: number
    totalItems: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
    pageSizeOptions?: number[]
    disabled?: boolean
}

export function DataTablePagination({
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
    disabled = false,
}: DataTablePaginationProps) {
    const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1))
    const safeTotalPages = Math.max(1, totalPages || 1)
    const hasData = totalItems > 0
    const showingFrom = hasData ? (safeCurrentPage - 1) * pageSize + 1 : 0
    const showingTo = hasData ? Math.min(safeCurrentPage * pageSize, totalItems) : 0

    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-md border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">
                Mostrando <span className="font-semibold text-foreground">{showingFrom}</span> a <span className="font-semibold text-foreground">{showingTo}</span> de <span className="font-semibold text-foreground">{totalItems}</span> registros
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium">
                    Filas por página:
                </label>
                <select
                    value={pageSize}
                    onChange={(e) => {
                        onPageSizeChange(Number(e.target.value))
                        onPageChange(1)
                    }}
                    className="h-8 rounded-md border bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    disabled={disabled}
                >
                    {pageSizeOptions.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>

                <div className="flex items-center gap-1 ml-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={disabled || safeCurrentPage <= 1}
                        onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
                        title="Página anterior"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[100px] text-center text-xs font-medium select-none">
                        Página <span className="font-bold text-foreground">{safeCurrentPage}</span> de <span className="font-bold text-foreground">{safeTotalPages}</span>
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={disabled || safeCurrentPage >= safeTotalPages}
                        onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
                        title="Página siguiente"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
