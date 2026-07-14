"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { User, Mail, Image as ImageIcon, Shield, Upload, RefreshCw, Download, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { updateOwnProfileAction } from "@/app/actions/auth-actions"
import { Loader2, AlertTriangle, Phone } from "lucide-react"
import { logActionClient as logAction } from "@/lib/audit-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { clearProfileAvatarDraft, setProfileAvatarDraft } from "@/lib/profile-avatar-draft"
import { downloadBackupFile, importBackupFile } from "@/lib/backup-service"

type PendingAvatar = {
  dataUrl: string
  fileName: string
  mimeType: string
} | null

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024

type ConfiguracionModuleProps = {
  onDirtyChange?: (hasDirtyChanges: boolean) => void
  registerActions?: (actions: {
    save: () => Promise<boolean>
    discard: () => Promise<boolean>
  }) => void
}

export function ConfiguracionModule({ onDirtyChange, registerActions }: ConfiguracionModuleProps) {
  const { user: currentUser, refreshUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar || "")
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar>(null)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const savedAvatarRef = useRef(currentUser?.avatar || "")
  const selectedAvatarFileRef = useRef<File | null>(null)
  const avatarReadGenerationRef = useRef(0)
  const avatarReadPromiseRef = useRef<Promise<void> | null>(null)
  const avatarReadResolveRef = useRef<(() => void) | null>(null)
  const avatarReadErrorRef = useRef<Error | null>(null)
  const pendingAvatarRef = useRef<PendingAvatar>(null)
  const [isAvatarReading, setIsAvatarReading] = useState(false)
  // const { toast } = useToast() // Replaced by Sonner

  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
  })

  useEffect(() => {
    const nextAvatar = currentUser?.avatar || ""
    setAvatarPreview(nextAvatar)

    // Cuando el avatar cambia por el draft local, useAuth vuelve a propagar ese
    // preview como currentUser.avatar. En ese caso no debemos limpiar el estado
    // pendiente, porque eso haría desaparecer la marca de "cambios sin guardar".
    if (!pendingAvatarRef.current && !isAvatarReading) {
      setFormData({
        name: currentUser?.name || "",
        email: currentUser?.email || "",
        phone: currentUser?.phone || "",
      })
      savedAvatarRef.current = nextAvatar
      setPendingAvatar(null)
      setShowDiscardDialog(false)
    }
  }, [currentUser?.avatar, currentUser?.email, currentUser?.name, currentUser?.phone, isAvatarReading])

  const hasUnsavedChanges = Boolean(
    pendingAvatar
    || isAvatarReading
    || formData.name !== (currentUser?.name || "")
    || formData.email !== (currentUser?.email || "")
    || formData.phone !== (currentUser?.phone || "")
  )

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

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

  const clearAvatarSelectionState = useCallback(() => {
    avatarReadGenerationRef.current += 1
    selectedAvatarFileRef.current = null
    avatarReadPromiseRef.current = null
    avatarReadResolveRef.current = null
    avatarReadErrorRef.current = null
    setIsAvatarReading(false)
  }, [])

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

    selectedAvatarFileRef.current = file
    setIsAvatarReading(true)
    const generation = ++avatarReadGenerationRef.current
    avatarReadErrorRef.current = null
    avatarReadPromiseRef.current = new Promise<void>((resolve) => {
      avatarReadResolveRef.current = resolve
    })
    const reader = new FileReader()
    reader.onload = () => {
      if (generation !== avatarReadGenerationRef.current) return

      const result = String(reader.result || "")
      const nextPendingAvatar = {
        dataUrl: result,
        fileName: file.name,
        mimeType: file.type,
      }

      setAvatarPreview(result)
      if (currentUser?.id) {
        setProfileAvatarDraft(currentUser.id, result)
      }
      pendingAvatarRef.current = nextPendingAvatar
      setPendingAvatar(nextPendingAvatar)
      setIsAvatarReading(false)
      avatarReadResolveRef.current?.()
      avatarReadPromiseRef.current = null
      avatarReadResolveRef.current = null
      avatarReadErrorRef.current = null
      setIsEditing(true)
    }
    reader.onerror = () => {
      if (generation !== avatarReadGenerationRef.current) return

      const error = new Error("No se pudo leer la imagen seleccionada.")
      selectedAvatarFileRef.current = null
      setIsAvatarReading(false)
      avatarReadErrorRef.current = error
      avatarReadResolveRef.current?.()
      avatarReadPromiseRef.current = null
      avatarReadResolveRef.current = null
      toast.error("Error al leer la imagen", {
        description: error.message,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleSave = useCallback(async () => {
    if (!currentUser) return false
    setIsLoading(true)
    try {
      if (isAvatarReading && avatarReadPromiseRef.current) {
        await avatarReadPromiseRef.current
      }

      if (avatarReadErrorRef.current) {
        throw avatarReadErrorRef.current
      }

      const resolvedAvatar = pendingAvatarRef.current || pendingAvatar
      const result = await updateOwnProfileAction({
        nombre: formData.name,
        email: formData.email,
        phone: formData.phone,
        avatarDataUrl: resolvedAvatar?.dataUrl || undefined,
        avatarFileName: resolvedAvatar?.fileName || undefined,
      })

      if (result.error) throw new Error(result.error)

      if (currentUser?.id) {
        clearProfileAvatarDraft(currentUser.id)
      }

      clearAvatarSelectionState()
      setPendingAvatar(null)
      pendingAvatarRef.current = null
      selectedAvatarFileRef.current = null

      await refreshUser()
      setShowDiscardDialog(false)

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
      return true
    } catch (err: any) {
      toast.error("Error", {
        description: err.message,
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [clearAvatarSelectionState, currentUser, formData.email, formData.name, formData.phone, isAvatarReading, pendingAvatar, refreshUser])

  const handleCancel = useCallback(async () => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true)
      return
    }
    setIsEditing(false)
  }, [hasUnsavedChanges])

  const discardChanges = useCallback(async () => {
    if (currentUser?.id) {
      clearProfileAvatarDraft(currentUser.id)
    }
    clearAvatarSelectionState()
    setPendingAvatar(null)
    pendingAvatarRef.current = null
    selectedAvatarFileRef.current = null
    setAvatarPreview(savedAvatarRef.current || "")
    setIsEditing(false)
    setShowDiscardDialog(false)
    await refreshUser()
    toast.info("Cambios descartados", {
      description: "Tu perfil volvió al estado guardado.",
    })
    return true
  }, [clearAvatarSelectionState, currentUser?.id, refreshUser])

  useEffect(() => {
    registerActions?.({
      save: handleSave,
      discard: discardChanges,
    })
  }, [discardChanges, handleSave, registerActions])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges])

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
            <Button variant="ghost" onClick={() => void handleCancel()} disabled={isLoading}>Cancelar</Button>
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
                      if (currentUser?.id) {
                        clearProfileAvatarDraft(currentUser.id)
                      }
                      setPendingAvatar(null)
                      pendingAvatarRef.current = null
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

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Copias de Seguridad (Borradores Locales)
          </CardTitle>
          <CardDescription>
            Respalda o restaura borradores de tus formularios de laboratorio (Densidad Huantar, Humedad, Compresión, etc.) persistidos en este navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-lg bg-secondary/10 p-4 md:flex-row md:items-center">
            <div className="space-y-3 w-full">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Gestión de datos de formularios sin guardar</p>
                <p className="text-xs text-muted-foreground">
                  Exporta tu avance a un archivo JSON o restaura borradores creados previamente en otro dispositivo o sesión.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => downloadBackupFile()}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Borradores (.json)
                </Button>
                
                <label className="inline-flex items-center">
                  <Input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (!file) return

                      const reader = new FileReader()
                      reader.onload = () => {
                        const content = String(reader.result || "")
                        const res = importBackupFile(content)
                        if (res.success) {
                          toast.success("Restauración exitosa", {
                            description: `Se importaron ${res.count} borradores de formularios. Recarga el módulo correspondiente para ver los cambios.`
                          })
                        } else {
                          toast.error("Error al restaurar", {
                            description: res.error || "No se pudo restaurar el archivo."
                          })
                        }
                      }
                      reader.readAsText(file)
                    }}
                  />
                  <span className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Borradores (.json)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué quieres hacer con los cambios?</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar en tu perfil. Puedes guardarlos ahora o descartarlos y volver a la versión anterior.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDiscardDialog(false)} disabled={isLoading}>
              Seguir editando
            </Button>
            <Button variant="secondary" onClick={() => void discardChanges()} disabled={isLoading}>
              Descartar cambios
            </Button>
            <Button onClick={() => void handleSave()} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
