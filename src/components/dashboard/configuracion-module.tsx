"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { User, Mail, Image as ImageIcon, Shield, Upload, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { updateOwnProfileAction } from "@/app/actions/auth-actions"
import { Loader2, AlertTriangle, Phone } from "lucide-react"
import { logActionClient as logAction } from "@/lib/audit-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type PendingAvatar = {
  dataUrl: string
  fileName: string
  mimeType: string
} | null

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024

export function ConfiguracionModule() {
  const { user: currentUser, refreshUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar || "")
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // const { toast } = useToast() // Replaced by Sonner

  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
  })

  useEffect(() => {
    setFormData({
      name: currentUser?.name || "",
      email: currentUser?.email || "",
      phone: currentUser?.phone || "",
    })
    setAvatarPreview(currentUser?.avatar || "")
    setPendingAvatar(null)
  }, [currentUser?.avatar, currentUser?.email, currentUser?.name, currentUser?.phone])

  const getInitials = (name?: string | null) => {
    const value = String(name || "").trim()
    if (!value) return "?"
    return value
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2)
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Formato no permitido", {
        description: "Usa JPG, PNG, WEBP o GIF.",
      })
      return
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error("Archivo muy grande", {
        description: "La imagen no debe superar los 2 MB.",
      })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      setAvatarPreview(result)
      setPendingAvatar({
        dataUrl: result,
        fileName: file.name,
        mimeType: file.type,
      })
      setIsEditing(true)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const result = await updateOwnProfileAction({
        nombre: formData.name,
        email: formData.email,
        phone: formData.phone,
        avatarDataUrl: pendingAvatar?.dataUrl || undefined,
        avatarFileName: pendingAvatar?.fileName || undefined,
      })

      if (result.error) throw new Error(result.error)

      await refreshUser()

      toast.success("Perfil actualizado", {
        description: "Tus datos han sido guardados correctamente.",
      })

      // Log action
      logAction({
        user_id: currentUser.id,
        user_name: formData.name,
        action: "Actualizó su perfil personal",
        module: "CONFIGURACIÓN",
      })

      setIsEditing(false)
    } catch (err: any) {
      toast.error("Error", {
        description: err.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">Gestiona tu perfil y preferencias personales dentro del CRM</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>Editar Perfil</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isLoading}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        )}
      </div>

      {isEditing && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-3 text-warning">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">⚠️ Advertencia de Seguridad</p>
            <p className="opacity-90">Modificar tu correo electrónico afectará tus credenciales de acceso. Ten cuidado al realizar estos cambios.</p>
          </div>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Información de Perfil
          </CardTitle>
          <CardDescription>Datos básicos de tu cuenta vinculada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input
              value={isEditing ? formData.name : (currentUser?.name || "")}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              readOnly={!isEditing}
              className={!isEditing ? "bg-secondary/30" : "bg-background"}
            />
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={isEditing ? formData.email : (currentUser?.email || "")}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                readOnly={!isEditing}
                className={!isEditing ? "pl-10 bg-secondary/30" : "pl-10 bg-background"}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={isEditing ? formData.phone : (currentUser?.phone || "")}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                readOnly={!isEditing}
                className={!isEditing ? "pl-10 bg-secondary/30" : "pl-10 bg-background"}
                placeholder="Ej. 987654321"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Rol asignado</Label>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <Badge variant="outline" className="capitalize px-3 py-1 font-medium bg-primary/5 border-primary/20">
                {currentUser?.role === "admin" ? "Administrador" : (currentUser?.role || "Usuario")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Imagen de Perfil
          </CardTitle>
          <CardDescription>Esta imagen se muestra en el dashboard y cotizaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-lg bg-secondary/10 p-4 md:flex-row md:items-center">
            <div className="relative h-20 w-20 shrink-0">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarImage src={avatarPreview || currentUser?.avatar || ""} alt={currentUser?.name || "Avatar"} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                  {getInitials(currentUser?.name)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Personaliza tu icono de perfil</p>
                <p className="text-xs text-muted-foreground">
                  Sube una imagen para que aparezca en tu perfil y en las notificaciones que generes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Cambiar avatar
                </Button>
                {pendingAvatar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPendingAvatar(null)
                      setAvatarPreview(currentUser?.avatar || "")
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Descartar cambio
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground italic">
                Formatos admitidos: JPG, PNG, WEBP o GIF. Tamaño máximo: 2 MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
