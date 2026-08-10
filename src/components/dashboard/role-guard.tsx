"use client"

import type React from "react"
import type { User, UserRole } from "@/hooks/use-auth"
import { Shield } from "lucide-react"

interface RoleGuardProps {
  user: User
  allowedRoles: UserRole[]
  allowedEmails?: string[]
  children: React.ReactNode
}

export function RoleGuard({ user, allowedRoles, allowedEmails, children }: RoleGuardProps) {
  const isEmailAllowed =
    allowedEmails &&
    user.email &&
    allowedEmails.some((e) => user.email.toLowerCase().trim().includes(e.toLowerCase().trim()))

  if (!allowedRoles.includes(user.role) && !isEmailAllowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
        <p className="text-muted-foreground max-w-md">
          No tienes permisos para acceder a esta sección. Contacta a un administrador si necesitas acceso.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
