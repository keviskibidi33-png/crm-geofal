"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                refetchOnWindowFocus: false, // We rely on Realtime
            }
        }
    }))

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <Toaster richColors position="top-right" />
        </QueryClientProvider>
    )
}
