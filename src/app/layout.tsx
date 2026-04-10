import type React from "react"
import type { Metadata } from "next"

import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/components/providers"
import { SecurityShield } from "@/components/security-shield"


export const metadata: Metadata = {
  title: "Geofal CRM - Sistema de Gestión Inteligente",
  description: "Plataforma centralizada de Geofal para la gestión técnica, comercial y administrativa de proyectos de ingeniería.",
  keywords: ["CRM", "Geofal", "Ingeniería", "Gestión de Proyectos", "Laboratorio"],
  authors: [{ name: "Geofal Perú" }],
  robots: "noindex, nofollow", // CRM internals usually shouldn't be indexed
  openGraph: {
    title: "Geofal CRM",
    description: "Sistema de Gestión técnica y comercial",
    url: "https://crm.geofal.com.pe",
    siteName: "Geofal CRM",
    locale: "es_PE",
    type: "website",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/geofal.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body className={`font-sans antialiased h-screen overflow-hidden`} suppressHydrationWarning>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <SecurityShield />
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
