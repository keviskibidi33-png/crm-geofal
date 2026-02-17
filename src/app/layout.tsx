import type React from "react"
import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"

import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/components/providers"
import { SecurityShield } from "@/components/security-shield"

const inter = Inter({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

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
